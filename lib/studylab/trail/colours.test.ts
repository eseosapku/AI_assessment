// lib/studylab/trail/colours.test.ts
import { describe, it, expect } from 'vitest'
import { TRAIL_COLOURS } from './colours'

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('Trail colours', () => {
  it('trail and grid hold 3:1 on the dark canvas, and the trail does on the light one', () => {
    const { light, dark } = TRAIL_COLOURS
    for (const c of [...dark.tile, ...dark.done, dark.grid]) expect(contrast(c, dark.canvas)).toBeGreaterThanOrEqual(3)
    for (const c of [...light.tile, ...light.done]) expect(contrast(c, light.canvas)).toBeGreaterThanOrEqual(3)
  })

  it('the primary label: ink on the gradient', () => {
    expect(contrast('#16202A', '#2ACBF2')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#16202A', '#0C86CE')).toBeGreaterThanOrEqual(3)
  })
})
