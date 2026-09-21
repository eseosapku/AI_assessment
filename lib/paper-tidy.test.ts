// lib/paper-tidy.test.ts
import { describe, it, expect } from 'vitest'
import { dropRepeatedSentences, stripPartLabels, dropRepeatedFigures, tidyPaper } from './paper-tidy'

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
