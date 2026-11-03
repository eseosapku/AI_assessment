// lib/studylab/engines/half-life/half-life.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  halfLifeEngine as engine, BEAD_TOLERANCE, DRAWN_MAX, HALVES, LEFTS, LEVELS, MAX_STEP, MEASURES, NUCLIDES, STEPS_PER_HALF_LIFE, UNITS,
  amountAt, amountTicks, done, fmt, fractionAt, goodPrompt, halvesFor, isCount, knownNuclide, leftAtStep, madeLevels, madeStep, madeText, namesOf, sampleOf, standsAlone, stillWhole, targetStep, timeTicks, trueLevel, working,
  type DrawConfig, type HalfConfig, type HalfState, type WaitConfig,
} from './config'
import { BEAD_HIT, CELL, H_DRAW, H_WAIT, HalfLifeView, PX0_DRAW, PX0_WAIT, PX1, PY0, PY1, ROWS, STEP_TOTAL, TRAY, W, cellsOf, labelsOf, stairPath, textWidth, type Label } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const wait = (more: Partial<WaitConfig> = {}): WaitConfig => ({ task: 'wait', left: 1 / 2, halfLife: 8, unit: 'minutes', start: 64, measure: 'nuclei', background: 0, nuclide: null, ...more })
const draw = (more: Partial<DrawConfig> = {}): DrawConfig => ({ task: 'draw', halves: 4, start: 64, measure: 'nuclei', halfLife: null, unit: null, nuclide: null, ...more })
const nameOf = (c: unknown) => JSON.stringify(c)

const WAITS: HalfConfig[] = [
  ...LEFTS.flatMap((left) => [1, 5, 8, 12, 30, 0.5, 2.5, 5730, 99999].flatMap((halfLife) => ['seconds', 'minutes', 'years', 'billion years'].flatMap((unit) => [64, 100, 640, 6400, 100000].map((start) => wait({ left, halfLife, unit, start }))))),
  ...LEFTS.map((left) => wait({ left, measure: 'counts/min', start: 160 })),
  ...LEFTS.map((left) => wait({ left, measure: 'counts/s', start: 800 })),
  ...LEFTS.map((left) => wait({ left, measure: 'Bq', start: 4000 })),
  ...LEFTS.flatMap((left) => [[140, 20], [200, 50], [125, 5], [90, 10], [160, 40]].map(([start, background]) => wait({ left, measure: 'counts/min', start, background, halfLife: 12 }))),
  ...NUCLIDES.flatMap((n) => LEFTS.map((left) => wait({ left, nuclide: n.name, halfLife: n.halfLife, unit: n.unit }))),
  wait({ start: 16 }), wait({ start: 16, left: 1 / 4 }), wait({ start: 32, left: 1 / 8 }), wait({ start: 50, left: 1 / 4 }),
]
const DRAWS: HalfConfig[] = HALVES.flatMap((halves) => [16, 32, 64, 80, 100, 1000, 6400, 100000].flatMap((start) => [draw({ halves, start }), draw({ halves, start, halfLife: 8, unit: 'days' }), draw({ halves, start, measure: 'counts/min' })]))
const ALL = [...WAITS, ...DRAWS]

describe('the law', () => {
  it('halves every half-life, and the clock can always stop on a whole number of them', () => {
    expect(fractionAt(0)).toBe(1)
    for (let m = 1; m <= 5; m++) expect(fractionAt(m * STEPS_PER_HALF_LIFE)).toBeCloseTo(2 ** -m, 12)
    expect(MAX_STEP).toBe(5 * STEPS_PER_HALF_LIFE)
    expect(amountAt(wait({ start: 64 }), 12)).toBeCloseTo(8, 9)
  })

  it('a background sits on top of the source and never falls', () => {
    const c = wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12 })
    expect(amountAt(c, 0)).toBeCloseTo(140, 9)
    expect(amountAt(c, 4)).toBeCloseTo(80, 9)
    expect(amountAt(c, 8)).toBeCloseTo(50, 9)
    // The whole reading halves later than the source does: that is the trap.
    expect(amountAt(c, 5)).toBeLessThan(75)
    expect(amountAt(c, 4)).toBeGreaterThan(70)
    for (let k = 0; k <= MAX_STEP; k++) expect(amountAt(c, k)).toBeGreaterThan(20)
  })

  it('takes real half-lives, and knows a nuclide by the usual names', () => {
    for (const [name, want] of [['carbon-14', 5730], ['C-14', 5730], ['14C', 5730], ['Carbon 14', 5730], ['radiocarbon', 5730], ['iodine-131', 8], ['I-131', 8], ['tritium', 12.3], ['technetium-99m', 6], ['Tc-99m', 6], ['uranium 238', 4.5]] as [string, number][]) {
      expect(knownNuclide(name)?.halfLife, name).toBe(want)
    }
    expect(knownNuclide('__proto__')).toBeNull()
    expect(knownNuclide('isotope X')).toBeNull()
    expect(namesOf(wait({ nuclide: 'carbon-14' }))).toEqual({ parent: 'carbon-14', product: 'nitrogen-14' })
    expect(namesOf(wait())).toEqual({ parent: 'not yet decayed', product: 'decayed' })
    expect(namesOf(wait({ nuclide: 'isotope X' }))).toEqual({ parent: 'isotope X', product: 'decayed' })
  })

  it('marks along the axes have nothing to do with the half-life, and fit', () => {
    expect(timeTicks(40)).toEqual([0, 10, 20, 30, 40])
    expect(timeTicks(5)).toEqual([0, 1, 2, 3, 4, 5])
    expect(timeTicks(2.5)).toEqual([0, 0.5, 1, 1.5, 2, 2.5])
    expect(timeTicks(28650)).toEqual([0, 5000, 10000, 15000, 20000, 25000])
    expect(timeTicks(0)).toEqual([0])
    for (const c of WAITS as WaitConfig[]) {
      const ticks = timeTicks(c.halfLife * 5)
      expect(ticks.length, nameOf(c)).toBeLessThanOrEqual(6)
      expect(ticks.length, nameOf(c)).toBeGreaterThanOrEqual(3)
      const room = ((ticks[1] / (c.halfLife * 5)) * (PX1 - PX0_WAIT))
      expect(fmt(ticks[ticks.length - 1]).length * 7, nameOf(c)).toBeLessThan(room)
    }
    expect(amountTicks(64)).toEqual([0, 16, 32, 48, 64])
    expect(amountTicks(150)).toEqual([0, 75, 150])
    expect(amountTicks(51)).toEqual([0, 51])
  })
})

describe('the sample', { timeout: 30_000 }, () => {
  it('has the formula’s count at every stop of the clock, whatever the seed, and every nucleus goes whole', () => {
    for (const start of [16, 32, 50, 64, 6400]) {
      const n = Math.min(DRAWN_MAX, start)
      for (let seed = 1; seed <= 40; seed++) {
        const s = sampleOf(start, seed)
        expect(s.n).toBe(n)
        expect(new Set(s.order).size).toBe(n)
        for (let k = 0; k <= MAX_STEP; k++) expect(stillWhole(s, k), `${start} seed ${seed} step ${k}`).toBe(leftAtStep(n, k))
      }
    }
  })

  it('halves exactly on 64 nuclei, and a stop the learner reads is never ambiguous', () => {
    const s = sampleOf(64, 1)
    expect([0, 4, 8, 12, 16].map((k) => stillWhole(s, k))).toEqual([64, 32, 16, 8, 4])
    // A learner who stops when the count is right cannot be marked wrong: no other stop shows that count.
    for (const c of WAITS as WaitConfig[]) {
      if (c.start > DRAWN_MAX) continue
      const k = targetStep(c)
      const here = leftAtStep(Math.min(DRAWN_MAX, c.start), k)
      for (let j = 0; j <= MAX_STEP; j++) if (j !== k && c.background === 0) expect(leftAtStep(Math.min(DRAWN_MAX, c.start), j), `${nameOf(c)} step ${j}`).not.toBe(here)
    }
    // Every config that passes, background or not: the number at the right stop is on no other stop.
    for (const c of WAITS as WaitConfig[]) {
      expect(standsAlone(c), nameOf(c)).toBe(true)
      const shown = (j: number) => Math.round(amountAt(c, j))
      for (let j = 0; j <= MAX_STEP; j++) if (j !== targetStep(c)) expect(shown(j), `${nameOf(c)} step ${j}`).not.toBe(shown(targetStep(c)))
    }
  })

  it('a new sample loses different nuclei and the same number', () => {
    const a = sampleOf(64, 1)
    const b = sampleOf(64, 2)
    const goneBy = (s: typeof a, k: number) => s.times.flatMap((t, i) => (t <= k ? [i] : []))
    expect(goneBy(a, 4).length).toBe(goneBy(b, 4).length)
    expect(goneBy(a, 4)).not.toEqual(goneBy(b, 4))
    // Different seeds keep differing: no two of twenty are alike.
    expect(new Set(Array.from({ length: 20 }, (_, i) => goneBy(sampleOf(64, i + 1), 4).join())).size).toBe(20)
    // The same seed is the same sample, so a frame can be redrawn.
    expect(sampleOf(64, 7).times).toEqual(sampleOf(64, 7).times)
  })

  it('the stair is one step per nucleus, and only ever falls', () => {
    const s = sampleOf(64, 3)
    const d = stairPath(s, 20, (k) => k * 10, (w) => 100 - w)
    expect([...d.matchAll(/V/g)].length).toBe(s.times.filter((t) => t <= 20).length)
    const ys = [...d.matchAll(/V([\d.]+)/g)].map((m) => Number(m[1]))
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    expect(ALL.length).toBeGreaterThan(200)
    for (const c of ALL) {
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
  })

  it('marks a clock exactly at the right stop, and nowhere else', () => {
    for (const c of WAITS as WaitConfig[]) {
      const k = halvesFor(c.left) * STEPS_PER_HALF_LIFE
      for (let j = 0; j <= MAX_STEP; j++) expect(engine.check(c, { k: j }).ok, `${nameOf(c)} ${j}`).toBe(j === k)
    }
    const c = wait()
    for (const bad of [{}, { k: 4.5 }, { k: -4 }, { k: 400 }, { k: '4' }, null, undefined]) expect(engine.check(c, bad as never).ok, nameOf(bad)).toBe(false)
  })

  it('marks beads by the rule, including its edges', () => {
    const c = draw()
    const right = [32, 16, 8, 4]
    expect(done(c, { levels: right })).toBe(true)
    for (let i = 0; i < 4; i++) {
      for (const by of [-BEAD_TOLERANCE - 1, -BEAD_TOLERANCE, 0, BEAD_TOLERANCE, BEAD_TOLERANCE + 1]) {
        const levels = [...right]
        levels[i] += by
        expect(done(c, { levels }), JSON.stringify(levels)).toBe(Math.abs(by) <= BEAD_TOLERANCE)
      }
    }
    // Over a wide sweep the check is only ever the rule.
    for (let a = 0; a <= LEVELS; a += 4) for (let b = 0; b <= LEVELS; b += 4) {
      const levels = [a, b, 8, 4]
      expect(done(c, { levels })).toBe(levels.every((v, i) => Math.abs(v - trueLevel(i)) <= BEAD_TOLERANCE))
    }
    for (const bad of [{}, { levels: [32, 16, 8] }, { levels: 'x' }, { levels: [32, 16, 8, 'x'] }, { levels: [32, 16, 8, 500] }, null]) expect(done(c, bad as never), nameOf(bad)).toBe(false)
    const three = draw({ halves: 3 })
    expect(done(three, { levels: [32, 16, 8] })).toBe(true)
    expect(done(three, { levels: [32, 16, 8, 4] })).toBe(false)
    expect(engine.check(c, { levels: [32, 16, 16, 4] }).wrongIds).toEqual(['bead-3'])
  })

  it('the misconceptions are all marked wrong', () => {
    const c = draw()
    for (const levels of [[48, 32, 16, 0], [32, 0, 0, 0], [32, 32, 32, 32], [16, 8, 4, 2], [64, 32, 16, 8]]) expect(done(c, { levels }), JSON.stringify(levels)).toBe(false)
  })

  it('says something true when marked', () => {
    for (const c of ALL) {
      const said = working(c)
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      if (c.task === 'wait') {
        const n = halvesFor(c.left)
        expect(said, nameOf(c)).toContain(fmt(n * c.halfLife))
        if (n > 1) expect(said, nameOf(c)).toContain(`${n} half-lives`)
        if (c.background > 0) expect(said, nameOf(c)).toContain('background never falls')
      } else {
        expect(said, nameOf(c)).toContain(fmt(Math.round(c.start / 2)))
        expect(said, nameOf(c)).toContain('half of what is left')
      }
    }
    expect(working(wait({ left: 1 / 8 }))).toContain('24 minutes, which is 3 half-lives of 8 minutes')
    expect(working(wait({ left: 1 / 8 }))).toContain('64, then 32, 16, 8')
    expect(working(wait({ nuclide: 'carbon-14', halfLife: 5730, unit: 'years', left: 1 / 4 }))).toContain('11,460 years')
    expect(working(wait({ halfLife: 1 }))).toContain('1 minute:')
    expect(working(wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12 }))).toContain('from 120 to 60')
    expect(working(wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12 }))).toContain('reads 80')
    expect(working(wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12, left: 1 / 8 }))).toContain('went 120, then 60, 30, 15')
  })

  it('says what was made when wrong, never the answer', () => {
    for (const c of WAITS as WaitConfig[]) {
      for (let k = 0; k <= MAX_STEP; k++) {
        if (k === targetStep(c)) continue
        const said = madeText(c, { k })
        expect(said.startsWith('Yes.'), nameOf(c)).toBe(false)
        expect(said, `${nameOf(c)} ${k}`).not.toContain('half-li')
      }
    }
    expect(madeText(wait(), { k: 0 })).toMatch(/has not moved/)
    expect(madeText(wait({ left: 1 / 8 }), { k: 7 })).toBe('You stopped at 14 minutes, with 19 of the 64 left. That is more than an eighth.')
    expect(madeText(wait({ left: 1 / 8 }), { k: 16 })).toBe('You stopped at 32 minutes, with 4 of the 64 left. That is less than an eighth.')
    expect(madeText(wait({ measure: 'counts/min', start: 160, left: 1 / 4, halfLife: 8 }), { k: 4 })).toMatch(/counter reading 80.*more than a quarter of its count rate/)
    expect(madeText(wait({ measure: 'Bq', start: 4000, left: 1 / 4, halfLife: 6, unit: 'hours' }), { k: 4 })).toBe('You stopped at 6 hours, with an activity of 2,000 Bq. That is more than a quarter of where it started.')
    const d = draw()
    expect(madeText(d, { levels: [64, 64, 64, 64] })).toMatch(/still at the start/)
    expect(madeText(d, { levels: [48, 32, 16, 0] })).toMatch(/straight/)
    expect(madeText(d, { levels: [32, 40, 8, 4] })).toMatch(/goes up after 1 half-life/)
    expect(madeText(d, { levels: [32, 24, 8, 4] })).toBe('Between half-life 1 and half-life 2 your line goes from 32 to 24: less than half of them went.')
    expect(madeText(d, { levels: [32, 4, 2, 1] })).toBe('Between half-life 1 and half-life 2 your line goes from 32 to 4: more than half of them went.')
    expect(madeText(d, { levels: [16, 8, 4, 2] })).toMatch(/Between the start and half-life 1/)
  })

  it('names the trap: halving the whole reading, background and all', () => {
    const c = wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12 })
    expect(engine.check(c, { k: 5 }).ok).toBe(false)
    expect(madeText(c, { k: 5 })).toBe('The counter reads 70, about half of its first reading. But 20 of every reading is background, and that part never falls.')
    expect(madeText(c, { k: 2 })).toMatch(/You stopped at 6 minutes/)
  })
})

describe('reading the config', () => {
  const p = (raw: unknown) => engine.parse(raw)
  it('reads reasonable phrasings', () => {
    expect(p({ task: 'wait' })).toEqual(wait())
    expect(p({ task: 'find the half-life', halfLife: '8 minutes' })).toEqual(wait())
    expect(p({ task: 'Find half life', half_life: 8, unit: 'mins' })).toEqual(wait())
    expect(p({ halfLife: '6h', left: 'a quarter' })).toEqual(wait({ halfLife: 6, unit: 'hours', left: 1 / 4 }))
    expect(p({ left: '1/8' })).toEqual(wait({ left: 1 / 8 }))
    expect(p({ left: 'one-eighth' })).toEqual(wait({ left: 1 / 8 }))
    expect(p({ left: 'only an eighth' })).toEqual(wait({ left: 1 / 8 }))
    expect(p({ left: '1 in 16' })).toEqual(wait({ left: 1 / 16 }))
    expect(p({ left: '25%' })).toEqual(wait({ left: 1 / 4 }))
    expect(p({ left: 0.125 })).toEqual(wait({ left: 1 / 8 }))
    expect(p({ left: 8, nuclei: 64 })).toEqual(wait({ left: 1 / 8 }))
    expect(p({ decayed: '7/8' })).toEqual(wait({ left: 1 / 8 }))
    expect(p({ decayed: '75%' })).toEqual(wait({ left: 1 / 4 }))
    expect(p({ halfLives: 3 })).toEqual(wait({ left: 1 / 8 }))
    expect(p({ task: { kind: 'wait', left: 'half' } })).toEqual(wait())
    expect(p({ nuclei: '6,400' })).toEqual(wait({ start: 6400 }))
    expect(p({ nuclide: 'C-14', left: '1/4' })).toEqual(wait({ nuclide: 'carbon-14', halfLife: 5730, unit: 'years', left: 1 / 4 }))
    expect(p({ task: 'dating', isotope: 'carbon 14', halfLife: 5700, unit: 'years', left: '1/4' })).toEqual(wait({ nuclide: 'carbon-14', halfLife: 5700, unit: 'years', left: 1 / 4 }))
    expect(p({ nuclide: 'Uranium-238' })).toEqual(wait({ nuclide: 'uranium-238', halfLife: 4.5, unit: 'billion years' }))
    expect(p({ halfLife: 4500000000, unit: 'years' })).toEqual(wait({ halfLife: 4.5, unit: 'billion years' }))
    expect(p({ countRate: 140, background: 20, halfLife: 12 })).toEqual(wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12 }))
    expect(p({ measure: 'count rate', start: 160 })).toEqual(wait({ measure: 'counts/min', start: 160 }))
    expect(p({ measure: 'counts per second', start: 800 })).toEqual(wait({ measure: 'counts/s', start: 800 }))
    expect(p({ activity: 4000 })).toEqual(wait({ measure: 'Bq', start: 4000 }))
    expect(p({ task: 'draw' })).toEqual(draw())
    expect(p({ task: 'Draw the curve', halves: 3 })).toEqual(draw({ halves: 3 }))
    expect(p({ task: 'predict', nuclei: 800, halfLife: '8 days' })).toEqual(draw({ start: 800, halfLife: 8, unit: 'days' }))
    expect(p({ beads: 3 })).toEqual(draw({ halves: 3 }))
    expect(p({ task: 'sketch', halfLives: 3 })).toEqual(draw({ halves: 3 }))
  })

  it('returns null only for what cannot be read at all', () => {
    for (const raw of [null, 'half-life', 7, {}, { task: 'dance' }, { task: '__proto__' }, { task: 'wait', halfLife: 'soon' }, { task: 'wait', left: 'most' }, { task: 'wait', start: 'lots' }, { task: 'wait', nuclide: 5 }, { task: 'wait', measure: 'mass spectrum' }, { task: 'draw', halves: 'many' }, { task: 'wait', background: 'some' }]) {
      expect(p(raw), nameOf(raw)).toBeNull()
    }
    // Out of range still parses: faults says what would work.
    for (const raw of [{ task: 'wait', left: '1/3' }, { task: 'wait', left: '1/32' }, { task: 'wait', halfLife: -2 }, { task: 'wait', halfLife: 8, unit: 'fortnights' }, { task: 'wait', start: 5 }, { task: 'wait', start: 2000000 }, { task: 'draw', halves: 7 }, { task: 'wait', measure: 'counts/min', start: 100, background: 80 }, { task: 'wait', nuclide: 'carbon-14', halfLife: 8, unit: 'minutes' }]) {
      const c = p(raw)
      expect(c, nameOf(raw)).not.toBeNull()
      expect(engine.faults(c!).length, nameOf(raw)).toBeGreaterThan(0)
    }
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const cases: [HalfConfig, RegExp, Record<string, unknown>][] = [
      [wait({ left: 1 / 3 }), /1\/2, 1\/4, 1\/8 or 1\/16/, { left: 1 / 8 }],
      [wait({ left: 1 / 32 }), /1\/2, 1\/4, 1\/8 or 1\/16/, { left: 1 / 8 }],
      [wait({ left: 3 / 4 }), /1\/2, 1\/4, 1\/8 or 1\/16/, { left: 1 / 8 }],
      [wait({ start: 16, left: 1 / 8 }), /too few to tell/, { start: 64 }],
      [wait({ start: 5 }), /too few to show a half-life \(16 or more\)/, { start: 64 }],
      [wait({ start: 2000000 }), /at most 100,000/, { start: 6400 }],
      [wait({ halfLife: 0 }), /above 0/, { halfLife: 8 }],
      [wait({ halfLife: -2 }), /above 0/, { halfLife: 8 }],
      [wait({ halfLife: 150000, unit: 'years' }), /too long to write/, { halfLife: 4.5, unit: 'billion years' }],
      [wait({ unit: 'fortnights' }), /not a unit the clock can show/, { unit: 'minutes' }],
      [wait({ nuclide: 'carbon-14', halfLife: 8, unit: 'minutes' }), /half-life of carbon-14 is 5,730 years/, { halfLife: 5730, unit: 'years' }],
      [wait({ background: 20 }), /belongs to a count rate/, { measure: 'counts/min', start: 140, background: 20 }],
      [wait({ measure: 'Bq', start: 400, background: 20 }), /belongs to a count rate/, { measure: 'counts/min', start: 140, background: 20 }],
      [wait({ measure: 'counts/min', start: 64, background: 16, left: 1 / 16 }), /too close to the stops/, { start: 140, background: 20 }],
      [wait({ measure: 'counts/min', start: 100, background: 80 }), /a quarter at most/, { start: 140, background: 20 }],
      [wait({ measure: 'counts/min', start: 140, background: -3 }), /0 or more/, { background: 20 }],
      [wait({ nuclide: 'a very long and unusual isotope name' }), /too long to name/, { nuclide: 'iodine-131', halfLife: 8, unit: 'days' }],
      [draw({ halves: 7 }), /must be 3 or 4/, { halves: 4 }],
      [draw({ halves: 2 }), /must be 3 or 4/, { halves: 3 }],
      [draw({ start: 3 }), /too few/, { start: 64 }],
    ]
    for (const [c, says, fix] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = { ...c, ...fix } as unknown as HalfConfig
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
    }
    // Nothing a refused config can do crashes the rest of the engine.
    for (const [c] of cases) {
      expect(() => engine.check(c, engine.initial(c)), nameOf(c)).not.toThrow()
      for (const marked of ['idle', 'wrong', 'right', 'shown'] as const) {
        expect(() => renderToStaticMarkup(createElement(HalfLifeView, { config: c, state: engine.initial(c), setState: () => {}, marked, reduced: true, locked: false })), nameOf(c)).not.toThrow()
      }
    }
    expect(() => renderToStaticMarkup(createElement(HalfLifeView, { config: draw({ halves: 1000000 }), state: {}, setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    expect(MEASURES).toContain('Bq')
    expect(UNITS).toContain('billion years')
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: HalfConfig, s: string) => engine.promptFaults!(c, s)

  it('asking for the outcome is fine', () => {
    expect(pf(wait(), 'Drag the clock handle along the time line, or tap + and -, until half of the nuclei have gone.')).toEqual([])
    expect(pf(wait({ left: 1 / 8 }), 'The half-life is 8 minutes. Drag the clock handle until only an eighth of the 64 nuclei are left.')).toEqual([])
    expect(pf(wait({ nuclide: 'carbon-14', halfLife: 5730, unit: 'years', left: 1 / 4 }), 'A piece of old wood has only a quarter of its carbon-14 left. Drag the clock handle until only a quarter is left, to find its age.')).toEqual([])
    expect(pf(wait({ left: 1 / 16 }), 'Sweep the clock along and watch how many go. Stop when 4 nuclei are left.')).toEqual([])
    expect(pf(draw(), 'Before it runs, drag each bead up or down to show how many nuclei are left after that many half-lives.')).toEqual([])
  })

  it('the time, the count of half-lives, or the trick is not', () => {
    for (const s of ['Drag the clock to 8 minutes.', 'The half-life is 8 minutes. Find it.', 'Stop at 8.']) expect(pf(wait(), s), s).toHaveLength(1)
    for (const s of ['Drag the clock to 24 minutes.', 'Wait 3 half-lives.', 'Wait three half-lives.']) expect(pf(wait({ left: 1 / 8 }), s), s).toHaveLength(1)
    expect(pf(wait({ nuclide: 'carbon-14', halfLife: 5730, unit: 'years', left: 1 / 4 }), 'Wind on 11,460 years.')).toHaveLength(1)
    expect(pf(wait({ nuclide: 'carbon-14', halfLife: 5730, unit: 'years', left: 1 / 4 }), 'Wind on 11460 years.')).toHaveLength(1)
    const bg = wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12 })
    for (const s of ['Subtract the background first.', 'Take off the background, then halve it.', 'Stop when the counter reads 80.', 'Find the corrected count rate.']) expect(pf(bg, s), s).toHaveLength(1)
    for (const s of ['Drag each bead to 32, 16, 8 and 4.', 'Draw the curve.', 'It is exponential.', 'Halve the number each time.', 'Half of what is left goes.', 'Not a straight line.']) expect(pf(draw(), s), s).toHaveLength(1)
  })

  it('a nuclide’s own number is not mistaken for the answer', () => {
    expect(pf(wait({ halfLife: 14, unit: 'days', nuclide: 'phosphorus-32' }), 'Drag the clock until half of the phosphorus-32 has gone.')).toEqual([])
    expect(pf(wait({ halfLife: 7, left: 1 / 4 }), 'Drag the clock until 14 nuclei are left.')).toEqual([])
    expect(pf(wait({ halfLife: 32 }), 'Drag the clock until half of the phosphorus-32 has gone.')).toEqual([])
  })

  it('what the card does not show is refused too', () => {
    for (const s of ['Which is alpha and which is beta?', 'Add an absorber.', 'Roll the dice.', 'Flip the coins.', 'Tap the nucleus you think goes next.', 'Pick a nucleus.', 'Listen to the clicks.', 'Heat the sample and see what changes.', 'Type your answer.', 'Balance the decay equation.']) {
      expect(pf(wait({ left: 1 / 4 }), s).join(), s).toMatch(/does not show/)
    }
    expect(pf(wait({ left: 1 / 4 }), 'Read the GM tube.').join()).toMatch(/does not show/)
    expect(pf(wait({ left: 1 / 4 }), 'Watch the count rate.').join()).toMatch(/does not show/)
    expect(pf(wait({ left: 1 / 4, measure: 'counts/min', start: 160 }), 'Watch the count rate on the counter until it has fallen to a quarter of where it started.')).toEqual([])
    expect(pf(wait({ left: 1 / 4, measure: 'Bq', start: 4000 }), 'Read the GM tube.').join()).toMatch(/does not show/)
    expect(pf(wait({ left: 1 / 4, measure: 'Bq', start: 4000 }), 'Drag the clock until the activity has fallen to a quarter of where it started.')).toEqual([])
    expect(pf(draw(), 'Wind the clock on.').join()).toMatch(/does not show/)
  })

  it('every fix it offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const said = pf(c, 'Roll the dice.')
      expect(said, nameOf(c)).toHaveLength(1)
      const fix = said[0].match(/\("([^"]+)"\)/)![1]
      expect(fix).toBe(goodPrompt(c))
      expect(pf(c, fix), `${nameOf(c)}: ${fix}`).toEqual([])
      expect(fix).toMatch(c.task === 'wait' ? /clock handle/ : /drag each bead/)
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"half-life", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['wait', 'draw']))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "half-life"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'half-life')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Half-life', 'Half life', 'Half-lives', 'Finding the half-life from a graph', 'Decay constant and half-life', 'Radioactivity', 'Chapter 16: Radioactivity', 'Radioactive decay', 'Atomic Nuclei and Radioactive Decay',
      'Chapter 33: Radioactive materials', 'Rate of decay of radioactive substances and half-life of a radioisotope', 'Randomness and decay', 'The mathematics of radioactive decay', 'Decay graphs and equations', 'Uninhibited decay and radioactive decay problems',
      'Carbon dating', 'Radiocarbon dating', 'Radioactive dating of rocks', 'Count rate and background count', 'Using a Geiger counter', 'Decay curves',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other half-lives, other decay, or the parts of radioactivity it does not draw', () => {
    for (const st of [
      // Pharmacology and the body.
      'The half-life of a drug', 'Half-life of drugs in the body', 'Drug half-life and dosing', 'Half-lives of drugs', 'Elimination half-life', 'Plasma half-life of medicines', 'Biological half-life', 'The half-life of caffeine', 'Half-life of alcohol in the blood', 'Pharmacology: half-life and dosage', 'Half-life of mRNA', 'Half-life of a hormone',
      // The game.
      'Half-Life: the video game', 'The Half-Life series', 'Half-Life Alyx', 'Half-Life and the history of video games', 'Half-Life: game design', 'Gordon Freeman in Half-Life',
      // Chemical kinetics.
      'Half-life of a first-order reaction', 'First order kinetics and half-life', 'Demonstrate that the half-life of a first-order reaction is constant', 'Rate equations and half-life', 'Orders of reaction from half-life', 'Half-life of a reactant',
      // Figures of speech, and other uses of each word.
      'The half-life of knowledge', 'The half-life of facts', 'Half-life of plastics in the ocean', 'Half-life of pesticides',
      'Half of a number', 'Halves and quarters', 'Life cycles', 'Half-time in football', 'Half term', 'Half and half', 'Life in a rock pool', 'Half-brothers', 'Half-lines',
      'Radio waves', 'Radio broadcasting', 'Radio signals and communication', 'Radio drama', 'Radiology', 'Radius and diameter', 'Radiation in the electromagnetic spectrum',
      'Tooth decay', 'Decay of leaves', 'Decomposers and decay', 'Urban decay', 'Orbital decay of satellites', 'Trace decay theories of forgetting', 'Memory decay', 'Bacteria and decay', 'Exponential growth and decay', 'Exponential graphs', 'Rate of decay of leaves in compost',
      'Interest rate', 'Heart rate', 'Birth rate', 'Counting in twos', 'Counters in maths', 'Carbon cycle', 'Carbon footprint', 'Dating and relationships', 'Dating rocks with index fossils',
      // Radioactivity it does not draw.
      'Radioactive decay: alpha, beta and gamma', 'Radioactivity: alpha, beta and gamma radiation', 'Penetrating power of radiation in radioactivity', 'Nuclear equations', 'Nuclear equations and radioactive decay series', 'Balancing decay equations', 'Alpha decay and beta decay in radioactive decay', 'Fission and fusion', 'Nuclear fission', 'Binding energy and mass defect', 'Atomic structure', 'Isotopes', 'Discovering radioactivity', 'Radioactivity all around us', 'Application of Radioactivity', 'Uses of radioactivity', 'Health hazards of radioactivity', 'Modern physics', 'Quantum physics', 'Wave and particle nature of light',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('a word too short to match can never rule out the whole topic', () => {
    // `words` drops anything under three letters, so a stray "half-life 2" would read as "half life" and refuse them all.
    const said = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'what', 'when', 'why', 'how', 'into', 'from', 'that', 'this', 'about', 'always'].includes(w)).join(' ')
    for (const n of engine.notFor!) {
      expect(['half life', 'half lives', 'radioactivity', 'radioactive decay'], n).not.toContain(said(n))
    }
    for (const ph of engine.phrases!) expect(said(ph).split(' ').length >= 2 || ['radioactivity', 'halflife', 'radioisotope', 'radioisotopes', 'radiocarbon'].includes(said(ph)), ph).toBe(true)
    expect(engine.covers.every((w) => !/half|life|radio|decay|carbon/i.test(w))).toBe(true)
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('half-life')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "half-life"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:half-life"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const word of ['wait', 'draw', 'nuclide', 'background', 'halves', 'Not drawn', 'Before marking', 'Do not use it for pharmacology']) expect(engine.prompt).toContain(word)
    expect(engine.prompt).toContain(`within ${BEAD_TOLERANCE} sixty-fourths`)
  })
})

describe('a still frame is a frame a learner sees', { timeout: 30_000 }, () => {
  type Box = { left: number; right: number; top: number; bottom: number }
  const box = (l: Label): Box => {
    const wide = textWidth(l.text)
    const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - wide : l.x - wide / 2
    return { left, right: left + wide, top: l.y - 11, bottom: l.y + 3 }
  }
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const LOOKS: HalfConfig[] = [
    wait(), wait({ measure: 'counts/min', start: 140, background: 20 }), wait({ measure: 'Bq', start: 4000 }), wait({ measure: 'counts/s', start: 800 }), draw(), draw({ measure: 'counts/min', start: 160 }),
    ...NUCLIDES.map((n) => wait({ nuclide: n.name, halfLife: n.halfLife, unit: n.unit })), ...NUCLIDES.map((n) => wait({ nuclide: n.name, halfLife: n.halfLife, unit: n.unit, measure: 'counts/min', start: 140, background: 20 })), ...NUCLIDES.map((n) => draw({ nuclide: n.name })),
    wait({ nuclide: 'isotope X' }), wait({ nuclide: 'an eighteen letters' .slice(0, 18) }),
  ]

  it('every label stays on the plate, and none touches another', () => {
    for (const c of LOOKS) {
      const boxes = labelsOf(c).map((l) => ({ l, b: box(l) }))
      boxes.forEach((a, i) => {
        expect(a.b.left, `${a.l.text} ${nameOf(c)}`).toBeGreaterThanOrEqual(6)
        expect(a.b.right, `${a.l.text} ${nameOf(c)}`).toBeLessThanOrEqual(W - 6)
        boxes.forEach((o, j) => { if (j > i) expect(hits(a.b, o.b), `${a.l.text} / ${o.l.text} ${nameOf(c)}`).toBe(false) })
      })
    }
  })

  it('every label sits nearer its own part than any other label’s', () => {
    for (const c of LOOKS) {
      const labels = labelsOf(c)
      for (const l of labels) {
        const b = box(l)
        const here = { x: (l.anchor === 'start' ? b.left : b.left), y: (b.top + b.bottom) / 2 }
        const mine = Math.hypot(here.x - l.part.x, here.y - l.part.y)
        for (const o of labels) if (o !== l) expect(mine, `${l.text} nearer ${o.text} in ${nameOf(c)}`).toBeLessThan(Math.hypot(here.x - o.part.x, here.y - o.part.y))
      }
    }
  })

  it('every nucleus fits the tray and keeps apart, at any sample size', () => {
    for (const n of [16, 17, 32, 40, 50, 63, 64]) {
      const cells = cellsOf(n)
      expect(cells).toHaveLength(n)
      expect(new Set(cells.map((c) => c.y)).size).toBeLessThanOrEqual(ROWS)
      for (const c of cells) {
        expect(c.x - CELL / 2, String(n)).toBeGreaterThanOrEqual(TRAY.x + 4)
        expect(c.x + CELL / 2, String(n)).toBeLessThanOrEqual(TRAY.x + TRAY.w - 4)
        expect(c.y - CELL / 2, String(n)).toBeGreaterThanOrEqual(TRAY.y + 4)
        expect(c.y + CELL / 2, String(n)).toBeLessThanOrEqual(TRAY.y + TRAY.h - 4)
      }
      cells.forEach((a, i) => cells.forEach((b, j) => { if (j > i) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(CELL) }))
    }
    // Each is at least 12 px across.
    expect(CELL).toBeGreaterThanOrEqual(16)
  })

  it('the counter never meets the curve', () => {
    // As drawn: the counter's left and lower edges, then the name under the tube. The curve must have fallen below each by the time it gets there.
    const yAt = (c: HalfConfig, x: number) => {
      const step = ((x - PX0_WAIT) / (PX1 - PX0_WAIT)) * STEP_TOTAL
      return PY1 - (amountAt(c, step) / c.start) * (PY1 - PY0)
    }
    for (const c of [wait({ measure: 'counts/min', start: 140, background: 20 }), wait({ measure: 'counts/min', start: 200, background: 50 }), wait({ measure: 'counts/min', start: 160 })]) {
      expect(yAt(c, 214), nameOf(c)).toBeGreaterThan(188 + 4)
      expect(yAt(c, 300), nameOf(c)).toBeGreaterThan(216 + 3)
    }
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    expect(STEP_TOTAL).toBe(MAX_STEP)
    expect(W).toBe(360)
    const html = renderToStaticMarkup(createElement(HalfLifeView, { config: draw(), state: engine.initial(draw()), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(html).toContain(`viewBox="0 0 ${W} ${H_DRAW}"`)
    expect(html).toContain(`aria-valuemax="${draw().start}"`)
    const w = renderToStaticMarkup(createElement(HalfLifeView, { config: wait(), state: engine.initial(wait()), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(w).toContain(`viewBox="0 0 ${W} ${H_WAIT}"`)
    expect(w).toContain(`aria-valuemax="${MAX_STEP}"`)
    expect(LEVELS).toBe(64)
    expect(DRAWN_MAX).toBe(64)
    expect(BEAD_HIT).toBeGreaterThanOrEqual(24)
    expect(PX0_DRAW).toBeGreaterThan(PX0_WAIT)
  })

  it('one smallest move changes the picture: a step early on sets off many, and the tail still moves the clock', () => {
    const s = sampleOf(64, 1)
    expect(stillWhole(s, 0) - stillWhole(s, 1)).toBeGreaterThanOrEqual(8)
    // The same length of sweep sets off half as many each half-life: this is the idea in the hand.
    const sweep = (k: number) => stillWhole(s, k) - stillWhole(s, k + 4)
    expect([sweep(0), sweep(4), sweep(8), sweep(12)]).toEqual([32, 16, 8, 4])
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'half-life', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: HalfConfig, state: HalfState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false, locked = marked === 'right') =>
    renderToStaticMarkup(createElement(HalfLifeView, { config: cfg, state, setState: () => {}, marked, reduced, locked }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')
  const countOf = (html: string, word: string) => [...html.matchAll(new RegExp(word, 'g'))].length
  const EXAMPLES: [HalfConfig, string][] = [
    [wait(), 'Drag the clock handle along the time line, or tap + and -, until half of the nuclei have gone.'],
    [wait({ left: 1 / 8, halfLife: 6, unit: 'hours', nuclide: 'technetium-99m' }), 'The half-life of technetium-99m is 6 hours. Drag the clock handle along the time line, or tap + and -, until only an eighth of the nuclei are left.'],
    [wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12 }), 'The dashed line is the background count. Drag the clock handle along the time line, or tap + and -, until half of the source\'s nuclei have decayed.'],
    [draw(), 'Before it runs, drag each bead up or down to show how many nuclei are left after that many half-lives.'],
  ]

  it('before marking, nothing says the answer, the rule or the half-life', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '').replace(prompt.replace(/'/g, '&#x27;'), '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'half of what', 'halves', 'halved', 'each bracket', 'halve', 'less than', 'more than', 'never falls', 'take it off', 'curves']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
      if (cfg.task === 'wait') {
        expect(shown, nameOf(cfg)).not.toContain('half-li')
        expect(html, nameOf(cfg)).not.toContain('data-reading')
        expect(html, nameOf(cfg)).not.toContain('data-bracket')
      } else {
        // The beads say nothing but where they are: all at the start.
        const row = [...html.matchAll(/data-value="\d"[^>]*>([^<]+)</g)].map((m) => m[1])
        expect(row).toEqual(['64', '64', '64', '64', '64'])
        expect(html).not.toContain('data-curve')
      }
    }
  })

  it('the half-life is never a mark on the axis, and a state before marking prints no half-life', () => {
    const c = wait({ left: 1 / 8, halfLife: 8 })
    const html = raw(c, { k: 7 }, 'idle')
    expect(text(html)).not.toContain('half-li')
    expect(text(html)).toContain('14 min')
    expect(text(html)).toContain('19')
    for (const m of [10, 20, 30, 40]) expect(text(html)).toContain(String(m))
  })

  it('names what it draws, on the card, before marking', () => {
    const n = text(raw(wait(), { k: 0 }, 'idle'))
    for (const name of ['not yet decayed', 'decayed', 'nuclei left', 'time (minutes)', 'Time', 'Nuclei left', 'New sample']) expect(n).toContain(name)
    const b = text(raw(wait({ measure: 'counts/min', start: 140, background: 20 }), { k: 0 }, 'idle'))
    for (const name of ['GM tube', 'counts/min', 'background 20', 'Count rate', 'not yet decayed']) expect(b).toContain(name)
    const d = text(raw(draw(), engine.initial(draw()), 'idle'))
    for (const name of ['nuclei left', 'half-lives', 'left', 'not yet decayed', 'decayed']) expect(d).toContain(name)
    // A GM tube reads a count. Activity has no counter drawn, because none on a bench reads it directly.
    const a = text(raw(wait({ measure: 'Bq', start: 4000 }), { k: 0 }, 'idle'))
    for (const name of ['activity (Bq)', 'Activity', '4,000 Bq']) expect(a).toContain(name)
    expect(a).not.toContain('GM tube')
    expect(raw(wait({ measure: 'Bq', start: 4000 }), { k: 0 }, 'idle')).not.toContain('data-counter')
    expect(raw(wait({ measure: 'counts/s', start: 800 }), { k: 0 }, 'idle')).toContain('data-counter')
    expect(raw(draw({ measure: 'counts/min', start: 800 }), {}, 'idle')).not.toContain('data-counter')
    expect(isCount('Bq')).toBe(false)
    const named = text(raw(wait({ nuclide: 'carbon-14', halfLife: 5730, unit: 'years' }), { k: 0 }, 'idle'))
    for (const name of ['carbon-14', 'nitrogen-14', 'time (years)']) expect(named).toContain(name)
  })

  it('each move changes the picture, in a still frame too, with nothing animating under reduced motion', () => {
    const c = wait()
    const first = raw(c, { k: 0 }, 'idle', true)
    expect(first).not.toMatch(/transition:\s*[a-z]/)
    for (let k = 1; k <= MAX_STEP; k++) {
      const html = raw(c, { k }, 'idle', true)
      expect(html, String(k)).not.toBe(raw(c, { k: k - 1 }, 'idle', true))
      expect(countOf(html, 'data-nucleus="whole"') - 1, String(k)).toBe(leftAtStep(64, k)) // less the one in the legend
      expect(html).not.toMatch(/transition:\s*[a-z]/)
    }
    const d = draw()
    const start = raw(d, engine.initial(d), 'idle', true)
    expect(start).not.toMatch(/transition:\s*[a-z]/)
    for (let i = 0; i < 4; i++) {
      const levels = [64, 64, 64, 64]
      levels[i] = 63
      expect(raw(d, { levels, at: i }, 'idle', true), String(i)).not.toBe(start)
    }
    // The tray follows the bead moved last.
    expect(countOf(raw(d, { levels: [32, 64, 64, 64], at: 0 }, 'idle', true), 'data-nucleus="whole"') - 1).toBe(32)
    expect(countOf(raw(d, { levels: [32, 16, 64, 64], at: 1 }, 'idle', true), 'data-nucleus="whole"') - 1).toBe(16)
    expect(raw(c, { k: 3 }, 'idle', false)).toMatch(/transition:opacity 240ms/)
  })

  it('marking gives the time and the why, and draws how to read it', () => {
    const c = wait({ left: 1 / 8 })
    const right = raw(c, { k: 12 }, 'right')
    expect(text(right)).toContain('24 minutes')
    expect(countOf(right, 'data-bracket=')).toBe(3)
    expect(countOf(right, 'data-reading=')).toBe(3)
    expect(text(right)).toContain('each bracket is one half-life')
    expect(right).not.toContain('data-thumb')
    const wrong = raw(c, { k: 7 }, 'wrong')
    expect(text(wrong)).toContain('more than an eighth')
    expect(wrong).toContain('data-thumb')
    expect(wrong).not.toContain('data-bracket')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const c = wait({ left: 1 / 4 })
    const html = raw(c, { k: 1 }, 'shown', true)
    expect(html).toContain('data-time="8"')
    expect(text(html)).toContain('16 minutes')
    expect(countOf(html, 'data-bracket=')).toBe(2)
    const d = raw(draw(), engine.initial(draw()), 'shown', true)
    for (const v of [32, 16, 8, 4]) expect(text(d)).toContain(String(v))
    expect(d).toContain('data-curve')
    expect(text(d)).toContain('Yes. 32, 16, 8 and 4.')
  })

  it('a wrong bead is ringed once marked, and only then', () => {
    const d = draw()
    const levels = [32, 24, 8, 4]
    expect(countOf(raw(d, { levels, at: 1 }, 'wrong'), 'data-wrong="1"')).toBe(1)
    expect(countOf(raw(d, { levels, at: 1 }, 'idle'), 'data-wrong="1"')).toBe(0)
  })

  it('every control is a real button with its own label, and locks when solved', () => {
    const c = wait()
    const idle = raw(c, { k: 0 }, 'idle')
    const labels = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
    expect(labels.map((m) => m[1])).toEqual(['The clock. Drag it along the time line, or use the arrow keys', 'Wind the clock back', 'Wind the clock on', 'Draw a new sample of the same nuclei'])
    for (const m of labels) expect(m[0], m[1]).toContain('type="button"')
    expect(idle).toContain('role="slider"')
    expect(idle).toContain('touch-none')
    expect(idle).toContain('nodrag')
    // Nothing on the slider's text gives away the half-life.
    expect(idle).toContain('aria-valuetext="0 minutes"')
    const solved = raw(c, { k: 4 }, 'right')
    expect(solved).not.toContain('role="slider"')
    expect(solved).not.toContain('data-scrub')
    expect(solved).toMatch(/aria-label="Wind the clock on"[^>]*disabled|disabled[^>]*aria-label="Wind the clock on"/)
    // New sample is still there to look with: which went is not what was marked.
    expect(solved).toContain('New sample')
    const d = raw(draw(), engine.initial(draw()), 'idle')
    const beads = [...d.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
    expect(beads).toHaveLength(4)
    expect(new Set(beads.map((m) => m[1])).size).toBe(4)
    for (const m of beads) {
      expect(m[0]).toContain('role="slider"')
      expect(m[0]).toContain('aria-orientation="vertical"')
    }
    const dRight = raw(draw(), engine.solve(draw()), 'right')
    expect(dRight).not.toContain('role="slider"')
    expect(madeLevels(draw(), engine.solve(draw()))).toEqual([32, 16, 8, 4])
    expect(madeStep(engine.solve(wait()))).toBe(4)
  })

  it('keyboard help is for keyboard users', () => {
    const html = raw(wait(), { k: 0 }, 'idle')
    expect(html).toContain('[&amp;:has(button:focus-visible)_.hl-kbd]:block')
    expect(html).toMatch(/hl-kbd hidden/)
  })

  it('tells a screen reader what is there, never what it should be', () => {
    const html = raw(wait({ left: 1 / 8 }), { k: 7 }, 'idle')
    expect(text(html)).toContain('Time 14 minutes. 19 of 64 nuclei left.')
    expect(attrs(html)).not.toMatch(/half-li|eighth/)
    const bg = raw(wait({ measure: 'counts/min', start: 140, background: 20, halfLife: 12 }), { k: 5 }, 'idle')
    expect(text(bg)).toContain('The counter reads 70.')
    expect(attrs(bg)).toContain('background of 20')
    const d = raw(draw(), { levels: [32, 24, 8, 4], at: 0 }, 'idle')
    expect(text(d)).toContain('Your beads say 32 after 1, 24 after 2, 8 after 3, 4 after 4.')
  })

  it('no text under 12 px, only flat colour, and buttons that will not wrap', () => {
    for (const [cfg] of EXAMPLES) for (const marked of ['idle', 'right', 'wrong', 'shown'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow|capitalize/)
    }
    expect(raw(wait(), { k: 0 }, 'idle')).toMatch(/whitespace-nowrap[^"]*"[^>]*>New sample|New sample/)
  })

  it('a sample too big to draw says what each one stands for', () => {
    expect(text(raw(wait({ start: 6400 }), { k: 4 }, 'idle'))).toContain('Each nucleus drawn stands for many of the 6,400.')
    expect(text(raw(wait({ start: 6400 }), { k: 4 }, 'idle'))).toContain('3,200')
    expect(countOf(raw(wait({ start: 6400 }), { k: 0 }, 'idle'), 'data-nucleus=') - 2).toBe(64)
    expect(countOf(raw(wait({ start: 32 }), { k: 0 }, 'idle'), 'data-nucleus=') - 2).toBe(32)
    expect(PY0).toBeLessThan(PY1)
  })
})
