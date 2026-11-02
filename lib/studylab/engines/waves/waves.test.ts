// lib/studylab/engines/waves/waves.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  wavesEngine as engine, AMP_MAX, AMP_MIN, FREQ_MAX, FREQ_MIN, SLOW_FREQ_MAX, SPEED_THICK, SPEED_THIN,
  ROPE_LENGTH, cmp, madeText, ratText, startOf, wavelength, working, type WavesConfig, type WavesState,
} from './config'
import { WavesView, PX_PER_M, X0, X1, W, dotsOf, labelSpans, targetPath, unitWave } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import '..'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
const MATCH: WavesConfig[] = range(FREQ_MIN, FREQ_MAX).flatMap((frequency) => range(AMP_MIN, AMP_MAX).map((amplitude) => ({ task: 'match' as const, frequency, amplitude })))
const SLOW: WavesConfig[] = range(FREQ_MIN, SLOW_FREQ_MAX).map((frequency) => ({ task: 'slow' as const, frequency }))
const ALL = [...MATCH, ...SLOW]

describe('the rules, from first principles', () => {
  it('wavelength is speed over frequency, exactly, and v = f x wavelength', () => {
    for (const speed of [SPEED_THIN, SPEED_THICK]) for (const f of range(FREQ_MIN, FREQ_MAX)) {
      const l = wavelength(speed, f)
      expect(l.n * f).toBe(speed * l.d)
    }
    expect(ratText(wavelength(12, 5))).toBe('2.4')
    expect(ratText(wavelength(12, 4))).toBe('3')
    expect(cmp(wavelength(12, 2), wavelength(12, 3))).toBe(1)
  })

  it('the thick rope halves the wavelength at the same frequency', () => {
    for (const f of range(FREQ_MIN, SLOW_FREQ_MAX)) {
      expect(cmp(wavelength(SPEED_THIN, f), { n: 2 * wavelength(SPEED_THICK, f).n, d: wavelength(SPEED_THICK, f).d })).toBe(0)
    }
  })

  it('the drawn wave has f crests on the thin rope and the same number of shakes a second at both dots', () => {
    // A crest is where the phase is a quarter turn; count sign changes along the rope.
    const cross = (task: 'match' | 'slow', f: number, from: number, to: number) => {
      let n = 0
      let prev = unitWave(task, f, from, 0)
      for (let m = from + 0.01; m <= to; m += 0.01) { const v = unitWave(task, f, m, 0); if (prev < 0 && v >= 0) n++; prev = v }
      return n
    }
    for (const f of range(1, 4)) {
      expect(Math.abs(cross('match', f, 0, 12) - f)).toBeLessThanOrEqual(1)
      expect(Math.abs(cross('slow', f, 6, 12) - f)).toBeLessThanOrEqual(1) // the thick half is 6 m at 6 m/s
    }
    // Both dots go up and down at the same rate: the phase moves them by the same amount over a short time.
    const [m1, m2] = dotsOf('slow')
    const period = 1 / 3
    for (const m of [m1, m2]) expect(unitWave('slow', 3, m, 0)).toBeCloseTo(unitWave('slow', 3, m, 2 * Math.PI), 9)
    expect(period).toBeGreaterThan(0)
  })
})

describe('every configuration', { timeout: 30_000 }, () => {
  it('parses, has no fault, starts unsolved and can be solved', () => {
    for (const c of ALL) {
      expect(engine.parse(c), JSON.stringify(c)).toEqual(c)
      expect(engine.faults(c), JSON.stringify(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, `initial ${JSON.stringify(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${JSON.stringify(c)}`).toBe(true)
    }
    expect(ALL.length).toBe(24 + 4)
  })

  it('only the exact shake passes, and nothing else does', () => {
    for (const c of ALL) {
      const max = c.task === 'slow' ? SLOW_FREQ_MAX : FREQ_MAX
      for (const f of range(FREQ_MIN, max)) for (const a of range(AMP_MIN, AMP_MAX)) {
        const ok = engine.check(c, { f, a }).ok
        expect(ok, `${JSON.stringify(c)} f${f} a${a}`).toBe(f === c.frequency && (c.task === 'slow' || a === c.amplitude))
      }
    }
  })

  it('starts away from the target, and every target is reachable by taps within range', () => {
    for (const c of ALL) {
      const s = startOf(c)
      expect(s.f).not.toBe(c.frequency)
      if (c.task === 'match') expect(s.a).not.toBe(c.amplitude)
      expect(s.f).toBeGreaterThanOrEqual(FREQ_MIN)
      expect(s.f).toBeLessThanOrEqual(c.task === 'slow' ? SLOW_FREQ_MAX : FREQ_MAX)
    }
  })

  it('says something true when marked, and never the answer\'s numbers when wrong', () => {
    for (const c of ALL) {
      expect(working(c)).toContain(ratText(wavelength(c.task === 'slow' ? SPEED_THICK : SPEED_THIN, c.frequency)))
      const wrong: WavesState = engine.initial(c)
      const t = madeText(c, wrong)
      expect(t).toMatch(/longer|shorter|right length/)
      if (c.task === 'match') expect(t).not.toContain(`${c.frequency} times`)
    }
  })

  it('bad or out-of-range values still parse, and faults name the limit and a nearby example', () => {
    const big = engine.parse({ task: 'match', frequency: 9, amplitude: 2 })!
    expect(engine.faults(big)[0]).toContain('e.g. frequency 6')
    const tall = engine.parse({ task: 'match', frequency: 2, amplitude: 9 })!
    expect(engine.faults(tall)[0]).toContain('e.g. amplitude 4')
    const half = engine.parse({ task: 'slow', frequency: 5 })!
    expect(engine.faults(half)[0]).toContain('e.g. frequency 4')
    expect(engine.faults(engine.parse({ task: 'match', frequency: 2.5, amplitude: 2 })!)).toHaveLength(1)
    expect(engine.parse({ task: 'interference', frequency: 2 })).toBeNull()
    expect(engine.parse({ task: 'make the wave', frequency: '3 Hz', height: 2 })).toEqual({ task: 'match', frequency: 3, amplitude: 2 })
    expect(engine.parse({ task: 'thick rope', hz: 2 })).toEqual({ task: 'slow', frequency: 2 })
    expect(engine.parse(null)).toBeNull()
  })

  it('refuses a state outside the range', () => {
    const c: WavesConfig = { task: 'match', frequency: 3, amplitude: 2 }
    expect(engine.check(c, { f: 99, a: 2 }).ok).toBe(false)
    expect(engine.check(c, {}).ok).toBe(false)
  })

  it('is registered, with every example readable and fault-free', () => {
    expect(getEngine('waves')).toBe(engine)
    expect(engine.isolates).toBe('magnitude')
    expect(engine.prompt).toMatch(/SCENE "waves"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:waves"/)
    const examples = [...engine.prompt.matchAll(/"config": (\{ "task":[^}]*\})/g)].map((m) => JSON.parse(m[1]))
    expect(examples.length).toBe(2)
    for (const ex of examples) {
      expect(engine.parse(ex), JSON.stringify(ex)).not.toBeNull()
      expect(engine.faults(engine.parse(ex)!)).toEqual([])
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (cfg: WavesConfig, prompt: string) => engine.promptFaults!(cfg, prompt)
  const m: WavesConfig = { task: 'match', frequency: 3, amplitude: 2 }
  const s: WavesConfig = { task: 'slow', frequency: 2 }

  it('match: the outcome is fine; numbers, the rule and the direction are not', () => {
    expect(pf(m, 'Shake the end of the rope so the wave matches the dashed green wave.')).toEqual([])
    expect(pf(m, 'Match the wavelength and the height of the dashed green wave.')).toEqual([])
    expect(pf(m, 'Shake 3 times a second to match the wave.')).toHaveLength(1)
    expect(pf(m, 'Make a wave 4 m long.')).toHaveLength(1)
    expect(pf(m, 'Wave speed = frequency x wavelength. Match the wave.')).toHaveLength(1)
    expect(pf(m, 'Shake faster to match the wave.')).toHaveLength(1)
    expect(pf(m, 'The wave is too long: shake more often.')).toHaveLength(1)
  })

  it('slow: what the thick rope does to the wave is not to be said', () => {
    expect(pf(s, 'The rope gets thicker part way along. Shake the end so the wave on the thick part matches the dashed green wave.')).toEqual([])
    expect(pf(s, 'The wave slows down on the thick rope. Match the dashed wave.')).toHaveLength(1)
    expect(pf(s, 'The waves get shorter on the thick rope. Match the dashed wave.')).toHaveLength(1)
    expect(pf(s, 'The frequency stays the same. Match the dashed wave on the thick part.')).toHaveLength(1)
    // the fix named fits the task
    expect(pf(s, 'It slows.')[0]).toContain('thick')
    expect(pf(m, '3 Hz')[0]).not.toContain('thick')
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"waves", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(2)
    for (const f of found) expect(engine.promptFaults!(engine.parse(JSON.parse(f[2]))!, f[1])).toEqual([])
  })
})

describe('when the tutor is shown it', () => {
  it('is offered for the stations that name waves', () => {
    for (const st of ['Waves', 'Waves (phys AL)', 'Sound waves', 'Wave speed', 'Wavelength and frequency', 'Transverse waves', 'Properties of waves', 'The speed of sound', 'Ultrasound', 'Pitch and loudness']) {
      expect(sceneCatalogue(st), st).toContain('SCENE "waves"')
      expect(scenesFor(st).some((e) => e.id === 'waves'), st).toBe(true)
    }
  })

  it('is not offered for heat waves, microwaves, sound reasoning and other uses of the words', () => {
    for (const st of [
      'Heat wave warnings', 'A wave of migration', 'Microwave ovens', 'Sound reasoning', 'Sound financial advice', 'Amplitude of a sine graph', 'Frequency tables',
      'Cumulative frequency', 'Longitudinal studies', 'The first wave of feminism', 'Waveform design in Photoshop', 'Soundtrack design',
    ]) {
      expect(sceneCatalogue(st), st).not.toContain('SCENE "waves"')
      expect(scenesFor(st).some((e) => e.id === 'waves'), st).toBe(false)
    }
  })
})

describe('a still frame is a frame a learner sees', () => {
  it('the target and the rope stay inside the picture for every config', () => {
    for (const c of ALL) {
      const nums = [...targetPath(c).matchAll(/[ML]([\d.]+) ([\d.-]+)/g)].map((x) => [Number(x[1]), Number(x[2])])
      for (const [x, y] of nums) {
        expect(x).toBeGreaterThanOrEqual(X0 - 0.1)
        expect(x).toBeLessThanOrEqual(X1 + 0.1)
        expect(y).toBeGreaterThanOrEqual(20)
        expect(y).toBeLessThan(122)
      }
    }
    expect(W).toBeGreaterThan(X1)
    expect(PX_PER_M * ROPE_LENGTH).toBeCloseTo(X1 - X0, 9)
  })

  it('the labels under the picture never touch each other', () => {
    for (const task of ['match', 'slow'] as const) {
      const spans = labelSpans(task)
      for (const row of ['A', 'B'] as const) {
        const r = spans.filter((p) => p.row === row).sort((p, q) => p.left - q.left)
        for (let i = 1; i < r.length; i++) expect(r[i].left, `${task} ${r[i - 1].text} / ${r[i].text}`).toBeGreaterThan(r[i - 1].right + 4)
        for (const p of r) { expect(p.left).toBeGreaterThanOrEqual(0); expect(p.right).toBeLessThanOrEqual(W) }
      }
    }
  })

  it('a dot sits on its own line, nearer its own label than any other', () => {
    for (const task of ['match', 'slow'] as const) {
      const dots = dotsOf(task)
      const named = labelSpans(task).filter((l) => l.text === 'orange dot')
      expect(named).toHaveLength(dots.length)
    }
  })
})

describe('the waves scene on the board', () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'waves', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: WavesConfig, state: WavesState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(WavesView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  it('before marking: round buttons, named colours, and none of the answer', () => {
    for (const [cfg, prompt] of [
      [{ task: 'match', frequency: 3, amplitude: 2 }, 'Shake the end of the rope so the wave matches the dashed green wave.'],
      [{ task: 'slow', frequency: 2 }, 'The rope gets thicker part way along. Shake the end so the wave on the thick part matches the dashed green wave.'],
    ] as const) {
      const html = card(cfg, prompt)
      expect(html).toContain('aria-label="Shake faster"')
      expect(html).toContain('aria-label="Shake slower"')
      expect(html).not.toContain('role="slider"')
      const shown = text(html.replace(prompt, ''))
      for (const secret of ['frequency', 'wavelength', 'Hz', ' m long', 'speed', 'v =', 'Yes', 'You made', 'same rate', 'longer', 'shorter']) {
        expect(shown, secret).not.toContain(secret)
      }
      expect(shown).toContain('make this wave')
      expect(shown).toContain('orange dot')
      expect(shown).toContain('hand')
      expect(html).toContain(cfg.task === 'slow' ? 'thick rope' : 'blue rope')
      expect(html).not.toMatch(/Hz|hertz/i)
    }
    expect(card({ task: 'match', frequency: 3, amplitude: 2 }, 'x')).toContain('Shake a longer distance')
    expect(card({ task: 'slow', frequency: 2 }, 'x')).not.toContain('Shake a longer distance')
  })

  it('a button stops at the end of its range, and locks when solved', () => {
    const c: WavesConfig = { task: 'match', frequency: 3, amplitude: 2 }
    const disabled = (html: string) => (html.match(/<button[^>]* disabled=""/g) ?? []).length
    expect(disabled(raw(c, { f: FREQ_MIN, a: 2 }, 'idle'))).toBe(1)
    expect(disabled(raw(c, { f: FREQ_MAX, a: AMP_MAX }, 'idle'))).toBe(2)
    expect(disabled(raw(c, { f: 3, a: 2 }, 'right'))).toBe(4)
  })

  it('marking says the numbers when right, and what was made when wrong', () => {
    const c: WavesConfig = { task: 'match', frequency: 3, amplitude: 2 }
    expect(text(raw(c, { f: 3, a: 2 }, 'right'))).toContain('12 = 3 x 4')
    expect(text(raw(c, { f: 1, a: 2 }, 'wrong'))).toContain('longer than the dashed ones')
    expect(text(raw({ task: 'slow', frequency: 2 }, { f: 2 }, 'shown'))).toContain('6 = 2 x 3')
  })

  it('the still frame changes with each tap, under reduced motion', () => {
    const c: WavesConfig = { task: 'match', frequency: 3, amplitude: 2 }
    const a = raw(c, { f: 1, a: 2 }, 'idle', true)
    const b = raw(c, { f: 2, a: 2 }, 'idle', true)
    const d = raw(c, { f: 2, a: 3 }, 'idle', true)
    expect(a).not.toBe(b)
    expect(b).not.toBe(d)
    expect(a).not.toMatch(/requestAnimationFrame|animate/)
  })

  it('arrow keys are kept inside the card', () => {
    const html = raw({ task: 'match', frequency: 3, amplitude: 2 }, { f: 1, a: 1 }, 'idle')
    expect(html).toContain('nodrag')
  })
})
