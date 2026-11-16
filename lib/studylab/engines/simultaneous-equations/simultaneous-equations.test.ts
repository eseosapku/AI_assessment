import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  simultaneousEquationsEngine as engine, combine, eliminationSentence, equationText, graphSentence,
  readEquation, solutionOf, targetsOf, type SimConfig, type SimState,
} from './config'
import { lineEnds, SimultaneousEquationsView, RANGE, MAX_MULT } from './View'
import { GRID, MAX_MULTIPLIER } from './config'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { examplesOf } from '../examples'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const cfg = (task: 'graph' | 'eliminate', first = 'x + y = 5', second = 'x - y = 1') => engine.parse({ task, first, second })!
const view = (config: SimConfig, state: SimState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
  renderToStaticMarkup(createElement(SimultaneousEquationsView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null,
  createElement(ActivityNode as never, { id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'simultaneous-equations', config }, success: { kind: 'scene' } } } } as never)))

describe('exact equations and solutions', () => {
  it('reads equations broadly and rejects only unreadable ones', () => {
    expect(readEquation('2x + 3y = 12')).toEqual({ a: 2, b: 3, c: 12 })
    expect(readEquation('−x + y = −4')).toEqual({ a: -1, b: 1, c: -4 })
    expect(readEquation('3y - 2 + x = 8')).toEqual({ a: 1, b: 3, c: 10 })
    expect(readEquation({ x: 2, y: -1, rhs: '7' })).toEqual({ a: 2, b: -1, c: 7 })
    expect(readEquation('x² + y = 3')).toBeNull()
    expect(readEquation('hello')).toBeNull()
    expect(engine.parse({ task: { kind: 'graphical', first: 'x+y=4', second: 'x-y=2' } })).toEqual(cfg('graph', 'x+y=4', 'x-y=2'))
  })

  it('formats without 1 coefficients or double signs', () => {
    expect(equationText({ a: 1, b: -1, c: 2 })).toBe('x − y = 2')
    expect(equationText({ a: 0, b: -3, c: -9 })).toBe('−3y = −9')
    expect(equationText(combine(cfg('eliminate', '2x + y = 7', 'x - y = 2'), 1, 1))).toBe('3x = 9')
  })

  it('distinguishes one, none and infinitely many with exact arithmetic', () => {
    expect(solutionOf(cfg('graph'))).toEqual({ kind: 'one', x: { n: 3, d: 1 }, y: { n: 2, d: 1 } })
    expect(solutionOf(cfg('graph', 'x+y=2', 'x+y=5')).kind).toBe('none')
    expect(solutionOf(cfg('graph', '2x+y=4', '4x+2y=8')).kind).toBe('many')
    expect(solutionOf(cfg('graph', 'x+y=1', 'x-y=0'))).toEqual({ kind: 'one', x: { n: 1, d: 2 }, y: { n: 1, d: 2 } })
  })

  it('finds combinations that eliminate either variable and never both for a solvable pair', () => {
    const c = cfg('eliminate', '2x + y = 7', 'x - y = 2')
    const targets = targetsOf(c)
    expect(targets.some((t) => t.p === 1 && t.q === 1 && t.variable === 'y')).toBe(true)
    expect(targets.some((t) => t.p === 1 && t.q === -2 && t.variable === 'x')).toBe(true)
    for (const t of targets) {
      const e = combine(c, t.p, t.q)
      expect(e.a === 0 || e.b === 0).toBe(true)
      expect(e.a !== 0 || e.b !== 0).toBe(true)
    }
  })

  it('clipped line endpoints stay inside the visible grid', () => {
    for (const e of [{ a: 1, b: 1, c: 5 }, { a: 1, b: 0, c: -5 }, { a: 0, b: 2, c: 7 }, { a: 3, b: -4, c: 2 }]) {
      const ends = lineEnds(e)!
      for (const p of ends) {
        expect(Math.abs(p[0])).toBeLessThanOrEqual(5.00001)
        expect(Math.abs(p[1])).toBeLessThanOrEqual(5.00001)
      }
    }
    expect(lineEnds({ a: 0, b: 0, c: 2 })).toBeNull()
  })
})

describe('faults fit the configs they refuse', () => {
  it('refuses non-grid graphical answers, with a working nearby example', () => {
    expect(engine.faults(cfg('graph', 'x+y=1', 'x-y=0')).join(' ')).toMatch(/whole-number grid coordinates.*x \+ y = 5/)
    expect(engine.faults(cfg('graph', 'x+y=30', 'x-y=0')).join(' ')).toMatch(/inside the grid/)
    expect(engine.faults(cfg('graph', '0.5x+y=3', 'x-y=1')).join(' ')).toMatch(/whole number/)
  })
  it('refuses parallel elimination, but supports it in graph', () => {
    expect(engine.faults(cfg('eliminate', 'x+y=2', 'x+y=5')).join(' ')).toMatch(/use graph/)
    expect(engine.faults(cfg('graph', 'x+y=2', 'x+y=5'))).toEqual([])
    expect(engine.faults(cfg('graph', '2x+y=4', '4x+2y=8'))).toEqual([])
  })
  it('accepts its catalogue examples and the usual curriculum equations', () => {
    expect(engine.faults(cfg('graph'))).toEqual([])
    expect(engine.faults(cfg('eliminate', '2x + y = 7', 'x - y = 2'))).toEqual([])
    expect(engine.faults(cfg('eliminate', '3x + 2y = 12', '2x - y = 1'))).toEqual([])
  })
})

/** Every valid small system the parser can express, both task kinds, plus 400 deterministic random systems. */
function systems(): SimConfig[] {
  const out: SimConfig[] = []
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) for (let c = -8; c <= 8; c++) {
    const first = { a, b, c }
    const second = { a: b - 1, b: a + 1, c: c - 3 }
    for (const task of ['graph', 'eliminate'] as const) out.push({ task, first, second })
  }
  let seed = 31
  const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed % n) - Math.floor(n / 2) }
  for (let i = 0; i < 200; i++) for (const task of ['graph', 'eliminate'] as const) {
    out.push({ task, first: { a: rand(25), b: rand(25), c: rand(81) }, second: { a: rand(25), b: rand(25), c: rand(81) } })
  }
  return out
}

describe('every valid configuration', { timeout: 30_000 }, () => {
  const all = systems()
  it('includes more than 400 random configurations and thousands of small ones', () => {
    expect(all.length).toBeGreaterThan(3_000)
    expect(all.filter(engine.faults).length).toBeGreaterThan(400)
  })
  it('starts unsolved, solves, and never accepts a collapsed elimination', () => {
    for (const c of all) {
      if (engine.faults(c).length) continue
      const start = engine.initial(c)
      const done = engine.solve(c)
      expect(engine.check(c, start).ok, `start ${JSON.stringify(c)}`).toBe(false)
      expect(engine.check(c, done), `solve ${JSON.stringify(c)}`).toEqual({ ok: true, wrongIds: [] })
      if (c.task === 'eliminate') {
        const answer = solutionOf(c)
        expect(answer.kind).toBe('one')
        const e = combine(c, done.p!, done.q!)
        expect(e.a === 0 || e.b === 0).toBe(true)
        expect(e.a !== 0 || e.b !== 0).toBe(true)
        expect(engine.check(c, { ...done, p: 0, q: 0 }).ok).toBe(false)
      }
    }
  })
  it('accepts the answer only, not a point on just one line', () => {
    const c = cfg('graph')
    expect(engine.check(c, { point: [5, 0] }).ok).toBe(false)
    expect(engine.check(c, { point: [3, 2] }).ok).toBe(true)
    expect(engine.check(c, {}).ok).toBe(false)
    const e = cfg('eliminate', '2x+y=7', 'x-y=2')
    expect(engine.check(e, { p: 1, q: 1 }).ok).toBe(true)
    expect(engine.check(e, { p: 1, q: -2 }).ok).toBe(true)
    expect(engine.check(e, { p: 1, q: 0 }).ok).toBe(false)
  })
})

describe('marked sentences say what was made', () => {
  it('says which equation a wrong point satisfies', () => {
    const c = cfg('graph')
    expect(graphSentence(c, { point: [5, 0] }, false)).toContain('satisfies the first equation, but not the second')
    expect(graphSentence(c, { point: [3, 2] }, true)).toContain('(3, 2) lies on both lines')
  })
  it('reports parallel, coincident and non-simplified elimination truthfully', () => {
    const parallel = cfg('graph', 'x+y=2', 'x+y=5')
    expect(graphSentence(parallel, engine.solve(parallel), true)).toContain('no solution')
    const same = cfg('graph', '2x+y=4', '4x+2y=8')
    expect(graphSentence(same, engine.solve(same), true)).toContain('infinitely many')
    const c = cfg('eliminate', '2x+y=7', 'x-y=2')
    expect(eliminationSentence(c, { p: 1, q: 1 }, true)).toContain('3x = 9, so x = 3')
    expect(eliminationSentence(c, { p: 1, q: -2 }, true)).toContain('3y = 3, so y = 1')
    expect(eliminationSentence(c, { p: 1, q: 0 }, false)).toContain('Both x and y are still present')
  })
})

describe('the scene on the board', () => {
  it('has keyboard controls, starts with a visible ring, and leaks no answer before marking', () => {
    const prompt = 'Drag the ring to the point that satisfies both x + y = 5 and x - y = 1.'
    const html = card({ task: 'graph', first: 'x + y = 5', second: 'x - y = 1' }, prompt)
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-valuetext="Your point is (0, 0)"')
    const withoutPrompt = html.replace(prompt, '')
    expect(withoutPrompt).not.toMatch(/\(3, 2\)|Yes:|right answer|correct answer/)
    expect(withoutPrompt).not.toMatch(/on the blue line|off the blue line/)
  })
  it('does not call special lines parallel or coincident before they are marked', () => {
    const c = cfg('graph', 'x+y=2', 'x+y=5')
    // "No solutions" is one of the three answer buttons, so only the words for the lines are held back.
    expect(view(c, engine.initial(c), 'idle')).not.toMatch(/parallel|coincident/i)
    expect(view(c, engine.solve(c), 'right')).toContain('parallel')
  })
  it('shows a live combined equation but no solution working until marked', () => {
    const c = cfg('eliminate', '2x+y=7', 'x-y=2')
    const idle = view(c, engine.initial(c), 'idle')
    expect(idle).toContain('data-combined-equation')
    expect(idle.match(/<button/g)).toHaveLength(4)
    expect(idle).not.toMatch(/Substitute|Yes\.|back-substituted/)
    const right = view(c, engine.solve(c), 'right')
    expect(right).toContain('Substitute')
    expect(right).toContain('(3, 1)')
    expect(right.match(/<button[^>]*disabled=""/g)).toHaveLength(4)
  })
  it('reduced motion has no transition and still shows the changed equation', () => {
    const c = cfg('eliminate', '2x+y=7', 'x-y=2')
    const html = view(c, { p: 2, q: -1 }, 'idle', true)
    expect(html).not.toContain('transition:')
    // 2(2x + y = 7) − (x − y = 2) is 3x + 3y = 12.
    expect(html).toContain('3x + 3y = 12')
  })
  it('is registered with the promised isolates and view constants agree', () => {
    expect(getEngine('simultaneous-equations')).toBe(engine)
    expect(engine.prompt).toContain('"isolates":"position"')
    expect(engine.isolates).toBe('position')
    expect(RANGE).toBe(GRID)
    expect(MAX_MULT).toBe(MAX_MULTIPLIER)
  })
  it('catches its stations and not the neighbouring scenes', () => {
    expect(scenesFor('Solving simultaneous equations by elimination').map((e) => e.id)).toContain('simultaneous-equations')
    expect(sceneCatalogue('Simultaneous equations graphically')).toContain('SCENE "simultaneous-equations"')
    expect(scenesFor('Elimination reactions in organic chemistry').map((e) => e.id)).not.toContain('simultaneous-equations')
    expect(sceneCatalogue('Quadratic equations')).not.toContain('SCENE "simultaneous-equations"')
    expect(sceneCatalogue('Balancing chemical equations')).not.toContain('SCENE "simultaneous-equations"')
  })
})

describe('the prompt a card is written with', () => {
  it('does not reveal a crossing or special case', () => {
    expect(engine.promptFaults!(cfg('graph'), 'The answer is (3, 2).').join(' ')).toMatch(/gives the answer away/)
    expect(engine.promptFaults!(cfg('graph'), 'Solve: x is 3.').join(' ')).toMatch(/gives the answer away/)
    expect(engine.promptFaults!(cfg('graph', 'x+y=2', 'x+y=5'), 'These are parallel.').join(' ')).toMatch(/gives the answer away/)
    expect(engine.promptFaults!(cfg('graph'), 'Drag the ring to satisfy x + y = 5 and x - y = 1.')).toEqual([])
  })
  it('does not reveal elimination multipliers, but allows naming equations and buttons', () => {
    const c = cfg('eliminate', '2x+y=7', 'x-y=2')
    expect(engine.promptFaults!(c, 'Multiply by 1 and -2, then add the equations.').join(' ')).toMatch(/gives the method or answer away/)
    expect(engine.promptFaults!(c, 'Use the multiplier buttons to combine 2x + y = 7 and x - y = 2.')).toEqual([])
  })
  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('simultaneous-equations')!
    const found = examplesOf(e)
    expect(found.length).toBeGreaterThan(0)
    for (const x of found) expect(e.promptFaults!(e.parse(x.config)!, x.prompt)).toEqual([])
  })
})
