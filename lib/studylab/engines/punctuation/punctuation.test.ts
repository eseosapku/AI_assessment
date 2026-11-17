// lib/studylab/engines/punctuation/punctuation.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  punctuationEngine, PASSAGES, MARK_NAME, MARK_TEXT, passageOf, slotsOf, sentenceText, meaningText,
  type PunctConfig, type PunctState,
} from './config'
import { PunctuationView, W, H } from './View'
import { getEngine, scenesFor, sceneCatalogue } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const config = (id: string): PunctConfig => punctuationEngine.parse({ task: 'punctuate', passage: id })!
const view = (c: PunctConfig, s: PunctState, marked: 'idle' | 'right' | 'wrong' | 'shown') =>
  renderToStaticMarkup(createElement(PunctuationView, { config: c, state: s, setState: () => {}, marked, reduced: true, locked: marked === 'right' }))

describe('the hand-checked punctuation passages', () => {
  it('has a drawable answer and an unsolved start for every one', () => {
    for (const p of PASSAGES) {
      expect(p.parts, p.id).toHaveLength(p.target.length + 1)
      expect(p.start, p.id).toHaveLength(p.target.length)
      expect(new Set(p.marks).size, p.id).toBe(p.marks.length)
      for (const m of p.target) if (m) expect(p.marks, p.id).toContain(m)
      for (const m of p.start) if (m) expect(p.marks, p.id).toContain(m)
      expect(sentenceText(config(p.id), { slots: p.target })).not.toContain('[gap]')
      expect(sentenceText(config(p.id), { slots: p.start })).not.toBe(sentenceText(config(p.id), { slots: p.target }))
      expect(meaningText(config(p.id), { slots: p.start })).not.toBe(meaningText(config(p.id), { slots: p.target }))
    }
  })

  it('knows the exact sentence each answer makes', () => {
    expect(sentenceText(config('grandma'), punctuationEngine.solve(config('grandma')))).toBe('Let’s eat, Grandma.')
    expect(sentenceText(config('packing'), punctuationEngine.solve(config('packing')))).toBe('I packed socks, sandwiches, fruit and a torch.')
    expect(sentenceText(config('brother'), punctuationEngine.solve(config('brother')))).toBe('My brother, who lives in Leeds, is visiting.')
    expect(sentenceText(config('one-dog'), punctuationEngine.solve(config('one-dog')))).toBe('The dog’s bone is buried here.')
    expect(sentenceText(config('two-dogs'), punctuationEngine.solve(config('two-dogs')))).toBe('The dogs’ bones are buried here.')
    expect(sentenceText(config('raining'), punctuationEngine.solve(config('raining')))).toBe('It’s raining outside.')
    expect(sentenceText(config('its-tail'), punctuationEngine.solve(config('its-tail')))).toBe('The dog wagged its tail.')
    expect(sentenceText(config('speech'), punctuationEngine.solve(config('speech')))).toBe('Maya said, ‘Where is my book?’')
    expect(sentenceText(config('boundary'), punctuationEngine.solve(config('boundary')))).toBe('The rain stopped. We went outside.')
  })

  it('marks every slot by rule and identifies the wrong slots', () => {
    for (const p of PASSAGES) {
      const c = config(p.id)
      const wrong = punctuationEngine.solve(c)
      wrong.slots[0] = p.target[0] === null ? 'apostrophe' : null
      expect(punctuationEngine.check(c, wrong).ok).toBe(false)
      expect(punctuationEngine.check(c, wrong).wrongIds).toContain('0')
    }
    expect(punctuationEngine.check(config('grandma'), { slots: ['apostrophe'] }).ok).toBe(false)
    expect(punctuationEngine.check(config('speech'), { slots: ['comma', 'openQuote', 'question', 'closeQuote'] }).ok).toBe(true)
    expect(punctuationEngine.check(config('speech'), { slots: ['comma', 'closeQuote', 'question', 'openQuote'] }).wrongIds).toEqual(['1', '3'])
  })

  it('reads stored work safely', () => {
    expect(slotsOf(config('grandma'), {} as PunctState)).toEqual([null])
    expect(slotsOf(config('grandma'), { slots: ['fullStop', 'comma'] })).toEqual([null])
    expect(punctuationEngine.check(config('its-tail'), {} as PunctState).ok).toBe(true)
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('starts unsolved, solves, and renders the change without any verdict', () => {
    for (const p of PASSAGES) {
      const c = config(p.id)
      const initial = punctuationEngine.initial(c)
      expect(punctuationEngine.check(c, initial).ok, p.id).toBe(false)
      expect(punctuationEngine.check(c, punctuationEngine.solve(c)), p.id).toEqual({ ok: true, wrongIds: [] })
      expect(punctuationEngine.faults(c), p.id).toEqual([])
      const before = view(c, initial, 'idle')
      const after = view(c, punctuationEngine.solve(c), 'idle')
      expect(before, p.id).not.toBe(after)
      expect(before, p.id).toContain(`data-scene="${p.scene}"`)
      expect(before, p.id).toContain('Drag a mark into a gap')
      expect(before, p.id).not.toContain('Yes.')
      expect(after, p.id).not.toContain('Yes.')
    }
  })
})

describe('reading the tutor config', () => {
  it('reads ids, names, numbers and broad topic wording', () => {
    expect(punctuationEngine.parse('commas in lists')).toEqual({ task: 'punctuate', passage: 'packing' })
    expect(punctuationEngine.parse({ passage: 'direct speech' })).toEqual({ task: 'punctuate', passage: 'speech' })
    expect(punctuationEngine.parse({ task: 'apostrophes for possession' })).toEqual({ task: 'punctuate', passage: 'one-dog' })
    expect(punctuationEngine.parse({ task: { kind: 'comma splice' } })).toEqual({ task: 'punctuate', passage: 'boundary' })
    expect(punctuationEngine.parse({ task: 'punctuate', passage: 'one-dog' })).toEqual({ task: 'punctuate', passage: 'one-dog' })
    expect(punctuationEngine.parse({ task: 'punctuation' })).toEqual({ task: 'punctuate', passage: 'grandma' })
    expect(punctuationEngine.parse({ item: 2 })).toEqual({ task: 'punctuate', passage: 'packing' })
    expect(punctuationEngine.parse({})).toEqual({ task: 'punctuate', passage: 'grandma' })
    expect(punctuationEngine.parse({ passage: {} })).toBeNull()
    expect(punctuationEngine.parse(null)).toBeNull()
  })

  it('refuses unknown passages with a working alternative', () => {
    const c = config('a sentence I invented')
    expect(punctuationEngine.faults(c).join(' ')).toContain('no hand-checked passage')
    expect(punctuationEngine.faults(c).join(' ')).toContain('"passage":"grandma"')
    expect(punctuationEngine.faults(c).join(' ')).toContain('two-dogs')
    expect(passageOf(c).id).toBe('grandma')
  })

  it('catches prompts that print or locate the answer, but allows the gesture', () => {
    expect(punctuationEngine.promptFaults!(config('grandma'), 'Put the comma after eat.')).toHaveLength(1)
    expect(punctuationEngine.promptFaults!(config('grandma'), PASSAGES[0].prompt)).toEqual([])
    expect(punctuationEngine.promptFaults!(config('asking'), 'Use a question mark at the end.')).toHaveLength(1)
    expect(punctuationEngine.promptFaults!(config('its-tail'), 'Its needs no apostrophe.')).toHaveLength(1)
    expect(punctuationEngine.promptFaults!(config('its-tail'), passageOf(config('its-tail')).prompt)).toEqual([])
    expect(punctuationEngine.promptFaults!(config('two-dogs'), 'Write dogs’ in the sentence.')).toHaveLength(1)
    expect(punctuationEngine.promptFaults!(config('speech'), PASSAGES.find((p) => p.id === 'speech')!.prompt)).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('punctuation')!
    const found = [...e.prompt.matchAll(/"prompt":"([^"]+)"[\s\S]*?"config": (\{[\s\S]*?\}) \}/g)]
    expect(found.length).toBeGreaterThanOrEqual(4)
    for (const m of found) expect(e.promptFaults!(e.parse(JSON.parse(m[2]))!, m[1])).toEqual([])
  })
})

describe('the catalogue and its neighbours', () => {
  it('registers punctuation, position and the same isolates in its examples', () => {
    expect(getEngine('punctuation')).toBe(punctuationEngine)
    expect(punctuationEngine.isolates).toBe('position')
    expect(punctuationEngine.prompt).toContain('SCENE "punctuation"')
    expect(punctuationEngine.prompt).toContain('"apparatus":"scene:punctuation"')
    expect(punctuationEngine.prompt).toContain('"isolates":"position"')
  })

  it('catches punctuation stations and leaves grammar, spelling and argument to theirs', () => {
    expect(scenesFor('Apostrophes for possession').map((e) => e.id)).toContain('punctuation')
    expect(scenesFor('Direct speech and inverted commas').map((e) => e.id)).toContain('punctuation')
    expect(sceneCatalogue('Using commas in lists')).toContain('SCENE "punctuation"')
    expect(scenesFor('Argument and persuasive writing').map((e) => e.id)).not.toContain('punctuation')
    expect(scenesFor('Nouns, verbs and adjectives').map((e) => e.id)).not.toContain('punctuation')
    expect(scenesFor('Spelling patterns').map((e) => e.id)).not.toContain('punctuation')
    expect(scenesFor('Punctuated equilibrium').map((e) => e.id)).not.toContain('punctuation')
  })
})

describe('the drawing and accessible controls', () => {
  it('keeps the scene compact and the view constants independent of config constants', () => {
    expect(W).toBe(360)
    expect(H).toBe(158)
    const c = config('speech')
    const html = view(c, punctuationEngine.initial(c), 'idle')
    expect(html.match(/data-slot=/g)).toHaveLength(4)
    expect(html).toContain('aria-label="comma tile"')
    expect(html).toContain('aria-label="opening speech mark tile"')
    expect(html).toContain('touch-none')
    expect(html).toContain('Maya’s exact words')
  })

  it('shows the observable before marking and explains only afterwards', () => {
    const c = config('grandma')
    const before = view(c, punctuationEngine.initial(c), 'idle')
    expect(before).toContain('Grandma is on the serving dish')
    expect(before).not.toContain('serving dish. She sounds like the food.</span><br /><span class="font-semibold">Grandma has a bowl')
    expect(before).not.toContain('The comma shows that Grandma is being spoken to')
    const wrong = view(c, punctuationEngine.initial(c), 'wrong')
    expect(wrong).toContain('You wrote')
    const right = view(c, punctuationEngine.solve(c), 'right')
    expect(right).toContain('The comma shows that Grandma is being spoken to')
  })

  it('never prints the answer before marking, through ActivityNode', () => {
    for (const id of ['grandma', 'packing', 'brother', 'one-dog', 'two-dogs', 'raining', 'speech', 'asking', 'boundary']) {
      const c = config(id)
      const prompt = passageOf(c).prompt
      const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
        id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'punctuation', config: c }, success: { kind: 'scene' } } },
      } as never))).replace(prompt, '')
      expect(html, id).not.toContain(sentenceText(c, punctuationEngine.solve(c)))
      expect(html, id).not.toContain('Yes.')
    }
  })

  it('does not change the observable just because a tile is picked up', () => {
    const c = config('packing')
    const plain = view(c, { slots: [null, null], held: null }, 'idle')
    const held = view(c, { slots: [null, null], held: 'comma' }, 'idle')
    expect(held).toContain('The foods are bunched together in the list.')
    expect(plain).toContain('The foods are bunched together in the list.')
  })

  it('changes a sentence to two complete thoughts only when the boundary changes', () => {
    const c = config('boundary')
    expect(sentenceText(c, punctuationEngine.initial(c))).toBe('The rain stopped, we went outside.')
    expect(sentenceText(c, punctuationEngine.solve(c))).toBe('The rain stopped. We went outside.')
    expect(view(c, punctuationEngine.initial(c), 'idle')).toContain('data-scene-state="joined"')
    expect(view(c, punctuationEngine.solve(c), 'idle')).toContain('data-scene-state="separate"')
  })

  it('keeps rain present for both the full and shortened contraction', () => {
    const c = config('raining')
    expect(view(c, punctuationEngine.initial(c), 'idle')).toContain('data-scene-state="two-words"')
    expect(view(c, punctuationEngine.solve(c), 'idle')).toContain('data-scene-state="shortened"')
  })

  it('uses the same glyph and name for every mark', () => {
    expect(MARK_TEXT.question).toBe('?')
    expect(MARK_NAME.openQuote).toBe('opening speech mark')
    expect(MARK_NAME.closeQuote).toBe('closing speech mark')
  })
})
