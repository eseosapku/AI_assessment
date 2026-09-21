// lib/figure-question-match.test.ts
import { describe, it, expect } from 'vitest'
import { absentLabels, absentCountedNouns, namesAbsentLabel, figureMismatchReasons } from './figure-question-match'

const MITO = 'A cross-section of a mitochondrion showing the outer membrane, inner membrane, intermembrane space, cristae, ribosomes and DNA.'
const ROAD = 'An illustration of a straight road running between two rows of houses with red roofs, drawn in perspective.'

describe('labels the figure does not have', () => {
  it('catches "the part labelled A" on a diagram with no A', () => {
    // Shipped: a mitochondrion labelled Outer membrane, Cristae, DNA — asked
    // to "Name the part labelled A".
    expect(absentLabels('Look at the diagram. Name the part labelled A that is involved in ATP production.', MITO))
      .toEqual(['A'])
  })

  it('catches angles invented on a decorative illustration', () => {
    // Shipped: a stock picture of a road between houses, asked "Work out the
    // size of angle C if angle D is 120 degrees." There are no labels at all.
    expect(absentLabels('In the diagram, a road with houses shows parallel lines. Work out the size of angle C if angle D is 120 degrees.', ROAD))
      .toEqual(['C', 'D'])
  })

  it('accepts a label the description actually names', () => {
    expect(absentLabels('Name the part labelled B.', 'A plant cell diagram with A the nucleus and B the chloroplast.'))
      .toEqual([])
  })

  it('does not treat every capital letter as a label', () => {
    // "Vitamin A" and a sentence starting "I" are not diagram labels.
    expect(absentLabels('Name the vitamin found in carrots.', ROAD)).toEqual([])
    expect(absentLabels('State the process shown.', ROAD)).toEqual([])
  })

  it('only fires when a figure is actually attached', () => {
    const q = { question: 'Name the part labelled A.', image_url: '' }
    expect(namesAbsentLabel(q, MITO)).toBe(false)
    expect(namesAbsentLabel({ ...q, image_url: '/fig.png' }, MITO)).toBe(true)
  })
})

describe('things the figure does not show', () => {
  it('catches counting cubes in a picture of flowers', () => {
    // Shipped: fifteen painted flowers, asked about "the number of cubes",
    // with the stem asserting the learner counted twelve.
    const flowers = 'A hand-painted repeating pattern of fifteen blue four-petalled flowers arranged in three rows inside a black border.'
    expect(absentCountedNouns('Look at the diagram. Sam counted the number of cubes in the pattern.', flowers))
      .toEqual(['cubes'])
  })

  it('accepts what the figure does show', () => {
    const flowers = 'A repeating pattern of blue flowers arranged in three rows inside a black border.'
    expect(absentCountedNouns('Count the number of flowers in each row.', flowers)).toEqual([])
  })

  it('stays quiet when the description is too thin to judge', () => {
    // A two-word description cannot be expected to name everything, and
    // demanding it would strip figures from sound questions.
    expect(absentCountedNouns('Count the number of cubes.', 'a pattern')).toEqual([])
  })
})

describe('the reasons together', () => {
  it('says which, so a log line is diagnosable', () => {
    const reasons = figureMismatchReasons(
      { question: 'Look at the diagram. Name the part labelled A.', image_url: '/m.png' },
      MITO,
    )
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toContain('A')
  })

  it('is empty for a sound pair', () => {
    expect(figureMismatchReasons(
      { question: 'Look at the diagram. Name the membrane folded into cristae.', image_url: '/m.png' },
      MITO,
    )).toEqual([])
  })

  it('survives junk', () => {
    for (const junk of [null, undefined, {}, { question: 42 }]) {
      expect(() => figureMismatchReasons(junk as never, null)).not.toThrow()
    }
  })
})
