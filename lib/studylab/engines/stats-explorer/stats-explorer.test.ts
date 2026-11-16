import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  statsExplorerEngine as engine, AVERAGES, MAX_DOTS, MAX_VALUES, MIN_DOTS, MIN_VALUES, MOVE_WORDS, REASONS, SCENARIOS, TOP,
  applyChange, chooseSaid, cmpRat, findSet, fmtMedian, fmtRat, judgeMake, makeGoal, makeSaid, makeSolution, nearbyMake, outcomes,
  predictSaid, rat, ratOfDecimal, readAnswers, readChoice, readDots, scenarioFacts, scenarioOf, statsOf, targetChips, terminates,
  type Goal, type MakeTask, type Measure, type Move, type PChange, type PredictTask, type Scenario, type StatsExplorerConfig,
} from './config'
import { HEAD, PAD_X, PLOT_W, StatsExplorerView, layoutPlot, stackOf, tallest } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { dimensionsOf } from '../../activities/dimensions'
import { checkIntent } from '../../activities/intent'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Averages and spread on a dot plot: the tutor names targets, a data set and a
 * change, or a situation; the engine counts exactly and marks what the learner
 * builds, predicts or chooses.
 */

const make = (count: number, targets: Partial<Record<Measure, number>>): StatsExplorerConfig => ({ task: { kind: 'make', count, ...targets } })
const predict = (values: number[], change: PChange, measures?: ('mean' | 'median' | 'range')[]): StatsExplorerConfig =>
  ({ task: { kind: 'predict', values, change, measures: measures ?? ['mean', 'median', 'range'] } })
const choose = (context: string): StatsExplorerConfig => ({ task: { kind: 'choose', context } })

const makeTask = (c: StatsExplorerConfig) => c.task as MakeTask
const predictTask = (c: StatsExplorerConfig) => c.task as PredictTask

/** A small deterministic dice, so a failure can be replayed. */
function dice(seed: number) {
  let s = seed >>> 0
  const next = () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296
  }
  return { int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)) }
}

// ---------------------------------------------------------------------------
// Independent oracles, sharing nothing with the engine's search or its statistics.

type Sig = { sum: number; med2: number; mode: number | null; range: number }

/**
 * Every sorted set of n values on the line, one by one: the signatures (total, twice the median,
 * the mode or none, the range) that some set has. Sets with every dot on one value are left out,
 * as the engine leaves them out.
 */
function allSignatures(n: number): Sig[] {
  const seen = new Uint8Array(201 * 41 * 22 * 21)
  const a = new Array<number>(n).fill(0)
  const rec = (i: number, lo: number, sum: number) => {
    if (i === n) {
      const med2 = n % 2 ? 2 * a[(n - 1) / 2] : a[n / 2 - 1] + a[n / 2]
      // The mode from the runs of equal values: the longest run, if no other run is as long.
      let best = 0
      let bestValue = -1
      let ties = 0
      let run = 0
      for (let j = 0; j < n; j++) {
        run = j > 0 && a[j] === a[j - 1] ? run + 1 : 1
        if (j === n - 1 || a[j + 1] !== a[j]) {
          if (run > best) {
            best = run
            bestValue = a[j]
            ties = 1
          } else if (run === best) ties++
        }
      }
      seen[((sum * 41 + med2) * 22 + (ties === 1 ? bestValue : 21)) * 21 + (a[n - 1] - a[0])] = 1
      return
    }
    for (let v = lo; v <= TOP; v++) {
      a[i] = v
      rec(i + 1, v, sum + v)
    }
  }
  rec(0, 0, 0)
  const out: Sig[] = []
  for (let idx = 0; idx < seen.length; idx++) {
    if (!seen[idx]) continue
    const range = idx % 21
    const rest = Math.floor(idx / 21)
    const mode = rest % 22
    const rest2 = Math.floor(rest / 22)
    if (range > 0) out.push({ sum: Math.floor(rest2 / 41), med2: rest2 % 41, mode: mode === 21 ? null : mode, range })
  }
  return out
}

/** The (key, value) tuples some set has, for each way of naming one or two targets. */
type Table = Map<string, Set<string>>
const KEYS = ['sum', 'med2', 'mode', 'range'] as const
type Key = (typeof KEYS)[number]
function tableOf(sigs: Sig[]): Table {
  const t: Table = new Map()
  const add = (keys: Key[], s: Sig) => {
    if (keys.includes('mode') && s.mode === null) return
    const id = keys.join('+')
    if (!t.has(id)) t.set(id, new Set())
    t.get(id)!.add(keys.map((k) => s[k]).join('|'))
  }
  for (let i = 0; i < KEYS.length; i++) {
    for (const s of sigs) add([KEYS[i]], s)
    for (let j = i + 1; j < KEYS.length; j++) for (const s of sigs) add([KEYS[i], KEYS[j]], s)
  }
  return t
}
const possible = (t: Table, goal: Goal): boolean => {
  const keys = KEYS.filter((k) => goal[k] !== undefined)
  return t.get(keys.join('+'))?.has(keys.map((k) => goal[k]).join('|')) ?? false
}

const ORACLES = new Map<number, Table>()
const oracleFor = (n: number): Table => {
  if (!ORACLES.has(n)) ORACLES.set(n, tableOf(allSignatures(n)))
  return ORACLES.get(n)!
}

/** The mean, median, mode and range of a set by plain loops. */
function plain(values: number[]) {
  const v = [...values].sort((a, b) => a - b)
  const n = v.length
  const counts = new Map<number, number>()
  v.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1))
  const top = Math.max(...counts.values())
  const winners = [...counts].filter(([, c]) => c === top).map(([x]) => x)
  return {
    n,
    sum: v.reduce((a, b) => a + b, 0),
    med2: n % 2 ? 2 * v[(n - 1) / 2] : v[n / 2 - 1] + v[n / 2],
    mode: winners.length === 1 ? winners[0] : null,
    range: v[n - 1] - v[0],
  }
}

/** Which way b moves from a, by cross-multiplying whole numbers as BigInts. */
const sign = (x: bigint): Move => (x > BigInt(0) ? 'up' : x < BigInt(0) ? 'down' : 'same')
function plainMoves(before: number[], after: number[]): Record<'mean' | 'median' | 'range', Move> {
  const a = plain(before)
  const b = plain(after)
  return {
    mean: sign(BigInt(b.sum) * BigInt(a.n) - BigInt(a.sum) * BigInt(b.n)),
    median: sign(BigInt(b.med2 - a.med2)),
    range: sign(BigInt(b.range - a.range)),
  }
}

// ---------------------------------------------------------------------------

describe('exact numbers: fractions, medians and the four measures', () => {
  it('writes a fraction as a decimal when it ends, and says so when it does not', () => {
    expect(fmtRat(rat(12, 2))).toBe('6')
    expect(fmtRat(rat(13, 2))).toBe('6.5')
    expect(fmtRat(rat(33, 8))).toBe('4.125')
    expect(fmtRat(rat(32, 5))).toBe('6.4')
    expect(fmtRat(rat(32, 7))).toBe('about 4.57')
    expect(fmtRat(rat(2, 3))).toBe('about 0.67')
    expect(fmtRat(rat(0, 7))).toBe('0')
    expect(terminates(rat(33, 8))).toBe(true)
    expect(terminates(rat(1, 3))).toBe(false)
  })

  it('reads a decimal of at most three places exactly, and nothing else', () => {
    expect(ratOfDecimal(6.4)).toEqual({ n: 32, d: 5 })
    expect(ratOfDecimal('4.125')).toEqual({ n: 33, d: 8 })
    expect(ratOfDecimal(6)).toEqual({ n: 6, d: 1 })
    for (const bad of [6.0001, 1 / 3, -1, NaN, 'six', '', null, undefined, 1e21]) expect(ratOfDecimal(bad), `${bad}`).toBeNull()
  })

  it('writes a median from twice its value', () => {
    expect(fmtMedian(12)).toBe('6')
    expect(fmtMedian(13)).toBe('6.5')
    expect(fmtMedian(0)).toBe('0')
    expect(fmtMedian(1)).toBe('0.5')
  })

  it('finds the mean, median, mode and range as plain loops do, for 600 random sets', () => {
    const d = dice(7)
    for (let i = 0; i < 600; i++) {
      const n = d.int(1, 12)
      const values = Array.from({ length: n }, () => d.int(0, TOP))
      const s = statsOf(values)
      const p = plain(values)
      expect(s.sum, `${values}`).toBe(p.sum)
      expect(s.median2, `${values}`).toBe(p.med2)
      expect(s.mode, `${values}`).toBe(p.mode)
      expect(s.range, `${values}`).toBe(p.range)
      expect(cmpRat(s.mean, rat(p.sum, p.n)), `${values}`).toBe(0)
    }
  })

  it('has no mode when two values tie, or when no value repeats', () => {
    expect(statsExplorerEngine_mode([3, 3, 5, 5, 7])).toBeNull()
    expect(statsExplorerEngine_mode([1, 2, 3, 4, 5])).toBeNull()
    expect(statsExplorerEngine_mode([4, 4, 5, 5, 5])).toBe(5)
    expect(statsOf([3, 3, 5, 5, 7]).tied).toEqual([3, 5])
  })

  it('reads dots from a saved state safely', () => {
    expect(readDots({ dots: [7, 3, 3, 21, -1, 2.5, 'x', 5] })).toEqual([3, 3, 5, 7])
    expect(readDots({ dots: [1, 2, 3, 4, 5, 6] }, 4)).toEqual([1, 2, 3, 4])
    for (const bad of [null, undefined, 'junk', 7, {}, { dots: 'x' }, { dots: null }]) expect(readDots(bad)).toEqual([])
  })
})
function statsExplorerEngine_mode(v: number[]) {
  return statsOf(v).mode
}

// ---------------------------------------------------------------------------

describe('reading what the tutor writes', () => {
  const parse = (raw: unknown) => engine.parse(raw)

  it('reads a make task however the targets are reasonably written', () => {
    expect(parse({ task: { kind: 'make', count: 6, mean: 6, range: 8 } })).toEqual({ task: { kind: 'make', count: 6, mean: 6, range: 8 } })
    expect(parse({ task: { kind: 'Build', dots: '7', Mean: 5 } })).toEqual({ task: { kind: 'make', count: 7 } })
    expect(parse({ task: { kind: 'make', count: 6, targets: { median: 4.5, mode: '3' } } })).toEqual({ task: { kind: 'make', count: 6, median: 4.5, mode: 3 } })
    expect(parse({ kind: 'make', count: 5, mode: 4 })).toEqual({ task: { kind: 'make', count: 5, mode: 4 } })
  })

  it('reads a predict task: a change as add, remove or move, and the double of the largest', () => {
    const v = [3, 4, 5, 6, 8]
    expect(parse({ task: { kind: 'predict', values: v, change: { kind: 'add', value: 19 } } })).toEqual(predict(v, { kind: 'add', value: 19 }))
    expect(parse({ task: { kind: 'predict', values: '3, 4, 5, 6, 8', change: { kind: 'remove', value: '4' } } })).toEqual(predict(v, { kind: 'remove', value: 4 }))
    expect(parse({ task: { kind: 'predict', values: v, change: { kind: 'move', from: 8, to: 18 }, measures: ['Mean', 'median'] } })).toEqual(predict(v, { kind: 'move', from: 8, to: 18 }, ['mean', 'median']))
    expect(parse({ task: { kind: 'predict', values: v, change: { kind: 'double-the-largest' } } })).toEqual(predict(v, { kind: 'move', from: 8, to: 16 }))
    expect(parse({ task: { values: v, change: { type: 'new-value', value: 9 } } })).toEqual(predict(v, { kind: 'add', value: 9 }))
  })

  it('reads a choose task by the situation, in any reasonable spelling', () => {
    for (const s of SCENARIOS) {
      expect(parse({ task: { kind: 'choose', context: s.id } })).toEqual(choose(s.id))
      expect(parse({ task: { kind: 'choose', context: s.id.replace(/-/g, ' ').toUpperCase() } })).toEqual(choose(s.id))
    }
    expect(parse({ task: { kind: 'choose', context: 'Shoe Sizes' } })).toEqual(choose('shoe-sizes'))
    expect(parse({ task: { kind: 'choose', context: 'house prices' } })).toEqual(choose('house-prices'))
  })

  it('returns null only for what cannot be read at all, and says the rest through faults()', () => {
    for (const raw of [null, undefined, 7, 'make', [], {}, { task: null }, { task: 'make' }, { task: 5 }]) expect(parse(raw), JSON.stringify(raw)).toBeNull()
    // Anything with a task is read, and faults() names what is wrong.
    const odd = parse({ task: { kind: 'sing', count: 6, mean: 'six' } })!
    expect(engine.faults(odd).join(' ')).toMatch(/kind "sing" is not one of: make, predict, choose/)
    expect(engine.faults(odd).join(' ')).toMatch(/mean "six" is not a number/)
    expect(engine.faults(parse({ task: { kind: 'make', count: 6, values: [1, 2, 3], mean: 4 } })!).join(' ')).toMatch(/"values" is not used by a make task/)
    expect(engine.faults(parse({ task: { kind: 'choose', context: 'tennis' } })!).join(' ')).toMatch(/not a situation this scene has\. Use one of: "shoe-sizes"/)
    expect(engine.faults(parse({ task: { kind: 'choose' } })!).join(' ')).toMatch(/needs a "context"/)
    expect(engine.faults(parse({ task: { kind: 'predict', values: [1, 2, 3, 4, 5], change: { kind: 'swap' } } })!).join(' ')).toMatch(/change kind "swap" is not one of/)
    expect(engine.faults(parse({ task: { kind: 'predict', values: [1, 2, 3, 4, 5], change: { kind: 'add' } } })!).join(' ')).toMatch(/needs a "value"/)
    expect(engine.faults(parse({ task: { kind: 'predict', values: [1, 2, 3, 4, 5], change: { kind: 'add', value: 9 }, measures: ['mean', 'mode'] } })!).join(' ')).toMatch(/measure "mode" is not one of: mean, median, range/)
    expect(engine.faults(parse({ task: { kind: 'predict', values: [1, 'x', 3, 4, 5], change: { kind: 'add', value: 9 } } })!).join(' ')).toMatch(/"x" in values is not a number/)
  })
})

// ---------------------------------------------------------------------------

describe('every one or two targets a make task can name', { timeout: 180_000 }, () => {
  /** Every value a tutor could write for a target, for n dots: means that are decimals that end, medians that n allows. */
  const values = (n: number): Record<Measure, number[]> => ({
    mean: Array.from({ length: TOP * n + 1 }, (_, s) => s).filter((s) => terminates(rat(s, n))).map((s) => Number(fmtRat(rat(s, n)))),
    median: Array.from({ length: 2 * TOP + 1 }, (_, m) => m).filter((m) => n % 2 === 0 || m % 2 === 0).map((m) => m / 2),
    mode: Array.from({ length: TOP + 1 }, (_, v) => v),
    range: Array.from({ length: TOP }, (_, r) => r + 1),
  })
  const goalOf = (n: number, t: Partial<Record<Measure, number>>): Goal => ({
    ...(t.mean !== undefined ? { sum: Math.round(t.mean * n) } : {}),
    ...(t.median !== undefined ? { med2: Math.round(t.median * 2) } : {}),
    ...(t.mode !== undefined ? { mode: t.mode } : {}),
    ...(t.range !== undefined ? { range: t.range } : {}),
  })
  const PAIRS: [Measure, Measure][] = [['mean', 'median'], ['mean', 'mode'], ['mean', 'range'], ['median', 'mode'], ['median', 'range'], ['mode', 'range']]

  it('is drawn when some set of dots meets it, and refused with a set that does when none does', () => {
    let accepted = 0
    let refused = 0
    for (const n of [5, 6, 7, 8, 9, 10]) {
      const table = oracleFor(n)
      const vals = values(n)
      const configs: Partial<Record<Measure, number>>[] = []
      for (const m of ['mean', 'median', 'mode', 'range'] as Measure[]) for (const x of vals[m]) configs.push({ [m]: x })
      for (const [a, b] of PAIRS) for (const x of vals[a]) for (const y of vals[b]) configs.push({ [a]: x, [b]: y })
      let seen = 0
      for (const targets of configs) {
        const c = make(n, targets)
        const goal = goalOf(n, targets)
        const should = possible(table, goal)
        const where = `${n} dots ${JSON.stringify(targets)}`
        // The decision itself, for every config: the goal is read, and the search finds a set exactly when one exists.
        const read = makeGoal(makeTask(c))
        if (!read) throw new Error(`${where}: the goal was not read`)
        const found = findSet(n, read)
        if (should !== (found !== null)) throw new Error(`${where}: ${should ? 'is possible but' : 'is impossible but'} the search ${found ? `found ${found}` : 'found nothing'}`)
        // The sentence a writer reads: for every possible config, and for one in eight of the refused (it also searches for a nearby set).
        if (!should && seen++ % 8 !== 0) continue
        const faults = engine.faults(c)
        if (should !== (faults.length === 0)) throw new Error(`${where}: ${should ? 'is possible but' : 'is impossible but'} faults() said ${JSON.stringify(faults)}`)
        if (should) {
          accepted++
          const start = engine.check(c, engine.initial(c))
          if (start.ok) throw new Error(`${where}: the start passes`)
          const dots = (engine.solve(c) as { dots: number[] }).dots
          if (dots.length !== n || !engine.check(c, { dots }).ok) throw new Error(`${where}: solve() does not pass check()`)
          const p = plain(dots)
          if (p.range === 0) throw new Error(`${where}: solve() put every dot on one value`)
          if (goal.sum !== undefined && p.sum !== goal.sum) throw new Error(`${where}: total ${p.sum}`)
          if (goal.med2 !== undefined && p.med2 !== goal.med2) throw new Error(`${where}: median`)
          if (goal.mode !== undefined && p.mode !== goal.mode) throw new Error(`${where}: mode`)
          if (goal.range !== undefined && p.range !== goal.range) throw new Error(`${where}: range`)
        } else {
          refused++
          if (faults.length !== 1 || !faults[0].startsWith(`No ${n} dots on the 0 to ${TOP} line have `)) throw new Error(`${where}: ${JSON.stringify(faults)}`)
          // The sets it names are real: each one's targets are possible, and its dots meet them.
          for (const near of nearbyMake(makeTask(c))) {
            if (!possible(table, goalOf(n, near.task as Partial<Record<Measure, number>>))) throw new Error(`${where}: the nearby ${JSON.stringify(near.task)} is impossible`)
            if (!judgeMake(near.task, near.dots).ok) throw new Error(`${where}: the nearby dots ${near.dots} miss`)
            if (!faults[0].includes(`dots ${near.dots.join(', ')}`)) throw new Error(`${where}: the fault leaves out ${near.dots}`)
          }
        }
      }
    }
    // Both sides are well covered, so neither the accepting nor the refusing is untested.
    expect(accepted).toBeGreaterThan(30_000)
    expect(refused).toBeGreaterThan(2_000)
  })

  it('names a nearby target that works for most refused configs', () => {
    let refused = 0
    let named = 0
    const d = dice(11)
    for (let i = 0; i < 600; i++) {
      const n = d.int(MIN_DOTS, MAX_DOTS)
      const [a, b] = PAIRS[d.int(0, PAIRS.length - 1)]
      const vals = values(n)
      const t = { [a]: vals[a][d.int(0, vals[a].length - 1)], [b]: vals[b][d.int(0, vals[b].length - 1)] }
      const c = make(n, t)
      if (!engine.faults(c).length) continue
      refused++
      if (nearbyMake(makeTask(c)).length > 0) named++
    }
    expect(refused).toBeGreaterThan(100)
    expect(named / refused).toBeGreaterThan(0.95)
  })

  it('finds a tight set rather than a scatter for the commonest cases', () => {
    expect(findSet(6, { sum: 36, range: 8 })!.length).toBe(6)
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
    expect(spread(findSet(7, { sum: 42, med2: 12 })!)).toBeLessThanOrEqual(4)
    expect(spread(findSet(5, { mode: 3 })!)).toBeLessThanOrEqual(4)
    expect(spread(findSet(8, { sum: 64 })!)).toBeLessThanOrEqual(4)
    expect(spread(findSet(10, { med2: 21 })!)).toBeLessThanOrEqual(4)
    // A pair that pulls two ways still gets an example, if a wider one.
    expect(findSet(5, { sum: 57, mode: 20 })).not.toBeNull()
  })

  it('puts every dot on the line, never all on one value, and the mode strictly ahead', () => {
    for (const c of [make(6, { mean: 6, range: 8 }), make(7, { mode: 4, median: 6 }), make(5, { mean: 9 }), make(10, { mode: 0, range: 20 })]) {
      const dots = makeSolution(makeTask(c))!
      expect(dots.every((x) => Number.isInteger(x) && x >= 0 && x <= TOP)).toBe(true)
      expect(new Set(dots).size).toBeGreaterThan(1)
    }
    const d = makeSolution(makeTask(make(7, { mode: 4, median: 6 })))!
    expect(plain(d).mode).toBe(4)
  })
})

describe('what a make task refuses, and the sentence a writer can act on', () => {
  const faults = (c: StatsExplorerConfig) => engine.faults(c).join(' ')

  it('asks for the count, and for 5 to 10 whole dots', () => {
    expect(faults({ task: { kind: 'make', mean: 6 } })).toMatch(/Say how many dots to place: "count", from 5 to 10/)
    expect(faults(make(4, { mean: 6 }))).toMatch(/4 dots is outside 5 to 10/)
    expect(faults(make(11, { mean: 6 }))).toMatch(/11 dots is outside 5 to 10/)
    expect(faults(make(6.5, { mean: 6 }))).toMatch(/6\.5 dots is not a whole number/)
  })

  it('wants one or two targets, not none and not three', () => {
    expect(faults(make(6, {}))).toMatch(/Name one or two targets/)
    expect(faults(make(6, { mean: 6, median: 6, range: 8 }))).toMatch(/3 targets together \(mean, median, range\)/)
    expect(faults(make(6, { mean: 6, median: 6, mode: 5, range: 8 }))).toMatch(/4 targets together/)
  })

  it('says why a mean cannot be a total of whole dots, with means and counts that can', () => {
    const f = faults(make(5, { mean: 6.5 }))
    expect(f).toMatch(/A mean of 6\.5 from 5 dots needs a total of 32\.5, but dots are whole numbers/)
    expect(f).toMatch(/a mean of 6\.4 or 6\.6 with 5 dots/)
    expect(f).toMatch(/6 dots with a mean of 6\.5/)
    // For 7 dots only whole means end as decimals, so it names those.
    expect(faults(make(7, { mean: 6.5 }))).toMatch(/needs a total of 45\.5/)
    expect(faults(make(7, { mean: 6.5 }))).toMatch(/a mean of 6 or 7 with 7 dots/)
    expect(faults(make(9, { mean: 4.5 }))).toMatch(/a mean of 4 or 5 with 9 dots, or 6 dots with a mean of 4\.5|a mean of 4 or 5 with 9 dots, or 8 dots with a mean of 4\.5/)
    expect(faults(make(6, { mean: 6.0001 }))).toMatch(/at most three decimal places/)
    expect(faults(make(6, { mean: 21 }))).toMatch(/A mean of 21 is off the line/)
    expect(faults(make(6, { mean: -1 }))).toMatch(/at most three decimal places/)
  })

  it('refuses a half median with an odd number of dots, and one off the line', () => {
    const f = faults(make(7, { median: 4.5 }))
    expect(f).toMatch(/A median of 4\.5 cannot happen with 7 dots/)
    expect(f).toMatch(/Use 4 or 5, or an even number of dots \(6 or 8\)/)
    expect(faults(make(6, { median: 4.5 }))).toBe('')
    expect(faults(make(6, { median: 4.25 }))).toMatch(/whole number or a half/)
    expect(faults(make(6, { median: 21 }))).toMatch(/off the line \(0 to 20\)/)
  })

  it('refuses a mode off the line or not whole, and a range of nothing, too wide or not whole', () => {
    expect(faults(make(6, { mode: 21 }))).toMatch(/A mode of 21 is not a place on the line/)
    expect(faults(make(6, { mode: 4.5 }))).toMatch(/A mode of 4\.5 is not a place on the line/)
    expect(faults(make(6, { mode: -1 }))).toMatch(/not a place on the line/)
    expect(faults(make(6, { range: 0 }))).toMatch(/A range of 0 puts every dot on one value/)
    expect(faults(make(6, { range: 21 }))).toMatch(/wider than the line/)
    expect(faults(make(6, { range: 7.5 }))).toMatch(/not a whole number/)
  })

  it('refuses targets that need every dot on one value, and targets no dots can meet together', () => {
    expect(faults(make(6, { mean: 0 }))).toMatch(/^No 6 dots on the 0 to 20 line have a mean of 0, with the dots not all on one value\./)
    expect(faults(make(6, { mean: 20 }))).toMatch(/^No 6 dots/)
    const f = faults(make(5, { mean: 19, mode: 0 }))
    expect(f).toMatch(/^No 5 dots on the 0 to 20 line have a mean of 19 and a mode of 0, with the dots not all on one value\. Use e\.g\. /)
    expect(f).toMatch(/\(dots \d+(, \d+)+\)/)
    expect(faults(make(5, { mean: 1, range: 20 }))).toMatch(/^No 5 dots/)
  })

  it('accepts the cards the catalogue shows', () => {
    for (const c of [make(6, { mean: 6, range: 8 }), make(7, { median: 6, mode: 4 }), make(8, { mean: 7.5 }), make(5, { range: 12 })]) expect(engine.faults(c), JSON.stringify(c)).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('marking the dots a learner places', { timeout: 60_000 }, () => {
  it('is right exactly when the dots are all placed, not all one value, and meet every target (3000 random sets)', () => {
    const d = dice(3)
    let right = 0
    let wrong = 0
    for (let i = 0; i < 3000; i++) {
      const n = d.int(MIN_DOTS, MAX_DOTS)
      const dots = Array.from({ length: n }, () => d.int(2, 12))
      const p = plain(dots)
      // Targets taken from this set, then bent for half of them.
      const t: Partial<Record<Measure, number>> = {}
      const names = (['mean', 'median', 'mode', 'range'] as Measure[]).filter(() => d.int(0, 1) === 1).slice(0, 2)
      if (!names.length) names.push('range')
      for (const m of names) {
        const bend = d.int(0, 3) === 0 ? d.int(1, 2) : 0
        if (m === 'mean') t.mean = p.sum % p.n === 0 ? p.sum / p.n + bend : NaN
        else if (m === 'median') t.median = p.med2 / 2 + (bend ? 0.5 * bend : 0)
        else if (m === 'mode') t.mode = (p.mode ?? 3) + bend
        else t.range = Math.max(1, p.range + bend)
      }
      if (Number.isNaN(t.mean as number)) delete t.mean
      if (!Object.keys(t).length) continue
      const task: MakeTask = { kind: 'make', count: n, ...t }
      const expected =
        p.range > 0 &&
        (t.mean === undefined || t.mean * p.n === p.sum) &&
        (t.median === undefined || t.median * 2 === p.med2) &&
        (t.mode === undefined || t.mode === p.mode) &&
        (t.range === undefined || t.range === p.range)
      const got = engine.check({ task }, { dots }).ok
      if (got !== expected) throw new Error(`${n} dots ${dots} vs ${JSON.stringify(t)}: ${got}`)
      if (expected) right++
      else wrong++
    }
    expect(right).toBeGreaterThan(300)
    expect(wrong).toBeGreaterThan(300)
  })

  it('is wrong for too few dots, too many, none, or a tie for the mode', () => {
    const c = make(5, { mode: 3 })
    expect(engine.check(c, { dots: [3, 3, 4, 5] }).ok).toBe(false)
    expect(engine.check(c, { dots: [3, 3, 4, 5, 6] }).ok).toBe(true)
    // A longer list is not a longer answer.
    expect(engine.check(c, { dots: [3, 3, 3, 4, 5, 6] }).ok).toBe(false)
    expect(engine.check(c, { dots: [] }).ok).toBe(false)
    expect(engine.check(c, { dots: [3, 3, 5, 5, 6] }).ok).toBe(false)
    expect(engine.check(c, { dots: [3, 3, 3, 3, 3] }).ok).toBe(false)
  })

  it('is exact where a float would not be', () => {
    // 0.1 + 0.2 style traps: a mean of 6.4 from 5 dots totals 32, a mean of 4.125 from 8 totals 33.
    expect(engine.check(make(5, { mean: 6.4 }), { dots: [4, 6, 7, 7, 8] }).ok).toBe(true)
    expect(engine.check(make(8, { mean: 4.125 }), { dots: [1, 2, 3, 4, 5, 6, 6, 6] }).ok).toBe(true)
    expect(engine.check(make(8, { mean: 4.125 }), { dots: [1, 2, 3, 4, 5, 6, 6, 7] }).ok).toBe(false)
    expect(engine.check(make(10, { mean: 5.3 }), { dots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 8] }).ok).toBe(true)
  })

  it('reads a state it cannot use as no dots', () => {
    const c = make(6, { mean: 6, range: 8 })
    for (const bad of [null, undefined, 'junk', 7, { dots: 'x' }, { dots: [99, -2, 'a'] }]) expect(engine.check(c, bad as never).ok).toBe(false)
  })

  it('says what was made when wrong, and what is still needed, in a learner’s words', () => {
    const t = makeTask(make(5, { mean: 6, mode: 7 }))
    const wrong = makeSaid(t, { dots: [2, 5, 7, 7, 8] }, 'wrong').join(' ')
    expect(wrong).toContain('You made mean 5.8, median 7, mode 7, range 6.')
    expect(wrong).toContain('The mean needs to be 6. 5 dots with that mean total 30; yours total 29.')
    expect(wrong).not.toMatch(/mode needs/)
    expect(makeSaid(t, { dots: [2, 4, 5, 6, 8] }, 'wrong').join(' ')).toMatch(/The mode needs to be 7: the value with the most dots\. In yours no value has more dots than another, so there is no mode\./)
    expect(makeSaid(t, { dots: [4, 4, 7, 7, 8] }, 'wrong').join(' ')).toMatch(/In yours 4 and 7 tie for the most dots, so there is no single mode\./)
    expect(makeSaid(makeTask(make(5, { median: 6, range: 9 })), { dots: [1, 4, 5, 7, 8] }, 'wrong').join(' ')).toMatch(/The median needs to be 6[^.]*\. Yours is 5\.\s+The range needs to be 9[^.]*\. Yours is 7 \(from 1 to 8\)/)
    expect(makeSaid(t, { dots: [2, 7] }, 'wrong')).toEqual(['You have placed 2 of 5 dots. Place all 5, then check.'])
    expect(makeSaid(t, { dots: [] }, 'wrong')[0]).toMatch(/No dots are placed yet\. Place 5 dots on the line/)
    expect(makeSaid(makeTask(make(5, { mean: 6 })), { dots: [6, 6, 6, 6, 6] }, 'wrong').join(' ')).toMatch(/Every dot is on the same value/)
  })

  it('shows the working once right, for each target', () => {
    const t = makeTask(make(6, { mean: 6, range: 8 }))
    const dots = makeSolution(t)!
    const lines = makeSaid(t, { dots }, 'right')
    expect(lines[0]).toMatch(/^Your dots have mean 6, median [\d.]+, mode (\d+|none \([^)]*\)), range 8\.$/)
    expect(lines.join(' ')).toMatch(/Mean: total 36 ÷ 6 dots = 6\./)
    expect(lines.join(' ')).toMatch(/Range: \d+ − \d+ = 8\./)
    expect(lines[lines.length - 1]).toBe('Different sets of dots can share the same mean and range.')
  })
})

// ---------------------------------------------------------------------------

describe('predicting what a change does', () => {
  const REPEAT = predict([2, 5, 6, 6, 6, 8, 9], { kind: 'add', value: 19 })

  it('works out which way each measure moves for 1000 random changes, as BigInt cross-multiplying does', () => {
    const d = dice(21)
    let moved = { up: 0, same: 0, down: 0 }
    let checked = 0
    for (let i = 0; i < 1000; i++) {
      const n = d.int(MIN_VALUES, MAX_VALUES)
      const values = Array.from({ length: n }, () => d.int(0, TOP))
      const kind = ['add', 'remove', 'move'][d.int(0, 2)]
      const change: PChange =
        kind === 'add' ? { kind: 'add', value: d.int(0, TOP) }
        : kind === 'remove' ? { kind: 'remove', value: values[d.int(0, n - 1)] }
        : { kind: 'move', from: values[d.int(0, n - 1)], to: d.int(0, TOP) }
      if (change.kind === 'move' && change.to === change.from) continue
      const t = predictTask(predict(values, change))
      const want = plainMoves(values, applyChange(values, change))
      const got = outcomes(t)!
      for (const o of got) {
        if (o.move !== want[o.measure]) throw new Error(`${values} ${JSON.stringify(change)}: ${o.measure} ${o.move} not ${want[o.measure]}`)
        moved[o.move]++
      }
      checked++
    }
    expect(checked).toBeGreaterThan(900)
    // All three answers happen, so none is a safe guess.
    expect(moved.up).toBeGreaterThan(200)
    expect(moved.same).toBeGreaterThan(200)
    expect(moved.down).toBeGreaterThan(200)
  })

  it('has the textbook answers for the classic cases', () => {
    const moves = (c: StatsExplorerConfig) => Object.fromEntries(outcomes(predictTask(c))!.map((o) => [o.measure, o.move]))
    // An outlier added: the mean and the range jump, the middle of a data set with repeats does not move.
    expect(moves(REPEAT)).toEqual({ mean: 'up', median: 'same', range: 'up' })
    // The largest doubled: the mean rises, the median and the range of a middle change do not.
    expect(moves(predict([3, 4, 5, 6, 8], { kind: 'move', from: 8, to: 16 }))).toEqual({ mean: 'up', median: 'same', range: 'up' })
    // Taking away the smallest: the mean rises, the range falls.
    expect(moves(predict([1, 5, 6, 7, 8, 9], { kind: 'remove', value: 1 }))).toEqual({ mean: 'up', median: 'up', range: 'down' })
    // Adding a value equal to the mean leaves the mean alone.
    expect(moves(predict([4, 5, 6, 7, 8], { kind: 'add', value: 6 }, ['mean', 'range']))).toEqual({ mean: 'same', range: 'same' })
    // A move inside the data leaves the range, and the mean moves.
    expect(moves(predict([2, 5, 6, 7, 10], { kind: 'move', from: 5, to: 6 }))).toEqual({ mean: 'up', median: 'same', range: 'same' })
  })

  it('writes the before and after in whole numbers, halves and fractions', () => {
    const o = outcomes(predictTask(predict([4, 5, 5, 6, 7, 8], { kind: 'add', value: 19 })))!
    expect(o.map((x) => [x.measure, x.before, x.after, x.move])).toEqual([
      ['mean', 'about 5.83', 'about 7.71', 'up'], ['median', '5.5', '6', 'up'], ['range', '4', '15', 'up'],
    ])
  })

  it('is right only when every measure asked is called, and the start answers nothing', () => {
    const t = predictTask(REPEAT)
    const right = engine.solve(REPEAT)
    expect(right).toEqual({ answers: { mean: 'up', median: 'same', range: 'up' } })
    expect(engine.check(REPEAT, right).ok).toBe(true)
    expect(engine.check(REPEAT, engine.initial(REPEAT))).toEqual({ ok: false, wrongIds: ['mean', 'median', 'range'] })
    expect(engine.check(REPEAT, { answers: { mean: 'up', median: 'up', range: 'up' } })).toEqual({ ok: false, wrongIds: ['median'] })
    expect(engine.check(REPEAT, { answers: { mean: 'up', median: 'same' } }).ok).toBe(false)
    // Only the measures asked are marked.
    const some = predict(t.values, t.change!, ['mean', 'range'])
    expect(engine.check(some, { answers: { mean: 'up', range: 'up' } }).ok).toBe(true)
    expect(engine.check(some, { answers: { mean: 'up', range: 'up', median: 'down' } }).ok).toBe(true)
    for (const bad of [null, undefined, 'junk', 7, { answers: 'x' }, { answers: { mean: 'sideways' } }]) expect(engine.check(REPEAT, bad as never).ok).toBe(false)
    expect(readAnswers({ answers: { mean: 'up', median: 'x', range: 3 } })).toEqual({ mean: 'up' })
  })

  it('is solved by solve() and unsolved by initial() for 300 random cards', () => {
    const d = dice(5)
    let n = 0
    while (n < 300) {
      const len = d.int(MIN_VALUES, MAX_VALUES)
      const values = Array.from({ length: len }, () => d.int(0, TOP))
      const c = predict(values, { kind: 'add', value: d.int(0, TOP) })
      if (engine.faults(c).length) continue
      n++
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
    }
  })

  it('says each measure back once marked, and what a wrong answer should have been', () => {
    const t = predictTask(REPEAT)
    const right = predictSaid(t, engine.solve(REPEAT), 'right').join(' ')
    expect(right).toContain('Mean: 6 to 7.625, so it goes up.')
    expect(right).toContain('Median: 6 to 6, so it stays the same.')
    expect(right).toContain('Range: 7 to 17, so it goes up.')
    expect(right).toMatch(/The median only depends on the middle of the data/)
    const wrong = predictSaid(t, { answers: { mean: 'up', median: 'up' } }, 'wrong').join(' ')
    expect(wrong).toContain('Median: you said it goes up, but it goes 6 to 6, so it stays the same.')
    expect(wrong).toContain('Range: you said it was not answered, but it goes 7 to 17, so it goes up.')
    expect(wrong).toContain('Mean: 6 to 7.625, so it goes up.')
    expect(Object.values(MOVE_WORDS)).toEqual(['goes up', 'stays the same', 'goes down'])
  })

  it('refuses data and changes it cannot draw, with a sentence a writer can act on', () => {
    const faults = (c: StatsExplorerConfig) => engine.faults(c).join(' ')
    expect(faults(predict([1, 2, 3, 4], { kind: 'add', value: 9 }))).toMatch(/"values" has 4: a data set of 5 to 9 values/)
    expect(faults(predict([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { kind: 'add', value: 9 }))).toMatch(/"values" has 10/)
    expect(faults(predict([1, 2, 3, 4, 25], { kind: 'add', value: 9 }))).toMatch(/25 is not a whole number from 0 to 20/)
    expect(faults(predict([1, 2, 3, 4, 5.5], { kind: 'add', value: 9 }))).toMatch(/5\.5 is not a whole number/)
    expect(faults({ task: { kind: 'predict', values: [1, 2, 3, 4, 5], measures: ['mean'] } })).toMatch(/Say the change/)
    expect(faults(predict([1, 2, 3, 4, 5], { kind: 'add', value: 21 }))).toMatch(/The value added, 21, is not a whole number from 0 to 20/)
    expect(faults(predict([1, 2, 3, 4, 5], { kind: 'remove', value: 9 }))).toMatch(/There is no dot at 9 to take away\. Take away one of 1, 2, 3, 4, 5/)
    expect(faults(predict([1, 2, 3, 4, 5], { kind: 'move', from: 9, to: 3 }))).toMatch(/There is no dot at 9 to move/)
    expect(faults(predict([1, 2, 3, 4, 5], { kind: 'move', from: 5, to: 5 }))).toMatch(/nowhere/)
    expect(faults(predict([1, 2, 3, 4, 5], { kind: 'move', from: 5, to: 25 }))).toMatch(/cannot move to 25/)
    expect(faults({ task: { kind: 'predict', values: [1, 2, 3, 4, 5], change: { kind: 'add', value: 9 }, measures: [] } })).toMatch(/"measures" is empty/)
    // The largest doubled needs room on the line.
    expect(faults(predict([3, 4, 5, 6, 12], { kind: 'move', from: 12, to: 24 }))).toMatch(/cannot move to 24/)
    expect(engine.parse({ task: { kind: 'predict', values: [3, 4, 5, 6, 12], change: { kind: 'double-largest' } } })).not.toBeNull()
  })

  it('refuses a change that moves nothing asked, and names one that does', () => {
    // Adding the mean to 4..8 leaves the mean, the median and the range where they are.
    const c = predict([4, 5, 6, 7, 8], { kind: 'add', value: 6 })
    const f = engine.faults(c).join(' ')
    expect(f).toMatch(/leaves the mean, median, range exactly where they are/)
    const eg = /e\.g\. add (\d+)\./.exec(f)
    expect(eg).not.toBeNull()
    expect(engine.faults(predict([4, 5, 6, 7, 8], { kind: 'add', value: Number(eg![1]) }))).toEqual([])
    expect(engine.faults(predict([4, 5, 6, 7, 8], { kind: 'add', value: 6 }, ['mean'])).join(' ')).toMatch(/leaves the mean exactly where it is/)
    // One measure asked, and it moves: fine, even if the others would not.
    expect(engine.faults(predict([4, 5, 6, 7, 8], { kind: 'add', value: 6 }, ['median'])).join(' ')).toMatch(/leaves the median exactly where it is/)
    expect(engine.faults(predict([2, 5, 6, 6, 6, 8, 9], { kind: 'add', value: 19 }, ['mean']))).toEqual([])
  })

  it('suggests, for a move or a removal that changes nothing, one that does', () => {
    // Taking away a middle value that has a twin leaves the median and the range, but the mean moves: only the median asked.
    const c = predict([3, 5, 6, 6, 6, 9], { kind: 'remove', value: 6 }, ['median', 'range'])
    const f = engine.faults(c).join(' ')
    expect(f).toMatch(/leaves the median, range exactly where they are/)
    const eg = /e\.g\. remove (\d+)\./.exec(f)
    expect(eg).not.toBeNull()
    expect(engine.faults(predict([3, 5, 6, 6, 6, 9], { kind: 'remove', value: Number(eg![1]) }, ['median', 'range']))).toEqual([])
    const m = predict([3, 5, 6, 6, 6, 9], { kind: 'move', from: 5, to: 6 }, ['median', 'range'])
    expect(engine.faults(m).join(' ')).toMatch(/e\.g\. move 5 to \d+\./)
  })
})

// ---------------------------------------------------------------------------

describe('choosing the best average', () => {
  it('has a situation for each average, and every situation is what it says it is, by the data', () => {
    expect(SCENARIOS.map((s) => s.answer).sort()).toEqual(['mean', 'mean', 'median', 'median', 'mode', 'mode'])
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
    for (const s of SCENARIOS) {
      const p = plain(s.values)
      const sorted = [...s.values].sort((a, b) => a - b)
      const f = scenarioFacts(s)
      // Every value sits on a column of its axis.
      for (const v of s.values) expect((v - s.axis.min) % s.axis.step, `${s.id} ${v}`).toBe(0)
      for (const v of s.values) expect(v >= s.axis.min && v <= s.axis.max, `${s.id} ${v}`).toBe(true)
      expect((s.axis.max - s.axis.min) / s.axis.step + 1, s.id).toBeLessThanOrEqual(21)
      // The quartiles by the median-of-halves rule, for the usual 1.5 x IQR outlier test.
      const half = Math.floor(sorted.length / 2)
      const med = (xs: number[]) => (xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2)
      const q1 = med(sorted.slice(0, half))
      const q3 = med(sorted.slice(sorted.length - half))
      const outliers = sorted.filter((v) => v > q3 + 1.5 * (q3 - q1) || v < q1 - 1.5 * (q3 - q1))
      const mean = p.sum / p.n
      const median = p.med2 / 2
      if (s.answer === 'mode') {
        // One value clearly ahead, and the mean and median are not it.
        const counts = sorted.reduce<Record<number, number>>((m, v) => ({ ...m, [v]: (m[v] ?? 0) + 1 }), {})
        const lead = Object.values(counts).sort((a, b) => b - a)
        expect(p.mode, s.id).not.toBeNull()
        expect(lead[0] - lead[1], s.id).toBeGreaterThanOrEqual(2)
        expect(mean, s.id).not.toBe(p.mode)
        expect(median, s.id).not.toBe(p.mode)
        expect(outliers, s.id).toEqual([])
      } else if (s.answer === 'median') {
        // Exactly one extreme value, and it drags the mean past most of the data.
        expect(outliers, s.id).toHaveLength(1)
        expect(f.beaten, s.id).toBeGreaterThanOrEqual(s.values.length - 1)
        expect(Math.abs(mean - median) / median, s.id).toBeGreaterThan(0.1)
        expect(p.mode, `${s.id}: a single mode would make the mode arguable`).toBeNull()
      } else {
        // No extreme value, nothing repeated most, and an exact mean: the equal share.
        expect(outliers, s.id).toEqual([])
        expect(p.sum % p.n, s.id).toBe(0)
        expect(mean, s.id).not.toBe(median)
      }
      // The words are in the data: the setting says the aim, and not the average.
      expect(s.setting, s.id).not.toMatch(/\b(mean|median|mode|average)\b/i)
      expect(s.setting.length, s.id).toBeLessThan(200)
    }
  })

  it('is right only with the best average and the reason that goes with it', () => {
    for (const s of SCENARIOS) {
      const c = choose(s.id)
      expect(engine.faults(c)).toEqual([])
      expect(engine.check(c, engine.initial(c))).toEqual({ ok: false, wrongIds: ['average', 'reason'] })
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
      for (const average of AVERAGES) {
        for (const reason of AVERAGES) {
          const got = engine.check(c, { average, reason })
          const wrongIds = [...(average === s.answer ? [] : ['average']), ...(reason === s.answer ? [] : ['reason'])]
          expect(got, `${s.id} ${average} ${reason}`).toEqual({ ok: wrongIds.length === 0, wrongIds })
        }
      }
    }
    expect(readChoice({ average: 'mean', reason: 'spoon' })).toEqual({ average: 'mean', reason: '' })
    expect(readChoice('junk')).toEqual({ average: '', reason: '' })
  })

  it('says what each answer is once marked, with the numbers worked from the data', () => {
    const say = (id: string, state: unknown, marked: 'right' | 'wrong') => chooseSaid(choose(id).task as never, state, marked).join(' ')
    const houses = say('house-prices', { average: 'median', reason: 'median' }, 'right')
    expect(houses).toContain('The median is the best average here.')
    expect(houses).toContain(`Why: ${REASONS.median}`)
    expect(houses).toContain('The extreme value £500k pulls the mean up to £232.5k, higher than 7 of the 8 values. The median, £200k, is the middle value')
    const shoes = say('shoe-sizes', { average: 'mean', reason: 'mean' }, 'wrong')
    expect(shoes).toContain('You chose the mean. The best average here is the mode.')
    expect(shoes).toContain('The most common shoe size is 8, with 4 of the 12. The mean (7) and the median (7.5)')
    expect(shoes).toContain(`The reason you chose describes the mean: "${REASONS.mean}" The mode's reason is`)
    const share = say('pocket-money', { average: 'mean', reason: 'median' }, 'wrong')
    expect(share).toContain('The mean is the best average here.')
    expect(share).toContain(`The reason you chose describes the median: "${REASONS.median}" The mean's reason is`)
    expect(share).toContain('5 values totalling 35, shared out equally, give 7 each. The median (6) and the mode (none: no value has more than the others)')
    expect(say('team-goals', { average: 'mean' }, 'wrong')).toBe('Choose an average and a reason, then check.')
    expect(say('team-goals', { average: 'mean', reason: 'mean' }, 'right')).toContain('6 values totalling 18, shared out equally, give 3 each.')
  })

  it('has one reason for each average, written to fit any situation', () => {
    expect(Object.keys(REASONS).sort()).toEqual(['mean', 'median', 'mode'])
    for (const text of Object.values(REASONS)) expect(text).not.toMatch(/shoe|house|price|pay|goal|money|table/i)
    expect(scenarioOf({ kind: 'choose', context: 'house-prices' })?.answer).toBe('median')
    expect(scenarioOf({ kind: 'choose', context: 'nope' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('the picture of the plot', () => {
  const AXES: [string, ReturnType<typeof layoutPlot>][] = [
    ['0 to 20', layoutPlot({ min: 0, max: TOP, step: 1, labelEvery: 2 }, MAX_DOTS)],
    ...SCENARIOS.map((s): [string, ReturnType<typeof layoutPlot>] => [s.id, layoutPlot(s.axis, tallest(s.values))]),
  ]

  it('keeps every dot a stack could hold inside its box and clear of every other dot', () => {
    for (const [name, L] of AXES) {
      const cells: { cx: number; cy: number }[] = []
      for (const t of L.ticks) for (let k = 0; k < L.rows; k++) cells.push(L.dot(t.value, k))
      for (const c of cells) {
        expect(c.cx - L.r, name).toBeGreaterThanOrEqual(0)
        expect(c.cx + L.r, name).toBeLessThanOrEqual(L.w)
        expect(c.cy - L.r, name).toBeGreaterThanOrEqual(HEAD)
        expect(c.cy + L.r, name).toBeLessThan(L.baseY)
      }
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const gap = Math.hypot(cells[i].cx - cells[j].cx, cells[i].cy - cells[j].cy) - 2 * L.r
          if (gap < 0.5) throw new Error(`${name}: two dots touch (${gap})`)
        }
      }
      // A finger can land on a column: each is at least 16 px wide in the drawing.
      expect(L.pitch, name).toBeGreaterThanOrEqual(16)
    }
  })

  it('numbers the axis with each number nearer its own tick than any other, apart, inside the box, and at 12px or more', () => {
    for (const [name, L] of AXES) {
      for (const l of L.labels) {
        const tick = L.ticks.find((t) => t.value === l.value)!
        expect(l.x, name).toBe(tick.x)
        const nearest = [...L.ticks].sort((a, b) => Math.abs(a.x - l.x) - Math.abs(b.x - l.x))[0]
        expect(nearest.value, name).toBe(l.value)
        expect(l.x - l.w / 2, name).toBeGreaterThanOrEqual(0)
        expect(l.x + l.w / 2, name).toBeLessThanOrEqual(L.w)
        expect(l.y + 4, name).toBeLessThanOrEqual(L.h)
        expect(l.y - l.h, name).toBeGreaterThan(L.baseY)
      }
      for (let i = 1; i < L.labels.length; i++) {
        const a = L.labels[i - 1]
        const b = L.labels[i]
        expect(b.x - b.w / 2 - (a.x + a.w / 2), `${name}: ${a.text} and ${b.text}`).toBeGreaterThanOrEqual(4)
      }
    }
    expect(AXES[0][1].labels.map((l) => l.text)).toEqual(['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20'])
    expect(AXES.find(([n]) => n === 'house-prices')![1].labels.map((l) => l.text)).toEqual(['100', '200', '300', '400', '500'])
  })

  it('finds the column under a point, and keeps a drag on the line', () => {
    const L = AXES[0][1]
    for (const t of L.ticks) expect(L.valueAtX(t.x)).toBe(t.value)
    expect(L.valueAtX(-50)).toBe(0)
    expect(L.valueAtX(PLOT_W + 50)).toBe(TOP)
    expect(L.valueAtX(L.xOf(7) + L.pitch * 0.4)).toBe(7)
    expect(L.valueAtX(L.xOf(7) + L.pitch * 0.6)).toBe(8)
    expect(L.xOf(0)).toBe(PAD_X)
  })

  it('stacks equal values upward and numbers each', () => {
    expect(stackOf([5, 3, 5, 5, 3])).toEqual([{ value: 3, k: 0 }, { value: 3, k: 1 }, { value: 5, k: 0 }, { value: 5, k: 1 }, { value: 5, k: 2 }])
    expect(tallest([5, 3, 5, 5, 3])).toBe(3)
    expect(tallest([])).toBe(0)
  })
})

// ---------------------------------------------------------------------------

describe('the prompt a stats-explorer card is written with', () => {
  const faults = (c: StatsExplorerConfig, prompt: string) => getEngine('stats-explorer')!.promptFaults!(c, prompt)

  it('make: may name the targets and the count, and may not list a set that works nor the total', () => {
    const c = make(6, { mean: 6, range: 8 })
    for (const p of [
      'Place the dots to make a data set with a mean of 6 and a range of 8.',
      'Build a data set of 6 values with mean 6 and range 8.',
      'Make 6 dots. Their mean must be 6 and their range 8.',
      'Show how the mean and the range can both be met.',
    ]) expect(faults(c, p), p).toEqual([])
    const sets = makeSolution(makeTask(c))!
    expect(faults(c, `Try the set ${sets.join(', ')}.`).join(' ')).toMatch(/lists a set of dots that meets the targets/)
    expect(faults(c, 'The 6 values must total 36.').join(' ')).toMatch(/gives the total the dots must have \(36\)/)
    expect(faults(c, 'Make 6 dots whose total is 36.').join(' ')).toMatch(/gives the total/)
    expect(faults(c, 'Use 36 as the total.').join(' ')).toMatch(/gives the total/)
    // Other numbers near the word "total" are not the total.
    expect(faults(c, 'The total of the dots matters; try 5 dots.').join(' ')).not.toMatch(/gives the total/)
  })

  it('make: may not contradict the card’s targets or its count', () => {
    const c = make(6, { mean: 6, range: 8 })
    expect(faults(c, 'Make 7 dots with a mean of 6 and a range of 8.').join(' ')).toMatch(/says 7 dots, but the card sets 6/)
    expect(faults(c, 'Make a data set with a mean of 7.').join(' ')).toMatch(/says a mean of 7, but the card's target is 6/)
    expect(faults(c, 'Make a data set with a range of 9.').join(' ')).toMatch(/says a range of 9, but the card's target is 8/)
    expect(faults(make(5, { mode: 3 }), 'Make 5 dots whose mode is 3.')).toEqual([])
    expect(faults(make(5, { median: 4.5 }), 'The median must be 4.5.')).toEqual([])
    expect(faults(c, 'The mean of 6 dots is the target.')).toEqual([])
  })

  it('predict: may ask the question, and may not say what a change does nor the value after', () => {
    const c = REPEATCARD
    for (const p of [
      'One more value is added. Predict what happens to each measure.',
      'Does the mean go up, go down or stay the same?',
      'What happens to the mean, the median and the range when 19 is added?',
      'Say whether the median goes up or stays the same.',
    ]) expect(faults(c, p), p).toEqual([])
    for (const p of [
      'Adding 19 makes the mean go up. Check the median.',
      'The median stays the same when 19 is added.',
      'Notice that the range increases a lot.',
      'The mean does not change.',
    ]) expect(faults(c, p).join(' '), p).toMatch(/says what happens/)
    expect(faults(c, 'The new mean is 7.625. Does the median change?').join(' ')).toMatch(/gives a value after the change \(7\.625\)/)
    expect(faults(c, 'After the change the range becomes 17.').join(' ')).toMatch(/gives a value after the change \(17\)/)
  })

  it('choose: may ask which average, and may not name the best one alone nor its reason', () => {
    const houses = choose('house-prices')
    for (const p of [
      'Which average should the estate agent use, and why?',
      'Choose the mean, the median or the mode for these prices.',
      'Which of the mean, median and mode is the most suitable?',
    ]) expect(faults(houses, p), p).toEqual([])
    expect(faults(houses, 'Use the median to describe these prices.').join(' ')).toMatch(/names the median/)
    expect(faults(houses, 'Which average copes with the outlier?').join(' ')).toMatch(/gives the reason away \("outlier"\)/)
    expect(faults(houses, 'One house is unusually high. Which average?').join(' ')).toMatch(/gives the reason away/)
    expect(faults(choose('shoe-sizes'), 'Which average finds the most common size?').join(' ')).toMatch(/gives the reason away/)
    expect(faults(choose('pocket-money'), 'Which average shares it out equally?').join(' ')).toMatch(/gives the reason away/)
    expect(faults(choose('shoe-sizes'), 'Use the mode.').join(' ')).toMatch(/names the mode/)
    // Naming a different average is not naming the answer.
    expect(faults(choose('shoe-sizes'), 'Why is the mean not suitable? Which average is?')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('stats-explorer')!
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
    expect(found.length).toBeGreaterThanOrEqual(3)
    expect(new Set(found.map((f) => f.config.task.kind))).toEqual(new Set(['make', 'predict', 'choose']))
    for (const ex of found) {
      const c = e.parse(ex.config)!
      expect(c, ex.prompt).not.toBeNull()
      expect(e.faults(c), ex.prompt).toEqual([])
      expect(e.promptFaults!(c, ex.prompt), ex.prompt).toEqual([])
      expect(validateSpec({ pattern: 'scene', prompt: ex.prompt, payload: { engine: 'stats-explorer', config: ex.config }, success: { kind: 'scene' } }), ex.prompt).toBe(true)
    }
  })
})
const REPEATCARD = predict([2, 5, 6, 6, 6, 8, 9], { kind: 'add', value: 19 })

// ---------------------------------------------------------------------------

describe('the catalogue entry', () => {
  it('is registered for the tutor, with its config and every task kind in orbit’s format', () => {
    expect(getEngine('stats-explorer')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/^SCENE "stats-explorer"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"engine":"stats-explorer"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:stats-explorer"/)
    expect(engine.prompt).toMatch(/"isolates":"consequence"/)
    for (const kind of ['make', 'predict', 'choose']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    for (const s of SCENARIOS) expect(engine.prompt).toContain(`"${s.id}"`)
  })

  it('says plainly what the card shows and what it keeps until it is marked', () => {
    expect(engine.prompt).toMatch(/shows no mean, median, mode or range of its own, nor a total/)
    expect(engine.prompt).toMatch(/what they made only when it is marked/)
    expect(engine.prompt).toMatch(/The values before and\s+after come when it is marked/)
    expect(engine.prompt).toMatch(/Not for histograms, box plots, cumulative frequency, scatter graphs/)
  })

  it('is an activity whose intent is consequence', () => {
    const spec = { pattern: 'scene', prompt: 'Which average?', payload: { engine: 'stats-explorer', config: choose('shoe-sizes') }, success: { kind: 'scene' } }
    expect(validateSpec(spec)).toBe(true)
    expect(dimensionsOf(spec as never)).toEqual(['consequence'])
    expect(checkIntent({ goal: 'g', isolates: 'consequence', apparatus: 'scene:stats-explorer', why: 'w' }, spec as never).ok).toBe(true)
    expect(validateSpec({ ...spec, payload: { engine: 'stats-explorer', config: 'make' } })).toBe(false)
  })

  it('is offered to the stations it is for, and not to those that merely share a word', () => {
    for (const station of [
      'Mean, median and mode', 'Averages: mean, median and mode', 'Calculating the mean', 'Finding the median of a list', 'Finding the mode',
      'Mean and range of a data set', 'Comparing averages and range', 'Choosing an average: mean, median or mode', 'Averages and spread', 'Spotting outliers in data',
    ]) expect(scenesFor(station).map((x) => x.id), station).toContain('stats-explorer')
    // A bare "range", "average", "mean" or "mode" belongs to other ideas.
    for (const station of [
      'Range of a function', 'Domain and range of a function', 'Average speed', 'Average rainfall in a climate', 'Mean free path of a gas',
      'Mountain range formation', 'Mode of transport in a city', 'Median of a triangle', 'What does the poem mean?', 'Equivalent fractions',
      'Reading a graph', 'Scatter graphs and correlation', 'Histograms', 'Box plots and quartiles', 'Cumulative frequency',
    ]) expect(scenesFor(station).map((x) => x.id), station).not.toContain('stats-explorer')
    for (const bare of ['range', 'mean', 'mode', 'median', 'average', 'averages']) expect(engine.covers).not.toContain(bare)
    for (const station of ['Equivalent fractions', 'Changes of state: what happens when ice melts', 'Drawing a line graph', 'Linear equations: solving 2x + 3 = 11'])
      expect(sceneCatalogue(station), station).not.toContain('SCENE "stats-explorer"')
    expect(sceneCatalogue('Mean, median and mode')).toContain('SCENE "stats-explorer"')
  })

  it('is refused by the meaning gates for a config it cannot teach, and for a prompt that gives the answer', () => {
    const action = (config: unknown, prompt = 'Place the dots.') =>
      ({ type: 'createActivity', id: 's1', spec: { pattern: 'scene', prompt, payload: { engine: 'stats-explorer', config }, success: { kind: 'scene' } } })
    expect(meaningFaults(action(make(6, { mean: 6, range: 8 })))).toEqual([])
    expect(meaningFaults(action(make(5, { mean: 6.5 }))).join(' ')).toMatch(/needs a total of 32\.5/)
    expect(meaningFaults(action(make(5, { mean: 19, mode: 0 }))).join(' ')).toMatch(/No 5 dots/)
    expect(meaningFaults(action(make(6, { mean: 6, range: 8 }), 'The 6 values must total 36.')).join(' ')).toMatch(/gives the total/)
    expect(meaningFaults(action(choose('house-prices'), 'Use the median.')).join(' ')).toMatch(/names the median/)
    expect(meaningFaults(action(predict([4, 5, 6, 7, 8], { kind: 'add', value: 6 }))).join(' ')).toMatch(/exactly where they are/)
  })
})

// ---------------------------------------------------------------------------

describe('the stats-explorer scene on the board', { timeout: 60_000 }, () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'stats-explorer', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (c: StatsExplorerConfig, state: unknown, marked: SceneMarked) =>
    renderToStaticMarkup(createElement(StatsExplorerView, { config: c, state: state as never, setState: () => {}, marked, reduced: false, locked: marked === 'right' || marked === 'shown' }))
  /** What a person or a screen reader is given: visible text, and the labels read aloud. */
  const said = (html: string) => ({
    texts: [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]).join(' | '),
    aloud: [...html.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((m) => m[1]).join(' | '),
  })

  const MAKE = make(6, { mean: 6, range: 8 })
  const PREDICT = predict([4, 5, 5, 6, 7, 8], { kind: 'add', value: 19 })

  it('make: draws a plot a keyboard can walk, with the targets beside it and no count of its own', () => {
    const html = card(MAKE, 'Place the dots to make a data set with a mean of 6 and a range of 8.')
    expect(html).toContain('role="grid"')
    expect(html).toMatch(/tabindex="0"/)
    expect((html.match(/role="gridcell"/g) ?? []).length).toBe(TOP + 1)
    expect(html).toContain('6 dots')
    expect(html).toContain('Mean: 6')
    expect(html).toContain('Range: 8')
    expect(html).toContain('Dots placed: 0 of 6')
    expect(html).toContain('Not all the dots on one value')
    expect(html).toContain('Clear the dots')
    expect(html).toMatch(/aria-label="0, no dots"/)
    expect(html).toContain('touch-none')
    const { texts, aloud } = said(view(MAKE, { dots: [1, 2, 3, 4, 5, 6] }, 'idle').replace(/<button.*?<\/button>/g, '').replace(/<ul.*?<\/ul>/g, ''))
    // While the learner works: no mean, median, mode, range or total of their own dots, in sight or aloud.
    expect(`${texts} ${aloud}`).not.toMatch(/You made|Your dots|total|about|3\.5|median|mode|mean/i)
    expect(view(MAKE, { dots: [1, 2, 2, 4] }, 'idle')).toMatch(/aria-label="2, 2 dots"/)
    expect(view(MAKE, { dots: [1, 2, 2, 4] }, 'idle')).toContain('Dots placed: 4 of 6')
  })

  it('make: names what was made only once marked, and puts the controls away once solved', () => {
    const wrong = view(MAKE, { dots: [1, 2, 3, 4, 5, 6] }, 'wrong')
    expect(wrong).toContain('You made mean 3.5, median 3.5, mode none (no value repeats), range 5.')
    expect(wrong).toContain('The mean needs to be 6. 6 dots with that mean total 36; yours total 21.')
    const dots = makeSolution(makeTask(MAKE))!
    const right = view(MAKE, { dots }, 'right')
    expect(right).toContain('Your dots have mean 6')
    expect(right).not.toContain('Clear the dots')
    expect(right).toMatch(/aria-readonly="true"/)
    expect(right).toMatch(/tabindex="-1"/)
    expect(right).not.toContain('Tap the line to add a dot')
  })

  it('predict: shows the change on the plot and a pick for each measure, and none of the answers', () => {
    const html = card(PREDICT, 'One more value is added. Predict what happens to each measure.')
    expect(html).toContain('The change: a new value, 19, is added')
    expect(html).toContain('The orange dashed dot is the new value.')
    expect((html.match(/role="radiogroup"/g) ?? []).length).toBe(3)
    expect((html.match(/role="radio"/g) ?? []).length).toBe(9)
    expect(html).toContain('What happens to the mean?')
    expect(html).toContain('What happens to the range?')
    expect((html.match(/aria-checked="true"/g) ?? []).length).toBe(0)
    // One stop on Tab for each group.
    expect((html.match(/role="radio"[^>]*tabindex="0"|tabindex="0"[^>]*role="radio"/g) ?? []).length).toBe(3)
    expect(html).toMatch(/aria-label="Dot plot on a line from 0 to 20\. The dots are at 4, 5, 5, 6, 7, 8\. The change: a new value, 19, is added\."/)
    const { texts, aloud } = said(html.replace('One more value is added. Predict what happens to each measure.', ''))
    // Before and after values stay back until it is marked.
    expect(`${texts} ${aloud}`).not.toMatch(/about 5\.83|about 7\.71|5\.5|so it |you said|Mean: |Median: |Range: /)
    expect(texts).toContain('Goes up')
  })

  it('predict: draws a removal and a move, with an arrow for the move', () => {
    const removal = view(predict([1, 5, 6, 7, 8, 9], { kind: 'remove', value: 1 }), {}, 'idle')
    expect(removal).toContain('The change: one dot, at 1, is taken away')
    expect(removal).toContain('The orange crossed dot is taken away.')
    const move = view(predict([3, 4, 5, 6, 8], { kind: 'move', from: 8, to: 16 }), {}, 'idle')
    expect(move).toContain('The change: one dot moves from 8 to 16')
    expect(move).toContain('moves to the dashed dot at its end')
    expect(move).toMatch(/<path d="M [\d.]+ [\d.]+ l -?7 -4\.5 v 9 Z"/)
  })

  it('predict: names every measure’s before and after only once marked, and keeps the picks standing', () => {
    const wrong = view(PREDICT, { answers: { mean: 'up', median: 'down' } }, 'wrong')
    expect(wrong).toContain('Mean: about 5.83 to about 7.71, so it goes up.')
    expect(wrong).toContain('Median: you said it goes down, but it goes 5.5 to 6, so it goes up.')
    expect(wrong).toMatch(/aria-checked="true"/)
    const right = view(PREDICT, engine.solve(PREDICT), 'right')
    expect(right).toContain('Range: 4 to 15, so it goes up.')
    expect(right).toMatch(/aria-disabled="true"/)
  })

  it('choose: shows the situation and its data, and neither the best average nor any of its working', () => {
    for (const s of SCENARIOS) {
      const html = card(choose(s.id), 'Which average is best, and why?')
      expect(html, s.id).toContain(s.setting)
      expect((html.match(/role="radiogroup"/g) ?? []).length, s.id).toBe(2)
      expect((html.match(/role="radio"/g) ?? []).length, s.id).toBe(6)
      expect((html.match(/aria-checked="true"/g) ?? []).length, s.id).toBe(0)
      expect(html, s.id).toContain('Which average is best here?')
      expect(html, s.id).toContain('Which reason fits?')
      const { texts, aloud } = said(html.replace('Which average is best, and why?', ''))
      expect(`${texts} ${aloud}`, s.id).not.toMatch(/is the best average|Why:|pulls the mean|shared out equally, give|You chose|most common (shoe|number)/)
      expect(aloud, s.id).toContain(`There are ${s.values.length} values`)
    }
  })

  it('choose: lays the choices out the same for every situation, so the order says nothing', () => {
    const order = (id: string) => [...card(choose(id), 'Which average?').matchAll(/role="radio"[^>]*>([^<]*)</g)].map((m) => m[1])
    const first = order('shoe-sizes')
    expect(first).toEqual(['Mean', 'Median', 'Mode', REASONS.mean, REASONS.median, REASONS.mode])
    for (const s of SCENARIOS) expect(order(s.id), s.id).toEqual(first)
    // And the same one stop on Tab: the first of each group while nothing is picked.
    const stops = (id: string) => [...card(choose(id), 'Which average?').matchAll(/<button[^>]*tabindex="0"[^>]*>([^<]*)</g)].map((m) => m[1])
    for (const s of SCENARIOS) expect(stops(s.id), s.id).toEqual(['Mean', REASONS.mean])
  })

  it('choose: says the best average and why once marked, and leaves the picks standing', () => {
    const wrong = view(choose('house-prices'), { average: 'mean', reason: 'mean' }, 'wrong')
    expect(wrong).toContain('You chose the mean. The best average here is the median.')
    expect(wrong).toContain('pulls the mean up to £232.5k, higher than 7 of the 8 values')
    expect(wrong).toMatch(/aria-checked="true"/)
    const right = view(choose('house-prices'), engine.solve(choose('house-prices')), 'right')
    expect(right).toContain('The median is the best average here.')
    expect(right).toMatch(/aria-disabled="true"/)
  })

  it('names no answer before marking, on any card, even to a screen reader', () => {
    for (const c of [MAKE, make(5, { mode: 3, median: 4 }), PREDICT, predict([1, 5, 6, 7, 8, 9], { kind: 'remove', value: 1 }), ...SCENARIOS.map((s) => choose(s.id))]) {
      const html = view(c, engine.initial(c), 'idle')
      expect(html, JSON.stringify(c)).not.toMatch(/You (made|chose)|Your dots|so it (goes|stays)|you said|is the best average|Why: |needs to be/)
    }
  })

  it('still draws a state it cannot read, as the start', () => {
    for (const c of [MAKE, PREDICT, choose('shoe-sizes')]) {
      for (const bad of [null, undefined, 'junk', 7, { dots: 'x', answers: 5, average: 3 }, { dots: [999, -1, 'a'], answers: { mean: 'x' }, average: 'spoon', reason: [] }]) {
        expect(() => view(c, bad, 'idle'), `${JSON.stringify(c)} ${JSON.stringify(bad)}`).not.toThrow()
        expect(() => view(c, bad, 'wrong'), `${JSON.stringify(c)} ${JSON.stringify(bad)}`).not.toThrow()
      }
    }
  })

  it('draws a config it cannot show as a plain message, not a crash', () => {
    expect(view(make(4, { mean: 6 }), {}, 'idle')).toContain('This data could not be drawn.')
    expect(view({ task: { kind: 'make', mean: 6 } }, {}, 'idle')).toContain('This data could not be drawn.')
    expect(view({ task: { kind: 'predict', values: [], measures: ['mean'] } }, {}, 'idle')).toContain('This data could not be drawn.')
    expect(view(choose('tennis'), {}, 'idle')).toContain('This situation could not be drawn.')
    // The playable cards are drawn even at the edges of what is allowed.
    expect(() => view(make(10, { range: 20 }), {}, 'idle')).not.toThrow()
    expect(() => view(predict([20, 20, 20, 20, 19, 19, 19, 19, 18], { kind: 'add', value: 20 }), {}, 'idle')).not.toThrow()
  })

  it('has no text smaller than 12 px and no text split mid-word', () => {
    for (const c of [MAKE, PREDICT, predict([3, 4, 5, 6, 8], { kind: 'move', from: 8, to: 16 }), ...SCENARIOS.map((s) => choose(s.id))]) {
      const html = view(c, engine.initial(c), 'idle')
      for (const m of html.matchAll(/font-size[:=]"?(\d+(?:\.\d+)?)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/break-all|break-words|capitalize/)
    }
  })

  it('moves nothing under reduced motion because nothing moves by itself', () => {
    for (const c of [MAKE, PREDICT, choose('house-prices')]) {
      const html = renderToStaticMarkup(createElement(StatsExplorerView, { config: c, state: engine.initial(c) as never, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
      expect(html).not.toMatch(/animate|transition|keyframes/)
    }
  })

  it('draws the dots a state holds, one circle each, and the flag of the column only when the learner is on it', () => {
    const html = view(MAKE, { dots: [3, 3, 5, 8] }, 'idle')
    const dots = html.match(/<g fill="#2563EB"[^>]*>(.*?)<\/g>/)?.[1].match(/<circle /g) ?? []
    expect(dots).toHaveLength(4)
    // Not focused in a static render: no band or flag over a column.
    expect(html).not.toContain('stroke="var(--subject)"')
    expect(targetChips(makeTask(MAKE))).toEqual(['Mean: 6', 'Range: 8'])
  })

  it('the numbers a make card shows are the targets, and match the engine’s own goal', () => {
    expect(makeGoal(makeTask(MAKE))).toEqual({ sum: 36, range: 8 })
    expect(makeGoal(makeTask(make(6, { mean: 6.5 })))).toEqual({ sum: 39 })
    expect(makeGoal(makeTask(make(5, { mean: 6.5 })))).toBeNull()
    expect(makeGoal(makeTask(make(7, { median: 4.5 })))).toBeNull()
    expect(makeGoal(makeTask(make(8, { median: 4.5 })))).toEqual({ med2: 9 })
  })
})

// Types used only to keep the imports honest.
export type { Scenario }
