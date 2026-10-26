// lib/studylab/meaning/index.ts
import type { VaryPayload } from '../activities/types'
import { varyFaults } from './vary'
import { startStateFaults } from './startState'
import { selfAnswerFaults } from './selfAnswer'
import { artFaults } from './art'

export { varyFaults, startStateFaults, selfAnswerFaults, artFaults }

/**
 * Everything that would make an interaction teach nothing, in words a writer
 * can act on; empty when it is fine. Whatever accepts an activity or a
 * material asks this: the authoring code checks (the pass is written again)
 * and live dispatch (refused, and the station's fallback fills in).
 */
export function meaningFaults(action: unknown): string[] {
  if (!action || typeof action !== 'object') return []
  const a = action as { type?: unknown; spec?: { pattern?: unknown; payload?: unknown } }
  const out: string[] = []
  if (a.type === 'createActivity' && a.spec?.pattern === 'vary' && a.spec.payload && typeof a.spec.payload === 'object') {
    try {
      out.push(...varyFaults(a.spec.payload as VaryPayload))
    } catch {
      out.push('the slider card cannot be worked out')
    }
  }
  out.push(...startStateFaults(action), ...selfAnswerFaults(action), ...artFaults(action))
  return out
}
