import { describe, it, expect } from 'vitest'
import { projectGaps, projectLift, projectTimeline, SCENARIO } from './projection'

describe('projectGaps', () => {
  it('lands on the headline figures the model is built to produce', () => {
    const g = projectGaps()
    expect(g.identified).toBe(21_436)
    expect(g.closed).toBe(16_091)
  })

  it('never reports more gaps closed than were found', () => {
    // The one arithmetic error that would discredit the whole page.
    const g = projectGaps()
    expect(g.closed).toBeLessThanOrEqual(g.identified)
    expect(g.stillOpen).toBe(g.identified - g.closed)
  })

  it('states a closure rate consistent with its own two figures', () => {
    const g = projectGaps()
    expect(g.closureRate).toBeCloseTo((g.closed / g.identified) * 100, 1)
  })

  it('shows the full chain, starting from the cohort and ending at the total', () => {
    const g = projectGaps()
    expect(g.identifiedChain[0].label).toBe('Active students')
    expect(g.identifiedChain[0].runningTotal).toBe(SCENARIO.students.value)
    expect(g.identifiedChain.at(-1)?.runningTotal).toBe(g.identified)
  })

  it('marks which links are evidence and which are assumptions', () => {
    // A projection whose factors all look equally solid is a lie by layout.
    const bases = projectGaps().identifiedChain.map((s) => s.basis)
    expect(bases).toContain('observed')
    expect(bases).toContain('modelled')
  })

  it('gives every factor a note explaining where it came from', () => {
    for (const step of [...projectGaps().identifiedChain, ...projectGaps().closedChain]) {
      expect(step.note.length, step.label).toBeGreaterThan(10)
    }
  })

  it('starts the closure chain from the identified total', () => {
    const g = projectGaps()
    expect(g.closedChain[0].runningTotal).toBe(g.identified)
    expect(g.closedChain.at(-1)?.runningTotal).toBe(g.closed)
  })
})

describe('projectLift', () => {
  it('reports the gain the model targets', () => {
    expect(projectLift().deltaPoints).toBe(12.4)
  })

  it('keeps the live starting point rather than inventing a flattering one', () => {
    // Moving the baseline as well as the finish would make the gain
    // unfalsifiable; 55.7% is what the live data actually measures.
    expect(projectLift().firstThreeAvg).toBe(55.7)
  })

  it('derives the relative figure from the two averages', () => {
    const l = projectLift()
    expect(l.deltaRelative).toBeCloseTo(((l.lastThreeAvg - l.firstThreeAvg) / l.firstThreeAvg) * 100, 1)
  })
})

describe('projectTimeline', () => {
  it('returns twelve months, oldest first so a chart reads left to right', () => {
    const t = projectTimeline()
    expect(t).toHaveLength(12)
    expect([...t].sort((a, b) => a.month.localeCompare(b.month))).toEqual(t)
  })

  it('sums to exactly the headline totals, so chart and cards cannot disagree', () => {
    const t = projectTimeline()
    const g = projectGaps()
    expect(t.reduce((a, p) => a + p.identified, 0)).toBe(g.identified)
    expect(t.reduce((a, p) => a + p.closed, 0)).toBe(g.closed)
  })

  it('never closes more gaps than it opened in a month', () => {
    for (const p of projectTimeline()) {
      expect(p.closed, p.month).toBeLessThanOrEqual(p.identified)
    }
  })

  it('grows rather than sitting flat', () => {
    const t = projectTimeline()
    expect(t.at(-1)!.identified).toBeGreaterThan(t[0].identified)
  })
})
