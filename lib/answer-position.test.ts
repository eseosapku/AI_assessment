// lib/answer-position.test.ts
import { describe, it, expect } from 'vitest'
import {
  assertedAnswer,
  reconcileKeyWithExplanation,
  delexicaliseExplanation,
  balanceAnswerPositions,
  stripOptionLabels,
  repairAnswerKeys,
} from './answer-position'

describe('reading the answer the explanation asserts', () => {
  it('reads a parenthesised value beside "correct"', () => {
    expect(assertedAnswer('The correct answer is 7 because 3 + 4 = 7. Option B (7) is correct.')).toBe('7')
  })

  it('reads a plainly stated value', () => {
    expect(assertedAnswer('The correct answer is carbon dioxide because plants absorb it.')).toBe('carbon dioxide')
    expect(assertedAnswer('The correct answer is 9.')).toBe('9')
  })

  it('refuses a bare letter, which is the unreliable half', () => {
    expect(assertedAnswer('The correct answer is B.')).toBeNull()
  })

  it('refuses anything absent or hedged', () => {
    expect(assertedAnswer('')).toBeNull()
    expect(assertedAnswer(undefined)).toBeNull()
    expect(assertedAnswer('Plants need light to photosynthesise.')).toBeNull()
  })
})

describe('pointing the key at the right option', () => {
  it('fixes a key that contradicts its own explanation', () => {
    // Verbatim from a Primary 1 paper. The reasoning is right, the index is
    // off by one, and a child who answers 7 is marked wrong.
    const q = reconcileKeyWithExplanation({
      question: 'What is 3 plus 4?',
      options: ['6', '7', '8', '5'],
      correct_answer: 0,
      explanation: 'The correct answer is 7 because when you add 3 and 4, you get 7. Option B (7) is correct.',
    })
    expect(q.correct_answer).toBe(1)
  })

  it('trusts the value over the letter, and so leaves a right key alone', () => {
    // Same paper, the other way round: the letter says B, the value says 7,
    // and 7 is option A — which is what the key already said. Following the
    // letter here would break a question that was correct.
    const q = reconcileKeyWithExplanation({
      question: 'What is 5 plus 2?',
      options: ['7', '6', '8', '4'],
      correct_answer: 0,
      explanation: 'The correct answer is 7 because when you add 5 and 2, you get 7. Option B (7) is correct.',
    })
    expect(q.correct_answer).toBe(0)
  })

  it('does nothing when the asserted value matches more than one option', () => {
    const q = reconcileKeyWithExplanation({
      options: ['7', '7', '8', '4'],
      correct_answer: 2,
      explanation: 'The correct answer is 7.',
    })
    expect(q.correct_answer).toBe(2)
  })

  it('does nothing when the explanation asserts nothing', () => {
    const q = reconcileKeyWithExplanation({
      options: ['6', '7', '8', '5'],
      correct_answer: 3,
      explanation: 'Addition means putting two amounts together.',
    })
    expect(q.correct_answer).toBe(3)
  })

  it('leaves non-four-option questions untouched', () => {
    const q = { options: ['a', 'b'], correct_answer: 0, explanation: 'The correct answer is b.' }
    expect(reconcileKeyWithExplanation(q)).toEqual(q)
  })
})

describe('taking the letters out of the prose', () => {
  it('drops the label and keeps the value', () => {
    const q = delexicaliseExplanation({
      options: ['6', '7', '8', '5'],
      correct_answer: 1,
      explanation: 'Option B (7) is correct because 3 + 4 = 7. Option A (6) is incorrect.',
    })
    expect(q.explanation).toBe('7 is correct because 3 + 4 = 7. 6 is incorrect.')
  })

  it('substitutes what the option actually says when no value is given', () => {
    const q = delexicaliseExplanation({
      options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'],
      correct_answer: 0,
      explanation: 'Option C is incorrect because plants do not absorb it.',
    })
    expect(q.explanation).toBe('Nitrogen is incorrect because plants do not absorb it.')
  })

  it('leaves an explanation with no letters in it alone', () => {
    const e = 'Plants take in carbon dioxide through their stomata.'
    expect(delexicaliseExplanation({ options: ['a', 'b', 'c', 'd'], correct_answer: 0, explanation: e }).explanation)
      .toBe(e)
  })
})

describe('spreading the answers across the four positions', () => {
  const q = (options: string[], correct_answer: number) => ({ options, correct_answer })

  it('breaks up a run of A', () => {
    // Measured live: 26 of 48 answers were A and 2 were D. A child who always
    // picks A scores 54% without reading the paper.
    const paper = balanceAnswerPositions([
      q(['1', '2', '3', '4'], 0), q(['5', '6', '7', '8'], 0),
      q(['9', '10', '11', '12'], 0), q(['13', '14', '15', '16'], 0),
    ])
    expect(paper.map((x) => x.correct_answer).sort()).toEqual([0, 1, 2, 3])
  })

  it('keeps the correct option correct wherever it moves', () => {
    const paper = balanceAnswerPositions([
      q(['1', '2', '3', '4'], 0), q(['5', '6', '7', '8'], 0), q(['9', '10', '11', '12'], 0),
    ])
    expect(paper[1].options[paper[1].correct_answer as number]).toBe('5')
    expect(paper[2].options[paper[2].correct_answer as number]).toBe('9')
  })

  it('rotates rather than shuffles, so an ordered list stays ordered', () => {
    // Ascending distractors matter in a Maths paper and cost nothing elsewhere.
    const [moved] = balanceAnswerPositions([q(['1', '2', '3', '4'], 0), q(['1', '2', '3', '4'], 0)]).slice(1)
    const opts = moved.options as string[]
    const start = opts.indexOf('1')
    expect(opts.map((_, i) => opts[(start + i) % 4])).toEqual(['1', '2', '3', '4'])
  })

  it('leaves a paper that is already balanced alone', () => {
    const paper = [q(['1', '2', '3', '4'], 0), q(['1', '2', '3', '4'], 1), q(['1', '2', '3', '4'], 2)]
    expect(balanceAnswerPositions(paper)).toEqual(paper)
  })

  it('is deterministic', () => {
    const paper = [q(['1', '2', '3', '4'], 0), q(['5', '6', '7', '8'], 0), q(['9', '10', '11', '12'], 0)]
    expect(balanceAnswerPositions(paper)).toEqual(balanceAnswerPositions(paper))
  })

  it('passes long-form and short-answer questions through untouched', () => {
    const lf = [{ question: 'Explain photosynthesis.', marks: 3 }]
    expect(balanceAnswerPositions(lf)).toEqual(lf)
  })
})

describe('options that label themselves', () => {
  it('takes the letter off when every option carries one', () => {
    // A Literature paper came back like this. The UI draws its own letters, so
    // the student reads "A. A. Opening a book".
    const q = stripOptionLabels({
      options: ['A. Opening a book', 'B. Unwrapping a precious gift', 'C. Solving a puzzle', 'D. Planting a garden'],
      correct_answer: 1,
    })
    expect(q.options).toEqual(['Opening a book', 'Unwrapping a precious gift', 'Solving a puzzle', 'Planting a garden'])
  })

  it('accepts the other separators', () => {
    expect(stripOptionLabels({ options: ['A) one', 'B) two', 'C) three', 'D) four'], correct_answer: 0 }).options)
      .toEqual(['one', 'two', 'three', 'four'])
  })

  it('leaves a genuine answer beginning with a letter alone', () => {
    // "A. Vitamin A" is a label; "Vitamin A" is an answer. The guard is that
    // ALL four must be labelled, in order.
    const q = { options: ['Vitamin A', 'B. Vitamin B', 'Vitamin C', 'Vitamin D'], correct_answer: 2 }
    expect(stripOptionLabels(q).options).toEqual(q.options)
  })

  it('leaves labels that are out of order alone', () => {
    const q = { options: ['B. one', 'A. two', 'C. three', 'D. four'], correct_answer: 0 }
    expect(stripOptionLabels(q).options).toEqual(q.options)
  })

  it('strips before balancing, so a rotated option is not mislabelled', () => {
    // The reason this must run first: rotate a self-labelled option and
    // "A. Opening a book" ends up sitting in position B.
    const paper = repairAnswerKeys([
      { options: ['A. one', 'B. two', 'C. three', 'D. four'], correct_answer: 0, explanation: 'one is right.' },
      { options: ['A. five', 'B. six', 'C. seven', 'D. eight'], correct_answer: 0, explanation: 'five is right.' },
    ])
    for (const q of paper) {
      for (const o of q.options as string[]) expect(o).not.toMatch(/^[A-D][).:]/)
    }
    expect(paper[1].options![paper[1].correct_answer as number]).toBe('five')
  })
})

describe('the whole repair together', () => {
  it('fixes the key, drops the letters and moves the answer off A', () => {
    const paper = repairAnswerKeys([
      {
        question: 'What is 3 plus 4?',
        options: ['6', '7', '8', '5'],
        correct_answer: 0,
        explanation: 'The correct answer is 7 because 3 + 4 = 7. Option B (7) is correct.',
      },
      {
        question: 'What is 1 plus 9?',
        options: ['10', '8', '7', '5'],
        correct_answer: 0,
        explanation: 'The correct answer is 10 because 1 + 9 = 10. Option A (10) is correct.',
      },
    ])

    // The key now points at 7, wherever 7 ended up.
    expect(paper[0].options![paper[0].correct_answer as number]).toBe('7')
    expect(paper[1].options![paper[1].correct_answer as number]).toBe('10')
    // No letters left in the prose.
    for (const q of paper) expect(String(q.explanation)).not.toMatch(/\boption\s*[A-D]\b/i)
    // And the two answers are not both in the same place.
    expect(paper[0].correct_answer).not.toBe(paper[1].correct_answer)
  })

  it('survives junk', () => {
    for (const junk of [null, undefined, 'x', 42, {}, [null], [42]]) {
      expect(() => repairAnswerKeys(junk as never)).not.toThrow()
    }
  })
})
