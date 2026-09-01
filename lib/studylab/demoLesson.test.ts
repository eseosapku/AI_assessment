// lib/studylab/demoLesson.test.ts
import { describe, it, expect } from 'vitest'
import {
  DEMO_ACTS,
  DEMO_STEPS,
  DEMO_PLAN_QUESTIONS,
  actAt,
  isFinished,
  cueAt,
  suggestionsAt,
  type DemoTrigger,
} from './demoLesson'
import { isValidQuestion } from './quiz'
import { applyActions } from './actions'
import type { CanvasState } from './types'

describe('the demo script', () => {
  it('opens on accepting the plan — the first thing a real lesson asks for', () => {
    expect(DEMO_ACTS[0].expect).toBe('accept-plan')
  })

  it('gives every act a cue with an action and a reason', () => {
    // A tutorial that shows a workspace and says nothing is the thing this
    // exists to fix, so there is no act without an instruction.
    DEMO_ACTS.forEach((act, i) => {
      expect(act.cue.action.length, `act ${i} has no action`).toBeGreaterThan(0)
      expect(act.cue.why.length, `act ${i}: "${act.cue.action}" has no reason`).toBeGreaterThan(30)
    })
  })

  it('covers every way of driving a lesson', () => {
    // The point of a scripted demo is that nothing is left to chance: if a
    // control is not exercised here, nobody is taught it exists.
    const used = new Set(DEMO_ACTS.map((a) => a.expect))
    const expected: DemoTrigger[] = [
      'accept-plan', 'continue', 'chip', 'ask', 'card-menu',
      'answer-check', 'set-pace', 'jump', 'add-block',
    ]
    for (const trigger of expected) {
      expect(used.has(trigger), `nothing in the demo exercises "${trigger}"`).toBe(true)
    }
  })

  it('walks all three steps, in order', () => {
    const steps = [...new Set(DEMO_ACTS.map((a) => a.step))]
    expect(steps).toEqual([1, 2, 3])
    expect(DEMO_STEPS).toHaveLength(3)
  })

  it('ends every step with a check that is answered before moving on', () => {
    for (const step of [1, 2, 3]) {
      const acts = DEMO_ACTS.filter((a) => a.step === step)
      const opens = acts.filter((a) => a.opensCheck)
      const answers = acts.filter((a) => a.expect === 'answer-check')
      expect(opens, `step ${step} opens no check`).toHaveLength(1)
      expect(answers, `step ${step} never answers its check`).toHaveLength(1)
      // The check has to be opened before it can be answered.
      expect(acts.indexOf(opens[0])).toBeLessThan(acts.indexOf(answers[0]))
      expect(answers[0].completesStep).toBe(true)
    }
  })

  it('writes checks the canvas can actually render', () => {
    for (const act of DEMO_ACTS) {
      for (const action of act.actions ?? []) {
        if (action.type !== 'checkpoint') continue
        expect(action.questions.length).toBeGreaterThan(0)
        // The same predicate the real reducer uses: a demo that renders a
        // broken question teaches that checks are broken.
        expect(action.questions.every(isValidQuestion)).toBe(true)
      }
    }
  })

  it('offers a chip before the act that asks for one', () => {
    const chipAct = DEMO_ACTS.findIndex((a) => a.expect === 'chip')
    expect(chipAct).toBeGreaterThan(0)
    const offered = suggestionsAt(chipAct)
    expect(offered.length).toBeGreaterThan(0)
    // The cue names a chip, so that chip has to be on offer.
    expect(DEMO_ACTS[chipAct].cue.action).toContain(offered[0])
  })

  it('pre-writes the question for the act that asks one to be sent', () => {
    const ask = DEMO_ACTS.find((a) => a.expect === 'ask')
    expect(ask?.compose, 'the ask act has no composed question').toBeTruthy()
    expect(ask!.compose!.length).toBeGreaterThan(10)
  })

  it('only rewrites cards that exist by the time it rewrites them', () => {
    const created = new Set<string>()
    for (const act of DEMO_ACTS) {
      for (const action of act.actions ?? []) {
        if (action.type === 'createCard') created.add(action.id)
        if (action.type === 'updateCard') {
          expect(created.has(action.id), `updateCard "${action.id}" before it is created`).toBe(true)
        }
        if (action.type === 'connect') {
          expect(created.has(action.from), `connect from unknown "${action.from}"`).toBe(true)
          expect(created.has(action.to), `connect to unknown "${action.to}"`).toBe(true)
        }
      }
    }
  })

  it('stamps every card with the step its act belongs to', () => {
    for (const act of DEMO_ACTS) {
      for (const action of act.actions ?? []) {
        if (action.type === 'createCard') expect(action.step).toBe(act.step)
        if (action.type === 'checkpoint') expect(action.step).toBe(act.step)
      }
    }
  })

  it('builds a board the real reducer accepts, with nothing silently dropped', () => {
    let canvas: CanvasState = { nodes: [], edges: [] }
    let created = 0
    for (const act of DEMO_ACTS) {
      if (!act.actions) continue
      created += act.actions.filter((a) => a.type === 'createCard').length
      const applied = applyActions(canvas, act.actions)
      canvas = { ...canvas, nodes: applied.nodes, edges: applied.edges }
    }
    const cards = canvas.nodes.filter(
      (n) => n.type !== 'quiz' && n.type !== 'checkpointHeader' && n.data.title,
    )
    expect(cards).toHaveLength(created)
    expect(canvas.edges.length).toBeGreaterThan(0)
  })

  it('asks something on the plan card, so the negotiation is shown at all', () => {
    expect(DEMO_PLAN_QUESTIONS.length).toBeGreaterThan(0)
  })
})

describe('act lookup', () => {
  it('reports the act in hand and knows when there is none left', () => {
    expect(actAt(0)?.expect).toBe('accept-plan')
    expect(isFinished(0)).toBe(false)
    expect(actAt(DEMO_ACTS.length)).toBeUndefined()
    expect(isFinished(DEMO_ACTS.length)).toBe(true)
  })

  it('still answers "what now?" once the demo is over', () => {
    const cue = cueAt(DEMO_ACTS.length)
    expect(cue.action.length).toBeGreaterThan(0)
    expect(cue.why.length).toBeGreaterThan(30)
  })
})
