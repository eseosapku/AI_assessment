// lib/studylab/engines/transformers/transformers.test.ts
import { describe as suite, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  transformersEngine as E, answerTurns, lampVolts, blows, move, fitLamp, canFit, readState, done, captionText, verdictText, goalText, measureOf, EXAMPLES,
  type TransformersConfig, type TransformersState, type Real,
} from './config'
import { TransformersView } from './View'
import { secondaryVolts } from './Picture'
import { getEngine, scenesFor } from '../registry'

vi.spyOn(console, 'error').mockImplementation(() => {})

const [T1, T2, T3, S1] = EXAMPLES.map((e) => e.config) as [Real, Real, Real, Real]

function allConfigs(): TransformersConfig[] {
  const out: TransformersConfig[] = []
  const lamps = [1.5, 3, 4.5, 6, 9, 12, 18, 24, 36]
  for (let supplyVolts = 2; supplyVolts <= 24; supplyVolts++) for (let primaryTurns = 1; primaryTurns <= 12; primaryTurns++) for (const lampRating of lamps) {
    for (let startTurns = 1; startTurns <= 12; startTurns++) out.push({ kind: 'turns', supplyVolts, primaryTurns, lampRating, startTurns })
    out.push({ kind: 'supply', supplyVolts, primaryTurns, lampRating })
  }
  return out.filter((c) => E.faults(c).length === 0)
}

const render = (config: TransformersConfig, state: TransformersState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(TransformersView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

suite('every valid config starts unsolved and solves', () => {
  it('holds for every config', () => {
    const configs = allConfigs()
    expect(configs.length).toBeGreaterThan(500)
    for (const c of configs) {
      const tag = JSON.stringify(c)
      expect(E.check(c, E.initial(c)).ok, `starts solved ${tag}`).toBe(false)
      const s = E.solve(c)
      expect(E.check(c, s).ok, `cannot solve ${tag}`).toBe(true)
      expect(s.blown).toBe(false)
      expect(verdictText(c, s)).toBeTruthy()
    }
  })

  it('agrees with the picture on the lamp voltage', () => {
    for (const c of allConfigs().filter((_, i) => i % 11 === 0)) {
      for (const supply of ['ac', 'dc'] as const) for (const turns of [1, 5, 12]) {
        const r = c as Real
        expect(lampVolts(r, { supply, turns, blown: false })).toBeCloseTo(secondaryVolts({ supply, supplyVolts: r.supplyVolts, primaryTurns: r.primaryTurns, secondaryTurns: turns }), 9)
      }
    }
  })
})

suite('marking and moves', () => {
  it('needs a.c., an unblown lamp and exactly N turns', () => {
    expect(answerTurns(T1)).toBe(3)
    expect(answerTurns(T2)).toBe(6)
    expect(answerTurns(T3)).toBe(4)
    expect(answerTurns(S1)).toBe(8)
    expect(E.check(T1, { supply: 'ac', turns: 3, blown: false }).ok).toBe(true)
    expect(E.check(T1, { supply: 'ac', turns: 2, blown: false }).ok).toBe(false)
    expect(E.check(T1, { supply: 'ac', turns: 4, blown: false }).ok).toBe(false)
    expect(E.check(T1, { supply: 'ac', turns: 3, blown: true }).ok).toBe(false)
    expect(E.check(S1, { supply: 'dc', turns: 8, blown: false }).ok).toBe(false)
    expect(E.check(S1, { supply: 'ac', turns: 8, blown: false }).ok).toBe(true)
    expect(E.check(S1, { supply: 'ac', turns: 7, blown: false }).ok).toBe(false)
    expect(E.check({ kind: 'other', asked: 'x' }, E.initial(T1)).ok).toBe(false)
    expect(done(T1, null)).toBe(false)
  })

  it('blows at twice the rating, stays blown until a new lamp is fitted, and refuses a new lamp while it would blow', () => {
    // 12 V, 6 primary turns: 2 V a turn; lamp 6 V blows at 12 V = 6 turns.
    expect(blows(T1, { supply: 'ac', turns: 5 })).toBe(false)
    expect(blows(T1, { supply: 'ac', turns: 6 })).toBe(true)
    expect(blows(T1, { supply: 'dc', turns: 12 })).toBe(false)
    let s = E.initial(T1)
    s = move(T1, s, { turns: 6 })
    expect(s.blown).toBe(true)
    expect(canFit(T1 as Real, s)).toBe(false)
    expect(fitLamp(T1, s).blown).toBe(true)
    s = move(T1, s, { turns: 3 })
    expect(s.blown).toBe(true)
    expect(canFit(T1, s)).toBe(true)
    expect(fitLamp(T1, s)).toEqual({ supply: 'ac', turns: 3, blown: false })
  })

  it('reads corrupt state as a safe start', () => {
    expect(readState(null)).toEqual({ supply: 'ac', turns: 1, blown: false })
    expect(readState({ supply: 'x' as 'ac', turns: 99, blown: 1 as unknown as boolean })).toEqual({ supply: 'ac', turns: 12, blown: false })
  })
})

suite('reading and refusing configs', () => {
  it('reads broad phrasings', () => {
    expect(E.parse(T1)).toEqual(T1)
    expect(E.parse({ kind: 'turns', supplyVolts: '12 V', primaryTurns: '6 turns', lampRating: '6 V' })).toEqual(T1)
    expect(E.parse({ kind: 'battery' })).toEqual(S1)
    expect(E.parse({ kind: 'winding', volts: 6, np: 2, lamp: 18 })).toEqual(T2)
    expect(E.parse({ lampRating: 6 })).toMatchObject({ kind: 'turns', lampRating: 6 })
    expect(E.parse(null)).toBeNull()
    expect(E.parse({})).toBeNull()
    expect(E.parse('transformer')).toBeNull()
  })

  it('refuses what cannot be drawn, with an example that works', () => {
    const f = (raw: unknown) => E.faults(E.parse(raw)!)
    expect(f({ kind: 'turns', supplyVolts: 12, primaryTurns: 6, lampRating: 5 })[0]).toMatch(/needs 2\.5 secondary turns.*"kind":"turns"/)
    expect(f({ kind: 'turns', supplyVolts: 12, primaryTurns: 6, lampRating: 6 })).toEqual([])
    expect(f({ kind: 'turns', supplyVolts: 12, primaryTurns: 12, lampRating: 11 })[0]).toMatch(/only 1 V/)
    expect(f({ kind: 'turns', supplyVolts: 12, primaryTurns: 6, lampRating: 10 })).toEqual([])
    expect(f({ kind: 'turns', supplyVolts: 12, primaryTurns: 6, lampRating: 6, startTurns: 3 })[0]).toMatch(/nothing to do/)
    expect(f({ kind: 'turns', supplyVolts: 12, primaryTurns: 6, lampRating: 6, startTurns: 6 })[0]).toMatch(/blow the lamp at once/)
    expect(f({ kind: 'supply', supplyVolts: 7 })[0]).toMatch(/3, 6, 9 or 12/)
    expect(f({ kind: 'supply', supplyVolts: 6 })).toEqual([])
    expect(f({ kind: 'turns', supplyVolts: 30 })[0]).toMatch(/2 to 24/)
    expect(f({ kind: 'turns', primaryTurns: 13 })[0]).toMatch(/1 to 12/)
    expect(f({ kind: 'turns', lampRating: 40 })[0]).toMatch(/1\.5 to 36/)
    expect(f({ kind: 'turns', startTurns: 13 })[0]).toMatch(/starts with/)
    expect(f({ kind: 'motor' })[0]).toMatch(/Only two tasks/)
  })
})

suite('prompts', () => {
  it('catches prompts that give the answer away', () => {
    for (const t of ['Wind 3 turns on.', 'Use three secondary turns.', 'Make a step-down transformer.', 'It needs a step up.', 'Use more turns.', 'Use fewer turns.', 'Make it half.', 'Double it.', 'Twice the voltage.', 'Times as many turns.'])
      expect(E.promptFaults!(T1, t).join(' '), t).toMatch(/gives the answer away/)
    for (const t of ['Use the a.c. supply.', 'Connect the power pack.', 'Use alternating current.', 'Use the mains.', 'A changing current is needed.', 'Switch the supply.', 'Use ac instead of the battery.'])
      expect(E.promptFaults!(S1, t).join(' '), t).toMatch(/gives the answer away/)
    expect(E.promptFaults!(T1, 'The primary has 6 turns.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('transformers')!
    expect(e).toBe(E)
    expect(EXAMPLES).toHaveLength(4)
    for (const { prompt, config } of EXAMPLES) {
      expect(e.prompt).toContain(JSON.stringify(config))
      expect(e.prompt).toContain(prompt)
      const parsed = e.parse(JSON.parse(JSON.stringify(config)))!
      expect(parsed).toEqual(config)
      expect(e.faults(parsed), prompt).toEqual([])
      expect(e.promptFaults!(parsed, prompt), prompt).toEqual([])
      expect(e.check(parsed, e.initial(parsed)).ok).toBe(false)
      expect(e.check(parsed, e.solve(parsed)).ok).toBe(true)
    }
    expect([...e.prompt.matchAll(/"isolates":"(\w+)"/g)].map((m) => m[1])).toEqual(['quantity'])
    expect(e.isolates).toBe('quantity')
  })
})

suite('the words on the card', () => {
  it('says each state as an observation', () => {
    const s = (supply: 'ac' | 'dc', turns: number, blown = false): TransformersState => ({ supply, turns, blown })
    expect(goalText(T1)).toBe('Light the 6 V lamp at its proper brightness')
    expect(goalText(S1)).toBe('Make the 12 V lamp light')
    expect(measureOf(T1, s('ac', 2))).toEqual({ label: 'Lamp voltage', value: '4 V' })
    expect(measureOf(S1, s('dc', 8)).value).toBe('0 V')
    expect(captionText(T1, s('ac', 1))).toMatch(/gets 2 V, less than the 6 V.*dimly/)
    expect(captionText(T1, s('ac', 3))).toBe('The lamp gets 6 V.')
    expect(captionText(T1, s('ac', 4))).toMatch(/more than the 6 V.*glares/)
    expect(captionText(T1, s('ac', 6, true))).toMatch(/burnt through/)
    expect(captionText(S1, s('dc', 8))).toMatch(/steady.*dark/)
    expect(captionText(S1, s('ac', 8))).toMatch(/keeps reversing/)
  })

  it('gives the verdicts from the design', () => {
    expect(verdictText(T1, { supply: 'ac', turns: 3, blown: false })).toMatch(/3 turns to the primary's 6.*half of 12 V: 6 V.*step-down.*power in equals power out/)
    expect(verdictText(T2, { supply: 'ac', turns: 6, blown: false })).toMatch(/step-up/)
    expect(verdictText(T1, { supply: 'ac', turns: 2, blown: false })).toBe('Each turn adds 2 V. With 2 turns the lamp got 4 V and it is made for 6 V.')
    expect(verdictText(T1, { supply: 'ac', turns: 3, blown: true })).toMatch(/blew when it got twice the 6 V/)
    expect(verdictText(S1, { supply: 'ac', turns: 8, blown: false })).toMatch(/changing current makes a changing field/)
    expect(verdictText(S1, { supply: 'dc', turns: 11, blown: false })).toMatch(/steady.*however many turns/)
    expect(verdictText(S1, { supply: 'ac', turns: 7, blown: false })).toMatch(/Each turn adds 1\.5 V/)
  })
})

suite('catalogue matching', () => {
  it('is offered for transformers, not for transformations', () => {
    for (const st of ['Transformers', 'Step-up and step-down transformers', 'The transformer equation', 'Turns ratio', 'Primary and secondary coils']) expect(scenesFor(st).map((e) => e.id), st).toContain('transformers')
    for (const st of ['Geometric transformations', 'Energy transformations', 'Transformations of shapes', 'Electric motors']) expect(scenesFor(st).map((e) => e.id), st).not.toContain('transformers')
  })
})

suite('the card', () => {
  it('renders every task with no answer before marking, on the server', () => {
    for (const config of allConfigs().filter((_, i) => i % 97 === 0)) {
      const html = render(config, E.initial(config))
      expect(html).toContain('Goal')
      expect(html).toContain(goalText(config))
      expect(html).toContain('Lamp voltage')
      expect(html).not.toMatch(/data-done/)
      expect(html).toContain('aria-label="Wind one more turn onto the secondary coil"')
      expect(html).toContain('aria-label="Unwind one turn from the secondary coil"')
      expect(html.includes('Connect the battery')).toBe(config.kind === 'supply')
      expect(html).not.toContain('Fit a new lamp')
    }
  })

  it('does not tell the answer in the screen-reader text, even when solved, before marking', () => {
    for (const config of allConfigs().filter((_, i) => i % 61 === 0)) {
      for (const state of [E.initial(config), E.solve(config)]) {
        const words = render(config, state).replace(/ class="[^"]*"/g, '').replace(/<style>[\s\S]*?<\/style>/g, '')
        expect(words).not.toMatch(/\b(?:correct|incorrect|wrong|right|solved|well done)\b/i)
        expect(words).not.toMatch(/step-up|step-down|power in equals|however many turns|changing current/)
      }
    }
  })

  it('disables the buttons at the ends, on the pressed supply, and after marking', () => {
    expect(render(T1, { supply: 'ac', turns: 1, blown: false })).toMatch(/aria-label="Unwind one turn from the secondary coil" disabled=""|disabled="" class="[^"]*"[^>]*>−|Unwind[^>]*disabled/)
    const supplyHtml = render(S1, E.initial(S1))
    expect(supplyHtml).toMatch(/aria-pressed="true" aria-label="Connect the battery to the primary coil" disabled=""/)
    const blown = render(T1, { supply: 'ac', turns: 6, blown: true })
    expect(blown).toContain('Fit a new lamp')
    expect(blown).toMatch(/aria-label="Fit a new lamp" disabled=""/)
    const right = render(T1, E.solve(T1), 'right')
    expect(right).toContain('data-done="1"')
    expect((right.match(/disabled=""/g) ?? []).length).toBe(2)
    const wrong = render(T1, { supply: 'ac', turns: 2, blown: false }, 'wrong')
    expect(wrong).toContain('data-done="0"')
    expect(wrong).toContain('Each turn adds 2 V')
    expect(render(T1, E.initial(T1), 'shown')).toContain('data-done="1"')
  })

  it('renders with reduced motion', () => {
    expect(render(S1, E.initial(S1), 'idle', true)).toContain('Lamp voltage')
  })
})
