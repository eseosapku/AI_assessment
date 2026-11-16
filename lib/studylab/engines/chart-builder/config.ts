// lib/studylab/engines/chart-builder/config.ts
//
// A table of numbers turned into a chart on squared paper. The learner handles the chart itself:
//   build  -- drag the top of each bar (or each point of a line graph, or the end of each pictogram row) to its value in the
//             table, reading the scale on the axis or the key;
//   scale  -- the bars are already drawn, and the learner picks what each square is worth: too small and the tallest bar runs
//             off the paper, too large and the chart shrinks, and the wrong factor leaves a bar ending between two lines;
//   honest -- a bar chart whose axis starts part-way up makes small differences look huge. The learner moves where the axis
//             starts, and the bars redraw, until they show the numbers fairly.
//
// The rules, all computed here and never read from the drawing:
//   a bar's height in squares is its value over what one square is worth, exactly (integers, never floats);
//   the best scale is the smallest in a short list (1, 2, 5, 10, 20, 25, ...) that divides every value and lets the tallest bar
//   fit the ten squares of paper: the biggest chart whose every bar ends on a line;
//   a pictogram row holds whole and half symbols, so a value is twice its value over the key, in halves;
//   a bar chart is honest when its axis starts at zero, because a bar's length is the thing that carries the number.
//
// Ideas taken, never code or art:
//   - the truncated axis as the way a bar chart lies, and the same data redrawn from zero as the cure: Calling Bullshit (Bergstrom
//     and West), "Misleading axes on graphs": bars of 15 and 20 on an axis starting at 10 look twice as different as 4/3.
//     A bar's length is its value, so only a zero baseline keeps it true; a line graph is allowed to zoom, which is why the honest
//     task is bars only. Truncation misleads even trained readers (Yang et al., "Truncating bar graphs persistently misleads
//     viewers", J. Applied Research in Memory and Cognition, 2021, read in summary);
//   - the classroom errors, from teacher guides and Oak National Academy's "Checking understanding of pictograms and bar charts":
//     a forgotten key, a mislabelled vertical scale, a bar halfway between 10 and 20 read as 11, uneven intervals, a missing zero.
//     They shape the three tasks: the key must be read, the scale must be chosen, the axis must start in the right place;
//   - Desmos's "Bar Graph Sliders" (build the graph by pulling its bars): the page would not load for me, so only its title
//     was read; the drag-to-height move is the common idea of the whole genre.
// Refused:
//   - pie charts, histograms, scatter graphs and cumulative frequency: different ideas, and a histogram needs frequency density;
//   - a live readout of the bar being dragged: it would turn reading the scale into matching two numbers;
//   - typing the values in: the act is the chart, not the table;
//   - two scales on one chart, logarithmic axes and broken axes: the honest task is the simple, common lie.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ChartBuilderView } from './View'

// ---------------------------------------------------------------------------
// The paper. Everything is on a 357-wide plate of 17 px squares, so the squares are whole all the way across.

export const SQ = 17
export const W = 357
export const X0 = 51
export const X1 = 340
export const BASE_Y = 204
export const TOP_Y = 34
/** Squares of paper above the axis: a bar can reach this and no further. */
export const CAP = 10
export const H = 273
/** Below the axis: a row of names, then a row of numbers, like a table. */
export const NAME_Y = 225
export const RULE_Y = 239
export const VALUE_Y = 255
export const TABLE_END = 271

// A pictogram is a table with pictures: key on top, then one row for each name.
export const PIC_KEY_H = 40
export const PIC_ROW_H = 40
export const PIC_X0 = 88
export const PIC_CELL = 27
export const PIC_DIVIDE = 310
export const PIC_SYMBOLS = 8
export const PIC_CAP = 2 * PIC_SYMBOLS
export const picHeight = (rows: number) => PIC_KEY_H + PIC_ROW_H * rows + 12

export const SCALES = [1, 2, 4, 5, 10, 20, 25, 40, 50, 100, 200, 250, 400, 500, 1000, 2000, 5000] as const
export const PIC_KEYS = [2, 4, 10, 20, 40, 50, 100, 200, 400, 500, 1000] as const
export const FORMS = ['bar', 'line', 'pictogram'] as const
export type Form = (typeof FORMS)[number]
export const SYMBOLS = ['person', 'apple', 'book', 'star', 'ball'] as const

export const MAX_VALUE = 50000
export const MAX_PIC_VALUE = 9999
export const MAX_TITLE = 60
export const MAX_UNIT = 12
/** The widest a 12 px name can be, in characters. */
const CHAR = 7.2

export type Row = { label: string; value: number }
export type ChartConfig = {
  task: 'build' | 'scale' | 'honest'
  /** Which chart `build` makes. A word outside the list still parses, and faults says what would work. */
  form: string
  data: Row[]
  title: string
  unit: string
  /** build, bar or line: what one square is worth. The engine picks the best when this is left out. */
  scale?: number
  /** build, pictogram: what one symbol stands for. */
  key?: number
  symbol: string
  /** Things the tutor wrote that the parser read but cannot honour, so faults can say so. */
  oddities: string[]
}

/** What the learner has done: heights in squares (or half symbols), the scale chosen, or where the axis starts. */
export type ChartState = { v?: number[]; each?: number; start?: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const isInt = (n: number) => Number.isInteger(n)

export const rowsCount = (c: ChartConfig) => c.data.length
export const formOf = (c: ChartConfig): string => (c.task === 'build' ? c.form : 'bar')
const values = (c: ChartConfig) => c.data.map((r) => r.value)
const maxOf = (v: number[]) => (v.length ? Math.max(...v) : 0)
const minOf = (v: number[]) => (v.length ? Math.min(...v) : 0)

// ---------------------------------------------------------------------------
// The maths of scales and keys.

/** The best scale: the smallest square value that every value is a whole number of squares of, with the tallest bar on the paper. */
export function bestScale(vals: number[]): number | null {
  const top = maxOf(vals)
  const found = SCALES.find((s) => vals.every((v) => isInt(v) && v % s === 0) && top / s <= CAP)
  return found ?? null
}

const fallbackScale = (vals: number[]): number => SCALES.find((s) => Math.ceil(maxOf(vals) / s) <= CAP) ?? SCALES[SCALES.length - 1]

/** The smallest key that every value is a whole number of halves of, with the longest row fitting. */
export function bestKey(vals: number[]): number | null {
  const top = maxOf(vals)
  const found = PIC_KEYS.find((k) => vals.every((v) => isInt(v) && (2 * v) % k === 0) && top / k <= PIC_SYMBOLS)
  return found ?? null
}

const fallbackKey = (vals: number[]): number => PIC_KEYS.find((k) => Math.ceil(maxOf(vals) / k) <= PIC_SYMBOLS) ?? PIC_KEYS[PIC_KEYS.length - 1]

/** The honest chart's paper: the top it must reach, and the highest start that still leaves every bar showing. */
export function honestPlan(vals: number[]): { top: number; start0: number } {
  const top = Math.max(10, Math.ceil(maxOf(vals) / 10) * 10)
  const start0 = Math.max(0, Math.ceil(minOf(vals) / 10) * 10 - 10)
  return { top, start0 }
}
export const honestStarts = (vals: number[]): number[] => {
  const { start0 } = honestPlan(vals)
  return Array.from({ length: start0 / 10 + 1 }, (_, i) => i * 10)
}

/** The paper a state draws: what one square is worth, where the axis starts, and each bar's height in squares. */
export type Paper = { each: number; start: number; heights: number[]; labels: number[] }

export function paperOf(c: ChartConfig, state: ChartState): Paper {
  const vals = values(c)
  let each: number
  let start = 0
  let heights: number[]
  if (c.task === 'scale') {
    each = eachOf(c, state)
    heights = vals.map((v) => v / each)
  } else if (c.task === 'honest') {
    const { top } = honestPlan(vals)
    start = startOf(c, state)
    each = (top - start) / CAP
    heights = vals.map((v) => (v - start) / each)
  } else {
    each = c.scale ?? bestScale(vals) ?? fallbackScale(vals)
    heights = heightsOf(c, state)
  }
  const labels = [0, 1, 2, 3, 4, 5].map((j) => start + j * 2 * each)
  return { each, start, heights, labels }
}

/** The key and each row's length in half symbols. */
export type Pictogram = { key: number; halves: number[]; target: number[] }
export function pictogramOf(c: ChartConfig, state: ChartState): Pictogram {
  const vals = values(c)
  const key = c.key ?? bestKey(vals) ?? fallbackKey(vals)
  return { key, halves: heightsOf(c, state), target: vals.map((v) => Math.round((2 * v) / key)) }
}

const capOf = (c: ChartConfig) => (formOf(c) === 'pictogram' ? PIC_CAP : CAP)

/** What the learner has drawn, one whole number a bar, read safely. */
export function heightsOf(c: ChartConfig, state: ChartState): number[] {
  const raw = Array.isArray(state?.v) ? state.v : []
  return c.data.map((_, i) => {
    const x = raw[i]
    return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(capOf(c), Math.round(x))) : 0
  })
}

export const answerScale = (c: ChartConfig): number => bestScale(values(c)) ?? fallbackScale(values(c))

/** Where the scale task starts: one step too coarse, so the chart opens small and unfinished. */
export function startScale(c: ChartConfig): number {
  const i = SCALES.indexOf(answerScale(c) as (typeof SCALES)[number])
  return SCALES[i + 1 < SCALES.length ? i + 1 : i - 1]
}
export function eachOf(c: ChartConfig, state: ChartState): number {
  const e = state?.each
  return typeof e === 'number' && (SCALES as readonly number[]).includes(e) ? e : startScale(c)
}
export function startOf(c: ChartConfig, state: ChartState): number {
  const opts = honestStarts(values(c))
  const s = state?.start
  return typeof s === 'number' && opts.includes(s) ? s : opts[opts.length - 1]
}

/** The height each bar should reach, in squares or half symbols. */
export function targetOf(c: ChartConfig): number[] {
  const vals = values(c)
  if (formOf(c) === 'pictogram') return pictogramOf(c, {}).target
  const each = c.scale ?? bestScale(vals) ?? fallbackScale(vals)
  return vals.map((v) => Math.round(v / each))
}

// ---------------------------------------------------------------------------
// Geometry the view and the tests share.

export const colWidth = (n: number) => (X1 - X0) / Math.max(1, n)
export const colCentre = (n: number, i: number) => X0 + colWidth(n) * (i + 0.5)
export const barWidth = (n: number) => Math.min(40, Math.round(colWidth(n) * 0.58))
/** The longest name a column can hold on one line at 12 px. */
export function maxLabel(form: string, n: number): number {
  if (form === 'pictogram') return 9
  return Math.floor((colWidth(n) - 4) / CHAR)
}
export const squareAt = (y: number) => Math.max(0, Math.min(CAP, Math.round((BASE_Y - y) / SQ)))
export const halfAt = (x: number) => Math.max(0, Math.min(PIC_CAP, Math.round((x - PIC_X0) / (PIC_CELL / 2))))

// ---------------------------------------------------------------------------
// Marking: from the rules, always.

export function check(c: ChartConfig, state: ChartState): { ok: boolean; wrongIds: string[] } {
  if (c.task === 'scale') return { ok: eachOf(c, state) === answerScale(c), wrongIds: [] }
  if (c.task === 'honest') return { ok: startOf(c, state) === 0, wrongIds: [] }
  const have = heightsOf(c, state)
  const want = targetOf(c)
  const wrongIds = want.flatMap((w, i) => (have[i] === w ? [] : [String(i)]))
  return { ok: wrongIds.length === 0, wrongIds }
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card says nothing about right or wrong.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const ratio = (a: number, b: number) => (Math.round((a / b) * 10) / 10).toString()
/** Two ratios to one place, or to two when one place would make them look the same. */
function ratioText(a: number, b: number, c: number, d: number): [string, string] {
  const one: [string, string] = [ratio(a, b), ratio(c, d)]
  return one[0] === one[1] ? [(Math.round((a / b) * 100) / 100).toString(), (Math.round((c / d) * 100) / 100).toString()] : one
}

/** The number a bar or row shows now, in the table's own units. */
export function shownValue(c: ChartConfig, state: ChartState, i: number): number {
  if (formOf(c) === 'pictogram') return (heightsOf(c, state)[i] * pictogramOf(c, state).key) / 2
  return heightsOf(c, state)[i] * paperOf(c, state).each
}

const unitWord = (c: ChartConfig) => (c.unit ? ` ${c.unit}` : '')

/** What a correct card says: what the learner found, and the idea behind it. */
export function working(c: ChartConfig, state: ChartState): string {
  const vals = values(c)
  if (c.task === 'scale') {
    const e = answerScale(c)
    return `Yes. With each square worth ${e}, every value lands exactly on a line, and the tallest bar, ${maxOf(vals)}, is ${maxOf(vals) / e} of the ${CAP} squares. A good scale is the one that fits the paper and still lets you read every bar.`
  }
  if (c.task === 'honest') {
    return `Yes. Starting the axis at 0 makes each bar as long as its number. The tallest bar is ${ratio(maxOf(vals), minOf(vals))} times the shortest, and so are the numbers. A bar chart must start at zero, because the length of a bar is what carries the value.`
  }
  const form = formOf(c)
  if (form === 'pictogram') {
    const k = pictogramOf(c, state).key
    const half = c.data.findIndex((r) => ((2 * r.value) / k) % 2 === 1)
    const tail = half >= 0 ? ` ${c.data[half].label}, ${c.data[half].value}, takes a half symbol.` : ''
    return `Yes. Each symbol stands for ${k}${unitWord(c)}, so each row is its number divided by ${k}.${tail} The key is what turns pictures into numbers.`
  }
  const e = paperOf(c, state).each
  const big = c.data.reduce((b, r, i) => (r.value > c.data[b].value ? i : b), 0)
  if (form === 'line') {
    return `Yes. Each square is worth ${e}, so ${c.data[big].label}, ${c.data[big].value}, sits ${c.data[big].value / e} squares up. Every point is at the height its number says, and the line joins them in order.`
  }
  return `Yes. Each square is worth ${e}, so ${c.data[big].label}, ${c.data[big].value}, is ${c.data[big].value / e} squares tall. Every bar ends on the line its number says.`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(c: ChartConfig, state: ChartState): string {
  const vals = values(c)
  if (c.task === 'scale') {
    const e = eachOf(c, state)
    const tallest = maxOf(vals) / e
    if (tallest > CAP) return `With each square worth ${e}, the tallest bar, ${maxOf(vals)}, needs ${tallest} squares, but the paper has ${CAP}. It runs off the top.`
    const bad = c.data.find((r) => r.value % e !== 0)
    if (bad) return `With each square worth ${e}, ${bad.label} (${bad.value}) is ${Math.round((bad.value / e) * 100) / 100} squares tall, so it ends between two lines and cannot be read exactly.`
    return `With each square worth ${e}, every bar ends on a line, but the tallest fills only ${tallest} of the ${CAP} squares. A bigger chart would be easier to read.`
  }
  if (c.task === 'honest') {
    const s = startOf(c, state)
    const drawn = ratioText(maxOf(vals) - s, minOf(vals) - s, maxOf(vals), minOf(vals))
    return `The axis starts at ${s}, so the tallest bar looks ${drawn[0]} times the shortest, but the numbers are ${drawn[1]} times. The bars are drawn from ${s}, not from nothing, so they do not match the numbers.`
  }
  const wrong = check(c, state).wrongIds.map(Number)
  const names = wrong.map((i) => c.data[i].label)
  const first = wrong[0]
  const noun = formOf(c) === 'bar' ? 'bar' : formOf(c) === 'line' ? 'point' : 'row'
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const lead = `${list} ${names.length === 1 ? 'is' : 'are'} not yet at the table's value.`
  const got = shownValue(c, state, first)
  const body = heightsOf(c, state)[first] === 0
    ? `The ${c.data[first].label} ${noun} is still at the bottom.`
    : `Your ${c.data[first].label} ${noun} shows ${got}${unitWord(c)}; the table says ${c.data[first].value}.`
  return `${lead} ${body}`
}

/** What the screen reader hears of the picture: its parts, never whether they are right. */
export function describe(c: ChartConfig): string {
  const n = rowsCount(c)
  const names = c.data.map((r) => r.label).join(', ')
  if (c.task === 'scale') return `A bar chart on squared paper with ${n} bars, ${names}. The scale on the axis is what you set.`
  if (c.task === 'honest') return `A bar chart with ${n} bars, ${names}. The axis starts at the number you set.`
  const form = formOf(c)
  const what = form === 'bar' ? `a bar chart with ${n} bars` : form === 'line' ? `a line graph with ${n} points` : `a pictogram with ${n} rows`
  return `A table of ${n} values, ${names}, and ${what} to draw from it.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const FORM_WORDS: Record<string, Form> = {
  bar: 'bar', bars: 'bar', 'bar-chart': 'bar', 'bar-graph': 'bar', 'bar-charts': 'bar', 'bar-graphs': 'bar', barchart: 'bar', 'column-chart': 'bar', 'column-graph': 'bar', columns: 'bar', 'vertical-bar-chart': 'bar',
  line: 'line', 'line-graph': 'line', 'line-chart': 'line', 'line-graphs': 'line', linegraph: 'line', 'line-plot': 'line', 'time-graph': 'line', 'time-series': 'line',
  pictogram: 'pictogram', pictograms: 'pictogram', pictograph: 'pictogram', pictographs: 'pictogram', 'picture-graph': 'pictogram', 'pictogram-chart': 'pictogram', 'picture-chart': 'pictogram', 'pictorial-chart': 'pictogram',
}
const TASK_WORDS: Record<string, ChartConfig['task']> = {
  build: 'build', draw: 'build', make: 'build', plot: 'build', construct: 'build', create: 'build', complete: 'build', 'draw-chart': 'build', 'draw-the-chart': 'build', 'build-chart': 'build', 'build-a-chart': 'build', 'make-chart': 'build', 'draw-graph': 'build', 'draw-a-graph': 'build', chart: 'build', graph: 'build', 'table-to-chart': 'build',
  scale: 'scale', scales: 'scale', 'choose-scale': 'scale', 'choose-a-scale': 'scale', 'choosing-scale': 'scale', 'choosing-a-scale': 'scale', 'pick-scale': 'scale', 'pick-a-scale': 'scale', 'set-scale': 'scale', 'set-the-scale': 'scale', 'axis-scale': 'scale', 'choose-the-scale': 'scale',
  honest: 'honest', honesty: 'honest', misleading: 'honest', 'misleading-chart': 'honest', 'misleading-graph': 'honest', truncated: 'honest', 'truncated-axis': 'honest', baseline: 'honest', 'axis-start': 'honest', fair: 'honest', 'fair-chart': 'honest', 'spot-the-trick': 'honest', 'fix-the-chart': 'honest', 'broken-axis': 'honest', 'false-start': 'honest', 'spot-the-lie': 'honest',
}
const SYMBOL_WORDS: Record<string, string> = {
  person: 'person', people: 'person', child: 'person', children: 'person', pupil: 'person', pupils: 'person', student: 'person', students: 'person', man: 'person', figure: 'person', stick: 'person',
  apple: 'apple', apples: 'apple', fruit: 'apple', book: 'book', books: 'book', star: 'star', stars: 'star', ball: 'ball', balls: 'ball', football: 'ball', footballs: 'ball',
}

const LABEL_KEYS = ['label', 'name', 'category', 'x', 'day', 'month', 'year', 'item', 'group', 'key', 'title', 'time', 'type', 'pet', 'fruit', 'sport']
const VALUE_KEYS = ['value', 'count', 'frequency', 'freq', 'y', 'number', 'total', 'amount', 'votes', 'height', 'quantity', 'score']

function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim().replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}
const readLabel = (raw: unknown): string | null => (typeof raw === 'string' || typeof raw === 'number' ? String(raw).replace(/\s+/g, ' ').trim() : null)

function rowOf(item: unknown): Row | null {
  if (Array.isArray(item) && item.length >= 2) {
    const label = readLabel(item[0])
    const value = readNumber(item[1])
    return label && value !== null ? { label, value } : null
  }
  if (typeof item === 'string') {
    const m = item.trim().match(/^(.*?)[\s:=-]+(-?[\d.,]+)$/)
    const value = m ? readNumber(m[2]) : null
    return m && m[1].trim() && value !== null ? { label: m[1].trim(), value } : null
  }
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>
    const label = readLabel(first(o, LABEL_KEYS))
    const value = readNumber(first(o, VALUE_KEYS))
    return label && value !== null ? { label, value } : null
  }
  return null
}

function readRows(raw: unknown): Row[] | null {
  if (Array.isArray(raw)) {
    const rows = raw.map(rowOf)
    return rows.length && rows.every((r) => r) ? (rows as Row[]) : null
  }
  if (typeof raw === 'string') {
    const rows = raw.split(/[,;\n]+/).filter((s) => s.trim()).map(rowOf)
    return rows.length && rows.every((r) => r) ? (rows as Row[]) : null
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.labels) && Array.isArray(o.values) && o.labels.length === o.values.length) return readRows(o.labels.map((l, i) => [l, (o.values as unknown[])[i]]))
    for (const k of ['rows', 'items', 'data', 'table']) if (o[k] !== undefined && o[k] !== raw) return readRows(o[k])
    const rows = Object.entries(o).map(([label, value]) => rowOf([label, value]))
    return rows.length && rows.every((r) => r) ? (rows as Row[]) : null
  }
  return null
}

function readQuantity(raw: unknown): number | undefined {
  const direct = readNumber(raw)
  if (direct !== null) return direct
  if (typeof raw === 'string') {
    const m = raw.match(/\d[\d,]*(?:\.\d+)?/)
    if (m) return readNumber(m[0]) ?? undefined
  }
  return undefined
}

const text = (raw: unknown): string => (typeof raw === 'string' || typeof raw === 'number' ? String(raw).replace(/\s+/g, ' ').trim() : '')

/** What a prompt can safely say: the gesture and the aim. */
export const goodPrompt = (c: ChartConfig): string => {
  if (c.task === 'scale') return 'Use the plus and minus to choose how much each square is worth, so the chart is as tall as the paper allows and every bar ends exactly on a line.'
  if (c.task === 'honest') return 'Use the plus and minus to move where the axis starts, so the bars show the numbers fairly.'
  const form = formOf(c)
  if (form === 'line') return 'Drag each point up to its value in the table, reading the scale on the axis.'
  if (form === 'pictogram') return 'Drag the end of each row along to show its number in the table, using the key.'
  return 'Drag the top of each bar up to its value in the table, reading the scale on the axis.'
}

const EXAMPLES: Record<string, string> = {
  bar: 'data [["Cats",10],["Dogs",6],["Fish",4],["Birds",8]]',
  line: 'data [["Mon",4],["Tue",7],["Wed",5],["Thu",9],["Fri",6]]',
  pictogram: 'data [["Bus",12],["Walk",8],["Car",6],["Bike",4]]',
  scale: 'data [["Cats",15],["Dogs",35],["Fish",25],["Birds",40]]',
  honest: 'data [["Shop A",36],["Shop B",39]]',
}
const exampleFor = (c: ChartConfig) => EXAMPLES[c.task === 'build' ? formOf(c) : c.task] ?? EXAMPLES.bar

/** Values rounded to a nearby unit that does draw, to show a writer what would work. */
function nearbyValues(vals: number[], pictogram: boolean): string {
  const units: readonly number[] = pictogram ? PIC_KEYS.map((k) => k / 2) : SCALES
  const top = maxOf(vals)
  const unit = units.find((u) => Math.ceil(top / u) <= (pictogram ? PIC_SYMBOLS * 2 : CAP)) ?? units[units.length - 1]
  return vals.map((v) => Math.max(unit, Math.round(v / unit) * unit)).join(', ')
}

const countRange = (c: ChartConfig): [number, number] => {
  if (c.task === 'honest') return [2, 6]
  if (c.task === 'scale') return [3, 6]
  const f = formOf(c)
  return f === 'line' ? [4, 8] : f === 'pictogram' ? [3, 5] : [3, 6]
}

export const chartBuilderEngine: SceneEngine<ChartConfig, ChartState> = {
  id: 'chart-builder',
  // Few and distinctive: `scenesFor` matches a covers word by its first five letters. "chart", "graph" and "table" are common
  // (flow charts, the periodic table), so everything else is a whole phrase.
  covers: ['pictograms', 'pictographs'],
  phrases: [
    'bar chart', 'bar charts', 'bar graph', 'bar graphs', 'drawing bar charts', 'drawing bar graphs', 'line graph', 'line graphs', 'line chart', 'line charts', 'drawing line graphs', 'pictogram', 'pictograms',
    'data handling', 'handling data', 'introduction to data handling', 'representing data', 'displaying data', 'presenting data', 'data presentation', 'data representation in charts', 'statistical diagrams', 'statistical charts',
    'charts and graphs', 'graphs and charts', 'interpreting charts', 'interpreting graphs', 'interpreting graphs and charts', 'reading graphs', 'reading charts', 'reading bar charts', 'tally charts', 'tally and frequency', 'frequency tables', 'frequency table',
    'scales and axes', 'axes and scales', 'choosing a scale', 'choosing scales', 'scale on a graph', 'scales on graphs', 'misleading graphs', 'misleading charts', 'misleading statistics', 'misleading data', 'truncated axes',
    'data visualisation', 'data visualization', 'spreadsheet charts', 'charts in spreadsheets', 'creating charts', 'drawing graphs of results', 'presenting results', 'recording results and drawing graphs', 'processing and presenting data',
  ],
  // Near misses: charts and tables of other kinds, and graphs this card does not draw.
  notFor: [
    'flow chart', 'flow charts', 'flowchart', 'flowcharts', 'gantt chart', 'gantt charts', 'organisation chart', 'organization chart', 'pert chart', 'periodic table', 'truth table', 'truth tables', 'times table', 'times tables', 'multiplication table', 'multiplication tables',
    'histogram', 'histograms', 'cumulative frequency', 'box plot', 'box plots', 'scatter graph', 'scatter graphs', 'scatter diagram', 'scatter diagrams', 'scatter plot', 'scatter plots', 'correlation', 'line of best fit', 'stem and leaf',
    'straight line graph', 'straight line graphs', 'distance time graph', 'distance time graphs', 'speed time graph', 'speed time graphs', 'velocity time graph', 'velocity time graphs', 'displacement time graph', 'real life graphs', 'conversion graphs',
    'quadratic graph', 'quadratic graphs', 'graphs of functions', 'sketching graphs', 'transformations of graphs', 'graph theory', 'supply and demand', 'time series analysis', 'moving averages', 'sequence diagrams', 'class diagram', 'class diagrams', 'entity relationship',
  ],
  // The learner varies a quantity: a bar's height, a scale, where an axis starts.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ? { ...o, ...nested } : o
    const data = readRows(first(src, ['data', 'table', 'rows', 'items', 'frequencies']) ?? (src.labels !== undefined && src.values !== undefined ? { labels: src.labels, values: src.values } : undefined))
    if (!data) return null
    const oddities: string[] = []

    // The task and the form may each be written in either place, by many names.
    let task: ChartConfig['task'] | null = null
    let form: string | null = null
    for (const k of nested ? ['kind', 'task', 'type', 'mode', 'form', 'chart', 'chartType'] : ['task', 'kind', 'type', 'mode', 'form', 'chart', 'chartType', 'chart_type', 'graph', 'display']) {
      const v = src[k]
      if (v === undefined || typeof v === 'object') continue
      const word = keyOf(v)
      if (!word) continue
      if (has(TASK_WORDS, word) && !(k === 'form' && has(FORM_WORDS, word))) {
        if (!task) task = TASK_WORDS[word]
      } else if (has(FORM_WORDS, word)) {
        if (!form) form = FORM_WORDS[word]
      } else if (k === 'form' || k === 'chart' || k === 'chartType' || k === 'chart_type' || k === 'graph' || k === 'display') {
        if (!form) form = word
      } else if (!task) {
        oddities.push(`There is no "${word}" task: use build, scale or honest, e.g. task "build".`)
      }
    }
    const finalTask = task ?? 'build'
    if (finalTask !== 'build' && form && form !== 'bar') oddities.push(`The ${finalTask} task draws bars only, not a ${form} chart: leave the form out, or use task "build".`)

    const symbolRaw = first(src, ['symbol', 'icon', 'picture', 'pictureOf'])
    const symbolKey = keyOf(symbolRaw).replace(/^(?:a|an|the)-/, '')
    const symbol = symbolRaw === undefined ? 'person' : has(SYMBOL_WORDS, symbolKey) ? SYMBOL_WORDS[symbolKey] : symbolKey || 'person'

    return {
      task: finalTask,
      form: form ?? 'bar',
      data,
      title: text(first(src, ['title', 'caption', 'heading'])),
      unit: text(first(src, ['unit', 'units', 'measure', 'yLabel', 'y_label', 'ylabel', 'axisLabel'])),
      scale: readQuantity(first(src, ['scale', 'each', 'eachSquare', 'each_square', 'squareValue', 'step', 'interval'])),
      key: readQuantity(first(src, ['key', 'perSymbol', 'per_symbol', 'symbolValue', 'symbol_value', 'standsFor', 'represents'])),
      symbol,
      oddities,
    }
  },

  faults(c) {
    const out: string[] = [...c.oddities]
    const form = formOf(c)
    const vals = values(c)
    const n = vals.length
    const example = exampleFor(c)
    if (c.task === 'build' && !(FORMS as readonly string[]).includes(form)) out.push(`There is no "${form}" chart here: use bar, line or pictogram, e.g. form "bar".`)
    const known = (FORMS as readonly string[]).includes(form)
    const pic = c.task === 'build' && form === 'pictogram'
    const [lo, hi] = countRange(c)
    if (n < lo || n > hi) out.push(`${plural(n, 'row')} of data is outside what this chart holds (${lo} to ${hi}): use e.g. ${example}.`)
    const bad = c.data.filter((r) => !isInt(r.value) || r.value < 0)
    if (bad.length) out.push(`Values must be whole numbers, 0 or more, but ${bad.map((r) => `${r.label} is ${r.value}`).join(' and ')}: use e.g. ${example}.`)
    const limit = pic ? MAX_PIC_VALUE : MAX_VALUE
    if (!bad.length && maxOf(vals) > limit) out.push(`The largest value is ${maxOf(vals)}, more than the card can label (${limit}): use e.g. ${example}.`)
    if (new Set(c.data.map((r) => r.label.toLowerCase())).size < n) out.push(`Two rows share a name: every bar needs its own, e.g. ${example}.`)
    const room = known || c.task !== 'build' ? maxLabel(pic ? 'pictogram' : form, Math.max(1, n)) : 6
    const wide = c.data.filter((r) => [...r.label].length > room)
    if (wide.length) out.push(`"${wide[0].label}" is too long for its place on the chart (${room} characters at most with ${plural(n, 'row')}): shorten it, e.g. "${[...wide[0].label].slice(0, room).join('').trim()}".`)
    if ([...c.title].length > MAX_TITLE) out.push(`The title is longer than ${MAX_TITLE} characters: shorten it.`)
    if ([...c.unit].length > MAX_UNIT) out.push(`The unit "${c.unit}" is longer than ${MAX_UNIT} characters: use e.g. unit "pupils".`)
    if (bad.length || n === 0) return out

    if (c.task === 'honest') {
      const { start0 } = honestPlan(vals)
      if (minOf(vals) <= 10) out.push(`The smallest value is ${minOf(vals)}: an axis that starts part-way up needs every value above 10. Use e.g. ${EXAMPLES.honest}.`)
      else if (maxOf(vals) > 2 * minOf(vals)) out.push(`The values run from ${minOf(vals)} to ${maxOf(vals)}: a cut axis only fools the eye when they are close (the largest within twice the smallest). Use e.g. ${EXAMPLES.honest}.`)
      else if (start0 < 10) out.push(`An axis starting part-way up needs the smallest value above 10: use e.g. ${EXAMPLES.honest}.`)
      return out
    }
    if (maxOf(vals) < 5) out.push(`The largest value is ${maxOf(vals)}: with so few squares there is no scale to choose. Use values up to at least 5, e.g. ${example}.`)
    if (vals.filter((v) => v > 0).length < 2) out.push(`At least two rows need a value above 0, or there is almost nothing to draw: use e.g. ${example}.`)
    if (pic) {
      if (!(SYMBOLS as readonly string[]).includes(c.symbol)) out.push(`There is no "${c.symbol}" symbol: use person, apple, book, star or ball, e.g. symbol "person".`)
      if (c.key !== undefined) {
        if (!isInt(c.key) || c.key < 1) out.push(`The key must be a whole number of 1 or more, e.g. key 4.`)
        else if (vals.some((v) => (2 * v) % c.key! !== 0)) out.push(`A key of ${c.key} cannot show ${vals.find((v) => (2 * v) % c.key! !== 0)}, since rows are in whole and half symbols: use a key that makes every value whole or half, e.g. key ${bestKey(vals) ?? 4}, or change the data (e.g. ${nearbyValues(vals, true)}).`)
        else if (maxOf(vals) / c.key > PIC_SYMBOLS) out.push(`A key of ${c.key} makes the longest row ${maxOf(vals) / c.key} symbols, more than a row holds (${PIC_SYMBOLS}): use a bigger key, e.g. key ${PIC_KEYS.find((k) => maxOf(vals) / k <= PIC_SYMBOLS) ?? 100}.`)
        else if (maxOf(vals) / c.key < 3) out.push(`A key of ${c.key} makes even the longest row under 3 symbols: use a smaller key, e.g. key ${PIC_KEYS.slice().reverse().find((k) => maxOf(vals) / k >= 3 && vals.every((v) => (2 * v) % k === 0)) ?? 2}.`)
      } else if (bestKey(vals) === null) {
        out.push(`No key lets these values be drawn in whole and half symbols with at most ${PIC_SYMBOLS} in a row: use values like ${nearbyValues(vals, true)}.`)
      }
      return out
    }
    if (c.task === 'build' && c.scale !== undefined) {
      if (!isInt(c.scale) || c.scale < 1 || c.scale > 5000) out.push(`The scale must be a whole number from 1 to 5000, e.g. scale 5.`)
      else if (vals.some((v) => v % c.scale! !== 0)) out.push(`With each square worth ${c.scale}, ${vals.find((v) => v % c.scale! !== 0)} would end between two lines: leave the scale out, or use e.g. scale ${bestScale(vals) ?? 5}, or change the data (e.g. ${nearbyValues(vals, false)}).`)
      else if (maxOf(vals) / c.scale > CAP) out.push(`With each square worth ${c.scale}, the tallest bar needs ${maxOf(vals) / c.scale} squares, more than the paper (${CAP}): use a bigger scale, e.g. scale ${SCALES.find((s) => maxOf(vals) / s <= CAP && vals.every((v) => v % s === 0)) ?? 10}.`)
      else if (maxOf(vals) / c.scale < 3) out.push(`With each square worth ${c.scale}, the tallest bar is under 3 squares: use a smaller scale, e.g. scale ${bestScale(vals) ?? 1}.`)
    } else if (bestScale(vals) === null) {
      out.push(`No scale on the paper lets every value end on a line with the tallest bar inside ${CAP} squares: use values with a common factor, like ${nearbyValues(vals, false)}.`)
    }
    return out
  },

  promptFaults(c, prompt) {
    const t = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(c)
    const out: string[] = []
    const form = formOf(c)
    const gesture = c.task === 'build'
      ? /\b(?:drag|pull|move|slide|raise|push|lift)\b/i.test(t)
      : /\b(?:plus|minus|choose|pick|set|change|adjust|tap|press|move|step)\b/i.test(t)
    if (!gesture) out.push(`the prompt does not say what to do with the card: ${c.task === 'build' ? 'the learner drags' : 'the learner taps the plus and minus'} -- ask for that ("${example}")`)
    if (c.task === 'scale') {
      const gives = /\b(?:each|every|one|1)\s+(?:small\s+)?(?:square|box|grid\s+square)s?\s+(?:is|=|stands?(?:\s+for)?|represents?|worth|equals?|counts?(?:\s+as)?)\s*(?:worth\s+)?(?:=\s*)?\d/i.test(t)
        || /\bscale\s+(?:of|is|=)\s*\d/i.test(t) || /\bin\s+(?:ones|twos|threes|fives|tens|twenties|fifties|hundreds|\d+s)\b/i.test(t) || /\bcount(?:ing)?\s+in\b/i.test(t)
        || /\b\d+\s+squares?\b/i.test(t) || /\bdivides?\b|\bfactor\b|\bmultiples?\b/i.test(t)
      if (gives) out.push(`the prompt gives the answer away: it says what a square is worth, how many squares, or how to find it, which the learner is to choose -- ask for the outcome only ("${example}")`)
    }
    if (c.task === 'honest') {
      if (/\bzero\b|\b0\b|\bbottom\b|\bbaseline\b|\btruncat|\bbroken\s+axis|\bfrom\s+the\s+start\b|\bstart(?:s|ing)?\s+(?:at|from)\b|\bnot\s+start/i.test(t)) {
        out.push(`the prompt gives the answer away: it says where the axis should start, which the learner is to find -- ask for the outcome only ("${example}")`)
      }
    }
    // Things the card does not draw or do.
    if (/\bpie\b|\bhistogram|\bscatter|\bcolou?r(?:ed|ing|s)?\b|\bruler\b|\bpencil\b|\btitle\s+(?:the|your)\b|\blabel\s+(?:the|each|both|your)\s+(?:axes|axis|bars?|points?)|\bwrite\b|\btype\s+in\b|\bstack|\bgrouped\b/i.test(t)) {
      out.push(`the prompt promises something the card does not do: it draws one chart from the table, and the learner only ${c.task === 'build' ? 'drags' : 'taps the plus and minus'} -- ask for that ("${example}")`)
    }
    if (c.task !== 'build' && /\bdrag\b|\bpull\b|\bslide\b/i.test(t)) out.push(`the prompt promises a drag, but this card has plus and minus buttons -- ask for that ("${example}")`)
    if (/\bwhich\s+(?:is|was|has|had)\s+the\s+(?:most|least|biggest|tallest|largest|smallest|highest|lowest)|\bhow\s+many\s+more\b|\bdifference\s+between\b|\bmost\s+popular\b/i.test(t)) {
      out.push(`the prompt asks a question about the data: this card makes or fixes the chart and asks nothing about what it says -- ask for that ("${example}")`)
    }
    // The prompt must name the chart the card draws.
    if (c.task === 'build') {
      if (form === 'bar' && /\bline\s+(?:graph|chart)|\bpoints?\b|\bdots?\b|\bpictogram|\bsymbols?\b|\bkey\b|\bpictures?\b/i.test(t)) out.push(`the prompt describes a different chart: this card draws a bar chart, so the learner drags bar tops -- ask for that ("${example}")`)
      if (form === 'line' && /\bbars?\b|\bpictogram|\bsymbols?\b|\bkey\b|\bpictures?\b/i.test(t)) out.push(`the prompt describes a different chart: this card draws a line graph, so the learner drags points -- ask for that ("${example}")`)
      if (form === 'pictogram' && /\bbars?\b|\bpoints?\b|\bline\s+(?:graph|chart)|\bsquares?\b|\bscale\b|\baxis\b|\baxes\b/i.test(t)) out.push(`the prompt describes a different chart: this card draws a pictogram, so the learner drags the end of a row and reads the key -- ask for that ("${example}")`)
    } else if (/\bpoints?\b|\bline\s+(?:graph|chart)|\bpictogram|\bsymbols?\b|\bkey\b/i.test(t)) {
      out.push(`the prompt describes a different chart: this card has a bar chart -- ask for that ("${example}")`)
    }
    return out
  },

  initial(c) {
    if (c.task === 'scale') return { each: startScale(c) }
    if (c.task === 'honest') return { start: honestPlan(values(c)).start0 }
    return { v: c.data.map(() => 0) }
  },

  check,

  solve(c) {
    if (c.task === 'scale') return { each: answerScale(c) }
    if (c.task === 'honest') return { start: 0 }
    return { v: targetOf(c) }
  },

  View: ChartBuilderView,

  prompt: `SCENE "chart-builder" -- a table of numbers and the chart to make from it, drawn on real squared paper (pale blue grid, dark axes, a ruled table of names and numbers under the axis). Three tasks, each one thing to handle and one thing that answers back.
  For: bar charts, line graphs and pictograms, drawing a chart from a frequency table, choosing a scale and reading the axis, what a pictogram key means, and spotting a bar chart whose axis starts part-way up and so misleads. Not for pie charts, histograms, scatter graphs, cumulative frequency, straight-line graphs, distance-time graphs, flow charts or the periodic table.
  build: the table is under the axis, each name over its number. The learner DRAGS the top of each bar up (grab the white handle on the bar, or touch the column) until it reaches the number, reading the numbered scale on the vertical axis; bars snap to whole squares, and nothing says whether a bar is right until marking. form "bar", "line" (the learner drags a point in each column, and a line joins them) or "pictogram" (a key shows one symbol and what it stands for, and the learner drags the end of each row along; half symbols are allowed, and a number is shown at the end of each row). The card picks the best scale or key; give "scale" (what a square is worth) or "key" (what a symbol stands for) only to set it. "symbol": person, apple, book, star or ball. 3 to 6 names for a bar chart, 4 to 8 for a line graph, 3 to 5 for a pictogram. Every value must be a whole number a scale or key can draw exactly, e.g. 15, 35 and 25 with squares of 5.
  scale: the bars are already drawn from the table, and the learner taps plus and minus to choose what each square is worth. The chart redraws at once: too small a scale and the tallest bar runs off the top of the paper, too large and the chart shrinks, and a scale that does not divide a value leaves that bar ending between two lines. Marked right at the smallest scale that fits the paper and puts every bar on a line. 3 to 6 bars; the values need a common factor in the list 1, 2, 5, 10, 20, 25, 50 and so on, such as 15, 35, 25, 40 (squares of 5).
  honest: a bar chart whose axis starts part-way up, so bars of 36 and 39 look wildly different. The learner taps plus and minus to move where the axis starts and the bars redraw. Marked right when the bars are fair, and the card says why. 2 to 6 bars, every value above 10 and the largest within twice the smallest, such as 36 and 39.
  title: a short caption under the picture, optional. unit: the word on the axis or key, such as "pupils", optional (12 characters at most). Names must be short: 6 characters for six bars, 9 for a pictogram row.
  Before marking the card shows the table, the paper and the chart the learner has made. It holds back whether a bar is right, the scale that fits and where an honest axis starts; marking says what the learner made and why. The prompt must say the gesture and the aim only: do NOT say a scale, how many squares tall, a bar's value as a height, or (for honest) that the axis should start at zero or at the bottom.
  config: { "task":"build", "form":"bar", "title":"Pets in Class 5", "unit":"pupils", "data":[["Cats",15],["Dogs",35],["Fish",25],["Birds",10]] }  -- the prompt says "Drag the top of each bar up to its value in the table, reading the scale on the axis."
       or { "task":"build", "form":"line", "title":"Visitors each day", "unit":"visitors", "data":[["Mon",20],["Tue",50],["Wed",30],["Thu",60],["Fri",40]] }  -- "Drag each point up to its value in the table, reading the scale on the axis."
       or { "task":"build", "form":"pictogram", "symbol":"person", "unit":"pupils", "data":[["Bus",12],["Walk",8],["Car",6],["Bike",4]] }  -- "Drag the end of each row along to show its number in the table, using the key."
       or { "task":"scale", "unit":"goals", "data":[["Ana",15],["Ben",35],["Cai",25],["Dee",40]] }  -- "Use the plus and minus to choose how much each square is worth, so the chart is as tall as the paper allows and every bar ends exactly on a line."
       or { "task":"honest", "unit":"pupils", "title":"Pupils in each shop queue", "data":[["Shop A",36],["Shop B",39],["Shop C",37]] }  -- "Use the plus and minus to move where the axis starts, so the bars show the numbers fairly."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the top of each bar up to its value in the table, reading the scale on the axis.", "payload": { "engine":"chart-builder", "config": { "task":"build", "form":"bar", "title":"Pets in Class 5", "unit":"pupils", "data":[["Cats",15],["Dogs",35],["Fish",25],["Birds",10]] } }, "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:chart-builder", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the end of each row along to show its number in the table, using the key.", "payload": { "engine":"chart-builder", "config": { "task":"build", "form":"pictogram", "symbol":"person", "unit":"pupils", "data":[["Bus",12],["Walk",8],["Car",6],["Bike",4]] } }, "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:chart-builder", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the plus and minus to choose how much each square is worth, so the chart is as tall as the paper allows and every bar ends exactly on a line.", "payload": { "engine":"chart-builder", "config": { "task":"scale", "unit":"goals", "data":[["Ana",15],["Ben",35],["Cai",25],["Dee",40]] } }, "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:chart-builder", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the plus and minus to move where the axis starts, so the bars show the numbers fairly.", "payload": { "engine":"chart-builder", "config": { "task":"honest", "unit":"pupils", "title":"Pupils in each shop queue", "data":[["Shop A",36],["Shop B",39],["Shop C",37]] } }, "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:chart-builder", "why":"..." } }`,
}

registerEngine(chartBuilderEngine as SceneEngine<unknown, unknown>)
