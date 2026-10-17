// lib/paper-tidy.test.ts
import { describe, it, expect } from 'vitest'
import { dropRepeatedSentences, stripPartLabels, dropRepeatedFigures, tidyPaper, dropRepeatedScenarios } from './paper-tidy'

describe('a sentence the stem already said', () => {
  it('removes the pasted-in repeat', () => {
    // Shipped verbatim on a Science paper.
    const stem = 'Look at the graph. During a lesson, Sam noticed that the graph shows a peak at a certain element. Look at the graph. Sam noticed that the graph shows a peak at a certain element. Write down the name of the element where the peak occurs.'
    const out = dropRepeatedSentences(stem)
    expect(out.match(/Look at the graph/g)).toHaveLength(1)
    expect(out.match(/noticed that the graph shows a peak/g)).toHaveLength(1)
    expect(out).toContain('Write down the name of the element')
  })

  it('keeps two genuinely different demands', () => {
    const stem = 'State the name of the gas. Calculate the mass of the product.'
    expect(dropRepeatedSentences(stem)).toBe(stem)
  })

  it('keeps a stem that says nothing twice', () => {
    const stem = 'Work out the area of the compound shape.'
    expect(dropRepeatedSentences(stem)).toBe(stem)
  })

  it('never takes the question for a repeat of a short scene sentence that shares a word with it', () => {
    // Shipped as "Look at the drawing. The grapes dry in the sun." -- no question: "grapes" was the
    // short sentence's only content word, and the question contains it.
    const stem = 'Look at the drawing. The grapes dry in the sun. Which change of state happens to the water in the grapes as they dry?'
    expect(dropRepeatedSentences(stem)).toBe(stem)
    const stem2 = 'The kettle boils. What happens to the water in the kettle as it boils?'
    expect(dropRepeatedSentences(stem2)).toBe(stem2)
  })

  it('removes a question asked twice, keeping the first', () => {
    const stem = 'Look at the graph. What is the highest temperature on the graph? What is the highest temperature shown on the graph?'
    expect(dropRepeatedSentences(stem)).toBe('Look at the graph. What is the highest temperature on the graph?')
  })
})

describe('part labels inside the sentence', () => {
  it('strips a mid-stem (b)', () => {
    // Shipped: "(b)" is the paper's numbering, not part of the question.
    expect(stripPartLabels('Explain why earthquakes occur near volcanoes. (b) Write down one reason.'))
      .toBe('Explain why earthquakes occur near volcanoes. Write down one reason.')
  })

  it('strips a leading one', () => {
    expect(stripPartLabels('(a) Name the gas produced.')).toBe('Name the gas produced.')
  })

  it('leaves ordinary brackets alone', () => {
    const stem = 'Work out the value of 2(x + 3) when x = 4.'
    expect(stripPartLabels(stem)).toBe(stem)
  })
})

describe('a figure spent twice', () => {
  const q = (image_url?: string) => ({ question: 'x', ...(image_url ? { image_url } : {}) })

  it('removes a repeat on an unrelated later question', () => {
    // Shipped: a clean-up illustration on question 11 and again on 25.
    const { questions, removed } = dropRepeatedFigures([q('/a.png'), q(), q(), q('/a.png')])
    expect(removed).toBe(1)
    expect(questions[0].image_url).toBe('/a.png')
    expect(questions[3].image_url).toBeUndefined()
  })

  it('leaves adjacent parts of one question sharing their figure', () => {
    // This is how a real paper is laid out and must not be touched.
    const { questions, removed } = dropRepeatedFigures([q('/a.png'), q('/a.png'), q('/a.png')])
    expect(removed).toBe(0)
    expect(questions.every((x) => x.image_url === '/a.png')).toBe(true)
  })

  it('leaves different figures alone', () => {
    const { removed } = dropRepeatedFigures([q('/a.png'), q('/b.png'), q('/c.png')])
    expect(removed).toBe(0)
  })
})

describe('together', () => {
  it('applies all three and survives junk', () => {
    const { questions } = tidyPaper([
      { question: 'Look at the graph. Look at the graph. Write down the element. (b) Name it.', image_url: '/a.png' },
      { question: 'Other.', image_url: '/b.png' },
      { question: 'Third.', image_url: '/a.png' },
    ])
    expect(questions[0].question).not.toMatch(/\(b\)/)
    expect(String(questions[0].question).match(/Look at the graph/g)).toHaveLength(1)
    expect(questions[2].image_url).toBeUndefined()
    for (const junk of [null, undefined, 'x', 42]) {
      expect(() => tidyPaper(junk as never)).not.toThrow()
    }
  })
})

describe('never take a picture out from under a stem that points at it', () => {
  it('keeps a repeated figure when the question needs it', () => {
    // A repeated figure is a blemish; a missing one is a broken question.
    const { questions, removed } = dropRepeatedFigures([
      { question: 'Look at the diagram. Name the organelle.', image_url: '/m.png' },
      { question: 'Something else.' },
      { question: 'Look at the diagram. Explain the role of the cristae.', image_url: '/m.png' },
    ])
    expect(removed).toBe(0)
    expect(questions[2].image_url).toBe('/m.png')
  })

  it('still removes one the question never mentions', () => {
    const { questions, removed } = dropRepeatedFigures([
      { question: 'Look at the diagram. Name the organelle.', image_url: '/m.png' },
      { question: 'Something else.' },
      { question: 'Work out the mean of 4, 6 and 8.', image_url: '/m.png' },
    ])
    expect(removed).toBe(1)
    expect(questions[2].image_url).toBeUndefined()
  })
})

describe('a scenario the paper has already set', () => {
  const q = (question: string) => ({ question })

  it('keeps the first and strips the repeats', () => {
    // Straight off a live English paper: the model restated the passage's
    // opening at the top of question after question.
    const out = dropRepeatedScenarios([
      q('Theo found himself drawn to the house of whispers. Write down the name of the house.'),
      q('Theo found himself drawn to the house of whispers. Explain why he went inside.'),
      q('Theo found himself drawn to the house of whispers. Give two words that describe the door.'),
    ])
    expect(out[0].question).toContain('Theo found himself')
    expect(out[1].question).toBe('Explain why he went inside.')
    expect(out[2].question).toBe('Give two words that describe the door.')
  })

  it('leaves a scenario used twice alone', () => {
    // Two parts of one numbered question legitimately share a scenario.
    const rows = [
      q('Sam heated the copper sulfate solution slowly. Describe what he saw.'),
      q('Sam heated the copper sulfate solution slowly. Explain why it changed.'),
    ]
    expect(dropRepeatedScenarios(rows).map((r) => r.question)).toEqual(rows.map((r) => r.question))
  })

  it('never strips the only sentence a question has', () => {
    const rows = [
      q('Theo found himself drawn to the house of whispers.'),
      q('Theo found himself drawn to the house of whispers.'),
      q('Theo found himself drawn to the house of whispers.'),
    ]
    for (const r of dropRepeatedScenarios(rows)) expect(r.question).toBeTruthy()
  })

  it('does not treat a short command as a scenario', () => {
    const rows = [
      q('Look at the diagram. Name part A.'),
      q('Look at the diagram. Name part B.'),
      q('Look at the diagram. Name part C.'),
    ]
    expect(dropRepeatedScenarios(rows).map((r) => r.question)).toEqual(rows.map((r) => r.question))
  })
})
