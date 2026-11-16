// lib/studylab/activities/conditions.ts
import type { ActivityPattern, BalancePayload, SequencePayload } from './types'
import { sideTotal } from './patterns/balance'

export interface Condition { text: string; met: boolean }

/**
 * A clue as the one pair it checks. The writer's own sentence can claim more
 * than its tick tests: a heart lesson ticked "Each chamber relaxes after it
 * contracts" for the atria alone, with the ventricles still out of order.
 */
export const pairText = (before: string, after: string) => `${before} before ${after}`

/**
 * What a constraint answer must make true, each ticked as it comes true: a
 * sequence's rules, a balance's level beam. Patterns without any give none.
 */
export function conditionsFor(pattern: ActivityPattern, payload: unknown, work: Record<string, unknown>): Condition[] {
  if (pattern === 'sequence') {
    const order = Array.isArray(work.order) ? (work.order as string[]) : []
    const p = payload as SequencePayload
    const label = (id: string) => p.items.find((item) => item.id === id)?.label ?? id
    return (p.rules ?? []).map((r) => {
      const i = order.indexOf(r.before)
      const j = order.indexOf(r.after)
      return { text: pairText(label(r.before), label(r.after)), met: i >= 0 && j >= 0 && i < j }
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
