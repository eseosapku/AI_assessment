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
    expect(drawFromReply('{"kind":"numberline","min":0,"max":5,"step":1}')!.noun).toBe('number line')
    expect(drawFromReply('{"kind":"barchart","y":{"label":"n","min":0,"max":10,"step":5},"bars":[{"label":"a","value":3},{"label":"b","value":6}]}')!.noun).toBe('bar chart')
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
