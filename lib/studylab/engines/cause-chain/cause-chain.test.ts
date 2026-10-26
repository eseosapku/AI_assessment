import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  causeChainEngine as engine, judge, propagation, ringOrder, readsInOrder, statedLinks, learnerLinks,
  withLink, withoutLink, effectChoices, polarity, promptFaults,
  type CauseChainConfig, type CauseChainState, type Effect, type Link,
} from './config'
import { CauseChainView, ringGeometry, arrowGeometry } from './View'
import { getEngine } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Cause and consequence, built: the tutor states the links, the learner draws
 * them, the engine marks the structure and lights the chain from its start.
 */

// Push factors of rural-urban migration (Cambridge IGCSE Geography 0460, population migration):
// drought brings crop failure, which raises food prices and drives people to the cities.
const DROUGHT = {
  task: {
    kind: 'build-chain', start: 'drought',
    factors: [
      { id: 'drought', label: 'Drought' },
      { id: 'crop-failure', label: 'Crop failure' },
      { id: 'food-prices', label: 'Rising food prices' },
      { id: 'migration', label: 'Migration to cities' },
    ],
    links: [
      { from: 'drought', to: 'crop-failure', effect: 'causes' },
      { from: 'crop-failure', to: 'food-prices', effect: 'causes' },
      { from: 'crop-failure', to: 'migration', effect: 'causes' },
    ],
  },
}

// Deforestation and the drainage basin (Cambridge IGCSE Geography 0460, hydrographs and river flooding):
// fewer trees intercept less rain, so more runs off over the surface, eroding soil and raising flood risk.
const FOREST = {
  task: {
    kind: 'build-chain', start: 'deforestation',
    factors: [
      { id: 'deforestation', label: 'Deforestation' },
      { id: 'interception', label: 'Interception by leaves' },
      { id: 'runoff', label: 'Surface runoff' },
      { id: 'erosion', label: 'Soil erosion' },
      { id: 'flooding', label: 'Flood risk' },
    ],
    links: [
      { from: 'deforestation', to: 'interception', effect: 'decreases' },
      { from: 'interception', to: 'runoff', effect: 'decreases' },
      { from: 'runoff', to: 'erosion', effect: 'increases' },
      { from: 'runoff', to: 'flooding', effect: 'increases' },
    ],
  },
}

const read = (raw: unknown) => {
  const c = engine.parse(raw)
  if (!c) throw new Error('did not parse')
  return c
}
/** A copy of a fixture with its task changed. */
const variant = (base: typeof DROUGHT, change: (t: Record<string, unknown> & typeof DROUGHT.task) => void) => {
  const copy = JSON.parse(JSON.stringify(base))
  change(copy.task)
  return copy
}
const L = (from: string, to: string, effect: Effect = 'causes'): Link => ({ from, to, effect })

describe('reading a chain', () => {
  it('reads the documented config', () => {
    expect(engine.parse(DROUGHT)).toEqual(DROUGHT)
  })

  it('reads reasonable phrasings: labels for factors, labels or ids in links, effect words, an unstated start', () => {
    const c = read({
      task: {
        kind: 'Build chain',
        factors: ['Drought', 'Crop failure', { label: 'Rising food prices' }],
        links: [{ from: 'Drought', to: 'crop_failure' }, { from: 'Crop failure', to: 'rising-food-prices', effect: 'leads to' }],
      },
    })
    expect(c.task.start).toBe('drought')
    expect(c.task.factors.map((f) => f.id)).toEqual(['drought', 'crop-failure', 'rising-food-prices'])
    expect(c.task.links).toEqual([L('drought', 'crop-failure'), L('crop-failure', 'rising-food-prices')])
    const words = read({ task: { start: 'a', factors: ['A', 'B', 'C', 'D'], links: [
      { from: 'a', to: 'b', effect: 'Reduces' }, { from: 'b', to: 'c', effect: '+' }, { from: 'b', to: 'd', effect: 'raises' },
    ] } })
    expect(words.task.links.map((l) => l.effect)).toEqual(['decreases', 'increases', 'increases'])
    expect(read({ task: { start: 'A', factors: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], links: [L('a', 'b'), L('b', 'c')] } }).task.factors[0]).toEqual({ id: 'a', label: 'A' })
  })

  it('reads nothing it cannot honestly draw', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: { ...DROUGHT.task, kind: 'explore' } })).toBeNull()
    expect(engine.parse({ task: { ...DROUGHT.task, factors: 'Drought, Crop failure' } })).toBeNull()
    expect(engine.parse({ task: { ...DROUGHT.task, links: [{ from: 'drought', to: 'crop-failure', effect: 'prevents' }] } })).toBeNull()
    expect(engine.parse({ task: { ...DROUGHT.task, links: [{ from: 5, to: 'crop-failure' }] } })).toBeNull()
    expect(engine.parse({ task: { ...DROUGHT.task, factors: [...DROUGHT.task.factors, {}] } })).toBeNull()
    expect(engine.parse({ task: { ...DROUGHT.task, factors: Array.from({ length: 13 }, (_, i) => `F${i}`) } })).toBeNull()
    // No start, and two factors that nothing leads into: which one starts it cannot be told.
    expect(engine.parse({ task: { factors: ['A', 'B', 'C'], links: [L('a', 'c'), L('b', 'c')] } })).toBeNull()
  })
})

describe('what the engine refuses', () => {
  const faults = (raw: unknown) => engine.faults(read(raw)).join('\n')

  it('finds nothing wrong with a sound chain', () => {
    expect(engine.faults(read(DROUGHT))).toEqual([])
    expect(engine.faults(read(FOREST))).toEqual([])
  })

  it('refuses links to factors that do not exist, to themselves, or stated twice', () => {
    expect(faults(variant(DROUGHT, (t) => t.links.push(L('food-prices', 'famine'))))).toMatch(/"famine", which is not a factor/)
    expect(faults(variant(DROUGHT, (t) => t.links.push(L('migration', 'migration'))))).toMatch(/"Migration to cities" is linked to itself/)
    expect(faults(variant(DROUGHT, (t) => t.links.push(L('drought', 'crop-failure', 'decreases'))))).toMatch(/from "Drought" to "Crop failure" is stated twice/)
  })

  it('refuses a loop, a factor no link touches, and fewer than two links', () => {
    expect(faults(variant(DROUGHT, (t) => t.links.push(L('food-prices', 'drought'))))).toMatch(/loop \(Drought → Crop failure → Rising food prices → Drought\)/)
    expect(faults(variant(DROUGHT, (t) => t.factors.push({ id: 'tourism', label: 'Tourism' })))).toMatch(/"Tourism" is in no link/)
    expect(faults(variant(DROUGHT, (t) => t.links.splice(1)))).toMatch(/at least 2 links; this one has 1/)
  })

  it('refuses a star: every factor joined to the start only is not a chain', () => {
    const star = variant(DROUGHT, (t) => { t.links = [L('drought', 'crop-failure'), L('drought', 'food-prices'), L('drought', 'migration')] })
    expect(faults(star)).toMatch(/Every link joins the start "Drought"/)
  })

  it('refuses what a learner could not work out: an unreachable factor, a shortcut, two words for one sign', () => {
    const war = variant(DROUGHT, (t) => { t.factors.push({ id: 'war', label: 'War' }); t.links.push(L('war', 'food-prices')) })
    expect(faults(war)).toMatch(/"War" cannot be reached from the start "Drought"/)
    const shortcut = variant(DROUGHT, (t) => t.links.push(L('drought', 'food-prices')))
    expect(faults(shortcut)).toMatch(/from "Drought" to "Rising food prices" is already carried by Drought → Crop failure → Rising food prices/)
    const mixed = variant(DROUGHT, (t) => { t.links[1].effect = 'increases' })
    expect(faults(mixed)).toMatch(/both "causes" and "increases"/)
  })

  it('refuses too few or too many factors or links, shared ids or labels, long labels, an unknown start', () => {
    expect(faults({ task: { start: 'a', factors: ['A', 'B'], links: [L('a', 'b'), L('b', 'a')] } })).toMatch(/at least 3 factors/)
    const eight = { task: { start: 'f0', factors: Array.from({ length: 8 }, (_, i) => `F${i}`), links: Array.from({ length: 7 }, (_, i) => L(`f${i}`, `f${i + 1}`)) } }
    expect(faults(eight)).toMatch(/At most 7 factors/)
    const nine = { task: { start: 'f0', factors: Array.from({ length: 7 }, (_, i) => `F${i}`), links: [
      ...Array.from({ length: 6 }, (_, i) => L(`f${i}`, `f${i + 1}`)), L('f0', 'f2'), L('f0', 'f3'), L('f0', 'f4'),
    ] } }
    expect(faults(nine)).toMatch(/At most 8 links/)
    expect(faults(variant(DROUGHT, (t) => { t.factors[3].id = 'food-prices' }))).toMatch(/share the id "food-prices"/)
    expect(faults(variant(DROUGHT, (t) => { t.factors[3].label = 'crop failure' }))).toMatch(/both labelled "crop failure"/)
    expect(faults(variant(DROUGHT, (t) => { t.factors[3].label = 'Migration from the countryside to the cities' }))).toMatch(/too long for its card/)
    expect(faults(variant(DROUGHT, (t) => { t.start = 'famine' }))).toMatch(/The start "famine" is not one of the factors/)
  })

  it('is refused by the meaning gates when it would teach nothing, and passes them when sound', () => {
    const action = (config: unknown) => ({ type: 'createActivity', id: 'c1', spec: { pattern: 'scene', prompt: 'Starting from the drought, link what followed.', payload: { engine: 'cause-chain', config }, success: { kind: 'scene' } } })
    const star = variant(DROUGHT, (t) => { t.links = [L('drought', 'crop-failure'), L('drought', 'food-prices'), L('drought', 'migration')] })
    expect(meaningFaults(action(star)).join('\n')).toMatch(/Every link joins the start/)
    expect(meaningFaults(action(DROUGHT))).toEqual([])
    expect(validateSpec(action(DROUGHT).spec)).toBe(true)
  })
})

describe('the prompt a cause-chain card is written with', () => {
  const c = read(DROUGHT)

  it('may name the start and ask', () => {
    expect(promptFaults(c, 'Starting from the drought, link what followed, and say how.')).toEqual([])
    expect(promptFaults(c, 'How did the drought end with migration to cities? Build the chain.')).toEqual([])
  })

  it('may not state a link the learner is to find, either way round', () => {
    expect(promptFaults(c, 'Drought causes crop failure. Link what else follows.').join('\n')).toMatch(/gives away the link from "Drought" to "Crop failure"/)
    expect(promptFaults(c, 'Crop failure, caused by drought, had consequences. Link them.').join('\n')).toMatch(/from "Drought" to "Crop failure"/)
  })

  it('may not list the factors in the chain’s own order', () => {
    expect(promptFaults(c, 'Link drought, crop failure, rising food prices and migration to cities.').join('\n')).toMatch(/in the chain's own order/)
    expect(promptFaults(c, 'Link migration to cities, rising food prices, crop failure and drought.')).toEqual([])
  })

  it('passes the catalogue’s own example', () => {
    const example = JSON.parse(engine.prompt.slice(engine.prompt.indexOf('{ "type":"createActivity"')))
    expect(engine.promptFaults(read(example.spec.payload.config), example.spec.prompt)).toEqual([])
  })
})

describe('marking the learner’s chain', () => {
  const c = read(DROUGHT)
  const state = (...links: Link[]): CauseChainState => ({ links })
  const all = [L('drought', 'crop-failure'), L('crop-failure', 'food-prices'), L('crop-failure', 'migration')]

  it('starts unsolved and is solved by the stated links', () => {
    expect(engine.initial(c)).toEqual({ links: [] })
    expect(engine.check(c, engine.initial(c)).ok).toBe(false)
    expect(engine.check(c, engine.solve(c)).ok).toBe(true)
    expect(engine.check(c, state(...[...all].reverse())).ok).toBe(true)
  })

  it('is wrong while a stated link is missing', () => {
    const v = judge(c, state(all[0], all[1]))
    expect(v.ok).toBe(false)
    expect(v.missing).toEqual([all[2]])
  })

  it('is wrong for a link drawn the wrong way round, or with the opposite effect, and names those links', () => {
    const reversed = engine.check(c, state(L('crop-failure', 'drought'), all[1], all[2]))
    expect(reversed).toEqual({ ok: false, wrongIds: ['crop-failure>drought'] })
    const opposite = judge(c, state(all[0], L('crop-failure', 'food-prices', 'decreases'), all[2]))
    expect(opposite.ok).toBe(false)
    expect(opposite.judged.find((j) => j.link.to === 'food-prices')?.status).toBe('opposite')
  })

  it('reads the sign, not the word: "increases" for a stated "causes" is right', () => {
    expect(engine.check(c, state(L('drought', 'crop-failure', 'increases'), all[1], all[2])).ok).toBe(true)
    expect(polarity('causes')).toBe(polarity('increases'))
    expect(polarity('decreases')).toBe(-1)
  })

  it('allows links the tutor did not state, and marks them neither right nor wrong', () => {
    const v = judge(c, state(...all, L('migration', 'food-prices'), L('drought', 'migration', 'decreases')))
    expect(v.ok).toBe(true)
    expect(v.judged.filter((j) => j.status === 'extra')).toHaveLength(2)
  })

  it('never fails on a state it cannot read', () => {
    for (const bad of [null, undefined, {}, { links: 'x' }, { links: [null, { from: 1 }, { from: 'drought', to: 'nowhere', effect: 'causes' }, { from: 'drought', to: 'crop-failure', effect: 'maybe' }] }]) {
      expect(engine.check(c, bad as never).ok).toBe(false)
    }
  })

  it('keeps one link for each ordered pair, the last drawn', () => {
    expect(learnerLinks(c, state(L('drought', 'crop-failure', 'decreases'), L('drought', 'crop-failure')))).toEqual([L('drought', 'crop-failure')])
  })
})

describe('drawing links', () => {
  it('draws one link between two factors: a new one, either way round, replaces the old', () => {
    const one = withLink({ links: [] }, L('drought', 'crop-failure'))
    expect(withLink(one, L('crop-failure', 'drought', 'decreases'))).toEqual({ links: [L('crop-failure', 'drought', 'decreases')] })
    expect(withLink(one, L('crop-failure', 'food-prices')).links).toHaveLength(2)
    expect(withoutLink(one, 'crop-failure', 'drought')).toEqual({ links: [] })
  })

  it('offers the chain’s own word for a push up, and "decreases"', () => {
    expect(effectChoices(read(DROUGHT))).toEqual(['causes', 'decreases'])
    expect(effectChoices(read(FOREST))).toEqual(['increases', 'decreases'])
  })
})

describe('the consequences spreading from the start', () => {
  const c = read(DROUGHT)

  it('reaches every factor once the chain is right, a step at a time', () => {
    const s = propagation(c, engine.solve(c))
    expect(Object.fromEntries(s.depth)).toEqual({ 'drought': 0, 'crop-failure': 1, 'food-prices': 2, 'migration': 2 })
    expect(s.order.map((o) => [o.link.to, o.at])).toEqual([['crop-failure', 1], ['food-prices', 2], ['migration', 2]])
  })

  it('stops where the learner’s chain breaks', () => {
    const s = propagation(c, { links: [L('drought', 'crop-failure'), L('food-prices', 'crop-failure'), L('crop-failure', 'migration', 'decreases')] })
    expect([...s.depth.keys()]).toEqual(['drought', 'crop-failure'])
  })
})

describe('where the cards go', () => {
  it('puts the start first and every other factor once, the same way every time', () => {
    for (const raw of [DROUGHT, FOREST]) {
      const c = read(raw)
      const ring = ringOrder(c)
      expect(ring[0]).toBe(c.task.start)
      expect([...ring].sort()).toEqual(c.task.factors.map((f) => f.id).sort())
      expect(ringOrder(read(JSON.parse(JSON.stringify(raw))))).toEqual(ring)
      expect(readsInOrder(ring, statedLinks(c), true)).toBe(false)
      expect(readsInOrder(ring, statedLinks(c), false)).toBe(false)
    }
  })

  it('never lets two cards touch, nor any card leave the ring, for three to seven factors', () => {
    for (let n = 3; n <= 7; n++) {
      const g = ringGeometry(n)
      for (const s of g.slots) {
        expect(s.x - g.card.w / 2).toBeGreaterThanOrEqual(0)
        expect(s.x + g.card.w / 2).toBeLessThanOrEqual(g.w)
        expect(s.y - g.card.h / 2).toBeGreaterThanOrEqual(0)
        expect(s.y + g.card.h / 2).toBeLessThanOrEqual(g.h)
      }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const [a, b] = [g.slots[i], g.slots[j]]
          expect(Math.abs(a.x - b.x) >= g.card.w + 6 || Math.abs(a.y - b.y) >= g.card.h + 6, `${n} cards: ${i} and ${j}`).toBe(true)
        }
      }
    }
  })

  it('draws every possible arrow clear of the cards it does not join, with its sign in the open', () => {
    const inside = (p: { x: number; y: number }, c: { x: number; y: number }, w: number, h: number, pad = 0) =>
      Math.abs(p.x - c.x) < w / 2 + pad && Math.abs(p.y - c.y) < h / 2 + pad
    const bad: string[] = []
    for (let n = 3; n <= 7; n++) {
      const g = ringGeometry(n)
      g.slots.forEach((a, i) => g.slots.forEach((b, j) => {
        if (i === j) return
        const { curve: [p0, p1, p2, p3], badge } = arrowGeometry(a, b, g.centre)
        g.slots.forEach((c, k) => {
          if (inside(badge, c, g.card.w, g.card.h, 9)) bad.push(`${n} cards, ${i}→${j}: the sign is under card ${k}`)
          if (k === i || k === j) return
          for (let s = 0; s <= 40; s++) {
            const t = s / 40
            const m = 1 - t
            const p = {
              x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
              y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
            }
            if (inside(p, c, g.card.w, g.card.h)) {
              bad.push(`${n} cards, ${i}→${j}: passes under card ${k}`)
              break
            }
          }
        })
      }))
    }
    expect(bad).toEqual([])
  })
})

// ── Every valid chain ───────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const factorsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, label: `Factor ${String.fromCharCode(65 + i)}` }))
const withSigns = (shape: [string, string][], up: Effect, signs: number): Link[] =>
  shape.map(([from, to], i) => ({ from, to, effect: signs & (1 << i) ? 'decreases' : up }))

/** Every shape of chain on n factors that the engine accepts: every set of links between them, tried. */
function everyShape(n: number): CauseChainConfig[] {
  const factors = factorsOf(n)
  const pairs = factors.flatMap((a) => factors.filter((b) => b !== a).map((b): [string, string] => [a.id, b.id]))
  const out: CauseChainConfig[] = []
  for (let mask = 0; mask < 1 << pairs.length; mask++) {
    const shape = pairs.filter((_, i) => mask & (1 << i))
    if (shape.length < 2 || shape.length > 8) continue
    const plain: CauseChainConfig = { task: { kind: 'build-chain', factors, start: 'f0', links: withSigns(shape, 'causes', 0) } }
    if (engine.faults(plain).length === 0) out.push(plain)
  }
  return out
}

/** Every chain on n factors that the engine accepts: every shape, every sign, both words for a push up. */
function everyChain(n: number): CauseChainConfig[] {
  return everyShape(n).flatMap((plain) => {
    const shape = plain.task.links.map((l): [string, string] => [l.from, l.to])
    return (['causes', 'increases'] as const).flatMap((up) =>
      Array.from({ length: 1 << shape.length }, (_, signs) => ({ task: { ...plain.task, links: withSigns(shape, up, signs) } })))
  })
}

/** Random chains on five to seven factors, listed in any order, that the engine accepts. */
function randomChains(count: number, seed: number): CauseChainConfig[] {
  const rand = mulberry32(seed)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const out: CauseChainConfig[] = []
  for (let tries = 0; out.length < count && tries < count * 100; tries++) {
    const n = 5 + Math.floor(rand() * 3)
    const factors = factorsOf(n)
    // Each later factor follows from one or two before it; then a few links are thrown in anywhere.
    const shape: [string, string][] = []
    for (let i = 1; i < n; i++) {
      const parents = new Set([pick(factors.slice(0, i)).id])
      if (rand() < 0.35) parents.add(pick(factors.slice(0, i)).id)
      for (const p of parents) shape.push([p, factors[i].id])
    }
    while (rand() < 0.3) shape.push([pick(factors).id, pick(factors).id])
    const up = rand() < 0.5 ? 'causes' : 'increases'
    const links = withSigns(shape, up, Math.floor(rand() * 256))
    const listed = [...factors].sort(() => rand() - 0.5)
    const c: CauseChainConfig = { task: { kind: 'build-chain', factors: listed, start: 'f0', links: [...links].sort(() => rand() - 0.5) } }
    if (engine.faults(c).length === 0) out.push(c)
  }
  return out
}

/** Every way the promises can break for one config, in words. */
function broken(c: CauseChainConfig): string[] {
  const bad: string[] = []
  const name = JSON.stringify(c.task.links.map((l) => `${l.from}${l.effect === 'decreases' ? '-' : '+'}${l.to}`))
  const stated = statedLinks(c)
  const ok = (links: Link[]) => engine.check(c, { links }).ok
  const solved = engine.solve(c).links
  if (engine.check(c, engine.initial(c)).ok) bad.push(`${name}: solved at the start`)
  if (!ok(solved)) bad.push(`${name}: its solution fails`)
  stated.forEach((l, i) => {
    const others = solved.filter((_, j) => j !== i)
    if (ok(others)) bad.push(`${name}: solved without ${l.from}>${l.to}`)
    if (ok([...others, { from: l.to, to: l.from, effect: l.effect }])) bad.push(`${name}: solved with ${l.from}>${l.to} reversed`)
    if (ok([...others, { ...l, effect: polarity(l.effect) > 0 ? 'decreases' : 'causes' }])) bad.push(`${name}: solved with ${l.from}>${l.to} the other sign`)
  })
  const ids = c.task.factors.map((f) => f.id)
  for (const a of ids) {
    for (const b of ids) {
      if (a === b || stated.some((s) => (s.from === a && s.to === b) || (s.from === b && s.to === a))) continue
      if (!ok([...solved, { from: a, to: b, effect: 'decreases' }])) bad.push(`${name}: an extra ${a}>${b} was marked`)
    }
  }
  const depth = propagation(c, engine.solve(c)).depth
  if (depth.size !== ids.length) bad.push(`${name}: the chain reaches ${depth.size} of ${ids.length} factors`)
  const ring = ringOrder(c)
  if (ring[0] !== c.task.start || [...ring].sort().join() !== [...ids].sort().join()) bad.push(`${name}: the ring is not the factors, start first`)
  if (readsInOrder(ring, stated, true)) bad.push(`${name}: the ring reads in the chain's order`)
  // With two links between later factors, neither way round the ring spells the chain.
  if (stated.filter((l) => l.from !== c.task.start).length >= 2 && readsInOrder(ring, stated, false)) bad.push(`${name}: the ring reads in order anticlockwise`)
  return bad
}

// Every shape and layout scored for each chain: seconds of work, longer under a full run.
describe('every chain the engine accepts', { timeout: 30_000 }, () => {
  it('on three and four factors (every shape, sign and word): starts unsolved, can be solved, marks every link, ignores extras, never spells the answer', () => {
    expect(everyShape(3)).toHaveLength(2)
    // On four: the 15 trees from the start that are not a star, and the 3 diamonds.
    expect(everyShape(4)).toHaveLength(18)
    const chains = [...everyChain(3), ...everyChain(4)]
    // 2 shapes x 4 signs x 2 words, and (15 trees x 8 signs + 3 diamonds x 16) x 2 words.
    expect(chains).toHaveLength(16 + 336)
    expect(chains.flatMap(broken)).toEqual([])
  })

  it('on five factors (every shape, with random signs in both words): the same', () => {
    const rand = mulberry32(5)
    const shapes = everyShape(5)
    expect(shapes.length).toBeGreaterThan(200)
    const chains = shapes.flatMap((plain) => {
      const shape = plain.task.links.map((l): [string, string] => [l.from, l.to])
      return (['causes', 'increases'] as const).map((up) => ({ task: { ...plain.task, links: withSigns(shape, up, Math.floor(rand() * 256)) } }))
    })
    expect(chains.flatMap(broken)).toEqual([])
  })

  it('on five to seven factors (400 random, listed in any order): the same', () => {
    const chains = randomChains(400, 26)
    expect(chains).toHaveLength(400)
    expect(new Set(chains.map((c) => c.task.factors.length))).toEqual(new Set([5, 6, 7]))
    expect(chains.flatMap(broken)).toEqual([])
  })

  it('never fails on a chain it refuses, either', () => {
    const rand = mulberry32(7)
    for (let i = 0; i < 300; i++) {
      const n = 1 + Math.floor(rand() * 9)
      const factors = factorsOf(n)
      const links = Array.from({ length: Math.floor(rand() * 10) }, () => ({ from: `f${Math.floor(rand() * (n + 1))}`, to: `f${Math.floor(rand() * (n + 1))}`, effect: (['causes', 'increases', 'decreases'] as const)[Math.floor(rand() * 3)] }))
      const c: CauseChainConfig = { task: { kind: 'build-chain', factors, start: `f${Math.floor(rand() * (n + 1))}`, links } }
      expect(() => {
        engine.faults(c)
        engine.check(c, engine.solve(c))
        propagation(c, engine.solve(c))
        ringOrder(c)
        renderToStaticMarkup(createElement(CauseChainView, { config: c, state: engine.solve(c), setState: () => {}, marked: 'wrong', reduced: true, locked: false }))
      }).not.toThrow()
    }
  })
})

// ── On the board ────────────────────────────────────────────────────────────

describe('the cause-chain scene on the board', () => {
  const PROMPT = 'Starting from the drought, link what followed, and say how.'
  const card = (config: unknown) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt: PROMPT, payload: { engine: 'cause-chain', config }, success: { kind: 'scene' } } },
    } as never)))
  const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  it('draws every factor as a button the keyboard can reach, the start marked', () => {
    const html = card(DROUGHT)
    for (const f of DROUGHT.task.factors) expect(html).toMatch(new RegExp(`<button[^>]*aria-label="${f.label}[^"]*"`))
    expect(html).toMatch(/aria-label="Drought, the start"/)
    expect(html).toMatch(/Tap a factor, then the factor it affects/)
  })

  it('shows no link, no effect and no order of the chain before it is marked', () => {
    const html = card(DROUGHT).replace(PROMPT, '')
    expect(html).not.toMatch(/data-link|→/)
    expect(html.toLowerCase()).not.toMatch(/\b(causes|increases|decreases)\b/)
    // The cards come in the ring's order, which never reads as the chain.
    const order = DROUGHT.task.factors.map((f) => ({ id: f.id, at: html.indexOf(`aria-label="${f.label}`) })).sort((a, b) => a.at - b.at).map((f) => f.id)
    expect(order[0]).toBe('drought')
    expect(readsInOrder(order, DROUGHT.task.links as Link[], true)).toBe(false)
  })

  const view = (raw: unknown, links: Link[], marked: SceneMarked) => {
    const config = read(raw)
    return renderToStaticMarkup(createElement(CauseChainView, { config, state: { links }, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))
  }

  it('draws the learner’s own links as they make them, unmarked', () => {
    const html = view(DROUGHT, [L('crop-failure', 'drought')], 'idle')
    expect(html).toMatch(/data-link="crop-failure&gt;drought"/)
    expect(text(html)).toMatch(/Crop failure \+ causes Drought/)
    expect(text(html)).not.toMatch(/wrong way|fits the chain|reached from the start/)
  })

  it('once right, lights the whole chain from the start and reads it out in order', () => {
    const html = view(DROUGHT, engine.solve(read(DROUGHT)).links, 'right')
    expect(html.match(/reached from the start/g)).toHaveLength(4)
    expect(text(html)).toMatch(/The chain from Drought, a step at a time/)
    expect(text(html)).toMatch(/1 Drought \+ causes Crop failure 2 Crop failure \+ causes Rising food prices 2 Crop failure \+ causes Migration to cities/)
  })

  it('when wrong, says what the learner made and where it goes against the chain', () => {
    const html = text(view(FOREST, [L('deforestation', 'interception', 'decreases'), L('runoff', 'interception', 'increases'), L('runoff', 'erosion', 'decreases')], 'wrong'))
    expect(html).toMatch(/You made 3 links: 1 fits the chain, 2 go against it\./)
    expect(html).toMatch(/runs the wrong way/)
    expect(html).toMatch(/has the opposite effect/)
    // Flood risk is the one with nothing drawn to it; the two drawn wrong are flagged, not counted again.
    expect(html).toMatch(/1 more link is needed/)
  })
})

describe('the catalogue entry', () => {
  it('is registered for the tutor, isolating consequence', () => {
    expect(getEngine('cause-chain')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/^SCENE "cause-chain"/)
    expect(engine.prompt).toMatch(/"isolates":"consequence", "apparatus":"scene:cause-chain"/)
  })

  it('gives an example the engine accepts as it stands', () => {
    const example = JSON.parse(engine.prompt.slice(engine.prompt.indexOf('{ "type":"createActivity"')))
    expect(example.spec.payload.engine).toBe('cause-chain')
    expect(example.spec.success).toEqual({ kind: 'scene' })
    expect(engine.faults(read(example.spec.payload.config))).toEqual([])
    expect(validateSpec(example.spec)).toBe(true)
    expect(meaningFaults(example)).toEqual([])
  })
})
