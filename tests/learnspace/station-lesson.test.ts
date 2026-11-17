import { describe, it, expect } from 'vitest'
import {
  acceptPlan, beginCheck, emptyRun, failCheck, nextBeat, passCheck, proposePlan, requestTestOut, skipStep, editPlan, stageOf,
  type LessonRun, type LessonStep,
} from '@/lib/studylab/lessonRun'
import { POLICIES } from '@/lib/studylab/lessonPolicy'

function step(id: string, title: string, extra: Partial<LessonStep> = {}): LessonStep {
  return { id, title, goal: title, status: 'pending', cardIds: [], ...extra }
}

function go(run: LessonRun, transition: { ok: true; run: LessonRun } | { ok: false; reason: string }): LessonRun {
  if (!transition.ok) throw new Error(transition.reason)
  return transition.run
}

describe('a station lesson, from the plan to the end', () => {
  it('walks explore, name, practice and check, and a second miss goes back to naming it', () => {
    let run = go(emptyRun(POLICIES.scratch), proposePlan(emptyRun(POLICIES.scratch), [step('s1', 'Demand'), step('s2', 'Supply')]))
    expect(run.phase).toBe('planning')
    expect(acceptPlan(run).ok).toBe(true)
    run = go(run, acceptPlan(run))
    expect(acceptPlan(run).ok).toBe(false)
    expect(run.recipe).toBe('station')
    expect(stageOf(run)).toBe('explore')

    run = go(run, nextBeat(run))
    expect(stageOf(run)).toBe('name')
    run = go(run, nextBeat(run))
    expect(stageOf(run)).toBe('practice')

    run = go(run, beginCheck(run, 's1', 'c1', 'checkpoint', 'hard'))
    expect(stageOf(run)).toBe('check')
    expect(nextBeat(run).ok).toBe(false)

    run = go(run, failCheck(run, ['the slope']))
    expect(stageOf(run)).toBe('practice')
    expect(run.stationMisses).toBe(1)

    run = go(run, beginCheck(run, 's1', 'c2', 'checkpoint', 'hard'))
    run = go(run, failCheck(run, ['the slope']))
    expect(stageOf(run)).toBe('name')
    expect(run.stationMisses).toBe(2)

    run = go(run, beginCheck(run, 's1', 'c3', 'checkpoint', 'hard'))
    run = go(run, passCheck(run))
    expect(run.steps[0].status).toBe('done')
    expect(run.currentStep).toBe(1)
    expect(stageOf(run)).toBe('explore')
    expect(run.stationMisses).toBeUndefined()

    run = go(run, beginCheck(run, 's2', 'c4', 'checkpoint', 'hard'))
    run = go(run, passCheck(run))
    expect(run.phase).toBe('done')
    expect(run.currentStep).toBe(-1)
  })

  it('a homework question is not given a stage, and a typed lesson cannot be tested out of', () => {
    const planned = go(emptyRun(POLICIES.homework), proposePlan(emptyRun(POLICIES.homework), [step('h1', 'Question 1', { homework: { label: '1', answer: null, rubric: null, attempt: 'I wrote this' } })]))
    const started = go(planned, acceptPlan(planned))
    expect(started.recipe).toBe('station')
    expect(stageOf(started)).toBeNull()

    const scratch = go(emptyRun(POLICIES.scratch), proposePlan(emptyRun(POLICIES.scratch), [step('s1', 'Demand')]))
    const teaching = go(scratch, acceptPlan(scratch))
    expect(requestTestOut(teaching, 's1', 'to-s1', POLICIES.scratch).ok).toBe(false)
  })

  it('a gap lesson will not drop the step it was opened to fix', () => {
    const weak = step('s1', 'Quadratics', { lockedBy: { subtopicId: 9, accuracy: 32 } })
    const planned = go(emptyRun(POLICIES.gap), proposePlan(emptyRun(POLICIES.gap), [weak, step('s2', 'Factorising')]))
    expect(editPlan(planned, { remove: ['s1'] }, POLICIES.gap).ok).toBe(false)
    const teaching = go(planned, acceptPlan(planned))
    expect(skipStep(teaching, 's1', POLICIES.gap).ok).toBe(false)
    expect(requestTestOut(teaching, 's1', 'to-s1', POLICIES.gap).ok).toBe(false)
  })

  it('passing a test-out marks the step known and stays on the station in hand', () => {
    const planned = go(emptyRun(POLICIES.gap), proposePlan(emptyRun(POLICIES.gap), [step('s1', 'Demand'), step('s2', 'Supply')]))
    let run = go(planned, acceptPlan(planned))
    run = go(run, requestTestOut(run, 's2', 'to-s2', POLICIES.gap))
    expect(stageOf(run)).toBe('explore')
    run = go(run, passCheck(run))
    expect(run.steps[1].status).toBe('known')
    expect(run.currentStep).toBe(0)
    expect(run.phase).toBe('teaching')
  })
})
