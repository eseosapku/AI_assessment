// lib/passage-paragraphs.test.ts
import { describe, it, expect } from 'vitest'
import { splitIntoParagraphs, letterFor, wordCount, readingMinutes } from './passage-paragraphs'

describe('lettering a passage', () => {
  it('splits on blank lines and letters them in reading order', () => {
    const p = splitIntoParagraphs('First para.\n\nSecond para.\n\nThird para.')
    expect(p.map((x) => x.label)).toEqual(['A', 'B', 'C'])
    expect(p[1].text).toBe('Second para.')
  })

  it('falls back to single newlines, which is what the model sometimes returns', () => {
    const p = splitIntoParagraphs('First para.\nSecond para.')
    expect(p.map((x) => x.label)).toEqual(['A', 'B'])
  })

  it('does not letter a single paragraph', () => {
    // A lone "A" labels nothing, because there is nothing to tell it from.
    const p = splitIntoParagraphs('Only one paragraph here.')
    expect(p).toEqual([{ label: '', text: 'Only one paragraph here.' }])
  })

  it('is empty for an empty passage', () => {
    expect(splitIntoParagraphs('')).toEqual([])
    expect(splitIntoParagraphs(undefined)).toEqual([])
  })

  it('keeps going past Z', () => {
    expect(letterFor(0)).toBe('A')
    expect(letterFor(25)).toBe('Z')
    expect(letterFor(26)).toBe('AA')
  })

  it('counts words and never reports a zero-minute read', () => {
    expect(wordCount('one two three')).toBe(3)
    expect(wordCount('')).toBe(0)
    expect(readingMinutes('a few words')).toBe(1)
    expect(readingMinutes(Array(540).fill('word').join(' '))).toBe(3)
  })
})
