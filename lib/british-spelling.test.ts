import { describe, it, expect } from 'vitest'
import { toBritish, americanSpellings } from './british-spelling'

describe('toBritish', () => {
  it('fixes the spellings that shipped', () => {
    expect(toBritish('Analyzing the grid, when light hits the surface.')).toBe(
      'Analysing the grid, when light hits the surface.',
    )
    expect(toBritish('Explain how the particle model explains the behavior of gases.')).toBe(
      'Explain how the particle model explains the behaviour of gases.',
    )
    expect(toBritish('Describe the process of fertilization in flowering plants.')).toBe(
      'Describe the process of fertilisation in flowering plants.',
    )
    expect(toBritish('Calculate the distance traveled by a marble.')).toBe(
      'Calculate the distance travelled by a marble.',
    )
  })

  it('keeps the original capitalisation', () => {
    expect(toBritish('Behavior')).toBe('Behaviour')
    expect(toBritish('BEHAVIOR')).toBe('BEHAVIOUR')
    expect(toBritish('behavior')).toBe('behaviour')
    expect(toBritish('Analyze the data')).toBe('Analyse the data')
  })

  it('takes any ending on an -ize stem', () => {
    expect(toBritish('analyze analyzes analyzed analyzing')).toBe(
      'analyse analyses analysed analysing',
    )
  })

  it('does NOT maul words that merely start the same way', () => {
    // The bug in the first version of this table: an open-ended stem rule
    // turned these into "labouratory" and "centreed".
    expect(toBritish('the school laboratory')).toBe('the school laboratory')
    expect(toBritish('the centered image')).toBe('the centred image')
    expect(toBritish('a colorimeter reading')).toBe('a colorimeter reading')
  })

  it('leaves words that are already correct British English', () => {
    // Every one of these is spelled this way by Cambridge.
    for (const ok of [
      'a humorous story', 'vigorous exercise', 'a computer program',
      'the first draft', 'the size of the prize', 'the ship will capsize',
      'a voltmeter and an ammeter', 'the gas meter', 'practice makes perfect',
    ]) {
      expect(toBritish(ok)).toBe(ok)
    }
  })

  it('converts the unit but not the instrument', () => {
    expect(toBritish('a length of 5 meters')).toBe('a length of 5 metres')
    expect(toBritish('read the voltmeter')).toBe('read the voltmeter')
  })

  it('takes the longest form first', () => {
    expect(toBritish('in the neighborhood')).toBe('in the neighbourhood')
    expect(toBritish('my neighbors')).toBe('my neighbours')
  })

  it('handles empty and missing input', () => {
    expect(toBritish('')).toBe('')
    expect(toBritish(null)).toBe('')
    expect(toBritish(undefined)).toBe('')
  })
})

describe('americanSpellings', () => {
  it('reports what it finds', () => {
    expect(americanSpellings('The behavior of the colored fiber')).toEqual(
      expect.arrayContaining(['behavior', 'colored', 'fiber']),
    )
  })

  it('reports nothing for British text', () => {
    expect(americanSpellings('The behaviour of the coloured fibre')).toEqual([])
    expect(americanSpellings('a humorous laboratory program')).toEqual([])
  })
})
