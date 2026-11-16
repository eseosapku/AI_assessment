// lib/studylab/engines/function-machine/function-machine.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  fmEngine as engine, applyStep, done, fmt, firstMiss, madeText, nthTerm, outputOf, readState, stages, tilesAt, undoOf, working,
  DIAL_A, DIAL_B, OPERAND, PLUS_MAX, PLUS_MIN, STEP_MAX, STEP_MIN, STEPS_MAX, TEXT_MAX, TIMES_MAX, TIMES_MIN, X_MAX, X_MIN,
  type FmConfig, type FmState, type Op, type Step,
} from './config'
import {
  CAP_GAP, DROP, DWELL, FIG_BASE, FIG_X, FunctionMachineView, H_INVERSE, H_PATTERN, HOLD, SPEED, TILE_PITCH, TILE_SIZE, W, capColumns, capHeight, cycleOf,
  figureTiles, rideAt, stationCentres, stationWidth, ticketWidth,
} from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const OPS: Op[] = ['+', '−', '×', '÷']
const operands = (op: Op): number[] => (op === '×' || op === '÷' ? [2, 3, 5, 10] : [1, 4, 9, 30])
const singles: Step[] = OPS.flatMap((op) => operands(op).map((by) => ({ op, by })))
// Every one-step machine, every two-step machine from those, and a deterministic spread of three-step ones.
const MACHINES: Step[][] = [
  ...singles.map((s) => [s]),
  ...singles.flatMap((a) => singles.map((b) => [a, b])),
  ...Array.from({ length: 150 }, (_, i) => [singles[(i * 7) % singles.length], singles[(i * 11 + 3) % singles.length], singles[(i * 13 + 5) % singles.length]]),
]
const INPUTS = [-20, -3, 0, 1, 7, 50]
const INVERSES: FmConfig[] = MACHINES.flatMap((steps) => INPUTS.map((input) => ({ task: 'inverse' as const, steps, input })))
const VALID_INVERSES = INVERSES.filter((c) => engine.faults(c).length === 0)
const PATTERNS: FmConfig[] = []
for (let times = TIMES_MIN; times <= TIMES_MAX; times++) for (let plus = PLUS_MIN; plus <= PLUS_MAX; plus++) PATTERNS.push({ task: 'pattern', times, plus })
const VALID_PATTERNS = PATTERNS.filter((c) => engine.faults(c).length === 0)
const ALL = [...VALID_INVERSES, ...VALID_PATTERNS]
const name = (c: FmConfig) => JSON.stringify(c)

describe('exact numbers', () => {
  it('runs a number through the stations without a float', () => {
    const steps: Step[] = [{ op: '×', by: 3 }, { op: '+', by: 2 }]
    expect(stages(steps, 5).map(fmt)).toEqual(['5', '15', '17'])
    expect(stages([{ op: '÷', by: 3 }], 4).map(fmt)).toEqual(['4', '4/3'])
    expect(stages([{ op: '÷', by: 4 }], 3).map(fmt)).toEqual(['3', '0.75'])
    expect(stages([{ op: '−', by: 5 }], 2).map(fmt)).toEqual(['2', '−3'])
    expect(fmt({ n: -7, d: 2 })).toBe('−3.5')
    expect(fmt({ n: 1, d: 8 })).toBe('0.125')
    expect(fmt({ n: 1, d: 16 })).toBe('1/16')
  })

  it('every station is undone by its opposite, for every number', () => {
    for (const s of singles) for (let x = X_MIN; x <= X_MAX; x++) {
      const v = stages([s], x)[1]
      const back = applyStep(v, undoOf(s))
      expect(back, `${s.op}${s.by} ${x}`).toEqual({ n: x, d: 1 })
    }
  })

  it('a machine is one-to-one: two inputs never give the same output', () => {
    for (const steps of MACHINES.slice(0, 300)) {
      const seen = new Set<string>()
      for (let x = X_MIN; x <= X_MAX; x++) {
        const o = outputOf(steps, x)
        const k = `${o.n}/${o.d}`
        expect(seen.has(k), name({ task: 'inverse', steps, input: x })).toBe(false)
        seen.add(k)
      }
    }
  })

  it('writes the nth term the way a book does', () => {
    expect(nthTerm(3, 2)).toBe('3n + 2')
    expect(nthTerm(1, 4)).toBe('n + 4')
    expect(nthTerm(4, -1)).toBe('4n − 1')
    expect(nthTerm(5, 0)).toBe('5n')
  })
})

describe('every valid configuration', { timeout: 30_000 }, () => {
  it('enumerates a real spread', () => {
    expect(VALID_INVERSES.length).toBeGreaterThan(1000)
    // For each group size a, the extra runs from -(a - 1) to 6; times 1 with plus 0 is refused.
    expect(VALID_PATTERNS.length).toBe([1, 2, 3, 4, 5].reduce((n, a) => n + 6 + a, 0) - 1)
  })

  it('starts unsolved and can always be solved', () => {
    for (const c of ALL) {
      expect(engine.check(c, engine.initial(c)).ok, `initial ${name(c)}`).toBe(false)
      expect(engine.check(c, engine.solve(c)).ok, `solve ${name(c)}`).toBe(true)
    }
  })

  it('an inverse is solved by one number only', () => {
    for (const c of VALID_INVERSES.filter((_, i) => i % 7 === 0)) {
      if (c.task !== 'inverse') continue
      for (let x = X_MIN; x <= X_MAX; x++) expect(done(c, { x, a: 1, b: 0 }), `${name(c)} ${x}`).toBe(x === c.input)
    }
  })

  it('a pattern is solved by one machine only, and the tiles agree with the rule at every step', () => {
    for (const c of VALID_PATTERNS) {
      if (c.task !== 'pattern') continue
      for (let a = DIAL_A.min; a <= DIAL_A.max; a++) for (let b = DIAL_B.min; b <= DIAL_B.max; b++) {
        const right = a === c.times && b === c.plus
        expect(done(c, { x: 1, a, b }), `${name(c)} ${a},${b}`).toBe(right)
        expect(firstMiss(c, a, b) === null, `${name(c)} ${a},${b}`).toBe(right)
      }
      for (let n = STEP_MIN; n <= STEP_MAX; n++) {
        const tiles = figureTiles(c.times, c.plus, n).filter((t) => !t.ghost)
        expect(tiles.length, `${name(c)} step ${n}`).toBe(tilesAt(c.times, c.plus, n))
        expect(tiles.length).toBeGreaterThan(0)
      }
    }
  })

  it('never reads a number off the drawing: a state from nowhere is read safely', () => {
    for (const c of ALL.filter((_, i) => i % 11 === 0)) {
      for (const junk of [null, undefined, {}, { x: 'a' }, { x: 1e9, a: -5, b: 99 }, { x: NaN }, 'x', 4]) {
        const s = readState(c, junk)
        expect(Number.isInteger(s.x) && Number.isInteger(s.a) && Number.isInteger(s.b)).toBe(true)
        expect(() => engine.check(c, junk as FmState)).not.toThrow()
      }
    }
  })

  it('every number on a ticket fits, for every number the learner can feed in', () => {
    for (const c of VALID_INVERSES) {
      if (c.task !== 'inverse') continue
      for (let x = X_MIN; x <= X_MAX; x += 7) for (const v of stages(c.steps, x)) expect(fmt(v).length, `${name(c)} ${x}`).toBeLessThanOrEqual(TEXT_MAX)
    }
  })

  it('what is said once marked is true', () => {
    for (const c of ALL.filter((_, i) => i % 5 === 0)) {
      const right = working(c, engine.solve(c))
      expect(right.lead.startsWith('Yes.')).toBe(true)
      if (c.task === 'inverse') {
        expect(right.lead).toContain(`${fmt({ n: c.input, d: 1 })} goes in and ${fmt(outputOf(c.steps, c.input))} comes out`)
        // The working back ends on the number that went in.
        expect(right.detail.endsWith(`= ${fmt({ n: c.input, d: 1 })}.`), name(c)).toBe(true)
      } else {
        expect(right.lead).toContain(nthTerm(c.times, c.plus))
        expect(right.detail).toContain(`${tilesAt(c.times, c.plus, 10)} tiles`)
      }
    }
  })

  it('says what was made when wrong, with the real numbers', () => {
    const c: FmConfig = { task: 'inverse', steps: [{ op: '×', by: 3 }, { op: '+', by: 2 }], input: 5 }
    expect(madeText(c, { x: 6, a: 1, b: 0 })).toBe('6 goes in and 20 comes out, but 17 was wanted.')
    const p: FmConfig = { task: 'pattern', times: 3, plus: 2 }
    expect(madeText(p, { x: 1, a: 3, b: 1 })).toBe('At step 1 your machine gives 4, but that figure has 5 tiles.')
    expect(madeText(p, { x: 1, a: 2, b: 5 })).toBe('At step 1 your machine gives 7, but that figure has 5 tiles.')
    expect(madeText(p, { x: 1, a: 4, b: 1 })).toBe('At step 2 your machine gives 9, but that figure has 8 tiles.')
  })
})

describe('reading the config', () => {
  const read = (raw: unknown) => engine.parse(raw)

  it('reads the shapes a tutor writes', () => {
    expect(read({ task: 'inverse', steps: ['×3', '+2'], input: 5 })).toEqual({ task: 'inverse', steps: [{ op: '×', by: 3 }, { op: '+', by: 2 }], input: 5 })
    expect(read({ task: 'inverse', machine: 'times 3 then add 2', input: 5 })).toEqual(read({ task: 'inverse', steps: ['×3', '+2'], input: 5 }))
    expect(read({ task: 'function machine', steps: ['multiply by 3', 'add 2'], input: 5 })).toEqual(read({ steps: ['x3', '+ 2'], start: 5 }))
    expect(read({ steps: [{ op: 'times', by: 3 }, { operation: 'plus', value: 2 }], input: '5' })).toEqual(read({ steps: ['×3', '+2'], input: 5 }))
    expect(read({ steps: ['−4', '÷3'], input: 16 })).toEqual({ task: 'inverse', steps: [{ op: '−', by: 4 }, { op: '÷', by: 3 }], input: 16 })
    expect(read({ steps: ['take away 4', 'divide by 3'], input: 16 })).toEqual(read({ steps: ['-4', '/3'], input: 16 }))
    expect(read({ steps: ['double', 'subtract 1'], input: 6 })).toEqual({ task: 'inverse', steps: [{ op: '×', by: 2 }, { op: '−', by: 1 }], input: 6 })
    expect(read({ task: { kind: 'inverse', steps: ['×3'], input: 4 } })).toEqual({ task: 'inverse', steps: [{ op: '×', by: 3 }], input: 4 })
    expect(read({ task: 'pattern', times: 3, plus: 2 })).toEqual({ task: 'pattern', times: 3, plus: 2 })
    expect(read({ task: 'nth term', rule: '3n + 2' })).toEqual({ task: 'pattern', times: 3, plus: 2 })
    expect(read({ rule: '4n − 1' })).toEqual({ task: 'pattern', times: 4, plus: -1 })
    expect(read({ rule: 'n+5' })).toEqual({ task: 'pattern', times: 1, plus: 5 })
    expect(read({ rule: 'nth term = 5n' })).toEqual({ task: 'pattern', times: 5, plus: 0 })
    expect(read({ first: 5, difference: 3 })).toEqual({ task: 'pattern', times: 3, plus: 2 })
    expect(read({ task: 'pattern', times: '2', plus: '-1' })).toEqual({ task: 'pattern', times: 2, plus: -1 })
  })

  it('works out the input from a wanted output, and picks one when none is given', () => {
    expect(read({ steps: ['×3', '+2'], output: 17 })).toEqual(read({ steps: ['×3', '+2'], input: 5 }))
    const c = read({ steps: ['÷4', '+1'] })
    expect(c && c.task === 'inverse' && Number.isInteger(c.input)).toBe(true)
    expect(c && engine.faults(c)).toEqual([])
    const odd = read({ steps: ['×3'], output: 10 })!
    expect(engine.faults(odd).join(' ')).toMatch(/whole number/)
  })

  it('returns null only for what it cannot read at all', () => {
    for (const bad of [null, undefined, 'x', 5, [], {}, { task: 'inverse' }, { steps: ['wobble 3'] }, { steps: [{ op: 'times' }] }, { steps: 7 }, { rule: 'banana' }, { task: 'pattern', plus: 3 }]) {
      expect(read(bad), JSON.stringify(bad)).toBeNull()
    }
  })

  it('reads a config it will refuse, so the refusal can be explained', () => {
    for (const raw of [
      { steps: ['×3', '+2', '−1', '÷2'], input: 5 }, { steps: [], input: 3 }, { steps: ['×1'], input: 3 }, { steps: ['÷0'], input: 3 }, { steps: ['×2.5'], input: 3 }, { steps: ['+200'], input: 3 },
      { steps: ['×3'], input: 99 }, { steps: ['÷3'], input: 4 }, { steps: ['×3', '÷3'], input: 4 }, { steps: ['÷9', '÷9', '÷9'], input: 729 },
      { task: 'pattern', times: 9, plus: 2 }, { task: 'pattern', times: 3, plus: -5 }, { task: 'pattern', times: 2, plus: -3 }, { task: 'pattern', times: 1, plus: 0 }, { task: 'pattern', times: 2.5, plus: 1 }, { task: 'pattern', times: 0, plus: 4 },
    ]) {
      const c = read(raw)
      expect(c, JSON.stringify(raw)).not.toBeNull()
      expect(engine.faults(c!).length, JSON.stringify(raw)).toBeGreaterThan(0)
    }
  })

  it('refuses with the limit and an example that works', () => {
    const fix = (raw: unknown) => engine.faults(read(raw)!).join(' | ')
    expect(fix({ steps: ['×3', '+2', '−1', '÷2'], input: 5 })).toMatch(/up to 3/)
    expect(fix({ steps: ['×1'], input: 3 })).toMatch(/2 to 10/)
    expect(fix({ steps: ['÷3'], input: 4 })).toMatch(/input 3|input 6/)
    expect(fix({ steps: ['×3'], input: 99 })).toMatch(/-20 to 50.*input 50/)
    expect(fix({ steps: ['×3', '÷3'], input: 4 })).toMatch(/gives back what goes in/)
    expect(fix({ task: 'pattern', times: 9, plus: 2 })).toMatch(/1 to 5.*times 5/)
    expect(fix({ task: 'pattern', times: 2, plus: -3 })).toMatch(/plus -1/)
    expect(fix({ task: 'pattern', times: 1, plus: 0 })).toMatch(/times 3 plus 2/)
    // Each fix is itself a config that passes.
    const good = read({ steps: ['÷3'], input: 6 })!
    expect(engine.faults(good)).toEqual([])
  })

  it('takes the ranges it documents', () => {
    expect(OPERAND['×']).toEqual([2, 10])
    expect(STEPS_MAX).toBe(3)
    expect(PLUS_MIN).toBe(-4)
    expect(PLUS_MAX).toBe(6)
  })
})

describe('the prompt must not give the answer away', () => {
  const inv: FmConfig = { task: 'inverse', steps: [{ op: '×', by: 3 }, { op: '+', by: 2 }], input: 5 }
  const inv2: FmConfig = { task: 'inverse', steps: [{ op: '−', by: 4 }, { op: '÷', by: 3 }], input: 16 }
  const pat: FmConfig = { task: 'pattern', times: 3, plus: 2 }
  const faults = (c: FmConfig, p: string) => engine.promptFaults!(c, p)

  it('refuses a prompt that names the number, or the method, or the rule', () => {
    expect(faults(inv, 'Feed in 5 to the machine.')).not.toEqual([])
    expect(faults(inv, 'Find the number that goes in. Hint: undo each step.')).not.toEqual([])
    expect(faults(inv, 'Work backwards from the wanted number.')).not.toEqual([])
    expect(faults(inv, 'Use the inverse of each step.')).not.toEqual([])
    expect(faults(pat, 'Set the machine to 3n + 2.')).not.toEqual([])
    expect(faults(pat, 'The pattern goes up by 3 each time. Set the machine.')).not.toEqual([])
    expect(faults(pat, 'Set the machine to multiply by 3, then add 2.')).not.toEqual([])
    expect(faults(pat, 'Find the common difference and the constant.')).not.toEqual([])
    expect(faults(pat, 'Each figure has a group of 3 tiles and 2 extra tiles.')).not.toEqual([])
  })

  it('refuses a prompt that promises what the card does not show', () => {
    expect(faults(inv, 'Drag the ticket along the belt until the wanted number comes out.')).not.toEqual([])
    expect(faults(pat, 'Plot the tiles on a graph and write the rule.')).not.toEqual([])
    expect(faults(pat, 'Complete the table of values for each step.')).not.toEqual([])
  })

  it('passes the prompts it asks for', () => {
    expect(faults(inv, 'Tap + and − to feed numbers into the machine. Find the number to feed in so that the wanted number comes out.')).toEqual([])
    expect(faults(inv2, 'Tap + and − to feed numbers into the machine. Find the number to feed in so that the wanted number comes out.')).toEqual([])
    expect(faults(inv, 'Find the number that makes 17 come out. Tap + and − to try numbers.')).toEqual([])
    expect(faults(pat, 'Use Step to grow the pattern, and turn the Times and Add dials until the machine gives the number of tiles in every step.')).toEqual([])
    expect(faults({ task: 'pattern', times: 4, plus: -1 }, 'Grow the pattern with Step, and set the machine so its answer matches the tiles at every step.')).toEqual([])
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"function-machine", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(4)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['inverse', 'pattern']))
  })

  it('every refusal offers a prompt that passes, for every kind of config', () => {
    for (const c of [inv, inv2, pat, { task: 'pattern', times: 5, plus: 0 } as FmConfig]) {
      for (const bad of ['Feed in 5.', 'Work backwards.', 'Set 3n + 2.', 'Draw a graph.']) {
        for (const msg of faults(c, bad)) {
          const quoted = msg.match(/\("([^"]+)"\)/)?.[1]
          expect(quoted, msg).toBeTruthy()
          expect(faults(c, quoted!), msg).toEqual([])
        }
      }
    }
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "function-machine"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'function-machine')

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Function machines', 'Inverse functions', 'Finding the nth term', 'The nth term of a linear sequence', 'Number patterns', 'Growing patterns', 'Linear sequences', 'Mappings', 'Mappings and functions',
      'Unit 3: Sequences, surds and sets', 'Chapter 9: Generating sequences', 'Position-to-term rules', 'Inverse operations', 'Unit 6: More equations, formulae and functions', 'Unit 2: Numerical functions, equations, and inequalities',
      'Composite and inverse functions', 'Number machines', 'Arithmetic sequences', 'Patterns and sequences', 'Visual patterns',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words, or for harder functions', () => {
    for (const st of [
      'Functions of the skeleton', 'Functions in C++ Programming', 'Spreadsheet formulas, functions, and formatting', 'Vitamins and minerals: sources, functions, deficiency', 'Unit 4: Functional components of a computer',
      'Logarithmic and Exponential Functions', 'Unit 7: Polynomial, rational and irrational functions', 'Unit 9: Differentiation of polynomials, rational and irrational functions', 'Trigonometric functions',
      'Unit 4: Limit of polynomial, logarithmic, exponential functions and applications', 'Functions of money', 'Functions of the heart', 'Inverse proportion', 'Inverse square law', 'Inverse matrices',
      'Position, direction and patterns', 'Motifs, Patterns and Design Process', 'UNIT 15: CLASSIFICATION AND PATTERNS OF DISEASE', 'Weather patterns', 'Weaving patterns with raffia', 'Pattern recognition',
      'Mapping skills', 'Map reading', 'DNA sequence', 'Sequence of events', 'Sequencing instructions in an algorithm', 'Input and output devices', 'Simple machines', 'Machine learning', 'Term-time',
      'Sonnets and rhyme schemes', 'Food webs', 'Algebra tiles and equation balance', 'Straight-line graphs', 'Network and internet fundamentals', 'Algorithms and flowcharts', 'Fractions of a bar',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('function-machine')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "function-machine"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:function-machine"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
  })

  it('the limits in its catalogue entry are the limits it marks to', () => {
    expect(engine.prompt).toContain(`a whole number from ${X_MIN} to ${X_MAX}`)
    expect(engine.prompt).toContain(`one to three, each a plain string`)
    expect(engine.prompt).toContain(`${OPERAND['×'][0]} to ${OPERAND['×'][1]}`)
    expect(engine.prompt).toContain(`${OPERAND['+'][0]} to ${OPERAND['+'][1]}`)
    expect(engine.prompt).toContain(`step stepper (${STEP_MIN} to ${STEP_MAX})`)
    expect(engine.prompt).toContain(`${TIMES_MIN} to ${TIMES_MAX}`)
    expect(engine.prompt).toContain(`${PLUS_MIN} to ${PLUS_MAX}`)
  })
})

describe('the picture', { timeout: 30_000 }, () => {
  type Box = { l: number; r: number; t: number; b: number }
  const apart = (a: Box, b: Box) => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t
  const ticket = (cx: number, cy: number, text: string): Box => ({ l: cx - ticketWidth(text) / 2, r: cx + ticketWidth(text) / 2, t: cy - 11, b: cy + 11 })

  it('the numbers written in the view agree with the config', () => {
    expect(W).toBe(360)
    expect(H_INVERSE).toBeLessThan(200)
    expect(H_PATTERN).toBeLessThan(310)
    const html = renderToStaticMarkup(createElement(FunctionMachineView, { config: { task: 'pattern', times: 3, plus: 2 }, state: { x: 1, a: 1, b: 0 }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    // The steppers' ranges, as spin buttons say them.
    expect(html).toContain(`aria-valuemin="${STEP_MIN}" aria-valuemax="${STEP_MAX}"`)
    expect(html).toContain(`aria-valuemin="${DIAL_A.min}" aria-valuemax="${DIAL_A.max}"`)
    expect(html).toContain(`aria-valuemin="${DIAL_B.min}" aria-valuemax="${DIAL_B.max}"`)
    const inv = renderToStaticMarkup(createElement(FunctionMachineView, { config: { task: 'inverse', steps: [{ op: '×', by: 3 }], input: 5 }, state: { x: 0, a: 1, b: 0 }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(inv).toContain(`aria-valuemin="${X_MIN}" aria-valuemax="${X_MAX}"`)
  })

  it('stations, tickets and labels keep clear of each other and of the hopper and tray, for the longest numbers', () => {
    for (const count of [1, 2, 3]) {
      const centres = stationCentres(count)
      const w = stationWidth(count)
      const long = '−19/3'.padEnd(TEXT_MAX, '0')
      const smalls = centres.map((cx) => ticket(cx, 134, long))
      const wanted = ticket(320, 134, long)
      const all = [...smalls, wanted]
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(apart(all[i], all[j]), `count ${count}: ${i} ${j}`).toBe(true)
      // Housings sit between the hopper and the tray, apart from each other.
      centres.forEach((cx, k) => {
        expect(cx - w / 2).toBeGreaterThanOrEqual(76)
        expect(cx + w / 2).toBeLessThanOrEqual(284)
        if (k > 0) expect(cx - w / 2 - (centres[k - 1] + w / 2)).toBeGreaterThanOrEqual(12)
      })
      // Each label sits on its own station's centre, nearer it than any other.
      const html = renderToStaticMarkup(createElement(FunctionMachineView, { config: { task: 'inverse', steps: Array.from({ length: count }, () => ({ op: '+' as const, by: 1 })), input: 5 }, state: { x: 0, a: 1, b: 0 }, setState: () => {}, marked: 'idle', reduced: true, locked: false }))
      centres.forEach((cx, k) => expect(html, `count ${count} step ${k + 1}`).toMatch(new RegExp(`<text x="${cx}" y="162"[^>]*>step ${k + 1}<`)))
    }
    // A six-character ticket fits the hopper's mouth and the tray.
    expect(ticketWidth('−19/30')).toBeLessThanOrEqual(64)
    expect(ticketWidth('0')).toBe(34)
  })

  it('the ride starts in the hopper, passes every station, stops to work at each, and ends in the tray', () => {
    for (const count of [1, 2, 3]) {
      const centres = stationCentres(count)
      const cycle = cycleOf(centres)
      expect(rideAt(centres, 0)!.stage).toBe(0)
      let lastStage = 0
      let lastX = 0
      const busy = new Set<number>()
      for (let t = 0; t < cycle; t += 0.02) {
        const r = rideAt(centres, t)
        if (!r) continue
        expect(r.x).toBeGreaterThanOrEqual(lastX - 1e-9)
        expect(r.stage).toBeGreaterThanOrEqual(lastStage)
        expect(r.stage - lastStage).toBeLessThanOrEqual(1)
        lastX = r.x
        lastStage = r.stage
        if (r.busy >= 0) busy.add(r.busy)
      }
      expect(lastStage).toBe(count)
      expect([...busy].sort()).toEqual(centres.map((_, k) => k))
      expect(rideAt(centres, cycle - 0.01)).toBeNull()
      // A walking pace: the ticket crosses the belt in a few seconds.
      expect(cycle).toBeGreaterThan(4)
      expect(cycle).toBeLessThan(9)
    }
    expect(SPEED).toBeLessThanOrEqual(100)
    expect(DWELL).toBeGreaterThan(DROP / 2)
    expect(HOLD).toBeGreaterThan(0)
  })

  it('every figure keeps its tiles inside the panel and apart, over the machine, with its missing tiles outlined', () => {
    for (const c of VALID_PATTERNS) {
      if (c.task !== 'pattern') continue
      for (let n = STEP_MIN; n <= STEP_MAX; n++) {
        const tiles = figureTiles(c.times, c.plus, n)
        const boxes = tiles.map((t) => ({ l: t.x, r: t.x + TILE_SIZE, t: t.y, b: t.y + TILE_SIZE }))
        for (const b of boxes) {
          expect(b.l, name(c)).toBeGreaterThanOrEqual(FIG_X)
          expect(b.r, name(c)).toBeLessThanOrEqual(W - 20)
          expect(b.t, name(c)).toBeGreaterThanOrEqual(124)
          expect(b.b, name(c)).toBeLessThanOrEqual(FIG_BASE)
        }
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(apart(boxes[i], boxes[j]), `${name(c)} ${n}`).toBe(true)
        expect(tiles.filter((t) => t.ghost).length).toBe(c.plus < 0 ? -c.plus : 0)
      }
    }
    expect(capHeight(1)).toBe(2)
    expect(capColumns(3, 2)).toBe(1)
    expect(capColumns(2, 6)).toBe(3)
    expect(capColumns(3, -1)).toBe(0)
    expect(CAP_GAP).toBeGreaterThan(TILE_PITCH - TILE_SIZE)
  })

  it('the new group arrives on the right and the fixed tiles stay where they are', () => {
    const at = (n: number) => figureTiles(3, 2, n).filter((t) => !t.ghost)
    const one = at(1)
    const two = at(2)
    expect(two.length - one.length).toBe(3)
    for (const t of one) expect(two.some((u) => u.x === t.x && u.y === t.y)).toBe(true)
    const newOnes = two.filter((u) => !one.some((t) => t.x === u.x && t.y === u.y))
    expect(Math.min(...newOnes.map((t) => t.x))).toBeGreaterThan(Math.max(...one.map((t) => t.x)))
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'function-machine', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: FmConfig, state: FmState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(FunctionMachineView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')
  const INV: FmConfig = { task: 'inverse', steps: [{ op: '×', by: 3 }, { op: '+', by: 2 }], input: 5 }
  const PAT: FmConfig = { task: 'pattern', times: 3, plus: 2 }
  const INV_PROMPT = 'Tap + and − to feed numbers into the machine. Find the number to feed in so that the wanted number comes out.'
  const PAT_PROMPT = 'Use Step to grow the pattern, and turn the Times and Add dials until the machine gives the number of tiles in every step.'

  it('before marking, nothing says the answer, the method or the rule', () => {
    for (const [cfg, prompt] of [[INV, INV_PROMPT], [PAT, PAT_PROMPT], [{ task: 'inverse', steps: [{ op: '−', by: 4 }, { op: '÷', by: 3 }], input: 16 }, INV_PROMPT], [{ task: 'pattern', times: 4, plus: -1 }, PAT_PROMPT]] as [FmConfig, string][]) {
      const html = card(cfg, prompt)
      expect(html, name(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      for (const secret of ['Yes', 'goes in and', 'was wanted', 'backwards', 'undo', 'Undo', 'inverse', 'Every step adds', 'Step 10', 'never change', 'nth', 'tiles in step n', 'but that figure has', 'still short']) {
        expect(shown, `${secret} in ${name(cfg)}`).not.toContain(secret)
      }
    }
    // The rule is not in the picture either: the plates are the learner's dials, not the pattern's.
    const pat = text(raw(PAT, { x: 1, a: 1, b: 0 }, 'idle'))
    expect(pat).not.toContain('×3')
    expect(pat).not.toContain('+2')
    expect(attrs(raw(PAT, { x: 1, a: 1, b: 0 }, 'idle'))).not.toMatch(/multiplies by 3|adds 2/)
  })

  it('the secret input is not on the card until the learner feeds it', () => {
    const html = raw(INV, { x: 0, a: 1, b: 0 }, 'idle')
    // The hopper shows what was fed (0); the wanted number is shown; the input 5 appears nowhere as a ticket.
    expect(html).toContain('data-wanted="17"')
    expect(html.match(/data-ticket/g)!.length).toBeGreaterThan(3)
    expect(text(html)).not.toMatch(/(^|\s)5(\s|$)/)
  })

  it('names what it draws, on the card, before marking', () => {
    const inv = text(raw(INV, { x: 0, a: 1, b: 0 }, 'idle'))
    for (const word of ['Input', 'Output', 'Wanted', 'step 1', 'step 2', 'Feed in', '×3', '+2']) expect(inv).toContain(word)
    const pat = text(raw(PAT, { x: 2, a: 1, b: 0 }, 'idle'))
    for (const word of ['Step', 'Output', 'Times', 'Add', 'Step 2: 8 tiles']) expect(pat).toContain(word)
    expect(text(raw({ task: 'pattern', times: 4, plus: -1 }, { x: 1, a: 1, b: 0 }, 'idle'))).toContain('A dashed square is a tile that is missing')
    expect(pat).not.toContain('dashed square')
  })

  it('a small move changes the picture: the plates, the tickets and the tiles', () => {
    const a = raw(INV, { x: 0, a: 1, b: 0 }, 'idle', true)
    const b = raw(INV, { x: 1, a: 1, b: 0 }, 'idle', true)
    expect(a).not.toEqual(b)
    expect(attrs(b)).toContain('1 is fed in and 5 comes out')
    expect(attrs(a)).toContain('0 is fed in and 2 comes out')
    const p1 = raw(PAT, { x: 1, a: 1, b: 0 }, 'idle', true)
    const p2 = raw(PAT, { x: 2, a: 1, b: 0 }, 'idle', true)
    expect([...p2.matchAll(/data-tile="tile"/g)].length - [...p1.matchAll(/data-tile="tile"/g)].length).toBe(3)
    const d1 = raw(PAT, { x: 1, a: 1, b: 0 }, 'idle', true)
    const d2 = raw(PAT, { x: 1, a: 2, b: 0 }, 'idle', true)
    expect(d1).not.toEqual(d2)
    expect(text(d2)).toContain('×2')
  })

  it('reduced motion draws a still frame with no moving ticket, and every part still there', () => {
    const html = raw(INV, { x: 3, a: 1, b: 0 }, 'idle', true)
    expect(html).not.toMatch(/animate|style="[^"]*transition/)
    expect(html).toContain('data-part="hopper"')
    expect(html).toContain('data-part="tray"')
    expect(html).toContain('data-after="1"')
    expect([...html.matchAll(/data-ticket="paper"/g)].length).toBe(2)
  })

  it('marking says the number and the machine run backwards, or the rule and what it means', () => {
    expect(text(raw(INV, { x: 5, a: 1, b: 0 }, 'right'))).toContain('5 goes in and 17 comes out.')
    expect(text(raw(INV, { x: 5, a: 1, b: 0 }, 'right'))).toContain('17 − 2 = 15, then 15 ÷ 3 = 5')
    expect(text(raw(INV, { x: 6, a: 1, b: 0 }, 'wrong'))).toContain('6 goes in and 20 comes out, but 17 was wanted.')
    expect(text(raw(PAT, { x: 1, a: 3, b: 2 }, 'right'))).toContain('3n + 2')
    expect(text(raw(PAT, { x: 1, a: 3, b: 2 }, 'right'))).toContain('Step 10 would have 32 tiles')
    expect(text(raw(PAT, { x: 2, a: 3, b: 1 }, 'wrong'))).toContain('At step 1 your machine gives 4, but that figure has 5 tiles.')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const inv = raw(INV, { x: 0, a: 1, b: 0 }, 'shown')
    expect(inv).toContain('aria-valuenow="5"')
    const pat = raw(PAT, { x: 3, a: 1, b: 0 }, 'shown')
    expect(pat).toContain('aria-valuenow="3"')
    expect(text(pat)).toContain('×3')
    expect(text(pat)).toContain('+2')
    expect(text(pat)).toContain('Step 3: 11 tiles')
  })

  it('every control is a real button with its own label, and locks when solved', () => {
    for (const cfg of [INV, PAT]) {
      const html = raw(cfg, { x: 2, a: 2, b: 1 }, 'idle')
      const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0])
      expect(buttons.length).toBe(cfg.task === 'inverse' ? 2 : 6)
      for (const b of buttons) expect(b).toMatch(/aria-label="(Lower|Raise) the [a-z ]+"/)
      expect(new Set(buttons.map((b) => b.match(/aria-label="([^"]*)"/)![1])).size).toBe(buttons.length)
      expect([...html.matchAll(/role="spinbutton"/g)].length).toBe(cfg.task === 'inverse' ? 1 : 3)
      const locked = raw(cfg, { x: 5, a: 3, b: 2 }, 'right')
      expect([...locked.matchAll(/<button[^>]*disabled/g)].length).toBe(buttons.length)
    }
  })

  it('the keyboard help shows only for the keyboard, and nothing is smaller than 12px', () => {
    const html = raw(INV, { x: 0, a: 1, b: 0 }, 'idle')
    expect(html).toContain('fm-kbd hidden')
    expect(html).toContain('focus-visible')
    for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    expect(html).not.toMatch(/capitalize|uppercase/)
  })
})
