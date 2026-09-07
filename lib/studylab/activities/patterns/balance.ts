// lib/studylab/activities/patterns/balance.ts
import type { BalancePayload, PatternModule, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'

export interface BalanceWork { left: string[]; right: string[] }

const all = (p: BalancePayload) => [...p.left, ...p.right, ...p.pool]

/**
 * Total weight of one side. Unknown ids (a stale reference, or a keyboard-path
 * race) contribute 0 rather than NaN — `?? 0` on the Map lookup, not on the
 * arithmetic, so a missing weight can never poison the running sum.
 */
export function sideTotal(payload: BalancePayload, ids: string[]): number {
  const index = new Map(all(payload).map((i) => [i.id, i.weight]))
  return ids.reduce((sum, id) => sum + (index.get(id) ?? 0), 0)
}

export const balanceModule: PatternModule<BalancePayload, BalanceWork> = {
  pattern: 'balance',

  initialWork(payload): BalanceWork {
    // Seed the pans from the authored sides; everything else starts in the pool.
    return { left: payload.left.map((i) => i.id), right: payload.right.map((i) => i.id) }
  },

  validate(payload, work, success: SuccessRule): ValidateResult {
    const diff = sideTotal(payload, work.left ?? []) - sideTotal(payload, work.right ?? [])
    return evaluateSuccess(success, { value: diff })
  },

  // No accepts(): any item may sit on either pan. Being momentarily wrong is
  // the point of a balance — the tilt shows it, Check confirms it.

  isPayload(p: unknown): p is BalancePayload {
    const x = p as BalancePayload
    const okItems = (arr: unknown) =>
      Array.isArray(arr) &&
      (arr as BalancePayload['pool']).every(
        (i) =>
          !!i && typeof i === 'object' &&
          typeof i.id === 'string' && i.id.length > 0 &&
          typeof i.label === 'string' &&
          typeof i.weight === 'number' && Number.isFinite(i.weight),
      )
    return (
      !!x && typeof x === 'object' &&
      okItems(x.left) && okItems(x.right) && okItems(x.pool) &&
      (x.mode === 'weights' || x.mode === 'equation') &&
      all(x).length > 0
    )
  },
}
