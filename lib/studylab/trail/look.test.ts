// lib/studylab/trail/look.test.ts
import { describe, it, expect } from 'vitest'
import { trailEligible, resolveLook } from './look'
import type { LessonRun } from '../lessonRun'

const steps = (n: number, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `S${i}`, goal: '', status: 'pending', cardIds: [], ...extra }))
const teaching = (over = {}) =>
  ({ phase: 'teaching', pace: 'step', recipe: 'station', currentStep: 0, beats: 0, awaiting: false, steps: steps(5), ...over }) as LessonRun

describe('trailEligible', () => {
  it('takes station runs of 3 to 10 steps', () => {
    expect(trailEligible(teaching({ steps: steps(3) }), [])).toBe(true)
    expect(trailEligible(teaching({ steps: steps(10) }), [])).toBe(true)
    expect(trailEligible(teaching({ steps: steps(2) }), [])).toBe(false)
    expect(trailEligible(teaching({ steps: steps(11) }), [])).toBe(false)
  })

  it('refuses every other kind of run', () => {
    expect(trailEligible(null, [])).toBe(false)
    expect(trailEligible(teaching({ recipe: undefined }), [])).toBe(false)
    expect(trailEligible(teaching({ pace: 'run' }), [])).toBe(false)
    expect(trailEligible(teaching({ mode: 'montessori' }), [])).toBe(false)
    expect(trailEligible(teaching({ steps: steps(5, { homework: { label: 'Q1', answer: null, rubric: null, attempt: null } }) }), [])).toBe(false)
  })

  it('takes a plan still being drafted: recipe is only set on accept', () => {
    const planning = { ...teaching(), phase: 'planning', recipe: undefined, currentStep: -1 } as LessonRun
    expect(trailEligible({ ...planning, steps: [] }, [])).toBe(true)
    expect(trailEligible(planning, [])).toBe(true)
    expect(trailEligible({ ...planning, steps: steps(12) as LessonRun['steps'] }, [])).toBe(false)
    expect(trailEligible({ ...planning, steps: [] }, [{ role: 'assistant', kind: 'homework', content: '', sheet: { questions: [], live: true } }])).toBe(false)
  })

  it('keeps a finished station run', () => {
    expect(trailEligible(teaching({ phase: 'done', currentStep: -1 }), [])).toBe(true)
  })
})

describe('resolveLook', () => {
  it('the URL beats the stored choice, and neither beats eligibility', () => {
    expect(resolveLook({ search: '?look=trail', stored: 'classic', eligible: true })).toBe('trail')
    expect(resolveLook({ search: '?look=classic', stored: 'trail', eligible: true })).toBe('classic')
    expect(resolveLook({ search: '', stored: 'trail', eligible: true })).toBe('trail')
    expect(resolveLook({ search: '', stored: null, eligible: true })).toBe('classic')
    expect(resolveLook({ search: '?look=trail', stored: 'trail', eligible: false })).toBe('classic')
  })
})
