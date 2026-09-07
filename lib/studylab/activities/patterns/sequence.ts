import type { PatternModule, SequencePayload, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'
import { seededShuffle } from '../shuffle'

export interface SequenceWork { order: string[] }

export const sequenceModule: PatternModule<SequencePayload, SequenceWork> = {
  pattern: 'sequence',
  initialWork(payload, seed = 1): SequenceWork {
    const solved = payload.items.map((i) => i.id)
    // A sequence that renders already-solved looks broken. Short sequences are
    // common (3 steps => 1-in-6 chance of the identity permutation), so retry
    // with a perturbed seed, then fall back to a deterministic rotation.
    if (solved.length < 2) return { order: solved }
    for (let attempt = 0; attempt < 8; attempt++) {
      const order = seededShuffle(solved, seed + attempt * 101)
      if (order.some((id, i) => id !== solved[i])) return { order }
    }
    return { order: [...solved.slice(1), solved[0]] }
  },
  validate(_payload, work, success: SuccessRule): ValidateResult {
    return evaluateSuccess(success, { order: work.order ?? [] })
  },
  isPayload(p: unknown): p is SequencePayload {
    const x = p as SequencePayload
    if (!(
      !!x && typeof x === 'object' && Array.isArray(x.items) && x.items.length > 1 &&
      x.items.every((i) => typeof i?.id === 'string' && typeof i?.label === 'string')
    )) return false
    const ids = new Set(x.items.map((i) => i.id))
    if (ids.size !== x.items.length) return false // duplicate item ids would collide in `order`
    return true
  },
}
