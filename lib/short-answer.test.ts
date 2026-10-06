// lib/short-answer.test.ts
import { describe, it, expect } from 'vitest'
import { gradeShortAnswer, normalizeAnswer, isPlaceholderKey } from './short-answer'

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

  it('ignores a leading article on either side, the way a marker would', () => {
    expect(gradeShortAnswer('the heart', key(['heart'])).correct).toBe(true)
    expect(gradeShortAnswer('lens', key(['a lens'])).correct).toBe(true)
    expect(gradeShortAnswer('An increase', key(['increase'])).correct).toBe(true)
  })

  it('never takes a label for an article', () => {
    // "A and C" names two labels; it is not "and C".
    expect(gradeShortAnswer('A and C', key(['and c'])).correct).toBe(false)
    expect(gradeShortAnswer('A', key(['heart'])).correct).toBe(false)
    expect(gradeShortAnswer('a b', key(['b'])).correct).toBe(false)
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

describe('a key that is the shape of an answer, not an answer', () => {
  it('spots the placeholders a model returns when it cannot answer its own question', () => {
    // Real, from a paper: "name one plant species in the diagram" came back
    // with {"accepted":["Plant name"]}. Marked against that, every learner is
    // wrong and the paper says so confidently.
    for (const junk of ['Plant name', 'answer', 'The value', 'name', 'species', 'unit', '<the answer>', '...']) {
      expect(isPlaceholderKey({ accepted: [junk] }), junk).toBe(true)
    }
  })

  it('treats an empty or missing key as a placeholder too', () => {
    expect(isPlaceholderKey({ accepted: [] })).toBe(true)
    expect(isPlaceholderKey(null)).toBe(true)
    expect(isPlaceholderKey(undefined)).toBe(true)
    expect(isPlaceholderKey({ accepted: ['  '] })).toBe(true)
  })

  it('rejects a key nobody could type', () => {
    // Real, from a paper: a 2-mark written answer came back carrying a whole
    // sentence as its "key". Matched against that every learner is wrong, and
    // carrying a key is what demotes a question to one mark.
    expect(isPlaceholderKey({ accepted: [
      'Using the same type of plant ensures that any differences in growth are due to the light conditions',
    ] })).toBe(true)
  })

  it('keeps a brief phrase, which is a real short answer', () => {
    expect(isPlaceholderKey({ accepted: ['elastic potential energy'] })).toBe(false)
    expect(isPlaceholderKey({ accepted: ['the same type of plant'] })).toBe(false)
  })

  it('leaves a real answer alone', () => {
    for (const real of ['condensation', 'nitrogen', '75', 'igneous', 'elastic potential energy', 'copper']) {
      expect(isPlaceholderKey({ accepted: [real] }), real).toBe(false)
    }
  })

  it('keeps a key where one listed form is real', () => {
    // A vague alternative beside a real answer is not a placeholder.
    expect(isPlaceholderKey({ accepted: ['photosynthesis', 'name'] })).toBe(false)
  })
})

describe('the fill-in-the-blank keys that were never caught', () => {
  it('rejects a slot where an answer should be', () => {
    // This rule had never fired: its word boundaries had been written as
    // literal backspace characters, so the regex could not match anything.
    for (const a of ['name here', 'plant name here', '<the answer>', '...', 'your answer', 'answer here']) {
      expect(isPlaceholderKey({ accepted: [a] }), a).toBe(true)
    }
  })

  it('still accepts a real answer that happens to contain those words', () => {
    expect(isPlaceholderKey({ accepted: ['photosynthesis'] })).toBe(false)
    expect(isPlaceholderKey({ accepted: ['here'] })).toBe(false)
  })
})
