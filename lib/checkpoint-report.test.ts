// lib/checkpoint-report.test.ts
import { describe, it, expect } from 'vitest'
import { checkpointReport } from './checkpoint-report'
import { checkpointSubject } from './cambridge-checkpoint'
import { buildPaper, applyBlueprint, PAPER_MARKS } from './checkpoint-paper'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

const q = (strand: string, marks = 1, matched = true) => ({ strand, marks, strand_matched: matched })

describe('checkpointReport', () => {
  it('scores in marks, on the total the paper actually carried', () => {
    const questions = [q('Biology', 1), q('Biology', 2), q('Chemistry', 3), q('Chemistry', 1)]
    const report = checkpointReport(questions, [true, true, false, true], SCIENCE)
    expect(report.outOf).toBe(7)
    expect(report.score).toBe(4)
  })

  it('reads a full blueprint paper as Cambridge reports one, out of 50', () => {
    // The point of the blueprint: a full component is a 50-mark paper, so the
    // raw mark IS the 0-50 reporting scale rather than a percentage rescaled
    // into it.
    const paper = buildPaper(SCIENCE, SCIENCE.components[0], { mode: 'paper', seed: 9 })
    // Shaped like what the generator returns for each slot kind, so the
    // blueprint can match them and the marks land where they should.
    const questions = applyBlueprint(
      paper.slots.map((slot, i) => ({
        id: i,
        question: `Q${i}`,
        type: slot.format === 'tick' ? 'interactive' : 'longform',
        ...(slot.format === 'short' ? { short_answer: { accepted: [`a${i}`] } } : {}),
        ...(slot.format === 'tick'
          ? { kind: 'multi_select', options: ['a', 'b', 'c', 'd'], correct_indices: [0, 1] }
          : {}),
      })),
      paper,
    )
    const report = checkpointReport(questions, questions.map(() => true), SCIENCE)
    expect(report.outOf).toBe(PAPER_MARKS)
    expect(report.score).toBe(PAPER_MARKS)
  })

  it('keeps the part marks a written answer earned', () => {
    // Counting questions right-or-wrong throws away the main thing a written
    // answer is for: 2 of 3 is not a wrong answer.
    const report = checkpointReport([q('Physics', 3)], [2], SCIENCE)
    expect(report.score).toBe(2)
    expect(report.outOf).toBe(3)
    expect(report.strands.find((s) => s.strand === 'Physics')!.earned).toBe(2)
  })

  it('never awards more marks than the question was worth', () => {
    const report = checkpointReport([q('Physics', 2)], [9], SCIENCE)
    expect(report.score).toBe(2)
  })

  it('treats a negative award as none rather than subtracting from the paper', () => {
    const report = checkpointReport([q('Physics', 2), q('Biology', 2)], [-5, 2], SCIENCE)
    expect(report.score).toBe(2)
  })

  it('takes a boolean as all of that question’s marks or none', () => {
    const report = checkpointReport([q('Physics', 3), q('Biology', 2)], [true, false], SCIENCE)
    expect(report.score).toBe(3)
  })

  it('reports a strand nobody was asked about as not assessed, never zero', () => {
    // Scoring a strand that had no questions is the same class of lie as a
    // citation that is not true — it reads as a finding and is not one.
    const report = checkpointReport([q('Biology')], [true], SCIENCE)
    const physics = report.strands.find((s) => s.strand === 'Physics')!
    expect(physics.assessed).toBe(false)
    expect(physics.available).toBe(0)
    expect(physics.questions).toBe(0)
  })

  it('counts a question toward a strand only when the tag was a real match', () => {
    const questions = [q('Biology', 1, true), q('Physics', 1, false)]
    const report = checkpointReport(questions, [true, false], SCIENCE)
    expect(report.strands.find((s) => s.strand === 'Biology')!.questions).toBe(1)
    expect(report.strands.find((s) => s.strand === 'Physics')!.assessed).toBe(false)
  })

  it('still scores an unmatched question overall, because the learner answered it', () => {
    // The tag is uncertain; the answer is not. Dropping it from the total
    // would understate what they actually did.
    const report = checkpointReport([q('Biology', 3, false)], [true], SCIENCE)
    expect(report.score).toBe(3)
    expect(report.outOf).toBe(3)
  })

  it('names the weakest assessed strand by marks, not by questions', () => {
    // One 3-mark question missed outweighs two 1-mark questions missed, and a
    // learner told to revise the wrong strand has been actively misled.
    const questions = [q('Biology', 1), q('Biology', 1), q('Chemistry', 3)]
    const report = checkpointReport(questions, [false, true, 0], SCIENCE)
    expect(report.weakest).toBe('Chemistry')
  })

  it('names no weakest strand when nothing was assessed', () => {
    const report = checkpointReport([q('Biology', 1, false)], [true], SCIENCE)
    expect(report.weakest).toBeNull()
  })

  it('lists every strand of the subject, assessed or not', () => {
    const report = checkpointReport([q('Biology')], [true], SCIENCE)
    expect(report.strands.map((s) => s.strand)).toEqual(SCIENCE.strands)
  })

  it('treats a question with no marks as worth one', () => {
    const report = checkpointReport([{ strand: 'Biology', strand_matched: true }], [true], SCIENCE)
    expect(report.outOf).toBe(1)
    expect(report.score).toBe(1)
  })

  it('survives a paper with no questions', () => {
    const report = checkpointReport([], [], SCIENCE)
    expect(report.score).toBe(0)
    expect(report.outOf).toBe(0)
    expect(report.weakest).toBeNull()
    expect(report.strands.every((s) => !s.assessed)).toBe(true)
  })

  it('never throws when answers and questions disagree in length', () => {
    const report = checkpointReport([q('Biology', 2), q('Physics', 3)], [true], SCIENCE)
    expect(report.score).toBe(2)
    expect(report.outOf).toBe(5)
  })
})
