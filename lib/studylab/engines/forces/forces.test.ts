import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  forcesEngine as engine, FINDS, OBJECTS, SCENES,
  eqRat, fmaCase, fmaSaid, fmtRat, fmtTenths, hashOf, makeForces, makeRange, makeSaid, makeScenario, rat, readNumber, readTarget, resultantSaid,
  resultantScenario, stepForKey, truthOf,
  type ForcesConfig, type ForcesState, type Force, type MakeTask, type ResultantTask, type FmaTask, type ObjectId,
} from './config'
import { CARD_W, ForcesView, LABEL_H, layoutScene, resultantStepsFromPoint, specsOf, stepsFromPoint, textW, type Layout, type Pt, type Rect, type Spec } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { dimensionsOf } from '../../activities/dimensions'
import { checkIntent } from '../../activities/intent'

vi.spyOn(console, 'error').mockImplementation(() => {})

const OBJ = [...OBJECTS] as ObjectId[]
const MOTIONS = ['at rest', 'moving left', 'moving right', 'moving down', 'moving up']
const RESULTS = ['balanced', 'speeds up', 'slows down']

const resultant = (object: string, motion: string | undefined, result: string, forces?: number, variant?: number): ForcesConfig =>
  ({ task: { kind: 'resultant', object, ...(motion ? { motion } : {}), result, ...(forces ? { forces } : {}), ...(variant ? { variant } : {}) } } as never)
const make = (object: string, motion: string | undefined, target: unknown, forces?: number, variant?: number): ForcesConfig =>
  ({ task: { kind: 'make', object, ...(motion ? { motion } : {}), target, ...(forces ? { forces } : {}), ...(variant ? { variant } : {}) } } as never)
const fma = (find: string, object?: string, g?: number, variant?: number): ForcesConfig =>
  ({ task: { kind: 'f-ma', find, ...(object ? { object } : {}), ...(g ? { g } : {}), ...(variant ? { variant } : {}) } } as never)

const read = (raw: unknown): ForcesConfig => {
  const c = engine.parse(raw)
  if (!c) throw new Error(`could not read ${JSON.stringify(raw)}`)
  return c
}
const faultsOf = (raw: unknown): string[] => engine.faults(read(raw))
const rt = (c: ForcesConfig) => c.task as ResultantTask
const mk = (c: ForcesConfig) => c.task as MakeTask
const fm = (c: ForcesConfig) => c.task as FmaTask

function dice(seed: number) {
  let s = seed >>> 0
  const next = () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296
  }
  return { int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)), one: <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)] }
}

type Plain = { way: string; n: number }
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
      expect(resultantScenario(rt(g.cfg)) !== null, JSON.stringify(g.cfg)).toBe(should)
      if (should) valid++
    }
    expect(valid).toBeGreaterThan(250)
  })

  it('says why a car cannot start at rest, a box cannot slow at rest, and a skydiver must fall', () => {
    expect(faultsOf(resultant('car', 'at rest', 'balanced')).join(' ')).toMatch(/A car cannot start "at rest" here/)
    expect(faultsOf(resultant('box', 'at rest', 'slows down')).join(' ')).toMatch(/A box at rest cannot slow down/)
    expect(faultsOf(resultant('skydiver', 'moving up', 'balanced')).join(' ')).toMatch(/already falling, with weight and air resistance/)
    expect(faultsOf(resultant('car', 'moving right', 'balanced', 4)).join(' ')).toMatch(/The car card holds 2 or 3 forces, not 4/)
    expect(faultsOf(resultant('skydiver', undefined, 'speeds up', 3)).join(' ')).toMatch(/The skydiver card holds 2 forces, not 3/)
    expect(faultsOf(resultant('box', undefined, 'balanced')).join(' ')).toMatch(/Say how it starts/)
    expect(faultsOf({ task: { kind: 'resultant', object: 'box', motion: 'at rest' } }).join(' ')).toMatch(/Say what the forces do/)
    expect(faultsOf({ task: { kind: 'resultant', motion: 'at rest', result: 'balanced' } }).join(' ')).toMatch(/Say what the forces act on/)
    expect(faultsOf(resultant('skydiver', undefined, 'slows down'))).toEqual([])
    expect(faultsOf({ task: { kind: 'resultant', object: 'box', motion: 'at rest', result: 'balanced', variant: 123 } }).join(' ')).toMatch(/not a whole number from 0 to 99/)
  })

  it('make: refuses an aim the object cannot draw to scale, with one that works', () => {
    expect(faultsOf(make('box', 'moving right', 'balanced'))).toEqual([])
    expect(faultsOf(make('box', 'moving right', '20 N to the right'))).toEqual([])
    expect(faultsOf(make('box', 'moving right', '20 N to the left'))).toEqual([])
    expect(faultsOf(make('car', 'moving right', '400 N to the right'))).toEqual([])
    const off = faultsOf(make('box', 'moving right', '22 N to the right')).join(' ')
    expect(off).toMatch(/22 N is not a size the box card can draw to scale/)
    expect(faultsOf(make('car', 'moving right', '450 N to the right')).join(' ')).toMatch(/steps of 200 N/)
    expect(faultsOf(make('box', 'moving right', '20 N upwards')).join(' ')).toMatch(/works left and right/)
    expect(faultsOf(make('skydiver', undefined, '200 N to the left')).join(' ')).toMatch(/works up and down/)
    expect(faultsOf({ task: { kind: 'make', object: 'box' } }).join(' ')).toMatch(/Say the aim/)
    expect(faultsOf(make('car', 'at rest', 'balanced')).join(' ')).toMatch(/cannot start "at rest"/)
  })

  it('make: an aim too big to reach is refused with the largest that works', () => {
    const huge = faultsOf(make('box', 'moving right', '500 N to the right')).join(' ')
    expect(huge).toMatch(/No forces can be dealt that meet that aim/)
    expect(huge).toMatch(/Use e\.g\. "5 N to the right"/)
    for (const c of [make('box', 'moving right', '500 N to the right'), make('car', 'moving left', '6000 N to the left'), make('skydiver', undefined, '3000 N upwards'), make('boat', 'moving right', '4000 N to the right')]) {
      const said = faultsOf(c).join(' ')
      const e = /Use e\.g\. "([^"]+)"/.exec(said)
      expect(e, said).not.toBeNull()
      if (e![1] === 'balanced') continue
      const fixed = { task: { ...(c.task as object), target: e![1] } }
      expect(faultsOf(fixed), `${said} -> ${e![1]}`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// The engine's maths: one truth for every card.

describe('resultant property', { timeout: 60_000 }, () => {
  const valid = resultantGrid().filter((g) => expectValid(g.object, g.motion, g.result, g.forces))

  it('deals a scenario for every valid card, whose net force and change are right by plain addition', () => {
    for (const g of valid) {
      const s = resultantScenario(rt(g.cfg))!
      expect(s, JSON.stringify(g.cfg)).not.toBeNull()
      const net = plainNet(s.forces)
      const t = truthOf(s)
      expect(t.size, JSON.stringify(g.cfg)).toBe(Math.abs(net))
      const change = plainChange(motionWay(g.motion ?? 'moving down'), net)
      expect(t.change, `${JSON.stringify(g.cfg)} net=${net}`).toBe(change)
    }
  })

  it('is initially unsolved and can be solved', () => {
    for (const g of valid) {
      const s = engine.initial(g.cfg)
      expect(engine.check(g.cfg, s).ok, JSON.stringify(g.cfg)).toBe(false)
      const solved = engine.solve(g.cfg)
      expect(engine.check(g.cfg, solved).ok, JSON.stringify(g.cfg)).toBe(true)
    }
  })

  it('accepts the right answer and rejects wrong ones', () => {
    const d = dice(42)
    for (const g of valid) {
      const s = resultantScenario(rt(g.cfg))!
      const t = truthOf(s)
      const right: ForcesState = { size: String(t.size), way: t.way, change: t.change }
      expect(engine.check(g.cfg, right).ok, JSON.stringify(g.cfg)).toBe(true)
      const wrong = { size: String(t.size + s.scene.unit), way: t.way, change: t.change }
      expect(engine.check(g.cfg, wrong).ok, JSON.stringify(g.cfg)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------

describe('make property', { timeout: 60_000 }, () => {
  it('deals a scenario for every valid make card and can solve it', () => {
    for (const object of OBJ) {
      for (const aim of ['balanced', object === 'skydiver' ? '200 N upwards' : '10 N to the right', object === 'skydiver' ? '300 N downwards' : '15 N to the left']) {
        for (const forces of [undefined, 3, 4]) {
          const raw = make(object, object === 'skydiver' ? undefined : 'moving right', aim, forces)
          const cfg = engine.parse(raw)
          if (!cfg || engine.faults(cfg).length > 0) continue
          const m = makeScenario(mk(cfg))
          expect(m, JSON.stringify(raw)).not.toBeNull()
          if (!m) continue
          const solved = engine.solve(cfg)
          expect(engine.check(cfg, solved).ok, JSON.stringify(raw)).toBe(true)
          expect(engine.check(cfg, engine.initial(cfg)).ok, JSON.stringify(raw)).toBe(false)
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('how force is set', () => {
  it('arrow keys step in the right direction for each axis and outward', () => {
    expect(stepForKey('ArrowRight', 1, 'horizontal')).toBe(1)
    expect(stepForKey('ArrowLeft', 1, 'horizontal')).toBe(-1)
    expect(stepForKey('ArrowRight', -1, 'horizontal')).toBe(-1)
    expect(stepForKey('ArrowUp', 1, 'vertical')).toBe(1)
    expect(stepForKey('ArrowDown', 1, 'vertical')).toBe(-1)
    expect(stepForKey('ArrowUp', -1, 'vertical')).toBe(-1)
    expect(stepForKey('a', 1, 'horizontal')).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('f-ma property', { timeout: 60_000 }, () => {
  it('deals an f-ma case for every valid card and can solve it', () => {
    for (const find of FINDS) {
      for (const object of [...OBJ, undefined]) {
        for (const g of [undefined, 9.8, 10]) {
          for (const variant of [0, 1, 2, 5]) {
            const raw = fma(find, object, g, variant)
            const cfg = engine.parse(raw)
            if (!cfg || engine.faults(cfg).length > 0) continue
            const c = fmaCase(fm(cfg))
            expect(c, JSON.stringify(raw)).not.toBeNull()
            if (!c) continue
            const solved = engine.solve(cfg)
            expect(engine.check(cfg, solved).ok, JSON.stringify(raw)).toBe(true)
            expect(engine.check(cfg, engine.initial(cfg)).ok, JSON.stringify(raw)).toBe(false)
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('said back', () => {
  it('resultant: says what the learner gave and what the truth is', () => {
    const c = read(resultant('car', 'moving right', 'slows down', 3))
    const s = resultantScenario(rt(c))!
    const t = truthOf(s)
    const wrong = resultantSaid(rt(c), { size: String(t.size + 200), way: 'right', change: 'faster' }, 'wrong')
    expect(wrong.join(' ')).toContain('You said')
    expect(wrong.join(' ')).toContain('The resultant force is')
    const right = resultantSaid(rt(c), engine.solve(c), 'right')
    expect(right.join(' ')).toContain('The resultant force is')
  })

  it('make: says what the learner set and the aim', () => {
    const c = read(make('box', 'moving right', 'balanced'))
    const m = makeScenario(mk(c))!
    const wrong = makeSaid(mk(c), { steps: m.start }, 'wrong')
    expect(wrong.join(' ')).toContain('You set the push to')
    expect(wrong.join(' ')).toContain('The aim was')
    const right = makeSaid(mk(c), { steps: m.solution }, 'right')
    expect(right.join(' ')).toContain('With the push at')
  })

  it('f-ma: says the working and the equation', () => {
    const c = read(fma('acceleration', 'car', undefined, 2))
    const x = fmaCase(fm(c))!
    const wrong = fmaSaid(fm(c), { answer: String(x.F! * x.m) }, 'wrong')
    expect(wrong.join(' ')).toContain('a = F ÷ m')
    const right = fmaSaid(fm(c), engine.solve(c), 'right')
    expect(right.join(' ')).toContain(`${fmtRat(x.answer)} m/s²`)
  })
})

// ---------------------------------------------------------------------------
// The picture: pure layout, held to the bar for every card.

type Seg = { a: Pt; b: Pt }
const rectDist = (r: Rect, p: Pt) => Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.y0 - p.y, 0, p.y - r.y1))
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

function checkLayout(layout: Layout, px: number, label: string) {
  const { w, h } = layout
  expect(w, label).toBe(CARD_W)
  const segs = layout.arrows.map((a) => ({ a: a.tail, b: a.tip }))
  layout.arrows.forEach((a, i) => {
    expect(Math.abs(a.tip.x - a.tail.x) + Math.abs(a.tip.y - a.tail.y), `${label} length`).toBeCloseTo(a.steps * px, 5)
    for (const p of [a.tail, a.tip]) {
      expect(p.x, label).toBeGreaterThanOrEqual(4)
      expect(p.x, label).toBeLessThanOrEqual(w - 4)
      expect(p.y, label).toBeGreaterThanOrEqual(4)
      expect(p.y, label).toBeLessThanOrEqual(h - 4)
    }
    expect(inside(a.label, w, h, 4), `${label} label ${a.name} ${JSON.stringify(a.label)}`).toBe(true)
    expect(overlap(a.label, layout.box), `${label} label on object`).toBe(false)
    expect(a.label.x1 - a.label.x0, label).toBeGreaterThanOrEqual(Math.max(textW(a.name, 12), textW(a.value, 14, true)))
    expect(a.label.y1 - a.label.y0, label).toBe(LABEL_H)
    const own = labelToArrow(a.label, segs[i])
    segs.forEach((s, j) => { if (j !== i) expect(own, `${label} ${a.name} label nearer another arrow`).toBeLessThan(labelToArrow(a.label, s)) })
    segs.forEach((s, j) => { if (j !== i) expect(labelToArrow(a.label, s), `${label} label over arrow`).toBeGreaterThan(6) })
    layout.arrows.forEach((b, j) => { if (j > i) expect(overlap(a.label, b.label), `${label} labels overlap`).toBe(false) })
  })
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

  it('draws arrows in proportion: twice the force is twice the length', () => {
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

  it('the resultant drag maps pointer coords to signed steps correctly', () => {
    const center = { x: 180, y: 100 }
    expect(resultantStepsFromPoint(center, { x: 220, y: 100 }, 10, 'horizontal', 4)).toBe(4)
    expect(resultantStepsFromPoint(center, { x: 140, y: 100 }, 10, 'horizontal', 4)).toBe(-4)
    expect(resultantStepsFromPoint(center, { x: 185, y: 100 }, 10, 'horizontal', 4)).toBe(1)
    expect(resultantStepsFromPoint(center, { x: 180, y: 100 }, 10, 'horizontal', 4)).toBe(0)
    expect(resultantStepsFromPoint(center, { x: 180, y: 60 }, 10, 'vertical', 4)).toBe(4)
    expect(resultantStepsFromPoint(center, { x: 180, y: 140 }, 10, 'vertical', 4)).toBe(-4)
    expect(resultantStepsFromPoint(center, { x: 9999, y: 100 }, 10, 'horizontal', 4)).toBe(4)
    expect(resultantStepsFromPoint(center, { x: -9999, y: 100 }, 10, 'horizontal', 4)).toBe(-4)
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
      expect(e.check(c, e.solve(c)).ok, ex.prompt).toBe(true)
      expect(e.check(c, e.initial(c)).ok, ex.prompt).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------

describe('the catalogue entry', () => {
  it('is registered for the tutor, with its config and every task kind', () => {
    // Both forces/ and forces-next/ register id 'forces'; the lead swaps the folder, so
    // only one is live. Here we check our own engine object, not which one the registry holds.
    expect(engine.id).toBe('forces')
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

describe('the forces-next scene on the board', { timeout: 60_000 }, () => {
  const view = (c: ForcesConfig, state: unknown, marked: SceneMarked, reduced = false) =>
    renderToStaticMarkup(createElement(ForcesView, { config: c, state: state as never, setState: () => {}, marked, reduced, locked: marked === 'right' || marked === 'shown' }))
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

  it('resultant: draws the object, the forces with names and sizes, a scale, a drag handle and a motion choice', () => {
    // Rendered directly (not through ActivityNode) because both forces/ and forces-next/
    // register id 'forces', and the import chain may load the old View.
    const html = view(CAR, engine.initial(CAR), 'idle')
    const s = resultantScenario(rt(CAR))!
    expect(html).toContain('Starts moving to the right')
    for (const f of s.forces) {
      expect(html).toContain(`>${f.name}<`)
      expect(html).toContain(`>${f.n} N<`)
    }
    expect(html).toMatch(/= 800 N/)
    expect(html).toContain('Arrows are drawn to the scale shown.')
    expect(html).toContain('Only the forces along the line are drawn: up and down, the weight and the support balance.')
    expect(html).toContain('Drag the green handle to set the resultant force.')
    // One slider for the resultant, one radiogroup for the motion change.
    expect(html).toContain('role="slider"')
    expect((html.match(/role="radiogroup"/g) ?? []).length).toBe(1)
    expect((html.match(/role="radio"/g) ?? []).length).toBe(3)
    expect(html).toContain('>Stays at rest or keeps a steady speed<')
    expect(html).toContain('>Speeds up<')
    expect(html).toContain('>Slows down<')
    // No text input on the resultant card — the drag replaces it.
    expect(html).not.toMatch(/inputMode="decimal"/)
    // Tab stops: the slider + the first radio of the change group.
    const stops = [...html.matchAll(/tabindex="0"/g)]
    expect(stops.length).toBeGreaterThanOrEqual(2)
  })

  it('resultant: the slider reports its value via ARIA', () => {
    const c = CAR
    const s = resultantScenario(rt(c))!
    const html = view(c, { size: String(s.scene.unit * 2), way: 'right' }, 'idle')
    expect(html).toMatch(/aria-valuenow/)
    expect(html).toMatch(/aria-valuetext="[^"]*newtons/)
    // The initial state has "not set"
    const initial = view(c, {}, 'idle')
    expect(initial).toContain('aria-valuetext="not set"')
  })

  it('resultant: a vertical card uses up-down orientation', () => {
    const html = view(SKY, engine.initial(SKY), 'idle')
    expect(html).toContain('aria-orientation="vertical"')
    expect(html).toContain('>Up<')
    expect(html).toContain('>Down<')
    expect(html).not.toContain('>Left<')
  })

  it('resultant: names no answer before it is marked, even to a screen reader', () => {
    for (const c of [CAR, BOX, SKY, read(resultant('boat', 'moving left', 'balanced', 3)), read(resultant('box', 'moving right', 'slows down', 4))]) {
      const html = view(c, engine.initial(c), 'idle')
      const { texts, aloud } = said(html)
      const all = `${texts} ${aloud}`
      expect(all, JSON.stringify(c)).not.toMatch(/balanced|unbalanced|The resultant force is|You said|difference|starts to move|keeps moving|stays at rest\.|no resultant|Forces to the/)
      expect(all, JSON.stringify(c)).not.toMatch(/resultant is \d/)
      expect(html).not.toMatch(/stroke-dasharray="6 4"/)
    }
  })

  it('resultant: draws the truth and says everything once marked', () => {
    const s = resultantScenario(rt(CAR))!
    const t = truthOf(s)
    const state = { size: String(t.size + 200), way: 'right', change: 'faster' }
    const wrong = view(CAR, state, 'wrong')
    expect(wrong).toContain('>Resultant<')
    expect(wrong).toContain(`>${t.size} N<`)
    expect(wrong).toContain(`You said a resultant of ${t.size + 200} N to the right, and that the car speeds up.`)
    expect(wrong).toContain(`The resultant force is ${t.size} N to the left.`)
    const right = view(CAR, engine.solve(CAR), 'right')
    expect(right).toMatch(/aria-disabled="true"/)
    expect(right).toContain('so it slows down.')
    const zero = view(read(resultant('box', 'moving left', 'balanced')), engine.solve(read(resultant('box', 'moving left', 'balanced'))), 'right')
    expect(zero).toContain('>0 N<')
    expect(zero).toContain('no resultant force')
  })

  it('resultant: sets a chosen option inline, so it looks chosen against the base style', () => {
    const html = view(CAR, { size: '', way: '', change: 'slower' }, 'idle')
    const chosen = [...html.matchAll(/<button[^>]*aria-checked="true"[^>]*>/g)].map((m) => m[0])
    expect(chosen.length).toBe(1)
    for (const b of chosen) {
      expect(b).toMatch(/style="[^"]*border-color:var\(--subject\)/)
      expect(b).not.toMatch(/class="[^"]*(?<![:\w-])border-\[color:var\(--subject\)\]/)
    }
    const unchosen = [...html.matchAll(/<button[^>]*aria-checked="false"[^>]*>/g)].map((m) => m[0])
    for (const b of unchosen) expect(b).not.toMatch(/style=/)
  })

  it('resultant: the motion change options are in the same order for every card', () => {
    const order = (c: ForcesConfig) => [...view(c, engine.initial(c), 'idle').matchAll(/role="radio"[^>]*>([^<]*)</g)].map((m) => m[1])
    const first = order(CAR)
    expect(first).toEqual(['Stays at rest or keeps a steady speed', 'Speeds up', 'Slows down'])
    for (const c of [BOX, read(resultant('boat', 'moving left', 'balanced')), read(resultant('car', 'moving left', 'speeds up'))]) expect(order(c)).toEqual(first)
    expect(order(SKY)).toEqual(first)
  })

  it('make: draws a slider on the end of the learner’s arrow, with the aim, and no resultant of its own', () => {
    const html = view(MAKE, engine.initial(MAKE), 'idle')
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
    expect(html).toContain(`>${m.start * 5} N<`)
    expect(html).not.toContain(`aria-valuenow="${m.solution * 5}"`)
    const { texts, aloud } = said(html)
    expect(`${texts} ${aloud}`).not.toMatch(/You set|The aim was|With the push|keeps moving|difference|resultant is/)
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
    const right = view(MAKE, { steps: m.solution }, 'right')
    expect(right).toContain(`With the push at ${m.solution * 5} N the resultant is 0 N: the forces are balanced.`)
    expect(right).toMatch(/aria-readonly="true"/)
    expect(right).toMatch(/tabindex="-1"/)
    expect(right).not.toContain('>Shorter<')
    expect(right).not.toContain('touch-none')
  })

  it('make: a vertical card is a slider up and down', () => {
    const v = view(MAKE_V, engine.initial(MAKE_V), 'idle')
    expect(v).toContain('aria-orientation="vertical"')
    expect(v).toContain('Aim: a resultant of 200 N upwards')
    expect(v).toContain('role="slider"')
    expect(v).toMatch(/aria-valuetext="\d+ newtons upwards"/)
    const left = read(make('car', 'moving left', 'balanced'))
    expect(view(left, engine.initial(left), 'idle')).toMatch(/aria-valuetext="\d+ newtons to the left"/)
  })

  it('f-ma: shows the givens and the object, asks for one number, and holds back the answer and the equation', () => {
    const html = view(FMA, engine.initial(FMA), 'idle')
    const x = fmaCase(fm(FMA))!
    expect(html).toContain(`Mass: ${x.m} kg`)
    expect(html).toContain(`Resultant force: ${x.F} N`)
    expect(html).toContain('Acceleration (m/s²)')
    expect(html).toContain('Type a number. You may add m/s².')
    expect(html).toContain('The arrow shows the resultant force on it.')
    expect(html).toMatch(/inputMode="decimal"/)
    const { texts, aloud } = said(html)
    expect(`${texts} ${aloud}`).not.toMatch(/÷|×|F = |a = |m = |W = |Acceleration: |You gave/)
    expect(`${texts} ${aloud}`).not.toContain(`${fmtRat(x.answer)} m/s`)
    const w = view(read(fma('weight', 'box', 9.8, 3)), {}, 'idle')
    expect(w).toContain('g = 9.8 N/kg')
    expect(w).toContain('Weight (N)')
    expect(w).toContain('Only the object is drawn.')
    const force = view(read(fma('force', 'box', undefined, 1)), {}, 'idle')
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

  it('keeps the arrow keys for the card and gives controls a touch target', () => {
    const html = view(CAR, engine.initial(CAR), 'idle')
    expect(html).toContain('nodrag')
    expect(html).toMatch(/min-h-\[44px\]/)
    const make_ = view(MAKE, engine.initial(MAKE), 'idle')
    expect(make_).toMatch(/min-h-\[44px\]/)
    expect(make_).toContain('nodrag')
    expect(make_).toMatch(/<rect [^>]*height="44"[^>]*fill="transparent"|<rect [^>]*fill="transparent"[^>]*height="44"|<rect [^>]*width="44"[^>]*fill="transparent"/)
  })

  it('the View’s layout constants agree with config.ts values used there as literals', () => {
    expect(CARD_W).toBe(360)
    expect(LABEL_H).toBe(32)
  })

  it('hashes the same text to the same number, and different text to different', () => {
    expect(hashOf('abc')).toBe(hashOf('abc'))
    expect(hashOf('abc')).not.toBe(hashOf('abd'))
  })
})

export type { Layout }
void getEngine
void sceneCatalogue
