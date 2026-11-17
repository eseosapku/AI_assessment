// lib/studylab/engines/encryption/encryption.test.ts
import { describe as suite, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { encryptionEngine as E, shift, EXAMPLES, captionText, goalText, measureOf, verdictText, describe, readingOf, done, type EncryptionConfig, type EncryptionState } from './config'
import { EncryptionView } from './View'

vi.spyOn(console, 'error').mockImplementation(() => {})

const PLAINS = ['MEET AT TEN', 'BRING CAKE', 'GO AT NOON', 'ABC', 'HELLO', 'ZEBRA XY']

function allConfigs(): EncryptionConfig[] {
  const out: EncryptionConfig[] = []
  for (const plain of PLAINS) for (let key = 1; key <= 25; key++) for (const kind of ['lock', 'crack', 'share'] as const) out.push({ kind, plain, key })
  return out
}

const render = (config: EncryptionConfig, state: EncryptionState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(EncryptionView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

suite('the cipher', () => {
  it('shifts, wraps and keeps spaces', () => {
    expect(shift('MEET AT TEN', 3)).toBe('PHHW DW WHQ')
    expect(shift('XYZ', 3)).toBe('ABC')
    expect(shift('ABC', -1)).toBe('ZAB')
    expect(shift(shift('GO AT NOON', 11), -11)).toBe('GO AT NOON')
  })
})

suite('every valid config starts unsolved and solves', () => {
  it('holds for every config', () => {
    const configs = allConfigs()
    expect(configs.length).toBeGreaterThan(400)
    for (const c of configs) {
      const tag = JSON.stringify(c)
      expect(E.faults(c), tag).toEqual([])
      expect(E.check(c, E.initial(c)).ok, `starts solved ${tag}`).toBe(false)
      expect(E.check(c, E.solve(c)).ok, `cannot solve ${tag}`).toBe(true)
    }
  })

  it('marks by the rules', () => {
    const lock: EncryptionConfig = { kind: 'lock', plain: 'MEET AT TEN', key: 3 }
    const st = (p: Partial<EncryptionState>): EncryptionState => ({ ...E.initial(lock), ...p })
    expect(done(lock, st({ turn: 3, sent: false }))).toBe(false)
    expect(done(lock, st({ turn: 4, sent: true }))).toBe(false)
    expect(done(lock, st({ turn: 3, sent: true }))).toBe(true)
    const share: EncryptionConfig = { kind: 'share', plain: 'MEET AT TEN', key: 7 }
    expect(done(share, { ...E.initial(share), keyTrip: 'bare' })).toBe(false)
    expect(done(share, { ...E.initial(share), keyTrip: 'boxed' })).toBe(true)
    const crack: EncryptionConfig = { kind: 'crack', plain: 'GO AT NOON', key: 7 }
    expect(done(crack, { ...E.initial(crack), turn: 6 })).toBe(false)
    expect(readingOf(crack, { ...E.initial(crack), turn: 7 })).toBe('GO AT NOON')
  })
})

suite('what the engine refuses', () => {
  const bad = (c: unknown) => {
    const cfg = E.parse(c)
    return cfg ? E.faults(cfg) : ['unparsed']
  }
  it('refuses what cannot be drawn', () => {
    for (const c of [
      { kind: 'lock', plain: 'meet at ten', key: 3 },
      { kind: 'lock', plain: 'MEET AT 10!', key: 3 },
      { kind: 'lock', plain: 'MEET ME AT TEN', key: 3 },
      { kind: 'lock', plain: ' MEET  AT', key: 3 },
      { kind: 'lock', plain: 'AAA', key: 3 },
      { kind: 'lock', plain: 'MEET AT TEN', key: 0 },
      { kind: 'lock', plain: 'MEET AT TEN', key: 26 },
      { kind: 'lock', plain: 'MEET AT TEN', key: -2 },
      { kind: 'lock', plain: 'MEET AT TEN', key: 2.5 },
      { kind: 'wobble', plain: 'MEET AT TEN', key: 3 },
    ]) expect(bad(c).length, JSON.stringify(c)).toBeGreaterThan(0)
  })
  it('reads broadly and fills defaults', () => {
    expect(E.parse({ kind: 'lock' })).toEqual({ kind: 'lock', plain: 'MEET AT TEN', key: 3 })
    expect(E.parse({ task: 'Crack', message: 'HELLO', shift: '4' })).toEqual({ kind: 'crack', plain: 'HELLO', key: 4 })
    expect(E.parse({ kind: 'share' })).toEqual({ kind: 'share', plain: 'MEET AT TEN', key: 7 })
    expect(E.parse(null)).toBeNull()
  })
})

suite('prompts', () => {
  it('passes every catalogue example', () => {
    for (const e of EXAMPLES) {
      expect(E.faults(e.config), e.prompt).toEqual([])
      expect(E.promptFaults!(e.config, e.prompt), e.prompt).toEqual([])
      expect(E.check(e.config, E.initial(e.config)).ok).toBe(false)
      expect(E.check(e.config, E.solve(e.config)).ok).toBe(true)
      expect(E.parse(e.config)).toEqual(e.config)
    }
  })
  it('catches answer-giving prompts', () => {
    const lock: EncryptionConfig = { kind: 'lock', plain: 'MEET AT TEN', key: 3 }
    const crack: EncryptionConfig = { kind: 'crack', plain: 'GO AT NOON', key: 7 }
    const share: EncryptionConfig = { kind: 'share', plain: 'MEET AT TEN', key: 7 }
    expect(E.promptFaults!(lock, 'Lock your note and send it.').length).toBe(1)
    expect(E.promptFaults!(lock, 'Key 3: send PHHW DW WHQ.').length).toBeGreaterThan(0)
    expect(E.promptFaults!(crack, 'Eve caught a note about NOON.').length).toBe(1)
    expect(E.promptFaults!(crack, 'The key is seven.').length).toBe(1)
    expect(E.promptFaults!(crack, 'The key is 7.').length).toBe(1)
    expect(E.promptFaults!(share, 'Send the key in a padlock box.').length).toBe(1)
    expect(E.promptFaults!(share, 'Pick the right way.').length).toBe(1)
  })
  it('isolates consequence', () => {
    expect(E.isolates).toBe('consequence')
    expect(E.prompt).toContain('"encryption"')
  })
})

suite('nothing says right or wrong before marking', () => {
  it('draws no verdict and no answer while idle', () => {
    for (const e of EXAMPLES) {
      const html = render(e.config, E.initial(e.config))
      expect(html).not.toContain('data-done')
      expect(html.replace(/<style>[^<]*<\/style>/g, ' ').replace(/<[^>]*>/g, ' ')).not.toMatch(/\b(right|wrong|correct)\b/i)
      const s = E.initial(e.config)
      if (e.config.kind === 'crack') {
        for (const text of [captionText(e.config, s), describe(e.config, s), goalText(e.config)]) {
          expect(text).not.toContain(e.config.plain)
        }
      }
      expect(measureOf(e.config, s).length).toBeGreaterThan(0)
    }
  })
  it('draws the verdict once marked', () => {
    for (const e of EXAMPLES) {
      const solved = E.solve(e.config)
      expect(render(e.config, solved, 'right')).toContain('data-done="1"')
      expect(render(e.config, solved, 'shown')).toContain('data-done')
      expect(render(e.config, E.initial(e.config), 'wrong')).toContain('data-done="0"')
      expect(verdictText(e.config, solved).length).toBeGreaterThan(0)
    }
  })
  it('refuses to draw a config it cannot', () => {
    const c = { kind: 'lock', plain: 'x', key: 0 } as EncryptionConfig
    expect(render(c, E.initial(c))).toBe('')
  })
})
