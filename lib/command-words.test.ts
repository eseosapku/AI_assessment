import { describe, it, expect } from 'vitest'
import { commandWordsFor, buildCommandWordBlock } from './command-words'
import { CURRICULUM_REGISTRY } from './curriculum-registry'

describe('commandWordsFor', () => {
  it('covers every curriculum in the registry', () => {
    // A curriculum without a vocabulary silently falls back to generic
    // phrasing, which is the gap this exists to close.
    for (const meta of Object.values(CURRICULUM_REGISTRY)) {
      expect(commandWordsFor(meta.slug), meta.slug).not.toBeNull()
    }
  })

  it('returns nothing for an unknown board rather than inventing a vocabulary', () => {
    expect(commandWordsFor(null)).toBeNull()
    expect(commandWordsFor(undefined)).toBeNull()
    expect(commandWordsFor('made-up' as never)).toBeNull()
  })

  it('keeps boards distinct instead of averaging them', () => {
    // WAEC uses "mention" and "outline"; Cambridge does not. Merging the lists
    // would teach a vocabulary neither board actually sets.
    const waec = commandWordsFor('waec')!.words.map((w) => w.word)
    const cam = commandWordsFor('cambridge')!.words.map((w) => w.word)
    expect(waec).toContain('Mention')
    expect(cam).not.toContain('Mention')
    expect(cam).toContain('Suggest')
    expect(waec).not.toContain('Suggest')
  })

  it('gives every word a meaning and an expected length', () => {
    // The length is what stops a 1-mark question asking for a paragraph.
    for (const meta of Object.values(CURRICULUM_REGISTRY)) {
      for (const w of commandWordsFor(meta.slug)!.words) {
        expect(w.means.length, `${meta.slug}/${w.word}`).toBeGreaterThan(20)
        expect(w.expect.length, `${meta.slug}/${w.word}`).toBeGreaterThan(5)
      }
    }
  })
})

describe('buildCommandWordBlock', () => {
  it('names the board so the vocabulary is attributable', () => {
    expect(buildCommandWordBlock('cambridge')).toContain('Cambridge Assessment International Education')
    expect(buildCommandWordBlock('waec')).toContain('West African Examinations Council')
  })

  it('carries the mark convention, not just the words', () => {
    expect(buildCommandWordBlock('cambridge')).toMatch(/\[2\]|brackets/)
    expect(buildCommandWordBlock('jamb')).toMatch(/four options/i)
  })

  it('drops the written-answer guidance for a multiple-choice-only board', () => {
    // JAMB has no written papers, so mark-to-command matching is noise.
    expect(buildCommandWordBlock('jamb')).not.toMatch(/a 1-mark question uses/)
    expect(buildCommandWordBlock('waec')).toMatch(/a 1-mark question uses/)
  })

  it('drops it for an MCQ paper on any board', () => {
    expect(buildCommandWordBlock('cambridge', 'mcq')).not.toMatch(/a 1-mark question uses/)
    expect(buildCommandWordBlock('cambridge', 'longform')).toMatch(/a 1-mark question uses/)
  })

  it('is empty when the curriculum is unknown', () => {
    expect(buildCommandWordBlock(null)).toBe('')
    expect(buildCommandWordBlock(undefined)).toBe('')
  })
})
