// lib/studylab/engines/shadows/shadows.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  shadowsEngine, shadowHeight, shadowLength, elevationAt, clock, madeDistance, madeTime, goodPrompt,
  PUPPET_CM, SCREEN_CM, HEIGHT_MIN, HEIGHT_MAX, DAY_TOL, SIZE_TOL, type ShadowsConfig, type ShadowsState,
} from './config'
import { ShadowsView, lampX, dayPos, distanceAtX, timeAtPoint } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const size = (height = 24) => shadowsEngine.parse({ task: 'size', height })! as Extract<ShadowsConfig, { task: 'size' }>
const day = () => shadowsEngine.parse({ task: 'day' })!

describe('shadow geometry', () => {
  it('uses similar triangles, not the drawing, for the screen shadow', () => {
    expect(shadowHeight(10)).toBe(PUPPET_CM * 2)
    expect(shadowHeight(20)).toBe(PUPPET_CM * 1.5)
    expect(shadowHeight(30)).toBe(16)
    expect(shadowHeight(12)).toBe(22)
    expect(shadowHeight(10)).toBeGreaterThan(shadowHeight(20))
  })

  it('uses the Sun elevation for a vertical 100 cm stick', () => {
    expect(elevationAt(12)).toBe(65)
    expect(elevationAt(8.5)).toBeCloseTo(elevationAt(15.5))
    expect(shadowLength(12)).toBeCloseTo(100 / Math.tan(65 * Math.PI / 180))
    expect(shadowLength(8.5)).toBeGreaterThan(shadowLength(12))
    expect(shadowLength(8.25)).toBeGreaterThan(shadowLength(9))
    expect(clock(8.5)).toBe('8:30 am')
    expect(clock(12)).toBe('12:00 pm')
    expect(clock(15.75)).toBe('3:45 pm')
  })

  it('maps hand positions back to the same semantic settings', () => {
    for (const d of [6, 10, 20, 30]) expect(distanceAtX(lampX(d))).toBeCloseTo(d)
    for (const t of [8, 10, 12, 14, 16]) {
      const p = dayPos(t)
      expect(timeAtPoint(p.x, p.y)).toBeCloseTo(t)
    }
  })
})

describe('reading and refusing configs', () => {
  it('reads task aliases, nested tasks and cm strings', () => {
    expect(shadowsEngine.parse({ task: 'shadow-puppet', target: '20 cm' })).toEqual({ task: 'size', height: 20 })
    expect(shadowsEngine.parse({ task: { kind: 'shadow stick' } })).toEqual({ task: 'day' })
    expect(shadowsEngine.parse({ targetHeight: 22 })).toEqual({ task: 'size', height: 22 })
    expect(shadowsEngine.parse({ task: 'resize', size: 'twice' })).toEqual({ task: 'size', height: 24 })
    expect(shadowsEngine.parse({ task: 'through the day' })).toEqual({ task: 'day' })
    expect(shadowsEngine.parse({ task: 'nonsense' })).toBeNull()
    expect(shadowsEngine.parse(null)).toBeNull()
  })

  it('refuses only values that cannot be drawn, with a nearby example', () => {
    expect(shadowsEngine.faults(size(18))).toEqual([])
    expect(shadowsEngine.faults(size(24))).toEqual([])
    expect(shadowsEngine.faults(size(100))[0]).toMatch(/18 to 24 cm, e.g. height 24/)
    expect(shadowsEngine.faults(size(2))[0]).toMatch(/e.g. height 18/)
    expect(shadowsEngine.faults(size(22.5))[0]).toMatch(/whole centimetres/)
    expect(shadowsEngine.faults(day())).toEqual([])
  })

  it('offers the scene to shadow stations, not neighbouring optics and orbit stations', () => {
    expect(scenesFor('Changing the size of a shadow').map((e) => e.id)).toContain('shadows')
    expect(scenesFor('Light travels in straight lines: how shadows form').map((e) => e.id)).toContain('shadows')
    expect(scenesFor('Shadow stick: shadows through the day').map((e) => e.id)).toContain('shadows')
    expect(scenesFor('Reflection and refraction of light').map((e) => e.id)).not.toContain('shadows')
    expect(scenesFor('Day and night').map((e) => e.id)).not.toContain('shadows')
    expect(scenesFor('Eclipses and the Moon').map((e) => e.id)).not.toContain('shadows')
    expect(scenesFor('The electromagnetic spectrum').map((e) => e.id)).not.toContain('shadows')
    expect(scenesFor('Sound waves').map((e) => e.id)).not.toContain('shadows')
    expect(sceneCatalogue('Transparent, translucent and opaque materials')).not.toContain('SCENE "shadows"')
  })
})

describe('the engine over every valid configuration', { timeout: 30_000 }, () => {
  const configs: ShadowsConfig[] = [
    ...Array.from({ length: HEIGHT_MAX - HEIGHT_MIN + 1 }, (_, i) => ({ task: 'size' as const, height: HEIGHT_MIN + i })),
    { task: 'day' },
  ]

  it('starts unsolved, solves, and only visibly near positions pass', () => {
    for (const config of configs) {
      const start = shadowsEngine.initial(config)
      const solved = shadowsEngine.solve(config)
      expect(shadowsEngine.faults(config), JSON.stringify(config)).toEqual([])
      expect(shadowsEngine.check(config, start).ok, JSON.stringify(config)).toBe(false)
      expect(shadowsEngine.check(config, solved), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      if (config.task === 'size') {
        const d = madeDistance(config, solved)
        expect(Math.abs(shadowHeight(d) - config.height)).toBeLessThanOrEqual(SIZE_TOL)
        // The tolerance is visible on the card, and the start is well outside it.
        expect(shadowHeight(d) - shadowHeight(d + SIZE_TOL)).toBeGreaterThan(0.2)
        expect(Math.abs(shadowHeight(madeDistance(config, start)) - config.height)).toBeGreaterThan(SIZE_TOL)
      } else {
        expect(shadowLength(madeTime(start))).toBeGreaterThan(shadowLength(12) + DAY_TOL)
        expect(shadowsEngine.check(config, { time: 8 }).ok).toBe(false)
        expect(shadowsEngine.check(config, { time: 16 }).ok).toBe(false)
        expect(shadowsEngine.check(config, { time: 11.5 }).ok).toBe(true)
        expect(shadowsEngine.check(config, { time: 12.5 }).ok).toBe(true)
      }
    }
  })

  it('reads damaged stored work safely and never marks it solved accidentally', () => {
    for (const config of configs) {
      expect(shadowsEngine.check(config, {} as ShadowsState).ok).toBe(false)
      expect(shadowsEngine.check(config, { distance: NaN, time: NaN }).ok).toBe(false)
      expect(shadowsEngine.check(config, { distance: Infinity, time: -100 }).ok).toBe(false)
    }
  })
})

const view = (config: ShadowsConfig, state: ShadowsState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
  renderToStaticMarkup(createElement(ShadowsView, { config, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' }))

describe('the card before and after marking', () => {
  it('has accessible drag controls, real stepper buttons and live measures', () => {
    const s = view(size(), shadowsEngine.initial(size()), 'idle')
    expect(s).toMatch(/data-torch-handle/)
    expect(s).toMatch(/role="slider"/)
    expect(s).toMatch(/aria-label="Move torch nearer the rabbit"/)
    expect(s).toMatch(/aria-label="Move torch away from the rabbit"/)
    expect(s).toMatch(/Shadow height/)
    expect(s).toMatch(/16.0/)
    expect(s).toMatch(/goal/)
    const d = view(day(), shadowsEngine.initial(day()), 'idle')
    expect(d).toMatch(/data-sun-handle/)
    expect(d).toMatch(/aria-label="Move the Sun 15 minutes earlier"/)
    expect(d).toMatch(/Shadow length/)
    expect(d).toMatch(/8:30 am/)
  })

  it('holds back the rules and the exact shortest time until marked', () => {
    const s = view(size(), shadowsEngine.initial(size()), 'idle').replace(/aria-label="[^"]*"/g, '')
    expect(s).not.toMatch(/straight lines/)
    expect(s).not.toMatch(/closer makes/)
    expect(s).not.toMatch(/similar triangles/)
    const d = view(day(), shadowsEngine.initial(day()), 'idle').replace(/aria-label="[^"]*"/g, '')
    expect(d).not.toMatch(/midday|noon|highest|12:00 pm/)
    const right = view(day(), shadowsEngine.solve(day()), 'right')
    expect(right).toMatch(/midday/)
    expect(right).toMatch(/highest/)
    expect(right).toMatch(/12:00 pm/)
  })

  it('says what was made, and gives exact values with a near pass', () => {
    const wrong = view(size(), { distance: 30 }, 'wrong')
    expect(wrong).toMatch(/Your rabbit shadow is 16 cm tall/)
    expect(wrong).toMatch(/blue marks are 24 cm apart/)
    const near = shadowsEngine.parse({ task: 'size', height: 20 })! as Extract<ShadowsConfig, { task: 'size' }>
    expect(shadowsEngine.check(near, { distance: 14.5 }).ok).toBe(true)
    expect(view(near, { distance: 14.5 }, 'right')).toMatch(/Near enough: the exact goal is 20 cm/)
    const wrongDay = view(day(), { time: 8.5 }, 'wrong')
    expect(wrongDay).toMatch(/pointing west/)
    expect(view(day(), { time: 11.5 }, 'right')).toMatch(/Near enough/)
  })

  it('draws no answer in the whole activity before marking', () => {
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt: goodPrompt(day()), payload: { engine: 'shadows', config: { task: 'day' } }, success: { kind: 'scene' } } },
    } as never))).replace(goodPrompt(day()), '')
    expect(html).not.toMatch(/midday|noon|highest|12:00 pm/)
    expect(html).toMatch(/data-sun-handle/)
    expect(html).toMatch(/Shadow stick/)
  })

  it('is registered with the right id and isolates', () => {
    expect(getEngine('shadows')).toBe(shadowsEngine)
    expect(shadowsEngine.id).toBe('shadows')
    expect(shadowsEngine.isolates).toBe('position')
    expect(shadowsEngine.prompt).toMatch(/"engine":"shadows"/)
    expect(shadowsEngine.prompt).toMatch(/"apparatus":"scene:shadows"/)
    expect(shadowsEngine.prompt).toMatch(/"isolates":"position"/)
  })
})

describe('prompts', () => {
  it('rejects answers and gestures or tasks the card does not have', () => {
    expect(shadowsEngine.promptFaults!(size(), 'Move the torch closer to make the shadow bigger.').join(' ')).toMatch(/gives the answer away/)
    expect(shadowsEngine.promptFaults!(size(), 'Make a 24 cm shadow.').join(' ')).toMatch(/say the gesture/)
    expect(shadowsEngine.promptFaults!(size(), 'Drag the torch to compare transparent and translucent materials.').join(' ')).toMatch(/does not show/)
    expect(shadowsEngine.promptFaults!(day(), 'Drag the Sun to noon, when it is highest.').join(' ')).toMatch(/gives the answer away/)
    expect(shadowsEngine.promptFaults!(size(), goodPrompt(size()))).toEqual([])
    expect(shadowsEngine.promptFaults!(day(), goodPrompt(day()))).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('shadows')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)",\s*\n\s*"payload": \{ "engine":"shadows", "config": (\{[^\n]+\}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
      expect(e.promptFaults!(config, m[1])).toEqual([])
    }
  })
})
