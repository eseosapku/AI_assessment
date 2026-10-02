// lib/question-checker.test.ts
import { describe, it, expect } from 'vitest'
import { buildCheckPrompt, applyVerdicts, parseVerdicts, chunk } from './question-checker'

const short = (id: number, question: string, accepted: string[]) =>
  ({ id, type: 'longform', marks: 1, question, short_answer: { accepted } })

describe('the prompt', () => {
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
    expect(p).toMatch(/\* B\. 7/)
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

  it('leaves a question it got no verdict for, unchecked', () => {
    const out = applyVerdicts([short(1, 'Name the gas.', ['oxygen'])], [])
    expect(out.kept).toHaveLength(1)
    expect((out.kept[0] as any).checked).toBeUndefined()
  })

  it('does not trust a fix that would break the question', () => {
    const mcq = { id: 1, type: 'mcq', marks: 1, question: 'Ring the prime.', options: ['4', '7', '9', '12'], correct_answer: 1 }
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
