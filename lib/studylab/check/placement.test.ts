// lib/studylab/check/placement.test.ts
import { describe, it, expect } from 'vitest'
import { placeInto, clearAt, unplaced, toggle, shuffledItems, sentenceParts, filledSentence } from './placement'

describe('placing tiles and items', () => {
  it('puts a piece in an empty place', () => {
    expect(placeInto(['', ''], 1, 'water')).toEqual(['', 'water'])
  })
  it('moves a piece already placed elsewhere, so it is never in two places', () => {
    expect(placeInto(['water', ''], 1, 'water')).toEqual(['', 'water'])
  })
  it('swaps two placed pieces, so an order can be rearranged in one move', () => {
    expect(placeInto(['Egg', 'Larva', 'Pupa'], 0, 'Pupa')).toEqual(['Pupa', 'Larva', 'Egg'])
  })
  it('sends a piece it replaces back to the bank when the new one came from the bank', () => {
    expect(placeInto(['oxygen', ''], 0, 'glucose')).toEqual(['glucose', ''])
  })
  it('empties a place', () => {
    expect(clearAt(['a', 'b'], 0)).toEqual(['', 'b'])
  })
  it('keeps the bank in its own order, less what is placed', () => {
    expect(unplaced(['glucose', 'water', 'oxygen'], ['', 'water'])).toEqual(['glucose', 'oxygen'])
  })
  it('toggles a tapped part', () => {
    expect(toggle(['nucleus'], 'vacuole')).toEqual(['nucleus', 'vacuole'])
    expect(toggle(['nucleus', 'vacuole'], 'nucleus')).toEqual(['vacuole'])
  })
})

describe('shuffledItems', () => {
  const items = ['Egg', 'Larva', 'Pupa', 'Adult']
  it('never shows an order in its right order, and shows the same order every time', () => {
    for (const seed of ['q1', 'q2', 'q3', 'abc', 'zzz']) {
      const shown = shuffledItems(items, seed)
      expect(shown).not.toEqual(items)
      expect([...shown].sort()).toEqual([...items].sort())
      expect(shuffledItems(items, seed)).toEqual(shown)
    }
  })
})

describe('the sentence of a fill question', () => {
  it('splits into text and numbered blanks', () => {
    expect(sentenceParts('Plants make ___ from ___.')).toEqual([{ text: 'Plants make ' }, { blank: 0 }, { text: ' from ' }, { blank: 1 }, { text: '.' }])
  })
  it('reads back with what was placed, and gaps where nothing was', () => {
    expect(filledSentence('Plants make ___ from ___.', ['glucose', ''])).toBe('Plants make glucose from ___.')
  })
})
