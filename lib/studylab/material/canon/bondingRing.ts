import { joinId } from '@/lib/studylab/activities/patterns/compose'
import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { ComposePayload } from '@/lib/studylab/activities/types'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

interface Bond {
  id: string
  from: string
  to: string
}

function possibleBonds(payload: ComposePayload): Bond[] {
  const bonds: Bond[] = []
  for (let i = 0; i < payload.parts.length; i++) {
    for (let j = i + 1; j < payload.parts.length; j++) {
      const from = payload.parts[i]
      const to = payload.parts[j]
      // Legacy validJoins matches part LABELS, not ids. Keeping that detail
      // here prevents the shipped fault where every authored bond was illegal.
      const valid = payload.validJoins.some(
        (join) =>
          (join.a === from.label && join.b === to.label) ||
          (join.a === to.label && join.b === from.label),
      )
      if (!valid) continue
      bonds.push({ id: `bond-${joinId(from.id, to.id)}`, from: from.id, to: to.id })
    }
  }
  return bonds
}

const base: MaterialSpec = {
  prompt: 'Move every valid bond into the bonding ring.',
  pieces: [
    { id: 'bond-h1-o', label: 'H—O', traits: { bond: 1 } },
    { id: 'bond-h2-o', label: 'H—O', traits: { bond: 2 } },
  ],
  groups: [
    { id: 'joined', label: 'Bonding ring', ordered: false },
    { id: 'pool', label: 'Available bonds', ordered: false },
  ],
  slots: [
    { id: 's-joined', groupId: 'joined', x: 0, y: 0, capacity: 2 },
    { id: 's-pool', groupId: 'pool', x: 0, y: 1, capacity: 2 },
  ],
  rules: [],
  goal: {
    kind: 'binAssignment',
    assign: { 'bond-h1-o': 'joined', 'bond-h2-o': 'joined' },
  },
}

function convert(payload: ComposePayload): MaterialSpec | null {
  const bonds = possibleBonds(payload)
  if (bonds.length === 0 || new Set(bonds.map((bond) => bond.id)).size !== bonds.length) return null
  return {
    prompt: `Build ${payload.target.label} by moving every valid bond into the ring.`,
    pieces: bonds.map((bond, index) => ({
      id: bond.id,
      label: `${payload.parts.find((part) => part.id === bond.from)!.label}—${payload.parts.find((part) => part.id === bond.to)!.label}`,
      traits: { bond: index },
    })),
    groups: [
      { id: 'joined', label: 'Bonding ring', ordered: false },
      { id: 'pool', label: 'Available bonds', ordered: false },
    ],
    slots: [
      { id: 's-joined', groupId: 'joined', x: 0, y: 0, capacity: bonds.length },
      { id: 's-pool', groupId: 'pool', x: 0, y: 1, capacity: bonds.length },
    ],
    rules: [],
    goal: {
      kind: 'binAssignment',
      assign: Object.fromEntries(bonds.map((bond) => [bond.id, 'joined'])),
    },
  }
}

export const bondingRing: Apparatus = {
  name: 'bonding-ring',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'compose',
    fromLegacy(payload: unknown): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('compose')
        if (!module?.isPayload(payload)) return null
        const spec = convert(payload)
        if (!spec) return null
        const result = validateMaterial(spec, 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
