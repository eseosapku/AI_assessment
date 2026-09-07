import type { ComparePayload, PatternModule, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'

export interface CompareWork { assign: Record<string, 'left' | 'right' | 'both'> }

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
    return true
  },
}
