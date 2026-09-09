import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { SortPayload } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const base: MaterialSpec = {
  prompt: 'Sort each tile into its matching frame.',
  pieces: [
    { id: 'warm-tile', label: 'Warm', traits: { category: 'warm' } },
    { id: 'cool-tile', label: 'Cool', traits: { category: 'cool' } },
  ],
  groups: [
    { id: 'warm', label: 'Warm', ordered: false },
    { id: 'cool', label: 'Cool', ordered: false },
  ],
  slots: [
    { id: 's-warm', groupId: 'warm', x: 0, y: 0, capacity: 2 },
    { id: 's-cool', groupId: 'cool', x: 0, y: 0, capacity: 2 },
  ],
  rules: [
    { op: 'allow', selector: { trait: 'category', equals: 'warm' }, groupId: 'warm' },
    { op: 'allow', selector: { trait: 'category', equals: 'cool' }, groupId: 'cool' },
  ],
  goal: { kind: 'binAssignment', assign: { 'warm-tile': 'warm', 'cool-tile': 'cool' } },
}

function convert(payload: SortPayload): MaterialSpec {
  const counts = new Map<string, number>()
  for (const item of payload.items) {
    counts.set(item.binId, (counts.get(item.binId) ?? 0) + 1)
  }

  return {
    prompt: 'Sort each item into its matching frame.',
    pieces: payload.items.map((item) => ({
      id: item.id,
      label: item.label,
      traits: { category: item.binId },
    })),
    groups: payload.bins.map((bin) => ({ id: bin.id, label: bin.label, ordered: false })),
    // The s-${groupId} convention is part of legacy equivalence.
    slots: payload.bins.map((bin, index) => ({
      id: `s-${bin.id}`,
      groupId: bin.id,
      x: index,
      y: 0,
      capacity: Math.max(1, counts.get(bin.id) ?? 0),
    })),
    rules: payload.bins.map((bin) => ({
      op: 'allow' as const,
      selector: { trait: 'category' as const, equals: bin.id },
      groupId: bin.id,
    })),
    goal: {
      kind: 'binAssignment',
      assign: Object.fromEntries(payload.items.map((item) => [item.id, item.binId])),
    },
  }
}

export const sortingFrame: Apparatus = {
  name: 'sorting-frame',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'sort',
    fromLegacy(payload: unknown): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('sort')
        if (!module?.isPayload(payload)) return null
        const spec = convert(payload)
        const result = validateMaterial(spec, 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
