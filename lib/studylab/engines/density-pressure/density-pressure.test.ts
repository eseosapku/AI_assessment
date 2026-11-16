// lib/studylab/engines/density-pressure/density-pressure.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  densityPressureEngine as engine, BLOCKS, BLOCK_NAMES, BRICK, DENT_PER_KPA, DIVE_DEPTH, DIVE_LIQUIDS, FACES, LIQUIDS, LIQUID_NAMES, MAX_BRICKS, MIN_FREEBOARD, RAFT, TANK, TARGETS, UNITS,
  bricksOf, depthOf, diveAnswer, done, faceOf, freeboard, loadFrame, loadPlan, madeText, pressAnswer, pressureOf, reading, validReferences, weightUnit, weightsOf, working,
  type DPConfig, type DPState,
} from './config'
import { BOX, DENT, DensityPressureView, H, PX_DIVE, PX_LOAD, PX_PRESS, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

type Load = Extract<DPConfig, { task: 'load' }>
type Press = Extract<DPConfig, { task: 'press' }>
type Dive = Extract<DPConfig, { task: 'dive' }>

const LOADS: Load[] = BLOCK_NAMES.flatMap((block) => LIQUID_NAMES.map((liquid) => ({ task: 'load' as const, block, liquid }))).filter((c) => loadPlan(c) !== null)
const PRESSES: Press[] = TARGETS.map((target) => ({ task: 'press' as const, target }))
const DIVES: Dive[] = DIVE_LIQUIDS.flatMap((liquid) => validReferences(liquid).map((reference) => ({ task: 'dive' as const, liquid, reference })))
const ALL: DPConfig[] = [...LOADS, ...PRESSES, ...DIVES]
const nameOf = (c: DPConfig) => JSON.stringify(c)
const rhoOf = (liquid: string) => LIQUIDS[liquid as 'brine' | 'paraffin'].rho

/** Every state a learner can reach. */
function everyState(c: DPConfig): DPState[] {
  if (c.task === 'load') return Array.from({ length: loadPlan(c)!.most + 3 }, (_, weights) => ({ weights }))
  if (c.task === 'press') return FACES.flatMap((_, face) => Array.from({ length: MAX_BRICKS }, (__, i) => ({ face, bricks: i + 1 })))
  return Array.from({ length: DIVE_DEPTH + 1 }, (_, depth) => ({ depth }))
}

describe('floating, from first principles', () => {
  it('the block is 1000 cm3, so its mass in grams is its density in kg/m3', () => {
    expect(RAFT.w * RAFT.d * RAFT.h).toBe(1000)
    expect(BLOCKS.pine.rho).toBe(500)
    expect(LIQUIDS.water.rho).toBe(1000)
  })

  it('floating, it pushes aside its own mass of liquid, and sinks by that depth', () => {
    const plan = loadPlan({ block: 'pine', liquid: 'water' })!
    expect(plan).toEqual({ mass: 500, liquid: 1000, unit: 150, most: 3 })
    const empty = loadFrame(plan, 0)
    expect(empty.sunk).toBeCloseTo(2.5, 9)
    expect(empty.level).toBeCloseTo(12 + 500 / 420, 9)
    expect(empty.bottom).toBeCloseTo(empty.level - 2.5, 9)
  })

  it('goes under exactly when the load passes what its volume can push aside', () => {
    for (const c of LOADS) {
      const plan = loadPlan(c)!
      for (let n = 0; n <= plan.most + 2; n++) {
        const f = loadFrame(plan, n)
        expect(f.floats, `${nameOf(c)} ${n}`).toBe(plan.mass + n * plan.unit <= plan.liquid)
        expect(f.floats, `${nameOf(c)} ${n}`).toBe(n <= plan.most)
      }
    }
  })

  it('each weight lowers the block and raises the tank, until it sinks and the tank holds its level', () => {
    for (const c of LOADS) {
      const plan = loadPlan(c)!
      for (let n = 0; n < plan.most; n++) {
        const a = loadFrame(plan, n)
        const b = loadFrame(plan, n + 1)
        expect(b.sunk, nameOf(c)).toBeGreaterThan(a.sunk)
        expect(b.level, nameOf(c)).toBeGreaterThan(a.level)
      }
      const last = loadFrame(plan, plan.most)
      const under = loadFrame(plan, plan.most + 1)
      expect(under.bottom).toBe(0)
      expect(under.level).toBeCloseTo(12 + 1000 / 420, 9)
      expect(last.level).toBeLessThanOrEqual(under.level + 1e-9)
      expect(last.bottom).toBeGreaterThan(0)
    }
  })

  it('the block never dips below the floor and the tank never reaches the rim', () => {
    for (const c of LOADS) {
      const plan = loadPlan(c)!
      for (let n = 0; n <= plan.most + 2; n++) {
        const f = loadFrame(plan, n)
        expect(f.bottom).toBeGreaterThanOrEqual(0)
        expect(f.level).toBeLessThan(TANK.rim)
      }
    }
  })

  it('every playable block has room for 3 to 6 weights, a clear margin, and enough freeboard to see', () => {
    expect(LOADS.length).toBe(17)
    for (const c of LOADS) {
      const plan = loadPlan(c)!
      expect(plan.most, nameOf(c)).toBeGreaterThanOrEqual(3)
      expect(plan.most, nameOf(c)).toBeLessThanOrEqual(6)
      const rest = (plan.liquid - plan.mass - plan.most * plan.unit) / plan.unit
      expect(rest, nameOf(c)).toBeGreaterThanOrEqual(0.15)
      expect(rest, nameOf(c)).toBeLessThanOrEqual(0.85)
      expect(freeboard(plan.mass, plan.liquid)).toBeGreaterThanOrEqual(MIN_FREEBOARD)
      expect(UNITS).toContain(plan.unit)
      // The waterline moves up the block, with each weight, by something a person sees.
      expect(((RAFT.h * plan.unit) / plan.liquid) * PX_LOAD, nameOf(c)).toBeGreaterThanOrEqual(1.5)
    }
    expect(weightUnit(1)).toBeNull()
  })

  it('a heavy block can float and a light one cannot carry as much: oak carries less than pine, steel and ice-in-water are refused', () => {
    const carry = (block: string) => {
      const p = loadPlan({ block, liquid: 'water' })!
      return p.most * p.unit
    }
    expect(carry('oak')).toBeLessThan(carry('pine'))
    expect(loadPlan({ block: 'steel', liquid: 'water' })).toBeNull()
    expect(loadPlan({ block: 'ice', liquid: 'water' })).toBeNull()
    expect(loadPlan({ block: 'pine', liquid: 'mercury' })).toBeNull()
  })
})

describe('pressure in a solid, from first principles', () => {
  it('a brick is 2 kg: 20 N, on a face of 200, 100 or 50 cm2, so 1, 2 or 4 kPa', () => {
    expect(BRICK.l * BRICK.w * BRICK.h).toBe(1000)
    expect(BRICK.newtons).toBe(BRICK.kg * 10)
    expect(FACES.map((f) => f.area)).toEqual([200, 100, 50])
    for (const f of FACES) {
      expect(f.wide * f.deep).toBe(f.area)
      expect(f.wide * f.deep * f.high).toBe(1000)
    }
    expect([0, 1, 2].map((face) => pressureOf({ face, bricks: 1 }))).toEqual([1, 2, 4])
    expect(pressureOf({ face: 2, bricks: 2 })).toBe(8)
  })

  it('the answer is the fewest bricks, and unique', () => {
    expect(TARGETS).toEqual([1, 2, 4, 8])
    expect(pressAnswer(1)).toEqual({ face: 0, bricks: 1 })
    expect(pressAnswer(2)).toEqual({ face: 1, bricks: 1 })
    expect(pressAnswer(4)).toEqual({ face: 2, bricks: 1 })
    expect(pressAnswer(8)).toEqual({ face: 2, bricks: 2 })
    expect(pressAnswer(3)).toBeNull()
    for (const t of TARGETS) {
      const best = pressAnswer(t)!
      const same = everyState({ task: 'press', target: t }).filter((s) => pressureOf(s) === t)
      expect(Math.min(...same.map((s) => bricksOf(s)))).toBe(best.bricks)
      expect(same.filter((s) => bricksOf(s) === best.bricks)).toHaveLength(1)
    }
  })

  it('the scale reads the mass whatever the face: the weight does not change, the pressure does', () => {
    for (const face of [0, 1, 2]) {
      const html = renderToStaticMarkup(createElement(DensityPressureView, { config: PRESSES[2], state: { face, bricks: 2 }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
      expect(html).toContain('4.0 kg')
    }
  })

  it('a brick stack stays on the panel at every state, with its labels, and the dent stays inside the foam', () => {
    for (const s of everyState(PRESSES[0])) {
      const f = FACES[faceOf(s)]
      const top = 212 + DENT * pressureOf(s) - bricksOf(s) * f.high * PX_PRESS
      expect(top - 11 - 12, JSON.stringify(s)).toBeGreaterThan(BOX.press.y)
      expect(DENT * pressureOf(s)).toBeLessThan(50)
      expect(f.wide * PX_PRESS + 20).toBeLessThan(180)
    }
  })
})

describe('pressure in a liquid, from first principles', () => {
  it('p = rho g h, gauge, in kPa', () => {
    expect(reading(1000, 18)).toBeCloseTo(1.8, 12)
    expect(reading(1200, 15)).toBeCloseTo(1.8, 12)
    expect(reading(800, 20)).toBeCloseTo(1.6, 12)
    expect(reading(1200, 32)).toBeLessThan(4)
    expect(reading(800, 0)).toBe(0)
  })

  it('the same reading comes at a depth in inverse proportion to the density, in whole centimetres only', () => {
    expect(diveAnswer('brine', 18)).toBe(15)
    expect(diveAnswer('paraffin', 16)).toBe(20)
    expect(diveAnswer('brine', 17)).toBeNull()
    expect(diveAnswer('water', 18)).toBeNull()
    expect(validReferences('brine')).toEqual([6, 12, 18, 24, 30, 36])
    expect(validReferences('paraffin')).toEqual([4, 8, 12, 16, 20, 24])
    for (const c of DIVES) {
      const d = diveAnswer(c.liquid, c.reference)!
      expect(reading(rhoOf(c.liquid), d)).toBeCloseTo(reading(1000, c.reference), 12)
      expect(d).toBeLessThanOrEqual(DIVE_DEPTH)
    }
  })

  it('the needle and the marker stay on the dial at every depth', () => {
    for (const c of DIVES) {
      expect(reading(rhoOf(c.liquid), DIVE_DEPTH)).toBeLessThanOrEqual(4)
      expect(reading(1000, c.reference)).toBeLessThanOrEqual(4)
      expect(reading(1000, c.reference)).toBeGreaterThan(0.2)
    }
    expect(PX_DIVE * DIVE_DEPTH).toBeLessThan(130)
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
    expect(ALL.length).toBe(17 + 4 + 12)
  })

  it('marks exactly by the rule, over every state the learner can reach, with one right answer', () => {
    for (const c of ALL) {
      let right = 0
      for (const s of everyState(c)) {
        let should = false
        if (c.task === 'load') should = weightsOf(s, loadPlan(c)!.most) === loadPlan(c)!.most
        else if (c.task === 'press') should = pressureOf(s) === c.target && bricksOf(s) === pressAnswer(c.target)!.bricks
        else should = depthOf(s) * rhoOf(c.liquid) === c.reference * 1000
        expect(engine.check(c, s).ok, `${nameOf(c)} ${JSON.stringify(s)}`).toBe(should)
        if (should) right++
      }
      expect(right, nameOf(c)).toBe(1)
    }
  })

  it('an initial state is never the answer, for any target', () => {
    for (const c of PRESSES) expect(done(c, engine.initial(c))).toBe(false)
    expect(engine.initial({ task: 'press', target: 1 })).toEqual({ face: 2, bricks: 1 })
    expect(engine.initial({ task: 'press', target: 4 })).toEqual({ face: 0, bricks: 1 })
  })

  it('refuses a state that could not have been made', () => {
    const c: Load = { task: 'load', block: 'pine', liquid: 'water' }
    expect(engine.check(c, {}).ok).toBe(false)
    expect(engine.check(c, { weights: 99 }).ok).toBe(false)
    expect(engine.check(c, { weights: 3.5 }).ok).toBe(false)
    expect(engine.check(c, { weights: '3' as never }).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check({ task: 'dive', liquid: 'brine', reference: 18 }, { depth: 15.2 }).ok).toBe(false)
    expect(engine.check({ task: 'press', target: 4 }, { face: 7, bricks: 9 }).ok).toBe(false)
  })

  it('says something true when marked, and what was made when wrong', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      // The bold first sentence must not stop at a decimal point.
      expect(said.match(/^(Yes\. [^.]*\.)/)![1], nameOf(c)).not.toMatch(/\d\.$/)
      const made = madeText(c, engine.initial(c))
      expect(made.startsWith('Yes.'), nameOf(c)).toBe(false)
    }
    expect(working({ task: 'load', block: 'pine', liquid: 'water' }, { weights: 3 })).toMatch(/3 weights is the most, 950 g in all/)
    expect(working({ task: 'dive', liquid: 'brine', reference: 18 }, { depth: 15 })).toMatch(/15 cm in brine reads 1\.8 kPa/)
    expect(working({ task: 'press', target: 4 }, { face: 2, bricks: 1 })).toMatch(/1 brick on the 10 × 5 cm face is 4 kPa/)
    const l: Load = { task: 'load', block: 'pine', liquid: 'water' }
    expect(madeText(l, { weights: 1 })).toMatch(/still floats with room to spare/)
    expect(madeText(l, { weights: 4 })).toMatch(/has sunk/)
    expect(madeText(l, {})).toMatch(/Nothing is on the pine block yet/)
    expect(madeText({ task: 'press', target: 2 }, { face: 0, bricks: 2 })).toMatch(/reaches the line, but with 2 bricks/)
    expect(madeText({ task: 'press', target: 8 }, { face: 0, bricks: 1 })).toMatch(/does not reach/)
    expect(madeText({ task: 'press', target: 1 }, { face: 2, bricks: 1 })).toMatch(/goes past/)
    expect(madeText({ task: 'dive', liquid: 'brine', reference: 18 }, { depth: 12 })).toMatch(/1\.44 kPa/)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'load', block: 'Pine wood', liquid: 'Water' })).toEqual({ task: 'load', block: 'pine', liquid: 'water' })
    expect(engine.parse({ task: 'floating and sinking', block: 'a wooden block', liquid: 'salt water' })).toEqual({ task: 'load', block: 'pine', liquid: 'sea water' })
    expect(engine.parse({ block: 'Ice cube', liquid: 'saturated brine' })).toEqual({ task: 'load', block: 'ice', liquid: 'brine' })
    expect(engine.parse({ task: 'buoyancy', block: 'plastic', liquid: 'kerosene' })).toEqual({ task: 'load', block: 'polythene', liquid: 'paraffin' })
    expect(engine.parse({ task: 'load' })).toEqual({ task: 'load', block: 'pine', liquid: 'water' })
    expect(engine.parse({ task: 'pressure in solids', target: '4 kPa' })).toEqual({ task: 'press', target: 4 })
    expect(engine.parse({ task: 'press' })).toEqual({ task: 'press', target: 4 })
    expect(engine.parse({ target: 2 })).toEqual({ task: 'press', target: 2 })
    expect(engine.parse({ task: 'dive', liquid: 'Brine', reference: '18 cm' })).toEqual({ task: 'dive', liquid: 'brine', reference: 18 })
    expect(engine.parse({ task: 'liquid pressure', liquid: 'paraffin oil' })).toEqual({ task: 'dive', liquid: 'paraffin', reference: 16 })
    expect(engine.parse({ liquid: 'brine' })).toEqual({ task: 'dive', liquid: 'brine', reference: 18 })
    expect(engine.parse({ task: { kind: 'press', target: 8 } })).toEqual({ task: 'press', target: 8 })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('pine')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'press', target: 'lots' })).toBeNull()
    expect(engine.parse({ task: 'load', block: 5 })).toBeNull()
    expect(engine.parse({ task: 'dive', liquid: {} })).toBeNull()
    expect(engine.parse({ task: 'dive', reference: 'deep' })).toBeNull()
    // Unknown or out of range still parses: faults says what would work.
    expect(engine.parse({ task: 'load', block: 'steel' })).not.toBeNull()
    expect(engine.parse({ task: 'load', block: 'pine', liquid: 'mercury' })).not.toBeNull()
    expect(engine.parse({ task: 'press', target: 3 })).not.toBeNull()
    expect(engine.parse({ task: 'dive', liquid: 'water' })).not.toBeNull()
    expect(engine.parse({ task: 'dive', liquid: 'brine', reference: 17 })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, naming the limit and a nearby example that works', () => {
    const fixOf = (c: DPConfig, said: string): DPConfig => {
      const b = said.match(/e\.g\. block "(\w+)"/)
      if (b) return { ...(c as Load), block: b[1] }
      const l = said.match(/e\.g\. liquid "([\w ]+)"/)
      if (l) return { ...c, liquid: l[1] } as DPConfig
      const t = said.match(/e\.g\. target (\d+)/)
      if (t) return { ...c, target: Number(t[1]) } as DPConfig
      const r = said.match(/e\.g\. reference (\d+)/)
      expect(r, said).not.toBeNull()
      return { ...c, reference: Number(r![1]) } as DPConfig
    }
    const cases: [DPConfig, RegExp][] = [
      [{ task: 'load', block: 'steel', liquid: 'water' }, /denser than every liquid/],
      [{ task: 'load', block: 'granite', liquid: 'water' }, /so it sinks/],
      [{ task: 'load', block: 'cheese', liquid: 'water' }, /balsa, cork, pine, oak, ice, polythene/],
      [{ task: 'load', block: '__proto__', liquid: 'water' }, /balsa, cork/],
      [{ task: 'load', block: 'pine', liquid: 'mercury' }, /water, sea water, brine, paraffin/],
      [{ task: 'load', block: 'ice', liquid: 'water' }, /floats too low in water to load \(only 8%/],
      [{ task: 'load', block: 'polythene', liquid: 'sea water' }, /too low/],
      [{ task: 'load', block: 'oak', liquid: 'paraffin' }, /too low/],
      [{ task: 'load', block: 'ice', liquid: 'paraffin' }, /sinks in paraffin/],
      [{ task: 'press', target: 3 }, /1, 2, 4 or 8/],
      [{ task: 'press', target: 16 }, /1, 2, 4 or 8/],
      [{ task: 'press', target: 0 }, /1, 2, 4 or 8/],
      [{ task: 'dive', liquid: 'water', reference: 18 }, /reference the marker is set in/],
      [{ task: 'dive', liquid: 'mercury', reference: 18 }, /paraffin or brine/],
      [{ task: 'dive', liquid: 'brine', reference: 17 }, /multiple of 6 from 6 to 36/],
      [{ task: 'dive', liquid: 'paraffin', reference: 30 }, /multiple of 4 from 4 to 24/],
      [{ task: 'dive', liquid: 'brine', reference: 2.5 }, /multiple of 6/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f.length, nameOf(c)).toBeGreaterThanOrEqual(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(c, f[0])
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
    }
    // Nothing a refused config can do crashes the rest of the engine.
    for (const [c] of cases) {
      expect(() => engine.check(c, engine.initial(c))).not.toThrow()
      expect(() => renderToStaticMarkup(createElement(DensityPressureView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'wrong', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: DPConfig, p: string) => engine.promptFaults!(c, p)
  const load: Load = { task: 'load', block: 'pine', liquid: 'water' }
  const press: Press = { task: 'press', target: 4 }
  const dive: Dive = { task: 'dive', liquid: 'brine', reference: 18 }

  it('asking for the outcome and the gesture is fine, naming the material included', () => {
    expect(pf(load, 'Tap + to stack weights on the pine block, and − to take one off. Load it with as many weights as it can carry and still float.')).toEqual([])
    expect(pf(load, 'Here is a block of pine floating in water. How many weights can it carry before it sinks? Tap + and − to find out.')).toEqual([])
    expect(pf(press, 'Tap the arrows to turn the brick onto another face, and + or − to add or take away a brick. Press the foam in to the dashed line, using as few bricks as you can.')).toEqual([])
    expect(pf(dive, 'Tap + to lower the capsule into the brine. In water the needle stopped at the orange tab: lower the capsule until the needle reaches it here.')).toEqual([])
    expect(pf(dive, 'In water the gauge read 1.8 kPa at 18 cm. Lower the capsule into the brine until it reads the same.')).toEqual([])
  })

  it('how many, which face, how deep, or why, is not', () => {
    for (const p of ['Stack 3 weights on it.', 'It can carry three weights.', 'Load it up to 950 g.', 'It floats while its density is less than the water.', 'Watch it displace its own weight of water.', 'A block that is less dense than water floats.']) {
      expect(pf(load, p), p).toHaveLength(1)
    }
    for (const p of ['Make 4 kPa.', 'Use one brick.', 'Stand it on its smallest face.', 'Put it on its end.', 'A smaller area means more pressure.', 'Halve the area to double the pressure.', 'Pressure is force ÷ area, so turn it.', 'Lay it flat.']) {
      expect(pf(press, p), p).toHaveLength(1)
    }
    for (const p of ['Lower it to 15 cm.', 'You will need to go shallower than in water.', 'Brine is denser, so it reads more at the same depth.', 'Use p = ρgh.']) {
      expect(pf(dive, p), p).toHaveLength(1)
    }
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Drag the block into the water.', 'Pour in more water.', 'Change the liquid to oil.', 'Find the pressure of the air.', 'Explain how a ship floats in the sea.', 'Compare the blood pressure.', 'Change the temperature.']) {
      const f = pf(load, p)
      expect(f.length, p).toBeGreaterThanOrEqual(1)
      expect(f.join(' '), p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    const quoted = (c: DPConfig) => pf(c, 'Stack 3 weights, use one brick, go to 15 cm, and drag it.')[0].match(/\("([^"]+)"\)/)![1]
    for (const c of ALL) {
      const fix = quoted(c)
      expect(pf(c, fix), nameOf(c)).toEqual([])
      if (c.task === 'load') expect(fix).toContain(`the ${c.block} block`)
      if (c.task === 'press') expect(fix).toMatch(/arrows/)
      if (c.task === 'dive') expect(fix).toContain(`into the ${c.liquid}`)
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"density-pressure", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['load', 'press', 'dive']))
  })

  it('the numbers in its catalogue entry are the numbers it marks to', () => {
    const p = loadPlan({ block: 'pine', liquid: 'water' })!
    expect(engine.prompt).toContain(`pine in water: ${p.most} weights of ${p.unit} g`)
    expect(engine.prompt).toContain(`brine, 18 cm in water: ${diveAnswer('brine', 18)} cm`)
    expect(engine.prompt).toContain('a multiple of 4 in paraffin (4 to 24) or of 6 in brine (6 to 36)')
    expect(engine.prompt).toContain('(4 kPa: one brick on its smallest face; 8 kPa: two on it)')
    expect(engine.prompt).toContain('1, 2, 4 or 8')
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "density-pressure"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'density-pressure')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Density', 'Density and pressure', 'Density and Pressure in Solids and Fluids', 'Measuring density', 'Density of materials', 'Mass, volume and density', 'Relative density', 'Floating and sinking', 'Why do ships float?', 'Sink or float',
      'Buoyancy', 'Upthrust', 'Upthrust and floating', 'Archimedes’ principle and flotation', 'Pressure in liquids', 'Pressure in solids', 'Pressure in solids and liquids', 'Liquid pressure', 'Water pressure and depth', 'Hydrostatic pressure',
      'Pressure and depth', 'Force, area and pressure', 'Pressure and area', 'Calculating pressure', 'Chapter 4: Density and pressure',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Population density', 'Population density and distribution', 'Urban density', 'Optical density', 'Charge density', 'Probability density functions', 'Frequency density and histograms', 'Bone density and health', 'Density-dependent factors', 'Magnetic flux density', 'Stocking density in farming', 'Gas density',
      'Gas pressure', 'Pressure and volume of a gas', 'Gas laws', 'Blood pressure', 'Blood pressure and the heart', 'Peer pressure', 'Exam stress and pressure', 'Pressure groups', 'Pressure cookers', 'Atmospheric pressure', 'High pressure and low pressure systems', 'Vapour pressure', 'Osmotic pressure', 'Partial pressure', 'The effect of pressure on equilibrium', 'Selection pressure', 'Tyre pressure',
      'Sinking fund', 'Floating exchange rates', 'Floating point numbers', 'Share flotation', 'Hydrostatic equilibrium in stars', 'Hydraulic systems', 'Hydraulic brakes', 'Barometers', 'Boyle’s law', 'The particle model', 'Moments', 'Forces and motion', 'Food chains', 'Pressure sores', 'Surface tension', 'Sea level rise',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('density-pressure')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "density-pressure"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:density-pressure"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const n of [...BLOCK_NAMES, ...LIQUID_NAMES]) expect(engine.prompt).toContain(n)
    expect(engine.prompt).toMatch(/gas pressure \(use the particles scene\)/)
  })
})

describe('a still frame is a frame a learner sees', { timeout: 30_000 }, () => {
  const html = (c: DPConfig, s: DPState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle') =>
    renderToStaticMarkup(createElement(DensityPressureView, { config: c, state: s, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))
  const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  it('the stack of weights stays inside the panel, and the block between the glass walls, at every state', () => {
    for (const c of LOADS) {
      const plan = loadPlan(c)!
      for (let n = 0; n <= plan.most + 2; n++) {
        const f = loadFrame(plan, n)
        const bodyTop = 272 - PX_LOAD * f.bottom - RAFT.h * PX_LOAD
        expect(bodyTop - 6 * n, `${nameOf(c)} ${n}`).toBeGreaterThan(BOX.load.y + 4)
      }
    }
    expect(138 - (RAFT.w * PX_LOAD) / 2).toBeGreaterThan(30)
    expect(138 + (RAFT.w * PX_LOAD) / 2).toBeLessThan(246)
  })

  it('the liquid name stays clear of the weights tray, whatever the level, and fits beside the tank', () => {
    for (const c of LOADS) {
      const plan = loadPlan(c)!
      for (let n = 0; n <= plan.most + 2; n++) {
        const f = loadFrame(plan, n)
        const waterBottom = 272 - PX_LOAD * f.level + 4 + 4
        const tray = Math.max(0, plan.most + 2 - n)
        const trayLabelTop = 276 - 6 * tray - 22 - 10
        expect(waterBottom, `${nameOf(c)} ${n}`).toBeLessThan(trayLabelTop)
      }
      expect(258 + c.liquid.length * 6.6, c.liquid).toBeLessThan(W)
    }
  })

  it('the dive picture keeps the capsule inside the tank at every depth, and its labels beside what they name', () => {
    const h = html(DIVES[0], { depth: 10 })
    for (const name of ['0 cm', '10 cm', '20 cm', '30 cm', 'capsule', 'paraffin', 'kPa']) expect(text(h), name).toContain(name)
    for (const d of [0, 10, 20, DIVE_DEPTH]) expect(146 + PX_DIVE * d + 8.5, String(d)).toBeLessThan(276)
  })

  it('no more than about eight short labels around the apparatus, and every kind of thing named', () => {
    const count = (h: string) => [...h.matchAll(/<text /g)].length
    const loadHtml = html({ task: 'load', block: 'pine', liquid: 'water' }, { weights: 1 })
    expect(text(loadHtml)).toMatch(/pine 500 g.*water.*weights.*150 g each/)
    expect(count(loadHtml)).toBeLessThanOrEqual(8)
    const pressHtml = html(PRESSES[2], { face: 0, bricks: 1 })
    expect(count(pressHtml)).toBeLessThanOrEqual(8)
    for (const name of ['target dent', 'foam', 'scale', '20 cm', '5 cm']) expect(text(pressHtml)).toContain(name)
    // Dive: four ruler numbers, the liquid and its density, the capsule, kPa and five dial numbers.
    expect(count(html(DIVES[0], { depth: 5 }))).toBeLessThanOrEqual(13)
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    expect(W).toBe(360)
    expect(H).toBe(300)
    expect(DENT).toBe(DENT_PER_KPA)
    expect(PX_LOAD * TANK.wide).toBe(216)
    expect(html(LOADS[0], { weights: 0 })).toContain(`viewBox="0 ${BOX.load.y} ${W} ${BOX.load.h}"`)
    expect(BOX.load.y + BOX.load.h).toBe(H)
    expect(BOX.press.y + BOX.press.h).toBe(H)
    expect(BOX.dive.h).toBeLessThanOrEqual(H)
    expect(PX_PRESS * FACES[2].high * MAX_BRICKS).toBe(176)
  })

  it('one smallest move makes a change the eye catches', () => {
    const plan = loadPlan({ block: 'pine', liquid: 'water' })!
    const a = loadFrame(plan, 0)
    const b = loadFrame(plan, 1)
    expect((b.sunk - a.sunk) * PX_LOAD).toBeGreaterThan(5)
    expect((b.level - a.level) * PX_LOAD).toBeGreaterThan(0.5)
    expect(DENT * pressureOf({ face: 0, bricks: 2 }) - DENT * pressureOf({ face: 0, bricks: 1 })).toBeGreaterThanOrEqual(5)
    expect(PX_DIVE).toBeGreaterThan(3)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'density-pressure', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: DPConfig, state: DPState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(DensityPressureView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (h: string) => [...h.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [DPConfig, string][] = [
    [{ task: 'load', block: 'pine', liquid: 'water' }, 'Tap + to stack weights on the pine block, and − to take one off. Load it with as many weights as it can carry and still float.'],
    [{ task: 'load', block: 'ice', liquid: 'brine' }, 'Tap + to stack weights on the ice block, and − to take one off. Load it with as many weights as it can carry and still float.'],
    [{ task: 'press', target: 4 }, 'Tap the arrows to turn the brick onto another face, and + or − to add or take away a brick. Press the foam in to the dashed line, using as few bricks as you can.'],
    [{ task: 'press', target: 1 }, 'Press the foam in to the dashed line, using as few bricks as you can.'],
    [{ task: 'dive', liquid: 'brine', reference: 18 }, 'Tap + to lower the capsule into the brine. In water the needle stopped at the orange tab: lower the capsule until the needle reaches it here.'],
    [{ task: 'dive', liquid: 'paraffin', reference: 16 }, 'Lower the capsule until the needle reaches the orange tab.'],
  ]

  it('before marking, nothing says the answer, the rule or a verdict', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const h = card(cfg, prompt)
      expect(h, nameOf(cfg)).toContain('<button')
      const shown = text(h.replace(prompt, '')) + ' ' + attrs(h)
      for (const secret of ['Yes', 'is the most', 'room to spare', 'has sunk', 'fewer', 'does not reach', 'goes past', 'same reading', 'denser', 'less dense', 'push aside', 'pushes aside', 'force ÷ area', 'not at the marker', 'correct', 'wrong']) {
        expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      }
    }
  })

  it('the answer never appears before marking, in the markup, the labels or the ARIA text', () => {
    for (const c of ALL) {
      const initial = raw(c, engine.initial(c), 'idle')
      const everything = text(initial) + ' ' + attrs(initial)
      if (c.task === 'dive') expect(everything.replace("0 cm 10 cm 20 cm 30 cm", ""), nameOf(c)).not.toMatch(new RegExp(`\\b${diveAnswer(c.liquid, c.reference)} cm`))
      if (c.task === 'load') {
        expect(attrs(initial), nameOf(c)).not.toMatch(/most|carry|sinks/)
        expect(attrs(initial), nameOf(c)).not.toContain(`${loadPlan(c)!.most} weights`)
      }
    }
  })

  it('names what it draws, on the card, before marking', () => {
    const load = text(raw({ task: 'load', block: 'oak', liquid: 'sea water' }, { weights: 0 }, 'idle'))
    for (const name of ['oak 700 g', 'sea water', 'weights', 'Weights', 'Total mass on the water', 'Oak block, 20 × 10 × 5 cm, 700 g', '1.03 g per cm³']) expect(load).toContain(name)
    const press = text(raw({ task: 'press', target: 2 }, { face: 0, bricks: 1 }, 'idle'))
    for (const name of ['target dent', 'foam', 'scale', 'Resting on', '20 × 10 cm', 'Bricks', '2.0 kg', 'Brick 20 × 10 × 5 cm, 2 kg each']) expect(press).toContain(name)
    const dive = text(raw({ task: 'dive', liquid: 'brine', reference: 18 }, { depth: 0 }, 'idle'))
    for (const name of ['kPa', 'capsule', 'brine', '1.2 g/cm³', 'Depth of the capsule', 'Gauge reads', '0.00 kPa', 'Orange tab']) expect(dive).toContain(name)
  })

  it('marking gives the count and the why, and what was made when wrong', () => {
    const l: Load = { task: 'load', block: 'pine', liquid: 'water' }
    expect(text(raw(l, { weights: 3 }, 'right'))).toContain('3 weights is the most')
    expect(text(raw(l, { weights: 1 }, 'wrong'))).toContain('still floats with room to spare')
    expect(text(raw(l, { weights: 4 }, 'wrong'))).toContain('has sunk')
    expect(text(raw({ task: 'press', target: 8 }, { face: 2, bricks: 2 }, 'right'))).toContain('2 bricks on the 10 × 5 cm face is 8 kPa')
    expect(text(raw({ task: 'press', target: 2 }, { face: 0, bricks: 2 }, 'wrong'))).toContain('with 2 bricks')
    expect(text(raw({ task: 'dive', liquid: 'paraffin', reference: 16 }, { depth: 20 }, 'right'))).toContain('20 cm in paraffin reads 1.6 kPa')
    expect(text(raw({ task: 'dive', liquid: 'brine', reference: 18 }, { depth: 8 }, 'wrong'))).toContain('0.96 kPa')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const l: Load = { task: 'load', block: 'pine', liquid: 'water' }
    const h = raw(l, {}, 'shown')
    // Three weights on the block, two left in the pile.
    expect([...h.matchAll(/data-weight="1"/g)].length).toBe(5)
    expect(text(h)).toContain('3 weights is the most')
    expect(raw({ task: 'press', target: 8 }, {}, 'shown')).toContain('4.0 kg')
    expect(text(raw({ task: 'dive', liquid: 'brine', reference: 18 }, {}, 'shown'))).toContain('15 cm')
  })

  it('every control is a real button with its own label, the stepper is a spinbutton, and everything locks when solved', () => {
    for (const [cfg] of EXAMPLES) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const buttons = [...idle.matchAll(/<button[^>]*>/g)].map((m) => m[0])
      expect(buttons.length, nameOf(cfg)).toBeGreaterThanOrEqual(2)
      expect(buttons.length, nameOf(cfg)).toBeLessThanOrEqual(4)
      for (const b of buttons) expect(b, nameOf(cfg)).toMatch(/aria-label="[^"]+"/)
      expect(idle).toContain('role="spinbutton"')
      const solved = raw(cfg, engine.solve(cfg), 'right')
      for (const b of [...solved.matchAll(/<button[^>]*>/g)].map((m) => m[0])) expect(b, nameOf(cfg)).toMatch(/disabled/)
    }
  })

  it('under reduced motion nothing animates and the picture still changes with each move', () => {
    const l: Load = { task: 'load', block: 'pine', liquid: 'water' }
    const a = raw(l, { weights: 0 }, 'idle', true)
    expect(a).not.toBe(raw(l, { weights: 1 }, 'idle', true))
    expect(a).not.toMatch(/<animate|style="[^"]*transition/)
    const p: Press = { task: 'press', target: 4 }
    expect(raw(p, { face: 0, bricks: 1 }, 'idle', true)).not.toBe(raw(p, { face: 1, bricks: 1 }, 'idle', true))
    const d: Dive = { task: 'dive', liquid: 'brine', reference: 18 }
    expect(raw(d, { depth: 3 }, 'idle', true)).not.toBe(raw(d, { depth: 4 }, 'idle', true))
  })
})
