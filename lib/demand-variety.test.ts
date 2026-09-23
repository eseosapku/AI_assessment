// lib/demand-variety.test.ts
import { describe, it, expect } from 'vitest'
import { demandOf, sameDemand, dropRepeatedDemands, stripDeadPointer, stripPrintedMarks } from './demand-variety'

describe('what a question actually asks', () => {
  it('takes the pointer and the paragraph reference off', () => {
    expect(demandOf('Referring to the diagram, name the structure where energy is released.'))
      .toBe('name the structure where energy is released')
    expect(demandOf('In paragraph E, what did Elara find at the base of the oak?'))
      .toBe('what did elara find at the base of the oak')
    expect(demandOf('Write the name of the village. (Paragraph C)'))
      .toBe('write the name of the village')
  })
})

describe('the same question asked twice', () => {
  it('catches a tense change', () => {
    // Both of these were on one English paper.
    expect(sameDemand(
      'Write the name of the village where Elara lived.',
      'Write the name of the village where Elara lives.',
    )).toBe(true)
  })

  it('catches a different paragraph claim over the same demand', () => {
    expect(sameDemand(
      'In paragraph E, what did Elara find at the base of the ancient oak tree?',
      'In paragraph G, what did Elara find at the base of the ancient oak tree?',
    )).toBe(true)
  })

  it('leaves two genuinely different questions alone', () => {
    for (const [a, b] of [
      ['Name the gas produced when magnesium burns.', 'Name the gas used in respiration.'],
      ['Work out the mean of the five readings.', 'Work out the range of the five readings.'],
      ['Explain why the lamp is brighter.', 'Explain why the fuse melted.'],
      ['Write down the name of the village.', 'Write down the name of the river.'],
    ]) {
      expect(sameDemand(a, b), `${a} :: ${b}`).toBe(false)
    }
  })

  it('keeps the first and drops the repeat', () => {
    const out = dropRepeatedDemands([
      { question: 'Write the name of the village where Elara lived.' },
      { question: 'Name the gas produced when magnesium burns.' },
      { question: 'Write the name of the village where Elara lives.' },
    ])
    expect(out.removed).toBe(1)
    expect(out.questions).toHaveLength(2)
    expect(out.questions[0].question).toContain('lived')
  })

  it('says nothing about a one-word demand', () => {
    expect(sameDemand('Why?', 'Why?')).toBe(false)
  })
})

describe('the dead pointer', () => {
  it('removes "Referring to the diagram" and recapitalises', () => {
    expect(stripDeadPointer('Referring to the diagram, name the structure.'))
      .toBe('Name the structure.')
    expect(stripDeadPointer('Referring to the table, write down the total.'))
      .toBe('Write down the total.')
  })

  it('leaves "Look at the diagram" alone, which is how the papers open', () => {
    const stem = 'Look at the diagram. Name the part labelled A.'
    expect(stripDeadPointer(stem)).toBe(stem)
  })

  it('never empties a question', () => {
    expect(stripDeadPointer('Referring to the diagram.')).toBe('Referring to the diagram.')
    expect(stripDeadPointer('')).toBe('')
  })
})

describe('stripPrintedMarks', () => {
  it('removes the allocation a printed paper puts in the margin', () => {
    expect(stripPrintedMarks('Calculate the average speed of a marble. [2]')).toBe(
      'Calculate the average speed of a marble.',
    )
    expect(stripPrintedMarks('Explain why the temperature stops rising. (3)')).toBe(
      'Explain why the temperature stops rising.',
    )
    expect(stripPrintedMarks('Describe the water cycle. [4 marks]')).toBe('Describe the water cycle.')
    expect(stripPrintedMarks('Give one reason for your answer — 2 marks')).toBe(
      'Give one reason for your answer',
    )
  })

  it('leaves a bracketed number that is part of the question', () => {
    // Content, not an allocation: removing these changes what is being asked.
    expect(stripPrintedMarks('Write down the value at [3] on the number line.')).toBe(
      'Write down the value at [3] on the number line.',
    )
    expect(stripPrintedMarks('State the charge on ion (2) in the diagram.')).toBe(
      'State the charge on ion (2) in the diagram.',
    )
  })

  it('never strips a stem down to nothing', () => {
    expect(stripPrintedMarks('[2]')).toBe('[2]')
    expect(stripPrintedMarks('Find x. [2]')).toBe('Find x. [2]')
  })

  it('handles empty input', () => {
    expect(stripPrintedMarks('')).toBe('')
    expect(stripPrintedMarks(null)).toBe('')
  })
})
