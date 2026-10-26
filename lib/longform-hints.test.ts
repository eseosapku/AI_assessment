import { describe, expect, it } from 'vitest'
import {
  labelledParts,
  alignLongformHints,
  attachLongformHints,
  buildLongformHint,
  hintLeaksAnswer,
  prepareLongformQuestionsForStudent,
  questionDemands,
  studentHintsOf,
  tokenOverlapRatio,
} from './longform-hints'

describe('labelled parts of a written question', () => {
  it('drops the label and keeps the demand', () => {
    expect(labelledParts('(a) Explain the process of photosynthesis. (b) Give one reason it needs light.'))
      .toEqual(['Explain the process of photosynthesis.', 'Give one reason it needs light.'])
  })
})

describe('longform hints', () => {
  it('rejects a hint that copies the marking criterion', () => {
    const criterion = 'Identifies photosynthesis as converting light energy into chemical energy'
    expect(hintLeaksAnswer(criterion, criterion)).toBe(true)
    expect(tokenOverlapRatio(criterion, criterion)).toBeGreaterThan(0.8)
  })

  it('accepts a nudge that does not restate the mark', () => {
    const criterion = 'Identifies photosynthesis as converting light energy into chemical energy'
    const hint = 'Explain how the plant uses light in the process named in the question.'
    expect(hintLeaksAnswer(hint, criterion)).toBe(false)
  })

  it('returns exactly one comprehensive hint, not one per criterion', () => {
    const question =
      "Analyse the impact of Rwanda's reforestation efforts on biodiversity. Provide examples of how reforestation has benefited different species."
    const criteria = [
      'States an impact on biodiversity',
      'Gives a specific species example',
      'Links reforestation to the benefit',
    ]
    const hints = alignLongformHints(criteria, [], 'Many species recovered habitat.', question)
    expect(hints).toHaveLength(1)
    expect(hints[0].toLowerCase()).toMatch(/biodiversity|species|reforestation|impact|examples/)
    expect(hints[0]).not.toMatch(/for this mark/i)
  })

  it('collapses duplicate AI hints into a single useful line', () => {
    const question =
      "Explain how deforestation in Rwanda affects the country's water cycle. Consider the role of trees in water absorption and transpiration."
    const dup = question
    const hints = alignLongformHints(
      ['Mentions absorption', 'Mentions transpiration', 'Links to water cycle'],
      [dup, dup, 'Link absorption to transpiration so the water-cycle change is clear.'],
      'Trees reduce runoff and increase transpiration.',
      question,
    )
    expect(hints).toHaveLength(1)
    expect(hints[0].toLowerCase()).toMatch(/absorption|transpiration|water/)
    expect(hints[0]).not.toBe(dup)
  })

  it('splits multi-demand questions', () => {
    const demands = questionDemands(
      "Analyse the impact of Rwanda's reforestation on biodiversity. Provide examples of how different species have benefited.",
    )
    expect(demands.length).toBeGreaterThanOrEqual(2)
    expect(demands[0]).toMatch(/analyse|impact|biodiversity/i)
    expect(demands[1]).toMatch(/examples|species/i)
  })

  it('strips hints when the teacher has turned them off', () => {
    const q = {
      type: 'longform',
      question: 'State the independent variable in this experiment.',
      marking_criteria: ['States the independent variable'],
      hints: ['Name the thing you change in the experiment.'],
      model_answer: 'The independent variable is temperature.',
    }
    const off = prepareLongformQuestionsForStudent([q], false)
    expect(off[0].hints).toBeUndefined()
    const on = prepareLongformQuestionsForStudent([q], true)
    expect(studentHintsOf(on[0]).length).toBe(1)
  })

  it('attaches one question-based hint when AI hints are missing', () => {
    const q = attachLongformHints({
      type: 'longform',
      question: 'Using the extract, explain how the writer presents isolation.',
      marking_criteria: ['Uses a quote from the extract to support the point'],
      model_answer: 'The writer uses “bitter wind” to show isolation.',
    })
    expect(q.hints).toHaveLength(1)
    expect(q.hints?.[0]).toMatch(/isolation|extract|writer|explain/i)
  })

  it('buildLongformHint stays grounded without leaking the numeric answer', () => {
    const hint = buildLongformHint(
      'Calculate the resultant force when a 12 N force acts to the right and a 5 N force acts to the left.',
      ['Gives resultant as 7 N to the right'],
      '7 N to the right',
      [],
    )
    expect(hint.toLowerCase()).toMatch(/resultant|force/)
    expect(hint).not.toMatch(/\b7\s*n\b/i)
  })
})
