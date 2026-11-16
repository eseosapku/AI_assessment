// lib/studylab/engines/river-coast/river-coast.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  riverCoastEngine as engine, BAYS, BAY_W, BENDS, FLOWS, FROMS, HOLD_AT, HOTELS, PEBBLES, PLAN_H, PLAN_W, SITES, SPACING, TMAX, WALL,
  distToRiver, done, driftSite, fromOf, groynesOf, hotelBay, levelsAt, lostAt, madeText, screenBay, settledPebbles, startPebbles, stepPebbles, working,
  type RcConfig, type RcState,
} from './config'
import { H, RiverCoastView, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const METEORS: RcConfig[] = FLOWS.flatMap((flow) => BENDS.map((bend) => ({ task: 'meander' as const, flow, bend })))
const DRIFTS: RcConfig[] = FROMS.flatMap((from) => HOTELS.map((hotel) => ({ task: 'drift' as const, from, hotel })))
const ALL = [...METEORS, ...DRIFTS]
const nameOf = (c: RcConfig) => JSON.stringify(c)
const SUBSETS: number[][] = Array.from({ length: 16 }, (_, b) => [1, 2, 3, 4].filter((s) => b & (1 << (s - 1))))
const raw = (cfg: RcConfig, state: RcState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
  renderToStaticMarkup(createElement(RiverCoastView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

describe('every config the tutor can write', { timeout: 30_000 }, () => {
  it('starts unsolved and can always be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, nameOf(c)).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, nameOf(c)).toBe(true)
      expect(engine.check(c, engine.initial(c)).wrongIds.length, nameOf(c)).toBe(1)
    }
  })

  it('meander: the river reaches every outside plot and no inside plot, in both flows', () => {
    for (const flow of FLOWS) {
      for (const s of SITES) {
        const lost = lostAt(flow, s.id)
        if (s.side === 'outer') {
          expect(lost, `${flow} ${s.id}`).not.toBeNull()
          // Late enough that the learner can see it coming, early enough to fit the clock.
          expect(lost!, `${flow} ${s.id}`).toBeGreaterThan(1.5)
          expect(lost!, `${flow} ${s.id}`).toBeLessThan(TMAX)
        } else expect(lost, `${flow} ${s.id}`).toBeNull()
        // At the start no plot is touched.
        expect(distToRiver(flow, s, 0), `${s.id}`).toBeGreaterThan(24)
      }
    }
  })

  it('meander: marks by the plot, whatever the clock says', () => {
    for (const c of METEORS) {
      for (const s of SITES) {
        const ok = engine.check(c, { site: s.id, t: 0, run: 0 }).ok
        expect(ok, `${nameOf(c)} ${s.id}`).toBe(s.side === 'inner')
        expect(engine.check(c, { site: s.id, t: TMAX, run: 3 }).ok).toBe(ok)
      }
      // A state with nothing in it still reads as the start.
      expect(engine.check(c, { t: 0, run: 0 }).ok).toBe(false)
      expect(engine.check(c, { site: 'nowhere', t: 0, run: 0 } as RcState).ok).toBe(false)
    }
  })

  it('meander: the plots are numbered in an order that says nothing about which are safe', () => {
    const sides = SITES.map((s) => s.side)
    expect(new Set(SITES.map((s) => s.n))).toEqual(new Set([1, 2, 3, 4, 5, 6]))
    expect(sides.join()).not.toBe('inner,outer,inner,outer,inner,outer')
    expect(sides.join()).not.toBe('outer,inner,outer,inner,outer,inner')
    expect(sides.slice(0, 3).filter((x) => x === 'inner').length).toBeGreaterThan(0)
    expect(sides.slice(0, 3).filter((x) => x === 'outer').length).toBeGreaterThan(0)
  })

  it('drift: the beach fills behind a groyne on the side the pebbles come from, and thins beyond it', () => {
    for (const c of DRIFTS) {
      const from = fromOf(c)
      const k = hotelBay(c)
      const down = from === 'left' ? k + 1 : k
      const up = from === 'left' ? k : k + 1
      expect(done(c, { groynes: [], t: 0, run: 0 }), nameOf(c)).toBe(false)
      expect(done(c, { groynes: [down], t: 0, run: 0 }), nameOf(c)).toBe(true)
      expect(done(c, { groynes: [up], t: 0, run: 0 }), nameOf(c)).toBe(false)
      const lv = levelsAt(from, [down], TMAX)
      expect(lv[k]).toBeGreaterThanOrEqual(HOLD_AT)
      // The bay on the far side of that groyne is starved.
      const beyond = from === 'left' ? k + 1 : k - 1
      expect(lv[beyond]).toBeLessThan(0.2)
      expect(levelsAt(from, [], TMAX).every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true)
    }
  })

  it('drift: a beach and its mirror image behave alike, for every set of groynes', () => {
    for (const g of SUBSETS) {
      const mirrored = g.map((s) => BAYS - s)
      const a = levelsAt('left', g, TMAX)
      const b = levelsAt('right', mirrored, TMAX).slice().reverse()
      a.forEach((v, i) => expect(v, `${g}`).toBeCloseTo(b[i], 6))
      for (const v of a) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
    expect(driftSite('right', 1)).toBe(4)
    expect(screenBay('right', 0)).toBe(4)
  })

  it('drift: a bay behind a groyne never loses sand while the groyne stands', () => {
    for (const g of SUBSETS) {
      let before = levelsAt('left', g, 0)
      for (let t = 0.25; t <= TMAX; t += 0.25) {
        const now = levelsAt('left', g, t)
        for (const s of g) expect(now[s - 1] + 1e-6, `${g} t${t}`).toBeGreaterThanOrEqual(before[s - 1])
        before = now
      }
    }
  })

  it('drift: any set of groynes is marked by the beach it leaves, not by a list', () => {
    for (const c of DRIFTS) {
      for (const g of SUBSETS) {
        const ok = engine.check(c, { groynes: g, t: 0, run: 0 }).ok
        expect(ok, `${nameOf(c)} ${g}`).toBe(levelsAt(fromOf(c), g, TMAX)[hotelBay(c)] >= HOLD_AT)
      }
    }
    expect(groynesOf({ groynes: [3, 3, 9, 1, -2], t: 0, run: 0 })).toEqual([1, 3])
  })
})

describe('the pebbles', { timeout: 30_000 }, () => {
  it('zigzag on along the coast, and never through a groyne', () => {
    for (const g of [[], [1], [3], [2, 4], [1, 2, 3, 4]]) {
      let ps = startPebbles()
      expect(ps.length).toBe(PEBBLES)
      for (let i = 0; i < 1200; i++) {
        const before = ps
        ps = stepPebbles(ps, g, 0.05)
        ps.forEach((p, k) => {
          for (const s of g) {
            const w = s * BAY_W
            if (before[k].x <= w - WALL + 1e-6) expect(p.x, `${g} step ${i}`).toBeLessThanOrEqual(w - WALL + 1e-6)
          }
        })
      }
    }
  })

  it('pile up against a groyne without sitting on one another, and leave the beach beyond it empty', () => {
    const ps = settledPebbles([3], 80)
    for (const p of ps) expect(p.x).toBeLessThanOrEqual(3 * BAY_W - WALL + 1e-6)
    const xs = ps.map((p) => p.x).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1], `${xs}`).toBeGreaterThanOrEqual(SPACING - 0.01)
    expect(ps.filter((p) => p.x > 3 * BAY_W).length).toBe(0)
  })

  it('move on at the rate of the drift when nothing stops them, wrapping at the end', () => {
    let ps = startPebbles()
    const x0 = ps.map((p) => p.x)
    for (let i = 0; i < 100; i++) ps = stepPebbles(ps, [], 0.05)
    const moved = ps.map((p, i) => p.x - x0[i]).filter((d) => d > 0)
    expect(moved.length).toBeGreaterThan(6)
    for (const d of moved) expect(d).toBeGreaterThan(30)
    for (let i = 0; i < 4000; i++) ps = stepPebbles(ps, [], 0.05)
    for (const p of ps) {
      expect(p.x).toBeLessThan(380)
      expect(p.x).toBeGreaterThan(-40)
    }
  })
})

describe('reading the tutor’s config', () => {
  it('reads the usual phrasings', () => {
    expect(engine.parse({ task: 'meander', flow: 'fast', bend: 'second' })).toEqual({ task: 'meander', flow: 'fast', bend: 'second' })
    expect(engine.parse({ task: 'river', flow: 'Fast-flowing', bend: 2 })).toEqual({ task: 'meander', flow: 'fast', bend: 'second' })
    expect(engine.parse({ task: 'meanders' })).toEqual({ task: 'meander', flow: 'steady', bend: 'first' })
    expect(engine.parse({ flow: 'flood' })).toEqual({ task: 'meander', flow: 'fast', bend: 'first' })
    expect(engine.parse({ task: 'longshore drift', from: 'the West', hotel: 'centre' })).toEqual({ task: 'drift', from: 'left', hotel: 'middle' })
    expect(engine.parse({ task: 'groynes', from: 'east', hotel: 'right' })).toEqual({ task: 'drift', from: 'right', hotel: 'right' })
    expect(engine.parse({ from: 'right' })).toEqual({ task: 'drift', from: 'right', hotel: 'middle' })
    expect(engine.parse({ task: 'coast' })).toEqual({ task: 'drift', from: 'left', hotel: 'middle' })
  })

  it('reads what it cannot draw and lets faults say what works', () => {
    const odd = engine.parse({ task: 'meander', flow: 'torrent', bend: 'fourth' })!
    expect(odd).not.toBeNull()
    const f = engine.faults(odd)
    expect(f.length).toBe(2)
    expect(f.join(' ')).toMatch(/e\.g\. flow "steady"/)
    expect(f.join(' ')).toMatch(/e\.g\. bend "first"/)
    const d = engine.parse({ task: 'drift', from: 'north', hotel: 'back' })!
    expect(engine.faults(d).join(' ')).toMatch(/e\.g\. from "left"/)
    expect(engine.faults(d).join(' ')).toMatch(/e\.g\. hotel "middle"/)
  })

  it('returns null only for what it cannot read at all', () => {
    for (const bad of [null, undefined, 3, 'river', [], {}, { task: 'waterfall' }, { task: 'meander', flow: {} }, { task: 'drift', from: ['left'] }]) expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
  })
})

describe('what the prompt may say', () => {
  const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"river-coast", "config": (\{[^}]*\})/g)]

  it('passes the examples in its own catalogue entry', () => {
    expect(found.length).toBe(2)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['meander', 'drift']))
  })

  it('refuses a prompt that gives the answer away, with a nearby prompt that works', () => {
    const m = METEORS[0]
    const d = DRIFTS[1]
    for (const p of [
      'Move the house to the inside of a bend and run the years.',
      'Put the house on plot 3, away from the fast water.',
      'The river cuts the outer bank. Find the safest plot.',
      'Choose the plot where sand is deposited.',
    ]) {
      const out = engine.promptFaults!(m, p)
      expect(out.length, p).toBeGreaterThan(0)
      expect(out.join(' ')).toMatch(/Tap a numbered plot/)
    }
    for (const p of [
      'Build a groyne next to the hotel.',
      'Build a groyne on the side the waves come from.',
      'Use one groyne to keep the hotel beach. Pebbles zigzag along the shore.',
      'Stop the downdrift starving the beach.',
    ]) {
      const out = engine.promptFaults!(d, p)
      expect(out.length, p).toBeGreaterThan(0)
      expect(out.join(' ')).toMatch(/Tap a dotted line/)
    }
    expect(engine.promptFaults!(m, 'Add a waterfall and a delta.').join(' ')).toMatch(/does not show/)
    expect(engine.promptFaults!(d, 'Drag a seawall into place and hold back the tide.').join(' ')).toMatch(/does not show/)
  })

  it('has a good prompt for every config kind, that passes', () => {
    for (const c of ALL) {
      const p = c.task === 'meander'
        ? `Tap a numbered plot to move the house there, and press the plus on Years to run the river forward. Choose a plot where the house is still on dry land after ${TMAX * 50} years.`
        : `Tap a dotted line to build a groyne there, and tap it again to take it away. Keep the beach in front of the hotel thick with sand for the next ${TMAX * 5} years.`
      expect(engine.promptFaults!(c, p), p).toEqual([])
    }
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "river-coast"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'river-coast')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      'Wave Erosion and Deposition', 'Ocean waves and coastal erosion', 'River landforms', 'Rivers and coasts', 'River and coast landforms', 'Meanders and oxbow lakes', 'Longshore drift',
      'Coastal management: groynes and sea defences', 'Middle and lower course river landforms', 'Coastal processes and landforms', 'River erosion and deposition', 'Coastal protection',
      'Meandering rivers', 'Floodplains and levees', 'Spits and bars', 'Beach processes',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Continental drift', 'Genetic drift', 'Electron drift in a wire', 'Snow drift', 'Soil erosion and conservation', 'Wind erosion', 'Glacial erosion and deposition', 'Plate tectonics', 'Tsunamis',
      'Rivers of Ancient Egypt', 'The Nile valley civilisation', 'River valley civilisations', 'The river Thames', 'Money and banks', 'Blood banks', 'Bank accounts', 'Central banks', 'Heat waves', 'Ocean waves', 'Sound waves',
      'Waves', 'River pollution', 'The water cycle', 'Drainage basins', 'Flood management', 'Sea level rise', 'Coastal tourism', 'Coral reefs and mangroves', 'Coastal cities', 'Mouth and teeth', 'Wave speed',
      'Hydrological cycle', 'The Mississippi River in American history', 'Fishing banks', 'Drift nets and fishing', 'Mean, median and mode',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('river-coast')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "river-coast"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:river-coast"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const w of [...FLOWS, ...BENDS, ...HOTELS]) expect(engine.prompt).toContain(`"${w}"`)
    expect(engine.prompt).toContain(`${TMAX * 50} years`)
    expect(engine.prompt).toContain(`${TMAX * 5} years`)
  })
})

describe('the view agrees with the engine', () => {
  it('keeps its literals in step with the config, since it may not read the config while it loads', () => {
    expect(W).toBe(PLAN_W)
    expect(H).toBe(PLAN_H)
    expect(BAYS * BAY_W).toBe(W)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'river-coast', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const PROMPTS = {
    meander: 'Tap a numbered plot to move the house there, and press the plus on Years to run the river forward. Choose a plot where the house is still on dry land after 200 years.',
    drift: 'Tap a dotted line to build a groyne there, and tap it again to take it away. Keep the beach in front of the hotel thick with sand for the next 20 years.',
  }

  it('before marking, nothing says the answer, the rule or a verdict', () => {
    for (const c of ALL) {
      const html = card(c, PROMPTS[c.task])
      expect(html, nameOf(c)).toContain('<button')
      const shown = text(html.replace(PROMPTS[c.task], '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'outside of', 'outer', 'inner', 'cut bank', 'cutbank', 'deposit', 'drops its sand', 'safe', 'zigzag', 'updrift', 'downdrift', 'starv', 'wore away', 'wrong']) {
        expect(shown, `${secret} in ${nameOf(c)}`).not.toContain(secret)
      }
    }
  })

  it('names every colour and shape on the card, and draws every object', () => {
    const m = raw(METEORS[0], engine.initial(METEORS[0]), 'idle')
    for (const w of ['Fast water', 'Sand', 'House', 'Flow']) expect(text(m)).toContain(w)
    expect(m).toContain('data-house="standing"')
    const own = SITES.find((s) => s.id === 'o0')!.n
    for (const n of [1, 2, 3, 4, 5, 6].filter((n) => n !== own)) expect(m).toContain(`Put the house on plot ${n}"`)
    const d = raw(DRIFTS[0], engine.initial(DRIFTS[0]), 'idle')
    for (const w of ['Pebble', 'Groyne', 'Sand', 'Hotel', 'Waves']) expect(text(d)).toContain(w)
    expect((d.match(/data-pebble=/g) ?? []).length).toBe(PEBBLES)
    expect((d.match(/data-groyne="offer"/g) ?? []).length).toBe(4)
  })

  it('shows each move: the house lost to the river, the groyne built, the beach changed', () => {
    const lost = raw(METEORS[0], { site: 'o0', t: TMAX, run: 0 }, 'idle', true)
    expect(lost).toContain('data-house="lost"')
    const safe = raw(METEORS[0], { site: 'i0', t: TMAX, run: 0 }, 'idle', true)
    expect(safe).toContain('data-house="standing"')
    const early = raw(METEORS[0], { site: 'o0', t: 0, run: 0 }, 'idle', true)
    expect(early).toContain('data-house="standing"')
    expect(early).not.toBe(lost)
    expect(early).not.toContain('data-start')
    expect(lost).toContain('data-start')
    const c = DRIFTS[0]
    const a = raw(c, { groynes: [], t: TMAX, run: 0 }, 'idle', true)
    const b = raw(c, { groynes: [3], t: TMAX, run: 0 }, 'idle', true)
    const e = raw(c, { groynes: [3], t: 0, run: 0 }, 'idle', true)
    expect(a).not.toBe(b)
    expect(b).not.toBe(e)
    expect((b.match(/data-groyne="built"/g) ?? []).length).toBe(1)
  })

  it('says what the learner made when it is wrong, and why when it is right', () => {
    const m = METEORS[0]
    const wrong = text(raw(m, { site: 'o0', t: 0, run: 0 }, 'wrong'))
    expect(wrong).toMatch(/You put the house on plot \d/)
    expect(wrong).toMatch(/year \d+/)
    expect(text(raw(m, engine.solve(m), 'right'))).toContain('Yes.')
    const d = DRIFTS[0]
    const hotel = hotelBay(d)
    expect(madeText(d, { groynes: [], t: 0, run: 0 })).toMatch(/no groyne/)
    expect(madeText(d, { groynes: [hotel], t: 0, run: 0 })).toMatch(/side the waves come from/)
    expect(madeText(d, { groynes: [4], t: 0, run: 0 })).toMatch(/no groyne stops/)
    expect(madeText(DRIFTS[2], { groynes: [2, 3, 4], t: 0, run: 0 })).toMatch(/other groynes caught them first/)
    expect(working(d, engine.solve(d))).toMatch(/^Yes\./)
    expect(text(raw(d, engine.solve(d), 'shown'))).toContain('Yes.')
  })

  it('under reduced motion nothing animates', () => {
    for (const c of ALL) expect(raw(c, engine.initial(c), 'idle', true), nameOf(c)).not.toContain('animation:')
    expect(raw(METEORS[0], engine.initial(METEORS[0]), 'idle', false)).toContain('animation:')
  })

  it('locked: the learner can look and not change', () => {
    const html = raw(METEORS[0], engine.solve(METEORS[0]), 'right')
    expect(html).not.toContain('Put the house on plot')
  })
})
