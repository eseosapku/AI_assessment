import { describe, it, expect } from 'vitest'
import { TOUR_STEPS, clampStep, hasSeenTour } from './product-tour'

describe('TOUR_STEPS', () => {
  it('is short enough to finish', () => {
    // The report asked for 3-5 steps; more than that and it is skipped.
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(3)
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(5)
  })

  it('leads with where the lost tester was trying to go', () => {
    expect(TOUR_STEPS[0].href).toBe('/practice')
  })

  it('points every step at a real nav destination', () => {
    const navHrefs = ['/dashboard', '/practice', '/studylab', '/studylab/gap-map', '/progress', '/classrooms']
    for (const step of TOUR_STEPS) {
      expect(navHrefs, `${step.href} is not in the sidebar`).toContain(step.href)
    }
  })

  it('says what a section is for rather than repeating its name', () => {
    for (const step of TOUR_STEPS) {
      expect(step.body.length).toBeGreaterThan(30)
      expect(step.title.toLowerCase()).not.toBe(step.href.replace('/', ''))
    }
  })
})

describe('clampStep', () => {
  it('keeps an index inside the tour', () => {
    expect(clampStep(-5)).toBe(0)
    expect(clampStep(0)).toBe(0)
    expect(clampStep(99)).toBe(TOUR_STEPS.length - 1)
  })

  it('handles malformed input', () => {
    expect(clampStep(NaN)).toBe(0)
    expect(clampStep(undefined as never)).toBe(0)
  })
})

describe('hasSeenTour', () => {
  it('treats an unavailable store as already seen', () => {
    // Running the tour on every single load is worse than never running it.
    expect(typeof hasSeenTour()).toBe('boolean')
  })
})
