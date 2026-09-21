// lib/cambridge-checkpoint.test.ts
import { describe, it, expect } from 'vitest'
import {
  CHECKPOINT_SUBJECTS, checkpointSubject, buildableSubjects, stageOf,
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

  it('names Primary ESL components from the papers, not from Lower Secondary', () => {
    // These were deferred rather than guessed, and the guess would have been
    // right -- which is not the point. The cover pages now say "Reading and
    // Usage", "Listening" and "Writing", and the totals printed on page one
    // are 34, 20 and 35: none of that could have been inferred.
    const esl = checkpointSubject('primary', 'English as a Second Language')!
    expect(esl.components.map((c) => c.name)).toEqual(['Reading and Usage', 'Listening', 'Writing'])
    expect(esl.components.map((c) => c.marks)).toEqual([34, 20, 35])
  })

  it('keeps "cannot be mocked" apart from "not built yet"', () => {
    // Listening needs audio and always will. That is a different fact from a
    // component nobody has written yet, and a learner deserves the real
    // reason for each.
    for (const programme of ['primary', 'lower-secondary'] as const) {
      const esl = checkpointSubject(programme, 'English as a Second Language')!
      const listening = esl.components.find((c) => c.name === 'Listening')!
      expect(listening.mockable, programme).toBe(false)
      expect(listening.notMockableReason, programme).toMatch(/audio/i)
      // The reading and writing papers of the same subject are buildable.
      expect(esl.components.filter((c) => c.mockable).length, programme).toBe(2)
    }
  })

  it('offers every subject whose papers have been read', () => {
    for (const programme of ['primary', 'lower-secondary'] as const) {
      expect(buildableSubjects(programme).map((s) => s.name).sort()).toEqual([
        'English', 'English as a Second Language', 'Mathematics', 'Science',
      ])
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

describe('the totals Cambridge prints on page one', () => {
  // Read off the question papers themselves: "The total mark for this paper
  // is N." Sixteen 0862 papers, thirteen 0893, twelve 0097, four 0861.
  it('records 50 for the Lower Secondary papers that say 50', () => {
    for (const name of ['Mathematics', 'Science', 'English'] as const) {
      const s = checkpointSubject('lower-secondary', name)!
      for (const c of s.components) expect(c.marks, `${name} ${c.number}`).toBe(50)
    }
  })

  it('records 40 for Primary Science, which is not 50', () => {
    // The whole point. This file used to assume 50 everywhere, inferred from
    // the 0-50 reporting scale. Twelve 0097 papers say 40, and a practice
    // paper marked out of the wrong total misreports every learner who sits it.
    const s = checkpointSubject('primary', 'Science')!
    for (const c of s.components) expect(c.marks, c.number).toBe(40)
  })

  it('records the three different ESL totals rather than one for the subject', () => {
    const esl = checkpointSubject('lower-secondary', 'English as a Second Language')!
    expect(esl.components.map((c) => c.marks)).toEqual([42, 25, 35])
  })

  it('leaves the total unrecorded where no paper was read', () => {
    // 0058 and 0096 have no paper in the set. Borrowing a total from a
    // subject that happens to share a duration is the inference that produced
    // the wrong 50 in the first place.
    expect(checkpointSubject('primary', 'English')!.components.every((c) => c.marks === undefined)).toBe(true)
    expect(checkpointSubject('primary', 'Mathematics')!.components.every((c) => c.marks === undefined)).toBe(true)
  })

  it('never records a total that is not a positive whole number', () => {
    for (const s of CHECKPOINT_SUBJECTS) {
      for (const c of s.components) {
        if (c.marks === undefined) continue
        expect(Number.isInteger(c.marks), `${s.name} ${c.number}`).toBe(true)
        expect(c.marks, `${s.name} ${c.number}`).toBeGreaterThan(0)
      }
    }
  })
})
