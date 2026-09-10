import type { ActivityPattern, SuccessRule } from '@/lib/studylab/activities/types'
import type { MaterialSpec } from '../types'
import { sortingFrame } from './sortingFrame'
import { orderingTrack } from './orderingTrack'
import { threePeriodCards } from './threePeriodCards'
import { vennSets } from './vennSets'
import { balanceBeam } from './balanceBeam'
import { labelledDiagram } from './labelledDiagram'
import { variableModel } from './variableModel'
import { decisionBranch } from './decisionBranch'
import { bondingRing } from './bondingRing'

export interface Apparatus {
  name: string
  /** How many traits may vary across manipulable pieces. Default 1. */
  maxVaryingTraits: number
  /** Base scene and rules, which the tutor extends with content. */
  base: MaterialSpec
  /** The legacy pattern this replaces, and how to convert its payload. */
  legacy?: {
    pattern: ActivityPattern
    fromLegacy(payload: unknown, success?: SuccessRule): MaterialSpec | null
  }
}

// A Map, NOT an object literal: `name` originates in model output, and
// indexing an object literal reaches Object.prototype — so '__proto__' and
// 'constructor' would resolve to truthy non-entries and sail past a null check.
const CANON = new Map<string, Apparatus>([
  ['sorting-frame', sortingFrame],
  ['ordering-track', orderingTrack],
  ['three-period-cards', threePeriodCards],
  ['venn-sets', vennSets],
  ['balance-beam', balanceBeam],
  ['labelled-diagram', labelledDiagram],
  ['variable-model', variableModel],
  ['decision-branch', decisionBranch],
  ['bonding-ring', bondingRing],
])

export function getApparatus(name: string): Apparatus | null {
  return CANON.get(name) ?? null
}

export function apparatusNames(): string[] {
  return [...CANON.keys()]
}
