import { describe, it, expect } from 'vitest'
import { gradeMcq, gradeMatch, checkpointResultText, isValidQuestion, readGradeReply, settleStaleCell, markCheck, missedQuestions, salvageQuestions, checkAnswers, coerceQuestion, blanksIn, gradeFill, gradeOrder, gradeTap, clueStates } from '@/lib/studylab/quiz'
import type { CheckpointQuestion, QuizCell } from '@/lib/studylab/types'
import type { FillQuestion, OrderQuestion, TapQuestion } from '@/lib/studylab/quiz'

const mcq: CheckpointQuestion = { id: 'q1', format: 'mcq', prompt: 'p', options: ['a', 'b'], answer: 1 }
const match: CheckpointQuestion = {
  id: 'q2',
  format: 'match',
  prompt: 'p',
  pairs: [{ left: 'L1', right: 'R1' }, { left: 'L2', right: 'R2' }],
}

describe('gradeMcq', () => {
  it('is correct only for the answer index', () => {
    expect(gradeMcq(mcq as any, 1)).toBe(true)
    expect(gradeMcq(mcq as any, 0)).toBe(false)
  })
})

describe('gradeMatch', () => {
  it('is correct when every left maps to its right', () => {
    expect(gradeMatch(match as any, ['R1', 'R2'])).toBe(true)
    expect(gradeMatch(match as any, ['R2', 'R1'])).toBe(false)
    expect(gradeMatch(match as any, ['R1'])).toBe(false)
  })
})

describe('isValidQuestion', () => {
  it('accepts well-formed questions', () => {
    expect(isValidQuestion(mcq)).toBe(true)
    expect(isValidQuestion(match)).toBe(true)
    expect(isValidQuestion({ id: 's', format: 'short', prompt: 'p' })).toBe(true)
    expect(isValidQuestion({ id: 'c', format: 'code', prompt: 'p', goal: 'g' })).toBe(true)
  })
  it('rejects malformed questions', () => {
    expect(isValidQuestion({ format: 'mcq', prompt: 'p' })).toBe(false)
    expect(isValidQuestion({ id: 'x', format: 'rune' })).toBe(false)
    expect(isValidQuestion(null)).toBe(false)
  })
})

describe('checkpointResultText', () => {
  const cell = (id: string, state: QuizCell['state']): QuizCell => ({
    checkpointId: 'c', gate: 'hard', question: { ...mcq, id }, state,
  })

  // It used to read `CHECKPOINT RESULT: 1/2 correct. Missed: "tricky".` —
  // written to be parsed by the model. The tutor now gets the result as
  // structured data on the action and never sees this string, so there is
  // nobody left for the protocol wording to serve.
  it('speaks to the learner, not to the model', () => {
    const text = checkpointResultText([cell('q1', 'correct'), cell('q2', 'incorrect')])
    expect(text).toBe('1 of 2 right — we will go back over the rest.')
    expect(text).not.toContain('CHECKPOINT')
  })

  it('keeps a single question singular', () => {
    expect(checkpointResultText([cell('q1', 'correct')])).toBe('Correct.')
    expect(checkpointResultText([cell('q1', 'incorrect')]))
      .toBe('Not quite — we will go back over that.')
  })

  it('counts a clean sweep', () => {
    const all = [cell('q1', 'correct'), cell('q2', 'correct'), cell('q3', 'correct')]
    expect(checkpointResultText(all)).toBe('All 3 correct.')
  })

  it('does not quote the questions back — the marked card on the board already shows them', () => {
    const text = checkpointResultText([
      cell('q1', 'correct'),
      { checkpointId: 'c', gate: 'hard', question: { ...mcq, id: 'q2', prompt: 'tricky' }, state: 'incorrect' },
    ])
    expect(text).not.toContain('tricky')
  })
})

describe('a multiple-choice question with a bad answer key', () => {
  // Number(null) and Number('') are 0, so a missing key passed as "option A",
  // and an index past the options made a question nobody could get right.
  const mcq = (answer: unknown) => ({ id: 'q', prompt: 'Which?', format: 'mcq', options: ['a', 'b', 'c'], answer })
  it('is refused when the key is missing', () => {
    expect(isValidQuestion(mcq(null))).toBe(false)
    expect(isValidQuestion(mcq(''))).toBe(false)
    expect(isValidQuestion(mcq(undefined))).toBe(false)
  })
  it('is refused when the key is past the options', () => {
    expect(isValidQuestion(mcq(3))).toBe(false)
    expect(isValidQuestion(mcq(-1))).toBe(false)
  })
  it('still takes a numeric-string key the model sometimes sends', () => {
    expect(isValidQuestion(mcq('2'))).toBe(true)
    expect(isValidQuestion(mcq(0))).toBe(true)
  })
})

describe('reading the marker\'s reply', () => {
  it('takes a clear verdict', () => {
    expect(readGradeReply(true, { correct: true, feedback: 'Yes.' })).toEqual({ verdict: 'correct', feedback: 'Yes.' })
    expect(readGradeReply(true, { correct: false, feedback: 'No.' })).toEqual({ verdict: 'incorrect', feedback: 'No.' })
  })
  it('never turns a failure into a wrong answer', () => {
    // An AWS blip, a paywall or a server error came back as `incorrect`, and
    // the answer locked -- a mark lost to something the student did not do.
    expect(readGradeReply(false, { error: 'Server error' }).verdict).toBe('ungraded')
    expect(readGradeReply(true, { error: 'Subscription required' }).verdict).toBe('ungraded')
    expect(readGradeReply(true, { feedback: 'hm' }).verdict).toBe('ungraded')
    expect(readGradeReply(true, { correct: false, feedback: 'Could not grade right now — try again.' }).verdict).toBe('ungraded')
    expect(readGradeReply(true, null).verdict).toBe('ungraded')
  })
})

describe('a check question saved while it was being marked', () => {
  it('is put back to unanswered so the student can try again', () => {
    expect(settleStaleCell({ state: 'pending', given: 'x' } as QuizCell)).toEqual({ state: 'unanswered', given: 'x' })
    expect(settleStaleCell({ state: 'correct', given: 'x' } as QuizCell)).toBeNull()
  })
})

describe('marking a check on the server', () => {
  const mcq = { id: 'q1', format: 'mcq' as const, prompt: 'p?', options: ['a', 'b'], answer: 0 }
  const match = { id: 'q2', format: 'match' as const, prompt: 'pair', pairs: [{ left: 'x', right: '1' }, { left: 'y', right: '2' }] }
  const short = { id: 'q3', format: 'short' as const, prompt: 'why?' }

  it('marks choice and matching questions from what was picked, not from the state the page claims', () => {
    expect(markCheck([mcq], { q1: { given: 0 } })).toBe(true)
    expect(markCheck([mcq], { q1: { given: 1, state: 'correct' } })).toBe(false)
    expect(markCheck([match], { q2: { given: ['1', '2'] } })).toBe(true)
    expect(markCheck([match], { q2: { given: ['2', '1'], state: 'correct' } })).toBe(false)
  })

  it("takes the grade route's verdict for a written answer", () => {
    expect(markCheck([short], { q3: { given: 'because', state: 'correct' } })).toBe(true)
    expect(markCheck([short], { q3: { given: 'because', state: 'incorrect' } })).toBe(false)
  })

  it('needs more than half right, and nothing reported is nothing right', () => {
    expect(markCheck([mcq, match, short], { q1: { given: 0 }, q3: { state: 'correct' } })).toBe(true)
    expect(markCheck([mcq, match], { q1: { given: 0 } })).toBe(false)
    expect(markCheck([mcq], undefined)).toBe(false)
  })

  it('names questions by the same ids the board gives them', () => {
    const kept = salvageQuestions('cp-9', [{ format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: '1' }, { format: 'mcq', prompt: 'broken' }])
    expect(kept).toEqual([{ id: 'cp-9-q0', format: 'mcq', prompt: 'p?', options: ['a', 'b'], answer: 1 }])
  })

  it('reports each answered cell by its question id', () => {
    const cells = [{ checkpointId: 'cp', gate: 'hard' as const, question: mcq, state: 'correct' as const, given: 0 }]
    expect(checkAnswers(cells)).toEqual({ q1: { given: 0, state: 'correct' } })
  })
})

describe('per-option feedback on a multiple-choice question', () => {
  const base = { id: 'f', format: 'mcq' as const, prompt: 'Which?', options: ['A', 'B', 'C'], answer: 1 }

  it('keeps feedback that has one line per option', () => {
    const q = coerceQuestion({ ...base, optionFeedback: ['no', 'yes', 'no'] })
    expect(q.format === 'mcq' && q.optionFeedback).toEqual(['no', 'yes', 'no'])
  })

  it('drops feedback that does not line up with the options', () => {
    const short = coerceQuestion({ ...base, optionFeedback: ['no', 'yes'] })
    expect(short.format === 'mcq' && 'optionFeedback' in short).toBe(false)
    const notText = coerceQuestion({ ...base, optionFeedback: ['no', 3, 'no'] as unknown as string[] })
    expect(notText.format === 'mcq' && 'optionFeedback' in notText).toBe(false)
  })
})

describe('missedQuestions -- what a near-twin is made from', () => {
  const mcq = { id: 'q1', format: 'mcq' as const, prompt: 'What is 4 + 8?', options: ['11', '12'], answer: 1 }
  const match = { id: 'q2', format: 'match' as const, prompt: 'Pair them', pairs: [{ left: 'x', right: '1' }, { left: 'y', right: '2' }] }
  const short = { id: 'q3', format: 'short' as const, prompt: 'Why?' }

  it('lists the prompts of the questions answered wrong, marked the way the check is', () => {
    expect(missedQuestions([mcq, match, short], { q1: { given: 0 }, q2: { given: ['1', '2'] }, q3: { state: 'incorrect' } })).toEqual([
      'What is 4 + 8?',
      'Why?',
    ])
  })
  it('counts an unanswered question as missed, and a right one as not', () => {
    expect(missedQuestions([mcq, short], { q3: { state: 'correct' } })).toEqual(['What is 4 + 8?'])
  })
})

describe('fill, order and tap', () => {
  const fill: FillQuestion = { id: 'f1', format: 'fill', prompt: 'Complete the sentence.', text: 'Plants make ___ from carbon dioxide and ___.', tiles: ['glucose', 'water', 'oxygen'], answer: ['glucose', 'water'] }
  const order: OrderQuestion = { id: 'o1', format: 'order', prompt: 'Put the stages in order.', items: ['Egg', 'Larva', 'Pupa', 'Adult'], clues: [{ text: 'The larva hatches from the egg.', before: 'Egg', after: 'Larva' }, { text: 'The adult comes out of the pupa.', before: 'Pupa', after: 'Adult' }] }
  const tap: TapQuestion = { id: 't1', format: 'tap', prompt: 'Tap the nucleus.', figure: 'asset:plant-cell', answer: ['nucleus'] }

  it('counts the blanks in a sentence', () => {
    expect(blanksIn(fill.text)).toBe(2)
    expect(blanksIn('No blanks here.')).toBe(0)
  })

  it('accepts a fill whose tiles can fill its blanks, and refuses one that cannot', () => {
    expect(isValidQuestion(fill)).toBe(true)
    expect(isValidQuestion({ ...fill, answer: ['glucose'] })).toBe(false) // blanks != answers
    expect(isValidQuestion({ ...fill, tiles: ['glucose', 'oxygen'] })).toBe(false) // an answer missing from the tiles
    expect(isValidQuestion({ ...fill, tiles: ['glucose', 'water', 'water'] })).toBe(false) // a tile repeated
    expect(isValidQuestion({ ...fill, tiles: ['glucose', 'water', 'a', 'b', 'c', 'd', 'e', 'f', 'g'] })).toBe(false) // more than 8
  })

  it('accepts an order of 3 to 6 different items whose clues hold, and refuses one that does not', () => {
    expect(isValidQuestion(order)).toBe(true)
    expect(isValidQuestion({ ...order, items: ['Egg', 'Larva', 'Egg'] })).toBe(false)
    expect(isValidQuestion({ ...order, items: ['Egg', 'Adult'], clues: [] })).toBe(false)
    expect(isValidQuestion({ ...order, clues: [{ text: 'x', before: 'Egg', after: 'Caterpillar' }] })).toBe(false)
    expect(isValidQuestion({ ...order, clues: [{ text: 'x', before: 'Adult', after: 'Egg' }] })).toBe(false) // false in the right order
  })

  it('accepts a tap on parts we have mapped, and refuses anything else', () => {
    expect(isValidQuestion(tap)).toBe(true)
    expect(isValidQuestion({ ...tap, figure: 'asset:made-up' })).toBe(false)
    expect(isValidQuestion({ ...tap, answer: ['golgi'] })).toBe(false)
    expect(isValidQuestion({ ...tap, answer: [] })).toBe(false)
    expect(isValidQuestion({ ...tap, answer: ['nucleus', 'nucleus'] })).toBe(false)
    // Every part an answer: tapping everything would win.
    expect(isValidQuestion({ ...tap, answer: ['cell-wall', 'cell-membrane', 'vacuole', 'nucleus', 'chloroplast'] })).toBe(false)
  })

  it('marks each from what was given', () => {
    expect(gradeFill(fill, ['Glucose ', 'water'])).toBe(true)
    expect(gradeFill(fill, ['water', 'glucose'])).toBe(false)
    expect(gradeOrder(order, ['Egg', 'Larva', 'Pupa', 'Adult'])).toBe(true)
    expect(gradeOrder(order, ['Egg', 'Pupa', 'Larva', 'Adult'])).toBe(false)
    expect(gradeTap({ ...tap, answer: ['nucleus', 'vacuole'] }, ['vacuole', 'nucleus'])).toBe(true)
    expect(gradeTap(tap, ['nucleus', 'vacuole'])).toBe(false)
  })

  it('marks them on the server from what was given, never from a page that says it was right', () => {
    const qs = [fill, order, tap] as unknown as CheckpointQuestion[]
    const lying = { f1: { given: ['water', 'glucose'], state: 'correct' }, o1: { given: ['Adult'], state: 'correct' }, t1: { given: ['vacuole'], state: 'correct' } }
    expect(markCheck(qs, lying)).toBe(false)
    expect(missedQuestions(qs, lying)).toHaveLength(3)
    const right = { f1: { given: ['glucose', 'water'] }, o1: { given: ['Egg', 'Larva', 'Pupa', 'Adult'] }, t1: { given: ['nucleus'] } }
    expect(markCheck(qs, right)).toBe(true)
  })

  it('ticks a clue only when both of its items are placed, in that order', () => {
    expect(clueStates(order, ['Egg', 'Larva', '', ''])).toEqual([true, false])
    expect(clueStates(order, ['Larva', 'Egg', 'Pupa', 'Adult'])).toEqual([false, true])
    expect(clueStates(order, [])).toEqual([false, false])
  })
})

describe('a question its writer found broken', () => {
  const base = { id: 'q', format: 'mcq', prompt: 'P', options: ['a', 'b'], answer: 0 }
  it('is refused', () => {
    const fb = ['Right.', 'Wait—actually, this IS one too. But option A is also correct, so pick the first one.']
    expect(isValidQuestion({ ...base, optionFeedback: fb })).toBe(false)
    expect(isValidQuestion({ ...base, explain: 'Both are correct, really.' })).toBe(false)
  })
  it('is refused when a wrong option is said to work', () => {
    expect(isValidQuestion({ ...base, optionFeedback: ['Right.', 'This works but loses the pattern.'] })).toBe(false)
    expect(isValidQuestion({ ...base, optionFeedback: ['This works: it is the rule.', 'Halving comes first.'] })).toBe(true)
  })
  it('ordinary feedback is not', () => {
    expect(isValidQuestion({ ...base, optionFeedback: ['Yes: this is the square of 3.', 'You would wait longer for that.'] })).toBe(true)
    expect(isValidQuestion({ ...base, explain: 'It actually reaches the same value.' })).toBe(true)
  })
})
