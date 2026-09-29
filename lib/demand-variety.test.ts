// lib/demand-variety.test.ts
import { describe, it, expect } from 'vitest'
import { demandOf, sameDemand, dropRepeatedDemands, stripDeadPointer, stripPrintedMarks, stripEmptyAnswerInstruction } from './demand-variety'

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

describe('stripEmptyAnswerInstruction', () => {
  it('removes a bare instruction that says nothing', () => {
    expect(stripEmptyAnswerInstruction('Calculate the mean number of borrows from the table. Write your answer.'))
      .toBe('Calculate the mean number of borrows from the table.')
    expect(stripEmptyAnswerInstruction('Find the perimeter of the rectangle. Give your answer'))
      .toBe('Find the perimeter of the rectangle.')
  })

  it('keeps one that carries a qualifier, which is the real instruction', () => {
    for (const stem of [
      'Calculate the mean. Write your answer to one decimal place.',
      'Find the ratio. Give your answer in its simplest form.',
      'Work out the cost. State the answer in dollars.',
    ]) {
      expect(stripEmptyAnswerInstruction(stem), stem).toBe(stem)
    }
  })

  it('never strips a stem down to nothing', () => {
    expect(stripEmptyAnswerInstruction('Write your answer.')).toBe('Write your answer.')
  })

  it('handles empty input', () => {
    expect(stripEmptyAnswerInstruction('')).toBe('')
    expect(stripEmptyAnswerInstruction(null)).toBe('')
  })
})

describe('the same subject asked in different words', () => {
  it('catches the three Arctic hare questions that shipped on one paper', () => {
    const out = dropRepeatedDemands([
      { question: "Explain how the Arctic hare's fur colour helps it survive." },
      { question: "Explain how the Arctic hare's fur colour aids in its survival." },
      { question: "Explain how the Arctic hare's fur colour is an adaptation to its habitat." },
    ])
    expect(out.questions).toHaveLength(1)
    expect(out.removed).toBe(2)
  })

  it('keeps two questions on one template that ask different things', () => {
    // Radiation and convection: the two words each has alone are the point.
    const out = dropRepeatedDemands([
      { question: 'Name the heat transfer method occurring between the sun and the ground.' },
      { question: 'Name the heat transfer method occurring as warm air rises.' },
    ])
    expect(out.questions).toHaveLength(2)
  })

  it('keeps the parts of one question, which share a subject on purpose', () => {
    const scenario = 'An Arctic hare lives in the snow.'
    const out = dropRepeatedDemands([
      { question: "Explain how the Arctic hare's fur colour helps it survive.", scenario },
      { question: "Explain how the Arctic hare's fur colour aids in its survival.", scenario },
    ])
    expect(out.questions).toHaveLength(2)
  })
})

describe('repeats on a passage paper', () => {
  it('does not apply the subject rule when told not to', () => {
    // Every question on one passage shares its names; on English this rule
    // removed ten questions in one pass.
    const qs = [
      { question: 'Explain how Elara feels in the Whispering Woods at dawn.' },
      { question: 'Explain how Elara reacts in the Whispering Woods at night.' },
    ]
    expect(dropRepeatedDemands(qs, { bySubject: false }).questions).toHaveLength(2)
  })
})

describe('the same data asked about twice', () => {
  it('catches the repeated sequence that shipped', () => {
    const out = dropRepeatedDemands([
      { question: 'Work out the nth term of the sequence 3, 7, 11, 15,..., using the diagram.' },
      { question: 'Determine the nth term of the sequence: 3, 7, 11, 15,... Explain your reasoning.' },
    ])
    expect(out.questions).toHaveLength(1)
  })

  it('keeps questions whose numbers differ, or are too few to mean anything', () => {
    expect(dropRepeatedDemands([
      { question: 'Calculate 3 + 4 × 2.' },
      { question: 'Calculate 3 + 4 × 5.' },
    ]).questions).toHaveLength(2)
    expect(dropRepeatedDemands([
      { question: 'Find the area of a rectangle 5 cm by 8 cm.' },
      { question: 'Find the perimeter of a square with side 5 cm and explain.' },
    ]).questions).toHaveLength(2)
  })
})

describe('parts of one question before the scenario is lifted', () => {
  it('keeps parts that carry the same lead-in in their stems', () => {
    // Eleven of these were removed in one pass on a live Primary paper.
    const lead = 'Sam measured the heights of three plants: 4 cm, 7 cm and 9 cm.'
    const out = dropRepeatedDemands([
      { question: `${lead} Calculate the mean height.` },
      { question: `${lead} Calculate the range of the heights.` },
      { question: `${lead} Explain why Sam should repeat the measurements.` },
    ])
    expect(out.questions).toHaveLength(3)
  })

  it('still removes a real repeat that happens to have a lead-in of its own', () => {
    const out = dropRepeatedDemands([
      { question: "Explain how the Arctic hare's fur colour helps it survive." },
      { question: "In winter the snow is deep. Explain how the Arctic hare's fur colour aids its survival." },
    ])
    expect(out.questions).toHaveLength(1)
  })
})

describe('the instruction frame is not the question', () => {
  it('keeps ESL items that share only the "draw a ring around" frame', () => {
    const out = dropRepeatedDemands([
      { question: "Draw a ring around the correct plural form of 'leaf'." },
      { question: "Draw a ring around the correct form of the verb 'go' in the past." },
      { question: 'Draw a ring around the correct preposition: the book is on the shelf.' },
      { question: 'Tick all the correct statements about paragraph E.' },
      { question: 'Tick all the correct statements about the items Elara took.' },
    ])
    expect(out.questions).toHaveLength(5)
  })
})

describe('the same demand under a different scenario', () => {
  it('catches the three xylem questions that shipped', () => {
    const out = dropRepeatedDemands([
      { question: 'Which structure is responsible for transporting water to the rest of the plant?' },
      { question: 'During a lab, Alex measured the rate of water uptake in a plant stem. Write down the name of the structure that transports water in the plant.' },
      { question: 'During an experiment, a student measured the rate of water uptake in a celery stalk. Name the part of the plant responsible for water transport.' },
    ])
    expect(out.questions).toHaveLength(1)
  })

  it('keeps a short demand under two different scenarios', () => {
    const out = dropRepeatedDemands([
      { question: 'A car travels 120 km in 2 hours. Calculate its average speed.' },
      { question: 'A cyclist rides 30 km in 3 hours. Calculate its average speed.' },
    ])
    expect(out.questions).toHaveLength(2)
  })
})
