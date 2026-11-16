// lib/studylab/engines/climate-station/climate-station.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  climateStationEngine as engine, GOALS, MAX_ACCEPTED, MONTHS, PLACE_MONTH, STATIONS, STATION_IDS, TOL_TEMP, acceptedMonths, declination, done, exactMonths, extremeOf, fitAxes, latText,
  madeText, monthOf, nearestStation, noonHeight, startMonth, stationsNorthToSouth, sunHighestMonth, sunLowestMonth, valuesOf, working, type ClimateConfig, type ClimateState, type Goal,
} from './config'
import { ClimateStationView, H, PX0, PX1, W, beamOf, patchLength } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const PLACES: ClimateConfig[] = STATION_IDS.map((place) => ({ task: 'place' as const, place }))
const MONTH_ALL: ClimateConfig[] = STATION_IDS.flatMap((place) => GOALS.map((goal) => ({ task: 'month' as const, place, goal })))
const MONTHS_OK = MONTH_ALL.filter((c) => engine.faults(c).length === 0)
const ALL = [...PLACES, ...MONTHS_OK]
const nameOf = (c: ClimateConfig) => JSON.stringify(c)

describe('the data and the sun', () => {
  it('has twelve months of data for each of six places, far enough apart on a globe to tell apart', () => {
    for (const s of STATIONS) {
      expect(s.temp, s.id).toHaveLength(12)
      expect(s.rain, s.id).toHaveLength(12)
      for (const v of [...s.temp, ...s.rain]) expect(Number.isFinite(v)).toBe(true)
      for (const r of s.rain) expect(r).toBeGreaterThanOrEqual(0)
    }
    const lats = stationsNorthToSouth().map((s) => s.lat)
    for (let i = 1; i < lats.length; i++) expect(lats[i - 1] - lats[i], String(lats[i])).toBeGreaterThanOrEqual(13)
  })

  it('the figures are the ones a geography teacher would recognise', () => {
    const by = (id: string) => STATIONS.find((s) => s.id === id)!
    const sum = (id: string) => by(id).rain.reduce((a, b) => a + b, 0)
    expect(by('london').temp[6]).toBe(19)
    expect(sum('london')).toBeGreaterThan(550)
    expect(sum('london')).toBeLessThan(700)
    expect(Math.max(...by('cairo').temp)).toBe(30)
    expect(sum('cairo')).toBeLessThan(40)
    expect(Math.max(...by('singapore').temp) - Math.min(...by('singapore').temp)).toBeLessThanOrEqual(2)
    expect(sum('singapore')).toBeGreaterThan(2000)
    expect(by('barrow').temp.filter((t) => t > 0)).toHaveLength(3)
    // The southern hemisphere runs the other way round.
    expect(by('sydney').temp.indexOf(Math.max(...by('sydney').temp))).toBeLessThanOrEqual(1)
    expect(by('sydney').temp.indexOf(Math.min(...by('sydney').temp))).toBe(6)
    expect(by('darwin').rain.slice(0, 3).every((r) => r >= 300)).toBe(true)
    expect(by('darwin').rain.slice(5, 9).every((r) => r <= 20)).toBe(true)
  })

  it('the sun swings between the tropics, and is highest in June in the north and December in the south', () => {
    expect(declination(5)).toBeGreaterThan(22.5)
    expect(declination(11)).toBeLessThan(-22.5)
    expect(Math.abs(declination(2))).toBeLessThan(4)
    expect(sunHighestMonth(51.5)).toBe(5)
    expect(sunLowestMonth(51.5)).toBe(11)
    expect(sunHighestMonth(-34)).toBe(11)
    expect(noonHeight(51.5, 5)).toBeCloseTo(90 - (51.5 - declination(5)), 6)
  })

  it('the beam lands on a longer patch of ground the further the place is from the sun overhead', () => {
    const at = (lat: number) => patchLength(lat, declination(PLACE_MONTH))
    expect(at(0)).toBeLessThan(at(30))
    expect(at(30)).toBeLessThan(at(51))
    expect(at(51)).toBeLessThan(at(71))
    expect(at(0) / 16).toBeGreaterThan(0.95)
    // The same place has a long patch in its winter and a short one in its summer.
    expect(patchLength(51.5, declination(11))).toBeGreaterThan(patchLength(51.5, declination(5)) * 2)
    expect(patchLength(-34, declination(5))).toBeGreaterThan(patchLength(-34, declination(11)) * 1.8)
    // And none at all in polar night.
    expect(beamOf(71, declination(11)).dark).toBe(true)
    expect(patchLength(71, declination(11))).toBe(0)
    expect(beamOf(71, declination(5)).dark).toBe(false)
  })

  it('a ray meets the ground exactly at the station when the beam is centred on it', () => {
    for (const s of STATIONS) {
      for (let m = 0; m < 12; m++) {
        const b = beamOf(s.lat, declination(m))
        if (b.dark) continue
        const e = b.entry(b.b0)
        const phi = (s.lat * Math.PI) / 180
        expect(e.x).toBeCloseTo(96 - 68 * Math.cos(phi), 4)
        expect(e.y).toBeCloseTo(92 - 68 * Math.sin(phi), 4)
      }
    }
  })

  it('finds the nearest place to where the pointer is', () => {
    for (const s of STATIONS) expect(nearestStation(s.lat + 2).id).toBe(s.id)
    expect(nearestStation(90).id).toBe('barrow')
    expect(nearestStation(-90).id).toBe('sydney')
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
    expect(PLACES).toHaveLength(6)
    expect(MONTHS_OK.length).toBeGreaterThanOrEqual(14)
  })

  it('a month card is right for exactly the months that look as good as the best, over every month', () => {
    for (const c of MONTHS_OK) {
      if (c.task !== 'month') continue
      const s = STATIONS.find((x) => x.id === c.place)!
      const goal = c.goal as Goal
      const v = valuesOf(s, goal)
      const best = extremeOf(s, goal)
      for (let m = 0; m < 12; m++) {
        const ok = engine.check(c, { at: s.id, month: m }).ok
        const near = acceptedMonths(s, goal).includes(m)
        expect(ok, `${nameOf(c)} ${MONTHS[m]}`).toBe(near)
        if (near) expect(Math.abs(v[m] - best), `${nameOf(c)} ${MONTHS[m]}`).toBeLessThanOrEqual(goal === 'warmest' || goal === 'coldest' ? TOL_TEMP : fitAxes(s).rMax * 0.05 + 1e-9)
      }
      expect(acceptedMonths(s, goal).length).toBeLessThanOrEqual(MAX_ACCEPTED)
      expect(exactMonths(s, goal).every((m) => acceptedMonths(s, goal).includes(m))).toBe(true)
    }
  })

  it('the start is clearly outside what is accepted', () => {
    for (const c of MONTHS_OK) {
      if (c.task !== 'month') continue
      const s = STATIONS.find((x) => x.id === c.place)!
      const goal = c.goal as Goal
      const gap = Math.abs(valuesOf(s, goal)[startMonth(s, goal)] - extremeOf(s, goal))
      const tol = goal === 'warmest' || goal === 'coldest' ? TOL_TEMP : fitAxes(s).rMax * 0.05
      expect(gap, nameOf(c)).toBeGreaterThanOrEqual(2 * tol)
    }
  })

  it('a place card is right only at the target, and each place has a graph unlike the others', () => {
    for (const c of PLACES) for (const id of STATION_IDS) expect(engine.check(c, { at: id, month: 5 }).ok, `${c.place} ${id}`).toBe(id === c.place)
    for (const a of STATIONS) for (const b of STATIONS) if (a !== b) expect(a.temp.join() === b.temp.join() && a.rain.join() === b.rain.join()).toBe(false)
  })

  it('reads a bad state as nothing done, never as a crash', () => {
    const c: ClimateConfig = { task: 'place', place: 'cairo' }
    expect(engine.check(c, {}).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { at: 'atlantis', month: 99 }).ok).toBe(false)
    const m: ClimateConfig = { task: 'month', place: 'london', goal: 'warmest' }
    expect(monthOf(m, { month: 99 })).toBe(startMonth(STATIONS[1], 'warmest'))
    expect(engine.check(m, { month: 6.5 }).ok).toBe(false)
  })

  it('says something true when marked, and what was made when wrong', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      const wrong = madeText(c, engine.initial(c))
      expect(wrong.startsWith('Yes.'), nameOf(c)).toBe(false)
      expect(wrong, nameOf(c)).toMatch(/^You (?:put|chose)/)
    }
    expect(working({ task: 'place', place: 'cairo' }, {})).toContain('Cairo, Egypt, 30° N')
    const lon: ClimateConfig = { task: 'month', place: 'london', goal: 'warmest' }
    expect(working(lon, { month: 6 })).toMatch(/July is the warmest month in London, with 19 °C/)
    expect(working(lon, { month: 6 })).toMatch(/The sun is highest over London in June, and the warmest month comes a month later/)
    expect(working({ task: 'month', place: 'london', goal: 'wettest' }, { month: 9 })).toMatch(/% of the year's rain falls in the three months/)
    // Near enough: the exact answer is named.
    expect(working({ task: 'month', place: 'cairo', goal: 'warmest' }, { month: 5 })).toMatch(/Near enough: June has 29 °C, and the exact answer is July and August/)
    expect(madeText(lon, { month: 0 })).toBe('You chose January, with 5 °C. Another month is warmer.')
    expect(done({ task: 'month', place: 'nowhere', goal: 'warmest' }, {})).toBe(false)
  })

  it('the lag is said where the data show it', () => {
    for (const c of MONTHS_OK) {
      if (c.task !== 'month' || (c.goal !== 'warmest' && c.goal !== 'coldest')) continue
      const s = STATIONS.find((x) => x.id === c.place)!
      const said = working(c, engine.solve(c))
      const best = exactMonths(s, c.goal as Goal)[0]
      const sun = c.goal === 'warmest' ? sunHighestMonth(s.lat) : sunLowestMonth(s.lat)
      const gap = (best - sun + 12) % 12
      if (gap === 1 || gap === 2) expect(said, nameOf(c)).toMatch(/later, because the land and sea/)
    }
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'place', place: 'Cairo, Egypt' })).toEqual({ task: 'place', place: 'cairo' })
    expect(engine.parse({ task: 'match the graph', station: 'Utqiaġvik' })).toEqual({ task: 'place', place: 'barrow' })
    expect(engine.parse({ place: 'London' })).toEqual({ task: 'place', place: 'london' })
    expect(engine.parse({ task: 'month', place: 'the Sydney station', goal: 'Coldest month' })).toEqual({ task: 'month', place: 'sydney', goal: 'coldest' })
    expect(engine.parse({ task: 'month', place: 'London', find: 'hottest' })).toEqual({ task: 'month', place: 'london', goal: 'warmest' })
    expect(engine.parse({ task: 'wettest', place: 'singapore' })).toEqual({ task: 'month', place: 'singapore', goal: 'wettest' })
    expect(engine.parse({ place: 'Darwin', goal: 'rainiest' })).toEqual({ task: 'month', place: 'darwin', goal: 'wettest' })
    expect(engine.parse({ task: 'month', place: 'london' })).toEqual({ task: 'month', place: 'london', goal: 'warmest' })
    expect(engine.parse({ task: 'place', place: 'hot desert' })).toEqual({ task: 'place', place: 'cairo' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('cairo')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance', place: 'cairo' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'place', place: 5 })).toBeNull()
    expect(engine.parse({ task: 'month', place: 'london', goal: {} })).toBeNull()
    expect(engine.parse({ task: 'place', place: 'Paris' })).not.toBeNull()
    expect(engine.parse({ task: 'month', place: 'london', goal: 'sunniest' })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: ClimateConfig, said: string): ClimateConfig => {
      const goal = said.match(/e\.g\. goal "(\w+)"/)
      if (goal) return { ...c, goal: goal[1] } as ClimateConfig
      const place = said.match(/e\.g\. place "(\w+)"/)
      expect(place, said).not.toBeNull()
      return { ...c, place: place![1] }
    }
    const cases: [ClimateConfig, RegExp][] = [
      [{ task: 'place', place: 'paris' }, /barrow, london, cairo/],
      [{ task: 'place', place: '' }, /needs a place/],
      [{ task: 'place', place: '__proto__' }, /no "__proto__" station/],
      [{ task: 'month', place: 'moscow', goal: 'warmest' }, /barrow, london, cairo, singapore, darwin, sydney/],
      [{ task: 'month', place: 'london', goal: 'sunniest' }, /warmest, coldest, wettest, driest/],
      [{ task: 'month', place: 'singapore', goal: 'warmest' }, /hardly changes/],
      [{ task: 'month', place: 'singapore', goal: 'coldest' }, /hardly changes/],
      [{ task: 'month', place: 'darwin', goal: 'driest' }, /nearly dry/],
      [{ task: 'month', place: 'cairo', goal: 'driest' }, /nearly dry/],
      [{ task: 'month', place: 'barrow', goal: 'driest' }, /nearly dry/],
      [{ task: 'month', place: 'darwin', goal: 'warmest' }, /hardly changes/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
    }
    // Nothing a refused config can do crashes the rest of the engine.
    for (const [c] of cases) {
      expect(() => engine.initial(c)).not.toThrow()
      expect(() => engine.check(c, engine.initial(c))).not.toThrow()
      expect(() => renderToStaticMarkup(createElement(ClimateStationView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: ClimateConfig, p: string) => engine.promptFaults!(c, p)
  const place: ClimateConfig = { task: 'place', place: 'cairo' }
  const month: ClimateConfig = { task: 'month', place: 'london', goal: 'warmest' }

  it('asking for the outcome is fine', () => {
    expect(pf(place, 'Drag the station around the globe, or use the arrows, until its graph matches the dashed graph.')).toEqual([])
    expect(pf(place, 'Find the place whose climate graph matches the dashed one. Drag the station on the globe.')).toEqual([])
    expect(pf(month, 'Here is the climate of London, UK. Use the month arrows, or tap the graph, to find its warmest month.')).toEqual([])
    expect(pf(month, 'Scrub through the year with the month arrows to find the hottest month in London.')).toEqual([])
  })

  it('naming the place, its latitude or its weather on a place card is not', () => {
    for (const p of ['Find Cairo.', 'Find the place in Egypt.', 'Drag the station to the hot desert.', 'It is near the Tropic of Cancer.', 'Move north until the graph matches.', 'Put the station at 30 degrees.', 'Find the dry place.', 'Where has hot summers and almost no rain?', 'Find the place in Africa.', 'Drag to 30° N.']) {
      expect(pf(place, p), p).toHaveLength(1)
    }
  })

  it('naming the right month, or why, or asking for another thing, on a month card is not', () => {
    for (const p of ['Find the warmest month; it is July.', 'Is it hottest in Aug?', 'The sun is highest at the solstice: find the warmest month.', 'Find the warmest month, a month after the sun is highest.']) expect(pf(month, p), p).toHaveLength(1)
    expect(pf(month, 'Find the coldest month in London.')[0]).toMatch(/something else/)
    expect(pf({ task: 'month', place: 'darwin', goal: 'wettest' }, 'Find the wettest month, in the wet season.')).toHaveLength(1)
    // A month that is not the answer is not given away.
    expect(pf(month, 'Find the warmest month; start from January.')).toEqual([])
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Read the wind speed on the anemometer.', 'Find the pressure at the station.', 'Which map shows it?', 'Is there a storm in January?', 'Check the humidity.']) {
      expect(pf(month, p), p).toHaveLength(1)
      expect(pf(month, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const fix = pf(c, 'It is 30 degrees north, in Egypt, in July, hot, with wind.')[0].match(/\("([^"]+)"\)/)![1]
      expect(pf(c, fix), nameOf(c)).toEqual([])
      expect(fix).toMatch(c.task === 'place' ? /Drag the station/ : /month arrows/)
      if (c.task === 'month') {
        expect(fix).toContain(STATIONS.find((s) => s.id === c.place)!.full)
        expect(fix).toContain(`${c.goal} month`)
      }
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"climate-station", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['place', 'month']))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "climate-station"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'climate-station')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      'Weather and climate', 'Going outside', 'Climate graphs', 'Reading climate graphs', 'Weather instruments', 'Measuring the weather', 'Climate zones of the world', 'Tropical climates', 'Climate and latitude',
      'Temperature and rainfall', 'Hot desert climates', 'Why we have seasons', 'Climate and Climate Change in Rwanda', 'Making a weather station', 'Equatorial climate', 'Using thermometers', 'Weather',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Climate change policy', 'Effects of climate change', 'Physical Features and Effects of Climate Change', 'The political climate', 'Business climate and investment', 'Global warming and the greenhouse effect',
      'Weather forecasting', 'Weather maps and symbols', 'Severe weather and hazards', 'Tropical storms', 'Space weather', 'Air pressure and wind', 'Gas pressure', 'Blood pressure', 'Pressure in fluids',
      'Railway station', 'Service station', 'Power stations', 'Police station', 'Weathering of rocks', 'Rock weathering', 'Latitude and longitude', 'Grid references', 'Solar energy and solar panels',
      'Climate of fear in Macbeth', 'Seasons of life', 'Seasonal sales', 'Food chains', 'Wave speed', 'Pressure and moments',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('climate-station')).toBe(engine)
    expect(engine.isolates).toBe('position')
    expect(engine.prompt).toMatch(/SCENE "climate-station"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:climate-station"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const s of STATIONS) expect(engine.prompt).toContain(`${s.id} (${s.full}, ${latText(s.lat)}`)
    for (const g of GOALS) expect(engine.prompt).toContain(g)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'climate-station', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: ClimateConfig, state: ClimateState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(ClimateStationView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [ClimateConfig, string][] = [
    [{ task: 'place', place: 'cairo' }, 'Drag the station around the globe, or use the arrows, until its graph matches the dashed graph.'],
    [{ task: 'place', place: 'barrow' }, 'Drag the station around the globe, or use the arrows, until its graph matches the dashed graph.'],
    [{ task: 'month', place: 'london', goal: 'warmest' }, 'Here is the climate of London, UK. Use the month arrows, or tap the graph, to find its warmest month.'],
    [{ task: 'month', place: 'sydney', goal: 'coldest' }, 'Here is the climate of Sydney, Australia. Use the month arrows, or tap the graph, to find its coldest month.'],
  ]

  it('before marking, nothing names the answer, says right, or says why', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'Near enough', 'a month later', 'highest over', 'because the land', 'Another month', 'not the shape', '% of the year']) expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      if (cfg.task === 'place') {
        for (const s of STATIONS) for (const n of [s.name, s.full, 'Egypt', 'Alaska', 'Australia', 'desert', 'polar']) expect(shown, `${n} in ${nameOf(cfg)}`).not.toContain(n)
      }
    }
  })

  it('names what it draws, before marking', () => {
    const t = text(raw({ task: 'place', place: 'cairo' }, {}, 'idle'))
    for (const name of ['sunlight', 'equator', 'thermometer', 'rain gauge', 'Temperature', 'Rainfall', "Sun's patch", 'Target', '°C', 'mm', 'Station', 'Month']) expect(t).toContain(name)
    const m = text(raw({ task: 'month', place: 'london', goal: 'warmest' }, {}, 'idle'))
    for (const name of ['London · 51.5° N', 'thermometer', 'rain gauge', 'Month']) expect(m).toContain(name)
    expect(m).not.toContain('Target')
  })

  it('marking says the place or the month, and what was made when wrong', () => {
    expect(text(raw({ task: 'place', place: 'cairo' }, { at: 'cairo', month: 2 }, 'right'))).toContain('Yes. That is Cairo, Egypt, 30° N.')
    expect(text(raw({ task: 'place', place: 'cairo' }, { at: 'london', month: 2 }, 'wrong'))).toContain('You put the station at 51.5° N')
    expect(text(raw({ task: 'month', place: 'london', goal: 'warmest' }, { at: 'london', month: 6 }, 'right'))).toContain('July is the warmest month')
    expect(text(raw({ task: 'month', place: 'london', goal: 'warmest' }, { at: 'london', month: 0 }, 'wrong'))).toContain('You chose January')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    expect(raw({ task: 'place', place: 'cairo' }, { at: 'london', month: 2 }, 'shown')).toContain('data-station="cairo"')
    expect(raw({ task: 'month', place: 'london', goal: 'warmest' }, {}, 'shown')).toContain('data-band="6"')
  })

  it('every control is a real button with its own label, and locks when solved', () => {
    const idle = raw(EXAMPLES[0][0], engine.initial(EXAMPLES[0][0]), 'idle')
    expect([...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)].map((m) => m[1])).toEqual(['Move the station south', 'Move the station north', 'Previous month', 'Next month'])
    for (const m of idle.matchAll(/<button[^>]*>/g)) expect(m[0]).toContain('type="button"')
    expect(idle).toContain('role="spinbutton"')
    expect(idle).toContain('touch-none')
    const month = raw(EXAMPLES[2][0], engine.initial(EXAMPLES[2][0]), 'idle')
    expect([...month.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map((m) => m[1])).toEqual(['Previous month', 'Next month'])
    for (const [cfg] of EXAMPLES) {
      const solved = raw(cfg, engine.solve(cfg), 'right')
      expect([...solved.matchAll(/<button[^>]*>/g)].every((m) => /disabled/.test(m[0])), nameOf(cfg)).toBe(true)
      expect(solved).not.toContain('touch-none')
    }
  })

  it('the picture changes with every move, with nothing animating under reduced motion', () => {
    for (const [cfg] of EXAMPLES) {
      const start = engine.initial(cfg)
      const first = raw(cfg, start, 'idle', true)
      expect(first, nameOf(cfg)).not.toMatch(/transition:\s*[a-z]/)
      for (let m = 0; m < 12; m++) if (m !== monthOf(cfg, start)) expect(raw(cfg, { ...start, month: m }, 'idle', true), `${nameOf(cfg)} ${m}`).not.toBe(first)
      if (cfg.task === 'place') for (const id of STATION_IDS) if (id !== start.at) expect(raw(cfg, { ...start, at: id }, 'idle', true), `${nameOf(cfg)} ${id}`).not.toBe(first)
    }
    expect(raw(EXAMPLES[2][0], {}, 'idle', false)).toMatch(/transition:y 600ms/)
  })

  it('the instruments read what the graph says', () => {
    for (const s of STATIONS) {
      for (let m = 0; m < 12; m++) {
        const html = raw({ task: 'place', place: 'london' }, { at: s.id, month: m }, 'idle', true)
        expect(html).toContain(`data-reading="temp">${s.temp[m]} °C`)
        expect(html).toContain(`data-reading="rain">${s.rain[m]} mm`)
      }
    }
  })

  it('a place card shares axes, so a dry place looks dry; a month card fits its own', () => {
    const a = (id: string) => fitAxes(STATIONS.find((s) => s.id === id)!)
    expect(a('london').rMax).toBe(100)
    expect(a('darwin').rMax).toBe(500)
    expect(a('cairo').tMin).toBe(0)
    expect(a('barrow').tMin).toBe(-30)
    expect(raw({ task: 'place', place: 'cairo' }, { at: 'london', month: 0 }, 'idle', true)).toContain('data-ghost-line')
    expect(raw({ task: 'month', place: 'london', goal: 'warmest' }, {}, 'idle', true)).not.toContain('data-ghost-line')
  })

  it('no text under 12 px, and no gradients', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })

  it('agrees with what the view writes out as literals', () => {
    const html = raw(EXAMPLES[0][0], engine.initial(EXAMPLES[0][0]), 'idle', true)
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`)
    expect(W).toBe(360)
    expect(PX1 - PX0).toBe(272)
    expect(html).toMatch(/<circle cx="96" cy="92" r="68"/)
  })
})
