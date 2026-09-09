import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { ComparePayload } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const base: MaterialSpec = {
  prompt: 'Place each tile in the left, right, or shared set.',
  pieces: [
    { id: 'left-tile', label: 'Left only', traits: { side: 'left', overlap: 0 } },
    { id: 'shared-tile', label: 'Both', traits: { side: 'both', overlap: 1 } },
    { id: 'right-tile', label: 'Right only', traits: { side: 'right', overlap: 0 } },
  ],
  groups: [
    { id: 'left', label: 'Left', ordered: false },
    { id: 'both', label: 'Both', ordered: false },
    { id: 'right', label: 'Right', ordered: false },
  ],
  slots: [
    { id: 's-left', groupId: 'left', x: 0, y: 0, capacity: 3 },
    { id: 's-both', groupId: 'both', x: 1, y: 0, capacity: 3 },
    { id: 's-right', groupId: 'right', x: 2, y: 0, capacity: 3 },
  ],
  rules: [],
  goal: {
    kind: 'binAssignment',
    assign: { 'left-tile': 'left', 'shared-tile': 'both', 'right-tile': 'right' },
  },
}

function convert(payload: ComparePayload): MaterialSpec {
  return {
    prompt: 'Place each item in the left, right, or shared set.',
    pieces: payload.items.map((item) => ({
      id: item.id,
      label: item.label,
      traits: {
        side: item.belongs,
        overlap: item.belongs === 'both' ? 1 : 0,
      },
    })),
    groups: [
      { id: 'left', label: payload.sets[0].label, ordered: false },
      { id: 'both', label: 'Both', ordered: false },
      { id: 'right', label: payload.sets[1].label, ordered: false },
    ],
    slots: [
      { id: 's-left', groupId: 'left', x: 0, y: 0, capacity: payload.items.length },
      { id: 's-both', groupId: 'both', x: 1, y: 0, capacity: payload.items.length },
      { id: 's-right', groupId: 'right', x: 2, y: 0, capacity: payload.items.length },
    ],
    // Compare permits wrong placements to stand until the learner checks.
    rules: [],
    goal: {
      kind: 'binAssignment',
      assign: Object.fromEntries(payload.items.map((item) => [item.id, item.belongs])),
    },
  }
}

export const vennSets: Apparatus = {
  name: 'venn-sets',
  maxVaryingTraits: 2,
  base,
  legacy: {
    pattern: 'compare',
    fromLegacy(payload: unknown): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('compare')
        if (!module?.isPayload(payload)) return null
        if (!payload.items.every((item: { label?: unknown }) => typeof item.label === 'string')) return null
        const spec = convert(payload)
        const result = validateMaterial(spec, 2)
        return result.ok ? result.spec : null
      })
    },
  },
}
