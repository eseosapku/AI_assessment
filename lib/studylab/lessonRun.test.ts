// lib/studylab/lessonRun.test.ts
import { describe, it, expect } from 'vitest'
import { policyFor } from './lessonPolicy'
import {
  emptyRun, proposePlan, acceptPlan, editPlan, nextBeat, beginCheck,
  passCheck, failCheck, requestTestOut, skipStep, jumpTo, setPace, stop, finish,
  type LessonRun, type LessonStep,
} from './lessonRun'

const GAP = policyFor('gap')
// Permissive about measured gaps, and still offers test-out. `scratch` is the
// one origin that hides it: a lesson someone started by naming what they
// wanted to learn should not offer to skip every step of it.
const OPEN = policyFor('homework')

const step = (id: string, over?: Partial<LessonStep>): LessonStep => ({
  id, title: `Step ${id}`, goal: `goal ${id}`, status: 'pending', cardIds: [], ...over,
})

/** A run mid-lesson: three steps, teaching the first. */
function teaching(policy = GAP, steps?: LessonStep[]): LessonRun {
  const planned = proposePlan(emptyRun(policy), steps ?? [step('a'), step('b'), step('c')])
  if (!planned.ok) throw new Error(planned.reason)
  const started = acceptPlan(planned.run)
  if (!started.ok) throw new Error(started.reason)
  return started.run
}

const unwrap = (t: ReturnType<typeof nextBeat>): LessonRun => {
  if (!t.ok) throw new Error(`expected ok, got refusal: ${t.reason}`)
  return t.run
}

describe('emptyRun', () => {
  it('opens in planning with nothing built and no step current', () => {
    const run = emptyRun(GAP)
    expect(run.phase).toBe('planning')
    expect(run.steps).toEqual([])
    expect(run.currentStep).toBe(-1)
  })

  it('takes its starting pace from the policy', () => {
    // Remediation opens step-by-step; browsing a topic opens running.
    expect(emptyRun(GAP).pace).toBe('step')
    expect(emptyRun(OPEN).pace).toBe('run')
  })
})

describe('acceptPlan', () => {
  it('starts teaching the first step', () => {
    const run = teaching()
    expect(run.phase).toBe('teaching')
    expect(run.currentStep).toBe(0)
    expect(run.steps[0].status).toBe('teaching')
  })

  it('skips over steps already marked known', () => {
    const planned = unwrap(proposePlan(emptyRun(OPEN), [step('a', { status: 'known' }), step('b')]))
    const run = unwrap(acceptPlan(planned))
    expect(run.currentStep).toBe(1)
  })

  it('refuses an empty plan', () => {
    const t = acceptPlan(emptyRun(GAP))
    expect(t.ok).toBe(false)
  })
})

describe('skipStep', () => {
  it('refuses to skip a step over a measured gap in a gap lesson', () => {
    // The guarantee this whole design exists for.
    const run = teaching(GAP, [
      step('a'), step('b', { lockedBy: { subtopicId: 7, accuracy: 38 } }),
    ])
    const t = skipStep(run, 'b', GAP)
    expect(t.ok).toBe(false)
    if (!t.ok) expect(t.reason).toContain('38')
  })

  it('allows the same skip in an open lesson', () => {
    // Same code, same locked step, different policy. Information, not permission.
    const run = teaching(OPEN, [
      step('a'), step('b', { lockedBy: { subtopicId: 7, accuracy: 38 } }),
    ])
    const t = skipStep(run, 'b', OPEN)
    expect(t.ok).toBe(true)
    if (t.ok) expect(t.run.steps[1].status).toBe('known')
  })

  it('refuses a step id that is not in the plan', () => {
    expect(skipStep(teaching(), 'nope', GAP).ok).toBe(false)
  })

  it('moves teaching along when the skipped step was the current one', () => {
    const run = unwrap(skipStep(teaching(OPEN), 'a', OPEN))
    expect(run.steps[0].status).toBe('known')
    expect(run.currentStep).toBe(1)
    expect(run.steps[1].status).toBe('teaching')
  })
})

describe('requestTestOut', () => {
  it('opens a check on a later step without moving teaching', () => {
    // The reason openCheck names its own step: testing out of step 3 must not
    // disturb the fact that step 1 is being taught.
    const run = unwrap(requestTestOut(teaching(OPEN), 'c', 'cp-1', OPEN))
    expect(run.openCheck).toMatchObject({ stepId: 'c', kind: 'testout' })
    expect(run.currentStep).toBe(0)
    expect(run.steps[0].status).toBe('teaching')
  })

  it('refuses on a locked step under a gap policy', () => {
    const run = teaching(GAP, [step('a'), step('b', { lockedBy: { subtopicId: 7, accuracy: 38 } })])
    expect(requestTestOut(run, 'b', 'cp-1', GAP).ok).toBe(false)
  })

  it('refuses while another check is already open', () => {
    const run = unwrap(requestTestOut(teaching(OPEN), 'c', 'cp-1', OPEN))
    expect(requestTestOut(run, 'b', 'cp-2', OPEN).ok).toBe(false)
  })
})

describe('passCheck', () => {
  it('marks a tested-out step known and leaves teaching where it was', () => {
    const run = unwrap(passCheck(unwrap(requestTestOut(teaching(OPEN), 'c', 'cp-1', OPEN))))
    expect(run.steps[2].status).toBe('known')
    expect(run.currentStep).toBe(0)
    expect(run.openCheck).toBeUndefined()
  })

  it('marks a checkpoint step done and advances', () => {
    const run = unwrap(passCheck(unwrap(beginCheck(teaching(), 'a', 'cp-1', 'checkpoint', 'hard'))))
    expect(run.steps[0].status).toBe('done')
    expect(run.currentStep).toBe(1)
    expect(run.steps[1].status).toBe('teaching')
  })

  it('refuses when no check is open', () => {
    expect(passCheck(teaching()).ok).toBe(false)
  })
})

describe('failCheck', () => {
  it('turns a failed test-out into teaching that step', () => {
    // Better than not trying: the lesson narrows to what was actually missed.
    const run = unwrap(failCheck(unwrap(requestTestOut(teaching(OPEN), 'c', 'cp-1', OPEN)), ['q2']))
    expect(run.steps[2].status).toBe('teaching')
    expect(run.currentStep).toBe(2)
    expect(run.openCheck).toBeUndefined()
  })
})

describe('nextBeat', () => {
  it('counts beats on the current step', () => {
    expect(unwrap(nextBeat(teaching())).beats).toBe(1)
    expect(unwrap(nextBeat(unwrap(nextBeat(teaching())))).beats).toBe(2)
  })

  it('refuses while a hard check is open', () => {
    const run = unwrap(beginCheck(teaching(), 'a', 'cp-1', 'checkpoint', 'hard'))
    expect(nextBeat(run).ok).toBe(false)
  })

  it('allows a beat while only a soft check is open', () => {
    const run = unwrap(beginCheck(teaching(), 'a', 'cp-1', 'checkpoint', 'soft'))
    expect(nextBeat(run).ok).toBe(true)
  })
})

describe('editPlan', () => {
  it('refuses to restructure a gap lesson once teaching has started', () => {
    expect(editPlan(teaching(GAP), { add: [step('d')] }, GAP).ok).toBe(false)
  })

  it('lets an open lesson change direction mid-lesson', () => {
    const run = unwrap(editPlan(teaching(OPEN), { add: [step('d')] }, OPEN))
    expect(run.steps).toHaveLength(4)
  })

  it('refuses to remove a locked step under a gap policy', () => {
    const planned = unwrap(proposePlan(emptyRun(GAP), [
      step('a'), step('b', { lockedBy: { subtopicId: 7, accuracy: 38 } }),
    ]))
    expect(editPlan(planned, { remove: ['b'] }, GAP).ok).toBe(false)
  })
})

describe('finish', () => {
  it('refuses a gap lesson with work outstanding', () => {
    expect(finish(teaching(GAP), GAP).ok).toBe(false)
  })

  it('lets an open lesson stop whenever the learner says', () => {
    // No obligation to complete something started out of curiosity.
    const t = finish(teaching(OPEN), OPEN)
    expect(t.ok).toBe(true)
    if (t.ok) expect(t.run.phase).toBe('done')
  })

  it('allows a gap lesson to finish once every step is settled', () => {
    let run = teaching(GAP)
    for (const s of run.steps) run = unwrap(skipStep(run, s.id, OPEN))
    expect(finish(run, GAP).ok).toBe(true)
  })
})

describe('invariants', () => {
  it('keeps exactly one step teaching while the phase is teaching', () => {
    const run = unwrap(nextBeat(teaching()))
    expect(run.steps.filter((s) => s.status === 'teaching')).toHaveLength(1)
    expect(run.steps[run.currentStep].status).toBe('teaching')
  })

  it('never lets a locked step reach known under a gap policy', () => {
    const run = teaching(GAP, [step('a', { lockedBy: { subtopicId: 7, accuracy: 12 } })])
    expect(skipStep(run, 'a', GAP).ok).toBe(false)
    expect(requestTestOut(run, 'a', 'cp-1', GAP).ok).toBe(false)
  })

  it('resets the beat count when the current step changes', () => {
    const busy = unwrap(nextBeat(unwrap(nextBeat(teaching(OPEN)))))
    expect(unwrap(skipStep(busy, 'a', OPEN)).beats).toBe(0)
  })
})

describe('setPace and stop', () => {
  it('changes pace without disturbing anything else', () => {
    const run = unwrap(setPace(teaching(GAP), 'run'))
    expect(run.pace).toBe('run')
    expect(run.currentStep).toBe(0)
  })

  it('marks the run as awaiting the learner', () => {
    expect(unwrap(stop(teaching())).awaiting).toBe(true)
  })
})

describe('jumpTo', () => {
  it('refuses to jump past an unfinished locked step in a gap lesson', () => {
    const run = teaching(GAP, [
      step('a', { lockedBy: { subtopicId: 7, accuracy: 20 } }), step('b'), step('c'),
    ])
    expect(jumpTo(run, 'c', GAP).ok).toBe(false)
  })

  it('allows the same jump in an open lesson', () => {
    const run = teaching(OPEN, [
      step('a', { lockedBy: { subtopicId: 7, accuracy: 20 } }), step('b'), step('c'),
    ])
    expect(jumpTo(run, 'c', OPEN).ok).toBe(true)
  })
})

/**
 * Navigating a plan nobody has agreed to.
 *
 * `jumpTo` set phase to 'teaching' unconditionally, so a click on the rail
 * started the lesson behind the plan card's back — while that card was still
 * asking which pace to use, and discarding the answer when it came.
 */
describe('the plan cannot be navigated before it is accepted', () => {
  const planning = (): LessonRun => {
    const proposed = proposePlan(emptyRun(policyFor('scratch')), [
      { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
      { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [] },
    ])
    if (!proposed.ok) throw new Error(proposed.reason)
    return proposed.run
  }

  it('refuses a jump, rather than silently starting the lesson', () => {
    const result = jumpTo(planning(), 'b', policyFor('scratch'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Start the lesson first')
  })

  it('refuses a test-out on a lesson that has not begun', () => {
    const result = requestTestOut(planning(), 'b', 'cp-1', policyFor('homework'))
    expect(result.ok).toBe(false)
  })

  it('allows both once the plan is accepted', () => {
    const started = acceptPlan(planning())
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(jumpTo(started.run, 'b', policyFor('scratch')).ok).toBe(true)
    expect(requestTestOut(started.run, 'b', 'cp-1', policyFor('homework')).ok).toBe(true)
  })
})

describe('test-out is only offered where something claims the learner might know it', () => {
  it('refuses on a lesson the learner started by naming a topic', () => {
    // The UI hides the control; this is the guarantee, since a stale client
    // can still send the action.
    const result = requestTestOut(teaching(policyFor('scratch')), 'c', 'cp-1', policyFor('scratch'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('yours to explore')
  })

  it('still allows it on homework and on a gap lesson', () => {
    expect(requestTestOut(teaching(policyFor('homework')), 'c', 'cp-1', policyFor('homework')).ok).toBe(true)
    expect(requestTestOut(teaching(GAP), 'c', 'cp-1', GAP).ok).toBe(true)
  })
})

/**
 * Revisiting a finished lesson is browsing it, not reopening it.
 *
 * `focus` marked whatever step you landed on as 'teaching', and `jumpTo` set
 * the phase to 'teaching' outright — so going back to re-read step 1 of a
 * completed lesson un-completed it, and the rail dropped from 5 of 5 to 4.
 */
describe('jumping back into a finished lesson', () => {
  const OPEN = policyFor('homework')

  const completed = (): LessonRun => {
    const proposed = proposePlan(emptyRun(OPEN), [
      { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
      { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [] },
    ])
    if (!proposed.ok) throw new Error(proposed.reason)
    const run = acceptPlan(proposed.run)
    if (!run.ok) throw new Error(run.reason)
    return {
      ...run.run,
      phase: 'done',
      currentStep: -1,
      steps: run.run.steps.map((s) => ({ ...s, status: 'done' as const })),
    }
  }

  it('leaves the lesson finished', () => {
    const jumped = jumpTo(completed(), 'a', OPEN)
    expect(jumped.ok).toBe(true)
    if (!jumped.ok) return
    expect(jumped.run.phase).toBe('done')
  })

  it('leaves the step you land on still done', () => {
    const jumped = jumpTo(completed(), 'a', OPEN)
    if (!jumped.ok) return
    expect(jumped.run.steps[0].status).toBe('done')
    expect(jumped.run.steps.every((s) => s.status === 'done')).toBe(true)
  })

  it('still moves the cursor, so the rail follows you', () => {
    const jumped = jumpTo(completed(), 'b', OPEN)
    if (!jumped.ok) return
    expect(jumped.run.currentStep).toBe(1)
  })

  it('does not settle a step that was never taught', () => {
    // The guard is "leave a settled step settled", not "settle whatever you
    // land on" — an untaught step still needs teaching when you arrive.
    const proposed = proposePlan(emptyRun(OPEN), [
      { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
      { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [] },
    ])
    if (!proposed.ok) return
    const started = acceptPlan(proposed.run)
    if (!started.ok) return
    const jumped = jumpTo(started.run, 'b', OPEN)
    if (!jumped.ok) return
    expect(jumped.run.steps[1].status).toBe('teaching')
    expect(jumped.run.phase).toBe('teaching')
  })
})

describe('finishing by doing the lesson', () => {
  const OPEN = policyFor('homework')

  it('reports done once the last check is passed', () => {
    // This used to leave the phase on 'teaching' with no current step: every
    // step ticked, Continue with nothing to advance to, and the completion
    // panel — carrying the quiz that moves the gap map — never appeared.
    const proposed = proposePlan(emptyRun(OPEN), [
      { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
    ])
    if (!proposed.ok) throw new Error(proposed.reason)
    const started = acceptPlan(proposed.run)
    if (!started.ok) throw new Error(started.reason)
    const open = beginCheck(started.run, 'a', 'cp-1', 'checkpoint', 'hard')
    if (!open.ok) throw new Error(open.reason)

    const passed = passCheck(open.run)
    expect(passed.ok).toBe(true)
    if (!passed.ok) return
    expect(passed.run.phase).toBe('done')
    expect(passed.run.currentStep).toBe(-1)
    expect(passed.run.steps[0].status).toBe('done')
  })

  it('keeps teaching while a step is still unsettled', () => {
    const proposed = proposePlan(emptyRun(OPEN), [
      { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
      { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [] },
    ])
    if (!proposed.ok) return
    const started = acceptPlan(proposed.run)
    if (!started.ok) return
    const open = beginCheck(started.run, 'a', 'cp-1', 'checkpoint', 'hard')
    if (!open.ok) return

    const passed = passCheck(open.run)
    if (!passed.ok) return
    expect(passed.run.phase).toBe('teaching')
    expect(passed.run.currentStep).toBe(1)
  })

  it('does not finish the lesson on a test-out', () => {
    // Testing out of the last step settles it, but the learner is still
    // somewhere earlier in the lesson.
    const proposed = proposePlan(emptyRun(OPEN), [
      { id: 'a', title: 'Atoms', goal: 'g', status: 'pending', cardIds: [] },
      { id: 'b', title: 'Bonding', goal: 'g', status: 'pending', cardIds: [] },
    ])
    if (!proposed.ok) return
    const started = acceptPlan(proposed.run)
    if (!started.ok) return
    const open = beginCheck(started.run, 'b', 'cp-b', 'testout', 'soft')
    if (!open.ok) return

    const passed = passCheck(open.run)
    if (!passed.ok) return
    expect(passed.run.steps[1].status).toBe('known')
    expect(passed.run.phase).toBe('teaching')
  })
})

/**
 * The lesson that could not be continued.
 *
 * Three checks stacked on one step, none answered, and moving to another step
 * changed nothing: the run still held the first one open, so Continue refused
 * for ever and the banner kept pointing back at a question belonging to a step
 * the learner had walked away from.
 */
describe('walking away from a check', () => {
  const OPEN = policyFor('homework')

  const midCheck = (): LessonRun => {
    const proposed = proposePlan(emptyRun(OPEN), [
      { id: 'a', title: 'One', goal: 'g', status: 'pending', cardIds: [] },
      { id: 'b', title: 'Two', goal: 'g', status: 'pending', cardIds: [] },
    ])
    if (!proposed.ok) throw new Error(proposed.reason)
    const started = acceptPlan(proposed.run)
    if (!started.ok) throw new Error(started.reason)
    const open = beginCheck(started.run, 'a', 'cp-a', 'checkpoint', 'hard')
    if (!open.ok) throw new Error(open.reason)
    return open.run
  }

  it('abandons the check when the learner moves to another step', () => {
    const jumped = jumpTo(midCheck(), 'b', OPEN)
    expect(jumped.ok).toBe(true)
    if (!jumped.ok) return
    expect(jumped.run.openCheck).toBeUndefined()
  })

  it('lets the lesson carry on afterwards', () => {
    const jumped = jumpTo(midCheck(), 'b', OPEN)
    if (!jumped.ok) return
    // This refused with "Finish the check first" for ever.
    expect(nextBeat(jumped.run).ok).toBe(true)
  })

  it('keeps the check when you land back on the step it belongs to', () => {
    // Clicking the step you are already on is not walking away from it.
    const jumped = jumpTo(midCheck(), 'a', OPEN)
    if (!jumped.ok) return
    expect(jumped.run.openCheck?.checkpointId).toBe('cp-a')
  })
})
