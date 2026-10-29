import { describe, expect, it } from 'vitest'
import { buildStyleTemplate } from './style-template'

describe('buildStyleTemplate', () => {
  it('counts command words and marks from the questions it is given', () => {
    const template = buildStyleTemplate('cambridge', 'o_level', 'physics', [
      { stem: 'Calculate the speed of the trolley in m/s.', marks: 2, command_word: 'calculate', parts: [] },
      { stem: 'State the unit of force.', marks: 1, command_word: 'state', parts: [] },
      { stem: 'From the graph, determine the gradient.', marks: 3, command_word: 'determine', parts: [{ text: 'Explain the shape.', marks: 2, command_word: 'explain' }] },
    ])
    expect(template.command_words.calculate).toBe(1)
    expect(template.marks.median).toBe(2)
    expect(template.parts.multi).toBe(1)
    expect(template.parts.single).toBe(2)
    expect(template.figure_rate).toBeCloseTo(1 / 3)
    expect(template.thin).toBe(true)
    expect(template.exemplars.length).toBeGreaterThan(0)
    expect(template.exemplars[0].text).toContain('Calculate the speed')
  })
})
