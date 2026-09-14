import { getPatternModule } from '@/lib/studylab/activities/registry'
import type { SuccessRule, ThreePeriodPayload } from '@/lib/studylab/activities/types'
import { catalogueArt } from '../catalogueArt'
import { validateMaterial } from '../validate'
import type { MaterialSpec } from '../types'
import type { Apparatus } from './index'
import { safeFromLegacy } from './safeFromLegacy'

const answerGroupId = (itemId: string): string => `answer-${itemId}`

const base: MaterialSpec = {
  prompt: 'Place each recall card with the name it answers.',
  pieces: [
    { id: 'sun-card', label: 'Sun', traits: { answer: 'sun' } },
    { id: 'moon-card', label: 'Moon', traits: { answer: 'moon' } },
  ],
  groups: [
    { id: 'answer-sun', label: 'Sun', ordered: false },
    { id: 'answer-moon', label: 'Moon', ordered: false },
  ],
  slots: [
    { id: 's-answer-sun', groupId: 'answer-sun', x: 0, y: 0, capacity: 1 },
    { id: 's-answer-moon', groupId: 'answer-moon', x: 1, y: 0, capacity: 1 },
  ],
  rules: [
    { op: 'allow', selector: { trait: 'answer', equals: 'sun' }, groupId: 'answer-sun' },
    { op: 'allow', selector: { trait: 'answer', equals: 'moon' }, groupId: 'answer-moon' },
  ],
  // Pairing has no MaterialState -> SuccessInput conversion yet. Recall is
  // therefore expressed as reachable placement into one answer group per card.
  goal: {
    kind: 'binAssignment',
    assign: { 'sun-card': 'answer-sun', 'moon-card': 'answer-moon' },
  },
}

function convert(payload: ThreePeriodPayload, success?: SuccessRule): MaterialSpec | null {
  if (new Set(payload.items.map((item) => item.label)).size !== payload.items.length) return null
  let assign: Record<string, string>
  if (success) {
    if (success.kind !== 'pairing' || success.pairs.length !== payload.items.length) return null
    assign = {}
    for (const [pieceId, answerLabel] of success.pairs) {
      if (assign[pieceId] !== undefined || !payload.items.some((item) => item.id === pieceId)) return null
      const answer = payload.items.find((item) => item.label === answerLabel)
      if (!answer) return null
      assign[pieceId] = answerGroupId(answer.id)
    }
    if (Object.keys(assign).length !== payload.items.length) return null
  } else {
    assign = Object.fromEntries(payload.items.map((item) => [item.id, answerGroupId(item.id)]))
  }
  return {
    prompt: 'Place each recall card with the name it answers.',
    pieces: payload.items.map((item) => {
      const art = catalogueArt(item.imageUrl)
      return {
        id: item.id,
        label: item.label,
        ...(art ? { art } : {}),
        traits: { answer: item.id },
      }
    }),
    groups: payload.items.map((item) => ({
      id: answerGroupId(item.id),
      label: item.label,
      ordered: false,
    })),
    slots: payload.items.map((item, index) => ({
      id: `s-${answerGroupId(item.id)}`,
      groupId: answerGroupId(item.id),
      x: index,
      y: 0,
      capacity: 1,
    })),
    // Legacy threePeriod has no accepts(): an incorrect recall answer must be
    // placeable so the supplied pairing rule, not payload order, grades it.
    rules: [],
    // Do not use pairing: the interpreter intentionally has no settled
    // conversion for its three incompatible legacy/canon meanings.
    goal: {
      kind: 'binAssignment',
      assign,
    },
  }
}

export const threePeriodCards: Apparatus = {
  name: 'three-period-cards',
  maxVaryingTraits: 1,
  base,
  legacy: {
    pattern: 'threePeriod',
    fromLegacy(payload: unknown, success?: SuccessRule): MaterialSpec | null {
      return safeFromLegacy(() => {
        const module = getPatternModule('threePeriod')
        if (!module?.isPayload(payload)) return null
        if (!payload.phases.every((phase: unknown) =>
          phase === 'present' || phase === 'identify' || phase === 'recall')) return null
        const spec = convert(payload, success)
        if (!spec) return null
        const result = validateMaterial(spec, 1)
        return result.ok ? result.spec : null
      })
    },
  },
}
