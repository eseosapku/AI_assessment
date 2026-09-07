// lib/studylab/activities/patterns/scenario.ts
import type { PatternModule, ScenarioPayload, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'

export interface ScenarioWork { chosen: string | null }

export const scenarioModule: PatternModule<ScenarioPayload, ScenarioWork> = {
  pattern: 'scenario',

  initialWork(): ScenarioWork {
    return { chosen: null }
  },

  validate(_payload, work, success: SuccessRule): ValidateResult {
    if (!work.chosen) return { ok: false, wrongIds: [] }
    // A scenario is ONE decision judged against a SET of acceptable answers, so
    // the relation is membership, not set equality. Passing a single-element set
    // to `exactSet` would report every unpicked defensible id as "missing" and
    // fail a correct choice whenever more than one option is defensible.
    if (success.kind === 'exactSet') {
      const ok = success.itemIds.includes(work.chosen)
      return ok ? { ok: true, wrongIds: [] } : { ok: false, wrongIds: [work.chosen] }
    }
    // Any other rule kind: evaluateSuccess's generic handling still applies, but
    // (as above) only the choice actually made can be "wrong" here — a rule kind
    // that reports missing/other ids would wrongly co-name the RIGHT choice.
    const result = evaluateSuccess(success, { set: [work.chosen] })
    return result.ok ? result : { ok: false, wrongIds: [work.chosen] }
  },

  isPayload(p: unknown): p is ScenarioPayload {
    const x = p as ScenarioPayload
    if (!x || typeof x !== 'object') return false
    if (typeof x.situation !== 'string' || x.situation.trim().length === 0) return false
    if (x.imageUrl !== undefined && typeof x.imageUrl !== 'string') return false
    if (!Array.isArray(x.choices) || x.choices.length < 2) return false
    const seen = new Set<string>()
    for (const c of x.choices) {
      if (!c || typeof c !== 'object') return false
      if (typeof c.id !== 'string' || c.id.length === 0) return false
      if (typeof c.label !== 'string' || c.label.length === 0) return false
      if (typeof c.consequence !== 'string' || c.consequence.length === 0) return false
      if (seen.has(c.id)) return false // duplicate id would make grading ambiguous
      seen.add(c.id)
    }
    if (x.followUp !== undefined && typeof x.followUp !== 'string') return false
    return true
  },
}
