// lib/studylab/planRail.test.ts
import { describe, it, expect } from 'vitest'
import { railSteps, railIsLive } from './planRail'
import { policyFor } from './lessonPolicy'
import type { LessonRun } from './lessonRun'

const run: LessonRun = {
  phase: 'teaching', pace: 'step', currentStep: 0, beats: 0, awaiting: false,
  steps: [
    { id: 'a', title: 'Atoms', goal: 'g', status: 'teaching', cardIds: [] },
    { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [],
      lockedBy: { subtopicId: 7, accuracy: 38 } },
    { id: 'c', title: 'Shapes', goal: 'g', status: 'pending', cardIds: [] },
    { id: 'd', title: 'Naming', goal: 'g', status: 'known', cardIds: [] },
  ],
}

const GAP = policyFor('gap')
// Homework: permissive about measured gaps, but it still offers test-out —
// it is work the learner has already attempted, so "I know this" is a claim
// worth testing. `scratch` deliberately hides the control (see SCRATCH below).
const OPEN = policyFor('homework')
const SCRATCH = policyFor('scratch')

describe('railSteps', () => {
  it('shows the measurement on a locked step whichever policy applies', () => {
    // Information either way; only what it does differs.
    expect(railSteps(run, GAP)[1].measured).toBe(38)
    expect(railSteps(run, OPEN)[1].measured).toBe(38)
  })

  it('offers no test-out on a locked step in a gap lesson', () => {
    expect(railSteps(run, GAP)[1].canTestOut).toBe(false)
  })

  it('offers test-out on the same step in an open lesson', () => {
    // Same step, same measurement, different policy.
    expect(railSteps(run, OPEN)[1].canTestOut).toBe(true)
  })

  it('offers test-out on an unlocked pending step under either policy', () => {
    expect(railSteps(run, GAP)[2].canTestOut).toBe(true)
    expect(railSteps(run, OPEN)[2].canTestOut).toBe(true)
  })

  it('never offers test-out on the step being taught', () => {
    expect(railSteps(run, GAP)[0].canTestOut).toBe(false)
  })

  it('never offers test-out on a step already settled', () => {
    expect(railSteps(run, OPEN)[3].canTestOut).toBe(false)
  })

  it('marks which step is current', () => {
    expect(railSteps(run, GAP).map((r) => r.current)).toEqual([true, false, false, false])
  })

  it('returns nothing for a lesson with no run yet', () => {
    expect(railSteps(null, OPEN)).toEqual([])
  })
})

describe('lockedReason', () => {
  it('says why a locked step cannot be tested out of', () => {
    // Showing a percentage and silently omitting the button reads as the
    // control being missing rather than withheld.
    const [, bonding] = railSteps(run, policyFor('gap'))
    expect(bonding.lockedReason).toContain('38%')
    expect(bonding.canTestOut).toBe(false)
  })

  it('explains nothing in an open lesson, where the step is not withheld', () => {
    const [, bonding] = railSteps(run, OPEN)
    expect(bonding.lockedReason).toBeNull()
    expect(bonding.canTestOut).toBe(true)
  })

  it('explains nothing on a step with no measurement', () => {
    const [, , shapes] = railSteps(run, policyFor('gap'))
    expect(shapes.lockedReason).toBeNull()
  })
})

/**
 * A plan still being negotiated is a preview, not a control panel.
 *
 * Both transitions the rail drives refuse during planning, so offering the
 * buttons would mean offering controls that exist only to be refused.
 */
describe('the rail while a plan is still being agreed', () => {
  const planning: LessonRun = { ...run, phase: 'planning', currentStep: -1 }

  it('offers nothing to test out of', () => {
    expect(railSteps(planning, OPEN).some((r) => r.canTestOut)).toBe(false)
    // The same steps are testable once the lesson is running.
    expect(railSteps(run, OPEN).some((r) => r.canTestOut)).toBe(true)
  })

  it('still lists the steps, because the plan is the thing being decided', () => {
    expect(railSteps(planning, OPEN)).toHaveLength(4)
    expect(railSteps(planning, OPEN)[0].title).toBe('Atoms')
  })

  it('offers no test-out on a lesson the learner started themselves', () => {
    // They typed the topic because they wanted to learn it; offering to skip
    // every step of it reads as the tutor doubting the request.
    expect(railSteps(run, SCRATCH).some((r) => r.canTestOut)).toBe(false)
    expect(railSteps(run, OPEN).some((r) => r.canTestOut)).toBe(true)
  })

  it('reports itself as not live', () => {
    expect(railIsLive(planning)).toBe(false)
    expect(railIsLive(run)).toBe(true)
    expect(railIsLive(null)).toBe(false)
  })
})
