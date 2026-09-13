// lib/tag-tokens.test.ts
import { describe, it, expect } from 'vitest'
import { tagTokens, TAG_STOPWORDS } from './tag-tokens'

describe('tagTokens', () => {
  it('lowercases and keeps only alphanumeric runs', () => {
    expect(tagTokens('Photosynthesis: light-dependent REACTIONS!')).toEqual([
      'photosynthesis', 'light', 'dependent', 'reactions',
    ])
  })

  it('drops words of three characters or fewer', () => {
    // "of", "an", "at" carry no signal for matching a strand name.
    expect(tagTokens('Rate of an acid at 20C')).not.toContain('of')
    expect(tagTokens('Rate of an acid at 20C')).toContain('acid')
  })

  it('drops stopwords', () => {
    for (const word of TAG_STOPWORDS) {
      expect(tagTokens(`alpha ${word} beta`)).not.toContain(word)
    }
  })

  it('never throws on empty or non-string input', () => {
    expect(tagTokens('')).toEqual([])
    expect(tagTokens(null as unknown as string)).toEqual([])
    expect(tagTokens(undefined as unknown as string)).toEqual([])
  })
})
