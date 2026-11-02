// lib/studylab/trail/opening.test.ts
import { describe, it, expect } from 'vitest'
import type { ChatPlan } from '../types'
import { trailLayout, FOCUS_W } from './layout'
import { openingChips, nextQuestion, openingInsets, planFrom, restingSpot } from './opening'
import type { PlotInput } from './types'

const plan = (over: Partial<ChatPlan> = {}): ChatPlan => ({ steps: [], questions: [], live: true, ...over })
const plots = (states: PlotInput['state'][]): PlotInput[] => states.map((state, i) => ({ id: `s${i}`, title: `S${i}`, state, focus: null, finished: [], filed: [], notes: 0 }))
const world = (states: PlotInput['state'][]) => trailLayout({ stations: plots(states), detours: [], focusWidth: FOCUS_W, speaker: true })

describe('openingChips', () => {
  it.each(['Have you met demand curves?', 'Do you know x?', 'Can you add?', 'Is this new?'])('%s gets yes/no chips', (q) => {
    expect(openingChips(q)).toEqual(['Yes, a bit', 'Not yet'])
  })
  it('anything else is free text only', () => {
    expect(openingChips('What do you want to get out of this?')).toEqual([])
    expect(openingChips('Doing this for an exam?')).toEqual([])
  })
})

describe('nextQuestion', () => {
  it('questions come one at a time; none left means straight to Start', () => {
    expect(nextQuestion(['a', 'b'], new Set())).toBe('a')
    expect(nextQuestion(['a', 'b'], new Set(['a']))).toBe('b')
    expect(nextQuestion(['a'], new Set(['a']))).toBeNull()
    expect(nextQuestion([], new Set())).toBeNull()
  })
})

describe('planFrom', () => {
  it('only a live plan opens the lesson', () => {
    expect(planFrom([{ role: 'assistant', kind: 'plan', content: '', plan: plan({ live: false }) }])).toBeNull()
    expect(planFrom([])).toBeNull()
  })
  it('the newest plan is the one on the table', () => {
    const newest = plan({ questions: ['new'] })
    expect(planFrom([{ role: 'assistant', kind: 'plan', content: '', plan: plan({ live: false }) }, { role: 'assistant', kind: 'plan', content: '', plan: newest }])).toBe(newest)
  })
})

describe('where Kana waits with no card in focus', () => {
  it('on the plot the journey goes to next', () => {
    const w = world(['done', 'next', 'future'])
    const spot = restingSpot(w)!
    const plot = w.plots[1].rect
    expect(spot.kana.x).toBeGreaterThanOrEqual(plot.x)
    expect(spot.kana.y).toBeGreaterThanOrEqual(plot.y)
    expect(spot.kana.x).toBeLessThan(plot.x + plot.w)
  })
  it('nowhere on the board before there are plots', () => {
    expect(restingSpot(world([]))).toBeNull()
  })
})

describe('openingInsets', () => {
  it("leaves room above the button for Kana's question, at a size that can be read", () => {
    const insets = { top: 72, right: 32, bottom: 128, left: 32 }
    const open = openingInsets(insets)
    expect(open.bottom).toBeGreaterThan(insets.bottom + 100)
    expect({ ...open, bottom: 0 }).toEqual({ ...insets, bottom: 0 })
  })
})
