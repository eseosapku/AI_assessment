// lib/studylab/meaning/vary.test.ts
import { describe, it, expect } from 'vitest'
import { varyFaults, samplePositions } from './vary'
import { varyModule } from '../activities/patterns/vary'
import type { VaryPayload } from '../activities/types'

/**
 * A slider card has to move what it shows, and be marked on it. The Moon card
 * that read 50% at every angle, and counted as solved at 45 degrees of slider,
 * is the case these pin.
 */
const MOON: VaryPayload = {
  variable: { id: 'angle', label: 'Moon position in orbit', min: 0, max: 360, step: 15, unit: 'degrees' },
  model: { kind: 'bars', bars: [{ label: 'Lit half of Moon', expr: '50', max: 50 }] },
  readouts: [{ label: 'Lit half of Moon', expr: '50', unit: '%' }],
  scene: 'asset:globe',
}
const RIVER: VaryPayload = {
  variable: { id: 'g', label: 'Gradient', min: 0, max: 20, step: 1, unit: 'degrees' },
  model: { kind: 'bars', bars: [{ label: 'Flow speed', expr: 'g * 2', max: 40 }] },
  readouts: [{ label: 'Flow speed', expr: 'g * 2', unit: 'cm/s' }],
  target: { expr: 'g * 2', value: 30, tolerance: 2 },
}
const words = (p: VaryPayload) => varyFaults(p).join(' | ')

describe('varyFaults', () => {
  it('refuses a bar that reads the same at every slider position', () => {
    expect(words(MOON)).toMatch(/"Lit half of Moon" reads 50 at every slider position/)
  })

  it('refuses a bar that barely moves, or is always full or always empty', () => {
    const barely = { ...RIVER, model: { kind: 'bars' as const, bars: [{ label: 'Flow speed', expr: '100 + g * 0.1', max: 200 }] } }
    expect(words(barely)).toMatch(/"Flow speed" hardly moves/)
    const full = { ...RIVER, model: { kind: 'bars' as const, bars: [{ label: 'Flow speed', expr: '50 + g', max: 40 }] } }
    expect(words(full)).toMatch(/"Flow speed" is full at every slider position/)
    const empty = { ...RIVER, model: { kind: 'bars' as const, bars: [{ label: 'Flow speed', expr: '0 - g', max: 40 }] } }
    expect(words(empty)).toMatch(/"Flow speed" is empty at every slider position/)
  })

  it('refuses a plot whose slider is called x: the curve would never move', () => {
    const plot: VaryPayload = { ...RIVER, variable: { ...RIVER.variable, id: 'x' }, model: { kind: 'plot', fn: 'x * x', xRange: [0, 5], yRange: [0, 25] }, target: { expr: 'x * 2', value: 10, tolerance: 1 } }
    expect(words(plot)).toMatch(/slider is named "x"/)
  })

  it('refuses a card marked on the slider instead of on what the learner watches', () => {
    const { target: _t, ...noTarget } = RIVER
    expect(words(noTarget as VaryPayload)).toMatch(/give a "target"/)
  })

  it('refuses a target no slider position reaches, and one met before the slider moves', () => {
    expect(words({ ...RIVER, target: { expr: 'g * 2', value: 99, tolerance: 1 } })).toMatch(/no slider position reaches the target/)
    expect(words({ ...RIVER, target: { expr: 'g * 2', value: 0, tolerance: 1 } })).toMatch(/solved before the slider moves/)
  })

  it('passes a card whose bar moves and whose target is reached part-way along', () => {
    expect(varyFaults(RIVER)).toEqual([])
  })
})

describe('samplePositions', () => {
  it('runs from min to max on the slider’s own steps', () => {
    expect(samplePositions({ id: 'g', label: 'G', min: 0, max: 20, step: 1 })).toEqual(expect.arrayContaining([0, 20]))
    const p = samplePositions({ id: 'g', label: 'G', min: 0, max: 20, step: 5 })
    expect(p.every((v) => v % 5 === 0)).toBe(true)
  })
})

describe('marking a slider card', () => {
  it('marks what the learner watches when the card names a target', () => {
    const rule = { kind: 'numericWithin' as const, target: 7, tolerance: 1 }
    // Flow 30 at gradient 15: right, though the slider's own rule says 7.
    expect(varyModule.validate(RIVER, { value: 15 }, rule).ok).toBe(true)
    expect(varyModule.validate(RIVER, { value: 7 }, rule).ok).toBe(false)
  })

  it('still marks an old card on the slider, as it always was', () => {
    const { target: _t, ...old } = RIVER
    expect(varyModule.validate(old as VaryPayload, { value: 7 }, { kind: 'numericWithin', target: 7, tolerance: 1 }).ok).toBe(true)
  })
})
