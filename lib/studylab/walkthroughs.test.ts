// lib/studylab/walkthroughs.test.ts
import { describe, it, expect } from 'vitest'
import {
  WALKTHROUGHS,
  walkthroughById,
  progressFor,
  type WalkthroughEvent,
} from './walkthroughs'

describe('the walkthroughs themselves', () => {
  it('gives each one a distinct id', () => {
    const ids = WALKTHROUGHS.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps each short enough to finish in one sitting', () => {
    // Longer than five and it becomes a chore that gets abandoned halfway,
    // which teaches less than not starting.
    for (const w of WALKTHROUGHS) {
      expect(w.steps.length, `${w.id} has ${w.steps.length} steps`).toBeGreaterThanOrEqual(3)
      expect(w.steps.length, `${w.id} has ${w.steps.length} steps`).toBeLessThanOrEqual(5)
    }
  })

  it('writes every step as an action, not a description', () => {
    // "Press X" teaches; "The pace control changes the pace" does not.
    for (const w of WALKTHROUGHS) {
      for (const s of w.steps) {
        expect(s.action.length, `${w.id}: empty action`).toBeGreaterThan(0)
        expect(s.why.length, `${w.id}: "${s.action}" has no reason`).toBeGreaterThan(20)
      }
    }
  })

  it('names a real anchor wherever a step points at something', () => {
    const known = ['lesson-board', 'lesson-chat', 'lesson-continue', 'lesson-plan', 'lesson-pace']
    for (const w of WALKTHROUGHS) {
      for (const s of w.steps) {
        if (s.anchor) expect(known, `${w.id}: ${s.anchor}`).toContain(s.anchor)
      }
    }
  })

  it('finds one by id, and nothing for an unknown one', () => {
    expect(walkthroughById('skim-it')?.title).toBe('Skim a topic you half-know')
    expect(walkthroughById('nope')).toBeUndefined()
  })
})

describe('progressFor', () => {
  const steps = [
    { action: 'a', why: 'because a', on: 'plan-shown' as const },
    { action: 'b', why: 'because b', on: 'plan-accepted' as const },
    { action: 'c', why: 'because c', on: 'check-answered' as const },
  ]

  it('starts at nothing done', () => {
    expect(progressFor(steps, [])).toBe(0)
  })

  it('advances one step per matching event, in order', () => {
    expect(progressFor(steps, ['plan-shown'])).toBe(1)
    expect(progressFor(steps, ['plan-shown', 'plan-accepted'])).toBe(2)
  })

  it('ignores an event for a later step while an earlier one is outstanding', () => {
    // A walkthrough that ticked off whatever happened to fire would jump
    // around, and the learner would lose the thread of what it was showing.
    expect(progressFor(steps, ['check-answered', 'plan-accepted'])).toBe(0)
  })

  it('ignores events that belong to no step', () => {
    expect(progressFor(steps, ['block-added' as WalkthroughEvent, 'plan-shown'])).toBe(1)
  })

  it('does not double-count a repeated event', () => {
    expect(progressFor(steps, ['plan-shown', 'plan-shown'])).toBe(1)
  })

  it('reports completion when every step has fired', () => {
    const all: WalkthroughEvent[] = ['plan-shown', 'plan-accepted', 'check-answered']
    expect(progressFor(steps, all)).toBe(steps.length)
  })

  it('stops counting once finished, whatever else happens', () => {
    const more: WalkthroughEvent[] = [
      'plan-shown', 'plan-accepted', 'check-answered', 'check-answered', 'plan-shown',
    ]
    expect(progressFor(steps, more)).toBe(3)
  })
})
