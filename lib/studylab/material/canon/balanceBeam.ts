import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { BalancePayload, SuccessRule } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const base: MaterialSpec = {
  prompt: 'Balance the two sides of the beam.',
  pieces: [
    { id: 'one', label: '1', traits: { weight: 1 } },
    { id: 'two', label: '2', traits: { weight: 2 } },
  ],
  groups: [
    { id: 'left', label: 'Left', ordered: false },
    { id: 'right', label: 'Right', ordered: false },
    { id: 'pool', label: 'Weights', ordered: false },
  ],
  slots: [
    { id: 's-left', groupId: 'left', x: 0, y: 0, capacity: 2 },
    { id: 's-right', groupId: 'right', x: 1, y: 0, capacity: 2 },
    { id: 's-pool', groupId: 'pool', x: 0, y: 1, capacity: 2 },
  ],
  displays: [{ id: 'beam', kind: 'beam', min: -3, max: 3 }],
  rules: [{ op: 'bind', target: 'beam', expr: 'sum_weight_left - sum_weight_right' }],
  goal: { kind: 'numericWithin', target: 0, tolerance: 0 },
}

function convert(payload: BalancePayload, success?: SuccessRule): MaterialSpec | null {
  if (success && success.kind !== 'numericWithin') return null
  const items = [...payload.left, ...payload.right, ...payload.pool]
  const extent = items.reduce((sum, item) => sum + Math.abs(item.weight), 0)
  return {
    prompt: 'Balance the two sides of the beam.',
    pieces: items.map((item) => ({
      id: item.id,
      label: item.label,
      traits: { weight: item.weight },
    })),
    groups: [
      { id: 'left', label: 'Left', ordered: false },
      { id: 'right', label: 'Right', ordered: false },
      { id: 'pool', label: 'Weights', ordered: false },
    ],
    slots: [
      { id: 's-left', groupId: 'left', x: 0, y: 0, capacity: items.length },
      { id: 's-right', groupId: 'right', x: 1, y: 0, capacity: items.length },
      { id: 's-pool', groupId: 'pool', x: 0, y: 1, capacity: items.length },
    ],
    displays: [{ id: 'beam', kind: 'beam', min: -extent, max: extent }],
    rules: [{ op: 'bind', target: 'beam', expr: 'sum_weight_left - sum_weight_right' }],
    goal: success ?? { kind: 'numericWithin', target: 0, tolerance: 0 },
  }
}

export const balanceBeam: Apparatus = {
  name: 'balance-beam',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'balance',
    fromLegacy(payload: unknown, success?: SuccessRule): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('balance')
        if (!module?.isPayload(payload)) return null
        const spec = convert(payload, success)
        if (!spec) return null
        const result = validateMaterial(spec, 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
