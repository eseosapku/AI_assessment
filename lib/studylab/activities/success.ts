// lib/studylab/activities/success.ts
import type { SuccessRule, ValidateResult } from './types'

export interface SuccessInput {
  set?: string[]
  order?: string[]
  assign?: Record<string, string>
  value?: number
  pairs?: [string, string][]
}

const ok = (): ValidateResult => ({ ok: true, wrongIds: [] })
const no = (wrongIds: string[] = []): ValidateResult => ({ ok: false, wrongIds })

export function evaluateSuccess(rule: SuccessRule, input: SuccessInput): ValidateResult {
  switch (rule.kind) {
    case 'exactSet': {
      const got = input.set ?? []
      const want = new Set(rule.itemIds)
      const extra = got.filter((id) => !want.has(id))
      const missing = rule.itemIds.filter((id) => !got.includes(id))
      if (extra.length === 0 && missing.length === 0) return ok()
      return no([...extra, ...missing])
    }
    case 'exactOrder': {
      const got = input.order ?? []
      if (got.length === rule.itemIds.length && got.every((id, i) => id === rule.itemIds[i])) return ok()
      return no(got.filter((id, i) => id !== rule.itemIds[i]))
    }
    case 'binAssignment': {
      const got = input.assign ?? {}
      const wrong = Object.keys(rule.assign).filter((id) => got[id] !== rule.assign[id])
      return wrong.length === 0 ? ok() : no(wrong)
    }
    case 'numericWithin': {
      if (typeof input.value !== 'number' || !Number.isFinite(input.value)) return no()
      return Math.abs(input.value - rule.target) <= rule.tolerance ? ok() : no()
    }
    case 'pairing': {
      const key = (a: string, b: string) => `${a}::${b}`
      const want = new Set(rule.pairs.map(([a, b]) => key(a, b)))
      const got = input.pairs ?? []
      const wrong = got.filter(([a, b]) => !want.has(key(a, b))).map(([a]) => a)
      if (got.length !== rule.pairs.length) return no(wrong)
      return wrong.length === 0 ? ok() : no(wrong)
    }
    case 'allSubgoals': {
      const results = rule.subgoals.map((s) => evaluateSuccess(s, input))
      const wrong = results.flatMap((r) => r.wrongIds)
      return results.every((r) => r.ok) ? ok() : no([...new Set(wrong)])
    }
    default:
      return no()
  }
}
