// lib/studylab/progressBar.test.ts
import { describe, it, expect } from 'vitest'
import { barSegments, barProgress } from './progressBar'
import { emptyRun, proposePlan, acceptPlan, withStage, type LessonRun, type LessonStep } from './lessonRun'
import { policyFor } from './lessonPolicy'

/**
 * The lesson's progress as one bar across the top: a segment a station,
 * finished ones full, the one being taught filled by its four stages.
 */
const SCRATCH = policyFor('scratch')
const steps = (n: number): LessonStep[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, title: `Step ${i + 1}`, goal: 'g', status: 'pending', cardIds: [] }))
const planned = (n = 4): LessonRun => {
  const r = proposePlan(emptyRun(SCRATCH), steps(n))
  if (!r.ok) throw new Error(r.reason)
  return r.run
}
const accepted = (n = 4): LessonRun => {
  const r = acceptPlan(planned(n))
  if (!r.ok) throw new Error(r.reason)
  return r.run
}

describe('barSegments', () => {
  it('is empty while the plan is still being agreed', () => {
    const segs = barSegments(planned(), SCRATCH)
    expect(segs.map((s) => s.fill)).toEqual([0, 0, 0, 0])
    expect(segs.every((s) => s.status === 'later')).toBe(true)
  })

  it('fills finished stations, the current one by its stage, and leaves the rest empty', () => {
    const run = withStage(accepted(), 'practice')
    const moved: LessonRun = {
      ...run,
      steps: run.steps.map((s, i) => (i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'teaching' } : s)),
      currentStep: 1,
    }
    const segs = barSegments(moved, SCRATCH)
    expect(segs.map((s) => s.status)).toEqual(['done', 'current', 'later', 'later'])
    expect(segs[0].fill).toBe(1)
    expect(segs[1].fill).toBeCloseTo(0.625)
    expect(segs[1].stage).toBe('practice')
    expect(segs[2].fill).toBe(0)
  })

  it('counts a station tested out of as finished', () => {
    const run = accepted()
    const known: LessonRun = { ...run, steps: run.steps.map((s, i) => (i === 3 ? { ...s, status: 'known' } : s)) }
    const segs = barSegments(known, SCRATCH)
    expect(segs[3]).toMatchObject({ status: 'known', fill: 1 })
  })

  it('has nothing to show without a run', () => {
    expect(barSegments(null, SCRATCH)).toEqual([])
  })
})

describe('barProgress', () => {
  it('is how much of the whole lesson is filled, from 0 to 1', () => {
    expect(barProgress([])).toBe(0)
    expect(barProgress([{ fill: 1 }, { fill: 0.5 }, { fill: 0 }, { fill: 0.5 }] as never)).toBe(0.5)
  })
})
