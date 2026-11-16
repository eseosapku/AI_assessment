// lib/studylab/engines/art-studio/art-studio.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  artStudioEngine as engine, COLOURS, COLS, MATCH_TOLERANCE, MAX_DABS, MOTIFS, PAINTS, ROWS, RULES, SPOTS_X, SPOTS_Y, SPOT_ON,
  amountsOf, dabsOf, done, givenPrints, hexOf, labDistance, labOf, madeText, missText, mixDistance, patternOf, printsOf, printsToMake, recipeText, reflectance, spotKey, tally, working,
  type Amounts, type ArtConfig, type ArtState, type Paint, type Print, type RuleName,
} from './config'
import { CLOTH, DOLLOPS, MIX_H, MIX_X, MIX_Y, PALETTE, REPEAT_H, SPOT_X0, SPOT_Y0, STEP, ArtStudioView, W, mixRadius, nearest, spotAt, streakPath } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const MIXES: ArtConfig[] = Object.keys(COLOURS).map((colour) => ({ task: 'mix', colour }))
const REPEATS: ArtConfig[] = RULES.flatMap((rule) => MOTIFS.map((motif) => ({ task: 'repeat' as const, rule, motif })))
const ALL: ArtConfig[] = [...MIXES, ...REPEATS]
const nameOf = (c: ArtConfig) => JSON.stringify(c)
const dabsFor = (a: Amounts): Paint[] => PAINTS.flatMap((p) => Array.from({ length: a[p] ?? 0 }, () => p))
const hue = (a: Amounts) => { const l = labOf(a); return ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360 }
const chroma = (a: Amounts) => { const l = labOf(a); return Math.hypot(l[1], l[2]) }
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

describe('paint mixes as paint does', () => {
  it('red and yellow make an orange, between the two', () => {
    const o = hue({ red: 1, yellow: 1 })
    expect(o).toBeGreaterThan(hue({ red: 1 }))
    expect(o).toBeLessThan(hue({ yellow: 1 }))
    const [r, g, b] = rgb(hexOf({ red: 1, yellow: 1 }))
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
  })

  it('yellow and blue make a green, which averaging light would not', () => {
    const [r, g, b] = rgb(hexOf({ yellow: 1, blue: 1 }))
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
    // The average of the two as light would be a grey, far lighter than the paint: paint takes light away.
    const lightAverage = rgb(hexOf({ yellow: 1 })).map((v, i) => (v + rgb(hexOf({ blue: 1 }))[i]) / 2)
    expect(Math.abs(lightAverage[0] - lightAverage[2])).toBeLessThan(40)
    expect(labOf({ yellow: 1, blue: 1 })[0]).toBeLessThan(labOf({ yellow: 1 })[0])
  })

  it('red and blue make a purple', () => {
    const [r, g, b] = rgb(hexOf({ red: 1, blue: 1 }))
    expect(b).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(g)
  })

  it('all three go muddy: duller than any two of them', () => {
    const mud = chroma({ red: 1, yellow: 1, blue: 1 })
    expect(mud).toBeLessThan(chroma({ red: 1, yellow: 1 }) / 2)
    expect(mud).toBeLessThan(chroma({ yellow: 1, blue: 1 }))
    expect(mud).toBeLessThan(chroma({ red: 1, blue: 1 }))
    expect(labOf({ red: 1, yellow: 1, blue: 1 })[0]).toBeLessThan(labOf({ red: 1, yellow: 1 })[0])
  })

  it('white makes a tint and black a shade, each by small steps, and black is the stronger', () => {
    for (const p of ['red', 'yellow', 'blue'] as Paint[]) {
      expect(labOf({ [p]: 1, white: 1 })[0], p).toBeGreaterThan(labOf({ [p]: 1 })[0])
      expect(labOf({ [p]: 1, white: 3 })[0], p).toBeGreaterThan(labOf({ [p]: 1, white: 1 })[0])
      expect(labOf({ [p]: 3, black: 1 })[0], p).toBeLessThan(labOf({ [p]: 1 })[0])
      expect(chroma({ [p]: 3, black: 1 }), p).toBeLessThan(chroma({ [p]: 1 }))
    }
    // Equal parts of black and white come out nearer black than white.
    const mid = labOf({ white: 1, black: 1 })[0]
    expect(mid - labOf({ black: 1 })[0]).toBeLessThan(labOf({ white: 1 })[0] - mid)
    // No colour in a grey.
    expect(chroma({ white: 2, black: 1 })).toBeLessThan(4)
  })

  it('reflects no more light than the paint in it that reflects the most, band by band', () => {
    const mix = reflectance({ red: 1, yellow: 1 })
    const a = reflectance({ red: 1 })
    const b = reflectance({ yellow: 1 })
    mix.forEach((v, i) => {
      expect(v, `band ${i}`).toBeLessThanOrEqual(Math.max(a[i], b[i]) + 1e-9)
      expect(v, `band ${i}`).toBeGreaterThanOrEqual(Math.min(a[i], b[i]) - 1e-9)
    })
  })

  it('reads only the proportions: twice the paint is the same colour', () => {
    for (const c of Object.values(COLOURS)) {
      const twice = Object.fromEntries(Object.entries(c.recipe).map(([k, v]) => [k, (v as number) * 2])) as Amounts
      expect(labDistance(labOf(c.recipe), labOf(twice))).toBeLessThan(1e-6)
    }
  })

  it('draws a fraction of a dab, which is how the swirl passes through real mixtures', () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map((f) => labDistance(labOf({ red: 1, yellow: f }), labOf({ red: 1, yellow: 1 })))
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1])
    for (const h of [hexOf({ red: 0.2, yellow: 0.03 }), hexOf({})]) expect(h).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('the colour match is forgiving, as a good eye is', () => {
  it('keeps the tolerance and what counts as exact in one named place', () => {
    expect(MATCH_TOLERANCE).toBe(10)
    expect(SPOT_ON).toBeLessThan(MATCH_TOLERANCE)
  })

  it('every recipe fits the palette, twice over where it can, and is the exact mix', () => {
    for (const [name, c] of Object.entries(COLOURS)) {
      const n = dabsFor(c.recipe).length
      expect(n, name).toBeGreaterThanOrEqual(2)
      expect(n, name).toBeLessThanOrEqual(Math.floor(MAX_DABS / 1.5))
      expect(mixDistance({ task: 'mix', colour: name }, { dabs: dabsFor(c.recipe) }), name).toBeLessThan(1e-6)
    }
  })

  it('a near mix passes, and says Near enough with the exact mix, never wrong', () => {
    const c: ArtConfig = { task: 'mix', colour: 'orange' }
    const near: ArtState = { dabs: ['red', 'red', 'red', 'yellow', 'yellow'] }
    expect(mixDistance(c, near)).toBeGreaterThan(SPOT_ON)
    expect(engine.check(c, near).ok).toBe(true)
    const said = working(c, near)
    expect(said).toMatch(/^Near enough/)
    expect(said).toContain('equal parts of red and yellow')
    expect(said).not.toMatch(/wrong/i)
    expect(working(c, { dabs: ['red', 'yellow'] })).toMatch(/^Yes\. Orange is equal parts of red and yellow/)
    expect(working(c, { dabs: ['red', 'red', 'yellow', 'yellow'] })).toMatch(/^Yes\./)
    // Every colour has at least one near mix besides its own proportions.
    for (const m of MIXES) {
      if (m.task !== 'mix') continue
      const recipe = COLOURS[m.colour].recipe
      const neighbours = PAINTS.flatMap((p) => [{ ...recipe, [p]: (recipe[p] ?? 0) + 1 }, { ...recipe, [p]: Math.max(0, (recipe[p] ?? 0) * 2 + 1) }])
      const doubled = Object.fromEntries(Object.entries(recipe).map(([k, v]) => [k, (v as number) * 2])) as Amounts
      const candidates = [...neighbours, ...PAINTS.map((p) => ({ ...doubled, [p]: (doubled[p] ?? 0) + 1 }))]
      const passes = candidates.filter((a) => labDistance(labOf(a), labOf(recipe)) <= MATCH_TOLERANCE && labDistance(labOf(a), labOf(recipe)) > 0)
      expect(passes.length, m.colour).toBeGreaterThan(0)
    }
  })

  it('a plain paint is never enough, and no first dab is near', () => {
    for (const c of MIXES) {
      for (const p of PAINTS) expect(engine.check(c, { dabs: [p] }).ok, `${nameOf(c)} ${p}`).toBe(false)
      for (const p of PAINTS) expect(mixDistance(c, { dabs: [p] }), `${nameOf(c)} ${p}`).toBeGreaterThan(MATCH_TOLERANCE + 8)
    }
  })

  it('tells clearly different colours apart', () => {
    const c: ArtConfig = { task: 'mix', colour: 'orange' }
    expect(engine.check(c, { dabs: ['red', 'red', 'red', 'red', 'yellow'] }).ok).toBe(false)
    expect(engine.check(c, { dabs: ['red', 'yellow', 'yellow', 'yellow', 'yellow'] }).ok).toBe(false)
    expect(engine.check(c, { dabs: ['red', 'yellow', 'blue'] }).ok).toBe(false)
    expect(engine.check({ task: 'mix', colour: 'green' }, { dabs: ['yellow', 'yellow', 'yellow', 'blue'] }).ok).toBe(false)
    expect(engine.check({ task: 'mix', colour: 'pink' }, { dabs: ['red', 'white'] }).ok).toBe(false)
    expect(engine.check({ task: 'mix', colour: 'grey' }, { dabs: ['white', 'white', 'white', 'white', 'white', 'white', 'black'] }).ok).toBe(false)
    const names = Object.keys(COLOURS)
    for (const a of names) {
      for (const b of names) {
        if (a < b) expect(labDistance(labOf(COLOURS[a].recipe), labOf(COLOURS[b].recipe)), `${a} and ${b}`).toBeGreaterThan(MATCH_TOLERANCE)
      }
    }
  })

  it('says which way a mix is off, in an eye’s words, and never the recipe', () => {
    expect(missText({ red: 5, yellow: 1 }, { red: 1, yellow: 1 })).toContain('too red')
    expect(missText({ red: 1, yellow: 6 }, { red: 1, yellow: 1 })).toContain('too yellow')
    expect(missText({ blue: 1 }, { blue: 1, white: 3 })).toContain('too dark')
    expect(missText({ blue: 1, white: 8 }, { blue: 1, white: 1 })).toContain('too pale')
    expect(missText({ red: 1, yellow: 1, blue: 1 }, { red: 1, yellow: 1 })).toContain('too dull')
    const c: ArtConfig = { task: 'mix', colour: 'pink' }
    const made = madeText(c, { dabs: ['red'] })
    expect(made).toMatch(/too/)
    expect(made).not.toMatch(/white|parts?\b|tint/i)
    expect(madeText(c, { dabs: [] })).toMatch(/empty/)
    expect(madeText({ task: 'mix', colour: 'orange' }, { dabs: ['red', 'yellow', 'blue'] })).toMatch(/All three primaries/)
    expect(madeText({ task: 'mix', colour: 'brown' }, { dabs: ['red', 'yellow', 'blue', 'blue', 'blue'] })).not.toMatch(/All three primaries/)
  })

  it('gives each recipe in plain words', () => {
    expect(recipeText({ red: 1, yellow: 1 })).toBe('equal parts of red and yellow')
    expect(recipeText({ red: 1, white: 3 })).toBe('3 parts white to 1 part red')
    expect(recipeText({ red: 2, yellow: 2, blue: 1 })).toMatch(/^2 parts (?:red|yellow), 2 parts (?:red|yellow) to 1 part blue$/)
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
    expect(ALL.length).toBeGreaterThanOrEqual(30)
  })

  it('every mix up to eight dabs is marked by its distance alone', () => {
    const rec = (i: number, left: number, m: Amounts, out: Amounts[]) => {
      if (i === PAINTS.length) { if (Object.values(m).some((v) => v)) out.push(m); return out }
      for (let k = 0; k <= left; k++) rec(i + 1, left - k, { ...m, [PAINTS[i]]: k }, out)
      return out
    }
    const every = rec(0, 8, {}, [])
    expect(every.length).toBe(1286)
    for (const c of MIXES) {
      if (c.task !== 'mix') continue
      const want = labOf(COLOURS[c.colour].recipe)
      let right = 0
      for (const a of every) {
        const ok = engine.check(c, { dabs: dabsFor(a) }).ok
        expect(ok, `${c.colour} ${JSON.stringify(a)}`).toBe(labDistance(labOf(a), want) <= MATCH_TOLERANCE)
        if (ok) right++
      }
      // Forgiving, and still a task: several mixes pass, and most do not.
      expect(right, c.colour).toBeGreaterThanOrEqual(4)
      expect(right / every.length, c.colour).toBeLessThan(0.08)
    }
  })

  it('refuses a state that could not have been made', () => {
    const c: ArtConfig = { task: 'mix', colour: 'orange' }
    expect(engine.check(c, {}).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { dabs: 'red' as never }).ok).toBe(false)
    expect(engine.check(c, { dabs: ['chalk', 'gold'] as never }).ok).toBe(false)
    expect(dabsOf({ dabs: Array.from({ length: 30 }, () => 'red' as Paint) })).toHaveLength(MAX_DABS)
    const r: ArtConfig = { task: 'repeat', rule: 'block', motif: 'leaf' }
    expect(engine.check(r, {}).ok).toBe(false)
    expect(engine.check(r, null as never).ok).toBe(false)
    expect(printsOf(r, { prints: [{ x: 99, y: 0, turn: 0, flip: false }, { x: 1.5, y: 0, turn: 0, flip: false }, null as never] })).toEqual([])
  })
})

describe('the repeats', () => {
  const rules = RULES as readonly RuleName[]

  it('each rule lays one print in each of its places, all different and on the cloth', () => {
    for (const r of rules) {
      const all = patternOf(r)
      expect(all, r).toHaveLength(COLS * ROWS)
      expect(new Set(all.map(spotKey)).size, r).toBe(COLS * ROWS)
      for (const p of all) {
        expect(p.x, r).toBeGreaterThanOrEqual(0)
        expect(p.y, r).toBeGreaterThanOrEqual(0)
        expect(p.x, r).toBeLessThan(SPOTS_X)
        expect(p.y, r).toBeLessThan(SPOTS_Y)
      }
    }
  })

  it('is what its name says', () => {
    const at = (r: RuleName, col: number, row: number) => patternOf(r).find((p) => p.col === col && p.row === row)!
    expect(at('block', 1, 0)).toMatchObject({ x: 2, y: 0, turn: 0, flip: false })
    expect(at('half-drop', 1, 0)).toMatchObject({ x: 2, y: 1 })
    expect(at('half-drop', 2, 0)).toMatchObject({ x: 4, y: 0 })
    expect(at('brick', 0, 1)).toMatchObject({ x: 1, y: 2 })
    expect(at('brick', 0, 2)).toMatchObject({ x: 0, y: 4 })
    expect(at('mirror', 1, 0)).toMatchObject({ x: 2, y: 0, flip: true })
    expect(at('mirror', 2, 0)).toMatchObject({ x: 4, y: 0, flip: false })
    expect([0, 1, 2, 3].map((col) => at('turn', col, 0).turn)).toEqual([0, 1, 2, 3])
  })

  it('leaves half the cloth to print, and what is given shows the rule', () => {
    for (const r of rules) {
      expect(givenPrints(r).length, r).toBe((COLS * ROWS) / 2)
      expect(printsToMake(r).length, r).toBe((COLS * ROWS) / 2)
    }
    const sig = (r: RuleName) => givenPrints(r).map((p) => `${spotKey(p)}/${p.turn}/${p.flip}`).sort().join(' ')
    expect(new Set(rules.map(sig)).size).toBe(rules.length)
  })

  it('wants every print in its place, and counts what is off', () => {
    const c: ArtConfig = { task: 'repeat', rule: 'half-drop', motif: 'leaf' }
    const want = printsToMake('half-drop')
    expect(tally(c, {})).toEqual({ placed: 0, off: 0, wrongWay: 0, missing: 6 })
    expect(done(c, { prints: want.slice(0, 5) })).toBe(false)
    expect(tally(c, { prints: want.slice(0, 5) }).missing).toBe(1)
    const extra: Print = { x: 7, y: 5, turn: 0, flip: false }
    expect(done(c, { prints: [...want, extra] })).toBe(false)
    expect(tally(c, { prints: [...want, extra] }).off).toBe(1)
    expect(done(c, { prints: want })).toBe(true)
    // The order they went on in does not matter.
    expect(done(c, { prints: [...want].reverse() })).toBe(true)
    expect(madeText(c, { prints: [...want.slice(1), extra] })).toBe('1 print is out of step with the pattern, and 1 place is still bare.')
    const m: ArtConfig = { task: 'repeat', rule: 'mirror', motif: 'bird' }
    const mw = printsToMake('mirror').map((p) => ({ ...p, flip: false }))
    expect(done(m, { prints: mw })).toBe(false)
    expect(madeText(m, { prints: mw })).toMatch(/3 prints are in the right place but facing the wrong way/)
    expect(madeText(c, {})).toBe('6 places are still bare.')
  })

  it('a print on a given one counts for nothing, and a repeat counts once', () => {
    const c: ArtConfig = { task: 'repeat', rule: 'block', motif: 'fish' }
    const g = givenPrints('block')[0]
    expect(printsOf(c, { prints: [g] })).toEqual([])
    const p: Print = { x: 4, y: 0, turn: 0, flip: false }
    expect(printsOf(c, { prints: [p, p] })).toHaveLength(1)
  })

  it('says the name of the repeat and why, only once marked', () => {
    const named: Record<RuleName, RegExp> = { block: /block repeat/, 'half-drop': /half-drop repeat/, brick: /brick repeat/, mirror: /mirror repeat/, turn: /rotated repeat/ }
    for (const r of rules) {
      const c: ArtConfig = { task: 'repeat', rule: r, motif: 'leaf' }
      expect(working(c, engine.solve(c)), r).toMatch(named[r])
      expect(madeText(c, engine.initial(c)), r).not.toMatch(named[r])
    }
  })
})

describe('reading the tutor', () => {
  it('reads broadly', () => {
    expect(engine.parse({ colour: 'violet' })).toEqual({ task: 'mix', colour: 'purple' })
    expect(engine.parse({ color: 'Light Blue' })).toEqual({ task: 'mix', colour: 'sky blue' })
    expect(engine.parse({ task: 'colour-mixing', target: 'Dark Red' })).toEqual({ task: 'mix', colour: 'maroon' })
    expect(engine.parse({ task: 'tint', colour: 'blue' })).toEqual({ task: 'mix', colour: 'sky blue' })
    expect(engine.parse({ task: 'shade', colour: 'red' })).toEqual({ task: 'mix', colour: 'maroon' })
    expect(engine.parse({ colour: 'tint of yellow' })).toEqual({ task: 'mix', colour: 'cream' })
    expect(engine.parse({ task: { kind: 'mix', colour: 'gray' } })).toEqual({ task: 'mix', colour: 'grey' })
    expect(engine.parse({ task: 'mix' })).toEqual({ task: 'mix', colour: 'orange' })
    expect(engine.parse({ rule: 'half drop' })).toEqual({ task: 'repeat', rule: 'half-drop', motif: 'leaf' })
    expect(engine.parse({ task: 'pattern', repeat: 'Brick Repeat', motif: 'Birds' })).toEqual({ task: 'repeat', rule: 'brick', motif: 'bird' })
    expect(engine.parse({ task: 'motif', layout: 'rotated', stamp: 'fish' })).toEqual({ task: 'repeat', rule: 'turn', motif: 'fish' })
    expect(engine.parse({ motif: 'leaf' })).toEqual({ task: 'repeat', rule: 'half-drop', motif: 'leaf' })
  })

  it('returns null only for what cannot be read', () => {
    for (const raw of [null, 3, 'orange', {}, { colour: 4 }, { task: 'sculpt' }, { task: 'repeat', rule: 7 }]) expect(engine.parse(raw), JSON.stringify(raw)).toBeNull()
  })

  it('still parses a colour or a rule it cannot draw, and refuses it with something that works', () => {
    for (const raw of [{ colour: 'tartan' }, { colour: 'red' }, { colour: 'white' }, { colour: 'black' }, { rule: 'zigzag' }, { motif: 'star' }, { rule: 'wave', motif: 'star' }]) {
      const c = engine.parse(raw)!
      expect(c, JSON.stringify(raw)).not.toBeNull()
      const said = engine.faults(c)
      expect(said.length, JSON.stringify(raw)).toBeGreaterThan(0)
      for (const s of said) {
        const m = s.match(/e\.g\. (colour|rule|motif) "([^"]+)"/)
        expect(m, s).not.toBeNull()
        const fixed = engine.parse({ ...raw, [m![1]]: m![2], ...(m![1] === 'motif' && 'rule' in raw && raw.rule === 'wave' ? { rule: 'block' } : {}), ...(m![1] === 'rule' && 'motif' in raw && raw.motif === 'star' ? { motif: 'leaf' } : {}) })!
        expect(engine.faults(fixed), s).toEqual([])
      }
    }
    expect(engine.faults({ task: 'mix', colour: 'red' })[0]).toMatch(/comes straight from the tube/)
  })

  it('a refused config still draws, and can be marked without crashing', () => {
    for (const c of [engine.parse({ colour: 'tartan' })!, engine.parse({ rule: 'zigzag', motif: 'star' })!]) {
      expect(() => renderToStaticMarkup(createElement(ArtStudioView as never, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false } as never))).not.toThrow()
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
    }
  })
})

describe('the prompt', () => {
  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"art-studio", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(2)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['mix', 'repeat']))
    const listed = [...engine.prompt.matchAll(/config: (\{[^}]*\})|or (\{[^}]*\})/g)].map((m) => m[1] ?? m[2])
    expect(listed.length).toBeGreaterThanOrEqual(4)
    for (const l of listed) expect(engine.faults(engine.parse(JSON.parse(l))!), l).toEqual([])
  })

  it('names the isolates it is registered with', () => {
    const named = [...engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)].map((m) => m[1])
    expect(named.length).toBeGreaterThan(0)
    for (const n of named) expect(n).toBe(engine.isolates)
  })

  it('every refusal carries a prompt that passes, for every config', () => {
    const bad = (c: ArtConfig) => (c.task === 'mix' ? 'Mix 2 parts of red and white, then drag it.' : 'Draw every second column half a block lower, as a half-drop.')
    for (const c of ALL) {
      const said = engine.promptFaults!(c, bad(c))
      expect(said.length, nameOf(c)).toBeGreaterThan(0)
      for (const s of said) {
        const m = s.match(/\("([^"]+)"\)$/)
        expect(m, s).not.toBeNull()
        expect(engine.promptFaults!(c, m![1]), `${nameOf(c)}: ${m![1]}`).toEqual([])
      }
    }
  })

  it('refuses a prompt that gives the mix away', () => {
    const c: ArtConfig = { task: 'mix', colour: 'orange' }
    for (const p of ['Mix red and yellow to match the jug.', 'Use red and yellow.', 'Add a little yellow to the red.', 'Mix 2 parts of one to 1 of the other.', 'Use equal parts.', 'Mix all three.', 'Start with some red.']) {
      expect(engine.promptFaults!(c, p), p).not.toEqual([])
    }
    const t: ArtConfig = { task: 'mix', colour: 'sky blue' }
    expect(engine.promptFaults!(t, 'Add white to blue to match the jug.')).not.toEqual([])
  })

  it('lets a prompt name the colour itself, and a tint or shade of something', () => {
    expect(engine.promptFaults!({ task: 'mix', colour: 'orange' }, 'Tap a paint to add a dab. Mix the orange of the jug until the patch disappears.')).toEqual([])
    expect(engine.promptFaults!({ task: 'mix', colour: 'red-orange' }, 'Tap a paint to add a dab. Mix the red-orange of the jug.')).toEqual([])
    expect(engine.promptFaults!({ task: 'mix', colour: 'blue-green' }, 'Tap a paint to add a dab. Mix this blue-green.')).toEqual([])
    expect(engine.promptFaults!({ task: 'mix', colour: 'sky blue' }, 'Tap a paint to add a dab. The jug is a tint of blue: mix its sky blue.')).toEqual([])
    expect(engine.promptFaults!({ task: 'mix', colour: 'navy' }, 'Tap a paint to add a dab. The jug is a shade of blue: mix it.')).toEqual([])
  })

  it('refuses a prompt that gives the rule away, or promises what the card has not got', () => {
    const c: ArtConfig = { task: 'repeat', rule: 'half-drop', motif: 'leaf' }
    for (const p of ['Carry on this half-drop.', 'Print every second column lower.', 'Tap the cloth: each new column starts half a block down.', 'Flip the block and print.']) {
      expect(engine.promptFaults!(c, p), p).not.toEqual([])
    }
    for (const p of ['Drag the block across the cloth.', 'Design your own batik on the cloth.', 'Colour in the pattern.']) {
      expect(engine.promptFaults!(c, p), p).not.toEqual([])
    }
    expect(engine.promptFaults!({ task: 'repeat', rule: 'mirror', motif: 'fish' }, 'Tap the cloth to print. Use the button to flip the block. Carry the pattern on.')).toEqual([])
    expect(engine.promptFaults!({ task: 'repeat', rule: 'turn', motif: 'fish' }, 'Tap the cloth to print. Use the button to turn the block. Carry the pattern on.')).toEqual([])
    expect(engine.promptFaults!({ task: 'mix', colour: 'pink' }, 'Drag the paint to mix it.')).not.toEqual([])
    expect(engine.promptFaults!({ task: 'mix', colour: 'pink' }, 'Tap a paint to mix a beam of coloured light.')).not.toEqual([])
  })
})

describe('the stations it is shown to', () => {
  it('is registered, and its entry says what it is', () => {
    expect(getEngine('art-studio')).toBe(engine)
    expect(sceneCatalogue()).toContain('SCENE "art-studio"')
    expect(engine.isolates).toBe('structure')
  })

  it('finds the art lessons it is made for', () => {
    for (const s of [
      'Using Colour in Art', 'Colour mixing: making secondary colours', 'Primary and secondary colours', 'Tints and shades', 'Tertiary colours', 'Painting', 'Drawing and painting', 'Visual arts techniques: colour mixing',
      'Fine arts', 'Motif Design', 'Motifs, Patterns and Design Process', 'Pattern Designs', 'Digital Pattern Design', 'Motifs & Patterns in Embroidery, Batik & Tie & Dye', 'Block printing with a potato', 'Half-drop repeat patterns',
      'The colour wheel', 'Mixing paints to match a colour', 'Visual arts techniques', 'Drawing and craft', 'Still Life and Nature',
    ]) {
      expect(scenesFor(s).map((e) => e.id), s).toContain('art-studio')
      expect(sceneCatalogue(s), s).toContain('SCENE "art-studio"')
    }
  })

  it('stays away from near misses', () => {
    for (const s of [
      'Colour of light and prisms', 'Primary colours of light', 'Mixing coloured light with filters', 'Colour mixing with light on a TV screen', 'Why the sky is blue', 'Shade and shadows', 'Tone of voice', 'Tone in poetry', 'Line graphs', 'Straight lines and gradients', 'Number patterns',
      'Weather patterns', 'Patterns of inheritance', 'Pattern recognition in computing', 'Flame colours', 'Colours of transition metal compounds', 'Colour blindness inheritance', 'Plant pigments and chromatography', 'Skin colour and evolution', 'Indicators change colour in acid', 'Musical tone and pitch',
      'Motifs in Romeo and Juliet', 'Literary motifs in the novel', 'Themes and motifs', 'Sequence motifs in DNA', 'Protein structural motifs', 'A musical motif in the symphony', 'Preventing rusting by painting and galvanising', 'How much paint to cover a wall: painting and area', 'Cave paintings in ancient times', 'The history of painting in the Renaissance',
      'The invention of block printing in the Tang dynasty', 'The printing press', 'Primary sources in history', 'Primary consumers and tertiary consumers', 'Secondary and tertiary sectors', 'Tertiary structure of proteins', 'Colour in chemistry', 'Colour palette',
    ]) {
      expect(scenesFor(s).map((e) => e.id), s).not.toContain('art-studio')
      expect(sceneCatalogue(s), s).not.toContain('SCENE "art-studio"')
    }
  })
})

/** The palette's outline, from its path, to test what sits on it. */
function outline(path: string): [number, number][] {
  const nums = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  const pts: [number, number][] = []
  let x = nums[0]
  let y = nums[1]
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = nums.slice(i, i + 6)
    for (let k = 0; k < 40; k++) {
      const t = k / 40
      const u = 1 - t
      pts.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3])
    }
    x = x3
    y = y3
  }
  return pts
}
const inside = (poly: [number, number][], px: number, py: number) => {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

describe('the drawing', () => {
  const palette = outline(PALETTE)
  const big = mixRadius(MAX_DABS)

  it('the view and the config agree on what the view writes out', () => {
    expect(new Set(DOLLOPS.map((d) => d.paint))).toEqual(new Set(PAINTS))
    expect(SPOTS_X).toBe(8)
    expect(SPOTS_Y).toBe(6)
    expect(MAX_DABS).toBe(12)
    expect(RULES).toEqual(['block', 'half-drop', 'brick', 'mirror', 'turn'])
  })

  it('every paint and its name sits on the palette, and each name is nearest its own paint', () => {
    for (const d of DOLLOPS) {
      for (const [dx, dy] of [[-16, -14], [16, -14], [-16, 14], [16, 14]]) expect(inside(palette, d.x + dx, d.y + dy), `${d.paint} ${dx} ${dy}`).toBe(true)
      const half = (d.paint.length * 7) / 2
      for (const [dx, dy] of [[-half, -10], [half, -10], [-half, 2], [half, 2]]) expect(inside(palette, d.labelX + dx, d.labelY + dy), `${d.paint} name ${dx} ${dy}`).toBe(true)
      const nearestDollop = [...DOLLOPS].sort((a, b) => Math.hypot(a.x - d.labelX, a.y - d.labelY) - Math.hypot(b.x - d.labelX, b.y - d.labelY))[0]
      expect(nearestDollop.paint, d.paint).toBe(d.paint)
    }
  })

  it('no paint touches another, or a name, and the fullest mix clears them all', () => {
    const boxes = DOLLOPS.flatMap((d) => [
      { n: `${d.paint} paint`, l: d.x - 16, r: d.x + 16, t: d.y - 14, b: d.y + 14 },
      { n: `${d.paint} name`, l: d.labelX - (d.paint.length * 7) / 2, r: d.labelX + (d.paint.length * 7) / 2, t: d.labelY - 11, b: d.labelY + 3 },
    ])
    for (const a of boxes) {
      for (const b of boxes) {
        if (a.n >= b.n) continue
        const apart = a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t
        expect(apart, `${a.n} and ${b.n}`).toBe(true)
      }
      const dx = Math.max(a.l - MIX_X, 0, MIX_X - a.r)
      const dy = Math.max(a.t - MIX_Y, 0, MIX_Y - a.b)
      expect(Math.hypot(dx, dy), a.n).toBeGreaterThan(big * 1.09)
    }
  })

  it('the fullest mix and its name stay on the palette and on the plate', () => {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      expect(inside(palette, MIX_X + big * 1.09 * Math.cos(a), MIX_Y + big * 1.09 * Math.sin(a)), `${i}`).toBe(true)
    }
    expect(inside(palette, MIX_X - 28, MIX_Y + big + 16)).toBe(true)
    expect(inside(palette, MIX_X + 28, MIX_Y + big + 16)).toBe(true)
    expect(MIX_Y + big + 16).toBeLessThan(MIX_H - 8)
    for (const [x, y] of palette) {
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(W)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(MIX_H)
    }
  })

  it('the mix grows with each dab, and a dab winds out into a streak that keeps to its size', () => {
    for (let n = 1; n <= MAX_DABS; n++) expect(mixRadius(n)).toBeGreaterThan(mixRadius(n - 1))
    const still = streakPath({ x: 10, y: 0, r: 8 }, 30, 0)
    const wound = streakPath({ x: 10, y: 0, r: 8 }, 30, 9)
    expect(still).not.toEqual(wound)
    const points = wound.match(/-?\d+\.\d/g)!.map(Number)
    for (const v of points) expect(Number.isFinite(v)).toBe(true)
    const pairs = points.reduce<number[][]>((all, v, i) => (i % 2 ? [...all.slice(0, -1), [all[all.length - 1][0], v]] : [...all, [v]]), [])
    for (const [x, y] of pairs) expect(Math.hypot(x - MIX_X, y - MIX_Y)).toBeLessThan(19)
  })

  it('every print stays on the cloth and clear of the hem, every spot a tap can reach', () => {
    for (let x = 0; x < SPOTS_X; x++) {
      for (let y = 0; y < SPOTS_Y; y++) {
        const at = spotAt({ x, y })
        expect(at.x - 22, `${x},${y}`).toBeGreaterThan(CLOTH.x + 5)
        expect(at.x + 22, `${x},${y}`).toBeLessThan(CLOTH.x + CLOTH.w - 5)
        expect(at.y - 22, `${x},${y}`).toBeGreaterThan(CLOTH.y + 5)
        expect(at.y + 22, `${x},${y}`).toBeLessThan(CLOTH.y + CLOTH.h - 5)
      }
    }
    expect(CLOTH.x + CLOTH.w).toBeLessThan(W)
    expect(CLOTH.y + CLOTH.h).toBeLessThan(REPEAT_H)
  })

  it('a tap goes to the nearest chalk cross, however far from it, so a print cannot be nearly in place', () => {
    expect(nearest(SPOT_X0, SPOT_Y0)).toEqual({ x: 0, y: 0 })
    expect(nearest(SPOT_X0 + STEP * 4 + 12, SPOT_Y0 + STEP * 2 - 12)).toEqual({ x: 4, y: 2 })
    expect(nearest(0, 0)).toEqual({ x: 0, y: 0 })
    expect(nearest(9999, 9999)).toEqual({ x: 7, y: 5 })
  })

  it('whole-cell prints do not touch their neighbours in any rule', () => {
    for (const r of RULES) {
      const all = patternOf(r).map(spotAt)
      for (const a of all) {
        for (const b of all) {
          if (a !== b) expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), r).toBeGreaterThanOrEqual(STEP)
        }
      }
    }
  })
})

describe('what a learner sees', () => {
  const page = (config: ArtConfig, prompt = 'Do it.') => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'art-studio', config }, success: { kind: 'scene' } } },
  } as never)))
  const view = (config: ArtConfig, state: ArtState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = true) =>
    renderToStaticMarkup(createElement(ArtStudioView as never, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' } as never))

  it('holds back the recipe and the name of the repeat until marked, even from screen readers', () => {
    for (const c of MIXES) {
      const html = page(c)
      expect(html, nameOf(c)).toContain('your mix')
      expect(html, nameOf(c)).not.toMatch(/\bparts?\b|equal parts|secondary|tertiary|\btint\b|\bshade\b|Near enough|Yes\./i)
    }
    for (const c of REPEATS) {
      const html = page(c)
      expect(html, nameOf(c)).toContain('The cloth: press the block here')
      expect(html, nameOf(c)).not.toMatch(/half-drop|brick|mirror|rotated|every second|straight|Near enough|Yes\./i)
    }
  })

  it('never shows the numbers of the recipe: the only dabs on the card are the learner’s own', () => {
    for (const c of MIXES) {
      const html = view(c, engine.initial(c))
      expect(html, nameOf(c)).toContain('Nothing yet')
      expect(html, nameOf(c)).not.toContain('data-dab-group')
    }
    const html = view({ task: 'mix', colour: 'orange' }, { dabs: ['red', 'red', 'yellow'] })
    expect((html.match(/data-dab-group="red"/g) ?? []).length).toBe(1)
    expect((html.match(/data-dab-group/g) ?? []).length).toBe(2)
  })

  it('each dab changes the drawing, even as a still frame', () => {
    const fills = (html: string) => {
      const m = html.match(/data-patch="true"[^>]*?fill="(#[0-9a-f]{6})"|<path[^>]*data-patch[^>]*fill="(#[0-9a-f]{6})"/)
      return m ? m[1] ?? m[2] : null
    }
    const c: ArtConfig = { task: 'mix', colour: 'orange' }
    const a = view(c, { dabs: ['red'] })
    const b = view(c, { dabs: ['red', 'yellow'] })
    expect(fills(a)).toBe(hexOf({ red: 1 }))
    expect(fills(b)).toBe(hexOf({ red: 1, yellow: 1 }))
    expect(fills(a)).not.toBe(fills(b))
    // The mix on the palette is drawn too, and grows.
    expect(a).toContain(`fill="${hexOf({ red: 1 })}"`)
    expect(view(c, { dabs: [] })).toContain('data-mix-ring')
  })

  it('each print changes the drawing', () => {
    const c: ArtConfig = { task: 'repeat', rule: 'mirror', motif: 'bird' }
    const count = (html: string) => (html.match(/data-mine="1"/g) ?? []).length
    expect(count(view(c, { prints: [] }))).toBe(0)
    expect(count(view(c, { prints: [{ x: 4, y: 0, turn: 0, flip: false }] }))).toBe(1)
    expect(view(c, { prints: [{ x: 4, y: 0, turn: 0, flip: true }] })).toContain('data-flip="1"')
    expect((view(c, engine.initial(c)).match(/data-mine="0"/g) ?? []).length).toBe(6)
  })

  it('shows the flip or turn button only where it matters', () => {
    expect(view({ task: 'repeat', rule: 'half-drop', motif: 'leaf' }, {})).not.toMatch(/Flip the block|Turn the block/)
    expect(view({ task: 'repeat', rule: 'mirror', motif: 'leaf' }, {})).toContain('Flip the block')
    expect(view({ task: 'repeat', rule: 'turn', motif: 'leaf' }, {})).toContain('Turn the block')
  })

  it('names each paint and control with a real button, and every text is at least 12 px', () => {
    const c: ArtConfig = { task: 'mix', colour: 'green' }
    const html = view(c, {})
    for (const p of PAINTS) expect(html).toContain(`aria-label="Add a dab of ${p}"`)
    expect(html).toContain('aria-label="Take back the last dab"')
    expect(html).toContain('aria-label="Wipe the palette clean"')
    expect(html).not.toMatch(/font-size="(?:[0-9]|1[01])"/)
    for (const r of REPEATS) expect(view(r, {})).not.toMatch(/font-size="(?:[0-9]|1[01])"/)
    expect(view(c, {})).not.toMatch(/gradient/i)
  })

  it('once marked it says so; shown it shows the answer', () => {
    const c: ArtConfig = { task: 'mix', colour: 'pink' }
    expect(view(c, { dabs: ['red'] }, 'wrong')).toMatch(/too/)
    expect(view(c, engine.solve(c), 'right')).toContain('3 parts white to 1 part red')
    expect(view(c, { dabs: [] }, 'shown')).toContain('3 parts white to 1 part red')
    const r: ArtConfig = { task: 'repeat', rule: 'brick', motif: 'leaf' }
    expect(view(r, {}, 'shown')).toContain('brick repeat')
    expect((view(r, {}, 'shown').match(/data-mine="1"/g) ?? []).length).toBe(6)
  })

  it('the amounts it reads from the dabs are the learner’s', () => {
    expect(amountsOf(['red', 'red', 'white'])).toEqual({ red: 2, white: 1 })
  })
})
