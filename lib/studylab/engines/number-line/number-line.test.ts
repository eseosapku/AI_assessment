// lib/studylab/engines/number-line/number-line.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  numberLineEngine as engine, cellOf, done, fineText, ladderOf, landing, lastLevel, madeText, moveTo, rangeOf, readPlace, readValue, targetText,
  valueKey, windowAt, working, zoomIn, zoomOut,
  type JumpConfig, type NumberLineConfig, type NumberLineState, type PlaceConfig,
} from './config'
import { NumberLineView, X0, X1, labelled, placeHeight, rowCount } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { validateSpec } from '../../activities/validate'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const place = (value: string) => engine.parse({ task: 'place', value }) as PlaceConfig
const jump = (start: number, op: 'add' | 'subtract', amount: number) => engine.parse({ task: 'jump', start, op, amount }) as JumpConfig

/** Every number the card can place: whole numbers, decimals of one and two places, fractions with denominators 2 to 10. */
function allValues(): string[] {
  const out: string[] = []
  for (let n = -1999; n <= 1999; n++) out.push(String(n))
  for (let n = -199; n <= 199; n++) out.push((n / 10).toFixed(1))
  for (let n = -1999; n <= 1999; n++) out.push((n / 100).toFixed(2))
  for (let d = 2; d <= 10; d++) for (let n = -19 * d; n <= 19 * d; n++) out.push(`${n}/${d}`)
  return out
}
const ALL_PLACE: PlaceConfig[] = allValues().map((v) => place(v))
const ALL_JUMP: JumpConfig[] = []
for (let s = -20; s <= 20; s++) for (let a = -20; a <= 20; a++) {
  if (a === 0 || Math.abs(s) + Math.abs(a) > 20) continue
  for (const op of ['add', 'subtract'] as const) ALL_JUMP.push(jump(s, op, a))
}

describe('reading a number exactly', () => {
  it('reads whole numbers, decimals, fractions and mixed numbers', () => {
    expect(readValue('3.47')).toMatchObject({ kind: 'dec', D: 100, T: 347, dp: 2 })
    expect(readValue('-2.5')).toMatchObject({ kind: 'dec', D: 10, T: -25 })
    expect(readValue('−2.5')).toMatchObject({ kind: 'dec', D: 10, T: -25 })
    expect(readValue('3.50')).toMatchObject({ kind: 'dec', D: 10, T: 35 })
    expect(readValue('4.0')).toMatchObject({ kind: 'int', T: 4 })
    expect(readValue('.5')).toMatchObject({ kind: 'dec', T: 5, D: 10 })
    expect(readValue(7)).toMatchObject({ kind: 'int', T: 7 })
    expect(readValue(-0.25)).toMatchObject({ kind: 'dec', T: -25, D: 100 })
    expect(readValue('3/4')).toMatchObject({ kind: 'frac', D: 4, T: 3 })
    expect(readValue('7 / 4')).toMatchObject({ kind: 'frac', D: 4, T: 7 })
    expect(readValue('1 3/4')).toMatchObject({ kind: 'frac', D: 4, T: 7, whole: 1 })
    expect(readValue('-1 1/2')).toMatchObject({ kind: 'frac', D: 2, T: -3 })
    expect(readValue('¾')).toMatchObject({ kind: 'frac', D: 4, T: 3 })
    expect(readValue('2½')).toMatchObject({ kind: 'frac', D: 2, T: 5 })
    expect(readValue('4/2')).toMatchObject({ kind: 'frac', D: 2, T: 4 })
    expect(readValue('0')).toMatchObject({ kind: 'int', T: 0 })
    expect(readValue('-0')).toMatchObject({ T: 0 })
  })

  it('refuses only what is not a number', () => {
    for (const bad of ['', 'abc', '3/0', '1e5', '--3', '3.4.5', null, undefined, {}, [], NaN, Infinity]) expect(readValue(bad)).toBeNull()
  })

  it('keeps the value as plain text that reads back the same', () => {
    for (const v of ['3.47', '-2.5', '3/4', '1 3/4', '-7/5', '-35', '0']) expect(valueKey(readValue(v)!)).toBe(v)
    for (const c of ALL_PLACE) expect(readValue(c.value)!.T).toBe(readValue(valueKey(readValue(c.value)!))!.T)
  })

  it('writes numbers as a school does, with a true minus', () => {
    expect(targetText(readValue('-2.5')!)).toBe('−2.5')
    expect(targetText(readValue('1 3/4')!)).toBe('1 3/4')
    const t = readValue('3.47')!
    expect(fineText(t, 340, 10)).toBe('3.4')
    expect(fineText(t, 340, 1)).toBe('3.40')
    expect(fineText(t, 300, 100)).toBe('3')
    const f = readValue('3/4')!
    expect(fineText(f, 2, 1)).toBe('1/2')
    expect(fineText(f, 4, 1)).toBe('1')
    expect(fineText(f, -6, 1)).toBe('−1 1/2')
  })
})

describe('the ladder of lines', () => {
  it('zooms a decimal to tenths then hundredths, and a fraction to its parts', () => {
    expect(ladderOf(readValue('3.47')!)).toEqual({ steps: [100, 10, 1], A: 0, B: 500 })
    expect(ladderOf(readValue('-2.5')!)).toEqual({ steps: [10, 1], A: -50, B: 50 })
    expect(ladderOf(readValue('3/4')!)).toEqual({ steps: [4, 1], A: 0, B: 20 })
    expect(ladderOf(readValue('-35')!)).toEqual({ steps: [10, 1], A: -50, B: 50 })
    expect(ladderOf(readValue('-3')!)).toEqual({ steps: [1], A: -5, B: 5 })
    expect(ladderOf(readValue('450')!)).toEqual({ steps: [100, 10, 1], A: 0, B: 500 })
  })

  it('opens up the gap under the pin, and never a gap outside the line', () => {
    const c = place('3.47')
    const start = { v: 347, lo: [] as number[] }
    const z1 = zoomIn(c, start)
    expect(z1).toEqual({ v: 347, lo: [300] })
    expect(zoomIn(c, z1)).toEqual({ v: 347, lo: [300, 340] })
    expect(zoomIn(c, zoomIn(c, z1))).toEqual({ v: 347, lo: [300, 340] })
    expect(zoomOut(c, zoomIn(c, z1))).toEqual({ v: 347, lo: [300] })
    // The pin on the right end of the line opens the last gap, not one beyond.
    expect(zoomIn(c, { v: 500, lo: [] }).lo).toEqual([400])
    // Left of zero the gap is the one at or to the left of the pin.
    const n = place('-2.5')
    expect(zoomIn(n, { v: -25, lo: [] }).lo).toEqual([-30])
    expect(zoomIn(n, { v: -30, lo: [] }).lo).toEqual([-30])
    expect(zoomIn(n, { v: -29, lo: [] }).lo).toEqual([-30])
  })

  it('keeps the pin inside the line it is on, and reads any state safely', () => {
    const c = place('3.47')
    const z = zoomIn(c, { v: 347, lo: [] })
    expect(moveTo(c, z, 999).v).toBe(400)
    expect(moveTo(c, z, 0).v).toBe(300)
    for (const junk of [null, undefined, {}, { v: 'x', lo: 'y' }, { v: NaN, lo: [1.5, 7] }, { v: 1e12, lo: [300, 340, 345, 1] }, { lo: [-100] }, { at: 4 }]) {
      const s = readPlace(c, junk as NumberLineState)
      const w = windowAt(ladderOf(readValue(c.value)!), s.lo)
      expect(Number.isInteger(s.v)).toBe(true)
      expect(s.v).toBeGreaterThanOrEqual(w.lo)
      expect(s.v).toBeLessThanOrEqual(w.hi)
    }
  })

  it('is right only on the number’s own tick of the finest line', () => {
    const c = place('3.47')
    expect(done(c, { v: 347, lo: [] })).toBe(false)
    expect(done(c, { v: 347, lo: [300] })).toBe(false)
    expect(done(c, { v: 347, lo: [300, 340] })).toBe(true)
    expect(done(c, { v: 346, lo: [300, 340] })).toBe(false)
    expect(done(c, { v: 347, lo: [300, 350] })).toBe(false)
    expect(done(place('-3'), { v: -3, lo: [] })).toBe(true)
    expect(done(place('-3'), { v: 3, lo: [] })).toBe(false)
    expect(done(place('-2.5'), { v: 25, lo: [300] })).toBe(false)
  })
})

describe('the sums', () => {
  it('lands on start plus amount, or start minus amount', () => {
    expect(landing(jump(-3, 'add', 5))).toBe(2)
    expect(landing(jump(2, 'subtract', -3))).toBe(5)
    expect(landing(jump(2, 'subtract', 7))).toBe(-5)
    expect(landing(jump(-4, 'add', -6))).toBe(-10)
    expect(done(jump(2, 'subtract', -3), { at: 5 })).toBe(true)
    expect(done(jump(2, 'subtract', -3), { at: -1 })).toBe(false)
    expect(done(jump(2, 'subtract', -3), { at: 2 })).toBe(false)
  })

  it('draws the line wide enough for the hop either way, so its width keeps the way secret', () => {
    for (const c of ALL_JUMP) {
      const r = rangeOf(c)
      expect(Math.abs(c.start + c.amount)).toBeLessThanOrEqual(r)
      expect(Math.abs(c.start - c.amount)).toBeLessThanOrEqual(r)
    }
    expect(rangeOf(jump(-3, 'add', 5))).toBe(rangeOf(jump(-3, 'subtract', 5)))
  })
})

describe('reading the tutor’s config', () => {
  it('reads place and jump in many phrasings', () => {
    expect(engine.parse({ task: 'place', value: '3.47' })).toEqual({ task: 'place', value: '3.47' })
    expect(engine.parse({ value: 3.47 })).toEqual({ task: 'place', value: '3.47' })
    expect(engine.parse({ task: 'zoom', number: '−2.5' })).toEqual({ task: 'place', value: '-2.5' })
    expect(engine.parse({ task: 'Plot', target: '1 3/4' })).toEqual({ task: 'place', value: '1 3/4' })
    expect(engine.parse({ task: 'jump', start: -3, op: 'add', amount: 5 })).toEqual({ task: 'jump', start: -3, op: 'add', amount: 5 })
    expect(engine.parse({ task: 'jump', start: '-3', op: '+', amount: '5' })).toEqual({ task: 'jump', start: -3, op: 'add', amount: 5 })
    expect(engine.parse({ task: 'subtract', start: 2, amount: -3 })).toEqual({ task: 'jump', start: 2, op: 'subtract', amount: -3 })
    expect(engine.parse({ task: 'jump', expression: '2 − (−3)' })).toEqual({ task: 'jump', start: 2, op: 'subtract', amount: -3 })
    expect(engine.parse({ expression: '-4 + 6 = 2' })).toEqual({ task: 'jump', start: -4, op: 'add', amount: 6 })
    expect(engine.parse({ start: 5, op: 'minus', amount: 8 })).toEqual({ task: 'jump', start: 5, op: 'subtract', amount: 8 })
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [null, undefined, 'x', 3, [], {}, { task: 'place' }, { task: 'place', value: 'abc' }, { task: 'jump' }, { task: 'jump', start: 2 }, { task: 'juggle' }, { task: 'jump', start: 'a', op: 'add', amount: 1 }]) {
      expect(engine.parse(bad)).toBeNull()
    }
  })

  it('refuses in faults, with a nearby example that works', () => {
    const f = (c: unknown) => engine.faults(engine.parse(c)!)
    expect(f({ task: 'place', value: '3.472' })[0]).toMatch(/decimal places.*value "3\.47"/)
    expect(f({ task: 'place', value: '3/11' })[0]).toMatch(/denominator 11.*value "3\/4"/)
    expect(f({ task: 'place', value: '3/1' })).toEqual([])
    expect(f({ task: 'place', value: '25.5' })[0]).toMatch(/too far from zero.*value "3\.47"/)
    expect(f({ task: 'place', value: '5000' })[0]).toMatch(/too large.*value "-35"/)
    expect(f({ task: 'jump', start: 2, op: 'add', amount: 0 })[0]).toMatch(/does not move.*amount 5/)
    expect(f({ task: 'jump', start: 2, op: 'add', amount: 2.5 })[0]).toMatch(/whole number of steps.*amount 5/)
    expect(f({ task: 'jump', start: 0.5, op: 'add', amount: 2 })[0]).toMatch(/whole number.*start -3/)
    expect(f({ task: 'jump', start: 18, op: 'add', amount: 9 })[0]).toMatch(/20.*start -3, amount 5/)
    expect(f({ task: 'jump', start: -3, op: 'subtract', amount: -5 })).toEqual([])
  })

  it('catches a prompt that gives the answer away or promises what the card does not do', () => {
    const e = (c: NumberLineConfig, p: string) => engine.promptFaults!(c, p)
    expect(e(place('3.47'), 'Drag the pin to 3.47 and zoom in until its tick shows.')).toEqual([])
    expect(e(place('3.47'), 'Place 3.47 on the line.')).toEqual([])
    expect(e(place('3.47'), 'Drag the pin to 3.47: it is between 3 and 4.')[0]).toMatch(/gives the answer away/)
    expect(e(place('3.47'), 'Zoom in to the gap just past 3.4 and put the pin on 3.47.')[0]).toMatch(/gives the answer away/)
    expect(e(place('3.47'), 'Drag the pin to 3.47, halfway between 3.4 and 3.5.')[0]).toMatch(/gives the answer away/)
    expect(e(place('3.47'), 'Drag the pin to 3.47 and say if it is bigger than 3.5.')[0]).toMatch(/promises something/)
    expect(e(place('3.47'), 'Drag the pins to 3.47 and 3.5.')[0]).toMatch(/promises something/)
    expect(e(place('3.47'), 'Round 3.47 to the nearest whole number.').join(' ')).toMatch(/promises something/)
    expect(e(place('3.47'), 'Where is 3.47 on the line?')[0]).toMatch(/does not say what to do/)
    expect(e(jump(-3, 'add', 5), 'Drag the hopper to where −3 + 5 lands.')).toEqual([])
    expect(e(jump(-3, 'add', 5), 'Drag the hopper to −3 + 5 = 2.')[0]).toMatch(/gives the answer away/)
    expect(e(jump(-3, 'add', 5), 'Drag the hopper five to the right of −3.')[0]).toMatch(/gives the answer away/)
    expect(e(jump(2, 'subtract', -3), 'Drag the hopper: subtracting a negative flips the hop.')[0]).toMatch(/gives the answer away/)
    expect(e(jump(2, 'subtract', -3), 'Drag the hopper through three hops.')[0]).toMatch(/promises something/)
    expect(e(jump(2, 'subtract', -3), 'What is 2 − (−3)?')[0]).toMatch(/does not say what to do/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('number-line')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)",\s*\n?\s*"payload": \{ "engine":"number-line", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    const kinds = new Set<string>()
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(c).not.toBeNull()
      expect(e.faults(c)).toEqual([])
      expect(e.promptFaults!(c, m[1])).toEqual([])
      kinds.add((c as NumberLineConfig).task)
    }
    expect([...kinds].sort()).toEqual(['jump', 'place'])
    expect(e.prompt).toContain('"isolates":"position"')
    expect(e.isolates).toBe('position')
  })
})

describe('every card is solvable, and starts unsolved', { timeout: 30_000 }, () => {
  it('every number it can place', () => {
    expect(ALL_PLACE.length).toBeGreaterThan(9000)
    for (const c of ALL_PLACE) {
      const t = readValue(c.value)!
      const l = ladderOf(t)
      const ok = engine.faults(c).length === 0
      expect(ok || Math.abs(t.T) / t.D >= 20 || t.kind === 'int').toBe(true)
      if (!ok) continue
      // The ladder: the number is inside the line, its ticks are whole steps, and the last tick is the finest.
      expect(l.A).toBeLessThanOrEqual(t.T)
      expect(t.T).toBeLessThan(l.B)
      expect(l.steps[lastLevel(l)]).toBe(1)
      for (let k = 1; k < l.steps.length; k++) {
        const r = l.steps[k - 1] / l.steps[k]
        expect(Number.isInteger(r)).toBe(true)
        expect(r).toBeLessThanOrEqual(10)
      }
      expect((l.B - l.A) % l.steps[0]).toBe(0)
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      const s = engine.solve(c)
      expect(engine.check(c, s).ok).toBe(true)
      expect(readPlace(c, s)).toEqual({ v: t.T, lo: s.lo })
      expect(s.lo!.length).toBe(lastLevel(l))
      // Each zoomed window holds the number, and zooming back out leaves the pin where it was.
      let w = windowAt(l, [])
      for (let k = 0; k < s.lo!.length; k++) {
        expect(cellOf(w, t.T)).toBe(s.lo![k])
        w = windowAt(l, s.lo!.slice(0, k + 1))
        expect(w.lo).toBeLessThanOrEqual(t.T)
        expect(t.T).toBeLessThanOrEqual(w.hi)
      }
      expect(zoomOut(c, s).v).toBe(t.T)
    }
  })

  it('every sum it can draw', () => {
    expect(ALL_JUMP.length).toBeGreaterThan(1000)
    for (const c of ALL_JUMP) {
      expect(engine.faults(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok).toBe(true)
      const r = rangeOf(c)
      expect(Math.abs(landing(c))).toBeLessThanOrEqual(r)
      expect(Math.abs(c.start)).toBeLessThanOrEqual(r)
    }
  })

  it('the shown and right states read as marked, whatever the view is given', () => {
    for (const c of [place('3.47'), place('-2.5'), place('3/4'), place('-35'), jump(2, 'subtract', -3)]) {
      expect(working(c, engine.solve(c))).toMatch(/^Yes\. /)
      expect(madeText(c, engine.initial(c)).length).toBeGreaterThan(10)
    }
  })
})

describe('what the card says once marked', () => {
  it('says the path to a number, and the idea behind a sum', () => {
    expect(working(place('3.47'), {})).toBe('Yes. 3.47 sits between 3 and 4, then between 3.4 and 3.5, and then 7 ticks of 0.01 on from 3.40.')
    expect(working(place('3/4'), {})).toBe('Yes. 3/4 sits between 0 and 1, and then 3 ticks of 1/4 on from 0.')
    expect(working(place('-2.5'), {})).toContain('Left of zero the numbers get smaller')
    expect(working(place('-3'), {})).toContain('3 ticks left of zero')
    expect(working(jump(2, 'subtract', -3), { at: 5 })).toBe('Yes. 2 − (−3) = 5. Subtracting a negative hops the other way from subtracting a positive: 3 to the right.')
    expect(working(jump(-3, 'add', 5), { at: 2 })).toContain('Adding 5 hops 5 to the right')
  })

  it('says what the learner made when wrong, and where the pin is when it is not yet zoomed enough', () => {
    expect(madeText(place('3.47'), { v: 346, lo: [300, 340] })).toBe('You put the pin on 3.46.')
    expect(madeText(place('3.47'), { v: 350, lo: [] })).toMatch(/ticks are 1 apart.*0\.01 apart/)
    expect(madeText(jump(2, 'subtract', -3), { at: -1 })).toMatch(/^You hopped 3 left and landed on −1\./)
    expect(madeText(jump(2, 'subtract', -3), { at: 2 })).toMatch(/^You stayed at 2\./)
  })
})

describe('the drawing', () => {
  it('keeps the view’s own copies of the geometry in line with the config', () => {
    expect(X0).toBe(50)
    expect(X1).toBe(334)
    expect(rowCount(place('3.47'))).toBe(ladderOf(readValue('3.47')!).steps.length)
    expect(rowCount(place('3/4'))).toBe(2)
    expect(rowCount(place('-3'))).toBe(1)
    expect(placeHeight(3)).toBeGreaterThan(placeHeight(1))
  })

  it('never crowds the numbers on a line: those with a label stay at least 30px apart', () => {
    for (const c of ALL_PLACE.filter((p) => engine.faults(p).length === 0)) {
      const t = readValue(c.value)!
      const l = ladderOf(t)
      const s = engine.solve(c)
      for (let level = 0; level <= lastLevel(l); level++) {
        const w = windowAt(l, s.lo!.slice(0, level))
        const n = (w.hi - w.lo) / w.step
        expect(n).toBeLessThanOrEqual(level === 0 ? 40 : 10)
        const xs: number[] = []
        for (let i = 0; i <= n; i++) if (labelled(w, i, n)) xs.push(X0 + (i / n) * (X1 - X0))
        expect(xs.length).toBeGreaterThanOrEqual(2)
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(30)
      }
    }
  }, 30_000)
})

describe('the scene on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'number-line', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (c: NumberLineConfig, state: NumberLineState, marked: SceneMarked, reduced = false) =>
    renderToStaticMarkup(createElement(NumberLineView, { config: c, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

  it('is a valid activity, drawn as a line with a pin, a zoom control and every move a real control', () => {
    expect(validateSpec({ pattern: 'scene', prompt: 'Drag the pin to 3.47.', payload: { engine: 'number-line', config: { task: 'place', value: '3.47' } }, success: { kind: 'scene' } })).toBe(true)
    const html = card({ task: 'place', value: '3.47' }, 'Drag the pin to 3.47 and zoom in until its tick shows.')
    expect(html).toContain('role="img"')
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-label="Pin on the number line"')
    expect(html).toContain('aria-label="Zoom in on the shaded gap under the pin"')
    expect(html).toContain('aria-label="Zoom out one line"')
    expect(html).toContain('Find')
    expect(html).toContain('data-target="1"')
    expect(html.match(/<button[^>]*aria-label="Zoom/g)!.length).toBe(2)
    const j = card({ task: 'jump', start: 2, op: 'subtract', amount: -3 }, 'Drag the hopper to where 2 − (−3) lands.')
    expect(j).toContain('aria-label="Hopper on the number line"')
    expect(j).toContain('aria-label="Move the hopper one to the right"')
    expect(j).toContain('2 − (−3)')
  })

  it('shows no answer before it is marked, even to a screen reader', () => {
    const sums = [jump(2, 'subtract', -3), jump(-3, 'add', 5), jump(2, 'subtract', 7)]
    for (const c of sums) {
      const html = view(c, engine.initial(c), 'idle')
      expect(html).not.toMatch(/Yes\.|You hopped|You stayed|lands on|Subtracting a negative|Adding a negative/)
      expect(html).toContain('no hop yet')
      expect(html).not.toContain('data-hop="1"')
      expect(html).toContain(`aria-valuenow="${c.start}"`)
    }
    for (const c of [place('3.47'), place('-2.5'), place('3/4'), place('-35')]) {
      const html = view(c, engine.initial(c), 'idle')
      expect(html).not.toMatch(/Yes\.|You put|sits between|tick of|ticks of|needs ticks/)
      const t = readValue(c.value)!
      expect(html).not.toContain(`aria-valuenow="${t.T}"`)
      expect(html).not.toContain(`Pin on ${targetText(t)},`)
      // Only the learner’s own pin is named, never the number it should be on.
      expect(html).not.toMatch(/data-gap="1"[^>]*>[\s\S]*Yes/)
    }
  })

  it('speaks once marked', () => {
    const c = place('3.47')
    expect(view(c, engine.solve(c), 'right')).toContain('Yes.')
    expect(view(c, {}, 'shown')).toContain('sits between 3 and 4')
    expect(view(c, { v: 346, lo: [300, 340] }, 'wrong')).toContain('You put the pin on 3.46.')
    const j = jump(2, 'subtract', -3)
    expect(view(j, { at: -1 }, 'wrong')).toContain('You hopped 3 left')
    expect(view(j, {}, 'shown')).toContain('= 5')
  })

  it('changes with each move, still, under reduced motion', () => {
    const c = place('3.47')
    const a = view(c, { v: 250, lo: [] }, 'idle', true)
    const b = view(c, { v: 251, lo: [] }, 'idle', true)
    const z = view(c, { v: 250, lo: [200] }, 'idle', true)
    expect(a).not.toEqual(b)
    expect(a).not.toEqual(z)
    expect(a).not.toMatch(/transition:/)
    expect(z).not.toMatch(/transition:/)
    const j = jump(-3, 'add', 5)
    expect(view(j, { at: -3 }, 'idle', true)).not.toEqual(view(j, { at: -2 }, 'idle', true))
    expect(view(j, { at: -2 }, 'idle', true)).toContain('1 right')
  })

  it('stacks one line for each zoom, with a funnel from the gap under the pin to the next', () => {
    const c = place('3.47')
    expect(view(c, { v: 347, lo: [] }, 'idle').match(/data-row=/g)!.length).toBe(1)
    expect(view(c, { v: 347, lo: [300] }, 'idle').match(/data-row=/g)!.length).toBe(2)
    expect(view(c, { v: 347, lo: [300, 340] }, 'idle').match(/data-row=/g)!.length).toBe(3)
    expect(view(c, { v: 347, lo: [300] }, 'idle')).toContain('data-funnel="open"')
    expect(view(c, { v: 347, lo: [300] }, 'idle')).toContain('data-funnel="preview"')
    expect(view(c, { v: 347, lo: [300, 340] }, 'idle')).not.toContain('data-funnel="preview"')
    expect(view(c, { v: 347, lo: [300] }, 'idle')).toContain('×10')
    expect(view(place('-3'), {}, 'idle')).not.toContain('Zoom')
  })
})

describe('the catalogue finds it for its own topics and leaves other stations alone', () => {
  const found = (station: string) => scenesFor(station).some((e) => e.id === 'number-line')
  const offered = (station: string) => sceneCatalogue(station).includes('SCENE "number-line"')

  it('is made for number lines, negative numbers, integers and placing decimals and fractions', () => {
    for (const s of [
      'Integers', 'The number line', 'Negative numbers', 'Adding and subtracting negative numbers: hops on a number line', 'Ordering decimals', 'Decimals',
      'Fractions on a number line', 'Directed numbers', 'Positive and negative numbers in context', 'Ordering integers',
    ]) {
      expect(found(s), s).toBe(true)
      expect(offered(s), s).toBe(true)
    }
  })

  it('is not offered for near misses', () => {
    for (const s of [
      'Straight-line graphs', 'Lines of symmetry', 'Line graphs', 'Line of best fit', 'Parallel lines', 'Time lines of the Cold War', 'Multiplying decimals', 'Dividing decimals', 'Adding and subtracting decimals',
      'Recurring decimals', 'Decimal places and significant figures', 'Rounding decimals', 'Inequalities on a number line', 'Double number lines and ratio', 'Data types: integers and floats', 'Integer overflow',
      'Negative feedback loops', 'Negative correlation', 'Negative indices', 'Neural networks', 'Place value', 'Fractions of an amount', 'Percentages', 'Ratio and proportion', 'Prime numbers', 'Number patterns',
      'Standard form', 'The decimal system in money', 'Changes of state', 'Electric circuits', 'Photosynthesis',
    ]) {
      expect(found(s), s).toBe(false)
      expect(offered(s), s).toBe(false)
    }
  })

  it('stays out of the way of its neighbours', () => {
    // Place value belongs to counters-place-value and parts of a whole to bar-model: neither station should be told this one is made for it.
    for (const s of ['Place value', 'Tens and ones', 'Bar models', 'Equivalent fractions']) expect(found(s), s).toBe(false)
  })
})
