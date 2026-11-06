// lib/question-checker.test.ts
import { describe, it, expect } from 'vitest'
import { buildCheckPrompt, applyVerdicts, parseVerdicts, chunk } from './question-checker'

const short = (id: number, question: string, accepted: string[]) =>
  ({ id, type: 'longform', marks: 1, question, short_answer: { accepted } })

describe('the prompt', () => {
  it('shows the complete matching exercise and its actual index key', () => {
    const prompt = buildCheckPrompt([{ id: 1, type: 'interactive', kind: 'match', question: 'Match each term.', left_items: ['Sample Space', 'Probability'], right_items: ['Likelihood', 'All outcomes'], correct_pairs: [[0, 0], [1, 1]] }], { subject: 'REB Mathematics', stage: 'S6', others: [] })
    expect(prompt).toContain('Sample Space')
    expect(prompt).toContain('All outcomes')
    expect(prompt).toContain('"correct_pairs":[[0,0],[1,1]]')
  })
  it('checks an A Level exam part with its symbolic solution and exam-specific rules', () => {
    const prompt = buildCheckPrompt([{
      id: 1, type: 'longform', part: 'a', exam_question_id: 'question-1',
      scenario: 'A projectile is launched with speed u at angle theta.',
      question: 'Show that its maximum height is u² sin²(theta) / (2g).',
      model_answer: 'Use v² = u² sin²(theta) - 2gh with v = 0 at maximum height.',
    }], { subject: 'Further Mathematics', stage: 'Cambridge AS and A Level', others: [], examPaper: true })
    expect(prompt).toContain('WORKED MODEL ANSWER: Use v²')
    expect(prompt).toContain('Symbolic answers')
    expect(prompt).toContain('This is not answer leakage')
    expect(prompt).toContain('All parts of this numbered question are shown together')
    expect(prompt).toContain('PART: (a)')
  })
  it('shows each question with its answer, and the rest of the paper for repeats', () => {
    const qs = [
      short(1, 'Work out the mean of 25, 15, 30 and 10.', ['12.5']),
      { id: 2, type: 'mcq', marks: 1, question: 'Draw a ring around the prime number.', options: ['4', '7', '9', '12'], correct_answer: 1 },
    ]
    const p = buildCheckPrompt(qs, {
      subject: 'Mathematics', stage: 'Lower Secondary Stage 9',
      others: ['Q3: Name the largest planet.'],
    })
    expect(p).toContain('Work out the mean of 25, 15, 30 and 10.')
    expect(p).toContain('12.5')
    // A ring-around is checked blind: its options are shown, its key is not.
    expect(p).toContain('B. 7')
    expect(p).not.toMatch(/\* B\. 7/)
    expect(p).toContain('Q3: Name the largest planet.')
    expect(p).toContain('Lower Secondary Stage 9')
  })

  it('carries the reading text and the figure data when there are any', () => {
    const p = buildCheckPrompt(
      [{ id: 1, type: 'longform', marks: 1, question: 'Which language has the most speakers?', short_answer: { accepted: ['Mandarin'] }, figure_spec: { kind: 'barchart', bars: [{ label: 'English', value: 45 }, { label: 'Mandarin', value: 25 }] } }],
      { subject: 'Science', stage: 'Primary Stage 6', passage: 'A. Elara walked into the woods.', others: [] },
    )
    expect(p).toContain('Elara walked into the woods.')
    expect(p).toMatch(/English[^]*45/)
  })

  it('carries what the book teaches at the stage, so "beyond the stage" means the book\'s stage', () => {
    const p = buildCheckPrompt([short(1, 'Work out the area of a circle of radius 2 cm.', ['12.57'])], {
      subject: 'Mathematics', stage: 'Cambridge Primary Stage 3 (age 8)', others: [],
      scope: 'It teaches: area by counting squares.\nNOT taught yet: area formulae, circles.',
    })
    expect(p).toContain('WHAT THE BOOK TEACHES AT THIS STAGE')
    expect(p).toContain('area by counting squares')
    expect(p).toContain('Cambridge Primary Stage 3 (age 8)')
  })
})

describe('repairs found by the random assessment sweep', () => {
  it('does not keep an MCQ when the checker only says the answer is absent from the options', () => {
    const q = { id: 1, type: 'mcq', options: ['1 1/3', '1 1/2', '1 3/4', '1 1/4'], correct_answer: 0, question: 'What is 3/4 + 5/6?' }
    expect(applyVerdicts([q], [{ id: 1, verdict: 'fix', explanation: 'The correct answer 1 7/12 is not listed.' }]).kept).toHaveLength(0)
  })
  it('repairs a matching key without shuffling the displayed items', () => {
    const q = { id: 1, type: 'interactive', kind: 'match', left_items: ['Sample space', 'Probability'], right_items: ['Likelihood', 'All outcomes'], correct_pairs: [[0, 0], [1, 1]] }
    const result = applyVerdicts([q], [{ id: 1, verdict: 'fix', correct_pairs: [[0, 1], [1, 0]] }])
    expect(result.fixed).toBe(1)
    expect(q.correct_pairs).toEqual([[0, 1], [1, 0]])
    expect(q.right_items).toEqual(['Likelihood', 'All outcomes'])
  })
  it('rejects an invalid matching repair rather than creating an unmarkable exercise', () => {
    const q = { id: 1, type: 'interactive', kind: 'match', left_items: ['A', 'B'], right_items: ['X', 'Y'], correct_pairs: [[0, 0], [1, 1]] }
    expect(applyVerdicts([q], [{ id: 1, verdict: 'fix', correct_pairs: [[0, 1], [1, 1]] }]).kept).toHaveLength(0)
  })
  it('keeps the worked answer consistent with a repaired mark scheme', () => {
    const q = { id: 1, type: 'longform', question: 'Integrate 2x³.', marking_criteria: ['Use the power rule.', 'Answer is 2x⁴/3.'], model_answer: '2x⁴/3 + C', explanation: 'Use the power rule.' }
    applyVerdicts([q], [{ id: 1, verdict: 'fix', mark_scheme: ['Increase the exponent to 4.', 'Divide 2 by 4: x⁴/2 + C.'], model_answer: 'The integral is x⁴/2 + C.' }])
    expect(q.model_answer).toBe('The integral is x⁴/2 + C.')
    expect(q.marking_criteria.join(' ')).not.toContain('2x⁴/3')
  })
  it('refills rather than substituting a rubric for a missing corrected worked answer', () => {
    const q = { id: 1, type: 'longform', marking_criteria: ['Wrong value 11'], model_answer: 'The determinant is 11.' }
    expect(applyVerdicts([q], [{ id: 1, verdict: 'fix', mark_scheme: ['The determinant is -13.'] }]).kept).toHaveLength(0)
  })
})

describe('reading the verdicts', () => {
  it('takes a JSON array, even wrapped in prose or a code fence', () => {
    const v = parseVerdicts('Here you go:\n```json\n[{"id":1,"verdict":"fix","accepted":["20"]},{"id":2,"verdict":"ok"}]\n```')
    expect(v.map((x) => x.id)).toEqual([1, 2])
  })

  // Haiku copied the "--- Q1" labels and answered "id": "Q1"; every verdict
  // was then discarded as having no id, and nothing was checked at all.
  it('takes an id written as "Q1" or "1"', () => {
    const v = parseVerdicts('[{"id":"Q1","verdict":"ok"},{"id":"2","verdict":"drop","why":"x"}]')
    expect(v.map((x) => x.id)).toEqual([1, 2])
  })

  it('is empty, not an error, on nonsense', () => {
    expect(parseVerdicts('I cannot help with that.')).toEqual([])
  })
})

describe('a ring-around checked blind', () => {
  const ring = (correct: number) => ({
    id: 1, type: 'mcq', question: 'On parallel lines, which pair of angles are equal?',
    options: ['Corresponding angles', 'Alternate angles', 'Co-interior angles', 'Adjacent angles'], correct_answer: correct,
    explanation: 'Corresponding angles are equal.',
  })

  it('does not show its key or the explanation that names it', () => {
    const p = buildCheckPrompt([ring(0)], { subject: 'Mathematics', stage: 'Cambridge Lower Secondary Stage 8', others: [] })
    expect(p).not.toMatch(/\* A\./)
    expect(p).not.toContain('Corresponding angles are equal.')
  })

  it('goes when two options are right, or none', () => {
    expect(applyVerdicts([ring(0)], [{ id: 1, verdict: 'ok', right: [0, 1] }]).kept).toEqual([])
    expect(applyVerdicts([ring(0)], [{ id: 1, verdict: 'ok', right: [] }]).kept).toEqual([])
  })

  it('stays when its one right option is the key', () => {
    const out = applyVerdicts([ring(1)], [{ id: 1, verdict: 'ok', right: [1], explain: 'x' }])
    expect(out.kept).toHaveLength(1)
    expect(out.fixed).toBe(0)
    expect(out.kept[0].explanation).toBe('Corresponding angles are equal.')
  })

  it('follows the one right option when the key is another, with the explanation for it', () => {
    const out = applyVerdicts([ring(2)], [{ id: 1, verdict: 'ok', right: [1], explain: 'Alternate angles are equal on parallel lines.' }])
    expect(out.kept[0].correct_answer).toBe(1)
    expect(out.kept[0].explanation).toBe('Alternate angles are equal on parallel lines.')
    expect(out.fixed).toBe(1)
  })

  it('goes when the key is wrong and nothing explains the right one', () => {
    expect(applyVerdicts([ring(2)], [{ id: 1, verdict: 'ok', right: [1] }]).kept).toEqual([])
  })
})

describe('applying the verdicts', () => {
  it('fixes a wrong key, drops a broken question, keeps a good one', () => {
    const qs = [
      short(1, 'Work out the mean of 25, 15, 30 and 10.', ['12.5']),
      short(2, 'Write down "renewable".', ['renewable']),
      short(3, 'Name the largest planet.', ['Jupiter']),
    ]
    const out = applyVerdicts(qs, [
      { id: 1, verdict: 'fix', accepted: ['20'] },
      { id: 2, verdict: 'drop', why: 'tells the learner the answer' },
      { id: 3, verdict: 'ok' },
    ])
    expect(out.kept.map((q: any) => q.id)).toEqual([1, 3])
    expect((out.kept[0] as any).short_answer.accepted).toEqual(['20'])
    expect(out.dropped).toEqual([{ id: 2, why: 'tells the learner the answer' }])
    expect(out.fixed).toBe(1)
    expect(out.kept.every((q: any) => q.checked === true)).toBe(true)
  })

  it('fixes the ringed option, the ticks and the table columns', () => {
    const mcq = { id: 1, type: 'mcq', marks: 1, question: 'Ring the prime.', options: ['4', '7', '9', '2'], correct_answer: 1 }
    const tick = { id: 2, type: 'interactive', kind: 'multi_select', marks: 1, question: 'Tick the true ones.', options: ['a', 'b', 'c', 'd', 'e'], correct_indices: [0] }
    const table = { id: 3, type: 'interactive', kind: 'categorize', marks: 2, question: 'Complete the table.', categories: ['Causes disease', 'Does not'], items: ['TB', 'Yeast', 'Strep', 'Lactobacillus'], correct_category: [1, 0, 1, 0] }
    const out = applyVerdicts([mcq, tick, table], [
      { id: 1, verdict: 'drop', why: 'two correct options' },
      { id: 2, verdict: 'fix', correct_options: [0, 2] },
      { id: 3, verdict: 'fix', correct_columns: ['Causes disease', 'Does not', 'Causes disease', 'Does not'] },
    ])
    expect(out.kept.map((q: any) => q.id)).toEqual([2, 3])
    expect((out.kept[0] as any).correct_indices).toEqual([0, 2])
    expect((out.kept[1] as any).correct_category).toEqual([0, 1, 0, 1])
  })

  it('fixes a mark scheme only when it loses no points', () => {
    const q = { id: 1, type: 'longform', marks: 3, question: 'Explain why the ice melts.', marking_criteria: ['heat', 'energy'] }
    const good = applyVerdicts([{ ...q }], [{ id: 1, verdict: 'fix', mark_scheme: ['heat from the room', 'particles gain energy', 'they move apart'] }])
    expect((good.kept[0] as any).marking_criteria).toHaveLength(3)
    // A "fix" with fewer points than the scheme it replaces is not a fix.
    const bad = applyVerdicts([{ ...q }], [{ id: 1, verdict: 'fix', mark_scheme: ['heat'] }])
    expect(bad.kept).toHaveLength(0)
  })
  it('keeps a valid worked answer when only the explanation changes and the rubric is identical', () => {
    const q = { id: 1, type: 'longform', marks: 2, marking_criteria: ['Use v = u + at.', 'Obtain 24 m/s.'], model_answer: 'v = 4 + 2 × 10 = 24 m/s.' }
    const out = applyVerdicts([q], [{ id: 1, verdict: 'fix', mark_scheme: [...q.marking_criteria], explanation: 'The final speed is 24 m/s.' }])
    expect(out.kept).toHaveLength(1)
    expect(out.kept[0].model_answer).toBe(q.model_answer)
  })

  it('repairs an overallocated generated exam part together with its worked answer', () => {
    const q = { id: 1, type: 'longform', exam_question_id: 'exam-1', marks: 2, question: 'Name the number shown.', marking_criteria: ['Identify the number.', 'Name the number.'], model_answer: 'Four.' }
    const out = applyVerdicts([q], [{ id: 1, verdict: 'fix', mark_scheme: ['Four.'], model_answer: 'Four.' }])
    expect(out.kept).toHaveLength(1)
    expect(out.kept[0].marks).toBe(1)
    expect(out.kept[0].marking_criteria).toEqual(['Four.'])
  })

  it('leaves a question it got no verdict for, unchecked', () => {
    const out = applyVerdicts([short(1, 'Name the gas.', ['oxygen'])], [])
    expect(out.kept).toHaveLength(1)
    expect((out.kept[0] as any).checked).toBeUndefined()
  })

  it('does not trust a fix that would break the question', () => {
    const mcq = { id: 1, type: 'mcq', marks: 1, question: 'Ring the prime.', options: ['4', '7', '9', '12'], correct_answer: 1 }
    const kept = applyVerdicts(
      [{ id: 1, type: 'mcq', options: ['6', '7', '8', '5'], correct_answer: 0, question: '3+4?' }],
      [{ id: 1, verdict: 'fix', why: 'index', right: [1], explain: '7 is the sum of 3 and 4.', correct_option: 1, accepted: ['7'] }],
    )
    expect(kept.kept).toHaveLength(1)
    expect(kept.kept[0].correct_answer).toBe(1)

    const out = applyVerdicts([mcq], [{ id: 1, verdict: 'fix', correct_option: 9 }])
    expect(out.kept).toHaveLength(0)
  })
})

describe('chunking', () => {
  it('splits into groups of at most n', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
  })
})

describe('an explanation that contradicts the answer', () => {
  it('is shown to the checker and can be corrected', () => {
    const q = { id: 1, type: 'longform', marks: 1, question: 'Name the gas plants take in.', short_answer: { accepted: ['carbon dioxide'] }, explanation: 'Plants take in oxygen.' }
    expect(buildCheckPrompt([q], { subject: 'Science', stage: 'Primary Stage 6', others: [] })).toContain('Plants take in oxygen.')
    const out = applyVerdicts([q], [{ id: 1, verdict: 'fix', explanation: 'Plants take in carbon dioxide for photosynthesis.' }])
    expect((out.kept[0] as any).explanation).toMatch(/carbon dioxide/)
  })
})

// The checker was shown each question's PROVISIONAL marks -- a slot's, by
// position, before seating -- and dropped "a two-word answer worth 25 marks"
// that seating would have made worth one. Marks are not its to judge.
describe('the checker is not shown marks', () => {
  it('leaves them out of the prompt', () => {
    const p = buildCheckPrompt([short(1, 'Name the gas.', ['oxygen'])].map((q) => ({ ...q, marks: 25 })), {
      subject: 'Science', stage: 'Primary Stage 6', others: [],
    })
    expect(p).not.toMatch(/25 marks/)
  })
})
