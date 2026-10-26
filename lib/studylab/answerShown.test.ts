// lib/studylab/answerShown.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'
import { MOTION, motionFor } from './motionPresets'

/**
 * A solved material says so by the thing itself: sorted bins close, a
 * balanced beam's pans each take a tick. Rendered as a reloaded board shows
 * them, solved and not.
 */
vi.spyOn(console, 'error').mockImplementation(() => {})

const card = (spec: Record<string, unknown>, activityState?: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, { id: 'n1', data: { spec, activityState } } as never)))
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length

const SORT = {
  pattern: 'sort', prompt: 'Sort the elements.', seed: 7,
  payload: {
    bins: [{ id: 'b1', label: 'Metal' }, { id: 'b2', label: 'Non-metal' }],
    items: [{ id: 'i1', label: 'Iron', binId: 'b1' }, { id: 'i2', label: 'Sulfur', binId: 'b2' }],
  },
  success: { kind: 'binAssignment', assign: { i1: 'b1', i2: 'b2' } },
}
const BALANCE = {
  pattern: 'balance', prompt: 'Balance the scale.', seed: 1,
  payload: { left: [{ id: 'l1', label: 'Box', weight: 5 }], right: [], pool: [{ id: 'p1', label: 'Bag', weight: 3 }, { id: 'p2', label: 'Tin', weight: 2 }], mode: 'weights' },
  success: { kind: 'numericWithin', target: 0, tolerance: 0 },
}

describe('the close preset', () => {
  it('drops a lid in within 300 ms, and under reduced motion only fades it', () => {
    expect(MOTION.close.transition.duration).toBeLessThanOrEqual(0.3)
    const reduced = motionFor('close', true)
    expect(reduced.initial).not.toHaveProperty('scaleY')
    expect(reduced.animate).toHaveProperty('opacity')
  })
})

describe('sorted bins close when the sort is solved', () => {
  it('a lid on every bin once solved, and none before', () => {
    expect(count(card(SORT), /data-lid/g)).toBe(0)
    expect(count(card(SORT, { status: 'solved', attempts: 1, hintsUsed: 0, elapsedMs: 0, rejectedMoves: [], work: {} }), /data-lid/g)).toBe(2)
  })
})

describe('a balanced beam ticks both pans', () => {
  it('each pan takes a tick once solved, and neither before', () => {
    expect(count(card(BALANCE), /data-pan-settled/g)).toBe(0)
    expect(count(card(BALANCE, { status: 'solved', attempts: 1, hintsUsed: 0, elapsedMs: 0, rejectedMoves: [], work: {} }), /data-pan-settled/g)).toBe(2)
  })
})
