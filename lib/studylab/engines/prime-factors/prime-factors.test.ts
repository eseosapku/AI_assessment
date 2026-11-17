// lib/studylab/engines/prime-factors/prime-factors.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  expandedText, factorPairs, gcd, indexText, isPrime, lcmAt, madeText, pairedOf, pairDone, primeFactors,
  primeFactorsEngine, sharedCounts, solvedTree, treeDone, treeLeaves, working,
  MAX_NUMBER, MAX_PRIMES, MAX_SHARED, type PairConfig, type PairState, type PrimeConfig, type TreeConfig, type TreeState,
} from './config'
import { layoutTree, pairTiles, PrimeFactorsView, TILE_H, TREE_H, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const tree = (number: number) => primeFactorsEngine.parse({ task: 'tree', number }) as TreeConfig
const pair = (a: number, b: number, find: 'hcf' | 'lcm' = 'hcf') => primeFactorsEngine.parse({ task: 'pair', a, b, find }) as PairConfig
const clean = (c: PrimeConfig | null) => c && primeFactorsEngine.faults(c).length === 0

describe('exact prime arithmetic', () => {
  it('knows primes and every proper factor choice', () => {
    expect([2, 3, 5, 7, 11, 13, 17, 19].every(isPrime)).toBe(true)
    expect([0, 1, 4, 9, 15, 21, 1.5, -3].every((n) => !isPrime(n))).toBe(true)
    expect(factorPairs(360)).toEqual([2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18])
    expect(factorPairs(17)).toEqual([])
    expect(primeFactors(360)).toEqual([2, 2, 2, 3, 3, 5])
    expect(expandedText(primeFactors(360))).toBe('2 × 2 × 2 × 3 × 3 × 5')
    expect(indexText(primeFactors(360))).toBe('2³ × 3² × 5')
  })

  it('pairs repeated primes one copy at a time', () => {
    expect([...sharedCounts(72, 180)]).toEqual([[2, 2], [3, 2]])
    expect([...sharedCounts(8, 12)]).toEqual([[2, 2]])
    expect([...sharedCounts(8, 27)]).toEqual([])
    const c = pair(72, 180, 'lcm')
    const s: PairState = { paired: { 2: 99, 3: 1, 5: 4 } }
    expect([...pairedOf(c, s)]).toEqual([[2, 2], [3, 1]])
    expect(lcmAt(c, s)).toBe(1080)
  })
})

describe('the hands-on tree', () => {
  it('accepts different routes and gives the same leaves', () => {
    const c = tree(360)
    const a: TreeState = { splits: { '': [10, 36], l: [2, 5], r: [6, 6], rl: [2, 3], rr: [2, 3] } }
    expect(treeDone(c, a)).toBe(true)
    expect(primeFactorsEngine.check(c, a).ok).toBe(true)
    expect(treeLeaves(c, a).map((n) => n.n).sort((x, y) => x - y)).toEqual(primeFactors(360))
    expect(primeFactorsEngine.check(c, solvedTree(360)).ok).toBe(true)
  })

  it('does not count a non-factor or a 1 × n change as a split', () => {
    const c = tree(84)
    expect(primeFactorsEngine.check(c, { splits: { '': [5, 17] } }).ok).toBe(false)
    expect(primeFactorsEngine.check(c, { splits: { '': [1, 84] } }).ok).toBe(false)
    expect(treeLeaves(c, { splits: {} }).map((n) => n.n)).toEqual([84])
  })

  it('lays every node inside the panel, without touching sibling tiles', () => {
    for (const n of [4, 12, 84, 180, 360]) {
      const c = tree(n)
      for (const s of [primeFactorsEngine.initial(c) as TreeState, solvedTree(n)]) {
        const placed = layoutTree(c, s)
        expect(placed.every((p) => p.x - 21 >= 0 && p.x + 21 <= W && p.y - TILE_H / 2 >= 0 && p.y + TILE_H / 2 < TREE_H - 22)).toBe(true)
        for (const a of placed) for (const b of placed) {
          if (a.id < b.id && a.depth === b.depth) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(42)
        }
      }
    }
  })
})

describe('reading configs and refusing only what cannot be drawn', () => {
  it('reads broad semantic phrasings', () => {
    expect(primeFactorsEngine.parse({ task: 'prime factorisation', number: '360' })).toEqual(tree(360))
    expect(primeFactorsEngine.parse({ task: { kind: 'factor tree', n: 84 } })).toEqual(tree(84))
    expect(primeFactorsEngine.parse({ task: 'hcf', first: 84, second: 180 })).toEqual(pair(84, 180))
    expect(primeFactorsEngine.parse({ a: 24, b: 60, find: 'least common multiple' })).toEqual(pair(24, 60, 'lcm'))
    expect(primeFactorsEngine.parse(null)).toBeNull()
    expect(primeFactorsEngine.parse({ task: 'tree' })).toBeNull()
  })

  it('gives a nearby working example for every refusal', () => {
    expect(primeFactorsEngine.faults(tree(7)).join(' ')).toMatch(/already prime.*360/)
    expect(primeFactorsEngine.faults(tree(1000)).join(' ')).toMatch(/2 to 360.*360/)
    expect(primeFactorsEngine.faults(tree(12.5)).join(' ')).toMatch(/whole number.*360/)
    expect(primeFactorsEngine.faults(pair(14, 15)).join(' ')).toMatch(/share no prime.*84 and b 180/)
    expect(primeFactorsEngine.faults(pair(60, 60)).join(' ')).toMatch(/both 60.*84 and b 180/)
    expect(primeFactorsEngine.faults(tree(4))).toEqual([])
    expect(primeFactorsEngine.faults(pair(84, 180, 'lcm'))).toEqual([])
  })

  it('catches its stations and not the neighbouring scenes', () => {
    expect(scenesFor('Prime factorisation: product of prime factors').map((e) => e.id)).toContain('prime-factors')
    expect(scenesFor('Highest common factor and lowest common multiple').map((e) => e.id)).toContain('prime-factors')
    expect(sceneCatalogue('Factor trees and HCF')).toContain('SCENE "prime-factors"')
    expect(scenesFor('Sets and Venn diagrams of numbers').map((e) => e.id)).not.toContain('prime-factors')
    expect(scenesFor('Factorising algebraic expressions').map((e) => e.id)).not.toContain('prime-factors')
    expect(scenesFor('Place value and number sequences').map((e) => e.id)).not.toContain('prime-factors')
  })
})

/** Every drawable tree, and 200 deterministic pairs spanning the accepted range. */
function configs(): PrimeConfig[] {
  const out: PrimeConfig[] = []
  for (let n = 2; n <= MAX_NUMBER; n++) {
    const c = tree(n)
    if (clean(c) && primeFactors(n).length <= MAX_PRIMES) out.push(c)
  }
  let seed = 31
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed }
  let tries = 0
  while (out.filter((c) => c.task === 'pair').length < 200 && tries++ < 10000) {
    const a = 2 + random() % (MAX_NUMBER - 1)
    const b = 2 + random() % (MAX_NUMBER - 1)
    const c = pair(a, b, out.length % 2 ? 'hcf' : 'lcm')
    if (clean(c) && sharedCounts(a, b).size && [...sharedCounts(a, b).values()].reduce((s, n) => s + n, 0) <= MAX_SHARED) out.push(c)
  }
  return out
}

describe('every valid configuration', { timeout: 30_000 }, () => {
  const all = configs()
  it('starts unsolved and its solve passes', () => {
    expect(all.length).toBeGreaterThan(400)
    expect(all.filter((c) => c.task === 'pair')).toHaveLength(200)
    for (const c of all) {
      const start = primeFactorsEngine.initial(c)
      const solved = primeFactorsEngine.solve(c)
      expect(primeFactorsEngine.check(c, start).ok, `starts solved ${JSON.stringify(c)}`).toBe(false)
      expect(primeFactorsEngine.check(c, solved).ok, `cannot solve ${JSON.stringify(c)}`).toBe(true)
      expect(primeFactorsEngine.check(c, solved).wrongIds).toEqual([])
    }
  })

  it('pair solve makes every allowed pair and gives the exact HCF/LCM', () => {
    for (const c of all.filter((x): x is PairConfig => x.task === 'pair')) {
      const s = primeFactorsEngine.solve(c) as PairState
      expect(pairDone(c, s)).toBe(true)
      expect(lcmAt(c, s)).toBe((c.a * c.b) / gcd(c.a, c.b))
      for (const tile of pairTiles(c, s)) {
        expect(tile.x - 21 >= 0 && tile.x + 21 <= W).toBe(true)
        expect(tile.y - 17 >= 0 && tile.y + 17 <= 224).toBe(true)
      }
    }
  })
})

describe('the prompt and what is hidden before marking', () => {
  const faults = (c: PrimeConfig, prompt: string) => primeFactorsEngine.promptFaults!(c, prompt)
  it('refuses answers and gestures the card does not have', () => {
    expect(faults(tree(360), 'Write 360 = 2 × 2 × 2 × 3 × 3 × 5.').join(' ')).toMatch(/gives the prime factorisation away/)
    expect(faults(tree(84), 'Split 84 into 2² × 3 × 7.').join(' ')).toMatch(/gives the prime factorisation away/)
    expect(faults(pair(84, 180), 'The HCF of 84 and 180 is 12.').join(' ')).toMatch(/gives the HCF/)
    expect(faults(pair(84, 180, 'lcm'), 'Drag the tiles to find the LCM.').join(' ')).toMatch(/does not show/)
    expect(faults(tree(360), 'Tap a composite tile, choose a factor with − and +, then press Split. Break 360 into primes.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('prime-factors')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{[^}]*\})/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })

  const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'prime-factors', config }, success: { kind: 'scene' } } },
  } as never)))

  it('has real labelled controls and no finished answer before marking', () => {
    const html = card({ task: 'tree', number: 360 }, 'Tap a composite tile, choose a factor with − and +, then press Split. Break 360 into primes.')
    expect(html).toContain('aria-label="Split 360 into 2 times 180"')
    expect(html).toContain('Gold tiles are prime')
    expect(html).not.toContain('2³')
    expect(html).not.toContain('2 × 2 × 2')
    const p = card({ task: 'pair', a: 84, b: 180, find: 'hcf' }, 'Tap a prime in the 84 row, then an equal prime in the 180 row. Pair all the shared primes to find the HCF.')
    expect(p).toContain('Prime 2 in the 84 row')
    expect(p).toContain('Shared product')
    expect(p).not.toContain('HCF(84, 180)')
  })

  it('marks from the rules and explains what was made', () => {
    const c = tree(84)
    const right = renderToStaticMarkup(createElement(PrimeFactorsView, { config: c, state: primeFactorsEngine.solve(c), setState: () => {}, marked: 'right', reduced: true, locked: true }))
    expect(right).toContain('84 = 2² × 3 × 7')
    expect(right).toContain('Every route')
    const wrong = madeText(c, { splits: { '': [6, 14] } })
    expect(wrong).toContain('6 and 14')
    expect(wrong).toContain('still composite')
    const pc = pair(84, 180)
    expect(working(pc, primeFactorsEngine.solve(pc))).toContain('HCF(84, 180) = 12')
    expect(madeText(pc, { paired: { 2: 1 } })).toContain('2 × 3 can still be matched')
  })
})
