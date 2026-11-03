// lib/studylab/engines/enzyme-rate/enzyme-rate.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  enzymeRateEngine as engine, BEST_TEMP, BUBBLE_TOP, DEFAULT_SITES, DEFAULT_TARGET, ENZYMES, FACTS, LIGHTS, OTHERS, OTHER_TEMPS, PHS, RATE_TOP, SECONDS, SITES_MAX, SITES_MIN, START_TEMP, SUBSTRATES, TARGET_MAX, TARGET_MIN, TEMPS,
  atOf, bestOf, bracketed, done, factsOf, freshTube, goodPrompt, idealOf, intactOf, lensOf, levelsOf, lightOf, limitAt, limitRate, limitStepped, madeText, neededFor, otherOf, rateOf, seenOf, startOf, stepped, tracesOf, tubeOf, tubeRate, tubesOf, working,
  type EnzymeRateConfig as Config, type EnzymeRateState as State,
} from './config'
import {
  DRIFT, EnzymeRateView, H, LIQUID_TOP, LR, LX, LY, MOLECULE_REACH, PX0, PY0, PY1, TUBE_X, W, WEDGE_REACH, benchTags, gasBottom, graphOf, graphX, graphY, lampX, lensLayout, lensTags, moleculeScale, notesOf, phColour, pondY, thermY, tubeTags,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

type EnzymeCard = Extract<Config, { task: 'enzyme' }>
const SITES = Array.from({ length: SITES_MAX - SITES_MIN + 1 }, (_, i) => SITES_MIN + i)
const TARGETS = Array.from({ length: TARGET_MAX - TARGET_MIN + 1 }, (_, i) => TARGET_MIN + i)

const HEATS: EnzymeCard[] = ENZYMES.map((enzyme) => ({ task: 'enzyme', factor: 'temperature', enzyme }))
const PH_CARDS: EnzymeCard[] = ENZYMES.map((enzyme) => ({ task: 'enzyme', factor: 'ph', enzyme }))
const SUBS: EnzymeCard[] = ENZYMES.flatMap((enzyme) => SITES.map((sites) => ({ task: 'enzyme' as const, factor: 'substrate', enzyme, sites })))
const LIMITS: Config[] = SECONDS.flatMap((second) => TARGETS.map((target) => ({ task: 'limiting' as const, second, target })))
const ENZYME_CARDS = [...HEATS, ...PH_CARDS, ...SUBS]
const ALL: Config[] = [...ENZYME_CARDS, ...LIMITS]
const nameOf = (c: Config) => JSON.stringify(c)

const heat = (enzyme = 'catalase'): EnzymeCard => ({ task: 'enzyme', factor: 'temperature', enzyme })
const ph = (enzyme = 'pepsin'): EnzymeCard => ({ task: 'enzyme', factor: 'ph', enzyme })
const sub = (sites = 4, enzyme = 'catalase'): EnzymeCard => ({ task: 'enzyme', factor: 'substrate', enzyme, sites })
const limit = (target = 24, second = 'co2'): Config => ({ task: 'limiting', second, target })

/** A small repeatable generator, so a failing walk can be run again. */
function randomFrom(seed: number) {
  let s = seed >>> 0
  return (n: number) => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s % n
  }
}

describe('the biology, from first principles', () => {
  it('rate doubles with each 10 degrees up to the best, then falls to nothing, in a fresh tube at each step', () => {
    const c = heat()
    expect(TEMPS.map((t) => tubeRate(c, [t]))).toEqual([6, 12, 24, 48, 96, 48, 0, 0])
    expect(Math.max(...TEMPS.map((t) => tubeRate(c, [t])))).toBe(tubeRate(c, [BEST_TEMP]))
    for (let t = 10; t <= BEST_TEMP; t += 10) expect(tubeRate(c, [t]) / tubeRate(c, [t - 10]), String(t)).toBe(2)
  })

  it('a cold tube only slows: warm it again and every reading comes back', () => {
    const c = heat()
    expect(tubeRate(c, [20, 10, 0])).toBe(6)
    expect(tubeRate(c, [20, 10, 0, 10, 20])).toBe(tubeRate(c, [20]))
    expect(tubeRate(c, [20, 10, 0, 10, 20, 30, 40])).toBe(96)
    expect(intactOf(c, [20, 10, 0])).toBe(1)
  })

  it('a hot tube keeps the damage: cooled again, its rate does not come back', () => {
    const c = heat()
    expect(tubeRate(c, [40, 50])).toBe(48)
    expect(tubeRate(c, [40, 50, 40])).toBe(24)
    expect(tubeRate(c, [40, 50, 40])).toBeLessThan(tubeRate(c, [40]))
    expect(tubeRate(c, [40, 50, 40, 30])).toBe(12)
    expect(tubeRate(c, [40, 50, 60, 50, 40, 30, 20])).toBe(0)
    // A fresh tube is whole again, unless the bath it goes into is too hot for it.
    expect(tubeRate(c, tubeOf(c, freshTube(c, { tubes: [[40, 50, 40]] })))).toBe(96)
    expect(tubeOf(c, freshTube(c, { tubes: [[40, 50]] }))).toEqual([50])
    expect(intactOf(c, tubeOf(c, freshTube(c, { tubes: [[40, 50, 60]] })))).toBe(0)
  })

  it('each enzyme is best at its own textbook pH, and falls either side of it', () => {
    expect(ENZYMES.map((e) => FACTS[e].bestPh)).toEqual([7, 7, 2, 8, 8])
    for (const c of PH_CARDS) {
      const best = bestOf(c)
      const rates = PHS.map((v) => tubeRate(c, [v]))
      expect(Math.max(...rates), nameOf(c)).toBe(tubeRate(c, [best]))
      expect(rates.filter((r) => r === tubeRate(c, [best])), nameOf(c)).toHaveLength(1)
      for (const v of PHS) if (Math.abs(v - best) >= 1 && Math.abs(v - best) < 4) expect(tubeRate(c, [v]), `${nameOf(c)} ${v}`).toBeGreaterThan(Math.abs(v - best) < 3 ? tubeRate(c, [v + Math.sign(v - best)]) : -1)
    }
  })

  it('close to its best pH the fall recovers, and far from it the damage stays', () => {
    const c = ph('amylase')
    expect(tubeRate(c, [5, 6, 7])).toBe(96)
    expect(tubeRate(c, [5, 7])).toBe(96)
    expect(tubeRate(c, [4, 7])).toBe(48)
    expect(tubeRate(c, [3, 7])).toBe(0)
    expect(tubeRate(c, [11, 7])).toBe(0)
  })

  it('every pH card starts two steps away, where nothing is harmed, and not always on the same side', () => {
    for (const c of PH_CARDS) {
      expect(Math.abs(startOf(c) - bestOf(c)), nameOf(c)).toBe(2)
      expect(intactOf(c, [startOf(c)]), nameOf(c)).toBe(1)
    }
    expect(new Set(PH_CARDS.map((c) => Math.sign(startOf(c) - bestOf(c)))).size).toBe(2)
  })

  it('more substrate raises the rate only until every active site is busy', () => {
    for (const n of SITES) {
      const c = sub(n)
      const rates = SUBSTRATES.map((v) => tubeRate(c, [v]))
      for (let v = 1; v <= 6; v++) expect(rates[v - 1], `${n} ${v}`).toBe(20 * Math.min(v, n))
      const l = lensOf(c, { tubes: [[n]] })
      expect(l.molecules.filter((m) => m.busy), String(n)).toHaveLength(n)
      expect(l.free, String(n)).toBe(0)
      if (n < 6) expect(lensOf(c, { tubes: [[n + 1]] }).free, String(n)).toBe(1)
    }
    // The plateau is real on every card: there is always a step past it to take.
    expect(SITES_MAX).toBeLessThan(SUBSTRATES[SUBSTRATES.length - 1])
  })

  it('photosynthesis runs at the factor in shortest supply, and raising the other changes nothing', () => {
    for (const l of LIGHTS) for (const o of OTHERS) {
      expect(limitRate(l, o), `${l} ${o}`).toBe(Math.min(6 * l, 6 + 6 * o))
      const which = limitAt(l, o)
      if (which === 'light' && l < 5) expect(limitRate(l + 1, o)).toBeGreaterThan(limitRate(l, o))
      if (which === 'light' && o < 5) expect(limitRate(l, o + 1)).toBe(limitRate(l, o))
      if (which === 'other' && o < 5) expect(limitRate(l, o + 1)).toBeGreaterThan(limitRate(l, o))
      if (which === 'other' && l < 5) expect(limitRate(l + 1, o)).toBe(limitRate(l, o))
    }
  })

  it('a target past the scales still names settings on them', () => {
    expect(neededFor(90)).toEqual({ light: 5, second: 5 })
    expect(neededFor(1)).toEqual({ light: 1, second: 1 })
  })

  it('the first lamp step doubles the rate, and the second hits a wall: the textbook curve in two taps', () => {
    expect([limitRate(1, 1), limitRate(2, 1), limitRate(3, 1)]).toEqual([6, 12, 12])
    // More of the other factor lifts the wall, and the lamp works again.
    expect(limitRate(3, 2)).toBe(18)
    expect(limitRate(4, 2)).toBe(18)
    expect(limitRate(4, 3)).toBe(24)
  })

  it('the settings it asks for are the least that reach the aim, checked against every setting there is', () => {
    for (const target of TARGETS) {
      const reach = LIGHTS.flatMap((l) => OTHERS.map((o) => [l, o])).filter(([l, o]) => limitRate(l, o) >= target)
      const need = neededFor(target)
      expect(Math.min(...reach.map((p) => p[0])), String(target)).toBe(need.light)
      expect(Math.min(...reach.map((p) => p[1])), String(target)).toBe(need.second)
      expect(limitRate(need.light, need.second), String(target)).toBeGreaterThanOrEqual(target)
      // Neither can come down a step.
      expect(need.light === 1 || limitRate(need.light - 1, need.second) < target, String(target)).toBe(true)
      expect(need.second === 1 || limitRate(need.light, need.second - 1) < target, String(target)).toBe(true)
      // Both factors have work to do on every target allowed, so a flat stretch cannot be avoided.
      expect(need.light, String(target)).toBeGreaterThan(1)
      expect(need.second, String(target)).toBeGreaterThan(1)
    }
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
    expect(ALL.length).toBe(ENZYMES.length * (2 + SITES.length) + SECONDS.length * TARGETS.length)
  })

  it('the answer is reached by real taps: solve is a run of steps and fresh tubes from the start', () => {
    for (const c of ENZYME_CARDS) {
      const tubes = tubesOf(c, engine.solve(c))
      const grid = levelsOf(c)
      expect(tubes[0][0], nameOf(c)).toBe(startOf(c))
      tubes.forEach((t, i) => {
        for (let k = 1; k < t.length; k++) expect(Math.abs(grid.indexOf(t[k]) - grid.indexOf(t[k - 1])), `${nameOf(c)} ${t}`).toBe(1)
        // A fresh tube starts where the last one was left.
        if (i > 0) expect(t[0], nameOf(c)).toBe(tubes[i - 1][tubes[i - 1].length - 1])
      })
    }
  })

  it('a lucky stop is not a result: reaching the answer without testing past it is marked wrong, and says why', () => {
    for (const c of ENZYME_CARDS) {
      const grid = levelsOf(c)
      const start = startOf(c)
      const best = bestOf(c)
      const dir = Math.sign(best - start)
      const path = [start]
      while (path[path.length - 1] !== best) path.push(grid[grid.indexOf(path[path.length - 1]) + dir])
      const s: State = { tubes: [path] }
      expect(rateOf(c, s), nameOf(c)).toBe(tubeRate(c, [best]))
      expect(bracketed(c, s), nameOf(c)).toBe(false)
      expect(engine.check(c, s).ok, nameOf(c)).toBe(false)
      expect(madeText(c, s), nameOf(c)).toMatch(/one side|not tried any more/)
    }
  })

  it('marks exactly by the rule, over thousands of random runs on every enzyme card', () => {
    for (const c of ENZYME_CARDS) {
      const rnd = randomFrom(nameOf(c).length * 7919)
      const best = bestOf(c)
      let right = 0
      for (let run = 0; run < 120; run++) {
        let s = engine.initial(c)
        for (let move = rnd(14); move >= 0; move--) {
          const roll = rnd(5)
          s = roll === 0 ? freshTube(c, s) : stepped(c, s, roll % 2 === 0 ? 1 : -1)
          // An oracle that does not call the rule it checks: the top rate there is, at the best level, seen from past it.
          const top = tubeRate(c, [best])
          const rate = rateOf(c, s)
          const past = tubesOf(c, s).flat().some((v) => (startOf(c) < best ? v > best : v < best))
          const should = rate === top && atOf(c, s) === best && past
          expect(engine.check(c, s).ok, `${nameOf(c)} ${JSON.stringify(s)}`).toBe(should)
          if (should) right++
        }
      }
      if (c.factor !== 'substrate') expect(right, nameOf(c)).toBeGreaterThan(0)
    }
  })

  it('marks every setting of a limiting card, and only the least one that reaches the aim is right', () => {
    for (const c of LIMITS) {
      if (c.task !== 'limiting') continue
      let right = 0
      for (const l of LIGHTS) for (const o of OTHERS) {
        const should = limitRate(l, o) >= c.target && !(l > 1 && limitRate(l - 1, o) >= c.target) && !(o > 1 && limitRate(l, o - 1) >= c.target)
        expect(engine.check(c, { light: l, second: o }).ok, `${nameOf(c)} ${l} ${o}`).toBe(should)
        if (should) right++
      }
      expect(right, nameOf(c)).toBe(1)
    }
  })

  it('a limiting card can always be solved by taps, and any route to it meets a flat step', () => {
    for (const c of LIMITS) {
      const s = engine.solve(c)
      const seen = seenOf(s)
      expect(seen[0], nameOf(c)).toEqual([1, 1])
      for (let i = 1; i < seen.length; i++) expect(Math.abs(seen[i][0] - seen[i - 1][0]) + Math.abs(seen[i][1] - seen[i - 1][1]), nameOf(c)).toBe(1)
      expect(seen.slice(1).some((p, i) => limitRate(p[0], p[1]) === limitRate(seen[i][0], seen[i][1])), nameOf(c)).toBe(true)
    }
    // Every other way through the settings too, on the default card.
    const need = neededFor(DEFAULT_TARGET)
    const walk = (l: number, o: number, flat: boolean): boolean => {
      if (l === need.light && o === need.second) return flat
      const next: boolean[] = []
      if (l < need.light) next.push(walk(l + 1, o, flat || limitRate(l + 1, o) === limitRate(l, o)))
      if (o < need.second) next.push(walk(l, o + 1, flat || limitRate(l, o + 1) === limitRate(l, o)))
      return next.every(Boolean)
    }
    expect(walk(1, 1, false)).toBe(true)
  })

  it('a step off the end of a scale does nothing, and a state that could not have been made counts for nothing', () => {
    const c = heat()
    expect(tubeOf(c, stepped(c, { tubes: [[70]] }, 1))).toEqual([70])
    expect(tubeOf(c, stepped(c, { tubes: [[0]] }, -1))).toEqual([0])
    expect(lightOf(limitStepped({ light: 5, second: 1 }, 'light', 1))).toBe(5)
    expect(otherOf(limitStepped({ light: 5, second: 1 }, 'second', -1))).toBe(1)
    for (const s of [{}, { tubes: 'x' }, { tubes: [['x']] }, { tubes: [[35]] }, { tubes: [] }, null] as unknown as State[]) {
      expect(engine.check(c, s).ok, JSON.stringify(s)).toBe(false)
      expect(atOf(c, s), JSON.stringify(s)).toBe(START_TEMP)
    }
    for (const s of [{}, { light: 'x', second: 9 }, null] as unknown as State[]) {
      expect(engine.check(limit(), s).ok, JSON.stringify(s)).toBe(false)
    }
  })

  it('says something true when marked', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      if (c.task === 'limiting') {
        expect(said).toMatch(/limiting factor/)
        expect(said, nameOf(c)).toContain(`${limitRate(neededFor(c.target).light, neededFor(c.target).second)} bubbles a minute`)
      } else if (c.factor === 'temperature') {
        expect(said).toContain('40 °C')
        expect(said).toContain('37 °C')
        expect(said).toContain('denatured, not killed')
      } else if (c.factor === 'ph') {
        expect(said, nameOf(c)).toContain(`pH ${FACTS[c.enzyme as keyof typeof FACTS].bestPh}`)
        expect(said).toContain('denatured')
      } else {
        expect(said, nameOf(c)).toContain(`${c.sites}%`)
        expect(said).toMatch(/every active site is busy/)
      }
    }
  })

  it('says what was made when wrong, without saying where the answer is', () => {
    for (const c of ALL) {
      const said = madeText(c, engine.initial(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(false)
      expect(said, nameOf(c)).not.toMatch(/optimum|denatured|limiting factor|plateau/)
      if (c.task === 'enzyme') expect(said, nameOf(c)).not.toContain(c.factor === 'substrate' ? `${c.sites}%` : `${bestOf(c)} °C`)
    }
    expect(madeText(heat(), { tubes: [[20, 30]] })).toBe('You left it at 30 °C, at 48 mm a minute, and it can go faster.')
    expect(madeText(heat(), { tubes: [[20, 30, 40, 50, 40]] })).toMatch(/as hot as 50 °C.*has not recovered/)
    expect(madeText(ph('pepsin'), { tubes: [[4, 5, 6, 7, 4]] })).toMatch(/through pH 4 to 7.*has not recovered/)
    // Still at its worst, it has had no chance to recover, and is not told it failed to.
    expect(madeText(heat(), { tubes: [[20, 30, 40, 50, 60]] })).toBe('At 60 °C the rate is 0 mm a minute, and a tube can go faster than that.')
    expect(madeText(ph('trypsin'), { tubes: [[10, 11]] })).toBe('At pH 11 the rate is 4% a minute, and a tube can go faster than that.')
    expect(madeText(sub(4), { tubes: [[1, 2, 3, 4, 5, 6]] })).toMatch(/less hydrogen peroxide gives that rate too/)
    expect(madeText(limit(24), { light: 2, second: 1 })).toBe('You stopped at 12 bubbles a minute, and the aim is 24.')
    expect(madeText(limit(24), { light: 5, second: 5 })).toMatch(/more than you needed/)
    expect(madeText(limit(24), { light: 5, second: 5 })).not.toMatch(/lamp|carbon dioxide/)
  })
})

describe('reading the config', () => {
  const t = (factor: string, enzyme = 'catalase', extra: object = {}) => ({ task: 'enzyme', factor, enzyme, ...extra })

  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'temperature' })).toEqual(t('temperature'))
    expect(engine.parse({ task: 'Effect of temperature', enzyme: 'Liver catalase' })).toEqual(t('temperature'))
    expect(engine.parse({ task: 'denaturing', enzyme: 'amylase' })).toEqual(t('temperature', 'amylase'))
    expect(engine.parse({ task: 'enzyme', factor: 'pH', enzyme: 'Pepsin' })).toEqual(t('ph', 'pepsin'))
    expect(engine.parse({ task: 'pH', enzyme: 'stomach protease' })).toEqual(t('ph', 'pepsin'))
    expect(engine.parse({ task: 'Optimum pH', enzyme: 'protease' })).toEqual(t('ph', 'trypsin'))
    expect(engine.parse({ factor: 'acidity', enzyme: 'salivary amylase' })).toEqual(t('ph', 'amylase'))
    expect(engine.parse({ enzyme: 'lipase' })).toEqual(t('temperature', 'lipase'))
    expect(engine.parse({ task: 'substrate concentration' })).toEqual(t('substrate', 'catalase', { sites: DEFAULT_SITES }))
    expect(engine.parse({ task: 'saturation', sites: '3 molecules', enzyme: 'carbohydrase' })).toEqual(t('substrate', 'amylase', { sites: 3 }))
    expect(engine.parse({ task: { kind: 'enzyme', factor: 'substrate', sites: 5 } })).toEqual(t('substrate', 'catalase', { sites: 5 }))
    expect(engine.parse({ task: 'limiting factors' })).toEqual({ task: 'limiting', second: 'co2', target: DEFAULT_TARGET })
    expect(engine.parse({ task: 'Photosynthesis', with: 'Carbon dioxide', target: '18 bubbles' })).toEqual({ task: 'limiting', second: 'co2', target: 18 })
    expect(engine.parse({ task: 'pondweed', second: 'temperature', aim: 30 })).toEqual({ task: 'limiting', second: 'temperature', target: 30 })
    expect(engine.parse({ task: 'limiting', second: 'CO₂' })).toEqual({ task: 'limiting', second: 'co2', target: DEFAULT_TARGET })
    expect(engine.parse({ task: 'light intensity', second: 'light' })).toEqual({ task: 'limiting', second: 'co2', target: DEFAULT_TARGET })
    expect(engine.parse({ target: 24 })).toEqual({ task: 'limiting', second: 'co2', target: 24 })
    expect(engine.parse({ second: 'temperature' })).toEqual({ task: 'limiting', second: 'temperature', target: DEFAULT_TARGET })
    expect(engine.parse({ factor: 'light intensity' })).toEqual({ task: 'limiting', second: 'co2', target: DEFAULT_TARGET })
    expect(engine.parse({ factor: 'carbon dioxide', target: 18 })).toEqual({ task: 'limiting', second: 'co2', target: 18 })
    // An enzyme's temperature is still an enzyme card.
    expect(engine.parse({ factor: 'temperature' })).toEqual(t('temperature'))
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('temperature')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 5 })).toBeNull()
    expect(engine.parse({ task: 'enzyme', enzyme: 7 })).toBeNull()
    expect(engine.parse({ task: 'enzyme', factor: 7 })).toBeNull()
    expect(engine.parse({ task: 'limiting', target: 'lots' })).toBeNull()
    expect(engine.parse({ task: 'limiting', second: 3 })).toBeNull()
    expect(engine.parse({ task: 'substrate', sites: 'many' })).toBeNull()
  })

  it('still reads what it cannot draw, so faults can say what would work', () => {
    expect(engine.parse({ task: 'enzyme', enzyme: 'maltase' })).not.toBeNull()
    expect(engine.parse({ task: 'enzyme', factor: 'enzyme concentration' })).not.toBeNull()
    expect(engine.parse({ task: 'inhibitors' })).not.toBeNull()
    expect(engine.parse({ task: 'limiting', second: 'water' })).not.toBeNull()
    expect(engine.parse({ task: 'limiting', target: 90 })).not.toBeNull()
    expect(engine.parse({ task: 'substrate', sites: 9 })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: Config, said: string): Config => {
      const f = said.match(/e\.g\. factor "(\w+)"/)
      if (f) return { ...c, factor: f[1] } as Config
      const e = said.match(/e\.g\. enzyme "(\w+)"/)
      if (e) return { ...c, enzyme: e[1] } as Config
      const s = said.match(/e\.g\. sites (\d+)/)
      if (s) return { ...c, sites: Number(s[1]) } as Config
      const sec = said.match(/e\.g\. second "(\w+)"/)
      if (sec) return { ...c, second: sec[1] } as Config
      const tg = said.match(/e\.g\. target (\d+)/)
      expect(tg, said).not.toBeNull()
      return { ...c, target: Number(tg![1]) } as Config
    }
    const cases: [Config, RegExp][] = [
      [{ task: 'enzyme', factor: 'inhibitor', enzyme: 'catalase' }, /temperature, ph or substrate/],
      [{ task: 'enzyme', factor: 'enzyme-concentration', enzyme: 'catalase' }, /temperature, ph or substrate/],
      [{ task: 'enzyme', factor: '__proto__', enzyme: 'catalase' }, /temperature, ph or substrate/],
      [{ task: 'enzyme', factor: 'temperature', enzyme: 'maltase' }, /catalase, amylase, pepsin, trypsin, lipase/],
      [{ task: 'enzyme', factor: 'temperature', enzyme: 'constructor' }, /catalase, amylase/],
      [{ task: 'enzyme', factor: 'substrate', enzyme: 'catalase', sites: 9 }, /2 to 5/],
      [{ task: 'enzyme', factor: 'substrate', enzyme: 'catalase', sites: 1 }, /2 to 5/],
      [{ task: 'enzyme', factor: 'substrate', enzyme: 'catalase', sites: 2.5 }, /2 to 5/],
      [{ task: 'limiting', second: 'water', target: 24 }, /carbon dioxide or temperature/],
      [{ task: 'limiting', second: 'co2', target: 90 }, /more than the nearest lamp/],
      [{ task: 'limiting', second: 'co2', target: 6 }, /lamp alone/],
      [{ task: 'limiting', second: 'co2', target: 20.5 }, /whole number/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
      // Nothing a refused config can do crashes or hangs the rest of the engine: a target past the lamp once made solve run for ever.
      expect(() => renderToStaticMarkup(createElement(EnzymeRateView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
      expect(() => engine.solve(c)).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: Config, p: string) => engine.promptFaults!(c, p)

  it('asking for the outcome is fine, and naming the idea is too', () => {
    expect(pf(heat(), 'What temperature suits this enzyme best? Tap the buttons to change the water bath, and take a fresh tube when you want one.')).toEqual([])
    expect(pf(heat(), 'Find the optimum temperature for catalase. Tap the buttons to change the bath.')).toEqual([])
    expect(pf(ph('pepsin'), 'Find the optimum pH for pepsin by tapping the buttons.')).toEqual([])
    expect(pf(sub(4), 'What does more hydrogen peroxide do to the rate? Tap the buttons to change it, and use no more than you need.')).toEqual([])
    expect(pf(limit(24), 'What is the limiting factor? Tap the buttons to move the lamp and change the carbon dioxide, and reach 24 bubbles a minute.')).toEqual([])
    expect(pf(limit(18, 'temperature'), 'Tap the buttons to move the lamp and warm the water. Reach 18 bubbles a minute.')).toEqual([])
  })

  it('the best level, or what is going to happen, is not', () => {
    for (const p of ['Set it to 40 °C.', 'The best is about 37 C.', 'Warm it to body temperature.', 'Heat it until the enzyme denatures.', 'Heating kills the enzyme.', 'Careful not to cook it.', 'A cooled tube will not recover.', 'The damage is permanent.', 'Watch the active site change shape.', 'Find the peak.', 'Molecules collide more when warm.', 'The optimum is at 40 degrees.']) {
      expect(pf(heat(), p), p).toHaveLength(1)
      expect(pf(heat(), p)[0], p).toMatch(/gives the answer away/)
    }
    for (const p of ['Set it to pH 2.', 'Pepsin works in acid.', 'It works in the stomach.', 'Pepsin likes acidic conditions.', 'Too alkaline denatures it.', 'Try neutral first.']) {
      expect(pf(ph('pepsin'), p), p).toHaveLength(1)
    }
    for (const p of ['Stop at 4%.', 'Add substrate until the graph levels off.', 'Find the plateau.', 'Find where the enzyme is saturated.', 'Fill all the active sites.', 'See the substrate queue.', 'Adding more enzyme lifts it.']) {
      expect(pf(sub(4), p), p).toHaveLength(1)
    }
    for (const p of ['Carbon dioxide is limiting at first.', 'The light is the limiting factor.', 'Watch the line go flat.', 'Find the plateau.', 'Raise the lamp to 4.', 'It takes three steps.', 'More light has no effect.', 'The lamp stops helping.', 'Take turns with the two buttons.']) {
      expect(pf(limit(24), p), p).toHaveLength(1)
    }
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Drag the slider to change the bath.', 'Add an inhibitor to the tube.', 'Find Vmax.', 'Use the Michaelis constant.', 'Now do it for yeast respiration.', 'Move the lamp.', 'Measure the pondweed.', 'Test it with Benedict’s solution.']) {
      expect(pf(heat(), p), p).toHaveLength(1)
      expect(pf(heat(), p)[0], p).toMatch(/does not show/)
    }
    expect(pf(sub(4), 'Take a fresh tube.')[0]).toMatch(/does not show/)
    for (const p of ['Change the temperature.', 'Heat the water.']) expect(pf(limit(24, 'co2'), p)[0], p).toMatch(/does not show/)
    for (const p of ['Change the carbon dioxide.', 'Add more CO2.']) expect(pf(limit(24, 'temperature'), p)[0], p).toMatch(/does not show/)
    expect(pf(limit(24), 'Take a fresh tube of liver.')[0]).toMatch(/does not show/)
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const said = pf(c, 'Find the plateau, and denature it at 40 °C, at pH 2 and at 4%. Now drag.')
      expect(said.length, nameOf(c)).toBeGreaterThanOrEqual(1)
      for (const s of said) {
        const fix = s.match(/\("([^"]+)"\)/)![1]
        expect(fix).toBe(goodPrompt(c))
        expect(pf(c, fix), nameOf(c)).toEqual([])
        if (c.task === 'limiting') {
          expect(fix).toContain(`${c.target} bubbles`)
          expect(fix).toContain(c.second === 'co2' ? 'carbon dioxide' : 'temperature')
          expect(fix).toContain('lamp')
        } else {
          expect(fix).toContain(factsOf(c).name)
          expect(fix).toContain(c.factor === 'temperature' ? 'water bath' : c.factor === 'ph' ? 'pH' : factsOf(c).substrate)
        }
      }
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"enzyme-rate", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    const inline = [...engine.prompt.matchAll(/(\{ "task":[^}]*\})\s+-- the prompt says "([^"]+)"/g)]
    expect(inline.length).toBe(5)
    for (const f of inline) {
      const c = engine.parse(JSON.parse(f[1]))!
      expect(engine.faults(c), f[1]).toEqual([])
      expect(engine.promptFaults!(c, f[2]), f[2]).toEqual([])
    }
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "enzyme-rate"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'enzyme-rate')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Enzymes', 'UNIT 10: ENZYMES', 'Mode of action of enzymes', 'Factors that affect enzyme action', 'Factors that affect enzyme activity', 'Factors that affect enzymes', 'Characteristics of enzymes', 'Factors affecting enzyme action',
      'Enzymes as biological catalysts', 'Biological catalysts', 'Effect of temperature and pH on enzymes', 'Digestive enzymes', 'The lock and key model', 'Lock and key', 'The active site', 'Denaturation', 'Denaturing proteins', 'Amylase and starch', 'Pepsin in the stomach', 'Lipase', 'Trypsin',
      'Catalase and hydrogen peroxide', 'Substrate concentration and rate', 'Photosynthesis', 'Plant nutrition', 'Limiting factors of photosynthesis', 'Limiting factors', 'Factors affecting photosynthesis', 'Rate of photosynthesis', 'Autotrophic Nutrition',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      // "rate" in maths, finance and chemistry.
      'Rate of change', 'Rates of change and differentiation', 'Exchange rates', 'Interest rates', 'Compound interest rates', 'Rate of inflation', 'Birth rate and death rate', 'Heart rate', 'Rates of reaction', 'The rate of a chemical reaction', 'Rate equations', 'Speed and rates', 'Tax rates', 'Unit rates',
      // "limiting" in chemistry, calculus, accounts and ecology.
      'Limiting reactant', 'Limiting reagents and yield', 'Limiting reagent and limiting factors', 'Limits and continuity', 'Limiting value of a sequence', 'Limit of a function', 'Speed limits', 'Rate-limiting step', 'Budgeting: limiting factors', 'Limiting factors and the production budget', 'Limiting factors of population growth', 'Population limiting factors', 'Carrying capacity and limiting factors', 'Limiting factors in an ecosystem',
      // Stems that a looser match would catch.
      'Catalysts', 'Catalytic converters', 'Catalogue design', 'Substitution', 'Substances and mixtures', 'Substrate for a semiconductor', 'Photography', 'Photons and the photoelectric effect', 'Photocopying', 'Enzyme-free',
      // Enzyme and photosynthesis topics this card cannot draw.
      'Restriction enzymes and DNA ligase', 'Immobilising enzymes', 'Enzyme inhibitors', 'Comparing the affinity of different enzymes for their substrates', 'Enzymes technology', 'Biological washing powders contain enzymes', 'Criteria for naming enzymes', 'Types of enzymes', 'Importance of enzymes in living organisms',
      'The light dependent reactions of photosynthesis', 'The light independent reactions of photosynthesis', 'Internal structure of the leaf and its adaptations to photosynthesis', 'Adaptation of plants for photosynthesis', 'Structure of chloroplast—the organelle for photosynthesis', 'Necessity of chlorophyll, light energy and carbon dioxide for photosynthesis', 'Importance of photosynthesis', 'The word equation for photosynthesis', 'Tests for starch and for oxygen in photosynthesis', 'Photosynthesis in the carbon cycle', 'Dark reaction of photosynthesis',
      // Other meanings of the rest.
      'Plant nutrition and soil fertility', 'Plant nutrition: fertilisers and manures', 'Mineral nutrition in plants', 'Denatured alcohol', 'DNA denaturation in PCR', 'Lock and key encryption', 'Public key cryptography',
      // Generic words that must not catch it, among them what pH would have left bare.
      'Optimum population', 'Optimum pH of soil', 'Temperature and thermometers', 'Effect of temperature on the rate of reaction', 'The pH scale', 'Acids and alkalis', 'Greenhouse gases', 'The greenhouse effect', 'Carbon dioxide test', 'Light intensity and the inverse square law', 'Crop production', 'Respiration',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('enzyme-rate')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "enzyme-rate"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:enzyme-rate"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const e of ENZYMES) expect(engine.prompt).toContain(e)
  })

  it('the figures in its catalogue entry are the ones it marks to', () => {
    expect(engine.prompt).toContain(`best step is ${BEST_TEMP} °C`)
    expect(engine.prompt).toContain(`catalase ${FACTS.catalase.bestPh}, amylase ${FACTS.amylase.bestPh}, pepsin ${FACTS.pepsin.bestPh}, trypsin ${FACTS.trypsin.bestPh}, lipase ${FACTS.lipase.bestPh}`)
    expect(engine.prompt).toContain(`${SITES_MIN} to ${SITES_MAX} enzyme molecules, default ${DEFAULT_SITES}`)
    expect(engine.prompt).toContain(`${TARGET_MIN} to ${TARGET_MAX}, default ${DEFAULT_TARGET}`)
    expect(engine.prompt).toContain(`from ${TEMPS[0]} to ${TEMPS[TEMPS.length - 1]} °C in tens, starting at ${START_TEMP} °C`)
    expect(engine.prompt).toContain(`pH ${PHS[0]} to ${PHS[PHS.length - 1]}`)
    expect(engine.prompt).toContain(`${OTHER_TEMPS[0]} to ${OTHER_TEMPS[OTHER_TEMPS.length - 1]} °C`)
  })
})

describe('a still frame is a frame a learner sees', { timeout: 30_000 }, () => {
  type Box = { left: number; right: number; top: number; bottom: number }
  const box = (t: { text: string; x: number; y: number; anchor: string }, font = 7): Box => {
    const wide = t.text.length * font
    const left = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - wide : t.x - wide / 2
    return { left, right: left + wide, top: t.y - 12, bottom: t.y + 3 }
  }
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const onPlate = (b: Box, name: string) => {
    expect(b.left, name).toBeGreaterThanOrEqual(0)
    expect(b.right, name).toBeLessThanOrEqual(W)
    expect(b.top, name).toBeGreaterThanOrEqual(0)
    expect(b.bottom, name).toBeLessThanOrEqual(H)
  }
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
  const centre = (b: Box) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 })
  // The picture alone: the caption and the readings below it say "foam" whatever the tube is doing.
  const text60 = (renderToStaticMarkup(createElement(EnzymeRateView, { config: heat(), state: { tubes: [[20, 30, 40, 50, 60]] }, setState: () => {}, marked: 'idle', reduced: true, locked: false })).match(/<g data-bath="">.*?<\/g><g data-lens/)?.[0] ?? '').replace(/<[^>]*>/g, ' ')

  /** Every state worth looking at: the start, the answer, each level of the scale, and each level after the worst there is. */
  const statesOf = (c: EnzymeCard): State[] => {
    const grid = levelsOf(c)
    return [engine.initial(c), engine.solve(c), ...grid.map((v) => ({ tubes: [[v]] })), ...grid.map((v) => ({ tubes: [[grid[grid.length - 1], v]] })), ...grid.map((v) => ({ tubes: [[bestOf(c) + (c.factor === 'temperature' ? 10 : c.factor === 'ph' ? 3 : 0), v].filter((n) => grid.includes(n))] }))]
  }

  it('the names on the tube stay on the plate, apart, and beside what they name', () => {
    for (const c of ENZYME_CARDS) {
      for (const s of statesOf(c)) {
        const tags = tubeTags(factsOf(c), rateOf(c, s))
        tags.forEach((t, i) => {
          const b = box(t)
          onPlate(b, `${t.text} ${nameOf(c)}`)
          tags.forEach((o, j) => { if (j > i) expect(hits(b, box(o)), `${t.text}/${o.text}`).toBe(false) })
          // The tube itself ends at its wall, and the name starts past it.
          expect(b.left, t.text).toBeGreaterThanOrEqual(TUBE_X + 18)
          const near = dist(centre(b), t.part)
          for (const o of tags) if (o !== t) expect(near, `${t.text} nearer ${o.text}`).toBeLessThan(dist(centre(b), o.part))
        })
      }
    }
  })

  it('a name leaves with its thing: no foam, no word for it', () => {
    expect(tubeTags(FACTS.catalase, 0).map((t) => t.text)).toEqual(['liver'])
    expect(tubeTags(FACTS.catalase, 24).map((t) => t.text)).toEqual(['foam', 'liver'])
    expect(text60).not.toContain('foam')
    expect(text60).toContain('liver')
  })

  it('the names on the tube miss the tube label, the paper and the lens', () => {
    const paper: Box = { left: 124, right: 180, top: 8, bottom: 41 }
    const label: Box = { left: 126, right: 160, top: 14, bottom: 34 }
    for (const c of ENZYME_CARDS) for (const s of statesOf(c)) {
      for (const t of tubeTags(factsOf(c), rateOf(c, s))) {
        const b = box(t)
        if (c.factor === 'ph') expect(hits(b, paper), `${t.text} ${nameOf(c)} ${JSON.stringify(s)}`).toBe(false)
        if (c.factor === 'substrate') expect(hits(b, label), `${t.text} ${nameOf(c)} ${JSON.stringify(s)}`).toBe(false)
        expect(b.right, t.text).toBeLessThan(LX - LR)
      }
    }
  })

  it('every molecule sits inside the lens, and nothing in the lens touches anything else', () => {
    for (const n of [...SITES]) {
      const { at, gaps } = lensLayout(n)
      expect(at).toHaveLength(n)
      const reach = MOLECULE_REACH * moleculeScale(n)
      at.forEach(([x, y], i) => {
        expect(Math.hypot(x, y) + reach, `molecule ${i} of ${n}`).toBeLessThanOrEqual(LR - 3)
        at.forEach(([x2, y2], j) => { if (j > i) expect(Math.hypot(x - x2, y - y2), `${i} ${j} of ${n}`).toBeGreaterThanOrEqual(2 * reach - 4) })
      })
      gaps.forEach(([x, y], i) => {
        expect(Math.hypot(x, y) + WEDGE_REACH + DRIFT, `gap ${i} of ${n}`).toBeLessThanOrEqual(LR - 3)
        at.forEach(([x2, y2], j) => expect(Math.hypot(x - x2, y - y2), `gap ${i} / molecule ${j} of ${n}`).toBeGreaterThanOrEqual(reach + WEDGE_REACH + DRIFT - 4))
        gaps.forEach(([x2, y2], j) => { if (j > i) expect(Math.hypot(x - x2, y - y2), `gaps ${i} ${j} of ${n}`).toBeGreaterThanOrEqual(2 * (WEDGE_REACH + DRIFT)) })
      })
    }
  })

  it('the lens has a gap for everything that can be left waiting', () => {
    for (const c of SUBS) for (const v of SUBSTRATES) {
      const l = lensOf(c, { tubes: [[v]] })
      expect(l.free, `${nameOf(c)} ${v}`).toBeLessThanOrEqual(lensLayout(l.molecules.length).gaps.length)
    }
    for (const c of [...HEATS, ...PH_CARDS]) for (const v of levelsOf(c)) {
      const l = lensOf(c, { tubes: [[v]] })
      expect(l.free).toBeLessThanOrEqual(lensLayout(4).gaps.length)
      expect(l.molecules).toHaveLength(4)
    }
  })

  it('a damaged tube draws exactly its fraction of changed molecules, and only an intact one holds a substrate', () => {
    const c = heat()
    const count = (s: State) => lensOf(c, s).molecules.filter((m) => m.intact).length
    expect(count({ tubes: [[40]] })).toBe(4)
    expect(count({ tubes: [[50]] })).toBe(1)
    expect(count({ tubes: [[60]] })).toBe(0)
    expect(lensOf(ph('amylase'), { tubes: [[4]] }).molecules.filter((m) => m.intact)).toHaveLength(2)
    for (const card of [...HEATS, ...PH_CARDS]) for (const s of statesOf(card)) {
      const l = lensOf(card, s)
      for (const m of l.molecules) if (m.busy) expect(m.intact, nameOf(card)).toBe(true)
      // Anything still working shows at least one substrate at work.
      expect(l.molecules.some((m) => m.busy), `${nameOf(card)} ${JSON.stringify(s)}`).toBe(rateOf(card, s) > 0)
    }
  })

  // Measured in Chrome at the card's own size and weight, since a count of letters overstates "active site". The margin is for other fonts.
  const MEASURED: Record<string, number> = { enzyme: 45.3, 'active site': 58.6, substrate: 54.5, changed: 50.1, 'changed shape': 87.8, denatured: 60.7 }
  const rowBox = (t: { text: string; x: number; y: number }): Box => {
    const wide = MEASURED[t.text] * 1.06
    return { left: t.x - wide / 2, right: t.x + wide / 2, top: t.y - 12, bottom: t.y + 3 }
  }

  it('the names under the lens are in a row, apart, on the plate, and clear of the lens', () => {
    for (const marked of ['idle', 'right', 'wrong'] as const) {
      for (const c of ENZYME_CARDS) for (const s of statesOf(c)) {
        const tags = lensTags(lensOf(c, s), marked)
        expect(tags.length, nameOf(c)).toBeGreaterThanOrEqual(1)
        tags.forEach((t, i) => {
          expect(MEASURED[t.text], t.text).toBeGreaterThan(0)
          const b = rowBox(t)
          onPlate(b, `${t.text} ${nameOf(c)}`)
          // Clear of the hot plate on the left, whose right edge is at 170, and of the lens above.
          expect(b.left, `${t.text} ${nameOf(c)}`).toBeGreaterThanOrEqual(170)
          expect(b.top, t.text).toBeGreaterThanOrEqual(LY + LR)
          tags.forEach((o, j) => { if (j > i) expect(hits(b, rowBox(o)), `${t.text}/${o.text}`).toBe(false) })
          expect(dist(t.to, { x: LX, y: LY }), `${t.text} points into the lens`).toBeLessThanOrEqual(LR)
        })
      }
    }
  })

  it('the bench names stay on the plate and clear of the graph title, wherever the lamp is', () => {
    for (const c of LIMITS) {
      const g = graphOf(c)
      const title = box({ text: g.title, x: 14, y: 184, anchor: 'start' })
      for (const l of LIGHTS) for (const o of OTHERS) {
        const tags = benchTags(l, limitRate(l, o))
        tags.forEach((t, i) => {
          const b = box(t)
          onPlate(b, t.text)
          expect(hits(b, title), t.text).toBe(false)
          tags.forEach((x, j) => { if (j > i) expect(hits(b, box(x)), `${t.text}/${x.text}`).toBe(false) })
          const near = dist(centre(b), t.part)
          for (const x of tags) if (x !== t) expect(near, `${t.text} nearer ${x.text}`).toBeLessThan(dist(centre(b), x.part))
        })
      }
    }
  })

  it('the lamp stays on the bench and clear of the beaker, and one step moves it far enough to see', () => {
    expect(lampX(1) - 15).toBeGreaterThanOrEqual(6)
    expect(lampX(5) + 38).toBeLessThanOrEqual(176)
    expect(lampX(2) - lampX(1)).toBeGreaterThanOrEqual(20)
  })

  it('the gas stays in its tube, and one lamp step that raises the rate moves it clearly', () => {
    expect(gasBottom(30)).toBeLessThan(92)
    expect(gasBottom(12) - gasBottom(6)).toBeGreaterThanOrEqual(8)
  })

  it('every reading is on the graph, every note is on the plate, and no note hits another', () => {
    for (const c of ALL) {
      const g = graphOf(c)
      const states = c.task === 'limiting' ? [engine.initial(c), engine.solve(c), { light: 5, second: 5 }, { light: 1, second: 5 }] : statesOf(c)
      for (const s of states) {
        for (const t of tracesOf(c, s)) for (const p of t.points) {
          expect(graphX(g, p.x), nameOf(c)).toBeGreaterThanOrEqual(PX0)
          expect(graphX(g, p.x), nameOf(c)).toBeLessThanOrEqual(g.x1)
          expect(graphY(g, p.y), `${nameOf(c)} ${JSON.stringify(p)}`).toBeLessThanOrEqual(PY0)
          expect(graphY(g, p.y), `${nameOf(c)} ${JSON.stringify(p)}`).toBeGreaterThanOrEqual(PY1)
        }
        const notes = notesOf(c, s)
        notes.forEach((n, i) => {
          const b = box(n, 7.2)
          onPlate(b, `${n.text} ${nameOf(c)}`)
          expect(b.bottom, `${n.text} ${nameOf(c)}`).toBeLessThanOrEqual(PY0)
          notes.forEach((o, j) => { if (j > i) expect(hits(b, box(o, 7.2)), `${n.text}/${o.text} ${nameOf(c)}`).toBe(false) })
        })
      }
    }
  })

  it('the ticks along the graph keep apart, and the axis name is clear of the last', () => {
    for (const c of [heat(), ph(), sub(), limit()] as Config[]) {
      const g = graphOf(c)
      for (let i = 1; i < g.xs.length; i++) expect(graphX(g, g.xs[i]) - graphX(g, g.xs[i - 1]), nameOf(c)).toBeGreaterThanOrEqual(20)
      expect(W - 6 - g.xName.length * 7.2, nameOf(c)).toBeGreaterThanOrEqual(graphX(g, g.xs[g.xs.length - 1]) + 7)
    }
  })

  it('the longest graph title is clear of the names under the lens', () => {
    for (const e of ENZYMES) {
      const title = box({ text: FACTS[e].title, x: 14, y: 184, anchor: 'start' })
      for (const t of lensTags(lensOf(heat(e), { tubes: [[60]] }), 'idle')) expect(hits(title, box(t, 7.2)), `${FACTS[e].title} / ${t.text}`).toBe(false)
      for (const t of lensTags(lensOf(heat(e), { tubes: [[20]] }), 'idle')) expect(hits(title, box(t, 7.2)), `${FACTS[e].title} / ${t.text}`).toBe(false)
    }
  })

  it('no more than about eight short labels before marking', () => {
    for (const c of ENZYME_CARDS) for (const s of statesOf(c)) {
      expect(tubeTags(factsOf(c), rateOf(c, s)).length + lensTags(lensOf(c, s), 'idle').length, nameOf(c)).toBeLessThanOrEqual(6)
    }
    expect(benchTags(1, 6).length).toBeLessThanOrEqual(6)
  })

  it('one smallest move makes a change the eye catches', () => {
    // A step on the way up moves the foam by more than the width of a label's height; the thermometer moves too.
    const c = heat()
    for (const [a, b] of [[10, 20], [20, 30], [30, 40]]) {
      expect((tubeRate(c, [b]) - tubeRate(c, [a])) * 0.9, `${a} to ${b}`).toBeGreaterThanOrEqual(10)
      expect(thermY(a) - thermY(b)).toBeGreaterThanOrEqual(12)
    }
    expect((tubeRate(c, [40]) - tubeRate(c, [40, 50, 40])) * 0.9).toBeGreaterThanOrEqual(60)
    // pH, the same; and a step of the other factor on the limiting card moves the thermometer or the gauge.
    const p = ph('amylase')
    for (const [a, b] of [[5, 6], [6, 7]]) expect((tubeRate(p, [b]) - tubeRate(p, [a])) * 0.9).toBeGreaterThanOrEqual(20)
    expect(pondY(15) - pondY(20)).toBeGreaterThanOrEqual(16)
    // Each substrate step lights one more active site, or leaves one more waiting.
    const s = sub(4)
    for (let v = 1; v < 6; v++) {
      const a = lensOf(s, { tubes: [[v]] })
      const b = lensOf(s, { tubes: [[v + 1]] })
      expect(b.molecules.filter((m) => m.busy).length + b.free, String(v)).toBe(a.molecules.filter((m) => m.busy).length + a.free + 1)
    }
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    const e = graphOf(heat())
    const l = graphOf(limit())
    expect(e.xs).toEqual(TEMPS)
    expect(e.top).toBe(RATE_TOP)
    expect(l.top).toBe(BUBBLE_TOP)
    expect(l.xs).toEqual(LIGHTS)
    expect(pondY(OTHER_TEMPS[0])).toBeGreaterThan(pondY(OTHER_TEMPS[OTHER_TEMPS.length - 1]))
    expect(LIQUID_TOP - RATE_TOP * 0.9).toBeGreaterThan(10)
    expect(graphOf(ph()).xs).toEqual(PHS)
    expect(graphOf(sub()).xs).toEqual(SUBSTRATES)
    for (const v of PHS) expect(phColour(v)).toMatch(/^#[0-9A-F]{6}$/)
    expect(OTHERS).toEqual([1, 2, 3, 4, 5])
    expect(LIGHTS).toEqual([1, 2, 3, 4, 5])
  })

  it('the true curve drawn after marking is the one the card was marking to', () => {
    expect(idealOf(heat(), {}).map((p) => p.y)).toEqual([6, 12, 24, 48, 96, 48, 0, 0])
    expect(idealOf(limit(), { light: 4, second: 3 }).map((p) => p.y)).toEqual([6, 12, 18, 24, 24])
    expect(idealOf(sub(3), {}).map((p) => p.y)).toEqual([20, 40, 60, 60, 60, 60])
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'enzyme-rate', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: Config, state: State, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(EnzymeRateView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: Config[] = [heat(), ph('pepsin'), ph('trypsin'), sub(4), sub(3, 'amylase'), heat('amylase'), heat('pepsin'), heat('lipase'), limit(24), limit(18, 'temperature')]

  it('before marking, nothing says the answer, the rule or the reason', () => {
    for (const cfg of EXAMPLES) {
      const prompt = goodPrompt(cfg)
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'optimum', 'Optimum', 'fastest', 'denatur', 'killed', 'limiting', 'limits', 'plateau', 'saturat', 'every site', 'collide', 'collisions', '37 °C', 'cannot mend', 'recover', 'too much', 'nothing wasted', 'wrong']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
    }
  })

  it('before marking, damage is drawn and named, but not with the word to be learned', () => {
    const html = raw(heat(), { tubes: [[20, 30, 40, 50, 60, 50]] }, 'idle')
    expect(text(html)).toContain('changed shape')
    expect(html).toContain('data-molecule="changed"')
    expect(text(html)).not.toContain('denatured')
    expect(attrs(html)).not.toContain('denatured')
    expect(text(raw(heat(), { tubes: [[20, 30, 40, 50, 60, 50]] }, 'wrong'))).toContain('denatured')
  })

  it('names what it draws, on the card, before marking', () => {
    const t = text(raw(heat(), engine.initial(heat()), 'idle'))
    for (const name of ['foam', 'liver', 'enzyme', 'active site', 'substrate', 'Foam in a minute', 'Rate', 'Hottest this tube', 'Water bath', 'Fresh tube', 'hydrogen peroxide']) expect(t, name).toContain(name)
    const p = text(raw(ph('pepsin'), engine.initial(ph('pepsin')), 'idle'))
    for (const name of ['egg white', 'pH', 'paper', 'Tube has seen', 'pH of the buffer', 'Egg white gone']) expect(p, name).toContain(name)
    expect(text(raw(ph('amylase'), engine.initial(ph('amylase')), 'idle'))).toContain('starch')
    expect(text(raw(heat('lipase'), engine.initial(heat('lipase')), 'idle'))).toContain('fat')
    const l = text(raw(limit(), engine.initial(limit()), 'idle'))
    for (const name of ['lamp', 'pondweed', 'oxygen', 'CO₂', 'Bubbles a minute', 'Aim', 'aim', 'light', 'Carbon dioxide']) expect(l, name).toContain(name)
    const lt = text(raw(limit(18, 'temperature'), engine.initial(limit(18, 'temperature')), 'idle'))
    for (const name of ['lamp', 'Temperature', '10 °C']) expect(lt, name).toContain(name)
    expect(lt).not.toContain('CO₂')
  })

  it('the graph starts with one reading and no curve, and each step adds a dot', () => {
    const start = raw(heat(), engine.initial(heat()), 'idle')
    expect(start).not.toContain('data-true')
    expect(start).not.toContain('data-note')
    expect([...start.matchAll(/data-trace="now"/g)]).toHaveLength(1)
    const dots = (html: string) => { const m = html.match(/data-trace="now">(.*?)<\/g>/); return [...(m?.[1] ?? '').matchAll(/<circle/g)].length }
    expect(dots(start)).toBe(1)
    expect(dots(raw(heat(), { tubes: [[20, 30]] }, 'idle'))).toBe(2)
    expect(dots(raw(heat(), { tubes: [[20, 30, 40]] }, 'idle'))).toBe(3)
  })

  it('the way down lies below the way up, and a fresh tube starts a new line in its own colour', () => {
    const [t] = tracesOf(heat(), { tubes: [[30, 40, 50, 40, 30]] })
    expect(t.points.map((p) => p.y)).toEqual([48, 96, 48, 24, 12])
    const two = tracesOf(heat(), freshTube(heat(), { tubes: [[30, 40, 50, 40]] }))
    expect(two.map((x) => x.now)).toEqual([false, true])
    expect(two[1].points).toEqual([{ x: 40, y: 96 }])
    const html = raw(heat(), { tubes: [[30, 40, 50, 40], [40]] }, 'idle')
    expect(html).toContain('data-trace="old"')
    expect(text(html)).toContain('grey: an earlier tube')
    expect(text(raw(heat(), { tubes: [[30, 40]] }, 'idle'))).not.toContain('grey')
    // Only the last three tubes are drawn, however many were used.
    expect(tracesOf(heat(), { tubes: [[20], [20], [20], [20], [20]] })).toHaveLength(3)
  })

  it('each setting of the other factor gets its own line on the limiting graph', () => {
    const s: State = { light: 3, second: 2, seen: [[1, 1], [2, 1], [3, 1], [3, 2]] }
    const lines = tracesOf(limit(), s)
    expect(lines.map((x) => x.now)).toEqual([false, true])
    expect(lines[0].points).toEqual([{ x: 1, y: 6 }, { x: 2, y: 12 }, { x: 3, y: 12 }])
    expect(lines[1].points).toEqual([{ x: 3, y: 18 }])
    expect(text(raw(limit(), s, 'idle'))).toContain('grey: other levels')
  })

  it('marking gives the names and the true curve, and what was made when wrong', () => {
    const right = raw(heat(), engine.solve(heat()), 'right')
    expect(right).toContain('data-true')
    expect(text(right)).toContain('fastest')
    expect(text(right)).toContain('denatured')
    expect(text(right)).toContain('40 °C')
    const wrong = raw(heat(), { tubes: [[20, 30]] }, 'wrong')
    expect(wrong).not.toContain('data-true')
    expect(text(wrong)).toContain('You left it at 30 °C')
    expect(text(wrong)).not.toContain('fastest')
    const lr = text(raw(limit(), engine.solve(limit()), 'right'))
    expect(lr).toContain('light limits')
    expect(lr).toContain('CO₂ limits')
    const st = text(raw(limit(18, 'temperature'), engine.solve(limit(18, 'temperature')), 'right'))
    expect(st).toContain('temperature limits')
    const sr = text(raw(sub(4), engine.solve(sub(4)), 'right'))
    expect(sr).toContain('substrate limits')
    expect(sr).toContain('every site busy')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const shown = raw(heat(), engine.initial(heat()), 'shown')
    expect(text(shown)).toContain('40 °C')
    expect(shown).toContain('data-reading="rate">96 mm a minute')
    const l = raw(limit(24), engine.initial(limit(24)), 'shown')
    expect(l).toContain('data-reading="rate">24')
  })

  it('every control is a real button with its own label, no more than four in view, and they lock when solved', () => {
    for (const cfg of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const buttons = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
      expect(buttons.length, nameOf(cfg)).toBeGreaterThanOrEqual(2)
      expect(buttons.length, nameOf(cfg)).toBeLessThanOrEqual(4)
      expect(new Set(buttons.map((m) => m[1])).size, nameOf(cfg)).toBe(buttons.length)
      for (const m of buttons) expect(m[0], m[1]).toContain('type="button"')
      expect(idle, nameOf(cfg)).toContain('nodrag')
      const solved = raw(cfg, engine.solve(cfg), 'right')
      for (const m of solved.matchAll(/<button[^>]*>/g)) expect(m[0], nameOf(cfg)).toContain('disabled')
    }
    expect(raw(heat(), engine.initial(heat()), 'idle')).toContain('aria-label="Take a fresh tube"')
    expect(raw(sub(), engine.initial(sub()), 'idle')).not.toContain('fresh tube')
  })

  it('a button at the end of its scale is disabled, and the button order says nothing about the answer', () => {
    const at0 = raw(heat(), { tubes: [[0]] }, 'idle')
    expect(at0.match(/<button[^>]*aria-label="Cool the water bath[^>]*>/)![0]).toContain('disabled')
    const top = raw(limit(), { light: 5, second: 5 }, 'idle')
    expect(top.match(/<button[^>]*aria-label="Move the lamp nearer"[^>]*>/)![0]).toContain('disabled')
    const orders = HEATS.map((c) => [...raw(c, engine.initial(c), 'idle').matchAll(/aria-label="([^"]+)"[^>]*>/g)].map((m) => m[1]).filter((l) => /Cool|Warm|fresh/.test(l)).join('|'))
    expect(new Set(orders).size).toBe(1)
  })

  it('keyboard help is for keyboard users', () => {
    for (const cfg of [heat(), limit()] as Config[]) {
      const html = raw(cfg, engine.initial(cfg), 'idle')
      expect(html).toContain('[&amp;:has(button:focus-visible)_.er-kbd]:block')
      expect(html).toMatch(/er-kbd hidden/)
    }
  })

  it('the still frame changes with every move, with nothing animating under reduced motion', () => {
    for (const cfg of EXAMPLES) {
      const first = raw(cfg, engine.initial(cfg), 'idle', true)
      expect(first, nameOf(cfg)).not.toMatch(/transition:\s*[a-z]/)
      expect(first, nameOf(cfg)).not.toMatch(/<animate/)
      if (cfg.task === 'limiting') {
        expect(raw(cfg, limitStepped(engine.initial(cfg), 'light', 1), 'idle', true)).not.toBe(first)
        expect(raw(cfg, limitStepped(engine.initial(cfg), 'second', 1), 'idle', true)).not.toBe(first)
      } else {
        expect(raw(cfg, stepped(cfg, engine.initial(cfg), 1), 'idle', true)).not.toBe(first)
        expect(raw(cfg, stepped(cfg, engine.initial(cfg), -1), 'idle', true) === first, nameOf(cfg)).toBe(atOf(cfg, engine.initial(cfg)) === levelsOf(cfg)[0])
      }
    }
    // When motion is allowed, a change eases and the bubbles rise.
    const live = raw(heat(), engine.initial(heat()), 'idle', false)
    expect(live).toMatch(/transition:[a-z]/)
    expect(live).toMatch(/<animate/)
    expect(raw(limit(), engine.initial(limit()), 'idle', false)).toMatch(/<animate/)
  })

  it('a flat step still changes the drawing: the lamp moves even when the rate does not', () => {
    const before = raw(limit(), { light: 2, second: 1 }, 'idle', true)
    const after = raw(limit(), { light: 3, second: 1, seen: [[1, 1], [2, 1], [3, 1]] }, 'idle', true)
    expect(after).not.toBe(before)
    expect(after).toContain('data-lamp="3"')
    expect(before).toContain('data-lamp="2"')
    expect(limitRate(2, 1)).toBe(limitRate(3, 1))
    // The gauge, the same.
    const g = raw(limit(), { light: 1, second: 2 }, 'idle', true)
    expect(g).toContain('data-gas-bottle="2"')
  })

  it('tells a screen reader what is there, never what it means', () => {
    const live = raw(heat(), { tubes: [[20, 30]] }, 'idle')
    expect(attrs(live)).toContain('water bath at 30 degrees')
    expect(attrs(live)).toContain('48 mm a minute')
    expect(text(live)).toContain('30 °C. The rate is 48 mm a minute.')
    expect(attrs(raw(ph('pepsin'), { tubes: [[4, 3]] }, 'idle'))).toContain('at pH 3')
    expect(attrs(raw(limit(), { light: 2, second: 1 }, 'idle'))).toContain('12 bubbles a minute')
    expect(text(raw(limit(), { light: 2, second: 1 }, 'idle'))).toContain('Lamp at step 2, carbon dioxide at 1. 12 bubbles a minute.')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const cfg of EXAMPLES) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })

  it('the state a tap makes passes through parse-safe reading', () => {
    expect(seenOf(limitStepped(limitStepped(engine.initial(limit()), 'light', 1), 'second', 1))).toEqual([[1, 1], [2, 1], [2, 2]])
    expect(tubesOf(heat(), stepped(heat(), engine.initial(heat()), 1))).toEqual([[20, 30]])
    expect(done(limit(24), { light: 4, second: 3 })).toBe(true)
  })
})
