// lib/studylab/engines/area-grid/area-grid.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  areaGridEngine as engine, B_MAX, B_MIN, C_MAX, P_MAX, expandWorking, expandedPoly, halvesText, polyText, rat, ratText,
  readMonomial, readPoly, readRational, squareWorking, madeExpand, madeSquare,
  type AreaGridConfig, type AreaGridState,
} from './config'
import { AreaGridView, unitFor, unitForB, X_PX } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
const EXPAND: AreaGridConfig[] = range(1, P_MAX).flatMap((p) => range(1, P_MAX).map((q) => ({ task: 'expand' as const, p, q })))
const SQUARE: AreaGridConfig[] = range(B_MIN, B_MAX).flatMap((b) => range(-C_MAX, C_MAX).map((c) => ({ task: 'complete-square' as const, b, c })))
const ALL = [...EXPAND, ...SQUARE]

describe('reading what is typed, exactly', () => {
  it('reads a single term however it is written', () => {
    expect(readMonomial('3x')).toEqual({ deg: 1, coef: 3 })
    expect(readMonomial(' 3 x ')).toEqual({ deg: 1, coef: 3 })
    expect(readMonomial('x')).toEqual({ deg: 1, coef: 1 })
    expect(readMonomial('x^2')).toEqual({ deg: 2, coef: 1 })
    expect(readMonomial('x²')).toEqual({ deg: 2, coef: 1 })
    expect(readMonomial('x*x')).toEqual({ deg: 2, coef: 1 })
    expect(readMonomial('15')).toEqual({ deg: 0, coef: 15 })
    expect(readMonomial('3*x')).toEqual({ deg: 1, coef: 3 })
    expect(readMonomial('−2x')).toEqual({ deg: 1, coef: -2 })
    expect(readMonomial('3y')).toBeNull()
    expect(readMonomial('')).toBeNull()
    expect(readMonomial('x+3')).toBeNull()
  })

  it('reads a sum, and notices terms not put together', () => {
    expect(readPoly('x^2 + 8x + 15')).toEqual({ poly: [15, 8, 1], collected: true })
    expect(readPoly('15 + 8x + x²')).toEqual({ poly: [15, 8, 1], collected: true })
    expect(readPoly('x^2 + 3x + 5x + 15')).toEqual({ poly: [15, 8, 1], collected: false })
    expect(readPoly('x² − 2x − 3')).toEqual({ poly: [-3, -2, 1], collected: true })
    expect(readPoly('x²+')).toBeNull()
    expect(readPoly('2(x+1)')).toBeNull()
    expect(polyText([15, 8, 1])).toBe('x² + 8x + 15')
    expect(polyText([-3, -2, 1])).toBe('x² − 2x − 3')
  })

  it('reads a fraction or decimal exactly', () => {
    expect(readRational('9/4')).toEqual(rat(9, 4))
    expect(readRational('2.25')).toEqual(rat(9, 4))
    expect(readRational('x')).toBeNull()
  })

  it('writes the working once marked', () => {
    expect(expandWorking(3, 5)).toBe('x² + 3x + 5x + 15 = x² + 8x + 15')
    expect(expandWorking(4, 4)).toBe('(x + 4)² = x² + 4x + 4x + 16 = x² + 8x + 16')
    expect(squareWorking(6, 0)).toBe('x² + 6x = (x + 3)² − 9')
    expect(squareWorking(5, 0)).toBe('x² + 5x = (x + 5/2)² − 25/4')
    expect(squareWorking(6, 2)).toBe('x² + 6x + 2 = (x + 3)² − 9 + 2 = (x + 3)² − 7')
    expect(squareWorking(6, -4)).toBe('x² + 6x − 4 = (x + 3)² − 9 − 4 = (x + 3)² − 13')
    expect(squareWorking(6, 9)).toBe('x² + 6x + 9 = (x + 3)² − 9 + 9 = (x + 3)²')
    expect(halvesText(1)).toBe('0.5')
    expect(halvesText(6)).toBe('3')
  })
})

describe('the area-grid engine', () => {
  it('reads a config however it is reasonably written, and nothing unreadable', () => {
    expect(engine.parse({ task: 'expand', p: 3, q: 5 })).toEqual({ task: 'expand', p: 3, q: 5 })
    expect(engine.parse({ task: { kind: 'Double brackets', p: '2', q: '7' } })).toEqual({ task: 'expand', p: 2, q: 7 })
    expect(engine.parse({ task: 'completing the square', b: 6 })).toEqual({ task: 'complete-square', b: 6, c: 0 })
    expect(engine.parse({ task: 'completeSquare', b: '5', c: -2 })).toEqual({ task: 'complete-square', b: 5, c: -2 })
    // Out of range still reads: faults() explains.
    expect(engine.parse({ task: 'expand', p: -3, q: 5 })).toEqual({ task: 'expand', p: -3, q: 5 })
    expect(engine.parse({ task: 'complete-square', b: 40 })).toEqual({ task: 'complete-square', b: 40, c: 0 })
    expect(engine.parse({ task: 'expand', p: 'three', q: 5 })).toBeNull()
    expect(engine.parse({ task: 'expand', p: 3 })).toBeNull()
    expect(engine.parse({ task: 'factorise', p: 3, q: 5 })).toBeNull()
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: 'complete-square', b: 6, c: 'lots' })).toBeNull()
  })

  it('refuses what the picture cannot honestly show, with a nearby example that works', () => {
    const f = (raw: unknown) => engine.faults(engine.parse(raw)!)
    expect(f({ task: 'expand', p: -3, q: 5 })[0]).toMatch(/cannot be drawn as an area.*Choose positive p and q, e\.g\. \(x \+ 3\)\(x \+ 5\)/)
    expect(f({ task: 'expand', p: 0, q: 5 })[0]).toMatch(/Choose positive/)
    expect(f({ task: 'expand', p: 12, q: 2 })[0]).toMatch(/more than the grid holds \(9\).*\(x \+ 9\)\(x \+ 2\)/)
    expect(f({ task: 'expand', p: 1.5, q: 2 })[0]).toMatch(/whole numbers/)
    expect(f({ task: 'complete-square', b: -6 })[0]).toMatch(/negative width.*Use a positive b, e\.g\. x² \+ 6x/)
    expect(f({ task: 'complete-square', b: 1 })[0]).toMatch(/only one place to cut.*Use b from 2 to 12/)
    expect(f({ task: 'complete-square', b: 14 })[0]).toMatch(/longer than the picture holds \(12\).*x² \+ 12x/)
    expect(f({ task: 'complete-square', b: 2.5 })[0]).toMatch(/whole number b/)
    expect(f({ task: 'complete-square', b: 6, c: 99 })[0]).toMatch(/c must be a whole number/)
    expect(f({ task: 'expand', p: 3, q: 5 })).toEqual([])
    expect(f({ task: 'complete-square', b: 5, c: 3 })).toEqual([])
  })

  it('over every valid config, starts unsolved, can be solved, and the solution is typed as the learner would', { timeout: 30_000 }, () => {
    expect(ALL.length).toBe(81 + 11 * 61)
    for (const c of ALL) {
      const label = JSON.stringify(c)
      expect(engine.parse(c), label).toEqual(c)
      expect(engine.faults(c), label).toEqual([])
      const start = engine.initial(c)
      const solved = engine.solve(c)
      expect(engine.check(c, start).ok, `${label} starts solved`).toBe(false)
      expect(engine.check(c, solved).ok, `${label} cannot be solved`).toBe(true)
      if (c.task === 'complete-square') {
        // The start is never the middle cut, and the solved cut is.
        expect(start.cut).not.toBe(c.b)
        expect(solved.cut).toBe(c.b)
        expect(start.moved).toBe(false)
      }
    }
  })

  it('expand: marks each region and the whole, and says which are wrong', () => {
    const c: AreaGridConfig = { task: 'expand', p: 3, q: 5 }
    const solved = engine.solve(c)
    expect(solved.cells).toEqual({ tl: 'x²', tr: '3x', bl: '5x', br: '15' })
    expect(solved.total).toBe('x² + 8x + 15')
    // The two strips swapped is wrong, and so is not collecting.
    expect(engine.check(c, { ...solved, cells: { ...solved.cells, tr: '5x', bl: '3x' } })).toEqual({ ok: false, wrongIds: ['tr', 'bl'] })
    expect(engine.check(c, { ...solved, total: 'x^2 + 3x + 5x + 15' })).toEqual({ ok: false, wrongIds: ['total'] })
    expect(engine.check(c, { ...solved, total: 'x² + 15x + 8' })).toEqual({ ok: false, wrongIds: ['total'] })
    // Typed any reasonable way.
    expect(engine.check(c, { cells: { tl: 'x^2', tr: '3 x', bl: '5*x', br: '15' }, total: '15 + 8x + x^2' }).ok).toBe(true)
    // A 3 by 3 square: both strips are 3x.
    const sq: AreaGridConfig = { task: 'expand', p: 3, q: 3 }
    expect(engine.check(sq, { cells: { tl: 'x²', tr: '3x', bl: '3x', br: '9' }, total: 'x²+6x+9' }).ok).toBe(true)
    expect(expandedPoly(3, 5)).toEqual([15, 8, 1])
  })

  it('expand: says what was written, never the answer', () => {
    const c: AreaGridConfig = { task: 'expand', p: 3, q: 5 }
    const solved = engine.solve(c)
    const said = madeExpand(c, { ...solved, cells: { ...solved.cells, br: '8' } })
    expect(said).toBe('Look again at the bottom right (you wrote 8). A region\'s area is its width times its height.')
    expect(madeExpand(c, { cells: { tl: '', tr: '3x', bl: '5x', br: '15' } })).toMatch(/top left \(empty\)/)
    expect(madeExpand(c, { ...solved, total: '' })).toMatch(/Now write the whole area/)
    expect(madeExpand(c, { ...solved, total: 'x^2+3x+5x+15' })).toMatch(/two terms of the same kind/)
    expect(madeExpand(c, { ...solved, total: '2x' })).toMatch(/You wrote 2x/)
  })

  it('complete-square: the cut, the turn and the gap are all needed, and the gap is a square only for the middle cut', () => {
    const c: AreaGridConfig = { task: 'complete-square', b: 6, c: 0 }
    expect(engine.check(c, { cut: 6, moved: true, corner: '9' })).toEqual({ ok: true, wrongIds: [] })
    expect(engine.check(c, { cut: 6, moved: true, corner: '9.0' }).ok).toBe(true)
    expect(engine.check(c, { cut: 6, moved: false, corner: '9' }).wrongIds).toEqual(['moved'])
    expect(engine.check(c, { cut: 6, moved: true, corner: '6' }).wrongIds).toEqual(['corner'])
    // An uneven cut leaves a rectangle, even if its own area is typed right.
    expect(engine.check(c, { cut: 4, moved: true, corner: '8' }).wrongIds).toEqual(['cut', 'corner'])
    const odd: AreaGridConfig = { task: 'complete-square', b: 5, c: 0 }
    expect(engine.check(odd, { cut: 5, moved: true, corner: '25/4' }).ok).toBe(true)
    expect(engine.check(odd, { cut: 5, moved: true, corner: '6.25' }).ok).toBe(true)
    expect(engine.check(odd, { cut: 5, moved: true, corner: '6' }).ok).toBe(false)
  })

  it('complete-square: says what the learner made', () => {
    const c: AreaGridConfig = { task: 'complete-square', b: 6, c: 0 }
    expect(madeSquare(c, { cut: 6, moved: false })).toMatch(/not been turned round/)
    expect(madeSquare(c, { cut: 4, moved: true })).toBe('You cut the strip into 2 and 4, so the gap is 2 by 4: a rectangle, not a square.')
    expect(madeSquare(c, { cut: 1, moved: true })).toMatch(/0\.5 and 5\.5/)
    expect(madeSquare(c, { cut: 6, moved: true, corner: '' })).toMatch(/Write the area/)
    expect(madeSquare(c, { cut: 6, moved: true, corner: 'nine' })).toMatch(/not a number/)
    expect(madeSquare(c, { cut: 6, moved: true, corner: '6' })).toBe('You wrote 6 for the gap. Its area is its two sides multiplied.')
  })

  it('is registered, with every example in its catalogue entry readable and fault-free', () => {
    expect(getEngine('area-grid')).toBe(engine)
    expect(engine.isolates).toBe('structure')
    expect(engine.prompt).toMatch(/SCENE "area-grid"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:area-grid"/)
    const examples = [...engine.prompt.matchAll(/"config": (\{ "task":[^}]*\})/g)].map((m) => JSON.parse(m[1]))
    expect(examples.length).toBe(2)
    for (const ex of examples) expect(engine.faults(engine.parse(ex)!)).toEqual([])
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (cfg: AreaGridConfig, prompt: string) => engine.promptFaults!(cfg, prompt)
  const e35: AreaGridConfig = { task: 'expand', p: 3, q: 5 }
  const s6: AreaGridConfig = { task: 'complete-square', b: 6, c: 0 }

  it('expand: the question is fine, the expansion is not', () => {
    expect(pf(e35, 'Expand (x + 3)(x + 5).')).toEqual([])
    expect(pf(e35, 'Use the grid to expand (x + 3)(x + 5).')).toEqual([])
    expect(pf(e35, 'Expand (x + 3)(x + 5). Hint: the answer starts x² + 8x.')).toHaveLength(1)
    expect(pf(e35, 'Expand (x + 3)(x + 5) -- remember 3 times 5 is 15.')).toHaveLength(1)
    expect(pf(e35, 'The strips are 8x together. Expand (x + 3)(x + 5).')).toHaveLength(1)
    expect(pf({ task: 'expand', p: 2, q: 4 }, 'Expand (x + 2)(x + 4).')).toEqual([])
  })

  it('complete-square: the question is fine; the half, the gap and the bracket are not', () => {
    expect(pf(s6, 'Complete the square for x² + 6x.')).toEqual([])
    expect(pf({ task: 'complete-square', b: 6, c: 2 }, 'Write x² + 6x + 2 in completed-square form.')).toEqual([])
    expect(pf(s6, 'Take half of 6 and complete the square for x² + 6x.')).toHaveLength(1)
    expect(pf(s6, 'Complete the square for x² + 6x, using b/2.')).toHaveLength(1)
    expect(pf(s6, 'Complete the square: x² + 6x = (x + 3)² − 9.')).toHaveLength(1)
    expect(pf(s6, 'The missing corner has area 9. Complete the square for x² + 6x.')).toHaveLength(1)
    expect(pf({ task: 'complete-square', b: 5, c: 0 }, 'Complete the square for x² + 5x. The gap is 25/4.')).toHaveLength(1)
    expect(pf({ task: 'complete-square', b: 5, c: 0 }, 'Complete the square for x² + 5x.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"area-grid", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(2)
    for (const m of found) expect(engine.promptFaults!(engine.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('when the tutor is shown it', () => {
  it('is offered for the stations that name these topics', () => {
    for (const s of ['Expanding double brackets', 'Double brackets and the box method', 'Completing the square', 'Expanding brackets: the grid method', 'Solving quadratics by completing the square']) {
      expect(sceneCatalogue(s), s).toContain('SCENE "area-grid"')
    }
    for (const s of ['Expanding double brackets', 'Completing the square', 'Expanding double brackets with the box method']) {
      expect(scenesFor(s).some((e) => e.id === 'area-grid'), s).toBe(true)
    }
  })

  it('is not offered for unrelated topics', () => {
    for (const s of [
      'Area of a rectangle', 'Surface area of a prism', 'Linear equations', 'Simplifying algebraic expressions',
      'Solving quadratic equations by factorising', 'The quadratic formula', 'Factorising expressions', 'Probability trees', 'Plotting a straight line',
    ]) {
      expect(sceneCatalogue(s), s).not.toContain('SCENE "area-grid"')
      expect(scenesFor(s).some((e) => e.id === 'area-grid'), s).toBe(false)
    }
  })
})

describe('the area-grid scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'area-grid', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: AreaGridConfig, state: AreaGridState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
    renderToStaticMarkup(createElement(AreaGridView, { config: cfg, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' })).replace(/ /g, ' ')

  it('expand: a region takes its colour once written in, right or wrong, so the picture builds as they work', () => {
    const cfg: AreaGridConfig = { task: 'expand', p: 3, q: 5 }
    const plain = (html: string) => html.match(/background:transparent/g)?.length ?? 0
    expect(plain(raw(cfg, { cells: { tl: '', tr: '', bl: '', br: '' }, total: '' } as AreaGridState, 'idle'))).toBe(4)
    expect(plain(raw(cfg, { cells: { tl: 'x^2', tr: '', bl: '', br: '' }, total: '' } as AreaGridState, 'idle'))).toBe(3)
    expect(plain(raw(cfg, { cells: { tl: 'wrong', tr: 'a', bl: 'b', br: 'c' }, total: '' } as AreaGridState, 'idle'))).toBe(0)
  })

  it('expand: before marking, four empty regions and the sides, with no area and no working', () => {
    const prompt = 'Expand (x + 3)(x + 5).'
    const html = card({ task: 'expand', p: 3, q: 5 }, prompt)
    expect(html.match(/placeholder="\?"/g)).toHaveLength(4)
    const shown = html.replace(prompt, '').replace(/<[^>]*>/g, ' ')
    for (const secret of ['15', '8x', '5x', '3x', 'x² +', 'Whole area', 'times its height', 'Look again']) expect(shown, secret).not.toContain(secret)
    // sr-only text names no answer either: aria labels give only widths and heights.
    expect(html).toContain('aria-label="Area of the top right region, 3 wide and x tall"')
  })

  it('expand: the whole-area box waits until the regions are filled, then marking says the working', () => {
    const c: AreaGridConfig = { task: 'expand', p: 3, q: 5 }
    expect(raw(c, engine.initial(c), 'idle')).not.toContain('Whole area')
    const solved = engine.solve(c)
    expect(raw(c, solved, 'idle')).toContain('Whole area')
    expect(raw(c, solved, 'right')).toContain('x² + 3x + 5x + 15 = x² + 8x + 15.')
    const wrong = raw(c, { ...solved, cells: { ...solved.cells, br: '8' } }, 'wrong')
    expect(wrong).toContain('bottom right (you wrote 8)')
    expect(wrong.replace(/<[^>]*>/g, ' ')).not.toContain('x² + 8x + 15')
  })

  it('complete-square: before marking, the strip, a cut and a piece, but no half, gap area or algebra', () => {
    const prompt = 'Complete the square for x² + 6x.'
    const html = card({ task: 'complete-square', b: 6, c: 0 }, prompt)
    expect(html).toContain('role="slider"')
    expect(html).toContain('role="button"')
    expect(html).not.toContain('dashed gap')
    const shown = html.replace(prompt, '').replace(/<[^>]*>/g, ' ')
    for (const secret of ['(x + 3)', '− 9', 'The gap is', 'x + 3<', '>9<', 'Area of the']) expect(shown, secret).not.toContain(secret)
    // The label above the strip says what the cut makes, not the answer.
    expect(shown).toContain('0.5 + 5.5')
  })

  it('complete-square: turning the piece round brings the gap and its box; marking says the algebra back', () => {
    const c: AreaGridConfig = { task: 'complete-square', b: 6, c: 2 }
    const moved = raw(c, { cut: 6, moved: true, corner: '' }, 'idle')
    expect(moved).toContain('Area of the dashed gap')
    expect(moved).toContain('stroke-dasharray="5 4"')
    expect(moved).not.toContain('(x + 3)')
    const right = raw(c, engine.solve(c), 'right')
    expect(right).toContain('x² + 6x + 2 = (x + 3)² − 9 + 2 = (x + 3)² − 7')
    expect(right).toContain('The gap is 3 by 3.')
    expect(raw(c, { cut: 4, moved: true, corner: '8' }, 'wrong')).toContain('a rectangle, not a square')
  })

  it('fits the card: the grid and the picture stay within 400 px, and every region can hold its text', () => {
    for (const p of range(1, P_MAX)) for (const q of range(1, P_MAX)) {
      const u = unitFor(p, q)
      expect(28 + X_PX + p * u, `${p},${q}`).toBeLessThanOrEqual(340)
      expect(24 + X_PX + q * u, `${p},${q}`).toBeLessThanOrEqual(340)
      // The narrowest region still holds a two-character area.
      expect(u).toBeGreaterThanOrEqual(22)
    }
    for (const b of range(B_MIN, B_MAX)) {
      const u = unitForB(b)
      // The gap of the right cut holds its number when marked: b=3 needs 24 px for "9/4".
      expect((b / 2) * u, `b=${b}`).toBeGreaterThanOrEqual(ratText(rat(b * b, 4)).length * 8 + 4)
      expect(44 + 130 + b * u + 30, `b=${b}`).toBeLessThanOrEqual(400)
    }
  })
})
