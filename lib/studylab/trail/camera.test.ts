// lib/studylab/trail/camera.test.ts
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LessonCompleteScene } from '@/components/studylab/stage/LessonCompleteScene'
import type { LessonRun } from '../lessonRun'
import { lessonSummary } from '../scenes'
import { cameraInsets } from '../spotlight'
import { cameraFor, easeOut, focusFraming, focusWidthFor, journeyFrame, panForKey, MIN_ZOOM } from './camera'
import { FOCUS_W, trailLayout } from './layout'
import type { PlotInput } from './types'

const box = { w: 1440, h: 900 }
const insets = { top: 72, right: 32, bottom: 128, left: 32 }

describe('cameraFor', () => {
  it('centres a frame that fits, capped at 1.0', () => {
    const v = cameraFor({ x: 100, y: 100, w: 640, h: 400 }, box, insets)
    expect(v.zoom).toBe(1)
    expect(100 * v.zoom + v.x + 320).toBeCloseTo(32 + (1440 - 64) / 2)
  })

  it('zooms out to fit, but not past readable', () => {
    expect(cameraFor({ x: 0, y: 0, w: 640, h: 750 }, box, insets).zoom).toBeCloseTo(700 / 750)
    expect(cameraFor({ x: 0, y: 0, w: 640, h: 3000 }, box, insets).zoom).toBe(MIN_ZOOM)
  })

  it('never lets 18 px text fall under 16 px on screen', () => {
    expect(18 * MIN_ZOOM).toBeGreaterThanOrEqual(16)
    const laptop = { w: 1366, h: 768 }
    expect(18 * cameraFor({ x: 0, y: 0, w: 640, h: 714 }, laptop, insets).zoom).toBeGreaterThanOrEqual(16)
  })

  it('a phone fits the width and pans for the rest, whatever the height', () => {
    const phone = { w: 390, h: 844 }
    const phoneInsets = cameraInsets(true)
    const v = cameraFor({ x: 0, y: 300, w: 358, h: 800 }, phone, phoneInsets, { minZoom: 1 })
    expect(v.zoom).toBe(1)
    expect(300 + v.y).toBeCloseTo(phoneInsets.top)
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

describe('focusFraming', () => {
  const base = { sized: true, alreadyFramed: false, lookingBack: false }
  it('a new focus, once measured, is flown to', () => {
    expect(focusFraming(base)).toBe('frame')
  })
  it('waits for a size, and frames each focus once', () => {
    expect(focusFraming({ ...base, sized: false })).toBe('hold')
    expect(focusFraming({ ...base, alreadyFramed: true })).toBe('hold')
  })
  it('a turn landing while looking back does not take the camera off the reopened card', () => {
    expect(focusFraming({ ...base, lookingBack: true })).toBe('mark')
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

describe('journeyFrame', () => {
  const plots = (n: number): PlotInput[] => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `S${i}`, state: 'future', focus: null, finished: [], filed: [], notes: 0 }))
  it('the pull-back shows the finished station and the next one together', () => {
    const world = trailLayout({ stations: plots(5), detours: [], focusWidth: FOCUS_W, speaker: true })
    const r = journeyFrame(world, 1, 2)
    for (const p of [world.plots[1].rect, world.plots[2].rect]) {
      expect(p.x).toBeGreaterThanOrEqual(r.x)
      expect(p.x + p.w).toBeLessThanOrEqual(r.x + r.w)
      expect(p.y).toBeGreaterThanOrEqual(r.y)
      expect(p.y + p.h).toBeLessThanOrEqual(r.y + r.h)
    }
  })
  it('includes their names, and the bit of trail between rows', () => {
    const world = trailLayout({ stations: plots(8), detours: [], focusWidth: FOCUS_W, speaker: true })
    const r = journeyFrame(world, 3, 4)
    expect(world.plots[3].label.y).toBeGreaterThanOrEqual(r.y)
    expect(world.plots[4].label.y).toBeGreaterThanOrEqual(r.y)
  })
  it('a station with no plot asks for the whole board', () => {
    const world = trailLayout({ stations: plots(3), detours: [], focusWidth: FOCUS_W, speaker: true })
    expect(journeyFrame(world, 9, 10)).toEqual(world.bounds)
  })
})

describe('the complete scene', () => {
  const run = { phase: 'done', steps: [], currentStep: -1 } as unknown as LessonRun
  const html = (p = {}) => renderToStaticMarkup(createElement(LessonCompleteScene, { title: 'T', summary: lessonSummary(run, [], 0), onClose() {}, ...p }))
  it('takes a mascot, and classic still shows Inky by default', () => {
    expect(html({ mascot: createElement('i', null, 'KANA') })).toContain('KANA')
    expect(html()).not.toContain('KANA')
  })
})

describe('focusWidthFor', () => {
  it('on a phone the card fills the width, and the camera shows it at full size', () => {
    expect(focusWidthFor(1440)).toBe(640)
    expect(focusWidthFor(390)).toBe(358)
    const v = cameraFor({ x: 0, y: 0, w: focusWidthFor(390), h: 400 }, { w: 390, h: 844 }, cameraInsets(true))
    expect(v.zoom).toBe(1)
  })
})
