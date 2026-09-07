import type { PatternModule, SortPayload, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'

export interface SortWork { assign: Record<string, string> }

export const sortModule: PatternModule<SortPayload, SortWork> = {
  pattern: 'sort',

  initialWork(): SortWork {
    return { assign: {} }
  },

  validate(payload: SortPayload, work: SortWork, success: SuccessRule): ValidateResult {
    // Every item must be placed before we judge — an unfinished board is not "wrong".
    const placed = Object.keys(work.assign ?? {})
    if (placed.length < payload.items.length) return { ok: false, wrongIds: [] }
    return evaluateSuccess(success, { assign: work.assign })
  },

  // Control of error: a bin physically refuses an item that does not belong to it.
  accepts(payload: SortPayload, _work: SortWork, move): boolean {
    const item = payload.items.find((i) => i.id === move.itemId)
    if (!item) return false
    if (!payload.bins.some((b) => b.id === move.targetId)) return false
    return item.binId === move.targetId
  },

  isPayload(p: unknown): p is SortPayload {
    const x = p as SortPayload
    if (!(
      !!x && typeof x === 'object' &&
      Array.isArray(x.bins) && x.bins.length > 0 &&
      Array.isArray(x.items) && x.items.length > 0 &&
      x.bins.every((b) => typeof b?.id === 'string' && typeof b?.label === 'string') &&
      x.items.every((i) => typeof i?.id === 'string' && typeof i?.label === 'string' && typeof i?.binId === 'string')
    )) return false
    const itemIds = new Set(x.items.map((i) => i.id))
    if (itemIds.size !== x.items.length) return false // duplicate item ids would collide in `assign`
    const binIds = new Set(x.bins.map((b) => b.id))
    // An item whose binId matches no declared bin is refused by every bin's
    // `accepts` check — it could never be placed, so the board could never
    // reach "every item placed" and would sit unsolvable forever.
    if (x.items.some((i) => !binIds.has(i.binId))) return false
    return true
  },
}
