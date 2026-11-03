import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
// The engine first: it registers itself, and its view comes with it.
import {
  trigCircleEngine as engine, ANGLE_STEP, EXACT_ANGLES, LADDER_MAX, LADDER_MIN, TILT_MAX, TILT_MIN, VALUES,
  angleAt, angleOf, done, exactKey, fmtM, footMax, footOf, ladderOk, madeText, numberOfKey, readValue, showKey, showNumber, signOfKey, solutions,
  targetAngle, targetFoot, LADDER_TOLERANCE, askedAt, snapFoot, topAt, valueRange, working,
  type TrigConfig, type TrigState,
} from './config'
import {
  CX, CY, GROUND_Y, GW, GX, H, LADDER_PX, R, STEP_DEG, TILT_LIMITS, W, WALL_X, TrigCircleView, curvePath, ladderGeometry, pointGeometry, rungCount,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import type { SceneMarked } from '../types'
import { validateSpec } from '../../activities/validate'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

type Ladder = Extract<TrigConfig, { task: 'ladder' }>
type Circle = Extract<TrigConfig, { task: 'circle' }>

const ladder = (length: number, ask: string, value: number): Ladder => ({ task: 'ladder', length, ask, value })
const circle = (fn: string, value: string, other?: string): Circle => ({ task: 'circle', fn, value, ...(other ? { other } : {}) })

const rad = (d: number) => (d * Math.PI) / 180

describe('reading the config', () => {
  it('reads a ladder, broadly', () => {
    expect(engine.parse({ task: 'ladder', length: 5, ask: 'height', value: 4 })).toEqual(ladder(5, 'height', 4))
    expect(engine.parse({ task: 'ladder', length: '5 m', ask: 'out', value: '3 metres' })).toEqual(ladder(5, 'out', 3))
    expect(engine.parse({ task: 'triangle', length: 10, reach: 8 })).toEqual(ladder(10, 'height', 8))
    expect(engine.parse({ task: 'ladder', length: 5, ask: 'sine', value: 4 })).toEqual(ladder(5, 'height', 4))
    expect(engine.parse({ task: 'ladder', length: 5, ask: 'cosine', value: 3 })).toEqual(ladder(5, 'out', 3))
    expect(engine.parse({ length: 5, out: 3 })).toEqual(ladder(5, 'out', 3))
    // A value outside the range still parses, so faults can say what would work.
    expect(engine.parse({ task: 'ladder', length: 40, ask: 'height', value: 4 })).toEqual(ladder(40, 'height', 4))
    expect(engine.parse({ task: 'ladder', length: 5, ask: 'slope', value: 4 })).toEqual(ladder(5, 'slope', 4))
  })

  it('reads a circle, broadly', () => {
    expect(engine.parse({ task: 'circle', fn: 'sine', value: '1/2' })).toEqual(circle('sine', '1/2'))
    expect(engine.parse({ task: 'unit-circle', fn: 'sin', value: 0.5, other: 'negative' })).toEqual(circle('sine', '0.5', 'negative'))
    expect(engine.parse({ task: 'circle', fn: 'Cosine', value: '√3/2', other: '-' })).toEqual(circle('cosine', '√3/2', 'negative'))
    expect(engine.parse({ task: 'circle', fn: 'tan', value: '1' })).toEqual(circle('tangent', '1'))
    expect(engine.parse({ fn: 'cosine', value: '-1/2', other: 'plus' })).toEqual(circle('cosine', '-1/2', 'positive'))
  })

  it('refuses only what cannot be read at all', () => {
    for (const bad of [null, 'ladder', 7, [], {}, { task: 'sundial' }, { task: 'ladder', length: 'long', value: 4 }, { task: 'ladder', length: 5 }, { task: 'circle' }, { task: 'circle', fn: 'sine' }, { task: 'circle', fn: 'sine', value: {} }]) {
      expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    }
  })

  it('reads exact values in the ways they are written', () => {
    const cases: [string | number, string | null][] = [
      ['1/2', '1/2'], ['0.5', '1/2'], [0.5, '1/2'], ['½', '1/2'], ['half', '1/2'], ['-1/2', '-1/2'], ['−1/2', '-1/2'], ['minus half', '-1/2'], ['-0.5', '-1/2'],
      ['√2/2', '√2/2'], ['sqrt(2)/2', '√2/2'], ['1/√2', '√2/2'], ['0.707', '√2/2'], ['0.71', '√2/2'], ['-√2/2', '-√2/2'],
      ['√3/2', '√3/2'], ['sqrt3/2', '√3/2'], ['0.866', '√3/2'], ['0.87', '√3/2'], ['(√3)/2', '√3/2'], ['-√3 / 2', '-√3/2'],
      ['0', '0'], ['0.0', '0'], ['1', '1'], ['-1', '-1'], ['1/1', '1'],
      ['0.6', null], ['1/3', null], ['2', null], ['abc', null], ['', null], ['1/0', null],
    ]
    for (const [raw, key] of cases) expect(readValue(raw), String(raw)).toBe(key)
  })
})

describe('the exact values', () => {
  it('match the real sine and cosine at every angle the point can sit at, and only at the exact ones', () => {
    let exact = 0
    for (let a = 0; a < 360; a += ANGLE_STEP) {
      for (const fn of ['sine', 'cosine'] as const) {
        const key = exactKey(fn, a)
        const real = fn === 'sine' ? Math.sin(rad(a)) : Math.cos(rad(a))
        if (key === null) {
          // The odd multiples of 15 degrees are not on the table, and are no table value.
          expect(a % 30 !== 0 && a % 45 !== 0, `${fn} ${a}`).toBe(true)
          for (const k of VALUES) for (const sg of [1, -1]) expect(Math.abs(real - sg * numberOfKey(k)), `${fn} ${a}`).toBeGreaterThan(0.01)
        } else {
          exact += 1
          expect(Math.abs(numberOfKey(key) - real), `${fn} ${a}`).toBeLessThan(1e-9)
        }
      }
    }
    expect(exact).toBe(EXACT_ANGLES.length * 2)
    expect(EXACT_ANGLES.length).toBe(16)
  })

  it('are written the way a learner writes them', () => {
    expect(showKey('1/2')).toBe('½')
    expect(showKey('-1/2')).toBe('−½')
    expect(showKey('-√3/2')).toBe('−√3/2')
    expect(showKey('0')).toBe('0')
    expect(showNumber(-0.0001)).toBe('0.00')
    expect(showNumber(-0.866)).toBe('−0.87')
    expect(signOfKey('0')).toBe('zero')
  })
})

describe('the ladder', () => {
  it('is the right triangle: the length never changes, only the angle', () => {
    const c = ladder(5, 'height', 4)
    for (let d = 1; d <= footMax(5); d++) {
      const g = ladderGeometry(c, d)
      expect(Math.hypot(g.top.x - g.foot.x, g.top.y - g.foot.y)).toBeCloseTo(LADDER_PX, 6)
      expect(g.top.x).toBe(WALL_X)
      expect(Math.abs(topAt(5, d) ** 2 + (d / 10) ** 2 - 25)).toBeLessThan(1e-9)
    }
  })

  it('is right at the step nearest the true distance, and nowhere else', () => {
    // 3-4-5: 4 m up is exactly 3 m out; 53.13 degrees.
    const c = ladder(5, 'height', 4)
    expect(targetFoot(c)).toBeCloseTo(30, 9)
    expect(ladderOk(c, 30)).toBe(true)
    // Within LADDER_TOLERANCE of the mark counts: 3.1 m out puts the top at 3.9 m.
    expect(LADDER_TOLERANCE).toBe(0.15)
    expect(ladderOk(c, 31)).toBe(true)
    expect(ladderOk(c, 29)).toBe(true)
    expect(ladderOk(c, 20)).toBe(false)
    expect(ladderOk(c, 40)).toBe(false)
    expect(snapFoot(c, 31)).toBe(30)
    expect(snapFoot(c, 20)).toBe(20)
    expect(working(c, { foot: 31 })).toMatch(/^Near enough: at 3\.1 m the top is 3\.9 m\. The exact answer is 3 m: sin θ = 4\/5/)
    expect(working(c, { foot: 31 })).not.toMatch(/wrong/i)
    expect(targetAngle(c)).toBeCloseTo(53.130102, 5)
    expect(angleAt(5, 30)).toBeCloseTo(53.130102, 5)
    expect(targetAngle(ladder(5, 'out', 3))).toBeCloseTo(53.130102, 5)
    expect(targetAngle(ladder(10, 'height', 6))).toBeCloseTo(36.869898, 5)
    expect(ladderOk(ladder(5, 'out', 3), 32)).toBe(false)
    expect(working(ladder(5, 'out', 3), { foot: 31 })).toMatch(/^Near enough: the foot is 3\.1 m out/)
  })

  it('has a range that keeps every step of the foot visible, and a limit that says so', () => {
    expect(valueRange(5, 'height').lo).toBeCloseTo(5 * Math.sin(rad(TILT_MIN)), 9)
    expect(valueRange(5, 'out').hi).toBeCloseTo(5 * Math.cos(rad(TILT_MIN)), 9)
    expect(engine.faults(ladder(5, 'height', 4))).toEqual([])
    expect(engine.faults(ladder(5, 'height', 1))[0]).toMatch(/not possible/)
    expect(engine.faults(ladder(5, 'height', 1))[0]).toMatch(/use e\.g\. value 1\.8/)
    expect(engine.faults(ladder(5, 'height', 5))[0]).toMatch(/use e\.g\. value 4\.9/)
    expect(engine.faults(ladder(5, 'out', 4.9))[0]).toMatch(/value 4.6/)
    expect(engine.faults(ladder(12, 'height', 6))[0]).toMatch(/3 to 10 m.*length 5/)
    expect(engine.faults(ladder(5, 'slope', 3))[0]).toMatch(/use ask "height".*ask "out"/)
    for (const c of [ladder(5, 'height', 1), ladder(5, 'height', 5), ladder(12, 'out', 3), ladder(2, 'out', 1)]) {
      const fix = /use e\.g\. (?:length 5, )?value (\d+(?:\.\d+)?)/.exec(engine.faults(c)[0])
      expect(fix, JSON.stringify(c)).not.toBeNull()
      const mended = { ...c, length: c.length < LADDER_MIN || c.length > LADDER_MAX ? 5 : c.length, value: Number(fix![1]) }
      expect(engine.faults(mended), JSON.stringify(mended)).toEqual([])
    }
  })

  it('reads a state safely, and keeps the foot on ground the ladder can reach', () => {
    const c = ladder(5, 'height', 4)
    for (const s of [null, undefined, {}, { foot: NaN }, { foot: 'x' as never }, { foot: -4 }, { foot: 999 }, { foot: 3.4 }]) {
      const d = footOf(c, s as never)
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(footMax(5))
      expect(Number.isInteger(d)).toBe(true)
    }
    expect(() => engine.check(c, null as never)).not.toThrow()
  })

  it('says the working once right, and only what was made when wrong', () => {
    const c = ladder(5, 'height', 4)
    expect(working(c, { foot: 30 })).toMatch(/^Yes\. The ladder leans at 53\.1° to the ground\./)
    expect(working(c, { foot: 30 })).toContain('Sine is opposite ÷ hypotenuse: 4 ÷ 5 = 0.8')
    expect(working(c, { foot: 30 })).toContain('The foot is 3 m from the wall.')
    const o = ladder(5, 'out', 3)
    expect(working(o, { foot: 30 })).toContain('Cosine is adjacent ÷ hypotenuse: 3 ÷ 5 = 0.6')
    expect(working(o, { foot: 30 })).toContain('The top is 4 m up the wall.')
    expect(madeText(c, { foot: 38 })).toBe('The top is 3.2 m up the wall, with the foot 3.8 m from it.')
    // What was made, not where the answer is: the angle and the target never appear.
    expect(madeText(c, { foot: 38 })).not.toMatch(/53|too|should|closer|further|flatter|steeper/)
  })

  describe('over every ladder it can be asked for', { timeout: 30_000 }, () => {
    it('starts unsolved, is solved by solve, and passes its own faults', () => {
      let n = 0
      for (let L = LADDER_MIN; L <= LADDER_MAX + 1e-9; L += 0.5) {
        for (const ask of ['height', 'out']) {
          const { lo, hi } = valueRange(L, ask)
          for (let v10 = Math.ceil(lo * 10); v10 <= Math.floor(hi * 10); v10++) {
            const c = ladder(L, ask, v10 / 10)
            expect(engine.faults(c), JSON.stringify(c)).toEqual([])
            const start = engine.initial(c)
            expect(engine.check(c, start).ok, `start ${JSON.stringify(c)}`).toBe(false)
            expect(engine.check(c, engine.solve(c)).ok, `solve ${JSON.stringify(c)}`).toBe(true)
            // The exact foot is right, and the start is clearly outside the tolerance (twice it), so it is never already met.
            expect(ladderOk(c, Math.round(targetFoot(c))), JSON.stringify(c)).toBe(true)
            expect(Math.abs(askedAt(c, (start as { foot: number }).foot) - c.value), JSON.stringify(c)).toBeGreaterThan(LADDER_TOLERANCE * 2)
            n += 1
          }
        }
      }
      expect(n).toBeGreaterThan(1000)
    })

    it('puts the mark where the marking says, within a pixel or two of the ladder when solved', () => {
      for (const c of [ladder(5, 'height', 4), ladder(10, 'height', 8), ladder(5, 'out', 3), ladder(7.5, 'out', 4.5), ladder(3, 'height', 2.5)]) {
        const g = ladderGeometry(c, (engine.solve(c) as { foot: number }).foot)
        const scale = LADDER_PX / c.length
        if (c.ask === 'height') expect(Math.abs(g.top.y - (GROUND_Y - c.value * scale)), JSON.stringify(c)).toBeLessThan(0.15 * scale + 0.5)
        else expect(Math.abs(g.foot.x - (WALL_X - c.value * scale)), JSON.stringify(c)).toBeLessThan(0.051 * scale)
      }
    })
  })
})

describe('the circle', () => {
  it('puts the point where the real sine and cosine say', () => {
    for (let a = 0; a < 360; a += ANGLE_STEP) {
      const g = pointGeometry(a)
      expect(g.p.x).toBeCloseTo(CX + R * Math.cos(rad(a)), 9)
      expect(g.p.y).toBeCloseTo(CY - R * Math.sin(rad(a)), 9)
      expect(g.sin).toBeCloseTo(Math.sin(rad(a)), 12)
    }
  })

  it('draws the curve from the same numbers, up to the point', () => {
    expect(curvePath('sine', 0)).toBe('')
    const path = curvePath('sine', 90)
    expect(path.startsWith(`M ${GX.toFixed(1)} ${CY.toFixed(1)}`)).toBe(true)
    // At 90 degrees a sine is at the top of the circle's height, and the curve's end is level with the point.
    expect(path.endsWith(`${(GX + GW / 4).toFixed(1)} ${(CY - R).toFixed(1)}`)).toBe(true)
    expect(curvePath('cosine', 180).endsWith(`${(GX + GW / 2).toFixed(1)} ${(CY + R).toFixed(1)}`)).toBe(true)
  })

  it('accepts every angle that has the value, and the sign when it is named', () => {
    expect(solutions(circle('sine', '1/2'))).toEqual([30, 150])
    expect(solutions(circle('sine', '1/2', 'negative'))).toEqual([150])
    expect(solutions(circle('sine', '1/2', 'positive'))).toEqual([30])
    expect(solutions(circle('cosine', '√3/2'))).toEqual([30, 330])
    expect(solutions(circle('cosine', '-√2/2', 'negative'))).toEqual([135, 225].filter((a) => a === 225))
    expect(solutions(circle('sine', '1'))).toEqual([90])
    expect(solutions(circle('sine', '0'))).toEqual([0, 180])
    expect(solutions(circle('sine', '0', 'negative'))).toEqual([180])
    expect(solutions(circle('cosine', '0'))).toEqual([90, 270])
    expect(solutions(circle('sine', '1', 'negative'))).toEqual([])
  })

  it('marks 30 and 150 both right for sine 1/2, and nothing else on the circle', () => {
    const c = circle('sine', '1/2')
    for (let a = 0; a < 360; a += ANGLE_STEP) expect(engine.check(c, { angle: a }).ok, `${a}`).toBe(a === 30 || a === 150)
  })

  it('refuses what it cannot draw, with a nearby example that works', () => {
    expect(engine.faults(circle('tangent', '1'))[0]).toMatch(/tangent is not drawn.*fn "sine" or "cosine"/)
    expect(engine.faults(circle('secant', '2'))[0]).toMatch(/not a function the circle draws/)
    expect(engine.faults(circle('sine', '0.6'))[0]).toMatch(/use e\.g\. value "√3\/2"/)
    expect(engine.faults(circle('sine', '1/2', 'sideways'))[0]).toMatch(/use "positive" or "negative"/)
    const clash = engine.faults(circle('sine', '1', 'negative'))[0]
    expect(clash).toMatch(/cosine is 0, never negative: leave other out/)
    expect(engine.faults(circle('sine', '1/2'))).toEqual([])
    // Each fix it suggests is itself a config that passes.
    for (const c of [circle('sine', '1', 'negative'), circle('cosine', '0', 'positive'), circle('sine', '0', 'negative')]) {
      const fx = engine.faults(c)
      if (fx.length === 0) continue
      const json = /e\.g\. (\{.*\})\./.exec(fx[0])
      expect(json, fx[0]).not.toBeNull()
      const mended = engine.parse(JSON.parse(json![1]))!
      expect(engine.faults(mended), json![1]).toEqual([])
    }
  })

  it('says the working once right, and only what was made when wrong', () => {
    expect(working(circle('sine', '1/2', 'negative'), { angle: 150 })).toMatch(/^Yes\. At 150° sine is ½ and cosine is −√3\/2\./)
    expect(working(circle('sine', '1/2'), { angle: 30 })).toContain('Sine is ½ again at 150°')
    expect(working(circle('sine', '1/2'), { angle: 150 })).toContain('again at 30°')
    expect(working(circle('sine', '1/2', 'negative'), { angle: 150 })).not.toContain('again')
    expect(madeText(circle('sine', '1/2'), { angle: 45 })).toBe('You made 45°: sine is √2/2 and cosine is √2/2.')
    expect(madeText(circle('sine', '1/2'), { angle: 15 })).toBe('You made 15°: sine is 0.26 and cosine is 0.97.')
    expect(madeText(circle('sine', '1/2'), { angle: 330 })).toBe('You made 330°: sine is −½ and cosine is √3/2.')
  })

  it('reads a state safely and always on the 15 degree steps', () => {
    for (const s of [null, undefined, {}, { angle: NaN }, { angle: 'x' as never }, { angle: -30 }, { angle: 725 }, { angle: 100 }]) {
      const a = angleOf(s as never)
      expect(a % ANGLE_STEP).toBe(0)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(360)
    }
    expect(angleOf({ angle: -30 })).toBe(330)
    expect(() => engine.check(circle('sine', '1/2'), null as never)).not.toThrow()
  })

  describe('over every value it can be asked for', { timeout: 30_000 }, () => {
    const all: Circle[] = []
    for (const fn of ['sine', 'cosine']) {
      for (const base of VALUES) {
        for (const sg of ['', '-']) {
          if (base === '0' && sg === '-') continue
          for (const other of [undefined, 'positive', 'negative']) all.push(circle(fn, `${sg}${base}`, other))
        }
      }
    }

    it('the config either has a fault that says what to write or starts unsolved and is solved by solve', () => {
      let valid = 0
      for (const c of all) {
        const fx = engine.faults(c)
        if (fx.length) {
          expect(solutions(c), JSON.stringify(c)).toEqual([])
          expect(fx[0], JSON.stringify(c)).toMatch(/e\.g\./)
          continue
        }
        valid += 1
        expect(engine.check(c, engine.initial(c)).ok, `start ${JSON.stringify(c)}`).toBe(false)
        expect(engine.check(c, engine.solve(c)).ok, `solve ${JSON.stringify(c)}`).toBe(true)
        // Marked from the real numbers: an angle passes exactly when its value and sign are the real ones.
        for (let a = 0; a < 360; a += ANGLE_STEP) {
          const real = c.fn === 'sine' ? Math.sin(rad(a)) : Math.cos(rad(a))
          const otherReal = c.fn === 'sine' ? Math.cos(rad(a)) : Math.sin(rad(a))
          const sign = Math.abs(otherReal) < 1e-9 ? 'zero' : otherReal > 0 ? 'positive' : 'negative'
          const expected = Math.abs(real - numberOfKey(readValue(c.value)!)) < 1e-9 && (c.other === undefined || sign === c.other)
          expect(engine.check(c, { angle: a }).ok, `${JSON.stringify(c)} at ${a}`).toBe(expected)
        }
      }
      // 2 functions x 9 signed values x 3 sign choices, less the ones with nothing to find.
      expect(valid).toBeGreaterThan(40)
    })
  })
})

describe('the literals in the view', () => {
  it('agree with the config, which the view may not read at load', () => {
    expect(STEP_DEG).toBe(ANGLE_STEP)
    expect(TILT_LIMITS).toEqual([TILT_MIN, TILT_MAX])
    expect(W).toBe(360)
    expect(H).toBe(236)
    // The ladder fits: wall, ground and the longest ladder's foot all lie inside the panel.
    expect(WALL_X - LADDER_PX).toBeGreaterThan(40)
    expect(GROUND_Y).toBeLessThan(H)
    expect(GX + GW).toBeLessThan(W - 8)
    expect(CX + R + 10).toBeLessThan(GX)
  })

  it('rungs stay countable', () => {
    for (let L = LADDER_MIN; L <= LADDER_MAX; L += 0.5) {
      const n = rungCount(L)
      expect(n).toBeGreaterThanOrEqual(7)
      expect(LADDER_PX / (n + 1)).toBeGreaterThan(9)
    }
  })

  it('does not read a config constant at the top of the file', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, 'View.tsx'), 'utf8')
    const imported = [...src.matchAll(/import \{([^}]*)\} from '\.\/config'/g)].flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean))
    const top = src.split('\n').filter((l) => /^(?:export )?const /.test(l)).join('\n')
    for (const name of imported) expect(top, name).not.toMatch(new RegExp(`\\b${name}\\b`))
  })
})

describe('what the tutor writes', () => {
  const LADDER_H = ladder(5, 'height', 4)
  const LADDER_O = ladder(5, 'out', 3)
  const CIRCLE = circle('sine', '1/2', 'negative')

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"trig-circle", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['ladder', 'circle']))
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
  })

  it('has a prompt that works for every config kind, and the fault suggests one', () => {
    for (const c of [LADDER_H, LADDER_O, CIRCLE, circle('cosine', '√3/2')]) {
      const fx = engine.promptFaults!(c, 'Nothing about moving it')
      expect(fx.length, JSON.stringify(c)).toBeGreaterThan(0)
      const example = /e\.g\. "([^"]*)"/.exec(fx[0])
      expect(example, fx[0]).not.toBeNull()
      expect(engine.promptFaults!(c, example![1]), example![1]).toEqual([])
    }
    // The example that is right for one kind is wrong for the other: sill for a height, line for a distance.
    expect(engine.promptFaults!(LADDER_O, 'Drag the foot of the ladder along the ground until its top just reaches the window sill.')[0]).toMatch(/window sill.*painted line on the paving/)
    expect(engine.promptFaults!(LADDER_H, 'Drag the foot until it stands on the painted line.')[0]).toMatch(/painted line.*window sill/)
  })

  it('refuses a prompt that gives the answer away', () => {
    expect(engine.promptFaults!(LADDER_H, 'Slide the ladder to lean at 53 degrees.')[0]).toMatch(/names an angle/)
    expect(engine.promptFaults!(LADDER_H, 'Slide the foot until the ladder leans at 53.1° and reaches the sill.')[0]).toMatch(/names an angle/)
    expect(engine.promptFaults!(CIRCLE, 'Drag the point to 150° on the circle.')[0]).toMatch(/names 150°/)
    expect(engine.promptFaults!(circle('sine', '1/2'), 'Drag the point round to 30 degrees or 150 degrees.')[0]).toMatch(/names 30°/)
    expect(engine.promptFaults!(circle('sine', '1/2'), 'Drag the point to where sine is ½. There are two places.')[0]).toMatch(/how many places or which quadrant/)
    expect(engine.promptFaults!(CIRCLE, 'Drag the point into the second quadrant where sine is ½.')[0]).toMatch(/which quadrant/)
    // An angle that is not the answer is not a leak.
    expect(engine.promptFaults!(circle('sine', '1/2', 'negative'), 'Drag the point round the circle from 0° to where sine is ½ and cosine is negative.')).toEqual([])
  })

  it('refuses a prompt that promises what the card does not show', () => {
    expect(engine.promptFaults!(CIRCLE, 'Drag the point to where sine is ½, giving your angle in radians.')[0]).toMatch(/radians/)
    expect(engine.promptFaults!(CIRCLE, 'Drag the point to 5π/6 on the circle.').join(' ')).toMatch(/radians/)
    expect(engine.promptFaults!(LADDER_H, 'Drag the foot until the tangent of the angle makes it reach the sill.')[0]).toMatch(/tangent, a calculator/)
    expect(engine.promptFaults!(LADDER_H, 'Slide the foot, then use a calculator to find the angle.')[0]).toMatch(/calculator/)
  })

  it('refuses numbers in a prompt that are not the card\'s', () => {
    expect(engine.promptFaults!(LADDER_H, 'Drag the foot until the top of the 6 m ladder reaches the sill.')[0]).toMatch(/says 6 m, but the card's ladder is 5 m long and its mark is 4 m up the wall/)
    expect(engine.promptFaults!(LADDER_H, 'Drag the foot until the top of the 5 m ladder reaches the sill 4 m up.')).toEqual([])
    expect(engine.promptFaults!(LADDER_O, 'Drag the foot of the 5 m ladder 3 m from the wall, onto the painted line.')).toEqual([])
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "trig-circle"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'trig-circle')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Trigonometry', 'Trigonometric ratios', 'Right-angled triangles', 'Right triangle trigonometry', 'Introduction to trigonometry', 'Chapter 12: Trigonometry', 'Unit 7: Trigonometric functions',
      'Sine and cosine', 'Sine, cosine and tangent', 'SOH CAH TOA', 'The unit circle', 'Unit circle and radians', 'Graphs of sine and cosine', 'Sine and cosine graphs', 'Trigonometric graphs',
      'Solving trigonometric equations', 'Angles of elevation and depression', "Pythagoras' Theorem", 'Pythagorean theorem and triples', 'Convert between degrees and radians', 'Exact trigonometric values',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for the other uses of its words, or for trigonometry it cannot draw', () => {
    for (const st of [
      'The sine rule', 'The cosine rule', 'Sine and cosine rules', 'Sine rule and cosine rule', 'Area of a triangle using sine', 'Trigonometric identities', 'Double angle formulae', 'Compound angles',
      'Integration of trigonometric functions', 'Differentiating trigonometric functions', 'Trigonometric substitution', 'Hyperbolic functions', 'Complex numbers and polar form', 'Simple harmonic motion', 'Fourier series',
      'Three dimensional trigonometry', 'Bearings', 'Circle theorems', 'Angles in a circle', 'Area of a circle', 'Circumference of a circle', 'Equation of a circle', 'Arc length and sector area', 'Chords and tangents',
      'Sound waves', 'Sine waves in alternating current', 'Light waves', 'Triangle inequality', 'Congruent triangles', 'Similar triangles', 'Constructing triangles', 'Angles in a triangle',
      'Waves and the electromagnetic spectrum', 'Moon and sine wave tides', 'Angles', 'Circles', 'Triangles', 'Ladders in construction', 'Right to a fair trial', 'Right and left brain', 'The Right Angle gallery',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('trig-circle')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "trig-circle"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:trig-circle"/)
    expect(engine.prompt).toContain('Not drawn: tangent, radians')
  })

  it('makes a valid activity from its examples', () => {
    for (const config of [{ task: 'ladder', length: 5, ask: 'height', value: 4 }, { task: 'circle', fn: 'cosine', value: '√3/2' }]) {
      expect(validateSpec({ pattern: 'scene', prompt: 'Drag it.', payload: { engine: 'trig-circle', config }, success: { kind: 'scene' } })).toBe(true)
    }
    expect(validateSpec({ pattern: 'scene', prompt: 'Drag it.', payload: { engine: 'trig-circle', config: { task: 'ladder' } }, success: { kind: 'scene' } })).toBe(false)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'trig-circle', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: TrigConfig, state: TrigState, marked: SceneMarked, reduced = false) =>
    renderToStaticMarkup(createElement(TrigCircleView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' || marked === 'shown' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const EXAMPLES: [TrigConfig, string][] = [
    [ladder(5, 'height', 4), 'Drag the foot of the ladder along the ground until its top just reaches the window sill.'],
    [ladder(5, 'out', 3), 'Drag the foot of the ladder along the ground until it stands on the painted line.'],
    [circle('sine', '1/2', 'negative'), 'Drag the point round the circle to where sine is ½ and cosine is negative.'],
    [circle('cosine', '√3/2'), 'Drag the point round the circle to where cosine is √3/2.'],
  ]

  it('before marking, nothing says the answer, the working or a verdict', () => {
    for (const [cfg, prompt] of EXAMPLES) {
      const html = card(cfg, prompt)
      expect(html).toContain('role="slider"')
      expect(html.match(/<button[^>]*aria-label="[^"]+"/g)?.length).toBe(2)
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'You made', 'again at', 'Sine is opposite', 'Cosine is adjacent', 'hypotenuse', '53.1', 'whose sine', 'whose cosine', 'too ', 'closer', 'steeper', 'flatter', 'correct', 'wrong']) {
        expect(shown, `${secret} in ${JSON.stringify(cfg)}`).not.toContain(secret)
      }
      // The solutions' angles are not on the card unless the point is standing on one: it starts on none.
      if (cfg.task === 'circle') for (const a of solutions(cfg)) expect(shown, `${a}`).not.toContain(`${a}°`)
    }
  })

  it('keeps the ladder\'s angle back until it is marked, then says it', () => {
    const c = ladder(5, 'height', 4)
    for (const foot of [10, 20, 30, 40]) expect(text(raw(c, { foot }, 'idle')) + attrs(raw(c, { foot }, 'idle'))).not.toMatch(/\d+(?:\.\d)?°/)
    expect(text(raw(c, { foot: 30 }, 'right'))).toContain('53.1° to the ground')
    expect(text(raw(c, { foot: 38 }, 'wrong'))).toContain('The top is 3.2 m up the wall')
    expect(text(raw(c, { foot: 38 }, 'wrong'))).not.toContain('Yes')
  })

  it('moves the drawing with each smallest move, without saying whether it is right', () => {
    const c = ladder(5, 'height', 4)
    const a = raw(c, { foot: 30 }, 'idle')
    const b = raw(c, { foot: 31 }, 'idle')
    expect(a).not.toBe(b)
    expect(text(a)).not.toBe(text(b))
    const k = circle('sine', '1/2')
    expect(raw(k, { angle: 30 }, 'idle')).not.toBe(raw(k, { angle: 45 }, 'idle'))
    expect(raw(k, { angle: 0 }, 'idle')).toMatch(/<path d="" [^>]*data-curve=/)
    expect(raw(k, { angle: 30 }, 'idle')).not.toMatch(/<path d="" [^>]*data-curve=/)
  })

  it('shows the solution when asked, and is still a drawing under reduced motion', () => {
    for (const [cfg] of EXAMPLES) {
      const state = engine.initial(cfg)
      const shown = raw(cfg, state, 'shown')
      expect(text(shown)).toContain('Yes.')
      // The same frame, moving or not: nothing here animates.
      expect(raw(cfg, state, 'idle', true)).toBe(raw(cfg, state, 'idle', false))
      expect(() => raw(cfg, engine.solve(cfg), 'right', true)).not.toThrow()
    }
  })

  it('draws every ladder and every point inside the panel, with every label inside it too', () => {
    for (const c of [ladder(3, 'height', 2), ladder(10, 'height', 9.8), ladder(10, 'out', 9.3), ladder(5, 'out', 1)]) {
      for (const foot of [1, 5, 15, 30, footMax(c.length)]) {
        const html = raw(c, { foot }, 'idle')
        for (const m of html.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)) {
          expect(Number(m[1]), JSON.stringify(c)).toBeGreaterThan(0)
          expect(Number(m[1])).toBeLessThan(W)
          expect(Number(m[2])).toBeGreaterThan(8)
          expect(Number(m[2])).toBeLessThan(H)
        }
      }
    }
    for (let a = 0; a < 360; a += ANGLE_STEP) {
      const html = raw(circle('sine', '1/2'), { angle: a }, 'idle')
      for (const m of html.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)) {
        expect(Number(m[1])).toBeGreaterThan(0)
        expect(Number(m[1])).toBeLessThan(W)
        expect(Number(m[2])).toBeLessThan(H)
      }
    }
  })

  it('keeps a leg\'s name nearer its own leg than the other, and drops it when the leg is too short to hold it', () => {
    const k = circle('sine', '1/2')
    // At 90 degrees the cosine leg is nothing: its name is gone, and so is its leg.
    const up = raw(k, { angle: 90 }, 'idle')
    expect(up).not.toContain('data-name="cosine"')
    expect(up).not.toContain('data-leg="cosine"')
    expect(up).toContain('data-name="sine"')
    // At 0 degrees the sine leg is nothing.
    const flat = raw(k, { angle: 0 }, 'idle')
    expect(flat).not.toContain('data-name="sine"')
    expect(flat).toContain('data-name="cosine"')
    // The cosine name sits on the opposite side of the axis from the point, away from the radius.
    const below = raw(k, { angle: 330 }, 'idle')
    const y = Number(/data-name="cosine"/.test(below) ? /y="([\d.]+)"[^>]*data-name="cosine"/.exec(below)![1] : NaN)
    expect(y).toBeLessThan(CY)
    const above = raw(k, { angle: 30 }, 'idle')
    expect(Number(/y="([\d.]+)"[^>]*data-name="cosine"/.exec(above)![1])).toBeGreaterThan(CY)
  })
})

describe('the figures', () => {
  it('format the way a lesson writes them', () => {
    expect(fmtM(4)).toBe('4')
    expect(fmtM(3.8)).toBe('3.8')
    expect(fmtM(2.25)).toBe('2.25')
    expect(done(ladder(5, 'height', 4), { foot: 30 })).toBe(true)
    expect(done(circle('sine', '1/2'), { angle: 30 })).toBe(true)
    expect(signOfKey('-1/2')).toBe('negative')
    expect(ladderOk(ladder(5, 'height', 4), footOf(ladder(5, 'height', 4), { foot: 30 }))).toBe(true)
  })
})
