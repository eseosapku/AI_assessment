import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  foodWebEngine as engine, WEBS, HABITATS, KINDS, ROLES, webFaults, webArrows, levels, roleOf, removalEffects, removable,
  judgeArrows, learnerArrows, toggleArrow, withoutArrow, withRole, withChange, ringOrder, ringGeometry, readsInLevelOrder,
  correlation, crossings, layoutScore, sideBySide, promptFaults, mentions,
  type FoodWebConfig, type FoodWebState, type Arrow, type HabitatId,
} from './config'
import { FoodWebView, arrowGeometry, bezier } from './View'
import { getEngine } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Food chains and webs, computed: the tutor names a habitat and a task, the
 * engine supplies the organisms and who feeds on whom, and marks the learner's
 * energy arrows, roles, or predictions.
 */

const read = (raw: unknown) => {
  const c = engine.parse(raw)
  if (!c) throw new Error(`did not parse: ${JSON.stringify(raw)}`)
  return c
}
const A = (from: string, to: string): Arrow => ({ from, to })
const POND = read({ task: { kind: 'draw-arrows', habitat: 'pond' } })

describe('the webs', () => {
  it('are each sound: 5 to 8 organisms, every one linked, and every consumer feeding on one trophic level only', () => {
    for (const id of HABITATS) expect(webFaults(WEBS[id]), id).toEqual([])
  })

  it('reach no higher than a tertiary consumer, and have a producer, a primary and a secondary consumer', () => {
    for (const id of HABITATS) {
      const lv = [...levels(WEBS[id]).values()]
      expect(Math.max(...lv), id).toBeLessThanOrEqual(3)
      for (const l of [0, 1, 2]) expect(lv, id).toContain(l)
    }
  })

  it('put each organism at the level the textbooks give it', () => {
    const role = (h: HabitatId, id: string) => roleOf(WEBS[h], id)
    expect(role('pond', 'algae')).toBe('producer')
    expect(role('pond', 'water-flea')).toBe('primary')
    expect(role('pond', 'stickleback')).toBe('secondary')
    expect(role('pond', 'heron')).toBe('tertiary')
    expect(role('woodland', 'tawny-owl')).toBe('tertiary')
    expect(role('woodland', 'ladybird')).toBe('secondary')
    expect(role('grassland', 'grass-snake')).toBe('tertiary')
    expect(role('grassland', 'kestrel')).toBe('secondary')
    expect(role('savanna', 'lion')).toBe('secondary')
    expect(role('savanna', 'impala')).toBe('primary')
  })

  it('give every organism names no other organism of its web shares', () => {
    for (const id of HABITATS) {
      const forms = WEBS[id].organisms.flatMap((x) => [...new Set([x.name, x.plural, ...(x.also ?? [])])])
      expect(new Set(forms).size, id).toBe(forms.length)
    }
  })

  it('catches a web a consumer of two levels would make arguable', () => {
    const mixed = { ...WEBS.pond, organisms: WEBS.pond.organisms.map((x) => (x.id === 'heron' ? { ...x, eats: ['stickleback', 'water-flea'] } : x)) }
    expect(webFaults(mixed).join('\n')).toMatch(/heron feeds on more than one trophic level/)
  })
})

describe('reading a food-web config', () => {
  it('reads the documented configs', () => {
    expect(engine.parse({ task: { kind: 'draw-arrows', habitat: 'pond' } })).toEqual({ task: { kind: 'draw-arrows', habitat: 'pond' } })
    expect(engine.parse({ task: { kind: 'roles', habitat: 'woodland' } })).toEqual({ task: { kind: 'roles', habitat: 'woodland' } })
    expect(engine.parse({ task: { kind: 'remove', habitat: 'pond', remove: 'stickleback' } })).toEqual({ task: { kind: 'remove', habitat: 'pond', remove: 'stickleback' } })
  })

  it('reads reasonable phrasings of the kind, the habitat and the organism', () => {
    expect(read({ task: { kind: 'Draw arrows', habitat: 'A pond' } }).task).toEqual({ kind: 'draw-arrows', habitat: 'pond' })
    expect(read({ task: { kind: 'trophic_levels', habitat: 'Savannah' } }).task).toEqual({ kind: 'roles', habitat: 'savanna' })
    expect(read({ task: { kind: 'roles', habitat: 'meadow' } }).task.habitat).toBe('grassland')
    expect(read({ task: { kind: 'roles', habitat: 'oak woodland' } }).task.habitat).toBe('woodland')
    expect(read({ task: { kind: 'remove', habitat: 'pond', remove: 'Sticklebacks' } }).task).toEqual({ kind: 'remove', habitat: 'pond', remove: 'stickleback' })
    expect(read({ task: { kind: 'remove species', habitat: 'grassland', species: 'grass_snake' } }).task).toEqual({ kind: 'remove', habitat: 'grassland', remove: 'grass-snake' })
    expect(read({ task: { kind: 'remove', habitat: 'woodland', organism: 'the tawny owls' } }).task).toEqual({ kind: 'remove', habitat: 'woodland', remove: 'tawny-owl' })
  })

  it('reads nothing it cannot honestly draw', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: { kind: 'draw-arrows' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'draw-arrows', habitat: 'rocky shore' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'explore', habitat: 'pond' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'remove', habitat: 'pond' } })).toBeNull()
    // A chicken is no organism of any web here: its level depends on what it is fed.
    expect(engine.parse({ task: { kind: 'remove', habitat: 'grassland', remove: 'chicken' } })).toBeNull()
    expect(engine.parse({ task: { kind: 'remove', habitat: 'pond', remove: 'lion' } })).toBeNull()
  })
})

describe('taking a species out', () => {
  const effects = (h: HabitatId, id: string) => Object.fromEntries(removalEffects(WEBS[h], id).map((e) => [e.id, e.change]))

  it('asks only what the arrows alone decide: the only food gone falls, the only predator gone rises', () => {
    expect(effects('pond', 'stickleback')).toEqual({ 'water-flea': 'rise', 'mayfly-nymph': 'rise', pike: 'fall', heron: 'fall' })
    expect(effects('pond', 'algae')).toEqual({ 'water-flea': 'fall', 'mayfly-nymph': 'fall' })
    expect(effects('savanna', 'lion')).toEqual({ zebra: 'rise', wildebeest: 'rise', giraffe: 'rise' })
    expect(effects('woodland', 'shrew')).toEqual({ caterpillar: 'rise', 'tawny-owl': 'fall' })
    // The pond snail also eats pondweed; the stickleback has two predators: neither is asked.
    expect(effects('pond', 'algae')['pond-snail']).toBeUndefined()
    expect(effects('pond', 'pike')).toEqual({})
  })

  it('says why, from the arrows', () => {
    const [heron] = removalEffects(WEBS.pond, 'stickleback').filter((e) => e.id === 'heron')
    expect(heron.because).toBe('It fed only on sticklebacks.')
    const [flea] = removalEffects(WEBS.pond, 'stickleback').filter((e) => e.id === 'water-flea')
    expect(flea.because).toBe('Only sticklebacks fed on it.')
  })

  it('refuses a removal that asks nothing, naming the ones that do', () => {
    expect(engine.faults(read({ task: { kind: 'remove', habitat: 'pond', remove: 'pike' } })).join('\n'))
      .toMatch(/Taking the pike out of the pond changes no population.*remove one of "algae", "pond snail", "stickleback"/)
    expect(engine.faults(read({ task: { kind: 'remove', habitat: 'pond', remove: 'stickleback' } }))).toEqual([])
  })

  it('lists in its catalogue entry exactly the removals that ask something', () => {
    for (const id of HABITATS) {
      expect(engine.prompt).toContain(`${id}: ${removable(WEBS[id]).map((x) => WEBS[id].organisms.find((o) => o.id === x)!.name).join(', ')}`)
    }
  })
})

describe('marking the energy arrows', () => {
  const web = webArrows(WEBS.pond)

  it('starts with no arrows, and is solved by the web drawn food to feeder, in any order', () => {
    expect(engine.initial(POND)).toEqual({ arrows: [] })
    expect(engine.check(POND, engine.initial(POND)).ok).toBe(false)
    expect(engine.check(POND, engine.solve(POND)).ok).toBe(true)
    expect(engine.check(POND, { arrows: [...web].reverse() }).ok).toBe(true)
  })

  it('marks the classic error: an arrow from the feeder to its food', () => {
    const backwards = web.map((a) => A(a.to, a.from))
    const v = judgeArrows(POND, { arrows: backwards })
    expect(v.ok).toBe(false)
    expect(v.judged.every((j) => j.status === 'reversed')).toBe(true)
    expect(engine.check(POND, { arrows: [...web.slice(1), A('water-flea', 'algae')] })).toEqual({ ok: false, wrongIds: ['water-flea>algae'] })
  })

  it('marks an arrow the field notes do not give, and a missing one', () => {
    expect(engine.check(POND, { arrows: [...web, A('pike', 'heron')] })).toEqual({ ok: false, wrongIds: ['pike>heron'] })
    const v = judgeArrows(POND, { arrows: web.slice(1) })
    expect(v.ok).toBe(false)
    expect(v.missing).toEqual([web[0]])
  })

  it('keeps one arrow between two organisms, the last drawn, and never fails on a state it cannot read', () => {
    expect(learnerArrows(POND, { arrows: [A('algae', 'water-flea'), A('water-flea', 'algae')] })).toEqual([A('water-flea', 'algae')])
    for (const bad of [null, undefined, {}, { arrows: 'x' }, { arrows: [null, { from: 1 }, A('algae', 'lion'), A('algae', 'algae')] }]) {
      expect(engine.check(POND, bad as never).ok).toBe(false)
    }
  })

  it('draws an arrow, takes it away when drawn again, and turns it round when drawn the other way', () => {
    const one = toggleArrow({ arrows: [] }, 'algae', 'water-flea')
    expect(one.arrows).toEqual([A('algae', 'water-flea')])
    expect(toggleArrow(one, 'algae', 'water-flea').arrows).toEqual([])
    expect(toggleArrow(one, 'water-flea', 'algae').arrows).toEqual([A('water-flea', 'algae')])
    expect(withoutArrow(one, 'water-flea', 'algae').arrows).toEqual([])
  })
})

describe('marking roles and predictions', () => {
  it('marks every role against the arrows, naming the wrong ones', () => {
    const c = read({ task: { kind: 'roles', habitat: 'pond' } })
    const right = engine.solve(c)
    expect(engine.check(c, right).ok).toBe(true)
    expect(engine.check(c, withRole(right, 'heron', 'secondary'))).toEqual({ ok: false, wrongIds: ['heron'] })
    expect(engine.check(c, withRole(right, 'heron', null))).toEqual({ ok: false, wrongIds: [] })
    expect(engine.check(c, { roles: { ...right.roles, heron: 'quaternary' } } as never).ok).toBe(false)
  })

  it('marks every prediction, and ignores one for an organism not asked about', () => {
    const c = read({ task: { kind: 'remove', habitat: 'pond', remove: 'stickleback' } })
    const right = engine.solve(c)
    expect(right.changes).toEqual({ 'water-flea': 'rise', 'mayfly-nymph': 'rise', pike: 'fall', heron: 'fall' })
    expect(engine.check(c, right).ok).toBe(true)
    expect(engine.check(c, withChange(right, 'pike', 'rise'))).toEqual({ ok: false, wrongIds: ['pike'] })
    expect(engine.check(c, withChange(right, 'pond-snail', 'rise')).ok).toBe(true)
    expect(engine.check(c, withChange(right, 'pike', null)).ok).toBe(false)
  })
})

// ── Where the cards go ──────────────────────────────────────────────────────

describe('where the cards go', () => {
  it('puts every organism round the ring once, the same way every time, never reading in level order', () => {
    for (const id of HABITATS) {
      const h = WEBS[id]
      const ring = ringOrder(h)
      expect([...ring].sort(), id).toEqual(h.organisms.map((x) => x.id).sort())
      expect(ringOrder(h)).toBe(ring)
      const lv = levels(h)
      expect(readsInLevelOrder(ring.map((x) => lv.get(x)!)), id).toBe(false)
    }
  })

  it('never puts the producers at the bottom and the top consumers at the top, nor sorts them left to right', () => {
    for (const id of HABITATS) {
      const h = WEBS[id]
      const ring = ringOrder(h)
      const geo = ringGeometry(ring.length)
      const lv = ring.map((x) => levels(h).get(x)!)
      expect(Math.abs(correlation(lv, geo.slots.map((s) => s.y))), `${id} by height`).toBeLessThan(0.3)
      expect(Math.abs(correlation(lv, geo.slots.map((s) => s.x))), `${id} across`).toBeLessThan(0.3)
      // No two producers side by side, nor two organisms of any one level more than once.
      const huddled = lv.filter((l, i) => l === lv[(i + 1) % lv.length]).length
      expect(huddled, `${id}: ${ring.join(', ')}`).toBeLessThanOrEqual(1)
      // No link of the web squeezed between two cards side by side in a row.
      const squeezed = webArrows(h).filter((a) => sideBySide(geo.slots[ring.indexOf(a.from)], geo.slots[ring.indexOf(a.to)], geo.card))
      expect(squeezed, id).toEqual([])
    }
  })

  it('scores a layout as the plain measures do, though it runs on numbers for speed', () => {
    const rand = mulberry32(3)
    for (let t = 0; t < 200; t++) {
      const h = WEBS[HABITATS[t % HABITATS.length]]
      const ring = h.organisms.map((x) => x.id).sort(() => rand() - 0.5)
      const g = ringGeometry(ring.length)
      const lv = ring.map((x) => levels(h).get(x)!)
      const huddled = lv.filter((l, i) => l === lv[(i + 1) % lv.length]).length
      const hooked = webArrows(h).filter((a) => sideBySide(g.slots[ring.indexOf(a.from)], g.slots[ring.indexOf(a.to)], g.card)).length
      const plain = (readsInLevelOrder(lv) ? 10000 : 0) + 300 * (Math.abs(correlation(lv, g.slots.map((s) => s.y))) + Math.abs(correlation(lv, g.slots.map((s) => s.x)))) +
        25 * huddled + 12 * crossings(ring, webArrows(h)) + 40 * hooked
      expect(layoutScore(h, ring)).toBeCloseTo(plain, 9)
    }
  })

  it('reads a sorted ring as sorted, either way round and from any card', () => {
    expect(readsInLevelOrder([0, 0, 1, 1, 2, 3])).toBe(true)
    expect(readsInLevelOrder([2, 3, 0, 0, 1, 1])).toBe(true)
    expect(readsInLevelOrder([3, 2, 1, 1, 0])).toBe(true)
    expect(readsInLevelOrder([0, 1, 0, 2, 1, 3])).toBe(false)
  })

  it('never lets two cards touch, nor any card leave the ring, for five to eight organisms', () => {
    for (let n = 5; n <= 8; n++) {
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

  it('draws every arrow a learner could draw clear of the cards it does not join, its head at its card', () => {
    const inside = (p: { x: number; y: number }, c: { x: number; y: number }, w: number, h: number) => Math.abs(p.x - c.x) < w / 2 && Math.abs(p.y - c.y) < h / 2
    const bad: string[] = []
    for (let n = 5; n <= 8; n++) {
      const g = ringGeometry(n)
      g.slots.forEach((a, i) => g.slots.forEach((b, j) => {
        if (i === j) return
        const { curve } = arrowGeometry(a, b, g.centre, g.card)
        const tip = curve[3]
        if (Math.hypot(tip.x - b.x, tip.y - b.y) > Math.hypot(g.card.w, g.card.h) / 2 + 6) bad.push(`${n} cards, ${i}→${j}: the head is not at its card`)
        g.slots.forEach((c, k) => {
          if (k === i || k === j) return
          for (let s = 0; s <= 40; s++) {
            if (inside(bezier(curve, s / 40), c, g.card.w, g.card.h)) {
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

// ── Every config ────────────────────────────────────────────────────────────

/** Every config the tutor can write: every habitat, every kind, every organism to take out. */
function everyConfig(): FoodWebConfig[] {
  return HABITATS.flatMap((habitat) => [
    read({ task: { kind: 'draw-arrows', habitat } }),
    read({ task: { kind: 'roles', habitat } }),
    ...WEBS[habitat].organisms.map((x) => read({ task: { kind: 'remove', habitat, remove: x.name } })),
  ])
}

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

/** Every way the promises can break for one config, in words. */
function broken(c: FoodWebConfig): string[] {
  const bad: string[] = []
  const name = JSON.stringify(c.task)
  const h = WEBS[c.task.habitat]
  const ok = (s: FoodWebState) => engine.check(c, s).ok
  const solved = engine.solve(c)
  if (ok(engine.initial(c))) bad.push(`${name}: solved at the start`)
  if (!ok(solved)) bad.push(`${name}: its solution fails`)
  if (c.task.kind === 'draw-arrows') {
    const web = solved.arrows!
    web.forEach((a, i) => {
      const others = web.filter((_, j) => j !== i)
      if (ok({ arrows: others })) bad.push(`${name}: solved without ${a.from}>${a.to}`)
      if (ok({ arrows: [...others, A(a.to, a.from)] })) bad.push(`${name}: solved with ${a.from}>${a.to} reversed`)
    })
    for (const x of h.organisms) {
      for (const y of h.organisms) {
        if (x === y || web.some((a) => (a.from === x.id && a.to === y.id) || (a.from === y.id && a.to === x.id))) continue
        if (ok({ arrows: [...web, A(x.id, y.id)] })) bad.push(`${name}: solved with an extra ${x.id}>${y.id}`)
      }
    }
    if (ok({ arrows: web.map((a) => A(a.to, a.from)) })) bad.push(`${name}: solved with every arrow reversed`)
  }
  if (c.task.kind === 'roles') {
    for (const x of h.organisms) {
      if (ok(withRole(solved, x.id, null))) bad.push(`${name}: solved with no role for ${x.id}`)
      for (const r of ROLES) if (r !== roleOf(h, x.id) && ok(withRole(solved, x.id, r))) bad.push(`${name}: solved with ${x.id} a ${r}`)
    }
  }
  if (c.task.kind === 'remove') {
    for (const [id, change] of Object.entries(solved.changes!)) {
      if (ok(withChange(solved, id, null))) bad.push(`${name}: solved with no prediction for ${id}`)
      if (ok(withChange(solved, id, change === 'rise' ? 'fall' : 'rise'))) bad.push(`${name}: solved with ${id} flipped`)
    }
  }
  return bad
}

describe('every config the engine accepts', { timeout: 30_000 }, () => {
  it('is listed in full: 4 habitats, 2 tasks each, and every removal that asks something', () => {
    const all = everyConfig()
    expect(all).toHaveLength(HABITATS.length * 10)
    const sound = all.filter((c) => engine.faults(c).length === 0)
    // 3 removals in the pond, 7 in the woodland, 5 on the grassland and 5 on the savanna ask something.
    expect(sound).toHaveLength(HABITATS.length * 2 + 3 + 7 + 5 + 5)
    for (const c of all) if (c.task.kind !== 'remove') expect(engine.faults(c)).toEqual([])
  })

  it('starts unsolved, can be solved, and is wrong after any one change to the solution', () => {
    const sound = everyConfig().filter((c) => engine.faults(c).length === 0)
    expect(sound.flatMap(broken)).toEqual([])
  })

  it('marks 300 random sets of arrows right exactly when they are the web, food to feeder', () => {
    const rand = mulberry32(19)
    let solvedCount = 0
    for (let t = 0; t < 300; t++) {
      const habitat = HABITATS[Math.floor(rand() * HABITATS.length)]
      const c = read({ task: { kind: 'draw-arrows', habitat } })
      const ids = WEBS[habitat].organisms.map((x) => x.id)
      const web = webArrows(WEBS[habitat])
      // Mostly the web with a few slips, so some are right.
      const arrows = web.filter(() => rand() > 0.08).map((a) => (rand() < 0.08 ? A(a.to, a.from) : a))
      while (rand() < 0.2) arrows.push(A(ids[Math.floor(rand() * ids.length)], ids[Math.floor(rand() * ids.length)]))
      const shuffled = arrows.sort(() => rand() - 0.5)
      const kept = learnerArrows(c, { arrows: shuffled })
      const exact = kept.length === web.length && web.every((w) => kept.some((k) => k.from === w.from && k.to === w.to))
      expect(engine.check(c, { arrows: shuffled }).ok).toBe(exact)
      if (exact) solvedCount++
    }
    expect(solvedCount).toBeGreaterThan(10)
  })

  it('draws every config at every stage of marking without failing', () => {
    const marks: SceneMarked[] = ['idle', 'wrong', 'right', 'shown']
    for (const c of everyConfig()) {
      for (const marked of marks) {
        for (const state of [engine.initial(c), engine.solve(c)]) {
          expect(() => renderToStaticMarkup(createElement(FoodWebView, { config: c, state, setState: () => {}, marked, reduced: marked === 'shown', locked: marked === 'right' }))).not.toThrow()
        }
      }
    }
  })
})

// ── The prompt ──────────────────────────────────────────────────────────────

describe('the prompt a food-web card is written with', () => {
  const draw = (habitat: string) => read({ task: { kind: 'draw-arrows', habitat } })
  const roles = (habitat: string) => read({ task: { kind: 'roles', habitat } })
  const gone = read({ task: { kind: 'remove', habitat: 'pond', remove: 'stickleback' } })

  it('finds organisms by name, plural or other word, the longest first', () => {
    expect(mentions(WEBS.grassland, 'The grass snake and the grass').map((m) => m.id)).toEqual(['grass-snake', 'grass'])
    expect(mentions(WEBS.pond, 'Water-fleas, Daphnia and pond snails').map((m) => m.id)).toEqual(['water-flea', 'water-flea', 'pond-snail'])
    expect(mentions(WEBS.pond, 'This pond food web')).toEqual([])
  })

  it('may name the habitat and ask', () => {
    expect(promptFaults(draw('pond'), 'Draw the energy arrows in this pond food web.')).toEqual([])
    expect(promptFaults(draw('pond'), 'Use the field notes to draw arrows showing the flow of energy.')).toEqual([])
    expect(promptFaults(roles('grassland'), 'Is each organism a producer, or a primary, secondary or tertiary consumer?')).toEqual([])
    expect(promptFaults(gone, 'The sticklebacks are all taken out. Will each population rise or fall?')).toEqual([])
    expect(promptFaults(gone, 'All the sticklebacks die out. What happens to the herons?')).toEqual([])
  })

  it('may not say who feeds on whom, either way round', () => {
    expect(promptFaults(draw('pond'), 'Herons eat sticklebacks. Draw the rest of the web.').join('\n')).toMatch(/says who feeds on whom \("Herons eat sticklebacks"\)/)
    expect(promptFaults(draw('pond'), 'Water fleas are eaten by sticklebacks.').join('\n')).toMatch(/who feeds on whom/)
    expect(promptFaults(draw('savanna'), 'Energy passes from the grass to the zebra. Draw the rest.').join('\n')).toMatch(/who feeds on whom/)
    expect(promptFaults(draw('woodland'), 'The ladybird is a predator of the aphid.').join('\n')).toMatch(/who feeds on whom/)
    // Even a link the web does not hold: the scene's own data says who feeds on whom.
    expect(promptFaults(draw('pond'), 'Herons feed on pike too.').join('\n')).toMatch(/who feeds on whom/)
  })

  it('may not give an organism its role', () => {
    expect(promptFaults(roles('pond'), 'The algae are producers. Name the other roles.').join('\n')).toMatch(/gives the algae a role/)
    expect(promptFaults(roles('woodland'), 'Which of these is the tertiary consumer -- the tawny owl?').join('\n')).toMatch(/gives the tawny owl a role/)
    expect(promptFaults(roles('savanna'), 'Lions, the carnivores here, ...').join('\n')).toMatch(/gives the lion a role/)
  })

  it('may not name three organisms in the order energy passes', () => {
    expect(promptFaults(roles('pond'), 'Look at the algae, the water flea, the stickleback and the pike.').join('\n')).toMatch(/in the order energy passes/)
    expect(promptFaults(roles('pond'), 'Look at the pike, the algae and the water flea.')).toEqual([])
  })

  it('may not tell the draw-arrows learner which way the arrows point', () => {
    expect(promptFaults(draw('pond'), 'Remember: arrows go from the food to the animal that eats it.').join('\n')).toMatch(/says which way the arrows point/)
    expect(promptFaults(draw('pond'), 'Each arrow points to the animal that eats.').join('\n')).toMatch(/which way the arrows point/)
  })

  it('may not say what happens to a population the remove card asks about', () => {
    expect(promptFaults(gone, 'With the sticklebacks gone, the herons starve. What else?').join('\n')).toMatch(/says what happens to the heron/)
    expect(promptFaults(gone, 'Explain why there are more water fleas.').join('\n')).toMatch(/says what happens to the water flea/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('food-web')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\} \}) \}/g)]
    expect(found).toHaveLength(3)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

// ── On the board ────────────────────────────────────────────────────────────

const PROMPTS: Record<string, string> = {
  'draw-arrows': 'Draw the energy arrows in this food web.',
  roles: 'Name the role of each organism in this food web.',
  remove: 'One species is taken out. Predict what happens to each organism listed.',
}
const card = (config: unknown, prompt: string) =>
  renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'food-web', config }, success: { kind: 'scene' } } },
  } as never)))
const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const view = (raw: unknown, state: FoodWebState, marked: SceneMarked, reduced = false) =>
  renderToStaticMarkup(createElement(FoodWebView, { config: read(raw), state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('the food-web scene on the board', () => {
  it('draw-arrows: every organism a button the keyboard reaches, the field notes, and no arrow of the answer', () => {
    for (const habitat of HABITATS) {
      const html = card({ task: { kind: 'draw-arrows', habitat } }, PROMPTS['draw-arrows']).replace(PROMPTS['draw-arrows'], '')
      for (const x of WEBS[habitat].organisms) expect(html).toMatch(new RegExp(`<button[^>]*aria-label="${x.name.charAt(0).toUpperCase()}${x.name.slice(1)}"`))
      expect(html).toMatch(/What each animal feeds on/)
      expect(html).not.toMatch(/data-arrow|→/)
      expect(text(html).toLowerCase()).not.toMatch(/producer|consumer|primary|secondary|tertiary|herbivore|carnivore|trophic/)
      expect(text(html)).not.toMatch(/fits the web|points from an animal/)
    }
  })

  it('draw-arrows: the field notes say what each animal feeds on, alphabetically, from the data', () => {
    const notes = text(card({ task: { kind: 'draw-arrows', habitat: 'pond' } }, PROMPTS['draw-arrows']))
    expect(notes).toMatch(/Heron sticklebacks Mayfly nymph algae Pike sticklebacks Pond snail algae and pondweed Stickleback mayfly nymphs and water fleas Water flea algae/)
  })

  it('roles: the web is drawn, and no organism carries a role before the learner gives one', () => {
    for (const habitat of HABITATS) {
      const html = card({ task: { kind: 'roles', habitat } }, PROMPTS.roles).replace(PROMPTS.roles, '')
      expect(html.match(/data-arrow=/g)).toHaveLength(webArrows(WEBS[habitat]).length)
      expect(text(html).toLowerCase()).not.toMatch(/producer|consumer|primary|secondary|tertiary|herbivore|carnivore/)
    }
  })

  it('remove: asks about each organism the arrows decide, with nothing chosen and no answer said', () => {
    for (const habitat of HABITATS) {
      for (const id of removable(WEBS[habitat])) {
        const html = card({ task: { kind: 'remove', habitat, remove: id } }, PROMPTS.remove).replace(PROMPTS.remove, '')
        expect(html.match(/aria-label="[^"]* rises"/g)).toHaveLength(removalEffects(WEBS[habitat], id).length)
        expect(html).not.toMatch(/aria-pressed="true"/)
        expect(text(html)).not.toMatch(/fed only on|fed on it|does not follow/)
        expect(html).toMatch(/taken out/i)
      }
    }
  })

  it('draws the learner’s own arrows as they make them, unmarked', () => {
    const html = view({ task: { kind: 'draw-arrows', habitat: 'pond' } }, { arrows: [A('heron', 'stickleback')] }, 'idle')
    expect(html).toMatch(/data-arrow="heron&gt;stickleback"/)
    expect(text(html)).toMatch(/Heron → to Stickleback/)
    expect(text(html)).not.toMatch(/fits the web|points from an animal/)
  })
})

describe('the food-web scene once marked', () => {
  it('draw-arrows, all backwards: says what the learner made', () => {
    const backwards = webArrows(WEBS.pond).map((a) => A(a.to, a.from))
    expect(text(view({ task: { kind: 'draw-arrows', habitat: 'pond' } }, { arrows: backwards }, 'wrong'))).toMatch(/Each of your 8 arrows points from an animal to what it eats\./)
  })

  it('draw-arrows, part right: counts what fits, what points backwards and what the notes do not give', () => {
    const web = webArrows(WEBS.pond)
    const arrows = [...web.slice(2), A(web[0].to, web[0].from), A('pike', 'heron')]
    const html = text(view({ task: { kind: 'draw-arrows', habitat: 'pond' } }, { arrows }, 'wrong'))
    expect(html).toMatch(/You drew 8 arrows: 6 fit the web, 1 points from an animal to its food, 1 joins two organisms the notes do not link\./)
    expect(html).toMatch(/1 more arrow is needed\./)
  })

  it('draw-arrows, right: the energy runs along every arrow, and stands still under reduced motion', () => {
    const c = { task: { kind: 'draw-arrows', habitat: 'pond' } }
    const right = view(c, engine.solve(read(c)), 'right')
    expect(text(right)).toMatch(/Every arrow runs from a food to the animal that feeds on it/)
    expect(right.match(/<animateMotion/g)).toHaveLength(8)
    expect(view(c, engine.solve(read(c)), 'right', true)).not.toMatch(/<animateMotion/)
  })

  it('roles, wrong: says what the learner called each wrong one, not what it is', () => {
    const c = { task: { kind: 'roles', habitat: 'pond' } }
    const state = withRole(withRole(engine.solve(read(c)), 'heron', 'secondary'), 'pike', null)
    const html = text(view(c, state, 'wrong'))
    expect(html).toMatch(/You named 7 of 8: 6 fit the arrows\./)
    expect(html).toMatch(/You called the heron a secondary consumer\./)
    expect(html).toMatch(/1 organism has no role yet\./)
    expect(html).not.toMatch(/tertiary consumer/i)
  })

  it('remove, wrong then right: says what was predicted, then why each change follows', () => {
    const c = { task: { kind: 'remove', habitat: 'pond', remove: 'stickleback' } }
    const right = engine.solve(read(c))
    const wrong = text(view(c, withChange(withChange(right, 'pike', 'rise'), 'heron', null), 'wrong'))
    expect(wrong).toMatch(/You said the water flea rises, the mayfly nymph rises and the pike rises\. One of these does not follow from the arrows\./)
    expect(wrong).toMatch(/1 more prediction is needed/)
    expect(wrong).not.toMatch(/fed only on/)
    const done = text(view(c, right, 'right'))
    expect(done).toMatch(/Heron .*Falls\. It fed only on sticklebacks\./)
    expect(done).toMatch(/Water flea .*Rises\. Only sticklebacks fed on it\./)
  })

  it('locks its controls once solved', () => {
    const c = { task: { kind: 'draw-arrows', habitat: 'grassland' } }
    const html = view(c, engine.solve(read(c)), 'right')
    expect(html.match(/<button[^>]*disabled=""/g)?.length).toBe(WEBS.grassland.organisms.length)
    expect(html).not.toMatch(/>Remove</)
  })
})

describe('the catalogue entry', () => {
  it('is registered for the tutor, isolating structure, with every kind and habitat', () => {
    expect(getEngine('food-web')).toBe(engine)
    expect(engine.isolates).toBe('structure')
    expect(engine.prompt).toMatch(/^SCENE "food-web"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"isolates":"structure", "apparatus":"scene:food-web"/)
    for (const kind of KINDS) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    for (const h of HABITATS) expect(engine.prompt).toContain(h)
  })

  it('gives examples the engine accepts as they stand', () => {
    const examples = [...engine.prompt.matchAll(/\{ "type":"createActivity"[\s\S]*?"why":"\.\.\." \} \}/g)].map((m) => JSON.parse(m[0]))
    expect(examples).toHaveLength(3)
    for (const ex of examples) {
      expect(ex.spec.payload.engine).toBe('food-web')
      expect(engine.faults(read(ex.spec.payload.config))).toEqual([])
      expect(validateSpec(ex.spec)).toBe(true)
      expect(meaningFaults(ex)).toEqual([])
    }
  })

  it('is offered to a station on food chains, food webs or trophic levels, and not to one on food tests', async () => {
    const { scenesFor } = await import('../registry')
    expect(scenesFor('Food chains and food webs').map((e) => e.id)).toContain('food-web')
    expect(scenesFor('Trophic levels in an ecosystem').map((e) => e.id)).toContain('food-web')
    expect(scenesFor('Food tests: starch, sugar and protein').map((e) => e.id)).not.toContain('food-web')
  })
})
