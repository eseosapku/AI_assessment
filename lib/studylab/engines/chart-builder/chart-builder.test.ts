// lib/studylab/engines/chart-builder/chart-builder.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  chartBuilderEngine as engine, BASE_Y, CAP, FORMS, H, MAX_TITLE, NAME_Y, PIC_CAP, PIC_CELL, PIC_DIVIDE, PIC_KEY_H, PIC_KEYS, PIC_ROW_H, PIC_SYMBOLS, PIC_X0, RULE_Y, SCALES, SQ, SYMBOLS, TABLE_END, TOP_Y, VALUE_Y, W, X0, X1,
  answerScale, barWidth, bestKey, bestScale, check, colCentre, colWidth, halfAt, heightsOf, honestPlan, honestStarts, madeText, maxLabel, paperOf, picHeight, pictogramOf, shownValue, squareAt, startScale, targetOf, working,
  type ChartConfig, type ChartState,
} from './config'
import { BASE, CAP_PX, PIC_CELL_PX, PIC_DIVIDE_PX, PIC_KEY_H_PX, PIC_ROW_H_PX, PIC_SLOT_COUNT, PIC_X0_PX, NAME_Y_PX, RULE_Y_PX, SQ_PX, TABLE_END_PX, TOP, VALUE_Y_PX, VH, VW, X0_PX, X1_PX } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const parse = (raw: unknown) => engine.parse(raw)!
const rows = (...pairs: [string, number][]) => pairs.map(([label, value]) => ({ label, value }))
const BAR = parse({ task: 'build', form: 'bar', unit: 'pupils', data: [['Cats', 15], ['Dogs', 35], ['Fish', 25], ['Birds', 10]] })
const LINE = parse({ task: 'build', form: 'line', unit: 'visitors', data: [['Mon', 20], ['Tue', 50], ['Wed', 30], ['Thu', 60], ['Fri', 40]] })
const PIC = parse({ task: 'build', form: 'pictogram', symbol: 'person', unit: 'pupils', data: [['Bus', 12], ['Walk', 7], ['Car', 6], ['Bike', 4]] })
const SCALE = parse({ task: 'scale', unit: 'goals', data: [['Ana', 15], ['Ben', 35], ['Cai', 25], ['Dee', 40]] })
const HONEST = parse({ task: 'honest', unit: 'pupils', data: [['Shop A', 36], ['Shop B', 39], ['Shop C', 37]] })

// ---------------------------------------------------------------------------
// Every valid config, or as many as a seeded random walk finds: the property test runs over all of them.

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const NAMES = ['Cats', 'Dogs', 'Fish', 'Birds', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Bus', 'Walk', 'Car', 'Bike', 'Red', 'Blue', 'Tea', 'Milk', 'Jan', 'Feb']
function generated(): ChartConfig[] {
  const r = rng(7)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
  const out: ChartConfig[] = []
  for (let i = 0; i < 900; i++) {
    const task = pick(['build', 'build', 'build', 'scale', 'honest'] as const)
    const n = 2 + Math.floor(r() * 7)
    const names = [...NAMES].sort(() => r() - 0.5).slice(0, n)
    let data: [string, number][]
    let extra: Record<string, unknown> = {}
    if (task === 'honest') {
      const lo = 11 + Math.floor(r() * 80)
      data = names.map((l) => [l, lo + Math.floor(r() * (lo + 1))])
    } else if (task === 'build' && r() < 0.35) {
      const key = pick(PIC_KEYS)
      data = names.map((l) => [l, (Math.floor(r() * (PIC_CAP + 1)) * key) / 2])
      extra = { form: 'pictogram', symbol: pick(SYMBOLS), ...(r() < 0.4 ? { key } : {}) }
    } else {
      const s = pick(SCALES)
      data = names.map((l) => [l, Math.floor(r() * (CAP + 1)) * s])
      extra = task === 'build' ? { form: pick(['bar', 'line'] as const), ...(r() < 0.3 ? { scale: s } : {}) } : {}
    }
    const cfg = engine.parse({ task, data, unit: r() < 0.5 ? 'pupils' : '', ...extra })
    if (cfg && engine.faults(cfg).length === 0) out.push(cfg)
  }
  return out
}
const ALL = generated()
const hand = [BAR, LINE, PIC, SCALE, HONEST]

describe('the rules, from first principles', () => {
  it('the best scale is the smallest that divides every value with the tallest bar on ten squares', () => {
    expect(bestScale([15, 35, 25, 40])).toBe(5)
    expect(bestScale([20, 50, 30, 60, 40])).toBe(10)
    expect(bestScale([10, 6, 4, 8])).toBe(1)
    expect(bestScale([100, 200, 300])).toBe(50)
    expect(bestScale([13, 27, 41])).toBeNull()
    for (const vals of [[5, 10], [12, 16, 24], [250, 500, 750], [1200, 800, 400]]) {
      const s = bestScale(vals)!
      expect(vals.every((v) => v % s === 0)).toBe(true)
      expect(Math.max(...vals) / s).toBeLessThanOrEqual(CAP)
      // Nothing smaller in the list does it.
      for (const t of SCALES.filter((x) => x < s)) expect(vals.every((v) => v % t === 0) && Math.max(...vals) / t <= CAP).toBe(false)
    }
  })

  it('a pictogram row is twice its value over the key, in halves', () => {
    expect(bestKey([12, 8, 6, 4])).toBe(2)
    expect(pictogramOf(PIC, {}).key).toBe(2)
    expect(pictogramOf(PIC, {}).target).toEqual([12, 7, 6, 4])
    expect(pictogramOf(parse({ task: 'build', form: 'pictogram', key: 10, data: [['A', 50], ['B', 25], ['C', 15]] }), {}).target).toEqual([10, 5, 3])
    expect(bestKey([13, 8, 60])).toBeNull()
  })

  it('the honest paper starts one step below the smallest value and ends at the next ten above the largest', () => {
    expect(honestPlan([36, 39, 37])).toEqual({ top: 40, start0: 30 })
    expect(honestPlan([40, 45])).toEqual({ top: 50, start0: 30 })
    expect(honestStarts([36, 39])).toEqual([0, 10, 20, 30])
  })

  it('a bar is value over what a square is worth, exactly', () => {
    expect(paperOf(BAR, { v: [3, 7, 5, 2] }).each).toBe(5)
    expect(targetOf(BAR)).toEqual([3, 7, 5, 2])
    expect(targetOf(LINE)).toEqual([2, 5, 3, 6, 4])
    expect(paperOf(SCALE, { each: 5 }).heights).toEqual([3, 7, 5, 8])
    expect(paperOf(SCALE, { each: 10 }).heights).toEqual([1.5, 3.5, 2.5, 4])
    expect(paperOf(HONEST, { start: 0 }).heights.map((h) => Math.round(h * 100) / 100)).toEqual([9, 9.75, 9.25])
    expect(paperOf(HONEST, { start: 30 }).heights).toEqual([6, 9, 7])
    expect(paperOf(HONEST, { start: 30 }).labels).toEqual([30, 32, 34, 36, 38, 40])
    expect(paperOf(BAR, {}).labels).toEqual([0, 10, 20, 30, 40, 50])
  })

  it('marks a bar only at its exact height, and says which are wrong', () => {
    expect(check(BAR, { v: [3, 7, 5, 2] })).toEqual({ ok: true, wrongIds: [] })
    expect(check(BAR, { v: [3, 7, 4, 2] })).toEqual({ ok: false, wrongIds: ['2'] })
    expect(check(BAR, { v: [3, 7, 5, 3] }).ok).toBe(false)
    expect(check(PIC, { v: [12, 7, 6, 4] }).ok).toBe(true)
    expect(check(PIC, { v: [12, 6, 6, 4] }).wrongIds).toEqual(['1'])
  })

  it('marks the scale only at the best one: too fine runs off the paper, too coarse wastes it, a non-factor misses a line', () => {
    expect(check(SCALE, { each: 5 }).ok).toBe(true)
    for (const e of [1, 2, 10, 20, 25, 50]) expect(check(SCALE, { each: e }).ok, `each ${e}`).toBe(false)
    expect(madeText(SCALE, { each: 2 })).toMatch(/runs off the top/)
    expect(madeText(SCALE, { each: 25 })).toMatch(/between two lines/)
    expect(madeText(SCALE, { each: 10 })).toMatch(/between two lines/)
    const even = parse({ task: 'scale', data: [['A', 20], ['B', 40], ['C', 60], ['D', 80]] })
    expect(answerScale(even)).toBe(10)
    expect(madeText(even, { each: 20 })).toMatch(/fills only 4 of the 10/)
  })

  it('marks the honest chart only when the axis starts at zero', () => {
    for (const s of [0, 10, 20, 30]) expect(check(HONEST, { start: s }).ok).toBe(s === 0)
    expect(madeText(HONEST, { start: 30 })).toMatch(/axis starts at 30/)
    expect(working(HONEST, { start: 0 })).toMatch(/1\.1 times/)
  })

  it('reads a state safely: junk counts for nothing', () => {
    expect(heightsOf(BAR, { v: [99, -4, 2.4, NaN] })).toEqual([10, 0, 2, 0])
    expect(heightsOf(BAR, {} as never)).toEqual([0, 0, 0, 0])
    expect(heightsOf(PIC, { v: [99, 1, 2, 3] })).toEqual([16, 1, 2, 3])
    expect(paperOf(SCALE, { each: 7 }).each).toBe(startScale(SCALE))
    expect(paperOf(HONEST, { start: 25 }).start).toBe(30)
  })
})

describe('reading the tutor’s config broadly', () => {
  it('takes the task and the form under many names, in either place', () => {
    const data = [['A', 10], ['B', 20], ['C', 30]]
    expect(parse({ task: 'build', form: 'line', data })).toMatchObject({ task: 'build', form: 'line' })
    expect(parse({ task: 'line graph', data })).toMatchObject({ task: 'build', form: 'line' })
    expect(parse({ chart: 'Bar chart', data })).toMatchObject({ task: 'build', form: 'bar' })
    expect(parse({ type: 'pictogram', data })).toMatchObject({ task: 'build', form: 'pictogram' })
    expect(parse({ task: 'choose a scale', data })).toMatchObject({ task: 'scale' })
    expect(parse({ task: 'misleading graph', data })).toMatchObject({ task: 'honest' })
    expect(parse({ task: { kind: 'honest' }, data })).toMatchObject({ task: 'honest' })
    expect(parse({ task: { kind: 'build', form: 'pictogram', symbol: 'apples' }, data })).toMatchObject({ task: 'build', form: 'pictogram', symbol: 'apple' })
    expect(parse({ data })).toMatchObject({ task: 'build', form: 'bar' })
  })

  it('takes the data as rows, pairs, a map, lists or text', () => {
    const want = [{ label: 'Cats', value: 12 }, { label: 'Dogs', value: 7 }]
    expect(parse({ data: [{ label: 'Cats', value: 12 }, { label: 'Dogs', value: 7 }] }).data).toEqual(want)
    expect(parse({ data: [{ name: 'Cats', count: '12' }, { name: 'Dogs', frequency: 7 }] }).data).toEqual(want)
    expect(parse({ data: [['Cats', 12], ['Dogs', '7']] }).data).toEqual(want)
    expect(parse({ data: { Cats: 12, Dogs: 7 } }).data).toEqual(want)
    expect(parse({ data: { labels: ['Cats', 'Dogs'], values: [12, 7] } }).data).toEqual(want)
    expect(parse({ labels: ['Cats', 'Dogs'], values: [12, 7] }).data).toEqual(want)
    expect(parse({ data: 'Cats: 12, Dogs: 7' }).data).toEqual(want)
    expect(parse({ table: [{ x: 2019, y: 4 }] }).data).toEqual([{ label: '2019', value: 4 }])
  })

  it('refuses only what cannot be read at all', () => {
    for (const raw of [null, 'x', 7, {}, { data: [] }, { data: 'nothing here' }, { data: [{ label: 'A' }] }, { data: [['A', 'many']] }]) expect(engine.parse(raw)).toBeNull()
  })

  it('faults what it reads but cannot draw, with something that works', () => {
    const f = (raw: unknown) => engine.faults(parse(raw)).join(' | ')
    expect(f({ task: 'build', form: 'pie', data: [['A', 1], ['B', 9], ['C', 5]] })).toMatch(/no "pie" chart.*bar, line or pictogram/)
    expect(f({ task: 'frequency', data: [['A', 1], ['B', 9], ['C', 5]] })).toMatch(/no "frequency" task.*build, scale or honest/)
    expect(f({ data: [['A', 10], ['B', 20]] })).toMatch(/2 rows of data is outside.*3 to 6.*e\.g\. data/)
    expect(f({ data: [['A', 10], ['B', 20], ['C', 30], ['D', 1], ['E', 2], ['F', 3], ['G', 4]] })).toMatch(/7 rows/)
    expect(f({ data: [['A', 10], ['B', 2.5], ['C', 30]] })).toMatch(/whole numbers.*B is 2\.5/)
    expect(f({ data: [['A', 10], ['B', -2], ['C', 30]] })).toMatch(/whole numbers/)
    expect(f({ data: [['A', 13], ['B', 27], ['C', 41]] })).toMatch(/No scale on the paper.*like 15, 25, 40/)
    expect(f({ task: 'scale', data: [['A', 13], ['B', 27], ['C', 41]] })).toMatch(/No scale on the paper/)
    expect(f({ data: [['A', 1], ['B', 2], ['C', 3]] })).toMatch(/at least 5/)
    expect(f({ data: [['A', 10], ['B', 0], ['C', 0]] })).toMatch(/two rows need a value above 0/)
    expect(f({ data: [['Wednesday', 10], ['Thursday', 20], ['Friday', 30], ['Saturday', 20], ['Sunday', 5], ['Monday', 8]] })).toMatch(/too long.*6 characters at most/)
    expect(f({ data: [['A', 10], ['a', 20], ['C', 30]] })).toMatch(/share a name/)
    expect(f({ unit: 'a very long unit name', data: [['A', 10], ['B', 20], ['C', 30]] })).toMatch(/unit.*12 characters/)
    expect(f({ title: 'x'.repeat(MAX_TITLE + 1), data: [['A', 10], ['B', 20], ['C', 30]] })).toMatch(/title/)
    expect(f({ scale: 4, data: [['A', 10], ['B', 20], ['C', 30]] })).toMatch(/end between two lines/)
    expect(f({ scale: 1, data: [['A', 10], ['B', 20], ['C', 30]] })).toMatch(/needs 30 squares/)
    expect(f({ scale: 50, data: [['A', 10], ['B', 20], ['C', 30]] })).toMatch(/\bscale|smaller/)
    expect(f({ scale: 10, data: [['A', 10], ['B', 20], ['C', 30]] })).toBe('')
    expect(f({ task: 'scale', form: 'line', data: [['A', 10], ['B', 20], ['C', 30]] })).toMatch(/bars only/)
    expect(f({ task: 'build', form: 'pictogram', symbol: 'dragon', data: [['A', 10], ['B', 20], ['C', 30]] })).toMatch(/no "dragon" symbol/)
    expect(f({ task: 'build', form: 'pictogram', key: 7, data: [['A', 10], ['B', 20], ['C', 30]] })).toMatch(/key of 7 cannot show/)
    expect(f({ task: 'build', form: 'pictogram', key: 2, data: [['A', 10], ['B', 20], ['C', 40]] })).toMatch(/more than a row holds/)
    expect(f({ task: 'build', form: 'pictogram', data: [['A', 13], ['B', 20], ['C', 40]] })).toMatch(/No key lets/)
    expect(f({ task: 'honest', data: [['A', 8], ['B', 9]] })).toMatch(/above 10/)
    expect(f({ task: 'honest', data: [['A', 20], ['B', 60]] })).toMatch(/within twice/)
    expect(f({ task: 'honest', data: [['A', 36]] })).toMatch(/1 row of data is outside.*2 to 6/)
  })
})

describe('every valid config, as the property test finds them', { timeout: 30_000 }, () => {
  it('finds a large and varied set of valid configs', () => {
    const all = [...hand, ...ALL]
    expect(ALL.length).toBeGreaterThanOrEqual(300)
    for (const task of ['build', 'scale', 'honest']) expect(all.filter((c) => c.task === task).length, task).toBeGreaterThan(20)
    for (const form of FORMS) expect(all.filter((c) => c.task === 'build' && c.form === form).length, form).toBeGreaterThan(20)
    for (const s of SYMBOLS) expect(all.some((c) => c.symbol === s && c.form === 'pictogram'), s).toBe(true)
  })

  it('starts unsolved, and its own solution passes', () => {
    for (const c of [...hand, ...ALL]) {
      const name = JSON.stringify(c)
      expect(engine.check(c, engine.initial(c)).ok, `initial ${name}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${name}`).toBe(true)
    }
  })

  it('every bar of the solution is a whole number of squares on the paper, and every row a whole number of halves', () => {
    for (const c of [...hand, ...ALL].filter((x) => x.task === 'build')) {
      const t = targetOf(c)
      const cap = c.form === 'pictogram' ? PIC_CAP : CAP
      t.forEach((h, i) => {
        expect(Number.isInteger(h)).toBe(true)
        expect(h).toBeGreaterThanOrEqual(0)
        expect(h).toBeLessThanOrEqual(cap)
        // The value is recovered exactly from the height.
        expect(shownValue(c, { v: t }, i)).toBe(c.data[i].value)
      })
    }
  })

  it('one wrong bar fails and names itself; a scale or start next to the answer fails', () => {
    for (const c of [...hand, ...ALL]) {
      if (c.task === 'build') {
        const t = targetOf(c)
        const cap = c.form === 'pictogram' ? PIC_CAP : CAP
        const i = t.findIndex((h) => h > 0)
        const off = t.slice()
        off[i] = off[i] > 0 ? off[i] - 1 : Math.min(cap, off[i] + 1)
        const r = check(c, { v: off })
        expect(r.ok).toBe(false)
        expect(r.wrongIds).toEqual([String(i)])
        expect(madeText(c, { v: off })).toMatch(/not yet/)
      } else if (c.task === 'scale') {
        const a = answerScale(c)
        for (const e of SCALES.filter((x) => x !== a)) expect(check(c, { each: e }).ok).toBe(false)
        for (const e of SCALES) expect(madeText(c, { each: e }).length).toBeGreaterThan(10)
      } else {
        for (const s of honestStarts(c.data.map((r) => r.value))) expect(check(c, { start: s }).ok).toBe(s === 0)
      }
    }
  })

  it('the scale task opens one step too coarse, so there is something to do', () => {
    for (const c of ALL.filter((x) => x.task === 'scale')) {
      expect(startScale(c)).not.toBe(answerScale(c))
      expect(paperOf(c, engine.initial(c)).each).toBe(startScale(c))
    }
  })

  it('every valid config passes its own promptFaults with the prompt the engine would write', () => {
    for (const c of [...hand, ...ALL]) {
      const prompts = {
        build: c.form === 'line' ? 'Drag each point up to its value in the table, reading the scale on the axis.' : c.form === 'pictogram' ? 'Drag the end of each row along to show its number in the table, using the key.' : 'Drag the top of each bar up to its value in the table, reading the scale on the axis.',
        scale: 'Use the plus and minus to choose how much each square is worth, so the chart is as tall as the paper allows and every bar ends exactly on a line.',
        honest: 'Use the plus and minus to move where the axis starts, so the bars show the numbers fairly.',
      }
      expect(engine.promptFaults!(c, prompts[c.task]), JSON.stringify(c)).toEqual([])
    }
  })
})

describe('what the prompt may say', () => {
  const faults = (c: ChartConfig, p: string) => engine.promptFaults!(c, p).join(' | ')
  it('must say the gesture', () => {
    expect(faults(BAR, 'Make the bar chart from the table.')).toMatch(/does not say what to do/)
    expect(faults(SCALE, 'Make the chart fit.')).toMatch(/does not say what to do/)
    expect(faults(BAR, 'Drag the top of each bar to its value.')).toBe('')
  })
  it('never gives the scale away', () => {
    for (const p of ['Choose the scale: each square is worth 5, so every bar ends on a line.', 'Use a scale of 5.', 'Count in fives and choose the scale.', 'Choose a scale so the tallest bar is 8 squares tall.', 'Choose the scale that divides every value.']) {
      expect(faults(SCALE, p), p).toMatch(/gives the answer away/)
    }
    expect(faults(SCALE, 'Choose how much each square is worth, so the chart fits the paper.')).toBe('')
  })
  it('never says where an honest axis should start', () => {
    for (const p of ['Move the axis so it starts at zero.', 'Change where the axis starts: it should start from 0.', 'Use plus and minus to put the baseline at the bottom.', 'Change the truncated axis.', 'Move the axis to the bottom of the bars.']) {
      expect(faults(HONEST, p), p).toMatch(/gives the answer away/)
    }
    expect(faults(HONEST, 'Use plus and minus to change where the axis starts, so the bars are fair.')).toBe('')
  })
  it('never promises what the card does not do or ask', () => {
    expect(faults(BAR, 'Drag each bar up and colour it in.')).toMatch(/promises something/)
    expect(faults(BAR, 'Drag each bar up, then draw a pie chart.')).toMatch(/promises something/)
    expect(faults(BAR, 'Drag each bar up, then say which is the tallest.')).toMatch(/asks a question/)
    expect(faults(SCALE, 'Drag the bars to fit the scale.')).toMatch(/promises a drag/)
  })
  it('must name the chart the card draws', () => {
    expect(faults(BAR, 'Drag each point up to its value.')).toMatch(/different chart/)
    expect(faults(LINE, 'Drag each bar up to its value.')).toMatch(/different chart/)
    expect(faults(PIC, 'Drag each bar along to its value.')).toMatch(/different chart/)
    expect(faults(PIC, 'Drag the end of each row along, using the key.')).toBe('')
    expect(faults(SCALE, 'Choose the scale for the points.')).toMatch(/different chart/)
  })
  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('chart-builder')!
    const lines = e.prompt.split('\n').filter((l) => l.trim().startsWith('{ "type":"createActivity"'))
    expect(lines.length).toBeGreaterThanOrEqual(4)
    const kinds = new Set<string>()
    for (const l of lines) {
      const ex = JSON.parse(l)
      const c = e.parse(ex.spec.payload.config)!
      expect(c, l).not.toBeNull()
      expect(e.faults(c), l).toEqual([])
      expect(e.promptFaults!(c, ex.spec.prompt), l).toEqual([])
      expect(ex.intent.isolates).toBe(e.isolates)
      expect(ex.spec.payload.engine).toBe('chart-builder')
      kinds.add(`${(c as ChartConfig).task}-${(c as ChartConfig).form}`)
    }
    expect(kinds.size).toBeGreaterThanOrEqual(4)
    // Every config line in the entry parses too, and its quoted prompt passes.
    const found = [...e.prompt.matchAll(/(\{ "task":[^\n]*?\})\s+-- (?:the prompt says )?"([^"]+)"/g)]
    expect(found.length).toBeGreaterThanOrEqual(4)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[1]))!
      expect(e.faults(c), m[1]).toEqual([])
      expect(e.promptFaults!(c, m[2]), m[1]).toEqual([])
    }
  })
})

describe('the catalogue: offered to the right stations and no others', () => {
  const offered = (s: string) => scenesFor(s).some((e) => e.id === 'chart-builder')
  it('is registered, with its config in its entry', () => {
    expect(getEngine('chart-builder')).toBe(engine)
    expect(engine.prompt).toMatch(/"engine":"chart-builder"/)
    expect(engine.isolates).toBe('magnitude')
  })
  it('is offered where charts are drawn from tables', () => {
    for (const s of ['Bar charts', 'Pictograms', 'Drawing line graphs', 'Introduction to Data Handling', 'Choosing a scale for a graph', 'Bar charts and pictograms: drawing from a frequency table', 'Misleading graphs', 'Representing data', 'Tally charts and frequency tables', 'Interpreting graphs and charts', 'Presenting results']) {
      expect(offered(s), s).toBe(true)
      expect(sceneCatalogue(s)).toMatch(/SCENE "chart-builder"/)
    }
  })
  it('is not offered where chart, graph or table mean something else', () => {
    for (const s of ['Flow charts', 'Flowcharts and algorithms', 'The periodic table', 'Truth tables', 'Times tables', 'Multiplication tables', 'Straight-line graphs', 'Distance-time graphs', 'Velocity-time graphs', 'Histograms', 'Scatter graphs and correlation', 'Cumulative frequency', 'Box plots', 'Gantt charts', 'Graph theory', 'Supply and demand graphs', 'Quadratic graphs', 'Real-life graphs', 'Organisation charts', 'Sketching graphs', 'The mean, median and mode', 'Coordinates and graphs of functions', 'Pie charts', 'Charts of the elements', 'A table of results for the experiment']) {
      expect(offered(s), s).toBe(false)
      expect(sceneCatalogue(s)).not.toMatch(/SCENE "chart-builder"/)
    }
  })
})

describe('the drawing', () => {
  const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

  it('the view’s literals agree with the config’s constants', () => {
    expect([VW, VH, SQ_PX, X0_PX, X1_PX, BASE, TOP, CAP_PX]).toEqual([W, H, SQ, X0, X1, BASE_Y, TOP_Y, CAP])
    expect([PIC_X0_PX, PIC_CELL_PX, PIC_KEY_H_PX, PIC_ROW_H_PX, PIC_DIVIDE_PX, PIC_SLOT_COUNT]).toEqual([PIC_X0, PIC_CELL, PIC_KEY_H, PIC_ROW_H, PIC_DIVIDE, PIC_SYMBOLS])
    expect([NAME_Y_PX, RULE_Y_PX, VALUE_Y_PX, TABLE_END_PX]).toEqual([NAME_Y, RULE_Y, VALUE_Y, TABLE_END])
    // The paper is whole squares across, and the axis sits on a grid line.
    expect(W % SQ).toBe(0)
    expect(X0 % SQ).toBe(0)
    expect(BASE_Y % SQ).toBe(0)
    expect(TOP_Y + CAP * SQ).toBe(BASE_Y)
  })

  it('reads no config constant at the top of the view (a crash on every lesson page)', () => {
    const view = read('View.tsx')
    const top = view.split('\n').filter((l) => /^(?:export )?const \w+\s*=/.test(l)).join('\n')
    for (const name of ['SCALES', 'PIC_KEYS', 'CAP', 'SQ', 'BASE_Y', 'TOP_Y', 'X0', 'X1', 'W', 'H']) expect(top).not.toMatch(new RegExp(`=\\s*${name}\\b`))
    expect(view).not.toMatch(/\.toString\(\)\s*,\s*\[/)
  })

  it('every name sits in its own column, on one line, nearer its own bar than any other', () => {
    for (const c of [...hand, ...ALL].filter((x) => x.form !== 'pictogram' || x.task !== 'build')) {
      const n = c.data.length
      for (let i = 0; i < n; i++) {
        const cx = colCentre(n, i)
        expect(cx).toBeGreaterThan(X0 + colWidth(n) * i)
        expect(cx).toBeLessThan(X0 + colWidth(n) * (i + 1))
        const wide = [...c.data[i].label].length * 7.2
        expect(wide, `${c.data[i].label} in ${n}`).toBeLessThanOrEqual(colWidth(n))
        expect(barWidth(n)).toBeLessThanOrEqual(colWidth(n) - 6)
      }
      expect(Math.min(...c.data.map((r) => maxLabel('bar', n) - [...r.label].length))).toBeGreaterThanOrEqual(0)
    }
    expect(maxLabel('bar', 6)).toBe(6)
    expect(maxLabel('pictogram', 5)).toBe(9)
    // A pictogram's longest row ends before its number.
    expect(PIC_X0 + PIC_SYMBOLS * PIC_CELL).toBeLessThan(PIC_DIVIDE)
    expect(picHeight(5)).toBeLessThan(H)
  })

  it('a touch maps to the nearest square or half symbol, and stays on the paper', () => {
    expect(squareAt(BASE_Y)).toBe(0)
    expect(squareAt(BASE_Y - SQ)).toBe(1)
    expect(squareAt(BASE_Y - 3.4 * SQ)).toBe(3)
    expect(squareAt(BASE_Y - 3.6 * SQ)).toBe(4)
    expect(squareAt(-500)).toBe(CAP)
    expect(squareAt(5000)).toBe(0)
    expect(halfAt(PIC_X0)).toBe(0)
    expect(halfAt(PIC_X0 + PIC_CELL)).toBe(2)
    expect(halfAt(PIC_X0 + 1.4 * PIC_CELL)).toBe(3)
    expect(halfAt(9999)).toBe(PIC_CAP)
    expect(halfAt(-5)).toBe(0)
  })

  const card = (config: unknown, prompt = 'Drag the top of each bar up to its value in the table, reading the scale on the axis.') =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'chart-builder', config }, success: { kind: 'scene' } } },
    } as never)))
  const cfg = (c: ChartConfig) => ({ task: c.task, form: c.form, unit: c.unit, symbol: c.symbol, data: c.data.map((r) => [r.label, r.value]) })

  it('draws the table, the paper and a handle on every bar that the keyboard can move', () => {
    const html = card(cfg(BAR))
    for (const r of BAR.data) expect(html).toContain(`>${r.value}</text>`)
    expect(html.match(/role="slider"/g)).toHaveLength(4)
    expect(html).toMatch(/aria-valuenow="0"/)
    expect(html).toMatch(/touch-none/)
    expect(html.match(/data-grip="1"/g)).toHaveLength(4)
    const pic = card(cfg(PIC), 'Drag the end of each row along to show its number in the table, using the key.')
    expect(pic).toMatch(/data-key="1"/)
    expect(pic).toMatch(/= 2 pupils/)
    expect(pic.match(/role="slider"/g)).toHaveLength(4)
  })

  it('holds back every answer until marking: no scale, height, start or verdict in the page', () => {
    const bar = card(cfg(BAR))
    expect(bar).not.toMatch(/Yes\.|not yet|table&#x27;s value|should|correct|wrong/i)
    // The answer scale and the answer heights are never printed: only the axis labels (which follow from the scale) are.
    const scale = card(cfg(SCALE), 'Use the plus and minus to choose how much each square is worth, so the chart is as tall as the paper allows and every bar ends exactly on a line.')
    expect(scale).toMatch(/Each square is worth/)
    expect(scale).not.toMatch(/Yes\.|runs off|between two lines|fills only|best|smallest scale/i)
    expect(scale).toMatch(/aria-valuetext="10"/)
    expect(scale).not.toMatch(/aria-valuetext="5"/)
    const honest = card(cfg(HONEST), 'Use the plus and minus to move where the axis starts, so the bars show the numbers fairly.')
    expect(honest).toMatch(/aria-valuetext="30"/)
    expect(honest).not.toMatch(/zero|Yes\.|honest|fair(?!ly)|misleading|(?<!dominant-)baseline|truncat/i)
    // Nothing the screen reader reads says what the answer is.
    for (const html of [bar, scale, honest]) {
      expect(html).not.toMatch(/aria-label="[^"]*(?:correct|wrong|right|answer)/i)
    }
  })

  it('shows the verdict and the reason once marked, and the drawing keeps its bars', () => {
    const solved = (c: ChartConfig, marked: 'right' | 'wrong' | 'shown', state?: ChartState) =>
      renderToStaticMarkup(createElement(engine.View, { config: c, state: state ?? engine.solve(c), setState: () => {}, marked, reduced: true, locked: marked === 'right' }))
    expect(solved(BAR, 'right')).toMatch(/Yes\. Each square is worth 5/)
    expect(solved(SCALE, 'right')).toMatch(/Yes\. With each square worth 5/)
    expect(solved(HONEST, 'right')).toMatch(/Yes\. Starting the axis at 0/)
    expect(solved(PIC, 'right')).toMatch(/Each symbol stands for 2 pupils/)
    expect(solved(LINE, 'right')).toMatch(/Every point is at the height/)
    const wrong = solved(BAR, 'wrong', { v: [3, 7, 4, 0] })
    expect(wrong).toMatch(/Fish and Birds are not yet at the table&#x27;s value\./)
    expect(wrong).toMatch(/Your Fish bar shows 20 pupils; the table says 25\./)
    expect(wrong.match(/data-wrong="/g)).toHaveLength(2)
    expect(solved(HONEST, 'wrong', { start: 20 })).toMatch(/The axis starts at 20/)
    // A solved board that is shown draws the solution whatever state it holds.
    expect(solved(BAR, 'shown', { v: [0, 0, 0, 0] })).toMatch(/data-height="7"/)
    // Locked and finished: no handle left to move.
    expect(solved(BAR, 'right')).not.toMatch(/data-grip/)
    expect(solved(HONEST, 'right')).toMatch(/aria-disabled="true"/)
  })

  it('the smallest move changes the picture: a bar one square taller is a taller rect', () => {
    const heightsIn = (v: number[]) => [...renderToStaticMarkup(createElement(engine.View, { config: BAR, state: { v }, setState: () => {}, marked: 'idle', reduced: true, locked: false })).matchAll(/data-height="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(heightsIn([0, 0, 0, 0])).toEqual([0, 0, 0, 0])
    expect(heightsIn([1, 0, 0, 0])).toEqual([1, 0, 0, 0])
    expect(heightsIn([3, 7, 5, 2])).toEqual([3, 7, 5, 2])
    const pic = (v: number[]) => (renderToStaticMarkup(createElement(engine.View, { config: PIC, state: { v }, setState: () => {}, marked: 'idle', reduced: true, locked: false })).match(/<path d="M3\.2 22\.5/g) ?? []).length
    expect(pic([0, 0, 0, 0]) + 0).toBeLessThan(pic([2, 0, 0, 0]))
    expect(pic([2, 0, 0, 0])).toBeLessThan(pic([4, 0, 0, 0]))
  })

  it('a bar taller than the paper runs off the top with a break mark, and stays inside the plate', () => {
    const html = renderToStaticMarkup(createElement(engine.View, { config: SCALE, state: { each: 2 }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(html.match(/data-break="1"/g)).toHaveLength(3)
    for (const m of html.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="\d+" height="([\d.]+)"[^>]*data-height/g)) {
      expect(Number(m[1])).toBeGreaterThanOrEqual(TOP_Y - 0.01)
      expect(Number(m[1]) + Number(m[2])).toBeLessThanOrEqual(BASE_Y + 0.01)
    }
  })

  it('does not animate position or scale under reduced motion', () => {
    const html = (reduced: boolean) => renderToStaticMarkup(createElement(engine.View, { config: SCALE, state: { each: 5 }, setState: () => {}, marked: 'idle', reduced, locked: false }))
    expect(html(false)).toMatch(/transition:y 700ms/)
    expect(html(true)).not.toMatch(/transition:y/)
  })

  it('never draws text under 12 px or splits a word', () => {
    const view = read('View.tsx')
    for (const m of view.matchAll(/fontSize=\{(\d+)\}/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    for (const m of view.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    expect(view).not.toMatch(/capitalize|break-all|break-words/)
  })

  it('every engine contract holds: id, covers, isolates and a catalogue entry that names its config', () => {
    expect(engine.id).toBe('chart-builder')
    expect(engine.covers.length).toBeGreaterThan(0)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:chart-builder"/)
    expect(pictogramOf(PIC, {}).key).toBe(2)
  })
})
