import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { similarityEngine, problemOf, targetScale, readScale, SCALE_TOLERANCE, type SimConfig } from './config'
import { SimilarityView, W, H, triangleSides } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const length = (layout: 'pair' | 'nested', variant: number): SimConfig => ({ task: 'length', layout, variant, direction: 'up' })
const grow = (solid: 'square' | 'cube', factor = 2): SimConfig => ({ task: 'grow', solid, base: solid === 'square' ? 9 : 8, target: solid === 'square' ? 9 * factor * factor : 8 * factor ** 3, unit: 'cm' })
const everyValid = (): SimConfig[] => [
  ...(['pair', 'nested'] as const).flatMap((layout) => [1, 2, 3].map((v) => length(layout, v))),
  ...(['square', 'cube'] as const).flatMap((solid) => [2, 3].map((k) => grow(solid, k))),
]

describe('the mathematics and reading', () => {
  it('draws a triangle from true side lengths', () => {
    const t = triangleSides(4, 3, 5)
    expect(t.x).toBeCloseTo(0)
    expect(t.h).toBeCloseTo(3)
    expect(Math.hypot(t.x, t.h)).toBeCloseTo(3)
    expect(Math.hypot(4 - t.x, t.h)).toBeCloseTo(5)
  })

  it('every prepared triangle has exactly the same factor on all sides', () => {
    for (const c of everyValid().filter((c) => c.task === 'length')) {
      const p = problemOf(c)
      for (const side of ['base', 'height', 'slant'] as const) expect(p.large[side] / p.small[side]).toBeCloseTo(p.scale)
      expect(p.small[p.missing]).not.toBe(p.large[p.missing])
    }
  })

  it('reads reasonable task forms and refuses only unreadable input', () => {
    expect(similarityEngine.parse({ task: { kind: 'similar triangles', layout: 'parallel sides', variant: '2' } })).toEqual(length('nested', 2))
    expect(similarityEngine.parse({ task: 'areas', shape: 'square', base: '9 cm²', target: '81 cm²', units: 'centimetres' })).toEqual(grow('square', 3))
    expect(similarityEngine.parse({ solid: 'cube', base: 8, volume: 216 })).toEqual(grow('cube', 3))
    expect(similarityEngine.parse(null)).toBeNull()
    expect(similarityEngine.parse({ task: 'prove SSS' })).toBeNull()
  })

  it('gives an actionable nearby example for values it cannot draw', () => {
    expect(similarityEngine.faults(length('pair', 99)).join(' ')).toMatch(/variant.*1, 2, 3/i)
    expect(similarityEngine.faults({ task: 'grow', solid: 'sphere', base: 8, target: 64, unit: 'cm' } as unknown as SimConfig).join(' ')).toMatch(/square.*cube/i)
    const tooBig = similarityEngine.parse({ task: 'grow', solid: 'square', base: 9, target: 144 })!
    expect(similarityEngine.faults(tooBig).join(' ')).toMatch(/factors 2 or 3.*target 81/i)
    expect(similarityEngine.faults(grow('cube', 3))).toEqual([])
  })
})

describe('every valid config', { timeout: 30_000 }, () => {
  it('starts unsolved, solve passes, and near visible placements pass', () => {
    for (const config of everyValid()) {
      expect(similarityEngine.faults(config)).toEqual([])
      expect(similarityEngine.check(config, similarityEngine.initial(config)).ok, JSON.stringify(config)).toBe(false)
      expect(similarityEngine.check(config, similarityEngine.solve(config)), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
      expect(similarityEngine.check(config, { scale: targetScale(config) + SCALE_TOLERANCE }).ok).toBe(true)
      if (targetScale(config) < 3) expect(similarityEngine.check(config, { scale: targetScale(config) + 0.2 }).ok).toBe(false)
    }
  })

  it('reads stored work safely', () => {
    for (const c of everyValid()) {
      expect(readScale(null)).toBe(1)
      expect(readScale({ scale: NaN })).toBe(1)
      expect(readScale({ scale: 99 })).toBe(3)
      expect(similarityEngine.check(c, {} as never).ok).toBe(false)
    }
  })
})

describe('catalogue, prompts and rendering', () => {
  it('is registered with the matching isolates and catches its stations, not its neighbours', () => {
    expect(getEngine('similarity')).toBe(similarityEngine)
    expect(similarityEngine.id).toBe('similarity')
    expect(similarityEngine.prompt).toMatch(/"isolates":"magnitude"/)
    expect(scenesFor('Similar triangles: find missing lengths').map((e) => e.id)).toContain('similarity')
    expect(sceneCatalogue('Areas and volumes of similar shapes')).toContain('SCENE "similarity"')
    expect(sceneCatalogue('Enlargement as a transformation')).not.toContain('SCENE "similarity"')
    expect(sceneCatalogue('Map scales and scale drawings')).not.toContain('SCENE "similarity"')
    expect(sceneCatalogue('Trigonometry in right angled triangles')).not.toContain('SCENE "similarity"')
  })

  it('refuses a prompt that prints the hidden factor or rule, and demands the gesture', () => {
    expect(similarityEngine.promptFaults!(grow('square'), 'Drag the corner using factor 2 to area 36 cm².').join(' ')).toMatch(/factor away/)
    expect(similarityEngine.promptFaults!(grow('cube'), 'Drag the corner to volume 64 cm³; cube the length factor.').join(' ')).toMatch(/rule/)
    expect(similarityEngine.promptFaults!(length('nested', 1), 'Make the base 8 cm.').join(' ')).toMatch(/gesture/)
    expect(similarityEngine.promptFaults!(grow('square'), 'Drag the blue corner until the larger square has area 36 cm². You can also use the length factor buttons.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('similarity')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{[^}]+\})/g)]
    expect(found).toHaveLength(3)
    for (const m of found) {
      const config = e.parse(JSON.parse(m[2]))!
      expect(e.faults(config)).toEqual([])
      expect(e.check(config, e.initial(config)).ok).toBe(false)
      expect(e.check(config, e.solve(config)).ok).toBe(true)
      expect(e.promptFaults!(config, m[1])).toEqual([])
    }
  })

  const card = (config: SimConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'similarity', config }, success: { kind: 'scene' } } },
  } as never)))

  it('shows the goal, gesture handle, units and live measure without a verdict', () => {
    const html = card(length('nested', 1), 'Drag the blue corner until the base is 8 cm.')
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-label="Resize the blue shape"')
    expect(html).toContain('/ 8 cm')
    expect(html).toContain('Length factor')
    expect(html).toContain('Base now')
    expect(html).toContain('Same angles.')
    expect(html).not.toContain('Yes.')
    expect(html).not.toContain('The exact length factor')
  })

  it('renders each task kind, including copy grids and marked explanations', () => {
    for (const config of everyValid()) {
      const idle = renderToStaticMarkup(createElement(SimilarityView, { config, state: similarityEngine.initial(config), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
      expect(idle).toContain(`viewBox="0 0 ${W} ${H}"`)
      expect(idle).toContain('aria-label="Decrease length factor"')
      const right = renderToStaticMarkup(createElement(SimilarityView, { config, state: similarityEngine.solve(config), setState: () => {}, marked: 'right', reduced: true, locked: true }))
      expect(right).toMatch(/Yes\.|Near enough\./)
      expect(right).toContain('factor')
      const wrong = renderToStaticMarkup(createElement(SimilarityView, { config, state: { scale: 1.25 }, setState: () => {}, marked: 'wrong', reduced: true, locked: false }))
      expect(wrong).toContain('You used length factor')
    }
    const square = renderToStaticMarkup(createElement(SimilarityView, { config: grow('square'), state: { scale: 2 }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(square).toContain('4 copies of the grey square fit inside.')
    const cube = renderToStaticMarkup(createElement(SimilarityView, { config: grow('cube'), state: { scale: 2 }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(cube).toContain('8 copies of the grey cube fit inside.')
  })

  it('keeps the picture dimensions used by the view independent of the import cycle', () => {
    expect(W).toBe(360)
    expect(H).toBe(238)
    expect(SCALE_TOLERANCE).toBe(0.05)
  })
})
