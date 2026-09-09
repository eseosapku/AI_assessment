// lib/studylab/material/isolation.ts
// The deepest Montessori principle, made checkable: the pink tower varies
// size and nothing else — not colour, not shape, not material. In a closed
// vocabulary of traits that stops being taste and becomes a count of how
// many trait keys differ across a material's pieces.
import type { MaterialSpec } from './types'

/**
 * Every trait key that differs somewhere across `spec.pieces`. A key absent
 * from one piece but present on another counts as differing — the value
 * "not present" is itself a distinct value, not something to skip past. A
 * trait present on every piece with the exact same value does not vary,
 * including when it is absent from every piece alike (never appears in the
 * union at all, so there is nothing to compare).
 *
 * Order is not meaningful; callers needing a stable order (tests included)
 * sort the result themselves.
 */
export function varyingTraits(spec: MaterialSpec): string[] {
  const keys = new Set<string>()
  for (const piece of spec.pieces) {
    for (const key of Object.keys(piece.traits)) keys.add(key)
  }

  const MISSING = Symbol('missing')
  const varying: string[] = []
  for (const key of keys) {
    const values = spec.pieces.map((p) => (key in p.traits ? p.traits[key] : MISSING))
    const first = values[0]
    if (values.some((v) => v !== first)) varying.push(key)
  }
  return varying
}

/**
 * Refuses a material that varies more traits than its apparatus allows to
 * isolate, and refuses one that varies none at all — a material offering no
 * decision teaches nothing, the same fault as a sorting frame whose items
 * all land in one bin.
 */
export function checkIsolation(
  spec: MaterialSpec,
  maxVarying: number,
): { ok: true } | { ok: false; reason: string } {
  const varying = varyingTraits(spec)

  if (varying.length === 0) {
    return { ok: false, reason: 'This material varies nothing across its pieces — there is no decision for the student to make.' }
  }

  if (varying.length > maxVarying) {
    return {
      ok: false,
      reason: `This material varies ${varying.length} traits (${varying.join(', ')}), but its apparatus isolates at most ${maxVarying}.`,
    }
  }

  return { ok: true }
}
