import { describe, it, expect } from 'vitest'
import { TOUR_STEPS, clampStep, hasSeenTour, choosePlacement } from './product-tour'

describe('TOUR_STEPS', () => {
  it('is short enough to finish', () => {
    // The report asked for 3-5 steps; more than that and it is skipped.
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(3)
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(5)
  })

  it('leads with the control the lost tester was hunting for', () => {
    // Not a menu item. The first version opened on a nav link, which is a
    // place, when the thing they could not find was a button.
    expect(TOUR_STEPS[0].anchor).toBe('hero-cta')
  })

  it('anchors every step to something that exists in the markup', () => {
    // Anchors are data-tour values, not element paths: the previous selector
    // walked the shell's structure and broke when the sidebar changed tag.
    const anchors = ['hero-cta', '/dashboard', '/practice', '/studylab', '/studylab/gap-map', '/progress', '/classrooms']
    for (const step of TOUR_STEPS) {
      expect(anchors, `${step.anchor} has no data-tour target`).toContain(step.anchor)
    }
  })

  it('teaches rather than narrating the menu', () => {
    for (const step of TOUR_STEPS) {
      // "Watch it move — scores and grades over time" described a page and
      // taught nothing. A step has to earn its interruption.
      expect(step.body.length).toBeGreaterThan(90)
      expect(step.title.length).toBeGreaterThan(12)
      expect(step.eyebrow.length).toBeGreaterThan(0)
    }
  })

  it('never titles a step with the name of the thing it points at', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.toLowerCase()).not.toBe(step.anchor.replace('/', ''))
    }
  })
})

describe('clampStep', () => {
  it('keeps the index inside the tour', () => {
    expect(clampStep(-5)).toBe(0)
    expect(clampStep(0)).toBe(0)
    expect(clampStep(99)).toBe(TOUR_STEPS.length - 1)
  })
})

describe('hasSeenTour', () => {
  it('reports seen when storage is unavailable, so it cannot loop', () => {
    // Better to never run than to run on every single page load.
    expect(hasSeenTour()).toBe(true)
  })
})

describe('choosePlacement', () => {
  const panel = { width: 348, height: 240 }
  const viewport = { width: 1440, height: 900 }

  it('prefers the right of the anchor when there is room', () => {
    const anchor = { top: 200, left: 40, right: 240, bottom: 240 }
    expect(choosePlacement(anchor, panel, viewport)).toBe('right')
  })

  it('flips to the left when the anchor is against the right edge', () => {
    const anchor = { top: 200, left: 1300, right: 1420, bottom: 240 }
    expect(choosePlacement(anchor, panel, viewport)).toBe('left')
  })

  it('drops below when the anchor spans the width', () => {
    const anchor = { top: 100, left: 20, right: 1420, bottom: 300 }
    expect(choosePlacement(anchor, panel, viewport)).toBe('below')
  })

  it('rises above when there is no room underneath', () => {
    const anchor = { top: 600, left: 20, right: 1420, bottom: 780 }
    expect(choosePlacement(anchor, panel, viewport)).toBe('above')
  })

  it('falls back to the centre rather than placing the panel off screen', () => {
    const anchor = { top: 10, left: 10, right: 1430, bottom: 890 }
    expect(choosePlacement(anchor, panel, viewport)).toBe('center')
  })
})
