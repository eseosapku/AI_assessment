// lib/studylab/engines/calculus-grapher/calculus-grapher.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  calculusGrapherEngine as E, areaTo, derive, evalPoly, fromHalves, gradientAt, rat, readRat, turningPoints,
  findVerdict, setVerdict, sweepVerdict, stepPx, MIN_STEP_PX, KINDS, layout, STATIONS, HALVES, polyText, type CalculusConfig, type Rat,
} from './config'
import { getEngine, registerEngine, sceneCatalogue, scenesFor } from '../registry'
// (the registry is filled by ./config alone, so this folder's own view is the one drawn)
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

// Other imports register the live engine under the same id; this folder's own must win.
registerEngine(E as never)

vi.spyOn(console, 'error').mockImplementation(() => {})

const parse = (task: unknown) => E.parse({ task })!

// Every curve of the sorts a syllabus uses: small rational coefficients.
const X3 = ['0', '1/3', '-1/3', '1/6', '-1/6', '1', '-1', '1/2']
const X2 = ['0', '1', '-1', '1/2', '-1/2', '1/4', '-1/4', '2', '-2']
const X1 = ['0', '1', '-1', '2', '-2', '3', '-3', '4', '-4', '1/2', '-1/2']
const C = ['0', '1', '2']

function* curves() {
  for (const x3 of X3) for (const x2 of X2) for (const x1 of X1) for (const c of C) yield { x3, x2, x1, c }
}

function every() {
  const out: CalculusConfig[] = []
  for (const curve of curves()) {
    for (const which of ['max', 'min']) {
      const c = E.parse({ task: { kind: 'find-stationary', curve, which } })
      if (c) out.push(c)
    }
    const set = E.parse({ task: { kind: 'set-gradients', curve } })
    if (set) out.push(set)
    for (let h = 1; h <= HALVES; h++) {
      const base = parse({ kind: 'sweep-area', curve, area: '1' })
      const a = areaTo(base.task.coef, fromHalves(h))
      const c = E.parse({ task: { kind: 'sweep-area', curve, area: `${a.n}/${a.d}` } })
      if (c) out.push(c)
    }
  }
  return out
}

describe('the exact maths', () => {
  it('reads fractions, decimals and numbers, and nothing else', () => {
    expect(readRat('1/3')).toEqual({ n: 1, d: 3 })
    expect(readRat('−0.5')).toEqual({ n: -1, d: 2 })
    expect(readRat(2)).toEqual({ n: 2, d: 1 })
    expect(readRat(1 / 3)).toBeNull()
    expect(readRat('two')).toBeNull()
  })

  it('differentiates and integrates polynomials exactly', () => {
    const f = parse({ kind: 'set-gradients', curve: { x3: '1/3', x1: -1 } }).task.coef
    expect(derive(f).map((r) => r.n / r.d)).toEqual([-1, 0, 1])
    expect(gradientAt(f, rat(2))).toEqual({ n: 3, d: 1 })
    expect(gradientAt(f, rat(1))).toEqual({ n: 0, d: 1 })
    const g = parse({ kind: 'sweep-area', curve: { x1: 2, x2: '-1/2' }, area: '9/2' }).task.coef
    expect(areaTo(g, rat(3))).toEqual({ n: 9, d: 2 })
    expect(areaTo(g, rat(2))).toEqual({ n: 8, d: 3 })
    expect(evalPoly(g, rat(4))).toEqual({ n: 0, d: 1 })
    expect(polyText(f)).toBe('(1/3)x³ − x')
  })

  it('finds where the gradient is zero, and whether it is a top or a dip', () => {
    const cubic = parse({ kind: 'set-gradients', curve: { x3: '1/3', x1: -1 } }).task.coef
    expect(turningPoints(cubic).map((t) => [t.kq, t.type])).toEqual([[-4, 'max'], [4, 'min']])
    expect(turningPoints(parse({ kind: 'set-gradients', curve: { x3: 1 } }).task.coef).map((t) => t.type)).toEqual(['flat'])
    expect(turningPoints(parse({ kind: 'set-gradients', curve: { x2: 1, x1: '1/3' } }).task.coef)[0].kq).toBeNull()
  })
})

describe('parsing', () => {
  it('reads the task however it is written', () => {
    const c = E.parse({ task: { kind: 'Find Stationary', curve: { quadratic: -1, linear: 2 }, which: 'Maximum' } })!
    expect(c.task.kind).toBe('find-stationary')
    expect(c.task.which).toBe('max')
    expect(E.parse({ task: { kind: 'sweepArea', curve: { x1: 2, x2: '-1/2' }, target: 4.5 } })!.task.area).toEqual({ n: 9, d: 2 })
    expect(E.parse({ task: { kind: 'sweep-area', curve: { x1: 2 } } })).toBeNull()
    expect(E.parse({ task: { kind: 'wander', curve: { x1: 2 } } })).toBeNull()
    expect(E.parse(null)).toBeNull()
  })

  it('takes a value out of range and lets faults refuse it, with an example', () => {
    const big = E.parse({ task: { kind: 'find-stationary', curve: { x2: 40, x1: 1 }, which: 'min' } })!
    expect(E.faults(big).join(' ')).toMatch(/coefficient above 12/)
    const steep = E.parse({ task: { kind: 'set-gradients', curve: { x3: 1 } } })!
    expect(E.faults(steep).join(' ')).toMatch(/whole number from −4 to 4.*x³\/3 − x/)
  })

  it('defaults which to the only turning point', () => {
    expect(E.parse({ task: { kind: 'find-stationary', curve: { x2: 1, x1: -2 } } })!.task.which).toBe('min')
  })
})

describe('faults', () => {
  const f = (task: unknown) => E.faults(parse(task)).join(' | ')

  it('refuses what teaches nothing', () => {
    expect(f({ kind: 'find-stationary', curve: { x1: 2, c: 1 }, which: 'max' })).toMatch(/straight line/)
    expect(f({ kind: 'find-stationary', curve: { x2: 1, x1: -2 }, which: 'max' })).toMatch(/no maximum.*dip/)
    expect(f({ kind: 'find-stationary', curve: { x3: 1 }, which: 'max' })).toMatch(/no maximum/)
    expect(f({ kind: 'find-stationary', curve: { x2: 1, x1: '1/3' }, which: 'min' })).toMatch(/quarter-unit/)
    expect(f({ kind: 'find-stationary', curve: { c: 3 }, which: 'min' })).toMatch(/flat line/)
    expect(f({ kind: 'set-gradients', curve: { x1: 2 } })).toMatch(/straight line.*coordinate-plane/)
  })

  it('refuses areas below the axis and targets the sweep cannot reach, and lists them as left for later', () => {
    expect(f({ kind: 'sweep-area', curve: { x2: 1, x1: -3 }, area: 1 })).toMatch(/below the x-axis/)
    expect(f({ kind: 'sweep-area', curve: { x1: 2, x2: '-1/2' }, area: 5 })).toMatch(/never exactly 5.*e\.g\. 4\.5/)
    expect(f({ kind: 'sweep-area', curve: { x1: 2, x2: '-1/2' }, area: '9/2' })).toBe('')
  })

  it('every worked suggestion in a fault message is itself acceptable', () => {
    const ok = (task: unknown) => expect(E.faults(parse(task))).toEqual([])
    ok({ kind: 'find-stationary', curve: { x2: -1, x1: 2 }, which: 'max' })
    ok({ kind: 'find-stationary', curve: { x2: 1, x1: -2 }, which: 'min' })
    ok({ kind: 'set-gradients', curve: { x3: '1/3', x1: -1 } })
    ok({ kind: 'set-gradients', curve: { x2: '1/2', x1: -1 } })
    ok({ kind: 'sweep-area', curve: { x1: 2, x2: '-1/2' }, area: '9/2' })
  })
})

describe('marking', () => {
  it('marks the top, not the dip, and not a level spot of the wrong kind', () => {
    const c = parse({ kind: 'find-stationary', curve: { x3: '1/3', x1: -1 }, which: 'max' })
    expect(E.check(c, { k: -4 }).ok).toBe(true)
    expect(E.check(c, { k: 4 }).ok).toBe(false)
    expect(E.check(c, { k: -5 }).ok).toBe(false)
    expect(E.check(c, { k: -3 }).ok).toBe(false)
    expect(E.check(c, {}).ok).toBe(false)
  })

  it('says what the learner made, only when asked', () => {
    const c = parse({ kind: 'find-stationary', curve: { x3: '1/3', x1: -1 }, which: 'max' })
    expect(E.View).toBeDefined()
    expect(findVerdict(c, 4, false)).toMatch(/level.*dip.*not the top/)
    expect(findVerdict(c, 0, false)).toMatch(/still falling/)
    expect(findVerdict(c, -4, true)).toMatch(/x = −1/)
    const s = parse({ kind: 'set-gradients', curve: { x3: '1/3', x1: -1 } })
    expect(setVerdict(s, [0, 0, 0, 0, 0], false)).toMatch(/3 tangents are off.*x = −2 your tangent is level, but the curve climbs/)
    expect(setVerdict(s, [3, 0, -1, 0, 3], true)).toMatch(/climbs.*falls.*climbs/)
    const a = parse({ kind: 'sweep-area', curve: { x1: 2, x2: '-1/2' }, area: '9/2' })
    expect(sweepVerdict(a, 2, false)).toMatch(/x = 1 with .*not enough|x = 1 with/)
  })

  it('marks only the exact gradients', () => {
    const s = parse({ kind: 'set-gradients', curve: { x3: '1/3', x1: -1 } })
    expect(E.check(s, { g: [3, 0, -1, 0, 3] })).toEqual({ ok: true, wrongIds: [] })
    expect(E.check(s, { g: [3, 0, -1, 0, 2] })).toEqual({ ok: false, wrongIds: ['s4'] })
    expect(E.check(s, {}).wrongIds).toHaveLength(5)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  const all = every().filter((c) => E.faults(c).length === 0)

  it('is numerous enough to mean something', () => {
    for (const kind of KINDS) expect(all.filter((c) => c.task.kind === kind).length, kind).toBeGreaterThan(25)
  })

  it('starts unsolved, and can always be solved', () => {
    for (const c of all) {
      const tag = `${c.task.kind} ${polyText(c.task.coef)} ${c.task.which ?? ''} ${c.task.area ? c.task.area.n + '/' + c.task.area.d : ''}`
      expect(E.check(c, E.initial(c)).ok, `initial ${tag}`).toBe(false)
      expect(E.check(c, E.solve(c)).ok, `solve ${tag}`).toBe(true)
    }
  })

  it('has exactly one right answer position (a top is unique), never two for find-stationary', () => {
    for (const c of all.filter((x) => x.task.kind === 'find-stationary')) {
      const right = Array.from({ length: 25 }, (_, i) => i - 12).filter((k) => E.check(c, { k }).ok)
      expect(right).toHaveLength(1)
    }
  })

  it('draws every curve inside the picture, and a hand can land on every position', () => {
    for (const kind of KINDS) expect(stepPx(kind), kind).toBeGreaterThanOrEqual(MIN_STEP_PX)
    for (const c of all.filter((x) => x.task.kind === 'sweep-area')) {
      // The area totals at neighbouring half-units differ by at least a tenth, so the readout tells them apart.
      for (let h = 1; h <= HALVES; h++) {
        const d = areaTo(c.task.coef, fromHalves(h)), e = areaTo(c.task.coef, fromHalves(h - 1))
        expect((d.n / d.d) - (e.n / e.d)).toBeGreaterThanOrEqual(0.1 - 1e-9)
      }
    }
    expect(layout('sweep-area').xb).toBe(4)
    expect(STATIONS).toHaveLength(5)
  })

  it('has a fine start: no station of set-gradients begins marked all right', () => {
    for (const c of all.filter((x) => x.task.kind === 'set-gradients')) {
      const d1 = derive(c.task.coef)
      const want = STATIONS.map((x) => (evalPoly(d1, rat(x)) as Rat).n)
      expect(want.some((v) => v !== 0)).toBe(true)
    }
  })
})

describe('promptFaults', () => {
  const pf = (task: unknown, prompt: string) => E.promptFaults!(parse(task), prompt)
  const find = { kind: 'find-stationary', curve: { x2: -1, x1: 2 }, which: 'max' }
  const set = { kind: 'set-gradients', curve: { x3: '1/3', x1: -1 } }
  const sweep = { kind: 'sweep-area', curve: { x1: 2, x2: '-1/2' }, area: '9/2' }

  it('lets a prompt ask without giving the answer away', () => {
    expect(pf(find, 'Slide the point to where the curve stops climbing.')).toEqual([])
    expect(pf(set, 'Set the tangent at each mark so it follows the curve.')).toEqual([])
    expect(pf(sweep, 'Sweep the line right until the area reaches the target.')).toEqual([])
  })

  it('catches a prompt that gives it away', () => {
    expect(pf(find, 'Find the maximum at x = 1.')).toHaveLength(1)
    expect(pf(find, 'Find the point (1, 1) on the curve.')).toHaveLength(1)
    expect(pf(find, 'Slide until dy/dx = 0.')).not.toHaveLength(0)
    expect(pf(set, 'Set the gradient at x = 2 to 3.')).toHaveLength(1)
    expect(pf(set, 'The derivative is f\'(x) = x² − 1; set it.')).toHaveLength(1)
    expect(pf(sweep, 'Sweep to x = 3.')).toHaveLength(1)
    expect(pf(sweep, 'Sweep between 0 and 3.')).toHaveLength(1)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('calculus-grapher')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \},\s*\n\s*"success"/g)]
    expect(found).toHaveLength(3)
    for (const m of found) {
      const cfg = e.parse(JSON.parse(m[2]))!
      expect(cfg).not.toBeNull()
      expect(e.faults(cfg)).toEqual([])
      expect(e.promptFaults!(cfg, m[1])).toEqual([])
    }
  })
})

describe('the catalogue and the tutor', () => {
  it('is registered, with its config in the catalogue entry', () => {
    expect(getEngine('calculus-grapher')).toBe(E)
    expect(E.prompt).toMatch(/"engine":"calculus-grapher"/)
    expect(E.prompt).toMatch(/"apparatus":"scene:calculus-grapher"/)
    expect(E.isolates).toBe('magnitude')
  })

  it('is offered to calculus stations, and not to straight-line gradients or areas of shapes', () => {
    const has = (s: string) => sceneCatalogue(s).includes('SCENE "calculus-grapher"')
    for (const s of ['Introduction to calculus', 'Stationary points and their nature', 'Integration: finding areas', 'Derivatives of polynomials', 'Maxima and minima problems', 'Definite integrals']) expect(has(s), s).toBe(true)
    for (const s of ['Gradient of a straight line', 'Gradient and intercept of lines', 'Area of a circle', 'Areas of rectangles and triangles', 'Surface area and volume', 'Rates of reaction', 'Tangents to a circle']) expect(has(s), s).toBe(false)
    expect(scenesFor('Differentiation of polynomials').some((x) => x.id === 'calculus-grapher')).toBe(true)
    expect(scenesFor('Stationary waves in strings').some((x) => x.id === 'calculus-grapher')).toBe(false)
    expect(scenesFor('Gradient of a straight line').some((x) => x.id === 'calculus-grapher')).toBe(false)
    expect(scenesFor('Area of shapes').some((x) => x.id === 'calculus-grapher')).toBe(false)
  })
})

describe('the scene on the board', () => {
  const card = (config: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'calculus-grapher', config }, success: { kind: 'scene' } } },
    } as never)))
  const cards = {
    find: card({ task: { kind: 'find-stationary', curve: { x3: '1/3', x1: -1 }, which: 'max' } }, 'Slide the point to where the curve stops climbing.'),
    set: card({ task: { kind: 'set-gradients', curve: { x3: '1/3', x1: -1 } } }, 'Set the tangent at each mark so it follows the curve.'),
    sweep: card({ task: { kind: 'sweep-area', curve: { x1: 2, x2: '-1/2' }, area: '9/2' } }, 'Sweep the line right until the area reaches the target.'),
  }

  it('draws sliders the keyboard can reach', () => {
    expect(cards.find).toMatch(/role="slider"[^>]*aria-valuenow="12"/)
    expect((cards.set.match(/role="slider"/g) ?? []).length).toBe(5)
    expect(cards.sweep).toMatch(/role="slider"[^>]*aria-valuenow="0"/)
    for (const html of Object.values(cards)) expect(html).toMatch(/touch-none/)
  })

  it('names no answer before marking, in the text or the screen-reader text', () => {
    const words = /stationary|turning|maximum|minimum|gradient is|derivative|you made|you stopped|too steep/i
    for (const [name, html] of Object.entries(cards)) {
      const shown = html.replace(/Slide the point to where the curve stops climbing\.|Set the tangent at each mark so it follows the curve\.|Sweep the line right until the area reaches the target\./, '')
      expect(shown, name).not.toMatch(words)
    }
    expect(cards.sweep).toMatch(/target 4\.5/)
  })

  it('keeps every label inside the picture and at least 12 px', () => {
    for (const [name, html] of Object.entries(cards)) {
      const vb = /viewBox="0 0 (\d+) (\d+)" role="group"/.exec(html)!
      const [W, H] = [Number(vb[1]), Number(vb[2])]
      const texts = [...html.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)]
      expect(texts.length, name).toBeGreaterThan(2)
      expect(texts.length, `${name} labels`).toBeLessThanOrEqual(40)
      for (const t of texts) {
        const x = Number(/(?:^| )x="([-\d.]+)"/.exec(t[1])![1])
        const y = Number(/(?:^| )y="([-\d.]+)"/.exec(t[1])![1])
        const size = Number(/font-size="(\d+)"/.exec(t[1])![1])
        const anchor = /text-anchor="(\w+)"/.exec(t[1])?.[1] ?? 'start'
        const w = t[2].length * 7
        const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x
        expect(size, `${name} ${t[2]}`).toBeGreaterThanOrEqual(12)
        expect(x0, `${name} ${t[2]}`).toBeGreaterThanOrEqual(0)
        expect(x0 + w, `${name} ${t[2]}`).toBeLessThanOrEqual(W)
        expect(y, `${name} ${t[2]}`).toBeGreaterThan(8)
        expect(y, `${name} ${t[2]}`).toBeLessThanOrEqual(H)
      }
    }
  })

  it('keeps each label nearer its own graph than the other', () => {
    for (const kind of KINDS) {
      const L = layout(kind)
      const caption = kind === 'find-stationary' ? 'steepness of the tangent' : kind === 'set-gradients' ? 'steepness of each tangent' : 'area so far'
      const html = cards[kind === 'find-stationary' ? 'find' : kind === 'set-gradients' ? 'set' : 'sweep']
      const y = Number(new RegExp(`y="([\\d.]+)"[^>]*>${caption}<`).exec(html)![1])
      // The caption sits in the gap, closer to the strip it names than to the curve above it.
      expect(L.strip.y0 - y, kind).toBeLessThan(y - (L.upper.y0 + L.upper.h))
    }
  })
})

describe('a target the sweep cannot reach', () => {
  it('is refused with the nearest one it can, so the writer can fix it first time', () => {
    const e = getEngine('calculus-grapher')!
    const faults = (x1: number, area: string) => e.faults!(e.parse({ task: { kind: 'sweep-area', curve: { x1 }, area } })).join(' ')
    expect(faults(2, '8')).toContain('e.g. 9 (at x = 3)')
    expect(faults(3, '12')).toContain('e.g. 13.5 (at x = 3)')
  })
})
