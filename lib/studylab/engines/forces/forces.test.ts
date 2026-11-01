import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  forcesEngine as engine, FINDS, OBJECTS, SCENES,
  eqRat, fmaCase, fmaGivens, fmaSaid, fmtRat, fmtTenths, hashOf, makeForces, makeRange, makeSaid, makeScenario, rat, readNumber, readTarget, resultantSaid,
  resultantScenario, stepForKey, truthOf,
  type ForcesConfig, type ForcesState, type Force, type MakeTask, type ResultantTask, type FmaTask, type ObjectId,
} from './config'
import { CARD_W, ForcesView, LABEL_H, layoutScene, stepsFromPoint, textW, type Layout, type Pt, type Rect, type Spec } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { dimensionsOf } from '../../activities/dimensions'
import { checkIntent } from '../../activities/intent'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Forces along one line: the tutor names an object, how it starts and what the forces do (or an aim, or a quantity to find);
 * the engine deals the forces, draws them to scale and marks exactly.
 */

const OBJ = [...OBJECTS] as ObjectId[]
const MOTIONS = ['at rest', 'moving left', 'moving right', 'moving down', 'moving up']
const RESULTS = ['balanced', 'speeds up', 'slows down']

const resultant = (object: string, motion: string | undefined, result: string, forces?: number, variant?: number): ForcesConfig =>
  ({ task: { kind: 'resultant', object, ...(motion ? { motion } : {}), result, ...(forces ? { forces } : {}), ...(variant ? { variant } : {}) } } as never)
const make = (object: string, motion: string | undefined, target: unknown, forces?: number, variant?: number): ForcesConfig =>
  ({ task: { kind: 'make', object, ...(motion ? { motion } : {}), target, ...(forces ? { forces } : {}), ...(variant ? { variant } : {}) } } as never)
const fma = (find: string, object?: string, g?: number, variant?: number): ForcesConfig =>
  ({ task: { kind: 'f-ma', find, ...(object ? { object } : {}), ...(g ? { g } : {}), ...(variant ? { variant } : {}) } } as never)

/** What the engine makes of what a tutor wrote. */
const read = (raw: unknown): ForcesConfig => {
  const c = engine.parse(raw)
  if (!c) throw new Error(`could not read ${JSON.stringify(raw)}`)
  return c
}
const faultsOf = (raw: unknown): string[] => engine.faults(read(raw))
const rt = (c: ForcesConfig) => c.task as ResultantTask
const mk = (c: ForcesConfig) => c.task as MakeTask
const fm = (c: ForcesConfig) => c.task as FmaTask

/** A small deterministic dice, so a failure can be replayed. */
function dice(seed: number) {
  let s = seed >>> 0
  const next = () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296
  }
  return { int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)), one: <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)] }
}

// ---------------------------------------------------------------------------
// Independent oracles: they share nothing with the engine's dealing or its truth.

type Plain = { way: string; n: number }
/** The resultant by plain addition: right and up are positive. */
const plainNet = (fs: readonly Plain[]) => fs.reduce((a, f) => a + (f.way === 'right' || f.way === 'up' ? f.n : -f.n), 0)
const plainChange = (motion: string, net: number): 'same' | 'faster' | 'slower' => {
  if (net === 0) return 'same'
  if (motion === 'rest') return 'faster'
  const forward = motion === 'right' || motion === 'up'
  return (net > 0) === forward ? 'faster' : 'slower'
}

const expectValid = (object: string, motion: string | undefined, result: string, forces: number | undefined): boolean => {
  const allowed: Record<string, string[]> = { box: ['at rest', 'moving left', 'moving right'], car: ['moving left', 'moving right'], boat: ['moving left', 'moving right'], skydiver: ['moving down'] }
  const counts: Record<string, number[]> = { box: [2, 3, 4], car: [2, 3], boat: [2, 3], skydiver: [2] }
  const m = motion ?? (object === 'skydiver' ? 'moving down' : undefined)
  if (!m || !allowed[object].includes(m)) return false
  if (!counts[object].includes(forces ?? 2)) return false
  return !(m === 'at rest' && result === 'slows down')
}

const motionWay = (motion: string) => (motion === 'at rest' ? 'rest' : motion.replace('moving ', ''))

/** Every resultant card the grid below can write. */
function resultantGrid(): { cfg: ForcesConfig; object: string; motion: string | undefined; result: string; forces: number | undefined; variant: number }[] {
  const out: ReturnType<typeof resultantGrid> = []
  for (const object of OBJ) for (const motion of [...MOTIONS, undefined]) for (const result of RESULTS) for (const forces of [undefined, 2, 3, 4, 5]) for (const variant of [0, 1, 2, 5, 11]) {
    out.push({ cfg: read(resultant(object, motion, result, forces, variant)), object, motion, result, forces, variant })
  }
  return out
}

// ---------------------------------------------------------------------------

describe('exact numbers', () => {
  it('reads a typed number as an exact decimal, with the quantity’s own unit if any', () => {
    expect(readNumber('15', 'force')).toEqual(rat(15))
    expect(readNumber(' 15 N ', 'force')).toEqual(rat(15))
    expect(readNumber('15N', 'force')).toEqual(rat(15))
    expect(readNumber('15 newtons', 'force')).toEqual(rat(15))
    expect(readNumber('0', 'force')).toEqual(rat(0))
    expect(readNumber('zero', 'force')).toEqual(rat(0))
    expect(readNumber('2.5', 'accel')).toEqual(rat(5, 2))
    expect(readNumber('2.5 m/s²', 'accel')).toEqual(rat(5, 2))
    expect(readNumber('2.5 m/s2', 'accel')).toEqual(rat(5, 2))
    expect(readNumber('2.50', 'accel')).toEqual(rat(5, 2))
    expect(readNumber('.5', 'accel')).toEqual(rat(1, 2))
    expect(readNumber('4 kg', 'mass')).toEqual(rat(4))
    expect(readNumber('1,200', 'force')).toEqual(rat(1200))
    expect(readNumber('1200', 'force')).toEqual(rat(1200))
  })

  it('refuses what is not a plain number, or has another quantity’s unit, or a decimal comma', () => {
    for (const bad of ['', ' ', 'abc', '7,5', '1,20', '15 kg', '2.5 m/s²', '4 m/s²', '1.2.3', '1e3', '-5', '15 N 2', '12345678', '0.0001', 'zero']) {
      expect(readNumber(bad, bad === 'zero' ? 'accel' : 'force'), bad).toBeNull()
    }
    expect(readNumber(15, 'force')).toBeNull()
    expect(readNumber(undefined, 'force')).toBeNull()
  })

  it('compares by cross-multiplying, so 58.8 is not 59 and 0.1 + 0.2 is not a problem', () => {
    expect(eqRat(readNumber('58.8', 'force')!, rat(588, 10))).toBe(true)
    expect(eqRat(readNumber('59', 'force')!, rat(588, 10))).toBe(false)
    expect(eqRat(readNumber('58.80', 'force')!, rat(588, 10))).toBe(true)
    expect(eqRat(readNumber('58.79', 'force')!, rat(588, 10))).toBe(false)
    expect(eqRat(readNumber('0.3', 'accel')!, rat(3, 10))).toBe(true)
  })

  it('writes a fraction as a decimal that ends', () => {
    expect(fmtRat(rat(588, 10))).toBe('58.8')
    expect(fmtRat(rat(5, 2))).toBe('2.5')
    expect(fmtRat(rat(121, 8))).toBe('15.125')
    expect(fmtRat(rat(30, 10))).toBe('3')
    expect(fmtTenths(25)).toBe('2.5')
    expect(fmtTenths(30)).toBe('3')
    expect(fmtTenths(5)).toBe('0.5')
  })
})

// ---------------------------------------------------------------------------

describe('reading what the tutor writes', () => {
  it('reads a resultant card however the words are reasonably written', () => {
    for (const raw of [
      { task: { kind: 'resultant', object: 'car', motion: 'moving right', result: 'slows down' } },
      { task: { kind: 'Resultant Force', object: 'the car', motion: 'Moving to the right', result: 'Slows-down' } },
      { task: { kind: 'resultant', scene: 'vehicle', start: 'right', outcome: 'decelerates' } },
      { task: { kind: 'net-force', object: 'Car', motion: 'rightwards', result: 'slowing down', forces: '2 forces' } },
    ]) {
      const c = rt(read(raw))
      expect(c.object, JSON.stringify(raw)).toBe('car')
      expect(c.motion).toBe('right')
      expect(c.result).toBe('slows down')
    }
    expect(rt(read({ task: { kind: 'resultant', object: 'crate', motion: 'stationary', result: 'accelerates', forces: 3 } }))).toMatchObject({ object: 'box', motion: 'rest', result: 'speeds up', forces: 3 })
    expect(rt(read({ task: { kind: 'resultant', object: 'parachutist', motion: 'falling', result: 'steady speed' } }))).toMatchObject({ object: 'skydiver', motion: 'down', result: 'balanced' })
  })

  it('reads a make card’s aim as balanced, a size and a way, or an object', () => {
    for (const t of ['balanced', 'Balanced forces', 'zero', '0 N', '0', 'no resultant', 0, { n: 0 }, { balanced: true }]) expect(readTarget(t), JSON.stringify(t)).toEqual({ balanced: true })
    for (const t of ['20 N to the right', '20N right', '20 newtons to the right', 'a resultant of 20 N to the right', '20 N rightwards', { n: 20, way: 'right' }, { size: '20', direction: 'to the right' }]) {
      expect(readTarget(t), JSON.stringify(t)).toEqual({ balanced: false, n: 20, way: 'right' })
    }
    expect(readTarget('300 N upwards')).toEqual({ balanced: false, n: 300, way: 'up' })
    expect(readTarget('100 N down')).toEqual({ balanced: false, n: 100, way: 'down' })
    for (const t of ['big', '20 N', '', null, 12, ['a'], { n: 'x' }]) expect(readTarget(t), JSON.stringify(t)).toBeNull()
    expect(mk(read({ task: { kind: 'balance', object: 'box', target: 'balanced', motion: 'right' } }))).toMatchObject({ kind: 'make', object: 'box', motion: 'right', target: { balanced: true } })
  })

  it('reads an f-ma card, whatever the quantity is called', () => {
    for (const [word, find] of [['acceleration', 'acceleration'], ['Force', 'force'], ['resultant force', 'force'], ['the mass', 'mass'], ['Weight', 'weight'], ['a', 'acceleration']] as const) {
      expect(fm(read({ task: { kind: 'F=ma', find: word } })).find, word).toBe(find)
    }
    expect(fm(read({ task: { kind: 'f-ma', find: 'weight', g: '9.8 N/kg' } })).g).toBe(9.8)
    expect(fm(read({ task: { kind: 'f-ma', ask: 'mass', object: 'boat', seed: 3 } }))).toMatchObject({ find: 'mass', object: 'boat', variant: 3 })
  })

  it('returns null only for what cannot be read at all, and says the rest through faults()', () => {
    for (const bad of [null, undefined, 'x', 3, {}, { task: null }, { task: [] }, { task: { kind: 'orbit' } }, { task: { object: 'car' } }]) expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    expect(faultsOf({ task: { kind: 'resultant', object: 'spaceship', motion: 'moving right', result: 'balanced' } }).join(' ')).toMatch(/"spaceship" is not an object the card can draw: use "box", "car", "boat" or "skydiver"/)
    expect(faultsOf({ task: { kind: 'resultant', object: 'car', motion: 'sideways', result: 'balanced' } }).join(' ')).toMatch(/"sideways" is not a way to start/)
    expect(faultsOf({ task: { kind: 'resultant', object: 'car', motion: 'moving right', result: 'explodes' } }).join(' ')).toMatch(/"explodes" is not something the forces can do/)
    expect(faultsOf({ task: { kind: 'resultant', object: 'car', motion: 'moving right', result: 'balanced', forces: [{ n: 5 }] } }).join(' ')).toMatch(/the engine chooses the values of the forces, so leave the list out/)
    expect(faultsOf({ task: { kind: 'make', object: 'box', target: 'big' } }).join(' ')).toMatch(/"big" is not an aim the card can read/)
    expect(faultsOf({ task: { kind: 'f-ma', find: 'speed' } }).join(' ')).toMatch(/"speed" is not something to find/)
    expect(faultsOf({ task: { kind: 'f-ma', find: 'weight', g: 'lots' } }).join(' ')).toMatch(/is not a value of g/)
  })
})

// ---------------------------------------------------------------------------

describe('what a card refuses, and the sentence a writer can act on', () => {
  it('knows which resultant cards can be drawn, and refuses the rest with a reason', () => {
    let valid = 0
    for (const g of resultantGrid()) {
      const faults = engine.faults(g.cfg)
      const should = expectValid(g.object, g.motion, g.result, g.forces)
      expect(faults.length === 0, `${JSON.stringify(g.cfg)} -> ${faults.join(' | ')}`).toBe(should)
      // A card with no fault is one that can be dealt, and the other way round.
      expect(resultantScenario(rt(g.cfg)) !== null, JSON.stringify(g.cfg)).toBe(should)
      if (should) valid++
    }
    expect(valid).toBeGreaterThan(250)
  })

  it('says why a car cannot start at rest, a box cannot slow at rest, and a skydiver must fall', () => {
    expect(faultsOf(resultant('car', 'at rest', 'balanced')).join(' ')).toMatch(/A car cannot start "at rest" here\. A car at rest has no air resistance or friction to draw; start it moving\. Use "motion": "moving left" or "moving right"/)
    expect(faultsOf(resultant('box', 'at rest', 'slows down')).join(' ')).toMatch(/A box at rest cannot slow down\. Use "result": "speeds up" \(it starts to move\) or "balanced" \(it stays at rest\)/)
    expect(faultsOf(resultant('skydiver', 'moving up', 'balanced')).join(' ')).toMatch(/already falling, with weight and air resistance/)
    expect(faultsOf(resultant('car', 'moving right', 'balanced', 4)).join(' ')).toMatch(/The car card holds 2 or 3 forces, not 4\. 4 forces is for the box\./)
    expect(faultsOf(resultant('skydiver', undefined, 'speeds up', 3)).join(' ')).toMatch(/The skydiver card holds 2 forces, not 3/)
    expect(faultsOf(resultant('box', undefined, 'balanced')).join(' ')).toMatch(/Say how it starts/)
    expect(faultsOf({ task: { kind: 'resultant', object: 'box', motion: 'at rest' } }).join(' ')).toMatch(/Say what the forces do: "result": "balanced", "speeds up" or "slows down"/)
    expect(faultsOf({ task: { kind: 'resultant', motion: 'at rest', result: 'balanced' } }).join(' ')).toMatch(/Say what the forces act on/)
    // The falling skydiver needs no motion named.
    expect(faultsOf(resultant('skydiver', undefined, 'slows down'))).toEqual([])
    expect(faultsOf({ task: { kind: 'resultant', object: 'box', motion: 'at rest', result: 'balanced', variant: 123 } }).join(' ')).toMatch(/not a whole number from 0 to 99/)
  })

  it('make: refuses an aim the object cannot draw to scale, with one that works', () => {
    expect(faultsOf(make('box', 'moving right', 'balanced'))).toEqual([])
    expect(faultsOf(make('box', 'moving right', '20 N to the right'))).toEqual([])
    expect(faultsOf(make('box', 'moving right', '20 N to the left'))).toEqual([])
    expect(faultsOf(make('car', 'moving right', '400 N to the right'))).toEqual([])
    const off = faultsOf(make('box', 'moving right', '22 N to the right')).join(' ')
    expect(off).toMatch(/22 N is not a size the box card can draw to scale: its arrows go in steps of 5 N\. Use e\.g\. "5 N to the right"/)
    expect(faultsOf(make('car', 'moving right', '450 N to the right')).join(' ')).toMatch(/steps of 200 N/)
    expect(faultsOf(make('box', 'moving right', '20 N upwards')).join(' ')).toMatch(/works left and right, so a target up is not one it can draw/)
    expect(faultsOf(make('skydiver', undefined, '200 N to the left')).join(' ')).toMatch(/works up and down/)
    expect(faultsOf({ task: { kind: 'make', object: 'box' } }).join(' ')).toMatch(/Say the aim: "target": "balanced"/)
    expect(faultsOf(make('car', 'at rest', 'balanced')).join(' ')).toMatch(/cannot start "at rest"/)
  })

  it('make: an aim too big to reach is refused with the largest that works', () => {
    const huge = faultsOf(make('box', 'moving right', '500 N to the right')).join(' ')
    expect(huge).toMatch(/No forces can be dealt that meet that aim/)
    expect(huge).toMatch(/Use e\.g\. "5 N to the right"/)
    // The example in a refusal is itself a working card.
    for (const c of [make('box', 'moving right', '500 N to the right'), make('car', 'moving left', '6000 N to the left'), make('skydiver', undefined, '3000 N upwards'), make('boat', 'moving right', '4000 N to the right')]) {
      const said = faultsOf(c).join(' ')
      const e = /Use e\.g\. "([^"]+)"/.exec(said)
      expect(e, said).not.toBeNull()
      if (e![1] === 'balanced') continue
      const fixed = { task: { ...(c.task as object), target: e![1] } }
      expect(faultsOf(fixed), `${said} -> ${e![1]}`).toEqual([])
    }
  })

  it('f-ma: asks what to find, and keeps g to weight and to 9.8 or 10', () => {
    expect(faultsOf({ task: { kind: 'f-ma' } }).join(' ')).toMatch(/Say what to find: "find": "acceleration", "force", "mass" or "weight"/)
    expect(faultsOf(fma('weight', 'box', 9.8))).toEqual([])
    expect(faultsOf(fma('weight', 'box', 10))).toEqual([])
    expect(faultsOf(fma('weight', 'box', 9.81)).join(' ')).toMatch(/is not used: write 9\.8 \(the 0625 value\) or 10/)
    expect(faultsOf(fma('acceleration', 'car', 10)).join(' ')).toMatch(/"g" is only used when finding the weight/)
    for (const find of FINDS) for (const o of [undefined, ...OBJ]) expect(faultsOf(fma(find, o)), `${find} ${o}`).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('resultant cards: every card that can be written', { timeout: 60_000 }, () => {
  const valid = resultantGrid().filter((g) => expectValid(g.object, g.motion, g.result, g.forces))

  it('deals forces whose resultant, found by plain addition, does what the card says', () => {
    for (const g of valid) {
      const s = resultantScenario(rt(g.cfg))!
      const label = JSON.stringify(g.cfg)
      expect(s.forces.length, label).toBe(g.forces ?? 2)
      const t = truthOf(s)
      const net = plainNet(s.forces)
      expect(t.net, label).toBe(net)
      expect(t.size, label).toBe(Math.abs(net))
      expect(t.change, label).toBe(plainChange(s.motion, net))
      expect(t.change, label).toBe({ balanced: 'same', 'speeds up': 'faster', 'slows down': 'slower' }[g.result])
      expect(t.way, label).toBe(net === 0 ? 'none' : s.scene.axis === 'horizontal' ? (net > 0 ? 'right' : 'left') : net > 0 ? 'up' : 'down')
      // Small, whole numbers of the object's unit, in the range that can be drawn to scale.
      for (const [i, x] of s.forces.entries()) {
        const slot = s.scene.slots[i]
        expect(x.n, label).toBe(x.steps * s.scene.unit)
        expect(x.steps, label).toBeGreaterThanOrEqual(slot.lo ?? s.scene.lo)
        expect(x.steps, label).toBeLessThanOrEqual(slot.hi ?? s.scene.hi)
      }
      // An unbalanced card is never close to nothing and never huge.
      expect(Math.abs(net) / s.scene.unit, label).toBeLessThanOrEqual(4)
    }
  })

  it('draws forces that are physically right: resistance opposes the motion, and does not exist at rest', () => {
    for (const g of valid) {
      const s = resultantScenario(rt(g.cfg))!
      const label = JSON.stringify(g.cfg)
      const names = s.forces.map((x) => x.name)
      if (s.motion === 'rest') {
        // No air or water resistance at rest, and static friction never wins.
        expect(names.some((n) => /resistance/i.test(n)), label).toBe(false)
        const friction = s.forces.find((x) => x.name === 'Friction')!
        const dir = s.dsign
        expect(plainNet(s.forces) * dir, label).toBeGreaterThanOrEqual(0)
        expect(friction.sign, label).toBe(-dir)
      } else {
        for (const x of s.forces) {
          if (/resistance|friction/i.test(x.name)) expect(x.way, `${label} ${x.name}`).toBe(opposite(s.motion))
        }
        // A car or boat is pushed the way it faces.
        for (const x of s.forces) if (/Driving|Engine/.test(x.name)) expect(x.way, label).toBe(s.motion)
      }
      if (s.scene.id === 'skydiver') {
        expect(s.forces.find((x) => x.name === 'Weight')!.way).toBe('down')
        expect(s.forces.find((x) => x.name === 'Air resistance')!.way).toBe('up')
      }
    }
  })

  it('starts unsolved and is solved by solve(), for every card', () => {
    for (const g of valid) {
      const label = JSON.stringify(g.cfg)
      expect(engine.faults(g.cfg), label).toEqual([])
      expect(engine.check(g.cfg, engine.initial(g.cfg)).ok, label).toBe(false)
      expect(engine.check(g.cfg, engine.solve(g.cfg)).ok, label).toBe(true)
    }
  })

  it('is right only when the size, the direction and the motion are all right, exactly (2000 random states)', () => {
    const d = dice(41)
    const WAYS_H = ['left', 'none', 'right']
    const WAYS_V = ['up', 'none', 'down']
    for (let i = 0; i < 2000; i++) {
      const g = d.one(valid)
      const s = resultantScenario(rt(g.cfg))!
      const t = truthOf(s)
      const right = engine.solve(g.cfg) as ForcesState
      const wrongSize = String(Math.max(0, t.size + d.one([-2, -1, 1, 2, 10]) * s.scene.unit))
      const state: ForcesState = { ...right }
      const bad: string[] = []
      if (d.int(0, 1)) { state.size = wrongSize === String(t.size) ? String(t.size + s.scene.unit) : wrongSize; bad.push('size') }
      if (d.int(0, 1)) { state.way = d.one((s.scene.axis === 'horizontal' ? WAYS_H : WAYS_V).filter((w) => w !== t.way)); bad.push('way') }
      if (d.int(0, 1)) { state.change = d.one(['same', 'faster', 'slower'].filter((c) => c !== t.change)); bad.push('change') }
      expect(engine.check(g.cfg, state).ok, `${JSON.stringify(g.cfg)} ${JSON.stringify(state)}`).toBe(bad.length === 0)
    }
  })

  it('takes the size however a learner types it, and nothing else', () => {
    const g = valid.find((v) => v.object === 'box' && v.result === 'speeds up')!
    const s = resultantScenario(rt(g.cfg))!
    const t = truthOf(s)
    const right = engine.solve(g.cfg) as ForcesState
    for (const typed of [`${t.size}`, ` ${t.size} `, `${t.size} N`, `${t.size}N`, `${t.size}.0`, `${t.size}.00 newtons`, `0${t.size}`]) {
      expect(engine.check(g.cfg, { ...right, size: typed }).ok, typed).toBe(true)
    }
    for (const typed of ['', 'x', `${t.size + 0.1}`, `${t.size - 0.01}`, `${t.size} kg`, `${t.size},5`, `-${t.size}`, `${t.size}0`]) {
      expect(engine.check(g.cfg, { ...right, size: typed }).ok, typed).toBe(false)
    }
  })

  it('shows variety: another variant of the same card deals other forces', () => {
    const forces = (v: number) => JSON.stringify(resultantScenario(rt(read(resultant('box', 'moving right', 'speeds up', 3, v))))!.forces.map((x) => x.steps))
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7].map(forces)).size).toBeGreaterThanOrEqual(5)
    // And the same card always deals the same forces.
    expect(forces(3)).toBe(forces(3))
  })

  it('reads a state it cannot use as the start', () => {
    const g = valid[0]
    for (const bad of [null, undefined, 'junk', 7, { size: 5, way: 3, change: [] }, { size: 'x'.repeat(500), way: 'sideways', change: 'maybe' }]) {
      expect(engine.check(g.cfg, bad as never).ok).toBe(false)
    }
  })
})

const opposite = (w: string) => ({ left: 'right', right: 'left', up: 'down', down: 'up' } as Record<string, string>)[w]

// ---------------------------------------------------------------------------

describe('make cards: every aim that can be reached', { timeout: 60_000 }, () => {
  const aims = (o: SceneDefLike): string[] => {
    const out = ['balanced']
    const ways = o.axis === 'horizontal' ? ['right', 'left'] : ['up', 'down']
    for (let k = 1; k <= 8; k++) for (const w of ways) out.push(`${k * o.unit} N ${w === 'up' ? 'upwards' : w === 'down' ? 'downwards' : `to the ${w}`}`)
    return out
  }
  type SceneDefLike = { axis: string; unit: number }
  type Grid = { cfg: ForcesConfig; object: ObjectId; motion: string | undefined; aim: string; forces: number | undefined; variant: number }
  const grid: Grid[] = []
  for (const object of OBJ) {
    for (const motion of [...MOTIONS.slice(0, 3), 'moving down', undefined]) {
      for (const aim of aims(SCENES[object])) for (const forces of [undefined, 3, 4]) for (const variant of [0, 3]) {
        grid.push({ cfg: read(make(object, motion, aim, forces, variant)), object, motion, aim, forces, variant })
      }
    }
  }
  const valid = grid.filter((g) => engine.faults(g.cfg).length === 0)

  it('can be drawn exactly when it has no fault, and many aims are reachable', () => {
    for (const g of grid) expect(makeScenario(mk(g.cfg)) !== null, JSON.stringify(g.cfg)).toBe(engine.faults(g.cfg).length === 0)
    expect(valid.length).toBeGreaterThan(300)
    // Balanced is reachable for every object and every way it can start.
    for (const object of OBJ) {
      expect(valid.some((g) => g.object === object && g.aim === 'balanced' && g.forces === undefined), object).toBe(true)
      expect(valid.some((g) => g.object === object && g.aim !== 'balanced'), object).toBe(true)
    }
  })

  it('starts unsolved, is solved by solve(), and is right for exactly one length of the force (plain addition)', () => {
    for (const g of valid) {
      const label = JSON.stringify(g.cfg)
      const m = makeScenario(mk(g.cfg))!
      const [lo, hi] = makeRange(m)
      expect(engine.check(g.cfg, engine.initial(g.cfg)).ok, label).toBe(false)
      expect(engine.check(g.cfg, engine.solve(g.cfg)).ok, label).toBe(true)
      expect(m.solution, label).toBeGreaterThanOrEqual(lo)
      expect(m.solution, label).toBeLessThanOrEqual(hi)
      expect(Math.abs(m.start - m.solution), label).toBeGreaterThanOrEqual(2)
      // The aim, in newtons, as the tutor wrote it.
      const t = mk(g.cfg).target!
      const want = t.balanced ? 0 : (t.way === 'right' || t.way === 'up' ? 1 : -1) * t.n
      expect(m.aim, label).toBe(want)
      let passing = 0
      for (let k = lo; k <= hi; k++) {
        const fs = m.forces.map((x, i) => ({ way: x.way, n: i === m.adjust ? k * m.scene.unit : x.n }))
        const ok = plainNet(fs) === want
        expect(engine.check(g.cfg, { steps: k }).ok, `${label} k=${k}`).toBe(ok)
        if (ok) passing++
      }
      expect(passing, label).toBe(1)
    }
  })

  it('holds the forces at the start, never at the answer, and moves only the learner’s force', () => {
    for (const g of valid) {
      const m = makeScenario(mk(g.cfg))!
      expect(m.forces[m.adjust].steps, JSON.stringify(g.cfg)).toBe(m.start)
      const moved = makeForces(m, m.solution)
      moved.forEach((x, i) => { if (i !== m.adjust) expect(x, JSON.stringify(g.cfg)).toEqual(m.forces[i]) })
      expect(moved[m.adjust].steps).toBe(m.solution)
      // Out of range steps are held to the range.
      const [lo, hi] = makeRange(m)
      expect(makeForces(m, hi + 50)[m.adjust].steps).toBe(hi)
      expect(makeForces(m, lo - 50)[m.adjust].steps).toBe(lo)
    }
  })

  it('draws physical forces: the learner’s force is the push, thrust or parachute, and the rest oppose or help correctly', () => {
    for (const g of valid) {
      const m = makeScenario(mk(g.cfg))!
      const adj = m.forces[m.adjust]
      expect(adj.name, JSON.stringify(g.cfg)).toBe(m.scene.id === 'skydiver' ? 'Air resistance' : m.scene.slots[0].name)
      if (m.motion !== 'rest') for (const x of m.forces) if (/resistance|friction/i.test(x.name)) expect(x.way).toBe(opposite(m.motion))
      if (m.motion === 'rest') {
        expect(m.forces.some((x) => /resistance/i.test(x.name))).toBe(false)
        expect(m.aim * m.dsign).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('is right only for the right length, and reads a state it cannot use as the start', () => {
    const g = valid.find((v) => v.object === 'car' && v.aim === 'balanced')!
    const m = makeScenario(mk(g.cfg))!
    expect(engine.check(g.cfg, { steps: m.solution }).ok).toBe(true)
    expect(engine.check(g.cfg, { steps: m.solution + 1 }).ok).toBe(false)
    for (const bad of [null, undefined, 'x', { steps: 'a' }, { steps: 2.5 }, { steps: 999 }, { steps: -3 }]) expect(engine.check(g.cfg, bad as never).ok).toBe(false)
  })

  it('varies with the variant', () => {
    const at = (v: number) => JSON.stringify(makeScenario(mk(read(make('box', 'moving right', 'balanced', 3, v))))!.forces.map((x) => x.steps))
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8].map(at)).size).toBeGreaterThanOrEqual(5)
  })
})

describe('how a force is set', () => {
  it('moves the end of an arrow the way the key points', () => {
    expect(stepForKey('ArrowRight', 1, 'horizontal')).toBe(1)
    expect(stepForKey('ArrowLeft', 1, 'horizontal')).toBe(-1)
    expect(stepForKey('ArrowRight', -1, 'horizontal')).toBe(-1)
    expect(stepForKey('ArrowLeft', -1, 'horizontal')).toBe(1)
    expect(stepForKey('ArrowUp', 1, 'vertical')).toBe(1)
    expect(stepForKey('ArrowDown', 1, 'vertical')).toBe(-1)
    expect(stepForKey('ArrowUp', -1, 'vertical')).toBe(-1)
    expect(stepForKey('ArrowDown', -1, 'vertical')).toBe(1)
    // The other axis does nothing; the plain keys always mean longer and shorter.
    expect(stepForKey('ArrowUp', 1, 'horizontal')).toBeNull()
    expect(stepForKey('ArrowRight', 1, 'vertical')).toBeNull()
    expect(stepForKey('+', -1, 'horizontal')).toBe(1)
    expect(stepForKey('-', -1, 'vertical')).toBe(-1)
    expect(stepForKey('PageUp', 1, 'horizontal')).toBe(5)
    expect(stepForKey('PageDown', 1, 'horizontal')).toBe(-5)
    for (const k of ['a', 'Tab', 'Enter', ' ', 'Escape']) expect(stepForKey(k, 1, 'horizontal'), k).toBeNull()
  })

  it('finds the length from where a pointer is, kept within what the force may be', () => {
    const right = { tail: { x: 224, y: 100 }, way: 'right' as const }
    expect(stepsFromPoint(right, { x: 224 + 34, y: 100 }, 10, 3, 11)).toBe(3)
    expect(stepsFromPoint(right, { x: 224 + 66, y: 130 }, 10, 3, 11)).toBe(7)
    expect(stepsFromPoint(right, { x: 224 + 5, y: 100 }, 10, 3, 11)).toBe(3)
    expect(stepsFromPoint(right, { x: 500, y: 100 }, 10, 3, 11)).toBe(11)
    expect(stepsFromPoint(right, { x: 100, y: 100 }, 10, 3, 11)).toBe(3)
    const left = { tail: { x: 136, y: 100 }, way: 'left' as const }
    expect(stepsFromPoint(left, { x: 136 - 50, y: 100 }, 10, 3, 11)).toBe(5)
    const up = { tail: { x: 180, y: 112 }, way: 'up' as const }
    expect(stepsFromPoint(up, { x: 180, y: 112 - 30 }, 6, 4, 16)).toBe(5)
    const down = { tail: { x: 180, y: 208 }, way: 'down' as const }
    expect(stepsFromPoint(down, { x: 180, y: 208 + 60 }, 6, 4, 16)).toBe(10)
    expect(stepsFromPoint(down, { x: 180, y: 0 }, 6, 4, 16)).toBe(4)
  })
})

// ---------------------------------------------------------------------------

describe('f-ma cards: every quantity that can be asked', { timeout: 60_000 }, () => {
  const cases: { cfg: ForcesConfig; find: string; object: string | undefined; g: number | undefined; variant: number }[] = []
  for (const find of FINDS) for (const object of [undefined, ...OBJ]) for (const g of find === 'weight' ? [undefined, 9.8, 10] : [undefined]) for (let variant = 0; variant < 12; variant++) {
    cases.push({ cfg: read(fma(find, object, g, variant)), find, object, g, variant })
  }

  it('is a card that can be dealt, for all of them, with no fault', () => {
    expect(cases.length).toBeGreaterThan(300)
    for (const c of cases) {
      expect(engine.faults(c.cfg), JSON.stringify(c.cfg)).toEqual([])
      expect(fmaCase(fm(c.cfg)), JSON.stringify(c.cfg)).not.toBeNull()
    }
  })

  it('has the answer F = ma, W = mg gives, worked in BigInt as an oracle', () => {
    for (const c of cases) {
      const x = fmaCase(fm(c.cfg))!
      const label = JSON.stringify(c.cfg)
      const m = BigInt(x.m)
      if (c.find === 'weight') {
        const gT = BigInt(c.g === 10 ? 100 : 98)
        // W = m g: tenths of newtons are m * g in tenths.
        expect(BigInt(x.answer.n) * BigInt(10), label).toBe(m * gT * BigInt(x.answer.d))
        expect(x.F, label).toBeNull()
        continue
      }
      const aT = BigInt(x.aT!)
      const F = BigInt(x.F!)
      // F = m a, with a in tenths.
      expect(F * BigInt(10), label).toBe(m * aT)
      if (c.find === 'acceleration') expect(BigInt(x.answer.n) * m, label).toBe(F * BigInt(x.answer.d))
      if (c.find === 'force') expect(x.answer, label).toEqual(rat(Number(F)))
      if (c.find === 'mass') expect(BigInt(x.answer.n) * aT, label).toBe(F * BigInt(10) * BigInt(x.answer.d))
    }
  })

  it('uses whole numbers or one decimal place, and numbers that suit the object', () => {
    for (const c of cases) {
      const x = fmaCase(fm(c.cfg))!
      const label = JSON.stringify(c.cfg)
      // The answer ends within one decimal place.
      expect((x.answer.n * 10) % x.answer.d, label).toBe(0)
      expect(Number.isInteger(x.m), label).toBe(true)
      if (x.F !== null) expect(Number.isInteger(x.F) && x.F >= 1, label).toBe(true)
      if (x.aT !== null) expect(x.aT >= 2 && x.aT <= 80, label).toBe(true)
      const mass: Record<string, [number, number]> = { box: [2, 50], car: [800, 2000], boat: [200, 2000], skydiver: [60, 90] }
      expect(x.m, label).toBeGreaterThanOrEqual(mass[x.scene.id][0])
      expect(x.m, label).toBeLessThanOrEqual(mass[x.scene.id][1])
      expect(x.way === 'down' || x.way === 'left' || x.way === 'right', label).toBe(true)
      if (x.scene.id === 'skydiver') expect(x.way, label).toBe('down')
    }
  })

  it('starts unsolved, is solved by solve(), and no near answer passes', () => {
    for (const c of cases) {
      const label = JSON.stringify(c.cfg)
      expect(engine.check(c.cfg, engine.initial(c.cfg)).ok, label).toBe(false)
      expect(engine.check(c.cfg, engine.solve(c.cfg)).ok, label).toBe(true)
      const x = fmaCase(fm(c.cfg))!
      const tenths = Math.round((x.answer.n * 10) / x.answer.d)
      for (const near of [tenths + 1, tenths - 1, tenths * 10, Math.round(tenths / 10), tenths + 10]) {
        if (near === tenths || near < 0) continue
        expect(engine.check(c.cfg, { answer: fmtTenths(near) }).ok, `${label} ${near}`).toBe(false)
      }
    }
  })

  it('takes the answer with its own unit, and no other', () => {
    const c = read(fma('acceleration', 'car', undefined, 2))
    const x = fmaCase(fm(c))!
    const a = fmtRat(x.answer)
    for (const typed of [a, `${a} m/s²`, `${a} m/s2`, ` ${a} `]) expect(engine.check(c, { answer: typed }).ok, typed).toBe(true)
    for (const typed of [`${a} N`, `${a} kg`, `${a}0001`, '', 'two']) expect(engine.check(c, { answer: typed }).ok, typed).toBe(false)
    const w = read(fma('weight', 'box', 9.8, 1))
    const wa = fmtRat(fmaCase(fm(w))!.answer)
    expect(engine.check(w, { answer: `${wa} N` }).ok).toBe(true)
    expect(engine.check(w, { answer: `${wa} kg` }).ok).toBe(false)
  })

  it('prints g on a weight card and the right one, and only the givens', () => {
    const w98 = fmaCase(fm(read(fma('weight', 'box', 9.8, 4))))!
    const w10 = fmaCase(fm(read(fma('weight', 'box', 10, 4))))!
    expect(fmaGivens(w98)).toEqual([`Mass: ${w98.m} kg`, 'g = 9.8 N/kg'])
    expect(fmaGivens(w10)).toEqual([`Mass: ${w10.m} kg`, 'g = 10 N/kg'])
    expect(w98.m).toBe(w10.m)
    expect(fmtRat(w98.answer)).toBe(fmtTenths(w98.m * 98))
    expect(fmtRat(w10.answer)).toBe(`${w10.m * 10}`)
    const a = fmaCase(fm(read(fma('acceleration', 'box', undefined, 4))))!
    expect(fmaGivens(a)).toEqual([`Mass: ${a.m} kg`, `Resultant force: ${a.F} N`])
    const f = fmaCase(fm(read(fma('force', 'box', undefined, 4))))!
    expect(fmaGivens(f)).toEqual([`Mass: ${f.m} kg`, `Acceleration: ${fmtTenths(f.aT!)} m/s² ${f.way === 'left' ? 'to the left' : 'to the right'}`])
    const m = fmaCase(fm(read(fma('mass', 'box', undefined, 4))))!
    expect(fmaGivens(m).join(' ')).not.toMatch(/Mass/)
  })

  it('knows a weight of 58.8 N is not 59 N', () => {
    // A mass of 6 kg at 9.8 N/kg: exact marking, so the rounded answer is not the answer.
    let found = 0
    for (let v = 0; v < 60 && !found; v++) {
      const c = read(fma('weight', 'box', 9.8, v))
      const x = fmaCase(fm(c))!
      if (x.m === 6) {
        found = 1
        expect(engine.check(c, { answer: '58.8' }).ok).toBe(true)
        expect(engine.check(c, { answer: '59' }).ok).toBe(false)
      }
    }
    expect(found).toBe(1)
  })

  it('says the slip a wrong answer is when it is a common one', () => {
    const c = read(fma('acceleration', 'box', undefined, 0))
    const x = fmaCase(fm(c))!
    expect(fmaSaid(fm(c), { answer: String(x.F! * x.m) }, 'wrong')[0]).toMatch(/That is force × mass\. Acceleration is force ÷ mass\./)
    expect(fmaSaid(fm(c), { answer: '' }, 'wrong')[0]).toMatch(/Type your answer/)
    const w = read(fma('weight', 'box', 9.8, 3))
    const y = fmaCase(fm(w))!
    expect(fmaSaid(fm(w), { answer: String(y.m) }, 'wrong')[0]).toMatch(/That is the mass, in kilograms\./)
  })
})

// ---------------------------------------------------------------------------

describe('what is said back, in the numbers of the card', () => {
  it('resultant: the working, the resultant and what it does, and what the learner said when wrong', () => {
    const c = resultant('car', 'moving right', 'slows down', 3)
    const cfg = read(c)
    const s = resultantScenario(rt(cfg))!
    const t = truthOf(s)
    const right = engine.solve(cfg) as ForcesState
    const mod = { resultantSaid, makeSaid, fmaSaid }
    const lines = mod.resultantSaid(rt(cfg), right, 'right')
    expect(lines[0]).toBe(`The resultant force is ${t.size} N to the left.`)
    expect(lines[1]).toMatch(/^Forces to the right: .* Forces to the left: .* The resultant is the difference: \d+ N − \d+ N = \d+ N to the left\.$/)
    expect(lines[2]).toBe('The resultant acts against the way the car is moving, so it slows down.')
    const wrong = mod.resultantSaid(rt(cfg), { size: String(t.size + 200), way: 'right', change: 'faster' }, 'wrong')
    expect(wrong[0]).toBe(`You said a resultant of ${t.size + 200} N to the right, and that the car speeds up.`)
    expect(wrong.join(' ')).toMatch(/The resultant force is/)
    const dirOnly = mod.resultantSaid(rt(cfg), { ...right, way: 'right' }, 'wrong')
    expect(dirOnly.join(' ')).toMatch(/The size is right, but the direction is not/)
    const motionOnly = mod.resultantSaid(rt(cfg), { ...right, change: 'same' }, 'wrong')
    expect(motionOnly.join(' ')).toMatch(/The resultant is right, but the motion is not/)
    expect(mod.resultantSaid(rt(cfg), {}, 'wrong')[0]).toMatch(/Give the size of the resultant, its direction, and what it does/)
    expect(mod.resultantSaid(rt(cfg), { size: '5' }, 'wrong')[0]).toBe('Still to give: its direction and what happens to the motion. Then check.')
  })

  it('resultant: balanced forces say there is no resultant and no change, at rest or moving', () => {
    const mod = { resultantSaid, makeSaid, fmaSaid }
    const moving = read(resultant('box', 'moving left', 'balanced'))
    const a = mod.resultantSaid(rt(moving), engine.solve(moving) as ForcesState, 'right')
    expect(a[0]).toBe('The resultant force is 0 N: there is no resultant force.')
    expect(a[1]).toMatch(/= 0 N\.$/)
    expect(a[2]).toMatch(/keeps moving at a steady speed in a straight line\. A moving object does not need a resultant force to keep moving\./)
    const rest = read(resultant('box', 'at rest', 'balanced'))
    expect(mod.resultantSaid(rt(rest), engine.solve(rest) as ForcesState, 'right')[2]).toMatch(/there is no resultant force and the box stays at rest\./)
    const start = read(resultant('box', 'at rest', 'speeds up'))
    expect(mod.resultantSaid(rt(start), engine.solve(start) as ForcesState, 'right')[2]).toMatch(/starts to move to the (?:left|right) and speeds up\./)
    // A resultant of 0 N has no direction.
    expect(mod.resultantSaid(rt(rest), { size: '0', way: 'right', change: 'same' }, 'wrong').join(' ')).toMatch(/A resultant of 0 N has no direction\./)
  })

  it('make: what the learner set, the aim and the working', () => {
    const mod = { resultantSaid, makeSaid, fmaSaid }
    const cfg = read(make('box', 'moving right', 'balanced'))
    const m = makeScenario(mk(cfg))!
    const ok = mod.makeSaid(mk(cfg), { steps: m.solution }, 'right')
    expect(ok[0]).toMatch(/^With the push at \d+ N the resultant is 0 N: the forces are balanced\.$/)
    expect(ok.join(' ')).toMatch(/keeps moving at a steady speed/)
    const bad = mod.makeSaid(mk(cfg), { steps: m.start }, 'wrong')
    expect(bad[0]).toMatch(new RegExp(`^You set the push to ${m.start * 5} N, which makes a resultant of \\d+ N to the (?:left|right)\\.$`))
    expect(bad[1]).toBe('The aim was balanced forces: a resultant of 0 N.')
    const rest = read(make('box', 'at rest', 'balanced'))
    const r = makeScenario(mk(rest))!
    expect(mod.makeSaid(mk(rest), { steps: r.solution }, 'right').join(' ')).toMatch(/stays at rest/)
  })

  it('f-ma: the working in the card’s numbers, for each quantity', () => {
    const mod = { resultantSaid, makeSaid, fmaSaid }
    for (const [find, re] of [
      ['acceleration', /^a = F ÷ m = \d+ N ÷ \d+ kg = [\d.]+ m\/s²\.$/],
      ['force', /^F = m × a = \d+ kg × [\d.]+ m\/s² = \d+ N\.$/],
      ['mass', /^m = F ÷ a = \d+ N ÷ [\d.]+ m\/s² = \d+ kg\.$/],
      ['weight', /^W = m × g = \d+ kg × 9\.8 N\/kg = [\d.]+ N\.$/],
    ] as const) {
      const cfg = read(fma(find, 'box', undefined, 2))
      const lines = mod.fmaSaid(fm(cfg), engine.solve(cfg), 'right')
      expect(lines[1], find).toMatch(re)
    }
    const cfg = read(fma('acceleration', 'box', undefined, 2))
    expect(mod.fmaSaid(fm(cfg), { answer: 'lots' }, 'wrong')[0]).toMatch(/could not be read/)
    expect(mod.fmaSaid(fm(cfg), { answer: '7' }, 'wrong')[0]).toMatch(/^You gave 7 m\/s²\./)
  })
})

// ---------------------------------------------------------------------------
// The picture: pure layout, held to the bar for every card.

type Seg = { a: Pt; b: Pt }
const rectDist = (r: Rect, p: Pt) => Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.y0 - p.y, 0, p.y - r.y1))
/** The nearest a label's box comes to an arrow's line, by walking along it. */
const labelToArrow = (r: Rect, s: Seg): number => {
  let best = Infinity
  const n = Math.max(1, Math.ceil(Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)))
  for (let i = 0; i <= n; i++) best = Math.min(best, rectDist(r, { x: s.a.x + ((s.b.x - s.a.x) * i) / n, y: s.a.y + ((s.b.y - s.a.y) * i) / n }))
  return best
}
const segDist = (s: Seg, t: Seg): number => {
  let best = Infinity
  const n = Math.max(1, Math.ceil(Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)))
  const m = Math.max(1, Math.ceil(Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y)))
  for (let i = 0; i <= n; i++) {
    const p = { x: s.a.x + ((s.b.x - s.a.x) * i) / n, y: s.a.y + ((s.b.y - s.a.y) * i) / n }
    for (let j = 0; j <= m; j++) best = Math.min(best, Math.hypot(p.x - (t.a.x + ((t.b.x - t.a.x) * j) / m), p.y - (t.a.y + ((t.b.y - t.a.y) * j) / m)))
  }
  return best
}
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const inside = (r: Rect, w: number, h: number, pad = 0) => r.x0 >= pad && r.y0 >= pad && r.x1 <= w - pad && r.y1 <= h - pad

const specsOf = (fs: readonly Force[], adjust?: number): Spec[] =>
  fs.map((x) => ({ id: x.id, name: x.name, value: `${x.n} N`, way: x.way, steps: x.steps, role: x.side, adjustable: x.id === adjust }))

function checkLayout(layout: Layout, px: number, label: string) {
  const { w, h } = layout
  expect(w, label).toBe(CARD_W)
  const segs = layout.arrows.map((a) => ({ a: a.tail, b: a.tip }))
  layout.arrows.forEach((a, i) => {
    // Arrows to scale, inside the card, and out of the object.
    expect(Math.abs(a.tip.x - a.tail.x) + Math.abs(a.tip.y - a.tail.y), `${label} length`).toBeCloseTo(a.steps * px, 5)
    for (const p of [a.tail, a.tip]) {
      expect(p.x, label).toBeGreaterThanOrEqual(4)
      expect(p.x, label).toBeLessThanOrEqual(w - 4)
      expect(p.y, label).toBeGreaterThanOrEqual(4)
      expect(p.y, label).toBeLessThanOrEqual(h - 4)
    }
    // A label sits inside the card, clear of the object, and holds its text.
    expect(inside(a.label, w, h, 4), `${label} label ${a.name} ${JSON.stringify(a.label)}`).toBe(true)
    expect(overlap(a.label, layout.box), `${label} label on object`).toBe(false)
    expect(a.label.x1 - a.label.x0, label).toBeGreaterThanOrEqual(Math.max(textW(a.name, 12), textW(a.value, 14, true)))
    expect(a.label.y1 - a.label.y0, label).toBe(LABEL_H)
    // Every label is nearer its own arrow than any other arrow.
    const own = labelToArrow(a.label, segs[i])
    segs.forEach((s, j) => { if (j !== i) expect(own, `${label} ${a.name} label nearer another arrow`).toBeLessThan(labelToArrow(a.label, s)) })
    // No label lies over another arrow (head room of 6).
    segs.forEach((s, j) => { if (j !== i) expect(labelToArrow(a.label, s), `${label} label over arrow`).toBeGreaterThan(6) })
    layout.arrows.forEach((b, j) => { if (j > i) expect(overlap(a.label, b.label), `${label} labels overlap`).toBe(false) })
  })
  // Arrows are apart.
  segs.forEach((s, i) => segs.forEach((t, j) => { if (j > i) expect(segDist(s, t), `${label} arrows apart`).toBeGreaterThanOrEqual(14) }))
  if (layout.result) {
    const r = layout.result
    expect(inside(r.label, w, h, 4), `${label} result label`).toBe(true)
    expect(overlap(r.label, layout.box), `${label} result label on object`).toBe(false)
    for (const p of [r.tail, r.tip]) {
      expect(p.x, label).toBeGreaterThanOrEqual(4)
      expect(p.x, label).toBeLessThanOrEqual(w - 4)
      expect(p.y, label).toBeLessThanOrEqual(h - 4)
    }
    segs.forEach((s, i) => {
      expect(labelToArrow(r.label, s), `${label} result label over arrow ${i}`).toBeGreaterThan(6)
      expect(labelToArrow(layout.arrows[i].label, { a: r.tail, b: r.tip }), `${label} arrow label over the resultant`).toBeGreaterThan(6)
      if (!r.zero) expect(segDist(s, { a: r.tail, b: r.tip }), `${label} resultant apart`).toBeGreaterThanOrEqual(14)
    })
    if (!r.zero) expect(Math.abs(r.tip.x - r.tail.x) + Math.abs(r.tip.y - r.tail.y), `${label} resultant length`).toBeCloseTo(r.steps * px, 5)
  }
  if (layout.scale) {
    const sc = layout.scale
    expect(Math.min(sc.x0, sc.x1), label).toBeGreaterThanOrEqual(4)
    expect(Math.max(sc.y0, sc.y1) + 6, label).toBeLessThanOrEqual(h)
    expect(sc.tx + textW(sc.text, 12), label).toBeLessThanOrEqual(w - 4)
    const box: Rect = { x0: sc.x0 - 5, y0: Math.min(sc.y0, sc.y1) - 5, x1: sc.tx + textW(sc.text, 12), y1: Math.max(sc.y0, sc.y1) + 6 }
    expect(overlap(box, layout.box), `${label} scale on object`).toBe(false)
    for (const a of layout.arrows) expect(overlap(box, a.label), `${label} scale on label`).toBe(false)
    if (layout.result) expect(overlap(box, layout.result.label), `${label} scale on resultant label`).toBe(false)
    segs.forEach((s) => expect(labelToArrow(box, s), `${label} scale on arrow`).toBeGreaterThan(2))
    if (layout.result && !layout.result.zero) expect(labelToArrow(box, { a: layout.result.tail, b: layout.result.tip }), `${label} scale on resultant`).toBeGreaterThan(2)
  }
  expect(overlap(layout.box, { x0: 0, y0: 0, x1: 0, y1: 0 }), label).toBe(false)
  expect(layout.box.x0).toBeGreaterThanOrEqual(0)
  expect(layout.box.x1).toBeLessThanOrEqual(w)
  expect(layout.box.y1).toBeLessThanOrEqual(h)
}

describe('the picture of the forces', { timeout: 60_000 }, () => {
  const valid = resultantGrid().filter((g) => expectValid(g.object, g.motion, g.result, g.forces))

  it('keeps every arrow and label of every resultant card inside the card and apart, each label by its own arrow, marked or not', () => {
    for (const g of valid) {
      const s = resultantScenario(rt(g.cfg))!
      const t = truthOf(s)
      for (const marked of [false, true]) {
        const layout = layoutScene(s.scene, specsOf(s.forces), {
          scaleBar: true,
          keepResult: true,
          result: marked ? { steps: t.size / s.scene.unit, way: t.way, value: `${t.size} N` } : null,
        })
        checkLayout(layout, s.scene.px, `${JSON.stringify(g.cfg)} ${marked ? 'marked' : 'idle'}`)
        expect(layout.result !== null).toBe(marked)
      }
    }
  })

  it('keeps a make card’s picture clean at every length of the learner’s force, marked or not', () => {
    for (const object of OBJ) {
      for (const aim of ['balanced', object === 'skydiver' ? '200 N upwards' : '10 N to the right']) {
        for (const forces of [undefined, 3, 4]) {
          const cfg = read(make(object, object === 'skydiver' ? undefined : 'moving right', aim, forces))
          const m = makeScenario(mk(cfg))
          if (!m) continue
          const [lo, hi] = makeRange(m)
          for (let k = lo; k <= hi; k++) {
            const fs = makeForces(m, k)
            const net = fs.reduce((a, x) => a + x.sign * x.n, 0)
            for (const marked of [false, true]) {
              const layout = layoutScene(m.scene, specsOf(fs, m.adjust), {
                scaleBar: true,
                keepResult: true,
                result: marked ? { steps: Math.abs(net) / m.scene.unit, way: net === 0 ? 'none' : m.scene.axis === 'horizontal' ? (net > 0 ? 'right' : 'left') : net > 0 ? 'up' : 'down', value: `${Math.abs(net)} N` } : null,
              })
              checkLayout(layout, m.scene.px, `${JSON.stringify(cfg)} k=${k} ${marked}`)
            }
          }
        }
      }
    }
  })

  it('keeps an f-ma card’s picture clean', () => {
    for (const object of OBJ) {
      const s = SCENES[object]
      for (const way of s.axis === 'horizontal' ? (['left', 'right'] as const) : (['down'] as const)) {
        const spec: Spec = { id: 0, name: 'Resultant force', value: '6000 N', way, steps: Math.min(s.hi, Math.round(90 / s.px)), role: 'with' }
        checkLayout(layoutScene(s, [spec], { scaleBar: false, keepResult: false }), s.px, `${object} ${way}`)
        checkLayout(layoutScene(s, [], { scaleBar: false, keepResult: false }), s.px, `${object} bare`)
      }
    }
  })

  it('draws arrows in proportion: twice the force is twice the length, across a card', () => {
    for (const g of valid) {
      const s = resultantScenario(rt(g.cfg))!
      const layout = layoutScene(s.scene, specsOf(s.forces), { scaleBar: true, keepResult: true })
      const lens = layout.arrows.map((a) => Math.abs(a.tip.x - a.tail.x) + Math.abs(a.tip.y - a.tail.y))
      layout.arrows.forEach((a, i) => {
        const n = s.forces[i].n
        expect(lens[i] / n, JSON.stringify(g.cfg)).toBeCloseTo(s.scene.px / s.scene.unit, 8)
        expect(a.value).toBe(`${n} N`)
      })
    }
  })

  it('puts the right arrows on the right side: the ones that point right start at the right of the object', () => {
    for (const g of valid.slice(0, 400)) {
      const s = resultantScenario(rt(g.cfg))!
      const layout = layoutScene(s.scene, specsOf(s.forces), { scaleBar: true, keepResult: true })
      layout.arrows.forEach((a) => {
        if (s.scene.axis === 'horizontal') {
          expect(a.way === 'right' ? a.tail.x >= layout.box.x1 : a.tail.x <= layout.box.x0, JSON.stringify(g.cfg)).toBe(true)
          expect(a.way === 'right' ? a.tip.x > a.tail.x : a.tip.x < a.tail.x).toBe(true)
        } else {
          expect(a.way === 'up' ? a.tip.y < a.tail.y && a.tail.y <= layout.box.y0 : a.tip.y > a.tail.y && a.tail.y >= layout.box.y1, JSON.stringify(g.cfg)).toBe(true)
        }
      })
    }
  })

  it('has labels wide enough for the longest name and value, within the room beside the object', () => {
    const longest = Math.max(...OBJ.flatMap((o) => SCENES[o].slots.map((s) => textW(s.name, 12))), textW('Resultant force', 12))
    expect(longest + 6).toBeLessThanOrEqual(124)
    expect(textW('12000 N', 14, true) + 6).toBeLessThanOrEqual(124)
  })
})

// ---------------------------------------------------------------------------

describe('the prompt a forces card is written with', () => {
  const faults = (c: ForcesConfig, prompt: string) => engine.promptFaults!(c, prompt)
  const car = read(resultant('car', 'moving right', 'slows down', 3))
  const carForces = resultantScenario(rt(car))!.forces
  const carTruth = truthOf(resultantScenario(rt(car))!)

  it('resultant: may ask the question, and may not name balanced or what the motion does', () => {
    for (const p of [
      'Find the resultant force on the car, then say what happens to its motion.',
      'What is the resultant force? What does it do to the car?',
      'Work out the resultant of these forces and say whether the car speeds up, slows down or keeps a steady speed.',
      'Look at the forces on the car. Give the size and direction of the resultant.',
    ]) expect(faults(car, p), p).toEqual([])
    for (const p of [
      'The forces on the car are unbalanced. Find the resultant.',
      'Are the forces balanced? Find the resultant.',
      'The car is at terminal velocity. Find the resultant.',
    ]) expect(faults(car, p).join(' '), p).toMatch(/uses the word/)
    for (const p of [
      'The car slows down. Find the resultant force.',
      'Find the resultant. Does the car speed up?',
      'The car keeps a steady speed. Why?',
    ]) expect(faults(car, p).join(' '), p).toMatch(/names what the motion does/)
  })

  it('resultant: may not give the resultant, its direction or the method, nor values the engine did not choose', () => {
    const big = `${carTruth.size}`
    expect(faults(car, `The resultant force is ${big} N. Say what happens.`).join(' ')).toMatch(new RegExp(`gives the resultant \\(${big} N\\)`))
    expect(faults(car, `The net force is ${big} N; what does it do?`).join(' ')).toMatch(/gives the resultant/)
    expect(faults(car, 'The resultant force acts to the left. Say what the car does.').join(' ')).toMatch(/gives the resultant's direction/)
    expect(faults(car, 'Subtract the smaller forces from the larger to find the resultant.').join(' ')).toMatch(/gives the method \("Subtract"\)/)
    expect(faults(car, 'Add up the forces to the left and take away those to the right.').join(' ')).toMatch(/gives the method/)
    expect(faults(car, 'The driving force is 99999 N. Find the resultant.').join(' ')).toMatch(/but the card's forces are/)
    // A force the card does draw may be named.
    expect(faults(car, `The ${carForces[0].name.toLowerCase()} is ${carForces[0].n} N. Find the resultant.`)).toEqual([])
  })

  it('resultant: the prompt must fit the picture’s object and its start', () => {
    expect(faults(car, 'A boat is travelling. Find the resultant.').join(' ')).toMatch(/is about a boat, but the card draws a car/)
    expect(faults(car, 'A box is pushed. Find the resultant.').join(' ')).toMatch(/about a box/)
    expect(faults(car, 'The car is moving left. Find the resultant.').join(' ')).toMatch(/but the card starts moving to the right/)
    expect(faults(car, 'The car is at rest. Find the resultant.').join(' ')).toMatch(/at rest, but the card starts moving to the right/)
    expect(faults(car, 'The car is moving right. Find the resultant.')).toEqual([])
    expect(faults(read(resultant('box', 'at rest', 'speeds up')), 'The box is moving left. Find the resultant.').join(' ')).toMatch(/starts at rest/)
  })

  it('make: may name the aim, and may not give the force to set nor the method', () => {
    const c = read(make('box', 'moving right', 'balanced'))
    const m = makeScenario(mk(c))!
    for (const p of [
      'Drag the end of the push arrow until the forces on the box are balanced.',
      'Set the push so that the resultant force is zero.',
      'Make the box keep moving at a steady speed by choosing the push.',
    ]) expect(faults(c, p), p).toEqual([])
    const sol = m.solution * 5
    expect(faults(c, `Set the push to ${sol} N.`).join(' ')).toMatch(new RegExp(`gives the force to set \\(${sol} N\\)`))
    expect(faults(c, 'Make the push equal to the friction.').join(' ')).toMatch(/gives the method/)
    expect(faults(c, 'Make the push as big as the friction.').join(' ')).toMatch(/gives the method/)
    expect(faults(c, 'The forces must cancel each other out.').join(' ')).toMatch(/gives the method/)
    expect(faults(c, 'Set the push to 4000 N.').join(' ')).toMatch(/but the card's fixed forces are/)
    expect(faults(c, 'A car is moving. Drag the arrow.').join(' ')).toMatch(/about a car/)
    // The aim may be said, with its own number.
    const aimed = read(make('car', 'moving right', '400 N to the right'))
    expect(faults(aimed, 'Set the driving force so the resultant is 400 N to the right.')).toEqual([])
  })

  it('f-ma: may ask for the quantity, and may not give the equation, the method’s name, the answer or other numbers', () => {
    const c = read(fma('acceleration', 'car', undefined, 2))
    const x = fmaCase(fm(c))!
    for (const p of [
      'A resultant force acts on the car. Work out its acceleration.',
      'What is the acceleration of the car?',
      `The car has a mass of ${x.m} kg and a resultant force of ${x.F} N. Find its acceleration.`,
    ]) expect(faults(c, p), p).toEqual([])
    for (const p of [
      'Use F = ma to find the acceleration.',
      'Use F=ma.',
      'Acceleration is force divided by mass.',
      'Remember a = F ÷ m.',
      "Apply Newton's second law.",
      'Multiply the mass by the acceleration.',
      'force = mass × acceleration',
    ]) expect(faults(c, p).join(' '), p).toMatch(/gives the method/)
    const ans = fmtRat(x.answer)
    expect(faults(c, `The acceleration is ${ans} m/s². Check it.`).join(' ')).toMatch(/gives the answer/)
    expect(faults(c, `The car has a mass of ${x.m + 7} kg. Find its acceleration.`).join(' ')).toMatch(/but the card's mass is different/)
    expect(faults(c, `The force is ${x.F! + 7} N. Find the acceleration.`).join(' ')).toMatch(/resultant force is different/)
    const w = read(fma('weight', 'box', 9.8, 3))
    expect(faults(w, 'Use W = mg to work out the weight.').join(' ')).toMatch(/gives the method/)
    expect(faults(w, 'Take g as 10 N/kg and find the weight.').join(' ')).toMatch(/but the card's g is different/)
    expect(faults(w, 'Take g as 9.8 N/kg and find the weight.')).toEqual([])
    expect(faults(w, 'Work out the weight of the car.').join(' ')).toMatch(/about a car/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('forces')!
    // Each example's prompt, then its config by matching braces.
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"/g)].map((m) => {
      const from = e.prompt.indexOf('"config": ', m.index!) + '"config": '.length
      let depth = 0
      let end = from
      for (; end < e.prompt.length; end++) {
        if (e.prompt[end] === '{') depth++
        if (e.prompt[end] === '}' && --depth === 0) break
      }
      return { prompt: m[1], config: JSON.parse(e.prompt.slice(from, end + 1)) }
    })
    expect(found.length).toBeGreaterThanOrEqual(4)
    expect(new Set(found.map((f) => f.config.task.kind))).toEqual(new Set(['resultant', 'make', 'f-ma']))
    for (const ex of found) {
      const c = e.parse(ex.config)!
      expect(c, ex.prompt).not.toBeNull()
      expect(e.faults(c), ex.prompt).toEqual([])
      expect(e.promptFaults!(c, ex.prompt), ex.prompt).toEqual([])
      expect(validateSpec({ pattern: 'scene', prompt: ex.prompt, payload: { engine: 'forces', config: ex.config }, success: { kind: 'scene' } }), ex.prompt).toBe(true)
      // And a card that can be solved.
      expect(e.check(c, e.solve(c)).ok, ex.prompt).toBe(true)
      expect(e.check(c, e.initial(c)).ok, ex.prompt).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------

describe('the catalogue entry', () => {
  it('is registered for the tutor, with its config and every task kind in orbit’s format', () => {
    expect(getEngine('forces')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/^SCENE "forces"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"engine":"forces"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:forces"/)
    expect(engine.prompt).toMatch(/"isolates":"magnitude"/)
    for (const kind of ['resultant', 'make', 'f-ma']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    for (const o of OBJ) expect(engine.prompt).toContain(o)
    for (const f of FINDS) expect(engine.prompt).toContain(f)
  })

  it('says plainly what the card shows and what it keeps until it is marked', () => {
    expect(engine.prompt).toMatch(/drawn TO SCALE/)
    expect(engine.prompt).toMatch(/prints no resultant, no acceleration and no weight of its own before the card is marked/)
    expect(engine.prompt).toMatch(/Whether the forces are balanced, the resultant, and the working are held back\s+until marked/)
    expect(engine.prompt).toMatch(/shows no running resultant/)
    expect(engine.prompt).toMatch(/The equation and the answer are held back until marked/)
    expect(engine.prompt).toMatch(/Not for: forces in two\s+dimensions or at angles, terminal velocity graphs, momentum and collisions, moments, circular motion/)
  })

  it('is an activity whose intent is magnitude', () => {
    const spec = { pattern: 'scene', prompt: 'Find the resultant.', payload: { engine: 'forces', config: resultant('box', 'moving right', 'balanced') }, success: { kind: 'scene' } }
    expect(validateSpec(spec)).toBe(true)
    expect(dimensionsOf(spec as never)).toEqual(['magnitude'])
    expect(checkIntent({ goal: 'g', isolates: 'magnitude', apparatus: 'scene:forces', why: 'w' }, spec as never).ok).toBe(true)
    expect(validateSpec({ ...spec, payload: { engine: 'forces', config: 'resultant' } })).toBe(false)
  })

  it('is offered to the stations it is for, and not to those that merely share a word', () => {
    for (const station of [
      'Balanced and unbalanced forces', 'Balanced forces', 'Unbalanced forces and motion', 'Resultant force', 'The resultant force on an object',
      'Force and acceleration', 'Forces and acceleration: F = ma', 'Forces and motion', "Newton's first law of motion", "Newton's second law", 'Mass and weight',
      'Gravitational field strength and weight',
    ]) expect(scenesFor(station).map((x) => x.id), station).toContain('forces')
    for (const station of [
      'Intermolecular forces', 'Market forces', 'Balanced diet', 'Resultant of vectors in maths', 'Forces between molecules', 'Balanced equations',
      'Forces of nature in geography', 'Forces: effects of forces on springs', 'Weight loss and nutrition', 'Acceleration of free fall', 'Friction in machines',
      'Newton rings', 'The first law of thermodynamics', 'Second World War', 'Momentum', 'Moments and levers', 'Circular motion', 'Gravity and orbits',
      'Speed, velocity and acceleration', 'Distance-time graphs', 'Resultant colour of mixing light', 'Vectors', 'Equivalent fractions', 'Magnetic fields',
    ]) expect(scenesFor(station).map((x) => x.id), station).not.toContain('forces')
    // No bare word that other ideas use.
    for (const bare of ['forces', 'force', 'weight', 'mass', 'acceleration', 'friction', 'balanced', 'resultant', 'newton', 'motion']) expect(engine.covers).not.toContain(bare)
    for (const station of ['Equivalent fractions', 'Changes of state: what happens when ice melts', 'Drawing a line graph', 'Linear equations: solving 2x + 3 = 11'])
      expect(sceneCatalogue(station), station).not.toContain('SCENE "forces"')
    expect(sceneCatalogue('Balanced and unbalanced forces')).toContain('SCENE "forces"')
    expect(sceneCatalogue('Resultant force')).toContain('SCENE "forces"')
  })

  it('is refused by the meaning gates for a config it cannot draw, and for a prompt that gives the answer', () => {
    const action = (config: unknown, prompt = 'Find the resultant.') =>
      ({ type: 'createActivity', id: 'f1', spec: { pattern: 'scene', prompt, payload: { engine: 'forces', config }, success: { kind: 'scene' } } })
    expect(meaningFaults(action(resultant('car', 'moving right', 'slows down')))).toEqual([])
    expect(meaningFaults(action(resultant('car', 'at rest', 'balanced'))).join(' ')).toMatch(/A car cannot start "at rest" here/)
    expect(meaningFaults(action(resultant('car', 'moving right', 'balanced'), 'The forces are balanced. Find the resultant.')).join(' ')).toMatch(/uses the word "balanced"/)
    expect(meaningFaults(action(make('box', 'moving right', '22 N to the right'))).join(' ')).toMatch(/steps of 5 N/)
    expect(meaningFaults(action(fma('acceleration', 'car'), 'Use F = ma to find the acceleration.')).join(' ')).toMatch(/gives the method/)
    expect(meaningFaults(action(fma('weight', 'box', 9.8), 'Work out the weight.'))).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('the forces scene on the board', { timeout: 60_000 }, () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'forces', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (c: ForcesConfig, state: unknown, marked: SceneMarked, reduced = false) =>
    renderToStaticMarkup(createElement(ForcesView, { config: c, state: state as never, setState: () => {}, marked, reduced, locked: marked === 'right' || marked === 'shown' }))
  /** What a person or a screen reader is given: visible text, and the labels read aloud. */
  const said = (html: string) => ({
    texts: [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]).join(' | '),
    aloud: [...html.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((m) => m[1]).join(' | '),
  })

  const CAR = read(resultant('car', 'moving right', 'slows down', 3))
  const BOX = read(resultant('box', 'at rest', 'speeds up', 4))
  const SKY = read(resultant('skydiver', undefined, 'balanced'))
  const MAKE = read(make('box', 'moving right', 'balanced'))
  const MAKE_V = read(make('skydiver', undefined, '200 N upwards'))
  const FMA = read(fma('acceleration', 'car', undefined, 2))

  it('resultant: draws the object, the forces with names and sizes, a scale, and three questions', () => {
    const html = card(CAR, 'Find the resultant force on the car, then say what happens to its motion.')
    const s = resultantScenario(rt(CAR))!
    expect(html).toContain('Starts moving to the right')
    for (const f of s.forces) {
      expect(html).toContain(`>${f.name}<`)
      expect(html).toContain(`>${f.n} N<`)
    }
    expect(html).toMatch(/= 800 N/)
    expect(html).toContain('Arrows are drawn to the scale shown.')
    expect(html).toContain('Only the forces along the line are drawn: up and down, the weight and the support balance.')
    expect(html).toContain('Resultant force')
    expect(html).toContain('Direction of the resultant')
    expect(html).toContain('What happens to its motion?')
    expect((html.match(/role="radiogroup"/g) ?? []).length).toBe(2)
    expect((html.match(/role="radio"/g) ?? []).length).toBe(6)
    expect(html).toContain('>Left<')
    expect(html).toContain('>No direction<')
    expect(html).toContain('>Right<')
    expect(html).toContain('>Stays at rest or keeps a steady speed<')
    expect(html).toContain('>Speeds up<')
    expect(html).toContain('>Slows down<')
    expect(html).toMatch(/inputMode="decimal"/)
    expect((html.match(/aria-checked="true"/g) ?? []).length).toBe(0)
    // One stop on Tab for each group.
    expect((html.match(/role="radio"[^>]*tabindex="0"|tabindex="0"[^>]*role="radio"/g) ?? []).length).toBe(2)
    const sky = view(SKY, engine.initial(SKY), 'idle')
    expect(sky).toContain('>Up<')
    expect(sky).toContain('>Down<')
    expect(sky).not.toContain('>Left<')
  })

  it('resultant: names no answer before it is marked, even to a screen reader', () => {
    for (const c of [CAR, BOX, SKY, read(resultant('boat', 'moving left', 'balanced', 3)), read(resultant('box', 'moving right', 'slows down', 4))]) {
      const prompt = 'Find the resultant force, then say what happens to the motion.'
      const html = card(c, prompt)
      const { texts, aloud } = said(html.replace(prompt, ''))
      const all = `${texts} ${aloud}`
      const s = resultantScenario(rt(c))!
      const t = truthOf(s)
      // The picture holds the forces and the fields hold the questions; nothing holds an answer.
      expect(all, JSON.stringify(c)).not.toMatch(/balanced|unbalanced|The resultant force is|You said|difference|starts to move|keeps moving|stays at rest\.|no resultant|Forces to the/)
      expect(aloud, JSON.stringify(c)).not.toMatch(/resultant/i)
      expect(html, JSON.stringify(c)).not.toContain(RESULT_GREEN)
      expect(html).not.toMatch(/stroke-dasharray="6 4"/)
      void t
    }
  })

  it('resultant: draws the resultant and says everything once marked, and leaves the picks standing', () => {
    const s = resultantScenario(rt(CAR))!
    const t = truthOf(s)
    const state = { size: String(t.size + 200), way: 'right', change: 'faster' }
    const wrong = view(CAR, state, 'wrong')
    expect(wrong).toContain(RESULT_GREEN)
    expect(wrong).toContain('>Resultant<')
    expect(wrong).toContain(`>${t.size} N<`)
    expect(wrong).toContain(`You said a resultant of ${t.size + 200} N to the right, and that the car speeds up.`)
    expect(wrong).toContain(`The resultant force is ${t.size} N to the left.`)
    expect(wrong).toMatch(/aria-checked="true"/)
    expect(wrong).toMatch(new RegExp(`value="${t.size + 200}"`))
    // Wrong leaves it open to change; right puts the controls away.
    expect(wrong).not.toMatch(/aria-readonly="true"/)
    const right = view(CAR, engine.solve(CAR), 'right')
    expect(right).toMatch(/aria-disabled="true"/)
    expect(right).toMatch(/readonly=""/)
    expect(right).toContain('so it slows down.')
    const zero = view(read(resultant('box', 'moving left', 'balanced')), engine.solve(read(resultant('box', 'moving left', 'balanced'))), 'right')
    expect(zero).toContain('>0 N<')
    expect(zero).toContain('no resultant force')
  })

  it('resultant: sets a chosen option inline, so it looks chosen against the base style', () => {
    const html = view(CAR, { size: '', way: 'left', change: 'slower' }, 'idle')
    const chosen = [...html.matchAll(/<button[^>]*aria-checked="true"[^>]*>/g)].map((m) => m[0])
    expect(chosen.length).toBe(2)
    for (const b of chosen) {
      expect(b).toMatch(/style="[^"]*border-color:var\(--subject\)/)
      // The chosen look is not carried by classes that the base's border-ss-line would beat.
      expect(b).not.toMatch(/class="[^"]*(?<![:\w-])border-\[color:var\(--subject\)\]/)
    }
    const unchosen = [...html.matchAll(/<button[^>]*aria-checked="false"[^>]*>/g)].map((m) => m[0])
    for (const b of unchosen) expect(b).not.toMatch(/style=/)
  })

  it('lays the options out the same for every card, so the order says nothing', () => {
    const order = (c: ForcesConfig) => [...view(c, engine.initial(c), 'idle').matchAll(/role="radio"[^>]*>([^<]*)</g)].map((m) => m[1])
    const first = order(CAR)
    expect(first).toEqual(['Left', 'No direction', 'Right', 'Stays at rest or keeps a steady speed', 'Speeds up', 'Slows down'])
    for (const c of [BOX, read(resultant('boat', 'moving left', 'balanced')), read(resultant('car', 'moving left', 'speeds up'))]) expect(order(c)).toEqual(first)
    expect(order(SKY)).toEqual(['Up', 'No direction', 'Down', 'Stays at rest or keeps a steady speed', 'Speeds up', 'Slows down'])
    // Many cards: the tab stops are the first of each group while nothing is picked.
    for (const g of resultantGrid().filter((x) => expectValid(x.object, x.motion, x.result, x.forces)).slice(0, 60)) {
      const stops = [...view(g.cfg, engine.initial(g.cfg), 'idle').matchAll(/<button[^>]*tabindex="0"[^>]*>([^<]*)</g)].map((m) => m[1])
      expect(stops.length).toBe(2)
      expect(stops[1]).toBe('Stays at rest or keeps a steady speed')
    }
  })

  it('make: draws a slider on the end of the learner’s arrow, with the aim, and no resultant of its own', () => {
    const html = card(MAKE, 'Drag the end of the push arrow until the forces on the box are balanced.')
    const m = makeScenario(mk(MAKE))!
    expect(html).toContain('Starts moving to the right')
    expect(html).toContain('Aim: balanced forces: a resultant of 0 N')
    expect(html).toContain('role="slider"')
    expect(html).toMatch(/tabindex="0"[^>]*>|role="slider"[^>]*tabindex="0"/)
    expect(html).toContain('touch-none')
    expect(html).toContain(`aria-valuemin="${3 * 5}"`)
    expect(html).toContain(`aria-valuemax="${11 * 5}"`)
    expect(html).toContain(`aria-valuenow="${m.start * 5}"`)
    expect(html).toContain(`aria-valuetext="${m.start * 5} newtons to the right"`)
    expect(html).toContain('>Shorter<')
    expect(html).toContain('>Longer<')
    expect(html).toContain('one step is 5 N')
    // The learner's force is shown at its start, as the control reads, never at the answer.
    expect(html).toContain(`>${m.start * 5} N<`)
    expect(html).not.toContain(`aria-valuenow="${m.solution * 5}"`)
    const { texts, aloud } = said(html.replace('Drag the end of the push arrow until the forces on the box are balanced.', ''))
    expect(`${texts} ${aloud}`).not.toMatch(/You set|The aim was|With the push|keeps moving|difference|resultant is/)
    expect(html).not.toContain(RESULT_GREEN)
    expect(html).not.toMatch(/stroke-dasharray="6 4"/)
  })

  it('make: shows the length the state holds, and puts the controls away once solved', () => {
    const m = makeScenario(mk(MAKE))!
    const other = m.start === 5 ? 6 : 5
    const html = view(MAKE, { steps: other }, 'idle')
    expect(html).toContain(`aria-valuenow="${other * 5}"`)
    expect(html).toContain(`>${other * 5} N<`)
    const wrong = view(MAKE, { steps: other }, 'wrong')
    expect(wrong).toContain(`You set the push to ${other * 5} N`)
    expect(wrong).toContain('The aim was balanced forces: a resultant of 0 N.')
    expect(wrong).toContain(RESULT_GREEN)
    const right = view(MAKE, { steps: m.solution }, 'right')
    expect(right).toContain(`With the push at ${m.solution * 5} N the resultant is 0 N: the forces are balanced.`)
    expect(right).toMatch(/aria-readonly="true"/)
    expect(right).toMatch(/tabindex="-1"/)
    expect(right).not.toContain('>Shorter<')
    expect(right).not.toContain('Drag the ring')
    expect(right).not.toContain('touch-none')
  })

  it('make: a vertical card is a slider up and down, and a left-pointing arrow is set by its own side', () => {
    const v = view(MAKE_V, engine.initial(MAKE_V), 'idle')
    expect(v).toContain('aria-orientation="vertical"')
    expect(v).toContain('Aim: a resultant of 200 N upwards')
    expect(v).toContain('role="slider"')
    expect(v).toMatch(/aria-valuetext="\d+ newtons upwards"/)
    const left = read(make('car', 'moving left', 'balanced'))
    expect(view(left, engine.initial(left), 'idle')).toMatch(/aria-valuetext="\d+ newtons to the left"/)
  })

  it('f-ma: shows the givens and the object, asks for one number, and holds back the answer and the equation', () => {
    const html = card(FMA, 'A resultant force acts on the car. Work out its acceleration.')
    const x = fmaCase(fm(FMA))!
    expect(html).toContain(`Mass: ${x.m} kg`)
    expect(html).toContain(`Resultant force: ${x.F} N`)
    expect(html).toContain('Acceleration (m/s²)')
    expect(html).toContain('Type a number. You may add m/s².')
    expect(html).toContain('The arrow shows the resultant force on it.')
    expect(html).toMatch(/inputMode="decimal"/)
    const { texts, aloud } = said(html.replace('A resultant force acts on the car. Work out its acceleration.', ''))
    expect(`${texts} ${aloud}`).not.toMatch(/÷|×|F = |a = |m = |W = |Acceleration: |You gave/)
    expect(`${texts} ${aloud}`).not.toContain(`${fmtRat(x.answer)} m/s`)
    const w = card(read(fma('weight', 'box', 9.8, 3)), 'Work out the weight of the box.')
    expect(w).toContain('g = 9.8 N/kg')
    expect(w).toContain('Weight (N)')
    expect(w).toContain('Only the object is drawn.')
    const force = card(read(fma('force', 'box', undefined, 1)), 'Work out the resultant force.')
    expect(force).toContain('Only the object is drawn.')
    expect(force).toMatch(/Acceleration: [\d.]+ m\/s² to the (?:left|right)/)
    const mass = view(read(fma('mass', 'boat', undefined, 1)), {}, 'idle')
    expect(mass).toContain('Mass (kg)')
    expect(mass).not.toMatch(/Mass: /)
  })

  it('f-ma: says the working once marked, and keeps the typed answer', () => {
    const x = fmaCase(fm(FMA))!
    const wrong = view(FMA, { answer: String(x.F! * x.m) }, 'wrong')
    expect(wrong).toContain(`a = F ÷ m = ${x.F} N ÷ ${x.m} kg = ${fmtRat(x.answer)} m/s².`)
    expect(wrong).toContain('That is force × mass.')
    expect(wrong).toContain(`value="${x.F! * x.m}"`)
    const right = view(FMA, engine.solve(FMA), 'right')
    expect(right).toContain(`Acceleration: ${fmtRat(x.answer)} m/s².`)
    expect(right).toMatch(/readonly=""/)
    expect(right).toContain('The acceleration is in the direction of the resultant force')
  })

  it('names no answer before marking on any card in the grid', () => {
    for (const g of resultantGrid().filter((x) => expectValid(x.object, x.motion, x.result, x.forces))) {
      const html = view(g.cfg, engine.initial(g.cfg), 'idle')
      expect(html, JSON.stringify(g.cfg)).not.toMatch(/You said|The resultant force is|so it (speeds|slows)|difference|Forces to the|no resultant/)
    }
    for (const c of [MAKE, MAKE_V, FMA, read(fma('force', 'box', undefined, 3)), read(fma('mass', 'car', undefined, 3)), read(fma('weight', 'skydiver', 10, 3))]) {
      const html = view(c, engine.initial(c), 'idle')
      expect(html, JSON.stringify(c)).not.toMatch(/You (set|gave|said)|The aim was|With the |÷|×|difference/)
    }
  })

  it('still draws a state it cannot read, as the start', () => {
    for (const c of [CAR, MAKE, FMA]) {
      for (const bad of [null, undefined, 'junk', 7, { size: 5, way: 3, change: [], steps: 'x', answer: {} }, { size: 'x'.repeat(500), way: 'sideways', change: 'maybe', steps: 9999, answer: 'y'.repeat(300) }]) {
        expect(() => view(c, bad, 'idle'), `${JSON.stringify(c)} ${JSON.stringify(bad)}`).not.toThrow()
        expect(() => view(c, bad, 'wrong'), `${JSON.stringify(c)} ${JSON.stringify(bad)}`).not.toThrow()
      }
    }
  })

  it('draws a config it cannot show as a plain message, not a crash', () => {
    expect(view(read(resultant('car', 'at rest', 'balanced')), {}, 'idle')).toContain('This card could not be drawn.')
    expect(view(read({ task: { kind: 'make', object: 'box', target: 'wobble' } }), {}, 'idle')).toContain('This card could not be drawn.')
    expect(view(read({ task: { kind: 'f-ma' } }), {}, 'idle')).toContain('This card could not be drawn.')
    expect(view(read(make('box', 'moving right', '500 N to the right')), {}, 'idle')).toContain('This card could not be drawn.')
    expect(() => view(read(resultant('box', 'at rest', 'slows down')), {}, 'wrong')).not.toThrow()
  })

  it('has no text smaller than 12 px, no text split mid-word, and no capitalising by CSS', () => {
    for (const c of [CAR, BOX, SKY, MAKE, MAKE_V, FMA, read(fma('weight', 'skydiver', 10, 1))]) {
      for (const marked of ['idle', 'wrong', 'right'] as const) {
        const html = view(c, marked === 'right' ? engine.solve(c) : engine.initial(c), marked)
        for (const m of html.matchAll(/font-size[:=]"?(\d+(?:\.\d+)?)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
        for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
        expect(html).not.toMatch(/break-all|break-words|capitalize|truncate/)
      }
    }
  })

  it('moves nothing under reduced motion because nothing moves by itself', () => {
    for (const c of [CAR, MAKE, MAKE_V, FMA]) {
      for (const marked of ['idle', 'wrong'] as const) {
        const html = view(c, engine.initial(c), marked, true)
        expect(html).not.toMatch(/animate|transition|keyframes|<animate/)
      }
    }
  })

  it('keeps the arrow keys for the card and gives a controls a touch target', () => {
    const html = view(CAR, engine.initial(CAR), 'idle')
    expect(html).toContain('nodrag')
    expect(html).toMatch(/min-h-\[44px\]/)
    const make_ = view(MAKE, engine.initial(MAKE), 'idle')
    expect(make_).toMatch(/min-h-\[44px\]/)
    expect(make_).toContain('nodrag')
    // The slider has a hit area bigger than the ring on its end.
    expect(make_).toMatch(/<rect [^>]*height="44"[^>]*fill="transparent"|<rect [^>]*fill="transparent"[^>]*height="44"|<rect [^>]*width="44"[^>]*fill="transparent"/)
  })

  it('hashes the same text to the same number, and different text to different', () => {
    expect(hashOf('abc')).toBe(hashOf('abc'))
    expect(hashOf('abc')).not.toBe(hashOf('abd'))
  })
})

const RESULT_GREEN = '#047857'

// Keep the imports honest.
export type { Layout }
void getEngine
void sceneCatalogue
