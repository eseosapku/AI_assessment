/**
 * Every approved figure clears the same validators as a newly drawn one.
 *
 * The library used to skip them, on the grounds that a person had looked at
 * each figure. Run over it, today's validators refused 64 of 1,278: empty
 * tables, and shapes that cannot exist -- a "rectangle" with sides 5, 5, 4, 4.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { parseFigureSpec } from './figure-spec'
import { drawnFigureForFocus, drawnFigureCount, resetDrawnFigures } from './drawn-figures'

describe('the approved figure library', () => {
  const raw: any[] = JSON.parse(fs.readFileSync('data/drawn-figures.json', 'utf8'))

  it('keeps the spec each figure was drawn from', () => {
    expect(raw.every((f) => f.spec && f.spec.kind === f.kind)).toBe(true)
  })

  it('loads only figures whose spec passes today\'s validators', () => {
    resetDrawnFigures()
    const passing = raw.filter((f) => parseFigureSpec(f.spec)).length
    // Placeholder labels are refused too, so the loaded count is at most this.
    expect(drawnFigureCount()).toBeLessThanOrEqual(passing)
    expect(drawnFigureCount()).toBeLessThan(raw.length)
    expect(drawnFigureCount()).toBeGreaterThan(1000)
  })

  it('hands the route a real spec, not a stand-in', () => {
    resetDrawnFigures()
    const f = drawnFigureForFocus('interpreting a pie chart described in words', { stage: 9, seed: 1 })
    expect(f?.spec).toBeTruthy()
    if (f?.spec?.kind === 'piechart') expect(f.spec.slices.length).toBeGreaterThan(1)
  })
})

// "A bar chart of Languages spoken at home", "Goals scored for Soccer,
// Basketball, Hockey, Cricket", "Shoes Sold for Sneakers, Boots": 80 of the
// 354 Science charts in the approved library, drawn in bulk for the skills
// topics with whatever data came to hand, and printed beside Science
// questions about pets and football.
describe('a Science chart is about science', () => {
  it('never offers a Science paper a chart about pets, shoes, sport or music', async () => {
    const { drawnFigureForFocus } = await import('./drawn-figures')
    const NOT_SCIENCE = /\b(?:languages? spoken|shoes?|pets?|goals? scored|instruments?|fruits? sold|favou?rite)\b/i
    for (const focus of ['reading a results table described in words', 'spotting an anomalous result', 'describing a pattern in a set of results', 'drawing a conclusion the evidence supports']) {
      for (let seed = 0; seed < 60; seed++) {
        const f = drawnFigureForFocus(focus, { stage: 9, seed })
        if (f && f.subject === 'Science') expect(f.description, focus).not.toMatch(NOT_SCIENCE)
      }
    }
  })
})
