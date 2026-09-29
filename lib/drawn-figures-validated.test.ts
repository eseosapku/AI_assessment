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
