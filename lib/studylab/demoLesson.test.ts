// lib/studylab/demoLesson.test.ts
import { describe, it, expect } from 'vitest'
import {
  DEMO_STEPS,
  DEMO_PLAN_QUESTIONS,
  demoBeat,
  demoBeatCount,
  demoCheck,
  demoCheckpointId,
  demoCue,
} from './demoLesson'
import { emptyRun, proposePlan, acceptPlan, beginCheck, type LessonRun } from './lessonRun'
import { policyFor } from './lessonPolicy'
import { isValidQuestion } from './quiz'
import { applyActions } from './actions'
import type { CanvasState } from './types'

const POLICY = policyFor('scratch')

function started(): LessonRun {
  const planned = proposePlan(emptyRun(POLICY), DEMO_STEPS)
  if (!planned.ok) throw new Error(planned.reason)
  const run = acceptPlan(planned.run)
  if (!run.ok) throw new Error(run.reason)
  return run.run
}

describe('the demo script', () => {
  it('has a beat for every step, and the same shape throughout', () => {
    for (const step of DEMO_STEPS) {
      expect(demoBeatCount(step.id), `${step.id} has no beats`).toBeGreaterThan(0)
      for (let i = 0; i < demoBeatCount(step.id); i += 1) {
        const beat = demoBeat(step.id, i)
        expect(beat, `${step.id} beat ${i}`).not.toBeNull()
        expect(beat!.say.length).toBeGreaterThan(0)
        expect(beat!.actions.length).toBeGreaterThan(0)
      }
    }
  })

  it('runs out of beats rather than repeating the last one', () => {
    expect(demoBeat('d1', demoBeatCount('d1'))).toBeNull()
    expect(demoBeat('nope', 0)).toBeNull()
  })

  it('closes every step with a check the canvas can render', () => {
    DEMO_STEPS.forEach((step, i) => {
      const cp = demoCheck(step.id, i + 1) as { questions: unknown[]; gate: string } | null
      expect(cp, `${step.id} has no check`).not.toBeNull()
      expect(cp!.gate).toBe('hard')
      expect(cp!.questions.length).toBeGreaterThan(0)
      // The same predicate the real reducer uses: a demo that renders a broken
      // question teaches the learner that checks are broken.
      expect(cp!.questions.every(isValidQuestion)).toBe(true)
    })
  })

  it('gives every check a distinct id', () => {
    const ids = DEMO_STEPS.map((s) => demoCheckpointId(s.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(Boolean)).toBe(true)
  })

  it('produces a board the real reducer accepts, with nothing dropped', () => {
    let canvas: CanvasState = { nodes: [], edges: [] }
    let created = 0
    for (const step of DEMO_STEPS) {
      for (let i = 0; i < demoBeatCount(step.id); i += 1) {
        const beat = demoBeat(step.id, i)!
        created += beat.actions.filter((a) => a.type === 'createCard').length
        const applied = applyActions(canvas, beat.actions)
        canvas = { ...canvas, nodes: applied.nodes, edges: applied.edges }
      }
    }
    // Every card asked for is a card on the board: no duplicate ids, no
    // duplicate titles silently swallowed.
    expect(canvas.nodes.filter((n) => n.data.title)).toHaveLength(created)
    expect(canvas.edges.length).toBeGreaterThan(0)
  })

  it('stamps each card with the step it belongs to', () => {
    DEMO_STEPS.forEach((step, i) => {
      for (let b = 0; b < demoBeatCount(step.id); b += 1) {
        for (const action of demoBeat(step.id, b)!.actions) {
          if (action.type === 'createCard') expect(action.step).toBe(i + 1)
        }
      }
    })
  })

  it('asks something on the plan card, so the negotiation is shown at all', () => {
    expect(DEMO_PLAN_QUESTIONS.length).toBeGreaterThan(0)
  })
})

describe('demoCue', () => {
  it('tells a learner staring at the plan what to do', () => {
    const planned = proposePlan(emptyRun(POLICY), DEMO_STEPS)
    if (!planned.ok) throw new Error(planned.reason)
    const cue = demoCue(planned.run, { checkOpen: false })
    expect(cue.action).toContain('Looks good, start')
  })

  it('points at Continue on a step that has not been taught yet', () => {
    const cue = demoCue(started(), { checkOpen: false })
    expect(cue.action).toContain('Continue')
    expect(cue.anchor).toBe('lesson-continue')
  })

  it('drops everything else while a check is open', () => {
    // A cue telling them to explore while Continue is blocked would be a cue
    // that gets them stuck.
    const run = started()
    const open = beginCheck(run, 'd1', 'demo-cp-1', 'checkpoint', 'hard')
    if (!open.ok) throw new Error(open.reason)
    const cue = demoCue(open.run, { checkOpen: true })
    expect(cue.action).toContain('Answer the check')
  })

  it('closes on an invitation to start something real', () => {
    const cue = demoCue({ ...started(), phase: 'done' }, { checkOpen: false })
    expect(cue.action).toContain('start a real one')
  })

  it('always gives one action and a reason, whatever the state', () => {
    // The thing the demo exists to fix is a workspace that explains nothing,
    // so there is no state in which it goes quiet.
    const states: LessonRun[] = [
      started(),
      { ...started(), beats: 2 },
      { ...started(), currentStep: 1, beats: 1 },
      { ...started(), currentStep: 2, beats: 1 },
      { ...started(), phase: 'done' },
    ]
    for (const run of states) {
      const cue = demoCue(run, { checkOpen: false })
      expect(cue.action.length).toBeGreaterThan(0)
      expect(cue.why.length).toBeGreaterThan(30)
    }
  })
})
