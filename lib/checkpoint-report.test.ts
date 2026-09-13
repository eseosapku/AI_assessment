// lib/checkpoint-report.test.ts
import { describe, it, expect } from 'vitest'
import { checkpointReport } from './checkpoint-report'
import { checkpointSubject } from './cambridge-checkpoint'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

const q = (strand: string, matched = true) => ({ strand, strand_matched: matched })

describe('checkpointReport', () => {
  it('scores on the 0-50 scale Cambridge publishes', () => {
    const questions = [q('Biology'), q('Biology'), q('Chemistry'), q('Chemistry')]
    const report = checkpointReport(questions, [true, true, true, false], SCIENCE)
    expect(report.outOf).toBe(50)
    expect(report.score).toBe(38) // 3/4 of 50, rounded
  })

  it('reports a strand nobody was asked about as not assessed, never zero', () => {
    // Scoring a strand that had no questions is the same class of lie as a
    // citation that is not true — it reads as a finding and is not one.
    const report = checkpointReport([q('Biology')], [true], SCIENCE)
    const physics = report.strands.find((s) => s.strand === 'Physics')!
    expect(physics.assessed).toBe(false)
    expect(physics.total).toBe(0)
  })

  it('counts a question toward a strand only when the tag was a real match', () => {
    const questions = [q('Biology', true), q('Physics', false)]
    const report = checkpointReport(questions, [true, false], SCIENCE)
    expect(report.strands.find((s) => s.strand === 'Biology')!.total).toBe(1)
    expect(report.strands.find((s) => s.strand === 'Physics')!.assessed).toBe(false)
  })

  it('still scores an unmatched question overall, because the learner answered it', () => {
    // The tag is uncertain; the answer is not. Dropping it from the total
    // would understate what they actually did.
    const report = checkpointReport([q('Biology', false)], [true], SCIENCE)
    expect(report.score).toBe(50)
  })

  it('names the weakest assessed strand', () => {
    const questions = [q('Biology'), q('Chemistry'), q('Chemistry')]
    const report = checkpointReport(questions, [true, false, false], SCIENCE)
    expect(report.weakest).toBe('Chemistry')
  })

  it('names no weakest strand when nothing was assessed', () => {
    const report = checkpointReport([q('Biology', false)], [true], SCIENCE)
    expect(report.weakest).toBeNull()
  })

  it('lists every strand of the subject, assessed or not', () => {
    const report = checkpointReport([q('Biology')], [true], SCIENCE)
    expect(report.strands.map((s) => s.strand)).toEqual(SCIENCE.strands)
  })

  it('survives a paper with no questions', () => {
    const report = checkpointReport([], [], SCIENCE)
    expect(report.score).toBe(0)
    expect(report.weakest).toBeNull()
    expect(report.strands.every((s) => !s.assessed)).toBe(true)
  })

  it('never throws when answers and questions disagree in length', () => {
    expect(() => checkpointReport([q('Biology'), q('Physics')], [true], SCIENCE)).not.toThrow()
  })
})
