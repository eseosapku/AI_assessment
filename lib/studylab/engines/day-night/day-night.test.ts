// lib/studylab/engines/day-night/day-night.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  dayNightEngine as E, MOMENTS, MOMENT_HOUR, NEAR, INSIDE, START_HOUR, TASKS, TIMES,
  apart, done, goodPrompt, hourAt, isDay, madeText, meets, phaseOf, sunHeight, turnedOf, working, wrap24,
  type DayNightConfig, type DayNightState, type TimeName,
} from './config'
import {
  DayNightView, ARC_A, ARC_B, BEAMS, CX, CY, FIG, HORIZON, ICE, LAND, R, SKY_H, SKY_MID, SKY_SUN_R, SPACE_H, SPACE_LABELS, SUN_R, SUN_X, W,
  daylight, goalWord, inkOn, personAt, skyColour, spinArrow, starsShow, sunInSky, turnAngle,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const cfg = (time: TimeName = 'sunrise', task: DayNightConfig['task'] = 'watch'): DayNightConfig => ({ task, time })
const ALL: DayNightConfig[] = TASKS.flatMap((task) => TIMES.map((time) => cfg(time, task)))
const render = (config: DayNightConfig, state: DayNightState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = true) =>
  renderToStaticMarkup(createElement(DayNightView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
/** The turn that puts you at a given local time on a card. */
const turnFor = (config: DayNightConfig, hour: number): DayNightState => ({ turned: wrap24(hour - START_HOUR[config.time as TimeName]) })

/** The points of an SVG path made of M, L and Z with numbers. */
const pointsOf = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))

describe('the Earth and the Sun, from first principles', () => {
  // The Sun shines from the left of the picture. Math coordinates (y up) for the geometry.
  const toSun = { x: -1, y: 0 }
  const you = (hour: number) => { const p = personAt(hour); return { x: p.x - CX, y: -(p.y - CY) } }

  it('it is day exactly when you are on the half facing the Sun', () => {
    for (let h = 0; h < 24; h += 0.05) {
      const p = you(h)
      const facing = p.x * toSun.x + p.y * toSun.y
      if (Math.abs(facing) < 1e-6) continue
      expect(isDay(h), `hour ${h.toFixed(2)}`).toBe(facing > 0)
      expect(sunHeight(h) > 0).toBe(facing > 0)
    }
  })

  it('the Earth turns anticlockwise seen from above the North Pole: you go round anticlockwise as the hours pass', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const a = you(h)
      const b = you(h + 0.5)
      expect(a.x * b.y - a.y * b.x, `hour ${h}`).toBeGreaterThan(0)
    }
    // The arrow round the pole turns the same way: its head points along an anticlockwise turn.
    const arrow = spinArrow(0, 0, 10, 4)
    const end = pointsOf(arrow.arc.replace(/A[^A-Z]*$/, '')).at(-1)
    expect(end).toBeTruthy()
    const endAngle = (215 * Math.PI) / 180
    // Anticlockwise on the screen at angle a (math): screen direction (-sin a, -cos a).
    expect(arrow.tangent.x).toBeCloseTo(-Math.sin(endAngle), 6)
    expect(arrow.tangent.y).toBeCloseTo(-Math.cos(endAngle), 6)
    expect(arrow.arc).toMatch(/A10 10 0 1 0 /)
  })

  it('at sunrise you are turned into the light, with the Sun in the east; at sunset out of it, with the Sun in the west', () => {
    expect(isDay(6 - 0.01)).toBe(false)
    expect(isDay(6 + 0.01)).toBe(true)
    expect(isDay(18 - 0.01)).toBe(true)
    expect(isDay(18 + 0.01)).toBe(false)
    // Your east is the way the ground carries you: anticlockwise, along (-sin, cos) at your angle.
    const east = (hour: number) => { const a = (turnAngle(hour) * Math.PI) / 180; return { x: -Math.sin(a), y: Math.cos(a) } }
    expect(east(6).x * toSun.x + east(6).y * toSun.y).toBeCloseTo(1, 6)
    expect(east(18).x * toSun.x + east(18).y * toSun.y).toBeCloseTo(-1, 6)
    // Midday faces the Sun; midnight faces away.
    expect(you(12).x).toBeCloseTo(-R, 6)
    expect(you(0).x).toBeCloseTo(R, 6)
  })

  it('your sky shows the same: the Sun on the east (left) horizon at sunrise, highest at midday, on the west (right) at sunset', () => {
    const rise = sunInSky(6)
    const noon = sunInSky(12)
    const set = sunInSky(18)
    expect(rise.x).toBeCloseTo(SKY_MID - ARC_A, 6)
    expect(rise.y).toBeCloseTo(HORIZON, 6)
    expect(noon.x).toBeCloseTo(SKY_MID, 6)
    expect(noon.y).toBeCloseTo(HORIZON - ARC_B, 6)
    expect(set.x).toBeCloseTo(SKY_MID + ARC_A, 6)
    for (let h = 6.25; h < 12; h += 0.25) expect(sunInSky(h).x, `${h}`).toBeLessThan(SKY_MID)
    for (let h = 12.25; h < 18; h += 0.25) expect(sunInSky(h).x, `${h}`).toBeGreaterThan(SKY_MID)
    // Up while it is day, down while it is night; climbing all morning, sinking all afternoon.
    for (let h = 0; h < 24; h += 0.25) expect(sunInSky(h).y < HORIZON, `${h}`).toBe(isDay(h))
    for (let h = 6; h < 12; h += 0.5) expect(sunInSky(h + 0.5).y).toBeLessThan(sunInSky(h).y)
    expect(sunHeight(12)).toBe(90)
    expect(sunHeight(6)).toBe(0)
  })

  it('the map is the real Earth from above, not its mirror: Greenland lies west of you (Kenya), about 78 degrees clockwise', () => {
    const pts = pointsOf(ICE)
    const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
    const angle = (Math.atan2(-c.y, c.x) * 180) / Math.PI
    expect(angle).toBeGreaterThan(-95)
    expect(angle).toBeLessThan(-60)
    // All land drawn is the northern half: inside the equator, which is the edge of the Earth.
    for (const p of pointsOf(LAND)) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(100.6)
    // You stand on land: some coast lies near your spot on the equator.
    expect(pointsOf(LAND).some((p) => Math.hypot(p.x - 100, p.y) < 12)).toBe(true)
  })

  it('the sky darkens and the stars come out as the Sun goes down, and the ground is lit by day', () => {
    expect(skyColour(40)).not.toBe(skyColour(-20))
    expect(starsShow(30)).toBe(0)
    expect(starsShow(-20)).toBe(1)
    expect(daylight(30)).toBe(1)
    expect(daylight(-30)).toBe(0)
    // The title stays readable on every sky.
    expect(inkOn(skyColour(40))).toBe('#1E3A5F')
    expect(inkOn(skyColour(-20))).toBe('#F1F5F9')
  })
})

describe('reading and refusing configs', () => {
  it('parses broad phrasings, and a closed sky or drawn curtains make a prediction', () => {
    expect(E.parse({ task: 'watch', time: 'sunrise' })).toEqual(cfg('sunrise'))
    expect(E.parse({ task: 'predict', time: 'Sunset' })).toEqual(cfg('sunset', 'predict'))
    expect(E.parse({ time: 'dawn' })).toEqual(cfg('sunrise'))
    expect(E.parse({ time: 'noon' })).toEqual(cfg('midday'))
    expect(E.parse({ time: '12 midnight' })).toEqual(cfg('midnight'))
    expect(E.parse({ time: 'night-time' })).toEqual(cfg('night'))
    expect(E.parse({ time: 'Daytime' })).toEqual(cfg('day'))
    expect(E.parse({ time: 'dusk', sky: 'closed' })).toEqual(cfg('sunset', 'predict'))
    expect(E.parse({ time: 'sunset', curtains: true })).toEqual(cfg('sunset', 'predict'))
    expect(E.parse({ task: { kind: 'predict', time: 'midday' } })).toEqual(cfg('midday', 'predict'))
    expect(E.parse({ task: 'sunrise' })).toEqual(cfg('sunrise'))
    expect(E.parse({ task: 'spin', time: 'it is midday for you' })).toEqual(cfg('midday'))
    expect(E.parse({})).toEqual(cfg('sunrise'))
    expect(E.parse(null)).toBeNull()
    expect(E.parse({ task: 'juggle' })).toBeNull()
    expect(E.parse({ time: 7 })).toEqual({ task: 'watch', time: '7' })
    expect(E.parse({ time: { at: 6 } })).toBeNull()
  })

  it('refuses only what it cannot make, with a working example near it', () => {
    for (const c of ALL) expect(E.faults(c), JSON.stringify(c)).toEqual([])
    expect(E.faults(E.parse({ time: 'morning' })!)[0]).toMatch(/cannot make "morning".*time "sunrise"/)
    expect(E.faults(E.parse({ time: 'evening' })!)[0]).toMatch(/time "sunset"/)
    expect(E.faults(E.parse({ time: '6pm' })!)[0]).toMatch(/clock times are not shown.*time "sunset"/)
    expect(E.faults(E.parse({ time: 'lunchtime' })!)[0]).toMatch(/time "midday"/)
    expect(E.faults(E.parse({ time: 'bedtime' })!)[0]).toMatch(/time "night"/)
  })
})

describe('every valid config starts unsolved and solves', { timeout: 30_000 }, () => {
  it('all twelve: the start is clearly wrong, and solve lands on the moment itself', () => {
    expect(ALL).toHaveLength(12)
    for (const c of ALL) {
      const start = E.initial(c)
      const answer = E.solve(c)
      expect(E.check(c, start).ok, `starts solved ${JSON.stringify(c)}`).toBe(false)
      expect(E.check(c, answer).ok, `cannot solve ${JSON.stringify(c)}`).toBe(true)
      expect(answer.turned).toBeGreaterThan(0)
      expect(answer.turned).toBeLessThan(24)
      const t = c.time as TimeName
      if ((MOMENTS as readonly string[]).includes(t)) {
        expect(hourAt(c, answer)).toBeCloseTo(MOMENT_HOUR[t as keyof typeof MOMENT_HOUR], 9)
        // Clearly outside the tolerance at the start: four hours or more.
        expect(apart(START_HOUR[t], MOMENT_HOUR[t as keyof typeof MOMENT_HOUR])).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('for sunrise and sunset, the first edge of the light you reach is the other one', () => {
    for (const t of ['sunrise', 'sunset'] as const) {
      const c = cfg(t)
      let firstEdge: number | null = null
      for (let k = 0.05; k < 24 && firstEdge === null; k += 0.05) {
        const h = hourAt(c, { turned: k })
        if (isDay(h) !== isDay(hourAt(c, { turned: k - 0.05 }))) firstEdge = h
      }
      expect(firstEdge).not.toBeNull()
      expect(apart(firstEdge!, MOMENT_HOUR[t])).toBeGreaterThan(11)
    }
  })

  it('marks by the rule over thousands of turns: within an hour of a moment, or clearly inside a half', () => {
    let seed = 7
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (const c of ALL) {
      for (let i = 0; i < 400; i++) {
        const turned = rand() * 72
        const h = hourAt(c, { turned })
        const t = c.time as TimeName
        const expected = (MOMENTS as readonly string[]).includes(t)
          ? Math.min(Math.abs(h - MOMENT_HOUR[t as keyof typeof MOMENT_HOUR]), 24 - Math.abs(h - MOMENT_HOUR[t as keyof typeof MOMENT_HOUR])) <= NEAR
          : (t === 'day' ? h >= 6 + INSIDE && h <= 18 - INSIDE : h >= 18 + INSIDE || h <= 6 - INSIDE)
        expect(E.check(c, { turned }).ok, `${JSON.stringify(c)} turned ${turned}`).toBe(expected)
        expect(meets(t, h)).toBe(expected)
      }
    }
  })

  it('is forgiving where it looks right, and the start is clearly outside', () => {
    const c = cfg('sunset', 'predict')
    expect(E.check(c, turnFor(c, 18.9)).ok).toBe(true)
    expect(E.check(c, turnFor(c, 17.1)).ok).toBe(true)
    expect(E.check(c, turnFor(c, 19.3)).ok).toBe(false)
    expect(E.check(cfg('day'), turnFor(cfg('day'), 6.2)).ok).toBe(false)
    expect(E.check(cfg('day'), turnFor(cfg('day'), 7)).ok).toBe(true)
    // A whole extra turn is the same moment a day later.
    expect(E.check(c, { turned: E.solve(c).turned + 24 }).ok).toBe(true)
  })

  it('never accepts corrupt stored work', () => {
    const c = cfg('midday')
    for (const s of [{}, { turned: -9 }, { turned: Number.NaN }, { turned: 'nine' }, null] as unknown as DayNightState[]) {
      expect(turnedOf(s)).toBe(0)
      expect(E.check(c, s).ok).toBe(false)
    }
    expect(done({ task: 'watch', time: 'morning' }, { turned: 4 })).toBe(false)
  })
})

describe('what is said once marked', () => {
  it('a right card says why, the far side, and near enough with the exact moment', () => {
    expect(working(cfg('sunrise'), E.solve(cfg('sunrise')))).toMatch(/^Yes, sunrise. .*comes up in the east. It is sunset on the far side of the Earth.$/)
    expect(working(cfg('midday'), E.solve(cfg('midday')))).toMatch(/It is midnight on the far side of the Earth. One turn takes 24 hours.$/)
    const near = working(cfg('sunset'), turnFor(cfg('sunset'), 18.66))
    expect(near).toMatch(/^Near enough: about 40 minutes after sunset\. You are being turned out of the light/)
    expect(near).not.toMatch(/Yes,/)
    expect(working(cfg('midnight'), turnFor(cfg('midnight'), 23.2))).toMatch(/^Near enough: about 50 minutes before midnight/)
    expect(working(cfg('night'), E.solve(cfg('night')))).toMatch(/Nothing covered the Sun/)
  })

  it('a wrong card names what was made, never how far to go', () => {
    const c = cfg('sunset', 'predict')
    expect(madeText(c, turnFor(c, 6.2))).toMatch(/^You made it sunrise: .*turned into it.*east/)
    expect(madeText(c, turnFor(c, 9))).toMatch(/^You made it morning/)
    expect(madeText(c, turnFor(c, 15))).toMatch(/^You made it afternoon/)
    expect(madeText(c, turnFor(c, 21))).toMatch(/a few hours after sunset/)
    expect(madeText(c, turnFor(c, 3))).toMatch(/a few hours before sunrise/)
    for (let h = 0; h < 24; h += 0.5) expect(madeText(c, turnFor(c, h))).not.toMatch(/\d+ hours?|turn (?:on|more|further)/)
    expect(phaseOf(5.2)).toBe('sunrise')
    expect(phaseOf(4.8)).toBe('early-night')
  })
})

describe('the drawing', () => {
  it('agrees with the config it cannot import while loading', () => {
    // View keeps its own literals; the turn of 15 degrees an hour is the config's 24-hour day.
    expect(turnAngle(24)).toBe(0)
    expect(turnAngle(6)).toBe(90)
    expect(wrap24(30)).toBe(6)
    expect(SPACE_H).toBe(196)
    expect(SKY_H).toBe(98)
    expect(W).toBe(360)
  })

  it('keeps you, the Earth and the Sun inside the space panel at every hour', () => {
    for (let h = 0; h < 24; h += 0.25) {
      for (const r of [R, R + FIG]) {
        const p = personAt(h, r)
        expect(p.x, `${h}`).toBeGreaterThan(4)
        expect(p.x, `${h}`).toBeLessThan(W - 4)
        expect(p.y, `${h}`).toBeGreaterThan(2)
        expect(p.y, `${h}`).toBeLessThan(SPACE_H - 2)
      }
    }
    expect(CY - R).toBeGreaterThan(FIG)
    expect(SUN_X + SUN_R).toBeLessThan(BEAMS[0].x1)
    for (const b of BEAMS) expect(Math.hypot(b.x2 - CX, b.y - CY)).toBeGreaterThan(R)
  })

  it('never puts you on a label, and the labels never touch each other', () => {
    const box = (l: (typeof SPACE_LABELS)[number]) => {
      const w = l.text.length * l.size * 0.62
      const left = l.anchor === 'start' ? l.x : l.x - w / 2
      return { left, right: left + w, top: l.y - l.size, bottom: l.y + 3 }
    }
    const boxes = SPACE_LABELS.map(box)
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      expect(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top, `${SPACE_LABELS[i].text} / ${SPACE_LABELS[j].text}`).toBe(true)
    }
    // The note that the Earth turns one way only, bottom left, two lines.
    const note = { left: 10, right: 108, top: SPACE_H - 37, bottom: SPACE_H - 7 }
    for (let h = 0; h < 24; h += 0.25) {
      for (let k = 0; k <= 1; k += 0.1) {
        const p = personAt(h, R + FIG * k)
        for (const b of [...boxes, note]) {
          expect(p.x > b.left - 3 && p.x < b.right + 3 && p.y > b.top - 3 && p.y < b.bottom + 3, `hour ${h}`).toBe(false)
        }
      }
    }
  })

  it('the Sun in your sky stays in the sky panel and clear of the house and the tree', () => {
    const things = [{ left: 144, right: 188, top: 42 }, { left: 189, right: 221, top: 43 }, { left: 121, right: 135, top: 74.5 - 17.5 * 1.45 }]
    for (let h = 6; h <= 18; h += 0.1) {
      const s = sunInSky(h)
      const reach = SKY_SUN_R + 6
      expect(s.y - reach).toBeGreaterThanOrEqual(0)
      expect(s.x - reach).toBeGreaterThanOrEqual(-reach)
      for (const t of things) expect(s.x + reach > t.left && s.x - reach < t.right && s.y + reach > t.top, `hour ${h.toFixed(1)}`).toBe(false)
    }
  })

  it('turns the map with the hours, and changes the sky', () => {
    const c = cfg('sunrise')
    const a = render(c, { turned: 0 })
    const b = render(c, { turned: 1 })
    expect(a.match(/data-turn="([\d.-]+)"/)![1]).not.toBe(b.match(/data-turn="([\d.-]+)"/)![1])
    expect(a.match(/data-sky="([\d.-]+)"/)![1]).not.toBe(b.match(/data-sky="([\d.-]+)"/)![1])
    expect(render(c, turnFor(c, 0))).toMatch(/data-window="lit"/)
    expect(render(c, turnFor(c, 12))).toMatch(/data-window="dark"/)
  })

  it('has real controls: a slider on the Earth and two turn buttons', () => {
    const s = render(cfg('midday'), { turned: 0 })
    expect(s).toMatch(/role="slider"[^>]*aria-label="Turn the Earth"/)
    expect(s).toMatch(/aria-label="Turn the Earth on 1 hour"/)
    expect(s).toMatch(/aria-label="Turn the Earth on 6 hours"/)
    expect(s.match(/type="button"/g)).toHaveLength(2)
    const locked = render(cfg('midday'), E.solve(cfg('midday')), 'right')
    expect(locked.match(/disabled=""/g)).toHaveLength(2)
  })

  it('keeps the curtains closed on a predict card until it is marked', () => {
    const c = cfg('sunset', 'predict')
    expect(render(c, { turned: 3 })).toMatch(/curtains closed/)
    expect(render(c, { turned: 3 })).toMatch(/Your curtains are closed/)
    expect(render(c, { turned: 3 })).not.toMatch(/In your sky/)
    expect(render(c, { turned: 3 }, 'wrong')).toMatch(/translateX\(-184px\)/)
    expect(render(cfg('sunset'), { turned: 3 })).not.toMatch(/curtains closed/)
  })

  it('renders every task kind and marked state without errors', () => {
    for (const c of ALL) {
      for (const marked of ['idle', 'right', 'wrong', 'shown'] as const) {
        const state = marked === 'idle' || marked === 'wrong' ? E.initial(c) : E.solve(c)
        expect(render(c, state, marked)).toContain('<svg')
        expect(render(c, state, marked, false)).toContain('<svg')
      }
    }
  })

  it('names only the goal before marking, never the time you have made', () => {
    const card = (config: DayNightConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'day-night', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    for (const c of ALL) {
      const s = card(c, goodPrompt(c))
      const goal = goalWord(c.time)
      expect(s, JSON.stringify(c)).toContain(`>${goal}</span>`)
      // The goal once, in its own line; no other time of day, and no verdict.
      const rest = s.replace(`>${goal}</span>`, '')
      expect(rest, JSON.stringify(c)).not.toMatch(/sunrise|sunset|midday|midnight|morning|afternoon|daytime|night-time|Near enough|You made|Yes,|o['’]clock/i)
    }
    // At any turn, the picture's own words say what is seen, not what time it is.
    for (let t = 0; t < 24; t += 0.5) {
      const s = render(cfg('midday'), { turned: t }).replace(/>midday<\/span>/, '')
      expect(s).not.toMatch(/sunrise|sunset|midday|midnight|morning|afternoon/i)
    }
  })
})

describe('catalogue matching and prompts', () => {
  it('matches the day-and-night stations and rules out the near misses', () => {
    expect(getEngine('day-night')).toBe(E)
    expect(E.isolates).toBe('position')
    for (const station of ['Day and night', 'Why we have day and night', 'The Earth spinning on its axis', "The Earth's rotation", 'Sunrise and sunset', "The Sun's apparent movement across the sky", 'Why the Sun rises in the east and sets in the west']) {
      expect(scenesFor(station).map((e) => e.id), station).toContain('day-night')
      expect(sceneCatalogue(station), station).toContain('SCENE "day-night"')
    }
    for (const station of ['Phases of the Moon', 'Why we have seasons: the tilt of the Earth', 'Shadows and the shadow stick', 'Rotating shapes about a point', 'Nocturnal animals', 'Day and night animals', 'Sunrise industries in the economy', 'Telling the time', 'Day length through the year', 'The solar system and orbits', 'Crop rotation']) {
      expect(sceneCatalogue(station), station).not.toContain('SCENE "day-night"')
    }
  })

  it('catches prompts that give the answer away or promise what the card does not do', () => {
    const c = cfg('sunrise')
    const p = cfg('sunset', 'predict')
    expect(E.promptFaults!(c, 'Turn the Earth 16 hours to reach sunrise.').join(' ')).toMatch(/gives the answer away/)
    expect(E.promptFaults!(c, 'Turn it a quarter turn and stop.').join(' ')).toMatch(/gives the answer away/)
    expect(E.promptFaults!(p, 'Stop where you are turned out of the light.').join(' ')).toMatch(/gives the answer away/)
    expect(E.promptFaults!(p, 'Stop on the line between day and night.').join(' ')).toMatch(/gives the answer away/)
    expect(E.promptFaults!(c, 'Stop when you reach the top of the globe.').join(' ')).toMatch(/gives the answer away/)
    expect(E.promptFaults!(c, 'Drag the Sun round the Earth until it rises.').join(' ')).toMatch(/promises something/)
    expect(E.promptFaults!(c, 'Make it 6 am for you.').join(' ')).toMatch(/promises something/)
    expect(E.promptFaults!(c, 'Watch how the seasons change.').join(' ')).toMatch(/promises something/)
    expect(E.promptFaults!(c, 'Turn the Earth clockwise until sunrise.').join(' ')).toMatch(/promises something/)
    expect(E.promptFaults!(p, 'Drag the Earth round and watch your sky until the Sun sets.').join(' ')).toMatch(/curtains stay closed/)
    expect(E.promptFaults!(c, 'Your curtains are closed: drag the Earth round until sunrise.').join(' ')).toMatch(/on a watch card the sky is open/)
    // Facts and the real turn are fine.
    expect(E.promptFaults!(c, 'The Earth spins once every 24 hours, anticlockwise from above. Drag the Earth round the way its arrow points, or tap the turn buttons. Stop when you see the Sun rise.')).toEqual([])
    for (const x of ALL) expect(E.promptFaults!(x, goodPrompt(x)), JSON.stringify(x)).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('day-night')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(3)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(config).not.toBeNull()
      expect(e.faults(config)).toEqual([])
      expect(e.promptFaults!(config, m[1])).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
    }
    expect([...e.prompt.matchAll(/"isolates":"(\w+)"/g)].every((m) => m[1] === e.isolates)).toBe(true)
  })
})
