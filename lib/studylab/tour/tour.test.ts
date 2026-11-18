import { describe, expect, it } from 'vitest'
import { stepsPresent, TOUR_STEPS } from './steps'
import { nextTip, TIP_GAP_MS, TIPS } from './tips'
import { markShown, markToolUsed, readUsage } from './usage'

const mem = (initial: Record<string, string> = {}) => {
  const data = { ...initial }
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data }
}
const base = { visible: new Set<string>(), used: new Set<string>(), shown: new Set<string>(), now: 100_000, lastTipAt: null, chatOpen: false, touring: false }

describe('stepsPresent', () => {
  it('keeps every step when every control is on screen, in order', () => {
    const all = TOUR_STEPS.flatMap((s) => (s.anchor ? [s.anchor] : []))
    expect(stepsPresent(all).map((s) => s.id)).toEqual(TOUR_STEPS.map((s) => s.id))
  })
  it('drops a step whose control is missing', () => {
    const ids = stepsPresent(['lesson-board', 'lesson-next', 'lesson-leave']).map((s) => s.id)
    expect(ids).toEqual(['board', 'next', 'leave', 'close'])
  })
  it('always ends on the closing card', () => {
    expect(stepsPresent([]).map((s) => s.id)).toEqual(['close'])
  })
})

describe('nextTip', () => {
  it('offers nothing when nothing is visible', () => {
    expect(nextTip(base)).toBeNull()
  })
  it('offers the first visible unused, unshown tip in priority order', () => {
    const t = nextTip({ ...base, visible: new Set(['lesson-stations', 'lesson-unsure']) })
    expect(t?.id).toBe('lesson-unsure')
  })
  it('skips used tools and tips already shown', () => {
    const t = nextTip({ ...base, visible: new Set(['lesson-unsure', 'lesson-stations']), used: new Set(['lesson-unsure']) })
    expect(t?.id).toBe('lesson-stations')
    expect(nextTip({ ...base, visible: new Set(['lesson-stations']), shown: new Set(['lesson-stations']) })).toBeNull()
  })
  it('never during the tour', () => {
    expect(nextTip({ ...base, visible: new Set(['lesson-stations']), touring: true })).toBeNull()
  })
  it('waits a minute after the last tip', () => {
    const v = new Set(['lesson-stations'])
    expect(nextTip({ ...base, visible: v, lastTipAt: base.now - TIP_GAP_MS + 1 })).toBeNull()
    expect(nextTip({ ...base, visible: v, lastTipAt: base.now - TIP_GAP_MS })?.id).toBe('lesson-stations')
  })
  it('keeps every tip but the composer one away from an open chat', () => {
    expect(nextTip({ ...base, chatOpen: true, visible: new Set(['lesson-stations']) })).toBeNull()
    expect(nextTip({ ...base, chatOpen: true, visible: new Set(['lesson-stations', 'lesson-attach']) })?.id).toBe('lesson-attach')
    expect(nextTip({ ...base, chatOpen: false, visible: new Set(['lesson-attach']) })).toBeNull()
  })
  it('has unique ids', () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length)
  })
})

describe('usage', () => {
  it('starts empty and survives garbage', () => {
    expect(readUsage(mem())).toEqual({ used: [], shown: [] })
    expect(readUsage(mem({ 'ss-learnspace-tour-v1': '{nope' }))).toEqual({ used: [], shown: [] })
    expect(readUsage(null)).toEqual({ used: [], shown: [] })
  })
  it('marks a tool used and a tip shown, once each', () => {
    const s = mem()
    markToolUsed('lesson-stations', s)
    markToolUsed('lesson-stations', s)
    markShown('lesson-unsure', s)
    expect(readUsage(s)).toEqual({ used: ['lesson-stations'], shown: ['lesson-unsure'] })
  })
  it('does not throw when storage throws', () => {
    const bad = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
    expect(() => markToolUsed('x', bad)).not.toThrow()
  })
})

import { placeCard } from './place'

describe('placeCard', () => {
  const view = { w: 1000, h: 800 }
  const card = { w: 300, h: 150 }
  it('goes below a control near the top, centred on it', () => {
    const p = placeCard({ x: 400, y: 20, w: 100, h: 40 }, card, view)
    expect(p.side).toBe('below')
    expect(p.y).toBeGreaterThanOrEqual(60)
    expect(p.clear).toBe(true)
  })
  it('goes above a control at the bottom', () => {
    const p = placeCard({ x: 400, y: 700, w: 200, h: 64 }, card, view)
    expect(p.side).toBe('above')
    expect(p.y + card.h).toBeLessThanOrEqual(700)
  })
  it('stays on screen at the edges', () => {
    const p = placeCard({ x: 960, y: 10, w: 36, h: 36 }, card, view)
    expect(p.x + card.w).toBeLessThanOrEqual(view.w)
    expect(p.x).toBeGreaterThanOrEqual(0)
  })
  it('uses the side when above and below are full', () => {
    const p = placeCard({ x: 20, y: 20, w: 200, h: 760 }, card, view)
    expect(p.side).toBe('right')
    expect(p.clear).toBe(true)
  })
  it('flanks a tall control instead of covering it above or below', () => {
    const p = placeCard({ x: 100, y: 60, w: 400, h: 600 }, card, view)
    expect(p.side).toBe('right')
  })
  it('centres with no control', () => {
    const p = placeCard(null, card, view)
    expect(p).toMatchObject({ x: 350, y: 325, side: 'center' })
  })
  it('reports overlap when nothing fits', () => {
    expect(placeCard({ x: 0, y: 0, w: 1000, h: 800 }, card, view).clear).toBe(false)
  })
})
