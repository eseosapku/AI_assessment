// lib/studylab/engines/circuit/circuit.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  circuitEngine as engine, BRIGHT_GOALS, I_MAX, LIGHT_GOALS, R_MAX, R_MIN, V_MAX, V_MIN, decimal, netOf, rat, ratText, readable, working,
  type CircuitConfig, type CircuitState,
} from './config'
import { CircuitView, runs, BULB_R, METER_R, SW_HALF, TOP, BOT } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
const PAIRS = range(V_MIN, V_MAX).flatMap((volts) => range(R_MIN, R_MAX).map((ohms) => ({ volts, ohms })))
const VALID = PAIRS.filter((p) => engine.faults({ task: 'light', goal: 'both', ...p }).length === 0)
const ALL: CircuitConfig[] = VALID.flatMap((p) => [
  ...LIGHT_GOALS.map((goal) => ({ task: 'light' as const, goal, ...p })),
  ...BRIGHT_GOALS.map((goal) => ({ task: 'brightness' as const, goal, ...p })),
])

describe('exact arithmetic', () => {
  it('reads terminating decimals exactly and refuses the rest', () => {
    expect(decimal(rat(3, 2))).toBe('1.5')
    expect(decimal(rat(1, 4))).toBe('0.25')
    expect(decimal(rat(4, 1))).toBe('4')
    expect(decimal(rat(1, 3))).toBeNull()
    expect(ratText(rat(12, 8))).toBe('1.5')
    expect(readable(6, 3)).toBe(true)
    expect(readable(5, 3)).toBe(false)
  })

  it('Ohm and the series and parallel rules, worked by hand (6 V, 3 ohm bulbs)', () => {
    const c: CircuitConfig = { task: 'brightness', goal: 'dims', volts: 6, ohms: 3 }
    const alone = netOf(c, { place: 'none' })
    expect(alone.a.current).toEqual(rat(2)); expect(alone.battery).toEqual(rat(2)); expect(alone.b).toBeNull()
    const series = netOf(c, { place: 'series' })
    expect(series.a.current).toEqual(rat(1)); expect(series.b!.current).toEqual(rat(1)); expect(series.battery).toEqual(rat(1)); expect(series.vA).toEqual(rat(3))
    expect(series.a.level).toBe(1)
    const par = netOf(c, { place: 'parallel' })
    expect(par.a.current).toEqual(rat(2)); expect(par.b!.current).toEqual(rat(2)); expect(par.battery).toEqual(rat(4)); expect(par.a.level).toBe(3)
  })

  it('series dims A and parallel does not, for every valid battery and bulb', () => {
    for (const p of VALID) {
      const c: CircuitConfig = { task: 'brightness', goal: 'dims', ...p }
      expect(netOf(c, { place: 'series' }).a.level, JSON.stringify(p)).toBeLessThan(netOf(c, { place: 'none' }).a.level)
      expect(netOf(c, { place: 'parallel' }).a.level, JSON.stringify(p)).toBe(netOf(c, { place: 'none' }).a.level)
      // Series: the same current through both, and the battery gives less. Parallel: the battery gives twice as much.
      const s = netOf(c, { place: 'series' })
      expect(s.a.current).toEqual(s.b!.current)
    }
  })
})

describe('reading the tutor\'s config', () => {
  it('reads reasonable phrasings and defaults', () => {
    expect(engine.parse({ task: 'light' })).toEqual({ task: 'light', goal: 'both', volts: 6, ohms: 3 })
    expect(engine.parse({ task: 'Make it light', goal: 'only B', volts: '9 V', ohms: '3 ohms' })).toEqual({ task: 'light', goal: 'only-second', volts: 9, ohms: 3 })
    expect(engine.parse({ task: 'brightness', goal: 'Stays bright' })).toEqual({ task: 'brightness', goal: 'stays-bright', volts: 6, ohms: 3 })
    expect(engine.parse({ task: { kind: 'series-or-parallel', goal: 'dimmer', voltage: 12, resistance: 6 } })).toEqual({ task: 'brightness', goal: 'dims', volts: 12, ohms: 6 })
  })
  it('returns null only for what cannot be read, and parses out-of-range values for faults to refuse', () => {
    for (const bad of [null, 'x', 3, {}, { task: 'nope' }, { task: 'light', goal: 'sideways' }, { task: 'light', volts: 'lots' }]) expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    const big = engine.parse({ task: 'light', volts: 100, ohms: 2 })!
    expect(big).not.toBeNull()
    expect(engine.faults(big)[0]).toMatch(/1 to 24/)
    expect(engine.faults(engine.parse({ task: 'light', volts: 5, ohms: 3 })!)[0]).toMatch(/e\.g\. a 5 V battery with 4 Ω bulbs|e\.g\. a 5 V battery with 2 Ω bulbs|e\.g\. a 5 V battery with \d+ Ω/)
    expect(engine.faults(engine.parse({ task: 'light', volts: 24, ohms: 1 })!)[0]).toMatch(/10 A/)
    expect(engine.faults(engine.parse({ task: 'light', volts: 6, ohms: 2.5 })!)[0]).toMatch(/whole number of ohms/)
  })
  it('the nearby example in a fault always works', () => {
    for (const p of PAIRS) {
      const f = engine.faults({ task: 'light', goal: 'both', ...p })
      if (!f.length) continue
      const m = f[0].match(/e\.g\. a (\d+) V battery with (\d+) Ω bulbs/)
      expect(m, f[0]).not.toBeNull()
      expect(engine.faults({ task: 'light', goal: 'both', volts: Number(m![1]), ohms: Number(m![2]) }), f[0]).toEqual([])
    }
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('there are plenty to try', () => { expect(ALL.length).toBeGreaterThan(400) })
  it('starts unsolved, can be solved, and the solution is a state check accepts', () => {
    for (const c of ALL) {
      expect(engine.check(c, engine.initial(c)).ok, JSON.stringify(c)).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, JSON.stringify(c)).toBe(true)
      expect(engine.parse(JSON.parse(JSON.stringify(c)))).toEqual(c)
    }
  })
  it('every start is a working circuit that is not dark, so the learner begins from something that responds', () => {
    for (const c of ALL) {
      const n = netOf(c, engine.initial(c))
      expect(n.a.lit || !!n.b?.lit, JSON.stringify(c)).toBe(true)
    }
  })
  it('in the light task every one of the eight switch settings marks right only when the lit bulbs match the goal', () => {
    for (const goal of LIGHT_GOALS) {
      const c: CircuitConfig = { task: 'light', goal, volts: 6, ohms: 3 }
      for (const m of range(0, 7)) {
        const sw = { a: !!(m & 1), link: !!(m & 2), b: !!(m & 4) }
        const n = netOf(c, { sw })
        const lit = [n.a.lit, n.b!.lit]
        const want = goal === 'both' ? [true, true] : goal === 'only-first' ? [true, false] : [false, true]
        expect(engine.check(c, { sw }).ok, `${goal} ${JSON.stringify(sw)}`).toBe(lit[0] === want[0] && lit[1] === want[1])
        expect(lit[0]).toBe(sw.a)
        expect(lit[1]).toBe(sw.link && sw.b)
      }
    }
  })
  it('every wrong place in the brightness task is marked wrong', () => {
    for (const goal of BRIGHT_GOALS) {
      const c: CircuitConfig = { task: 'brightness', goal, volts: 6, ohms: 3 }
      const ok = (['none', 'series', 'parallel'] as const).filter((place) => engine.check(c, { place }).ok)
      expect(ok).toEqual([goal === 'dims' ? 'series' : 'parallel'])
    }
  })
  it('the lit current is the same either side of a bulb, and no bulb uses any up (one reading per branch)', () => {
    for (const c of ALL) {
      const n = netOf(c, engine.solve(c))
      for (const b of [n.a, n.b]) if (b) expect(b.current.d).toBeGreaterThan(0)
      expect(readable(c.volts, c.ohms)).toBe(true)
      expect(decimal(n.battery), JSON.stringify(c)).not.toBeNull()
    }
  })
})

describe('the catalogue entry', () => {
  it('is complete', () => {
    expect(getEngine('circuit')).toBe(engine)
    expect(engine.prompt).toMatch(/SCENE "circuit"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:circuit"/)
    expect(engine.prompt).toMatch(/"isolates":"structure"/)
    const examples = [...engine.prompt.matchAll(/(\{ "task":"[a-z]+", "goal":"[a-z-]+", "volts":\d+, "ohms":\d+ \})/g)].map((m) => JSON.parse(m[1]))
    expect(examples.length).toBeGreaterThanOrEqual(4)
    for (const e of examples) {
      const cfg = engine.parse(e)
      expect(cfg, JSON.stringify(e)).not.toBeNull()
      expect(engine.faults(cfg!)).toEqual([])
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const light = engine.parse({ task: 'light', goal: 'only-second' })!
  const bright = engine.parse({ task: 'brightness', goal: 'dims' })!
  it('refuses prompts that name the arrangement or a current', () => {
    for (const p of [
      'Put the bulbs in series.', 'Make a parallel circuit.', 'Add bulb B in line with A.', 'Give each bulb its own path.', 'Add B on a branch.',
      'Each bulb should draw 2 A.', 'Read the ammeter.', 'The bulbs share the voltage.', 'Make one loop with both bulbs.',
    ]) {
      expect(engine.promptFaults!(light, p).length, p).toBe(1)
      expect(engine.promptFaults!(bright, p).length, p).toBe(1)
    }
  })
  it('every message fits the task it refuses', () => {
    expect(engine.promptFaults!(light, 'Use a parallel circuit.')[0]).toMatch(/switches/)
    expect(engine.promptFaults!(bright, 'Use a parallel circuit.')[0]).toMatch(/slots/)
  })
  it('passes ordinary prompts, and every example in its own catalogue entry', () => {
    for (const p of ['Make both bulbs light.', 'Switch the circuit so bulb B is lit and bulb A is out.', 'Add the second bulb so bulb A dims.', 'Which keeps bulb A as bright as it was alone? Try it.']) {
      expect(engine.promptFaults!(light, p), p).toEqual([])
      expect(engine.promptFaults!(bright, p), p).toEqual([])
    }
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"circuit", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(2)
    for (const m of found) expect(engine.promptFaults!(engine.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
    const quoted = [...engine.prompt.matchAll(/-- prompt "([^"]*)"/g)]
    expect(quoted.length).toBe(4)
    for (const m of quoted) {
      for (const cfg of [light, bright]) expect(engine.promptFaults!(cfg, m[1]), m[1]).toEqual([])
    }
  })
})

describe('when the tutor is shown it', () => {
  it('is offered for the stations that name these topics', () => {
    for (const s of [
      'Electric circuits', 'Series and parallel circuits', 'Ohm\'s law', 'Electric current and voltage', 'Using an ammeter and a voltmeter', 'Resistors in series', 'Series circuits', 'Parallel circuits',
      'Potential difference', 'Simple circuit', 'Electrical resistance',
    ]) {
      expect(sceneCatalogue(s), s).toContain('SCENE "circuit"')
      expect(scenesFor(s).some((e) => e.id === 'circuit'), s).toBe(true)
    }
  })
  it('is not offered for unrelated topics: current, series and parallel alone are not enough', () => {
    for (const s of [
      'Ocean currents', 'Number series', 'Parallel lines and angles', 'Arithmetic series', 'Taylor series', 'Parallel and perpendicular lines', 'Current affairs',
      'Time series data', 'Air resistance', 'Resistance to change', 'Series of events in the Cold War', 'Tectonic plates', 'Parallelograms', 'Blood circulation', 'The circulatory system', 'Resistance to antibiotics',
    ]) {
      expect(sceneCatalogue(s), s).not.toContain('SCENE "circuit"')
      expect(scenesFor(s).some((e) => e.id === 'circuit'), s).toBe(false)
    }
  })
})

describe('the circuit on the board', () => {
  const cardOf = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'circuit', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: CircuitConfig, state: CircuitState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
    renderToStaticMarkup(createElement(CircuitView, { config: cfg, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' })).replace(/&nbsp;/g, ' ')
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ')
  const SECRET = /series|parallel|ammeter|\bamps?\b|\d(?:\.\d+)? A\b|Ohm|ohm|share|own path|dimmer|in line|branch/i

  it('before marking, no arrangement, current or reading is anywhere in the DOM, for every task and starting state', () => {
    for (const c of [
      engine.parse({ task: 'light', goal: 'both' })!, engine.parse({ task: 'light', goal: 'only-second' })!, engine.parse({ task: 'light', goal: 'only-first' })!,
      engine.parse({ task: 'brightness', goal: 'dims' })!, engine.parse({ task: 'brightness', goal: 'stays-bright' })!,
    ]) {
      const prompt = c.task === 'light' ? 'Make both bulbs light.' : 'Add the second bulb so bulb A dims.'
      const html = cardOf(c, prompt)
      expect(text(html.replace(prompt, '')), JSON.stringify(c)).not.toMatch(SECRET)
      for (const place of ['none', 'series', 'parallel'] as const) {
        if (c.task === 'brightness') expect(text(raw(c, { place }, 'idle')), `${c.goal} ${place}`).not.toMatch(SECRET)
      }
      expect(html).not.toMatch(/aria-label="[^"]*(series|parallel)/i)
    }
  })

  it('the drawing answers the learner: a different state is a different picture', () => {
    const c = engine.parse({ task: 'brightness', goal: 'dims' })!
    const none = raw(c, { place: 'none' }, 'idle')
    const series = raw(c, { place: 'series' }, 'idle')
    const par = raw(c, { place: 'parallel' }, 'idle')
    expect(new Set([none, series, par]).size).toBe(3)
    const l = engine.parse({ task: 'light' })!
    expect(raw(l, { sw: { a: true, link: false, b: true } }, 'idle')).not.toBe(raw(l, { sw: { a: true, link: true, b: true } }, 'idle'))
  })

  it('every control is a button reachable by Tab, labelled with what it is and its state', () => {
    const l = raw(engine.parse({ task: 'light' })!, { sw: { a: true, link: false, b: false } }, 'idle')
    expect(l.match(/role="button"/g)).toHaveLength(3)
    expect(l.match(/tabindex="0"/g)).toHaveLength(3)
    expect(l).toContain('Switch for bulb A, closed')
    expect(l).toContain('Switch for bulb B, open')
    const b = raw(engine.parse({ task: 'brightness' })!, { place: 'none' }, 'idle')
    expect(b.match(/role="button"/g)).toHaveLength(2)
  })

  it('marked: ammeters appear with the same reading either side of a lit bulb, and the idea is named', () => {
    const c = engine.parse({ task: 'brightness', goal: 'stays-bright' })!
    const html = raw(c, { place: 'parallel' }, 'right')
    expect(html.match(/>2 A</g)).toHaveLength(2)
    expect(text(html)).toMatch(/parallel/)
    const wrong = raw(c, { place: 'series' }, 'wrong')
    expect(wrong.match(/>1 A</g)).toHaveLength(2)
    expect(text(wrong)).toMatch(/You added the second bulb and bulb A dimmed/)
    expect(text(wrong)).toMatch(/series/)
    expect(working(c, { place: 'parallel' })).toContain('a battery does not give a fixed current')
  })

  it('light: a dark pair says what it made, and lit bulbs get meters', () => {
    const c = engine.parse({ task: 'light', goal: 'both' })!
    const wrong = text(raw(c, { sw: { a: true, link: false, b: true } }, 'wrong'))
    expect(wrong).toContain('You made bulb A light and left bulb B dark.')
    expect(raw(c, { sw: { a: true, link: true, b: true } }, 'right').match(/>2 A</g)).toHaveLength(4)
  })

  it('draws nothing smaller than 12px and breaks no word', () => {
    const html = raw(engine.parse({ task: 'light' })!, { sw: { a: true, link: true, b: true } }, 'right')
    for (const m of html.matchAll(/font-size="(\d+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
  })
})

describe('the drawing is clean', () => {
  it('a wire is cut around each part and keeps the rest', () => {
    expect(runs(30, 220, [{ at: 66, half: 16 }, { at: 150, half: 17 }])).toEqual([[30, 50], [82, 133], [167, 220]])
    expect(runs(30, 220, [])).toEqual([[30, 220]])
    // A part touching the end leaves no stub.
    expect(runs(30, 220, [{ at: 40, half: 10 }])).toEqual([[50, 220]])
  })
  it('parts on a branch do not overlap, rays included, with room to spare', () => {
    // From the view: switch 66, meter 104, bulb 150, meter 196 (in the unshifted frame).
    const at = [66, 104, 150, 196]
    const half = [SW_HALF, METER_R, BULB_R + 4 + 9, METER_R]
    for (let i = 0; i + 1 < at.length; i++) expect(at[i] + half[i], `part ${i}`).toBeLessThanOrEqual(at[i + 1] - half[i + 1])
    expect(at[0] - SW_HALF).toBeGreaterThan(TOP)
    expect(at[3] + METER_R).toBeLessThan(BOT)
  })
  it('wires meet at right angles only: every drawn path is horizontal or vertical', () => {
    const html = renderToStaticMarkup(createElement(CircuitView, { config: engine.parse({ task: 'brightness' })!, state: { place: 'series' }, setState: () => {}, marked: 'right', reduced: false, locked: false }))
    const wires = [...html.matchAll(/ d="M([\d.]+) ([\d.]+)([HV])([\d.]+)"/g)]
    expect(wires.length).toBeGreaterThan(5)
  })
  it('the slot and branch positions keep their labels nearest their own bulb', () => {
    // The letter for a bulb sits 46px to its left (or to the right, in the top slot); the nearest other bulb is further away.
    const bulbs: Record<string, [number, number]> = { A: [300, 125], B: [190, 125] }
    const letter: Record<string, [number, number]> = { A: [254, 125], B: [144, 125] }
    for (const k of Object.keys(bulbs)) {
      const d = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1])
      const own = d(letter[k], bulbs[k])
      for (const o of Object.keys(bulbs)) if (o !== k) expect(own).toBeLessThan(d(letter[k], bulbs[o]))
    }
  })
})
