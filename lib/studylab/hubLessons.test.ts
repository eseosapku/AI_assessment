import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CarryOn, LessonShelf, TrailDots } from '@/components/studylab/hub/HubLessons'
import { HubAsk } from '@/components/studylab/hub/HubAsk'
import { matchesSearch, placeOf, shelvesOf, stepWords, unshout, type HubLesson } from './hubLessons'

const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Stage ${i + 1}`, status: 'pending' as const }))
const lesson = (over: Partial<HubLesson> = {}): HubLesson => ({
  id: 'a', title: 'Fractions', subject: 'Mathematics', origin: 'scratch', current_step: 0,
  status: 'active', created_at: '2026-11-01', updated_at: '2026-11-01', ...over,
})

describe('where a lesson stands', () => {
  it('reads its step from the run, counted from one', () => {
    expect(placeOf(lesson({ phase: 'teaching', step_index: 2, steps: steps(5) })))
      .toEqual({ kind: 'underway', at: 3, total: 5, title: 'Stage 3' })
  })
  it('a plan not yet begun is new, not step one', () => {
    expect(placeOf(lesson({ phase: 'planning', step_index: -1, steps: steps(5) }))).toEqual({ kind: 'new' })
  })
  it('an index past the end of the plan stays on the last step', () => {
    expect(placeOf(lesson({ step_index: 9, steps: steps(3) }))).toMatchObject({ at: 3, total: 3, title: 'Stage 3' })
  })
  it('a lesson from before runs still says its step, without a total', () => {
    expect(placeOf(lesson({ current_step: 4 }))).toEqual({ kind: 'underway', at: 4, total: null, title: null })
  })
  it('nothing begun and no run is new, never "Step 0"', () => {
    expect(placeOf(lesson())).toEqual({ kind: 'new' })
  })
  it('completed by the row or by the run', () => {
    expect(placeOf(lesson({ status: 'completed', step_index: 1, steps: steps(3) }))).toEqual({ kind: 'completed' })
    expect(placeOf(lesson({ phase: 'done', step_index: 1, steps: steps(3) }))).toEqual({ kind: 'completed' })
  })
})

describe('how a step is said', () => {
  const place = { kind: 'underway', at: 2, total: 4, title: null } as const
  it('steps, on a lesson', () => expect(stepWords(lesson(), place)).toBe('Step 2 of 4'))
  it('questions, on homework', () => expect(stepWords(lesson({ origin: 'homework' }), place)).toBe('Question 2 of 4'))
  it('no total when none is known', () => expect(stepWords(lesson(), { ...place, total: null })).toBe('Step 2'))
})

describe('the shelves', () => {
  const open1 = lesson({ id: 'open1', current_step: 2 })
  const done = lesson({ id: 'done', status: 'completed' })
  const open2 = lesson({ id: 'open2' })

  it('next is the newest unfinished one, even with a completed lesson above it', () => {
    expect(shelvesOf([done, open1, open2]).next?.id).toBe('open1')
  })
  it('the next lesson is not listed a second time', () => {
    const { inProgress, completed } = shelvesOf([done, open1, open2])
    expect(inProgress.map((l) => l.id)).toEqual(['open2'])
    expect(completed.map((l) => l.id)).toEqual(['done'])
  })
  it('nothing to carry on with when all are completed, or there are none', () => {
    expect(shelvesOf([done]).next).toBeNull()
    expect(shelvesOf([])).toEqual({ next: null, inProgress: [], completed: [] })
  })
})

describe('finding a lesson', () => {
  it('by title or subject, in any case', () => {
    expect(matchesSearch(lesson(), 'FRAC')).toBe(true)
    expect(matchesSearch(lesson(), 'maths')).toBe(false)
    expect(matchesSearch(lesson(), 'mathem')).toBe(true)
  })
  it('an empty search finds everything', () => expect(matchesSearch(lesson(), '  ')).toBe(true))
})

describe('a name in capitals', () => {
  it('reads in sentence case and keeps a code like S5', () => {
    expect(unshout('FINAL COMPUTER SCIENCE S5 WITH STAMP')).toBe('Final computer science S5 with stamp')
  })
  it('a name already written properly is left alone', () => {
    expect(unshout('Physics for Cambridge IGCSE')).toBe('Physics for Cambridge IGCSE')
  })
})

describe('the card to carry on with', () => {
  const underway = lesson({ title: 'Expanding brackets', phase: 'teaching', step_index: 2, steps: steps(6) })
  const open = vi.fn()

  it('says which step, out of how many, and what it is called', () => {
    const html = renderToStaticMarkup(createElement(CarryOn, { lesson: underway, onOpen: open }))
    expect(html).toContain('Step 3 of 6')
    expect(html).toContain('Stage 3')
    expect(html).toContain('Continue')
  })
  it('a lesson not begun says so, and starts rather than continues', () => {
    const html = renderToStaticMarkup(createElement(CarryOn, { lesson: lesson(), onOpen: open }))
    expect(html).toContain('Not started yet')
    expect(html).toContain('Start')
    expect(html).not.toContain('Continue')
  })
  it('its trail names the step for a screen reader, on a lesson with a plan only', () => {
    expect(renderToStaticMarkup(createElement(TrailDots, { lesson: underway }))).toContain('aria-label="Step 3 of 6"')
    expect(renderToStaticMarkup(createElement(TrailDots, { lesson: lesson({ current_step: 2 }) }))).toBe('')
  })
})

describe('the shelf of lessons', () => {
  const many = Array.from({ length: 30 }, (_, i) => lesson({ id: `l${i}`, title: `Lesson number ${i}`, current_step: 1 }))
  const shelf = (over: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(LessonShelf, {
      inProgress: many, completed: [lesson({ id: 'done', title: 'A finished one', status: 'completed' })],
      onOpen: vi.fn(), onBuild: vi.fn(), ...over,
    }))

  it('opens on what is in progress, a few at a time, with the rest offered', () => {
    const html = shelf()
    expect(html.split('ss-hub-card').length - 1).toBe(12)
    expect(html).toContain('Show 18 more')
    expect(html).not.toContain('A finished one')
  })
  it('a short list has no search and no "more"', () => {
    const html = shelf({ inProgress: many.slice(0, 3), completed: [] })
    expect(html).not.toContain('Find a lesson')
    expect(html).not.toContain(' more')
  })
  it('with nothing in progress, what is completed shows, and only that tab', () => {
    const html = shelf({ inProgress: [] })
    expect(html).toContain('A finished one')
    expect(html).not.toContain('In progress')
  })
})

describe('Kana asking', () => {
  const ask = (over: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(HubAsk, {
      userId: 'u', seedSubject: '', fill: null, firstTime: false, demoSeen: true, onCreated: vi.fn(), onHomework: vi.fn(), ...over,
    }))

  it('keeps what the product tour points at', () => {
    const html = ask()
    expect(html).toContain('data-tour="learnspace-new"')
    expect(html).toContain('data-tour="learnspace-homework"')
  })
  it('offers topics to try only to someone with no lessons', () => {
    expect(ask()).not.toContain('Topics to try')
    expect(ask({ firstTime: true })).toContain('Topics to try')
  })
  it('says Kana shows you around, until the tour has been seen', () => {
    expect(ask()).not.toContain('shows you around')
    expect(ask({ demoSeen: false })).toContain('Kana shows you around in your first lesson')
    expect(ask({ demoSeen: false })).not.toContain('/studylab/demo')
  })
})
