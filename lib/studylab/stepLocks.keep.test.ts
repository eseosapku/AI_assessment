// lib/studylab/stepLocks.keep.test.ts
import { describe, it, expect } from 'vitest'
import { keepMeasuredSteps } from './stepLocks'
import type { LessonStep } from './lessonRun'

const step = (id: string, subtopicId?: number, accuracy?: number): LessonStep => ({
  id,
  title: `Step ${id}`,
  goal: 'g',
  status: 'pending',
  cardIds: [],
  ...(subtopicId ? { subtopicId } : {}),
  ...(accuracy !== undefined ? { lockedBy: { subtopicId: subtopicId!, accuracy } } : {}),
})

describe('keepMeasuredSteps', () => {
  it('puts back a measured gap the re-draft dropped', () => {
    // Opened at 29% on "What is Classification", pressing "I know the basics"
    // came back with a plan that did not mention that subtopic at all — the
    // lesson would have run under a title about the gap while covering
    // everything except it.
    const previous = [step('s1', 1, 29), step('s2', 4)]
    const drafted = [step('a', 2), step('b', 3), step('c', 6)]
    const kept = keepMeasuredSteps(previous, drafted)

    expect(kept.map((s) => s.subtopicId)).toEqual([1, 2, 3, 6])
    // First, because it is the reason the lesson exists.
    expect(kept[0].lockedBy?.accuracy).toBe(29)
  })

  it('leaves the re-draft alone when it kept the gap itself', () => {
    const previous = [step('s1', 1, 29)]
    const drafted = [step('a', 3), step('b', 1)]
    expect(keepMeasuredSteps(previous, drafted)).toBe(drafted)
  })

  it('does nothing when nothing was measured', () => {
    // An open lesson has no gap to protect, and this must not add steps to one.
    const drafted = [step('a', 3)]
    expect(keepMeasuredSteps([step('s1', 1), step('s2', 2)], drafted)).toBe(drafted)
  })

  it('carries every measured gap, not just the first', () => {
    const previous = [step('s1', 1, 29), step('s2', 4, 12)]
    const kept = keepMeasuredSteps(previous, [step('a', 7)])
    expect(kept.map((s) => s.subtopicId)).toEqual([1, 4, 7])
  })

  it('renumbers so nothing collides with the drafted ids', () => {
    // Both sides number from s1, and two steps with one id is a plan the run
    // cannot navigate.
    const kept = keepMeasuredSteps([step('s1', 1, 29)], [step('s1', 2), step('s2', 3)])
    expect(kept.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
    expect(new Set(kept.map((s) => s.id)).size).toBe(kept.length)
  })

  it('brings the step back unstarted', () => {
    const taught: LessonStep = { ...step('s1', 1, 29), status: 'done', cardIds: ['c1'], checkpointId: 'cp-1' }
    const [back] = keepMeasuredSteps([taught], [step('a', 2)])
    expect(back.status).toBe('pending')
    expect(back.cardIds).toEqual([])
    expect(back.checkpointId).toBeUndefined()
  })
})
