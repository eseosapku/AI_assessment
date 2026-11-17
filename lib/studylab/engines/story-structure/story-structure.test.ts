// lib/studylab/engines/story-structure/story-structure.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  storyStructureEngine as engine, STORIES, BREAKS, BROKEN_ARCS, ARC_TOLERANCE, levelsOf, arcFaults, madeArc,
  type StoryConfig,
} from './config'
import { StoryStructureView, W, H, CARD_W, CARD_H, CENTRES, cardBox, arcPath } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const STORY_NAMES = Object.keys(STORIES)
const ALL: StoryConfig[] = [
  ...STORY_NAMES.map((story) => ({ task: 'shape' as const, story })),
  ...STORY_NAMES.flatMap((story) => BREAKS.map((broken) => ({ task: 'mend' as const, story, broken }))),
]

describe('the story mountain rules', () => {
  it('accepts many visible arcs, never one exact answer', () => {
    for (const levels of [[1, 3, 5, 3, 1], [2, 3, 4, 3, 2], [1, 2, 5, 4, 2], [2, 4, 5, 3, 1]]) {
      expect(arcFaults(levels), levels.join(',')).toEqual([])
      expect(engine.check(ALL[0], { levels }).ok).toBe(true)
    }
    expect(ARC_TOLERANCE).toBe(1)
  })

  it('rejects a flat line, an early peak, a weak climax and an unsettled ending', () => {
    expect(arcFaults([1, 1, 1, 1, 1]).join(' ')).toMatch(/build-up does not rise/)
    expect(arcFaults(BROKEN_ARCS['early-peak']).join(' ')).toMatch(/opening starts/)
    expect(arcFaults(BROKEN_ARCS['no-build-up']).join(' ')).toMatch(/build-up does not rise/)
    expect(arcFaults(BROKEN_ARCS['weak-climax']).join(' ')).toMatch(/climax is not the highest/)
    expect(arcFaults(BROKEN_ARCS['unsettled-ending']).join(' ')).toMatch(/ending stays too tense/)
    // Equal highest cards are not one turning point.
    expect(arcFaults([1, 3, 4, 4, 1]).join(' ')).toMatch(/one clear highest peak/)
  })

  it('reads stored work safely', () => {
    expect(levelsOf({ levels: [2, 3, 4, 3, 2] })).toEqual([2, 3, 4, 3, 2])
    expect(levelsOf({ levels: [0, 2.5, 9, Number.NaN] })).toEqual([1, 1, 1, 1, 1])
    expect(levelsOf(null as never)).toEqual([1, 1, 1, 1, 1])
    expect(engine.check(ALL[0], {} as never).ok).toBe(false)
  })

  it('says back the structural fault, or why a good arc works', () => {
    expect(madeArc(ALL[0], { levels: [1, 3, 5, 3, 1] }).lead).toMatch(/^Yes/)
    expect(madeArc(ALL[0], { levels: [1, 3, 5, 3, 1] }).detail).toMatch(/Many shapes work/)
    expect(madeArc(ALL[0], { levels: [1, 1, 5, 2, 1] }).detail).toMatch(/build-up/)
  })
})

describe('reading the tutor’s config', () => {
  it('reads tasks, stories and nested forms broadly', () => {
    expect(engine.parse({ task: 'shape', story: 'kite' })).toEqual({ task: 'shape', story: 'kite' })
    expect(engine.parse({ task: { kind: 'build a story mountain', story: 'The runaway robot' } })).toEqual({ task: 'shape', story: 'robot' })
    expect(engine.parse({ task: 'fix-the-arc', story: 'Sam', broken: 'weak climax' })).toEqual({ task: 'mend', story: 'lighthouse', broken: 'weak-climax' })
    expect(engine.parse({ story: 'turtle', fault: 'ending too tense' })).toEqual({ task: 'mend', story: 'turtle', broken: 'unsettled-ending' })
    expect(engine.parse({ task: 'plan', story: 'concert' })).toEqual({ task: 'shape', story: 'violin' })
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse({ task: 'order-events', story: 'kite' })).toBeNull()
  })

  it('refuses only what is not drawn, with a nearby working example', () => {
    expect(engine.faults(engine.parse({ task: 'shape', story: 'dragon' })!)).toEqual([
      'There is no "dragon" story drawn here: use kite, lighthouse, robot, turtle or violin, e.g. story "kite".',
    ])
    expect(engine.faults(engine.parse({ task: 'mend', story: 'kite', broken: 'flat-middle' })!)[0]).toContain('e.g. broken "early-peak"')
    for (const c of ALL) expect(engine.faults(c)).toEqual([])
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved and solve passes', () => {
    expect(ALL).toHaveLength(25)
    for (const config of ALL) {
      const start = engine.initial(config)
      expect(engine.check(config, start).ok, JSON.stringify(config)).toBe(false)
      expect(engine.check(config, engine.solve(config)), JSON.stringify(config)).toEqual({ ok: true, wrongIds: [] })
    }
  })

  it('agrees with an independent rule over every one of the 3,125 arcs', () => {
    let passing = 0
    for (let n = 0; n < 5 ** 5; n++) {
      const levels = Array.from({ length: 5 }, (_, i) => Math.floor(n / 5 ** i) % 5 + 1)
      const expected = levels[0] <= 2 && levels[1] >= levels[0] + 1 && levels[2] === Math.max(...levels) &&
        levels.every((v, i) => i === 2 || levels[2] - v >= 1) && levels[3] <= levels[2] - 1 && levels[4] <= 2 && levels[4] <= levels[3]
      expect(engine.check(ALL[0], { levels }).ok, levels.join(',')).toBe(expected)
      if (expected) passing++
    }
    expect(passing).toBeGreaterThan(10)
  })
})

describe('the drawing and its accessibility', () => {
  const raw = (config: StoryConfig, state: { levels: number[] }, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(StoryStructureView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

  it('has five draggable, keyboard-readable event cards and one quiet shared stepper', () => {
    const html = raw(ALL[0], engine.initial(ALL[0]), 'idle')
    expect(html.match(/role="slider"/g)).toHaveLength(5)
    expect(html.match(/aria-label="More tension/g)).toHaveLength(1)
    expect(html.match(/aria-label="Less tension/g)).toHaveLength(1)
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html).toContain('Reader’s tension')
    expect(html).toContain('low to high')
    expect(html).toContain('Drag an event, or tap it and use + / −. The line bends with it.')
    expect(html).toContain('font-size="12"')
    expect(html).not.toMatch(/font-size="(?:[0-9](?:\.\d+)?|1[01](?:\.\d+)?)"/)
  })

  it('keeps every card inside its panel at every height and bends on the smallest move', () => {
    for (let i = 0; i < 5; i++) {
      for (let level = 1; level <= 5; level++) {
        const b = cardBox(i, level)
        expect(b.left).toBeGreaterThanOrEqual(0)
        expect(b.right).toBeLessThanOrEqual(W)
        expect(b.top).toBeGreaterThanOrEqual(25)
        expect(b.bottom).toBeLessThanOrEqual(306)
        if (i) expect(b.left).toBeGreaterThanOrEqual(cardBox(i - 1, level).right + 1)
      }
    }
    expect(arcPath([1, 1, 1, 1, 1])).not.toBe(arcPath([1, 2, 1, 1, 1]))
    expect(CENTRES).toHaveLength(5)
    expect(CARD_W).toBeGreaterThan(50)
    expect(CARD_H).toBeGreaterThan(60)
    expect(H).toBeLessThanOrEqual(342)
  })

  it('keeps event words inside their own cards and every label readable', () => {
    for (const story of Object.values(STORIES)) {
      for (const beat of story.beats) {
        expect(beat.text.length, beat.text).toBeLessThanOrEqual(16)
        // At 12px, 16 average-width characters remain inside a 62px card's two lines.
        expect(beat.text.split(' ').every((word) => word.length <= 10)).toBe(true)
      }
    }
  })

  it('holds back all marking and fault language until marked, including screen-reader text', () => {
    const prompt = 'Drag each event up or down to change the reader’s tension. Shape a story mountain.'
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'story-structure', config: ALL[0] }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    expect(html).not.toMatch(/not quite|too much tension|does not rise|one clear highest|Many shapes work/)
    expect(raw(ALL[0], engine.initial(ALL[0]), 'wrong')).toContain('This arc is not quite a story mountain yet.')
    expect(raw(ALL[0], engine.solve(ALL[0]), 'right')).toContain('Yes — a clear story mountain')
    const shown = raw(ALL[0], engine.initial(ALL[0]), 'shown')
    // The shared stepper still controls the selected opening; the solved climax is drawn on the mountain.
    expect(shown).toContain('>1</span>')
    expect(shown).toContain('translate(180 88.0)')
    expect(shown.match(/disabled=""/g)?.length).toBe(2)
    expect(raw(ALL[0], engine.solve(ALL[0]), 'right').match(/role="slider"/g) ?? []).toHaveLength(0)
  })

  it('reduced motion changes the still frame with no positional transition', () => {
    const low = raw(ALL[0], { levels: [1, 1, 1, 1, 1] }, 'idle', true)
    const moved = raw(ALL[0], { levels: [1, 2, 1, 1, 1] }, 'idle', true)
    expect(low).not.toBe(moved)
    expect(low).not.toContain('transition:transform')
    expect(low).not.toContain('transition:d')
  })
})

describe('the stations and the catalogue', () => {
  it('registers the exact scene id and isolates tension magnitude', () => {
    expect(getEngine('story-structure')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toContain('SCENE "story-structure"')
    expect(engine.prompt).toContain('"engine":"story-structure"')
    expect(engine.prompt).toContain('"apparatus":"scene:story-structure"')
    expect(engine.prompt).toContain('"isolates":"magnitude"')
  })

  it('catches story structure stations and leaves near misses to their own scenes', () => {
    for (const station of ['Story structure: story mountain', 'Narrative structure: climax and resolution', 'Beginning middle and end', 'Planning a story']) {
      expect(scenesFor(station).map((e) => e.id), station).toContain('story-structure')
    }
    for (const station of ['Figurative language', 'Word classes', 'Punctuation and direct speech', 'Persuasive writing', 'Timelines of historical events', 'Flashback and in medias res']) {
      expect(scenesFor(station).map((e) => e.id), station).not.toContain('story-structure')
    }
    expect(sceneCatalogue('Story mountain: narrative structure')).toContain('SCENE "story-structure"')
    expect(sceneCatalogue('Figurative language')).not.toContain('SCENE "story-structure"')
  })

  it('flags prompts that supply heights or the fault, or promise a different task', () => {
    const shape = ALL[0]
    expect(engine.promptFaults!(shape, 'Set opening 1, build-up 3, climax 5, resolution 3 and ending 1.').join(' ')).toMatch(/gives away/)
    expect(engine.promptFaults!(shape, 'Put the climax at level 5.').join(' ')).toMatch(/gives away/)
    expect(engine.promptFaults!(shape, 'Order the events into a story.').join(' ')).toMatch(/different task/)
    const mend = engine.parse({ task: 'mend', story: 'kite', broken: 'weak-climax' })!
    expect(engine.promptFaults!(mend, 'Mend the weak climax.').join(' ')).toMatch(/gives away/)
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]+)",\s*\n\s*"payload": \{ "engine":"story-structure", "config": (\{[^}]+\}) \}/g)]
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) {
      const config = engine.parse(JSON.parse(m[2]))!
      expect(engine.faults(config)).toEqual([])
      expect(engine.promptFaults!(config, m[1])).toEqual([])
    }
  })
})
