import { describe, it, expect } from 'vitest'
import { TOURS, clampStep, hasSeenTour, choosePlacement, type TourId } from './product-tour'

const ALL = Object.values(TOURS)

describe('every tour', () => {
  it('is short enough to finish', () => {
    // The report asked for 3-5 steps. Longer than that and it gets skipped,
    // which teaches nobody anything.
    for (const tour of ALL) {
      expect(tour.steps.length, `${tour.id} has ${tour.steps.length} steps`).toBeGreaterThanOrEqual(3)
      expect(tour.steps.length, `${tour.id} has ${tour.steps.length} steps`).toBeLessThanOrEqual(5)
    }
  })

  it('teaches rather than narrating the screen', () => {
    // "Watch it move — scores and grades over time" described a page and
    // taught nothing. A step has to earn its interruption.
    for (const tour of ALL) {
      for (const step of tour.steps) {
        expect(step.body.length, `${tour.id}/${step.anchor} is too thin`).toBeGreaterThan(90)
        expect(step.title.length).toBeGreaterThan(12)
        expect(step.eyebrow.length).toBeGreaterThan(0)
      }
    }
  })

  it('never titles a step with the name of the thing it points at', () => {
    for (const tour of ALL) {
      for (const step of tour.steps) {
        expect(step.title.toLowerCase()).not.toBe(step.anchor.replace(/[/-]/g, ' ').trim())
      }
    }
  })

  it('keys its id to the record it is stored under', () => {
    for (const [key, tour] of Object.entries(TOURS)) {
      expect(tour.id).toBe(key)
    }
  })

  it('does not repeat a title across surfaces', () => {
    const titles = ALL.flatMap((t) => t.steps.map((s) => s.title))
    expect(new Set(titles).size).toBe(titles.length)
  })
})

describe('anchors', () => {
  it('points every step at a data-tour value that exists in the markup', () => {
    // Anchors are data-tour attributes, not element paths: the original
    // selector walked the shell's structure and broke silently when the
    // sidebar changed tag, leaving the tour pointing at nothing.
    const known: Record<TourId, string[]> = {
      home: ['hero-cta', '/practice', '/studylab', '/studylab/gap-map', '/progress', '/classrooms'],
      practice: ['practice-build', 'practice-custom', 'practice-modes'],
      learnspace: ['learnspace-new', 'learnspace-homework', 'learnspace-list'],
      gapmap: ['gapmap-canvas', 'gapmap-legend'],
      progress: ['progress-overall', 'progress-subjects', 'progress-recent'],
      recall: ['recall-due', 'recall-decks'],
    }
    for (const tour of ALL) {
      for (const step of tour.steps) {
        expect(known[tour.id], `${tour.id}: ${step.anchor} has no data-tour target`).toContain(step.anchor)
      }
    }
  })

  it('opens each tour on something the student can act on', () => {
    // Not a heading, and not a menu item. The lost tester was hunting for a
    // control, so step one is always a control.
    expect(TOURS.home.steps[0].anchor).toBe('hero-cta')
    expect(TOURS.practice.steps[0].anchor).toBe('practice-build')
    expect(TOURS.learnspace.steps[0].anchor).toBe('learnspace-new')
  })
})

describe('clampStep', () => {
  it('keeps the index inside the tour it was given', () => {
    expect(clampStep(-5, 3)).toBe(0)
    expect(clampStep(1, 3)).toBe(1)
    expect(clampStep(99, 3)).toBe(2)
  })

  it('defaults to the home tour when no length is given', () => {
    expect(clampStep(99)).toBe(TOURS.home.steps.length - 1)
  })
})

describe('hasSeenTour', () => {
  it('reports seen when storage is unavailable, so it cannot loop', () => {
    // Better never to run than to run on every single page load.
    for (const id of Object.keys(TOURS) as TourId[]) {
      expect(hasSeenTour(id)).toBe(true)
    }
  })
})

describe('choosePlacement', () => {
  const panel = { width: 348, height: 240 }
  const viewport = { width: 1440, height: 900 }

  it('prefers the right of the anchor when there is room', () => {
    expect(choosePlacement({ top: 200, left: 40, right: 240, bottom: 240 }, panel, viewport)).toBe('right')
  })

  it('flips to the left when the anchor is against the right edge', () => {
    expect(choosePlacement({ top: 200, left: 1300, right: 1420, bottom: 240 }, panel, viewport)).toBe('left')
  })

  it('drops below when the anchor spans the width', () => {
    expect(choosePlacement({ top: 100, left: 20, right: 1420, bottom: 300 }, panel, viewport)).toBe('below')
  })

  it('rises above when there is no room underneath', () => {
    expect(choosePlacement({ top: 600, left: 20, right: 1420, bottom: 780 }, panel, viewport)).toBe('above')
  })

  it('falls back to the centre rather than placing the panel off screen', () => {
    expect(choosePlacement({ top: 10, left: 10, right: 1430, bottom: 890 }, panel, viewport)).toBe('center')
  })
})
