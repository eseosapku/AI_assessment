// lib/studylab/engines/bar-model/bar-model.test.ts
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { barModelEngine as engine, MAX_PIECES, compare, reduce, type BarModelConfig, type BarModelState } from './config'
import { BarModelView, BX, BW, pieceX } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

const MATCH: BarModelConfig[] = range(2, 12).flatMap((d) =>
  range(1, d - 1).flatMap((n) => range(2, 12).filter((into) => into !== d && (n * into) % d === 0).map((into) => ({ task: 'match' as const, n, d, into }))))
const PART: BarModelConfig[] = range(2, 12).flatMap((d) =>
  range(1, d - 1).flatMap((n) => [d, d * 7, d * 13].map((amount) => ({ task: 'part' as const, n, d, amount, unit: 'km' }))))
const SHARE: BarModelConfig[] = range(1, 11).flatMap((a) =>
  range(1, 11).filter((b) => a !== b && a + b <= 12).flatMap((b) => [1, 5].map((k) => ({ task: 'share' as const, amount: (a + b) * k, unit: 'sweets', a, b, names: ['Asha', 'Ben'] as [string, string] }))))
const ALL = [...MATCH, ...PART, ...SHARE]

describe('the arithmetic is exact', () => {
  it('compares fractions by cross-multiplying', () => {
    expect(compare(4, 6, 2, 3)).toBe(0)
    expect(compare(3, 6, 2, 3)).toBe(-1)
    expect(compare(5, 6, 2, 3)).toBe(1)
    expect(reduce(6, 10)).toEqual({ n: 3, d: 5 })
  })
})

describe('the bar-model engine', () => {
  it('reads configs however they are reasonably written', () => {
    expect(engine.parse({ task: 'match', fraction: '2/3', into: 6 })).toEqual({ task: 'match', n: 2, d: 3, into: 6 })
    expect(engine.parse({ task: 'equivalent fractions', n: 2, d: 3, pieces: 6 })).toEqual({ task: 'match', n: 2, d: 3, into: 6 })
    expect(engine.parse({ task: 'part', percent: 30, amount: 60, unit: 'km' })).toEqual({ task: 'part', n: 3, d: 10, amount: 60, unit: 'km' })
    expect(engine.parse({ task: 'part', fraction: '30%', amount: '60' })).toEqual({ task: 'part', n: 3, d: 10, amount: 60, unit: '' })
    expect(engine.parse({ task: 'share', ratio: '2 to 3', amount: 60, names: ['asha', 'Ben'] })).toMatchObject({ task: 'share', a: 2, b: 3, names: ['Asha', 'Ben'] })
    expect(engine.parse({ task: 'share', ratio: [2, 3], amount: 60, names: ['Asha', 'Ben'] })).not.toBeNull()
    for (const bad of [null, 'x', {}, { task: 'dance' }, { task: 'match', fraction: 'half', into: 6 }, { task: 'share', ratio: '2:3', amount: 60 }]) expect(engine.parse(bad)).toBeNull()
  })

  it('refuses what the bar cannot draw, with a nearby example that works', () => {
    const f = (raw: unknown) => engine.faults(engine.parse(raw)!)
    expect(f({ task: 'match', fraction: '2/3', into: 6 })).toEqual([])
    expect(f({ task: 'match', fraction: '2/3', into: 5 })[0]).toMatch(/not a multiple of 3.*into 6/)
    expect(f({ task: 'match', fraction: '2/3', into: 3 })[0]).toMatch(/same cut/)
    expect(f({ task: 'match', fraction: '2/3', into: 24 })[0]).toMatch(/at most|from 2 to 12/)
    expect(f({ task: 'match', fraction: '5/3', into: 6 })[0]).toMatch(/proper fraction/)
    expect(f({ task: 'part', percent: 5, amount: 60 })[0]).toMatch(/needs the bar cut into 20 parts/)
    expect(f({ task: 'part', fraction: '3/5', amount: 62 })[0]).toMatch(/amount 60/)
    expect(f({ task: 'part', percent: 120, amount: 60 })[0]).toMatch(/less than the whole/)
    expect(f({ task: 'share', ratio: '2:3', amount: 62, names: ['Asha', 'Ben'] })[0]).toMatch(/amount 60/)
    expect(f({ task: 'share', ratio: '7:8', amount: 60, names: ['Asha', 'Ben'] })[0]).toMatch(/15 parts/)
    expect(f({ task: 'share', ratio: '3:3', amount: 60, names: ['Asha', 'Ben'] })[0]).toMatch(/equal share/)
    expect(f({ task: 'share', ratio: '2:3', amount: 60, names: ['Asha', 'Amir'] })[0]).toMatch(/different letters/)
  })

  it('over every valid config, starts unsolved, can be solved, and marks by the rule', { timeout: 30_000 }, () => {
    expect(ALL.length).toBeGreaterThan(300)
    for (const c of ALL) {
      expect(engine.faults(c), JSON.stringify(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, JSON.stringify(c)).toBe(false)
      const s = engine.solve(c)
      expect(engine.check(c, s).ok, JSON.stringify(c)).toBe(true)
      expect(s.pieces!).toBeLessThanOrEqual(MAX_PIECES)
    }
  })

  it('marks every nearby wrong answer wrong', () => {
    const m = { task: 'match', n: 2, d: 3, into: 6 } as const
    expect(engine.check(m, { pieces: 6, shaded: 4 }).ok).toBe(true)
    expect(engine.check(m, { pieces: 6, shaded: 3 }).ok).toBe(false)
    expect(engine.check(m, { pieces: 6, shaded: 5 }).ok).toBe(false)
    expect(engine.check(m, { pieces: 12, shaded: 8 }).ok).toBe(false) // same length, wrong cut
    expect(engine.check(m, { pieces: 4, shaded: 4 }).ok).toBe(false)
    const p = { task: 'part', n: 3, d: 10, amount: 60, unit: '' } as const
    expect(engine.check(p, { pieces: 10, shaded: 3 }).ok).toBe(true)
    expect(engine.check(p, { pieces: 10, shaded: 4 }).ok).toBe(false)
    const h = { task: 'part', n: 1, d: 2, amount: 60, unit: '' } as const
    for (const [pc, sh] of [[2, 1], [4, 2], [6, 3], [12, 6]]) expect(engine.check(h, { pieces: pc, shaded: sh }).ok).toBe(true)
    const sc: BarModelConfig = { task: 'share', amount: 60, unit: '', a: 2, b: 3, names: ['Asha', 'Ben'] }
    const o = (xs: number[]) => xs.concat(Array(12 - xs.length).fill(0))
    expect(engine.check(sc, { pieces: 5, owners: o([1, 1, 2, 2, 2]) }).ok).toBe(true)
    expect(engine.check(sc, { pieces: 5, owners: o([2, 1, 2, 1, 2]) }).ok).toBe(true)
    expect(engine.check(sc, { pieces: 5, owners: o([1, 1, 1, 2, 2]) }).ok).toBe(false)
    expect(engine.check(sc, { pieces: 5, owners: o([1, 1, 2, 2]) }).ok).toBe(false) // one not given out
    expect(engine.check(sc, { pieces: 10, owners: o([1, 1, 1, 1, 2, 2, 2, 2, 2, 2]) }).ok).toBe(true)
    expect(engine.check(sc, { pieces: 4, owners: o([1, 1, 2, 2]) }).ok).toBe(false)
    expect(engine.check(sc, {}).ok).toBe(false)
  })

  it('is registered, with every example in its catalogue entry readable and fault-free', () => {
    expect(getEngine('bar-model')).toBe(engine)
    expect(engine.prompt).toMatch(/SCENE "bar-model"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:bar-model"/)
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"bar-model", "config": (\{.*\}) \},/g)]
    expect(found.length).toBe(3)
    for (const m of found) {
      const c = engine.parse(JSON.parse(m[2]))
      expect(c, m[2]).not.toBeNull()
      expect(engine.faults(c!)).toEqual([])
      expect(engine.promptFaults!(c!, m[1]), m[1]).toEqual([])
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (raw: unknown, prompt: string) => engine.promptFaults!(engine.parse(raw)!, prompt)
  const match = { task: 'match', fraction: '2/3', into: 6 }
  const part = { task: 'part', fraction: '3/5', amount: 60, unit: 'km' }
  const share = { task: 'share', ratio: '2:3', amount: 60, unit: 'sweets', names: ['Asha', 'Ben'] }

  it('match: how many parts to cut into is fine, how many to shade is not', () => {
    expect(pf(match, 'Cut the lower bar into 6 equal parts and shade it to the same length as the top bar.')).toEqual([])
    expect(pf(match, 'Cut it into 6 parts and shade 4.')).toHaveLength(1)
    expect(pf(match, 'Show 2/3 as 4/6.')).toHaveLength(1)
    expect(pf(match, 'Shade four sixths.')).toHaveLength(1)
  })
  it('part: asking for the fraction is fine; the worth and the cut are not', () => {
    expect(pf(part, 'Cut and shade the bar to show 3/5 of the distance.')).toEqual([])
    expect(pf(part, 'Cut and shade the bar to show 3/5 of the 60 km distance.')).toEqual([])
    expect(pf(part, 'Show 36 km on the bar.')).toHaveLength(1)
    expect(pf(part, 'Cut the bar into 5 and shade 3.')).toHaveLength(1)
  })
  it('share: asking for the sharing is fine; the parts, a part and a share are not', () => {
    expect(pf(share, 'Share the sweets between Asha and Ben in the ratio 2:3.')).toEqual([])
    expect(pf(share, 'Cut it into 5 equal parts and share them in the ratio 2:3.')).toHaveLength(1)
    expect(pf(share, 'Each part is worth 12 sweets.')).toHaveLength(1)
    expect(pf(share, 'Asha should get 24 sweets.')).toHaveLength(1)
  })
})

describe('when the tutor is shown it', () => {
  it('is offered for the stations that name these topics', () => {
    for (const s of ['Fractions', 'Equivalent fractions', 'Percentages', 'Percentage of an amount', 'Ratio and proportion', 'Sharing in a ratio', 'Simplifying ratios', 'Bar models', 'Fractions, decimals and percentages', 'Percentage increase and decrease']) {
      expect(sceneCatalogue(s), s).toContain('SCENE "bar-model"')
      expect(scenesFor(s).some((e) => e.id === 'bar-model'), s).toBe(true)
    }
  })
  it('is not offered for the fractions, ratios and percentages of other subjects', () => {
    for (const s of ['Surface area to volume ratio', 'Fractional distillation of crude oil', 'Trigonometric ratios', 'Sine and cosine ratio', 'Accounting ratios: liquidity and profitability', 'Current ratio and gearing', 'Mole fraction and partial pressure', 'Percentage yield', 'Gear ratios', 'Rationalising the denominator']) {
      expect(sceneCatalogue(s), s).not.toContain('SCENE "bar-model"')
      expect(scenesFor(s).some((e) => e.id === 'bar-model'), s).toBe(false)
    }
  })
})

describe('a still frame is a frame a learner sees', () => {
  it('every part, at every cut, is at least 28 px wide and inside the bar', () => {
    for (let p = 1; p <= MAX_PIECES; p++) {
      expect(pieceX(0, p)).toBe(BX)
      expect(pieceX(p, p)).toBeCloseTo(BX + BW)
      expect(BW / p).toBeGreaterThanOrEqual(28)
    }
  })
})

describe('the bar-model scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'bar-model', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: BarModelConfig, state: BarModelState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(BarModelView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const m: BarModelConfig = { task: 'match', n: 2, d: 3, into: 6 }
  const p: BarModelConfig = { task: 'part', n: 3, d: 5, amount: 60, unit: 'km' }
  const s: BarModelConfig = { task: 'share', amount: 60, unit: 'sweets', a: 2, b: 3, names: ['Asha', 'Ben'] }

  it('match: before marking, two bars, two round buttons, the colours named, and no answer', () => {
    const prompt = 'Cut the lower bar into 6 equal parts and shade it to the same length as the top bar.'
    const html = card({ task: 'match', fraction: '2/3', into: 6 }, prompt)
    expect(html).toContain('aria-label="Cut the bar into one more equal part"')
    expect(html).toContain('aria-label="Cut the bar into one fewer equal part"')
    const shown = text(html.replace(prompt, ''))
    for (const w of ['shaded', 'not shaded', 'Given: 2 of 3 parts shaded', 'Yours', '1 equal part']) expect(shown, w).toContain(w)
    for (const secret of ['4/6', '4 of 6', 'same length', 'You cut', 'match', 'equivalent']) expect(shown, secret).not.toContain(secret)
    expect(html).not.toContain('stroke-dasharray')
    expect((html.match(/aria-label="Cut the bar/g) ?? []).length).toBe(2)
  })

  it('every cut changes the picture a lot: the dividers move and the shaded length follows', () => {
    const one = raw(m, { pieces: 1, shaded: 0 }, 'idle')
    const six = raw(m, { pieces: 6, shaded: 0 }, 'idle')
    expect(six).not.toBe(one)
    expect(text(six)).toContain('6 equal parts')
    expect(raw(m, { pieces: 6, shaded: 4 }, 'idle')).toContain('scaleX(0.6666')
    expect(raw(m, { pieces: 6, shaded: 3 }, 'idle')).toContain('scaleX(0.5)')
    expect((six.match(/role="button"/g) ?? []).length).toBe(6)
  })

  it('marking names the fractions and draws the line; wrong says what the learner made', () => {
    const good = raw(m, engine.solve(m), 'right')
    expect(good).toContain('stroke-dasharray')
    expect(text(good)).toContain('2/3 and 4/6 are the same length')
    expect(text(raw(m, { pieces: 6, shaded: 3 }, 'wrong'))).toContain('You cut it into 6 parts and shaded 3: 3/6 of the bar, shorter than 2/3.')
    expect(text(raw(m, { pieces: 12, shaded: 8 }, 'wrong'))).toContain('the card asked for 6 parts')
  })

  it('part: no worth before marking; each part and the total once marked', () => {
    const idle = text(raw(p, { pieces: 5, shaded: 3 }, 'idle'))
    expect(idle).toContain('Whole bar = 60 km')
    for (const secret of ['36', ' 12 ', 'Each part']) expect(idle, secret).not.toContain(secret)
    const right = text(raw(p, engine.solve(p), 'right'))
    expect(right).toContain('Each part is 12 (60 km in 5 parts). 3 parts are 3 × 12 = 36 km.')
    expect(text(raw(p, { pieces: 5, shaded: 4 }, 'wrong'))).toContain('4/5 of 60 km, which is 48 km, too much')
  })

  it('share: the two people are named with their colours, parts carry their owner, and amounts come with the mark', () => {
    const o = (xs: number[]) => xs.concat(Array(12 - xs.length).fill(0))
    const idle = raw(s, { pieces: 5, owners: o([1, 1, 2]) }, 'idle')
    const t = text(idle)
    for (const w of ['Asha', 'Ben', 'not given yet', 'Whole bar = 60 sweets']) expect(t, w).toContain(w)
    for (const secret of ['24', '36', 'Each part', '12 sweets']) expect(t, secret).not.toContain(secret)
    expect(idle).toContain('aria-pressed="true"')
    expect((idle.match(/<button/g) ?? []).length).toBe(4)
    expect(idle).toContain('given to Asha')
    const right = text(raw(s, engine.solve(s), 'right'))
    expect(right).toContain('Asha gets 2 parts, 24 sweets. Ben gets 3 parts, 36 sweets.')
    expect(text(raw(s, { pieces: 5, owners: o([1, 1, 1, 2, 2]) }, 'wrong'))).toContain('gave Asha 3 parts and Ben 2 parts')
  })

  it('buttons stop at the ends of their range and lock when solved', () => {
    const disabled = (html: string) => (html.match(/<button[^>]* disabled=""/g) ?? []).length
    expect(disabled(raw(m, { pieces: 3, shaded: 0 }, 'idle'))).toBe(0)
    expect(disabled(raw(m, { pieces: 1, shaded: 0 }, 'idle'))).toBe(1)
    expect(disabled(raw(m, { pieces: MAX_PIECES, shaded: 0 }, 'idle'))).toBe(1)
    expect(disabled(raw(m, engine.solve(m), 'right'))).toBe(2)
  })

  it('reduced motion: no transitions', () => {
    for (const c of [m, p, s]) expect(raw(c, engine.initial(c), 'idle', true)).not.toMatch(/transition|animation/i)
    expect(raw(m, engine.initial(m), 'idle', false)).toMatch(/transition/)
  })
})
