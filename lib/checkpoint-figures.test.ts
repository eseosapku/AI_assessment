// lib/checkpoint-figures.test.ts
import { describe, it, expect } from 'vitest'
import type { TextbookSourceImage } from './textbook-source-images'
import { fociWithFigures, splitForCatalogue } from './checkpoint-figures'

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

describe('splitting the foci so one catalogue call is not the ceiling', () => {
  it('asks in as many slices as the target needs', () => {
    // buildVisualFigureCatalogForTopics caps a single call at MAX_VISION_FIGURES
    // (12), so a paper wanting seventeen figures cannot get them in one ask.
    const foci = Array.from({ length: 34 }, (_, i) => `focus ${i}`)
    const slices = splitForCatalogue(foci, 17)
    expect(slices.length).toBe(2)
    expect(slices.flat().sort()).toEqual([...foci].sort())
  })

  it('uses a single slice when one call already covers the target', () => {
    const foci = Array.from({ length: 8 }, (_, i) => `focus ${i}`)
    expect(splitForCatalogue(foci, 6)).toEqual([foci])
  })

  it('never returns an empty slice, which would be a wasted model call', () => {
    for (const n of [1, 2, 3, 13, 34]) {
      const foci = Array.from({ length: n }, (_, i) => `f${i}`)
      for (const slice of splitForCatalogue(foci, 20)) expect(slice.length).toBeGreaterThan(0)
    }
  })

  it('returns nothing to ask when there are no foci', () => {
    expect(splitForCatalogue([], 12)).toEqual([])
  })
})
