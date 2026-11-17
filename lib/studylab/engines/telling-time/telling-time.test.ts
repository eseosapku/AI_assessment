// lib/studylab/engines/telling-time/telling-time.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'
import { getEngine, scenesFor } from '../registry'
import '..'
import {
  tellingTimeEngine, readTime, digital, timeWords, durationText, elapsedOf, readMinutes, working, madeText,
  type TimeConfig, type TimeState,
} from './config'
import { W, H, CX, CY, FACE_R, MINUTE_R, pointAt, minuteFromPoint, hourAngle, minuteAngle, TellingTimeView } from './View'

vi.spyOn(console, 'error').mockImplementation(() => {})

const set = (target: unknown, format: '12' | '24' = '12') => tellingTimeEngine.parse({ task: 'set', target, format })!
const interval = (start: unknown, end: unknown) => tellingTimeEngine.parse({ task: 'elapsed', start, end })!

describe('real clock time and ordinary language', () => {
  it('reads digital, am/pm and classroom forms broadly', () => {
    expect(readTime('00:00')).toBe(0)
    expect(readTime('15:45')).toBe(945)
    expect(readTime('3:30 pm')).toBe(930)
    expect(readTime('12 am')).toBe(0)
    expect(readTime('12 pm')).toBe(720)
    expect(readTime('11:05 AM')).toBe(665)
    expect(readTime('3.30 pm')).toBe(930)
    expect(readTime("3 o'clock")).toBe(180)
    expect(readTime('half past 3')).toBe(210)
    expect(readTime('half past three')).toBe(210)
    expect(readTime('quarter past 12')).toBe(735)
    expect(readTime('quarter to 8')).toBe(465)
    expect(readTime('twenty-five minutes past 3')).toBe(205)
    expect(readTime('10 minutes to 4')).toBe(230)
    expect(readTime('nonsense')).toBeNull()
    expect(readTime('3.5')).toBeNull()
  })

  it('writes 12-hour, 24-hour and classroom language correctly', () => {
    expect(digital(0, '12')).toBe('12:00 am')
    expect(digital(720, '12')).toBe('12:00 pm')
    expect(digital(930, '12')).toBe('3:30 pm')
    expect(digital(930, '24')).toBe('15:30')
    expect(digital(65, '24')).toBe('01:05')
    expect(timeWords(0)).toBe("12 o'clock")
    expect(timeWords(195)).toBe('quarter past 3')
    expect(timeWords(210)).toBe('half past 3')
    expect(timeWords(225)).toBe('quarter to 4')
    expect(timeWords(235)).toBe('5 minutes to 4')
    expect(durationText(0)).toBe('0 minutes')
    expect(durationText(60)).toBe('1 hour')
    expect(durationText(95)).toBe('1 hour 35 minutes')
  })

  it('parses nested and inferred tasks, but refuses unreadable configs', () => {
    expect(tellingTimeEngine.parse({ task: { kind: 'set-clock', time: 'quarter to 8' }, format: '24-hour' })).toEqual({ task: 'set', target: 465, format: '24' })
    expect(tellingTimeEngine.parse({ start: '09:45', end: '11:20' })).toEqual({ task: 'elapsed', start: 585, end: 680 })
    expect(tellingTimeEngine.parse(null)).toBeNull()
    expect(tellingTimeEngine.parse({ task: 'set' })).toBeNull()
    expect(tellingTimeEngine.parse({ task: 'elapsed', start: 'bad', end: '11:20' })).toBeNull()
    expect(tellingTimeEngine.parse({ task: 'angles', target: '3:30' })).toBeNull()
  })

  it('refuses narrowly, with a nearby example that works', () => {
    expect(tellingTimeEngine.faults(set('3:30'))).toEqual([])
    expect(tellingTimeEngine.faults(set('13:70', '24')).join(' ')).toMatch(/00:00 to 23:59.*minutes below 60/)
    expect(tellingTimeEngine.faults(interval('09:45', '11:20'))).toEqual([])
    expect(tellingTimeEngine.faults(interval('09:45', '09:45')).join(' ')).toMatch(/no time passes.*09:45.*11:20/)
    expect(tellingTimeEngine.faults(interval('08:00', '16:00')).join(' ')).toMatch(/longer than the six hours.*09:45.*11:20/)
    // An earlier end means forward around the same 12-hour dial.
    const crossing = interval('23:50', '00:20')
    expect(crossing.task === 'elapsed' ? elapsedOf(crossing) : 0).toBe(30)
    expect(tellingTimeEngine.faults(crossing)).toEqual([])
  })
})

function everyConfig(): TimeConfig[] {
  const all: TimeConfig[] = []
  for (let target = 0; target < 1440; target++) for (const format of ['12', '24'] as const) all.push({ task: 'set', target, format })
  for (let start = 0; start < 1440; start += 15) {
    for (let d = 1; d <= 360; d++) all.push({ task: 'elapsed', start, end: (start + d) % 1440 })
  }
  return all
}

describe('every valid clock configuration', { timeout: 30_000 }, () => {
  const all = everyConfig()
  it('enumerates all set times and many intervals; none starts solved and every solve passes', () => {
    expect(all.filter((c) => c.task === 'set')).toHaveLength(2880)
    expect(all.filter((c) => c.task === 'elapsed')).toHaveLength(34560)
    for (const config of all) {
      expect(tellingTimeEngine.faults(config)).toEqual([])
      const initial = tellingTimeEngine.initial(config)
      expect(tellingTimeEngine.check(config, initial).ok, JSON.stringify(config)).toBe(false)
      const solved = tellingTimeEngine.solve(config)
      expect(tellingTimeEngine.check(config, solved).ok, JSON.stringify(config)).toBe(true)
      if (config.task === 'elapsed') {
        expect(initial.minutes).toBe(0)
        expect(solved.minutes).toBeGreaterThan(0)
        expect(solved.minutes).toBeLessThanOrEqual(360)
      }
    }
  })

  it('does not mark a saved invalid or fractional minute right', () => {
    const config = set('3:30')
    expect(tellingTimeEngine.check(config, {} as TimeState).ok).toBe(false)
    expect(tellingTimeEngine.check(config, { minutes: 209.5 }).ok).toBe(false)
    expect(tellingTimeEngine.check(config, { minutes: 210 }).ok).toBe(true)
    expect(readMinutes(null, 0)).toBe(0)
    expect(readMinutes({ minutes: Infinity }, 0)).toBe(0)
  })
})

describe('the drawing and what it says', () => {
  it('maps minutes around the face and drives the hour hand continuously', () => {
    expect(pointAt(0, MINUTE_R)).toEqual({ x: CX, y: CY - MINUTE_R })
    expect(minuteFromPoint(CX, CY - MINUTE_R)).toBe(0)
    expect(minuteFromPoint(CX + MINUTE_R, CY)).toBe(15)
    expect(minuteFromPoint(CX, CY + MINUTE_R)).toBe(30)
    expect(minuteFromPoint(CX - MINUTE_R, CY)).toBe(45)
    for (let m = 0; m < 60; m++) {
      const p = pointAt(m, MINUTE_R)
      expect(minuteFromPoint(p.x, p.y)).toBe(m)
    }
    expect(hourAngle(180)).toBe(90)
    expect(hourAngle(210)).toBe(105) // half past 3: halfway between 3 and 4
    expect(minuteAngle(210)).toBe(180)
  })

  it('keeps every hour number inside the face and separate from its neighbours', () => {
    for (let n = 1; n <= 12; n++) {
      const p = pointAt(n * 5, 72)
      expect(Math.hypot(p.x - CX, p.y - CY)).toBeLessThan(FACE_R - 20)
      const q = pointAt((n % 12 + 1) * 5, 78)
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(25)
    }
    expect(W).toBe(360)
    expect(H).toBe(292)
  })

  it('explains the linked hour hand and counting through the hour only after marking', () => {
    expect(working(set('3:30 pm'))).toMatch(/half past 3.*3:30 pm.*passed 3/i)
    expect(working(interval('09:45', '11:20'))).toMatch(/1 hour 35 minutes.*15 minutes to 10:00.*1 hour 20 minutes/)
    expect(madeText(set('3:30 pm'), { minutes: 945 })).toMatch(/You set 3:45 pm.*quarter to 4/)
    expect(madeText(interval('09:45', '11:20'), { minutes: 35 })).toMatch(/35 minutes.*10:20/)
    const evening = set('15:45', '24')
    expect(evening.task === 'set' ? digital(evening.target, '24') : '').toBe('15:45')
    expect(tellingTimeEngine.initial(evening).minutes).toBe(900)
    expect(tellingTimeEngine.solve(evening).minutes).toBe(945)
  })

  const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'telling-time', config }, success: { kind: 'scene' } } },
  } as never)))

  it('server-renders controls and the live time without any answer hand instructions', () => {
    const html = card({ task: 'set', target: '3:30 pm', format: '12' }, 'Drag the orange grip on the minute hand to set 3:30 pm.').replace('Drag the orange grip on the minute hand to set 3:30 pm.', '')
    expect(html).toContain('data-handle="minute"')
    expect(html).toContain('role="slider"')
    expect(html).toContain('Move minute hand forward one minute')
    expect(html).toContain('short hour hand')
    expect(html).toMatch(/Set\s*<span[^>]*>3:30 pm<\/span>/)
    expect(html).toContain('2:45 pm') // the initial clock, not the answer
    expect(html).not.toContain('halfway between')
    expect(html).not.toContain('Yes.')
  })

  it('names the made time when wrong and the worked explanation when right', () => {
    const config = interval('09:45', '11:20')
    const wrong = renderToStaticMarkup(createElement(TellingTimeView, { config, state: { minutes: 35 }, setState: () => {}, marked: 'wrong', reduced: true, locked: false }))
    expect(wrong).toContain('You moved forward 35 minutes')
    const right = renderToStaticMarkup(createElement(TellingTimeView, { config, state: tellingTimeEngine.solve(config), setState: () => {}, marked: 'right', reduced: true, locked: true }))
    expect(right).toContain('1 hour 35 minutes')
    expect(right).toContain('>1h<')
    expect(right).toContain('>35m<')
    expect(right).not.toContain('role="slider"')
  })
})

describe('prompts and station routing', () => {
  it('refuses answer instructions and controls the card does not have', () => {
    expect(tellingTimeEngine.promptFaults!(set('3:30'), 'Drag the orange grip to set 3:30 pm.')).toEqual([])
    expect(tellingTimeEngine.promptFaults!(set('3:30'), 'Put the minute hand to 6 and the hour hand between 3 and 4.')).not.toEqual([])
    expect(tellingTimeEngine.promptFaults!(set('3:30'), 'Drag the hour hand too.')).not.toEqual([])
    expect(tellingTimeEngine.promptFaults!(interval('09:45', '11:20'), 'Move from 09:45 to 11:20, 1 hour 35 minutes later.')).not.toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('telling-time')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\})\s*\}\s*,\s*"success"/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })

  it('catches clock stations and leaves timelines, motion and transformations alone', () => {
    expect(scenesFor('Telling the time: reading analogue clocks').map((e) => e.id)).toContain('telling-time')
    expect(scenesFor('The 24-hour clock').map((e) => e.id)).toContain('telling-time')
    expect(scenesFor('Elapsed time and time intervals').map((e) => e.id)).toContain('telling-time')
    expect(scenesFor('Historical timelines and dates').map((e) => e.id)).not.toContain('telling-time')
    expect(scenesFor('Speed, distance and time').map((e) => e.id)).not.toContain('telling-time')
    expect(scenesFor('Clockwise turns and angles').map((e) => e.id)).not.toContain('telling-time')
    expect(tellingTimeEngine.isolates).toBe('position')
  })
})
