// lib/studylab/meaning/selfAnswer.ts
import { assetUrl } from '../activities/assetCatalog'

const norm = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase().replace(/\s+/g, ' ') : '')

/** Boxes and pieces sharing a name: a box headed with the answer it takes. */
function sharedNames(boxes: unknown[], pieces: unknown[]): string[] {
  const pieceNames = new Map<string, string>()
  for (const p of pieces) {
    const label = (p as { label?: unknown })?.label
    if (norm(label)) pieceNames.set(norm(label), String(label).trim())
  }
  const out: string[] = []
  for (const b of boxes) {
    const label = (b as { label?: unknown })?.label
    if (norm(label) && pieceNames.has(norm(label))) out.push(`"${String(label).trim()}" is both a box and a piece, so the box gives its answer away: head boxes with what they stand for, not with a piece's name`)
  }
  return out
}

/**
 * A sequence whose rules name every neighbouring pair: the rule list is the
 * order, read out. Rules agree with the order written, so nothing short of
 * every neighbour fixes it.
 */
function ruledOut(payload: Record<string, unknown>): string[] {
  const items = Array.isArray(payload.items) ? (payload.items as { id?: unknown }[]) : []
  const rules = Array.isArray(payload.rules) ? (payload.rules as { before?: unknown; after?: unknown }[]) : []
  if (items.length < 2 || rules.length === 0) return []
  const said = new Set(rules.map((r) => `${String(r.before)}>${String(r.after)}`))
  const whole = items.slice(1).every((item, k) => said.has(`${String(items[k].id)}>${String(item.id)}`))
  return whole ? ['its rules spell out the whole order, so the list gives the answer away: leave at least one neighbouring pair for the learner to work out'] : []
}

/**
 * Why an activity or material would show its own answer before it is
 * answered; empty when it would not. A naming card draws each item as its
 * picture, so an item with no picture it can show would be drawn as its name
 * -- "What is this? Antibody". A box headed with a piece's own name is that
 * piece's answer printed on the board.
 */
export function selfAnswerFaults(action: unknown): string[] {
  if (!action || typeof action !== 'object') return []
  const a = action as { type?: unknown; spec?: Record<string, unknown> }
  const spec = a.spec
  if (!spec || typeof spec !== 'object') return []
  if (a.type === 'createActivity') {
    const payload = spec.payload as Record<string, unknown> | undefined
    if (!payload) return []
    if (spec.pattern === 'threePeriod') {
      const items = Array.isArray(payload.items) ? payload.items : []
      return items
        .filter((i) => !(typeof (i as { imageUrl?: unknown }).imageUrl === 'string' && assetUrl((i as { imageUrl: string }).imageUrl)))
        .map((i) => `"${String((i as { label?: unknown }).label ?? '').trim()}" has no picture, so the card would show its name as the answer: give every item a catalogue picture, or use a different card`)
    }
    if (spec.pattern === 'sort') return sharedNames(Array.isArray(payload.bins) ? payload.bins : [], Array.isArray(payload.items) ? payload.items : [])
    if (spec.pattern === 'sequence') return ruledOut(payload)
    return []
  }
  if (a.type === 'build_material') {
    return sharedNames(Array.isArray(spec.groups) ? spec.groups : [], Array.isArray(spec.pieces) ? spec.pieces : [])
  }
  return []
}
