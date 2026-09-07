// lib/studylab/activities/validate.ts
import type { ActivitySpec, SuccessRule } from './types'
import { getPatternModule } from './registry'

const SUCCESS_KINDS = new Set([
  'exactSet', 'exactOrder', 'binAssignment', 'numericWithin', 'pairing', 'allSubgoals',
])

function isSuccessRule(r: unknown): r is SuccessRule {
  const x = r as any
  if (!x || typeof x !== 'object' || !SUCCESS_KINDS.has(x.kind)) return false
  switch (x.kind) {
    case 'exactSet':
    case 'exactOrder':
      return Array.isArray(x.itemIds) && x.itemIds.every((i: unknown) => typeof i === 'string')
    case 'binAssignment':
      return !!x.assign && typeof x.assign === 'object' && Object.keys(x.assign).length > 0
    case 'numericWithin':
      return typeof x.target === 'number' && typeof x.tolerance === 'number'
    case 'pairing':
      return Array.isArray(x.pairs) && x.pairs.every((p: unknown) => Array.isArray(p) && p.length === 2)
    case 'allSubgoals':
      return Array.isArray(x.subgoals) && x.subgoals.length > 0 && x.subgoals.every(isSuccessRule)
    default:
      return false
  }
}

/**
 * Structural guard for tutor-emitted activity specs. An invalid spec is DROPPED
 * by the reducer rather than rendered, so a malformed model turn degrades to
 * "no activity" instead of a broken card.
 */
export function validateSpec(x: unknown): x is ActivitySpec {
  const s = x as ActivitySpec
  if (!s || typeof s !== 'object') return false
  if (typeof s.prompt !== 'string' || !s.prompt.trim()) return false
  if (!isSuccessRule(s.success)) return false
  const mod = getPatternModule(s.pattern)
  if (!mod || typeof mod.isPayload !== 'function') return false
  if (!mod.isPayload(s.payload)) return false
  if (s.hints !== undefined && (!Array.isArray(s.hints) || !s.hints.every((h) => typeof h === 'string'))) return false
  if (s.reveal !== undefined && typeof s.reveal !== 'string') return false
  return true
}
