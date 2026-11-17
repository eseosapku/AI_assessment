// lib/studylab/engines/multiplication-arrays/multiplication-arrays.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  multiplicationArraysEngine as e, MIN_SIDE, MAX_SIDE, MIN_PLATES, MAX_PLATES, MAX_PER_PLATE, MAX_COOKIES,
  quotient, remainder, shareDrawable, buildDrawable, type ArraysConfig, type BuildConfig, type ShareConfig,
} from './config'
import { MultiplicationArraysView, CELL, AX, MAXS, W, PLATE_R, MAX_ON_PLATE, platePoint, platePositions, shareHeight, buildHeight } from './View'
import { getEngine, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const build = (rows = 4, cols = 3): BuildConfig => ({ task: 'build', rows, cols })
const share = (total = 13, plates = 4): ShareConfig => ({ task: 'share', total, plates })
const render = (config: ArraysConfig, state: unknown, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(MultiplicationArraysView, { config, state: state as never, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('rules', () => {
  it('knows the quotient and remainder', () => {
    expect(quotient(share())).toBe(3)
    expect(remainder(share())).toBe(1)
    expect(remainder(share(12, 4))).toBe(0)
  })
  it('accepts a turned tray as a different shape, not the same one', () => {
    expect(e.check(build(), { rows: 4, cols: 3 }).ok).toBe(true)
    expect(e.check(build(), { rows: 3, cols: 4 })).toEqual({ ok: false, wrongIds: ['rows', 'cols'] })
    expect(e.check(share(), { given: [3, 3, 3, 2] }).wrongIds).toEqual(['plate3'])
    expect(e.check(share(), { given: [2, 2, 2, 2] }).ok).toBe(false)
    expect(e.check(share(), { given: [3, 3, 3, 3] }).ok).toBe(true)
    expect(e.check(share(), {} as never).ok).toBe(false)
  })
  it('repairs corrupt stored work', () => {
    expect(buildDrawable({ rows: 99, cols: 'x' })).toEqual({ rows: MAXS, cols: 1 })
    expect(shareDrawable(share(), { given: [9, 9, 9, 9] }).given).toEqual([9, 4, 0, 0])
  })
})

describe('parse and faults', () => {
  it('reads broad phrasings', () => {
    expect(e.parse({ task: 'build', rows: 4, cols: 3 })).toEqual(build())
    expect(e.parse({ task: 'array', groups: '4', each: 3 })).toEqual(build())
    expect(e.parse({ task: { kind: 'share', total: 13, plates: 4 } })).toEqual(share())
    expect(e.parse({ cookies: 13, people: 4 })).toEqual(share())
    expect(e.parse({ task: 'build' })).toBeNull()
    expect(e.parse(null)).toBeNull()
  })
  it('refuses with a working example', () => {
    expect(e.faults(build(11, 3))[0]).toMatch(/2 to 10.*rows 4, cols 3/)
    expect(e.faults(build(4, 1))[0]).toMatch(/2 to 10/)
    expect(e.faults(share(13, 7))[0]).toMatch(/2 to 6/)
    expect(e.faults(share(3, 4))[0]).toMatch(/at least one for each plate/)
    expect(e.faults(share(40, 4))[0]).toMatch(/32/)
    expect(e.faults(share(32, 3))[0]).toMatch(/9 cookies/)
    expect(e.faults(share(13.5, 4))).not.toEqual([])
    expect(e.faults(build())).toEqual([])
  })
})

function everyConfig(): ArraysConfig[] {
  const out: ArraysConfig[] = []
  for (let r = MIN_SIDE; r <= MAX_SIDE; r++) for (let c = MIN_SIDE; c <= MAX_SIDE; c++) out.push(build(r, c))
  for (let k = MIN_PLATES; k <= MAX_PLATES; k++) for (let t = 0; t <= MAX_COOKIES + 2; t++) if (e.faults(share(t, k)).length === 0) out.push(share(t, k))
  return out
}

describe('every valid config starts unsolved and solves', { timeout: 30_000 }, () => {
  it('enumerates all', () => {
    const all = everyConfig()
    expect(all.length).toBeGreaterThan(150)
    for (const c of all) {
      expect(e.faults(c), JSON.stringify(c)).toEqual([])
      expect(e.check(c, e.initial(c)).ok, `solved ${JSON.stringify(c)}`).toBe(false)
      expect(e.check(c, e.solve(c)).ok, `unsolvable ${JSON.stringify(c)}`).toBe(true)
      expect(render(c, e.initial(c))).toContain('<svg')
      for (const m of ['right', 'wrong', 'shown'] as const) expect(render(c, e.solve(c), m, true)).toContain('<svg')
    }
  })
})

describe('the drawing', () => {
  it('keeps the geometry in step with config', () => {
    expect(MAXS).toBe(MAX_SIDE)
    expect(MAX_ON_PLATE).toBe(MAX_PER_PLATE)
    expect(AX + MAXS * CELL + 5 + 17).toBeLessThan(W)
    expect(buildHeight(MAXS)).toBeGreaterThan(40 + MAXS * CELL + 5 + 12)
    expect(CELL).toBe(23)
  })
  it('puts every cookie inside its plate and clear of the others', () => {
    for (let n = 1; n <= MAX_ON_PLATE; n++) {
      const pts = Array.from({ length: n }, (_, i) => platePoint(i, n, 0, 0))
      for (const p of pts) expect(Math.hypot(p.x, p.y) + 7).toBeLessThanOrEqual(PLATE_R - 6)
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(14)
    }
  })
  it('spaces plates apart and inside the panel', () => {
    for (let k = MIN_PLATES; k <= MAX_PLATES; k++) {
      const ps = platePositions(k)
      for (const p of ps) { expect(p.cx - PLATE_R).toBeGreaterThanOrEqual(0); expect(p.cx + PLATE_R).toBeLessThanOrEqual(W); expect(p.cy + PLATE_R + 20).toBeLessThan(shareHeight(k)) }
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) expect(Math.hypot(ps[i].cx - ps[j].cx, ps[i].cy - ps[j].cy)).toBeGreaterThan(2 * PLATE_R + 8)
    }
  })
  it('changes with every move', () => {
    expect(render(build(), { rows: 1, cols: 1 })).not.toBe(render(build(), { rows: 2, cols: 1 }))
    expect(render(build(), { rows: 2, cols: 3 }, 'idle', true)).not.toBe(render(build(), { rows: 3, cols: 2 }, 'idle', true))
    expect(render(share(), { given: [0, 0, 0, 0] })).not.toBe(render(share(), { given: [1, 0, 0, 0] }))
    expect(render(build(), { rows: 4, cols: 3 })).toMatch(/4 rows of 3, 12 cookies in all/)
    expect(render(build(), { rows: 1, cols: 1 })).toMatch(/1 row of 1, 1 cookie in all/)
  })
  it('has real buttons with labels', () => {
    const b = render(build(), { rows: 2, cols: 2 })
    expect(b).toMatch(/aria-label="Turn the tray a quarter turn"/)
    expect(b.match(/role="spinbutton"/g)).toHaveLength(2)
    const s = render(share(), { given: [1, 0, 0, 0] })
    expect(s).toMatch(/aria-label="Deal a round/)
    expect(s).toMatch(/Take a cookie back from plate 1/)
  })
  it('says what was made, then the fact family', () => {
    expect(render(build(), { rows: 3, cols: 4 }, 'wrong')).toMatch(/You made 3 rows of 4.*other way.*Turn/)
    expect(render(build(), { rows: 4, cols: 3 }, 'right')).toMatch(/4 × 3 = 3 × 4 = 12.*12 ÷ 3 = 4/)
    expect(render(share(), { given: [3, 3, 2, 3] }, 'wrong')).toMatch(/dealt 3, 3, 2, 3.*not equal/)
    expect(render(share(), { given: [2, 2, 2, 2] }, 'wrong')).toMatch(/another round/)
    expect(render(share(), { given: [3, 3, 3, 3] }, 'right')).toMatch(/13 ÷ 4 = 3 remainder 1.*4 × 3 \+ 1 = 13/)
  })
  it('keeps the answer out of the server-rendered card before marking', () => {
    const card = (config: ArraysConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'multiplication-arrays', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    expect(card(share(), 'Share the cookies.')).not.toMatch(/remainder|left over|÷/)
    expect(card(build(), 'Make the tray.')).not.toMatch(/= 12|÷|You made/)
  })
})

describe('catalogue and prompts', () => {
  it('is found for its stations and not for the near misses', () => {
    expect(getEngine('multiplication-arrays')).toBe(e)
    for (const s of ['Multiplication with arrays', 'Times tables', 'Equal groups and repeated addition', 'Division with remainders', 'Fact families']) expect(sceneCatalogue(s), s).toContain('SCENE "multiplication-arrays"')
    for (const s of ['Arrays in programming', 'Matrix multiplication', 'Multiplying decimals', 'Area of rectangles', 'Remainder theorem', 'Prime factorisation', 'Place value']) expect(sceneCatalogue(s), s).not.toContain('SCENE "multiplication-arrays"')
  })
  it('catches prompts that print the answer or promise too much', () => {
    expect(e.promptFaults!(build(), 'Make 4 rows of 3 to get 12 cookies.').join(' ')).toMatch(/in all/)
    expect(e.promptFaults!(build(), 'Drag the cookies into 4 rows of 3.').join(' ')).toMatch(/promises/)
    expect(e.promptFaults!(share(), 'Share 13 cookies, with 1 left over.').join(' ')).toMatch(/remainder|left over/)
    expect(e.promptFaults!(share(), 'Give each plate 3 each.').join(' ')).toMatch(/share each plate/)
    expect(e.promptFaults!(share(), 'Drag the cookies to the plates.').join(' ')).toMatch(/promises/)
    expect(e.promptFaults!(build(), 'Use the buttons to make 4 rows with 3 cookies in each row.')).toEqual([])
  })
  it('passes the examples in its own catalogue entry', () => {
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(2)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(e.faults(c)).toEqual([])
      expect(e.promptFaults!(c, m[1])).toEqual([])
      expect(e.check(c, e.initial(c)).ok).toBe(false)
      expect(e.check(c, e.solve(c)).ok).toBe(true)
    }
    expect(e.prompt).toMatch(/"isolates":"structure"/)
  })
})
