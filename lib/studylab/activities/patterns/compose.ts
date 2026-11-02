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

/** The two parts a written bond joins, whichever way its ids read. */
function partsOf(payload: ComposePayload, bond: string): [ComposePayload['parts'][number], ComposePayload['parts'][number]] | null {
  for (const a of payload.parts) {
    for (const b of payload.parts) {
      if (a.id !== b.id && joinId(a.id, b.id) === bond) return [a, b]
    }
  }
  return null
}

/** 3, 2.5, 5x, x^2, $x^2$: terms of a sum, not things that bond. */
const NUMBER = /^\d+(\.\d+)?$/
const TERM = /^\d+[a-z]$|^\d*[a-z](\^\d+|\u00b2|\u00b3)$/

/**
 * Bonds mean nothing in algebra. Asked to expand a bracket with this material, the
 * model wrote rules no reasoning could reach, and it kept doing so when told not to.
 */
export function isAlgebra(payload: ComposePayload): boolean {
  return payload.parts.some((p) => {
    const label = p.label.replace(/[$\s]/g, '')
    return NUMBER.test(label) || TERM.test(label)
  })
}

export const COMPOSE_IS_NOT_ALGEBRA =
  'The "compose" material joins real things, like atoms into a molecule. Its bonds mean nothing for algebra or arithmetic, so nothing was built. For a method in maths use a "sequence" of its steps, a "balance", or a practice card that asks for the working.'

/** What a bond means, by the names of what it joins. */
const namesOf = (a: string, b: string) => [a, b].sort().join('\u0000')

const finite = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n)
const positiveInt = (n: unknown): boolean => finite(n) && Number.isInteger(n) && (n as number) > 0
const nonEmptyString = (s: unknown): boolean => typeof s === 'string' && s.length > 0

export const composeModule: PatternModule<ComposePayload, ComposeWork> = {
  pattern: 'compose',

  initialWork(): ComposeWork {
    return { joins: [] }
  },

  validate(payload, work, success: SuccessRule): ValidateResult {
    // No joins made yet is not "wrong" — an empty board is unfinished, not a
    // misconception. Without this guard, exactSet's `missing` reports the
    // ENTIRE correct answer as wrongIds, and describeOutcome would tell the
    // tutor the student made specific bonding errors they never made.
    const joins = work.joins ?? []
    if (joins.length === 0) return { ok: false, wrongIds: [] }
    // The built structure must match the target EXACTLY (exactSet, not a
    // subset relation) - an extra bond is as wrong as a missing one.
    const set = joins.map(([a, b]) => joinId(a, b))
    const result = evaluateSuccess(success, { set })
    if (result.ok || success.kind !== 'exactSet') return result
    // Parts with one name are interchangeable: joining the second H where the rule
    // names the first builds the same molecule, and must not be marked wrong.
    const label = (id: string) => payload.parts.find((p) => p.id === id)?.label ?? id
    const built = joins.map(([a, b]) => namesOf(label(a), label(b))).sort()
    const wanted = success.itemIds.flatMap((id) => {
      const pair = partsOf(payload, id)
      return pair ? [namesOf(pair[0].label, pair[1].label)] : []
    }).sort()
    const same = built.length === wanted.length && built.every((name, i) => name === wanted[i])
    return same ? { ok: true, wrongIds: [] } : result
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

  // Every bond the rule asks for has to be one a learner can make: two different
  // parts, a legal pair, and no part asked for more bonds than it has slots.
  canBeMet(payload, success): boolean {
    if (isAlgebra(payload)) return false
    if (success.kind !== 'exactSet') return true
    const used = new Map<string, number>()
    for (const bond of success.itemIds) {
      const pair = partsOf(payload, bond)
      if (!pair) return false
      const legal = payload.validJoins.some((j) => namesOf(j.a, j.b) === namesOf(pair[0].label, pair[1].label))
      if (!legal) return false
      for (const part of pair) used.set(part.id, (used.get(part.id) ?? 0) + 1)
    }
    return payload.parts.every((p) => (used.get(p.id) ?? 0) <= p.slots)
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
    // Every join must name parts that resolve. `accepts` matches a validJoins
    // pair against part LABELS (not ids — see the comment there), so nothing
    // checked that a validJoins label actually names a part. One mistyped
    // label meant no bond was ever legal and nothing said so — the student
    // cannot finish and cannot tell why.
    const labels = new Set(x.parts.map((part) => part.label))
    if (!x.validJoins.every((j) => labels.has(j.a) && labels.has(j.b))) return false
    if (!x.target || typeof x.target !== 'object' || !nonEmptyString(x.target.label)) return false
    return true
  },
}
