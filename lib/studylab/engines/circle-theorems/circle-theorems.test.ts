// lib/studylab/engines/circle-theorems-kimi31/circle-theorems.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  ANGLE_TOLERANCE, circleTheoremsEngine, centreAngleAtC, centrePositions, crossings, isSolved,
  markedText, readState, semiAngles, tangentAngle, type CircleConfig, type CircleState,
} from './config'
import { CircleTheoremsView, tangentPoints, R, SEMI_START_B, TANGENT_START_DELTA } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})
const engine = circleTheoremsEngine

describe('the circle geometry', () => {
  it('halves the centre angle on the other arc, and stays invariant along it', () => {
    const c: CircleConfig = { task: 'centre', central: 120 }
    expect(centreAngleAtC(c, { c: 90 })).toBe(60)
    expect(centreAngleAtC(c, { c: 140 })).toBe(60)
    expect(centreAngleAtC(c, { c: -90 })).toBe(120)
    expect(centreAngleAtC({ task: 'centre', central: 30 }, { c: -90 })).toBe(165)
    expect(isSolved(c, { c: -90 })).toBe(false)
    expect(isSolved(c, { c: 90 })).toBe(true)
    expect(centrePositions(120)).toEqual({ a: -150, b: -30 })
  })

  it('uses one exact semicircle formula on either side of the diameter', () => {
    expect(semiAngles({ b: 90 })).toEqual({ centre: 90, atC: 45 })
    expect(semiAngles({ b: -40 })).toEqual({ centre: 220, atC: 110 })
    expect(semiAngles({ b: 0 })).toEqual({ centre: 180, atC: 90 })
    expect(isSolved({ task: 'semicircle' }, { b: 4 })).toBe(true)
    expect(isSolved({ task: 'semicircle' }, { b: 5 })).toBe(false)
  })

  it('turns the exact second intersection into P only at the tangent', () => {
    for (const delta of [-35, -20, -4, 0, 4, 20, 35]) {
      const { P, Q, handle, endA, endB } = tangentPoints(delta)
      const dist = Math.hypot(Q.x - 180, Q.y - 132)
      expect(dist).toBeCloseTo(90, 8)
      for (const p of [P, Q, handle, endA, endB]) {
        expect(p.x, `x at ${delta}`).toBeGreaterThanOrEqual(20)
        expect(p.x, `x at ${delta}`).toBeLessThanOrEqual(340)
        expect(p.y, `y at ${delta}`).toBeGreaterThanOrEqual(20)
        expect(p.y, `y at ${delta}`).toBeLessThanOrEqual(245)
      }
      if (delta) expect(Math.hypot(Q.x - P.x, Q.y - P.y)).toBeGreaterThan(1)
      else expect(Q).toEqual(P)
    }
    expect(crossings({ delta: 4 })).toBe(2)
    expect(crossings({ delta: 0 })).toBe(1)
    expect(tangentAngle({ delta: -20 })).toBe(70)
  })
})

describe('reading and refusing tutor configs', () => {
  it('reads the syllabus phrasings', () => {
    expect(engine.parse({ task: 'angle at the centre', central: '120°' })).toEqual({ task: 'centre', central: 120 })
    expect(engine.parse({ task: { kind: 'inscribed angle', angle: 100 } })).toEqual({ task: 'centre', central: 100 })
    expect(engine.parse({ theorem: 'angle-in-a-semicircle' })).toEqual({ task: 'semicircle' })
    expect(engine.parse({ task: 'Thales theorem' })).toEqual({ task: 'semicircle' })
    expect(engine.parse({ task: 'tangent and radius' })).toEqual({ task: 'tangent' })
    expect(engine.parse({ task: 'same-segment' })).toEqual({ task: 'centre', central: 120 })
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: 'cyclic quadrilateral' })).toBeNull()
    expect(engine.parse({ task: 'area of a circle' })).toBeNull()
    expect(engine.parse({ task: 'centre', central: 'lots' })).toBeNull()
  })

  it('refuses narrowly, with a nearby example', () => {
    expect(engine.faults({ task: 'centre', central: 120 })).toEqual([])
    expect(engine.faults({ task: 'centre', central: 30 })).toEqual([])
    expect(engine.faults({ task: 'centre', central: 170 })).toEqual([])
    expect(engine.faults({ task: 'centre', central: 121 })[0]).toMatch(/use an even whole number, e.g. central 122/)
    expect(engine.faults({ task: 'centre', central: 171 })[0]).toMatch(/use 30° to 170°/)
    expect(engine.faults({ task: 'centre', central: 200 })[0]).toMatch(/e.g. central 120/)
    expect(engine.faults({ task: 'tangent' })).toEqual([])
  })

  it('keeps the discovery out of prompts, and passes its catalogue examples', () => {
    const centre = engine.parse({ task: 'centre', central: 120 })!
    expect(engine.promptFaults!(centre, 'Drag C. The angle at the centre is twice the angle at the circumference.')).toHaveLength(1)
    expect(engine.promptFaults!(centre, 'Drag C off the highlighted arc AB and compare the angles.')).toEqual([])
    expect(engine.promptFaults!({ task: 'semicircle' }, 'Drag B to make a right angle.')).toHaveLength(1)
    expect(engine.promptFaults!({ task: 'tangent' }, 'Rotate it to be perpendicular to OP.')).toHaveLength(1)
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[^}]+\})/g)]
    expect(found).toHaveLength(3)
    for (const m of found) {
      const config = engine.parse(JSON.parse(m[2]))!
      expect(engine.faults(config)).toEqual([])
      expect(engine.promptFaults!(config, m[1])).toEqual([])
    }
  })
})

/** Every fault-free configuration, and the full visible range of states for each. */
function allConfigs(): CircleConfig[] {
  const out: CircleConfig[] = [{ task: 'semicircle' }, { task: 'tangent' }]
  for (let central = 30; central <= 170; central += 2) out.push({ task: 'centre', central })
  return out
}

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved, solves, and is reachable through the card’s whole state range', () => {
    expect(allConfigs()).toHaveLength(73)
    for (const config of allConfigs()) {
      expect(engine.faults(config)).toEqual([])
      expect(engine.check(config, engine.initial(config)).ok, JSON.stringify(config)).toBe(false)
      expect(engine.check(config, engine.solve(config)), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      for (let n = -180; n <= 180; n++) {
        const state: CircleState = config.task === 'centre' ? { c: n } : config.task === 'semicircle' ? { b: Math.max(-55, Math.min(150, n)) } : { delta: Math.max(-35, Math.min(35, n)) }
        expect(engine.check(config, state).ok).toBe(isSolved(config, state))
      }
    }
  })

  it('accepts a visibly close tangent or diameter, but starts clearly outside tolerance', () => {
    // The view repeats start geometry to avoid the config/view module-load cycle.
    expect(SEMI_START_B).toBe(readState({ task: 'semicircle' }, {}).b)
    expect(TANGENT_START_DELTA).toBe(readState({ task: 'tangent' }, {}).delta)
    expect(R).toBe(90)
    expect(ANGLE_TOLERANCE).toBe(4)
    expect(readState({ task: 'tangent' }, {}).delta).toBe(-20)
    expect(readState({ task: 'semicircle' }, {}).b).toBe(90)
    expect(markedText({ task: 'tangent' }, { delta: 4 }, 'right')).toMatch(/Near enough: Q is close to P.*exactly 90°/)
    expect(markedText({ task: 'semicircle' }, { b: -4 }, 'right')).toMatch(/Near enough: the exact answer is 180° at O and 90° at C/)
  })
})

describe('what the stations see', () => {
  it('matches circle theorem stations and rejects the neighbours', () => {
    const yes = [
      'Circle theorems', 'Angles in circles', 'Angle in a semicircle', 'Angle at the centre',
      'Angles in the same segment', 'Cyclic quadrilaterals', 'Tangents to a circle',
      'The alternate segment theorem', 'Chords and tangents', 'Circle properties',
      'Geometric reasoning with circles',
    ]
    for (const station of yes) expect(scenesFor(station).map((e) => e.id), station).toContain('circle-theorems')
    const no = [
      'Area and circumference of a circle', 'Arc length and sector area', 'The equation of a circle',
      'The unit circle and trigonometry', 'Constructions with compasses and loci', 'Bearings',
      'Circular motion', 'The circulatory system', 'The circle of life', 'Pie charts',
    ]
    for (const station of no) expect(scenesFor(station).map((e) => e.id), station).not.toContain('circle-theorems')
    expect(sceneCatalogue('Circle theorems')).toContain('SCENE "circle-theorems"')
    expect(getEngine('circle-theorems')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/"apparatus":"scene:circle-theorems"/)
    expect(engine.prompt).toMatch(/"isolates":"magnitude"/)
  })
})

const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null,
  createElement(ActivityNode as never, { id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'circle-theorems', config }, success: { kind: 'scene' } } } } as never)))

const view = (config: CircleConfig, state: CircleState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
  renderToStaticMarkup(createElement(CircleTheoremsView, { config, state, setState: () => {}, marked, reduced: false, locked: marked === 'right' || marked === 'shown' }))

describe('the card before and after marking', () => {
  it('keeps the panel palette in dark mode with inline SVG colours', () => {
    for (const config of allConfigs()) {
      const html = view(config, engine.solve(config), 'idle')
      expect(html).toContain('fill:#263442')
      expect(html).toContain('fill:#174D82')
      expect(html).toContain('stroke="#F8FAFC"')
    }
  })

  it('has a real slider, step buttons and live measured values, but no theorem words', () => {
    const prompt = 'Drag C off the highlighted arc AB. Compare the live angles at O and C. You can also use the step buttons.'
    const html = card({ task: 'centre', central: 120 }, prompt).replace(prompt, '')
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-label="Move C anticlockwise"')
    expect(html).toContain('aria-label="Move C clockwise"')
    expect(html).toContain('Angle at C')
    expect(html.toLowerCase()).not.toMatch(/twice|same segment|semicircle|tangent|right angle/)
    expect(html).not.toContain('60°')
  })

  it('names the result only when marked, and says back what was made when wrong', () => {
    const centre: CircleConfig = { task: 'centre', central: 120 }
    expect(view(centre, { c: 90 }, 'right')).toMatch(/angle at the centre is twice/)
    expect(view(centre, { c: -90 }, 'wrong')).toMatch(/C is on the highlighted arc/)
    expect(view({ task: 'semicircle' }, { b: 0 }, 'right')).toMatch(/angle in a semicircle is a right angle/)
    expect(view({ task: 'tangent' }, { delta: -20 }, 'wrong')).toMatch(/The line still cuts the circle at P and Q/)
    expect(view({ task: 'tangent' }, { delta: 0 }, 'shown')).toMatch(/angle between a tangent and the radius/)
    expect(view({ task: 'tangent' }, { delta: 4 }, 'right')).toMatch(/Circle crossings<\/span><span[^>]*>2/)
  })

  it('offers keyboard increments and reports position rather than correctness', () => {
    const html = view({ task: 'tangent' }, { delta: -20 }, 'idle')
    expect(html).toContain('aria-valuemin="-35"')
    expect(html).toContain('aria-valuemax="35"')
    expect(html).toContain('aria-valuenow="-20"')
    expect(html).toContain('2 crossings of the circle')
    expect(html).not.toMatch(/Yes\.|Near enough|right angle|perpendicular/)
  })
})
