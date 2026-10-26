// lib/studylab/attempt.ts
import type { MaterialSpec, MaterialState } from './material/types'

/**
 * What the learner did, in words the tutor can read back.
 *
 * Get help sends this with "Why was my answer wrong?", so the tutor answers the
 * attempt in front of it -- "You put the enzyme on the left-hand pan" -- rather
 * than explaining the topic again from the top.
 */
export type AttemptInput =
  | { kind: 'mcq'; options: string[]; chosen?: number }
  | { kind: 'match'; pairs: { left: string }[]; given: string[] }
  | { kind: 'text'; text: string }
  | {
      kind: 'material'
      /** Each placed piece, by its label, and the label of the group it sits in. */
      placed: { piece: string; slot: string }[]
      unplaced: string[]
      controls?: { label: string; value: number; unit?: string }[]
    }

/** Long enough for a worked answer; the route caps what it will take anyway. */
const MAX_CHARS = 1200

export function attemptText(input: AttemptInput): string {
  return describe(input).slice(0, MAX_CHARS)
}

function describe(input: AttemptInput): string {
  switch (input.kind) {
    case 'mcq': {
      const i = input.chosen
      if (i === undefined || input.options[i] === undefined) return 'Chose nothing yet'
      return `Chose: ${String.fromCharCode(65 + i)}) ${input.options[i]}`
    }
    case 'match':
      return `Matched: ${input.pairs.map((p, i) => `${p.left} → ${input.given[i]?.trim() || '(left blank)'}`).join('; ')}`
    case 'text': {
      const text = input.text.trim()
      return text ? `Wrote: "${text}"` : 'Wrote nothing yet'
    }
    case 'material': {
      // Grouped by where the pieces went, with repeats counted: "3 tile in Area".
      const bySlot = new Map<string, Map<string, number>>()
      for (const { piece, slot } of input.placed) {
        const pieces = bySlot.get(slot) ?? new Map<string, number>()
        pieces.set(piece, (pieces.get(piece) ?? 0) + 1)
        bySlot.set(slot, pieces)
      }
      const parts: string[] = []
      if (bySlot.size > 0) {
        const where = [...bySlot].map(
          ([slot, pieces]) => `${[...pieces].map(([piece, n]) => (n > 1 ? `${n} ${piece}` : piece)).join(', ')} in ${slot}`,
        )
        parts.push(`Put ${where.join('; ')}`)
      }
      for (const c of input.controls ?? []) parts.push(`Set ${c.label} to ${c.value}${c.unit ? ` ${c.unit}` : ''}`)
      if (parts.length === 0) return 'Moved nothing yet'
      if (input.unplaced.length > 0 && bySlot.size > 0) {
        parts.push(`Left ${input.unplaced.length} unplaced: ${[...new Set(input.unplaced)].join(', ')}`)
      }
      return parts.join('. ')
    }
  }
}

/** A material's attempt: where each piece is now, and where the controls are set. */
export function materialAttempt(spec: MaterialSpec, state: Pick<MaterialState, 'placement' | 'controls'>): string {
  const groups = new Map(spec.groups.map((g) => [g.id, g.label]))
  const slotGroup = new Map(spec.slots.map((s) => [s.id, groups.get(s.groupId) ?? s.groupId]))
  const placed = spec.pieces
    .filter((p) => state.placement[p.id])
    .map((p) => ({ piece: p.label, slot: slotGroup.get(state.placement[p.id]) ?? state.placement[p.id] }))
  const unplaced = spec.pieces.filter((p) => !state.placement[p.id]).map((p) => p.label)
  const controls = (spec.controls ?? [])
    .filter((c) => typeof state.controls?.[c.id] === 'number')
    .map((c) => ({ label: c.label, value: state.controls[c.id], unit: c.unit }))
  return attemptText({ kind: 'material', placed, unplaced, controls })
}
