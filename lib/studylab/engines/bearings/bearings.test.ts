// lib/studylab/engines/bearings/bearings.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { bearingsEngine, bearingText, initialAngle, madeText, norm360, targetOf, working, type BearingsConfig } from './config'
import { arcPath, DRAW_TOLERANCE, pointAt, routePoints, sectorPath, W, H } from './View'
import { BEARING_TOLERANCE } from './config'
import { getEngine, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const all: BearingsConfig[] = [
  ...Array.from({ length: 360 }, (_, target): BearingsConfig => ({ task: 'set', target })),
  ...Array.from({ length: 360 }, (_, outward): BearingsConfig => ({ task: 'back', outward })),
]

describe('bearings as mathematics', () => {
  it('is clockwise from north, with three figures and a full turn written as 000', () => {
    expect(bearingText(0)).toBe('000°')
    expect(bearingText(45)).toBe('045°')
    expect(bearingText(360)).toBe('000°')
    expect(bearingText(-90)).toBe('270°')
    expect(norm360(725)).toBe(5)
    expect(pointAt({ x: 0, y: 0 }, 0, 10)).toEqual({ x: 0, y: -10 })
    expect(pointAt({ x: 0, y: 0 }, 90, 10).x).toBeCloseTo(10)
    expect(pointAt({ x: 0, y: 0 }, 90, 10).y).toBeCloseTo(0)
  })

  it('reverses a bearing by exactly 180 degrees', () => {
    expect(targetOf({ task: 'back', outward: 50 })).toBe(230)
    expect(targetOf({ task: 'back', outward: 275 })).toBe(95)
    expect(targetOf({ task: 'back', outward: 180 })).toBe(0)
    expect(targetOf({ task: 'back', outward: 359 })).toBe(179)
  })

  it('draws a genuinely clockwise sector, including reflex sectors', () => {
    expect(arcPath({ x: 0, y: 0 }, 20, 90)).toContain('0 0 1')
    expect(arcPath({ x: 0, y: 0 }, 20, 230)).toContain('0 1 1')
    expect(sectorPath({ x: 0, y: 0 }, 20, 0)).toContain('Z')
    expect(arcPath({ x: 0, y: 0 }, 20, 0)).toBe('')
  })
})

describe('reading the tutor config', () => {
  it('reads reasonable names, nested tasks and degree signs', () => {
    expect(bearingsEngine.parse({ task: 'set', target: '045°' })).toEqual({ task: 'set', target: 45 })
    expect(bearingsEngine.parse({ task: { kind: 'back-bearing', outward: 50 } })).toEqual({ task: 'back', outward: 50 })
    expect(bearingsEngine.parse({ task: 'return', bearing: '275 degrees' })).toEqual({ task: 'back', outward: 275 })
    expect(bearingsEngine.parse({ task: 'set-course', course: 230 })).toEqual({ task: 'set', target: 230 })
    expect(bearingsEngine.parse(null)).toBeNull()
    expect(bearingsEngine.parse({ task: 'set' })).toEqual({ task: 'set', target: 45 })
    expect(bearingsEngine.parse({ task: 'sail', target: 45 })).toBeNull()
  })

  it('refuses narrowly, with a nearby whole degree that works', () => {
    expect(bearingsEngine.faults({ task: 'set', target: 360 })[0]).toMatch(/0 to 359.*target 359/)
    expect(bearingsEngine.faults({ task: 'back', outward: -50 })[0]).toMatch(/outward 0/)
    expect(bearingsEngine.faults({ task: 'set', target: 45.5 })[0]).toMatch(/whole-degree/)
    expect(bearingsEngine.faults({ task: 'set', target: 45 })).toEqual([])
    expect(bearingsEngine.faults({ task: 'back', outward: 230 })).toEqual([])
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and solve passes check, for all 720 cards', () => {
    expect(all).toHaveLength(720)
    for (const c of all) {
      const label = JSON.stringify(c)
      expect(bearingsEngine.parse(c), label).toEqual(c)
      expect(bearingsEngine.faults(c), label).toEqual([])
      expect(bearingsEngine.check(c, bearingsEngine.initial(c)).ok, `${label} starts solved`).toBe(false)
      expect(bearingsEngine.check(c, bearingsEngine.solve(c)).ok, `${label} cannot be solved`).toBe(true)
      expect(Math.abs(norm360(bearingsEngine.initial(c).angle! - targetOf(c)))).toBe(180)
    }
  })

  it('accepts a visible near-enough setting, with the exact answer in its sentence', () => {
    const c: BearingsConfig = { task: 'set', target: 45 }
    expect(BEARING_TOLERANCE).toBe(2)
    expect(DRAW_TOLERANCE).toBe(BEARING_TOLERANCE)
    expect(bearingsEngine.check(c, { angle: 42 }).ok).toBe(false)
    expect(bearingsEngine.check(c, { angle: 43 }).ok).toBe(true)
    expect(bearingsEngine.check(c, { angle: 45 }).ok).toBe(true)
    expect(bearingsEngine.check(c, { angle: 47 }).ok).toBe(true)
    expect(bearingsEngine.check(c, { angle: 48 }).ok).toBe(false)
    expect(bearingsEngine.check(c, { angle: 405 }).ok).toBe(true)
    expect(bearingsEngine.check(c, {})).toEqual({ ok: false, wrongIds: ['course'] })
    expect(bearingsEngine.check(c, { angle: NaN }).ok).toBe(false)
    expect(working(c, { angle: 44 })).toMatch(/^Near enough — the exact answer is 045°\./)
  })
})

describe('the route stays on its paper', () => {
  it('keeps both places, their labels and both local north lines inside for every outward bearing', () => {
    for (let out = 0; out < 360; out++) {
      const { a, b } = routePoints(out)
      for (const p of [a, b]) {
        expect(p.x, `${out} x`).toBeGreaterThanOrEqual(132)
        expect(p.x, `${out} x`).toBeLessThanOrEqual(228)
        expect(p.y, `${out} y`).toBeGreaterThanOrEqual(68)
        expect(p.y, `${out} y`).toBeLessThanOrEqual(164)
        // N is 33 above the point; A and B sit level with it, 14px to the side.
        expect(p.y - 39, `${out} north label`).toBeGreaterThanOrEqual(12)
        expect(p.y + 5, `${out} place label`).toBeLessThanOrEqual(H - 55)
        expect(p.x - 9).toBeGreaterThanOrEqual(12)
        expect(p.x + 9).toBeLessThanOrEqual(W - 12)
      }
    }
  })
})

describe('what the card says and hides', () => {
  const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'bearings', config }, success: { kind: 'scene' } } },
  } as never)))

  it('has a named goal, a live three-figure measure and accessible controls', () => {
    const html = card({ task: 'set', target: 45 }, 'Drag the blue handle to set the course from A to B to 045°. The arrow keys turn it too.')
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-label="Course direction. Drag the blue handle, or use the arrow keys"')
    expect(html).toContain('aria-label="Turn course 1 degree clockwise"')
    expect(html).toContain('Set the course A → B')
    expect(html).toContain('data-course="225"')
    expect(html).toContain('Clockwise from north')
  })

  it('holds the back-bearing answer and half-turn working until marked, including screen-reader text', () => {
    const prompt = 'The outward course from A to B is 050°. Drag the blue handle at B to point the return course back to A. The arrow keys turn it too.'
    const html = card({ task: 'back', outward: 50 }, prompt).replace(prompt, '')
    expect(html).not.toContain('230°')
    expect(html).not.toMatch(/half.turn|parallel, so reversing|180° =/)
    expect(html).toContain('data-course="50"')
    expect(html).toContain('Return course from B')
  })

  it('says what was made when wrong, and explains the half turn when right', () => {
    const c: BearingsConfig = { task: 'back', outward: 275 }
    expect(initialAngle(c)).toBe(275)
    expect(madeText(c, { angle: 275 })).toContain('275°')
    expect(working(c)).toContain('275° − 180° = 095°')
    expect(working(c)).toContain('Parallel north lines')
    const set: BearingsConfig = { task: 'set', target: 45 }
    expect(working(set)).toContain('045°')
    expect(madeText(set, { angle: 46 })).toContain('046°')
  })
})

describe('catalogue and prompts', () => {
  it('is registered with the matching isolates and catches bearings stations, not near neighbours', () => {
    expect(getEngine('bearings')).toBe(bearingsEngine)
    expect(bearingsEngine.isolates).toBe('position')
    expect(bearingsEngine.prompt).toContain('SCENE "bearings"')
    expect(bearingsEngine.prompt).toContain('"apparatus":"scene:bearings"')
    expect(bearingsEngine.prompt).toContain('"isolates":"position"')
    expect(scenesFor('Three-figure bearings and back bearings').map((e) => e.id)).toContain('bearings')
    expect(scenesFor('Navigation and compass directions in maths').map((e) => e.id)).toContain('bearings')
    expect(scenesFor('Magnetic fields and the plotting compass').map((e) => e.id)).not.toContain('bearings')
    expect(scenesFor('Sine and cosine rules').map((e) => e.id)).not.toContain('bearings')
  })

  it('refuses prompts that reveal a back bearing or promise undrawn work', () => {
    const c: BearingsConfig = { task: 'back', outward: 50 }
    expect(bearingsEngine.promptFaults!(c, 'The outward course is 050°. Drag to 230°.').join(' ')).toMatch(/gives away/)
    expect(bearingsEngine.promptFaults!(c, 'The outward course is 050°. Add 180° and drag back.').join(' ')).toMatch(/gives away/)
    expect(bearingsEngine.promptFaults!(c, 'Drag the handle back, then calculate the distance in km.').join(' ')).toMatch(/does not show/)
    expect(bearingsEngine.promptFaults!(c, 'Point back to A.').join(' ')).toMatch(/gesture/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('bearings')!
    const found = [...e.prompt.matchAll(/"prompt":\s*"([^"]+)"[\s\S]*?"config":\s*(\{[\s\S]*?\})\s*\},\s*"success"/g)]
    expect(found.length).toBe(2)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(e.faults(c)).toEqual([])
      expect(e.promptFaults!(c, m[1])).toEqual([])
      expect(e.check(c, e.initial(c)).ok).toBe(false)
      expect(e.check(c, e.solve(c)).ok).toBe(true)
    }
  })
})
