// lib/studylab/engines/standard-form/standard-form.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  baseOf, currentDecimal, decimalText, done, frameOf, isStandard, liveEquation, madeText,
  moveBounds, ordinaryLeft, readDecimal, readMove, standardExponent, standardFormEngine,
  standardParts, tapeDigits, working, MAX_POWER,
  type StandardFormConfig,
} from './config'
import { StandardFormView, tapeLayout, visibleCells, W, CELL_W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const parse = (raw: unknown) => standardFormEngine.parse(raw)!
const clean = (raw: unknown) => {
  const config = parse(raw)
  expect(standardFormEngine.faults(config)).toEqual([])
  return config
}

describe('exact decimal strings', () => {
  it('reads ordinary and scientific forms without rounding or exponential formatting', () => {
    expect(readDecimal('384000')).toEqual({ digits: '384', exp: 3, negative: false })
    expect(readDecimal('0.0032')).toEqual({ digits: '32', exp: -4, negative: false })
    expect(readDecimal('3.84 × 10^5')).toEqual({ digits: '384', exp: 3, negative: false })
    expect(readDecimal('9.1e-3')).toEqual({ digits: '91', exp: -4, negative: false })
    expect(readDecimal('.05')).toEqual({ digits: '5', exp: -2, negative: false })
    expect(readDecimal('5.')).toEqual({ digits: '5', exp: 0, negative: false })
    expect(readDecimal('1,234,500')).toEqual({ digits: '12345', exp: 2, negative: false })
    expect(readDecimal('0')).toEqual({ digits: '0', exp: 0, negative: false })
    expect(readDecimal('-3.2')).toEqual({ digits: '32', exp: -1, negative: true })
    expect(readDecimal('3.2e9999')).toBeNull()
    expect(readDecimal('three')).toBeNull()
    expect(readDecimal('3.2.1')).toBeNull()
  })

  it('keeps every placeholder zero in its own place-value column', () => {
    const large = tapeDigits(readDecimal('384000')!)
    expect(large.map((d) => d.digit).join('')).toBe('384000')
    expect(large.map((d) => d.place)).toEqual([5, 4, 3, 2, 1, 0])
    expect(large.map((d) => d.fromTape)).toEqual([true, true, true, false, false, false])
    const small = tapeDigits(readDecimal('0.0032')!)
    expect(small.map((d) => d.digit).join('')).toBe('00032')
    expect(small.map((d) => d.place)).toEqual([0, -1, -2, -3, -4])
    expect(small.map((d) => d.fromTape)).toEqual([false, false, false, true, true])
    expect(decimalText(readDecimal('0.000001')!)).toBe('0.000001')
    expect(decimalText(readDecimal('100.0203')!)).toBe('100.0203')
  })

  it('normalizes standard form by the leading significant digit, including 9.99 and 10', () => {
    expect(standardParts(readDecimal('384000')!)).toEqual({ coefficient: { digits: '384', exp: -2, negative: false }, power: 5 })
    expect(decimalText(standardParts(readDecimal('384000')!).coefficient)).toBe('3.84')
    expect(standardExponent(readDecimal('0.0032')!)).toBe(-3)
    expect(isStandard(readDecimal('9.99')!)).toBe(true)
    expect(isStandard(readDecimal('1')!)).toBe(true)
    expect(isStandard(readDecimal('10')!)).toBe(false)
    expect(isStandard(readDecimal('0.5')!)).toBe(false)
  })
})

describe('the tutor config', () => {
  it('reads flat, nested and common task phrasings', () => {
    expect(parse({ task: 'write', value: '384000' })).toEqual({ task: 'write', value: '384000' })
    expect(parse({ task: 'scientific notation', number: 0.0032 })).toEqual({ task: 'write', value: '0.0032' })
    expect(parse({ task: { kind: 'to ordinary', a: '3.84', n: 5 } })).toEqual({ task: 'expand', coefficient: '3.84', power: 5 })
    expect(parse({ task: 'expand', coefficient: '9.1', exponent: '-3' })).toEqual({ task: 'expand', coefficient: '9.1', power: -3 })
    expect(parse({ expression: '3.84 × 10^5' })).toEqual({ task: 'expand', coefficient: '3.84', power: 5 })
    expect(parse({ task: 'write', expression: '3.84e5' })).toEqual({ task: 'write', value: '384000' })
    expect(parse(null)).toBeNull()
    expect(parse({})).toBeNull()
    expect(parse({ task: 'order', value: 3 })).toBeNull()
  })

  it('refuses narrowly, with a nearby example that works', () => {
    expect(standardFormEngine.faults(parse({ task: 'write', value: '384000' }))).toEqual([])
    expect(standardFormEngine.faults(parse({ task: 'write', value: '5' }))[0]).toMatch(/already between 1 and 10/)
    expect(standardFormEngine.faults(parse({ task: 'write', value: '0' }))[0]).toMatch(/Zero/)
    expect(standardFormEngine.faults(parse({ task: 'write', value: '-384000' }))[0]).toMatch(/negative values/)
    expect(standardFormEngine.faults(parse({ task: 'expand', coefficient: '38.4', power: 4 }))[0]).toMatch(/coefficient "3.84", power 5/)
    expect(standardFormEngine.faults(parse({ task: 'expand', coefficient: '3.84', power: 0 }))[0]).toMatch(/power 5/)
    expect(standardFormEngine.faults(parse({ task: 'expand', coefficient: '3.84', power: 50 }))[0]).toMatch(/whole number from -9 to 9/)
    expect(standardFormEngine.faults(parse({ task: 'write', value: '1.23456789e5' }))[0]).toMatch(/at most 7/)
  })

  it('offers the scene only to its own stations, not the neighbours', () => {
    expect(scenesFor('Writing very large and very small numbers in standard form').map((e) => e.id)).toContain('standard-form')
    expect(sceneCatalogue('Scientific notation')).toContain('SCENE "standard-form"')
    expect(sceneCatalogue('Multiplying and dividing by powers of ten')).toContain('SCENE "standard-form"')
    expect(sceneCatalogue('Place value with counters')).not.toContain('SCENE "standard-form"')
    expect(sceneCatalogue('Rounding decimals and significant figures')).not.toContain('SCENE "standard-form"')
    expect(sceneCatalogue('Binary numbers and file sizes')).not.toContain('SCENE "standard-form"')
    expect(sceneCatalogue('General laws of indices in algebra')).not.toContain('SCENE "standard-form"')
    expect(standardFormEngine.isolates).toBe('magnitude')
  })
})

/** Every supported terminating decimal with up to three digits, plus larger and random examples. */
function everyConfig(): StandardFormConfig[] {
  const out: StandardFormConfig[] = []
  for (let n = 1; n <= 999; n++) {
    for (let e = -6; e <= 6; e++) {
      const d = { digits: String(n), exp: e }
      for (const task of ['write', 'expand'] as const) {
        const raw = task === 'write'
          ? { task, value: decimalText(d) }
          : { task, coefficient: decimalText(d), power: -standardExponent(d) }
        const c = standardFormEngine.parse(raw)
        if (c && standardFormEngine.faults(c).length === 0) out.push(c)
      }
    }
  }
  let seed = 31
  for (let k = 0; k < 250; k++) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    const digits = String(1 + seed % 9999999)
    seed = (seed * 1103515245 + 12345) % 2147483648
    const exp = seed % 13 - 6
    const d = { digits, exp }
    const c = parse({ task: 'write', value: decimalText(d) })
    if (standardFormEngine.faults(c).length === 0) out.push(c)
  }
  return out
}

describe('every valid configuration', { timeout: 50_000 }, () => {
  const all = everyConfig()
  it('starts unsolved, solves exactly, and stays within drawable bounds', () => {
    expect(all.length).toBeGreaterThan(5000)
    for (const config of all) {
      const start = standardFormEngine.initial(config)
      const solved = standardFormEngine.solve(config)
      expect(standardFormEngine.check(config, start).ok, JSON.stringify(config)).toBe(false)
      expect(standardFormEngine.check(config, solved).ok, JSON.stringify(config)).toBe(true)
      expect(done(config, solved)).toBe(true)
      const b = moveBounds(config)
      expect(start.move).toBeGreaterThanOrEqual(b.lo)
      expect(start.move).toBeLessThanOrEqual(b.hi)
      expect(solved.move).toBeGreaterThanOrEqual(b.lo)
      expect(solved.move).toBeLessThanOrEqual(b.hi)
      expect(readMove(config, { move: 999 })).toBe(b.hi)
      expect(frameOf(config).high - frameOf(config).low + 1).toBe(10)
      // Marking is exact: a noninteger or merely nearby position is not a hidden float tolerance.
      expect(done(config, { move: solved.move + 0.01 })).toBe(false)
    }
  })

  it('keeps the equation exactly equal at every reachable move', () => {
    for (const config of all) {
      const b = moveBounds(config)
      for (let move = b.lo; move <= b.hi; move++) {
        const eq = liveEquation(config, move)
        const before = readDecimal(config.task === 'write' ? ordinaryLeft(config) : `${decimalText(baseOf(config))}e${config.power}`)!
        const after = readDecimal(`${decimalText(eq.right)}e${eq.power}`)!
        expect({ digits: after.digits, exp: after.exp }, JSON.stringify(config)).toEqual({ digits: before.digits, exp: before.exp })
        const cells = tapeLayout(config, move).cells
        expect(cells.map((c) => c.digit).join('')).toBe(tapeDigits(baseOf(config)).map((c) => c.digit).join(''))
        expect(cells.every((c, i) => i === 0 || c.place === cells[i - 1].place - 1)).toBe(true)
        // Every significant digit stays visible. Original placeholder zeros may slide off
        // the tape once they are beyond the coefficient, but no digit in the current value may.
        const visible = cells.filter((c) => c.x >= 16 && c.x < 344)
        expect(cells.filter((c) => c.digit !== '0').every((c) => visible.includes(c)), JSON.stringify({ config, move })).toBe(true)
        const required = tapeDigits(currentDecimal(config, move))
        const f = frameOf(config)
        expect(required[0].place).toBeLessThanOrEqual(f.high)
        expect(required[required.length - 1].place).toBeGreaterThanOrEqual(f.low)
        const printed = visibleCells(config, move).map((c) => c.digit ?? '').join('').replace(/^0+(?=\d)/, '')
        const expected = decimalText(currentDecimal(config, move)).replace('.', '').replace('-', '').replace(/^0+(?=\d)/, '')
        expect(printed, JSON.stringify({ config, move })).toBe(expected)
        expect(visibleCells(config, move).filter((c) => c.digit !== null)).toHaveLength(new Set(visibleCells(config, move).filter((c) => c.digit !== null).map((c) => c.place)).size)
      }
    }
  })
})

const solvedPower = (config: StandardFormConfig) => standardFormEngine.solve(config).move

describe('the examples from the job', () => {
  it('shows 384000, not a 384 strip, and balances 3.84 × 10^5', () => {
    const c = clean({ task: 'write', value: '384000' })
    expect(tapeDigits(baseOf(c)).map((d) => d.digit).join('')).toBe('384000')
    expect(standardFormEngine.initial(c)).toEqual({ move: 0 })
    expect(standardFormEngine.check(c, { move: 0 }).ok).toBe(false)
    expect(standardFormEngine.solve(c)).toEqual({ move: 5 })
    expect(standardFormEngine.check(c, standardFormEngine.solve(c)).ok).toBe(true)
    const live = liveEquation(c, 5)
    expect(decimalText(live.right)).toBe('3.84')
    expect(live.power).toBe(5)
    expect(working(c, { move: 5 })).toMatch(/384000 = 3.84 × 10\^5/)
    expect(madeText(c, { move: 4 })).toMatch(/38.4 × 10\^4/)
    expect(madeText(c, { move: 6 })).toMatch(/0.384 × 10\^6/)
  })

  it('uses negative powers for small positive numbers, never negative values', () => {
    const c = clean({ task: 'write', value: '0.0032' })
    expect(standardFormEngine.solve(c)).toEqual({ move: -3 })
    expect(decimalText(currentDecimal(c, -3))).toBe('3.2')
    expect(working(c, { move: -3 })).toMatch(/0.0032 = 3.2 × 10\^-3/)
    expect(working(c, { move: -3 })).toMatch(/small number, not a negative number/)
    const back = clean({ task: 'expand', coefficient: '9.1', power: -3 })
    expect(standardFormEngine.solve(back)).toEqual({ move: 3 })
    expect(decimalText(currentDecimal(back, 3))).toBe('0.0091')
    expect(working(back, { move: 3 })).toMatch(/9.1 × 10\^-3 = 0.0091/)
  })
})

describe('the prompt', () => {
  const faults = (raw: unknown, prompt: string) => standardFormEngine.promptFaults!(parse(raw), prompt)
  it('names the value and gesture, without the result, direction or move count', () => {
    expect(faults({ task: 'write', value: '384000' }, 'Slide the digit tape, or use the arrow buttons, to write 384000 in standard form.')).toEqual([])
    expect(faults({ task: 'expand', coefficient: '9.1', power: -3 }, 'Slide the digit tape, or use the arrow buttons, to write 9.1 × 10^-3 as an ordinary number.')).toEqual([])
    expect(faults({ task: 'write', value: '384000' }, 'Slide the tape to make 3.84 × 10^5.')[0]).toMatch(/gives the answer away/)
    expect(faults({ task: 'write', value: '384000' }, 'Slide the digits 5 columns left.')[0]).toMatch(/gives the answer away/)
    expect(faults({ task: 'expand', coefficient: '3.84', power: 5 }, 'Move the digits right.')[0]).toMatch(/gives the answer away/)
    expect(faults({ task: 'write', value: '384000' }, 'Type the standard form.').join(' ')).toMatch(/gesture|does not show/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('standard-form')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{[^\n]+?\})\s*\}/g)]
    expect(found).toHaveLength(4)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(e.faults(c)).toEqual([])
      expect(e.check(c, e.initial(c)).ok).toBe(false)
      expect(e.check(c, e.solve(c)).ok).toBe(true)
      expect(e.promptFaults!(c, m[1])).toEqual([])
    }
  })
})

describe('the drawing and its accessibility', () => {
  const view = (config: StandardFormConfig, move: number, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) => renderToStaticMarkup(createElement(StandardFormView, {
    config, state: { move }, setState: () => {}, marked, reduced, locked: marked === 'right',
  }))

  it('lays ten columns evenly and renders a control for pointer and keyboard', () => {
    const c = clean({ task: 'write', value: '384000' })
    const cells = tapeLayout(c, 0).cells
    cells.forEach((cell, i) => expect(cell.x).toBeCloseTo(cells[0].x + i * CELL_W, 10))
    expect(W).toBe(360)
    expect(CELL_W).toBe(32.8)
    const html = view(c, 0)
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-label="Slide digits one column left"')
    expect(html).toContain('aria-label="Slide digits one column right"')
    expect(html).toContain('decimal point stays fixed')
    expect(html).toContain('>3</text>')
    expect(html).toContain('>8</text>')
    expect(html).toContain('>4</text>')
    expect(html).toContain('384000</span>')
    // No product is drawn before the learner acts; ignore the screen-reader equation.
    expect(html.replace(/<span class="sr-only"[\s\S]*?<\/span>/g, '')).not.toContain('384000 ×')
  })

  it('changes the picture by a full visible column on the smallest move', () => {
    const c = clean({ task: 'write', value: '384000' })
    expect(tapeLayout(c, 0).cells[0].x).toBeGreaterThanOrEqual(16)
    expect(tapeLayout(c, 1).cells[0].x).toBeCloseTo(tapeLayout(c, 0).cells[0].x + CELL_W, 10)
    expect(tapeLayout(c, 1).cells[0].x - tapeLayout(c, 0).cells[0].x).toBeCloseTo(CELL_W, 10)
    expect(view(c, 0)).not.toBe(view(c, 1))
    expect(view(c, 0, 'idle', true)).not.toContain('transition:transform')
    expect(view(c, 0)).toContain('transition:transform 650ms ease')
  })

  it('says no finishing value or direction before marking, including to a screen reader', () => {
    const large = view(clean({ task: 'write', value: '384000' }), 0)
    expect(large).not.toContain('3.84')
    expect(large).not.toContain('5 columns')
    expect(large).not.toContain('columns left')
    const small = view(clean({ task: 'write', value: '0.0032' }), 0)
    expect(small).not.toContain('>3.2<')
    expect(small).not.toContain('small number, not a negative number')
    const back = view(clean({ task: 'expand', coefficient: '9.1', power: -3 }), 0)
    expect(back).not.toContain('0.0091')
    expect(back).not.toContain('small number, not a negative number')
  })

  it('says the exact answer when right and what was made when wrong', () => {
    const c = clean({ task: 'write', value: '384000' })
    expect(view(c, 5, 'right')).toContain('384000 = 3.84 × 10^5.')
    expect(view(c, 4, 'wrong')).toContain('You made 38.4 × 10^4')
    expect(view(c, 6, 'wrong')).toContain('You made 0.384 × 10^6')
    const shown = view(c, 0, 'shown')
    expect(shown).toContain('384000 = 3.84 × 10^5.')
  })

  it('renders through ActivityNode with no answer words before marking', () => {
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt: 'Slide the digit tape to write 384000 in standard form.', payload: { engine: 'standard-form', config: { task: 'write', value: '384000' } }, success: { kind: 'scene' } } },
    } as never))).replace('Slide the digit tape to write 384000 in standard form.', '')
    expect(html).toContain('Digit tape position')
    expect(html).not.toContain('3.84')
    // Check text content, not coordinates such as 38.4 in the SVG layout.
    const text = html.replace(/<[^>]+>/g, ' ')
    expect(text).not.toContain('38.4')
    expect(text).not.toContain('0.384')
  })
})
