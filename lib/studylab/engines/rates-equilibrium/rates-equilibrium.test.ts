// lib/studylab/engines/rates-equilibrium/rates-equilibrium.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The rest of the registry first, so this folder's own engine registers last and is the one the card finds.
import '..'
import {
  ratesEquilibriumEngine as engine, RATE_REACTIONS, EQ_REACTIONS, SPECIES, COUNTS, EXPOSED, FIELD, STOPS, SPEED_MIN, SHIFT_MIN,
  levelsAt, rateOf, speedRatio, successShare, collisionRate, solidLayout, simTemp, needed, deltaMoles,
  amountsAt, changeIn, settle, equilibriumConstant, volumeAt, temperatureAt, addedAt, shiftToward,
  type RatesEquilibriumConfig, type SpeedTask, type ShiftTask, type SpeciesId,
} from './config'
import { RatesSim, ShiftSim, stillRates, stillShift, rateParams, applyShift, BOX, SHIFT_BOX, radiusOf, RatesEquilibriumView } from './View'
import { getEngine, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const speed = (reaction: string, condition: string, goal: string) => engine.parse({ task: { kind: 'speed', reaction, condition, goal } })
const shift = (o: Record<string, unknown>) => engine.parse({ task: { kind: 'shift', ...o } })

describe('the rules for how fast a reaction goes', () => {
  const r = RATE_REACTIONS.thiosulfate
  const at = (o: Partial<ReturnType<typeof levelsAt>>) => ({ temp: 2, conc: 2, area: 1, cat: 0 as 0 | 1, ...o })

  it('goes faster when hotter: more collisions, and a bigger share of them hard enough', () => {
    for (let i = 0; i < 4; i++) {
      expect(collisionRate(r, at({ temp: i + 1 }))).toBeGreaterThan(collisionRate(r, at({ temp: i })))
      expect(successShare(r, at({ temp: i + 1 }))).toBeGreaterThan(successShare(r, at({ temp: i })))
      expect(rateOf(r, at({ temp: i + 1 }))).toBeGreaterThan(rateOf(r, at({ temp: i })))
    }
  })

  it('shows temperature changing the share far more than the count of collisions (the part students miss)', () => {
    const hot = at({ temp: 4 })
    const mid = at({ temp: 2 })
    expect(successShare(r, hot) / successShare(r, mid)).toBeGreaterThan(2 * (collisionRate(r, hot) / collisionRate(r, mid)))
  })

  it('does not change how often particles meet when a catalyst is added, only how hard a hit must be', () => {
    const h = RATE_REACTIONS.haber
    expect(collisionRate(h, at({ cat: 1 }))).toBe(collisionRate(h, at({ cat: 0 })))
    expect(needed(1)).toBeLessThan(needed(0))
    expect(rateOf(h, at({ cat: 1 }))).toBeGreaterThan(rateOf(h, at({ cat: 0 })))
  })

  it('goes faster with more particles in the space, and with a solid broken up', () => {
    for (const id of ['thiosulfate', 'marble'] as const) {
      for (let i = 0; i < 4; i++) expect(rateOf(RATE_REACTIONS[id], at({ conc: i + 1 }))).toBeGreaterThan(rateOf(RATE_REACTIONS[id], at({ conc: i })))
    }
    const m = RATE_REACTIONS.marble
    expect(rateOf(m, at({ area: 1 }))).toBeGreaterThan(rateOf(m, at({ area: 0 })))
    expect(rateOf(m, at({ area: 2 }))).toBeGreaterThan(rateOf(m, at({ area: 1 })))
  })

  it('doubles a rate about every 10 degrees near room temperature, as the syllabus rule of thumb says', () => {
    // Between 25 and 40 degrees on the dial: 15 degrees, so between 2x and 4x.
    const ratio = rateOf(r, at({ temp: 2 })) / rateOf(r, at({ temp: 1 }))
    expect(ratio).toBeGreaterThan(2)
    expect(ratio).toBeLessThan(4)
  })

  it('builds the solid from 64 cells in each state, with more of them hittable as it breaks up', () => {
    for (const a of [0, 1, 2]) expect(solidLayout(a)).toHaveLength(64)
    expect(EXPOSED[0]).toBeLessThan(EXPOSED[1])
    expect(EXPOSED[1]).toBeLessThan(EXPOSED[2])
    expect(simTemp(RATE_REACTIONS.marble, 2)).toBe(1)
  })
})

describe('the rules for a balance', () => {
  it('starts every reaction at the mixture the scene draws', () => {
    for (const r of Object.values(EQ_REACTIONS)) {
      const got = settle(r, r.base, 1, r.T0)
      got.forEach((n, i) => expect(n).toBeCloseTo(r.base[i], 6))
    }
  })

  it('keeps the atoms: what one side loses the other gains, by the equation', () => {
    for (const r of Object.values(EQ_REACTIONS)) {
      for (const [V, T] of [[0.5, r.T0], [2, r.T0 + 60], [1, r.T0 - 60]]) {
        const got = settle(r, r.base.map((n) => n + 1), V, T)
        const atoms = (n: number[]) => r.terms.reduce((s, t, i) => s + SPECIES[t.id].atoms * n[i], 0)
        expect(atoms(got)).toBeCloseTo(atoms(r.base.map((n) => n + 1)), 5)
      }
    }
  })

  it('moves the real way for heat: the endothermic direction wins when hotter (enthalpy signs from the named sources)', () => {
    // N2O4 -> 2NO2 is endothermic (+57.2 kJ/mol): hotter, more NO2.
    expect(changeIn(shiftTask('n2o4', 'temperature', 'no2'), 4)).toBeGreaterThan(5)
    expect(changeIn(shiftTask('n2o4', 'temperature', 'no2'), -4)).toBeLessThan(-5)
    // Haber, Contact and H2 + I2 are exothermic: hotter, less product.
    expect(changeIn(shiftTask('haber', 'temperature', 'nh3'), 4)).toBeLessThan(-2)
    expect(changeIn(shiftTask('contact', 'temperature', 'so3'), 4)).toBeLessThan(-2)
    expect(changeIn(shiftTask('hi', 'temperature', 'hi'), 4)).toBeLessThan(0)
    expect(changeIn(shiftTask('haber', 'temperature', 'nh3'), -4)).toBeGreaterThan(2)
  })

  it('moves the real way for pressure: toward the side with fewer gas molecules', () => {
    expect(deltaMoles(EQ_REACTIONS.n2o4)).toBe(1)
    expect(deltaMoles(EQ_REACTIONS.haber)).toBe(-2)
    expect(deltaMoles(EQ_REACTIONS.contact)).toBe(-1)
    expect(deltaMoles(EQ_REACTIONS.hi)).toBe(0)
    expect(changeIn(shiftTask('haber', 'pressure', 'nh3'), 4)).toBeGreaterThan(SHIFT_MIN)
    expect(changeIn(shiftTask('contact', 'pressure', 'so3'), 4)).toBeGreaterThan(SHIFT_MIN)
    expect(changeIn(shiftTask('n2o4', 'pressure', 'no2'), 4)).toBeLessThan(-SHIFT_MIN)
    for (const p of [-4, -2, 2, 4]) expect(Math.abs(changeIn(shiftTask('hi', 'pressure', 'hi'), p))).toBeLessThan(1e-6)
    expect(volumeAt(4)).toBeLessThan(1)
  })

  it('moves the real way for adding a substance: away from what was added', () => {
    // More N2 pushes the Haber balance toward ammonia, and uses up hydrogen.
    const t = { ...shiftTask('haber', 'concentration', 'nh3'), adjust: 'n2' as SpeciesId }
    expect(changeIn(t, 4)).toBeGreaterThan(0)
    expect(changeIn({ ...t, species: 'h2' }, 4)).toBeLessThan(0)
    // Taking out the product pulls the balance toward it.
    const rev = { ...shiftTask('haber', 'concentration', 'n2'), adjust: 'nh3' as SpeciesId }
    expect(changeIn(rev, -4)).toBeLessThan(0)
  })

  it('never moves for a catalyst', () => {
    const t = shiftTask('haber', 'catalyst', 'nh3')
    expect(amountsAt(t, 3)).toEqual(amountsAt(t, 0))
  })

  it('keeps K the same at the starting temperature and raises or lowers it by the van \'t Hoff equation', () => {
    for (const r of Object.values(EQ_REACTIONS)) {
      const K0 = equilibriumConstant(r, r.T0)
      const hot = equilibriumConstant(r, r.T0 + 50)
      expect(r.dH > 0 ? hot > K0 : hot < K0).toBe(true)
    }
    expect(temperatureAt(EQ_REACTIONS.haber, 0)).toBe(EQ_REACTIONS.haber.T0)
    expect(addedAt(EQ_REACTIONS.haber, 'n2', 6)).toBe(6)
  })
})

function shiftTask(reaction: ShiftTask['reaction'], lever: ShiftTask['lever'], species: SpeciesId): ShiftTask {
  return { kind: 'shift', reaction, lever, species, amount: 'more' }
}

describe('reading what a writer wrote', () => {
  it('reads phrases for the same thing', () => {
    expect(speed('Marble chips and hydrochloric acid', 'Surface Area', 'Faster')).toEqual({
      task: { kind: 'speed', reaction: 'marble', condition: 'surface area', goal: 'faster' },
    })
    expect(speed('magnesium ribbon with acid', 'particle size', 'speed up')?.task).toMatchObject({ reaction: 'magnesium', condition: 'surface area', goal: 'faster' })
    expect(speed('the Haber process', 'a catalyst', 'slow down')?.task).toMatchObject({ reaction: 'haber', condition: 'catalyst', goal: 'slower' })
    expect(speed('thiosulphate and acid', 'pressure', 'slower')?.task).toMatchObject({ reaction: 'thiosulfate', condition: 'concentration' })
    expect(shift({ reaction: 'N₂O₄ ⇌ 2NO₂', lever: 'heat', species: 'NO₂', amount: 'More' })?.task).toEqual({
      kind: 'shift', reaction: 'n2o4', lever: 'temperature', species: 'no2', amount: 'more',
    })
    expect(shift({ reaction: 'Haber', lever: 'pressure', species: 'ammonia', amount: 'fewer' })?.task).toMatchObject({ amount: 'less', lever: 'pressure' })
    expect(shift({ reaction: 'contact process', lever: 'amount of a substance', species: 'sulphur trioxide', amount: 'more', adjust: 'SO2' })?.task)
      .toMatchObject({ reaction: 'contact', lever: 'concentration', species: 'so3', adjust: 'so2' })
  })

  it('reads a value out of range and leaves the refusal to faults', () => {
    // Surface area on a gas, and a catalyst where there is none, still parse; faults explains.
    expect(speed('sodium thiosulfate and hydrochloric acid', 'surface area', 'faster')).not.toBeNull()
    expect(shift({ reaction: 'hydrogen and iodine', lever: 'pressure', species: 'hydrogen iodide', amount: 'more' })).not.toBeNull()
  })

  it('returns null only for what it cannot read', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: { kind: 'dance' } })).toBeNull()
    expect(speed('unobtainium and cheese', 'temperature', 'faster')).toBeNull()
    expect(speed('marble chips', 'mood', 'faster')).toBeNull()
    expect(speed('marble chips', 'temperature', 'sideways')).toBeNull()
    expect(shift({ reaction: 'haber', lever: 'pressure', species: 'cheese', amount: 'more' })).toBeNull()
    expect(shift({ reaction: 'haber', lever: 'pressure', species: 'ammonia', amount: 'sideways' })).toBeNull()
    expect(shift({ reaction: 'haber', lever: 'wind', species: 'ammonia', amount: 'more' })).toBeNull()
  })
})

describe('what a writer can fix', () => {
  const faults = (c: RatesEquilibriumConfig | null) => engine.faults(c!)

  it('refuses surface area where there is no solid, with an example that works', () => {
    const f = faults(speed('sodium thiosulfate and hydrochloric acid', 'surface area', 'faster'))
    expect(f).toHaveLength(1)
    expect(f[0]).toMatch(/no solid/)
    expect(f[0]).toMatch(/marble chips and hydrochloric acid/)
    expect(faults(speed('marble chips and hydrochloric acid', 'surface area', 'faster'))).toEqual([])
  })

  it('refuses a catalyst where the syllabus has none, and names the reactions that do', () => {
    const f = faults(speed('magnesium and hydrochloric acid', 'catalyst', 'faster'))
    expect(f[0]).toMatch(/iron/)
    expect(f[0]).toMatch(/vanadium/)
    expect(faults(speed('nitrogen and hydrogen', 'catalyst', 'faster'))).toEqual([])
  })

  it('refuses pressure on a balance with equal gas molecules, teaching why, and offers one that works', () => {
    const f = faults(shift({ reaction: 'hydrogen and iodine', lever: 'pressure', species: 'hydrogen iodide', amount: 'more' }))
    expect(f[0]).toMatch(/same number of gas molecules/)
    expect(f[0]).toMatch(/For example/)
  })

  it('refuses a catalyst as the lever: it cannot move a balance', () => {
    const f = faults(shift({ reaction: 'haber', lever: 'catalyst', species: 'ammonia', amount: 'more' }))
    expect(f[0]).toMatch(/both directions equally/)
    expect(f[0]).toMatch(/For example/)
  })

  it('refuses a concentration lever with nothing to adjust, or one that is the goal itself', () => {
    expect(faults(shift({ reaction: 'haber', lever: 'concentration', species: 'ammonia', amount: 'more' }))[0]).toMatch(/adjust/)
    expect(faults(shift({ reaction: 'haber', lever: 'concentration', species: 'ammonia', amount: 'more', adjust: 'ammonia' }))[0]).toMatch(/different substance/)
    expect(faults(shift({ reaction: 'haber', lever: 'concentration', species: 'ammonia', amount: 'more', adjust: 'oxygen' }))[0]).toMatch(/not in/)
  })

  it('refuses a substance that is not in the reaction', () => {
    expect(faults(shift({ reaction: 'haber', lever: 'temperature', species: 'iodine', amount: 'more' }))[0]).toMatch(/not in the Haber process/)
  })

  it('refuses a change too small to see, such as heating to get less hydrogen iodide', () => {
    const f = faults(shift({ reaction: 'hydrogen and iodine', lever: 'temperature', species: 'hydrogen iodide', amount: 'less' }))
    expect(f[0]).toMatch(/cannot be made/)
    expect(faults(shift({ reaction: 'hydrogen and iodine', lever: 'temperature', species: 'hydrogen iodide', amount: 'more' }))).toEqual([])
  })

  it('has an example in every refusal that is itself a working config', () => {
    for (const r of Object.values(EQ_REACTIONS)) {
      const f = faults(shift({ reaction: r.id, lever: 'catalyst', species: r.terms[0].id, amount: 'more' }))[0]
      const m = f.match(/For example: "(more|less) ([a-z ]+)" with (.+) as the lever/)!
      expect(m, f).not.toBeNull()
      const species = (Object.keys(SPECIES) as SpeciesId[]).find((id) => SPECIES[id].name === m[2])!
      const lever = m[3].startsWith('the amount of ') ? 'concentration' : m[3]
      const adjust = lever === 'concentration' ? (Object.keys(SPECIES) as SpeciesId[]).find((id) => SPECIES[id].name === m[3].replace('the amount of ', '')) : undefined
      const c = shift({ reaction: r.id, lever, species, amount: m[1], ...(adjust ? { adjust } : {}) })!
      expect(engine.faults(c), f).toEqual([])
    }
  })
})

describe('starts unsolved and can always be solved', { timeout: 30_000 }, () => {
  const speedConfigs: RatesEquilibriumConfig[] = []
  for (const r of Object.values(RATE_REACTIONS)) {
    for (const condition of ['temperature', 'concentration', 'surface area', 'catalyst']) {
      for (const goal of ['faster', 'slower']) speedConfigs.push(speed(r.name, condition, goal)!)
    }
  }
  const shiftConfigs: RatesEquilibriumConfig[] = []
  for (const r of Object.values(EQ_REACTIONS)) {
    for (const lever of ['temperature', 'pressure', 'concentration', 'catalyst']) {
      for (const t of r.terms) {
        for (const amount of ['more', 'less']) {
          if (lever !== 'concentration') shiftConfigs.push(shift({ reaction: r.id, lever, species: t.id, amount })!)
          else for (const a of r.terms) shiftConfigs.push(shift({ reaction: r.id, lever, species: t.id, amount, adjust: a.id })!)
        }
      }
    }
  }

  it('enumerates every speed config: starts unsolved, solves, and no other config is solved at the start', () => {
    let good = 0
    for (const c of speedConfigs) {
      expect(c).not.toBeNull()
      if (engine.faults(c).length) continue
      good++
      const t = c.task as SpeedTask
      expect(engine.check(c, engine.initial(c)).ok, JSON.stringify(c)).toBe(false)
      const solved = engine.solve(c)
      expect(engine.check(c, solved).ok, JSON.stringify(c)).toBe(true)
      // The dial's other end does not also pass: the goal and its opposite never both hold.
      const opposite = { ...c, task: { ...t, goal: t.goal === 'faster' ? 'slower' : 'faster' } } as RatesEquilibriumConfig
      expect(engine.check(opposite, solved).ok, JSON.stringify(c)).toBe(false)
      // Faster really means faster by the rate rule, by at least the margin.
      const ratio = speedRatio(t, solved.pos)
      expect(t.goal === 'faster' ? ratio >= SPEED_MIN - 1e-9 : ratio <= 1 / SPEED_MIN + 1e-9).toBe(true)
    }
    expect(good).toBe(28)
  })

  it('enumerates every shift config: starts unsolved, solves, and refuses with a sentence otherwise', () => {
    let good = 0
    let refused = 0
    for (const c of shiftConfigs) {
      const f = engine.faults(c)
      if (f.length) {
        refused++
        expect(f[0].length).toBeGreaterThan(30)
        continue
      }
      good++
      const t = c.task as ShiftTask
      expect(engine.check(c, engine.initial(c)).ok, JSON.stringify(c)).toBe(false)
      const solved = engine.solve(c)
      expect(engine.check(c, solved).ok, JSON.stringify(c)).toBe(true)
      // The change is clear to the eye, in the asked direction.
      expect((t.amount === 'more' ? 1 : -1) * changeIn(t, solved.pos)).toBeGreaterThanOrEqual(SHIFT_MIN)
      // And the dial cannot meet the goal by moving the wrong way: some position in the wrong half fails.
      expect(engine.check(c, { pos: -solved.pos }).ok, JSON.stringify(c)).toBe(false)
    }
    expect(good).toBeGreaterThan(40)
    expect(refused).toBeGreaterThan(20)
  })

  it('treats a position outside the dial like the nearest end', () => {
    const c = speed('thiosulfate', 'temperature', 'faster')!
    expect(engine.check(c, { pos: 99 }).ok).toBe(engine.check(c, { pos: 4 }).ok)
    expect(engine.check(c, undefined as never).ok).toBe(false)
    expect(engine.check(c, { pos: NaN }).ok).toBe(false)
  })

  it('keeps the starting setting off the answer for surface area and catalyst, both ways', () => {
    for (const goal of ['faster', 'slower']) {
      for (const [r, cond] of [['marble', 'surface area'], ['haber', 'catalyst']] as const) {
        const c = speed(r, cond, goal)!
        expect(engine.check(c, engine.initial(c)).ok).toBe(false)
        expect(engine.check(c, engine.solve(c)).ok).toBe(true)
      }
    }
  })
})

describe('the chamber is a picture of the rules, not a second answer', { timeout: 30_000 }, () => {
  it('lets more collisions succeed as it gets hotter, in the order the rules give', () => {
    const t: SpeedTask = { kind: 'speed', reaction: 'thiosulfate', condition: 'temperature', goal: 'faster' }
    const got = [0, 1, 2, 3, 4].map((pos) => {
      const sim = new RatesSim(rateParams(t, pos), 11)
      for (let i = 0; i < 4000; i++) sim.step()
      return sim.successes
    })
    for (let i = 0; i < 4; i++) expect(got[i + 1]).toBeGreaterThan(got[i])
  })

  it('succeeds in a share of collisions that follows exp(-needed/kT), and in a smaller share for a catalyst-free hit', () => {
    const t: SpeedTask = { kind: 'speed', reaction: 'haber', condition: 'catalyst', goal: 'faster' }
    const share = (pos: number) => {
      const sim = new RatesSim(rateParams(t, pos), 21)
      for (let i = 0; i < 5000; i++) sim.step()
      return sim.successes / sim.collisions
    }
    const without = share(0)
    const withCat = share(1)
    expect(withCat).toBeGreaterThan(without * 1.8)
    // By the rule, with a little less because hard hitters are used up.
    expect(without).toBeGreaterThan(0.4 * Math.exp(-needed(0)))
    expect(without).toBeLessThan(1.2 * Math.exp(-needed(0)))
  })

  it('does not change how often particles meet when a catalyst is added', () => {
    const t: SpeedTask = { kind: 'speed', reaction: 'haber', condition: 'catalyst', goal: 'faster' }
    const meets = (pos: number) => {
      const sim = new RatesSim(rateParams(t, pos), 5)
      for (let i = 0; i < 5000; i++) sim.step()
      return sim.collisions
    }
    expect(Math.abs(meets(1) - meets(0)) / meets(0)).toBeLessThan(0.15)
  })

  it('settles a balance on the amounts the rules give, with both directions going at the same rate', () => {
    const cases: ShiftTask[] = [
      { kind: 'shift', reaction: 'n2o4', lever: 'temperature', species: 'no2', amount: 'more' },
      { kind: 'shift', reaction: 'haber', lever: 'pressure', species: 'nh3', amount: 'more' },
      { kind: 'shift', reaction: 'contact', lever: 'concentration', species: 'so3', amount: 'more', adjust: 'so2' },
      { kind: 'shift', reaction: 'hi', lever: 'temperature', species: 'hi', amount: 'more' },
    ]
    for (const t of cases) {
      for (const pos of [-4, 0, 4]) {
        const r = EQ_REACTIONS[t.reaction]
        const sim = new ShiftSim(r, 3)
        applyShift(sim, t, pos)
        for (let i = 0; i < 600; i++) sim.step()
        sim.forward = 0
        sim.reverse = 0
        const sum = r.terms.map(() => 0)
        for (let i = 0; i < 1800; i++) {
          sim.step()
          sim.counts().forEach((c, k) => { sum[k] += c })
        }
        const want = amountsAt(t, pos)
        sum.forEach((s, k) => expect(Math.abs(s / 1800 - want[k]), `${t.reaction} ${t.lever} ${pos} species ${k}`).toBeLessThan(1.2))
        expect(sim.forward).toBeGreaterThan(60)
        expect(sim.reverse).toBeGreaterThan(60)
        expect(Math.abs(sim.forward - sim.reverse) / sim.forward).toBeLessThan(0.25)
      }
    }
  })

  it('is the same still frame every time', () => {
    const t: SpeedTask = { kind: 'speed', reaction: 'marble', condition: 'surface area', goal: 'faster' }
    expect(stillRates(t, 1).movers).toEqual(stillRates(t, 1).movers)
    const s = shiftTask('haber', 'pressure', 'nh3')
    expect(stillShift(s, 2).parts).toEqual(stillShift(s, 2).parts)
    expect(stillShift(s, 2).parts).not.toEqual(stillShift(s, -2).parts)
  })
})

describe('what a learner sees in the box', () => {
  it('has the same size as the layout the rules use', () => {
    expect(BOX.w).toBe(FIELD.w)
    expect(BOX.h).toBe(FIELD.h)
  })

  it('keeps every particle inside the box and clear of the solid, at every setting', () => {
    for (const reaction of ['marble', 'thiosulfate'] as const) {
      for (const [condition, stops] of [['temperature', 5], ['concentration', 5], ['surface area', 3]] as const) {
        const t: SpeedTask = { kind: 'speed', reaction, condition, goal: 'faster' }
        for (let pos = 0; pos < stops; pos++) {
          const sim = stillRates(t, pos, 200)
          for (const m of sim.movers) {
            expect(m.x - BOX.r).toBeGreaterThanOrEqual(BOX.inset - 1e-9)
            expect(m.y - BOX.r).toBeGreaterThanOrEqual(BOX.inset - 1e-9)
            expect(m.x + BOX.r).toBeLessThanOrEqual(BOX.w - BOX.inset + 1e-9)
            expect(m.y + BOX.r).toBeLessThanOrEqual(BOX.h - BOX.inset + 1e-9)
            for (const c of sim.cells) expect(Math.hypot(m.x - c.x, m.y - c.y)).toBeGreaterThanOrEqual(BOX.r + 4 - 1.5)
          }
        }
      }
    }
  })

  it('never draws one particle over another in the collision box', () => {
    const t: SpeedTask = { kind: 'speed', reaction: 'thiosulfate', condition: 'concentration', goal: 'faster' }
    for (let pos = 0; pos < 5; pos++) {
      const ps = stillRates(t, pos, 200).movers
      let closest = Infinity
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) closest = Math.min(closest, Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y))
      expect(closest).toBeGreaterThanOrEqual(2 * BOX.r - 2)
    }
  })

  it('keeps every molecule of a balance inside the lid and clear of the others, at every lid height', () => {
    for (const r of Object.values(EQ_REACTIONS)) {
      for (const pos of [-4, 0, 4]) {
        const t: ShiftTask = { kind: 'shift', reaction: r.id, lever: 'pressure', species: r.terms[0].id, amount: 'more' }
        const sim = stillShift(t, pos, 120)
        const h = sim.height
        expect(h).toBeLessThanOrEqual(SHIFT_BOX.canvasH - 10)
        for (const p of sim.parts) {
          const rad = radiusOf(SPECIES[r.terms[p.term].id].atoms)
          expect(p.x - rad).toBeGreaterThanOrEqual(-1e-9)
          expect(p.y - rad).toBeGreaterThanOrEqual(-1e-9)
          expect(p.x + rad).toBeLessThanOrEqual(SHIFT_BOX.w + 1e-9)
          expect(p.y + rad).toBeLessThanOrEqual(h + 1e-9)
        }
        let worst = Infinity
        const ps = sim.parts
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const need = radiusOf(SPECIES[r.terms[ps[i].term].id].atoms) + radiusOf(SPECIES[r.terms[ps[j].term].id].atoms)
            worst = Math.min(worst, Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) - need)
          }
        }
        expect(worst, `${r.id} lid ${pos}`).toBeGreaterThanOrEqual(-2.5)
      }
    }
  })
})

describe('the prompt that goes with the scene', () => {
  const pf = (c: RatesEquilibriumConfig | null, prompt: string) => engine.promptFaults!(c!, prompt)

  it('refuses a prompt that says which way to turn the dial', () => {
    expect(pf(speed('thiosulfate', 'temperature', 'faster'), 'Heat it up to make the reaction faster.')).toHaveLength(1)
    expect(pf(speed('marble', 'surface area', 'faster'), 'Crush the marble to make it react faster.')).toHaveLength(1)
    expect(pf(speed('haber', 'catalyst', 'faster'), 'Add a catalyst to speed it up.')).toHaveLength(1)
    // A lesson on catalysts can name one, and the refusal says how.
    expect(pf(speed('haber', 'catalyst', 'faster'), 'Find out what the catalyst does: make this reaction go faster.')).toEqual([])
    expect(pf(speed('haber', 'catalyst', 'faster'), 'Add a catalyst to speed it up.')[0]).toContain('what the catalyst does')
    expect(pf(speed('haber', 'temperature', 'faster'), 'Heat it up.')[0]).toContain('Change the temperature')
    expect(pf(speed('thiosulfate', 'concentration', 'faster'), 'Use more acid so it goes faster.')).toHaveLength(1)
    expect(pf(speed('thiosulfate', 'temperature', 'faster'), 'Change the temperature so the reaction goes faster.')).toEqual([])
  })

  it('refuses a prompt that names the way a balance shifts, or gives the enthalpy', () => {
    const c = shift({ reaction: 'haber', lever: 'pressure', species: 'ammonia', amount: 'more' })
    expect(pf(c, 'Squeeze the gas to shift the balance to the right.')).not.toEqual([])
    expect(pf(c, 'The forward reaction is exothermic (ΔH = -92 kJ). Make more ammonia.')).not.toEqual([])
    expect(pf(c, 'Use the pressure lid to make more ammonia in the mixture.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('rates-equilibrium')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBe(2)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(c).not.toBeNull()
      expect(e.faults(c)).toEqual([])
      expect(e.promptFaults!(c, m[1])).toEqual([])
    }
  })
})

describe('the engine in the registry', () => {
  it('is registered, with its config in the catalogue entry and a real dimension', () => {
    expect(getEngine('rates-equilibrium')).toBe(engine)
    expect(engine.prompt).toMatch(/"engine":"rates-equilibrium"/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:rates-equilibrium"/)
    expect(engine.isolates).toBe('consequence')
  })

  it('is offered for the stations that name its topics, and not for ones that share only a word', () => {
    const offered = (station: string) => sceneCatalogue(station).includes('SCENE "rates-equilibrium"')
    for (const s of [
      'Rates of reaction', 'Collision theory: how fast do reactions go?', 'Catalysts', 'Dynamic equilibrium', "Le Chatelier's principle",
      'Reversible reactions', 'The Haber process', 'Activation energy', 'Chemical equilibrium and the Contact process',
    ]) expect(offered(s), s).toBe(true)
    for (const s of [
      'Exchange rates and inflation', 'Heart rate and exercise', 'Momentum and collisions', 'Atomic theory', "Archimedes' principle",
      'Energy transfers', 'Contact forces', 'Photosynthesis', 'Acids and bases', 'Interest rates', 'Flow rate and speed',
    ]) expect(offered(s), s).toBe(false)
  })
})

describe('the scene on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'rates-equilibrium', config }, success: { kind: 'scene' } } },
    } as never)))

  const speedCard = (reaction: string, condition: string, goal: string, prompt: string) => card({ task: { kind: 'speed', reaction, condition, goal } }, prompt)
  const shiftCard = (o: Record<string, unknown>, prompt: string) => card({ task: { kind: 'shift', ...o } }, prompt)

  it('draws a speed card with a dial the keyboard can set, each particle named beside its mark, and no answer', () => {
    const prompt = 'Change the temperature so the reaction goes faster.'
    const html = speedCard('marble chips and hydrochloric acid', 'temperature', 'faster', prompt)
    expect(html).toMatch(/type="range"/)
    expect(html).toMatch(/Temperature/)
    expect(html).toMatch(/needed/)
    // Each name sits in the same chip as its own mark.
    for (const name of ['acid', 'marble chips']) expect(html).toMatch(new RegExp(`</svg>${name}</span>`))
    const shown = html.replace(prompt, '')
    expect(shown).not.toMatch(/You made|faster|slower|about the same/i)
    expect(shown).not.toMatch(/more often|easier route|do not try harder/i)
  })

  it('draws a catalyst card as one switch, not a list, and names no answer', () => {
    const prompt = 'Use the catalyst so the reaction goes slower.'
    const html = speedCard('nitrogen and hydrogen', 'catalyst', 'slower', prompt)
    expect(html).toMatch(/role="switch"/)
    expect(html).toMatch(/aria-checked="true"/) // starts with it on, for "slower"
    expect(html.replace(prompt, '')).not.toMatch(/You made|faster|slower/i)
  })

  it('draws a balance card with its equation, a lever, and nothing about the way it shifts', () => {
    const prompt = 'Use the pressure lid to make more ammonia in the mixture.'
    const html = shiftCard({ reaction: 'Haber', lever: 'pressure', species: 'ammonia', amount: 'more' }, prompt)
    expect(html).toMatch(/type="range"/)
    expect(html).toMatch(/⇌/)
    for (const id of ['n2', 'h2', 'nh3'] as const) expect(html).toContain(SPECIES[id].name)
    const shown = html.replace(prompt, '')
    expect(shown).not.toMatch(/shift|exothermic|endothermic|kJ|favou?r|forward|toward|Le Chatelier|fewer|You made|settled/i)
    expect(shown).not.toMatch(/ΔH/)
    // The lever is labelled by what it does to the box, and its ends say nothing of the answer.
    expect(shown).toMatch(/Lower/)
    expect(shown).toMatch(/Higher/)
  })

  it('names every species by its own swatch, with formula and name together', () => {
    const html = shiftCard({ reaction: 'N2O4 and NO2', lever: 'temperature', species: 'nitrogen dioxide', amount: 'more' }, 'Use the temperature to make more nitrogen dioxide.')
    for (const id of ['n2o4', 'no2'] as const) {
      expect(html).toMatch(new RegExp(`<svg[^>]*aria-hidden[^>]*>.*?</svg><span[^>]*><span[^>]*>[^<]*(<sub>\\d</sub>)?[^<]*(<sub>\\d</sub>)?[^<]*</span><span[^>]*>${SPECIES[id].name}</span>`))
    }
  })

  it('says what was made once marked, and why, in sentence case', () => {
    const t = shiftTask('n2o4', 'temperature', 'no2')
    const view = (marked: 'right' | 'wrong', pos: number, goal: 'more' | 'less' = 'more') =>
      renderToStaticMarkup(createElement(RatesEquilibriumView, {
        config: { task: { ...t, amount: goal } }, state: { pos }, setState: () => {}, marked, reduced: true, locked: false,
      }))
    const wrong = view('wrong', -4)
    expect(wrong).toMatch(/You made less nitrogen dioxide settle/)
    expect(wrong).toMatch(/Cooling/)
    expect(wrong).not.toMatch(/Nitrogen Dioxide/)
    const right = view('right', 4)
    expect(right).toMatch(/More nitrogen dioxide settled/)
    expect(right).toMatch(/Heating pushes the balance the way that takes in heat/)
    const small = view('wrong', 0)
    expect(small).toMatch(/about the same amount of nitrogen dioxide/)
    const speedView = (marked: 'right' | 'wrong', pos: number) =>
      renderToStaticMarkup(createElement(RatesEquilibriumView, {
        config: { task: { kind: 'speed', reaction: 'thiosulfate', condition: 'temperature', goal: 'faster' } as SpeedTask }, state: { pos }, setState: () => {}, marked, reduced: true, locked: false,
      }))
    expect(speedView('wrong', 0)).toMatch(/You made the reaction slower/)
    expect(speedView('right', 4)).toMatch(/Faster\./)
    expect(speedView('right', 4)).toMatch(/do not try harder|more of the hits are enough/)
  })

  it('explains pressure honestly when it changes nothing', () => {
    const html = renderToStaticMarkup(createElement(RatesEquilibriumView, {
      config: { task: { kind: 'shift', reaction: 'hi', lever: 'pressure', species: 'hi', amount: 'more' } as ShiftTask },
      state: { pos: 3 }, setState: () => {}, marked: 'wrong', reduced: true, locked: false,
    }))
    expect(html).toMatch(/same number of gas molecules/)
    expect(shiftToward({ kind: 'shift', reaction: 'hi', lever: 'pressure', species: 'hi', amount: 'more' }, 3)).toBe('neither')
  })
})

describe('what the numbers on the dial mean', () => {
  it('has a start in the middle of every dial and ends that really differ', () => {
    for (const r of Object.values(RATE_REACTIONS)) {
      expect(r.temps).toHaveLength(STOPS.temperature)
      expect(COUNTS).toHaveLength(STOPS.concentration)
      expect(COUNTS[2]).toBe(20)
    }
  })
})
