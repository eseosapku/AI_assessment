import { describe, it, expect } from 'vitest'
import { classifySubjectDomain } from './subject-assessment-plan'

/**
 * Every string here is a real value from the live `assessments.subject`
 * column. The field stores textbook filenames, so the classifier has to cope
 * with levels, edition markers, double spaces and national acronyms — and
 * 28% of the corpus was falling through to generic prompts because it did not.
 */
describe('classifySubjectDomain against real stored values', () => {
  it('classifies a subject named only "Science"', () => {
    // The original pattern listed physics, chemistry, biology and
    // "integrated science" — but not the bare word, so 22 results were
    // generated from a subject called exactly this with the default prompt.
    expect(classifySubjectDomain('Science')).toBe('science')
    expect(classifySubjectDomain('Cambridge Lower Secondary Science 9 Learners Book')).toBe('science')
  })

  it('sees through punctuation used as a separator', () => {
    // "Cambridge-Science-9" has no word boundary around science without this.
    expect(classifySubjectDomain('Mathematics-S1-SB')).toBe('math')
    expect(classifySubjectDomain('P1-SST-PB')).toBe('humanities')
    expect(classifySubjectDomain('P1-SET-PB.')).toBe('science')
    expect(classifySubjectDomain('Entrepreneurship S5_SB')).toBe('business')
  })

  it('classifies entrepreneurship, the largest unclassified group', () => {
    for (const v of [
      'Entrepreneurship S2',
      'Entrepreneurship S1',
      'S3 Entrepreneurship SB',
      'Entrepreneurship S4_SB',
      'Entrepreneurship S6_SB',
    ]) {
      expect(classifySubjectDomain(v), v).toBe('business')
    }
  })

  it('classifies the arts, which had no domain at all', () => {
    expect(classifySubjectDomain('Fine Art and Crafts S1 SB')).toBe('arts')
    expect(classifySubjectDomain('Music S2 SB')).toBe('arts')
  })

  it('classifies religion without needing an exact phrase', () => {
    // The old pattern wanted "religious studies" or "ethics and"; the stored
    // value is "Religion  Ethics S1", which matched neither.
    expect(classifySubjectDomain('Religion  Ethics S1')).toBe('religious')
    expect(classifySubjectDomain('Islamic Studies')).toBe('religious')
  })

  it('keeps the domains it already got right', () => {
    expect(classifySubjectDomain('Advanced Mathematics S6 SB (1)')).toBe('math')
    expect(classifySubjectDomain('Biology S4  SB')).toBe('science')
    expect(classifySubjectDomain('Physics Learners book S2')).toBe('science')
    expect(classifySubjectDomain('ICT S5 Adapted SB')).toBe('technology')
    expect(classifySubjectDomain('English S6 SB')).toBe('language')
    expect(classifySubjectDomain('AGRIC S2 SB')).toBe('science')
  })

  it('puts business ahead of the domains that would otherwise claim it', () => {
    // "Business studies" contains neither science nor geography, but
    // agribusiness contains "agri" and would land in science.
    expect(classifySubjectDomain('Business Studies')).toBe('business')
    expect(classifySubjectDomain('Agribusiness S4')).toBe('business')
    expect(classifySubjectDomain('Accounting')).toBe('business')
  })

  it('still returns default for something genuinely unidentifiable', () => {
    // A stray uploaded document should not be forced into a subject.
    expect(classifySubjectDomain('Branis_Sumba_RUZIVO_Abstract')).toBe('default')
    expect(classifySubjectDomain('')).toBe('default')
  })
})
