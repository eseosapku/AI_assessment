// lib/studylab/activities/patterns/compose.ts
import type { ComposePayload, PatternModule, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'

export interface ComposeWork { joins: [string, string][] }

/** How many bonds a given part instance already has. */
export function joinCount(joins: [string, string][], partId: string): number {
  return joins.filter(([a, b]) => a === partId || b === partId).length
}

/**
 * Canonical join-id normaliser — the SINGLE source of truth for this pattern's
 * join-id convention. A join is identified by its two part ids, SORTED and
 * hyphenated (['o1','h1'].sort().join('-') -> 'h1-o1'), so the student's drag
 * order never matters when comparing against the target set in `success`.
 * `success.itemIds` must be authored to match this exact normalisation.
 *
 * Exported so `ComposeActivity.tsx` imports THIS function rather than
 * re-declaring its own copy — two independently-maintained copies could drift
 * (a different separator, a numeric sort) and silently mis-grade, with each
 * file's own tests still passing against its own copy.
 */
export const joinId = (a: string, b: string) => [a, b].sort().join('-')

const finite = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n)
const positiveInt = (n: unknown): boolean => finite(n) && Number.isInteger(n) && (n as number) > 0
const nonEmptyString = (s: unknown): boolean => typeof s === 'string' && s.length > 0

export const composeModule: PatternModule<ComposePayload, ComposeWork> = {
  pattern: 'compose',

  initialWork(): ComposeWork {
    return { joins: [] }
  },

  validate(_payload, work, success: SuccessRule): ValidateResult {
    // No joins made yet is not "wrong" — an empty board is unfinished, not a
    // misconception. Without this guard, exactSet's `missing` reports the
    // ENTIRE correct answer as wrongIds, and describeOutcome would tell the
    // tutor the student made specific bonding errors they never made.
    const joins = work.joins ?? []
    if (joins.length === 0) return { ok: false, wrongIds: [] }
    // The built structure must match the target EXACTLY (exactSet, not a
    // subset relation) - an extra bond is as wrong as a missing one.
    const set = joins.map(([a, b]) => joinId(a, b))
    return evaluateSuccess(success, { set })
  },

  // Control of error: a join is only legal when it connects two DIFFERENT
  // known parts, the pair's labels appear in validJoins (either order), that
  // exact bond does not already exist, and both parts still have a free slot.
  accepts(payload, work, move): boolean {
    const from = payload.parts.find((p) => p.id === move.itemId)
    const to = payload.parts.find((p) => p.id === move.targetId)
    if (!from || !to || from.id === to.id) return false
    const legal = payload.validJoins.some(
      (j) => (j.a === from.label && j.b === to.label) || (j.a === to.label && j.b === from.label),
    )
    if (!legal) return false
    const joins = work.joins ?? []
    if (joins.some(([a, b]) => joinId(a, b) === joinId(from.id, to.id))) return false
    return joinCount(joins, from.id) < from.slots && joinCount(joins, to.id) < to.slots
  },

  isPayload(p: unknown): p is ComposePayload {
    const x = p as ComposePayload
    if (!x || typeof x !== 'object') return false
    if (!Array.isArray(x.parts) || x.parts.length < 2) return false
    if (
      !x.parts.every(
        (i) => !!i && typeof i === 'object' && nonEmptyString(i.id) && nonEmptyString(i.label) && positiveInt(i.slots),
      )
    ) {
      return false
    }
    const ids = new Set(x.parts.map((i) => i.id))
    if (ids.size !== x.parts.length) return false // duplicate part ids would make join ids ambiguous
    if (!Array.isArray(x.validJoins) || x.validJoins.length === 0) return false
    if (!x.validJoins.every((j) => !!j && typeof j === 'object' && nonEmptyString(j.a) && nonEmptyString(j.b))) return false
    if (!x.target || typeof x.target !== 'object' || !nonEmptyString(x.target.label)) return false
    return true
  },
}
