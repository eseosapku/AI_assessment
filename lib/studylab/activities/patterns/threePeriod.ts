import type { PatternModule, ThreePeriodPayload, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'

export interface ThreePeriodWork {
  phase: number
  answers: Record<string, string>
  /** Walk-through position within present/identify. Persisted so a remount
   *  mid-walkthrough (e.g. reload) resumes where the student left off
   *  instead of restarting at item 0. Optional (rather than required) so
   *  work objects authored before this field existed — and validate()
   *  callers that only care about phase/answers — still type-check; the
   *  renderer defaults each to 0 when absent. */
  presentIdx?: number
  identifyIdx?: number
}

export const threePeriodModule: PatternModule<ThreePeriodPayload, ThreePeriodWork> = {
  pattern: 'threePeriod',

  initialWork(): ThreePeriodWork {
    return { phase: 0, answers: {}, presentIdx: 0, identifyIdx: 0 }
  },

  validate(payload: ThreePeriodPayload, work: ThreePeriodWork, success: SuccessRule): ValidateResult {
    // Only the recall period (phase 2) is judged — present/identify have no
    // wrong answer to score, they are the material naming things for the
    // student. An unfinished recall pass is not "wrong", just not ready yet.
    const answers = work.answers ?? {}
    if (Object.keys(answers).length < payload.items.length) return { ok: false, wrongIds: [] }
    const pairs = Object.entries(answers) as [string, string][]
    return evaluateSuccess(success, { pairs })
  },

  isPayload(p: unknown): p is ThreePeriodPayload {
    const x = p as ThreePeriodPayload
    if (!(
      !!x && typeof x === 'object' &&
      Array.isArray(x.items) && x.items.length > 0 &&
      x.items.every((i) => typeof i?.id === 'string' && typeof i?.label === 'string') &&
      Array.isArray(x.phases) && x.phases.length > 0
    )) return false
    const ids = new Set(x.items.map((i) => i.id))
    if (ids.size !== x.items.length) return false // duplicate item ids would collide in `answers`
    return true
  },
}
