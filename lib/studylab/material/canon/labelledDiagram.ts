import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { LabelPayload } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const base: MaterialSpec = {
  prompt: 'Place each label on its matching hotspot.',
  pieces: [
    { id: 'Nucleus', label: 'Nucleus', traits: { hotspot: 'nucleus' } },
    { id: 'Membrane', label: 'Membrane', traits: { hotspot: 'membrane' } },
  ],
  groups: [
    { id: 'nucleus', label: 'Nucleus', ordered: false },
    { id: 'membrane', label: 'Membrane', ordered: false },
  ],
  slots: [
    { id: 's-nucleus', groupId: 'nucleus', x: 0, y: 0, capacity: 1 },
    { id: 's-membrane', groupId: 'membrane', x: 1, y: 0, capacity: 1 },
  ],
  rules: [
    { op: 'allow', selector: { trait: 'hotspot', equals: 'nucleus' }, groupId: 'nucleus' },
    { op: 'allow', selector: { trait: 'hotspot', equals: 'membrane' }, groupId: 'membrane' },
  ],
  goal: { kind: 'binAssignment', assign: { Nucleus: 'nucleus', Membrane: 'membrane' } },
}

function convert(payload: LabelPayload): MaterialSpec {
  return {
    prompt: 'Place each label on its matching hotspot.',
    // Label accepts() compares the hotspot label with move.itemId, so the
    // movable piece id is deliberately the label text rather than hotspot id.
    pieces: payload.hotspots.map((hotspot) => ({
      id: hotspot.label,
      label: hotspot.label,
      traits: { hotspot: hotspot.id },
    })),
    groups: payload.hotspots.map((hotspot) => ({
      id: hotspot.id,
      label: hotspot.label,
      ordered: false,
    })),
    slots: payload.hotspots.map((hotspot) => ({
      id: `s-${hotspot.id}`,
      groupId: hotspot.id,
      x: hotspot.x,
      y: hotspot.y,
      capacity: 1,
    })),
    rules: payload.hotspots.map((hotspot) => ({
      op: 'allow' as const,
      selector: { trait: 'hotspot' as const, equals: hotspot.id },
      groupId: hotspot.id,
    })),
    goal: {
      kind: 'binAssignment',
      assign: Object.fromEntries(payload.hotspots.map((hotspot) => [hotspot.label, hotspot.id])),
    },
  }
}

export const labelledDiagram: Apparatus = {
  name: 'labelled-diagram',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'label',
    fromLegacy(payload: unknown): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('label')
        if (!module?.isPayload(payload)) return null
        const result = validateMaterial(convert(payload), 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
