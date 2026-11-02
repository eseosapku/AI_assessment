// lib/studylab/trail/camera.test.ts
import { describe, it, expect } from 'vitest'
import { cameraFor, easeOut, panForKey, MIN_ZOOM } from './camera'

const box = { w: 1440, h: 900 }
const insets = { top: 72, right: 32, bottom: 128, left: 32 }

describe('cameraFor', () => {
  it('centres a frame that fits, capped at 1.0', () => {
    const v = cameraFor({ x: 100, y: 100, w: 640, h: 400 }, box, insets)
    expect(v.zoom).toBe(1)
    expect(100 * v.zoom + v.x + 320).toBeCloseTo(32 + (1440 - 64) / 2)
  })

  it('zooms out to fit, but not past readable', () => {
    expect(cameraFor({ x: 0, y: 0, w: 640, h: 1000 }, box, insets).zoom).toBeCloseTo(700 / 1000)
    expect(cameraFor({ x: 0, y: 0, w: 640, h: 3000 }, box, insets).zoom).toBe(MIN_ZOOM)
  })

  it('a frame too tall to fit shows its top, below the top bar', () => {
    const v = cameraFor({ x: 0, y: 500, w: 640, h: 3000 }, box, insets)
    expect(500 * v.zoom + v.y).toBeCloseTo(insets.top)
  })

  it('a frame too wide to fit shows its left edge, not its middle', () => {
    const narrow = { w: 300, h: 800 }
    const v = cameraFor({ x: 200, y: 0, w: 640, h: 200 }, narrow, { top: 72, right: 16, bottom: 128, left: 16 })
    expect(200 * v.zoom + v.x).toBeCloseTo(16)
  })

  it('a short window still shows the start of the card above the button', () => {
    const short = { w: 1440, h: 420 }
    const v = cameraFor({ x: 0, y: 300, w: 640, h: 900 }, short, insets)
    expect(v.zoom).toBe(MIN_ZOOM)
    expect(300 * v.zoom + v.y).toBeCloseTo(insets.top)
    expect(300 * v.zoom + v.y).toBeLessThan(short.h - insets.bottom)
  })

  it('takes a lower floor when asked: the whole board is not a card to read', () => {
    expect(cameraFor({ x: 0, y: 0, w: 3000, h: 3000 }, box, insets, { minZoom: 0.1 }).zoom).toBeCloseTo(700 / 3000)
  })
})

describe('panForKey', () => {
  it('arrow keys pan, nothing else does', () => {
    expect(panForKey('ArrowLeft')).toEqual({ x: 80, y: 0 })
    expect(panForKey('ArrowRight')).toEqual({ x: -80, y: 0 })
    expect(panForKey('ArrowUp')).toEqual({ x: 0, y: 80 })
    expect(panForKey('ArrowDown')).toEqual({ x: 0, y: -80 })
    expect(panForKey('Enter')).toBeNull()
  })
})

describe('easeOut', () => {
  it('starts at 0, lands at 1, and slows down', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
  })
})
