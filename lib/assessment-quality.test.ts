import { describe, it, expect } from 'vitest'
import { dedupeQuestions, dropContradictions, stripExaminerVoice, cleanQuestionPaper, reconcileMarksWithCriteria } from './assessment-quality'

const q = (question: string, correct = 3, options = ['Square', 'Rectangle', 'Triangle', 'Circle']) => ({
  question,
  options,
  correct_answer: correct,
  explanation: 'Because a circle is round.',
})

describe('dedupeQuestions', () => {
  it('drops a reworded repeat that expects the same answer', () => {
    // Straight from a real P3 Maths paper.
    const out = dedupeQuestions([
      q('Which shape has one curved side?'),
      q('Which shape has a curved edge?'),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].question).toBe('Which shape has one curved side?')
  })

  it('keeps the first occurrence, preserving order', () => {
    const out = dedupeQuestions([q('Which shape has a curved edge?'), q('Which shape has one curved side?'), q('What is 2 + 2?', 0, ['4', '5', '6', '7'])])
    expect(out.map((x) => x.question)).toEqual(['Which shape has a curved edge?', 'What is 2 + 2?'])
  })

  it('keeps similar questions that expect different answers', () => {
    // "four sides" vs "four equal sides" probe different facts, and both must
    // survive even though the wording barely differs.
    const out = dedupeQuestions([
      q('Which shape has four sides?', 1),
      q('Which shape has four equal sides?', 0),
    ])
    expect(out).toHaveLength(2)
  })

  it('keeps unrelated questions that happen to share an answer', () => {
    const out = dedupeQuestions([
      q('Which shape has one curved side?'),
      q('Which shape has no corners at all in geometry?'),
    ])
    expect(out).toHaveLength(2)
  })

  it('ignores punctuation and case when comparing', () => {
    const out = dedupeQuestions([q('Which shape has one curved side?'), q('WHICH SHAPE HAS ONE CURVED SIDE')])
    expect(out).toHaveLength(1)
  })

  it('keeps questions whose answer cannot be resolved', () => {
    // Without a resolvable answer the duplicate test is unsafe, so nothing is dropped.
    const a = { question: 'Which shape has one curved side?', options: [], correct_answer: 0 }
    const b = { question: 'Which shape has a curved edge?', options: [], correct_answer: 0 }
    expect(dedupeQuestions([a, b])).toHaveLength(2)
  })

  it('handles an out-of-range correct_answer without throwing', () => {
    const a = { ...q('A'), correct_answer: 99 }
    const b = { ...q('B'), correct_answer: -1 }
    expect(dedupeQuestions([a, b])).toHaveLength(2)
  })

  it('skips malformed entries', () => {
    const out = dedupeQuestions([null as never, undefined as never, q('Real question here?')])
    expect(out).toHaveLength(1)
  })

  it('returns an empty array for non-array input', () => {
    expect(dedupeQuestions(null as never)).toEqual([])
  })
})

describe('stripExaminerVoice', () => {
  it('removes the examiner preamble and keeps the reasoning', () => {
    const input =
      "This question tests the student's understanding of the properties of geometric shapes. A circle is the only shape with one curved side."
    expect(stripExaminerVoice(input)).toBe('A circle is the only shape with one curved side.')
  })

  it('handles the common verb variants', () => {
    for (const verb of ['tests', 'assesses', 'evaluates', 'checks', 'examines', 'measures']) {
      const out = stripExaminerVoice(`This question ${verb} the student's grasp of shapes. Circles are round.`)
      expect(out).toBe('Circles are round.')
    }
  })

  it('removes two stacked preambles', () => {
    const input = 'This question tests understanding of shapes. This item assesses recall of properties. Circles are round.'
    expect(stripExaminerVoice(input)).toBe('Circles are round.')
  })

  it('keeps the original when the preamble is the entire explanation', () => {
    // A wrong-but-present explanation beats a blank one.
    const input = "This question tests the student's understanding of shapes."
    expect(stripExaminerVoice(input)).toBe(input)
  })

  it('leaves a student-facing explanation untouched', () => {
    const input = 'A circle is the only shape with one curved side.'
    expect(stripExaminerVoice(input)).toBe(input)
  })

  it('does not strip a sentence that merely mentions the word question', () => {
    const input = 'The question of scale matters here. Circles are round.'
    expect(stripExaminerVoice(input)).toBe(input)
  })

  it('handles empty and non-string input', () => {
    expect(stripExaminerVoice('')).toBe('')
    expect(stripExaminerVoice(null)).toBe('')
    expect(stripExaminerVoice(undefined)).toBe('')
  })
})

describe('cleanQuestionPaper', () => {
  it('dedupes and rewrites explanations in one pass', () => {
    const out = cleanQuestionPaper([
      { ...q('Which shape has one curved side?'), explanation: 'This question tests shapes. Circles are round.' },
      q('Which shape has a curved edge?'),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].explanation).toBe('Circles are round.')
  })

  it('leaves a clean paper byte-identical', () => {
    const paper = [q('What is 2 + 2?', 0, ['4', '5', '6', '7'])]
    expect(cleanQuestionPaper(paper)[0]).toBe(paper[0])
  })
})

describe('dropContradictions', () => {
  const shapes = ['Square', 'Rectangle', 'Triangle', 'Circle']

  it('drops a question that contradicts an earlier one', () => {
    // Straight from a generated paper: the same question, answered Square in
    // one place and Rectangle in another. Both cannot be right.
    const out = dropContradictions([
      q('Which shape has four right angles?', 0, shapes),
      q('Name the shape that has four right angles.', 1, shapes),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].question).toBe('Which shape has four right angles?')
  })

  it('ignores question-stem wording when comparing', () => {
    for (const stem of ['Identify the', 'Choose the', 'Select the', 'State the']) {
      const out = dropContradictions([
        q('Which shape has four right angles?', 0, shapes),
        q(`${stem} shape that has four right angles.`, 1, shapes),
      ])
      expect(out).toHaveLength(1)
    }
  })

  it('keeps a question that narrows an earlier one', () => {
    // "four equal sides" legitimately has a different answer from "four sides";
    // the extra word keeps them distinct.
    const out = dropContradictions([
      q('Which shape has four sides?', 1, shapes),
      q('Which shape has four equal sides?', 0, shapes),
    ])
    expect(out).toHaveLength(2)
  })

  it('keeps identically worded questions that agree', () => {
    // Same answer means no contradiction; dedupeQuestions handles that case.
    const out = dropContradictions([
      q('Which shape has four right angles?', 0, shapes),
      q('Name the shape that has four right angles.', 0, shapes),
    ])
    expect(out).toHaveLength(2)
  })

  it('keeps unrelated questions', () => {
    const out = dropContradictions([
      q('Which shape has four right angles?', 0, shapes),
      q('Which shape has no straight sides?', 3, shapes),
    ])
    expect(out).toHaveLength(2)
  })

  it('handles malformed input', () => {
    expect(dropContradictions(null as never)).toEqual([])
    expect(dropContradictions([null as never, q('Real one here?')])).toHaveLength(1)
  })
})

describe('near-identical answers', () => {
  it('treats singular and plural phrasings of the same answer as the same', () => {
    // Straight from a generated Biology paper: two versions of the same
    // question survived because "impulses" and "impulse" looked different.
    const out = dedupeQuestions([
      {
        question: 'How does the myelin sheath affect the speed of nerve impulses?',
        options: ['It increases the speed of nerve impulses.', 'It slows them.', 'No effect.', 'It blocks them.'],
        correct_answer: 0,
      },
      {
        question: 'How does the myelin sheath affect the speed of nerve impulses in a neuron?',
        options: ['It increases the speed of the nerve impulse.', 'It slows them.', 'No effect.', 'It blocks them.'],
        correct_answer: 0,
      },
    ])
    expect(out).toHaveLength(1)
  })

  it('still separates genuinely different answers', () => {
    const out = dedupeQuestions([
      { question: 'Which shape has four sides?', options: ['Square', 'Rectangle'], correct_answer: 1 },
      { question: 'Which shape has four equal sides?', options: ['Square', 'Rectangle'], correct_answer: 0 },
    ])
    expect(out).toHaveLength(2)
  })
})

describe('marks that match the mark scheme', () => {
  it('brings the marks down to what a marker can actually award', () => {
    // Measured: 15 of 18 long-form questions were worth more marks than they
    // gave anyone anything to award — "3 criteria for 8 marks", three times.
    const [q] = reconcileMarksWithCriteria([
      { question: 'Explain the causes of the war.', marks: 8, marking_criteria: ['a', 'b', 'c'] },
    ])
    expect(q.marks).toBe(3)
  })

  it('raises them too, when there are more points than marks', () => {
    const [q] = reconcileMarksWithCriteria([
      { question: 'x', marks: 2, marking_criteria: ['a', 'b', 'c', 'd'] },
    ])
    expect(q.marks).toBe(4)
  })

  it('leaves a question that already agrees alone', () => {
    const paper = [{ question: 'x', marks: 2, marking_criteria: ['a', 'b'] }]
    expect(reconcileMarksWithCriteria(paper)).toEqual(paper)
  })

  it('ignores blank criteria rather than counting them as marks', () => {
    const [q] = reconcileMarksWithCriteria([
      { question: 'x', marks: 4, marking_criteria: ['a', '', '   ', 'b'] },
    ])
    expect(q.marks).toBe(2)
  })

  it('does nothing without a mark scheme to count', () => {
    for (const paper of [
      [{ question: 'x', marks: 5 }],
      [{ question: 'x', marks: 5, marking_criteria: [] }],
      [{ question: 'x', options: ['a', 'b', 'c', 'd'], correct_answer: 0 }],
    ]) {
      expect(reconcileMarksWithCriteria(paper as never)).toEqual(paper)
    }
  })

  it('survives junk', () => {
    for (const junk of [null, undefined, 'x', 42, [null]]) {
      expect(() => reconcileMarksWithCriteria(junk as never)).not.toThrow()
    }
  })
})
