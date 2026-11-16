// lib/studylab/engines/stocks-flows/stocks-flows.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  stocksFlowsEngine as engine, CAP, CASES, H, RATE_MAX, SETTING, SETTINGS, SOLIDS, STEPS, TANK, TASKS, UNIT, W,
  answer, caseOf, done, endLevel, goodPrompt, levelY, madeText, rawLevel, settingOf, settingsOf, shownLevel, tagBox, tagsOf, timeText, working,
  type Box, type StocksConfig, type StocksState, type Tag,
} from './config'
import { H as VH, StocksFlowsView, W as VW } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const ALL: StocksConfig[] = TASKS.flatMap((task) => SETTINGS.flatMap((setting) => CASES[task].map((_, i) => ({ task, setting, variant: i + 1 }))))
const nameOf = (c: StocksConfig) => JSON.stringify(c)
/** Every state the learner can reach: each setting of the flow they turn, at every moment. */
const everyState = (c: StocksConfig): StocksState[] => {
  const k = caseOf(c)
  const out: StocksState[] = []
  for (let v = 0; v <= RATE_MAX; v++) for (let t = 0; t <= STEPS; t++) out.push({ tap: k.adjust === 'tap' ? v : k.tap, drain: k.adjust === 'drain' ? v : k.drain, t })
  return out
}

describe('the store, from first principles', () => {
  it('the level after t steps is the start plus in minus out, and the tank clamps only what is drawn', () => {
    const c: StocksConfig = { task: 'reach', setting: 'bath', variant: 1 } // start 3, drain 2, tap turned
    expect(rawLevel(c, { tap: 3, drain: 2, t: 3 })).toBe(6)
    expect(rawLevel(c, { tap: 5, drain: 2, t: 3 })).toBe(12)
    expect(shownLevel(c, { tap: 5, drain: 2, t: 3 })).toBe(CAP)
    expect(rawLevel(c, { tap: 0, drain: 2, t: 3 })).toBe(-3)
    expect(shownLevel(c, { tap: 0, drain: 2, t: 3 })).toBe(0)
    expect(rawLevel(c, { tap: 3, drain: 2, t: 0 })).toBe(3)
  })

  it('clamping is exact for constant flows: a level that hits a wall stays there', () => {
    for (const c of ALL) for (const s of everyState(c)) {
      const walk = [0, 1, 2, 3].map((t) => shownLevel(c, s, t))
      // Never leaves the tank, never changes direction, and once at a wall it stays.
      walk.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(CAP) })
      const net = settingsOf(c, s).tap - settingsOf(c, s).drain
      for (let i = 1; i < walk.length; i++) expect(Math.sign(walk[i] - walk[i - 1]) * Math.sign(net) >= 0, nameOf(c)).toBe(true)
    }
  })

  it('every prepared problem starts unsolved with a single answer in range that is not the extreme mistake', () => {
    for (const task of TASKS) {
      CASES[task].forEach((k, i) => {
        const c: StocksConfig = { task, setting: 'bath', variant: i + 1 }
        const right = everyState({ ...c }).filter((s) => s.t === STEPS && done(c, s))
        expect(right, `${task} ${i + 1}`).toHaveLength(1)
        expect(k.start).toBeGreaterThanOrEqual(1)
        expect(k.start).toBeLessThanOrEqual(CAP - 1)
        expect(k.aim).toBeGreaterThanOrEqual(1)
        expect(k.aim).toBeLessThanOrEqual(CAP - 1)
        const v = answer(c)
        expect(v, `${task} ${i + 1}`).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(RATE_MAX)
        // The mistakes the cases are built for: closing the flow right off, or leaving it alone.
        expect(done(c, { tap: k.adjust === 'tap' ? 0 : k.tap, drain: k.adjust === 'drain' ? 0 : k.drain, t: STEPS })).toBe(false)
        expect(done(c, engine.initial(c))).toBe(false)
      })
    }
    // The turn-it-down case really needs the flow in to stay on, and the rise case really keeps rising.
    expect(answer({ task: 'reach', setting: 'bath', variant: 1 })).toBeGreaterThan(0)
    expect(answer({ task: 'reach', setting: 'bath', variant: 2 })).toBeGreaterThan(0)
    expect(caseOf({ task: 'reach', setting: 'bath', variant: 1 }).aim).toBeGreaterThan(caseOf({ task: 'reach', setting: 'bath', variant: 1 }).start)
    expect(caseOf({ task: 'reach', setting: 'bath', variant: 2 }).aim).toBeLessThan(caseOf({ task: 'reach', setting: 'bath', variant: 2 }).start)
    // A steady level is flow in and out at the same rate, not no flow.
    for (let i = 1; i <= CASES.balance.length; i++) expect(answer({ task: 'balance', setting: 'bath', variant: i })).toBeGreaterThan(0)
  })

  it('the units of every setting agree: a flow times a step is a whole number of level notches', () => {
    for (const name of SETTINGS) {
      const s = SETTING[name]
      expect(s.rateScale * s.timeStep, name).toBe(s.levelScale)
      expect(s.level(3)).toContain(String(3 * s.levelScale))
      expect(s.rate(3)).toContain(String(3 * s.rateScale))
    }
    expect(timeText({ task: 'balance', setting: 'carbon', variant: 1 }, 3)).toBe('75 years')
    expect(timeText({ task: 'balance', setting: 'bath', variant: 1 }, 1)).toBe('1 minute')
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
    expect(ALL.length).toBe(28)
  })

  it('marks exactly by the rule, whatever moment the time slider is on', () => {
    for (const c of ALL) {
      const k = caseOf(c)
      for (const s of everyState(c)) {
        const f = settingsOf(c, s)
        const should = k.start + (f.tap - f.drain) * STEPS === k.aim
        expect(engine.check(c, s).ok, `${nameOf(c)} ${JSON.stringify(s)}`).toBe(should)
      }
    }
  })

  it('can always be solved by pressing + or − from the start, one notch at a time', () => {
    for (const c of ALL) {
      const k = caseOf(c)
      let s = engine.initial(c)
      const goal = answer(c)
      const key = k.adjust
      while (s[key] !== goal) s = { ...s, [key]: s[key] + (goal > s[key] ? 1 : -1) }
      expect(engine.check(c, s).ok, nameOf(c)).toBe(true)
    }
  })

  it('refuses a state that could not have been made, and never lets the fixed flow move', () => {
    const c: StocksConfig = { task: 'balance', setting: 'bath', variant: 1 } // tap fixed at 3, drain turned
    expect(engine.check(c, {} as never).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { tap: 'x', drain: 3.5, t: 'y' } as never).ok).toBe(false)
    expect(engine.check(c, { tap: 0, drain: 3, t: 3 }).ok).toBe(true) // the fixed tap is held at its own value
    expect(engine.check(c, { tap: 3, drain: 99, t: 3 }).ok).toBe(false)
    expect(settingsOf(c, { tap: 1, drain: 3, t: 99 })).toEqual({ tap: 3, drain: 3, t: STEPS })
  })

  it('says something true when marked, and what was made when wrong, without the rule before then', () => {
    for (const c of ALL) {
      const s = settingOf(c)
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      expect(said, nameOf(c)).toContain(s.rate(settingsOf(c, engine.solve(c)).tap))
      expect(said).toMatch(c.task === 'balance' ? /in minus out/ : /gap between in and out/)
      const wrong = madeText(c, engine.initial(c))
      expect(wrong.startsWith('You made'), nameOf(c)).toBe(true)
      expect(wrong).not.toMatch(/^Yes/)
    }
    expect(madeText({ task: 'reach', setting: 'bath', variant: 2 }, { tap: 0, drain: 3, t: 3 })).toMatch(/end at nothing/)
    expect(madeText({ task: 'reach', setting: 'bath', variant: 1 }, { tap: 5, drain: 2, t: 3 })).toMatch(/ends full/)
    expect(madeText({ task: 'reach', setting: 'bath', variant: 1 }, { tap: 3, drain: 2, t: 3 }).startsWith('You made')).toBe(true)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'balance', setting: 'bath' })).toEqual({ task: 'balance', setting: 'bath', variant: 1 })
    expect(engine.parse({ task: 'Hold steady', setting: 'The Carbon Cycle', variant: '2' })).toEqual({ task: 'balance', setting: 'carbon', variant: 2 })
    expect(engine.parse({ task: 'reach the target', setting: 'water cycle', case: 3 })).toEqual({ task: 'reach', setting: 'lake', variant: 3 })
    expect(engine.parse({ task: 'turn-down', setting: 'births and deaths', variant: 'variant 4' })).toEqual({ task: 'reach', setting: 'population', variant: 4 })
    expect(engine.parse({ setting: 'a bathtub' })).toEqual({ task: 'balance', setting: 'bath', variant: 1 })
    expect(engine.parse({ task: 'reach' })).toEqual({ task: 'reach', setting: 'bath', variant: 1 })
    expect(engine.parse({ kind: 'steady-state', context: 'herd' })).toEqual({ task: 'balance', setting: 'population', variant: 1 })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('bath')).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 5 })).toBeNull()
    expect(engine.parse({ setting: 7 })).toBeNull()
    expect(engine.parse({ variant: 'hard' })).toBeNull()
    // Unknown or out of range still parses: faults says what would work.
    expect(engine.parse({ task: 'balance', setting: 'ocean' })).not.toBeNull()
    expect(engine.parse({ task: 'balance', setting: '__proto__' })).not.toBeNull()
    expect(engine.parse({ task: 'reach', variant: 9 })).not.toBeNull()
    expect(engine.parse({ task: 'reach', variant: 2.5 })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const cases: [StocksConfig, RegExp][] = [
      [{ task: 'balance', setting: 'ocean', variant: 1 }, /bath, lake, population, carbon/],
      [{ task: 'balance', setting: '__proto__', variant: 1 }, /bath, lake, population, carbon/],
      [{ task: 'reach', setting: 'bath', variant: 9 }, /1 to 4/],
      [{ task: 'balance', setting: 'bath', variant: 4 }, /1 to 3/],
      [{ task: 'reach', setting: 'bath', variant: 0 }, /1 to 4/],
      [{ task: 'reach', setting: 'bath', variant: 2.5 }, /1 to 4/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const setting = f[0].match(/e\.g\. setting "(\w+)"/)
      const variant = f[0].match(/e\.g\. variant (\d+)/)
      const fixed = { ...c, ...(setting ? { setting: setting[1] } : {}), ...(variant ? { variant: Number(variant[1]) } : {}) }
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok).toBe(true)
    }
    // Nothing a refused config can do crashes the rest of the engine or the view.
    for (const [c] of cases) {
      expect(engine.check(c, engine.initial(c)).ok, nameOf(c)).toBe(false)
      expect(() => renderToStaticMarkup(createElement(StocksFlowsView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: StocksConfig, p: string) => engine.promptFaults!(c, p)
  const bath: StocksConfig = { task: 'balance', setting: 'bath', variant: 1 }
  const carbon: StocksConfig = { task: 'reach', setting: 'carbon', variant: 2 }

  it('asking for the outcome is fine, naming the idea included', () => {
    expect(pf(bath, 'Use the − and + buttons on Drain so that the water in the bath is still at its start line after 3 minutes.')).toEqual([])
    expect(pf(carbon, 'Carbon moves between the air, plants and the sea. Use the − and + buttons on Emissions to bring the carbon in the air to the aim line after 75 years.')).toEqual([])
    expect(pf(bath, 'This bath has a tap and a drain. Use the − and + buttons on Drain to keep the water at its start line, then move the time slider to check.')).toEqual([])
  })

  it('what to set, that the flows match, or what the level will do is not', () => {
    for (const p of [
      'Set the drain to 3 litres a minute.', 'Turn the tap to zero.', 'Make the drain equal to the tap.', 'The flows must match.', 'Make the flow out the same as the flow in.',
      'Shut the tap right off.', 'The level will fall if you turn the tap down.', 'The bath keeps rising unless you open the drain.', 'Find where in minus out is nothing.',
      'The tap is still running but the level still falls.', 'Make the drain faster than the tap.', 'Turn it up to 2.', 'Cut emissions in half.',
    ]) expect(pf(bath, p), p).toHaveLength(1)
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Drag the wheel to open the valve.', 'Sketch a graph of the level.', 'Plot the level against time.', 'Write the equation for the level.', 'Predict the next ten years.']) {
      expect(pf(bath, p), p).toHaveLength(1)
      expect(pf(bath, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    const quoted = (c: StocksConfig) => pf(c, 'Set it to 3 and drag the wheel.')[0].match(/\("([^"]+)"\)/)![1]
    for (const c of ALL) {
      const fix = quoted(c)
      expect(fix, nameOf(c)).toBe(goodPrompt(c))
      expect(pf(c, fix), nameOf(c)).toEqual([])
      const k = caseOf(c)
      expect(fix).toContain(k.adjust === 'tap' ? settingOf(c).inName : settingOf(c).outName)
      expect(fix).toContain(timeText(c, STEPS))
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"stocks-flows", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(f[1], f[2]).toBe(goodPrompt(c))
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['balance', 'reach']))
    // The "the prompt says" lines name the same prompts.
    for (const f of found) expect(engine.prompt).toContain(`the prompt says "${f[1]}"`)
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "stocks-flows"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'stocks-flows')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Stocks and flows', 'The carbon cycle', 'Carbon cycles', 'The water cycle', 'Nutrient cycles', 'Population growth', 'Population change', 'Birth rates and death rates', 'Natural increase',
      'Water balance in a drainage basin', 'Inflows and outflows', 'Carbon stores and sinks', 'Chapter 6: The global water cycle', 'Changes in population size', 'Systems thinking: stores and flows',
      'Bathtub dynamics', 'Greenhouse gas emissions',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for the economy, stock-keeping, other growth, other cycles or other populations', () => {
    for (const st of [
      'Stocks and flows of capital in the economy', 'Circular flow of income', 'The stock market', 'Stock control', 'Stock valuation', 'Stocks and shares', 'Cash flow forecasts', 'Cash flow statements',
      'Inflation and unemployment', 'Balance of payments', 'Capital stock and investment', 'Money flows', 'Business inventory',
      'Population pyramids', 'Population density and distribution', 'Ageing populations', 'Exponential growth and decay', 'Bacterial growth curves', 'Logistic growth', 'Demographic transition model',
      'Sampling a population', 'Population genetics', 'Compound interest',
      'The nitrogen cycle', 'The Krebs cycle', 'The cell cycle', 'Life cycles of plants', 'The rock cycle', 'Calvin cycle', 'Carbon footprints', 'Carbon dating', 'Carbon compounds',
      'Flow charts', 'Flowcharts and algorithms', 'Energy flow in ecosystems', 'Hydrographs and flood risk', 'Blood flow in the heart', 'Rate of flow of charge', 'Inflorescence', 'Ordinary differential equations',
      'Water treatment', 'Water pollution', 'Water supply', 'Food webs', 'Macroeconomics: aggregate demand',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('stocks-flows')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "stocks-flows"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:stocks-flows"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const n of SETTINGS) expect(engine.prompt).toContain(n)
    expect(engine.prompt).toContain(`variants 1 to ${CASES.balance.length}`)
    expect(engine.prompt).toContain(`variants 1 to ${CASES.reach.length}`)
  })
})

describe('a still frame is a frame a learner sees', { timeout: 30_000 }, () => {
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const center = (b: Box) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 })
  // Every state of the label set: nothing, brimming over, empty.
  const sets = (c: StocksConfig): Tag[][] => [tagsOf(c, null), tagsOf(c, CAP + 3), tagsOf(c, -3), tagsOf(c, 5)]

  it('nothing named falls off the plate, touches another label, or sits on a part', () => {
    for (const c of ALL) for (const tags of sets(c)) {
      const boxes = tags.map((t) => ({ t, box: tagBox(t) }))
      boxes.forEach((a, i) => {
        expect(a.box.left, `${a.t.text} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
        expect(a.box.right, `${a.t.text} ${nameOf(c)}`).toBeLessThanOrEqual(W)
        expect(a.box.top, `${a.t.text} ${nameOf(c)}`).toBeGreaterThanOrEqual(0)
        expect(a.box.bottom, `${a.t.text} ${nameOf(c)}`).toBeLessThanOrEqual(H)
        boxes.forEach((o, j) => { if (j > i) expect(hits(a.box, o.box), `${a.t.text} / ${o.t.text} ${nameOf(c)}`).toBe(false) })
        for (const p of SOLIDS) expect(hits(a.box, p.box), `${a.t.text} on ${p.name} ${nameOf(c)}`).toBe(false)
      })
    }
  })

  it('every label sits nearer its own part than any other label’s', () => {
    for (const c of ALL) for (const tags of sets(c)) for (const t of tags) {
      const here = center(tagBox(t))
      const mine = Math.hypot(here.x - t.part.x, here.y - t.part.y)
      for (const o of tags) if (o !== t) expect(mine, `${t.text} nearer ${o.text} in ${nameOf(c)}`).toBeLessThan(Math.hypot(here.x - o.part.x, here.y - o.part.y))
    }
  })

  it('the start and aim lines are far enough apart for their labels, and the labels stay inside the vessel', () => {
    for (const c of ALL) {
      const k = caseOf(c)
      expect(Math.abs(levelY(k.start) - levelY(k.aim)) >= 2 * UNIT || c.task === 'balance', nameOf(c)).toBe(true)
      for (const t of tagsOf(c, null).filter((x) => x.text === 'Start' || x.text === 'Aim')) {
        const b = tagBox(t)
        expect(b.left).toBeGreaterThanOrEqual(TANK.left)
        expect(b.right).toBeLessThanOrEqual(TANK.right)
        expect(b.top).toBeGreaterThanOrEqual(TANK.top)
      }
    }
  })

  it('no more than about eight short labels, and each thing in the picture is named', () => {
    for (const c of ALL) {
      const tags = tagsOf(c, null)
      expect(tags.length, nameOf(c)).toBeLessThanOrEqual(8)
      const s = settingOf(c)
      expect(tags.map((t) => t.text)).toEqual(expect.arrayContaining([s.inName, s.outName, s.store, 'Start']))
      if (c.task === 'reach') expect(tags.map((t) => t.text)).toContain('Aim')
    }
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    const html = renderToStaticMarkup(createElement(StocksFlowsView, { config: ALL[0], state: engine.initial(ALL[0]), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`)
    expect([VW, VH]).toEqual([W, H])
    expect([W, H, CAP, STEPS, TANK.top, TANK.bottom, TANK.left, TANK.right, UNIT]).toEqual([360, 252, 10, 3, 62, 192, 128, 232, 13])
    expect(html).toContain(`x="${TANK.left}" y="${TANK.top}" width="${TANK.right - TANK.left}" height="${TANK.bottom - TANK.top}"`)
    expect(html).toContain('data-level="8"')
  })

  it('one smallest move changes the level by a whole step of the scale', () => {
    for (const c of ALL) {
      const k = caseOf(c)
      for (const v of [0, 1, 2, 3, 4]) {
        const a = { tap: k.adjust === 'tap' ? v : k.tap, drain: k.adjust === 'drain' ? v : k.drain, t: STEPS }
        const b = { ...a, [k.adjust]: v + 1 }
        const gapNow = Math.abs(rawLevel(c, a) - rawLevel(c, b))
        // At least one tick of the scale on a full period (13 px), before any wall hides it.
        expect(gapNow * UNIT, nameOf(c)).toBeGreaterThanOrEqual(UNIT)
        expect(endLevel(c, a) - endLevel(c, b)).toBe((k.adjust === 'tap' ? -1 : 1) * STEPS)
      }
    }
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'stocks-flows', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: StocksConfig, state: StocksState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(StocksFlowsView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: StocksConfig[] = [
    { task: 'balance', setting: 'bath', variant: 1 }, { task: 'reach', setting: 'carbon', variant: 2 }, { task: 'reach', setting: 'lake', variant: 3 }, { task: 'balance', setting: 'population', variant: 2 },
  ]

  it('before marking, nothing says the answer, the rule or whether it is right', () => {
    for (const cfg of EXAMPLES) {
      const html = card(cfg, goodPrompt(cfg))
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(goodPrompt(cfg), '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'You made', 'gap', 'minus', 'Steady is not still', 'goes in than out', 'still rises', 'ends full', 'ends at nothing', 'correct', 'right']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
    }
  })

  it('names what it draws, on the card, before marking', () => {
    for (const cfg of EXAMPLES) {
      const s = settingOf(cfg)
      const t = text(raw(cfg, engine.initial(cfg), 'idle'))
      for (const name of [s.inName, s.outName, s.store, 'Start', 'Where it started', 'A wider stream runs faster', 'Time', s.measure, '(fixed)']) expect(t, `${name} ${nameOf(cfg)}`).toContain(name)
      if (cfg.task === 'reach') expect(t).toContain('Aim')
      else expect(t).not.toContain('Aim')
    }
  })

  it('marking says what was made when wrong, and why when right', () => {
    const c: StocksConfig = { task: 'reach', setting: 'bath', variant: 2 }
    expect(text(raw(c, { tap: 0, drain: 3, t: 3 }, 'wrong'))).toContain('You made 0 L/min in and 30 L/min out')
    expect(text(raw(c, engine.solve(c), 'right'))).toContain('gap between in and out')
    expect(text(raw({ task: 'balance', setting: 'bath', variant: 1 }, engine.solve({ task: 'balance', setting: 'bath', variant: 1 }), 'right'))).toContain('Steady is not still')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const c: StocksConfig = { task: 'reach', setting: 'bath', variant: 2 }
    const html = raw(c, { tap: 5, drain: 3, t: 1 }, 'shown')
    expect(html).toContain('data-flow="2"')
    expect(html).toContain('data-time="3"')
    expect(html.match(/<button[^>]*disabled/g)?.length).toBe(2)
  })

  it('every control is a real button with its own label, and locks when solved', () => {
    for (const cfg of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const buttons = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
      expect(buttons.map((m) => m[1]), nameOf(cfg)).toHaveLength(2)
      for (const m of buttons) expect(m[0]).toContain('type="button"')
      expect(buttons.map((m) => m[1]).join(' ')).toMatch(/Less .*More /)
      expect(idle, nameOf(cfg)).toContain('nodrag')
      expect(idle).toContain('type="range"')
      expect(idle).toContain('aria-label="Time"')
      expect(raw(cfg, engine.solve(cfg), 'right').match(/<button[^>]*disabled/g)?.length).toBe(2)
    }
    // At the ends the button that cannot go further is disabled.
    const atZero = raw({ task: 'reach', setting: 'bath', variant: 2 }, { tap: 0, drain: 3, t: 3 }, 'idle')
    expect(atZero).toMatch(/<button[^>]*aria-label="Less tap"[^>]*disabled/)
    const atMax = raw({ task: 'reach', setting: 'bath', variant: 1 }, { tap: 5, drain: 2, t: 3 }, 'idle')
    expect(atMax).toMatch(/<button[^>]*aria-label="More tap"[^>]*disabled/)
  })

  it('keyboard help is for keyboard users', () => {
    const html = raw(EXAMPLES[0], {} as never, 'idle')
    expect(html).toContain('[&amp;:has(button:focus-visible)_.sf-kbd]:block')
    expect(html).toMatch(/sf-kbd hidden/)
  })

  it('the still frame changes with every move, with nothing animating under reduced motion', () => {
    for (const cfg of EXAMPLES) {
      const k = caseOf(cfg)
      const first = raw(cfg, engine.initial(cfg), 'idle', true)
      expect(first, nameOf(cfg)).not.toMatch(/transition:\s*[a-z]/)
      for (const v of [0, 1, 2, 3, 4, 5]) {
        if (v === k[k.adjust]) continue
        const s = { ...engine.initial(cfg), [k.adjust]: v }
        expect(raw(cfg, s, 'idle', true), `${nameOf(cfg)} ${v}`).not.toBe(first)
      }
      // The moment on the slider changes the picture too, when the level is moving.
      const moving = { ...engine.initial(cfg), [k.adjust]: k.adjust === 'tap' ? k.drain + 2 : k.tap - 2 }
      expect(raw(cfg, { ...moving, t: 1 }, 'idle', true)).not.toBe(raw(cfg, { ...moving, t: 3 }, 'idle', true))
    }
    // A change eases when motion is allowed.
    expect(raw(EXAMPLES[0], engine.initial(EXAMPLES[0]), 'idle', false)).toMatch(/transition:transform 900ms/)
  })

  it('tells a screen reader what the vessel holds, never whether it is right', () => {
    const c: StocksConfig = { task: 'reach', setting: 'bath', variant: 1 }
    const live = raw(c, engine.initial(c), 'idle')
    expect(attrs(live)).toContain('Water in the bath after 3 minutes is 100 L')
    expect(text(live)).toContain('Water in the bath after 3 minutes: 100 L. It started at 30 L.')
    const scrubbed = raw(c, { ...engine.initial(c), t: 0 }, 'idle')
    expect(attrs(scrubbed)).toContain('after 0 minutes is 30 L')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const cfg of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
      expect(html).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
    }
  })

  it('the flows are drawn as wide as they run, and none at all when closed', () => {
    const c: StocksConfig = { task: 'reach', setting: 'bath', variant: 2 }
    const open = raw(c, { tap: 4, drain: 3, t: 3 }, 'idle')
    expect(open).toMatch(/data-stream="in"[^>]*/)
    const closed = raw(c, { tap: 0, drain: 3, t: 3 }, 'idle')
    expect(closed).not.toContain('data-stream="in"')
    expect(closed).toContain('data-stream="out"')
  })

  it('a card that is refused still reads', () => {
    expect(text(raw({ task: 'balance', setting: 'ocean', variant: 9 }, {} as never, 'idle', true))).toContain('Tap')
  })
})
