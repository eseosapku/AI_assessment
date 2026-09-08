import type { ComparePayload, PatternModule, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'
import { COMPARE_ZONE } from '../dropZoneGeometry'

export interface CompareWork { assign: Record<string, 'left' | 'right' | 'both'> }

/**
 * Ceiling on how many authored items may share one `belongs` value.
 *
 * `belongs` does not gate where a student may drop an item — there is no
 * `accepts()` for compare, so any item can land in any of the three drawn
 * zones — but it is how items are *expected* to sort, so this bounds the
 * zone each bucket lands in under normal (correct) use, the same way
 * balance.ts bounds each pan's authored group.
 *
 * All three zones share the same `top: 31.8%` anchor and the same
 * `COMPARE_ZONE.headroomPx` of headroom below it before a zone would grow
 * past the bottom of its own drawn crescent/lens (see `dropZoneGeometry.ts`
 * for the full derivation from the card's actual content width, the Venn
 * diagram's aspect ratio, and one chip row's height — even the widest
 * "both" zone is too narrow for two average item labels per row). As with
 * balance, a student can still drag every item into one narrow zone at
 * runtime; CompareActivity.tsx's `max-height` is the backstop for that, not
 * this cap.
 */
const MAX_ITEMS_PER_BUCKET = COMPARE_ZONE.maxItems

export const compareModule: PatternModule<ComparePayload, CompareWork> = {
  pattern: 'compare',

  initialWork(): CompareWork {
    return { assign: {} }
  },

  validate(payload: ComparePayload, work: CompareWork, success: SuccessRule): ValidateResult {
    // Every item must be placed before we judge — an unfinished board is not "wrong".
    const assign = work.assign ?? {}
    if (Object.keys(assign).length < payload.items.length) return { ok: false, wrongIds: [] }
    return evaluateSuccess(success, { assign })
  },

  // No accepts(): a wrong placement stands until Check, then is highlighted via wrongIds.

  isPayload(p: unknown): p is ComparePayload {
    const x = p as ComparePayload
    if (!(
      !!x && typeof x === 'object' &&
      Array.isArray(x.sets) && x.sets.length === 2 &&
      x.sets.every((s) => typeof s?.id === 'string' && typeof s?.label === 'string') &&
      Array.isArray(x.items) && x.items.length > 0 &&
      x.items.every((i) => typeof i?.id === 'string' && ['left', 'right', 'both'].includes(i?.belongs))
    )) return false
    const ids = new Set(x.items.map((i) => i.id))
    if (ids.size !== x.items.length) return false // duplicate item ids would collide in `assign`
    const bucketCounts = { left: 0, right: 0, both: 0 }
    for (const i of x.items) bucketCounts[i.belongs]++
    if (Object.values(bucketCounts).some((n) => n > MAX_ITEMS_PER_BUCKET)) return false
    return true
  },
}
