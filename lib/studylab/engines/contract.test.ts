// lib/studylab/engines/contract.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { registerEngine, getEngine, sceneCatalogue } from './registry'
import type { SceneEngine } from './types'
import { validateSpec } from '../activities/validate'
import { getPatternModule } from '../activities/registry'
import { dimensionsOf } from '../activities/dimensions'
import { checkIntent } from '../activities/intent'
import { meaningFaults } from '../meaning'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * A scene is an activity whose engine computes what the learner sees and
 * marks it: the tutor names a few fields, never the mechanics.
 */
const stub: SceneEngine<{ target: number }, { at: number }> = {
  id: 'stub',
  covers: ['testing the contract'],
  isolates: 'position',
  parse: (raw) => (raw && typeof (raw as { target?: unknown }).target === 'number' ? { target: (raw as { target: number }).target } : null),
  faults: (c) => (c.target === 0 ? ['the target is where it starts'] : []),
  initial: () => ({ at: 0 }),
  check: (c, s) => ({ ok: s.at === c.target, wrongIds: [] }),
  solve: (c) => ({ at: c.target }),
  View: ({ state }) => createElement('p', { 'data-stub': true }, `at ${state.at}`),
  prompt: 'stub -- a test engine: { "target": <number> }',
}
registerEngine(stub as SceneEngine<unknown, unknown>)

const spec = (config: unknown, engine = 'stub') => ({ pattern: 'scene', prompt: 'Move it to 3.', payload: { engine, config }, success: { kind: 'scene' } })

describe('the scene pattern', () => {
  it('is a valid activity when its engine can read its config', () => {
    expect(validateSpec(spec({ target: 3 }))).toBe(true)
    expect(validateSpec(spec({ target: 'three' }))).toBe(false)
    expect(validateSpec(spec({ target: 3 }, 'no-such-engine'))).toBe(false)
  })

  it('is marked by its engine, from its engine’s start', () => {
    const mod = getPatternModule('scene')!
    const s = spec({ target: 3 })
    expect(mod.initialWork(s.payload as never)).toEqual({ at: 0 })
    expect(mod.validate(s.payload as never, { at: 3 }, s.success as never).ok).toBe(true)
    expect(mod.validate(s.payload as never, { at: 2 }, s.success as never).ok).toBe(false)
  })

  it('isolates what its engine isolates, so a matching intent passes', () => {
    expect(dimensionsOf(spec({ target: 3 }) as never)).toEqual(['position'])
    expect(checkIntent({ goal: 'g', isolates: 'position', apparatus: 'scene:stub', why: 'w' }, spec({ target: 3 }) as never).ok).toBe(true)
  })

  it('is refused by the meaning gates for whatever its engine finds', () => {
    expect(meaningFaults({ type: 'createActivity', id: 'm1', spec: spec({ target: 0 }) })).toContain('the target is where it starts')
  })

  it('draws its engine’s view under the prompt', () => {
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, { id: 'n1', data: { spec: spec({ target: 3 }) } } as never)))
    expect(html).toContain('Move it to 3.')
    expect(html).toContain('data-stub')
  })
})

describe('the scenes a station is for', () => {
  it('finds a scene whose topic every word of is in the station', async () => {
    await import('./orbit/config')
    await import('./particles/config')
    const { scenesFor } = await import('./registry')
    expect(scenesFor('Changes of state: what happens to particles when ice melts').map((e) => e.id)).toContain('particles')
    expect(scenesFor('Why the Moon has phases -- phases of the Moon').map((e) => e.id)).toContain('orbit')
    expect(scenesFor('Equivalent fractions')).toEqual([])
  })

  it('gives a station the catalogue entries near its idea, not all of them', async () => {
    // Every entry in every prompt would run to tens of thousands of tokens at sixty engines.
    await import('./orbit/config')
    await import('./particles/config')
    const station = sceneCatalogue('Melting and freezing: what happens to the particles in ice')
    expect(station).toContain('SCENE "particles"')
    expect(station).not.toContain('SCENE "orbit"')
    expect(sceneCatalogue('Equivalent fractions')).toBe('')
    // A shared stem is not a shared idea.
    await import('./lab-bench/config')
    expect(sceneCatalogue('Equivalent fractions: making equal fractions')).not.toContain('SCENE "lab-bench"')
    expect(sceneCatalogue()).toContain('SCENE "orbit"')
  })
})

describe('the registry', () => {
  it('finds an engine by id, and lists every engine for the tutor', () => {
    expect(getEngine('stub')?.id).toBe('stub')
    expect(getEngine('nothing')).toBeNull()
    expect(sceneCatalogue()).toContain('stub -- a test engine')
  })

  it('lists every engine, for the evals that hold each to the bar', async () => {
    const { engines } = await import('./registry')
    expect(engines().map((e) => e.id)).toContain('stub')
  })
})
