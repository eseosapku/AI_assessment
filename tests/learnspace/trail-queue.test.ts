import { describe, it, expect } from 'vitest'
import { syncQueue, sameBranch, focusOf, waitingIds, pinnedFocus, holdOn, withHold, type QueueState } from '@/lib/studylab/trail/queue'

const q = (ids: string[], at: number): QueueState => ({ ids, at })

describe('one card at a time', () => {
  it('starts a queue on the first card of a burst', () => {
    expect(syncQueue(null, ['a', 'b'])).toEqual({ ids: ['a', 'b'], at: 0 })
    expect(focusOf(q(['a', 'b'], 0))).toBe('a')
    expect(waitingIds(q(['a', 'b'], 0))).toEqual(['b'])
  })

  it('an empty spotlight clears the queue', () => {
    expect(syncQueue(q(['a'], 0), [])).toBeNull()
  })

  it('moving to a card already queued does not rewind the ones still waiting', () => {
    const queue = q(['a', 'b', 'c'], 0)
    const moved = syncQueue(queue, ['b'])
    expect(moved).toEqual({ ids: ['a', 'b', 'c'], at: 1 })
    expect(syncQueue(moved, ['b'])).toBe(moved)
  })

  it('new work goes first and unreached cards on the same branch wait behind it', () => {
    const detours = [{ id: 'd1', cardIds: ['side'] }]
    const carry = sameBranch(detours, ['ask'], new Set(['a', 'b', 'ask']))
    const next = syncQueue(q(['a', 'b'], 0), ['ask'], carry)
    expect(next).toEqual({ ids: ['ask', 'b'], at: 0 })
  })

  it('a card on another branch, or already off the board, is not carried', () => {
    const detours = [{ id: 'd1', cardIds: ['a'] }, { id: 'd2', cardIds: ['b'] }]
    const carry = sameBranch(detours, ['ask'], new Set(['a']))
    expect(syncQueue(q(['a', 'b'], 0), ['ask'], carry)?.ids).toEqual(['ask'])
  })

  it('the trail behind a detour is not part of the detour', () => {
    const detours = [{ id: 'd1', cardIds: ['side'] }]
    const carry = sameBranch(detours, ['side'], new Set(['main', 'side']))
    expect(carry('main')).toBe(false)
    expect(carry('side')).toBe(true)
  })
})

describe('staying with an answer', () => {
  it('a reload pins the card the lesson did not name', () => {
    expect(pinnedFocus([], ['card'])).toBe('card')
    expect(pinnedFocus(['named'], ['card'])).toBeNull()
  })

  it('a settled answer is held until the learner moves on', () => {
    expect(holdOn({ from: 'q', queue: q(['next'], 0), settled: true, movedOn: null, detour: false })).toBe('q')
    expect(holdOn({ from: 'q', queue: q(['q'], 0), settled: true, movedOn: null, detour: false })).toBeNull()
    expect(holdOn({ from: 'q', queue: null, settled: false, movedOn: null, detour: false })).toBeNull()
    expect(holdOn({ from: 'q', queue: null, settled: true, movedOn: 'q', detour: false })).toBeNull()
    expect(holdOn({ from: 'q', queue: null, settled: true, movedOn: null, detour: true })).toBeNull()
  })

  it('the held card is shown first, with the new cards behind it', () => {
    expect(withHold(q(['next', 'after'], 0), 'q')).toEqual({ ids: ['q', 'next', 'after'], at: 0 })
    expect(withHold(q(['q', 'next'], 1), null)).toEqual(q(['q', 'next'], 1))
  })
})
