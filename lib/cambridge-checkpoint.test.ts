// lib/cambridge-checkpoint.test.ts
import { describe, it, expect } from 'vitest'
import {
  CHECKPOINT_SUBJECTS, checkpointSubject, buildableSubjects, stageOf, questionCountFor,
} from './cambridge-checkpoint'

describe('the published syllabus', () => {
  it('records Lower Secondary Mathematics as Cambridge prints it', () => {
    const maths = checkpointSubject('lower-secondary', 'Mathematics')!
    expect(maths.code).toBe('0862')
    expect(maths.components.map((c) => c.number)).toEqual(['01', '02'])
    expect(maths.components.every((c) => c.minutes === 60)).toBe(true)
  })

  it('records Lower Secondary Science as Cambridge prints it', () => {
    const science = checkpointSubject('lower-secondary', 'Science')!
    expect(science.code).toBe('0893')
    expect(science.components.every((c) => c.minutes === 45)).toBe(true)
    expect(science.strands).toContain('Earth and Space')
    expect(science.strands).toHaveLength(6)
  })

  it('records the Primary subjects at their own durations', () => {
    expect(checkpointSubject('primary', 'Mathematics')!.code).toBe('0096')
    expect(checkpointSubject('primary', 'Mathematics')!.components[0].minutes).toBe(45)
    expect(checkpointSubject('primary', 'Science')!.code).toBe('0097')
    expect(checkpointSubject('primary', 'Science')!.components[0].minutes).toBe(35)
  })

  it('does not confuse English with English as a Second Language', () => {
    // Several revision sites print 0861 as ESL. Cambridge's own May 2026
    // timetable has 0861 as English and 0876 as ESL, and a wrong syllabus code
    // in a product that claims to prep for the real exam is not a small error.
    expect(checkpointSubject('lower-secondary', 'English')!.code).toBe('0861')
    expect(checkpointSubject('lower-secondary', 'English as a Second Language')!.code).toBe('0876')
    expect(checkpointSubject('primary', 'English')!.code).toBe('0058')
    expect(checkpointSubject('primary', 'English as a Second Language')!.code).toBe('0057')
  })

  it('marks Lower Secondary listening unmockable, and says why', () => {
    const esl = checkpointSubject('lower-secondary', 'English as a Second Language')!
    const listening = esl.components.find((c) => c.number === '02')!
    expect(listening.mockable).toBe(false)
    expect(listening.notMockableReason).toMatch(/audio/i)
    // Its siblings can be mocked — the flag is per component, not per subject.
    expect(esl.components.find((c) => c.number === '01')!.mockable).toBe(true)
    expect(esl.components.find((c) => c.number === '03')!.mockable).toBe(true)
  })

  it('does not assume Primary ESL mirrors Lower Secondary', () => {
    // Only the durations were sourced for Primary ESL, never which component
    // is which skill. Guessing that 02 is Listening because it is at Lower
    // Secondary is the inference this module exists to prevent.
    const esl = checkpointSubject('primary', 'English as a Second Language')!
    expect(esl.components.every((c) => !c.mockable)).toBe(true)
    expect(esl.components[1].notMockableReason).toMatch(/not sourced/i)
  })

  it('keeps "cannot be mocked" apart from "not built yet"', () => {
    // English Reading and Writing genuinely can be mocked; they are simply
    // not this phase's work. Burying that among real limitations would tell a
    // learner the wrong reason.
    const english = checkpointSubject('lower-secondary', 'English')!
    expect(english.components.every((c) => c.mockable)).toBe(true)
    expect(buildableSubjects('lower-secondary').map((s) => s.name)).not.toContain('English')
  })

  it('offers only the subjects this phase built', () => {
    for (const programme of ['primary', 'lower-secondary'] as const) {
      expect(buildableSubjects(programme).map((s) => s.name).sort()).toEqual(['Mathematics', 'Science'])
    }
  })

  it('fixes the question count, so nobody chooses it', () => {
    // A dropdown offering the count is the tell that a paper is really a quiz.
    const science = checkpointSubject('lower-secondary', 'Science')!
    expect(questionCountFor(science.components[0])).toBe(10)
  })

  it('never asks for a count the generator cannot deliver', () => {
    // Measured, not guessed: asking for 15 returned 14 and asking for 12
    // returned 11, and the route errors on a short paper rather than
    // shipping it. Ten is the length that has actually worked, so the count
    // does NOT scale with duration however tempting that looks.
    for (const s of CHECKPOINT_SUBJECTS) {
      for (const c of s.components) {
        expect(questionCountFor(c), `${s.name} ${c.number}`).toBe(10)
      }
    }
  })

  it('derives the stage rather than storing it twice', () => {
    expect(stageOf('primary')).toBe(6)
    expect(stageOf('lower-secondary')).toBe(9)
  })
})

describe('the syllabus holds together', () => {
  it('gives every subject a four-digit code and at least one component', () => {
    for (const s of CHECKPOINT_SUBJECTS) {
      expect(s.code, s.name).toMatch(/^\d{4}$/)
      expect(s.components.length, s.name).toBeGreaterThan(0)
    }
  })

  it('gives every component a positive duration', () => {
    for (const s of CHECKPOINT_SUBJECTS) {
      for (const c of s.components) {
        expect(c.minutes, `${s.name} ${c.number}`).toBeGreaterThan(0)
      }
    }
  })

  it('makes every unmockable component explain itself', () => {
    for (const s of CHECKPOINT_SUBJECTS) {
      for (const c of s.components) {
        if (!c.mockable) expect(c.notMockableReason, `${s.name} ${c.number}`).toBeTruthy()
      }
    }
  })

  it('gives every subject at least two strands to report against', () => {
    // A single-strand subject would make the strand breakdown meaningless,
    // which is the whole product here.
    for (const s of CHECKPOINT_SUBJECTS) {
      expect(s.strands.length, s.name).toBeGreaterThanOrEqual(2)
    }
  })

  it('never lists the cross-cutting strand among the others', () => {
    // "Thinking and Working Mathematically" runs through Number, Algebra and
    // Statistics rather than sitting beside them; listing it twice would let a
    // question be tagged to it as if it were a content area.
    for (const s of CHECKPOINT_SUBJECTS) {
      if (s.crossCuttingStrand) expect(s.strands, s.name).not.toContain(s.crossCuttingStrand)
    }
  })

  it('has no duplicate code within a programme', () => {
    for (const programme of ['primary', 'lower-secondary'] as const) {
      const codes = CHECKPOINT_SUBJECTS.filter((s) => s.programme === programme).map((s) => s.code)
      expect(new Set(codes).size, programme).toBe(codes.length)
    }
  })
})
