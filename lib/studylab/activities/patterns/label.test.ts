import { describe, it, expect } from 'vitest'
import { labelModule } from './label'
import type { LabelPayload } from '../types'

const payload: LabelPayload = {
  image: { svg: '<circle cx="50" cy="50" r="40"/>', width: 200, height: 200 },
  hotspots: [
    { id: 'h1', x: 50, y: 50, r: 12, label: 'Nucleus' },
    { id: 'h2', x: 120, y: 60, r: 12, label: 'Cell wall' },
  ],
}
const success = { kind: 'pairing', pairs: [['h1', 'Nucleus'], ['h2', 'Cell wall']] } as const

describe('labelModule', () => {
  it('starts with no labels placed', () => {
    expect(labelModule.initialWork(payload)).toEqual({ assign: {} })
  })
  it('passes when each hotspot has its own label', () => {
    expect(labelModule.validate(payload, { assign: { h1: 'Nucleus', h2: 'Cell wall' } }, success).ok).toBe(true)
  })
  it('fails and names the mislabelled hotspot', () => {
    const r = labelModule.validate(payload, { assign: { h1: 'Cell wall', h2: 'Cell wall' } }, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds).toContain('h1')
  })
  it('refuses a label that belongs to no hotspot (control of error)', () => {
    expect(labelModule.accepts!(payload, { assign: {} }, { itemId: 'Nucleus', targetId: 'h1' })).toBe(true)
    expect(labelModule.accepts!(payload, { assign: {} }, { itemId: 'Nucleus', targetId: 'h2' })).toBe(false)
  })
  it('validates payload shape', () => {
    expect(labelModule.isPayload(payload)).toBe(true)
    expect(labelModule.isPayload({ image: {}, hotspots: [] })).toBe(false)
  })
  it('rejects an unknown hotspot id in accepts()', () => {
    expect(labelModule.accepts!(payload, { assign: {} }, { itemId: 'Nucleus', targetId: 'does-not-exist' })).toBe(false)
  })
  it('rejects a label that belongs to a different hotspot', () => {
    expect(labelModule.accepts!(payload, { assign: {} }, { itemId: 'Cell wall', targetId: 'h1' })).toBe(false)
  })
  it('exact wrongIds contents when both hotspots are mislabelled', () => {
    const r = labelModule.validate(payload, { assign: { h1: 'x', h2: 'y' } }, success)
    expect(r.ok).toBe(false)
    expect(r.wrongIds.slice().sort()).toEqual(['h1', 'h2'])
  })

  describe('isPayload numeric guards', () => {
    it('accepts the valid payload', () => {
      expect(labelModule.isPayload(payload)).toBe(true)
    })
    it('rejects a missing width', () => {
      const { width, ...imageNoWidth } = payload.image
      expect(labelModule.isPayload({ ...payload, image: imageNoWidth })).toBe(false)
    })
    it('rejects width: 0', () => {
      expect(labelModule.isPayload({ ...payload, image: { ...payload.image, width: 0 } })).toBe(false)
    })
    it('rejects width: -10', () => {
      expect(labelModule.isPayload({ ...payload, image: { ...payload.image, width: -10 } })).toBe(false)
    })
    it('rejects width: NaN', () => {
      expect(labelModule.isPayload({ ...payload, image: { ...payload.image, width: NaN } })).toBe(false)
    })
    it('rejects a hotspot with r: 0', () => {
      const hotspots = [{ ...payload.hotspots[0], r: 0 }, payload.hotspots[1]]
      expect(labelModule.isPayload({ ...payload, hotspots })).toBe(false)
    })
    it('rejects a hotspot with a non-numeric x', () => {
      const hotspots = [{ ...payload.hotspots[0], x: 'fifty' as unknown as number }, payload.hotspots[1]]
      expect(labelModule.isPayload({ ...payload, hotspots })).toBe(false)
    })
    it('rejects duplicate hotspot ids', () => {
      const hotspots = [payload.hotspots[0], { ...payload.hotspots[1], id: payload.hotspots[0].id }]
      expect(labelModule.isPayload({ ...payload, hotspots })).toBe(false)
    })
    it('rejects two hotspots sharing the same label (the renderer keys placed labels by text — the second would be permanently unfillable)', () => {
      const hotspots = [payload.hotspots[0], { ...payload.hotspots[1], label: payload.hotspots[0].label }]
      expect(labelModule.isPayload({ ...payload, hotspots })).toBe(false)
    })
  })
})
