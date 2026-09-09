import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { SequencePayload } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const TRACK_ID = 'sequence-track'

const base: MaterialSpec = {
  prompt: 'Place the cards in order along the track.',
  pieces: [
    { id: 'first-card', label: 'First', traits: { position: 1 } },
    { id: 'second-card', label: 'Second', traits: { position: 2 } },
  ],
  groups: [{ id: TRACK_ID, label: 'Order', ordered: true }],
  slots: [
    { id: 'step-0', groupId: TRACK_ID, x: 0, y: 0, capacity: 1, index: 0 },
    { id: 'step-1', groupId: TRACK_ID, x: 1, y: 0, capacity: 1, index: 1 },
  ],
  rules: [],
  goal: { kind: 'exactOrder', itemIds: ['first-card', 'second-card'] },
}

function convert(payload: SequencePayload): MaterialSpec {
  return {
    prompt: 'Place the cards in order along the track.',
    pieces: payload.items.map((item, index) => ({
      id: item.id,
      label: item.label,
      traits: { position: index + 1 },
    })),
    groups: [{ id: TRACK_ID, label: 'Order', ordered: true }],
    slots: payload.items.map((_, index) => ({
      id: `step-${index}`,
      groupId: TRACK_ID,
      x: payload.orientation === 'vertical' ? 0 : index,
      y: payload.orientation === 'vertical' ? index : 0,
      capacity: 1,
      index,
    })),
    rules: [],
    goal: { kind: 'exactOrder', itemIds: payload.items.map((item) => item.id) },
  }
}

export const orderingTrack: Apparatus = {
  name: 'ordering-track',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'sequence',
    fromLegacy(payload: unknown): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('sequence')
        if (!module?.isPayload(payload)) return null
        const spec = convert(payload)
        const result = validateMaterial(spec, 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
