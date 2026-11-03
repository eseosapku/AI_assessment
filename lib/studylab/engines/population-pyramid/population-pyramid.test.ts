// lib/studylab/engines/population-pyramid/population-pyramid.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  populationPyramidEngine as engine, BANDS, BIRTH_MAX, BIRTH_MIN, DEATH_MAX, DEATH_MIN, DECADES, MATCH_TOL, RATES, SHAPES, START_TOTAL, STEADY_TOL,
  axisOf, baseRatio, baseWords, changeOf, distance, done, finalOf, frameOf, ghostOf, madeText, ratesOf, runOf, shares, simulate, startOf, step, sz, targetRates, totalOf, working,
  type PyConfig, type PyState, type Shape,
} from './config'
import { DECADE_SECONDS, H, PopulationPyramidView, ROW, SETTLE_MS, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const MATCHES: PyConfig[] = SHAPES.flatMap((from) => SHAPES.filter((to) => to !== from).map((to) => ({ task: 'match' as const, from, to })))
const STEADIES: PyConfig[] = SHAPES.filter((s) => s !== 'even').map((from) => ({ task: 'steady' as const, from }))
const ALL: PyConfig[] = [...MATCHES, ...STEADIES]
const nameOf = (c: PyConfig) => JSON.stringify(c)

/** Every state a learner can reach: each pair of rates the two sliders allow. */
function everyState(): PyState[] {
  const out: PyState[] = []
  for (let b = BIRTH_MIN; b <= BIRTH_MAX; b++) for (let d = DEATH_MIN; d <= DEATH_MAX; d++) out.push({ birth: b, death: d })
  return out
}

describe('the model, from first principles', () => {
  it('has the number of people change by exactly the rates asked for, however the people are spread', () => {
    for (const from of SHAPES) {
      for (const [b, d] of [[40, 10], [12, 12], [7, 14], [25, 18], [46, 6], [6, 30]]) {
        const p = startOf(from)
        const { next } = step(p, b, d)
        const g = (b - d) / 200
        expect(totalOf(next), `${from} ${b} ${d}`).toBeCloseTo((totalOf(p) * (1 + g)) / (1 - g), 6)
      }
    }
  })

  it('has deaths equal to the death rate of the average population over the decade, and births likewise', () => {
    const p = startOf('wide-base')
    const b = 30
    const d = 15
    const { next, moved } = step(p, b, d)
    const average = totalOf(p) / (1 - (b - d) / 200)
    const born = moved.newM.f + moved.newF.f
    const lost = totalOf(p) + (born ? 0 : 0) - totalOf(next)
    // People after = people before + births - deaths, with the infants who die within the decade counted in both.
    expect(totalOf(next)).toBeCloseTo(totalOf(p) + (b / 100) * average - (d / 100) * average, 6)
    expect(born).toBeLessThanOrEqual((b / 100) * average)
    expect(lost).toBeCloseTo(((d - b) / 100) * average, 6)
  })

  it('never makes a negative or missing cohort, at any rates', () => {
    for (const from of SHAPES) {
      for (let b = BIRTH_MIN; b <= BIRTH_MAX; b += 8) {
        for (let d = DEATH_MIN; d <= DEATH_MAX; d += 8) {
          for (const p of simulate(from, b, d).states) {
            expect(p.m).toHaveLength(BANDS)
            expect(p.f).toHaveLength(BANDS)
            for (const x of [...p.m, ...p.f]) {
              expect(x.o, `${from} ${b} ${d}`).toBeGreaterThanOrEqual(0)
              expect(x.f).toBeGreaterThanOrEqual(0)
              expect(Number.isFinite(sz(x))).toBe(true)
            }
          }
        }
      }
    }
  })

  it('sends the people up the pyramid: every cohort is the one below it, a decade older and smaller', () => {
    const run = simulate('wide-base', 30, 12)
    for (let k = 0; k < DECADES; k++) {
      for (let r = 0; r + 2 < BANDS; r++) {
        for (const side of ['m', 'f'] as const) expect(sz(run.states[k + 1][side][r + 1])).toBeLessThanOrEqual(sz(run.states[k][side][r]) + 1e-9)
      }
    }
    // Those alive at the start are never counted as born since, and the other way round.
    expect(run.states[0].m.every((b) => b.f === 0)).toBe(true)
    expect(run.states[1].m[0].o).toBe(0)
    expect(run.states[DECADES].m[0].f).toBeGreaterThan(0)
  })

  it('has more boys born than girls, and the oldest rungs lean female', () => {
    const { moved } = step(startOf('even'), 12, 12)
    expect(moved.newM.f / moved.newF.f).toBeGreaterThan(1.02)
    expect(moved.newM.f / moved.newF.f).toBeLessThan(1.07)
    const top = startOf('even')
    expect(sz(top.f[BANDS - 1])).toBeGreaterThan(sz(top.m[BANDS - 1]))
  })

  it('starts the three shapes as a wide base, a base about as wide as the middle, and a narrow base', () => {
    expect(baseWords(startOf('wide-base'))).toBe('a wide base')
    expect(baseWords(startOf('even'))).toBe('a base about as wide as the middle')
    expect(baseWords(startOf('narrow-base'))).toBe('a narrow base')
    for (const s of SHAPES) expect(totalOf(startOf(s)), s).toBeCloseTo(START_TOTAL, 6)
  })

  it('makes a young country grow, and an old one shrink, from the rates it starts at', () => {
    expect(changeOf({ task: 'steady', from: 'wide-base' }, engine.initial({ task: 'steady', from: 'wide-base' }))).toBeGreaterThan(1)
    expect(changeOf({ task: 'steady', from: 'narrow-base' }, engine.initial({ task: 'steady', from: 'narrow-base' }))).toBeLessThan(-0.1)
  })

  it('has the pyramid change its shape at the base first: after one decade of fewer births only the youngest rung has moved', () => {
    const p = startOf('wide-base')
    const next = step(p, 12, 12).next
    expect(sz(next.m[0])).toBeLessThan(sz(p.m[0]) * 0.8)
    expect(sz(next.m[3])).toBeCloseTo(sz(p.m[2]) * (sz(next.m[3]) / sz(p.m[2])), 6)
    expect(sz(next.m[3]) / sz(p.m[2])).toBeGreaterThan(0.9)
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
    expect(ALL.length).toBe(8)
  })

  it('marks exactly by the rule, over every pair of rates the sliders allow', () => {
    for (const c of ALL) {
      let right = 0
      for (const s of everyState()) {
        const should = c.task === 'match' ? distance(shares(finalOf(c, s)), shares(ghostOf(c))) <= MATCH_TOL : Math.abs(totalOf(finalOf(c, s)) / START_TOTAL - 1) <= STEADY_TOL
        expect(engine.check(c, s).ok, `${nameOf(c)} ${JSON.stringify(s)}`).toBe(should)
        if (should) right++
      }
      expect(right, nameOf(c)).toBeGreaterThan(4)
    }
  })

  it('leaves the start clearly outside what passes, and the answer clearly inside, in the drawn pyramid', () => {
    for (const c of MATCHES) {
      expect(distance(shares(finalOf(c, engine.initial(c))), shares(ghostOf(c))), nameOf(c)).toBeGreaterThan(MATCH_TOL * 2.5)
      expect(distance(shares(finalOf(c, engine.solve(c))), shares(ghostOf(c))), nameOf(c)).toBe(0)
    }
    for (const c of STEADIES) {
      expect(Math.abs(changeOf(c, engine.initial(c))), nameOf(c)).toBeGreaterThan(STEADY_TOL * 3)
    }
  })

  it('forgives what looks right: a slider one notch off the answer still passes, and the card says so', () => {
    for (const c of MATCHES) {
      const t = targetRates(c.from as Shape, (c as Extract<PyConfig, { to: unknown }>).to as Shape)
      const off: PyState = { birth: Math.min(BIRTH_MAX, t.birth + 1), death: Math.min(DEATH_MAX, t.death + 1) }
      expect(engine.check(c, off).ok, nameOf(c)).toBe(true)
      expect(working(c, off), nameOf(c)).toContain('Near enough')
      expect(working(c, engine.solve(c)), nameOf(c)).not.toContain('Near enough')
    }
    const s: PyConfig = { task: 'steady', from: 'wide-base' }
    expect(engine.check(s, { birth: 20, death: 21 }).ok).toBe(true)
    expect(working(s, { birth: 20, death: 21 })).toContain('Near enough')
    expect(working(s, { birth: 20, death: 20 })).toContain('is the same')
    expect(engine.check(s, { birth: 20, death: 23 }).ok).toBe(false)
  })

  it('can be solved by moving the sliders from the start, one notch at a time', () => {
    for (const c of ALL) {
      let s = engine.initial(c)
      const goal = engine.solve(c)
      while (s.birth !== goal.birth) s = { ...s, birth: s.birth + Math.sign(goal.birth - s.birth) }
      while (s.death !== goal.death) s = { ...s, death: s.death + Math.sign(goal.death - s.death) }
      expect(engine.check(c, s).ok, nameOf(c)).toBe(true)
    }
  })

  it('reads a state that could not have been made as the start, and keeps the sliders in range', () => {
    const c: PyConfig = { task: 'steady', from: 'wide-base' }
    expect(ratesOf(c, null as never)).toEqual(RATES['wide-base'])
    expect(ratesOf(c, { birth: 'x' as never, death: NaN })).toEqual(RATES['wide-base'])
    expect(ratesOf(c, { birth: 999, death: -3 })).toEqual({ birth: BIRTH_MAX, death: DEATH_MIN })
    expect(engine.check(c, {} as never).ok).toBe(false)
    expect(engine.check(c, { birth: 20.4, death: 20.2 }).ok).toBe(true)
  })

  it('says what was made when wrong, with nothing that gives where the answer is', () => {
    for (const c of ALL) {
      const said = madeText(c, engine.initial(c))
      expect(said.startsWith('Yes'), nameOf(c)).toBe(false)
      expect(said, nameOf(c)).not.toMatch(/per 1000|raise|lower|increase|decrease|Stage|expansive|stationary|constrictive/)
    }
    expect(madeText({ task: 'steady', from: 'wide-base' }, { birth: 40, death: 14 })).toMatch(/\d+% more people/)
    expect(madeText({ task: 'steady', from: 'narrow-base' }, { birth: 6, death: 12 })).toMatch(/\d+% fewer people/)
    expect(madeText({ task: 'match', from: 'even', to: 'narrow-base' }, { birth: 12, death: 12 })).toMatch(/Fifty years on, your pyramid has/)
  })

  it('says something true when marked, naming the shape and the rates only then', () => {
    for (const c of MATCHES) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      const to = (c as Extract<PyConfig, { to: unknown }>).to as Shape
      expect(said).toContain(to === 'wide-base' ? 'expansive' : to === 'even' ? 'stationary' : 'constrictive')
      expect(said).toContain(baseWords(ghostOf(c)))
    }
    expect(working({ task: 'steady', from: 'wide-base' }, engine.solve({ task: 'steady', from: 'wide-base' }))).toMatch(/^Yes\./)
  })
})

describe('the picture at any moment', () => {
  const run = simulate('wide-base', 14, 10)

  it('on a whole decade is exactly the pyramid of that decade', () => {
    for (let k = 0; k <= DECADES; k++) {
      const { bars, total } = frameOf(run, k)
      expect(total, `${k}`).toBeCloseTo(totalOf(run.states[k]), 6)
      for (const side of ['m', 'f'] as const) {
        for (let r = 0; r < BANDS; r++) {
          const here = bars.filter((b) => b.side === side && Math.abs(b.row - r) < 1e-9).reduce((s, b) => s + b.o + b.f, 0)
          expect(here, `${k} ${side} ${r}`).toBeCloseTo(sz(run.states[k][side][r]), 6)
        }
      }
    }
  })

  it('between two decades the cohorts are on their way up, and the people are never created or lost to a gap', () => {
    for (const t of [0.25, 1.5, 2.9, 4.5]) {
      const { bars, total } = frameOf(run, t)
      expect(bars.some((b) => Math.abs(b.row - Math.round(b.row)) > 0.05), `${t}`).toBe(true)
      expect(total).toBeGreaterThan(START_TOTAL * 0.99)
      for (const b of bars) {
        expect(b.row).toBeGreaterThanOrEqual(-1)
        expect(b.row).toBeLessThanOrEqual(BANDS - 1)
      }
    }
  })

  it('moves smoothly: a frame a hundredth of a decade later is hardly different', () => {
    for (let t = 0; t < DECADES - 0.02; t += 0.07) {
      const a = frameOf(run, t)
      const b = frameOf(run, t + 0.01)
      expect(Math.abs(b.total - a.total) / a.total).toBeLessThan(0.01)
      const sum = (f: ReturnType<typeof frameOf>) => f.bars.reduce((s, x) => s + (x.o + x.f) * x.fade, 0)
      expect(Math.abs(sum(b) - sum(a)) / a.total, `${t}`).toBeLessThan(0.05)
    }
  })

  it('draws the start as pale (here at the start) and a new cohort as strong (born since)', () => {
    const first = frameOf(run, 0).bars
    expect(first.every((b) => b.f === 0 && b.o > 0)).toBe(true)
    const last = frameOf(run, DECADES).bars
    expect(last.some((b) => b.o > 0)).toBe(true)
    expect(last.filter((b) => b.row === 0).every((b) => b.o === 0 && b.f > 0)).toBe(true)
  })

  it('has its axis hold every bar of the card’s own pyramids', () => {
    for (const c of ALL) {
      const axis = axisOf(c)
      expect(axis % 2).toBe(0)
      for (const s of [engine.initial(c), engine.solve(c)]) for (const p of runOf(c, s).states) expect(Math.max(...shares(p)) * 100, nameOf(c)).toBeLessThanOrEqual(axis)
      if (c.task === 'match') expect(Math.max(...shares(ghostOf(c))) * 100, nameOf(c)).toBeLessThanOrEqual(axis)
    }
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'match', from: 'wide base', to: 'straight sided' })).toEqual({ task: 'match', from: 'wide-base', to: 'even' })
    expect(engine.parse({ task: 'Demographic transition', from: 'Expansive', to: 'Stage 5' })).toEqual({ task: 'match', from: 'wide-base', to: 'narrow-base' })
    expect(engine.parse({ from: 'young', to: 'ageing' })).toEqual({ task: 'match', from: 'wide-base', to: 'narrow-base' })
    expect(engine.parse({ task: 'steady', from: 'a narrow-based pyramid' })).toEqual({ task: 'steady', from: 'narrow-base' })
    expect(engine.parse({ task: 'hold steady', from: 'wide' })).toEqual({ task: 'steady', from: 'wide-base' })
    expect(engine.parse({ task: 'zero growth' })).toEqual({ task: 'steady', from: 'wide-base' })
    expect(engine.parse({ task: 'match', from: 'even' })).toEqual({ task: 'match', from: 'even', to: 'narrow-base' })
    expect(engine.parse({ task: 'match' })).toEqual({ task: 'match', from: 'wide-base', to: 'even' })
    expect(engine.parse({ start: 'column', target: 'constrictive' })).toEqual({ task: 'match', from: 'even', to: 'narrow-base' })
    expect(engine.parse({ from: 'wide base' })).toEqual({ task: 'steady', from: 'wide-base' })
    expect(engine.parse({ task: 'narrow base' })).toEqual({ task: 'match', from: 'wide-base', to: 'narrow-base' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('wide')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'match', from: 5 })).toBeNull()
    expect(engine.parse({ task: 'match', to: {} })).toBeNull()
    // An unknown shape still parses: faults says what would work.
    expect(engine.parse({ task: 'match', from: 'stage 3', to: 'even' })).not.toBeNull()
    expect(engine.parse({ task: 'match', from: '__proto__', to: 'even' })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: PyConfig, said: string): PyConfig => {
      const both = said.match(/from "([a-z-]+)" to "([a-z-]+)"/)
      const onlyTo = said.match(/e\.g\. to "([a-z-]+)"/)
      const onlyFrom = said.match(/e\.g\. from "([a-z-]+)"/)
      if (c.task === 'steady') return { task: 'steady', from: onlyFrom![1] }
      if (both) return { task: 'match', from: both[1], to: both[2] }
      if (onlyTo) return { task: 'match', from: c.from, to: onlyTo[1] }
      return { task: 'match', from: onlyFrom![1], to: (c as { to: string }).to }
    }
    const cases: [PyConfig, RegExp][] = [
      [{ task: 'match', from: 'stage-3', to: 'even' }, /wide-base, even, narrow-base/],
      [{ task: 'match', from: 'wide-base', to: 'bulge' }, /wide-base, even, narrow-base/],
      [{ task: 'match', from: 'even', to: 'even' }, /nothing to change/],
      [{ task: 'steady', from: 'even' }, /nothing to find/],
      [{ task: 'steady', from: '__proto__' }, /wide-base, even, narrow-base/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
      expect(engine.check(fixed, engine.initial(fixed)).ok, nameOf(fixed)).toBe(false)
    }
    // Nothing a refused config does crashes the rest of the engine.
    for (const [c] of cases) {
      expect(() => engine.check(c, engine.initial(c)), nameOf(c)).not.toThrow()
      expect(() => renderToStaticMarkup(createElement(PopulationPyramidView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: PyConfig, p: string) => engine.promptFaults!(c, p)
  const match: PyConfig = { task: 'match', from: 'wide-base', to: 'even' }
  const steady: PyConfig = { task: 'steady', from: 'wide-base' }

  it('asking for the outcome is fine', () => {
    expect(pf(match, 'Drag the birth rate and death rate sliders until the pyramid, 50 years on, fills the dashed outline. Press Play to watch the people age.')).toEqual([])
    expect(pf(match, 'Make the pyramid fill the dashed outline by moving the sliders.')).toEqual([])
    expect(pf(steady, 'Drag the birth rate and death rate sliders so the country has about the same number of people 50 years on as it has now.')).toEqual([])
    expect(pf(steady, 'Set the sliders so the population in 5 decades is no bigger and no smaller than today.')).toEqual([])
  })

  it('a rate, a direction, a shape or stage name, or that the rates match, is not', () => {
    for (const p of ['Set the birth rate to 14 and the death rate to 10.', 'Set 14 per 1000 births.', 'Lower the birth rate until the pyramid fits.', 'Increase the death rate.', 'Make a stationary pyramid.',
      'Reach Stage 4 of the demographic transition model.', 'Build a wide-based pyramid.', 'Make an ageing population.', 'Find the fewer births that fit.']) {
      expect(pf(match, p), p).toHaveLength(1)
    }
    for (const p of ['Make the birth rate equal to the death rate.', 'Balance births and deaths.', 'Make the natural increase zero.', 'Find zero growth.', 'Make it the same as the death rate.']) {
      expect(pf(steady, p), p).toHaveLength(1)
    }
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Add migration to the pyramid.', 'Change life expectancy.', 'Drag the bars to the outline.', 'Run it for 20 years.', 'See what the one-child policy does.', 'Move the fertility rate.', 'Show what war does to the pyramid.', 'Run it for 80 years.']) {
      expect(pf(match, p), p).toHaveLength(1)
      expect(pf(match, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    const quoted = (c: PyConfig) => pf(c, 'Set the birth rate to 14 and the death rate to 10.')[0].match(/\("([^"]+)"\)/)![1]
    for (const c of ALL) {
      const fix = quoted(c)
      expect(pf(c, fix), nameOf(c)).toEqual([])
      expect(fix).toMatch(c.task === 'match' ? /dashed outline/ : /same number of people/)
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"population-pyramid", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['match', 'steady']))
    // The prompts in the "config:" lines are the same as the ones in the examples.
    for (const m of engine.prompt.matchAll(/-- the prompt says "([^"]*)"/g)) expect(engine.prompt.split(m[1]).length - 1, m[1]).toBeGreaterThanOrEqual(2)
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "population-pyramid"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'population-pyramid')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Population and settlement', 'Population in Rwanda', 'Population pyramids', 'Reading population pyramids', 'The demographic transition model', 'Demography', 'Population structure and age structure',
      'Birth rates and death rates', 'Natural increase', 'Population change in Rwanda', 'Ageing populations', 'Population growth and decline', 'Chapter 4: Population and settlement',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other populations or other pyramids', () => {
    for (const st of [
      'Food pyramids', 'The food pyramid and a balanced diet', 'Pyramids of numbers and biomass', 'Pyramid of energy', 'Ecological pyramids', 'The Egyptian pyramids', 'Pyramids of Giza', 'Volume of a pyramid', 'Surface area of pyramids',
      'Square based pyramids', 'Pyramid schemes', 'Maslow’s hierarchy of needs', 'Bacterial population growth', 'Population growth curves in bacteria', 'Population ecology', 'Predator and prey populations', 'Animal populations and carrying capacity',
      'Population genetics', 'Samples and populations', 'Population mean and variance', 'Ecosystems and food webs', 'Yeast population', 'Maya pyramids', 'Pyramid selling', 'Food chains', 'Settlement patterns',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('population-pyramid')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "population-pyramid"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:population-pyramid"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const s of SHAPES) expect(engine.prompt).toContain(s)
  })

  it('the numbers in its catalogue entry are the numbers it marks to', () => {
    expect(engine.prompt).toContain(`within ${Math.round(MATCH_TOL * 100)} per cent of the people`)
    expect(engine.prompt).toContain(`within ${Math.round(STEADY_TOL * 100)} per cent`)
    expect(engine.prompt).toContain(`fifty years`)
    expect(DECADES).toBe(5)
    expect(engine.prompt).toContain('0-9 up to 80+')
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'population-pyramid', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: PyConfig, state: PyState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(PopulationPyramidView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [PyConfig, string][] = [
    [{ task: 'match', from: 'wide-base', to: 'even' }, 'Drag the birth rate and death rate sliders until the pyramid, 50 years on, fills the dashed outline. Press Play to watch the people age.'],
    [{ task: 'match', from: 'even', to: 'narrow-base' }, 'Drag the birth rate and death rate sliders until the pyramid, 50 years on, fills the dashed outline. Press Play to watch the people age.'],
    [{ task: 'steady', from: 'wide-base' }, 'Drag the birth rate and death rate sliders so the country has about the same number of people 50 years on as it has now. Press Play to watch the people age.'],
  ]

  it('before marking, nothing says the answer, a stage, a shape name or the rates of the outline', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('type="range"')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'Near enough', 'Stage', 'expansive', 'stationary', 'constrictive', 'typical', 'natural increase', 'equal', 'same number', 'drawn with']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
      // The outline's own rates are in no attribute or text: only what the learner has set.
      if (cfg.task === 'match') {
        const t = targetRates(cfg.from as Shape, cfg.to as Shape)
        expect(shown).not.toMatch(new RegExp(`${t.birth} per 1000.*${t.death} per 1000`))
      }
    }
  })

  it('names what it draws, on the card, before marking', () => {
    const m = text(raw({ task: 'match', from: 'wide-base', to: 'even' }, engine.initial({ task: 'match', from: 'wide-base', to: 'even' }), 'idle', true))
    for (const name of ['Men', 'Women', '% of all people', 'Alive at the start', 'Born since', 'Pyramid to fill', 'Year', 'People', 'Birth rate', 'Death rate', 'per 1000', '0–9', '80+', 'million']) expect(m).toContain(name)
    const s = text(raw({ task: 'steady', from: 'wide-base' }, { birth: 40, death: 14 }, 'idle', true))
    expect(s).not.toContain('Pyramid to fill')
    expect([...m.matchAll(/\d+–\d+|80\+/g)]).toHaveLength(BANDS)
  })

  it('marking gives the shape and the rates, and says what was made when wrong', () => {
    const c: PyConfig = { task: 'match', from: 'wide-base', to: 'even' }
    expect(text(raw(c, engine.solve(c), 'right'))).toContain('stationary')
    expect(text(raw(c, engine.initial(c), 'wrong'))).toContain('Fifty years on, your pyramid has a wide base')
    expect(text(raw(c, { birth: 14, death: 10 }, 'shown'))).toContain('Yes.')
    expect(text(raw({ task: 'steady', from: 'wide-base' }, { birth: 20, death: 20 }, 'right'))).toContain('The number of people is the same')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const c: PyConfig = { task: 'match', from: 'wide-base', to: 'even' }
    const html = raw(c, engine.initial(c), 'shown', true)
    expect(html).toContain('data-year="50"')
    expect(html).toContain(`${engine.solve(c).birth}`)
    expect([...html.matchAll(/<input[^>]*disabled/g)]).toHaveLength(2)
  })

  it('every control is a real control with its own label, and locks when solved', () => {
    for (const [cfg] of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const labels = [...idle.matchAll(/<input[^>]*aria-label="([^"]+)"/g)].map((m) => m[1])
      expect(labels, nameOf(cfg)).toHaveLength(3)
      expect(new Set(labels).size).toBe(3)
      expect(idle).toContain('nodrag')
      expect(idle).toMatch(/<button[^>]*type="button"[^>]*aria-label="Play the fifty years from the start"/)
      const done2 = raw(cfg, engine.solve(cfg), 'right')
      expect([...done2.matchAll(/<input[^>]*disabled/g)].length, nameOf(cfg)).toBe(2)
    }
  })

  it('the still frame changes with every move, with nothing animating under reduced motion', () => {
    for (const [cfg] of EXAMPLES) {
      const first = raw(cfg, engine.initial(cfg), 'idle', true)
      expect(first, nameOf(cfg)).not.toMatch(/transition:\s*[a-z]/)
      expect(raw(cfg, { ...engine.initial(cfg), birth: engine.initial(cfg).birth + 6 }, 'idle', true), nameOf(cfg)).not.toBe(first)
      expect(raw(cfg, { ...engine.initial(cfg), death: engine.initial(cfg).death + 6 }, 'idle', true), nameOf(cfg)).not.toBe(first)
    }
    // Reduced motion shows the fifty years in one frame, and the player is off.
    expect(raw(EXAMPLES[0][0], engine.initial(EXAMPLES[0][0]), 'idle', true)).toContain('data-year="50"')
    expect(raw(EXAMPLES[0][0], engine.initial(EXAMPLES[0][0]), 'idle', true)).toMatch(/<button[^>]*disabled/)
    expect(raw(EXAMPLES[0][0], engine.initial(EXAMPLES[0][0]), 'idle', false)).toContain('data-year="0"')
  })

  it('tells a screen reader what the pyramid shows, never the answer', () => {
    const c: PyConfig = { task: 'match', from: 'wide-base', to: 'even' }
    const a = attrs(raw(c, engine.initial(c), 'idle', true))
    expect(a).toContain('A population pyramid, men on the left and women on the right')
    expect(a).toContain('year 50')
    expect(a).not.toMatch(/expansive|stationary|constrictive|Stage|equal/)
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked, true)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
      expect(html).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
    }
  })

  it('agrees with what the view writes out as literals, and the rung labels fit beside their bars', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    const html = raw(EXAMPLES[0][0], engine.initial(EXAMPLES[0][0]), 'idle', true)
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`)
    expect(W).toBe(360)
    expect(ROW).toBeGreaterThanOrEqual(15)
    // 9 rungs, the longest label "70–79" at 12 px is about 33 px, and the gap between the two sides is 40.
    expect(html).toContain('min="6" max="46"')
    expect(html).toContain('min="6" max="30"')
    expect(BIRTH_MIN).toBe(6)
    expect(BIRTH_MAX).toBe(46)
    expect(DEATH_MIN).toBe(6)
    expect(DEATH_MAX).toBe(30)
    expect(5 * 7).toBeLessThanOrEqual(40)
    expect(html).toContain('x="180"')
    expect(DECADE_SECONDS).toBeGreaterThanOrEqual(0.8)
    expect(SETTLE_MS).toBeGreaterThan(300)
  })

  it('every rung label sits level with its own bar, and nothing is drawn off the panel', () => {
    const c: PyConfig = { task: 'match', from: 'wide-base', to: 'even' }
    const html = raw(c, engine.initial(c), 'idle', true)
    const labelYs = [...html.matchAll(/<text x="180" y="([\d.]+)"[^>]*>(?:\d+–\d+|80\+)<\/text>/g)].map((m) => Number(m[1]))
    expect(labelYs).toHaveLength(BANDS)
    for (let i = 1; i < labelYs.length; i++) expect(labelYs[i - 1] - labelYs[i]).toBeCloseTo(ROW, 5)
    // Every bar inside the panel, at the extreme of both sliders too.
    for (const s of [{ birth: BIRTH_MAX, death: DEATH_MIN }, { birth: BIRTH_MIN, death: DEATH_MAX }]) {
      const out = raw(c, s, 'idle', true)
      for (const m of out.matchAll(/<rect x="([\d.-]+)" y="[\d.-]+" width="([\d.]+)" height="14.5"/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(19.9)
        expect(Number(m[1]) + Number(m[2])).toBeLessThanOrEqual(340.1)
      }
    }
  })

  it('baseRatio and baseWords agree on the three ends', () => {
    expect(baseRatio(startOf('wide-base'))).toBeGreaterThan(1.8)
    expect(baseRatio(startOf('narrow-base'))).toBeLessThan(0.7)
    expect(baseRatio(startOf('even'))).toBeGreaterThan(0.9)
    expect(baseRatio(startOf('even'))).toBeLessThan(1.2)
  })
})
