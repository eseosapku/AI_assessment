// lib/studylab/engines/contract.test.ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
    expect(scenesFor('Sonnets and rhyme schemes')).toEqual([])
  })

  it('gives a station the catalogue entries near its idea, not all of them', async () => {
    // Every entry in every prompt would run to tens of thousands of tokens at sixty engines.
    await import('./orbit/config')
    await import('./particles/config')
    const station = sceneCatalogue('Melting and freezing: what happens to the particles in ice')
    expect(station).toContain('SCENE "particles"')
    expect(station).not.toContain('SCENE "orbit"')
    expect(sceneCatalogue('Sonnets and rhyme schemes')).toBe('')
    // A word any topic might use is no sign of the idea: break-even is not 'Odd and even numbers'.
    await import('./business-finance/config')
    expect(sceneCatalogue('Odd and even numbers')).not.toContain('SCENE "business-finance"')
    expect(sceneCatalogue('Staying safe in the lab: lab safety rules')).not.toContain('SCENE "business-finance"')
    expect(sceneCatalogue('Break-even analysis')).toContain('SCENE "business-finance"')
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


describe('the examples a scene shows the tutor', () => {
  it('name the isolates the scene is registered with', async () => {
    // A wrong one is copied, then refused: map-reader's example said magnitude, and the tutor lost 6 cards in 10 to it.
    await import('./index')
    const { engines } = await import('./registry')
    const wrong = engines().flatMap((e) =>
      [...e.prompt.matchAll(/"isolates":\s*"(\w+)"/g)].filter((m) => m[1] !== e.isolates).map((m) => `${e.id} says ${m[1]}, registered ${e.isolates}`))
    expect(wrong).toEqual([])
  })
})

describe('a view and its config import each other', () => {
  // config.ts imports View.tsx to register it, so when the view's module runs, config's constants do not
  // exist yet. Next crashes the whole page ("Cannot access 'COLS' before initialization"); Vitest quietly
  // reads undefined, so no other test sees it. map-reader took the lesson page down this way.
  const root = join(process.cwd(), 'lib/studylab/engines')
  const scenes = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)

  /** Each statement at the top of a file: `const NAME = initialiser`, read to where its brackets close. */
  const topLevel = (source: string) => {
    const out: { name: string; init: string }[] = []
    for (const m of source.matchAll(/^(?:export )?const (\w+)[^=\n]*= /gm)) {
      let depth = 0
      let i = m.index + m[0].length
      const start = i
      for (; i < source.length; i++) {
        const c = source[i]
        if ('([{'.includes(c)) depth++
        else if (')]}'.includes(c)) depth--
        else if (c === '\n' && depth === 0) break
      }
      out.push({ name: m[1], init: source.slice(start, i) })
    }
    return out
  }

  it.each(scenes)('%s reads nothing from its config while it loads', (id) => {
    const view = join(root, id, 'View.tsx')
    const config = join(root, id, 'config.ts')
    if (!existsSync(view) || !existsSync(config)) return
    const source = readFileSync(view, 'utf8')
    const imported = [...source.matchAll(/^import \{([^}]*)\} from '\.\/config'/gm)].flatMap((m) => m[1].split(',').map((n) => n.trim().split(' as ').pop()!.trim()).filter(Boolean))
    const constants = new Set([...readFileSync(config, 'utf8').matchAll(/^export const (\w+)/gm)].map((m) => m[1]))
    const risky = imported.filter((n) => constants.has(n))
    const found = topLevel(source)
      // A function's body runs later, once everything has loaded.
      .filter(({ init }) => !/^(?:async\s+)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>/.test(init.trim()))
      .flatMap(({ name, init }) => risky.filter((n) => new RegExp(`\\b${n}\\b`).test(init)).map((n) => `${name} uses ${n}`))
    expect(found).toEqual([])
  })
})
