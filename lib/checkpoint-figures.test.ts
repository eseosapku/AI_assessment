// lib/checkpoint-figures.test.ts
import { describe, it, expect } from 'vitest'
import type { TextbookSourceImage } from './textbook-source-images'
import { fociWithFigures, figuresForFoci } from './checkpoint-figures'

/** Only the fields the ranker reads; the rest of the record is irrelevant here. */
const fig = (key: string, description: string, keywords = ''): TextbookSourceImage =>
  ({ key, description, keywords } as unknown as TextbookSourceImage)

const LIBRARY = [
  fig('a', 'A labelled diagram of a plant cell showing the chloroplast and cell wall'),
  fig('b', 'A circuit diagram with two lamps wired in series and a cell'),
  fig('c', 'A photograph of a market stall selling fruit'),
]

describe('which foci the library can illustrate', () => {
  it('needs real word overlap, not a near miss', () => {
    // The ranker does not stem, so "circuits" does not match "circuit" and a
    // focus can read as obviously covered while scoring nothing. Worth pinning:
    // it is why the curated foci are phrased the way they are.
    expect(fociWithFigures(['series circuits and cells'], LIBRARY).size).toBe(0)
  })

  it('finds the foci a figure actually depicts', () => {
    const covered = fociWithFigures(['plant cell structure', 'series circuit with lamps'], LIBRARY)
    expect(covered.has('plant cell structure')).toBe(true)
    expect(covered.has('series circuit with lamps')).toBe(true)
  })

  it('leaves out a focus nothing depicts', () => {
    const covered = fociWithFigures(['the probability scale', 'plant cell structure'], LIBRARY)
    expect(covered.has('the probability scale')).toBe(false)
    expect(covered.size).toBe(1)
  })

  it('returns an empty set rather than throwing on an empty library', () => {
    expect(fociWithFigures(['plant cell structure'], []).size).toBe(0)
  })

  it('survives junk in place of foci', () => {
    expect(fociWithFigures([], LIBRARY).size).toBe(0)
    expect(fociWithFigures(['', '   '], LIBRARY).size).toBe(0)
  })
})

describe('one figure per focus', () => {
  /** Stands in for the vision describer, which resolves an origin and calls out. */
  const describeStub = async (img: TextbookSourceImage) => `described ${img.key}`

  const LIB = [
    fig('cell', 'A labelled diagram of a plant cell showing the chloroplast and cell wall'),
    fig('cell2', 'A second diagram of a plant cell with the cell wall labelled'),
    fig('circuit', 'A circuit diagram with two lamps wired in series and a cell'),
    fig('market', 'A photograph of a market stall selling fruit'),
  ]
  const FOCI = ['plant cell structure', 'series circuit with lamps']

  it('picks a figure chosen for each focus', async () => {
    const catalog = await figuresForFoci(FOCI, 4, LIB, describeStub)
    expect(catalog.map((c) => c.key)).toContain('circuit')
    expect(catalog.length).toBe(2)
  })

  it('never gives the same figure to two foci', async () => {
    // Clustering is what produced the near-duplicate questions: several
    // questions written about one picture, differing by a word.
    const catalog = await figuresForFoci(['plant cell structure', 'plant cell wall'], 4, LIB, describeStub)
    expect(new Set(catalog.map((c) => c.key)).size).toBe(catalog.length)
    expect(catalog.length).toBe(2)
  })

  it('stops at the target rather than illustrating everything', async () => {
    const catalog = await figuresForFoci(['plant cell structure', 'plant cell wall'], 1, LIB, describeStub)
    expect(catalog).toHaveLength(1)
  })

  it('skips a focus nothing depicts instead of reaching for a stray figure', async () => {
    // A photograph of a market stall is not an answer to "the probability
    // scale"; offering it is how a paper ends up asking about the picture.
    const catalog = await figuresForFoci(['the probability scale'], 4, LIB, describeStub)
    expect(catalog).toEqual([])
  })

  it('asks for nothing when there is nothing to ask for', async () => {
    expect(await figuresForFoci([], 12, LIB, describeStub)).toEqual([])
    expect(await figuresForFoci(FOCI, 0, LIB, describeStub)).toEqual([])
    expect(await figuresForFoci(FOCI, 12, [], describeStub)).toEqual([])
  })
})
