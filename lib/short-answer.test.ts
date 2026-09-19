// lib/short-answer.test.ts
import { describe, it, expect } from 'vitest'
import { gradeShortAnswer, normalizeAnswer } from './short-answer'

const key = (accepted: string[], extra: Record<string, unknown> = {}) => ({ accepted, ...extra })

describe('what counts as the same answer', () => {
  it('ignores case and surrounding space', () => {
    expect(gradeShortAnswer('  Photosynthesis ', key(['photosynthesis'])).correct).toBe(true)
  })

  it('ignores a trailing full stop, the way a marker would', () => {
    expect(gradeShortAnswer('condensation.', key(['condensation'])).correct).toBe(true)
  })

  it('accepts any of the listed answers', () => {
    const k = key(['millimetre', 'millimeter', 'mm'])
    for (const given of ['millimetre', 'Millimeter', ' MM ']) {
      expect(gradeShortAnswer(given, k).correct, given).toBe(true)
    }
  })

  it('strips a restated subject, because the answer line often pre-prints it', () => {
    // The papers print "h = " before the box. A learner who types "h = 5" has
    // given the same answer as one who types "5".
    expect(gradeShortAnswer('h = 5', key(['5'], { numeric: true })).correct).toBe(true)
    expect(gradeShortAnswer('area = 75', key(['75'], { numeric: true })).correct).toBe(true)
  })

  it('collapses internal whitespace rather than failing on it', () => {
    expect(gradeShortAnswer('food   web', key(['food web'])).correct).toBe(true)
  })
})

describe('numbers', () => {
  it('treats 12, 12.0 and 12.00 as the same number', () => {
    const k = key(['12'], { numeric: true })
    for (const g of ['12', '12.0', '12.00', ' 12 ']) expect(gradeShortAnswer(g, k).correct, g).toBe(true)
  })

  it('accepts a number written with a thousands separator', () => {
    expect(gradeShortAnswer('1,500', key(['1500'], { numeric: true })).correct).toBe(true)
  })

  it('accepts a unicode minus, which phone keyboards produce', () => {
    expect(gradeShortAnswer('−7', key(['-7'], { numeric: true })).correct).toBe(true)
  })

  it('allows the tolerance the question sets, and nothing more', () => {
    const k = key(['3.14'], { numeric: true, tolerance: 0.01 })
    expect(gradeShortAnswer('3.15', k).correct).toBe(true)
    expect(gradeShortAnswer('3.13', k).correct).toBe(true)
    expect(gradeShortAnswer('3.2', k).correct).toBe(false)
  })

  it('is exact when no tolerance is set', () => {
    expect(gradeShortAnswer('3.15', key(['3.14'], { numeric: true })).correct).toBe(false)
  })

  it('accepts the unit when the question expects one, and without it too', () => {
    // The papers pre-print the unit beside the answer box ("cm2 [1]"), so a
    // learner may or may not retype it. Neither is wrong.
    const k = key(['75'], { numeric: true, unit: 'cm2' })
    for (const g of ['75', '75cm2', '75 cm2', '75 CM2']) {
      expect(gradeShortAnswer(g, k).correct, g).toBe(true)
    }
  })

  it('refuses a right number with the wrong unit', () => {
    // Getting the number right and the unit wrong is a real, markable error.
    expect(gradeShortAnswer('75 m2', key(['75'], { numeric: true, unit: 'cm2' })).correct).toBe(false)
  })
})

describe('spelling', () => {
  it('forgives one slip in a long word', () => {
    // Checkpoint Science credits a recognisable attempt at a technical word.
    expect(gradeShortAnswer('photosynthesus', key(['photosynthesis'])).correct).toBe(true)
  })

  it('does not forgive a slip in a short word, where it changes the answer', () => {
    // "mass" and "gas" are both answers; one edit apart must not be a match.
    expect(gradeShortAnswer('gas', key(['mass'])).correct).toBe(false)
    expect(gradeShortAnswer('cell', key(['bell'])).correct).toBe(false)
  })

  it('never forgives a slip into a different listed answer', () => {
    expect(gradeShortAnswer('vein', key(['artery', 'vein'])).correct).toBe(true)
  })

  it('refuses something merely similar', () => {
    expect(gradeShortAnswer('photo', key(['photosynthesis'])).correct).toBe(false)
    expect(gradeShortAnswer('evaporation', key(['condensation'])).correct).toBe(false)
  })
})

describe('refusing to guess', () => {
  it('marks an empty answer wrong rather than throwing', () => {
    for (const g of ['', '   ', null, undefined, 42, {}, []]) {
      expect(gradeShortAnswer(g as unknown, key(['x'])).correct, String(g)).toBe(false)
    }
  })

  it('marks everything wrong when the question carries no answer key', () => {
    // A question with nothing to mark against cannot be marked. Awarding it
    // would hand out a mark nobody earned.
    expect(gradeShortAnswer('anything', key([])).correct).toBe(false)
    expect(gradeShortAnswer('anything', { accepted: ['  '] }).correct).toBe(false)
  })

  it('says why it refused, so a wrong key is visible rather than silent', () => {
    expect(gradeShortAnswer('anything', key([])).reason).toBe('no-key')
    expect(gradeShortAnswer('', key(['x'])).reason).toBe('blank')
    expect(gradeShortAnswer('wrong', key(['right'])).reason).toBe('no-match')
    expect(gradeShortAnswer('right', key(['right'])).reason).toBe('exact')
  })
})

describe('normalizeAnswer', () => {
  it('is stable and lowercase', () => {
    expect(normalizeAnswer('  The   Water Cycle. ')).toBe('the water cycle')
  })

  it('survives junk', () => {
    expect(normalizeAnswer(null)).toBe('')
    expect(normalizeAnswer(undefined)).toBe('')
    expect(normalizeAnswer(12 as unknown)).toBe('12')
  })
})
