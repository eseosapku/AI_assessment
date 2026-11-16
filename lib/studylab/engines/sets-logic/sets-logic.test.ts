// lib/studylab/engines/sets-logic-kimi31/sets-logic.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  setsLogicEngine, readExpression, expectedCounts, countsValid, countsOf,
  EXPRESSIONS, REGION_IDS, REGION_NAMES, MAX_TOTAL,
  type ExprKey, type SetsConfig, type SetsState,
} from './config'
import { SetsLogicView, REGION_POINTS, A_CENTRE, B_CENTRE, CIRCLE_R, INTERSECTION_Y, regionPath, W, H } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const shade = (expression: ExprKey): SetsConfig => ({ task: 'shade', expression, context: 'sports' })
const counts = (totalA = 12, totalB = 9, both = 4, universal = 30): SetsConfig => ({ task: 'counts', totalA, totalB, both, universal, context: 'sports' })
const render = (config: SetsConfig, state: SetsState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(SetsLogicView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

describe('the four regions and their set rules', () => {
  it('computes every mask from in-A/in-B answers, and teaches the common confusions', () => {
    expect(EXPRESSIONS.and.mask).toEqual([false, true, false, false])
    expect(EXPRESSIONS.or.mask).toEqual([true, true, true, false])
    expect(EXPRESSIONS.notA.mask).toEqual([false, false, true, true])
    expect(EXPRESSIONS.neither.mask).toEqual([false, false, false, true])
    expect(EXPRESSIONS.notBoth.mask).not.toEqual(EXPRESSIONS.notAandNotB.mask)
    expect(EXPRESSIONS.notAorB.mask).toEqual([false, true, true, true])
    expect(EXPRESSIONS.exactlyOne.mask).toEqual([true, false, true, false])
    expect(REGION_IDS).toEqual(['a', 'both', 'b', 'outside'])
  })

  it('reads textbook notation, including which brackets a prime applies to', () => {
    expect(readExpression('A ∩ B')).toBe('and')
    expect(readExpression('A union B')).toBe('or')
    expect(readExpression("A' ∩ B")).toBe('notAaB')
    expect(readExpression('A′ ∪ B')).toBe('notAorB')
    expect(readExpression('(A ∪ B)′')).toBe('neither')
    expect(readExpression('(A ∩ B)′')).toBe('notBoth')
    expect(readExpression("A' ∩ B'")).toBe('notAandNotB')
    expect(readExpression("A' ∪ B'")).toBe('notAorNotB')
    expect(readExpression('(A ∪ B) ∩ (A ∩ B)′')).toBe('exactlyOne')
    expect(readExpression('only A')).toBe('aNotB')
    expect(readExpression('neither A nor B')).toBe('neither')
    expect(readExpression('exactly one')).toBe('exactlyOne')
    expect(readExpression('universal set')).toBe('universal')
    expect(readExpression('complement of A')).toBe('notA')
    expect(readExpression('A but not B')).toBe('aNotB')
    expect(readExpression('A NAND B')).toBeNull()
    expect(readExpression('A + B')).toBeNull()
    expect(readExpression('')).toBeNull()
  })

  it('splits totals so A and B each include the overlap, which is counted once', () => {
    expect(expectedCounts(counts() as Extract<SetsConfig, { task: 'counts' }>)).toEqual([8, 4, 5, 13])
    expect(expectedCounts(counts(4, 4, 4, 20) as Extract<SetsConfig, { task: 'counts' }>)).toEqual([0, 4, 0, 16])
    expect(countsValid(counts() as Extract<SetsConfig, { task: 'counts' }>)).toBe(true)
    expect(countsValid(counts(3, 9, 4, 30) as Extract<SetsConfig, { task: 'counts' }>)).toBe(false)
  })
})

describe('reading and refusing configs', () => {
  it('parses broad task names, nested tasks, words, symbols and numeric strings', () => {
    expect(setsLogicEngine.parse({ task: 'shade', expression: 'A or B', context: 'even numbers' })).toEqual({ task: 'shade', expression: 'or', context: 'numbers' })
    expect(setsLogicEngine.parse({ task: { kind: 'shade-region', rule: "A' ∪ B" } })).toEqual({ task: 'shade', expression: 'notAorB', context: 'sports' })
    expect(setsLogicEngine.parse({ task: 'fill in counts', totalA: '12 students', totalB: 9, both: '4', universal: 30 })).toEqual(counts())
    expect(setsLogicEngine.parse({ totalA: 12, totalB: 9, overlap: 4, total: 30 })).toEqual(counts())
    expect(setsLogicEngine.parse({ task: 'shade' })).toEqual(shade('or'))
    expect(setsLogicEngine.parse(null)).toBeNull()
    expect(setsLogicEngine.parse({ task: 'shade', expression: 'NAND' })).toBeNull()
    expect(setsLogicEngine.parse({ task: 'counts', totalA: 'many', totalB: 9, both: 4, universal: 30 })).toBeNull()
  })

  it('refuses only what cannot teach, with a nearby working example', () => {
    expect(setsLogicEngine.faults(shade('or'))).toEqual([])
    expect(setsLogicEngine.faults(shade('empty'))[0]).toMatch(/unshaded card.*already be solved.*\(A ∪ B\)′/)
    expect(setsLogicEngine.faults(counts(3, 9, 4, 30))[0]).toMatch(/Both cannot exceed.*totalA 12/)
    expect(setsLogicEngine.faults(counts(12, 9, 4, 16))[0]).toMatch(/more than the universal total 16.*at least 17/)
    expect(setsLogicEngine.faults(counts(12.5, 9, 4, 30))[0]).toMatch(/whole number from 0 to 60.*totalA 12/)
    expect(setsLogicEngine.faults(counts(0, 0, 0, 0))[0]).toMatch(/nothing to do/)
    // Out of range parses and gets an actionable fault rather than a bare null.
    expect(setsLogicEngine.faults(counts(100, 9, 4, 120))[0]).toMatch(/0 to 60/)
  })
})

/** Every shade expression, and every counts config whose four totals are 0..15:
 * 3,860 valid cards, plus all the invalid boundary cases through faults. */
function everyCountsConfig() {
  const out: Extract<SetsConfig, { task: 'counts' }>[] = []
  for (let totalA = 0; totalA <= 15; totalA++)
    for (let totalB = 0; totalB <= 15; totalB++)
      for (let both = 0; both <= 15; both++)
        for (let universal = 0; universal <= 15; universal++) {
          const c = { task: 'counts' as const, context: 'sports' as const, totalA, totalB, both, universal }
          if (countsValid(c) && setsLogicEngine.faults(c).length === 0) out.push(c)
        }
  return out
}

describe('every valid config starts unsolved and solves', { timeout: 30_000 }, () => {
  const shades = (Object.keys(EXPRESSIONS) as ExprKey[]).filter((e) => setsLogicEngine.faults(shade(e)).length === 0).map(shade)
  const allCounts = everyCountsConfig()
  const all: SetsConfig[] = [...shades, ...allCounts]
  it('enumerates every rule and thousands of solvable count splits', () => {
    expect(shades).toHaveLength(16)
    expect(allCounts.length).toBe(3_860)
    for (const config of all) {
      const start = setsLogicEngine.initial(config)
      const answer = setsLogicEngine.solve(config)
      expect(setsLogicEngine.check(config, start).ok, `starts solved ${JSON.stringify(config)}`).toBe(false)
      expect(setsLogicEngine.check(config, answer).ok, `cannot solve ${JSON.stringify(config)}`).toBe(true)
    }
  })

  it('has exact wrong-region ids, and never accepts corrupt stored work', () => {
    expect(setsLogicEngine.check(shade('or'), { shaded: ['a', 'both', 'outside'] }).wrongIds).toEqual(['b', 'outside'])
    expect(setsLogicEngine.check(counts(), { counts: [12, 4, 9, 0] }).wrongIds).toEqual(['a', 'b', 'outside'])
    expect(setsLogicEngine.check(shade('or'), {} as SetsState).ok).toBe(false)
    expect(setsLogicEngine.check(counts(), { counts: [8.5, 4, 5, 13] }).ok).toBe(false)
    expect(countsOf(counts() as Extract<SetsConfig, { task: 'counts' }>, { counts: [8, 999, 5, 13] })[1]).toBe(4)
  })

  it('reports what was made, then the rule or exact arithmetic', () => {
    expect(render(shade('notA'), { shaded: ['b'] }, 'wrong')).toMatch(/You shaded only B.*Missing: neither A nor B.*A′ means not in A/)
    expect(render(counts(), { counts: [12, 4, 9, 0] }, 'wrong')).toMatch(/You made A only 12.*split between A only and both/)
    expect(render(counts(), setsLogicEngine.solve(counts()), 'right')).toMatch(/8 \+ 4 \+ 5 = 17.*overlap is counted once/)
  })
})

describe('the drawing and accessible controls', () => {
  it('puts each direct label inside the region it names', () => {
    const inside = (x: number, y: number, c: { x: number; y: number }) => Math.hypot(x - c.x, y - c.y) < CIRCLE_R - 4
    expect(inside(REGION_POINTS.a.x, REGION_POINTS.a.y, A_CENTRE)).toBe(true)
    expect(inside(REGION_POINTS.a.x, REGION_POINTS.a.y, B_CENTRE)).toBe(false)
    expect(inside(REGION_POINTS.b.x, REGION_POINTS.b.y, B_CENTRE)).toBe(true)
    expect(inside(REGION_POINTS.b.x, REGION_POINTS.b.y, A_CENTRE)).toBe(false)
    expect(inside(REGION_POINTS.both.x, REGION_POINTS.both.y, A_CENTRE)).toBe(true)
    expect(inside(REGION_POINTS.both.x, REGION_POINTS.both.y, B_CENTRE)).toBe(true)
    expect(inside(REGION_POINTS.outside.x, REGION_POINTS.outside.y, A_CENTRE)).toBe(false)
    expect(inside(REGION_POINTS.outside.x, REGION_POINTS.outside.y, B_CENTRE)).toBe(false)
    expect(Object.keys(REGION_NAMES)).toEqual(REGION_IDS)
    expect(W).toBe(360)
    expect(H).toBe(220)
    expect(INTERSECTION_Y).toBeCloseTo(62.608, 2)
    // Endpoints must lie on both circles, or SVG invents a different arc.
    for (const y of [INTERSECTION_Y, 2 * A_CENTRE.y - INTERSECTION_Y]) {
      expect(Math.hypot(180 - A_CENTRE.x, y - A_CENTRE.y)).toBeCloseTo(CIRCLE_R, 8)
      expect(Math.hypot(180 - B_CENTRE.x, y - B_CENTRE.y)).toBeCloseTo(CIRCLE_R, 8)
    }
    expect(regionPath('both')).toContain('A68 68 0 0 1')
  })

  it('has real region buttons and keyboard-operable spin buttons', () => {
    const s = render(shade('or'), { shaded: ['a'] })
    expect(s.match(/type="button"/g)).toHaveLength(4)
    expect(s).toMatch(/aria-label="Unshade only A"/)
    expect(s).toMatch(/aria-label="Shade both A and B"/)
    const c = render(counts(), setsLogicEngine.initial(counts()))
    expect(c.match(/role="spinbutton"/g)).toHaveLength(3)
    expect(c.match(/aria-label="Add 1 to/g)).toHaveLength(3)
    expect(c).toMatch(/In A or B/)
    expect(c).toMatch(/overlap once/)
  })

  it('changes the actual region fills, not just a readout', () => {
    expect(render(shade('or'), { shaded: [] })).not.toMatch(/fill="#F6D66B"[^>]*data-region-fill="a"/)
    expect(render(shade('or'), { shaded: ['a', 'both'] })).toMatch(/fill="#F6D66B"[^>]*data-region-fill="a"/)
    expect(render(shade('or'), { shaded: ['a', 'both'] })).toMatch(/fill="#F6D66B"[^>]*data-region-fill="both"/)
  })

  it('keeps answer text out of the server-rendered card before marking', () => {
    const card = (config: SetsConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'sets-logic', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    const s = card(shade('notA'), 'Shade A′.')
    expect(s).not.toMatch(/Missing:|Extra:|The matching|region is only|regions are only/)
    expect(s).not.toMatch(/aria-label="Correct/)
    const c = card(counts(), 'Fill in the regions.')
    expect(c).not.toMatch(/A only =|B only =|so neither =|You made/)
  })

  it('renders both task kinds, both themes and every marked state without errors', () => {
    for (const config of [shade('notAorB'), counts()]) {
      for (const marked of ['idle', 'right', 'wrong', 'shown'] as const) {
        const state = marked === 'idle' ? setsLogicEngine.initial(config) : marked === 'wrong' ? setsLogicEngine.initial(config) : setsLogicEngine.solve(config)
        expect(render(config, state, marked, true)).toContain('<svg')
      }
    }
  })
})

describe('catalogue matching and prompts', () => {
  it('matches Venn/set stations and rules out the near misses', () => {
    expect(getEngine('sets-logic')).toBe(setsLogicEngine)
    expect(setsLogicEngine.isolates).toBe('membership')
    expect(scenesFor('Set notation and Venn diagrams: union and intersection').map((e) => e.id)).toContain('sets-logic')
    expect(sceneCatalogue('Shading regions in a Venn diagram')).toContain('SCENE "sets-logic"')
    expect(sceneCatalogue('Probability from a Venn diagram')).toContain('SCENE "sets-logic"')
    for (const station of ['Data sets and statistics', 'Set squares in geometry', 'Setting up an experiment', 'Sets and reps in PE', 'Logic gates and truth tables', 'Logical fallacies in argument', 'Classifying living things with dichotomous keys']) {
      expect(sceneCatalogue(station), station).not.toContain('SCENE "sets-logic"')
    }
  })

  it('catches prompts that print the answer or promise another interaction', () => {
    expect(setsLogicEngine.promptFaults!(shade('or'), 'Shade three regions, and nothing else.').join(' ')).toMatch(/names the regions or their count/)
    expect(setsLogicEngine.promptFaults!(shade('neither'), 'Shade outside both circles.').join(' ')).toMatch(/names the regions/)
    expect(setsLogicEngine.promptFaults!(counts(), 'Set A only to 8 and neither to 13.').join(' ')).toMatch(/gives a region count/)
    expect(setsLogicEngine.promptFaults!(counts(), 'Drag the elements into place, then find the probability.').join(' ')).toMatch(/promises something/)
    expect(setsLogicEngine.promptFaults!(shade('notA'), 'Tap a region to shade it yellow, and tap again to unshade it. Shade every region for A′: not in A.')).toEqual([])
    expect(setsLogicEngine.promptFaults!(counts(), 'Use − and + to fill A only, B only and neither. A has 12, B has 9, 4 are both and ℰ has 30.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('sets-logic')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(3)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
    expect(e.prompt).toMatch(/"isolates":"membership"/)
  })
})
