// lib/studylab/engines/measure-shape/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MeasureShapeView } from './View'

/**
 * Two families of measuring tasks, for primary and lower-secondary numbers.
 *
 * 1. Reading scales. A ruler (cm or mm), a measuring cylinder (ml, read at the
 *    bottom of the meniscus), a thermometer (degrees Celsius, below zero too), a
 *    spring balance (N or g) or a dial kitchen scale (g or kg), drawn with
 *    numbered marks and small divisions. The tutor names the instrument and the
 *    value; the engine picks a real scale whose small divisions the value lands
 *    on, and refuses a value that lands on none (or on a numbered mark, where
 *    the reading is printed beside it). "read": the learner types the reading.
 *    "set": the learner moves the level, strip end, pointer or needle to it.
 *    What a small division is worth is the thing to work out, so it is said only
 *    once marked.
 * 2. Area and perimeter on a squared grid. "make": shade squares into one
 *    connected shape with the given area and/or perimeter; "compare": two
 *    shapes with the same area (or the same perimeter), and the learner picks
 *    the larger (or smaller) perimeter (or area). Area is the squares counted,
 *    perimeter the unit sides between a shaded square and an unshaded one (or
 *    the edge of the grid): exact integer counting throughout.
 *
 * Where the numbers come from.
 * - The scales are the ones the Cambridge Primary Mathematics framework (0096,
 *   Geometry and measure, stages 3 to 6: lengths in cm and mm, capacity in ml,
 *   mass in g and kg, temperature in degrees Celsius including below zero, and
 *   reading the scales that measure them) and Cambridge IGCSE Physics (0625,
 *   topic 1.2 Physical quantities and measurement: measuring cylinder read at
 *   the bottom of the meniscus, thermometer, newton meter) use. The
 *   catalogue of scales (range, numbered step, small step) below is a school
 *   set, each with a whole number of small divisions to a numbered one and no
 *   more than 50 in all, so a small division is always 6 px or more on screen.
 * - Area and perimeter of rectilinear shapes on squared paper: Cambridge
 *   Primary Mathematics stages 3 to 6 (perimeter and area by counting squares
 *   and sides, then of compound shapes), Lower Secondary Mathematics (0862)
 *   compound shapes.
 * - Which (area, perimeter) pairs a connected shape can have: the perimeter of
 *   a polyomino is even; for n squares it is at least 2 * ceil(2 * sqrt(n))
 *   and at most 2n + 2, and every even value between is reached (Harary and
 *   Harborth, "Extremal animals", Journal of Combinatorics, Information &
 *   System Sciences 1, 1976). The tests recheck this against every polyomino
 *   with up to nine squares, and prove the engine's own builder reaches every
 *   pair it accepts.
 */

// ---------------------------------------------------------------------------
// Numbers: every scale value is held in tenths, as a whole number.

const MINUS = '−'
export const tenths = (v: number): number => Math.round(v * 10)
export const isTenths = (v: number): boolean => Number.isFinite(v) && Math.abs(v * 10 - Math.round(v * 10)) < 1e-6

/** 74 tenths as "7.4", -70 as "−7": the way a school writes it. */
export function fmtTenths(t: number): string {
  const sign = t < 0 ? MINUS : ''
  const a = Math.abs(t)
  return a % 10 === 0 ? `${sign}${a / 10}` : `${sign}${(a / 10).toFixed(1)}`
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const slug = (raw: string) => raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-')

// ---------------------------------------------------------------------------
// Types.

export const INSTRUMENTS = ['ruler', 'cylinder', 'thermometer', 'balance', 'scales'] as const
export type Instrument = (typeof INSTRUMENTS)[number]
export type Unit = 'cm' | 'mm' | 'ml' | '°C' | 'N' | 'g' | 'kg'

/** What each instrument reads in, the commonest first. */
export const UNITS_OF: Record<Instrument, Unit[]> = {
  ruler: ['cm', 'mm'], cylinder: ['ml'], thermometer: ['°C'], balance: ['N', 'g'], scales: ['g', 'kg'],
}
export const INSTRUMENT_NAMES: Record<Instrument, string> = {
  ruler: 'ruler', cylinder: 'measuring cylinder', thermometer: 'thermometer', balance: 'spring balance', scales: 'kitchen scales',
}

type ScaleBase = { instrument: Instrument; value: number; unit?: string; step?: number }
export type ScaleTask = (ScaleBase & { kind: 'read' }) | (ScaleBase & { kind: 'set' })
export type GridUnit = 'units' | 'cm' | 'm' | 'mm'
export type MakeTask = { kind: 'make'; area?: number; perimeter?: number; unit?: string }
export type CompareTask = { kind: 'compare'; same: 'area' | 'perimeter'; value: number; ask: 'larger' | 'smaller'; unit?: string }
export type MeasureShapeConfig = { task: ScaleTask | MakeTask | CompareTask }

/**
 * read: `reading`, the learner's typed reading. set: `level`, the level in tenths
 * of a unit. make: `cells`, the shaded squares (row * columns + column).
 * compare: `pick`, 'a' or 'b'.
 */
export type MeasureShapeState = { reading?: string; level?: number; cells?: number[]; pick?: string }

// ---------------------------------------------------------------------------
// Units.

const UNIT_WORDS: Record<string, Unit> = {
  cm: 'cm', centimetre: 'cm', centimetres: 'cm', centimeter: 'cm', centimeters: 'cm',
  mm: 'mm', millimetre: 'mm', millimetres: 'mm', millimeter: 'mm', millimeters: 'mm',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml', cm3: 'ml', 'cm³': 'ml', cc: 'ml',
  '°c': '°C', 'c': '°C', '°': '°C', celsius: '°C', degrees: '°C', degree: '°C', degreesc: '°C', degreescelsius: '°C',
  n: 'N', newton: 'N', newtons: 'N',
  g: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
}

/** "ml", "millilitres", "cm³", "degrees Celsius": the unit it names, or null. */
export function readUnit(raw: unknown): Unit | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase().replace(/[\s.]+/g, '')
  return own(UNIT_WORDS, key) ? UNIT_WORDS[key] : null
}

const GRID_UNIT_WORDS: Record<string, GridUnit> = {
  unit: 'units', units: 'units', square: 'units', squares: 'units',
  cm: 'cm', centimetre: 'cm', centimetres: 'cm', centimeter: 'cm', centimeters: 'cm', 'cm²': 'cm', cm2: 'cm',
  m: 'm', metre: 'm', metres: 'm', meter: 'm', meters: 'm', 'm²': 'm', m2: 'm',
  mm: 'mm', millimetre: 'mm', millimetres: 'mm', 'mm²': 'mm', mm2: 'mm',
}
export function readGridUnit(raw: unknown): GridUnit | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase().replace(/[\s.]+/g, '')
  return own(GRID_UNIT_WORDS, key) ? GRID_UNIT_WORDS[key] : null
}

/** An area as it is said: "6 squares", "6 cm²". */
export const areaText = (n: number, unit: GridUnit = 'units'): string =>
  unit === 'units' ? `${n} square${n === 1 ? '' : 's'}` : `${n} ${unit}²`
/** A perimeter as it is said: "10 units", "10 cm". */
export const perimeterText = (n: number, unit: GridUnit = 'units'): string => (unit === 'units' ? `${n} unit${n === 1 ? '' : 's'}` : `${n} ${unit}`)

// ---------------------------------------------------------------------------
// The scales. A design is a real instrument scale, in tenths of its unit: where
// it starts and ends, the step between numbered marks (major) and the step of
// the small divisions (minor). Listed coarsest first, narrowest range first, so
// the first one a value lands on is the plainest scale that shows it.

export type Design = { unit: Unit; min: number; max: number; major: number; minor: number }
const d = (unit: Unit, min: number, max: number, major: number, minor: number): Design =>
  ({ unit, min: tenths(min), max: tenths(max), major: tenths(major), minor: tenths(minor) })

/**
 * No scale has more than this many small divisions, so each is drawn at least 6 px from the next
 * (the view draws a vertical scale 300 px long, a ruler 312 px, a dial 443 px round). A finer
 * scale is a section of the instrument: a ruler in millimetres is a 5 cm window, a clinical
 * thermometer runs 36 to 40.
 */
export const MAX_DIVISIONS = 50

export const DESIGNS: Record<Instrument, Design[]> = {
  // A 15 cm ruler: centimetres numbered, with halves; or millimetres in 5 cm sections (the strip
  // runs in from the left of a section away from zero).
  ruler: [
    d('cm', 0, 15, 1, 0.5), d('cm', 0, 5, 1, 0.1), d('cm', 5, 10, 1, 0.1), d('cm', 10, 15, 1, 0.1),
    d('mm', 0, 100, 10, 5), d('mm', 0, 50, 10, 1), d('mm', 50, 100, 10, 1), d('mm', 100, 150, 10, 1),
  ],
  cylinder: [
    d('ml', 0, 10, 1, 0.2), d('ml', 0, 25, 5, 1), d('ml', 0, 50, 10, 5), d('ml', 0, 50, 10, 2), d('ml', 0, 50, 10, 1),
    d('ml', 0, 100, 10, 5), d('ml', 0, 100, 10, 2),
    d('ml', 0, 250, 50, 25), d('ml', 0, 250, 50, 10), d('ml', 0, 250, 50, 5),
    d('ml', 0, 500, 100, 50), d('ml', 0, 500, 100, 20), d('ml', 0, 500, 100, 10),
    d('ml', 0, 1000, 100, 50), d('ml', 0, 1000, 100, 25), d('ml', 0, 1000, 100, 20),
  ],
  thermometer: [
    d('°C', -20, 50, 10, 5), d('°C', -20, 50, 10, 2),
    d('°C', -20, 30, 10, 1), d('°C', -10, 40, 10, 1), d('°C', 0, 50, 10, 1), d('°C', 50, 100, 10, 1),
    d('°C', -10, 110, 10, 5), d('°C', -10, 90, 10, 2), d('°C', 10, 110, 10, 2),
    d('°C', 0, 100, 10, 5), d('°C', 0, 100, 10, 2),
    d('°C', 36, 40, 1, 0.1),
  ],
  balance: [
    d('N', 0, 5, 1, 0.5), d('N', 0, 5, 1, 0.2), d('N', 0, 5, 1, 0.1),
    d('N', 0, 10, 1, 0.5), d('N', 0, 10, 2, 0.5), d('N', 0, 10, 1, 0.2),
    d('N', 0, 20, 5, 1), d('N', 0, 20, 2, 1),
    d('g', 0, 250, 50, 25), d('g', 0, 250, 50, 10),
    d('g', 0, 500, 100, 50), d('g', 0, 500, 100, 20), d('g', 0, 500, 100, 10),
    d('g', 0, 1000, 200, 50), d('g', 0, 1000, 100, 50),
  ],
  scales: [
    d('g', 0, 500, 100, 50), d('g', 0, 500, 100, 20), d('g', 0, 500, 100, 10),
    d('g', 0, 1000, 100, 50), d('g', 0, 1000, 100, 20),
    d('g', 0, 2000, 500, 100),
    d('kg', 0, 2, 0.5, 0.1),
    d('kg', 0, 5, 1, 0.5), d('kg', 0, 5, 1, 0.2), d('kg', 0, 5, 1, 0.1),
    d('kg', 0, 10, 2, 0.5), d('kg', 0, 10, 1, 0.5), d('kg', 0, 10, 1, 0.2),
  ],
}

/** The small divisions a scale has end to end. */
export const divisionsOf = (g: Design): number => (g.max - g.min) / g.minor
export const onDivision = (g: Design, t: number): boolean => Number.isInteger(t) && t >= g.min && t <= g.max && (t - g.min) % g.minor === 0
/** A numbered mark: the reading is printed beside it. */
export const isNumbered = (g: Design, t: number): boolean => (t - g.min) % g.major === 0

export type Tick = { t: number; kind: 'major' | 'mid' | 'minor' }
/** Every mark on a scale: numbered ones long, the half-way one a little shorter than numbered, the rest short. */
export function ticksOf(g: Design): Tick[] {
  const per = g.major / g.minor
  const out: Tick[] = []
  for (let t = g.min; t <= g.max; t += g.minor) {
    const off = (t - g.min) % g.major
    out.push({ t, kind: off === 0 ? 'major' : per % 2 === 0 && off === g.major / 2 ? 'mid' : 'minor' })
  }
  return out
}

/** A scale for a value, or null: one the value lands on a small division of, and not on a numbered mark. */
export function designFor(instrument: Instrument, units: readonly Unit[], t: number, step?: number): Design | null {
  if (!Number.isInteger(t)) return null
  for (const u of units) {
    for (const g of DESIGNS[instrument]) {
      if (g.unit !== u || !onDivision(g, t) || isNumbered(g, t)) continue
      if (step !== undefined && g.minor !== step) continue
      return g
    }
  }
  return null
}

/** The units a task's instrument is read in: the one it names, or all of the instrument's; null when it names one it cannot read in. */
function unitsOf(task: ScaleTask): Unit[] | null {
  if (task.unit === undefined) return UNITS_OF[task.instrument]
  const u = readUnit(task.unit)
  return u && UNITS_OF[task.instrument].includes(u) ? [u] : null
}

export type Resolved = { instrument: Instrument; design: Design; t: number; unit: Unit }

/** The scale a scale task is drawn on, with its value in tenths; null when no real scale shows it (faults() says why). */
export function resolveScale(task: ScaleTask): Resolved | null {
  const units = unitsOf(task)
  if (!units || !isTenths(task.value)) return null
  if (task.step !== undefined && !isTenths(task.step)) return null
  const t = tenths(task.value)
  const design = designFor(task.instrument, units, t, task.step === undefined ? undefined : tenths(task.step))
  return design ? { instrument: task.instrument, design, t, unit: design.unit } : null
}

/** Where on a scale a reading sits, said as it is seen: never as the number. */
const DIRECTION: Record<Instrument, string> = {
  ruler: 'to the right of', cylinder: 'above', thermometer: 'above', balance: 'below', scales: 'clockwise from',
}
export function positionWords(instrument: Instrument, g: Design, t: number): string {
  const base = g.min + Math.floor((t - g.min) / g.major) * g.major
  const k = Math.round((t - base) / g.minor)
  if (k === 0) return `at the ${fmtTenths(base)} mark`
  return `${k} small division${k === 1 ? '' : 's'} ${DIRECTION[instrument]} the ${fmtTenths(base)} mark`
}

/** What the scale looks like, for a screen reader: how it is numbered, never what a small division is worth. */
export function scaleWords(instrument: Instrument, g: Design): string {
  const between = g.major / g.minor - 1
  const small = between === 0 ? 'no small marks between the numbered marks' : `${between} small mark${between === 1 ? '' : 's'} between each pair of numbered marks`
  const section = instrument === 'ruler' && g.min > 0 ? ' (a section of the ruler, away from its zero end)' : ''
  return `${INSTRUMENT_NAMES[instrument]}${section}, numbered from ${fmtTenths(g.min)} to ${fmtTenths(g.max)} ${g.unit}, with ${small}`
}

/** The working shown once marked: "30 + 2 × 2 = 34". */
export function workedText(g: Design, t: number): string {
  const base = g.min + Math.floor((t - g.min) / g.major) * g.major
  const k = Math.round((t - base) / g.minor)
  const sum = k === 1 ? `${fmtTenths(base)} + ${fmtTenths(g.minor)}` : `${fmtTenths(base)} + ${k} × ${fmtTenths(g.minor)}`
  return `${sum} = ${fmtTenths(t)}`
}

/** Where a set task starts: the end of the scale farther from the value. */
export function startLevel(r: Resolved): number {
  return r.t - r.design.min >= r.design.max - r.t ? r.design.min : r.design.max
}

/** A level snapped to the nearest small division and kept on the scale. */
export function snapLevel(g: Design, raw: number): number {
  const n = Math.round((raw - g.min) / g.minor)
  const k = Math.max(0, Math.min(divisionsOf(g), n))
  return g.min + k * g.minor
}

/** The nearest value (below first on a tie) that a scale shows, for a fault to suggest. */
export function nearbyScaleValue(task: ScaleTask): Resolved | null {
  const units = unitsOf(task)
  const wanted = Number.isFinite(task.value) ? tenths(task.value) : 0
  const stepT = task.step !== undefined && isTenths(task.step) ? tenths(task.step) : undefined
  const names = units ?? UNITS_OF[task.instrument]
  const spread = Math.max(...DESIGNS[task.instrument].map((g) => g.max - g.min))
  const lo = Math.min(...DESIGNS[task.instrument].filter((g) => names.includes(g.unit)).map((g) => g.min))
  const hi = Math.max(...DESIGNS[task.instrument].filter((g) => names.includes(g.unit)).map((g) => g.max))
  // A value far off the scale is looked for from the nearest end of it.
  const centre = Math.max(lo, Math.min(hi, wanted))
  for (let off = 1; off <= spread; off++) {
    for (const t of [centre - off, centre + off]) {
      const design = designFor(task.instrument, names, t, stepT)
      if (design) return { instrument: task.instrument, design, t, unit: design.unit }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// What the learner types, and what a scale task says back.

export type Reading =
  | { ok: true; text: string; n: number; t: number }
  | { ok: false; why: 'empty' | 'format' | 'unit'; typed: string }

/** "34", "34 ml", "−7", "7.4cm": the number typed, with the unit if it is the right one. */
export function parseReading(raw: unknown, unit: Unit): Reading {
  const typed = typeof raw === 'string' ? raw.trim() : ''
  if (!typed) return { ok: false, why: 'empty', typed }
  // "3 4" is not 34.
  if (/\d\s+\d/.test(typed)) return { ok: false, why: 'format', typed }
  const s = typed.toLowerCase().replace(/[−–—]/g, '-').replace(/\s+/g, '')
  const m = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z°³]*)$/.exec(s)
  if (!m) return { ok: false, why: 'format', typed }
  const word = m[2]
  if (word && readUnit(word) !== unit) return { ok: false, why: 'unit', typed }
  const n = Number(m[1])
  if (!Number.isFinite(n)) return { ok: false, why: 'format', typed }
  return { ok: true, text: m[1].replace('-', MINUS), n, t: n * 10 }
}

const sameTenths = (a: number, b: number) => Math.abs(a - b) < 1e-6

/** The most a learner may type in the reading box: room for "−12.5 millilitres". */
export const READING_MAX = 24

/** A saved scale state read safely: a reading that is not text is empty, and a level that is off the scale is the start. */
export function readScaleState(r: Resolved, raw: unknown): { reading: string; level: number } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const level = o.level
  return {
    reading: typeof o.reading === 'string' ? o.reading.slice(0, READING_MAX) : '',
    level: typeof level === 'number' && onDivision(r.design, level) ? level : startLevel(r),
  }
}

const PLURAL = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The lines a scale card says once marked. Never called before: they name the answer. */
export function scaleSaid(task: ScaleTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const r = resolveScale(task)
  if (!r) return []
  const g = r.design
  const worked = `${workedText(g, r.t)} ${g.unit}.`
  const step = `The numbered marks go up in ${fmtTenths(g.major)} ${g.unit}, and each small division is ${fmtTenths(g.minor)} ${g.unit}.`
  const where = `The ${task.kind === 'read' ? 'level' : 'target'} is ${positionWords(r.instrument, g, r.t)}.`
  const s = readScaleState(r, state)
  if (marked !== 'wrong') {
    return task.kind === 'read'
      ? [`${fmtTenths(r.t)} ${g.unit}.`, `${where} ${worked}`, step]
      : [`Set to ${fmtTenths(r.t)} ${g.unit}.`, `${where} ${worked}`, step]
  }
  if (task.kind === 'set') {
    const level = s.level
    const off = (level - r.t) / g.minor
    return [
      `You set ${fmtTenths(level)} ${g.unit}, not ${fmtTenths(r.t)} ${g.unit}: ${PLURAL(Math.abs(off), 'small division')} too ${off > 0 ? 'high' : 'low'}.`,
      step,
    ]
  }
  const got = parseReading(s.reading, r.unit)
  if (!got.ok) {
    if (got.why === 'empty') return ['Type what the scale reads, then check.']
    if (got.why === 'unit') return [`You wrote "${got.typed}". This ${INSTRUMENT_NAMES[r.instrument]} reads in ${g.unit}: type just the number.`]
    return [`"${got.typed}" is not a number. Type the reading as a number, like ${fmtTenths(g.min + g.minor)}.`]
  }
  const lines = [`You read ${got.text} ${g.unit}.`, step]
  const whole = Math.round(got.t)
  if (got.t < g.min || got.t > g.max) {
    lines.push(`This scale only goes from ${fmtTenths(g.min)} to ${fmtTenths(g.max)} ${g.unit}.`)
  } else if (!sameTenths(got.t, whole) || !onDivision(g, whole)) {
    lines.push('That is between two small divisions. The level sits exactly on one.')
  } else if (r.instrument === 'cylinder' && sameTenths(got.t, r.t + g.minor)) {
    lines.push('Read the bottom of the curved surface (the meniscus), not the edges where the water climbs the glass.')
  } else if (r.instrument === 'thermometer' && sameTenths(got.t, -r.t)) {
    lines.push('Look at which side of 0 the level is.')
  }
  return lines
}

// ---------------------------------------------------------------------------
// The squared grid.

/** The grid a shape is made on, and the small grids two shapes are compared on. */
export const GRID_COLS = 12
export const GRID_ROWS = 8
export const MINI = 9
/** The most squares a make task may ask for, and the least. Every (area, perimeter) pair in between is built within the grid. */
export const MAX_AREA = 32
export const MIN_AREA = 3
/** The perimeters a make task asking only for a perimeter may name: up to a 12 by 8 rectangle. */
export const PERIMETER_ONLY_MAX = 40
export const PERIMETER_ONLY_MIN = 8
/** compare: the largest shared area, and the largest shared perimeter, that two shapes fit the small grids for. */
export const MAX_COMPARE_AREA = 30
export const MAX_COMPARE_PERIMETER = 32

export type Analysis = { area: number; perimeter: number; pieces: number; holes: number }

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/**
 * What a set of shaded squares is: its area (squares), its perimeter (unit sides
 * with a shaded square on one side and an unshaded square, or the edge of the
 * grid, on the other), the pieces it is in (squares joined along a side), and
 * the holes in it (unshaded squares walled in, which the outside cannot reach).
 */
export function analyse(cells: readonly number[], cols: number, rows: number): Analysis {
  const set = new Set(cells)
  let perimeter = 0
  for (const i of set) {
    const r = Math.floor(i / cols)
    const c = i % cols
    if (!(r > 0 && set.has(i - cols))) perimeter++
    if (!(r < rows - 1 && set.has(i + cols))) perimeter++
    if (!(c > 0 && set.has(i - 1))) perimeter++
    if (!(c < cols - 1 && set.has(i + 1))) perimeter++
  }
  const flood = (start: number, open: (i: number) => boolean, seen: Set<number>) => {
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const i = stack.pop()!
      const r = Math.floor(i / cols)
      const c = i % cols
      for (const [dr, dc] of NEIGHBOURS) {
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
        const j = nr * cols + nc
        if (!seen.has(j) && open(j)) {
          seen.add(j)
          stack.push(j)
        }
      }
    }
  }
  let pieces = 0
  const joined = new Set<number>()
  for (const i of set) {
    if (joined.has(i)) continue
    pieces++
    flood(i, (j) => set.has(j), joined)
  }
  // Unshaded squares the outside can reach, through a ring of empty squares round the grid.
  const outside = new Set<number>([0])
  const W = cols + 2
  const stack = [0]
  while (stack.length) {
    const i = stack.pop()!
    const r = Math.floor(i / W)
    const c = i % W
    for (const [dr, dc] of NEIGHBOURS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nc < 0 || nr >= rows + 2 || nc >= W) continue
      const j = nr * W + nc
      const real = nr >= 1 && nr <= rows && nc >= 1 && nc <= cols
      if (real && set.has((nr - 1) * cols + (nc - 1))) continue
      if (!outside.has(j)) {
        outside.add(j)
        stack.push(j)
      }
    }
  }
  let holes = 0
  const walled = new Set<number>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (set.has(i) || outside.has((r + 1) * W + (c + 1)) || walled.has(i)) continue
      holes++
      flood(i, (j) => !set.has(j), walled)
    }
  }
  return { area: set.size, perimeter, pieces, holes }
}

/** The smallest perimeter n squares can have: 2 * ceil(2 * sqrt(n)), in integers. */
export function minPerimeter(n: number): number {
  let s = Math.ceil(Math.sqrt(4 * n))
  while ((s - 1) * (s - 1) >= 4 * n) s--
  while (s * s < 4 * n) s++
  return 2 * s
}
/** The largest: squares in a line, or branching without a corner closing. */
export const maxPerimeter = (n: number): number => 2 * n + 2
/** The perimeters n squares can have: every even number from the least to the most. */
export function perimetersFor(n: number): number[] {
  const out: number[] = []
  for (let p = minPerimeter(n); p <= maxPerimeter(n); p += 2) out.push(p)
  return out
}
/** The areas a shape of perimeter p (even, 4 or more) can have: from p/2 - 1 squares to the biggest rectangle-ish block. */
export function areasFor(p: number): { least: number; most: number } {
  return { least: p / 2 - 1, most: Math.floor(p / 4) * Math.ceil(p / 4) }
}

type RC = [number, number]

/**
 * Connected shapes without holes, of `area` squares and perimeter `perimeter`,
 * that fit a grid. Built the way a child would: a block of squares laid in
 * rows (the last row part-filled, left-aligned) with a tail of single squares
 * running off its corner along the edge of the grid -- each tail square adds
 * 2 to the perimeter, each block of w columns and r rows 2 * (w + r). Every
 * candidate is checked with analyse(), so a shape that does not come out
 * exact is never offered.
 */
export function shapesWith(area: number, perimeter: number, cols: number, rows: number): number[][] {
  const out: number[][] = []
  const seen = new Set<string>()
  const add = (rc: RC[]) => {
    if (rc.some(([r, c]) => r < 0 || c < 0 || r >= rows || c >= cols)) return
    const cells = [...new Set(rc.map(([r, c]) => r * cols + c))].sort((a, b) => a - b)
    const key = cells.join(',')
    if (seen.has(key)) return
    const a = analyse(cells, cols, rows)
    if (a.area !== area || a.perimeter !== perimeter || a.pieces !== 1 || a.holes !== 0) return
    seen.add(key)
    out.push(cells)
  }
  for (let m = area; m >= 1; m--) {
    const tail = area - m
    for (let w = 1; w <= m; w++) {
      const r = Math.ceil(m / w)
      if (2 * (w + r) + 2 * tail !== perimeter) continue
      const block: RC[] = []
      for (let i = 0; i < m; i++) block.push([Math.floor(i / w), i % w])
      if (tail === 0) {
        add(block)
        continue
      }
      // Along the top row to the right, down the right edge, back along the bottom.
      const right: RC[] = []
      for (let c = w; c < cols; c++) right.push([0, c])
      for (let rr = 1; rr < rows; rr++) right.push([rr, cols - 1])
      for (let c = cols - 2; c >= 0; c--) right.push([rows - 1, c])
      if (right.length >= tail) add([...block, ...right.slice(0, tail)])
      // Down the left edge below the block, along the bottom, up the right edge.
      const down: RC[] = []
      for (let rr = r; rr < rows; rr++) down.push([rr, 0])
      for (let c = 1; c < cols; c++) down.push([rows - 1, c])
      for (let rr = rows - 2; rr >= 0; rr--) down.push([rr, cols - 1])
      if (down.length >= tail) add([...block, ...down.slice(0, tail)])
    }
  }
  return out
}

/** A shape moved to the middle of its grid. */
export function centred(cells: readonly number[], cols: number, rows: number): number[] {
  if (!cells.length) return []
  const rs = cells.map((i) => Math.floor(i / cols))
  const cs = cells.map((i) => i % cols)
  const [r0, r1, c0, c1] = [Math.min(...rs), Math.max(...rs), Math.min(...cs), Math.max(...cs)]
  const dr = Math.floor((rows - (r1 - r0 + 1)) / 2) - r0
  const dc = Math.floor((cols - (c1 - c0 + 1)) / 2) - c0
  return cells.map((i) => (Math.floor(i / cols) + dr) * cols + (i % cols) + dc).sort((a, b) => a - b)
}

/** One of the eight ways of turning or flipping a shape on a square grid, then centred. */
export function turned(cells: readonly number[], size: number, k: number): number[] {
  return centred(cells.map((i) => {
    let r = Math.floor(i / size)
    let c = i % size
    if (k & 1) c = size - 1 - c
    if (k & 2) r = size - 1 - r
    if (k & 4) [r, c] = [c, r]
    return r * size + c
  }), size, size)
}

/** A hash of text, well mixed in its low bits: the engine's own dice, so a card always deals the same. */
export function hashOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return h >>> 0
}

export type Shape = { cells: number[]; area: number; perimeter: number }
export type Pair = { a: Shape; b: Shape; answer: 'a' | 'b'; asked: 'area' | 'perimeter' }

const shapeOf = (cells: number[], size: number): Shape => {
  const a = analyse(cells, size, size)
  return { cells, area: a.area, perimeter: a.perimeter }
}

const pairCache = new Map<string, Pair | null>()

/**
 * The two shapes of a compare task, on small grids, and which holds the answer.
 * Same area: the most compact shape against one of perimeter 2 or 4 more.
 * Same perimeter: the biggest area against one of 1 to 3 squares fewer. Which
 * side the answer sits on, and which turn each shape has, come from a hash of
 * the task, so it is the same each time and not readable off the layout.
 */
export function comparePair(task: CompareTask): Pair | null {
  const key = `${task.same}:${task.value}:${task.ask}`
  if (pairCache.has(key)) return pairCache.get(key)!
  let pair: Pair | null = null
  if (Number.isInteger(task.value)) {
    const h = hashOf(key)
    const pick = <T,>(list: T[], bits: number) => list[bits % list.length]
    let small: Shape | null = null
    let big: Shape | null = null
    if (task.same === 'area') {
      const n = task.value
      const ps = perimetersFor(n).filter((p) => shapesWith(n, p, MINI, MINI).length > 0)
      if (ps.length >= 2) {
        const up = ps[1 + ((h >>> 3) % Math.min(2, ps.length - 1))]
        small = shapeOf(turned(pick(shapesWith(n, ps[0], MINI, MINI), h >>> 5), MINI, (h >>> 9) & 7), MINI)
        big = shapeOf(turned(pick(shapesWith(n, up, MINI, MINI), h >>> 11), MINI, (h >>> 15) & 7), MINI)
      }
    } else if (task.value % 2 === 0 && task.value >= 4) {
      const p = task.value
      const { least, most } = areasFor(p)
      const ok = (a: number) => shapesWith(a, p, MINI, MINI).length > 0
      const down: number[] = []
      for (let a = most - 1; a >= least && down.length < 3; a--) if (ok(a)) down.push(a)
      if (ok(most) && down.length) {
        const lower = down[(h >>> 3) % down.length]
        small = shapeOf(turned(pick(shapesWith(lower, p, MINI, MINI), h >>> 5), MINI, (h >>> 9) & 7), MINI)
        big = shapeOf(turned(pick(shapesWith(most, p, MINI, MINI), h >>> 11), MINI, (h >>> 15) & 7), MINI)
      }
    }
    if (small && big) {
      // The side holding the bigger measure is a coin the hash tosses; "smaller" flips which holds the answer.
      const bigFirst = ((h >>> 7) & 1) === 0
      const [a, b] = bigFirst ? [big, small] : [small, big]
      const bigSide: 'a' | 'b' = bigFirst ? 'a' : 'b'
      const smallSide: 'a' | 'b' = bigFirst ? 'b' : 'a'
      pair = { a, b, answer: task.ask === 'larger' ? bigSide : smallSide, asked: task.same === 'area' ? 'perimeter' : 'area' }
    }
  }
  pairCache.set(key, pair)
  return pair
}

/** A shape for a make task, centred in its grid; null when none fits (faults() says so first). */
export function solveShape(task: MakeTask): number[] | null {
  const { area, perimeter } = task
  if (area !== undefined) {
    const p = perimeter ?? minPerimeter(area)
    const found = shapesWith(area, p, GRID_COLS, GRID_ROWS)[0]
    return found ? centred(found, GRID_COLS, GRID_ROWS) : null
  }
  if (perimeter === undefined) return null
  // A rectangle: width + height is half the perimeter, as square as the grid allows.
  const half = perimeter / 2
  let h = Math.min(GRID_ROWS, Math.floor(half / 2))
  let w = half - h
  while (w > GRID_COLS && h < GRID_ROWS) {
    h++
    w--
  }
  if (w > GRID_COLS || h < 1 || w < 1) return null
  const cells: number[] = []
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push(r * GRID_COLS + c)
  return centred(cells, GRID_COLS, GRID_ROWS)
}

/** The squares a make state holds, read safely. */
export function readCells(raw: unknown, cols = GRID_COLS, rows = GRID_ROWS): number[] {
  const list = (raw as { cells?: unknown } | null)?.cells
  if (!Array.isArray(list)) return []
  const ok = list.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < cols * rows)
  return [...new Set(ok)].sort((a, b) => a - b)
}

/** Whether a make task's targets are met by a set of squares, and what is wrong if not. */
export function makeVerdict(task: MakeTask, cells: readonly number[]): Analysis & { ok: boolean; areaOk: boolean; perimeterOk: boolean } {
  const a = analyse(cells, GRID_COLS, GRID_ROWS)
  const areaOk = task.area === undefined || a.area === task.area
  const perimeterOk = task.perimeter === undefined || a.perimeter === task.perimeter
  return { ...a, areaOk, perimeterOk, ok: a.area > 0 && a.pieces === 1 && a.holes === 0 && areaOk && perimeterOk }
}

const gridUnitOf = (task: { unit?: string }): GridUnit => readGridUnit(task.unit) ?? 'units'

/** "Row 2, columns 3 to 5; row 3, column 3": a shape said in words, for a screen reader. */
export function runsText(cells: readonly number[], cols: number): string {
  const rows = new Map<number, number[]>()
  for (const i of [...cells].sort((a, b) => a - b)) {
    const r = Math.floor(i / cols)
    rows.set(r, [...(rows.get(r) ?? []), (i % cols) + 1])
  }
  const parts: string[] = []
  for (const [r, cs] of rows) {
    const runs: string[] = []
    for (let i = 0; i < cs.length; ) {
      let j = i
      while (j + 1 < cs.length && cs[j + 1] === cs[j] + 1) j++
      runs.push(i === j ? `column ${cs[i]}` : `columns ${cs[i]} to ${cs[j]}`)
      i = j + 1
    }
    parts.push(`row ${r + 1}, ${runs.join(' and ')}`)
  }
  return parts.join('; ')
}

/** The lines a make card says once marked. */
export function makeSaid(task: MakeTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const unit = gridUnitOf(task)
  const cells = readCells(state)
  const v = makeVerdict(task, cells)
  if (marked !== 'wrong') {
    return [
      `Area ${areaText(v.area, unit)}, perimeter ${perimeterText(v.perimeter, unit)}.`,
      'Area is the squares counted. Perimeter is the sides of squares counted round the outside.',
    ]
  }
  if (!cells.length) return ['No squares are shaded yet. Shade squares to build the shape.']
  if (v.pieces > 1) {
    return [`Your ${cells.length} squares make ${v.pieces} separate pieces. The shape must be one piece, with squares joined along a whole side (touching at a corner is not joined).`]
  }
  if (v.holes > 0) {
    return ['There is a hole inside your shape. Perimeter is measured round the outside of one solid shape, so fill the hole or open it to the outside.']
  }
  const lines = [`You made area ${areaText(v.area, unit)} and perimeter ${perimeterText(v.perimeter, unit)}.`]
  if (task.area !== undefined) lines.push(v.areaOk ? `The area is right.` : `The area needs to be ${areaText(task.area, unit)}.`)
  if (task.perimeter !== undefined) lines.push(v.perimeterOk ? `The perimeter is right.` : `The perimeter needs to be ${perimeterText(task.perimeter, unit)}.`)
  return lines
}

/** The lines a compare card says once marked. */
export function compareSaid(task: CompareTask, state: unknown, marked: 'right' | 'wrong' | 'shown'): string[] {
  const pair = comparePair(task)
  if (!pair) return []
  const unit = gridUnitOf(task)
  const measure = (s: Shape) => (pair.asked === 'perimeter' ? perimeterText(s.perimeter, unit) : areaText(s.area, unit))
  const shared = task.same === 'area' ? `area ${areaText(task.value, unit)}` : `perimeter ${perimeterText(task.value, unit)}`
  const winner = pair.answer.toUpperCase()
  const lines = [`Shape A: ${pair.asked} ${measure(pair.a)}. Shape B: ${pair.asked} ${measure(pair.b)}.`]
  if (marked === 'wrong') {
    const pick = (state as { pick?: unknown } | null)?.pick
    lines.unshift(pick === 'a' || pick === 'b' ? `You picked shape ${pick.toUpperCase()}.` : 'Pick a shape first.')
  }
  lines.push(`Shape ${winner} has the ${task.ask} ${pair.asked}. Both have ${shared}.`)
  if (marked !== 'wrong') {
    lines.push(task.same === 'area' ? 'Shapes with the same area can have different perimeters.' : 'Shapes with the same perimeter can have different areas.')
  }
  return lines
}

// ---------------------------------------------------------------------------
// Reading what the tutor writes.

/** A number, written as a number or with its unit ("34 ml", "−7 °C", "6 squares"); null for anything else. */
function readNum(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw !== 'string') return null
  const m = /^\s*([-+−–]?)\s*(\d+(?:\.\d+)?|\.\d+)\s*[a-z°²³ ]*$/i.exec(raw)
  if (!m) return null
  return (m[1] === '-' || m[1] === '−' || m[1] === '–' ? -1 : 1) * Number(m[2]) + 0
}

const KIND_WORDS: Record<string, 'read' | 'set' | 'make' | 'compare'> = {
  'read': 'read', 'reading': 'read', 'read-scale': 'read', 'read-the-scale': 'read', 'read-value': 'read', 'read-reading': 'read',
  'set': 'set', 'set-level': 'set', 'set-to': 'set', 'set-reading': 'set', 'set-value': 'set', 'show': 'set', 'show-value': 'set',
  'mark': 'set', 'adjust': 'set', 'move': 'set',
  'make': 'make', 'make-shape': 'make', 'build': 'make', 'build-shape': 'make', 'draw': 'make', 'draw-shape': 'make',
  'shade': 'make', 'shade-shape': 'make', 'construct': 'make',
  'compare': 'compare', 'compare-shapes': 'compare', 'which-is-larger': 'compare', 'pick': 'compare', 'choose': 'compare',
}
const INSTRUMENT_WORDS: Record<string, Instrument> = {
  'ruler': 'ruler', 'rule': 'ruler', 'metre-rule': 'ruler', 'ruler-cm': 'ruler', 'ruler-mm': 'ruler',
  'cylinder': 'cylinder', 'measuring-cylinder': 'cylinder', 'graduated-cylinder': 'cylinder', 'measuring-jug': 'cylinder', 'jug': 'cylinder',
  'thermometer': 'thermometer', 'temperature': 'thermometer',
  'balance': 'balance', 'spring-balance': 'balance', 'newton-meter': 'balance', 'newtonmeter': 'balance', 'newton-metre': 'balance',
  'force-meter': 'balance', 'forcemeter': 'balance', 'spring-scale': 'balance', 'spring-scales': 'balance',
  'scales': 'scales', 'scale': 'scales', 'kitchen-scales': 'scales', 'kitchen-scale': 'scales', 'weighing-scales': 'scales',
  'weighing-scale': 'scales', 'dial-scales': 'scales',
}
const LARGER = ['larger', 'bigger', 'greater', 'longer', 'more', 'largest', 'biggest', 'greatest', 'longest', 'most']
const SMALLER = ['smaller', 'shorter', 'less', 'fewer', 'smallest', 'shortest', 'least']

function readAsk(raw: unknown): 'larger' | 'smaller' | null {
  if (raw === undefined) return 'larger'
  if (typeof raw !== 'string') return null
  const key = slug(raw)
  return LARGER.includes(key) ? 'larger' : SMALLER.includes(key) ? 'smaller' : null
}

function readTaskKind(raw: unknown): 'read' | 'set' | 'make' | 'compare' | null {
  if (typeof raw !== 'string') return null
  const key = slug(raw)
  return own(KIND_WORDS, key) ? KIND_WORDS[key] : null
}

function withOptionalUnit<T extends object>(task: T, raw: unknown): T & { unit?: string } {
  const text = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
  if (text === undefined) return task
  const known = readUnit(text) ?? readGridUnit(text)
  return { ...task, unit: known ?? text }
}

// ---------------------------------------------------------------------------
// What would teach nothing, or wrongly: in words a writer can act on.

const listOr = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`)
const stepsOf = (instrument: Instrument, units: readonly Unit[]) =>
  [...new Set(DESIGNS[instrument].filter((g) => units.includes(g.unit)).map((g) => `${fmtTenths(g.minor)} ${g.unit}`))]

function scaleFaults(task: ScaleTask): string[] {
  const inst = task.instrument
  const name = INSTRUMENT_NAMES[inst]
  const allowed = UNITS_OF[inst]
  let units: Unit[] = allowed
  if (task.unit !== undefined) {
    const u = readUnit(task.unit)
    if (!u) return [`"${task.unit}" is not a unit a ${name} can be drawn in. Use ${listOr(allowed)}.`]
    if (!allowed.includes(u)) return [`A ${name} reads in ${listOr(allowed)}, not ${u}. Use ${listOr(allowed)}.`]
    units = [u]
  }
  const here = units[0]
  // With no unit named, a value is not tied to one: "34.5" rather than "34.5 g".
  const say = (v: number) => (units.length === 1 ? `${fmtTenths(tenths(v))} ${here}` : `${v}`)
  const eg = () => {
    const near = nearbyScaleValue(task)
    return near ? ` Use e.g. ${fmtTenths(near.t)} ${near.unit}.` : ''
  }
  if (task.step !== undefined) {
    const step = task.step
    const has = isTenths(step) && DESIGNS[inst].some((g) => units.includes(g.unit) && g.minor === tenths(step))
    if (!has) {
      return [`No ${name} scale here has small divisions of ${step}${units.length === 1 ? ` ${here}` : ''}: they are ${listOr(stepsOf(inst, units))}. Use one of those, or leave the step out.`]
    }
  }
  if (!isTenths(task.value)) {
    return [`${say(task.value)} is finer than any ${name} scale here shows (the smallest division is ${fmtTenths(Math.min(...DESIGNS[inst].filter((g) => units.includes(g.unit)).map((g) => g.minor)))} ${here}). Round it to a whole division.${eg()}`]
  }
  const t = tenths(task.value)
  const fit = DESIGNS[inst].filter((g) => units.includes(g.unit) && (task.step === undefined || g.minor === tenths(task.step)))
  const inRange = fit.filter((g) => t >= g.min && t <= g.max)
  if (!inRange.length) {
    const lo = Math.min(...fit.map((g) => g.min))
    const hi = Math.max(...fit.map((g) => g.max))
    return [`${say(task.value)} is outside every ${name} scale here (they run from ${fmtTenths(lo)} to ${fmtTenths(hi)} ${here}).${eg()}`]
  }
  const landing = inRange.filter((g) => onDivision(g, t))
  if (!landing.length) {
    const have = [...new Set(inRange.map((g) => `${fmtTenths(g.minor)} ${g.unit}`))]
    return [`${say(task.value)} is not on a small division of any ${name} scale that reaches it (their small divisions are ${listOr(have)}), and a reading has to land exactly on one.${eg()}`]
  }
  if (!landing.some((g) => !isNumbered(g, t))) {
    return [`${say(task.value)} is a numbered mark on every ${name} scale that reaches it, so the number is printed beside the reading and there is nothing to work out. Choose a value between the numbered marks.${eg()}`]
  }
  return []
}

/** The nearest even perimeter in [lo, hi], taking odd ones down first when it can. */
function evenWithin(p: number, lo: number, hi: number): number {
  const q = Math.max(lo, Math.min(hi, Math.round(p)))
  if (q % 2 === 0) return q
  return q - 1 >= lo ? q - 1 : q + 1
}

function makeFaults(task: MakeTask): string[] {
  const { area, perimeter } = task
  if (task.unit !== undefined && readGridUnit(task.unit) === null) {
    return [`"${task.unit}" is not a unit for a squared grid. Use cm, m, mm or leave it out.`]
  }
  if (area === undefined && perimeter === undefined) return ['Name an area, a perimeter, or both for the shape to have.']
  if (area !== undefined) {
    if (!Number.isInteger(area)) return [`An area of ${area} is not a whole number of squares. Use a whole number from ${MIN_AREA} to ${MAX_AREA}.`]
    if (area < MIN_AREA) return [`${area} square${area === 1 ? '' : 's'} can only be made one way, so there is nothing to work out. Use ${MIN_AREA} or more, e.g. area 6 with perimeter 10.`]
    if (area > MAX_AREA) return [`${area} squares is more than the grid is built for (${MAX_AREA}). Use a smaller area, e.g. area 24 with perimeter 20.`]
  }
  if (perimeter !== undefined) {
    if (!Number.isInteger(perimeter)) return [`A perimeter of ${perimeter} is not a whole number of unit sides. Use an even whole number from ${PERIMETER_ONLY_MIN}.`]
    if (perimeter % 2 !== 0) {
      const near = area !== undefined ? evenWithin(perimeter, minPerimeter(area), maxPerimeter(area)) : evenWithin(perimeter, PERIMETER_ONLY_MIN, PERIMETER_ONLY_MAX)
      return [`A perimeter of ${perimeter} cannot happen: on a squared grid a perimeter is always even (the sides come in pairs, across and up). Use ${area !== undefined ? `area ${area} with perimeter ${near}` : near}.`]
    }
    if (perimeter < PERIMETER_ONLY_MIN && area === undefined) return [`A perimeter of ${perimeter} is one square or a pair, so there is nothing to work out. Use ${PERIMETER_ONLY_MIN} or more, e.g. perimeter 12.`]
    if (perimeter > PERIMETER_ONLY_MAX && area === undefined) return [`A perimeter of ${perimeter} is more than the grid holds (${PERIMETER_ONLY_MAX}). Use a smaller one, e.g. perimeter 24.`]
  }
  if (area !== undefined && perimeter !== undefined) {
    const lo = minPerimeter(area)
    const hi = maxPerimeter(area)
    const all = perimetersFor(area)
    const have = `${area} squares can have a perimeter of ${all.length <= 4 ? listOr(all.map(String)) : `${lo} to ${hi}, in twos`}`
    if (perimeter < lo || perimeter > hi) {
      const ar = areasFor(perimeter)
      const alt = perimeter >= 4 && ar.least >= MIN_AREA ? `, or keep perimeter ${perimeter} and use an area from ${Math.max(ar.least, MIN_AREA)} to ${Math.min(ar.most, MAX_AREA)}` : ''
      return [`No shape of ${area} squares has a perimeter of ${perimeter}: ${perimeter < lo ? `the least is ${lo} (squares packed as close to a square as they go)` : `the most is ${hi} (squares in a line or branching)`}. ${have}. Use area ${area} with perimeter ${evenWithin(perimeter, lo, hi)}${alt}.`]
    }
    if (!shapesWith(area, perimeter, GRID_COLS, GRID_ROWS).length) {
      return [`A shape of ${area} squares and perimeter ${perimeter} needs more room than the grid has. Use a smaller pair, e.g. area ${Math.min(area, 12)} with perimeter ${minPerimeter(Math.min(area, 12))}.`]
    }
  }
  return []
}

function compareFaults(task: CompareTask): string[] {
  if (task.unit !== undefined && readGridUnit(task.unit) === null) {
    return [`"${task.unit}" is not a unit for a squared grid. Use cm, m, mm or leave it out.`]
  }
  const n = task.value
  if (!Number.isInteger(n)) return [`${n} is not a whole number. Use a whole number of ${task.same === 'area' ? 'squares' : 'units'}.`]
  if (task.same === 'area') {
    if (n < 4) return [`${n} squares can only have one perimeter (${maxPerimeter(n)}), so there are no two shapes to tell apart. Use 4 or more squares, e.g. 6.`]
    if (n > MAX_COMPARE_AREA) return [`${n} squares is more than the small grids hold (${MAX_COMPARE_AREA}). Use a smaller area, e.g. 12.`]
  } else {
    if (n % 2 !== 0) return [`A perimeter of ${n} cannot happen: on a squared grid it is always even. Use ${evenWithin(n, 8, MAX_COMPARE_PERIMETER)}.`]
    if (n < 8) return [`A perimeter of ${n} fits only one area, so there are no two shapes to tell apart. Use 8 or more, e.g. 12.`]
    if (n > MAX_COMPARE_PERIMETER) return [`A perimeter of ${n} is more than the small grids hold (${MAX_COMPARE_PERIMETER}). Use a smaller one, e.g. 20.`]
  }
  return comparePair(task) ? [] : [`Two shapes for ${task.same} ${n} do not fit the small grids. Use a smaller number, e.g. ${task.same === 'area' ? 6 : 12}.`]
}

// ---------------------------------------------------------------------------
// The prompt a card is written with.

/** Numbers a prompt writes, as numbers: "7.4", "34", "-5". A dash straight after a digit is a range ("0-100"), not a sign. */
function numbersIn(text: string): number[] {
  const t = text.replace(/[−–]/g, '-')
  const out: number[] = []
  for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) {
    const at = m.index ?? 0
    out.push((t[at - 1] === '-' && !/[\d)]/.test(t[at - 2] ?? '') ? -1 : 1) * Number(m[0]))
  }
  return out
}

const sentences = (text: string) => text.split(/[.?!]+\s+/)

function promptFaultsFor(config: MeasureShapeConfig, prompt: string): string[] {
  const task = config.task
  const out: string[] = []
  const counted = /(?:each|every)\s+(?:small\s+)?(?:division|mark|line|tick|step)s?\b[^.?!]{0,25}?\d/i
  if (task.kind === 'read' || task.kind === 'set') {
    const said = counted.exec(prompt)
    if (said) {
      out.push(`the prompt says what a small division is worth ("${said[0].trim()}"), which the learner is to work out from the scale: leave it out and ask only for the ${task.kind === 'read' ? 'reading' : 'setting'}.`)
    }
    const r = resolveScale(task)
    if (task.kind === 'read' && r && numbersIn(prompt).some((n) => sameTenths(n * 10, r.t))) {
      out.push(`the prompt gives the reading away (${fmtTenths(r.t)} ${r.unit}), which the learner reads off the scale: ask them to read the ${INSTRUMENT_NAMES[r.instrument]} without saying the value.`)
    }
    const counting = /\b\d+\s+small\s+(?:division|mark)s?\s+(?:above|below|past|after|from|to the right)/i.exec(prompt)
    if (counting) out.push(`the prompt counts the small divisions ("${counting[0].trim()}"), which is the reading work: leave it to the learner.`)
    return out
  }
  if (task.kind === 'make') {
    for (const m of prompt.matchAll(/(\d+)\s*(?:by|x|×|-by-)\s*(\d+)/gi)) {
      const [w, h] = [Number(m[1]), Number(m[2])]
      if ((task.area === undefined || w * h === task.area) && (task.perimeter === undefined || 2 * (w + h) === task.perimeter)) {
        out.push(`the prompt gives the shape away ("${m[0]}"): name the area and the perimeter and let the learner find a shape ("Make a shape with area ${task.area ?? '...'} and perimeter ${task.perimeter ?? '...'}.").`)
        break
      }
    }
    return out
  }
  // compare
  const pair = comparePair(task)
  const hidden = task.same === 'area' ? 'perimeter' : 'area'
  const letter = /\b(?:[Ss]hape\s+)?([AB])\s+(?:has|is|will have|must have|gets|wins)\b([^.?!]{0,30})/g
  for (const m of prompt.matchAll(letter)) {
    if (/larger|bigger|greater|longer|smaller|shorter|most|least|more|fewer|less/i.test(m[2])) {
      out.push(`the prompt says which shape is bigger ("${m[0].trim()}"), which the learner is to work out: ask which one and leave the answer out.`)
      break
    }
  }
  if (/\b(?:answer|solution)\s*(?:is|=|:)\s*(?:[Ss]hape\s+)?[AB]\b/.test(prompt)) {
    out.push('the prompt names the answer: ask which shape and leave the answer out.')
  }
  if (pair) {
    const values = [pair.a, pair.b].map((s) => (hidden === 'perimeter' ? s.perimeter : s.area))
    const near: number[] = []
    for (const m of prompt.matchAll(new RegExp(`${hidden}[^.?!\\d]{0,25}(\\d+)`, 'gi'))) near.push(Number(m[1]))
    for (const m of prompt.matchAll(new RegExp(`(\\d+)[^.?!\\d]{0,15}${hidden}`, 'gi'))) near.push(Number(m[1]))
    const given = near.find((n) => values.includes(n) && n !== task.value)
    if (given !== undefined) out.push(`the prompt gives a ${hidden} away (${given}), which the learner counts on the grid: say only what the shapes share.`)
  }
  // The card asks one question, in the card; a prompt asking the opposite contradicts it.
  const has = (s: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(s))
  const wrongWay = task.ask === 'larger' ? SMALLER : LARGER
  const rightWay = task.ask === 'larger' ? LARGER : SMALLER
  for (const s of sentences(prompt)) {
    if (/\bwhich\b/i.test(s) && has(s, wrongWay) && !has(s, rightWay)) {
      out.push(`the prompt asks which shape is ${task.ask === 'larger' ? 'smaller' : 'larger'}, but this card asks which is ${task.ask}: ask the same question the card does.`)
      break
    }
    if (/\bwhich\b/i.test(s) && has(s, [task.same]) && !has(s, [hidden])) {
      out.push(`the prompt asks about the ${task.same}, but the shapes share it and this card asks which has the ${task.ask} ${hidden}.`)
      break
    }
  }
  return out
}

// ---------------------------------------------------------------------------

export const measureShapeEngine: SceneEngine<MeasureShapeConfig, MeasureShapeState> = {
  id: 'measure-shape',
  // Phrases a station on these ideas would use: "area" alone is also urban areas and the area of a circle.
  covers: [
    'reading scales', 'measuring cylinder', 'thermometer', 'area and perimeter', 'area by counting squares',
    'perimeter of rectangles', 'compound shapes',
  ],
  // The learner moves a measured quantity: a level on a scale, or the length round and the squares inside a shape.
  isolates: 'magnitude',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const kind = readTaskKind(t.kind)
    if (!kind) return null

    if (kind === 'read' || kind === 'set') {
      const word = typeof t.instrument === 'string' ? slug(t.instrument) : ''
      const instrument = own(INSTRUMENT_WORDS, word) ? INSTRUMENT_WORDS[word] : null
      const value = readNum(first(t, ['value', 'reading', 'target', 'level']))
      if (!instrument || value === null) return null
      const stepRaw = first(t, ['step', 'division', 'small_division', 'smallDivision'])
      const step = stepRaw === undefined ? undefined : readNum(stepRaw)
      if (step === null) return null
      const base: ScaleTask = { kind, instrument, value, ...(step !== undefined ? { step } : {}) }
      return { task: withOptionalUnit(base, t.unit) }
    }

    if (kind === 'make') {
      const a = first(t, ['area', 'squares'])
      const p = first(t, ['perimeter', 'perim'])
      const area = a === undefined ? undefined : readNum(a)
      const perimeter = p === undefined ? undefined : readNum(p)
      if (area === null || perimeter === null) return null
      if (area === undefined && perimeter === undefined) return null
      const base: MakeTask = { kind, ...(area !== undefined ? { area } : {}), ...(perimeter !== undefined ? { perimeter } : {}) }
      return { task: withOptionalUnit(base, t.unit) }
    }

    // compare: which measure is shared, and its value.
    const area = first(t, ['area'])
    const perimeter = first(t, ['perimeter'])
    const sameRaw = typeof t.same === 'string' ? slug(t.same) : undefined
    let same: 'area' | 'perimeter' | null = sameRaw === 'area' ? 'area' : sameRaw === 'perimeter' ? 'perimeter' : null
    if (sameRaw !== undefined && !same) return null
    if (!same) {
      if ((area === undefined) === (perimeter === undefined)) return null
      same = area !== undefined ? 'area' : 'perimeter'
    }
    const value = readNum(first(t, ['value', same]))
    const ask = readAsk(t.ask ?? t.which)
    if (value === null || !ask) return null
    return { task: withOptionalUnit({ kind, same, value, ask } as CompareTask, t.unit) }
  },

  faults(config) {
    const task = config.task
    if (task.kind === 'read' || task.kind === 'set') return scaleFaults(task)
    return task.kind === 'make' ? makeFaults(task) : compareFaults(task)
  },

  promptFaults(config, prompt) {
    return promptFaultsFor(config, prompt)
  },

  initial(config) {
    const task = config.task
    if (task.kind === 'read') return { reading: '' }
    if (task.kind === 'set') {
      const r = resolveScale(task)
      return { level: r ? startLevel(r) : 0 }
    }
    return task.kind === 'make' ? { cells: [] } : { pick: '' }
  },

  check(config, state) {
    const task = config.task
    let ok = false
    if (task.kind === 'read' || task.kind === 'set') {
      const r = resolveScale(task)
      if (r) {
        const s = readScaleState(r, state)
        if (task.kind === 'read') {
          const got = parseReading(s.reading, r.unit)
          ok = got.ok && sameTenths(got.t, r.t)
        } else {
          ok = s.level === r.t
        }
      }
    } else if (task.kind === 'make') {
      ok = makeVerdict(task, readCells(state)).ok
    } else {
      const pair = comparePair(task)
      ok = !!pair && (state as { pick?: unknown } | null)?.pick === pair.answer
    }
    return { ok, wrongIds: [] }
  },

  solve(config) {
    const task = config.task
    if (task.kind === 'read' || task.kind === 'set') {
      const r = resolveScale(task)
      if (!r) return task.kind === 'read' ? { reading: '' } : { level: 0 }
      return task.kind === 'read' ? { reading: fmtTenths(r.t) } : { level: r.t }
    }
    if (task.kind === 'make') return { cells: solveShape(task) ?? [] }
    return { pick: comparePair(task)?.answer ?? '' }
  },

  View: MeasureShapeView,

  prompt: `SCENE "measure-shape" -- two families of measuring tasks, ages 7-14.
  (1) READING SCALES. An instrument drawn with numbered marks and small divisions: a "ruler" with a strip laid along it
  (cm or mm), a measuring "cylinder" (ml; the water has a curved surface, read at the bottom of the curve), a
  "thermometer" (degrees C, below zero too), a "balance" (spring balance, N or g) or "scales" (dial kitchen scales, g
  or kg). The engine chooses a real scale so the value falls on an unnumbered small division. The card never prints
  the reading, nor what a small division is worth, until it is marked.
  "read": the learner types the reading in a box. "set": the card states the target and the learner drags the level,
  strip end, pointer or needle to it (or uses the arrow keys); no number follows the level as it moves.
  (2) AREA AND PERIMETER on a squared grid. "make": the learner shades squares (click, tap, drag or keys) into one connected
  shape of the given area and/or perimeter; the grid shows the shape and its outline but no count. "compare": two
  shapes (A and B) are drawn with the same area, or the same perimeter, and the learner picks the one with the
  larger or smaller perimeter, or area. Areas, perimeters and the method are given once marked.
  For: reading scales, measuring cylinder, thermometer, reading a ruler, area, perimeter, compound shapes.
  config: { "task": { "kind":"read", "instrument":"<ruler | cylinder | thermometer | balance | scales>", "value":<number>,
            "unit":"<optional: cm mm ml C N g kg>", "step":<optional: what each small division is worth> } }
            -- the learner types the reading
       or { "task": { "kind":"set", ...same fields } }  -- the learner sets the level to the value
            value must land on a small division and not on a numbered mark. Ruler 0-15 cm/150 mm (millimetre marks in
            5 cm sections), cylinder 0-1000 ml, thermometer -20 to 110 C (0.1 C only from 36 to 40), balance 0-20 N or
            0-1000 g, scales 0-2000 g or 0-10 kg. A value that does not is refused, with a nearby one that works.
       or { "task": { "kind":"make", "area":<3-32 squares>, "perimeter":<even>, "unit":"<optional: cm m mm>" } }
            -- give area, perimeter or both. Perimeter is always even, between 2*ceil(2*sqrt(area)) and 2*area+2.
       or { "task": { "kind":"compare", "same":"<area | perimeter>", "value":<n>, "ask":"<larger | smaller>" } }
            -- same area 4-30: pick the larger or smaller perimeter; same perimeter 8-32 (even): pick the larger or smaller area
  - the prompt names the instrument and what to do. It never gives the reading, what a small division is worth, a
    shape's dimensions, or which shape is larger.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Read the level of the water in the measuring cylinder.",
    "payload": { "engine":"measure-shape", "config": { "task": { "kind":"read", "instrument":"cylinder", "value":34 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:measure-shape", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Set the thermometer to -7 degrees C.",
    "payload": { "engine":"measure-shape", "config": { "task": { "kind":"set", "instrument":"thermometer", "value":-7 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:measure-shape", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Shade squares to make one shape with area 6 squares and perimeter 12 units.",
    "payload": { "engine":"measure-shape", "config": { "task": { "kind":"make", "area":6, "perimeter":12 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:measure-shape", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Both shapes cover the same area. Which has the larger perimeter?",
    "payload": { "engine":"measure-shape", "config": { "task": { "kind":"compare", "same":"area", "value":8, "ask":"larger" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:measure-shape", "why":"..." } }`,
}

registerEngine(measureShapeEngine as SceneEngine<unknown, unknown>)
