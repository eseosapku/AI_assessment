import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  lociConstructionsEngine as engine, circleIntersections, compassGeometry, compassSolved, conditionError, DEFAULT_TRIANGLE,
  locusSamples, measurements, onLocus, readInk, TRACE_A, TRACE_B, TRACE_C, TRACE_SEG_A, TRACE_SEG_B, TRACE_TOLERANCE,
  TRACE_GOAL, type LociConfig, type LociState, type TraceRelation,
} from './config'
import { LociConstructionsView, W, H, UNIT, TRACE_TOLERANCE_PX } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const trace = (relation: TraceRelation, distance = 3) => engine.parse({ task: 'trace', relation, distance }) as Extract<LociConfig, { task: 'trace' }>
const compass = (kind: 'triangle' | 'perpendicular' | 'angle', a?: number, b?: number) => engine.parse({ task: 'compass', kind, a, b }) as Extract<LociConfig, { task: 'compass' }>

function everyConfig(): LociConfig[] {
  const out: LociConfig[] = [trace('two-points'), trace('two-lines')]
  for (const relation of ['point', 'segment'] as const) for (let d = 1.5; d <= 3; d += 0.5) out.push(trace(relation, d))
  for (let a = 3; a <= 7; a += 0.5) for (let b = 3; b <= 7; b += 0.5) {
    const c = compass('triangle', a, b)
    if (engine.faults(c).length === 0) out.push(c)
  }
  out.push(compass('perpendicular'), compass('angle'))
  return out
}

describe('the geometry is real geometry', () => {
  it('finds both circle intersections, and none for separate or contained circles', () => {
    const p = circleIntersections({ x: 0, y: 0 }, 5, { x: 8, y: 0 }, 5)
    expect(p).toHaveLength(2)
    expect(p[0].x).toBeCloseTo(4)
    expect(Math.abs(p[0].y)).toBeCloseTo(3)
    expect(circleIntersections({ x: 0, y: 0 }, 1, { x: 5, y: 0 }, 1)).toEqual([])
    expect(circleIntersections({ x: 0, y: 0 }, 5, { x: 1, y: 0 }, 1)).toEqual([])
  })

  it('measures to the nearest point of a segment, including its rounded ends', () => {
    const c = trace('segment', 3)
    expect(measurements(c, { x: 12, y: 6 })[0]).toBe(3)
    expect(measurements(c, { x: 4, y: 9 })[0]).toBe(3)
    expect(onLocus(c, { x: 12, y: 6 })).toBe(true)
    expect(onLocus(c, { x: 4, y: 9 })).toBe(true)
    // Square corners are too far away: the capsule is not a rectangle.
    expect(onLocus(c, { x: TRACE_SEG_A.x - 3, y: TRACE_SEG_A.y - 3 })).toBe(false)
  })

  it('samples complete loci, including both angle bisectors and both capsule ends', () => {
    const angle = locusSamples(trace('two-lines'))
    expect(angle.some((p) => p.x < 6)).toBe(true)
    expect(angle.some((p) => p.x > 18)).toBe(true)
    const capsule = locusSamples(trace('segment', 3))
    expect(capsule.some((p) => p.x < TRACE_SEG_A.x)).toBe(true)
    expect(capsule.some((p) => p.x > TRACE_SEG_B.x)).toBe(true)
    expect(locusSamples(trace('point', 3)).every((p) => Math.abs(Math.hypot(p.x - TRACE_C.x, p.y - TRACE_C.y) - 3) < 1e-8)).toBe(true)
  })

  it('uses one visible tracing tolerance, and starts well outside it', () => {
    expect(TRACE_TOLERANCE).toBe(TRACE_TOLERANCE_PX)
    const c = trace('two-points')
    const start = { x: 7, y: 4 }
    expect(conditionError(c, start)).toBeGreaterThan(4 * TRACE_TOLERANCE / UNIT)
    expect(onLocus(c, { x: 12, y: 4 })).toBe(true)
  })

  it('computes the true angle-bisector crossing rather than naming a hard-coded point', () => {
    const c = compass('angle')
    const g = compassGeometry(c)
    const exact = circleIntersections({ x: 17.5, y: 7.85 }, 4, { x: 17.5, y: 12.65 }, 4).find((p) => p.x > 8)!
    expect(g.solution.x).toBeCloseTo(exact.x)
    expect(g.solution.y).toBeCloseTo(exact.y)
  })
})

describe('reading semantic configs broadly and refusing narrowly', () => {
  it('reads ordinary phrasings and nested tasks', () => {
    expect(engine.parse({ task: 'locus', relation: 'equidistant from two points' })).toEqual({ task: 'trace', relation: 'two-points', distance: 3 })
    expect(engine.parse({ task: { kind: 'trace', locus: 'fixed distance from a line', radius: '2.5 cm' } })).toEqual({ task: 'trace', relation: 'segment', distance: 2.5 })
    expect(engine.parse({ task: 'construction', kind: 'SSS', a: '7 cm', b: 6 })).toEqual({ task: 'compass', kind: 'triangle', a: 7, b: 6 })
    expect(engine.parse({ task: 'compass', construction: 'bisect an angle' })).toEqual({ task: 'compass', kind: 'angle' })
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: 'trace', relation: 'parabola' })).toBeNull()
    expect(engine.parse({ task: 'compass', kind: 'SAS' })).toBeNull()
  })

  it('gives nearby working examples for impossible dimensions', () => {
    expect(engine.faults(trace('point', 12))[0]).toMatch(/use 1\.5 to 3 cm, e\.g\. distance 3/)
    expect(engine.faults(trace('point', 1.3))[0]).toMatch(/half-centimetre/)
    expect(engine.faults(compass('triangle', 1, 2))[0]).toMatch(/a 7, b 6/)
    expect(engine.faults(compass('triangle', 3, 3)).join(' ')).toMatch(/do not make a triangle/)
    expect(engine.faults(compass('triangle'))).toEqual([])
    expect(DEFAULT_TRIANGLE.a + DEFAULT_TRIANGLE.b).toBeGreaterThan(12)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  const all = everyConfig()
  it('starts unsolved and solves, and the property test covers the whole stated grid', () => {
    expect(all).toHaveLength(22)
    for (const config of all) {
      expect(engine.faults(config), JSON.stringify(config)).toEqual([])
      expect(engine.check(config, engine.initial(config)).ok, `starts solved ${JSON.stringify(config)}`).toBe(false)
      expect(engine.check(config, engine.solve(config)).ok, `cannot solve ${JSON.stringify(config)}`).toBe(true)
    }
  })

  it('accepts both SSS intersections and equal-radius perpendicular crossings', () => {
    const c = compass('triangle', 7, 6)
    const g = compassGeometry(c)
    expect(g.intersections).toHaveLength(2)
    for (const point of g.intersections) expect(compassSolved(c, { arcs: [{ centre: 'A', radius: 7 }, { centre: 'B', radius: 6 }], point })).toBe(true)
    const p = compass('perpendicular')
    const points = circleIntersections({ x: 6, y: 12 }, 8, { x: 18, y: 12 }, 8)
    for (const point of points) expect(compassSolved(p, { arcs: [{ centre: 'A', radius: 8 }, { centre: 'B', radius: 8 }], point })).toBe(true)
  })

  it('refuses wrong radii, unequal bisector arcs and invented points', () => {
    expect(compassSolved(compass('triangle', 7, 6), { arcs: [{ centre: 'A', radius: 6 }, { centre: 'B', radius: 6 }], point: compassGeometry(compass('triangle', 7, 6)).solution })).toBe(false)
    expect(compassSolved(compass('perpendicular'), { arcs: [{ centre: 'A', radius: 8 }, { centre: 'B', radius: 7 }], point: { x: 12, y: 6 } })).toBe(false)
    expect(compassSolved(compass('triangle', 7, 6), { arcs: [{ centre: 'A', radius: 7 }, { centre: 'B', radius: 6 }], point: { x: 1, y: 1 } })).toBe(false)
    expect(engine.check(trace('two-points'), { ink: [] }).ok).toBe(false)
    expect(engine.check(trace('two-points'), { ink: [{ x: 12, y: 4 }] }).ok).toBe(false)
  })

  it('does not mark from pretty pixels or corrupt saved state', () => {
    expect(readInk({ ink: [{ x: NaN, y: 2 }, { x: 99, y: 2 }, null] as never })).toEqual([])
    expect(compassSolved(compass('angle'), null)).toBe(false)
    expect(compassSolved(compass('perpendicular'), { arcs: [{ centre: 'A', radius: 5.5 }, { centre: 'B', radius: 5.5 }], point: { x: 12, y: 12 } })).toBe(false)
  })
})

describe('the catalogue and its prompts', () => {
  it('registers the exact scene id, catches loci stations and leaves near misses alone', () => {
    expect(getEngine('loci-constructions')).toBe(engine)
    expect(engine.isolates).toBe('position')
    expect(scenesFor('Constructions and loci: ruler and compasses').map((e) => e.id)).toContain('loci-constructions')
    expect(scenesFor('The perpendicular bisector as a locus').map((e) => e.id)).toContain('loci-constructions')
    expect(sceneCatalogue('Constructing triangles with ruler and compasses')).toContain('SCENE "loci-constructions"')
    expect(sceneCatalogue('Circle theorems and cyclic quadrilaterals')).not.toContain('SCENE "loci-constructions"')
    expect(sceneCatalogue('Gene loci and inheritance')).not.toContain('SCENE "loci-constructions"')
    expect(scenesFor('Sonnets and rhyme schemes')).toEqual([])
  })

  it('rejects answer-revealing or impossible prompts for each family', () => {
    expect(engine.promptFaults!(trace('two-points'), 'Trace the perpendicular bisector.').join(' ')).toMatch(/names the locus/)
    expect(engine.promptFaults!(trace('point', 3), 'Draw a circle.').join(' ')).toMatch(/names the locus/)
    expect(engine.promptFaults!(trace('segment', 3), 'Shade the region on a 1:200 scale drawing.').join(' ')).toMatch(/promises/)
    expect(engine.promptFaults!(compass('perpendicular'), 'Construct the line through the midpoint at 90°.').join(' ')).toMatch(/states the property/)
    expect(engine.promptFaults!(compass('angle'), 'Use a protractor and type the angle.').join(' ')).toMatch(/interaction/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('loci-constructions')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
  id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'loci-constructions', config }, success: { kind: 'scene' } } },
} as never)))
const view = (config: LociConfig, state: LociState, marked: 'idle' | 'right' | 'wrong' | 'shown') => renderToStaticMarkup(createElement(LociConstructionsView, { config, state, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))

describe('the scene on the board', () => {
  it('offers a real draggable keyboard pencil and live measurements without naming its locus', () => {
    const c = trace('two-points')
    const html = card(c, 'Drag the pencil around the paper. Blue ink appears only where PA = PB. Trace the whole path.').replace('Drag the pencil around the paper. Blue ink appears only where PA = PB. Trace the whole path.', '')
    expect(html).toContain('role="slider"')
    expect(html).toContain('data-handle="pencil"')
    expect(html).toContain('Move pencil left')
    expect(html).not.toMatch(/perpendicular bisector|angle bisector|capsule|semicircular/i)
    expect(view(c, engine.solve(c), 'right')).toMatch(/perpendicular bisector/)
    expect(view(c, {}, 'wrong')).toMatch(/No part of the path/)
  })

  it('has real centre, radius and crossing buttons, and reveals construction properties only after marking', () => {
    const c = compass('perpendicular')
    const idle = card(c, 'Place equal-radius arcs, then tap a crossing.').replace('Place equal-radius arcs, then tap a crossing.', '')
    expect(idle).toContain('Select compass centre A')
    expect(idle).toContain('Place arc from A')
    expect(idle).not.toMatch(/midpoint|90°|equidistant/)
    const solved = engine.solve(c)
    expect(view(c, solved, 'right')).toMatch(/midpoint of AB at 90°/)
    expect(view(c, {}, 'wrong')).toMatch(/No construction arcs/)
  })

  it('the view geometry agrees with the engine constants and reduced motion still changes the still frame', () => {
    expect(W).toBe(360)
    expect(H).toBe(258)
    expect(UNIT).toBe(15)
    const c = trace('point', 3)
    const before = view(c, {}, 'idle')
    const after = view(c, { x: 12, y: 12, ink: [{ x: 12, y: 12 }] }, 'idle')
    expect(after).not.toEqual(before)
    expect(view(c, { x: 12, y: 12, ink: [{ x: 12, y: 12 }, { x: 12, y: 12.2 }] }, 'idle')).toContain('data-ink="1"')
  })

  it('can solve angle construction from its actual C and D arcs', () => {
    const c = compass('angle')
    expect(compassSolved(c, engine.solve(c))).toBe(true)
    expect(engine.check(c, {}).ok).toBe(false)
    const html = view(c, engine.solve(c), 'right')
    expect(html).toMatch(/bisects the angle/)
  })
})
