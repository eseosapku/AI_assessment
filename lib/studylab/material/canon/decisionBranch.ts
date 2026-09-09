import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { ScenarioPayload } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const base: MaterialSpec = {
  prompt: 'Choose the defensible response.',
  pieces: [
    { id: 'safe', label: 'Safe choice', traits: { defensible: 1 } },
    { id: 'unsafe', label: 'Unsafe choice', traits: { defensible: 0 } },
  ],
  groups: [
    { id: 'chosen', label: 'My choice', ordered: false },
    { id: 'pool', label: 'Choices', ordered: false },
  ],
  slots: [
    { id: 's-chosen', groupId: 'chosen', x: 0, y: 0, capacity: 1 },
    { id: 's-pool', groupId: 'pool', x: 0, y: 1, capacity: 2 },
  ],
  displays: [{ id: 'decision', kind: 'gauge', min: 0, max: 1 }],
  rules: [{ op: 'bind', target: 'decision', expr: 'sum_defensible_chosen' }],
  goal: { kind: 'numericWithin', target: 1, tolerance: 0 },
}

function convert(payload: ScenarioPayload): MaterialSpec {
  return {
    prompt: payload.situation,
    pieces: payload.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      traits: { defensible: choice.defensible === true ? 1 : 0 },
    })),
    groups: [
      { id: 'chosen', label: 'My choice', ordered: false },
      { id: 'pool', label: 'Choices', ordered: false },
    ],
    slots: [
      { id: 's-chosen', groupId: 'chosen', x: 0, y: 0, capacity: 1 },
      { id: 's-pool', groupId: 'pool', x: 0, y: 1, capacity: payload.choices.length },
    ],
    displays: [{ id: 'decision', kind: 'gauge', min: 0, max: 1 }],
    rules: [{ op: 'bind', target: 'decision', expr: 'sum_defensible_chosen' }],
    // numericWithin deliberately avoids the all-pieces-placed guard: scenario
    // is one decision, so every unchosen option must remain in the pool.
    goal: { kind: 'numericWithin', target: 1, tolerance: 0 },
  }
}

export const decisionBranch: Apparatus = {
  name: 'decision-branch',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'scenario',
    fromLegacy(payload: unknown): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('scenario')
        if (!module?.isPayload(payload)) return null
        const result = validateMaterial(convert(payload), 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
