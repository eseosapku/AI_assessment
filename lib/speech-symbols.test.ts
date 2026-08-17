import { describe, it, expect } from 'vitest'
import { speakSymbols, needsSpeechHint } from './speech-symbols'

describe('needsSpeechHint', () => {
  it('is false for plain prose, so untouched text does no work', () => {
    expect(needsSpeechHint('Which shape has four equal sides?')).toBe(false)
    expect(needsSpeechHint('')).toBe(false)
    expect(needsSpeechHint(null)).toBe(false)
  })

  it('is true when a symbol is present', () => {
    expect(needsSpeechHint('12 ÷ 4')).toBe(true)
    expect(needsSpeechHint('x ≥ 5')).toBe(true)
  })
})

describe('speakSymbols', () => {
  it('speaks the arithmetic operators', () => {
    expect(speakSymbols('12 ÷ 4 = 3')).toBe('12 divided by 4 = 3')
    expect(speakSymbols('6 × 7')).toBe('6 times 7')
  })

  it('speaks comparisons without mangling the compound forms', () => {
    // ≥ must not be read as > after something has eaten the =.
    expect(speakSymbols('x ≥ 5')).toBe('x is greater than or equal to 5')
    expect(speakSymbols('x ≤ 5')).toBe('x is less than or equal to 5')
    expect(speakSymbols('a ≠ b')).toBe('a is not equal to b')
    expect(speakSymbols('3 < 5')).toBe('3 is less than 5')
  })

  it('speaks roots, powers and units', () => {
    expect(speakSymbols('√16')).toBe('the square root of 16')
    expect(speakSymbols('5² cm')).toBe('5 squared cm')
    expect(speakSymbols('90°')).toBe('90 degrees')
  })

  it('speaks science notation', () => {
    expect(speakSymbols('H₂ + O ⇌ product')).toContain('in equilibrium with')
    expect(speakSymbols('A → B')).toBe('A gives B')
  })

  it('handles several symbols in one string', () => {
    expect(speakSymbols('½ × 90° ≈ 45°')).toBe(
      'one half times 90 degrees is approximately 45 degrees',
    )
  })

  it('keeps punctuation tight so it reads as a sentence', () => {
    expect(speakSymbols('Find √9, then stop.')).toBe('Find the square root of 9, then stop.')
  })

  it('leaves prose untouched', () => {
    const plain = 'Which shape has four equal sides?'
    expect(speakSymbols(plain)).toBe(plain)
  })

  it('survives empty and non-string input', () => {
    expect(speakSymbols('')).toBe('')
    expect(speakSymbols(null)).toBe('')
    expect(speakSymbols(undefined)).toBe('')
  })
})
