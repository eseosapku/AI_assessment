// lib/studylab/trail/lookBack.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { LessonRun } from '../lessonRun'
import type { QuizCell, StudyNode, StudyNodeData } from '../types'
import { applyActions } from '../actions'
import { FOCUS_W, trailLayout } from './layout'
import { canRetry, freshAttempt, openLookBack, sandboxCallbacks } from './lookBack'
import { placeCards } from './placement'

const at = { x: 10, y: 20 }
const dims = { x: 0, y: 0, width: 100, height: 100 }
const question = { id: 'q', format: 'mcq', prompt: 'Why?', options: ['a', 'b'], answer: 1 } as QuizCell['question']
const cell: QuizCell = { checkpointId: 'c', gate: 'hard', question, state: 'correct', given: 1, feedback: 'Yes', attempts: 2, revealed: false }
const quizNode = (id: string) => ({ id, type: 'quiz', position: { x: 0, y: 0 }, data: { kind: 'quiz', quiz: cell }, source: 'lesson' }) as unknown as StudyNode
const noteNode = (id: string) => ({ id, type: 'note', position: { x: 0, y: 0 }, data: { kind: 'note', body: 'mine' }, source: 'freeform' }) as unknown as StudyNode
const node = (id: string, step: number) => ({ id, type: 'concept', position: { x: 0, y: 0 }, data: { kind: 'concept', step }, source: 'lesson' }) as unknown as StudyNode
const runAt = (current: number, statuses: string[]) =>
  ({ phase: 'teaching', pace: 'step', recipe: 'station', currentStep: current, beats: 0, awaiting: false, steps: statuses.map((status, i) => ({ id: `s${i}`, title: `S${i}`, goal: '', status, cardIds: [] })) }) as unknown as LessonRun

describe('openLookBack', () => {
  it('holds a copy, with the name to show and whether the card is the learner\'s own', () => {
    expect(openLookBack(quizNode('q1'), at, 3)).toMatchObject({ id: 'q1', title: 'Why?', at, epoch: 3, own: false })
    expect(openLookBack(noteNode('free-note-1'), at, 3).own).toBe(true)
  })
})

describe('sandboxCallbacks', () => {
  const open = () => openLookBack(quizNode('q1'), at, 1)
  const write = { quiz: { ...cell, state: 'incorrect' as const } }

  it('a write from the reopened card goes to its copy, and nothing else does anything', () => {
    const sandbox = vi.fn()
    const cb = sandboxCallbacks({ id: 'q1', epoch: 1, lookBack: open, writeSandbox: sandbox })
    cb.onNodeDataChange('q1', write)
    cb.onDeleteNode('q1')
    cb.onAskTutor('q1')
    cb.onNodeResize('q1', dims)
    cb.onToggleGroup('g')
    expect(sandbox).toHaveBeenCalledOnce()
    expect(sandbox).toHaveBeenCalledWith(write)
  })
  it('a result arriving after Back is dropped: marking finishes after the card has closed', () => {
    const sandbox = vi.fn()
    let current: ReturnType<typeof open> | null = open()
    const cb = sandboxCallbacks({ id: 'q1', epoch: 1, lookBack: () => current, writeSandbox: sandbox })
    current = null
    cb.onNodeDataChange('q1', write)
    expect(sandbox).not.toHaveBeenCalled()
  })
  it('a result from before Try it again is dropped: it belongs to an attempt that has gone', () => {
    const sandbox = vi.fn()
    const cb = sandboxCallbacks({ id: 'q1', epoch: 1, lookBack: () => openLookBack(quizNode('q1'), at, 2), writeSandbox: sandbox })
    cb.onNodeDataChange('q1', write)
    expect(sandbox).not.toHaveBeenCalled()
  })
  it('a result from a card closed before another was opened does not land on the new one', () => {
    const sandbox = vi.fn()
    const cb = sandboxCallbacks({ id: 'q1', epoch: 1, lookBack: () => openLookBack(quizNode('other'), at, 1), writeSandbox: sandbox })
    cb.onNodeDataChange('q1', write)
    expect(sandbox).not.toHaveBeenCalled()
  })
})

describe('freshAttempt', () => {
  it('Try it again clears a copy, and leaves the marked card alone', () => {
    const data = { kind: 'quiz', quiz: cell } as StudyNodeData
    const before = structuredClone(data)
    const next = freshAttempt(data)
    expect(next.quiz).toMatchObject({ checkpointId: 'c', state: 'unanswered', attempts: 0 })
    expect(next.quiz?.given).toBeUndefined()
    expect(next.quiz?.feedback).toBeUndefined()
    expect(data).toEqual(before)
    expect(freshAttempt({ kind: 'practice', practice: { state: 'correct', revealed: true } } as never).practice).toMatchObject({ state: 'unattempted', revealed: false })
    expect(freshAttempt({ kind: 'activity', activityState: { status: 'solved' } } as never).activityState).toBeUndefined()
    expect(freshAttempt({ kind: 'material', materialState: { status: 'solved' } } as never).materialState).toBeUndefined()
  })
})

describe('a fresh try', () => {
  it('starts a practice card from nothing: its old answer and its count of tries go too', () => {
    const next = freshAttempt({ kind: 'practice', practice: { state: 'correct', attempt: '1/5', attempts: 3, revealed: true, feedback: 'Yes' } } as never).practice
    expect(next).toMatchObject({ state: 'unattempted', revealed: false, attempts: 0 })
    expect(next?.attempt).toBeUndefined()
    expect((next as { feedback?: string }).feedback).toBeUndefined()
  })
})

describe('canRetry', () => {
  it('only a marked or solved card offers Try it again', () => {
    expect(canRetry({ kind: 'concept' } as StudyNodeData)).toBe(false)
    expect(canRetry({ kind: 'quiz', quiz: { state: 'correct' } } as never)).toBe(true)
    expect(canRetry({ kind: 'quiz', quiz: { state: 'unanswered' } } as never)).toBe(false)
    expect(canRetry({ kind: 'practice', practice: { state: 'unattempted' } } as never)).toBe(false)
    expect(canRetry({ kind: 'practice', practice: { state: 'unattempted', revealed: true } } as never)).toBe(true)
    expect(canRetry({ kind: 'activity', activityState: { status: 'solved' } } as never)).toBe(true)
    expect(canRetry({ kind: 'activity', activityState: { status: 'idle' } } as never)).toBe(false)
  })
})

describe('a turn while looking back', () => {
  it('the new focus lands in its plot, and the reopened card stays open', () => {
    const placed = placeCards({ nodes: [node('old', 1), node('new', 2)], run: runAt(1, ['done', 'teaching', 'pending']), queue: { ids: ['new'], at: 0 }, detours: [], openDetour: null, blocks: {}, sizes: {}, interlude: null, notes: [] })
    const w = trailLayout({ stations: placed.stations, detours: placed.detours, focusWidth: FOCUS_W, speaker: true, reopened: { id: 'old', natural: { w: 300, h: 300 }, at: { x: 0, y: 0 } } })
    expect(w.cards.old.role).toBe('reopened')
    expect(w.cards.new.role).toBe('focus')
  })
})

describe('a card the learner has already solved', () => {
  const spec = { pattern: 'scenario', prompt: 'Label the three terminals.', payload: { situation: 'A circuit.', choices: [{ id: 'a', label: 'A', consequence: 'It lights.' }, { id: 'b', label: 'B', consequence: 'It stays dark.' }] }, success: { kind: 'exactSet', itemIds: ['a'] } } as never
  const solved = { id: 'a', type: 'activity', position: { x: 0, y: 0 }, source: 'ai', data: { kind: 'activity', step: 1, spec, activityState: { status: 'solved', attempts: 1, hintsUsed: 0, elapsedMs: 0, rejectedMoves: [], work: {} } } } as unknown as StudyNode
  const untouched = { ...solved, data: { ...solved.data, activityState: undefined } } as unknown as StudyNode
  const state = (n: StudyNode) => ({ nodes: [n], edges: [] }) as never
  const again = { type: 'createActivity', id: 'b', spec, step: 1 } as never

  it('asking for the same prompt again makes a fresh card', () => {
    const r = applyActions(state(solved), [again])
    expect(r.created).toEqual(['b'])
    expect(r.nodes.find((n) => n.id === 'b')?.data.activityState?.status).toBe('untouched')
  })
  it('a true duplicate, nobody having solved it, still goes to the one that exists', () => {
    const r = applyActions(state(untouched), [again])
    expect(r.created).toEqual([])
    expect(r.effects).toMatchObject([{ kind: 'zoom', nodeId: 'a' }])
  })
})
