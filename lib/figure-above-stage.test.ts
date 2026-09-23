/**
 * A figure may be too advanced for the paper even when its book is not.
 *
 * Walked in a browser on a live Stage 9 Science paper and a live Stage 6
 * Primary Science paper, both of which opened on the same A Level diagram:
 *
 *   Stage 9  "Name the structure that separates the intermembrane space
 *             from the matrix."
 *   Stage 6  "Name the space between the outer and inner membranes."
 *            "Identify the structure that increases the surface area for
 *             reactions."
 *
 * The figure was a labelled mitochondrion ultrastructure from "Biology S4 SB".
 * `levelOfBook` reads "S4" as lower-secondary, so the level gate passed it, and
 * the question was then written to the labels on the picture.
 *
 * The Stage 6 pair is the case that settles where the fix belongs. Neither
 * stem contains a single term on the beyond-stage word list — "the space
 * between the outer and inner membranes" is six ordinary words — so no check
 * on the finished question can ever catch them. The picture is the only thing
 * that was checkable, and it was checkable before the question existed.
 */
import { describe, it, expect } from 'vitest'
import { beyondStage } from './grade-vocabulary'

describe('above-stage figure descriptions', () => {
  const MITOCHONDRION =
    'This diagram shows a cross-section of a mitochondrion, highlighting its ' +
    'key structures. The labels include the outer membrane, intermembrane ' +
    'space, inner membrane, cristae, matrix and ribosomes.'

  it('reads the mitochondrion ultrastructure as past Checkpoint', () => {
    expect(beyondStage(MITOCHONDRION, 9).length).toBeGreaterThan(0)
    expect(beyondStage(MITOCHONDRION, 6).length).toBeGreaterThan(0)
  })

  it('leaves it alone at IGCSE and above, where it is on the syllabus', () => {
    expect(beyondStage(MITOCHONDRION, 11)).toEqual([])
  })

  it('catches the terms the live papers used', () => {
    expect(beyondStage('the intermembrane space', 9)).toContain('intermembrane space')
    expect(beyondStage('labelled organelles of a plant cell', 9)).toContain('organelle')
    expect(beyondStage('cell ultrastructure', 9)).toContain('ultrastructure')
  })

  it('does not fire on the ordinary senses of "matrix"', () => {
    // A rock, a soil and a table of numbers are all a matrix, and a Stage 9
    // paper may legitimately print any of them. Only the organelle compartment
    // is listed, as a whole phrase.
    expect(beyondStage('the rock matrix surrounding the fossil', 9)).toEqual([])
    expect(beyondStage('a matrix of dots arranged in rows', 6)).toEqual([])
  })

  it('leaves the Stage 9 cell diagram that IS on the syllabus', () => {
    // Nucleus, cytoplasm, cell membrane, cell wall, chloroplast and vacuole
    // are Lower Secondary. Refusing these would empty the papers to catch the
    // ultrastructure ones, which is the trade this must not make.
    const plain =
      'A plant cell showing the nucleus, cytoplasm, cell membrane, cell wall, ' +
      'chloroplast and vacuole.'
    expect(beyondStage(plain, 9)).toEqual([])
    expect(beyondStage(plain, 6)).toEqual([])
  })
})
