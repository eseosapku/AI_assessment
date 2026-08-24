import { describe, expect, it } from 'vitest'
import {
  alignLongformHints,
  attachLongformHints,
  hintLeaksAnswer,
  prepareLongformQuestionsForStudent,
  scaffoldHint,
  studentHintsOf,
  tokenOverlapRatio,
} from './longform-hints'

describe('longform hints', () => {
  it('rejects a hint that copies the marking criterion', () => {
    const criterion = 'Identifies photosynthesis as converting light energy into chemical energy'
    expect(hintLeaksAnswer(criterion, criterion)).toBe(true)
    expect(tokenOverlapRatio(criterion, criterion)).toBeGreaterThan(0.8)
  })

  it('accepts a nudge that names the kind of point, not the fact', () => {
    const criterion = 'Identifies photosynthesis as converting light energy into chemical energy'
    const hint = 'A precise name or term is needed in this part — avoid a vague description.'
    expect(hintLeaksAnswer(hint, criterion)).toBe(false)
  })

  it('aligns one hint per criterion and scaffolds leaks', () => {
    const criteria = [
      'Names mitosis as the process of nuclear division',
      'Explains why identical daughter cells are produced',
    ]
    const hints = alignLongformHints(criteria, [
      'Names mitosis as the process of nuclear division',
      'Give a reason here, not only a label — a marker wants to see why this is true.',
    ])
    expect(hints).toHaveLength(2)
    expect(hints[0]).toBe(scaffoldHint(criteria[0]))
    expect(hints[1]).toMatch(/reason/i)
  })

  it('strips hints when the teacher has turned them off', () => {
    const q = {
      type: 'longform',
      marking_criteria: ['States the independent variable'],
      hints: ['Name the thing you change in the experiment.'],
      model_answer: 'The independent variable is temperature.',
    }
    const off = prepareLongformQuestionsForStudent([q], false)
    expect(off[0].hints).toBeUndefined()
    const on = prepareLongformQuestionsForStudent([q], true)
    expect(studentHintsOf(on[0]).length).toBe(1)
  })

  it('attaches scaffolds when a longform question has criteria but no hints', () => {
    const q = attachLongformHints({
      type: 'longform',
      marking_criteria: ['Uses a quote from the extract to support the point'],
      model_answer: 'The writer uses “bitter wind” to show isolation.',
    })
    expect(q.hints[0]).toMatch(/evidence|text|phrase/i)
  })
})
