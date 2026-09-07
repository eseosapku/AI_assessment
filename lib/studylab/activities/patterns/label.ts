import type { LabelPayload, PatternModule, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'

export interface LabelWork { assign: Record<string, string> }

export const labelModule: PatternModule<LabelPayload, LabelWork> = {
  pattern: 'label',

  initialWork(): LabelWork {
    return { assign: {} }
  },

  validate(payload: LabelPayload, work: LabelWork, success: SuccessRule): ValidateResult {
    // Every hotspot must be labelled before we judge — an unfinished board is not "wrong".
    const assign = work.assign ?? {}
    if (Object.keys(assign).length < payload.hotspots.length) return { ok: false, wrongIds: [] }
    const pairs = Object.entries(assign) as [string, string][]
    return evaluateSuccess(success, { pairs })
  },

  // Control of error: a hotspot physically accepts only its own label.
  accepts(payload: LabelPayload, _work: LabelWork, move): boolean {
    const spot = payload.hotspots.find((h) => h.id === move.targetId)
    return !!spot && spot.label === move.itemId
  },

  isPayload(p: unknown): p is LabelPayload {
    const x = p as LabelPayload
    // width/height/r must be finite and > 0 (a zero or negative size collapses
    // the viewBox / drop circle to nothing); x/y may legitimately be 0
    // (top-left origin) so they only need to be finite numbers.
    const pos = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n) && n > 0
    const coord = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n)
    if (!(
      !!x && typeof x === 'object' && !!x.image &&
      (typeof x.image.svg === 'string' || typeof x.image.imageUrl === 'string') &&
      pos(x.image.width) && pos(x.image.height) &&
      Array.isArray(x.hotspots) && x.hotspots.length > 0 &&
      x.hotspots.every((h) => typeof h?.id === 'string' && typeof h?.label === 'string' &&
        coord(h?.x) && coord(h?.y) && pos(h?.r))
    )) return false
    const ids = new Set(x.hotspots.map((h) => h.id))
    if (ids.size !== x.hotspots.length) return false // duplicate hotspot ids
    // The renderer tracks placed labels in a Set keyed on the LABEL TEXT, not
    // the hotspot id (it drops a chip from the unplaced pool once ANY hotspot
    // with that label is filled). Two hotspots sharing a label would leave
    // the second permanently unfillable — validate() could never see it done.
    const labels = new Set(x.hotspots.map((h) => h.label))
    if (labels.size !== x.hotspots.length) return false
    return true
  },
}
