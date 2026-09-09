// lib/studylab/material/scope.ts
// The flat Record<string, number> every rule expression reads. evaluateExpr
// (lib/studylab/activities/expr.ts) can reach nothing but this object — no
// board, no spec, no state — so whatever a `derive`/`bind`/`when`/`allow`
// expression is allowed to name has to already be a key here.
//
// Names come in three kinds:
//   - `count_<groupId>`        — how many pieces currently sit in that group.
//   - `sum_<trait>_<groupId>`  — that numeric trait, summed over the pieces
//                                currently sitting in that group.
//   - a control's own `id`     — the student-facing value, defaulting to the
//                                control's declared `min` until touched.
//   - a `derive` rule's `name` — its expression evaluated against everything
//                                above it in this list, in declaration order.
//
// String traits (e.g. a `color` or `label` trait) are deliberately never
// summed — they exist for `Selector` matching ({ trait, equals/between }),
// not arithmetic, and "sum" over a string has no meaning. Only trait values
// that are `typeof === 'number'` (on at least one piece) get a `sum_*` name.
//
// `scopeNames` and `buildScope` share one derivation of "what names exist" —
// buildScope builds its object by walking the exact same groups/traits/
// controls/rules scopeNames walks — so the two cannot drift apart into
// disagreeing about which names are legal.
import type { MaterialSpec, MaterialState } from './types'
import { evaluateExpr } from '@/lib/studylab/activities/expr'

/** Every numeric trait key carried by at least one piece, in first-seen order. */
function numericTraitNames(spec: MaterialSpec): string[] {
  const seen = new Set<string>()
  for (const piece of spec.pieces) {
    for (const [trait, value] of Object.entries(piece.traits)) {
      if (typeof value === 'number') seen.add(trait)
    }
  }
  return [...seen]
}

/** pieceId -> groupId, resolved through the slot the piece is placed in. */
function groupOfPiece(spec: MaterialSpec, state: MaterialState, pieceId: string): string | undefined {
  const slotId = state.placement[pieceId]
  if (slotId === undefined) return undefined // not yet placed
  const slot = spec.slots.find((s) => s.id === slotId)
  return slot?.groupId // placement naming a slot that no longer exists resolves to nothing
}

/** Every name an expression in this material is allowed to use. */
export function scopeNames(spec: MaterialSpec): string[] {
  const names: string[] = []
  const traits = numericTraitNames(spec)
  for (const group of spec.groups) {
    names.push(`count_${group.id}`)
    for (const trait of traits) names.push(`sum_${trait}_${group.id}`)
  }
  for (const control of spec.controls ?? []) names.push(control.id)
  for (const rule of spec.rules) if (rule.op === 'derive') names.push(rule.name)
  return names
}

/** The scope's values for one instant of a material's state. */
export function buildScope(spec: MaterialSpec, state: MaterialState): Record<string, number> {
  const scope: Record<string, number> = {}
  const traits = numericTraitNames(spec)

  // Aggregates: count and per-trait sums, over the pieces resolved to each group.
  for (const group of spec.groups) {
    scope[`count_${group.id}`] = 0
    for (const trait of traits) scope[`sum_${trait}_${group.id}`] = 0
  }
  for (const piece of spec.pieces) {
    const groupId = groupOfPiece(spec, state, piece.id)
    if (groupId === undefined || scope[`count_${groupId}`] === undefined) continue // unplaced, or a dangling slot reference
    scope[`count_${groupId}`] += 1
    for (const trait of traits) {
      const value = piece.traits[trait]
      if (typeof value === 'number') scope[`sum_${trait}_${groupId}`] += value
    }
  }

  // Controls: the student's value, or the declared minimum until touched.
  for (const control of spec.controls ?? []) {
    scope[control.id] = state.controls[control.id] ?? control.min
  }

  // Derived names, in declaration order, each seeing every name above it.
  for (const rule of spec.rules) {
    if (rule.op !== 'derive') continue
    const value = evaluateExpr(rule.expr, scope)
    scope[rule.name] = value === null ? 0 : value // fails closed, same as evaluateExpr itself
  }

  return scope
}
