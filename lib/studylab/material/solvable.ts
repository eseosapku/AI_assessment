// lib/studylab/material/solvable.ts
// The check that makes a whole class of shipped bug impossible. See
// docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md
// ("Solvable") for the rationale: `compose` declared its legal bonds by
// label, nothing checked those labels named real parts, and one typo meant
// no bond was ever legal — a student sat in front of a material that could
// not be completed, with nothing to tell them why. Searching a closed
// language settles that question statically, before anyone sees it.
//
// The search is breadth-first over MaterialStates, reachable purely through
// `allowsMove`/`applyMove` (piece -> slot) and control-value changes, tested
// after each move with `tick(...).solved`. Two things about `tick` (Task 3)
// bear directly on this: placement goals (exactSet/exactOrder/binAssignment/
// pairing) report unsolved until every piece is placed, which shrinks the
// goal test but not the search; `numericWithin` carries no such guard, so an
// empty board can legitimately already be solved — `isSolvable` checks the
// untouched state itself, before generating a single successor, or a
// zero-move solution would never be found (and moves would be miscounted
// for anything found from it).
import { allowsMove, applyMove, tick } from './interpreter'
import type { Control, MaterialSpec, MaterialState } from './types'

/**
 * A Montessori material with a reachable state space this large is a bad
 * material anyway — a child cannot hold it. The cap is doing pedagogical
 * work, not only bounding compute; see the design doc's "Solvable" section.
 */
export const MAX_STATES = 50_000

/** A control's sampled values are capped here too — see `controlSamples`. */
const MAX_CONTROL_SAMPLES = 20

/**
 * Floating-point division can undershoot an exact grid count by a hair —
 * `1 / 0.1` computes to `9.999999999999998`, not `10` — which would flooring
 * straight through to a grid one point short, silently dropping `max`
 * itself off the sampled set. A small epsilon nudges only that near-integer
 * case over the line; it is far smaller than any real `step`, so a
 * genuinely fractional ratio (span 1, step 0.6 -> 1.667 steps fit, not 2)
 * is never rounded up past the boundary it actually has.
 */
const GRID_COUNT_EPSILON = 1e-9

/**
 * Discretises one control's continuous range into the values the search
 * treats as reachable settings. Below the cap this is exactly the control's
 * own step grid (min, min+step, min+2*step, ... up to max) — every value on
 * it is one a real slider can stop on. Above the cap — a control a student
 * would have to nudge through hundreds of values to find the right one is
 * not a material either — this must still only ever hand back values that
 * are ON that grid. Sampling `MAX_CONTROL_SAMPLES` points evenly across the
 * CONTINUOUS [min, max] range (the range, not the grid) would land almost
 * every sample off-step: it can certify a material solvable at a slider
 * position no interaction could ever reach, and can just as easily miss an
 * on-grid target the range-based points simply step over. So instead this
 * picks `MAX_CONTROL_SAMPLES` evenly spaced INDICES into the grid and snaps
 * each to its exact grid value — fewer of the grid's points are reachable
 * in one move than walking the whole grid would allow, but every sample
 * that is offered really is a value the control could be set to.
 */
function controlSamples(control: Control): number[] {
  const span = control.max - control.min
  if (!(span > 0) || !(control.step > 0)) return [control.min]

  const gridCount = Math.floor(span / control.step + GRID_COUNT_EPSILON) + 1
  if (gridCount <= MAX_CONTROL_SAMPLES) {
    return Array.from({ length: gridCount }, (_, i) => control.min + i * control.step)
  }

  const gridIndices = new Set<number>()
  for (let i = 0; i < MAX_CONTROL_SAMPLES; i++) {
    gridIndices.add(Math.round((i * (gridCount - 1)) / (MAX_CONTROL_SAMPLES - 1)))
  }
  return [...gridIndices].map((gridIndex) => control.min + gridIndex * control.step)
}

/**
 * A canonical string for the visited set. Placement is a `Record<pieceId,
 * slotId>` — two paths that place the same pieces on the same slots can
 * build that record by inserting keys in a different order, and
 * `Object.entries` would reflect that insertion order right back out. To
 * make two orderings of the same board hash identically, this reads
 * placement and controls off `spec.pieces`/`spec.controls` — one fixed,
 * spec-defined order — rather than off whatever order the state object's
 * own keys happen to be in.
 *
 * `attempts`, `rejectedMoves` and `status` are left out on purpose: neither
 * `buildScope` (scope.ts) nor `evaluateGoal` (interpreter.ts) ever reads
 * them, so two states that differ only there behave identically under
 * `tick` and must count as one state, not two, or the visited set would
 * undercount how much of the space is already explored.
 */
function canonicalKey(spec: MaterialSpec, state: MaterialState): string {
  const placement = spec.pieces.map((p) => state.placement[p.id] ?? null)
  const controls = (spec.controls ?? []).map((c) => state.controls[c.id] ?? c.min)
  return JSON.stringify([placement, controls])
}

/** The untouched state every search starts from: nothing placed, every control at its declared minimum. */
function initialState(spec: MaterialSpec): MaterialState {
  return {
    placement: {},
    controls: Object.fromEntries((spec.controls ?? []).map((c) => [c.id, c.min])),
    attempts: 0,
    rejectedMoves: [],
    status: 'untouched',
  }
}

/**
 * Every state one move away from `state`: every `(piece, slot)` pair
 * `allowsMove` permits, plus — because controls make the space continuous
 * rather than absent from it — every other discretised value of every
 * control. A move that would not change anything (a piece offered its own
 * slot again) is skipped; it can only ever re-derive a state already in the
 * visited set, so generating it wastes a `canonicalKey`/lookup for no gain.
 */
function* successorsOf(spec: MaterialSpec, state: MaterialState): Generator<MaterialState> {
  for (const piece of spec.pieces) {
    for (const slot of spec.slots) {
      if (state.placement[piece.id] === slot.id) continue
      if (!allowsMove(spec, state, { pieceId: piece.id, slotId: slot.id })) continue
      yield applyMove(spec, state, { pieceId: piece.id, slotId: slot.id })
    }
  }

  for (const control of spec.controls ?? []) {
    const current = state.controls[control.id] ?? control.min
    for (const value of controlSamples(control)) {
      if (value === current) continue
      yield { ...state, controls: { ...state.controls, [control.id]: value } }
    }
  }
}

/**
 * Breadth-first search over reachable `MaterialState`s. Returns the number
 * of moves in the shortest winning sequence the moment one is found — BFS
 * visits states in non-decreasing move count, so the first solved state
 * seen is reached in the fewest moves possible — `{ ok: false, reason:
 * 'unreachable' }` once the frontier empties with nothing solved, or `{ ok:
 * false, reason: 'too-large' }` the instant the visited set would exceed
 * `MAX_STATES`.
 *
 * The cap is checked right where a state is admitted to the visited set —
 * immediately after the lookup that proves it is new, before `tick` runs
 * against it — rather than once per BFS level or once per call. Checking
 * per-level would let a single level's fan-out (branching is `pieces *
 * slots`, easily in the hundreds) run to completion first, doing all of its
 * `allowsMove`/`applyMove`/`tick` work before the excess was ever noticed;
 * checking here stops the search on the exact state that would have pushed
 * it over, so the worst case is bounded by `MAX_STATES` successor
 * evaluations, not by the size of one uncapped level.
 */
export function isSolvable(spec: MaterialSpec): { ok: true; moves: number } | { ok: false; reason: 'unreachable' | 'too-large' } {
  const start = initialState(spec)
  if (tick(spec, start).solved) return { ok: true, moves: 0 }

  const visited = new Set<string>([canonicalKey(spec, start)])
  let frontier = [start]
  let moves = 0

  while (frontier.length > 0) {
    moves += 1
    const next: MaterialState[] = []
    for (const state of frontier) {
      for (const successor of successorsOf(spec, state)) {
        const key = canonicalKey(spec, successor)
        if (visited.has(key)) continue
        visited.add(key)
        if (visited.size > MAX_STATES) return { ok: false, reason: 'too-large' }
        if (tick(spec, successor).solved) return { ok: true, moves }
        next.push(successor)
      }
    }
    frontier = next
  }

  return { ok: false, reason: 'unreachable' }
}
