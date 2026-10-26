// lib/studylab/meaning/startState.ts
import { getPatternModule } from '../activities/registry'
import type { ActivityPattern, SuccessRule } from '../activities/types'
import { parseMaterialSpec } from '../material/parse'
import { isSolvable } from '../material/solvable'

const SOLVED_AT_START = 'it is solved before anything is moved: start it somewhere the learner has to change'

/**
 * Why an activity or material would be served already solved; empty when it
 * starts unsolved. Each card's own starting state goes through its own marking,
 * so the check is whatever the card will mark, not a guess at it. A slider's
 * start is judged by varyFaults, which knows its target.
 */
export function startStateFaults(action: unknown): string[] {
  if (!action || typeof action !== 'object') return []
  const a = action as { type?: unknown; spec?: unknown }
  if (a.type === 'createActivity') {
    const spec = a.spec as { pattern?: ActivityPattern; payload?: unknown; success?: SuccessRule; seed?: number } | undefined
    if (!spec || spec.pattern === 'vary' || !spec.pattern) return []
    const mod = getPatternModule(spec.pattern)
    if (!mod || !spec.success || !mod.isPayload(spec.payload)) return []
    try {
      return mod.validate(spec.payload, mod.initialWork(spec.payload, spec.seed), spec.success).ok ? [SOLVED_AT_START] : []
    } catch {
      return []
    }
  }
  if (a.type === 'build_material') {
    const spec = parseMaterialSpec(a.spec)
    if (!spec) return []
    const solvable = isSolvable(spec)
    return solvable.ok && solvable.moves === 0 ? [SOLVED_AT_START] : []
  }
  return []
}
