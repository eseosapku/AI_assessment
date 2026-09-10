import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { SequencePayload, SuccessRule } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const base: MaterialSpec = {
  prompt: 'Place the cards in order along the track.',
  pieces: [
    { id: 'first-card', label: 'First', traits: { position: 1 } },
    { id: 'second-card', label: 'Second', traits: { position: 2 } },
  ],
  groups: [
    { id: '0', label: 'First', ordered: true },
    { id: '1', label: 'Second', ordered: true },
  ],
  slots: [
    { id: 's-0', groupId: '0', x: 0, y: 0, capacity: 1, index: 0 },
    { id: 's-1', groupId: '1', x: 1, y: 0, capacity: 1, index: 1 },
  ],
  rules: [],
  goal: { kind: 'exactOrder', itemIds: ['first-card', 'second-card'] },
}

function convert(payload: SequencePayload, success?: SuccessRule): MaterialSpec | null {
  if (success && success.kind !== 'exactOrder') return null
  return {
    prompt: 'Place the cards in order along the track.',
    pieces: payload.items.map((item, index) => ({
      id: item.id,
      label: item.label,
      traits: { position: index + 1 },
    })),
    // One ordered group per position keeps the shared legacy-equivalence
    // convention (`s-${groupId}`) while unique indices still pool into one
    // exactOrder sequence in the interpreter.
    groups: payload.items.map((_, index) => ({
      id: String(index),
      label: `Position ${index + 1}`,
      ordered: true,
    })),
    slots: payload.items.map((_, index) => ({
      id: `s-${index}`,
      groupId: String(index),
      x: payload.orientation === 'vertical' ? 0 : index,
      y: payload.orientation === 'vertical' ? index : 0,
      capacity: 1,
      index,
    })),
    rules: [],
    goal: success ?? { kind: 'exactOrder', itemIds: payload.items.map((item) => item.id) },
  }
}

export const orderingTrack: Apparatus = {
  name: 'ordering-track',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'sequence',
    fromLegacy(payload: unknown, success?: SuccessRule): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('sequence')
        if (!module?.isPayload(payload)) return null
        const spec = convert(payload, success)
        if (!spec) return null
        const result = validateMaterial(spec, 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
