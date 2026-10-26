// lib/studylab/arguable.test.ts
import { describe, it, expect } from 'vitest'
import { dropArguable } from './arguable'
import type { StationBundle } from './stationBundle'

/**
 * A judge that finds an item a teacher could argue fails the station; written
 * again, the part came back with another one -- milk's pH, a rubber ball's
 * density, a butterfly's trophic level (audits 6 and 7). Taking out the one
 * item, where the rest still stands, keeps the station.
 */
const sort = (items: [string, string, string][]) => ({
  type: 'createActivity', id: 'p1', step: 1,
  spec: {
    pattern: 'sort', prompt: 'Sort them by pH.',
    payload: { bins: [{ id: 'acid', label: 'Acidic' }, { id: 'neutral', label: 'Neutral' }, { id: 'alkali', label: 'Alkaline' }], items: items.map(([id, label, binId]) => ({ id, label, binId })) },
    success: { kind: 'binAssignment', assign: Object.fromEntries(items.map(([id, , binId]) => [id, binId])) },
  },
})
const PH: [string, string, string][] = [
  ['lemon', 'Lemon juice', 'acid'], ['vinegar', 'Vinegar', 'acid'], ['water', 'Pure water', 'neutral'],
  ['milk', 'Milk', 'neutral'], ['soap', 'Soap', 'alkali'], ['bleach', 'Bleach', 'alkali'],
]
const bundle = (practice: unknown, questions: unknown[] = []): StationBundle => ({
  version: 'v1', stepId: 's1',
  explore: { opening: 'Look.', action: { type: 'createCard', id: 'e1', card: 'practice', title: 'Predict: which is acidic?', answer: 'Lemon', steps: ['s'] } as never, hints: [] },
  name: { solved: { say: 'a', actions: [] }, helped: { say: 'b', actions: [] }, untried: { say: 'c', actions: [] } },
  practice: { say: 'Now you.', action: practice as never },
  check: { say: 'Check.', questions: questions as never },
})
const items = (b: StationBundle | null) => ((b?.practice.action as { spec: { payload: { items: { id: string }[] } } }).spec.payload.items).map((i) => i.id)

describe('dropArguable', () => {
  it('takes the quoted item out of a sort, and its key with it', () => {
    const out = dropArguable(bundle(sort(PH)), 'Milk')
    expect(items(out)).toEqual(['lemon', 'vinegar', 'water', 'soap', 'bleach'])
    expect((out!.practice.action as { spec: { success: { assign: Record<string, string> } } }).spec.success.assign).not.toHaveProperty('milk')
  })

  it('finds the one item whose label holds the quote, and never an item named inside other text', () => {
    expect(items(dropArguable(bundle(sort(PH)), 'water'))).not.toContain('water')
    expect(dropArguable(bundle(sort(PH)), 'Milk or vinegar')).toBeNull()
    // A feedback line that names an item is not the item: the judge quoted the line.
    expect(dropArguable(bundle(sort(PH)), 'Milk is slightly acidic.')).toBeNull()
  })

  it('leaves the station alone where taking the item out would empty a box or leave fewer than three', () => {
    const lone: [string, string, string][] = [['lemon', 'Lemon juice', 'acid'], ['water', 'Pure water', 'neutral'], ['soap', 'Soap', 'alkali'], ['bleach', 'Bleach', 'alkali']]
    expect(dropArguable(bundle(sort(lone)), 'Pure water')).toBeNull()
    expect(dropArguable(bundle(sort(PH.slice(0, 3))), 'Vinegar')).toBeNull()
  })

  it('takes a pair out of a match question, found by either side', () => {
    const match = { id: 'q1', format: 'match', prompt: 'Match each to its level.', pairs: [{ left: 'Grass', right: 'Producer' }, { left: 'Rabbit', right: 'Primary consumer' }, { left: 'Fox', right: 'Secondary consumer' }, { left: 'Butterfly', right: 'Primary consumer' }] }
    const out = dropArguable(bundle(sort(PH), [match]), 'Butterfly')
    expect((out!.check.questions[0] as unknown as { pairs: { left: string }[] }).pairs.map((p) => p.left)).toEqual(['Grass', 'Rabbit', 'Fox'])
  })

  it('takes an item out of an order question, and every clue that names it', () => {
    const order = { id: 'q2', format: 'order', prompt: 'Order them.', items: ['Egg', 'Larva', 'Pupa', 'Adult'], clues: [{ text: 'The larva comes before the pupa', before: 'Larva', after: 'Pupa' }, { text: 'The egg comes first', before: 'Egg', after: 'Larva' }] }
    const out = dropArguable(bundle(sort(PH), [order]), 'Pupa')
    const q = out!.check.questions[0] as unknown as { items: string[]; clues: { before: string; after: string }[] }
    expect(q.items).toEqual(['Egg', 'Larva', 'Adult'])
    expect(q.clues).toEqual([{ text: 'The egg comes first', before: 'Egg', after: 'Larva' }])
  })

  it('finds nothing to take out when the quote names no item', () => {
    expect(dropArguable(bundle(sort(PH)), 'The pH scale runs from 0 to 14')).toBeNull()
  })
})
