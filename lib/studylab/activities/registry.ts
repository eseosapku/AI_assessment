// lib/studylab/activities/registry.ts
import type { ActivityPattern, PatternModule } from './types'
import { sortModule } from './patterns/sort'
import { threePeriodModule } from './patterns/threePeriod'
import { sequenceModule } from './patterns/sequence'
import { compareModule } from './patterns/compare'
import { labelModule } from './patterns/label'
import { varyModule } from './patterns/vary'
import { balanceModule } from './patterns/balance'
import { scenarioModule } from './patterns/scenario'
import { composeModule } from './patterns/compose'

// A Map, NOT an object literal: `pattern` originates from model output, and
// indexing an object literal would reach Object.prototype — so
// '__proto__' / 'constructor' would resolve to truthy non-modules and sail past
// the `if (!mod)` guard in validateSpec. Each pattern task appends one entry.
const MODULES = new Map<ActivityPattern, PatternModule<any, any>>([
  ['sort', sortModule],
  ['threePeriod', threePeriodModule],
  ['sequence', sequenceModule],
  ['compare', compareModule],
  ['label', labelModule],
  ['vary', varyModule],
  ['balance', balanceModule],
  ['scenario', scenarioModule],
  ['compose', composeModule],
])

export function getPatternModule(p: ActivityPattern): PatternModule<any, any> | null {
  return MODULES.get(p) ?? null
}

export function registeredPatterns(): ActivityPattern[] {
  return [...MODULES.keys()]
}
