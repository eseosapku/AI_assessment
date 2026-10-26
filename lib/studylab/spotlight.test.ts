// lib/studylab/spotlight.test.ts
import { describe, it, expect } from 'vitest'
import { focusIds, continueFor, dockModel, focusFromTurn, viewportMoved, dockCandidate, takesArrivalFocus, cameraInsets, DOCK_LIFT_PHONE } from './spotlight'
import type { LessonRun, OpenCheck } from './lessonRun'
import type { QuizCell, StudyNode } from './types'

function run(over: Partial<LessonRun> = {}): LessonRun {
  return {
    phase: 'teaching',
    pace: 'step',
    steps: [
      { id: 's1', title: 'One', goal: 'g', status: 'teaching', cardIds: [] },
      { id: 's2', title: 'Two', goal: 'g', status: 'pending', cardIds: [] },
    ],
    currentStep: 0,
    beats: 1,
    awaiting: true,
    ...over,
  }
}

const open = (checkpointId: string, gate: OpenCheck['gate'] = 'hard'): OpenCheck => ({
  stepId: 's1', checkpointId, kind: 'checkpoint', gate,
})

const card = (id: string, step: number, extra: Partial<StudyNode> = {}): StudyNode => ({
  id, type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept', title: id, step }, ...extra,
})

const cell = (id: string, cp: string, state: QuizCell['state'] = 'unanswered', gate: QuizCell['gate'] = 'hard'): StudyNode => ({
  id,
  type: 'quiz',
  position: { x: 0, y: 0 },
  data: {
    kind: 'quiz',
    step: 1,
    quiz: { checkpointId: cp, gate, state, question: { id: `${id}-q`, format: 'mcq', prompt: 'p', options: ['a', 'b'], answer: 0 } },
  },
})

describe('focusIds', () => {
  it('has nothing in focus before teaching starts and after it ends', () => {
    const nodes = [card('a', 1)]
    expect(focusIds({ nodes, run: null, explicit: ['a'] })).toEqual([])
    expect(focusIds({ nodes, run: run({ phase: 'planning' }), explicit: ['a'] })).toEqual([])
    expect(focusIds({ nodes, run: run({ phase: 'done' }), explicit: ['a'] })).toEqual([])
  })

  it('follows what the last turn built, in order, dropping what is gone or folded', () => {
    const nodes = [
      card('a', 1),
      card('b', 1),
      card('gone', 1, { hidden: true }),
      { ...card('g', 1), type: 'stepGroup' as const },
    ]
    expect(focusIds({ nodes, run: run(), explicit: ['b', 'a', 'gone', 'g', 'missing'] })).toEqual(['b', 'a'])
  })

  it('goes to the first unanswered question of an open check after a reload', () => {
    const nodes = [card('a', 1), cell('q1', 'cp', 'correct'), cell('q2', 'cp'), cell('q3', 'cp')]
    expect(focusIds({ nodes, run: run({ openCheck: open('cp') }), explicit: [] })).toEqual(['q2'])
  })

  it('goes to the first question when every one of them is answered', () => {
    const nodes = [cell('q1', 'cp', 'correct'), cell('q2', 'cp', 'incorrect')]
    expect(focusIds({ nodes, run: run({ openCheck: open('cp') }), explicit: [] })).toEqual(['q1'])
  })

  it('otherwise takes the newest card of the step being taught', () => {
    const nodes = [card('a', 1), card('b', 1), card('c', 2), { ...card('mine', 1), source: 'freeform' as const }]
    expect(focusIds({ nodes, run: run(), explicit: [] })).toEqual(['b'])
    expect(focusIds({ nodes, run: run({ currentStep: 1 }), explicit: [] })).toEqual(['c'])
  })

  it('has nothing in focus when the step has no cards yet', () => {
    expect(focusIds({ nodes: [card('a', 1)], run: run({ currentStep: 1 }), explicit: [] })).toEqual([])
  })
})

describe('continueFor', () => {
  it('offers nothing while busy, without a run, or outside teaching', () => {
    const nodes = [card('a', 1)]
    expect(continueFor(null, { nodes, run: run(), busy: true })).toBeNull()
    expect(continueFor(null, { nodes, run: null, busy: false })).toBeNull()
    expect(continueFor(null, { nodes, run: run({ phase: 'planning' }), busy: false })).toBeNull()
    expect(continueFor(null, { nodes, run: run({ phase: 'done' }), busy: false })).toBeNull()
  })

  it('moves to the next unanswered question from an answered one', () => {
    const nodes = [cell('q1', 'cp', 'correct'), cell('q2', 'cp'), cell('q3', 'cp')]
    expect(continueFor('q1', { nodes, run: run({ openCheck: open('cp') }), busy: false })).toMatchObject({
      kind: 'focus', label: 'Next question', nodeId: 'q2',
    })
    // From an unanswered one, the next is another unanswered one, before or after.
    expect(continueFor('q3', { nodes, run: run({ openCheck: open('cp') }), busy: false })).toMatchObject({
      kind: 'focus', nodeId: 'q2',
    })
  })

  it('offers nothing to the only unanswered question -- its own Check is the way on', () => {
    const nodes = [cell('q1', 'cp', 'correct'), cell('q2', 'cp')]
    expect(continueFor('q2', { nodes, run: run({ openCheck: open('cp') }), busy: false })).toBeNull()
  })

  it('sends everything else to a gating check while it has questions left', () => {
    const one = [card('a', 1), cell('q1', 'cp')]
    expect(continueFor(null, { nodes: one, run: run({ openCheck: open('cp') }), busy: false })).toEqual({
      kind: 'focus', label: 'Go to the check', nodeId: 'q1', hint: 'Answer the check to go on',
    })
    const three = [card('a', 1), cell('q1', 'cp', 'correct'), cell('q2', 'cp'), cell('q3', 'cp')]
    expect(continueFor('a', { nodes: three, run: run({ openCheck: open('cp') }), busy: false })).toEqual({
      kind: 'focus', label: 'Go to the questions', nodeId: 'q2', hint: '2 of 3 questions still to answer',
    })
  })

  it('offers no Continue while a finished check is being handed in', () => {
    const nodes = [card('a', 1), cell('q1', 'cp', 'correct'), cell('q2', 'cp', 'incorrect')]
    expect(continueFor(null, { nodes, run: run({ openCheck: open('cp') }), busy: true })).toBeNull()
    expect(continueFor('q2', { nodes, run: run({ openCheck: open('cp') }), busy: true })).toBeNull()
  })

  it('offers to hand a finished check in when nothing is running -- the hand-in did not get through', () => {
    // A refused or failed hand-in left a settled check open with nothing to
    // press anywhere: the lesson was stuck.
    const nodes = [card('a', 1), cell('q1', 'cp', 'correct'), cell('q2', 'cp', 'incorrect')]
    const target = { kind: 'handIn', label: 'Hand in', hint: 'Your answers are in — hand them in' }
    expect(continueFor(null, { nodes, run: run({ openCheck: open('cp') }), busy: false })).toEqual(target)
    expect(continueFor('q2', { nodes, run: run({ openCheck: open('cp') }), busy: false })).toEqual(target)
  })

  it('never lets a soft check block the lesson', () => {
    const nodes = [card('a', 1), cell('q1', 'cp', 'unanswered', 'soft')]
    expect(continueFor(null, { nodes, run: run({ openCheck: open('cp', 'soft') }), busy: false })).toEqual({
      kind: 'advance', label: 'Continue',
    })
  })

  it('ignores the questions of a check that is no longer open', () => {
    const nodes = [card('a', 1), cell('old', 'cp-old')]
    expect(continueFor(null, { nodes, run: run(), busy: false })).toEqual({ kind: 'advance', label: 'Continue' })
  })

  it('finishes the lesson when no step is being taught', () => {
    expect(continueFor(null, { nodes: [], run: run({ currentStep: -1 }), busy: false })).toEqual({
      kind: 'finish', label: 'Finish lesson',
    })
  })
})

describe('dockModel', () => {
  const base = { nodes: [card('a', 1)], working: 'Building the next card…' }

  it('says the lesson is done once it is', () => {
    expect(dockModel({ ...base, run: run({ phase: 'done' }), busy: false })).toEqual({ kind: 'done' })
  })

  it('shows what the tutor is doing while a turn is in flight', () => {
    expect(dockModel({ ...base, run: run(), busy: true })).toEqual({ kind: 'working', label: 'Building the next card…' })
  })

  it('stays out of the way while the plan is agreed', () => {
    expect(dockModel({ ...base, run: null, busy: false })).toEqual({ kind: 'none' })
    expect(dockModel({ ...base, run: run({ phase: 'planning' }), busy: false })).toEqual({ kind: 'none' })
  })

  it('offers the lesson-level Continue, or the hand-in of a finished check', () => {
    expect(dockModel({ ...base, run: run(), busy: false })).toEqual({
      kind: 'continue', target: { kind: 'advance', label: 'Continue' },
    })
    const handedIn = [cell('q1', 'cp', 'correct')]
    expect(dockModel({ ...base, nodes: handedIn, run: run({ openCheck: open('cp') }), busy: false })).toMatchObject({
      kind: 'continue', target: { kind: 'handIn' },
    })
  })
})

describe('focusFromTurn', () => {
  it('puts what a turn built in focus, instead of zooming to it', () => {
    expect(focusFromTurn(['a', 'b'], [{ kind: 'zoom', target: 'fit' }])).toEqual({
      focus: ['a', 'b'],
      effects: [{ kind: 'zoom', target: 'fit' }],
      point: null,
    })
  })

  it('focuses a rewritten card when nothing new was built', () => {
    expect(focusFromTurn([], [{ kind: 'zoom', target: 'node', nodeId: 'c' }])).toEqual({ focus: ['c'], effects: [], point: null })
  })

  it('leaves the focus alone when a turn built and rewrote nothing', () => {
    expect(focusFromTurn([], [{ kind: 'zoom', target: 'reset' }])).toEqual({ focus: null, effects: [{ kind: 'zoom', target: 'reset' }], point: null })
    expect(focusFromTurn([], [])).toEqual({ focus: null, effects: [], point: null })
  })
})

describe('dockModel after a failed turn', () => {
  const base = { nodes: [card('a', 1)], working: 'Working…' }

  it('offers the turn again in the bar, whatever else it would show', () => {
    expect(dockModel({ ...base, run: run(), busy: false, failed: 'refusal' })).toEqual({ kind: 'retry', label: 'Continue' })
    expect(dockModel({ ...base, run: run(), busy: false, failed: 'error' })).toEqual({ kind: 'retry', label: 'Try again' })
    // Even while a finished check is being handed in -- the hand-in is what failed.
    const handedIn = [cell('q1', 'cp', 'correct')]
    expect(dockModel({ ...base, nodes: handedIn, run: run({ openCheck: open('cp') }), busy: false, failed: 'refusal' })).toEqual({
      kind: 'retry', label: 'Continue',
    })
  })

  it('does not offer it while a turn is running, or once the lesson is done', () => {
    expect(dockModel({ ...base, run: run(), busy: true, failed: 'error' })).toEqual({ kind: 'working', label: 'Working…' })
    expect(dockModel({ ...base, run: run({ phase: 'done' }), busy: false, failed: 'error' })).toEqual({ kind: 'done' })
  })
})

describe('viewportMoved', () => {
  it('counts a real pan or zoom, not a click that starts and ends in place', () => {
    const at = { x: 100, y: 50, zoom: 1 }
    expect(viewportMoved(at, { ...at })).toBe(false)
    expect(viewportMoved(at, { x: 101.5, y: 50.5, zoom: 1 })).toBe(false)
    expect(viewportMoved(at, { x: 140, y: 50, zoom: 1 })).toBe(true)
    expect(viewportMoved(at, { x: 100, y: 50, zoom: 0.9 })).toBe(true)
  })
})

describe('dockCandidate', () => {
  it('lets a card ask for the dock only when it is in the spotlight, the dock is up, and it has a bar to put there', () => {
    const base = { staged: true, dockReady: true, nodeId: 'a', focused: new Set(['a']), enabled: true }
    expect(dockCandidate(base)).toBe(true)
    // A legacy activity draws its own controls and no bar: it must not take
    // the dock and leave it empty.
    expect(dockCandidate({ ...base, enabled: false })).toBe(false)
    expect(dockCandidate({ ...base, staged: false })).toBe(false)
    expect(dockCandidate({ ...base, dockReady: false })).toBe(false)
    expect(dockCandidate({ ...base, nodeId: null })).toBe(false)
    expect(dockCandidate({ ...base, focused: new Set(['b']) })).toBe(false)
  })
})

describe('takesArrivalFocus -- the new card gets the keyboard', () => {
  it('takes focus that the board, the dock or nobody holds', () => {
    // Continue unmounts as the dock changes, so focus is usually on the page itself.
    expect(takesArrivalFocus({ where: 'body', firstFrame: false })).toBe(true)
    expect(takesArrivalFocus({ where: 'board', firstFrame: false })).toBe(true)
  })
  it('leaves focus alone in the chat, the rail or a card already in the spotlight', () => {
    expect(takesArrivalFocus({ where: 'outside', firstFrame: false })).toBe(false)
    expect(takesArrivalFocus({ where: 'card', firstFrame: false })).toBe(false)
  })
  it('does not grab focus when the page first opens on a lesson', () => {
    expect(takesArrivalFocus({ where: 'body', firstFrame: true })).toBe(false)
  })
})

describe('cameraInsets -- room for the dock', () => {
  it('leaves more room at the foot on phones, where the dock is lifted over Inky', () => {
    const wide = cameraInsets(false)
    const phone = cameraInsets(true)
    expect(wide.bottom).toBe(128)
    expect(phone.bottom).toBeGreaterThanOrEqual(wide.bottom + DOCK_LIFT_PHONE - 24)
    expect(phone.top).toBe(wide.top)
  })
})

describe('focusFromTurn and a point', () => {
  const point = { kind: 'point' as const, nodeId: 'n1', part: 'item-2' }
  it('keeps a point out of the focus and out of the camera, and hands it back on its own', () => {
    expect(focusFromTurn(['c1'], [point])).toEqual({ focus: ['c1'], effects: [], point: { nodeId: 'n1', part: 'item-2' } })
    expect(focusFromTurn([], [point])).toEqual({ focus: null, effects: [], point: { nodeId: 'n1', part: 'item-2' } })
  })
  it('has no point when the turn made none', () => {
    expect(focusFromTurn(['c1'], []).point).toBeNull()
  })
})
