// lib/figure-request.test.ts
import { describe, it, expect } from 'vitest'
import { buildFigureSpecPrompt, drawFromReply, questionNamesUndrawn, worthDrawing, drawableKindsFor } from './figure-request'

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

  it('now reaches the science foci the first six shapes could not', () => {
    // Every one of these was skipped before the menu grew. They are why the
    // library came back 65% bar charts.
    for (const [focus, kind] of [
      ['series and parallel circuits', 'circuit'],
      ['current, voltage and resistance', 'circuit'],
      ['balanced and unbalanced forces', 'forces'],
      ['friction and air resistance', 'forces'],
      ['food chains and food webs', 'foodchain'],
      ['interdependence in an ecosystem', 'foodchain'],
      ['coordinates in four quadrants', 'grid'],
      ['reflection, rotation and translation', 'grid'],
      ['angles in parallel lines', 'angles'],
    ] as const) {
      expect(worthDrawing(focus), focus).toBe(true)
      expect(drawableKindsFor(focus), focus).toContain(kind)
    }
  })

  it('does not spend a call on what it still cannot draw', () => {
    for (const f of [
      'the structure of a plant cell', 'the water cycle', 'photosynthesis',
      'the phases of the Moon', 'human reproduction',
      'why scientists check each other’s work',
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

describe('the menu is chosen per question', () => {
  it('stays inside the size budget for every focus, however many shapes exist', () => {
    // Fourteen shapes printed whole would be roughly four thousand characters,
    // and adherence measurably falls apart well before that.
    for (const [subject, focus] of [
      ['Mathematics', 'area of a compound shape'],
      ['Science', 'series and parallel circuits'],
      ['Science', 'balanced and unbalanced forces'],
      ['Science', 'food chains and food webs'],
      ['Mathematics', 'reading a frequency table'],
      ['Science', 'measuring volume accurately'],
    ] as const) {
      const p = buildFigureSpecPrompt(subject, 'Stage 9', focus)
      expect(p.length, `${focus}: ${p.length}`).toBeLessThan(1900)
    }
  })

  it('offers a Physics focus a circuit and not a spinner', () => {
    const p = buildFigureSpecPrompt('Science', 'Stage 9', 'series and parallel circuits')
    expect(p).toContain('"kind":"circuit"')
    expect(p).not.toContain('"kind":"spinners"')
  })

  it('offers a probability focus a spinner and not a circuit', () => {
    const p = buildFigureSpecPrompt('Mathematics', 'Stage 9', 'probability of two events together')
    expect(p).toContain('"kind":"spinners"')
    expect(p).not.toContain('"kind":"circuit"')
  })

  it('matches a stem in the middle of a word, and a plural', () => {
    // Both of these were dead: `\bmeasur\b` can never match, because there is
    // no word boundary inside "measuring"; `\bfood chain\b` misses the plural.
    expect(drawableKindsFor('measuring volume accurately')).toContain('apparatus')
    expect(drawableKindsFor('investigating how fast sugar dissolves')).toContain('apparatus')
    expect(drawableKindsFor('food chains and food webs')).toContain('foodchain')
    expect(drawableKindsFor('comparing two sets of data')).toContain('datatable')
    expect(drawableKindsFor('forces and their effects')).toContain('forces')
  })

  it('always offers something to a focus it half-recognises', () => {
    // Fewer than two matches used to mean an empty menu and a wasted call.
    const p = buildFigureSpecPrompt('Science', 'Stage 9', 'the reactivity of metals')
    expect(p).toContain('"kind":"')
  })
})

describe('English draws nothing', () => {
  it('refuses even a focus whose words match a shape', () => {
    // "finding information stated directly in the text" matched the table
    // shape on the word "table". A bar chart beside a comprehension is the
    // same fault as a clown beside one.
    for (const f of [
      'finding information stated directly in the text',
      'comparing two characters in the passage',
      'reading a table of contents',
    ]) {
      expect(worthDrawing(f, 'English'), f).toBe(false)
      expect(worthDrawing(f, 'English as a Second Language'), f).toBe(false)
      expect(drawableKindsFor(f, 'English'), f).toEqual([])
    }
  })

  it('still draws the same words for Mathematics', () => {
    expect(worthDrawing('reading a table of results', 'Mathematics')).toBe(true)
  })
})

describe('a single good match is not diluted', () => {
  it('offers a food chain focus the food chain and nothing else', () => {
    const p = buildFigureSpecPrompt('Science', 'Stage 9', 'food chains and food webs')
    expect(p).toContain('"kind":"foodchain"')
    expect(p).not.toContain('"kind":"barchart"')
    expect(p).not.toContain('"kind":"graph"')
  })

  it('still offers the general shapes where nothing specific fits', () => {
    const p = buildFigureSpecPrompt('Science', 'Stage 9', 'the reactivity of metals')
    expect(p).toContain('"kind":"')
  })
})
