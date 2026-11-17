// lib/studylab/engines/rusting/rusting.test.ts
import { describe as suite, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  rustingEngine as E, rustAt, readState, reasonOf, goalText, readoutText, captionText, verdictText, EXAMPLES, DEFAULT_OPTIONS, PROTECTIONS,
  type RustConfig, type RustState, type Protection,
} from './config'
import { RustingView } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'

vi.spyOn(console, 'error').mockImplementation(() => {})

const needs = (goal: string, salt?: boolean): RustConfig => ({ kind: 'needs', goal, ...(salt ? { salt } : {}) })
const protect = (goal: string, options?: string[]): RustConfig => ({ kind: 'protect', goal, ...(options ? { options } : {}) })
const st = (o: Partial<RustState>): RustState => ({ water: 'tap', air: 'in', protection: 'none', scratched: false, left: true, ...o })

function subsets(): string[][] {
  const out: string[][] = []
  const rec = (start: number, cur: Protection[]) => {
    if (cur.length >= 2) out.push([...cur])
    if (cur.length === 4) return
    for (let i = start; i < PROTECTIONS.length; i++) rec(i + 1, [...cur, PROTECTIONS[i]])
  }
  rec(0, [])
  return out
}

function allConfigs(): RustConfig[] {
  const out: RustConfig[] = [needs('rust'), needs('shinyWet'), needs('shinyAir'), needs('rustMost', true), needs('rust', true), needs('shinyWet', true)]
  for (const goal of ['scratchProof', 'untilScratched', 'keepShiny']) {
    out.push(protect(goal))
    for (const o of subsets()) out.push(protect(goal, o))
  }
  return out.filter((c) => E.faults(c).length === 0)
}

const render = (config: RustConfig, state: RustState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(RustingView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

suite('the rule', () => {
  it('rusts only where water and air reach bare iron', () => {
    expect(rustAt(st({}))).toBe('everywhere')
    expect(rustAt(st({ water: 'salt' }))).toBe('everywhere')
    expect(rustAt(st({ water: 'none' }))).toBe('nowhere')
    expect(rustAt(st({ air: 'out' }))).toBe('nowhere')
    expect(rustAt(st({ protection: 'paint' }))).toBe('nowhere')
    expect(rustAt(st({ protection: 'grease', scratched: true }))).toBe('scratch')
    expect(rustAt(st({ protection: 'zinc', scratched: true }))).toBe('nowhere')
    expect(rustAt(st({ protection: 'magnesium', scratched: true }))).toBe('nowhere')
    expect(rustAt(st({ protection: 'paint', scratched: true, air: 'out' }))).toBe('nowhere')
  })
})

suite('every valid config starts unsolved and solves', () => {
  it('holds for every config', () => {
    const configs = allConfigs()
    expect(configs.length).toBeGreaterThan(40)
    for (const c of configs) {
      const tag = JSON.stringify(c)
      expect(E.check(c, E.initial(c)).ok, `starts solved ${tag}`).toBe(false)
      const s = E.solve(c)
      expect(E.check(c, s).ok, `cannot solve ${tag}`).toBe(true)
      expect(s.left).toBe(true)
      expect(verdictText(c, s)).toBeTruthy()
    }
  })

  it('is never passed before the week is left', () => {
    for (const c of allConfigs()) {
      expect(E.check(c, { ...E.solve(c), left: false }).ok).toBe(false)
      expect(reasonOf(c, { ...E.solve(c), left: false })).toBe('not-left')
    }
  })

  it('marks each goal as designed', () => {
    expect(E.check(needs('rust'), st({})).ok).toBe(true)
    expect(E.check(needs('rust'), st({ water: 'none' })).ok).toBe(false)
    expect(E.check(needs('shinyWet'), st({ air: 'out' })).ok).toBe(true)
    expect(E.check(needs('shinyWet'), st({ water: 'none', air: 'out' })).ok).toBe(false)
    expect(E.check(needs('shinyAir'), st({ water: 'none' })).ok).toBe(true)
    expect(E.check(needs('shinyAir'), st({})).ok).toBe(false)
    expect(E.check(needs('rustMost', true), st({ water: 'salt' })).ok).toBe(true)
    expect(E.check(needs('rustMost', true), st({})).ok).toBe(false)
    const sp = protect('scratchProof')
    expect(E.check(sp, st({ protection: 'zinc', scratched: true })).ok).toBe(true)
    expect(E.check(sp, st({ protection: 'magnesium', scratched: true })).ok).toBe(true)
    expect(E.check(sp, st({ protection: 'paint', scratched: true })).ok).toBe(false)
    expect(reasonOf(sp, st({ protection: 'zinc' }))).toBe('not-scratched')
    const us = protect('untilScratched')
    expect(E.check(us, st({ protection: 'paint', scratched: true })).ok).toBe(true)
    expect(reasonOf(us, st({ protection: 'paint' }))).toBe('not-scratched')
    expect(E.check(us, st({ protection: 'zinc', scratched: true })).ok).toBe(false)
    expect(E.check(us, st({ protection: 'none', scratched: true })).ok).toBe(false)
    const ks = protect('keepShiny')
    expect(E.check(ks, st({ protection: 'paint' })).ok).toBe(true)
    expect(E.check(ks, st({ protection: 'paint', scratched: true })).ok).toBe(false)
    expect(E.check(ks, st({ protection: 'none' })).ok).toBe(false)
    expect(E.solve(protect('keepShiny', ['none', 'paint'])).protection).toBe('paint')
  })

  it('reads corrupt stored work as a fresh nail and never accepts it', () => {
    expect(readState(null)).toEqual({ water: 'tap', air: 'in', protection: 'none', scratched: false, left: false })
    expect(readState({ water: 'lava', protection: 'gold', left: 'yes' } as unknown as RustState).left).toBe(false)
    expect(E.check(needs('rust'), {} as RustState).ok).toBe(false)
  })
})

suite('reading and refusing configs', () => {
  it('reads broad phrasings', () => {
    expect(E.parse({ kind: 'needs', goal: 'rust' })).toEqual(needs('rust'))
    expect(E.parse({ goal: 'rustMost', salt: true })).toEqual(needs('rustMost', true))
    expect(E.parse({ kind: 'Protection', goal: 'scratch-proof', options: ['Nothing', 'galvanised', 'Mg'] })).toEqual(protect('scratchProof', ['none', 'zinc', 'magnesium']))
    expect(E.parse({ goal: 'keepShiny' })).toEqual(protect('keepShiny'))
    expect(E.parse(null)).toBeNull()
    expect(E.parse('rust')).toBeNull()
    expect(E.parse({})).toBeNull()
  })

  it('refuses what cannot be drawn, with an example that works', () => {
    const f = (raw: unknown) => E.faults(E.parse(raw)!)
    expect(f({ kind: 'needs', goal: 'rust' })).toEqual([])
    expect(f({ kind: 'needs', goal: 'rustMost' })[0]).toMatch(/"salt":true/)
    expect(f({ kind: 'needs', goal: 'rustMost', salt: true })).toEqual([])
    expect(f({ kind: 'needs', goal: 'banana' })[0]).toMatch(/rust, shinyWet/)
    expect(f({ kind: 'springs' })[0]).toMatch(/Only two tasks/)
    expect(f({ kind: 'protect', goal: 'scratchProof', options: ['none'] })[0]).toMatch(/two to four/)
    expect(f({ kind: 'protect', goal: 'scratchProof', options: ['none', 'none'] })[0]).toMatch(/two to four/)
    expect(f({ kind: 'protect', goal: 'scratchProof', options: ['none', 'gold'] })[0]).toMatch(/two to four/)
    expect(f({ kind: 'protect', goal: 'scratchProof', options: ['none', 'paint', 'grease', 'zinc', 'magnesium'] })[0]).toMatch(/two to four/)
    expect(f({ kind: 'protect', goal: 'scratchProof', options: ['none', 'paint'] })[0]).toMatch(/zinc/)
    expect(f({ kind: 'protect', goal: 'scratchProof', options: ['zinc', 'magnesium'] })[0]).toMatch(/nothing to choose/)
    expect(f({ kind: 'protect', goal: 'scratchProof', options: ['zinc', 'paint'] })).toEqual([])
    expect(f({ kind: 'protect', goal: 'untilScratched', options: ['none', 'zinc'] })[0]).toMatch(/paint/)
    expect(f({ kind: 'protect', goal: 'untilScratched', options: ['paint', 'grease'] })[0]).toMatch(/barrier/)
    expect(f({ kind: 'protect', goal: 'untilScratched', options: ['paint', 'zinc'] })).toEqual([])
    expect(f({ kind: 'protect', goal: 'keepShiny', options: ['zinc', 'magnesium'] })[0]).toMatch(/add "paint"/)
    expect(f({ kind: 'protect', goal: 'keepShiny', options: ['zinc', 'paint'] })).toEqual([])
    expect(E.check({ kind: 'other', asked: 'x' }, E.initial(needs('rust'))).ok).toBe(false)
  })
})

suite('prompts', () => {
  it('catches prompts that give the answer away', () => {
    const bad: [RustConfig, string][] = [
      [needs('rust'), 'Put the nail in water and air.'], [needs('rust'), 'Use tap water.'], [needs('rust'), 'Keep it open to the air.'], [needs('rust'), 'It needs oxygen and water.'],
      [needs('shinyWet'), 'Float oil on the water.'], [needs('shinyWet'), 'Use boiled water.'], [needs('shinyWet'), 'Keep the air away: no air.'], [needs('shinyWet'), 'Leave the air out.'],
      [needs('shinyAir'), 'Use a drying agent.'], [needs('shinyAir'), 'Leave it with no water.'], [needs('shinyAir'), 'Put in the stopper.'],
      [needs('rustMost', true), 'Use salt water.'], [needs('rustMost', true), 'Think of the sea.'],
      [protect('scratchProof'), 'Try zinc.'], [protect('scratchProof'), 'Use a more reactive metal.'], [protect('scratchProof'), 'Think of galvanising.'], [protect('scratchProof'), 'A sacrificial metal.'],
      [protect('untilScratched'), 'Use paint.'], [protect('untilScratched'), 'A grease coat.'], [protect('untilScratched'), 'A barrier.'],
    ]
    for (const [c, t] of bad) expect(E.promptFaults!(c, t).join(' '), t).toMatch(/gives the answer away/)
    expect(E.promptFaults!(needs('rust'), 'Set up a tube where the nail rusts.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('rusting')!
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
    expect([...e.prompt.matchAll(/"isolates":"(\w+)"/g)].map((m) => m[1])).toEqual(['consequence'])
    expect(e.isolates).toBe('consequence')
  })
})

suite('the words on the card', () => {
  it('shows the readout and captions from the design, and the verdicts', () => {
    expect(goalText(needs('rust'))).toBe('Make the nail rust')
    expect(readoutText({ ...E.initial(needs('rust')) }, 0)).toBe('Not left yet')
    expect(readoutText(st({}), 0)).toBe('None yet')
    expect(readoutText(st({}), 3)).toBe('Spots')
    expect(readoutText(st({}), 7)).toBe('All over')
    expect(readoutText(st({ protection: 'paint', scratched: true }), 7)).toBe('At the scratch')
    expect(readoutText(st({ air: 'out' }), 7)).toBe('None')
    expect(captionText(needs('rust'), E.initial(needs('rust')), 0)).toMatch(/drying agent/)
    expect(captionText(needs('rust'), st({ left: false }), 0)).toMatch(/open to the air/)
    expect(captionText(needs('shinyWet'), st({ left: false, air: 'out' }), 0)).toMatch(/boiling drove out/)
    expect(captionText(needs('rust'), st({}), 7)).toMatch(/rust all over.*flakes/)
    expect(captionText(protect('scratchProof'), st({ protection: 'zinc', scratched: true }), 7)).toMatch(/turned white/)
    expect(captionText(protect('scratchProof'), st({ protection: 'magnesium' }), 7)).toMatch(/thinner and crusted white/)
    expect(verdictText(needs('rust'), st({}))).toMatch(/water and air \(oxygen\) together/)
    expect(verdictText(needs('rust'), st({ air: 'out' }))).toMatch(/No air/)
    expect(verdictText(needs('rust'), st({ left: false }))).toMatch(/Leave for a week first/)
    expect(verdictText(protect('scratchProof'), st({ protection: 'zinc' }))).toMatch(/Scratch the nail/)
    expect(verdictText(protect('scratchProof'), st({ protection: 'paint', scratched: true }))).toMatch(/barrier|only a barrier/)
    expect(verdictText(protect('scratchProof'), st({ protection: 'zinc', scratched: true }))).toMatch(/galvanising/)
    expect(verdictText(protect('scratchProof'), st({ scratched: true }))).toMatch(/bare nail has no protection/)
  })
})

suite('catalogue matching', () => {
  it('is offered for rusting, and not for its neighbours', () => {
    for (const station of ['Rusting', 'Conditions for rusting', 'Corrosion of iron', 'Galvanising', 'Sacrificial protection']) {
      expect(scenesFor(station).map((e) => e.id), station).toContain('rusting')
      expect(sceneCatalogue(station), station).toContain('SCENE "rusting"')
    }
    for (const station of ['The reactivity series', 'Alloys', 'Electrolysis', 'Rates of reaction', 'Rust fungus on plants']) {
      expect(scenesFor(station).map((e) => e.id), station).not.toContain('rusting')
    }
  })
})

suite('the card', () => {
  it('server-renders every kind without the answer before marking', () => {
    for (const c of allConfigs()) {
      const html = render(c, E.initial(c))
      expect(html, JSON.stringify(c)).toContain('Leave for a week')
      expect(html).not.toMatch(/Right\.|Not quite|data-done/)
      expect(html).not.toContain(verdictText(c, E.solve(c)))
    }
    for (const c of [needs('rust'), needs('rustMost', true), protect('scratchProof'), protect('keepShiny', ['none', 'grease'])]) {
      expect(render(c, E.initial(c), 'idle', true)).toContain('Goal')
    }
  })

  it('shows protection options only as listed, and salt only when offered', () => {
    const p = render(protect('scratchProof', ['paint', 'zinc']), E.initial(protect('scratchProof', ['paint', 'zinc'])))
    expect(p).toContain('Protect with: paint')
    expect(p).not.toContain('Protect with: grease')
    expect(p).toContain('Scratch the nail')
    expect(render(needs('rust'), E.initial(needs('rust')))).not.toContain('Water: salt water')
    expect(render(needs('rustMost', true), E.initial(needs('rustMost', true)))).toContain('Water: salt water')
    expect(DEFAULT_OPTIONS).toEqual(['none', 'paint', 'zinc', 'magnesium'])
  })

  it('shows the verdict once marked, and the solved state when shown', () => {
    const c = protect('scratchProof')
    expect(render(c, E.solve(c), 'right')).toMatch(/galvanising|sacrificial/)
    expect(render(c, E.initial(c), 'wrong')).toContain('data-done="0"')
    expect(render(c, E.initial(c), 'shown')).toContain('data-done="1"')
    expect(render({ kind: 'other', asked: 'x' }, E.initial(c))).toBe('')
  })
})
