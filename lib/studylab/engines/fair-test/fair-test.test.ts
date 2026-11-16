// lib/studylab/engines/fair-test/fair-test.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  fairTestEngine as engine, FACTORS, FACTOR_INFO, FLAWS, REPEAT_FACTORS, RUNS_MAX, RUNS_NEEDED,
  differing, distances, done, rollDistance, fairNow, goodPrompt, laneA, laneB, leader, madeText, meanOf, nextFactor, runsDone, truth, working,
  type FairConfig, type FairState,
} from './config'
import type { Setup } from './config'
import { FLOOR, FOOT, HALF, K, LANE_H, LANE_Y, PXCM, RAMP_THICK, BOOK, SLAB, W, H, X0, FairTestView, dotAt, poseAt, poseOnFloor, poseOnRamp, rampOf } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const PLANS: FairConfig[] = FACTORS.map((change) => ({ task: 'plan' as const, change }))
const FIXES: FairConfig[] = FACTORS.flatMap((change) => FLAWS.map((flaw) => ({ task: 'fix' as const, change, flaw })))
const REPEATS: FairConfig[] = REPEAT_FACTORS.map((change) => ({ task: 'repeat' as const, change }))
const ALL = [...PLANS, ...FIXES, ...REPEATS]
const nameOf = (c: FairConfig) => JSON.stringify(c)

/** Every state a learner can reach on a plan or fix bench: each subset of the four factors. */
const subsets = (): FairState[] => Array.from({ length: 16 }, (_, bits) => ({ diff: FACTORS.filter((_, i) => bits & (1 << i)) as string[] }))

describe('the rule of a fair test, from first principles', () => {
  it('is fair exactly when the factor under test is the only one that differs, in every state', () => {
    for (const c of [...PLANS, ...FIXES]) {
      for (const s of subsets()) {
        const d = s.diff!
        expect(done(c, s), `${nameOf(c)} ${d}`).toBe(d.length === 1 && d[0] === c.change)
        expect(fairNow(c, s)).toBe(done(c, s))
        expect(engine.check(c, s).ok).toBe(done(c, s))
      }
    }
  })

  it('names what is wrong when it is wrong, and nothing when it is right', () => {
    const c: FairConfig = { task: 'plan', change: 'height' }
    expect(engine.check(c, { diff: ['height', 'floor'] }).wrongIds).toEqual(['floor'])
    expect(engine.check(c, { diff: ['floor'] }).wrongIds).toEqual(['floor', 'height'])
    expect(engine.check(c, { diff: [] }).wrongIds).toEqual(['height'])
    expect(engine.check(c, { diff: ['height'] })).toEqual({ ok: true, wrongIds: [] })
  })

  it('reads only the factors it knows, once each, in the bench order', () => {
    const c: FairConfig = { task: 'plan', change: 'height' }
    expect(differing(c, { diff: ['floor', 'floor', 'nonsense', 'height'] })).toEqual(['height', 'floor'])
    expect(differing(c, { diff: 'height' as never })).toEqual([])
    expect(differing(c, undefined as never)).toEqual([])
    expect(differing({ task: 'repeat', change: 'ramp' }, {})).toEqual(['ramp'])
  })

  it('lane A is always the first setting, and lane B takes the one other thing for each factor it differs in', () => {
    expect(laneA).toEqual({ books: 2, load: false, sandpaper: false, carpet: false })
    const c: FairConfig = { task: 'plan', change: 'height' }
    expect(laneB(c, { diff: [] })).toEqual(laneA)
    expect(laneB(c, { diff: ['height', 'load', 'ramp', 'floor'] })).toEqual({ books: 4, load: true, sandpaper: true, carpet: true })
    expect(laneB({ task: 'repeat', change: 'floor' }, {})).toEqual({ ...laneA, carpet: true })
  })
})

describe('every valid config: starts unsolved, and can always be solved', { timeout: 30_000 }, () => {
  it('has the configs it should', () => {
    expect(PLANS).toHaveLength(4)
    expect(FIXES).toHaveLength(8)
    expect(REPEATS).toHaveLength(3)
  })

  it('initial never passes, solve always passes, and neither is refused by faults', () => {
    for (const c of ALL) {
      expect(engine.faults(c), nameOf(c)).toEqual([])
      expect(engine.check(c, engine.initial(c)).ok, nameOf(c)).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, nameOf(c)).toBe(true)
      // The marked card too: reading state that came back from a save.
      expect(engine.check(c, JSON.parse(JSON.stringify(engine.solve(c)))).ok, nameOf(c)).toBe(true)
    }
  })

  it('a fix bench starts unfair in the way its flaw says, never already fair', () => {
    for (const change of FACTORS) {
      const next = nextFactor(change)
      expect(next).not.toBe(change)
      expect(engine.initial({ task: 'fix', change, flaw: 'extra' })).toEqual({ diff: [change, next] })
      expect(engine.initial({ task: 'fix', change, flaw: 'swapped' })).toEqual({ diff: [next] })
    }
    expect(engine.initial({ task: 'plan', change: 'load' })).toEqual({ diff: [] })
  })

  it('a bench you cannot clear has no state that passes by accident: only the one set of buttons passes', () => {
    for (const c of [...PLANS, ...FIXES]) {
      const passing = subsets().filter((s) => engine.check(c, s).ok)
      expect(passing, nameOf(c)).toEqual([{ diff: [c.change] }])
    }
  })

  it('the solved state shows lane B differing in exactly the factor under test', () => {
    for (const c of [...PLANS, ...FIXES]) {
      const solved = engine.solve(c)
      expect(differing(c, solved)).toEqual([c.change])
    }
  })
})

describe('the repeat data', () => {
  it('the first run or two put the wrong lane ahead, and every count from three on puts the right one ahead', () => {
    for (const c of REPEATS) {
      const t = truth(c.change)
      for (let n = 1; n < RUNS_NEEDED; n++) expect(leader(c.change, n), `${c.change} after ${n}`).not.toBe(t)
      for (let n = RUNS_NEEDED; n <= RUNS_MAX; n++) expect(leader(c.change, n), `${c.change} after ${n}`).toBe(t)
    }
  })

  it('has the real directions: a higher ramp goes further, sandpaper and carpet cut the distance', () => {
    expect(truth('height')).toBe('B')
    expect(truth('ramp')).toBe('A')
    expect(truth('floor')).toBe('A')
    const h = distances('height', RUNS_MAX)
    expect(meanOf(h.b)).toBeGreaterThan(meanOf(h.a))
    const f = distances('floor', RUNS_MAX)
    expect(meanOf(f.a)).toBeGreaterThan(meanOf(f.b))
  })

  it('every distance is a whole number of centimetres that fits the ruler, and the lanes are never equal on a run', () => {
    for (const c of REPEATS) {
      const { a, b } = distances(c.change, RUNS_MAX)
      expect(a).toHaveLength(RUNS_MAX)
      for (const x of [...a, ...b]) {
        expect(Number.isInteger(x)).toBe(true)
        expect(x).toBeGreaterThan(10)
        expect(x).toBeLessThan(95)
      }
    }
  })

  it('takes three runs, no fewer, and no more than six', () => {
    const c: FairConfig = { task: 'repeat', change: 'height' }
    for (let n = 0; n <= 8; n++) {
      expect(done(c, { runs: n }), `${n} runs`).toBe(Math.min(n, RUNS_MAX) >= RUNS_NEEDED)
    }
    expect(runsDone(c, { runs: 9 })).toBe(RUNS_MAX)
    expect(runsDone(c, { runs: -2 })).toBe(0)
    expect(runsDone(c, { runs: Number.NaN })).toBe(0)
    expect(runsDone(c, { runs: '4' as never })).toBe(0)
    expect(runsDone({ task: 'plan', change: 'height' }, { runs: 5 })).toBe(0)
  })

  it('a card saved with runs or diff of the wrong shape cannot crash marking', () => {
    for (const c of ALL) {
      for (const bad of [{}, { runs: 'x', diff: 3 }, null, undefined, { diff: [null, 4] }] as unknown[]) {
        expect(() => engine.check(c, bad as FairState)).not.toThrow()
        expect(() => madeText(c, (bad ?? {}) as FairState)).not.toThrow()
      }
    }
  })
})

describe('what is said once marked', () => {
  it('right: says what the learner found, in the words of the lesson', () => {
    const plan = working({ task: 'plan', change: 'height' }, { diff: ['height'] })
    expect(plan).toMatch(/^Yes\. Lane B changes only the ramp height\./)
    expect(plan).toMatch(/Lane A rolled 60 cm and lane B 82 cm, and as the rest stay the same/)
    const load = working({ task: 'plan', change: 'load' }, { diff: ['load'] })
    expect(load).toMatch(/lane B 70 cm/)
    expect(load).toMatch(/not which change caused it/)
    const rep = working({ task: 'repeat', change: 'height' }, { runs: 3 })
    expect(rep).toMatch(/^Yes\. 3 runs: lane A averaged 64 cm and lane B 74 cm\./)
    expect(rep).toMatch(/first run put lane A ahead/)
  })

  it('wrong: says what the learner made, and never what to do', () => {
    const c: FairConfig = { task: 'plan', change: 'height' }
    expect(madeText(c, { diff: [] })).toMatch(/exactly like lane A/)
    expect(madeText(c, { diff: ['floor'] })).toMatch(/differs in floor surface, but not in ramp height/)
    expect(madeText(c, { diff: ['height', 'ramp', 'load'] })).toMatch(/differs in car load, ramp surface and ramp height|differs in ramp height, car load and ramp surface/)
    expect(madeText({ task: 'repeat', change: 'height' }, { runs: 0 })).toMatch(/Nothing has been rolled/)
    const one = madeText({ task: 'repeat', change: 'height' }, { runs: 1 })
    expect(one).toMatch(/After 1 run lane A is ahead/)
    expect(one).toMatch(/could still be chance/)
    for (const t of [madeText(c, { diff: [] }), one]) expect(t).not.toMatch(/\bshould\b|\bmust\b|\btry\b/)
  })
})

describe('reading the tutor’s config', () => {
  const p = (raw: unknown) => engine.parse(raw)

  it('reads the three tasks and their usual names', () => {
    expect(p({ task: 'plan', change: 'height' })).toEqual({ task: 'plan', change: 'height' })
    expect(p({ task: 'fix', change: 'floor', flaw: 'extra' })).toEqual({ task: 'fix', change: 'floor', flaw: 'extra' })
    expect(p({ task: 'repeat', change: 'ramp' })).toEqual({ task: 'repeat', change: 'ramp' })
    expect(p({ task: 'Fair Test', variable: 'steepness' })).toEqual({ task: 'plan', change: 'height' })
    expect(p({ task: 'unfair test', factor: 'weight', fault: 'wrong thing' })).toEqual({ task: 'fix', change: 'load', flaw: 'swapped' })
    expect(p({ kind: 'reliability', change: 'carpet' })).toEqual({ task: 'repeat', change: 'floor' })
    expect(p({ task: 'repeat readings', change: 'sandpaper' })).toEqual({ task: 'repeat', change: 'ramp' })
  })

  it('reads the factor by the many ways it is said', () => {
    const ch = (v: string) => (p({ task: 'plan', change: v }) as { change: string }).change
    for (const v of ['height', 'Ramp height', 'the height of the ramp', 'steepness', 'slope', 'number of books', 'incline', 'ramp-height']) expect(ch(v), v).toBe('height')
    for (const v of ['load', 'car load', 'weight', 'mass of the car', 'the weight of the car', 'blocks']) expect(ch(v), v).toBe('load')
    for (const v of ['ramp', 'ramp surface', 'surface of the ramp', 'sandpaper', 'friction on the ramp', 'ramp texture']) expect(ch(v), v).toBe('ramp')
    for (const v of ['floor', 'floor surface', 'carpet', 'the ground', 'surface']) expect(ch(v), v).toBe('floor')
  })

  it('works out the task when it is not said, and fills in what is missing', () => {
    expect(p({ change: 'floor' })).toEqual({ task: 'plan', change: 'floor' })
    expect(p({ flaw: 'swapped' })).toEqual({ task: 'fix', change: 'height', flaw: 'swapped' })
    expect(p({ runs: 2 })).toEqual({ task: 'repeat', change: 'height' })
    expect(p({ task: 'plan' })).toEqual({ task: 'plan', change: 'height' })
    expect(p({ task: 'fix', change: 'load' })).toEqual({ task: 'fix', change: 'load', flaw: 'extra' })
    expect(p({ task: 'fix', change: 'load', flaw: 'two things differ' })).toEqual({ task: 'fix', change: 'load', flaw: 'two-things-differ' })
  })

  it('refuses only what cannot be read at all, and faults says what would work', () => {
    for (const bad of [null, undefined, 3, 'plan', [], {}, { task: 'shuffle' }, { task: 'plan', change: 4 }, { task: 'fix', flaw: 7 }]) expect(p(bad), JSON.stringify(bad)).toBeNull()
    const odd = p({ task: 'plan', change: 'temperature' })!
    expect(odd).toEqual({ task: 'plan', change: 'temperature' })
    expect(engine.faults(odd)[0]).toMatch(/no "temperature" on this bench.*e\.g\. change "height"/)
    const load = p({ task: 'repeat', change: 'weight' })!
    expect(engine.faults(load)[0]).toMatch(/Car load makes no clear difference.*e\.g\. change "height"/)
    const flaw = p({ task: 'fix', change: 'height', flaw: 'too cold' })!
    expect(engine.faults(flaw)[0]).toMatch(/no "too-cold" flaw.*e\.g\. flaw "extra"/)
    expect(engine.faults(p({ task: 'fix', change: 'load', flaw: 'swapped' })!)).toEqual([])
    expect(engine.faults(p({ task: 'plan', change: 'load' })!)).toEqual([])
  })

  it('a refused config still draws without crashing', () => {
    const odd = p({ task: 'repeat', change: 'temperature' })!
    expect(() => renderToStaticMarkup(createElement(FairTestView, { config: odd, state: engine.initial(odd), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
  })
})

describe('what the prompt may and may not say', () => {
  const pf = (c: FairConfig, t: string) => engine.promptFaults!(c, t)

  it('passes the good prompt of every config', () => {
    for (const c of ALL) expect(pf(c, goodPrompt(c)), nameOf(c)).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"fair-test", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(pf(c, f[1]), f[1]).toEqual([])
      expect(f[1]).toBe(goodPrompt(c))
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['plan', 'fix', 'repeat']))
  })

  it('refuses a prompt that says what to keep the same, how many things differ or what is wrong', () => {
    const plan: FairConfig = { task: 'plan', change: 'height' }
    for (const t of [
      'Set up lane B so only the height of the ramp is different.',
      'Test whether the height of the ramp matters, keeping everything else the same.',
      'Change just the height of the ramp in lane B.',
      'Make the test fair by changing one thing: the ramp height.',
      'Tap the buttons so the ramp height differs and the rest are controlled.',
      'Set up lane B for the height of the ramp. Hold the load constant.',
    ]) expect(pf(plan, t).join(' '), t).toMatch(/gives the answer away/)
    const fix: FairConfig = { task: 'fix', change: 'floor', flaw: 'extra' }
    for (const t of [
      'Lane B tests the floor but has an extra difference. Fix it.',
      'Lane B changes too many things when testing the floor the car rolls along.',
      'The floor test is unfair because lane B also has a heavier car.',
      'Lane B tests the floor but you changed the wrong thing. Fix it.',
    ]) expect(pf(fix, t).join(' '), t).toMatch(/gives the answer away/)
  })

  it('refuses a repeat prompt that says how many runs, to average, or which lane goes further', () => {
    const rep: FairConfig = { task: 'repeat', change: 'height' }
    for (const t of [
      'The lanes differ in the height of the ramp. Roll both cars three times.',
      'The lanes differ in the ramp height. Roll at least 3 times and find the average.',
      'Repeat the test on the height of the ramp until you trust it.',
      'The lanes differ in the height of the ramp. Show that lane B goes further.',
      'The lanes differ in the ramp height. Roll the cars until chance stops fooling you.',
      'The lanes differ in the ramp height. Take the mean of several runs.',
    ]) expect(pf(rep, t).join(' '), t).toMatch(/gives the answer away/)
  })

  it('refuses a prompt that promises what the card does not show', () => {
    const plan: FairConfig = { task: 'plan', change: 'height' }
    for (const t of [
      'Tap the buttons to set up a fair test of the height of the ramp and time the car with a stopwatch.',
      'Tap the buttons to test whether the height of the ramp changes the speed of the car.',
      'Tap the buttons to set up a test of ramp height, then plot a graph.',
      'Tap the buttons to test how a plant grows on the windowsill and the ramp height.',
      'Drag the books to set the height of the ramp.',
    ]) expect(pf(plan, t).join(' '), t).toMatch(/promises something the card does not show/)
  })

  it('refuses a prompt that does not name what is tested, or names another factor too', () => {
    const plan: FairConfig = { task: 'plan', change: 'height' }
    expect(pf(plan, 'Tap the buttons to set up lane B as a fair test.').join(' ')).toMatch(/does not name what is being tested.*ramp height/)
    expect(pf(plan, 'Tap the buttons to set up a test of whether the height of the ramp and the floor change how far the car rolls.').join(' ')).toMatch(/names another factor/)
    const load: FairConfig = { task: 'plan', change: 'load' }
    expect(pf(load, 'Tap the buttons to set up a test of whether the height of the ramp changes the distance.').join(' ')).toMatch(/does not name what is being tested.*car load/)
    // Each factor can be named in the ordinary ways.
    expect(pf({ task: 'plan', change: 'load' }, 'Tap the buttons to set up a fair test of whether a heavier car rolls a different distance.')).toEqual([])
    expect(pf({ task: 'plan', change: 'floor' }, 'Tap the buttons to set up a fair test of whether carpet changes how far the car rolls.')).toEqual([])
    expect(pf({ task: 'plan', change: 'ramp' }, 'Tap the buttons to set up a fair test of whether sandpaper on the ramp changes how far the car rolls.')).toEqual([])
    expect(pf({ task: 'plan', change: 'height' }, 'Tap the buttons to set up a fair test of whether a steeper ramp makes the car roll further.')).toEqual([])
  })

  it('every refusal carries an example that passes', () => {
    for (const c of ALL) {
      const refused = pf(c, 'The ramp is the same.')
      expect(refused.length, nameOf(c)).toBeGreaterThan(0)
      for (const msg of refused) {
        const m = msg.match(/\("([^"]*)"\)/)
        expect(m, msg).not.toBeNull()
        expect(pf(c, m![1]), msg).toEqual([])
      }
    }
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "fair-test"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'fair-test')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Planning, analysis and evaluation', 'P1: Practical skills at AS level', 'Fair tests', 'Planning a fair test', 'Planning investigations', 'Scientific enquiry', 'Working scientifically',
      'Controlling variables', 'Independent and dependent variables', 'Identifying variables', 'Repeat readings and reliability', 'Reliable results', 'Planning experiments', 'Practical skills', 'Scientific investigations', 'Repeatability',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words', () => {
    for (const st of [
      'Algebraic variables', 'Variables and constants', 'Variables in programming', 'Variables and data types', 'Variables and expressions', 'Using variables in algebra', 'Discrete random variables', 'Continuous random variables', 'Fixed and variable costs',
      'Independent events and conditional probability', 'Dependent and independent events', 'Fair trade', 'Fairtrade and ethical shopping', 'Fair share and sharing', 'A fair trial', 'Fair play in sport', 'Fair dice and probability', 'Fair division',
      'Hypothesis testing', 'Hypothesis tests', 'Statistical tests', 'Tests for ions', 'Flame tests', 'Test for starch', 'Food tests', 'Gas tests', 'Blood tests', 'Software testing', 'Unit testing', 'Testing and debugging',
      'Practical skills in food preparation', 'Woodwork skills', 'Reliability of sources', 'Reliability of historical sources', 'Reliability engineering', 'Scatter graphs and correlation', 'Regression lines', 'Categorical and continuous variables',
      'Looking after plants', 'Forces and motion', 'Ramps and inclined planes', 'Friction', 'Speed and acceleration', 'Heat and temperature', 'Dissolving', 'Variable resistors', 'Variable stars', 'Variable speed', 'The weather',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('fair-test')).toBe(engine)
    expect(engine.isolates).toBe('membership')
    expect(engine.prompt).toMatch(/SCENE "fair-test"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:fair-test"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const f of FACTORS) expect(engine.prompt).toContain(FACTOR_INFO[f].a)
    expect(engine.prompt).toContain('(up to 6 runs)')
    expect(engine.covers.every((w) => !/\s/.test(w))).toBe(true)
  })
})

describe('how far the cars roll when let go', () => {
  const setups = (): Setup[] => Array.from({ length: 16 }, (_, b) => ({ books: b & 1 ? 4 : 2, load: !!(b & 2), sandpaper: !!(b & 4), carpet: !!(b & 8) }) as Setup)

  it('goes the way the science says, factor by factor, from any starting point', () => {
    for (const s of setups()) {
      expect(rollDistance({ ...s, books: 4 }), 'higher ramp further').toBeGreaterThan(rollDistance({ ...s, books: 2 }))
      expect(rollDistance({ ...s, load: true }), 'load, in this model, further').toBeGreaterThan(rollDistance({ ...s, load: false }))
      expect(rollDistance({ ...s, sandpaper: true }), 'sandpaper shorter').toBeLessThan(rollDistance({ ...s, sandpaper: false }))
      expect(rollDistance({ ...s, carpet: true }), 'carpet shorter').toBeLessThan(rollDistance({ ...s, carpet: false }))
    }
  })

  it('each change is a clear gap on the ruler, and the biggest case stays on it', () => {
    for (const s of setups()) {
      const d = rollDistance(s)
      expect(Number.isInteger(d)).toBe(true)
      expect(d).toBeGreaterThan(10)
      expect(d).toBeLessThanOrEqual(92)
      expect(FOOT + d * PXCM).toBeLessThan(FOOT + 100 * PXCM)
    }
    for (const f of FACTORS) {
      const b = laneB({ task: 'plan', change: f }, { diff: [f] })
      expect(Math.abs(rollDistance(b) - rollDistance(laneA)) * PXCM, f).toBeGreaterThanOrEqual(15)
    }
    expect(rollDistance(laneA)).toBe(60)
  })

  it('rolling is not marking: the state it adds changes no verdict', () => {
    for (const c of [...PLANS, ...FIXES]) {
      for (const s of subsets()) expect(engine.check(c, { ...s, rolled: 3 }).ok).toBe(engine.check(c, s).ok)
    }
  })

  it('an unfair setup still shows a gap, which is why the right card says it cannot name the cause', () => {
    const s = laneB({ task: 'plan', change: 'height' }, { diff: ['height', 'carpet'] })
    expect(rollDistance(s)).not.toBe(rollDistance(laneA))
  })

  it('the card has a Let go button, cars start at the top, and after letting go they have stopped with markers', () => {
    const c: FairConfig = { task: 'plan', change: 'height' }
    const view = (s: FairState, marked: 'idle' | 'right' = 'idle', reduced = true) =>
      renderToStaticMarkup(createElement(FairTestView, { config: c, state: s, setState: () => {}, marked, reduced, locked: marked === 'right' }))
    const before = view({ diff: [] })
    expect(before).toMatch(/aria-label="Let go of both cars"/)
    expect(before).not.toContain('data-stops')
    const after = view({ diff: ['height'], rolled: 1 })
    expect(after).toContain('data-stops')
    expect(after).not.toBe(view({ diff: ['height'] }))
    // Marked right, a still card shows the result of the test, and no answer before then.
    expect(view({ diff: ['height'] }, 'right')).toContain('data-stops')
    expect(before.replace(/<[^>]*>/g, ' ')).not.toMatch(/\d+ cm and/)
  })
})

describe('the drawing', () => {
  it('View constants agree with the config', () => {
    expect(W).toBe(360)
    expect(FACTORS).toHaveLength(4)
    expect(RUNS_MAX).toBe(6)
    expect(laneA.books).toBe(2)
    expect(FACTOR_INFO.height.a).toBe('2 books')
    expect(FACTOR_INFO.height.b).toBe('4 books')
    // The ruler starts where the ramp ends and is wide enough for the furthest run any config makes.
    for (const c of REPEATS) {
      const { a, b } = distances(c.change, RUNS_MAX)
      for (const d of [...a, ...b]) expect(FOOT + d * PXCM, c.change).toBeLessThan(FOOT + 100 * PXCM)
    }
  })

  it('keeps everything inside its lane and the card', () => {
    expect(LANE_Y[1] + LANE_H).toBeLessThan(H)
    expect(LANE_Y[0] + LANE_H).toBeLessThanOrEqual(LANE_Y[1])
    // The tallest thing in a lane: a car with a load at the top of the highest ramp, under the lane's own top.
    const gap = LANE_Y[1] - (LANE_Y[0] + FLOOR + SLAB)
    const top = poseOnRamp(4, 0.14).y - 16 * K
    expect(top).toBeGreaterThan(-gap)
    expect(FLOOR + SLAB).toBeLessThanOrEqual(LANE_H)
    for (const books of [2, 4]) {
      const r = rampOf(books)
      // The ramp rests on the books at its high end and on the floor at its foot.
      expect(r.y0 + RAMP_THICK).toBe(FLOOR - BOOK * books)
      expect(r.y1 + RAMP_THICK).toBe(FLOOR)
      expect(r.y1).toBeGreaterThan(r.y0)
    }
    expect(X0).toBeLessThan(FOOT)
    // The higher ramp is visibly higher: at least a book's thickness over a second one.
    expect(rampOf(2).y0 - rampOf(4).y0).toBeGreaterThanOrEqual(2 * BOOK)
  })

  it('a car rests on its ramp at the start, and on the floor at the end, with its nose where the dot goes', () => {
    for (const books of [2, 4]) {
      const start = poseOnRamp(books, 0.14)
      expect(start.rot).toBeGreaterThan(0)
      expect(start.y).toBeLessThan(FLOOR)
      // The run starts and ends where the still frames are.
      for (const d of [38, 60, 84]) {
        expect(poseAt(books, d, 1)).toEqual(poseOnFloor(d))
        expect(poseAt(books, d, 0).x).toBeCloseTo(poseOnRamp(books, 0.14).x, 5)
        expect(poseOnFloor(d).x + HALF).toBeCloseTo(FOOT + d * PXCM, 5)
      }
    }
    // Mid-run it is always on the way: never behind where it started or past where it stops.
    for (let u = 0; u <= 1; u += 0.05) {
      const p = poseAt(4, 70, u)
      expect(p.x).toBeGreaterThanOrEqual(poseOnRamp(4, 0.14).x - 1e-9)
      expect(p.x).toBeLessThanOrEqual(poseOnFloor(70).x + 1e-9)
    }
  })

  it('no two dots touch, whichever runs have been rolled, and none is under the lane tag', () => {
    for (const c of REPEATS) {
      for (const lane of ['a', 'b'] as const) {
        const rows = distances(c.change, RUNS_MAX)[lane]
        for (let i = 0; i < rows.length; i++) {
          const p = dotAt(rows[i], i)
          expect(p.x, `${c.change} ${lane} ${i}`).toBeGreaterThan(FOOT)
          expect(p.y).toBeGreaterThan(FLOOR + 3.6)
          expect(p.y).toBeLessThan(FLOOR + SLAB - 3.6)
          for (let j = i + 1; j < rows.length; j++) {
            const q = dotAt(rows[j], j)
            expect(Math.hypot(p.x - q.x, p.y - q.y), `${c.change} ${lane} ${i}-${j}`).toBeGreaterThan(8.4)
          }
        }
      }
    }
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'fair-test', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: FairConfig, state: FairState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(FairTestView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('before marking, nothing says the answer, the rule or a mean', () => {
    for (const c of ALL) {
      const html = card(c, goodPrompt(c))
      expect(html, nameOf(c)).toContain('<button')
      const shown = text(html.replace(goodPrompt(c), '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'fair', 'unfair', 'only', 'control', 'chance', 'averag', 'mean', 'could not say', 'nothing to compare', 'exactly like', 'variable', 'stay the same', 'ahead', 'further than']) {
        expect(shown.toLowerCase(), `${secret} in ${nameOf(c)}`).not.toContain(secret.toLowerCase())
      }
    }
    // Partway through a repeat card, with runs on the board, still no mean and no teal bar.
    const mid = raw({ task: 'repeat', change: 'height' }, { runs: 2 }, 'idle')
    expect(mid).not.toContain('data-mean')
    expect(text(mid)).not.toMatch(/averag|\bcm\b[^0-9]*\bahead/)
  })

  it('names what it draws, on the card, before marking', () => {
    const plan = text(raw({ task: 'plan', change: 'height' }, { diff: [] }, 'idle'))
    for (const name of ['Lane A', 'Lane B', 'Let go', 'Ramp height', 'Car load', 'Ramp surface', 'Floor surface', '2 books', '4 books', 'empty', '2 blocks', 'smooth card', 'sandpaper', 'wood', 'carpet', 'cm']) expect(plan).toContain(name)
    const rep = text(raw({ task: 'repeat', change: 'floor' }, { runs: 2 }, 'idle'))
    for (const name of ['Lane A', 'Lane B', 'Runs', 'Roll both cars', 'Clear', 'dot']) expect(rep).toContain(name)
    expect(rep).not.toContain('Ramp height')
  })

  it('the buttons are real buttons with labels, every one, and state which is chosen', () => {
    const html = raw({ task: 'plan', change: 'height' }, { diff: ['height'] }, 'idle')
    const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0])
    expect(buttons).toHaveLength(9)
    for (const b of buttons) {
      expect(b).toMatch(/aria-label="[^"]+"/)
      if (!/Let go/.test(b)) expect(b).toMatch(/aria-pressed="(true|false)"/)
    }
    expect(html).toMatch(/aria-label="Lane B ramp height: 4 books"[^>]*>/)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(4)
    const rep = raw({ task: 'repeat', change: 'height' }, { runs: 0 }, 'idle')
    expect([...rep.matchAll(/<button[^>]*>/g)]).toHaveLength(2)
    expect(rep).toMatch(/aria-label="Roll both cars"/)
  })

  it('each smallest move changes the drawing: the apparatus itself', () => {
    const c: FairConfig = { task: 'plan', change: 'height' }
    const base = raw(c, { diff: [] }, 'idle')
    expect(base).toContain('data-books="2"')
    expect(base).not.toContain('data-books="4"')
    expect(raw(c, { diff: ['height'] }, 'idle')).toContain('data-books="4"')
    expect(raw(c, { diff: ['load'] }, 'idle')).toContain('data-load="1"')
    expect(base).not.toContain('data-load="1"')
    expect(raw(c, { diff: ['ramp'] }, 'idle')).toContain('data-ramp="sandpaper"')
    expect(base).not.toContain('data-ramp="sandpaper"')
    expect(raw(c, { diff: ['floor'] }, 'idle')).toContain('data-floor="carpet"')
    expect(base).not.toContain('data-floor="carpet"')
    // A run adds a dot and moves the car, even with reduced motion, so the still frame changes with each move.
    const r: FairConfig = { task: 'repeat', change: 'height' }
    const before = raw(r, { runs: 1 }, 'idle', true)
    const after = raw(r, { runs: 2 }, 'idle', true)
    expect((before.match(/data-dot=/g) ?? []).length).toBe(2)
    expect((after.match(/data-dot=/g) ?? []).length).toBe(4)
    expect(before).not.toBe(after)
    expect(raw(r, { runs: 0 }, 'idle', true)).not.toContain('data-dot')
  })

  it('shows the solution when it is shown, and locks when it is right', () => {
    const c: FairConfig = { task: 'plan', change: 'floor' }
    const shown = raw(c, { diff: [] }, 'shown')
    expect(shown).toContain('data-floor="carpet"')
    expect(text(shown)).toContain('Yes. Lane B changes only the floor surface.')
    const right = raw(c, { diff: ['floor'] }, 'right')
    expect(right).toMatch(/disabled=""/)
    const rep = raw({ task: 'repeat', change: 'height' }, { runs: 3 }, 'right')
    expect(rep).toContain('data-mean=')
    expect((rep.match(/data-mean=/g) ?? [])).toHaveLength(2)
    const wrong = raw({ task: 'repeat', change: 'height' }, { runs: 1 }, 'wrong')
    expect(text(wrong)).toMatch(/After 1 run lane A is ahead/)
  })

  it('is registered through the card on the board, which shows its view', () => {
    const html = card({ task: 'plan', change: 'height' }, goodPrompt({ task: 'plan', change: 'height' }))
    expect(html).toContain('data-lane="A"')
    expect(html).toContain('data-lane="B"')
  })
})
