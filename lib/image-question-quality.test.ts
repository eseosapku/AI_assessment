import { describe, it, expect } from 'vitest'
import {
  answerLeakage,
  describesTheImage,
  figureTypeMismatch,
  judgeImageQuestion,
  LEAKAGE_LIMIT,
} from './image-question-quality'

/** The question that prompted all of this, verbatim from a generated paper. */
const RAINFALL = {
  question:
    'A map shows a backyard scene during a rainfall. The rain is visible as streaks on the image. What does this indicate about the weather conditions?',
  options: [
    'It is a sunny day with clear skies.',
    'It is a rainy day with precipitation.',
    'It is a windy day.',
    'It is a snowy day.',
  ],
  correct_answer: 1,
  visionType: 'photograph',
}

describe('the rainfall question', () => {
  it('is caught', () => {
    const verdict = judgeImageQuestion(RAINFALL)
    expect(verdict.ok).toBe(false)
  })

  it('is caught for restating its own answer', () => {
    // "rainfall" and "rain" in the stem give away "a rainy day with
    // precipitation" without ever looking at the picture.
    const others = RAINFALL.options.filter((_, i) => i !== 1)
    expect(answerLeakage(RAINFALL.question, RAINFALL.options[1], others)).toBeGreaterThanOrEqual(LEAKAGE_LIMIT)
  })

  it('also narrates the picture and misnames it', () => {
    expect(describesTheImage(RAINFALL.question)).toBe(true)
    expect(figureTypeMismatch(RAINFALL.question, 'photograph')).toBe(true)
  })
})

describe('answerLeakage', () => {
  it('is low when the stem gives nothing away', () => {
    expect(answerLeakage('Which structure is labelled X?', 'The myelin sheath')).toBeLessThan(LEAKAGE_LIMIT)
  })

  it('catches a paraphrase, not just a verbatim repeat', () => {
    expect(answerLeakage('The diagram of photosynthesis in a leaf', 'Photosynthesis')).toBeGreaterThanOrEqual(LEAKAGE_LIMIT)
  })

  it('handles a missing or empty answer', () => {
    expect(answerLeakage('Anything', '')).toBe(0)
  })

  it('ignores context words every option shares', () => {
    // "cell" appears in the stem and in every distractor, so it gives nothing
    // away; only "wall" distinguishes the right answer.
    const leak = answerLeakage(
      'Which part of the plant cell is shown here?',
      'Cell wall',
      ['Cell membrane', 'Cell nucleus', 'Cell vacuole'],
    )
    expect(leak).toBeLessThan(LEAKAGE_LIMIT)
  })
})

describe('describesTheImage', () => {
  it('allows pointing at a figure', () => {
    // Referring to the figure is necessary and must stay allowed.
    expect(describesTheImage('In the photograph, which part is labelled B?')).toBe(false)
    expect(describesTheImage('Use the graph to find the value at 3 seconds.')).toBe(false)
  })

  it('flags narrating its contents', () => {
    expect(describesTheImage('The image shows a plant cell with a large vacuole.')).toBe(true)
    expect(describesTheImage('The diagram depicts a circuit with two resistors.')).toBe(true)
  })
})

describe('figureTypeMismatch', () => {
  it('flags a photograph called a map', () => {
    expect(figureTypeMismatch('A map shows a backyard.', 'photograph')).toBe(true)
  })

  it('accepts a correctly named figure', () => {
    expect(figureTypeMismatch('The graph shows speed over time.', 'graph')).toBe(false)
    expect(figureTypeMismatch('Use the map to find the river.', 'map')).toBe(false)
  })

  it('does not flag the generic words, which are always fair', () => {
    expect(figureTypeMismatch('In the image, which part is X?', 'diagram')).toBe(false)
  })

  it('says nothing when the figure type is unknown', () => {
    expect(figureTypeMismatch('A map shows a backyard.', undefined)).toBe(false)
    expect(figureTypeMismatch('A map shows a backyard.', '')).toBe(false)
  })
})

describe('judgeImageQuestion', () => {
  it('passes a question that genuinely needs its figure', () => {
    expect(
      judgeImageQuestion({
        question: 'In the diagram, which structure is labelled C?',
        options: ['Axon', 'Dendrite', 'Nucleus', 'Synapse'],
        correct_answer: 2,
        visionType: 'diagram',
      }).ok,
    ).toBe(true)
  })

  it('drops the question when the answer leaked, since no figure rescues it', () => {
    const v = judgeImageQuestion(RAINFALL)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.action).toBe('drop-question')
  })

  it('drops only the image when the figure is merely redundant', () => {
    // The question still works as text, and losing a question costs the
    // student practice while losing an image costs nothing.
    const v = judgeImageQuestion({
      question: 'The image shows a plant cell. Which organelle carries out photosynthesis?',
      options: ['Chloroplast', 'Ribosome', 'Golgi body', 'Lysosome'],
      correct_answer: 0,
      visionType: 'diagram',
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.action).toBe('drop-image')
  })

  it('handles malformed questions without throwing', () => {
    expect(judgeImageQuestion({}).ok).toBe(true)
    expect(judgeImageQuestion({ question: 'x', options: [], correct_answer: 9 }).ok).toBe(true)
    expect(judgeImageQuestion({ options: 'nope', correct_answer: null } as never).ok).toBe(true)
  })
})
