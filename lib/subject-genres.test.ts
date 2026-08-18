import { describe, it, expect } from 'vitest'
import { buildSubjectGenreBlock, hasGenreGuidance } from './subject-genres'
import { classifySubjectDomain, type SubjectDomain } from './subject-assessment-plan'

const DOMAINS: SubjectDomain[] = [
  'language', 'history', 'religious', 'humanities',
  'science', 'math', 'technology', 'business', 'arts', 'default',
]

describe('buildSubjectGenreBlock', () => {
  it('covers every domain the classifier can return, except the default', () => {
    // A generic paragraph for "default" would dilute the instructions around
    // it, so that one is deliberately empty.
    for (const d of DOMAINS) {
      expect(hasGenreGuidance(d), d).toBe(d !== 'default')
    }
    expect(buildSubjectGenreBlock('default')).toBe('')
  })

  it('asks maths distractors to come from named mistakes', () => {
    // The whole point: three arbitrary numbers can be eliminated by
    // inspection and teach nothing when eliminated.
    const b = buildSubjectGenreBlock('math')
    expect(b).toMatch(/sign|order|unsimplified|unit/i)
    // Phrased as the demand rather than the prohibition it replaced: each
    // distractor is the number a specific mistake produces.
    expect(b).toMatch(/the number that mistake produces/i)
    expect(b).toMatch(/name the mistake behind each wrong option/i)
  })

  it('guards against a maths question having two correct answers', () => {
    // Observed live: "which is a solution to x^2 - 5x + 6 = 0" offered both
    // roots, 2 and 3, among four options. Two right answers and no
    // defensible key is worse than a dull question.
    const b = buildSubjectGenreBlock('math')
    expect(b).toMatch(/exactly one option may be a correct answer/i)
    expect(b).toMatch(/roots/i)
  })

  it('rejects the non-explanation maths questions actually come back with', () => {
    expect(buildSubjectGenreBlock('math')).toMatch(/is not an explanation/i)
  })

  it('asks science for practical work, which generic prompts never produce', () => {
    const b = buildSubjectGenreBlock('science')
    expect(b).toMatch(/independent and dependent variables/i)
    expect(b).toMatch(/anomalous/i)
  })

  it('asks business for a scenario rather than a definition', () => {
    const b = buildSubjectGenreBlock('business')
    expect(b).toMatch(/situation rather than a definition/i)
  })

  it('asks computing to show code rather than describe it', () => {
    const b = buildSubjectGenreBlock('technology')
    expect(b).toMatch(/read code, not to define words/i)
    expect(b).toMatch(/trace-the-output/i)
  })

  it('asks languages to span the mark scheme’s three levels', () => {
    const b = buildSubjectGenreBlock('language')
    expect(b).toMatch(/literal/i)
    expect(b).toMatch(/inferential/i)
    expect(b).toMatch(/evaluative/i)
  })

  it('is phrased as what to ask for, not as a list of bans', () => {
    // Told not to write recall questions, a model writes recall questions in
    // different words; asked for a consequence, it gives a consequence.
    for (const d of DOMAINS.filter((x) => x !== 'default')) {
      const b = buildSubjectGenreBlock(d)
      const bans = (b.match(/\b(do not|don't|never|avoid)\b/gi) ?? []).length
      const asks = (b.match(/\b(ask|prefer|include|lead with|spread|use)\b/gi) ?? []).length
      expect(asks, `${d} reads as a ban list`).toBeGreaterThan(bans)
    }
  })

  it('insists on real facts in the subjects where invention is worst', () => {
    expect(buildSubjectGenreBlock('history')).toMatch(/invented/i)
    expect(buildSubjectGenreBlock('arts')).toMatch(/real, correctly attributed/i)
    expect(buildSubjectGenreBlock('religious')).toMatch(/real texts/i)
  })
})

describe('end to end from a stored subject value', () => {
  it('reaches the right genre from the filenames the database holds', () => {
    expect(buildSubjectGenreBlock(classifySubjectDomain('Mathematics-S1-SB'))).toMatch(/MATHEMATICS QUESTION DESIGN/)
    expect(buildSubjectGenreBlock(classifySubjectDomain('Entrepreneurship S5_SB'))).toMatch(/BUSINESS/)
    expect(buildSubjectGenreBlock(classifySubjectDomain('ICT S5 Adapted SB'))).toMatch(/ICT AND COMPUTING/)
    expect(buildSubjectGenreBlock(classifySubjectDomain('Music S2 SB'))).toMatch(/ART AND MUSIC/)
  })
})
