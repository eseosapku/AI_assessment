// lib/studylab/demoRing.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * The demo rings the control its cue names by putting an attribute on it.
 * The ring once set `position: relative`, which outranked `.absolute` and
 * dropped the docked bar -- an absolutely placed control -- out of view at
 * every "Press Continue" cue. A ring is a shadow; it must not move anything.
 */
describe('the demo ring', () => {
  it('draws a ring without repositioning the control it rings', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    const rule = css.match(/\[data-demo-here\]\s*\{([^}]*)\}/)
    expect(rule, 'no [data-demo-here] rule').toBeTruthy()
    expect(rule![1]).not.toMatch(/\bposition\s*:/)
  })
})
