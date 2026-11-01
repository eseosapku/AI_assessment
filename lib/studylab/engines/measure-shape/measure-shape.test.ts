import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  measureShapeEngine as engine, DESIGNS, GRID_COLS, GRID_ROWS, INSTRUMENTS, MAX_AREA, MAX_DIVISIONS, MAX_COMPARE_AREA, MAX_COMPARE_PERIMETER,
  MINI, MIN_AREA, PERIMETER_ONLY_MAX, PERIMETER_ONLY_MIN, UNITS_OF,
  analyse, areaText, areasFor, centred, compareSaid, comparePair, designFor, divisionsOf, fmtTenths, hashOf, isNumbered,
  isTenths, makeSaid, makeVerdict, maxPerimeter, minPerimeter, nearbyScaleValue, onDivision, parseReading, perimeterText,
  perimetersFor, positionWords, readCells, readUnit, resolveScale, runsText, scaleSaid, scaleWords, shapesWith, snapLevel,
  solveShape, startLevel, tenths, ticksOf, turned, workedText,
  type CompareTask, type Design, type Instrument, type MakeTask, type MeasureShapeConfig, type ScaleTask,
} from './config'
import { DIAL, MAKE_LOOK, MIN_GAP, MINI_LOOK, MeasureShapeView, RULER_BOX, VERT, dialAngle, layoutScale, outlineEdges } from './View'
import { getEngine } from '../registry'
import type { SceneMarked } from '../types'
import { meaningFaults } from '../../meaning'
import { validateSpec } from '../../activities/validate'
import { dimensionsOf } from '../../activities/dimensions'
import { sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * Reading scales, and area and perimeter on a squared grid: the tutor names an
 * instrument and a value, or a shape's area and perimeter, and the engine draws
 * the real scale (or the grid), counts exactly, and marks what the learner does.
 */

const scale = (kind: 'read' | 'set', instrument: Instrument, value: number, extra: Partial<ScaleTask> = {}): MeasureShapeConfig =>
  ({ task: { kind, instrument, value, ...extra } as ScaleTask })
const make = (area?: number, perimeter?: number, extra: Partial<MakeTask> = {}): MeasureShapeConfig =>
  ({ task: { kind: 'make', ...(area !== undefined ? { area } : {}), ...(perimeter !== undefined ? { perimeter } : {}), ...extra } })
const compare = (same: 'area' | 'perimeter', value: number, ask: 'larger' | 'smaller' = 'larger'): MeasureShapeConfig =>
  ({ task: { kind: 'compare', same, value, ask } as CompareTask })

/** The example the brief names: 34 ml on a measuring cylinder, small divisions of 2 ml. */
const CYL = scale('read', 'cylinder', 34)
const THERMO = scale('set', 'thermometer', -7)

/** At (row, column) pairs of a 12 by 8 grid. */
const at = (...rc: [number, number][]) => rc.map(([r, c]) => r * GRID_COLS + c)

/** What a person or a screen reader is given: visible text, and the labels read aloud. */
function said(html: string): { texts: string; aloud: string } {
  const texts = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]).join(' | ')
  const aloud = [...html.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((m) => m[1]).join(' | ')
  return { texts, aloud }
}
const numberTokens = (text: string) => [...text.matchAll(/(?<![\d.])\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))

describe('numbers, units and the words a school writes', () => {
  it('holds values in tenths and writes them the way a school does', () => {
    expect(tenths(7.4)).toBe(74)
    expect(tenths(-7)).toBe(-70)
    expect(isTenths(7.4)).toBe(true)
    expect(isTenths(7.45)).toBe(false)
    expect(isTenths(NaN)).toBe(false)
    expect(fmtTenths(74)).toBe('7.4')
    expect(fmtTenths(340)).toBe('34')
    expect(fmtTenths(-70)).toBe('−7')
    expect(fmtTenths(-5)).toBe('−0.5')
    expect(fmtTenths(0)).toBe('0')
  })

  it('reads a unit however it is reasonably written', () => {
    for (const [word, unit] of [['ml', 'ml'], ['millilitres', 'ml'], ['cm³', 'ml'], ['cm3', 'ml'], ['°C', '°C'], ['degrees Celsius', '°C'], ['C', '°C'],
      ['Newtons', 'N'], ['N', 'N'], ['grams', 'g'], ['KG', 'kg'], ['mm', 'mm'], ['Centimetres', 'cm']] as const) expect(readUnit(word), word).toBe(unit)
    for (const bad of ['furlongs', '', 'm/s', 3, null]) expect(readUnit(bad), String(bad)).toBeNull()
  })

  it('says an area and a perimeter in squares and units, or in cm', () => {
    expect(areaText(6)).toBe('6 squares')
    expect(areaText(1)).toBe('1 square')
    expect(areaText(6, 'cm')).toBe('6 cm²')
    expect(perimeterText(10)).toBe('10 units')
    expect(perimeterText(10, 'cm')).toBe('10 cm')
  })

  it('reads what a learner types as a reading, with or without the right unit', () => {
    expect(parseReading('34', 'ml')).toMatchObject({ ok: true, n: 34, t: 340 })
    expect(parseReading(' 34 ml ', 'ml')).toMatchObject({ ok: true, n: 34 })
    expect(parseReading('34ML', 'ml')).toMatchObject({ ok: true, n: 34 })
    expect(parseReading('7.4 cm', 'cm')).toMatchObject({ ok: true, n: 7.4 })
    expect(parseReading('−7', '°C')).toMatchObject({ ok: true, n: -7, t: -70, text: '−7' })
    expect(parseReading('-7 °C', '°C')).toMatchObject({ ok: true, n: -7 })
    expect(parseReading('-7 degrees', '°C')).toMatchObject({ ok: true, n: -7 })
    expect(parseReading('34 cm', 'ml')).toMatchObject({ ok: false, why: 'unit' })
    expect(parseReading('', 'ml')).toMatchObject({ ok: false, why: 'empty' })
    expect(parseReading('   ', 'ml')).toMatchObject({ ok: false, why: 'empty' })
    for (const bad of ['thirty four', '3,4', '3..4', '34 ml 5', '--3', 'ml']) expect(parseReading(bad, 'ml'), bad).toMatchObject({ ok: false, why: 'format' })
    expect(parseReading(undefined, 'ml')).toMatchObject({ ok: false, why: 'empty' })
  })
})

describe('the scales the engine draws', () => {
  it('has only real scales: whole divisions to a numbered mark and to the end, and no more than 50 in all', () => {
    const seen = new Set<string>()
    for (const inst of INSTRUMENTS) {
      for (const g of DESIGNS[inst]) {
        const label = `${inst} ${g.unit} ${g.min}-${g.max} by ${g.major}/${g.minor}`
        expect((g.max - g.min) % g.major, label).toBe(0)
        expect(g.major % g.minor, label).toBe(0)
        expect(g.minor, label).toBeGreaterThan(0)
        expect(divisionsOf(g), label).toBeLessThanOrEqual(MAX_DIVISIONS)
        expect(UNITS_OF[inst], label).toContain(g.unit)
        expect(seen.has(label), `${label} listed twice`).toBe(false)
        seen.add(label)
      }
    }
  })

  it('numbers the marks and lengthens the numbered and half-way ones', () => {
    const cyl = DESIGNS.cylinder.find((d) => d.max === tenths(100) && d.minor === tenths(2))!
    const marks = ticksOf(cyl)
    expect(marks).toHaveLength(51)
    expect(marks.filter((m) => m.kind === 'major').map((m) => m.t / 10)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    // Five small divisions to a numbered mark: no half-way mark, since five does not halve.
    expect(marks.filter((m) => m.kind === 'mid')).toHaveLength(0)
    const ruler = DESIGNS.ruler.find((d) => d.unit === 'cm' && d.minor === 1)!
    expect(ticksOf(ruler).filter((m) => m.kind === 'mid')).toHaveLength(5)
    expect(ticksOf(ruler).find((m) => m.t === 5)!.kind).toBe('mid')
  })

  it('picks the plainest scale a value lands on a small division of, and never a numbered mark', () => {
    expect(designFor('cylinder', ['ml'], 340)).toMatchObject({ max: 500, minor: 20 })
    expect(designFor('cylinder', ['ml'], 340, 20)).toMatchObject({ max: 500, minor: 20 })
    // 34 ml: the 50 ml cylinder has 5 ml divisions (34 is not on one) before it has 2 ml ones.
    const r = resolveScale(CYL.task as ScaleTask)!
    expect(r.design).toMatchObject({ unit: 'ml', min: 0, max: 500, major: 100, minor: 20 })
    expect(designFor('cylinder', ['ml'], 300)).toMatchObject({ max: 2500 })
    expect(designFor('cylinder', ['ml'], 1000)).toBeNull()
    expect(designFor('thermometer', ['°C'], -70)).toMatchObject({ min: -200, minor: 10 })
    // The clinical thermometer is 36 to 40 in tenths of a degree; a ruler in millimetres is a 5 cm section.
    expect(designFor('thermometer', ['°C'], 368)).toMatchObject({ min: 360, max: 400, minor: 1 })
    expect(designFor('thermometer', ['°C'], 330)).toMatchObject({ min: -100, max: 400, minor: 10 })
    expect(designFor('ruler', ['cm', 'mm'], 74)).toMatchObject({ unit: 'cm', min: 50, max: 100, minor: 1 })
    expect(designFor('ruler', ['cm', 'mm'], 32)).toMatchObject({ unit: 'cm', min: 0, max: 50, minor: 1 })
    expect(designFor('ruler', ['mm'], 870)).toMatchObject({ unit: 'mm', min: 500, max: 1000, minor: 10 })
    expect(designFor('scales', ['g', 'kg'], 24)).toMatchObject({ unit: 'kg' })
    expect(designFor('cylinder', ['ml'], 3.5 as number)).toBeNull()
  })

  it('says where a level sits on the scale, never what it is worth', () => {
    const g = resolveScale(CYL.task as ScaleTask)!.design
    expect(positionWords('cylinder', g, 340)).toBe('2 small divisions above the 30 mark')
    expect(positionWords('cylinder', g, 320)).toBe('1 small division above the 30 mark')
    expect(positionWords('cylinder', g, 300)).toBe('at the 30 mark')
    const t = resolveScale(THERMO.task as ScaleTask)!.design
    expect(positionWords('thermometer', t, -70)).toBe('3 small divisions above the −10 mark')
    expect(positionWords('balance', DESIGNS.balance[0], 25)).toBe('1 small division below the 2 mark')
    expect(positionWords('scales', DESIGNS.scales[0], 1500)).toBe('1 small division clockwise from the 100 mark')
    const section = DESIGNS.ruler.find((x) => x.unit === 'cm' && x.min === 50)!
    expect(positionWords('ruler', section, 74)).toBe('4 small divisions to the right of the 7 mark')
    expect(scaleWords('ruler', section)).toBe('ruler (a section of the ruler, away from its zero end), numbered from 5 to 10 cm, with 9 small marks between each pair of numbered marks')
    expect(scaleWords('cylinder', g)).toBe('measuring cylinder, numbered from 0 to 50 ml, with 4 small marks between each pair of numbered marks')
  })

  it('works the reading out in full once marked', () => {
    const g = resolveScale(CYL.task as ScaleTask)!.design
    expect(workedText(g, 340)).toBe('30 + 2 × 2 = 34')
    expect(workedText(resolveScale(THERMO.task as ScaleTask)!.design, -70)).toBe('−10 + 3 × 1 = −7')
    const section = DESIGNS.ruler.find((x) => x.unit === 'cm' && x.min === 50)!
    expect(workedText(section, 74)).toBe('7 + 4 × 0.1 = 7.4')
    expect(workedText(section, 71)).toBe('7 + 0.1 = 7.1')
  })
})

describe('the measure-shape engine reads what the tutor writes', () => {
  it('reads an instrument and a value however they are reasonably written', () => {
    const want = { task: { kind: 'read', instrument: 'cylinder', value: 34 } }
    expect(engine.parse(want)).toEqual(want)
    expect(engine.parse({ task: { kind: 'Read', instrument: 'Measuring cylinder', value: '34 ml' } })).toEqual(want)
    expect(engine.parse({ task: { kind: 'read_scale', instrument: 'measuring-cylinder', reading: 34 } })).toEqual(want)
    expect(engine.parse({ task: { kind: 'set', instrument: 'Thermometer', value: '−7 °C' } })).toEqual({ task: { kind: 'set', instrument: 'thermometer', value: -7 } })
    expect(engine.parse({ task: { kind: 'read', instrument: 'ruler', value: 7.4, unit: 'centimetres', step: '0.1' } })).toEqual(
      { task: { kind: 'read', instrument: 'ruler', value: 7.4, unit: 'cm', step: 0.1 } })
    expect(engine.parse({ task: { kind: 'read', instrument: 'Newton meter', value: '3.5 N' } })).toEqual({ task: { kind: 'read', instrument: 'balance', value: 3.5 } })
    expect(engine.parse({ task: { kind: 'read', instrument: 'kitchen scales', value: 340, unit: 'grams' } })).toEqual({ task: { kind: 'read', instrument: 'scales', value: 340, unit: 'g' } })
  })

  it('reads a make or compare task, and the unit the grid is in', () => {
    expect(engine.parse({ task: { kind: 'make', area: 6, perimeter: 10 } })).toEqual(make(6, 10))
    expect(engine.parse({ task: { kind: 'Build', area: '6 squares' } })).toEqual(make(6))
    expect(engine.parse({ task: { kind: 'make', perimeter: '12 units' } })).toEqual(make(undefined, 12))
    expect(engine.parse({ task: { kind: 'make', area: 6, perimeter: 12, unit: 'cm' } })).toEqual(make(6, 12, { unit: 'cm' }))
    expect(engine.parse({ task: { kind: 'compare', same: 'area', value: 8 } })).toEqual(compare('area', 8))
    expect(engine.parse({ task: { kind: 'compare', area: 8 } })).toEqual(compare('area', 8))
    expect(engine.parse({ task: { kind: 'compare', perimeter: 12, ask: 'smaller' } })).toEqual(compare('perimeter', 12, 'smaller'))
    expect(engine.parse({ task: { kind: 'compare', same: 'Area', value: 8, ask: 'bigger' } })).toEqual(compare('area', 8))
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [
      null, 'read', {}, { task: null }, { task: { kind: 'read' } },
      { task: { kind: 'read', instrument: 'cylinder' } },
      { task: { kind: 'read', instrument: 'barometer', value: 3 } },
      { task: { kind: 'read', instrument: 'cylinder', value: 'about thirty' } },
      { task: { kind: 'read', instrument: 'cylinder', value: 34, step: 'small' } },
      { task: { kind: 'measure', instrument: 'cylinder', value: 34 } },
      { task: { kind: 'make' } },
      { task: { kind: 'make', area: 'six' } },
      { task: { kind: 'compare', value: 8 } },
      { task: { kind: 'compare', area: 8, perimeter: 12 } },
      { task: { kind: 'compare', same: 'volume', value: 8 } },
      { task: { kind: 'compare', same: 'area', value: 8, ask: 'fairer' } },
    ]) expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
  })

  it('reads values the scales cannot show, so that faults can say why', () => {
    expect(engine.parse(scale('read', 'cylinder', 34.5))).toEqual(scale('read', 'cylinder', 34.5))
    expect(engine.parse(scale('read', 'cylinder', 5000))).toEqual(scale('read', 'cylinder', 5000))
    expect(engine.parse({ task: { kind: 'read', instrument: 'ruler', value: 3, unit: 'kg' } })).toEqual(scale('read', 'ruler', 3, { unit: 'kg' }))
    expect(engine.parse(make(7, 9))).toEqual(make(7, 9))
    expect(engine.parse(make(2.5))).toEqual(make(2.5))
  })
})

// ---------------------------------------------------------------------------

/** Every value from a little below a scale's start to a little past its end, in tenths. */
function* everyValue(inst: Instrument, units: readonly string[]): Generator<number> {
  const gs = DESIGNS[inst].filter((g) => units.includes(g.unit))
  const lo = Math.min(...gs.map((g) => g.min)) - 20
  const hi = Math.max(...gs.map((g) => g.max)) + 20
  for (let t = lo; t <= hi; t++) yield t / 10
}

describe('every value the tutor can name on every instrument', { timeout: 120_000 }, () => {
  it('is drawn on a real scale it lands on a small division of, or is refused with a value that works', () => {
    let valid = 0
    let refused = 0
    for (const inst of INSTRUMENTS) {
      for (const unit of [undefined, ...UNITS_OF[inst]]) {
        const units = unit ? [unit] : UNITS_OF[inst]
        for (const v of everyValue(inst, units)) {
          // Plain checks, not expect(), in the loop: a hundred thousand deep-equals would be most of the run.
          const c = engine.parse({ task: { kind: 'read', instrument: inst, value: v, ...(unit ? { unit } : {}) } })
          if (!c) throw new Error(`${inst} ${v} ${unit} does not parse`)
          const faults = engine.faults(c)
          const r = resolveScale(c.task as ScaleTask)
          const honest = !!units.map((u) => DESIGNS[inst].some((g) => g.unit === u && onDivision(g, tenths(v)) && !isNumbered(g, tenths(v)))).find(Boolean)
          if ((faults.length === 0) !== honest || (r !== null) !== honest) throw new Error(`${inst} ${v} ${unit}: faults ${JSON.stringify(faults)}`)
          if (!r) {
            refused++
            const f = faults[0]
            if (faults.length !== 1 || !/\b(Use|Choose|Round)\b/.test(f)) throw new Error(`${inst} ${v} ${unit}: a fault with nothing to do: ${f}`)
            continue
          }
          valid++
          // The scale shows the value on a small division and not on a numbered mark, in the unit asked.
          if (!onDivision(r.design, r.t) || isNumbered(r.design, r.t)) throw new Error(`${inst} ${v}: drawn on a scale it does not land on`)
          if (unit && r.unit !== unit) throw new Error(`${inst} ${v}: unit ${r.unit}, not ${unit}`)
          // read: starts empty, solves, and a different reading is wrong.
          if (engine.check(c, engine.initial(c)).ok) throw new Error(`${inst} ${v} starts solved`)
          if (!engine.check(c, engine.solve(c)).ok) throw new Error(`${inst} ${v} cannot be solved`)
          if (engine.check(c, { reading: fmtTenths(r.t + r.design.minor) }).ok) throw new Error(`${inst} ${v}: a neighbour is right`)
          // set: starts away from the value, on the scale, and solves.
          const s = engine.parse({ task: { kind: 'set', instrument: inst, value: v, ...(unit ? { unit } : {}) } })!
          const start = engine.initial(s) as { level: number }
          if (start.level === r.t || !onDivision(r.design, start.level)) throw new Error(`${inst} ${v}: set starts at ${start.level}`)
          if (engine.check(s, start).ok) throw new Error(`${inst} ${v}: set starts solved`)
          if (!engine.check(s, engine.solve(s)).ok) throw new Error(`${inst} ${v}: set cannot be solved`)
          if (engine.check(s, { level: snapLevel(r.design, r.t + r.design.minor) }).ok) throw new Error(`${inst} ${v}: set accepts a neighbour`)
        }
      }
    }
    expect(valid).toBeGreaterThan(1_300)
    expect(refused).toBeGreaterThan(30_000)
  })

  it('offers, for a value it refuses, one that is accepted', () => {
    let tried = 0
    for (const inst of INSTRUMENTS) {
      for (const v of [-300, -7.5, 0, 0.05, 1, 3.45, 12, 99.9, 100, 250, 1000, 1234.5, 99999]) {
        const c = scale('read', inst, v)
        const f = engine.faults(c)
        if (!f.length) continue
        tried++
        const eg = /e\.g\. (−?[\d.]+) (\S+)\./.exec(f[0])
        expect(eg, f[0]).toBeTruthy()
        const back = engine.parse({ task: { kind: 'read', instrument: inst, value: eg![1].replace('−', '-'), unit: eg![2] } })!
        expect(engine.faults(back), f[0]).toEqual([])
      }
    }
    expect(tried).toBeGreaterThan(30)
  })

  it('says in plain words why a value is refused', () => {
    expect(engine.faults(scale('read', 'cylinder', 34.5))[0]).toMatch(/^34\.5 ml is not on a small division of any measuring cylinder scale that reaches it .* Use e\.g\. 34 ml\.$/)
    expect(engine.faults(scale('read', 'cylinder', 5000))[0]).toMatch(/^5000 ml is outside every measuring cylinder scale here \(they run from 0 to 1000 ml\)\. Use e\.g\. 980 ml\.$/)
    expect(engine.faults(scale('read', 'cylinder', 100))[0]).toMatch(/^100 ml is a numbered mark on every measuring cylinder scale that reaches it, so the number is printed beside the reading/)
    expect(engine.faults(scale('read', 'thermometer', 0))[0]).toMatch(/^0 °C is a numbered mark on every thermometer scale that reaches it/)
    expect(engine.faults(scale('read', 'ruler', 7.45))[0]).toMatch(/^7\.45 is finer than any ruler scale here shows \(the smallest division is 0\.1 cm\)\. Round it to a whole division\. Use e\.g\./)
    expect(engine.faults(scale('read', 'thermometer', 200))[0]).toMatch(/^200 °C is outside every thermometer scale here \(they run from −20 to 110 °C\)/)
    expect(engine.faults(scale('read', 'cylinder', 34, { unit: 'kg' }))).toEqual(['A measuring cylinder reads in ml, not kg. Use ml.'])
    expect(engine.faults(scale('read', 'cylinder', 34, { unit: 'furlongs' }))).toEqual(['"furlongs" is not a unit a measuring cylinder can be drawn in. Use ml.'])
    expect(engine.faults(scale('read', 'balance', 3, { unit: 'cm' }))[0]).toBe('A spring balance reads in N or g, not cm. Use N or g.')
    expect(engine.faults(scale('read', 'cylinder', 34, { step: 3 }))[0]).toMatch(/^No measuring cylinder scale here has small divisions of 3 ml: they are .* Use one of those, or leave the step out\.$/)
    expect(engine.faults(CYL)).toEqual([])
    expect(engine.faults(THERMO)).toEqual([])
  })

  it('lets the tutor choose what a small division is worth, and draws that scale', () => {
    const one = resolveScale(scale('read', 'cylinder', 34, { step: 1 }).task as ScaleTask)!
    expect(one.design).toMatchObject({ max: 500, minor: 10 })
    const five = resolveScale(scale('read', 'ruler', 3.5, { step: 0.5 }).task as ScaleTask)!
    expect(five.design).toMatchObject({ unit: 'cm', minor: 5 })
    // 34 is not a multiple of 5 ml, so a 5 ml scale cannot show it.
    expect(engine.faults(scale('read', 'cylinder', 34, { step: 5 }))[0]).toMatch(/not on a small division of any measuring cylinder scale that reaches it/)
  })

  it('suggests the nearest value that works, the lower one first', () => {
    expect(nearbyScaleValue(scale('read', 'cylinder', 34.5).task as ScaleTask)).toMatchObject({ t: 340 })
    expect(nearbyScaleValue(scale('read', 'cylinder', 35).task as ScaleTask)).toMatchObject({ t: 340 })
    expect(nearbyScaleValue(scale('read', 'thermometer', 30).task as ScaleTask)).toMatchObject({ t: 290 })
  })
})

describe('the picture of every scale', () => {
  const box = (l: { cx: number; cy: number; w: number; h: number }, pad = 0) => ({ x0: l.cx - l.w / 2 - pad, x1: l.cx + l.w / 2 + pad, y0: l.cy - l.h / 2 - pad, y1: l.cy + l.h / 2 + pad })
  const apart = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0
  /** The nearest the label's centre comes to a tick's line. */
  const distance = (px: number, py: number, t: { x1: number; y1: number; x2: number; y2: number }) => {
    const dx = t.x2 - t.x1
    const dy = t.y2 - t.y1
    const k = Math.max(0, Math.min(1, ((px - t.x1) * dx + (py - t.y1) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(px - (t.x1 + k * dx), py - (t.y1 + k * dy))
  }

  it('keeps every mark and every number inside its box, apart from the others, each nearer its own mark than any other', () => {
    let designs = 0
    for (const inst of INSTRUMENTS) {
      for (const g of DESIGNS[inst]) {
        designs++
        const l = layoutScale(inst, g)
        const label = `${inst} ${g.unit} ${g.min}-${g.max} by ${g.major}/${g.minor}`
        expect(l.ticks, label).toHaveLength(divisionsOf(g) + 1)
        expect(l.labels, label).toHaveLength((g.max - g.min) / g.major + 1)
        for (const t of l.ticks) {
          for (const v of [t.x1, t.x2]) expect(v >= 0 && v <= l.w, `${label}: tick x ${v}`).toBe(true)
          for (const v of [t.y1, t.y2]) expect(v >= 0 && v <= l.h, `${label}: tick y ${v}`).toBe(true)
        }
        const boxes = l.labels.map((x) => box(x))
        for (const [i, b] of boxes.entries()) {
          expect(b.x0 >= 2 && b.x1 <= l.w - 2 && b.y0 >= 2 && b.y1 <= l.h - 2, `${label}: "${l.labels[i].text}" inside`).toBe(true)
          for (const [j, o] of boxes.entries()) if (i !== j) expect(apart(box(l.labels[i], 1), box(l.labels[j], 1)), `${label}: "${l.labels[i].text}" over "${l.labels[j].text}"`).toBe(true)
        }
        for (const lab of l.labels) {
          const own = distance(lab.cx, lab.cy, l.ticks.find((t) => t.t === lab.t)!)
          for (const t of l.ticks) if (t.t !== lab.t) expect(distance(lab.cx, lab.cy, t), `${label}: "${lab.text}" is nearer the ${fmtTenths(t.t)} mark`).toBeGreaterThan(own)
        }
        // A numbered mark gets its number, and only those.
        for (const lab of l.labels) expect(isNumbered(g, lab.t)).toBe(true)
      }
    }
    expect(designs).toBe(Object.values(DESIGNS).reduce((n, list) => n + list.length, 0))
  })

  it('draws every small division at least 6 px from the next, on every scale, so each can be seen, counted and set', () => {
    let nearest = Infinity
    for (const inst of INSTRUMENTS) {
      for (const g of DESIGNS[inst]) {
        const l = layoutScale(inst, g)
        const label = `${inst} ${g.unit} ${g.min}-${g.max} by ${g.major}/${g.minor}`
        expect(l.ticks, label).toHaveLength(divisionsOf(g) + 1)
        for (let i = 1; i < l.ticks.length; i++) {
          const gap = Math.hypot(l.ticks[i].x1 - l.ticks[i - 1].x1, l.ticks[i].y1 - l.ticks[i - 1].y1)
          nearest = Math.min(nearest, gap)
          if (gap < MIN_GAP - 1e-6) throw new Error(`${label}: marks ${i - 1} and ${i} are ${gap.toFixed(2)} px apart`)
        }
        // And what a drag lands on: the value under the point of each mark is that mark.
        for (const i of [0, 1, Math.floor(l.ticks.length / 2), l.ticks.length - 1]) {
          const tick = l.ticks[i]
          expect(snapLevel(g, l.fromPoint(tick.x1, tick.y1)), label).toBe(tick.t)
        }
      }
    }
    expect(MIN_GAP).toBe(6)
    expect(nearest).toBeGreaterThanOrEqual(MIN_GAP - 1e-6)
  })

  it('draws a section of ruler away from zero with its strip running in from the edge', () => {
    const section = DESIGNS.ruler.find((x) => x.unit === 'cm' && x.min === 50)!
    expect(layoutScale('ruler', section).fromZero).toBe(false)
    expect(layoutScale('ruler', DESIGNS.ruler[0]).fromZero).toBe(true)
    expect(layoutScale('thermometer', DESIGNS.thermometer[0]).fromZero).toBe(true)
  })

  it('finds the value under a point on the scale, so a drag sets what it is over', () => {
    for (const inst of INSTRUMENTS) {
      for (const g of DESIGNS[inst]) {
        const l = layoutScale(inst, g)
        for (const t of [g.min, g.min + g.minor, Math.floor((g.min + g.max) / 2 / g.minor) * g.minor, g.max]) {
          const p = l.at(t)
          expect(snapLevel(g, l.fromPoint(p.x, p.y)), `${inst} ${g.max}/${g.minor} at ${t}`).toBe(snapLevel(g, t))
        }
      }
    }
    // The dial: a point in the gap below snaps to the nearer end.
    const dial = layoutScale('scales', DESIGNS.scales[0])
    expect(dial.fromPoint(DIAL.cx - 5, DIAL.cy + 80)).toBe(DESIGNS.scales[0].min)
    expect(dial.fromPoint(DIAL.cx + 5, DIAL.cy + 80)).toBe(DESIGNS.scales[0].max)
    expect(dialAngle(0)).toBe(-135)
    expect(dialAngle(1)).toBe(135)
    expect(dialAngle(0.5)).toBe(0)
  })

  it('snaps a dragged level to a small division and keeps it on the scale', () => {
    const g = resolveScale(CYL.task as ScaleTask)!.design
    expect(snapLevel(g, 349)).toBe(340)
    expect(snapLevel(g, 351)).toBe(360)
    expect(snapLevel(g, -400)).toBe(g.min)
    expect(snapLevel(g, 99999)).toBe(g.max)
  })

  it('starts a set task at the end of the scale farther from the value', () => {
    expect(startLevel(resolveScale(scale('set', 'cylinder', 34).task as ScaleTask)!)).toBe(0)
    expect(startLevel(resolveScale(scale('set', 'cylinder', 480).task as ScaleTask)!)).toBe(0)
    expect(startLevel(resolveScale(THERMO.task as ScaleTask)!)).toBe(300)
  })
})

describe('marking a reading and a setting', () => {
  it('marks a typed reading right however the unit is written, and nothing else', () => {
    for (const ok of ['34', '34 ml', '34ml', ' 34.0 ', '34 millilitres', '034']) expect(engine.check(CYL, { reading: ok }).ok, ok).toBe(true)
    for (const no of ['', '36', '32', '3.4', '340', '34 cm', 'thirty-four', '3 4', '3 4 ml']) expect(engine.check(CYL, { reading: no }).ok, no).toBe(false)
    expect(engine.check(CYL, { reading: 34 } as never).ok).toBe(false)
    expect(engine.check(CYL, null as never).ok).toBe(false)
    const cold = scale('read', 'thermometer', -7)
    for (const ok of ['-7', '−7', '-7 °C', '−7°C', '-7 degrees']) expect(engine.check(cold, { reading: ok }).ok, ok).toBe(true)
    for (const no of ['7', '-6', '-8', '+7']) expect(engine.check(cold, { reading: no }).ok, no).toBe(false)
  })

  it('marks a set level right only on the value, and reads a state it cannot use as the start', () => {
    expect(engine.check(THERMO, { level: -70 }).ok).toBe(true)
    expect(engine.check(THERMO, { level: -60 }).ok).toBe(false)
    expect(engine.check(THERMO, { level: -71 }).ok).toBe(false)
    expect(engine.check(THERMO, { level: 'low' } as never).ok).toBe(false)
    expect(engine.check(THERMO, null as never).ok).toBe(false)
    expect(engine.initial(THERMO)).toEqual({ level: 300 })
  })

  it('says a wrong reading back, with the numbered step and the small division, never the answer', () => {
    // The 50 ml cylinder of the brief's example: numbered in 10s, small divisions of 2 ml.
    expect(scaleSaid(CYL.task as ScaleTask, { reading: '30' }, 'wrong')).toEqual(['You read 30 ml.', 'The numbered marks go up in 10 ml, and each small division is 2 ml.'])
    expect(scaleSaid(CYL.task as ScaleTask, { reading: '38' }, 'wrong')).toEqual(['You read 38 ml.', 'The numbered marks go up in 10 ml, and each small division is 2 ml.'])
    for (const reading of ['36', '30', '3', '40', '32']) expect(scaleSaid(CYL.task as ScaleTask, { reading }, 'wrong').join(' ')).not.toMatch(/\b34\b/)
  })

  it('says a reading that falls between marks, off the scale, with the wrong unit or not a number', () => {
    const two = CYL.task as ScaleTask
    expect(scaleSaid(two, { reading: '35' }, 'wrong')[2]).toBe('That is between two small divisions. The level sits exactly on one.')
    expect(scaleSaid(two, { reading: '35.5' }, 'wrong')[2]).toMatch(/between two small divisions/)
    expect(scaleSaid(two, { reading: '150' }, 'wrong')[2]).toBe('This scale only goes from 0 to 50 ml.')
    expect(scaleSaid(two, { reading: '34 cm' }, 'wrong')).toEqual(['You wrote "34 cm". This measuring cylinder reads in ml: type just the number.'])
    expect(scaleSaid(two, { reading: 'lots' }, 'wrong')).toEqual(['"lots" is not a number. Type the reading as a number, like 2.'])
    expect(scaleSaid(two, { reading: '' }, 'wrong')).toEqual(['Type what the scale reads, then check.'])
  })

  it('names the two common slips: the top of the meniscus, and a temperature on the wrong side of zero', () => {
    const two = CYL.task as ScaleTask
    expect(scaleSaid(two, { reading: '36' }, 'wrong')[2]).toMatch(/^Read the bottom of the curved surface \(the meniscus\)/)
    expect(scaleSaid(two, { reading: '32' }, 'wrong')[2]).toBeUndefined()
    const cold = scale('read', 'thermometer', -7).task as ScaleTask
    expect(scaleSaid(cold, { reading: '7' }, 'wrong')[2]).toBe('Look at which side of 0 the level is.')
    expect(scaleSaid(cold, { reading: '-6' }, 'wrong')[2]).toBeUndefined()
  })

  it('says a wrong setting back with how far out it is, and the right one with the working', () => {
    const t = THERMO.task as ScaleTask
    expect(scaleSaid(t, { level: -40 }, 'wrong')).toEqual([
      'You set −4 °C, not −7 °C: 3 small divisions too high.',
      'The numbered marks go up in 10 °C, and each small division is 1 °C.',
    ])
    expect(scaleSaid(t, { level: -90 }, 'wrong')[0]).toBe('You set −9 °C, not −7 °C: 2 small divisions too low.')
    expect(scaleSaid(t, { level: -70 }, 'right')).toEqual([
      'Set to −7 °C.',
      'The target is 3 small divisions above the −10 mark. −10 + 3 × 1 = −7 °C.',
      'The numbered marks go up in 10 °C, and each small division is 1 °C.',
    ])
    expect(scaleSaid(CYL.task as ScaleTask, { reading: '34' }, 'right')).toEqual([
      '34 ml.',
      'The level is 2 small divisions above the 30 mark. 30 + 2 × 2 = 34 ml.',
      'The numbered marks go up in 10 ml, and each small division is 2 ml.',
    ])
  })
})

// ---------------------------------------------------------------------------
// The squared grid.

describe('area and perimeter as the engine counts them', () => {
  it('counts a rectangle, an L and a line exactly', () => {
    expect(analyse(at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]), GRID_COLS, GRID_ROWS)).toEqual({ area: 6, perimeter: 10, pieces: 1, holes: 0 })
    expect(analyse(at([0, 0], [1, 0], [2, 0], [2, 1]), GRID_COLS, GRID_ROWS)).toEqual({ area: 4, perimeter: 10, pieces: 1, holes: 0 })
    expect(analyse(at([0, 0], [0, 1], [0, 2], [0, 3], [0, 4]), GRID_COLS, GRID_ROWS)).toEqual({ area: 5, perimeter: 12, pieces: 1, holes: 0 })
    expect(analyse([], GRID_COLS, GRID_ROWS)).toEqual({ area: 0, perimeter: 0, pieces: 0, holes: 0 })
    // A single square is 4 sides, at the corner of the grid or not.
    expect(analyse(at([0, 0]), GRID_COLS, GRID_ROWS).perimeter).toBe(4)
    expect(analyse(at([3, 5]), GRID_COLS, GRID_ROWS).perimeter).toBe(4)
  })

  it('counts a shape on the very edge of the grid, whose sides on the edge are still sides', () => {
    const full = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => i)
    expect(analyse(full, GRID_COLS, GRID_ROWS)).toEqual({ area: 96, perimeter: 40, pieces: 1, holes: 0 })
  })

  it('knows squares that touch only at a corner are two pieces', () => {
    expect(analyse(at([0, 0], [1, 1]), GRID_COLS, GRID_ROWS)).toMatchObject({ area: 2, perimeter: 8, pieces: 2 })
    expect(analyse(at([0, 0], [0, 1], [2, 5]), GRID_COLS, GRID_ROWS).pieces).toBe(2)
  })

  it('finds a hole when shaded squares wall in an unshaded one, and not when the way out is open', () => {
    const ring = at([1, 1], [1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2], [3, 3])
    expect(analyse(ring, GRID_COLS, GRID_ROWS)).toEqual({ area: 8, perimeter: 16, pieces: 1, holes: 1 })
    const open = at([1, 1], [1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3])
    expect(analyse(open, GRID_COLS, GRID_ROWS)).toEqual({ area: 7, perimeter: 16, pieces: 1, holes: 0 })
    // A ring with a corner missing still walls its middle in on all four sides: the gap is only a corner touching a corner.
    const notch = at([1, 1], [1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2])
    expect(analyse(notch, GRID_COLS, GRID_ROWS)).toEqual({ area: 7, perimeter: 16, pieces: 1, holes: 1 })
    // A ring touching the edge of the grid walls nothing in; its hole is still a hole.
    const edge = at([0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2])
    expect(analyse(edge, GRID_COLS, GRID_ROWS).holes).toBe(1)
    // Two holes.
    const two = at([0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 2], [1, 4], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4])
    expect(analyse(two, GRID_COLS, GRID_ROWS).holes).toBe(2)
  })

  it('has the least perimeter 2 * ceil(2 * sqrt(n)) and the most 2n + 2, in whole numbers', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 25, 32].map(minPerimeter)).toEqual([4, 6, 8, 8, 10, 10, 12, 12, 12, 14, 14, 16, 20, 24])
    for (let n = 1; n <= 200; n++) {
      expect(minPerimeter(n), `n = ${n}`).toBe(2 * Math.ceil(Math.sqrt(4 * n) - 1e-9))
      expect(maxPerimeter(n)).toBe(2 * n + 2)
    }
    expect(perimetersFor(6)).toEqual([10, 12, 14])
    expect(areasFor(12)).toEqual({ least: 5, most: 9 })
    expect(areasFor(10)).toEqual({ least: 4, most: 6 })
  })
})

describe('which pairs of area and perimeter a shape can have', () => {
  /** Every polyomino of up to nine squares: grown a square at a time, kept once for each shape. */
  function polyominoes(upTo: number): Map<number, Set<number>> {
    const perimetersByArea = new Map<number, Set<number>>()
    let level = new Map<string, [number, number][]>([['0,0', [[0, 0]]]])
    const norm = (cells: [number, number][]) => {
      const r0 = Math.min(...cells.map((c) => c[0]))
      const c0 = Math.min(...cells.map((c) => c[1]))
      return cells.map(([r, c]): [number, number] => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    }
    for (let n = 1; n <= upTo; n++) {
      const set = new Set<number>()
      for (const cells of level.values()) {
        const a = analyse(cells.map(([r, c]) => (r + 1) * 12 + c + 1), 12, 12)
        if (a.holes === 0) set.add(a.perimeter)
      }
      perimetersByArea.set(n, set)
      if (n === upTo) break
      const next = new Map<string, [number, number][]>()
      for (const cells of level.values()) {
        const have = new Set(cells.map(([r, c]) => `${r},${c}`))
        for (const [r, c] of cells) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (have.has(`${r + dr},${c + dc}`)) continue
            const grown = norm([...cells, [r + dr, c + dc]])
            next.set(grown.map((x) => x.join(',')).join(';'), grown)
          }
        }
      }
      level = next
    }
    return perimetersByArea
  }

  it('is exactly the even perimeters from 2 * ceil(2 * sqrt(n)) to 2n + 2, checked against every shape of up to nine squares', () => {
    const real = polyominoes(9)
    for (let n = 1; n <= 9; n++) expect([...real.get(n)!].sort((a, b) => a - b), `n = ${n}`).toEqual(perimetersFor(n))
  })

  it('is built on the grid for every pair the engine accepts, and for no pair it refuses', { timeout: 60_000 }, () => {
    let pairs = 0
    for (let a = MIN_AREA; a <= MAX_AREA; a++) {
      const real = new Set(perimetersFor(a))
      for (let p = 0; p <= maxPerimeter(a) + 6; p++) {
        const c = engine.parse({ task: { kind: 'make', area: a, perimeter: p } })!
        const faults = engine.faults(c)
        if (!real.has(p)) {
          // Not a pair any shape has: refused with the pair to use, which itself is accepted.
          if (faults.length !== 1) throw new Error(`area ${a} perimeter ${p} is not refused`)
          const eg = /Use area (\d+) with perimeter (\d+)/.exec(faults[0])
          if (!eg || Number(eg[1]) !== a || !real.has(Number(eg[2]))) throw new Error(`area ${a} perimeter ${p}: ${faults[0]}`)
          if (Math.abs(Number(eg[2]) - p) !== Math.min(...[...real].map((x) => Math.abs(x - p)))) throw new Error(`area ${a} perimeter ${p}: ${eg[2]} is not the nearest`)
          continue
        }
        pairs++
        if (faults.length) throw new Error(`area ${a} perimeter ${p}: ${faults}`)
        if (engine.check(c, engine.initial(c)).ok) throw new Error(`area ${a} perimeter ${p} starts solved`)
        const solved = engine.solve(c) as { cells: number[] }
        if (!engine.check(c, solved).ok) throw new Error(`area ${a} perimeter ${p} cannot be solved`)
        const got = analyse(solved.cells, GRID_COLS, GRID_ROWS)
        if (got.area !== a || got.perimeter !== p || got.pieces !== 1 || got.holes !== 0) throw new Error(`area ${a} perimeter ${p}: ${JSON.stringify(got)}`)
        // The shape stays inside the grid.
        if (solved.cells.some((i) => i < 0 || i >= GRID_COLS * GRID_ROWS)) throw new Error(`area ${a} perimeter ${p} leaves the grid`)
      }
    }
    // 3 to 32 squares: every even perimeter from the least to the most.
    expect(pairs).toBe(Array.from({ length: MAX_AREA - MIN_AREA + 1 }, (_, i) => perimetersFor(MIN_AREA + i).length).reduce((x, y) => x + y, 0))
  })

  it('asks for only an area, or only a perimeter, and builds a shape for each', () => {
    for (let a = MIN_AREA; a <= MAX_AREA; a++) {
      const c = make(a)
      expect(engine.faults(c), `area ${a}`).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `area ${a}`).toBe(true)
    }
    for (let p = PERIMETER_ONLY_MIN; p <= PERIMETER_ONLY_MAX; p += 2) {
      const c = make(undefined, p)
      expect(engine.faults(c), `perimeter ${p}`).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok).toBe(false)
      const solved = engine.solve(c) as { cells: number[] }
      expect(engine.check(c, solved).ok, `perimeter ${p}`).toBe(true)
      expect(analyse(solved.cells, GRID_COLS, GRID_ROWS).perimeter).toBe(p)
    }
  })

  it('says why a pair is impossible, in words a writer can act on, with a nearby pair that works', () => {
    expect(engine.faults(make(6, 9))).toEqual(['A perimeter of 9 cannot happen: on a squared grid a perimeter is always even (the sides come in pairs, across and up). Use area 6 with perimeter 10.'])
    expect(engine.faults(make(6, 8))[0]).toBe('No shape of 6 squares has a perimeter of 8: the least is 10 (squares packed as close to a square as they go). 6 squares can have a perimeter of 10, 12 or 14. Use area 6 with perimeter 10, or keep perimeter 8 and use an area from 3 to 4.')
    expect(engine.faults(make(4, 20))[0]).toBe('No shape of 4 squares has a perimeter of 20: the most is 10 (squares in a line or branching). 4 squares can have a perimeter of 8 or 10. Use area 4 with perimeter 10, or keep perimeter 20 and use an area from 9 to 25.')
    expect(engine.faults(make(6, 10))).toEqual([])
    expect(engine.faults(make(12, 14))).toEqual([])
    expect(engine.faults(make(2, 6))[0]).toMatch(/^2 squares can only be made one way, so there is nothing to work out\. Use 3 or more/)
    expect(engine.faults(make(1))[0]).toMatch(/^1 square can only be made one way/)
    expect(engine.faults(make(40))[0]).toMatch(/^40 squares is more than the grid is built for \(32\)\. Use a smaller area/)
    expect(engine.faults(make(6.5))[0]).toMatch(/^An area of 6\.5 is not a whole number of squares\. Use a whole number from 3 to 32\./)
    expect(engine.faults(make(undefined, 7))[0]).toMatch(/^A perimeter of 7 cannot happen.*Use 8\.$/)
    expect(engine.faults(make(undefined, 6))[0]).toMatch(/^A perimeter of 6 is one square or a pair, so there is nothing to work out\. Use 8 or more/)
    expect(engine.faults(make(undefined, 60))[0]).toMatch(/^A perimeter of 60 is more than the grid holds \(40\)\. Use a smaller one/)
    expect(engine.faults(make(6, 10, { unit: 'furlongs' }))[0]).toBe('"furlongs" is not a unit for a squared grid. Use cm, m, mm or leave it out.')
    expect(engine.faults({ task: { kind: 'make' } } as MeasureShapeConfig)[0]).toMatch(/^Name an area, a perimeter, or both/)
  })

  it('finds a shape for a pair with no hole, one piece, in the grid, and a different one when the first is not wanted', () => {
    // A 3 by 2 block and a 2 by 3 block.
    expect(shapesWith(6, 10, GRID_COLS, GRID_ROWS)).toHaveLength(2)
    expect(shapesWith(6, 12, GRID_COLS, GRID_ROWS).length).toBeGreaterThan(1)
    expect(shapesWith(6, 8, GRID_COLS, GRID_ROWS)).toEqual([])
    expect(shapesWith(6, 11, GRID_COLS, GRID_ROWS)).toEqual([])
    for (const cells of shapesWith(9, 16, GRID_COLS, GRID_ROWS)) expect(analyse(cells, GRID_COLS, GRID_ROWS)).toEqual({ area: 9, perimeter: 16, pieces: 1, holes: 0 })
  })

  it('moves a shape to the middle of its grid, and turns it eight ways without changing it', () => {
    const l = at([0, 0], [1, 0], [2, 0], [2, 1])
    const mid = centred(l, GRID_COLS, GRID_ROWS)
    expect(analyse(mid, GRID_COLS, GRID_ROWS)).toEqual(analyse(l, GRID_COLS, GRID_ROWS))
    expect(Math.min(...mid.map((i) => i % GRID_COLS))).toBe(5)
    expect(Math.min(...mid.map((i) => Math.floor(i / GRID_COLS)))).toBe(2)
    const small = [0, 1, MINI, 2 * MINI, 2 * MINI + 1]
    const seen = new Set<string>()
    for (let k = 0; k < 8; k++) {
      const t = turned(small, MINI, k)
      expect(analyse(t, MINI, MINI)).toEqual(analyse(small, MINI, MINI))
      seen.add(t.join(','))
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('marking the shape a learner makes', () => {
  const six = make(6, 10).task as MakeTask
  const rect = at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2])

  it('is right for any connected shape with the area and the perimeter, wherever it is on the grid', () => {
    expect(engine.check(make(6, 10), { cells: rect }).ok).toBe(true)
    expect(engine.check(make(6, 10), { cells: at([5, 6], [5, 7], [6, 6], [6, 7], [7, 6], [7, 7]) }).ok).toBe(true)
    expect(engine.check(make(6, 10), { cells: at([2, 3], [3, 3], [4, 3], [2, 4], [3, 4], [4, 4]) }).ok).toBe(true)
    // 6 squares and perimeter 12: more than one shape does.
    expect(engine.check(make(6, 12), { cells: at([0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1]) }).ok).toBe(true)
    expect(engine.check(make(6, 12), { cells: at([0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0]) }).ok).toBe(true)
  })

  it('is wrong for the wrong area, the wrong perimeter, two pieces, a hole or an empty grid', () => {
    expect(engine.check(make(6, 10), { cells: at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1]) }).ok).toBe(false)
    expect(engine.check(make(6, 10), { cells: at([0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1]) }).ok).toBe(false)
    expect(engine.check(make(6, 10), { cells: [] }).ok).toBe(false)
    expect(engine.check(make(6, 10), {}).ok).toBe(false)
    expect(engine.check(make(6, 10), null as never).ok).toBe(false)
    expect(engine.check(make(6, 10), { cells: 'lots' } as never).ok).toBe(false)
    // Two pieces: a 2 by 2 and a domino have area 6 but not perimeter 10.
    expect(engine.check(make(6), { cells: at([0, 0], [0, 1], [1, 0], [1, 1], [4, 4], [4, 5]) }).ok).toBe(false)
    // A ring of 8: perimeter counting its hole is 16, but a hole is refused whatever it counts.
    const ring = at([1, 1], [1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2], [3, 3])
    expect(engine.check(make(8), { cells: ring }).ok).toBe(false)
    expect(engine.check(make(8, 16), { cells: ring }).ok).toBe(false)
    expect(engine.check(make(8), { cells: at([0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3]) }).ok).toBe(true)
  })

  it('reads squares it is given safely: out of the grid, repeated or not whole are dropped', () => {
    expect(readCells({ cells: [5, 5, 3, 1.5, -1, 96, 'a', 95] })).toEqual([3, 5, 95])
    expect(readCells({})).toEqual([])
    expect(readCells(null)).toEqual([])
    expect(engine.check(make(6, 10), { cells: [...rect, ...rect, 500, -3] }).ok).toBe(true)
  })

  it('says what was made when wrong, and what is still needed', () => {
    const say = (cells: number[], t = six) => makeSaid(t, { cells }, 'wrong')
    expect(say([])).toEqual(['No squares are shaded yet. Shade squares to build the shape.'])
    expect(say(at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1]))).toEqual([
      'You made area 5 squares and perimeter 10 units.', 'The area needs to be 6 squares.', 'The perimeter is right.',
    ])
    expect(say(at([0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1]))).toEqual([
      'You made area 6 squares and perimeter 12 units.', 'The area is right.', 'The perimeter needs to be 10 units.',
    ])
    expect(say(at([0, 0], [0, 1], [1, 0], [1, 1], [4, 4], [4, 5]))[0]).toBe('Your 6 squares make 2 separate pieces. The shape must be one piece, with squares joined along a whole side (touching at a corner is not joined).')
    expect(say(at([1, 1], [1, 2], [1, 3], [2, 1], [2, 3], [3, 1], [3, 2], [3, 3]), make(8, 16).task as MakeTask)[0]).toMatch(/^There is a hole inside your shape\./)
    expect(makeSaid(make(6, 10, { unit: 'cm' }).task as MakeTask, { cells: at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1]) }, 'wrong')[0]).toBe('You made area 5 cm² and perimeter 10 cm.')
    expect(makeSaid(six, { cells: rect }, 'right')).toEqual([
      'Area 6 squares, perimeter 10 units.', 'Area is the squares counted. Perimeter is the sides of squares counted round the outside.',
    ])
    expect(makeVerdict(six, rect)).toMatchObject({ ok: true, areaOk: true, perimeterOk: true })
  })

  it('says a shape in words, row by row, for a screen reader', () => {
    expect(runsText(at([0, 0], [0, 1], [0, 2], [1, 0]), GRID_COLS)).toBe('row 1, columns 1 to 3; row 2, column 1')
    expect(runsText(at([2, 0], [2, 1], [2, 4]), GRID_COLS)).toBe('row 3, columns 1 to 2 and column 5')
    expect(runsText([], GRID_COLS)).toBe('')
  })
})

describe('comparing two shapes', { timeout: 60_000 }, () => {
  const everyCompare = () => {
    const out: MeasureShapeConfig[] = []
    for (const ask of ['larger', 'smaller'] as const) {
      for (let n = 4; n <= MAX_COMPARE_AREA; n++) out.push(compare('area', n, ask))
      for (let p = 8; p <= MAX_COMPARE_PERIMETER; p += 2) out.push(compare('perimeter', p, ask))
    }
    return out
  }

  it('draws, for every task, two shapes that share what they should and differ in what is asked', () => {
    let configs = 0
    let answerA = 0
    for (const c of everyCompare()) {
      configs++
      const t = c.task as CompareTask
      const label = `${t.same} ${t.value} ${t.ask}`
      if (engine.faults(c).length) throw new Error(`${label}: ${engine.faults(c)}`)
      const pair = comparePair(t)
      if (!pair) throw new Error(`${label}: no pair`)
      const [a, b] = [pair.a, pair.b]
      for (const s of [a, b]) {
        const got = analyse(s.cells, MINI, MINI)
        if (got.area !== s.area || got.perimeter !== s.perimeter || got.pieces !== 1 || got.holes !== 0) throw new Error(`${label}: shape is not what it says`)
        if (s.cells.some((i) => i < 0 || i >= MINI * MINI)) throw new Error(`${label}: shape leaves its grid`)
      }
      const shared = t.same === 'area' ? 'area' : 'perimeter'
      const asked = t.same === 'area' ? 'perimeter' : 'area'
      if (a[shared] !== t.value || b[shared] !== t.value) throw new Error(`${label}: they do not share ${shared} ${t.value}`)
      if (a[asked] === b[asked]) throw new Error(`${label}: they do not differ in ${asked}`)
      if (pair.asked !== asked) throw new Error(`${label}: asks ${pair.asked}`)
      const win = (t.ask === 'larger') === (a[asked] > b[asked]) ? 'a' : 'b'
      if (pair.answer !== win) throw new Error(`${label}: the answer is ${pair.answer}, not ${win}`)
      // The shapes do not look the same, and are not one shape turned.
      if (a.cells.join() === b.cells.join()) throw new Error(`${label}: the same shape twice`)
      if (engine.check(c, engine.initial(c)).ok) throw new Error(`${label}: starts solved`)
      if (!engine.check(c, engine.solve(c)).ok) throw new Error(`${label}: cannot be solved`)
      if (engine.check(c, { pick: pair.answer === 'a' ? 'b' : 'a' }).ok) throw new Error(`${label}: the other one is right`)
      if (pair.answer === 'a') answerA++
    }
    expect(configs).toBe(2 * (MAX_COMPARE_AREA - 3 + (MAX_COMPARE_PERIMETER - 6) / 2))
    // The side with the answer is not readable off the layout: a fair toss over the cards.
    expect(answerA / configs).toBeGreaterThan(0.35)
    expect(answerA / configs).toBeLessThan(0.65)
  })

  it('shows the compact shape against a longer one for the same area, and the fuller against a thinner for the same perimeter', () => {
    const area = comparePair(compare('area', 12).task as CompareTask)!
    const [small, big] = area.answer === 'a' ? [area.b, area.a] : [area.a, area.b]
    expect(small.perimeter).toBe(14)
    expect([16, 18]).toContain(big.perimeter)
    const perimeter = comparePair(compare('perimeter', 16).task as CompareTask)!
    const full = [perimeter.a, perimeter.b].find((s) => s.area === 16)!
    expect(full).toBeTruthy()
    expect([13, 14, 15]).toContain([perimeter.a, perimeter.b].find((s) => s !== full)!.area)
  })

  it('deals the same two shapes every time a card is drawn', () => {
    for (const c of [compare('area', 8), compare('perimeter', 12, 'smaller')]) {
      const t = c.task as CompareTask
      expect(comparePair({ ...t })).toEqual(comparePair({ ...t }))
    }
    expect(hashOf('area:8:larger')).toBe(hashOf('area:8:larger'))
    expect(hashOf('area:8:larger')).not.toBe(hashOf('area:9:larger'))
  })

  it('marks the right pick, says both shapes’ measures once marked, and never before', () => {
    const c = compare('area', 8)
    const pair = comparePair(c.task as CompareTask)!
    const wrong = pair.answer === 'a' ? 'b' : 'a'
    expect(engine.check(c, { pick: pair.answer }).ok).toBe(true)
    expect(engine.check(c, { pick: wrong }).ok).toBe(false)
    expect(engine.check(c, { pick: '' }).ok).toBe(false)
    expect(engine.check(c, { pick: 'c' }).ok).toBe(false)
    expect(engine.check(c, null as never).ok).toBe(false)
    const lines = compareSaid(c.task as CompareTask, { pick: wrong }, 'wrong')
    expect(lines[0]).toBe(`You picked shape ${wrong.toUpperCase()}.`)
    expect(lines[1]).toBe(`Shape A: perimeter ${pair.a.perimeter} units. Shape B: perimeter ${pair.b.perimeter} units.`)
    expect(lines[2]).toBe(`Shape ${pair.answer.toUpperCase()} has the larger perimeter. Both have area 8 squares.`)
    expect(compareSaid(c.task as CompareTask, { pick: pair.answer }, 'right').at(-1)).toBe('Shapes with the same area can have different perimeters.')
    expect(compareSaid(c.task as CompareTask, {}, 'wrong')[0]).toBe('Pick a shape first.')
  })

  it('says why two shapes cannot be compared, with a task that can', () => {
    expect(engine.faults(compare('area', 3))[0]).toBe('3 squares can only have one perimeter (8), so there are no two shapes to tell apart. Use 4 or more squares, e.g. 6.')
    expect(engine.faults(compare('area', 31))[0]).toMatch(/^31 squares is more than the small grids hold \(30\)\. Use a smaller area/)
    expect(engine.faults(compare('area', 8.5))[0]).toMatch(/^8\.5 is not a whole number/)
    expect(engine.faults(compare('perimeter', 13))[0]).toBe('A perimeter of 13 cannot happen: on a squared grid it is always even. Use 12.')
    expect(engine.faults(compare('perimeter', 6))[0]).toMatch(/^A perimeter of 6 fits only one area/)
    expect(engine.faults(compare('perimeter', 34))[0]).toMatch(/^A perimeter of 34 is more than the small grids hold \(32\)/)
    expect(engine.faults(compare('area', 8))).toEqual([])
    expect(engine.faults({ task: { kind: 'compare', same: 'area', value: 8, ask: 'larger', unit: 'furlongs' } } as MeasureShapeConfig)[0]).toMatch(/not a unit for a squared grid/)
  })
})

// ---------------------------------------------------------------------------

describe('the drawing', () => {
  it('draws exactly as many outline dashes as the shape has perimeter', () => {
    let shapes = 0
    for (const [a, p] of [[3, 8], [6, 10], [6, 12], [6, 14], [12, 14], [12, 26], [20, 24], [20, 42], [32, 24], [32, 66]]) {
      for (const cells of shapesWith(a, p, GRID_COLS, GRID_ROWS)) {
        shapes++
        const { cell, pad } = MAKE_LOOK
        expect(outlineEdges(cells, GRID_COLS, GRID_ROWS, cell, pad, 3), `${a}, ${p}`).toHaveLength(p)
      }
    }
    expect(shapes).toBeGreaterThan(10)
    // On the edge of the grid and in a corner, the sides on the edge count.
    expect(outlineEdges([0], GRID_COLS, GRID_ROWS, 26, 9, 3)).toHaveLength(4)
    expect(outlineEdges(Array.from({ length: 96 }, (_, i) => i), GRID_COLS, GRID_ROWS, 26, 9, 3)).toHaveLength(40)
    expect(outlineEdges([], GRID_COLS, GRID_ROWS, 26, 9, 3)).toHaveLength(0)
  })

  it('keeps every dash on the shape’s own boundary, and leaves a gap between neighbours so they can be counted', () => {
    const { cell, pad } = MAKE_LOOK
    const edges = outlineEdges(at([0, 0], [0, 1]), GRID_COLS, GRID_ROWS, cell, pad, 3)
    const top = edges.filter((e) => e.y1 === pad && e.y2 === pad).sort((a, b) => a.x1 - b.x1)
    expect(top).toHaveLength(2)
    expect(top[1].x1 - top[0].x2).toBe(6)
    // A dash lies on the line between two squares of the grid.
    for (const e of edges) {
      const onLine = (v: number) => (v - pad) % cell === 0
      expect(e.y1 === e.y2 ? onLine(e.y1) : onLine(e.x1)).toBe(true)
    }
  })

  it('fits the make grid and the two small grids to a card, with cells a finger can hit', () => {
    expect(GRID_COLS * MAKE_LOOK.cell + 2 * MAKE_LOOK.pad).toBeLessThanOrEqual(340)
    expect(MAKE_LOOK.cell).toBeGreaterThanOrEqual(24)
    expect(2 * (MINI * MINI_LOOK.cell + 2 * MINI_LOOK.pad) + 12).toBeLessThanOrEqual(380)
    expect(VERT.w).toBeLessThanOrEqual(340)
    expect(RULER_BOX.w).toBeLessThanOrEqual(340)
    expect(DIAL.w).toBeLessThanOrEqual(340)
  })
})

// ---------------------------------------------------------------------------

describe('the prompt a measure-shape card is written with', () => {
  const faults = (c: MeasureShapeConfig, prompt: string) => getEngine('measure-shape')!.promptFaults!(c, prompt)

  it('may not give a reading away, nor what a small division is worth', () => {
    for (const p of [
      'The cylinder shows 34 ml. Read it.',
      'Read the level, which is about 34.',
      'Is it 34 millilitres?',
    ]) expect(faults(CYL, p).join(' '), p).toMatch(/gives the reading away \(34 ml\)/)
    for (const p of [
      'Read the level. Each small division is 2 ml.',
      'Every division on this scale is worth 2.',
      'Each small mark stands for 2 ml.',
    ]) expect(faults(CYL, p).join(' '), p).toMatch(/says what a small division is worth/)
    expect(faults(CYL, 'Read the level, 3 small divisions above the 30 ml mark.').join(' ')).toMatch(/counts the small divisions/)
    expect(faults(scale('read', 'thermometer', -7), 'Read the temperature: it is -7 degrees.').join(' ')).toMatch(/gives the reading away \(−7 °C\)/)
  })

  it('may name the instrument, its range and what to do', () => {
    for (const [c, p] of [
      [CYL, 'Read the level of the water in the measuring cylinder.'],
      [CYL, 'The cylinder holds up to 100 ml. How much water is in it?'],
      [CYL, 'Look at the bottom of the curve. What is the reading in ml?'],
      [THERMO, 'Set the thermometer to -7 degrees C.'],
      [THERMO, 'Move the liquid to −7 °C.'],
      [scale('read', 'thermometer', -7), 'Read the thermometer (−20 to 50 °C). Is it above or below zero?'],
      [scale('read', 'ruler', 7.4), 'How long is the strip? Read the ruler (0 - 12 cm).'],
    ] as [MeasureShapeConfig, string][]) expect(faults(c, p), p).toEqual([])
    // A set task states its target: that is the task, not the answer.
    expect(faults(scale('set', 'cylinder', 34), 'Set the water level to 34 ml.')).toEqual([])
  })

  it('may not give a shape’s dimensions away for a make task', () => {
    const c = make(6, 10)
    expect(faults(c, 'Make a 2 by 3 rectangle with area 6.').join(' ')).toMatch(/gives the shape away \("2 by 3"\)/)
    expect(faults(c, 'Shade a 3 x 2 rectangle.').join(' ')).toMatch(/gives the shape away/)
    expect(faults(c, 'Make a shape with area 6 squares and perimeter 10 units.')).toEqual([])
    // A 1 by 6 strip has the area but not the perimeter, so naming it is not the answer.
    expect(faults(c, 'Is a 1 by 6 strip the answer? Make a shape with area 6 and perimeter 10.')).toEqual([])
  })

  it('may not say which shape is larger, nor a hidden measure, nor ask the opposite question', () => {
    const c = compare('area', 8)
    const pair = comparePair(c.task as CompareTask)!
    for (const p of ['Shape A has the larger perimeter. Check it.', 'B is longer all the way round.', 'Shape B has more perimeter, so pick it.', 'The answer is B.', 'The answer: shape A.']) {
      expect(faults(c, p).join(' '), p).toMatch(/the prompt (says which shape is bigger|names the answer)/)
    }
    expect(faults(c, `One shape has perimeter ${pair.a.perimeter}. Which has the larger perimeter?`).join(' ')).toMatch(new RegExp(`gives a perimeter away \\(${pair.a.perimeter}\\)`))
    expect(faults(c, 'Both shapes cover the same area. Which shape has the smaller perimeter?').join(' ')).toMatch(/asks which shape is smaller, but this card asks which is larger/)
    expect(faults(compare('area', 8, 'smaller'), 'Which shape has the larger perimeter?').join(' ')).toMatch(/asks which shape is larger, but this card asks which is smaller/)
    expect(faults(c, 'Which shape has the larger area?').join(' ')).toMatch(/asks about the area, but the shapes share it/)
    for (const p of [
      'Both shapes cover the same area. Which has the larger perimeter?',
      'Compare shapes A and B. Both have area 8. Which has the longer perimeter?',
      'Look at shapes A and B: which one has a greater perimeter?',
      'Which of the two shapes has more perimeter, A or B?',
    ]) expect(faults(c, p), p).toEqual([])
    expect(faults(compare('perimeter', 12), 'Both have a perimeter of 12 units. Which one has the larger area?')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('measure-shape')!
    // Each example's prompt, then its config by matching braces.
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"/g)].map((m) => {
      const from = e.prompt.indexOf('"config": ', m.index!) + '"config": '.length
      let depth = 0
      let end = from
      for (; end < e.prompt.length; end++) {
        if (e.prompt[end] === '{') depth++
        if (e.prompt[end] === '}' && --depth === 0) break
      }
      return { prompt: m[1], config: JSON.parse(e.prompt.slice(from, end + 1)) }
    })
    expect(found.length).toBeGreaterThanOrEqual(4)
    expect(new Set(found.map((f) => f.config.task.kind))).toEqual(new Set(['read', 'set', 'make', 'compare']))
    for (const ex of found) {
      const c = e.parse(ex.config)!
      expect(c, ex.prompt).not.toBeNull()
      expect(e.faults(c), ex.prompt).toEqual([])
      expect(e.promptFaults!(c, ex.prompt), ex.prompt).toEqual([])
      expect(validateSpec({ pattern: 'scene', prompt: ex.prompt, payload: { engine: 'measure-shape', config: ex.config }, success: { kind: 'scene' } }), ex.prompt).toBe(true)
    }
  })
})

describe('the catalogue entry', () => {
  it('is registered for the tutor, with its config and every task kind in orbit’s format', () => {
    expect(getEngine('measure-shape')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/^SCENE "measure-shape"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"engine":"measure-shape"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:measure-shape"/)
    expect(engine.prompt).toMatch(/"isolates":"magnitude"/)
    for (const kind of ['read', 'set', 'make', 'compare']) expect(engine.prompt).toContain(`"kind":"${kind}"`)
    for (const inst of INSTRUMENTS) expect(engine.prompt).toContain(inst)
  })

  it('says plainly what the card shows and what it keeps until it is marked', () => {
    expect(engine.prompt).toMatch(/never prints\s+the reading, nor what a small division is worth, until it is marked/)
    expect(engine.prompt).toMatch(/but no count/)
    expect(engine.prompt).toMatch(/given once marked/)
  })

  it('is an activity whose intent is magnitude', () => {
    const spec = { pattern: 'scene', prompt: 'Read it.', payload: { engine: 'measure-shape', config: CYL }, success: { kind: 'scene' } }
    expect(validateSpec(spec)).toBe(true)
    expect(dimensionsOf(spec as never)).toEqual(['magnitude'])
    expect(validateSpec({ ...spec, payload: { engine: 'measure-shape', config: { task: { kind: 'read', instrument: 'cylinder' } } } })).toBe(false)
  })

  it('is offered to the stations it is for, and not to those that merely share a word', () => {
    for (const station of [
      'Reading scales: measuring cylinders and rulers', 'Using a measuring cylinder', 'Reading a thermometer', 'Area and perimeter of rectangles',
      'Finding the perimeter of a shape', 'Area of compound shapes', 'Compound shapes: splitting into rectangles',
    ]) expect(sceneCatalogue(station), station).toContain('SCENE "measure-shape"')
    expect(scenesFor('Reading scales on a thermometer and a measuring cylinder').map((x) => x.id)).toContain('measure-shape')
    // scenesFor tells a station the scene is made for it: phrases, never the bare word "area".
    for (const station of ['Area and perimeter of rectangles', 'Area by counting squares', 'Area of compound shapes', 'Perimeter of rectangles and squares', 'Using a measuring cylinder', 'Reading a thermometer'])
      expect(scenesFor(station).map((x) => x.id), station).toContain('measure-shape')
    for (const station of ['Urban areas', 'Area of a circle', 'Surface area of a cuboid', 'Perimeter of a semicircle', 'Population density of an area', 'Reading a graph', 'Equivalent fractions'])
      expect(scenesFor(station).map((x) => x.id), station).not.toContain('measure-shape')
    expect(engine.covers).not.toContain('area')
    expect(engine.covers).not.toContain('perimeter')
    expect(engine.covers).toEqual(expect.arrayContaining(['area and perimeter', 'area by counting squares', 'compound shapes']))
    for (const station of ['Equivalent fractions', 'Changes of state: what happens when ice melts', 'Reading a graph', 'Drawing a line graph', 'Linear equations: solving 2x + 3 = 11'])
      expect(sceneCatalogue(station), station).not.toContain('SCENE "measure-shape"')
  })

  it('is refused by the meaning gates for a config it cannot teach, and for a prompt that gives the answer', () => {
    const action = (config: unknown, prompt = 'Read the cylinder.') =>
      ({ type: 'createActivity', id: 'm1', spec: { pattern: 'scene', prompt, payload: { engine: 'measure-shape', config }, success: { kind: 'scene' } } })
    expect(meaningFaults(action(CYL))).toEqual([])
    expect(meaningFaults(action(scale('read', 'cylinder', 100))).join(' ')).toMatch(/numbered mark/)
    expect(meaningFaults(action(make(6, 9))).join(' ')).toMatch(/always even/)
    expect(meaningFaults(action(CYL, 'The cylinder shows 34 ml.')).join(' ')).toMatch(/gives the reading away/)
  })
})

// ---------------------------------------------------------------------------

describe('the measure-shape scene on the board', { timeout: 60_000 }, () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'measure-shape', config }, success: { kind: 'scene' } } },
    } as never)))
  const view = (c: MeasureShapeConfig, state: unknown, marked: SceneMarked) =>
    renderToStaticMarkup(createElement(MeasureShapeView, { config: c, state: state as never, setState: () => {}, marked, reduced: false, locked: marked === 'right' || marked === 'shown' }))

  it('read: draws the instrument, its numbered marks and a box for the reading, and nothing else about the level', () => {
    const html = card(CYL, 'Read the level of the water in the measuring cylinder.')
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="The measuring cylinder, numbered from 0 to 50 ml, with 4 small marks between each pair of numbered marks. The bottom of the curved water surface is 2 small divisions above the 30 mark."')
    expect(html).toMatch(/<input[^>]*inputMode="decimal"/)
    expect(html).toContain('Your reading')
    expect(html).toContain('Measuring cylinder, in ml')
    expect(html).not.toMatch(/role="slider"/)
  })

  it('read: gives no number that is the reading, and no division size, before it is marked', () => {
    const prompt = 'Read the level of the water in the measuring cylinder.'
    const { texts, aloud } = said(card(CYL, prompt).replace(prompt, ''))
    expect(numberTokens(texts)).not.toContain(34)
    expect(`${texts} ${aloud}`).not.toMatch(/each small division|34 ml|worth|Put it back|You read/)
  })

  it('read: every value on every instrument shows a number nowhere that is its reading', () => {
    let shown = 0
    for (const inst of INSTRUMENTS) {
      for (const g of DESIGNS[inst]) {
        for (let t = g.min + g.minor; t < g.max; t += g.minor * Math.max(1, Math.floor(divisionsOf(g) / 7))) {
          if (isNumbered(g, t)) continue
          const c = scale('read', inst, t / 10, { unit: g.unit, step: g.minor / 10 })
          if (engine.faults(c).length) continue
          shown++
          const html = view(c, engine.initial(c), 'idle')
          const { texts, aloud } = said(html)
          const r = resolveScale(c.task as ScaleTask)!
          if (r.design !== g) continue
          // Numbers in what is seen: the numbered marks, which are never the reading.
          for (const n of numberTokens(texts)) if (Math.abs(n * 10 - r.t) < 1e-6) throw new Error(`${inst} ${t / 10}: "${texts}"`)
          if (new RegExp(`${fmtTenths(r.t).replace('−', '[-−]')} ?${r.unit.replace('°', '°')}`).test(aloud)) throw new Error(`${inst} ${t / 10}: read aloud`)
          if (/each small division|worth/.test(`${texts} ${aloud}`)) throw new Error(`${inst}: says what a small division is`)
        }
      }
    }
    expect(shown).toBeGreaterThan(150)
  })

  it('set: states the target, and offers a slider that says where the level is, not what it reads', () => {
    const html = card(THERMO, 'Set the thermometer to -7 degrees C.')
    expect(html).toContain('Set the top of the liquid to')
    expect(html).toContain('−7 °C')
    expect(html).toMatch(/role="slider"[^>]*tabindex="0"[^>]*/i)
    expect(html).toMatch(/aria-valuemin="0"/)
    expect(html).toMatch(/aria-valuemax="50"/)
    expect(html).toMatch(/aria-valuenow="50"/)
    expect(html).toMatch(/aria-valuetext="at the 30 mark"/)
    expect(html).not.toMatch(/aria-valuetext="[^"]*°C/)
    const mid = view(THERMO, { level: -40 }, 'idle')
    expect(mid).toMatch(/aria-valuetext="6 small divisions above the −10 mark"/)
    expect(mid).toMatch(/aria-valuenow="16"/)
    // The reading the level has is never shown while it moves.
    expect(said(mid).texts).not.toMatch(/−4|-4/)
    expect(mid).not.toMatch(/<input/)
  })

  it('set: the level moves with the state, on every instrument, and the picture changes', () => {
    for (const c of [scale('set', 'cylinder', 34), THERMO, scale('set', 'ruler', 7.4), scale('set', 'balance', 3.5), scale('set', 'scales', 340)]) {
      const r = resolveScale(c.task as ScaleTask)!
      const away = view(c, engine.initial(c), 'idle')
      const there = view(c, engine.solve(c), 'idle')
      expect(away, `${(c.task as ScaleTask).instrument}`).not.toBe(there)
      expect(there).toMatch(new RegExp(`aria-valuetext="${positionWords(r.instrument, r.design, r.t)}"`))
    }
  })

  it('make: draws a grid a keyboard can walk, with the targets beside it and no count of its own', () => {
    const html = card(make(6, 10), 'Make a shape with area 6 squares and perimeter 10 units.')
    expect(html).toContain('role="grid"')
    expect(html).toMatch(/tabindex="0"/)
    expect((html.match(/role="gridcell"/g) ?? []).length).toBe(GRID_COLS * GRID_ROWS)
    expect((html.match(/role="row"/g) ?? []).length).toBe(GRID_ROWS)
    expect(html).toContain('Area: 6 squares')
    expect(html).toContain('Perimeter: 10 units')
    expect(html).toContain('Clear the grid')
    expect(html).toMatch(/Each square has sides 1 unit long/)
    const { texts } = said(view(make(6, 10), { cells: at([0, 0], [0, 1], [0, 2], [1, 0]) }, 'idle').replace(/<button.*?<\/button>/g, ''))
    // While the learner works: no area or perimeter of their own shape, in sight or aloud.
    expect(texts).not.toMatch(/You made|Area 4|perimeter 8|\b4 squares\b/)
  })

  it('make: lists each square as shaded or empty, for a screen reader, and draws a dash for each unit of the outline', () => {
    const html = view(make(6, 10), { cells: at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]) }, 'idle')
    expect(html).toMatch(/aria-label="row 1, column 1, shaded"/)
    expect(html).toMatch(/aria-label="row 3, column 1, empty"/)
    expect((html.match(/aria-selected="true"/g) ?? []).length).toBe(6)
    expect((html.match(/<g stroke="#0B1D33"[^>]*>(.*?)<\/g>/)?.[1].match(/<line /g) ?? []).length).toBe(10)
  })

  it('make: names what was made only once marked, and puts the controls away once solved', () => {
    const six = make(6, 10)
    const rect = { cells: at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]) }
    const wrong = view(six, { cells: at([0, 0], [0, 1], [0, 2], [1, 0], [1, 1]) }, 'wrong')
    expect(wrong).toContain('You made area 5 squares and perimeter 10 units.')
    expect(wrong).toContain('The area needs to be 6 squares.')
    const right = view(six, rect, 'right')
    expect(right).toContain('Area 6 squares, perimeter 10 units.')
    expect(right).not.toContain('Clear the grid')
    expect(right).toMatch(/aria-readonly="true"/)
    expect(right).toMatch(/tabindex="-1"/)
  })

  it('compare: draws two shapes with a pick button each, and keeps their measures until it is marked', () => {
    const c = compare('area', 8)
    const pair = comparePair(c.task as CompareTask)!
    const html = card(c, 'Both shapes cover the same area. Which has the larger perimeter?')
    expect(html).toContain('role="radiogroup"')
    expect((html.match(/role="radio"/g) ?? []).length).toBe(2)
    expect(html).toContain('Pick shape A')
    expect(html).toContain('Pick shape B')
    expect(html).toContain('Shape A')
    expect(html).toContain('Shape B')
    expect(html).toContain('Which shape has the larger perimeter?')
    expect(html).toContain('Both shapes have an area of 8 squares.')
    expect(html).toMatch(/aria-label="Shape A on a squared grid, 9 columns by 9 rows: row/)
    expect((html.match(/aria-checked="true"/g) ?? []).length).toBe(0)
    const { texts, aloud } = said(html.replace('Both shapes cover the same area. Which has the larger perimeter?', ''))
    for (const p of [pair.a.perimeter, pair.b.perimeter]) expect(`${texts} ${aloud}`, `perimeter ${p}`).not.toMatch(new RegExp(`[Pp]erimeter:? ${p}\\b`))
    expect(`${texts} ${aloud}`).not.toMatch(/Shape [AB] has the larger|picked|Shapes with the same/)
    // Every shape is described by where its squares are, which is what is seen, and not by what it measures.
    expect(aloud).not.toMatch(/perimeter \d|area \d/i)
  })

  it('compare: marks the pick, names the measures once marked, and leaves the pick standing', () => {
    const c = compare('perimeter', 12)
    const pair = comparePair(c.task as CompareTask)!
    const wrong = pair.answer === 'a' ? 'b' : 'a'
    const html = view(c, { pick: wrong }, 'wrong')
    expect(html).toContain(`You picked shape ${wrong.toUpperCase()}.`)
    expect(html).toContain(`Shape ${pair.answer.toUpperCase()} has the larger area. Both have perimeter 12 units.`)
    expect(html).toMatch(new RegExp(`Area ${pair.a.area} squares`))
    expect(html).toMatch(/aria-checked="true"/)
    const right = view(c, { pick: pair.answer }, 'right')
    expect(right).toContain('Shapes with the same perimeter can have different areas.')
    expect(right).toMatch(/aria-disabled="true"/)
  })

  it('compare: the radio group has one stop on Tab, whichever is picked', () => {
    const c = compare('area', 8)
    const none = view(c, { pick: '' }, 'idle')
    expect((none.match(/role="radio"[^>]*tabindex="0"/g) ?? []).length + (none.match(/tabindex="0"[^>]*role="radio"/g) ?? []).length).toBe(1)
    const b = view(c, { pick: 'b' }, 'idle')
    const stops = [...b.matchAll(/<button[^>]*>/g)].map((m) => m[0]).filter((t) => /tabindex="0"/.test(t))
    expect(stops).toHaveLength(1)
    expect(stops[0]).toMatch(/aria-checked="true"/)
  })

  it('names no answer before marking, on any card, even to a screen reader', () => {
    for (const c of [CYL, scale('read', 'scales', 340), scale('read', 'ruler', 7.4), make(6, 10), compare('area', 8), compare('perimeter', 16, 'smaller'), THERMO]) {
      const html = view(c, engine.initial(c), 'idle')
      expect(html, JSON.stringify(c)).not.toMatch(/You (read|made|picked|set)|Put it back|small division is|Shapes with the same|Area is the squares counted/)
    }
  })

  it('still draws a state it cannot read, as the start', () => {
    for (const c of [CYL, THERMO, make(6, 10), compare('area', 8)]) {
      for (const bad of [null, undefined, 'junk', 7, { reading: 5, level: 'x', cells: 'y', pick: 3 }, { cells: [999, -1, 'a'] }]) {
        expect(() => view(c, bad, 'idle'), `${JSON.stringify(c)} ${JSON.stringify(bad)}`).not.toThrow()
      }
    }
  })

  it('draws a config it cannot show as a plain message, not a crash', () => {
    expect(view(scale('read', 'cylinder', 34.5), {}, 'idle')).toContain('This scale could not be drawn.')
    expect(view(compare('area', 3), {}, 'idle')).toContain('These shapes could not be drawn.')
  })

  it('has no text smaller than 12 px and no text split mid-word', () => {
    for (const c of [CYL, THERMO, scale('read', 'ruler', 7.4), scale('read', 'scales', 340), scale('set', 'balance', 3.5), make(6, 10), compare('area', 8)]) {
      const html = view(c, engine.initial(c), 'idle')
      for (const m of html.matchAll(/font-size[:=]"?(\d+(?:\.\d+)?)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/break-all|break-words|capitalize/)
    }
  })

  it('moves nothing under reduced motion because nothing moves by itself', () => {
    for (const c of [CYL, THERMO, make(6, 10), compare('area', 8)]) {
      const html = renderToStaticMarkup(createElement(MeasureShapeView, { config: c, state: engine.initial(c) as never, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
      expect(html).not.toMatch(/animate|transition|keyframes/)
    }
  })
})
