// lib/figure-request.test.ts
import { describe, it, expect } from 'vitest'
import { buildFigureSpecPrompt, drawFromReply, questionNamesUndrawn, worthDrawing } from './figure-request'

describe('the ask', () => {
  it('stays small, because size is what breaks adherence', () => {
    // Measured on this codebase: the same model returns clean JSON at ~1,200
    // characters and five questions of thirty-four at 26,600.
    expect(buildFigureSpecPrompt('Mathematics', 'Stage 9', 'area of a compound shape').length)
      .toBeLessThan(1600)
  })

  it('offers a way to say no', () => {
    // A model asked for "a diagram of a plant cell" will describe one happily
    // and nothing here can draw it. Better an honest none.
    expect(buildFigureSpecPrompt('Science', 'Stage 9', 'cells')).toContain('"kind":"none"')
  })
})

describe('drawing what came back', () => {
  it('draws a spec wrapped in the prose models add', () => {
    const reply = 'Here is the figure:\n```json\n{"kind":"spinners","count":2,"sides":7}\n```\nHope that helps.'
    const drawn = drawFromReply(reply)
    expect(drawn).toBeTruthy()
    expect(drawn!.svg.startsWith('<svg')).toBe(true)
    expect(drawn!.noun).toBe('diagram')
    expect(drawn!.labels).toContain('the grey spinner')
  })

  it('names a graph a graph and a number line a number line', () => {
    expect(drawFromReply('{"kind":"graph","x":{"label":"t","min":0,"max":10,"step":5},"y":{"label":"d","min":0,"max":10,"step":5},"points":[[0,0],[10,10]]}')!.noun).toBe('graph')
    expect(drawFromReply('{"kind":"numberline","min":0,"max":5,"step":1,"marks":[{"at":2,"label":"A"}]}')!.noun).toBe('number line')
    expect(drawFromReply('{"kind":"barchart","y":{"label":"n","min":0,"max":10,"step":5},"bars":[{"label":"tea","value":3},{"label":"juice","value":6}]}')!.noun).toBe('bar chart')
  })

  it('returns null for "none", for junk, and for what it cannot draw', () => {
    expect(drawFromReply('{"kind":"none"}')).toBeNull()
    expect(drawFromReply('no figure needed')).toBeNull()
    expect(drawFromReply('{"kind":"plant cell","parts":["nucleus"]}')).toBeNull()
    expect(drawFromReply(null)).toBeNull()
    expect(drawFromReply('{ broken json')).toBeNull()
  })
})

describe('holding the question to the figure', () => {
  const spinners = drawFromReply('{"kind":"spinners","count":2,"sides":7}')!

  it('catches a label the drawing does not carry', () => {
    // The exact fault that shipped: "name the part labelled A" on a figure
    // whose labels were all words.
    expect(questionNamesUndrawn('Look at the diagram. Name the part labelled A.', spinners))
      .toEqual(['A'])
  })

  it('accepts what the drawing does carry', () => {
    const poly = drawFromReply('{"kind":"polygon","sides":3,"edges":["A","B","C"]}')!
    expect(questionNamesUndrawn('Work out the length of side A.', poly)).toEqual([])
  })

  it('leaves an ordinary question alone', () => {
    expect(questionNamesUndrawn('Work out the probability that both spinners land on 4.', spinners))
      .toEqual([])
  })
})

describe('asking only when it is worth asking', () => {
  it('asks for the foci it can draw', () => {
    for (const f of [
      'area of a compound shape', 'angles in triangles and quadrilaterals',
      'reading a frequency table', 'probability of two events together',
      'negative numbers in context', 'describing a pattern in a set of results',
      'interpreting a bar chart described in words',
    ]) {
      expect(worthDrawing(f), f).toBe(true)
    }
  })

  it('does not spend a call on what it cannot draw', () => {
    // A Science paper has about fifteen figure slots and perhaps three are
    // drawable; asking for the rest buys a "none" at the price of a call.
    for (const f of [
      'the structure of a plant cell', 'series and parallel circuits',
      'the water cycle', 'photosynthesis', 'the phases of the Moon',
      'rock types and the rock cycle', 'why scientists check each other’s work',
    ]) {
      expect(worthDrawing(f), f).toBe(false)
    }
  })

  it('says no to nothing at all', () => {
    expect(worthDrawing('')).toBe(false)
    expect(worthDrawing(undefined)).toBe(false)
  })
})

describe('what the drawable menu must refuse', () => {
  it('refuses a bar chart labelled with placeholders, and keeps one labelled with things', () => {
    const y = '"y":{"label":"number of learners","min":0,"max":20,"step":5}'
    const placeholder = `{"kind":"barchart",${y},"bars":[{"label":"Category A","value":3},{"label":"Category B","value":6}]}`
    const real = `{"kind":"barchart",${y},"bars":[{"label":"walk","value":12},{"label":"bus","value":7}]}`
    expect(drawFromReply(placeholder)).toBeNull()
    expect(drawFromReply(real)).not.toBeNull()
  })

  it('refuses an axis that measures nothing', () => {
    const bad = '{"kind":"graph","x":{"label":"Trial Number","min":0,"max":5,"step":1},"y":{"label":"Measurement (cm)","min":0,"max":10,"step":2},"points":[[1,3],[2,5]]}'
    const good = '{"kind":"graph","x":{"label":"mass of marble (g)","min":0,"max":50,"step":10},"y":{"label":"depth of crater (cm)","min":0,"max":8,"step":2},"points":[[5,1],[25,2.7]]}'
    expect(drawFromReply(bad)).toBeNull()
    expect(drawFromReply(good)).not.toBeNull()
  })

  it('keeps a single-letter axis, which is a quantity and not a placeholder', () => {
    expect(drawFromReply('{"kind":"graph","x":{"label":"t","min":0,"max":10,"step":5},"y":{"label":"d","min":0,"max":10,"step":5},"points":[[0,0],[10,10]]}')).not.toBeNull()
  })

  it('refuses a number line marked on every division, which is a ruler', () => {
    const ruler = '{"kind":"numberline","min":0,"max":1000,"step":100,"marks":[{"at":0,"label":"0"},{"at":100,"label":"100"},{"at":200,"label":"200"},{"at":300,"label":"300"},{"at":400,"label":"400"},{"at":500,"label":"500"}]}'
    const asked = '{"kind":"numberline","min":0,"max":1000,"step":100,"marks":[{"at":370,"label":"A"}]}'
    expect(drawFromReply(ruler)).toBeNull()
    expect(drawFromReply(asked)).not.toBeNull()
  })
})

describe('placeholders that are not placeholders', () => {
  const chart = (a: string, b: string) =>
    `{"kind":"barchart","y":{"label":"number sold","min":0,"max":20,"step":5},"bars":[{"label":"${a}","value":12},{"label":"${b}","value":7}]}`

  it('refuses a noun with a letter stuck on the end', () => {
    for (const [a, b] of [['Drink A', 'Drink B'], ['Category A', 'Category B'], ['Group C', 'Group D']]) {
      expect(drawFromReply(chart(a, b)), a).toBeNull()
    }
  })

  it('keeps words that merely END in a, b, c or d', () => {
    // "tea" is a noun plus a trailing "a" to a regex without a space in it.
    for (const [a, b] of [['tea', 'coffee'], ['soda', 'water'], ['pasta', 'rice'], ['banana', 'mango']]) {
      expect(drawFromReply(chart(a, b)), a).not.toBeNull()
    }
  })

  it('keeps a numbered category that names a real group', () => {
    expect(drawFromReply(chart('Year 5', 'Year 6'))).not.toBeNull()
    expect(drawFromReply(chart('Item 1', 'Item 2'))).toBeNull()
  })
})
