// lib/studylab/trail/action.test.ts
import { describe, it, expect } from 'vitest'
import type { LessonRun, Stage } from '../lessonRun'
import type { ContinueTarget, DockView } from '../spotlight'
import { interludeFrom, trailAction, trailContinue } from './action'

const steps = (statuses: string[]) => statuses.map((status, i) => ({ id: `s${i}`, title: `S${i}`, goal: '', status, cardIds: [] }))
const run = (over: object) => ({ phase: 'teaching', pace: 'step', recipe: 'station', currentStep: 0, beats: 0, awaiting: false, steps: steps(['teaching', 'pending', 'pending']), ...over }) as unknown as LessonRun
const teachingAt = (stage: Stage) => run({ stage })
const atStep = (i: number, status: string) => run({ currentStep: i, steps: steps(['done', status, 'pending', 'pending']) })
const atStepDone = (done: number, next: number) => run({ currentStep: next, steps: steps(['done', 'done', 'teaching', 'pending']).map((s, i) => (i === done ? { ...s, status: 'done' } : s)) })
const finished = () => run({ phase: 'done', currentStep: -1, steps: steps(['done', 'done', 'done', 'done']) })
const flow = { nodes: [], run: teachingAt('name'), busy: false }

const cont = (target: ContinueTarget) => ({ kind: 'continue', target }) as DockView
const base = { view: { kind: 'none' } as DockView, claimed: false, run: teachingAt('name'), focusType: 'concept' as string | null, nextInQueue: null as string | null, interlude: null, lookBack: null, detourFooter: false }

describe('trailAction', () => {
  it('a read-only card with more waiting says Got it, and goes to the next card', () => {
    const a = trailAction({ ...base, nextInQueue: 'b', view: cont({ kind: 'advance', label: 'Continue' }) })
    expect(a).toMatchObject({ label: 'Got it', target: { kind: 'focus', nodeId: 'b' } })
  })
  it('a card with something to do, and more waiting, says Continue', () => {
    expect(trailAction({ ...base, focusType: 'activity', nextInQueue: 'b', view: cont({ kind: 'advance', label: 'Continue' }) })).toMatchObject({ label: 'Continue', target: { kind: 'focus', nodeId: 'b' } })
  })
  it('Got it needs no tutor: it works while a turn is in flight', () => {
    expect(trailAction({ ...base, nextInQueue: 'b', view: { kind: 'working', label: 'x' } })).toMatchObject({ label: 'Got it' })
  })
  it('with the queue empty it falls back to the usual target and label', () => {
    expect(trailAction({ ...base, view: cont({ kind: 'advance', label: "I've tried it" }) })).toMatchObject({ label: "I've tried it" })
    expect(trailAction({ ...base, view: cont({ kind: 'handIn', label: 'Hand in', hint: '' }) })).toMatchObject({ label: 'Hand in' })
    expect(trailAction({ ...base, view: cont({ kind: 'finish', label: 'Finish lesson' }) })).toMatchObject({ label: 'Finish lesson' })
  })
  it('advancing from the check stage finishes the station', () => {
    expect(trailAction({ ...base, run: teachingAt('check'), view: cont({ kind: 'advance', label: 'Continue' }) })).toMatchObject({ label: 'Finish station' })
  })
  it('a card with its bar in the dock owns the button', () => {
    expect(trailAction({ ...base, claimed: true, view: cont({ kind: 'advance', label: 'Continue' }) })).toEqual({ kind: 'bar' })
  })
  it('after a station, the button goes to the next, numbered from 1', () => {
    expect(trailAction({ ...base, interlude: { done: 1, next: 2 } })).toEqual({ kind: 'goToStation', label: 'Go to station 3', station: 2 })
  })
  it('working says nothing itself: the bubble does', () => {
    expect(trailAction({ ...base, view: { kind: 'working', label: 'Thinking' } })).toEqual({ kind: 'working' })
  })
  it('a finished lesson offers its summary', () => {
    expect(trailAction({ ...base, view: { kind: 'done' } })).toEqual({ kind: 'summary' })
  })
  it('Start is the button while planning with a plan; drafting and redrafting offer none', () => {
    const planningWith = (n: number) => run({ phase: 'planning', currentStep: -1, steps: steps(Array.from({ length: n }, () => 'pending')) })
    expect(trailAction({ ...base, run: planningWith(5), view: { kind: 'none' } })).toEqual({ kind: 'start' })
    expect(trailAction({ ...base, run: planningWith(0), view: { kind: 'none' } })).toEqual({ kind: 'none' })
    expect(trailAction({ ...base, run: planningWith(5), view: { kind: 'working', label: 'Drafting' } })).toEqual({ kind: 'working' })
    expect(trailAction({ ...base, run: planningWith(5), view: { kind: 'retry', label: 'Try again' } })).toEqual({ kind: 'retry', label: 'Try again' })
  })
  it('nothing to press is nothing to press', () => {
    expect(trailAction(base)).toEqual({ kind: 'none' })
  })
  it('a failed turn comes first, even with a queue, a card bar or the detour footer', () => {
    const retry = { kind: 'retry', label: 'Try again' } as DockView
    expect(trailAction({ ...base, claimed: true, nextInQueue: 'b', view: retry })).toEqual({ kind: 'retry', label: 'Try again' })
    expect(trailAction({ ...base, detourFooter: true, view: retry })).toEqual({ kind: 'retry', label: 'Try again' })
  })
  it('looking back owns the button, whatever the lesson is doing', () => {
    expect(trailAction({ ...base, view: { kind: 'working', label: 'x' }, lookBack: { canRetry: true } })).toEqual({ kind: 'tryAgain', label: 'Try it again' })
    expect(trailAction({ ...base, view: cont({ kind: 'advance', label: 'Continue' }), lookBack: { canRetry: false } })).toEqual({ kind: 'none' })
  })
  it('the detour footer replaces the button', () => {
    expect(trailAction({ ...base, view: cont({ kind: 'advance', label: 'Continue' }), detourFooter: true })).toEqual({ kind: 'none' })
  })
})

describe('trailContinue', () => {
  it('a card with a bar and more waiting: its Continue steps the queue, not the lesson', () => {
    expect(trailContinue('a', flow, 'b')).toMatchObject({ kind: 'focus', nodeId: 'b', label: 'Continue' })
  })
  it('with nothing waiting it means what it always meant', () => {
    expect(trailContinue('a', flow, null)).toMatchObject({ kind: 'advance' })
    expect(trailContinue('a', { ...flow, busy: true }, null)).toBeNull()
  })
})

describe('interludeFrom', () => {
  it('a station settling teaches an interlude; a reload does not', () => {
    expect(interludeFrom(atStep(1, 'teaching'), atStepDone(1, 2))).toEqual({ done: 1, next: 2 })
    expect(interludeFrom(null, atStepDone(1, 2))).toBeNull()
    expect(interludeFrom(atStep(1, 'teaching'), finished())).toBeNull()
  })
  it('a change with no station settling is no interlude', () => {
    expect(interludeFrom(atStep(1, 'teaching'), atStep(1, 'teaching'))).toBeNull()
  })
})
