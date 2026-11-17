// lib/studylab/engines/word-classes/word-classes.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  wordClassesEngine as E, SWAP_ITEMS, FRAMES, CLASSES, splitItem, swapTiles, socketsOf, readClass, itemOf, type WCConfig, type Cls,
} from './config'
import { WordClassesView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const render = (config: WCConfig, state: object, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(WordClassesView, { config: config as never, state: state as never, setState: () => {}, marked, reduced, locked: marked === 'right' }))

const allConfigs = (): WCConfig[] => [
  ...CLASSES.flatMap((focus) => SWAP_ITEMS[focus].map((_, i) => ({ task: 'swap', focus, item: i + 1 }) as WCConfig)),
  ...FRAMES.map((_, i) => ({ task: 'build', frame: i + 1 }) as WCConfig),
]

describe('the data is sound', () => {
  it('every item has a marker, two answers, three decoys of other classes, and no repeated words', () => {
    for (const focus of CLASSES) for (const item of SWAP_ITEMS[focus]) {
      expect(item.text.match(/\[/g), item.text).toHaveLength(1)
      expect(splitItem(item).target.length).toBeGreaterThan(1)
      expect(item.answers.length).toBeGreaterThanOrEqual(2)
      expect(item.decoys).toHaveLength(3)
      for (const [, c] of item.decoys) expect(c, item.text).not.toBe(focus)
      const words = swapTiles(focus, item).map((t) => t.w.toLowerCase())
      expect(new Set(words).size).toBe(words.length)
      expect(words).not.toContain(splitItem(item).target.toLowerCase())
    }
  })
  it('every frame has enough tiles of each socket class, and decoys that fit no socket class by being a different job', () => {
    for (const f of FRAMES) {
      for (const cls of new Set(socketsOf(f))) {
        const need = socketsOf(f).filter((c) => c === cls).length
        expect(f.tiles.filter((t) => t.cls === cls).length, f.name).toBeGreaterThanOrEqual(need)
      }
      expect(f.tiles.length).toBeGreaterThan(socketsOf(f).length)
    }
  })
  it('keeps the small-fact neighbours straight: swap tiles are alphabetical, not answer-first', () => {
    const tiles = swapTiles('noun', SWAP_ITEMS.noun[0]).map((t) => t.w)
    expect(tiles).toEqual([...tiles].sort((a, b) => a.localeCompare(b)))
  })
})

describe('reading and refusing configs', () => {
  it('parses broad phrasings', () => {
    expect(E.parse({ task: 'swap', focus: 'verbs', item: '2' })).toEqual({ task: 'swap', focus: 'verb', item: 2 })
    expect(E.parse({ focus: 'Adjective' })).toEqual({ task: 'swap', focus: 'adjective', item: 1 })
    expect(E.parse({ class: 'describing word', example: 3 })).toEqual({ task: 'swap', focus: 'adjective', item: 3 })
    expect(E.parse({ task: 'build', frame: 3 })).toEqual({ task: 'build', frame: 3 })
    expect(E.parse({ task: 'build', focus: 'expanded noun phrase' })).toEqual({ task: 'build', frame: 2 })
    expect(E.parse({ frame: 4 })).toEqual({ task: 'build', frame: 4 })
    expect(E.parse(null)).toBeNull()
    expect(E.parse({})).toBeNull()
    expect(readClass('connectives')).toBe('conjunction')
  })
  it('refuses with a nearby working example', () => {
    expect(E.faults({ task: 'swap', focus: 'noun', item: 1 })).toEqual([])
    expect(E.faults(E.parse({ focus: 'determiner' })!)[0]).toMatch(/not one of the word classes.*"focus":"noun"/)
    expect(E.faults({ task: 'swap', focus: 'preposition', item: 5 })[0]).toMatch(/2 sentences.*1 to 2/)
    expect(E.faults({ task: 'swap', focus: 'noun', item: 1.5 })[0]).toMatch(/1 to 3/)
    expect(E.faults({ task: 'build', frame: 9 })[0]).toMatch(/1 to 4/)
  })
})

describe('every valid config starts unsolved and solves', { timeout: 30_000 }, () => {
  it('enumerates every swap item and frame', () => {
    const all = allConfigs()
    expect(all.length).toBe(19 + 4)
    for (const c of all) {
      expect(E.faults(c), JSON.stringify(c)).toEqual([])
      expect(E.check(c, E.initial(c)).ok, `starts solved ${JSON.stringify(c)}`).toBe(false)
      expect(E.check(c, E.solve(c)).ok, `cannot solve ${JSON.stringify(c)}`).toBe(true)
    }
  })
  it('accepts any answer tile, rejects each decoy, and gives exact wrong ids', () => {
    for (const focus of CLASSES) SWAP_ITEMS[focus].forEach((item, i) => {
      const c: WCConfig = { task: 'swap', focus, item: i + 1 }
      for (const t of swapTiles(focus, item)) expect(E.check(c, { pick: t.w }).ok, `${item.text} ${t.w}`).toBe(t.cls === focus)
      expect(E.check(c, { pick: 'zzz' }).ok).toBe(false)
      expect(E.check(c, {} as never).wrongIds).toEqual(['slot'])
    })
    const b: WCConfig = { task: 'build', frame: 1 }
    // Tiles are in the frame's own order: sleepy(0) tiger(1) jumped(2) quietly(3).
    expect(E.check(b, { placed: [0, 1, 2, 3] }).ok).toBe(true)
    expect(E.check(b, { placed: [0, 1, 3, 2] }).wrongIds).toEqual(['s2', 's3'])
    // The same tile twice, out-of-range tiles and junk never pass.
    expect(E.check(b, { placed: [0, 0, 2, 3] }).ok).toBe(false)
    expect(E.check(b, { placed: [0, 1, 2, 99] }).ok).toBe(false)
    expect(E.check(b, {} as never).ok).toBe(false)
    // Two sockets of one class accept either tile (frame 2: two adjectives).
    expect(E.check({ task: 'build', frame: 2 }, { placed: [1, 0, 2, 3] }).ok).toBe(true)
  })
  it('says what was made, then the job', () => {
    const c: WCConfig = { task: 'swap', focus: 'noun', item: 1 }
    expect(render(c, { pick: 'quickly' }, 'wrong')).toMatch(/You swapped in &quot;quickly&quot;, an adverb.*walk.*is a noun here/)
    expect(render(c, { pick: 'run' }, 'right')).toMatch(/Yes.*walk.*a noun here.*run.*a noun too/)
    expect(render({ task: 'build', frame: 1 }, { placed: [3, 1, 2, 0] }, 'wrong')).toMatch(/quietly.*adverb.*socket 1 needs an adjective/)
  })
})

describe('the drawing', () => {
  it('shows the swapped word in the sentence and the original before', () => {
    const c: WCConfig = { task: 'swap', focus: 'verb', item: 1 }
    expect(render(c, { pick: null })).toContain('kicked')
    const s = render(c, { pick: 'threw' })
    expect(s).toMatch(/threw/)
    expect(s.match(/>kicked</g)).toBeNull()
  })
  it('capitalises a word placed at the start of a sentence', () => {
    expect(render({ task: 'swap', focus: 'adverb', item: 3 }, { pick: 'Later' })).toContain('>Later<')
    expect(render({ task: 'build', frame: 3 }, { placed: [0, null, null, null] })).toContain('>She<')
  })
  it('has real buttons with labels, and a tile bank that does not reveal classes before marking', () => {
    const s = render({ task: 'swap', focus: 'noun', item: 1 }, { pick: null })
    expect((s.match(/<button/g) ?? []).length).toBe(6)
    expect(s).toMatch(/aria-label="Swap in run"/)
    for (const cls of CLASSES) expect(s, cls).not.toMatch(new RegExp(`>${cls}<`))
    const m = render({ task: 'swap', focus: 'noun', item: 1 }, { pick: 'run' }, 'right')
    expect(m).toMatch(/>noun</)
  })
  it('renders every config in every marked state, reduced or not', () => {
    for (const c of allConfigs()) for (const marked of ['idle', 'right', 'wrong', 'shown'] as const) for (const reduced of [true, false]) {
      const state = marked === 'wrong' ? E.initial(c) : marked === 'idle' ? E.initial(c) : E.solve(c)
      expect(render(c, state, marked, reduced)).toContain('Word tiles')
    }
  })
  it('changes the picture with a move', () => {
    const c: WCConfig = { task: 'build', frame: 1 }
    expect(render(c, { placed: [null, null, null, null] })).not.toEqual(render(c, { placed: [0, null, null, null] }))
  })
  it('keeps answer words out of the server-rendered card before marking', () => {
    const card = (config: WCConfig, prompt: string) => renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'word-classes', config }, success: { kind: 'scene' } } },
    } as never))).replace(prompt, '')
    const s = card({ task: 'swap', focus: 'noun', item: 1 }, 'Swap it.')
    expect(s).not.toMatch(/a noun here|does the same job and|You swapped/)
    expect(s).not.toMatch(/names a thing/)
  })
  it('is the same card in a literal that View agrees with', () => {
    expect(itemOf({ task: 'swap', focus: 'noun', item: 1 })!.text).toContain('[walk]')
    expect(CLASSES as readonly Cls[]).toHaveLength(7)
  })
})

describe('catalogue matching and prompts', () => {
  it('matches word-class stations and rules out the near misses', () => {
    expect(getEngine('word-classes')).toBe(E)
    expect(E.isolates).toBe('category')
    for (const st of ['Nouns and verbs', 'Parts of speech', 'Adverbs: how, when and where', 'Pronouns and prepositions', 'Expanded noun phrases', 'Conjunctions that join clauses', 'Word classes in a sentence']) {
      expect(sceneCatalogue(st), st).toContain('SCENE "word-classes"')
    }
    expect(scenesFor('Parts of speech').map((e) => e.id)).toContain('word-classes')
    for (const st of ['Punctuation and apostrophes', 'Writing a persuasive speech', 'Spelling patterns', 'Argument writing', 'French verbs', 'Verb tenses', 'Logical conjunction in logic gates', 'Light and shadows', 'Number and place value']) {
      expect(sceneCatalogue(st), st).not.toContain('SCENE "word-classes"')
    }
  })
  it('catches prompts that name the class or a fitting word, or promise another gesture', () => {
    const noun: WCConfig = { task: 'swap', focus: 'noun', item: 1 }
    expect(E.promptFaults!(noun, 'Swap the noun for another noun.').join(' ')).toMatch(/names the class/)
    expect(E.promptFaults!(noun, 'Swap in a naming word.').join(' ')).toMatch(/names the class/)
    expect(E.promptFaults!(noun, 'Try swapping walk for run.').join(' ')).toMatch(/names a word that belongs/)
    expect(E.promptFaults!(noun, 'Drag a tile onto the amber word.').join(' ')).toMatch(/promises something/)
    expect(E.promptFaults!(noun, 'Tap a tile to swap it in. Pick a verb.')).toEqual([])
    expect(E.promptFaults!({ task: 'build', frame: 1 }, 'Fill the sockets with sleepy, tiger, jumped and quietly.').join(' ')).toMatch(/names a tile/)
    expect(E.promptFaults!({ task: 'build', frame: 1 }, 'Tap a socket, then a tile. Fill the nouns and verbs.')).toEqual([])
  })
  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('word-classes')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBe(3)
    for (const m of found) {
      const c = e.parse(JSON.parse(m[2]))!
      expect(e.faults(c)).toEqual([])
      expect(e.promptFaults!(c, m[1])).toEqual([])
      expect(e.check(c, e.initial(c)).ok).toBe(false)
      expect(e.check(c, e.solve(c)).ok).toBe(true)
    }
    expect(e.prompt).toMatch(/"isolates":"category"/)
  })
})
