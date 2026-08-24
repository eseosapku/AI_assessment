// lib/studylab/lessonRunMigrate.test.ts
import { describe, it, expect } from 'vitest'
import { policyFor } from './lessonPolicy'
import { runFromLegacy } from './lessonRunMigrate'

const OPEN = policyFor('scratch')
const PLAN = [
  { title: 'Atoms', goal: 'what an atom is' },
  { title: 'Bonding', goal: 'why atoms bond' },
  { title: 'Shapes', goal: 'predicting shape' },
]

describe('runFromLegacy', () => {
  it('marks everything before the current step as done', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 3, status: 'active' }, OPEN)
    expect(run.steps.map((s) => s.status)).toEqual(['done', 'done', 'teaching'])
    expect(run.currentStep).toBe(2)
  })

  it('treats a lesson at step 1 as barely started', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 1, status: 'active' }, OPEN)
    expect(run.steps.map((s) => s.status)).toEqual(['teaching', 'pending', 'pending'])
  })

  it('carries a completed lesson straight to done', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 3, status: 'completed' }, OPEN)
    expect(run.phase).toBe('done')
  })

  it('gives a lesson with no plan an empty run in planning', () => {
    // Most of the 47 scratch lessons predate the plan entirely.
    const run = runFromLegacy({ plan: null, currentStep: 0, status: 'active' }, OPEN)
    expect(run.phase).toBe('planning')
    expect(run.steps).toEqual([])
  })

  it('locks nothing, because old plans carry no subtopic', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 2, status: 'active' }, policyFor('gap'))
    expect(run.steps.every((s) => !s.lockedBy)).toBe(true)
  })

  it('takes its pace from the policy, since none was ever stored', () => {
    expect(runFromLegacy({ plan: PLAN, currentStep: 1, status: 'active' }, OPEN).pace).toBe('run')
  })

  it('survives a plan whose entries are malformed', () => {
    // canvas_state is jsonb written by a model; it is not to be trusted.
    const run = runFromLegacy(
      { plan: [{ title: 'Ok', goal: 'g' }, null, { goal: 'no title' }] as never, currentStep: 1, status: 'active' },
      OPEN,
    )
    expect(run.steps).toHaveLength(1)
    expect(run.steps[0].title).toBe('Ok')
  })

  it('clamps a current step beyond the plan', () => {
    const run = runFromLegacy({ plan: PLAN, currentStep: 99, status: 'active' }, OPEN)
    expect(run.currentStep).toBeLessThan(PLAN.length)
  })
})
