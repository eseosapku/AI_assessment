// lib/studylab/material/interpreter.ts
// The tick that makes a material behave. See
// docs/superpowers/specs/2026-09-07-studylab-composable-material-engine-design.md
// ("Evaluation") for the seven numbered steps this file implements:
//
//   1. Apply the move if an `allow` rule permits it; otherwise refuse it,
//      spring the piece back, and record it in `rejectedMoves`.
//   2. Recompute aggregates from the board.
//   3. Evaluate `derive` rules in declaration order.
//   4. Evaluate `bind` rules.
//   5. Evaluate `when` rules once, in declaration order, applying effects.
//   6. Re-run 2-4 once so bindings see the effects.
//   7. Evaluate the goal.
//
// Step 1 is `applyMove`/`allowsMove`; steps 2-7 are `tick`. Two passes, not a
// fixed point — a rule set that would need a third pass is rejected by
// `hasCycle` at validation time, which is what keeps a tick O(rules) and the
// Task 6 solvability search tractable.
import { evaluateExpr } from '@/lib/studylab/activities/expr'
import { evaluateSuccess, type SuccessInput } from '@/lib/studylab/activities/success'
import type { SuccessRule } from '@/lib/studylab/activities/types'
import { buildScope } from './scope'
import type { Effect, MaterialSpec, MaterialState, Piece, Predicate, Rule, Selector } from './types'

export interface TickResult {
  scope: Record<string, number>
  displays: Record<string, number>
  says: string[]
  solved: boolean
}

// ---------------------------------------------------------------------------
// Selectors and predicates — closed matchers, never arbitrary code.
// ---------------------------------------------------------------------------

function matchesSelector(selector: Selector, piece: Piece): boolean {
  if ('trait' in selector) {
    const value = piece.traits[selector.trait]
    if ('equals' in selector) return value === selector.equals
    const [lo, hi] = selector.between
    return typeof value === 'number' && value >= lo && value <= hi
  }
  return selector.anyOf.some((s) => matchesSelector(s, piece))
}

function evaluatePredicate(predicate: Predicate, scope: Record<string, number>): boolean {
  if ('all' in predicate) return predicate.all.every((p) => evaluatePredicate(p, scope))
  if ('any' in predicate) return predicate.any.some((p) => evaluatePredicate(p, scope))
  const left = evaluateExpr(predicate.left, scope)
  const right = evaluateExpr(predicate.right, scope)
  // A side that fails to evaluate makes the comparison unresolvable, not
  // vacuously true — the same fail-closed stance evaluateExpr itself takes.
  if (left === null || right === null) return false
  switch (predicate.cmp) {
    case '<': return left < right
    case '<=': return left <= right
    case '>': return left > right
    case '>=': return left >= right
    case '==': return left === right
    case '!=': return left !== right
  }
}

// ---------------------------------------------------------------------------
// derive + bind — the two passes tick runs before and after `when`.
// ---------------------------------------------------------------------------

/**
 * Runs every `derive` rule (in declaration order, writing into `scope` as it
 * goes so a later derive can read an earlier one), then every `bind` rule
 * into a fresh `displays` record. A display's value is also written back into
 * `scope` under its own id — the design's "expressions read derived names,
 * control values, display values, and aggregates" — so a `when` predicate or
 * a later rule can name a display directly.
 *
 * A `derive`/`bind` expression that fails to evaluate (`evaluateExpr` returns
 * `null` — names nothing, divides by zero, etc.) leaves its name ABSENT from
 * `scope`/`displays` rather than writing a `0`. Folding "unresolvable" into a
 * real number would let a material teach from a silent zero.
 */
function runDeriveAndBind(spec: MaterialSpec, scope: Record<string, number>): Record<string, number> {
  for (const rule of spec.rules) {
    if (rule.op !== 'derive') continue
    const value = evaluateExpr(rule.expr, scope)
    if (value === null) delete scope[rule.name]
    else scope[rule.name] = value
  }

  const displays: Record<string, number> = {}
  for (const rule of spec.rules) {
    if (rule.op !== 'bind') continue
    const value = evaluateExpr(rule.expr, scope)
    if (value === null) {
      delete scope[rule.target]
      continue
    }
    displays[rule.target] = value
    scope[rule.target] = value
  }
  return displays
}

function applyEffect(effect: Effect, scope: Record<string, number>, says: string[]): void {
  if ('say' in effect) {
    says.push(effect.say)
    return
  }
  const value = evaluateExpr(effect.expr, scope)
  if (value === null) delete scope[effect.set]
  else scope[effect.set] = value
}

// ---------------------------------------------------------------------------
// Goal evaluation — placement converted into the existing success algebra.
// ---------------------------------------------------------------------------

/**
 * Goal kinds whose truth depends on the board being finished. Carried over
 * from `sortModule.validate` (lib/studylab/activities/patterns/sort.ts):
 * "Every item must be placed before we judge — an unfinished board is not
 * 'wrong'." `numericWithin` is deliberately excluded — a balance's
 * `numericWithin` goal can be (and, empty, is) satisfied with nothing placed.
 */
const PLACEMENT_GOAL_KINDS = new Set(['exactSet', 'exactOrder', 'binAssignment', 'pairing'])

function isPlacementGoal(rule: SuccessRule): boolean {
  if (rule.kind === 'allSubgoals') return rule.subgoals.some(isPlacementGoal)
  return PLACEMENT_GOAL_KINDS.has(rule.kind)
}

function isPiecePlaced(spec: MaterialSpec, state: MaterialState, pieceId: string): boolean {
  const slotId = state.placement[pieceId]
  return slotId !== undefined && spec.slots.some((s) => s.id === slotId)
}

function allPiecesPlaced(spec: MaterialSpec, state: MaterialState): boolean {
  return spec.pieces.every((p) => isPiecePlaced(spec, state, p.id))
}

/** Converts the board's placement into the shape `evaluateSuccess` reads. */
function buildSuccessInput(spec: MaterialSpec, state: MaterialState, displays: Record<string, number>): SuccessInput {
  const slotById = new Map(spec.slots.map((s) => [s.id, s]))
  const groupById = new Map(spec.groups.map((g) => [g.id, g]))

  // Pieces whose placement names a slot that actually exists — a dangling
  // reference resolves to "not placed", the same treatment scope.ts gives it.
  const placedIds = spec.pieces.map((p) => p.id).filter((id) => isPiecePlaced(spec, state, id))

  const assign: Record<string, string> = {}
  const orderedEntries: { index: number; pieceId: string }[] = []

  for (const pieceId of placedIds) {
    const slotId = state.placement[pieceId]
    const slot = slotById.get(slotId)!
    assign[pieceId] = slot.groupId
    const group = groupById.get(slot.groupId)
    if (group?.ordered && typeof slot.index === 'number') {
      orderedEntries.push({ index: slot.index, pieceId })
    }
  }
  orderedEntries.sort((a, b) => a.index - b.index)

  // `numericWithin` reads the sole `bind` rule's display value. With zero or
  // more than one bind rule there is no way to know which display the goal
  // means, so `value` is left undefined rather than guessing.
  const bindRules = spec.rules.filter((r): r is Extract<Rule, { op: 'bind' }> => r.op === 'bind')
  const value = bindRules.length === 1 ? displays[bindRules[0].target] : undefined

  // No `pairs` conversion: the vocabulary has no settled notion of what a
  // `pairing` goal pairs. The two existing consumers of `pairing`
  // (lib/studylab/activities/patterns/label.ts, threePeriod.ts) pair a piece
  // id with a content value — a label string, an answer — never with a slot
  // id, so `[pieceId, slotId]` would just be `binAssignment` restated. The
  // canon's `matching-pairs` apparatus most naturally wants a piece-to-piece
  // correspondence instead (an atom card matched to its symbol card), a third
  // shape again. `PLACEMENT_GOAL_KINDS` still lists `pairing`, so a `pairing`
  // goal on an unfinished board still reports unsolved; on a finished board
  // with no `pairs` supplied, `evaluateSuccess`'s own length check fails it
  // closed rather than passing it open. Whichever canon entry first needs
  // `pairing` defines the mapping and lands it with a test.
  return {
    set: placedIds,
    assign,
    order: orderedEntries.map((e) => e.pieceId),
    value,
  }
}

function evaluateGoal(spec: MaterialSpec, state: MaterialState, displays: Record<string, number>): boolean {
  if (isPlacementGoal(spec.goal) && !allPiecesPlaced(spec, state)) return false
  return evaluateSuccess(spec.goal, buildSuccessInput(spec, state, displays)).ok
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function tick(spec: MaterialSpec, state: MaterialState): TickResult {
  const scope = buildScope(spec, state)

  // Pass 1: derive, then bind.
  runDeriveAndBind(spec, scope)

  // `when` rules fire once, in declaration order, against the pass-1 scope.
  const says: string[] = []
  for (const rule of spec.rules) {
    if (rule.op !== 'when') continue
    if (!evaluatePredicate(rule.predicate, scope)) continue
    for (const effect of rule.then) applyEffect(effect, scope, says)
  }

  // Pass 2: refresh the board-generated aggregates (harmless — the board
  // hasn't moved within a tick — but faithful to step 6) and re-run
  // derive + bind so a binding can see whatever a `when` effect just set.
  Object.assign(scope, buildScope(spec, state))
  const displays = runDeriveAndBind(spec, scope)

  const solved = evaluateGoal(spec, state, displays)
  return { scope, displays, says, solved }
}

export function allowsMove(spec: MaterialSpec, state: MaterialState, move: { pieceId: string; slotId: string }): boolean {
  const slot = spec.slots.find((s) => s.id === move.slotId)
  const piece = spec.pieces.find((p) => p.id === move.pieceId)
  if (!slot || !piece) return false

  // Capacity — a slot already full refuses anything else, regardless of `allow`.
  const occupants = Object.entries(state.placement)
    .filter(([pieceId, slotId]) => slotId === slot.id && pieceId !== move.pieceId).length
  if (occupants >= slot.capacity) return false

  // `allow` — control of error at the moment of action. A group nobody
  // constrained is open: silence is not a prohibition. Multiple `allow`
  // rules naming the same group are additive (OR): matching any one admits.
  const allowRules = spec.rules.filter((r): r is Extract<Rule, { op: 'allow' }> => r.op === 'allow' && r.groupId === slot.groupId)
  if (allowRules.length === 0) return true
  return allowRules.some((r) => matchesSelector(r.selector, piece))
}

export function applyMove(spec: MaterialSpec, state: MaterialState, move: { pieceId: string; slotId: string }): MaterialState {
  if (!allowsMove(spec, state, move)) {
    // The piece springs back — placement is untouched — but the attempt is
    // recorded. Without it, a move blocked by `allow` could never be
    // reported as the misconception signal it is.
    return { ...state, rejectedMoves: [...state.rejectedMoves, { pieceId: move.pieceId, slotId: move.slotId }] }
  }
  return {
    ...state,
    placement: { ...state.placement, [move.pieceId]: move.slotId },
    attempts: state.attempts + 1,
  }
}

/**
 * Every identifier-shaped token an expression mentions — a superset of the
 * scope names it actually reads (function names like `min` end up in here
 * too), which is fine: a name that never appears as a `derive` is a graph
 * leaf with no outgoing edges, so it can never be part of a cycle.
 */
function identifiersIn(expr: string): string[] {
  return [...new Set(expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [])]
}

/**
 * A `derive` rule's dependency graph must be acyclic — that is what lets
 * `tick` run two passes instead of iterating to a fixed point. Depth-first
 * search with a three-colour visited set catches both direct self-reference
 * (`x = x + 1`) and a cycle spread across several derives.
 */
export function hasCycle(spec: MaterialSpec): boolean {
  const graph = new Map<string, string[]>()
  for (const rule of spec.rules) {
    if (rule.op === 'derive') graph.set(rule.name, identifiersIn(rule.expr))
  }

  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()

  function visit(node: string): boolean {
    const c = color.get(node) ?? WHITE
    if (c === GRAY) return true
    if (c === BLACK) return false
    color.set(node, GRAY)
    for (const dep of graph.get(node) ?? []) {
      if (visit(dep)) return true
    }
    color.set(node, BLACK)
    return false
  }

  for (const name of graph.keys()) {
    if (visit(name)) return true
  }
  return false
}
