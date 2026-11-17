// lib/studylab/engines/life-cycles/life-cycles.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  lifeCyclesEngine as engine, LIFE, LIVES, done, goalOf, goodMoments, madeText, momentsOf, nextStage, rangeOf, stepOf, timeText, working,
  type LifeConfig, type LifeState,
} from './config'
import { H, LifeCyclesView, W, kf, labelBox, labelsOf, on } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const FINDS: LifeConfig[] = LIVES.flatMap((life) => LIFE[life].clues.map((c) => ({ task: 'find' as const, life, clue: c.id })))
const NEXTS: LifeConfig[] = LIVES.flatMap((life) => Object.keys(LIFE[life].changes).map((from) => ({ task: 'next' as const, life, from })))
const ALL = [...FINDS, ...NEXTS]
const nameOf = (c: LifeConfig) => JSON.stringify(c)
/** The names of the stages a card can ask for, which nothing may say before marking. */
const NAMES: Record<string, RegExp[]> = {
  caterpillar: [/caterpillar/i, /larva/i], chrysalis: [/chrysalis/i, /pupa/i, /cocoon/i], tadpole: [/tadpole/i], froglet: [/froglet/i],
  germination: [/germinat/i], seedling: [/seedling/i], adult: [/adult/i], seeds: [/seed head/i], dispersal: [/dispersal/i],
}
const stageAt = (life: (typeof LIVES)[number], i: number) => LIFE[life].moments[i].stage
const render = (config: LifeConfig, state: LifeState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = true) =>
  renderToStaticMarkup(createElement(LifeCyclesView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

describe('the lives, from the sources', () => {
  it('a monarch: egg about 4 days, caterpillar 10-14, chrysalis 8-14, about a month in all', () => {
    const m = LIFE.butterfly.moments
    const first = (s: string) => m[momentsOf(LIFE.butterfly, s)[0]].day
    expect(first('caterpillar') - first('egg')).toBeGreaterThanOrEqual(3)
    expect(first('caterpillar') - first('egg')).toBeLessThanOrEqual(5)
    expect(first('chrysalis') - first('caterpillar')).toBeGreaterThanOrEqual(10)
    expect(first('chrysalis') - first('caterpillar')).toBeLessThanOrEqual(14)
    expect(first('butterfly') - first('chrysalis')).toBeGreaterThanOrEqual(8)
    expect(first('butterfly') - first('chrysalis')).toBeLessThanOrEqual(14)
    expect(m[m.length - 1].day).toBeGreaterThanOrEqual(28)
    expect(m[m.length - 1].day).toBeLessThanOrEqual(40)
  })

  it('a common frog: hatches in about three weeks, leaves the water by about 16 weeks, breeds at 2-3 years', () => {
    const f = LIFE.frog
    const first = (s: string) => f.moments[momentsOf(f, s)[0]].day
    expect(first('tadpole')).toBeGreaterThanOrEqual(7)
    expect(first('tadpole')).toBeLessThanOrEqual(21)
    expect(first('frog')).toBeLessThanOrEqual(16 * 7)
    expect(f.moments[f.moments.length - 1].day / 365).toBeGreaterThanOrEqual(2)
    expect(f.moments[f.moments.length - 1].day / 365).toBeLessThanOrEqual(3)
  })

  it('a sunflower: up within about ten days, in flower at 70-80 days, ripe seed by about 120', () => {
    const p = LIFE.plant
    const first = (s: string) => p.moments[momentsOf(p, s)[0]].day
    expect(first('seedling')).toBeLessThanOrEqual(10)
    expect(first('flowering')).toBeGreaterThanOrEqual(70)
    expect(first('flowering')).toBeLessThanOrEqual(80)
    expect(p.moments[p.moments.length - 1].day).toBeLessThanOrEqual(130)
  })

  it('every life runs through its stages in order, never back, and ends by starting the next life', () => {
    for (const life of LIVES) {
      const info = LIFE[life]
      const order = info.moments.map((m) => info.stages.findIndex((s) => s.id === m.stage))
      expect(order.every((k) => k >= 0), life).toBe(true)
      for (let i = 1; i < order.length; i++) expect(order[i] - order[i - 1], `${life} ${i}`).toBeGreaterThanOrEqual(0)
      for (let i = 1; i < info.moments.length; i++) expect(info.moments[i].day, `${life} ${i}`).toBeGreaterThan(info.moments[i - 1].day)
      for (const s of info.stages) expect(momentsOf(info, s.id).length, `${life} ${s.id}`).toBeGreaterThan(0)
      // The last moment is the next egg, the next spawn, the next seeds.
      expect(info.clues.find((c) => c.id === 'next-cycle')?.ok).toEqual([info.moments.length - 1])
    }
  })

  it('getting bigger is not a new stage: the traps sit in the stage before', () => {
    // Shedding its skin, and hanging in a J: still a caterpillar.
    expect(stageAt('butterfly', 4)).toBe('caterpillar')
    expect(LIFE.butterfly.moments[4].seen).toMatch(/old skin/)
    expect(stageAt('butterfly', 6)).toBe('caterpillar')
    // The egg darkening, the commas in the jelly, the chrysalis turning clear: still the same stage.
    expect(stageAt('butterfly', 1)).toBe('egg')
    expect(stageAt('frog', 1)).toBe('frogspawn')
    expect(stageAt('butterfly', 9)).toBe('chrysalis')
    // Back legs alone: still a tadpole. Front legs and a shrinking tail: a froglet.
    expect(stageAt('frog', 4)).toBe('tadpole')
    expect(stageAt('frog', 5)).toBe('froglet')
    // Crumpled wings cannot fly yet.
    expect(LIFE.butterfly.clues.find((c) => c.id === 'flies')!.ok).not.toContain(10)
  })

  it('shows the time in the units a class would use', () => {
    expect(timeText('butterfly', 16)).toBe('Day 16')
    expect(timeText('frog', 21)).toBe('Week 3')
    expect(timeText('frog', 365)).toBe('1 year')
    expect(timeText('frog', 1095)).toBe('3 years')
    expect(timeText('plant', 70)).toBe('Day 70')
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    expect(ALL.length).toBe(24)
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
  })

  it('marks exactly by the rule, over every moment the learner can stop on', () => {
    for (const c of ALL) {
      const { min, max } = rangeOf(c)
      const good = goodMoments(c)
      expect(good.length, nameOf(c)).toBeGreaterThan(0)
      let right = 0
      for (let s = min; s <= max; s++) {
        expect(engine.check(c, { step: s }).ok, `${nameOf(c)} ${s}`).toBe(good.includes(s))
        if (good.includes(s)) right++
      }
      expect(right, nameOf(c)).toBe(good.length)
      // A next card passes on every moment of the next stage and nothing else.
      if (c.task === 'next') expect(good, nameOf(c)).toEqual(momentsOf(LIFE[c.life as 'frog'], nextStage(LIFE[c.life as 'frog'], c.from)!.id))
    }
  })

  it('every clue is seen in the drawing: a find card passes on each moment that shows it, several for most', () => {
    const several = FINDS.filter((c) => goodMoments(c).length > 1).length
    expect(several).toBeGreaterThanOrEqual(10)
    for (const c of FINDS) expect(goodMoments(c).every((i) => i > 0), nameOf(c)).toBe(true)
  })

  it('can always be reached by the + button from the start, and by − back again', () => {
    for (const c of ALL) {
      const { min, max } = rangeOf(c)
      const target = engine.solve(c).step!
      expect(target).toBeGreaterThan(min)
      expect(target).toBeLessThanOrEqual(max)
      let s = engine.initial(c).step!
      while (s < target) s += 1
      expect(done(c, { step: s }), nameOf(c)).toBe(true)
    }
  })

  it('refuses a state that could not have been made', () => {
    const c = FINDS[0]
    expect(engine.check(c, {}).ok).toBe(false)
    expect(engine.check(c, { step: 2.5 }).ok).toBe(false)
    expect(engine.check(c, { step: -1 }).ok).toBe(false)
    expect(engine.check(c, { step: 99 }).ok).toBe(false)
    expect(engine.check(c, { step: '3' as never }).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    // A next card cannot be marked before its own start.
    const n: LifeConfig = { task: 'next', life: 'frog', from: 'tadpole' }
    expect(rangeOf(n).min).toBe(2)
    expect(stepOf(n, { step: 0 })).toBe(2)
    expect(engine.check({ task: 'next', life: 'frog', from: 'froglet' }, { step: 1 }).ok).toBe(false)
  })

  it('says something true when marked, and what was made when wrong, never where the answer is', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      const made = madeText(c, engine.initial(c))
      expect(made.startsWith('Yes'), nameOf(c)).toBe(false)
      if (c.task === 'next') {
        const to = nextStage(LIFE[c.life as 'frog'], c.from)!
        expect(said, nameOf(c)).toContain(to.name)
        expect(made, nameOf(c)).toMatch(/has not changed into a new stage yet/)
        expect(made, nameOf(c)).not.toContain(to.name)
      }
    }
    expect(working({ task: 'find', life: 'butterfly', clue: 'eats-leaves' }, { step: 3 })).toMatch(/^Yes\. On day 7 it is a caterpillar \(larva\)/)
    expect(madeText({ task: 'find', life: 'butterfly', clue: 'eats-leaves' }, { step: 8 })).toMatch(/On day 21 it is a chrysalis \(pupa\)/)
    expect(madeText({ task: 'next', life: 'butterfly', from: 'caterpillar' }, { step: 4 })).toMatch(/shed its skin to grow, but it is still a caterpillar.*not changed into a new stage/)
    expect(madeText({ task: 'next', life: 'frog', from: 'tadpole' }, { step: 4 })).toMatch(/In week 9 it has grown back legs, but it is still a tadpole/)
    expect(working({ task: 'next', life: 'frog', from: 'tadpole' }, { step: 5 })).toMatch(/^Yes\. The tadpole has become a froglet\./)
    expect(working({ task: 'find', life: 'frog', clue: 'like-parent' }, { step: 9 })).toMatch(/After 3 years, it is an adult frog/)
    expect(working({ task: 'next', life: 'plant', from: 'flowering' }, { step: 7 })).toMatch(/^Yes\. The flower has become a seed head\./)
    expect(working({ task: 'next', life: 'plant', from: 'seed' }, { step: 1 })).toMatch(/^Yes\. The seed has become a sprouting seed \(germination\)\./)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'find', life: 'Monarch butterfly', clue: 'Eats leaves' })).toEqual({ task: 'find', life: 'butterfly', clue: 'eats-leaves' })
    expect(engine.parse({ life: 'frog', clue: 'has legs and a tail' })).toEqual({ task: 'find', life: 'frog', clue: 'legs-and-tail' })
    expect(engine.parse({ clue: 'gills' })).toEqual({ task: 'find', life: 'frog', clue: 'gills' })
    expect(engine.parse({ task: 'next stage', from: 'tadpole' })).toEqual({ task: 'next', life: 'frog', from: 'tadpole' })
    expect(engine.parse({ from: 'larva' })).toEqual({ task: 'next', life: 'butterfly', from: 'caterpillar' })
    expect(engine.parse({ task: 'next', life: 'butterfly', from: 'pupa' })).toEqual({ task: 'next', life: 'butterfly', from: 'chrysalis' })
    expect(engine.parse({ task: 'next', life: 'butterfly', from: 'cocoon' })).toEqual({ task: 'next', life: 'butterfly', from: 'chrysalis' })
    expect(engine.parse({ task: 'next', life: 'frog', from: 'spawn' })).toEqual({ task: 'next', life: 'frog', from: 'frogspawn' })
    expect(engine.parse({ task: 'find', life: 'flowering plant', clue: 'seed dispersal' })).toEqual({ task: 'find', life: 'plant', clue: 'next-cycle' })
    expect(engine.parse({ task: 'find', life: 'Sunflower life cycle', clue: 'germination' })).toEqual({ task: 'find', life: 'plant', clue: 'root' })
    expect(engine.parse({ task: { kind: 'change', life: 'plant', stage: 'sprouting' } })).toEqual({ task: 'next', life: 'plant', from: 'germination' })
    expect(engine.parse({ life: 'plant' })).toEqual({ task: 'find', life: 'plant', clue: 'first-leaves' })
    expect(engine.parse({ task: 'next', life: 'frog' })).toEqual({ task: 'next', life: 'frog', from: 'frogspawn' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('frog')).toBeNull()
    expect(engine.parse({ task: 'dance' })).toBeNull()
    expect(engine.parse({ task: '__proto__' })).toBeNull()
    expect(engine.parse({ task: 'find', life: 5 })).toBeNull()
    expect(engine.parse({ task: 'next', from: {} })).toBeNull()
    // Unknown lives, clues and stages still parse: faults says what would work.
    expect(engine.parse({ task: 'find', life: 'chicken' })).not.toBeNull()
    expect(engine.parse({ task: 'find', life: 'frog', clue: 'sings' })).not.toBeNull()
    expect(engine.parse({ task: 'next', life: 'frog', from: 'frog' })).not.toBeNull()
  })

  it('refuses only what cannot be drawn, naming what works and a nearby example that does', () => {
    const fixOf = (c: LifeConfig, said: string): LifeConfig => {
      const life = said.match(/e\.g\. life "(\w+)"/)
      if (life) return { ...c, life: life[1] } as LifeConfig
      const clue = said.match(/e\.g\. clue "([\w-]+)"/)
      if (clue) return { ...c, clue: clue[1] } as LifeConfig
      const from = said.match(/e\.g\. from "([\w-]+)"/)
      expect(from, said).not.toBeNull()
      return { ...c, from: from![1] } as LifeConfig
    }
    const cases: [LifeConfig, RegExp][] = [
      [{ task: 'find', life: 'chicken', clue: 'eats-leaves' }, /butterfly, frog, plant/],
      [{ task: 'find', life: '__proto__', clue: 'eats-leaves' }, /butterfly, frog, plant/],
      [{ task: 'next', life: 'human', from: 'baby' }, /butterfly, frog, plant/],
      [{ task: 'find', life: 'frog', clue: 'sings' }, /gills, legs-and-tail, on-land, like-parent, next-cycle/],
      [{ task: 'find', life: 'butterfly', clue: 'gills' }, /eats-leaves, in-case, flies, like-parent, next-cycle/],
      [{ task: 'find', life: 'plant', clue: 'like-parent' }, /root, first-leaves, flower, new-seeds, next-cycle/],
      [{ task: 'next', life: 'frog', from: 'frog' }, /has no next stage/],
      [{ task: 'next', life: 'butterfly', from: 'butterfly' }, /has no next stage/],
      [{ task: 'next', life: 'plant', from: 'seedling' }, /seed, germination, flowering/],
      [{ task: 'next', life: 'frog', from: 'newt' }, /has no stage "newt"/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      let fixed = fixOf(c, f[0])
      // A life fixed may still need its clue or stage fixed: one more round, never more.
      if (engine.faults(fixed).length) fixed = fixOf(fixed, engine.faults(fixed)[0])
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, nameOf(fixed)).toBe(true)
      // Nothing a refused config can do crashes the rest of the engine.
      expect(engine.check(c, engine.initial(c)).ok, nameOf(c)).toBe(false)
      expect(() => render(c, engine.initial(c))).not.toThrow()
      expect(() => render(c, engine.initial(c), 'wrong')).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: LifeConfig, p: string) => engine.promptFaults!(c, p)
  const eats: LifeConfig = { task: 'find', life: 'butterfly', clue: 'eats-leaves' }
  const tad: LifeConfig = { task: 'next', life: 'frog', from: 'tadpole' }
  const root: LifeConfig = { task: 'find', life: 'plant', clue: 'root' }

  it('the gesture and the goal are fine, naming the living thing included', () => {
    expect(pf(eats, 'Drag the time slider, or tap + and −, and watch it grow. Stop when it eats leaves.')).toEqual([])
    expect(pf(eats, 'Here is a monarch butterfly’s life. Drag the time slider and stop when it eats leaves.')).toEqual([])
    expect(pf(tad, 'Drag the time slider, or tap + and −. Stop when the tadpole has changed into its next stage.')).toEqual([])
    expect(pf(root, 'Watch a sunflower seed. Tap + to let time pass, and stop when it grows its first root.')).toEqual([])
    expect(pf({ task: 'find', life: 'frog', clue: 'like-parent' }, 'Drag the time slider. Stop when it looks like its parent, the frog.')).toEqual([])
  })

  it('the stage that answers, what it becomes, or when, is not', () => {
    for (const p of ['Stop when the caterpillar eats.', 'Find the larva eating.', 'Stop when it eats leaves, on day 7.', 'It takes about two weeks. Stop when it eats leaves.', 'Watch it turn into a caterpillar.']) {
      expect(pf(eats, p), p).toHaveLength(1)
      expect(pf(eats, p)[0], p).toMatch(/gives the answer away/)
    }
    for (const p of ['Stop when the tadpole becomes a froglet.', 'Stop at the froglet.', 'In week 12 it changes. Stop there.']) expect(pf(tad, p), p).toHaveLength(1)
    for (const p of ['Stop when it germinates.', 'Stop when the seed sprouts its root.']) expect(pf(root, p), p).toHaveLength(1)
    expect(pf({ task: 'find', life: 'butterfly', clue: 'in-case' }, 'Stop at the chrysalis.')).toHaveLength(1)
    expect(pf({ task: 'find', life: 'butterfly', clue: 'in-case' }, 'Stop at the pupa.')).toHaveLength(1)
    expect(pf({ task: 'next', life: 'butterfly', from: 'caterpillar' }, 'Stop when the caterpillar makes its cocoon.')).toHaveLength(1)
  })

  it('what the card does not do is refused too', () => {
    for (const p of ['Drag the stages into order.', 'Put the pictures in the right order.', 'Label each stage.', 'Name each stage of the chicken.', 'Write the stages of a human life.', 'Watch the bean grow.']) {
      const f = pf(eats, p)
      expect(f.some((x) => /does not do/.test(x)), p).toBe(true)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const said = pf(c, 'Drag the cards into order. It becomes a caterpillar on day 7.')
      expect(said.length, nameOf(c)).toBe(2)
      for (const s of said) {
        const fix = s.match(/\("([^"]+)"\)/)![1]
        expect(pf(c, fix), `${nameOf(c)}: ${fix}`).toEqual([])
        expect(fix).toContain(goalOf(c))
        expect(fix).toMatch(/Drag the time slider/)
      }
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"life-cycles", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, f[2]).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, f[2]).toBe(true)
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['find', 'next']))
    expect(new Set(found.map((f) => JSON.parse(f[2]).life))).toEqual(new Set(LIVES))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "life-cycles"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'life-cycles')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      'Life cycles', 'The life cycle of a butterfly', 'Life cycle of a frog', 'Metamorphosis', 'The life cycle of a flowering plant', 'Animal life cycles',
      'Stages of growth', 'Plant life cycles', 'From caterpillar to butterfly', 'Frogspawn and tadpoles', 'Complete metamorphosis in insects', 'Unit 3: Life cycles of plants and animals',
      'Lifecycles', 'Life-cycles of living things', 'How animals grow and change',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other cycles, other lives, or other uses of the words', () => {
    for (const st of [
      'The life cycle of a star', 'Stellar life cycles', 'Product life cycle', 'The product life cycle and extension strategies', 'Life cycle assessments', 'Life cycle assessment of a plastic bag',
      'Systems life cycle', 'Software development life cycle', 'The cell cycle and mitosis', 'The water cycle', 'The carbon cycle', 'The rock cycle', 'Metamorphic rocks', 'Kafka: The Metamorphosis',
      'Human life cycle and puberty', 'The life cycle of the malaria parasite', 'Viral life cycles', 'Fern life cycle', 'The resort life cycle model', 'Tourism and the resort life cycle', 'Stages of economic growth',
      'Half-life', 'Life processes', 'Incomplete metamorphosis in grasshoppers', 'Pollination and fertilisation', 'Seed germination', 'Caterpillars in a food chain', 'The life cycle of a chicken', 'Business life cycle',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('life-cycles')).toBe(engine)
    expect(engine.isolates).toBe('order')
    expect(engine.prompt).toMatch(/SCENE "life-cycles"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:life-cycles"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const life of LIVES) {
      for (const c of LIFE[life].clues) expect(engine.prompt, `${life} ${c.id}`).toContain(c.id)
      for (const from of Object.keys(LIFE[life].changes)) expect(engine.prompt, `${life} ${from}`).toContain(from)
    }
  })
})

describe('a still frame is a frame a learner sees', () => {
  type Box = ReturnType<typeof labelBox>
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const count = (life: string) => LIFE[life as 'frog'].moments.length

  it('every label sits on the plate, apart from every other label shown with it, and nearer its own part', () => {
    for (const life of LIVES) {
      const labels = labelsOf(life)
      expect(labels.length, life).toBeLessThanOrEqual(8)
      for (const l of labels) {
        const b = labelBox(l)
        expect(b.left, l.text).toBeGreaterThanOrEqual(4)
        expect(b.right, l.text).toBeLessThanOrEqual(W - 4)
        expect(b.top, l.text).toBeGreaterThanOrEqual(4)
        expect(b.bottom, l.text).toBeLessThanOrEqual(H - 4)
        expect(l.at.every((i) => i >= 0 && i < count(life)), l.text).toBe(true)
      }
      for (let m = 0; m < count(life); m++) {
        const shown = labels.filter((l) => l.at.includes(m))
        shown.forEach((a, i) => shown.forEach((b, j) => { if (j > i) expect(hits(labelBox(a), labelBox(b)), `${a.text} / ${b.text} at ${m}`).toBe(false) }))
        for (const l of shown) {
          const box = labelBox(l)
          const c = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
          const mine = Math.hypot(c.x - l.part.x, c.y - l.part.y)
          for (const o of shown) if (o !== l) expect(mine, `${l.text} nearer ${o.text}`).toBeLessThan(Math.hypot(c.x - o.part.x, c.y - o.part.y))
        }
      }
    }
  })

  it('names no stage before marking except the one a next card starts on', () => {
    for (const life of LIVES) {
      const stages = LIFE[life].stages.map((s) => s.id)
      for (const l of labelsOf(life)) {
        if (!stages.includes(l.text)) continue
        // A stage named on the picture is the first one, and no find clue or next card is answered by it.
        expect(l.text, life).toBe(stages[0])
        for (const c of ALL.filter((x) => x.life === life)) expect(goodMoments(c).some((i) => LIFE[life].moments[i].stage === l.text), nameOf(c)).toBe(false)
      }
    }
  })

  it('a moment between two is a blend of them: keyframes ease from one to the next', () => {
    expect(kf(0, [0, 10, 20])).toBe(0)
    expect(kf(0.5, [0, 10, 20])).toBe(5)
    expect(kf(2, [0, 10, 20])).toBe(20)
    expect(kf(9, [0, 10, 20])).toBe(20)
    expect(on(1.5, 4, [1])).toBe(0.5)
    expect(on(3, 4, [1])).toBe(0)
  })

  it('the view writes its own literals, and they agree with the drawing', () => {
    expect(W).toBe(360)
    expect(H).toBe(240)
    const html = render(FINDS[0], engine.initial(FINDS[0]))
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'life-cycles', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')
  const answerWords = (c: LifeConfig): RegExp[] => {
    const info = LIFE[c.life as 'frog']
    const good = new Set(goodMoments(c).map((i) => info.moments[i].stage))
    return [...good].flatMap((id) => NAMES[id] ?? [])
  }

  it('before marking, nothing says the answer, the stage it is looking for, or whether it is right', () => {
    for (const c of ALL) {
      const prompt = `Drag the time slider, or tap + and −, and watch it grow. ${goalOf(c)}`
      const html = card(c, prompt)
      expect(html, nameOf(c)).toContain('role="slider"')
      const shown = `${text(html.replace(prompt, '').replace(goalOf(c), ''))} ${attrs(html)}`
      for (const w of [...answerWords(c), /\bYes\b/, /metamorphosis/i, /\blarva\b/i, /\bpupa\b/i, /not changed/]) expect(shown, `${w} in ${nameOf(c)}`).not.toMatch(w)
    }
  })

  it('shows the goal, the time and the names of the places on the card', () => {
    const b = text(render({ task: 'find', life: 'butterfly', clue: 'eats-leaves' }, {}))
    for (const name of ['Goal', 'Stop when it eats leaves.', 'Time', 'Day 0', 'egg', 'parent', 'flowers', 'milkweed', 'Not to scale']) expect(b).toContain(name)
    const f = text(render({ task: 'next', life: 'frog', from: 'tadpole' }, {}))
    for (const name of ['Stop when the tadpole has changed into its next stage.', 'Week 3', 'lily pad', 'pond weed', 'pond', 'stone']) expect(f).toContain(name)
    const p = text(render({ task: 'find', life: 'plant', clue: 'root' }, {}))
    for (const name of ['Day 0', 'soil', 'seed']) expect(p).toContain(name)
  })

  it('every move changes the still frame, with nothing animating under reduced motion', () => {
    for (const c of ALL) {
      const { min, max } = rangeOf(c)
      const frames = new Set<string>()
      for (let s = min; s <= max; s++) {
        const html = render(c, { step: s })
        expect(html, nameOf(c)).not.toMatch(/transition:\s*[a-z]/)
        // The picture alone, without its words or the slider: the drawing itself must change.
        const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'))
        frames.add(svg.replace(/aria-[a-z]+="[^"]*"/g, '').replace(/data-moment="\d+"/g, '').replace(/>[^<]*</g, '><'))
      }
      expect(frames.size, nameOf(c)).toBe(max - min + 1)
    }
  })

  it('marking names the stage and why, and what was made when wrong', () => {
    const c: LifeConfig = { task: 'find', life: 'butterfly', clue: 'in-case' }
    expect(text(render(c, { step: 8 }, 'right'))).toMatch(/Yes\. On day 21 it is a chrysalis \(pupa\)/)
    expect(text(render(c, { step: 5 }, 'wrong'))).toMatch(/On day 14 it is a full-grown caterpillar/)
    const shown = render({ task: 'next', life: 'frog', from: 'tadpole' }, {}, 'shown')
    expect(shown).toContain('data-moment="5"')
    expect(text(shown)).toMatch(/The tadpole has become a froglet/)
  })

  it('every control is a real button or slider with its own label, locked once solved', () => {
    const c: LifeConfig = { task: 'find', life: 'frog', clue: 'gills' }
    const idle = render(c, { step: 3 })
    expect(idle).toMatch(/<button[^>]*aria-label="Go back in time"/)
    expect(idle).toMatch(/<button[^>]*aria-label="Let time pass"/)
    expect(idle).toMatch(/role="slider"[^>]*aria-valuetext="Week 5"/)
    expect(idle).toContain('nodrag')
    expect(idle).toContain('touch-none')
    const start = render(c, {})
    expect(start).toMatch(/<button[^>]*aria-label="Go back in time"[^>]*disabled=""/)
    const done2 = render(c, { step: 3 }, 'right')
    expect(done2).toMatch(/<button[^>]*aria-label="Let time pass"[^>]*disabled=""/)
    expect(done2).toMatch(/role="slider"[^>]*tabindex="-1"/)
  })

  it('tells a screen reader what is seen, never the name of a stage to be found', () => {
    for (const life of LIVES) {
      for (const m of LIFE[life].moments) {
        for (const words of Object.values(NAMES)) for (const w of words) expect(m.seen, `${life} ${m.day}`).not.toMatch(w)
      }
    }
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const c of ALL) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = render(c, marked === 'right' ? engine.solve(c) : engine.initial(c), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })
})
