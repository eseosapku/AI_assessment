import { describe, it, expect } from 'vitest'
import { classifyFigure, guidanceFor, describeForPrompt } from './figure-keying'

describe('classifyFigure', () => {
  it('spots a figure that names its parts', () => {
    expect(classifyFigure('A diagram of a neuron with labels for the axon, dendrites and myelin sheath.'))
      .toBe('word-labelled')
    expect(classifyFigure('Annotated cross-section of a leaf.')).toBe('word-labelled')
    expect(classifyFigure('A circuit with a legend showing each component.')).toBe('word-labelled')
  })

  it('spots a letter-keyed figure and does not mistake it for a named one', () => {
    // These descriptions contain the word "labelled" too, so order matters:
    // read as word-labelled, a perfectly good identification question would be
    // banned for no reason.
    expect(classifyFigure('A plant cell with parts labelled A to D.')).toBe('letter-keyed')
    expect(classifyFigure('Apparatus marked 1-4 showing the distillation setup.')).toBe('letter-keyed')
    expect(classifyFigure('Diagram labelled A, B and C.')).toBe('letter-keyed')
  })

  it('treats an unlabelled figure as unlabelled', () => {
    expect(classifyFigure('A photograph of a rainy backyard with a wooden fence.')).toBe('unlabelled')
    expect(classifyFigure('A bar chart comparing rainfall across four months.')).toBe('unlabelled')
  })

  it('handles missing descriptions', () => {
    expect(classifyFigure('')).toBe('unlabelled')
    expect(classifyFigure(null)).toBe('unlabelled')
    expect(classifyFigure(undefined)).toBe('unlabelled')
  })
})

describe('guidanceFor', () => {
  it('forbids naming only where the names are printed', () => {
    expect(guidanceFor('word-labelled').avoid).toMatch(/name, identify or pick out/i)
    expect(guidanceFor('letter-keyed').avoid).toBe('')
    expect(guidanceFor('unlabelled').avoid).toBe('')
  })

  it('asks for reasoning about a labelled figure rather than recall', () => {
    const ask = guidanceFor('word-labelled').ask.toLowerCase()
    expect(ask).toMatch(/does|relate|happens if|order|why/)
  })

  it('lets a letter-keyed figure be identified, since the student supplies the name', () => {
    expect(guidanceFor('letter-keyed').ask.toLowerCase()).toMatch(/name what a letter/)
  })

  it('phrases guidance as a demand, not only a ban', () => {
    // Telling a model not to ask naming questions yields naming questions in
    // different words; asking for a consequence yields a consequence.
    for (const k of ['word-labelled', 'letter-keyed', 'unlabelled'] as const) {
      expect(guidanceFor(k).ask.length).toBeGreaterThan(40)
    }
  })
})

describe('describeForPrompt', () => {
  const entry = {
    key: 'tb-1-p10-embedded-0',
    page: 10,
    category: 'diagram',
    description: 'A neuron with labels for the axon and dendrites.',
  }

  it('carries the key, the keying and the instruction', () => {
    const line = describeForPrompt(entry)
    expect(line).toContain('tb-1-p10-embedded-0')
    expect(line).toContain('word-labelled')
    expect(line).toContain('Do NOT ask the student to name')
    expect(line).toContain(entry.description)
  })

  it('omits the ban for figures that have nothing to give away', () => {
    const line = describeForPrompt({ ...entry, description: 'A photograph of a river delta.' })
    expect(line).toContain('unlabelled')
    expect(line).not.toContain('Do NOT')
  })
})
