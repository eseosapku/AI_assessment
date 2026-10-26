// lib/studylab/activities/conditions.ts
import type { ActivityPattern, BalancePayload, SequencePayload } from './types'
import { sideTotal } from './patterns/balance'

export interface Condition { text: string; met: boolean }

/**
 * What a constraint answer must make true, each ticked as it comes true: a
 * sequence's rules, a balance's level beam. Patterns without any give none.
 */
export function conditionsFor(pattern: ActivityPattern, payload: unknown, work: Record<string, unknown>): Condition[] {
  if (pattern === 'sequence') {
    const order = Array.isArray(work.order) ? (work.order as string[]) : []
    return ((payload as SequencePayload).rules ?? []).map((r) => {
      const i = order.indexOf(r.before)
      const j = order.indexOf(r.after)
      return { text: r.text, met: i >= 0 && j >= 0 && i < j }
    })
  }
  if (pattern === 'balance') {
    const left = Array.isArray(work.left) ? (work.left as string[]) : []
    const right = Array.isArray(work.right) ? (work.right as string[]) : []
    const p = payload as BalancePayload
    // Two empty pans are level, but nothing has been weighed.
    const met = left.length > 0 && right.length > 0 && sideTotal(p, left) === sideTotal(p, right)
    return [{ text: 'Both sides weigh the same', met }]
  }
  return []
}
