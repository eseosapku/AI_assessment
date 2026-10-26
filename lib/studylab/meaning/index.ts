// lib/studylab/meaning/index.ts
import type { VaryPayload } from '../activities/types'
import { varyFaults } from './vary'
import { startStateFaults } from './startState'
import { selfAnswerFaults } from './selfAnswer'
import { artFaults } from './art'
import { getEngine } from '../engines/registry'

export { varyFaults, startStateFaults, selfAnswerFaults, artFaults }

/**
 * Everything that would make an interaction teach nothing, in words a writer
 * can act on; empty when it is fine. Whatever accepts an activity or a
 * material asks this: the authoring code checks (the pass is written again)
 * and live dispatch (refused, and the station's fallback fills in).
 */
export function meaningFaults(action: unknown): string[] {
  if (!action || typeof action !== 'object') return []
  const a = action as { type?: unknown; spec?: { pattern?: unknown; payload?: unknown; prompt?: unknown } }
  const out: string[] = []
  if (a.type === 'createActivity' && a.spec?.pattern === 'vary' && a.spec.payload && typeof a.spec.payload === 'object') {
    try {
      out.push(...varyFaults(a.spec.payload as VaryPayload))
    } catch {
      out.push('the slider card cannot be worked out')
    }
  }
  if (a.type === 'createActivity' && a.spec?.pattern === 'scene') {
    // A scene's engine knows what would make its config teach nothing.
    const p = (a.spec.payload ?? {}) as { engine?: unknown; config?: unknown }
    const engine = getEngine(p.engine)
    const config = engine?.parse(p.config)
    out.push(...(engine && config ? engine.faults(config) : ["the scene's engine or config cannot be read"]))
    if (engine?.promptFaults && config) out.push(...engine.promptFaults(config, String(a.spec.prompt ?? '')))
  }
  out.push(...startStateFaults(action), ...selfAnswerFaults(action), ...artFaults(action))
  return out
}
