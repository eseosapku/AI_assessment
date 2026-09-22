// lib/exam-pacing.test.ts
import { describe, it, expect } from 'vitest'
import { pace, marksAttempted } from './exam-pacing'

/** Lower Secondary Science 0893: 50 marks in 45 minutes. */
const PAPER = { totalMarks: 50, totalSeconds: 45 * 60 }

describe('exam pacing', () => {
  it('says nothing in the first two minutes', () => {
    // Reading question one is not being behind.
    const p = pace({ ...PAPER, marksAttempted: 0, secondsRemaining: 45 * 60 - 30 })
    expect(p.state).toBe('unknown')
    expect(p.message).toBe('')
  })

  it('is on pace when marks keep up with the clock', () => {
    // Half the time gone, half the marks attempted.
    const p = pace({ ...PAPER, marksAttempted: 25, secondsRemaining: 22.5 * 60 })
    expect(p.state).toBe('on-track')
    expect(p.message).toBe('On pace')
  })

  it('counts being behind in minutes, not percent', () => {
    // Half the time gone, only 20 of 50 marks: 5 marks short, and this paper
    // pays 50 marks per 45 minutes, so that is about 4-5 minutes.
    const p = pace({ ...PAPER, marksAttempted: 20, secondsRemaining: 22.5 * 60 })
    expect(p.state === 'behind' || p.state === 'well-behind').toBe(true)
    expect(p.deltaMinutes).toBeLessThan(0)
    expect(p.message).toMatch(/min behind$/)
  })

  it('escalates once being behind is no longer recoverable by hurrying', () => {
    const mild = pace({ ...PAPER, marksAttempted: 22, secondsRemaining: 22.5 * 60 })
    const bad = pace({ ...PAPER, marksAttempted: 8, secondsRemaining: 22.5 * 60 })
    expect(mild.state).toBe('behind')
    expect(bad.state).toBe('well-behind')
  })

  it('says so when the learner is ahead', () => {
    const p = pace({ ...PAPER, marksAttempted: 35, secondsRemaining: 22.5 * 60 })
    expect(p.state).toBe('ahead')
    expect(p.message).toMatch(/min ahead$/)
  })

  it('stops talking about pace once every mark is attempted', () => {
    const p = pace({ ...PAPER, marksAttempted: 50, secondsRemaining: 10 * 60 })
    expect(p.state).toBe('ahead')
    expect(p.message).toBe('All marks attempted')
  })

  it('treats a minute either way as noise', () => {
    const p = pace({ ...PAPER, marksAttempted: 26, secondsRemaining: 22.5 * 60 })
    expect(p.state).toBe('on-track')
  })

  it('is quiet rather than wrong when it has nothing to work with', () => {
    for (const bad of [
      { totalMarks: 0, totalSeconds: 2700, marksAttempted: 0, secondsRemaining: 1000 },
      { totalMarks: 50, totalSeconds: 0, marksAttempted: 0, secondsRemaining: 1000 },
      { totalMarks: 50, totalSeconds: 2700, marksAttempted: 0, secondsRemaining: Number.NaN },
    ]) {
      expect(pace(bad).state, JSON.stringify(bad)).toBe('unknown')
    }
  })

  it('never blames the learner for time past the end of the paper', () => {
    // The clock can go negative when a paper runs over.
    const p = pace({ ...PAPER, marksAttempted: 50, secondsRemaining: -300 })
    expect(Number.isFinite(p.deltaMinutes)).toBe(true)
  })
})

describe('counting the marks attempted', () => {
  const qs = [{ marks: 1 }, { marks: 3 }, { marks: 25 }, { marks: undefined }]

  it('adds the marks of the questions that were answered', () => {
    expect(marksAttempted(qs, (i) => i === 1 || i === 2)).toBe(28)
  })

  it('is zero when nothing is answered, and safe on rubbish', () => {
    expect(marksAttempted(qs, () => false)).toBe(0)
    expect(marksAttempted([], () => true)).toBe(0)
    expect(marksAttempted(undefined as never, () => true)).toBe(0)
  })

  it('treats a question with no marks as worth nothing rather than NaN', () => {
    expect(marksAttempted(qs, (i) => i === 3)).toBe(0)
  })
})
