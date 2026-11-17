// lib/studylab/engines/pendulum/pendulum.test.ts
import { describe as suite, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  pendulumEngine as E, periodOf, tenSwings, tenText, oneText, fairPair, readState, done, captionText, goalText, measureOf, verdictText, markedRows,
  EXAMPLES, LENGTHS, BOBS, PULLS,
  type PendulumConfig, type PendulumState, type Setup,
} from './config'
import { PendulumView } from './View'
import { periodS, tenSwingsS, oneSwingText, runMs } from './Picture'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const START: Setup = { lengthCm: 50, bob: 'wood', pullDeg: 5 }
const [MATCH, CHANGE, COMPARE_BOB, COMPARE_PULL] = EXAMPLES.map((e) => e.config)
const compare = (variable: string, start: Setup = START): PendulumConfig => ({ kind: 'compare', variable, start })
const SETUPS: Setup[] = LENGTHS.flatMap((lengthCm) => BOBS.flatMap((bob) => PULLS.map((pullDeg) => ({ lengthCm, bob, pullDeg }))))

/** Every valid config. */
function allConfigs(): PendulumConfig[] {
  const out: PendulumConfig[] = []
  for (const start of SETUPS) {
    for (const targetCm of LENGTHS) out.push({ kind: 'match', targetCm, start })
    for (const direction of ['slower', 'faster']) out.push({ kind: 'change', direction, start })
    for (const variable of ['bob', 'pull', 'length']) out.push({ kind: 'compare', variable, start })
  }
  return out.filter((c) => E.faults(c).length === 0)
}

const render = (config: PendulumConfig, state: PendulumState, marked: 'idle' | 'right' | 'wrong' | 'shown' = 'idle', reduced = false) =>
  renderToStaticMarkup(createElement(PendulumView, { config, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))

const timed = (runs: Setup[]): PendulumState => ({ ...runs[runs.length - 1], phase: 'timed', runId: runs.length, runs })

suite('the physics', () => {
  it('times ten swings of each string as the design says', () => {
    expect(LENGTHS.map(tenText)).toEqual(['10.0', '14.2', '17.4', '20.1'])
    expect(LENGTHS.map(oneText)).toEqual(['1.00', '1.42', '1.74', '2.01'])
    expect(periodOf(100)).toBeCloseTo(2.006, 3)
  })

  it('agrees with the picture for all four lengths', () => {
    for (const l of LENGTHS) {
      expect(periodOf(l)).toBeCloseTo(periodS(l), 12)
      expect(tenSwings(l)).toBe(tenSwingsS(l))
      expect(oneText(l)).toBe(oneSwingText(l))
    }
    expect(runMs(25)).toBeGreaterThan(10000)
  })

  it('keeps the 0.1 s time for all 8 pull and length cases even with the true large-angle period', () => {
    for (const l of LENGTHS) {
      for (const deg of PULLS) {
        const th = (deg * Math.PI) / 180
        const exact = periodOf(l) * (1 + th ** 2 / 16 + (11 * th ** 4) / 3072)
        expect(Math.round(exact * 100) / 10, `${l} cm at ${deg} degrees`).toBe(tenSwings(l))
      }
    }
  })

  it('never lets the bob or the pull change the time', () => {
    for (const a of SETUPS) for (const b of SETUPS) if (a.lengthCm === b.lengthCm) expect(tenText(a.lengthCm)).toBe(tenText(b.lengthCm))
  })
})

suite('every valid config starts unsolved and solves', () => {
  it('holds for every config', () => {
    const configs = allConfigs()
    expect(configs.length).toBeGreaterThan(100)
    for (const c of configs) {
      const tag = JSON.stringify(c)
      expect(E.check(c, E.initial(c)).ok, `starts solved ${tag}`).toBe(false)
      const s = E.solve(c)
      expect(E.check(c, s).ok, `cannot solve ${tag}`).toBe(true)
      expect(s.phase).toBe('timed')
      expect(E.faults(c)).toEqual([])
      expect(verdictText(c, s)).toBeTruthy()
    }
  })

  it('is not solved by the start, by a setting changed but not timed, or by a swing still running', () => {
    for (const c of [MATCH, CHANGE, COMPARE_BOB, COMPARE_PULL]) {
      const s = E.solve(c)
      expect(E.check(c, { ...s, phase: 'swinging' }).ok).toBe(false)
      expect(E.check(c, { ...s, phase: 'set' }).ok).toBe(false)
    }
    expect(E.check(MATCH, timed([{ lengthCm: 100, bob: 'steel', pullDeg: 10 }])).ok).toBe(true)
    expect(E.check(MATCH, timed([{ lengthCm: 75, bob: 'steel', pullDeg: 10 }])).ok).toBe(false)
  })

  it('marks change by the direction from the start only', () => {
    const slower = CHANGE
    expect(E.check(slower, timed([START])).ok).toBe(false)
    expect(E.check(slower, timed([START, { ...START, bob: 'steel' }])).ok).toBe(false)
    expect(E.check(slower, timed([START, { ...START, pullDeg: 10 }])).ok).toBe(false)
    expect(E.check(slower, timed([START, { ...START, lengthCm: 25 }])).ok).toBe(false)
    expect(E.check(slower, timed([START, { ...START, lengthCm: 75 }])).ok).toBe(true)
    const faster: PendulumConfig = { kind: 'change', direction: 'faster', start: START }
    expect(E.check(faster, timed([START, { ...START, lengthCm: 25 }])).ok).toBe(true)
    expect(E.check(faster, timed([START, { ...START, lengthCm: 100 }])).ok).toBe(false)
  })

  it('needs a fair pair for compare: exactly the variable differs', () => {
    const wood = START
    const steel: Setup = { ...START, bob: 'steel' }
    expect(E.check(COMPARE_BOB, timed([{ ...wood, lengthCm: 75 }])).ok).toBe(false)
    const w75 = { ...wood, lengthCm: 75 as const }
    const s75 = { ...steel, lengthCm: 75 as const }
    expect(E.check(COMPARE_BOB, timed([w75, s75])).ok).toBe(true)
    // Two things changed: not fair.
    expect(E.check(COMPARE_BOB, timed([w75, { ...s75, pullDeg: 10 }])).ok).toBe(false)
    // A fair pair of the wrong variable.
    expect(E.check(COMPARE_BOB, timed([w75, { ...w75, pullDeg: 10 }])).ok).toBe(false)
    // Not adjacent rows is fine, and the same setting twice is not a comparison.
    expect(E.check(COMPARE_BOB, timed([w75, { ...w75, pullDeg: 10 }, s75])).ok).toBe(true)
    expect(E.check(COMPARE_BOB, timed([w75, w75])).ok).toBe(false)
    expect(fairPair([w75, s75], 'bob')).toEqual([0, 1])
    expect(fairPair([w75, s75], 'pull')).toBeNull()
    const len = compare('length')
    expect(E.check(len, timed([START, { ...START, lengthCm: 100 }])).ok).toBe(true)
    expect(E.check(len, timed([START, { ...START, lengthCm: 100, bob: 'steel' }])).ok).toBe(false)
  })

  it('reads corrupt stored work as the start and never accepts it', () => {
    expect(readState(null)).toEqual({ ...START, phase: 'set', runId: 0, runs: [] })
    expect(readState({ lengthCm: 60, runs: [{ lengthCm: 1 }], phase: 'banana' } as unknown as PendulumState)).toEqual({ ...START, phase: 'set', runId: 0, runs: [] })
    expect(E.check(MATCH, {} as PendulumState).ok).toBe(false)
    expect(done({ kind: 'other', asked: 'x', start: START }, E.initial(MATCH))).toBe(false)
  })
})

suite('reading and refusing configs', () => {
  it('reads broad phrasings', () => {
    expect(E.parse(MATCH)).toEqual(MATCH)
    expect(E.parse({ kind: 'match', targetCm: '1 m', start: { lengthCm: '25 cm', bob: 'Steel', pullDeg: '10°' } })).toEqual(MATCH)
    expect(E.parse({ kind: 'compare', variable: 'mass of the bob' })).toEqual(compare('bob'))
    expect(E.parse({ kind: 'compare', variable: 'angle' })).toEqual(compare('pull'))
    expect(E.parse({ kind: 'compare', variable: 'length of string' })).toEqual(compare('length'))
    expect(E.parse({ kind: 'change', direction: 'more slowly' })).toEqual({ kind: 'change', direction: 'slower', start: START })
    expect(E.parse({ kind: 'change', direction: 'quicker' })).toEqual({ kind: 'change', direction: 'faster', start: START })
    expect(E.parse({ variable: 'bob' })).toEqual(compare('bob'))
    expect(E.parse({ kind: 'match', targetCm: 100, lengthCm: 25, bob: 'steel', pullDeg: 10 })).toEqual(MATCH)
    expect(E.parse(null)).toBeNull()
    expect(E.parse('pendulum')).toBeNull()
    expect(E.parse({})).toBeNull()
  })

  it('refuses what cannot be drawn, with an example that works', () => {
    const f = (raw: unknown) => E.faults(E.parse(raw)!)
    expect(f({ kind: 'match', targetCm: 100, start: { lengthCm: 100 } })[0]).toMatch(/already met/)
    expect(f({ kind: 'match', targetCm: 100, start: { lengthCm: 25 } })).toEqual([])
    expect(f({ kind: 'match', targetCm: 60 })[0]).toMatch(/not 60 cm.*"kind":"match"/)
    expect(f({ kind: 'change', direction: 'slower', start: { lengthCm: 100 } })[0]).toMatch(/cannot be made slower/)
    expect(f({ kind: 'change', direction: 'slower', start: { lengthCm: 75 } })).toEqual([])
    expect(f({ kind: 'change', direction: 'faster', start: { lengthCm: 25 } })[0]).toMatch(/cannot be made faster/)
    expect(f({ kind: 'change', direction: 'faster', start: { lengthCm: 50 } })).toEqual([])
    expect(f({ kind: 'change', direction: 'sideways' })[0]).toMatch(/"slower" or "faster"/)
    expect(f({ kind: 'match', targetCm: 50, start: { lengthCm: 30 } })[0]).toMatch(/25, 50, 75 or 100 cm, not 30/)
    expect(f({ kind: 'match', targetCm: 50, start: { pullDeg: 30 } })[0]).toMatch(/5 or 10 degrees, not 30/)
    expect(f({ kind: 'match', targetCm: 100, start: { pullDeg: 10 } })).toEqual([])
    expect(f({ kind: 'match', targetCm: 100, start: { bob: 'lead' } })[0]).toMatch(/"wood" or "steel"/)
    for (const v of ['mass of string', 'air']) expect(f({ kind: 'compare', variable: v })[0], v).toMatch(/not "/)
    expect(f({ kind: 'compare', variable: 'bob' })).toEqual([])
    expect(f({ kind: 'springs' })[0]).toMatch(/Only three tasks/)
    expect(E.check({ kind: 'other', asked: 'x', start: START }, E.initial(MATCH)).ok).toBe(false)
  })
})

suite('prompts', () => {
  it('catches prompts that give the answer away', () => {
    for (const t of [
      'Change the string so one swing takes 2 s.', 'Make the length longer.', 'Use a shorter pendulum.', 'Try a 1 m pendulum.', 'Use 50 cm of thread.', 'Lengthen it.',
      'Only one thing matters here.', 'The period depends on a formula.', 'T = 2π√(L/g).', 'Which makes it slower, a longer one?',
    ]) expect(E.promptFaults!(CHANGE, t).join(' '), t).toMatch(/gives the answer away/)
    for (const t of ['Does the string matter?', 'Time it with a longer string.', 'It makes no difference.', 'The time does not change.', 'The time is independent of the bob.', 'It depends on the bob.', 'The time stays constant.'])
      expect(E.promptFaults!(COMPARE_BOB, t).join(' '), t).toMatch(/gives the answer away/)
    expect(E.promptFaults!(compare('length'), 'Does a longer string take longer?').join(' ')).toMatch(/gives the answer away/)
    expect(E.promptFaults!(COMPARE_PULL, 'Does pulling the bob back further make each swing take longer?')).toEqual([])
    expect(E.promptFaults!(MATCH, 'Make a pendulum that takes 1 s a swing.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const e = getEngine('pendulum')!
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
    expect(e.prompt).not.toMatch(/2π|√/)
  })
})

suite('the words on the card', () => {
  it('says what is happening as an observation, then the verdicts from the design', () => {
    expect(captionText(E.initial(CHANGE))).toBe('A wooden bob (50 g) hangs on a 50 cm string, to be pulled back 5° and let go. Press Release to time ten swings.')
    expect(captionText({ ...START, lengthCm: 100, bob: 'steel', pullDeg: 10, phase: 'set' })).toMatch(/steel bob \(500 g\) hangs on a 1 m string.*10°/)
    expect(captionText({ ...START, phase: 'swinging', runId: 1 })).toMatch(/timing ten complete swings.*dashed release point/)
    expect(captionText(timed([{ ...START, lengthCm: 75 }]))).toBe('Ten swings took 17.4 s, so one swing takes 1.74 s.')
    expect(goalText(MATCH)).toBe('One swing in 2.01 s')
    expect(goalText(CHANGE)).toBe('Swing more slowly')
    expect(goalText(COMPARE_BOB)).toBe('Time it with each bob')
    expect(measureOf(E.initial(MATCH))).toEqual({ label: 'One swing', value: '—' })
    expect(measureOf(timed([{ ...START, lengthCm: 75 }]))).toEqual({ label: 'One swing', value: '1.74 s' })

    expect(verdictText(MATCH, timed([{ ...START, lengthCm: 100 }]))).toBe('One swing now takes 2.01 s, the goal time.')
    expect(verdictText(MATCH, timed([{ ...START, lengthCm: 75 }]))).toBe('One swing took 1.74 s against a goal of 2.01 s: quicker than the goal.')
    expect(verdictText({ ...MATCH, targetCm: 25 } as PendulumConfig, timed([{ ...START, lengthCm: 75 }]))).toMatch(/slower than the goal/)
    expect(verdictText(CHANGE, timed([START, { ...START, lengthCm: 75 }]))).toBe('Now 1.74 s a swing, slower than the 1.42 s it started at.')
    expect(verdictText(CHANGE, timed([START, { ...START, bob: 'steel' }]))).toBe('The time did not move (1.42 s both times): changing the bob made no difference.')
    expect(verdictText(CHANGE, timed([START, { ...START, pullDeg: 10 }]))).toMatch(/pulling it back a different amount made no difference/)
    expect(verdictText(CHANGE, timed([START, { ...START, lengthCm: 25 }]))).toBe('It now swings faster than before: 1.00 s a swing against 1.42 s.')
    const w: Setup = { ...START, lengthCm: 75 }
    const s: Setup = { ...w, bob: 'steel' }
    expect(verdictText(COMPARE_BOB, timed([w, s]))).toBe('The wooden bob and the steel bob both took 17.4 s for ten swings, so the bob made no difference.')
    expect(verdictText(COMPARE_PULL, timed([{ ...w, pullDeg: 5 }, { ...w, pullDeg: 10 }]))).toMatch(/Pulled back 5° and 10°, both took 17.4 s/)
    expect(verdictText(compare('length'), timed([START, { ...START, lengthCm: 100 }]))).toBe('The 50 cm string took 14.2 s and the 1 m string took 20.1 s: the longer string took longer.')
    expect(verdictText(COMPARE_BOB, timed([w, { ...s, pullDeg: 10 }]))).toMatch(/Two or more things changed/)
    expect(verdictText(COMPARE_BOB, timed([w]))).toMatch(/needs two/)
    expect(verdictText(COMPARE_BOB, timed([w, { ...w, pullDeg: 10 }]))).toMatch(/not the thing being tested/)
    expect(verdictText(MATCH, E.initial(MATCH))).toMatch(/Nothing has been timed/)
  })

  it('points the notebook highlight at the rows the verdict names', () => {
    const w: Setup = { ...START, lengthCm: 75 }
    const s: Setup = { ...w, bob: 'steel' }
    expect(markedRows(MATCH, timed([w, s]))).toEqual([1])
    expect(markedRows(CHANGE, timed([START, w, { ...START, bob: 'steel' }]))).toEqual([0, 2])
    expect(markedRows(CHANGE, timed([w, { ...START, lengthCm: 100 }]))).toEqual([1])
    expect(markedRows(COMPARE_BOB, timed([w, { ...w, pullDeg: 10 }, s]))).toEqual([0, 2])
    expect(markedRows(COMPARE_BOB, timed([w, { ...s, pullDeg: 10 }]))).toEqual([0, 1])
    expect(markedRows(COMPARE_BOB, E.initial(COMPARE_BOB))).toEqual([])
  })
})

suite('catalogue matching', () => {
  it('is offered for pendulums, and not for its neighbours', () => {
    for (const station of ['Pendulums', 'The simple pendulum', 'Period of a pendulum', 'Investigating a pendulum', 'Timing oscillations', 'What affects the swing of a pendulum']) {
      expect(scenesFor(station).map((e) => e.id), station).toContain('pendulum')
      expect(sceneCatalogue(station), station).toContain('SCENE "pendulum"')
    }
    for (const station of ['Springs and Hooke\'s law', 'Waves and frequency', 'Energy stores and transfers', 'Planning a fair test', 'Telling the time']) {
      expect(scenesFor(station).map((e) => e.id), station).not.toContain('pendulum')
    }
  })
})

suite('the card', () => {
  it('renders every task with no answer before marking, on the server', () => {
    for (const config of allConfigs().filter((_, i) => i % 7 === 0)) {
      const html = render(config, E.initial(config))
      expect(html).toContain('Goal')
      expect(html).toContain(goalText(config))
      expect(html).toContain('One swing')
      expect(html).not.toMatch(/data-done/)
      expect(html).not.toMatch(/made no difference|the goal time|quicker than|slower than|longer string took/)
      expect(html.match(/aria-pressed/g)).toHaveLength(8)
      expect(html).not.toMatch(/disabled=""/)
      expect(html).toContain('aria-label="Release the pendulum and time ten swings"')
      for (const l of ['String 25 centimetres', 'String 1 metre', 'Wooden bob, 50 grams', 'Steel bob, 500 grams', 'Pull back 5 degrees', 'Pull back 10 degrees']) expect(html).toContain(`aria-label="${l}"`)
    }
  })

  it('does not tell the answer in the screen-reader text, even after timings, before marking', () => {
    for (const config of allConfigs().filter((_, i) => i % 5 === 0)) {
      for (const state of [E.initial(config), E.solve(config)]) {
        const words = render(config, state).replace(/ class="[^"]*"/g, '').replace(/<style>[\s\S]*?<\/style>/g, '')
        expect(words).not.toMatch(/\b(?:correct|incorrect|wrong|right|solved|well done)\b/i)
        expect(words).not.toMatch(/made no difference|the goal time|quicker than the goal|slower than the goal|longer string took|Two or more things/)
      }
    }
  })

  it('shows Stop while swinging, Time again after a timing, and the sum when timed', () => {
    const swing = render(CHANGE, { ...E.initial(CHANGE), phase: 'swinging', runId: 1 })
    expect(swing).toContain('aria-label="Stop the pendulum and the stopwatch"')
    expect(swing).toMatch(/disabled=""/)
    const t = render(CHANGE, timed([START]))
    expect(t).toContain('Time again')
    expect(t).toContain('1.42 s')
    expect(t).toContain('÷ 10')
    expect(render(CHANGE, { ...timed([START]), lengthCm: 75, phase: 'set' })).not.toContain('Time again')
  })

  it('shows the verdict once marked, and locks the buttons', () => {
    const right = render(CHANGE, E.solve(CHANGE), 'right')
    expect(right).toContain('slower than the 1.42 s it started at')
    expect(right).toContain('data-done="1"')
    expect(right).toContain('disabled=""')
    const wrong = render(COMPARE_BOB, timed([START, { ...START, bob: 'steel', pullDeg: 10 }]), 'wrong')
    expect(wrong).toContain('Two or more things changed')
    expect(wrong).toContain('data-done="0"')
    const shown = render(COMPARE_PULL, E.initial(COMPARE_PULL), 'shown')
    expect(shown).toContain('Pulled back 5° and 10°')
    expect(shown).toContain('data-done="1"')
  })

  it('still renders with reduced motion and with an unreadable config', () => {
    expect(render(MATCH, timed([{ ...START, lengthCm: 100 }]), 'idle', true)).toContain('2.01 s')
    expect(render({ kind: 'other', asked: 'x', start: START }, E.initial(MATCH))).toBe('')
    expect(render({ kind: 'match', targetCm: 30, start: START }, E.initial(MATCH))).toBe('')
  })

  it('renders inside the activity node', () => {
    const html = renderToStaticMarkup(
      createElement(ReactFlowProvider, null, createElement(ActivityNode, {
        id: 'n', type: 'activity', selected: false, dragging: false, zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0,
        data: { spec: { pattern: 'scene', prompt: EXAMPLES[1].prompt, payload: { engine: 'pendulum', config: CHANGE }, success: { kind: 'scene' } }, work: E.initial(CHANGE), status: 'open' },
      } as never)),
    )
    expect(html).toContain('Release')
  })
})
