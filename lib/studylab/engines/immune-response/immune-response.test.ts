import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { immuneResponseEngine, bacteriaFor, taggedOf, expectedTags, type ImmuneConfig, type ImmuneState } from './config'
import { ImmuneResponseView, W, H } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const configs: { raw: unknown; config: ImmuneConfig }[] = []
for (const task of ['tag', 'clear', 'bind', 'phagocytosis', 'specificity', 'remove'] as const) {
  for (const antigen of ['triangle', 'square', 'circle', 'round', 'square-shaped', 'triangular']) {
    const raw = { task, antigen }
    const config = immuneResponseEngine.parse(raw)
    if (config) configs.push({ raw, config })
  }
}

describe('the immune response engine', () => {
  it('is registered with the exact id and matching isolates', () => {
    expect(getEngine('immune-response')).toBe(immuneResponseEngine)
    expect(immuneResponseEngine.id).toBe('immune-response')
    expect(immuneResponseEngine.isolates).toBe('structure')
    expect(immuneResponseEngine.prompt).toMatch(/"isolates":"structure"/)
    expect(W).toBe(360)
    expect(H).toBe(310)
  })

  it('reads ordinary task and antigen phrasings broadly', () => {
    expect(immuneResponseEngine.parse({ task: 'bind', antigen: 'round' })).toEqual({ task: 'tag', antigen: 'circle' })
    expect(immuneResponseEngine.parse({ task: { kind: 'phagocytosis', antigen: 'square shaped' } })).toEqual({ task: 'clear', antigen: 'square' })
    expect(immuneResponseEngine.parse({ task: 'specificity' })).toEqual({ task: 'tag', antigen: 'triangle' })
    expect(immuneResponseEngine.parse(null)).toBeNull()
    expect(immuneResponseEngine.parse({ task: 'vaccinate' })).toBeNull()
  })

  it('refuses only shapes it cannot draw, with a working example', () => {
    expect(immuneResponseEngine.faults({ task: 'tag', antigen: 'star' })).toEqual([
      'There is no "star" antigen drawn here: use triangle, square or circle, e.g. { task: "tag", antigen: "triangle" }.',
    ])
    expect(immuneResponseEngine.faults({ task: 'clear', antigen: 'circle' })).toEqual([])
  })

  it('places one target for tag and two for clear, never all three alike', () => {
    for (const task of ['tag', 'clear'] as const) for (const antigen of ['triangle', 'square', 'circle']) {
      const bs = bacteriaFor({ task, antigen })
      expect(bs).toHaveLength(3)
      expect(bs.map((b) => b.antigen)).toContain(antigen)
      expect(expectedTags({ task, antigen })).toHaveLength(task === 'tag' ? 1 : 2)
      for (const b of bs) expect(b.x).toBeGreaterThan(40)
      for (const b of bs) expect(b.x).toBeLessThan(W - 40)
      for (const b of bs) expect(b.y).toBeGreaterThan(30)
      for (const b of bs) expect(b.y).toBeLessThan(110)
    }
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and can always be solved by complementary binding', () => {
    expect(configs.length).toBeGreaterThanOrEqual(30)
    for (const { raw, config } of configs) {
      const start = immuneResponseEngine.initial(config)
      const solved = immuneResponseEngine.solve(config)
      expect(immuneResponseEngine.faults(config), JSON.stringify(raw)).toEqual([])
      expect(immuneResponseEngine.check(config, start).ok, JSON.stringify(raw)).toBe(false)
      expect(immuneResponseEngine.check(config, solved).ok, JSON.stringify(raw)).toBe(true)
      for (const id of expectedTags(config)) {
        expect(immuneResponseEngine.check(config, { tagged: [...solved.tagged ?? [], id] }).ok).toBe(true)
      }
      if (expectedTags(config).length > 1) {
        expect(immuneResponseEngine.check(config, { tagged: solved.tagged!.slice(1) }).ok).toBe(false)
      }
    }
  })

  it('never accepts malformed or non-complementary stored work', () => {
    for (const { config } of configs) {
      expect(taggedOf(config, { tagged: ['B1', 'B2', 'B3', 'invented'] }).every((id) => expectedTags(config).includes(id))).toBe(true)
      expect(immuneResponseEngine.check(config, {} as ImmuneState).ok).toBe(false)
      expect(immuneResponseEngine.check(config, null as unknown as ImmuneState).ok).toBe(false)
    }
  })
})

describe('the prompt and catalogue', () => {
  it('refuses locations and mechanisms the card does not show', () => {
    const c = immuneResponseEngine.parse({ task: 'tag', antigen: 'triangle' })!
    expect(immuneResponseEngine.promptFaults!(c, 'Drag the antibody onto the middle bacterium.').join(' ')).toMatch(/gives the answer away/)
    expect(immuneResponseEngine.promptFaults!(c, 'The lymphocyte makes antibodies which digest the bacteria.').join(' ')).toMatch(/does not show/)
    expect(immuneResponseEngine.promptFaults!(c, 'Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('immune-response')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config":\s*(\{[^}]+\})/g)]
    expect(found).toHaveLength(3)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })

  it('catches immune stations but not the near misses owned by other scenes', () => {
    expect(scenesFor('Antibodies and antigens: the specific immune response').map((e) => e.id)).toContain('immune-response')
    expect(scenesFor('White blood cells and phagocytosis').map((e) => e.id)).toContain('immune-response')
    expect(scenesFor('Blood groups and transfusion').map((e) => e.id)).not.toContain('immune-response')
    expect(scenesFor('Natural selection of resistant bacteria').map((e) => e.id)).not.toContain('immune-response')
    expect(sceneCatalogue('Antibiotic resistance and natural selection')).not.toContain('SCENE "immune-response"')
  })
})

describe('the drawing before and after marking', () => {
  const card = (config: unknown, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
    id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'immune-response', config }, success: { kind: 'scene' } } },
  } as never)))

  it('names every cell and shape, with a keyboard-operable real antibody', () => {
    const html = card({ task: 'tag', antigen: 'triangle' }, 'Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does.')
    expect(html).toContain('role="slider"')
    expect(html).toContain('Y-shaped antibody. Drag it onto a bacterium')
    expect(html).toContain('lymphocyte')
    expect(html).toContain('phagocyte')
    expect(html).toContain('square antigen')
    expect(html).toContain('triangle antigen')
    expect(html).toContain('round antigen')
  })

  it('does not reveal complementary, correctness or completion through ActivityNode before marking', () => {
    const html = card({ task: 'tag', antigen: 'triangle' }, 'Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does.')
      .replace('Drag the Y-shaped antibody onto the bacterium whose antigen fits its tips. Watch what the phagocyte does.', '')
    expect(html).not.toMatch(/Yes\.|still outside|complementary shapes stay|data-engulfed|attached to/)
  })

  it('draws the antibody attached and the bacterium engulfed after a move', () => {
    const config = immuneResponseEngine.parse({ task: 'clear', antigen: 'circle' })!
    const html = renderToStaticMarkup(createElement(ImmuneResponseView, {
      config, state: { tagged: ['B1'] }, setState: () => {}, marked: 'idle', reduced: true, locked: false,
    }))
    expect(html).toContain('data-antibody="binding"')
    expect(html).toContain('data-engulfed="B1"')
    expect(html).toContain('scale(.18)')
    expect(html).toContain('data-tagged="1"')
  })

  it('says the separate antibody and phagocyte roles only when marked', () => {
    const config = immuneResponseEngine.parse({ task: 'tag', antigen: 'triangle' })!
    const right = renderToStaticMarkup(createElement(ImmuneResponseView, {
      config, state: immuneResponseEngine.solve(config), setState: () => {}, marked: 'right', reduced: true, locked: true,
    }))
    expect(right).toContain('antibodies mark pathogens; phagocytes engulf them.')
    const wrong = renderToStaticMarkup(createElement(ImmuneResponseView, {
      config, state: { tagged: [] }, setState: () => {}, marked: 'wrong', reduced: false, locked: false,
    }))
    expect(wrong).toContain('a mismatch springs back')
  })
})
