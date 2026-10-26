// lib/studylab/attempt.test.ts
import { describe, it, expect } from 'vitest'
import { attemptText, materialAttempt } from './attempt'
import type { MaterialSpec } from './material/types'

describe('attemptText -- what the learner did, in words the tutor can read back', () => {
  it('names the option chosen, by its letter and its words', () => {
    expect(attemptText({ kind: 'mcq', options: ['x + 3', '2x + 3', '2x'], chosen: 1 })).toBe('Chose: B) 2x + 3')
    expect(attemptText({ kind: 'mcq', options: ['a', 'b'] })).toBe('Chose nothing yet')
  })

  it('lists each match as given, blanks included', () => {
    expect(
      attemptText({ kind: 'match', pairs: [{ left: 'Mitochondria' }, { left: 'Ribosome' }], given: ['Energy', ''] }),
    ).toBe('Matched: Mitochondria → Energy; Ribosome → (left blank)')
  })

  it('quotes what was written', () => {
    expect(attemptText({ kind: 'text', text: '  x = 4 because 2x = 8 ' })).toBe('Wrote: "x = 4 because 2x = 8"')
    expect(attemptText({ kind: 'text', text: '   ' })).toBe('Wrote nothing yet')
  })

  it('describes a material by where its pieces are now, counting repeats', () => {
    expect(
      attemptText({
        kind: 'material',
        placed: [
          { piece: 'tile', slot: 'Area' },
          { piece: 'tile', slot: 'Area' },
          { piece: 'tile', slot: 'Area' },
          { piece: 'x-bar', slot: 'Side' },
        ],
        unplaced: ['tile'],
      }),
    ).toBe('Put 3 tile in Area; x-bar in Side. Left 1 unplaced: tile')
  })

  it('says where the controls were set', () => {
    expect(
      attemptText({ kind: 'material', placed: [], unplaced: [], controls: [{ label: 'Temperature', value: 40, unit: '°C' }] }),
    ).toBe('Set Temperature to 40 °C')
  })

  it('says when nothing has been moved', () => {
    expect(attemptText({ kind: 'material', placed: [], unplaced: ['a', 'b'] })).toBe('Moved nothing yet')
  })
})

describe('materialAttempt -- a material read off its board', () => {
  const spec: MaterialSpec = {
    prompt: 'Sort the organelles',
    pieces: [
      { id: 'p1', label: 'Chloroplast', traits: {} },
      { id: 'p2', label: 'Mitochondrion', traits: {} },
      { id: 'p3', label: 'Cell wall', traits: {} },
    ],
    groups: [{ id: 'g1', label: 'Animal cell', ordered: false }, { id: 'g2', label: 'Plant cell', ordered: false }],
    slots: [
      { id: 's1', groupId: 'g1', x: 0, y: 0, capacity: 5 },
      { id: 's2', groupId: 'g2', x: 0, y: 0, capacity: 5 },
    ],
    controls: [{ id: 'k', label: 'Light', min: 0, max: 10, step: 1, unit: 'lux' }],
    rules: [],
    goal: { kind: 'all-placed' } as unknown as MaterialSpec['goal'],
  }

  it('says where each piece sits now, by its group, and what is left', () => {
    expect(materialAttempt(spec, { placement: { p1: 's1', p2: 's1' }, controls: { k: 4 } })).toBe(
      'Put Chloroplast, Mitochondrion in Animal cell. Set Light to 4 lux. Left 1 unplaced: Cell wall',
    )
  })
})

describe('attemptText -- the new question formats', () => {
  it('reads a fill back as the sentence it made', () => {
    expect(attemptText({ kind: 'fill', text: 'Plants make ___ from ___.', given: ['water', ''] })).toBe('Filled in: "Plants make water from ___."')
  })
  it('reads an order back in the order it was put', () => {
    expect(attemptText({ kind: 'order', given: ['Egg', 'Pupa', '', 'Adult'] })).toBe('Put in order: Egg, Pupa, (empty), Adult')
  })
  it('reads a tap back by the parts tapped', () => {
    expect(attemptText({ kind: 'tap', parts: ['Vacuole'] })).toBe('Tapped: Vacuole')
    expect(attemptText({ kind: 'tap', parts: [] })).toBe('Tapped nothing yet')
  })
})
