// lib/studylab/engines/counters-place-value/counters-place-value.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  countersPlaceValueEngine as engine, apply, blocksText, exchangeTarget, placesOf, readNumbers, saidWhenRight, saidWhenWrong,
  standard, startOf, valueOf, BUILD_CAP, CAP,
  type Blocks, type CountersConfig, type CountersState, type Move, type Place,
} from './config'
import { CountersPlaceValueView, pileHeight, spots } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { checkIntent } from '../../activities/intent'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Base-ten blocks on a place-value mat: the tutor names a number (or two), the
 * engine draws flats, rods and cubes, counts every column and marks what the
 * learner builds, puts together, takes away and exchanges.
 */

const parse = (task: Record<string, unknown>) => engine.parse({ task })!
const make = (number: number, way: 'fewest' | 'any' = 'fewest') => parse({ kind: 'make', number, way })
const add = (a: number, b: number) => parse({ kind: 'add', numbers: [a, b] })
const subtract = (a: number, b: number) => parse({ kind: 'subtract', numbers: [a, b] })
const exchange = (number: number, counts: { hundreds?: number; tens?: number }) => parse({ kind: 'exchange', number, ...counts })

/** A move the learner can make, or the test fails with the reason it was refused. */
function run(c: CountersConfig, s: CountersState, m: Move): CountersState {
  const r = apply(c, s, m)
  if ('refused' in r) throw new Error(`${JSON.stringify(c.task)} ${JSON.stringify(m)} refused: ${r.refused}`)
  return r.next
}

/** Builds n block by block with the + buttons: on the mat, or on a number being built. */
function build(c: CountersConfig, s: CountersState, n: number, row?: number): CountersState {
  const d = standard(n)
  for (const p of [0, 1, 2] as Place[]) for (let k = 0; k < d[p]; k++) s = run(c, s, { kind: 'add', place: p, ...(row !== undefined ? { row } : {}) })
  return s
}

/** add, as a child does it: build both, put them together, then swap ten for one wherever a column has ten or more. */
function walkAdd(c: CountersConfig): CountersState {
  const [a, b] = (c.task as { numbers: [number, number] }).numbers
  let s = build(c, build(c, engine.initial(c), a, 0), b, 1)
  s = run(c, s, { kind: 'join' })
  while (s.mat[2] >= 10) s = run(c, s, { kind: 'bundle', place: 2 })
  while (s.mat[1] >= 10) s = run(c, s, { kind: 'bundle', place: 1 })
  return s
}

/** subtract, as a child does it: build the first number, then column by column break where short and take away. */
function walkSubtract(c: CountersConfig): CountersState {
  const [a, b] = (c.task as { numbers: [number, number] }).numbers
  const away = standard(b)
  let s = run(c, build(c, engine.initial(c), a, 0), { kind: 'join' })
  for (const p of [2, 1, 0] as Place[]) {
    while (s.mat[p] < away[p]) {
      // Short: break one from the next column up, breaking a hundred first if that column is empty too.
      if (s.mat[p - 1] === 0) s = run(c, s, { kind: 'break', place: (p - 2) as Place })
      s = run(c, s, { kind: 'break', place: (p - 1) as Place })
    }
    for (let k = 0; k < away[p]; k++) s = run(c, s, { kind: 'take', place: p })
  }
  return s
}

/** Every arrangement of `n` the exchange buttons reach from the usual one, within the columns' room. */
const reachable = (c: CountersConfig): Blocks[] => reachableFrom(c, engine.initial(c))

/** Every arrangement the exchange buttons reach from a state, within the columns' room. */
function reachableFrom(c: CountersConfig, from: CountersState): Blocks[] {
  const places = placesOf(c)
  const moves: Move[] = places.flatMap((p) => [{ kind: 'bundle', place: p } as Move, { kind: 'break', place: p } as Move])
  const seen = new Map<string, Blocks>()
  const queue: CountersState[] = [from]
  seen.set(queue[0].mat.join(), queue[0].mat)
  while (queue.length) {
    const s = queue.shift()!
    for (const m of moves) {
      const r = apply(c, s, m)
      if ('refused' in r || seen.has(r.next.mat.join())) continue
      seen.set(r.next.mat.join(), r.next.mat)
      queue.push(r.next)
    }
  }
  return [...seen.values()]
}

/** A small seeded generator, so the random configs are the same every run. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sameAs = (a: Blocks, b: Blocks) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
const digitSum = (n: number) => String(n).split('').reduce((t, d) => t + Number(d), 0)

/** Every 2-digit pair, and 400 random pairs reaching into the hundreds. */
function pairs(seed: number): [number, number][] {
  const out: [number, number][] = []
  for (let a = 1; a <= 99; a++) for (let b = 1; b <= 99; b++) out.push([a, b])
  const r = rng(seed)
  for (let i = 0; i < 400; i++) out.push([1 + Math.floor(r() * 999), 1 + Math.floor(r() * 999)])
  out.push([999, 1], [500, 499], [1, 999], [100, 1], [1000 - 1, 999], [305, 98], [300, 1], [900, 99])
  return out
}

describe('the blocks as the engine counts them', () => {
  it('values the blocks by base ten, and writes a number the usual way', () => {
    expect(valueOf([2, 3, 14])).toBe(244)
    expect(standard(47)).toEqual([0, 4, 7])
    expect(standard(305)).toEqual([3, 0, 5])
    expect(standard(999)).toEqual([9, 9, 9])
    for (let n = 0; n <= 999; n++) expect(valueOf(standard(n))).toBe(n)
  })

  it('says blocks in words, leaving out empty columns', () => {
    expect(blocksText([0, 4, 7])).toBe('4 tens and 7 ones')
    expect(blocksText([1, 0, 1])).toBe('1 hundred and 1 one')
    expect(blocksText([2, 13, 4])).toBe('2 hundreds, 13 tens and 4 ones')
    expect(blocksText([0, 1, 0])).toBe('1 ten')
    expect(blocksText([0, 0, 0])).toBe('no blocks')
  })

  it('reads the numbers a text says, in digits or words, and the counts of blocks it gives', () => {
    expect(readNumbers('Add 38 and 25.').numbers).toEqual([38, 25])
    expect(readNumbers('It makes sixty-three.').numbers).toEqual([63])
    expect(readNumbers('one hundred and four, three hundred, nineteen').numbers).toEqual([104, 300, 19])
    expect(readNumbers('Use 4 tens and seven ones.').counts).toEqual([{ n: 4, place: 1 }, { n: 7, place: 2 }])
    expect(readNumbers('a hundred, one ten and ten ones').counts).toEqual([{ n: 1, place: 0, whole: 100 }, { n: 1, place: 1 }, { n: 10, place: 2 }])
    expect(readNumbers('two hundred').counts).toEqual([{ n: 2, place: 0, whole: 200 }])
    expect(readNumbers('Make 47 using tens and ones.').counts).toEqual([])
  })

  it('lays the ones out in ten-frames, the tens in tens, and fans the hundreds', () => {
    // A full ten-frame is two rows of five; the eleventh one starts the next frame.
    const ones = spots(2, 11, 148)
    expect(new Set(ones.slice(0, 10).map((p) => p.y)).size).toBe(2)
    expect(ones[10].x).toBeGreaterThan(ones[4].x)
    // A column holds three rows of ten: in a narrow tens column a row each; in a wide one two groups
    // side by side, the third below. Ones go two ten-frames to a row, the third below the first.
    expect(CAP).toEqual([9, 29, 29])
    expect(pileHeight(1, 19, 136)).toBeGreaterThan(pileHeight(1, 9, 136))
    expect(pileHeight(1, 29, 136)).toBeGreaterThan(pileHeight(1, 19, 136))
    expect(pileHeight(1, 19, 212)).toBe(pileHeight(1, 1, 212))
    expect(pileHeight(1, 21, 212)).toBeGreaterThan(pileHeight(1, 20, 212))
    expect(pileHeight(2, 21, 148)).toBeGreaterThan(pileHeight(2, 20, 148))
    const ones29 = spots(2, 29, 112)
    expect(ones29[20].x).toBe(ones29[0].x)
    expect(ones29[20].y).toBeGreaterThan(ones29[19].y)
    // Every block stays inside its column, and no two overlap, at every count up to the column's room.
    for (const [p, w] of [[0, 112], [1, 136], [1, 212], [2, 112], [2, 148]] as [Place, number][]) {
      const size = p === 0 ? [70, 70] : p === 1 ? [7, 70] : [7, 7]
      for (let n = 1; n <= CAP[p]; n++) {
        const at = spots(p, n, w)
        for (const s of at) {
          expect(s.x, `${p} ×${n} in ${w}`).toBeGreaterThanOrEqual(0)
          expect(s.x + size[0], `${p} ×${n} in ${w}`).toBeLessThanOrEqual(w)
          expect(s.y + size[1], `${p} ×${n} in ${w}`).toBeLessThanOrEqual(pileHeight(p, n, w))
        }
        // Flats are a fanned pile by design; rods and cubes never touch.
        if (p > 0) {
          for (let i = 0; i < at.length; i++) {
            for (let j = i + 1; j < at.length; j++) {
              const apart = Math.abs(at[i].x - at[j].x) >= size[0] + 1 || Math.abs(at[i].y - at[j].y) >= size[1] + 1
              expect(apart, `${p} ×${n} in ${w}: ${i} and ${j}`).toBe(true)
            }
          }
        }
      }
    }
  })
})

describe('the counters-place-value engine', () => {
  it('reads a task however it is reasonably written, and nothing it cannot draw', () => {
    expect(engine.parse({ task: { kind: 'Make', number: '47' } })).toEqual({ task: { kind: 'make', number: 47, way: 'fewest' } })
    expect(engine.parse({ task: { kind: 'make a number', number: 'forty-seven', way: 'any way' } })).toEqual({ task: { kind: 'make', number: 47, way: 'any' } })
    expect(engine.parse({ task: { kind: 'make', n: 300, fewest: false } })).toEqual({ task: { kind: 'make', number: 300, way: 'any' } })
    expect(engine.parse({ task: { kind: 'addition', numbers: [38, '25'] } })).toEqual({ task: { kind: 'add', numbers: [38, 25] } })
    expect(engine.parse({ task: { kind: 'take away', a: 52, b: 17 } })).toEqual({ task: { kind: 'subtract', numbers: [52, 17] } })
    expect(engine.parse({ task: { kind: 'subtractWithRegrouping', numbers: ['fifty-two', 'seventeen'] } })).toEqual({ task: { kind: 'subtract', numbers: [52, 17] } })
    expect(engine.parse({ task: { kind: 'exchange', number: 34, tens: 'two' } })).toEqual({ task: { kind: 'exchange', number: 34, tens: 2 } })
    expect(engine.parse({ task: { kind: 'show another way', number: 234, hundreds: 1 } })).toEqual({ task: { kind: 'exchange', number: 234, hundreds: 1 } })
    for (const bad of [
      { kind: 'make', number: 0 }, { kind: 'make', number: 1000 }, { kind: 'make', number: 4.5 }, { kind: 'make', number: 'lots' },
      { kind: 'make', number: 47, way: 'quickly' }, { kind: 'add', numbers: [38] }, { kind: 'add', numbers: [38, 0] },
      { kind: 'add', numbers: [38, -2] }, { kind: 'subtract', a: 52 }, { kind: 'exchange', number: 34 },
      { kind: 'exchange', number: 34, tens: -1 }, { kind: 'exchange', number: 34, tens: 120 }, { kind: 'multiply', numbers: [3, 4] },
    ]) expect(engine.parse({ task: bad }), JSON.stringify(bad)).toBeNull()
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({})).toBeNull()
  })

  it('shows a hundreds column only when the task reaches 100', () => {
    expect(placesOf(make(47))).toEqual([1, 2])
    expect(placesOf(make(147))).toEqual([0, 1, 2])
    expect(placesOf(add(65, 47))).toEqual([0, 1, 2])
    expect(placesOf(add(38, 25))).toEqual([1, 2])
    expect(placesOf(subtract(52, 17))).toEqual([1, 2])
    expect(placesOf(exchange(234, { tens: 2 }))).toEqual([0, 1, 2])
  })
})

describe('every config, worked through as a child would', { timeout: 30_000 }, () => {
  it('make: every number from 1 to 999, both ways, starts empty and is built with the + buttons', () => {
    for (let n = 1; n <= 999; n++) {
      for (const way of ['fewest', 'any'] as const) {
        const c = make(n, way)
        expect(engine.faults(c)).toEqual([])
        expect(engine.check(c, engine.initial(c)).ok, `${n} ${way} starts solved`).toBe(false)
        expect(engine.check(c, engine.solve(c)).ok, `${n} ${way}`).toBe(true)
        const built = build(c, engine.initial(c), n)
        expect(engine.check(c, built).ok, `${n} ${way} built`).toBe(true)
        expect(built).toEqual(engine.solve(c))
        // Broken down, it is still n: right any way, but not with the fewest blocks.
        if (standard(n)[1] > 0) {
          const broken = run(c, built, { kind: 'break', place: 1 })
          expect(valueOf(broken.mat)).toBe(n)
          expect(engine.check(c, broken).ok, `${n} ${way} broken`).toBe(way === 'any')
        }
      }
    }
  })

  it('make: marks exactly the blocks worth the number, and for "fewest" only the usual way', () => {
    const wrong: string[] = []
    for (const n of [1, 9, 10, 19, 20, 47, 99, 100, 101, 110, 347, 909, 990, 999]) {
      const fewest = make(n, 'fewest')
      const any = make(n, 'any')
      for (let h = 0; h <= CAP[0]; h++) {
        for (let t = 0; t <= CAP[1]; t++) {
          for (let o = 0; o <= CAP[2]; o++) {
            const mat: Blocks = [h, t, o]
            const worth = 100 * h + 10 * t + o === n
            if (engine.check(any, { mat }).ok !== worth) wrong.push(`${n} any ${mat}`)
            if (engine.check(fewest, { mat }).ok !== (worth && h <= 9 && t <= 9 && o <= 9)) wrong.push(`${n} fewest ${mat}`)
          }
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('add: every 2-digit pair and 400 more -- a fault exactly when nothing is regrouped, else built, joined and regrouped to the answer', () => {
    let valid = 0
    for (const [a, b] of pairs(7)) {
      const c = add(a, b)
      const label = `${a} + ${b}`
      const faults = engine.faults(c)
      // Independently: each carry costs the digit sum 9, so a sum regroups exactly when its digit sum falls short.
      const regroups = digitSum(a) + digitSum(b) !== digitSum(a + b)
      const honest = a + b <= 999 && regroups && (a >= 10 || b >= 10)
      expect(faults.length === 0, label).toBe(honest)
      for (const f of faults) expect(f, label).toMatch(/\bchoose\b/i)
      if (!honest) continue
      valid++
      expect(engine.check(c, engine.initial(c)).ok, `${label} starts solved`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, label).toBe(true)
      const done = walkAdd(c)
      expect(engine.check(c, done).ok, `${label} walked`).toBe(true)
      expect(done).toEqual(engine.solve(c))
      // Put together but not yet regrouped is never right.
      const joined = run(c, build(c, build(c, engine.initial(c), a, 0), b, 1), { kind: 'join' })
      expect(engine.check(c, joined).ok, `${label} joined`).toBe(false)
      expect(valueOf(joined.mat)).toBe(a + b)
      // Whatever the learner swaps once they are together, no column ever counts out the total.
      for (const mat of reachableFrom(c, joined)) {
        if (mat.includes(a + b)) throw new Error(`${label}: ${mat} shows the total as a column's count`)
      }
    }
    expect(valid).toBeGreaterThan(4000)
  })

  it('subtract: every 2-digit pair and 400 more -- a fault exactly when nothing is broken or the answer is not positive, else built, broken and taken to the answer', () => {
    let valid = 0
    for (const [a, b] of pairs(11)) {
      const c = subtract(a, b)
      const label = `${a} − ${b}`
      const faults = engine.faults(c)
      // Independently: each break adds 9 to the digit sums' difference.
      const breaks = b < a && digitSum(a) - digitSum(b) !== digitSum(a - b)
      expect(faults.length === 0, label).toBe(breaks)
      for (const f of faults) expect(f, label).toMatch(/\bchoose\b/i)
      if (!breaks) continue
      valid++
      expect(engine.check(c, engine.initial(c)).ok, `${label} starts solved`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, label).toBe(true)
      const done = walkSubtract(c)
      expect(engine.check(c, done).ok, `${label} walked`).toBe(true)
      expect(done).toEqual(engine.solve(c))
      // Built and nothing taken is never right; nor is taking away without breaking where it was needed.
      const started = run(c, build(c, engine.initial(c), a, 0), { kind: 'join' })
      expect(engine.check(c, started).ok, `${label} started`).toBe(false)
    }
    expect(valid).toBeGreaterThan(2000)
  })

  it('exchange: every number, every count of hundreds and tens -- a fault exactly when no other way fits, else the exchange buttons reach it', () => {
    // 350,649 configs (tens 0 to 30, one past a column's room): mismatches are collected and asserted once,
    // as an expect per config is slow.
    let valid = 0
    let configs = 0
    const wrong: string[] = []
    const counts = [undefined, ...Array.from({ length: 31 }, (_, i) => i)]
    for (let n = 1; n <= 999; n++) {
      const usual = standard(n)
      let ways: Blocks[] | null = null
      for (const hundreds of counts.slice(0, 11)) {
        for (const tens of counts) {
          if (hundreds === undefined && tens === undefined) continue
          const c = engine.parse({ task: { kind: 'exchange', number: n, hundreds, tens } })
          const label = `${n} h${hundreds} t${tens}`
          if (!c) { wrong.push(`${label}: not read`); continue }
          configs++
          ways ??= reachable(c)
          // Independently: the arrangements the buttons reach that keep what was named (and, with no tens
          // named, the usual ones), other than the usual one.
          const fits = ways.filter((w) =>
            w[0] === (hundreds ?? usual[0]) && (tens !== undefined ? w[1] === tens : w[2] === usual[2]) && !sameAs(w, usual))
          const faults = engine.faults(c)
          if ((faults.length === 0) !== (fits.length > 0)) wrong.push(`${label}: faults ${JSON.stringify(faults)}, fits ${JSON.stringify(fits)}`)
          for (const f of faults) if (!/\b(choose|ask|name)\b/i.test(f)) wrong.push(`${label}: "${f}" says nothing to do`)
          if (!fits.length) continue
          valid++
          const target = exchangeTarget(c.task as never)
          if (fits.length !== 1 || !target || !sameAs(target, fits[0])) wrong.push(`${label}: target ${JSON.stringify(target)}`)
          if (engine.check(c, engine.initial(c)).ok) wrong.push(`${label}: starts solved`)
          if (!engine.check(c, engine.solve(c)).ok || !sameAs(engine.solve(c).mat, fits[0])) wrong.push(`${label}: solve`)
        }
      }
    }
    expect(wrong.slice(0, 10)).toEqual([])
    expect(configs).toBe(999 * (11 * 32 - 1))
    expect(valid).toBeGreaterThan(3000)
  })

  it('exchange: one or two exchanges fit a column, and the fault says why anything beyond does not', () => {
    // The eval's case: 52 using 3 tens is 3 tens and 22 ones, two tens broken.
    const two = exchange(52, { tens: 3 })
    expect(engine.faults(two)).toEqual([])
    expect(exchangeTarget(two.task as never)).toEqual([0, 3, 22])
    let s = engine.initial(two)
    s = run(two, run(two, s, { kind: 'break', place: 1 }), { kind: 'break', place: 1 })
    expect(engine.check(two, s).ok).toBe(true)
    expect(engine.faults(exchange(234, { hundreds: 0 }))).toEqual([])
    expect(engine.faults(exchange(999, { hundreds: 8, tens: 18 }))).toEqual([])
    // Three exchanges are past a column's room.
    expect(engine.faults(exchange(34, { tens: 0 }))).toEqual([
      'Showing 34 using 0 tens needs 34 ones, and a column holds at most 29. Ask for one or two fewer than usual, such as 34 using 2 tens.',
    ])
    expect(engine.faults(exchange(345, { hundreds: 0 })).join(' ')).toMatch(/needs 34 tens, and a column holds at most 29/)
  })
})

describe('what the learner can and cannot do', () => {
  it('builds a number for adding with at most 9 in a column, and puts the two together only once both are made', () => {
    const c = add(38, 25)
    let s = engine.initial(c)
    expect(apply(c, s, { kind: 'join' })).toEqual({ refused: 'Make 38 and 25 first.' })
    for (let k = 0; k < BUILD_CAP; k++) s = run(c, s, { kind: 'add', place: 2, row: 0 })
    expect(apply(c, s, { kind: 'add', place: 2, row: 0 })).toEqual({ refused: 'No more room for ones.' })
    expect(apply(c, s, { kind: 'add', place: 0, row: 0 })).toEqual({ refused: 'There is no hundreds column here.' })
    s = startOf(c)
    s = run(c, build(c, build(c, s, 38, 0), 25, 1), { kind: 'join' })
    expect(s.mat).toEqual([0, 5, 13])
    // Together, the blocks are only swapped: none added, none taken.
    expect(apply(c, s, { kind: 'add', place: 2 })).toEqual({ refused: 'You can only swap blocks now.' })
    expect(apply(c, s, { kind: 'bundle', place: 1 })).toEqual({ refused: 'There is no hundreds column here.' })
    expect(apply(c, s, { kind: 'bundle', place: 2 })).toMatchObject({ next: { mat: [0, 6, 3] } })
    // Put together, a column holds 19, so breaking a ten with 13 ones out is refused: 23 ones would be
    // more than add's room, which keeps every column's count below the total.
    expect(apply(c, s, { kind: 'break', place: 1 })).toEqual({ refused: 'No room for 10 more ones.' })
    expect(apply(c, run(c, s, { kind: 'bundle', place: 2 }), { kind: 'break', place: 1 })).toMatchObject({ next: { mat: [0, 5, 13] } })
  })

  it('takes away only what is there, and puts back only what was taken', () => {
    const c = subtract(52, 17)
    let s = run(c, build(c, engine.initial(c), 52, 0), { kind: 'join' })
    s = run(c, run(c, s, { kind: 'take', place: 2 }), { kind: 'take', place: 2 })
    expect(apply(c, s, { kind: 'take', place: 2 })).toEqual({ refused: 'There are no ones left to take.' })
    expect(apply(c, s, { kind: 'return', place: 1 })).toEqual({ refused: 'You have not taken any tens.' })
    s = run(c, s, { kind: 'break', place: 1 })
    expect(s.mat).toEqual([0, 4, 10])
    expect(s.taken).toEqual([0, 0, 2])
    expect(valueOf(s.mat) + valueOf(s.taken!)).toBe(52)
  })

  it('keeps the make mat to 999 and each column to its room', () => {
    const c = make(990)
    let s = build(c, engine.initial(c), 990)
    expect(apply(c, s, { kind: 'add', place: 1 })).toEqual({ refused: 'The mat only goes up to 999.' })
    expect(apply(c, s, { kind: 'add', place: 0 })).toEqual({ refused: 'No more room for hundreds.' })
    s = run(c, run(c, s, { kind: 'break', place: 0 }), { kind: 'break', place: 0 })
    expect(s.mat).toEqual([7, 29, 0])
    expect(apply(c, s, { kind: 'break', place: 0 })).toEqual({ refused: 'No room for 10 more tens.' })
    expect(apply(c, s, { kind: 'add', place: 1 })).toEqual({ refused: 'No more room for tens.' })
    expect(apply(c, s, { kind: 'bundle', place: 2 })).toEqual({ refused: 'You need 10 ones to make 1 ten.' })
  })

  it('still reads a saved state it cannot use, as the start', () => {
    const c = add(38, 25)
    expect(engine.check(c, { mat: [9, 99, 'x'] } as never).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { mat: [0, 6, 3], joined: true, parts: [[0, 3, 8], [0, 2, 5]] }).ok).toBe(true)
    expect(engine.check(c, { mat: [0, 6, 3], joined: false }).ok).toBe(false)
  })
})

describe('what the learner is told once marked', () => {
  it('names the answer when right', () => {
    expect(saidWhenRight(add(38, 25), engine.solve(add(38, 25)))).toEqual({ head: '38 + 25 = 63', detail: '6 tens and 3 ones.' })
    expect(saidWhenRight(subtract(52, 17), engine.solve(subtract(52, 17)))).toEqual({ head: '52 − 17 = 35', detail: '3 tens and 5 ones are left.' })
    expect(saidWhenRight(subtract(20, 9), engine.solve(subtract(20, 9))).detail).toBe('1 ten and 1 one are left.')
    expect(saidWhenRight(subtract(110, 100), engine.solve(subtract(110, 100))).detail).toBe('1 ten is left.')
    expect(saidWhenRight(make(47), { mat: [0, 4, 7] }).detail).toBe('47 is 4 tens and 7 ones.')
    expect(saidWhenRight(make(47, 'any'), { mat: [0, 3, 17] }).detail).toBe('47 is 3 tens and 17 ones.')
    expect(saidWhenRight(exchange(34, { tens: 2 }), { mat: [0, 2, 14] }).detail).toBe('34 is 2 tens and 14 ones, too.')
  })

  it('says what the learner made when wrong, and never composes add’s or subtract’s blocks into a number', () => {
    const sum = add(38, 25)
    const joined: CountersState = { mat: [0, 5, 13], parts: [[0, 3, 8], [0, 2, 5]], joined: true }
    expect(saidWhenWrong(sum, joined)).toEqual(['You made 5 tens and 13 ones.', 'You have 13 ones. That is more than 9.'])
    expect(saidWhenWrong(sum, engine.initial(sum))).toEqual(['Make 38 and 25, then put them together.'])
    expect(saidWhenWrong(sum, { ...joined, joined: false })).toEqual(['Put 38 and 25 together.'])
    for (const line of saidWhenWrong(sum, joined)) expect(readNumbers(line).numbers).not.toContain(63)

    const diff = subtract(52, 17)
    expect(saidWhenWrong(diff, { mat: [0, 4, 0], parts: [[0, 5, 2]], joined: true, taken: [0, 1, 2] })).toEqual(['You took away 12, not 17.'])
    expect(saidWhenWrong(diff, { mat: [0, 2, 15], parts: [[0, 5, 2]], joined: true, taken: [0, 1, 7] }))
      .toEqual(['You have 2 tens and 15 ones left.', 'You have 15 ones. That is more than 9.'])

    expect(saidWhenWrong(make(47), { mat: [0, 7, 4] })).toEqual(['You made 74.'])
    expect(saidWhenWrong(make(47), { mat: [0, 3, 17] })).toEqual(['You made 47 with 3 tens and 17 ones.', 'You have 17 ones. That is more than 9. You can use fewer blocks.'])
    expect(saidWhenWrong(exchange(34, { tens: 2 }), { mat: [0, 3, 4] })).toEqual(['You made 34 with 3 tens and 4 ones.'])
  })
})

describe('the prompt a counters-place-value card is written with', () => {
  const faults = (c: CountersConfig, prompt: string) => getEngine('counters-place-value')!.promptFaults!(c, prompt)

  it('may not give add’s total or subtract’s difference, in digits, words, or tens and ones', () => {
    expect(faults(add(38, 25), '38 + 25 = 63. Show it with blocks.').join(' ')).toMatch(/gives the answer away/)
    expect(faults(add(38, 25), 'Add 38 and 25 to make sixty-three.').join(' ')).toMatch(/gives the answer away/)
    expect(faults(add(38, 25), 'Add 38 and 25: you will get 6 tens and 3 ones.').join(' ')).toMatch(/gives the answer away/)
    expect(faults(subtract(52, 17), 'Take 17 from 52 to leave 35.').join(' ')).toMatch(/gives the answer away/)
    expect(faults(subtract(52, 17), 'Show that 52 − 17 is thirty-five.').join(' ')).toMatch(/gives the answer away/)
  })

  it('names the numbers and asks, and may describe them in tens and ones', () => {
    expect(faults(add(38, 25), 'Add 38 and 25 with the blocks.')).toEqual([])
    expect(faults(add(38, 25), 'Make 38 (3 tens and 8 ones) and 25, then put them together and exchange.')).toEqual([])
    expect(faults(subtract(52, 17), 'Take 17 away from 52.')).toEqual([])
    // A number said in words is its name, not its blocks.
    expect(faults(make(300), 'Make three hundred with the fewest blocks.')).toEqual([])
    expect(faults(make(100), 'Make a hundred.')).toEqual([])
    expect(faults(make(347), 'Make 347 using three hundreds.').join(' ')).toMatch(/gives the blocks away/)
  })

  it('may not tell a make task its blocks, or an exchange the count it finds', () => {
    expect(faults(make(47), 'Make 47 with 4 tens and 7 ones.').join(' ')).toMatch(/gives the blocks away/)
    expect(faults(make(47), 'Make 47 using four tens.').join(' ')).toMatch(/gives the blocks away/)
    expect(faults(make(47), 'Make 47. That is 40 and 7.').join(' ')).toMatch(/gives the blocks away/)
    expect(faults(make(47), 'Make 47 with the fewest blocks.')).toEqual([])
    expect(faults(make(47, 'any'), 'Make 47 using only 3 tens and some ones.')).toEqual([])
    expect(faults(exchange(34, { tens: 2 }), 'Show 34 as 2 tens and 14 ones.').join(' ')).toMatch(/says 14 ones/)
    expect(faults(exchange(34, { tens: 2 }), 'Show 34 with 2 tens and fourteen ones.').join(' ')).toMatch(/says 14 ones/)
    expect(faults(exchange(234, { hundreds: 1 }), 'Show 234 as 1 hundred and 13 tens.').join(' ')).toMatch(/says 13 tens/)
    expect(faults(exchange(34, { tens: 2 }), 'Show 34 using only 2 tens.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('counters-place-value')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found.length).toBe(4)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('the catalogue entry', () => {
  it('is registered, with every task kind and an example of each that has no fault', () => {
    expect(getEngine('counters-place-value')).toBe(engine)
    expect(engine.isolates).toBe('quantity')
    expect(engine.prompt).toMatch(/SCENE "counters-place-value"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:counters-place-value"/)
    for (const kind of ['make', 'add', 'subtract', 'exchange']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    const examples = [...engine.prompt.matchAll(/"config": (\{ "task": \{[^}]*\} \})/g)].map((m) => JSON.parse(m[1]))
    expect(examples).toHaveLength(4)
    for (const ex of examples) expect(engine.faults(engine.parse(ex)!)).toEqual([])
    expect(checkIntent({ goal: 'g', isolates: 'quantity', apparatus: 'scene:counters-place-value', why: 'w' },
      { pattern: 'scene', prompt: 'Add 38 and 25.', payload: { engine: 'counters-place-value', config: examples[0] }, success: { kind: 'scene' } } as never).ok).toBe(true)
  })

  it('is offered to place-value stations, and not to stations that only share a word', () => {
    for (const station of ['Place value: tens and ones', 'Hundreds, tens and ones', 'Adding 2-digit numbers', 'Subtraction with regrouping', 'Partitioning numbers']) {
      expect(sceneCatalogue(station), station).toContain('SCENE "counters-place-value"')
    }
    for (const station of ['Gas exchange in the lungs', 'Addition polymers', 'Equivalent fractions', 'Acids and bases', 'Melting and freezing']) {
      expect(sceneCatalogue(station), station).not.toContain('SCENE "counters-place-value"')
    }
    expect(scenesFor('Tens and ones: making 2-digit numbers').map((e) => e.id)).toContain('counters-place-value')
  })
})

describe('the counters-place-value scene on the board', { timeout: 30_000 }, () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'counters-place-value', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (config: CountersConfig, state: CountersState, marked: SceneMarked) =>
    renderToStaticMarkup(createElement(CountersPlaceValueView, { config, state, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))
  /** Everything the page says: its text, and the labels a screen reader reads. */
  const exposed = (html: string) => {
    const attrs = [...html.matchAll(/(?:aria-label|aria-valuetext|title|alt)="([^"]*)"/g)].map((m) => m[1])
    return `${html.replace(/<[^>]+>/g, ' ')} ${attrs.join(' ')}`.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')
  }
  const says = (html: string, n: number) => readNumbers(exposed(html)).numbers.includes(n)

  it('make: a mat with + and − buttons for each column, and an exchange for each seam', () => {
    const html = card({ task: { kind: 'make', number: 147 } }, 'Make 147 with the fewest blocks.')
    expect(html).toMatch(/Hundreds/)
    for (const name of ['hundred', 'ten', 'one']) {
      expect(html).toContain(`aria-label="Add 1 ${name}"`)
      expect(html).toContain(`aria-label="Take away 1 ${name}"`)
    }
    expect(html).toContain('aria-label="Swap 10 ones for 1 ten"')
    expect(html).toContain('aria-label="Swap 1 hundred for 10 tens"')
    expect(html).toMatch(/data-count="1">0</)
    // Nothing to take from an empty mat: the buttons say so before they are pressed.
    expect(html).toMatch(/aria-label="Take away 1 ten"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*aria-label="Take away 1 ten"/)
    // Every control is a real button, so Tab reaches it, and every target is at least 44px.
    const own = view(make(147), engine.initial(make(147)), 'idle')
    expect(own.match(/<button/g)!.length).toBe(6 + 4 + 1)
    for (const b of own.match(/<button[^>]*>/g)!) expect(b).toMatch(/h-11 w-11|min-h-\[44px\]|min-h-\[48px\]/)
    expect(own).not.toMatch(/capitalize/)
    for (const m of own.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
  })

  it('make: shows no numeral before it is marked, either way, so the learner reads the blocks; shows it once marked', () => {
    for (const way of ['fewest', 'any'] as const) {
      const c = make(47, way)
      const prompt = 'Make 47.'
      // Started, half-built, and built right: the column counts show, the number they make does not.
      const states: CountersState[] = [engine.initial(c), build(c, engine.initial(c), 40), engine.solve(c)]
      if (way === 'any') states.push(run(c, engine.solve(c), { kind: 'break', place: 1 }))
      for (const s of states) {
        const html = view(c, s, 'idle')
        expect(html, `${way} ${s.mat}`).not.toMatch(/data-numeral|Your number/)
        expect(says(html, valueOf(s.mat)) && valueOf(s.mat) >= 20, `${way} ${s.mat}`).toBe(false)
      }
      expect(card({ task: c.task }, prompt)).not.toMatch(/data-numeral|Your number/)
      expect(exposed(card({ task: c.task }, prompt)).replace(prompt, '')).not.toMatch(/\b47\b/)
      // Marked, right or wrong, the number the blocks make is shown.
      expect(view(c, engine.solve(c), 'right')).toMatch(/data-numeral="true">47</)
      expect(view(c, { mat: [0, 7, 4] }, 'wrong')).toMatch(/data-numeral="true">74</)
      expect(view(c, { mat: [0, 7, 4] }, 'wrong')).toContain('You made 74.')
    }
    // exchange keeps its numeral throughout: it never changes, which is what the task shows.
    expect(view(exchange(34, { tens: 2 }), engine.initial(exchange(34, { tens: 2 })), 'idle')).toMatch(/data-numeral="true">34</)
  })

  it('make: names no blocks before it is marked', () => {
    const prompt = 'Make 47 with the fewest blocks.'
    const shown = exposed(card({ task: { kind: 'make', number: 47 } }, prompt)).replace(prompt, '')
    expect(readNumbers(shown).counts.filter((c) => (c.place === 1 && c.n === 4) || (c.place === 2 && c.n === 7))).toEqual([])
    expect(shown).not.toMatch(/47 is/)
  })

  it('add: never shows the total before it is marked -- not built, not put together, not even regrouped', () => {
    let checked = 0
    for (const [a, b] of pairs(3).filter((_, i) => i % 37 === 0)) {
      const c = add(a, b)
      if (engine.faults(c).length) continue
      const r = a + b
      const prompt = `Add ${a} and ${b}.`
      expect(says(card(c, prompt).replace(prompt, ''), r), `${a} + ${b} at the start`).toBe(false)
      const joined = run(c, build(c, build(c, engine.initial(c), a, 0), b, 1), { kind: 'join' })
      for (const s of [joined, walkAdd(c)]) {
        const html = view(c, s, 'idle')
        expect(says(html, r), `${a} + ${b} ${JSON.stringify(s.mat)}`).toBe(false)
        expect(html).toMatch(new RegExp(`>${a} \\+ ${b}<`))
      }
      expect(says(view(c, joined, 'wrong'), r), `${a} + ${b} marked wrong`).toBe(false)
      expect(says(view(c, walkAdd(c), 'right'), r), `${a} + ${b} marked right`).toBe(true)
      checked++
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('subtract: never shows the difference before it is marked', () => {
    let checked = 0
    for (const [a, b] of pairs(5).filter((_, i) => i % 23 === 0)) {
      const c = subtract(a, b)
      const r = a - b
      // Small differences share their digits with the column counts; the composed number is what must not show.
      if (engine.faults(c).length || r < 20 || r === b) continue
      const started = run(c, build(c, engine.initial(c), a, 0), { kind: 'join' })
      for (const s of [engine.initial(c), started]) expect(says(view(c, s, 'idle'), r), `${a} − ${b}`).toBe(false)
      expect(says(view(c, walkSubtract(c), 'right'), r)).toBe(true)
      checked++
    }
    expect(checked).toBeGreaterThanOrEqual(50)
  })

  it('add, put together: the blocks and their counts, the swaps, and no + or − to change the total', () => {
    const c = add(38, 25)
    const joined = run(c, build(c, build(c, engine.initial(c), 38, 0), 25, 1), { kind: 'join' })
    const html = view(c, joined, 'idle')
    expect(html).toMatch(/data-count="1">5</)
    expect(html).toMatch(/data-count="2">13</)
    expect(html).not.toMatch(/aria-label="Add 1/)
    expect(html).toContain('aria-label="The mat: 5 tens and 13 ones"')
    expect(html).not.toMatch(/You made/)
    const wrong = exposed(view(c, joined, 'wrong'))
    expect(wrong).toContain('You made 5 tens and 13 ones.')
    expect(exposed(view(c, walkAdd(c), 'right'))).toContain('38 + 25 = 63')
  })

  it('add, being built: each number’s own buttons, a tick once it is made, and a Put together button that waits for both', () => {
    const c = add(38, 25)
    const html = view(c, build(c, engine.initial(c), 38, 0), 'idle')
    expect(html).toContain('aria-label="Add 1 ten to 25"')
    expect(html).toContain('Made.')
    expect(html).toMatch(/aria-disabled="true"[^>]*>Put together</)
    const both = view(c, build(c, build(c, engine.initial(c), 38, 0), 25, 1), 'idle')
    expect(both).not.toMatch(/aria-disabled="true"[^>]*>Put together</)
  })

  it('subtract: a take-away tally, and + to put back', () => {
    const c = subtract(52, 17)
    let s = run(c, build(c, engine.initial(c), 52, 0), { kind: 'join' })
    s = run(c, s, { kind: 'take', place: 1 })
    const html = view(c, s, 'idle')
    expect(html).toContain('aria-label="Put back 1 ten"')
    expect(html).toContain('aria-label="Taken away: 10, 1 ten"')
    expect(html).toMatch(/>52 − 17</)
  })

  it('exchange: starts the usual way, and does not say the count the learner is to find', () => {
    for (const [n, counts, found] of [[34, { tens: 2 }, 14], [234, { hundreds: 1 }, 13], [507, { hundreds: 4, tens: 9 }, 17]] as const) {
      const c = exchange(n, counts)
      const prompt = `Show ${n} another way.`
      const html = card({ task: c.task }, prompt)
      const shown = exposed(html).replace(prompt, '')
      expect(readNumbers(shown).numbers, `${n}`).not.toContain(found)
      expect(html).toMatch(new RegExp(`data-numeral="true">${n}<`))
      expect(html).not.toMatch(/aria-label="Add 1/)
    }
  })

  it('locks every control once solved', () => {
    const c = make(47)
    const html = view(c, engine.solve(c), 'right')
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(html.match(/<button/g)!.length)
    expect(html).not.toMatch(/Start again/)
    expect(html).toContain('47 is 4 tens and 7 ones.')
  })

  it('still draws a state it cannot read, as the start', () => {
    expect(view(add(38, 25), { mat: 'nonsense' } as never, 'idle')).toMatch(/Put together/)
    expect(view(make(47), { mat: [1, 2] } as never, 'wrong')).toMatch(/data-numeral="true">0</)
  })
})
