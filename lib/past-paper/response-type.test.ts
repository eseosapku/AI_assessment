import { describe, expect, it } from 'vitest'
import { classifyQuestion, classifyResponse } from './response-type'

describe('classifyResponse', () => {
  it('treats a printed graph as a number the student types', () => {
    expect(classifyResponse('From the graph, determine the gradient.')).toBe('graph_read')
  })

  it('does not call a four-option calculation a written number', () => {
    expect(classifyResponse('What is the actual length?\nA 1 mm B 2 mm C 3 mm D 4 mm')).toBe('multiple_choice')
  })

  it('separates a plotted line from a sketch of apparatus', () => {
    expect(classifyResponse('Draw a line of best fit.')).toBe('plot_line')
    expect(classifyResponse('Draw a ray diagram for the lens.')).toBe('freehand_draw')
  })
})

describe('classifyQuestion', () => {
  it('keeps a part that uses a graph the student plotted, and holds the plot', () => {
    const result = classifyQuestion({
      stem: 'The table shows the readings.',
      parts: [
        { label: 'a', text: 'Plot the points on the grid.' },
        { label: 'b', text: 'Draw a line of best fit.' },
        { label: 'c', text: 'Using your graph from (b), determine the value.' },
      ],
    })
    expect(result.parts[2].depends_on).toEqual(['b'])
    expect(result.parts[2].excluded_by_dependency).toBe(false)
    expect(result.parts[0].servable).toBe(true)
    expect(result.usable).toBe('partial')
  })

  it('drops a later part that needs a drawing the student cannot type', () => {
    const result = classifyQuestion({
      stem: 'The lens is shown.',
      parts: [
        { label: 'a', text: 'Draw a ray diagram for the lens.' },
        { label: 'b', text: 'Using your answer to (a), state the image position.' },
      ],
    })
    expect(result.parts[1].excluded_by_dependency).toBe(true)
    expect(result.parts[1].servable).toBe(false)
  })

  it('keeps an essay in scope and out of the unsupported list', () => {
    const result = classifyQuestion({ stem: 'Discuss the effects of the policy on employment. [8]', parts: [] })
    expect(result.parts[0].response_type).toBe('extended_write')
    expect(result.parts[0].servable).toBe(true)
    expect(result.usable).toBe('held')
  })

  it('rejects a question whose stem needs apparatus that is not shown', () => {
    const result = classifyQuestion({
      stem: 'You are provided with the apparatus shown.',
      parts: [{ label: 'a', text: 'State the name of the liquid.' }],
    })
    expect(result.stem_blocked).toBe(true)
    expect(result.usable).toBe('none')
  })

  it('keeps a calculation that stands on its own', () => {
    const result = classifyQuestion({ stem: 'Calculate the mass of rice for 16 people. [1]', parts: [] })
    expect(result.parts[0].response_type).toBe('numeric')
    expect(result.usable).toBe('full')
  })
})
