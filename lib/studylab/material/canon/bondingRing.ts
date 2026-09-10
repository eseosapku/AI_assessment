import { joinId } from '@/lib/studylab/activities/patterns/compose'
import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { ComposePayload, SuccessRule } from '@/lib/studylab/activities/types'
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

function convert(payload: ComposePayload, success?: SuccessRule): MaterialSpec | null {
  const candidates = possibleBonds(payload)
  if (
    candidates.length === 0 ||
    new Set(candidates.map((bond) => bond.id)).size !== candidates.length ||
    (success && success.kind !== 'exactSet')
  ) return null

  const wanted = success
    ? [...new Set(success.itemIds)]
    : candidates.map((bond) => joinId(bond.from, bond.to))
  if (wanted.length === 0) return null

  const bonds: Bond[] = []
  for (const wantedId of wanted) {
    const bond = candidates.find((candidate) => joinId(candidate.from, candidate.to) === wantedId)
    if (!bond) return null
    bonds.push(bond)
  }

  // compose.accepts() refuses a join after either endpoint has exhausted its
  // slots. A success rule asking for a higher degree is therefore unreachable
  // in legacy and must not become a supposedly-solvable canon material.
  const degree = new Map<string, number>()
  for (const bond of bonds) {
    degree.set(bond.from, (degree.get(bond.from) ?? 0) + 1)
    degree.set(bond.to, (degree.get(bond.to) ?? 0) + 1)
  }
  if (payload.parts.some((part) => (degree.get(part.id) ?? 0) > part.slots)) return null

  const requiredIds = new Set(bonds.map((bond) => bond.id))
  const bondValues = new Map(candidates.map((bond, index) => [bond.id, 2 ** index]))
  const target = candidates.reduce(
    (sum, bond) => sum + (requiredIds.has(bond.id) ? bondValues.get(bond.id)! : 0),
    0,
  )
  const max = [...bondValues.values()].reduce((sum, value) => sum + value, 0)

  return {
    prompt: `Build ${payload.target.label} by moving every required bond into the ring.`,
    pieces: candidates.map((bond) => ({
      id: bond.id,
      label: `${payload.parts.find((part) => part.id === bond.from)!.label}—${payload.parts.find((part) => part.id === bond.to)!.label}`,
      // Powers of two give every subset a unique sum, so both a missing
      // required bond and an extra valid-but-unrequired bond remain wrong.
      traits: { bondValue: bondValues.get(bond.id)! },
    })),
    groups: [
      { id: 'joined', label: 'Bonding ring', ordered: false },
      { id: 'pool', label: 'Available bonds', ordered: false },
    ],
    slots: [
      { id: 's-joined', groupId: 'joined', x: 0, y: 0, capacity: candidates.length },
      { id: 's-pool', groupId: 'pool', x: 0, y: 1, capacity: candidates.length },
    ],
    displays: [{ id: 'bond-count', kind: 'gauge', min: 0, max }],
    rules: [{ op: 'bind', target: 'bond-count', expr: 'sum_bondValue_joined' }],
    goal: {
      kind: 'numericWithin',
      target,
      tolerance: 0,
    },
  }
}

export const bondingRing: Apparatus = {
  name: 'bonding-ring',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'compose',
    fromLegacy(payload: unknown, success?: SuccessRule): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('compose')
        if (!module?.isPayload(payload)) return null
        const spec = convert(payload, success)
        if (!spec) return null
        const result = validateMaterial(spec, 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
