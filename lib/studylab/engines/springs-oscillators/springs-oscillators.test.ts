// lib/studylab/engines/springs-oscillators/springs-oscillators.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  springsEngine as engine, answerMasses, extensionFor, fmt, madeText, working,
  MASS_WEIGHT, MAX_MASSES, MIN_ANSWER,
  type SpringsConfig, type SpringsState,
} from './config'
import { AMP, BLK_H, BLK_W, CX, H, HOOK, PX, REST, SPRING_TOP, SpringsView, W, hookBot, springBot, springPath, stackBot } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const K_VALUES = Array.from({ length: 40 }, (_, i) => (i + 1) * 0.25)
const MASS_RANGE = Array.from({ length: MAX_MASSES - MIN_ANSWER + 1 }, (_, i) => i + MIN_ANSWER)
const ALL: SpringsConfig[] = K_VALUES.flatMap((k) =>
  MASS_RANGE.map((masses) => ({ k, extension: masses * MASS_WEIGHT / k })))
const nameOf = (c: SpringsConfig) => JSON.stringify(c)

describe('the rules, from first principles', () => {
  it('each mass adds the same extension: Hooke\'s law F = kx', () => {
    for (const k of [0.5, 1, 2, 3, 4]) {
      const ext1 = extensionFor(k, 1)
      for (let n = 2; n <= 8; n++) {
        expect(extensionFor(k, n)).toBeCloseTo(n * ext1, 9)
      }
    }
  })

  it('the answer is k × extension, rounded to a whole number', () => {
    expect(answerMasses({ k: 2, extension: 3 })).toBe(6)
    expect(answerMasses({ k: 1, extension: 5 })).toBe(5)
    expect(answerMasses({ k: 0.5, extension: 8 })).toBe(4)
    expect(answerMasses({ k: 3, extension: 2 })).toBe(6)
  })

  it('the extension at the answer is the target extension', () => {
    for (const c of ALL) {
      const n = answerMasses(c)
      expect(extensionFor(c.k, n)).toBeCloseTo(c.extension, 9)
    }
  })

  it('unit masses each weigh 1 N', () => {
    expect(MASS_WEIGHT).toBe(1)
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses to itself, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), nameOf(c)).toEqual(c)
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${nameOf(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${nameOf(c)}`).toBe(true)
    }
    expect(ALL.length).toBeGreaterThan(200)
  })

  it('can be solved by key presses from the start, without jumping over the answer', () => {
    for (const c of ALL) {
      const answer = answerMasses(c)
      const reachable = Array.from({ length: 9 }, (_, i) => i).some((n) => engine.check(c, { masses: n }).ok)
      expect(reachable, nameOf(c)).toBe(true)
      expect(answer, nameOf(c)).toBeGreaterThanOrEqual(MIN_ANSWER)
      expect(answer, nameOf(c)).toBeLessThanOrEqual(MAX_MASSES)
    }
  })

  it('refuses a state outside what can be set', () => {
    const c: SpringsConfig = { k: 2, extension: 3 }
    expect(engine.check(c, { masses: 6.5 }).ok).toBe(false)
    expect(engine.check(c, { masses: -1 }).ok).toBe(false)
    expect(engine.check(c, { masses: 99 }).ok).toBe(false)
    expect(engine.check(c, {} as SpringsState).ok).toBe(false)
    expect(engine.check(c, null as unknown as SpringsState).ok).toBe(false)
  })

  it('says something true when marked right', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      expect(said, nameOf(c)).toContain('F = kx')
      const n = answerMasses(c)
      expect(said, nameOf(c)).toContain(`${n} weight`)
      expect(said, nameOf(c)).toContain(`${fmt(c.extension)} cm`)
    }
  })

  it('says what was made when wrong, without saying where the answer is', () => {
    for (const c of ALL) {
      const said = madeText(c, engine.initial(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(false)
      expect(said, nameOf(c)).not.toContain('F = kx')
    }
    const c: SpringsConfig = { k: 2, extension: 3 }
    expect(madeText(c, { masses: 0 })).toMatch(/no weights/)
    expect(madeText(c, { masses: 4 })).toMatch(/short of/)
    expect(madeText(c, { masses: 7 })).toMatch(/past/)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ k: 2, extension: 3 })).toEqual({ k: 2, extension: 3 })
    expect(engine.parse({ stiffness: 'soft', extension: 4 })).toEqual({ k: 1, extension: 4 })
    expect(engine.parse({ spring_constant: 'medium', stretch: '5 cm' })).toEqual({ k: 2, extension: 5 })
    expect(engine.parse({ springConstant: 3, target: 2 })).toEqual({ k: 3, extension: 2 })
    expect(engine.parse({ constant: 'stiff', displacement: '2' })).toEqual({ k: 3, extension: 2 })
    expect(engine.parse({ stiffness: 'very soft', extension: 8 })).toEqual({ k: 0.5, extension: 8 })
  })

  it('fills in what the tutor left out, with something that works', () => {
    for (const raw of [{}, { k: 2 }, { extension: 4 }, { stiffness: 'medium' }]) {
      const c = engine.parse(raw)!
      expect(c, JSON.stringify(raw)).not.toBeNull()
      expect(engine.faults(c), JSON.stringify(raw)).toEqual([])
    }
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('spring')).toBeNull()
    expect(engine.parse({ k: 'banana' })).toBeNull()
    expect(engine.parse({ k: -1, extension: 3 })).toBeNull()
    expect(engine.parse({ k: 0, extension: 3 })).toBeNull()
    expect(engine.parse({ extension: 'a lot' })).toBeNull()
    expect(engine.parse({ k: 200, extension: 3 })).toBeNull()
    expect(engine.parse({ k: 2, extension: -1 })).toBeNull()
    expect(engine.parse({ k: 2, extension: 2.3 })).not.toBeNull()
  })

  const fixOf = (said: string): SpringsConfig => {
    const ext = said.match(/e\.g\. extension ([\d.]+)/)
    if (!ext) {
      const alt = said.match(/at least extension ([\d.]+)/)
      expect(alt, said).not.toBeNull()
      const k = said.match(/k = ([\d.]+)/)
      expect(k, said).not.toBeNull()
      return { k: Number(k![1]), extension: Number(alt![1]) }
    }
    const k = said.match(/k = ([\d.]+)/)
    expect(k, said).not.toBeNull()
    return { k: Number(k![1]), extension: Number(ext[1]) }
  }

  it('refuses what would need a non-whole, too few or too many masses, naming a fix', () => {
    const cases: [SpringsConfig, RegExp][] = [
      [{ k: 2, extension: 2.3 }, /not whole/],
      [{ k: 2, extension: 0.25 }, /not whole/],
      [{ k: 2, extension: 0.5 }, /only 1 mass/],
      [{ k: 1, extension: 0.5 }, /not whole/],
      [{ k: 2, extension: 5 }, /at most 8/],
      [{ k: 0.5, extension: 20 }, /at most 8/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = fixOf(f[0])
      expect(engine.faults(fixed), f[0]).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok, f[0]).toBe(true)
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: SpringsConfig, p: string) => engine.promptFaults!(c, p)
  const c: SpringsConfig = { k: 2, extension: 3 }

  it('asking for the outcome is fine', () => {
    expect(pf(c, 'Hang weights on the spring with the + and − buttons until it stretches to the dashed line.')).toEqual([])
    expect(pf(c, 'Add weights to the spring until it reaches the target.')).toEqual([])
    expect(pf(c, 'Use the round + and − buttons to load the spring to the dashed line.')).toEqual([])
  })

  it('a number, the rule or a direction is not', () => {
    for (const p of [
      'Hang 6 masses on it.',
      'Add weights until the force is 6 N.',
      'Stretch it 3 cm.',
      'The spring constant is 2.',
      'Remember Hooke\'s law.',
      'F = kx tells us what to do.',
      'Extension is proportional to force.',
      'Add 4 weights.',
      'Remove 2 blocks.',
      'Hang 3 weights on it.',
    ]) {
      expect(pf(c, p), p).toHaveLength(1)
    }
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)"[\s\S]*?"config":\s*(\{[^}]+\})\s*\}/g)]
    expect(found.length).toBeGreaterThanOrEqual(1)
    for (const m of found) {
      const parsed = engine.parse(JSON.parse(m[2]))!
      expect(parsed, m[2]).not.toBeNull()
      expect(engine.faults(parsed), m[2]).toEqual([])
      expect(engine.promptFaults!(parsed, m[1]), m[1]).toEqual([])
    }
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "springs-oscillators"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'springs-oscillators')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      "Hooke's law", 'Springs and elasticity', 'Force and extension',
      'Elastic deformation', 'Spring constant', 'Spring balances and Hooke\'s law',
      'Oscillations and simple harmonic motion', 'Mass on a spring',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for what it cannot draw', () => {
    for (const st of [
      'Hot springs and geothermal energy', 'Spring equinox and seasons', 'Spring tides and neap tides',
      'Oscillating chemical reactions', 'Chemical oscillations',
      'Energy stored in a spring', 'Parallel and series springs', 'Elastic limit',
      'Spring water sources', 'The spring season in the UK',
    ]) {
      expect(offered(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('springs-oscillators')?.id).toBe(engine.id)
    expect(engine.isolates).toBe('quantity')
    expect(engine.prompt).toMatch(/SCENE "springs-oscillators"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:springs-oscillators"/)
  })
})

describe('a still frame is a frame a learner sees', () => {
  it('the spring and all blocks stay inside the stage for every config', () => {
    for (const c of ALL) {
      const n = answerMasses(c)
      expect(springBot(n), nameOf(c)).toBeLessThan(H)
      expect(stackBot(n), nameOf(c)).toBeLessThanOrEqual(H)
      expect(springBot(0), nameOf(c)).toBeGreaterThan(SPRING_TOP)
      expect(CX - BLK_W / 2, nameOf(c)).toBeGreaterThanOrEqual(0)
      expect(CX + BLK_W / 2, nameOf(c)).toBeLessThanOrEqual(W)
    }
  })

  it('the target line sits inside the stage for every config', () => {
    for (const c of ALL) {
      const ty = stackBot(answerMasses(c))
      expect(ty, nameOf(c)).toBeGreaterThan(SPRING_TOP)
      expect(ty, nameOf(c)).toBeLessThan(H)
    }
  })

  it('one tap moves the drawing by plenty', () => {
    expect(PX + BLK_H).toBeGreaterThanOrEqual(24)
  })

  it('agrees with what the view writes out as literals', () => {
    expect(8).toBe(MAX_MASSES)
    expect(1).toBe(MASS_WEIGHT)
  })

  it('the spring path has sensible coordinates', () => {
    const p0 = springPath(0)
    expect(p0).toContain(`M ${CX.toFixed(1)}`)
    expect(p0).toContain(`L ${CX.toFixed(1)}`)
    const xs = [...springPath(8).matchAll(/[ML] ([\d.]+) /g)].map((m) => Number(m[1]))
    expect(Math.max(...xs)).toBeGreaterThan(CX + AMP - 1)
    expect(Math.min(...xs)).toBeLessThan(CX - AMP + 1)
  })
})

describe('the springs scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'springs-oscillators', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: SpringsConfig, state: SpringsState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(SpringsView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  const CFG: SpringsConfig = { k: 2, extension: 3 }
  const PROMPT = 'Hang weights on the spring with the + and − buttons until it stretches to the dashed line.'

  it('before marking, nothing says the answer, the rule or a number of it', () => {
    const html = card(CFG, PROMPT)
    expect(raw(CFG, { masses: 0 }, 'idle')).toContain('role="img"')
    const shown = text(html.replace(PROMPT, '')) + ' ' + attrs(html)
    for (const secret of ['F = kx', 'Hooke', 'proportional', 'spring constant', ' cm', ' N.', '= 2', '= 3', '= 6']) {
      expect(shown, secret).not.toContain(secret)
    }
  })

  it('names what it draws, on the card, before marking', () => {
    const m = text(raw(CFG, { masses: 3 }, 'idle'))
    for (const name of ['spring', 'target']) expect(m, name).toContain(name)
  })

  it('marking gives the numbers, on the drawing and in the sentence', () => {
    const right = text(raw(CFG, { masses: 6 }, 'right'))
    expect(right).toContain('F = kx')
    expect(right).toContain('3 cm')
    expect(right).toContain('6 N')
    const wrong = text(raw(CFG, { masses: 4 }, 'wrong'))
    expect(wrong).toContain('short of')
    expect(wrong).toContain('4 N')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const html = raw(CFG, { masses: 2 }, 'shown')
    expect(html).toContain('aria-label="Hang one more weight"')
    expect(html).toContain('>6<')
    expect(text(html)).toContain('F = kx')
  })

  it('the still frame changes with every move, with nothing moving by itself under reduced motion', () => {
    expect(raw(CFG, { masses: 3 }, 'idle', true)).not.toBe(raw(CFG, { masses: 4 }, 'idle', true))
  })

  it('has real buttons, and locks them when solved', () => {
    const idle = raw(CFG, engine.initial(CFG), 'idle')
    expect(idle).toContain('nodrag')
    expect(idle).toContain('<button type="button" aria-label="Hang one more weight"')
    expect(idle).not.toMatch(/<button[^>]*aria-label="Hang one more weight"[^>]*disabled=""/)
    const done = raw(CFG, engine.solve(CFG), 'right')
    expect(done).toMatch(/<button[^>]*aria-label="Hang one more weight"[^>]*disabled=""/)
    expect(done).toMatch(/<button[^>]*aria-label="Take one weight off"[^>]*disabled=""/)
  })

  it('tells a screen reader the state, never the answer', () => {
    const miss = attrs(raw(CFG, { masses: 3 }, 'idle'))
    expect(miss).toContain('has not reached the target')
    expect(miss).not.toContain('6')
    expect(attrs(raw(CFG, { masses: 6 }, 'idle'))).toContain('has stretched to the target')
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(CFG, marked === 'right' ? engine.solve(CFG) : engine.initial(CFG), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })
})
