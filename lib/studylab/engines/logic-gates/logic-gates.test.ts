// lib/studylab/engines/logic-gates/logic-gates.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  logicGatesEngine as engine, BUILD_IDS, CHOICES, CIRCUITS, CIRCUIT_IDS, OUT_X, defOf, kindsOf, layoutOf, lampOf, madeText, rowSwitches, rowsOf, slotsOf, wantedRow, wiresOf, working, yourRow,
  H as CH, W as CW, type LGConfig, type LGState,
} from './config'
import { H, LogicGatesView, SWITCH_H, SWITCH_W, W } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const ALL: LGConfig[] = [
  ...CIRCUIT_IDS.map((circuit) => ({ task: 'light' as const, circuit })),
  ...BUILD_IDS.map((circuit) => ({ task: 'build' as const, circuit })),
]
const nameOf = (c: LGConfig) => JSON.stringify(c)

/** Every state the learner can reach: each switch setting, and each pick of every changeable gate. */
function everyState(c: LGConfig): LGState[] {
  const def = defOf(c)
  const n = def.inputs.length
  const slots = c.task === 'build' ? slotsOf(def).length : 0
  const out: LGState[] = []
  for (let r = 0; r < 1 << n; r++) {
    for (let code = 0; code < CHOICES.length ** slots; code++) {
      const picks = Array.from({ length: slots }, (_, i) => Math.floor(code / CHOICES.length ** (slots - 1 - i)) % CHOICES.length)
      out.push({ sw: rowSwitches(n, r), seen: [r], picks })
    }
  }
  return out
}

describe('the gates, from first principles', () => {
  const truth = (kind: (typeof CHOICES)[number], a: boolean, b: boolean) => lampOf({ task: 'light', circuit: kind.toLowerCase() }, [a, b], [])
  it('each gate follows its truth table', () => {
    const rows: [boolean, boolean][] = [[false, false], [false, true], [true, false], [true, true]]
    expect(rows.map(([a, b]) => truth('AND', a, b))).toEqual([false, false, false, true])
    expect(rows.map(([a, b]) => truth('OR', a, b))).toEqual([false, true, true, true])
    expect(rows.map(([a, b]) => truth('NAND', a, b))).toEqual([true, true, true, false])
    expect(rows.map(([a, b]) => truth('NOR', a, b))).toEqual([true, false, false, false])
    expect(rows.map(([a, b]) => truth('XOR', a, b))).toEqual([false, true, true, false])
    expect([lampOf({ task: 'light', circuit: 'not' }, [false], []), lampOf({ task: 'light', circuit: 'not' }, [true], [])]).toEqual([true, false])
  })

  it('combined circuits agree with their written expression, over every setting', () => {
    const want: Record<string, (a: boolean, b: boolean, c: boolean) => boolean> = {
      'and-not': (a, b) => a && !b,
      'or-and': (a, b, c) => (a || b) && c,
      'and-or': (a, b, c) => (a && b) || c,
      'three-and': (a, b, c) => a && b && c,
      'and-not-c': (a, b, c) => a && b && !c,
      'xor-and': (a, b, c) => a !== b && c,
    }
    for (const [id, f] of Object.entries(want)) {
      const c: LGConfig = { task: 'light', circuit: id }
      const n = defOf(c).inputs.length
      for (let r = 0; r < 1 << n; r++) {
        const sw = rowSwitches(n, r)
        expect(lampOf(c, sw, []), `${id} ${r}`).toBe(f(sw[0], sw[1] ?? false, sw[2] ?? false))
      }
    }
  })

  it('rows run in counting order with A the leftmost digit', () => {
    expect(rowSwitches(3, 0)).toEqual([false, false, false])
    expect(rowSwitches(3, 1)).toEqual([false, false, true])
    expect(rowSwitches(3, 6)).toEqual([true, true, false])
    expect(rowSwitches(2, 2)).toEqual([true, false])
  })

  it('every circuit has a lamp that is lit for some settings and dark for others', () => {
    for (const id of CIRCUIT_IDS) {
      const row = wantedRow({ task: 'light', circuit: id })
      expect(row.some(Boolean), id).toBe(true)
      expect(row.some((v) => !v), id).toBe(true)
    }
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
    expect(ALL.length).toBeGreaterThanOrEqual(20)
  })

  it('marks exactly by the rule, over every state the learner can reach', () => {
    for (const c of ALL) {
      const def = defOf(c)
      const want = wantedRow(c)
      let right = 0
      for (const s of everyState(c)) {
        const should = c.task === 'light'
          ? lampOf(c, s.sw, s.picks)
          : Array.from({ length: rowsOf(def) }, (_, r) => lampOf(c, rowSwitches(def.inputs.length, r), s.picks)).every((v, r) => v === want[r])
        expect(engine.check(c, s).ok, `${nameOf(c)} ${JSON.stringify(s)}`).toBe(should)
        if (should) right++
      }
      expect(right, nameOf(c)).toBeGreaterThan(0)
    }
  })

  it('build marks the table, not the gates: another circuit with the same table passes', () => {
    // A AND NOT B needs only the AND slot; with the NOT fixed, NOR is wrong, AND is right.
    const c: LGConfig = { task: 'build', circuit: 'and-not' }
    expect(engine.check(c, { sw: [false, false], seen: [0], picks: [CHOICES.indexOf('AND')] }).ok).toBe(true)
    expect(engine.check(c, { sw: [false, false], seen: [0], picks: [CHOICES.indexOf('NOR')] }).ok).toBe(false)
    // (A AND B) OR C: a NAND followed by something else is not the same table.
    const d: LGConfig = { task: 'build', circuit: 'and-or' }
    expect(engine.check(d, { sw: [false, false, false], seen: [0], picks: [CHOICES.indexOf('AND'), CHOICES.indexOf('OR')] }).ok).toBe(true)
    expect(engine.check(d, { sw: [false, false, false], seen: [0], picks: [CHOICES.indexOf('AND'), CHOICES.indexOf('XOR')] }).ok).toBe(false)
  })

  it('light does not care which switches are on as long as the lamp is lit; the build ignores the switches', () => {
    const c: LGConfig = { task: 'light', circuit: 'or' }
    expect(engine.check(c, { sw: [true, true], seen: [3], picks: [] }).ok).toBe(true)
    expect(engine.check(c, { sw: [false, false], seen: [0], picks: [] }).ok).toBe(false)
    const b: LGConfig = { task: 'build', circuit: 'nand' }
    for (let r = 0; r < 4; r++) expect(engine.check(b, { sw: rowSwitches(2, r), seen: [r], picks: [CHOICES.indexOf('NAND')] }).ok).toBe(true)
  })

  it('can always be solved by taps from the start', () => {
    for (const c of ALL) {
      const start = engine.initial(c)
      const end = engine.solve(c)
      if (c.task === 'light') {
        // Flip, one switch at a time, the switches that differ.
        let sw = start.sw
        end.sw.forEach((v, i) => { if (sw[i] !== v) sw = sw.map((b, k) => (k === i ? v : b)) })
        expect(engine.check(c, { ...start, sw }).ok, nameOf(c)).toBe(true)
      } else {
        // Step each gate to its answer: at most CHOICES.length - 1 taps each, forward.
        const picks = start.picks.map((p, i) => { let q = p; for (let k = 0; k < CHOICES.length && q !== end.picks[i]; k++) q = (q + 1) % CHOICES.length; return q })
        expect(engine.check(c, { ...start, picks }).ok, nameOf(c)).toBe(true)
      }
    }
  })

  it('a state that could not have been made reads safely', () => {
    const c: LGConfig = { task: 'light', circuit: 'and' }
    expect(engine.check(c, null as never).ok).toBe(false)
    expect(engine.check(c, { sw: 'x' } as never).ok).toBe(false)
    expect(engine.check(c, { sw: [true], seen: [99], picks: 'x' } as never).ok).toBe(false)
    expect(() => renderToStaticMarkup(createElement(LogicGatesView, { config: c, state: null as never, setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
  })

  it('says something true when marked, and what was made when wrong, never where the answer is', () => {
    for (const c of ALL) {
      const said = working(c, engine.solve(c))
      expect(said.startsWith('Yes.'), nameOf(c)).toBe(true)
      expect(said, nameOf(c)).toContain(defOf(c).explain.slice(0, 12))
      const wrong = madeText(c, engine.initial(c))
      expect(wrong.startsWith('Yes.'), nameOf(c)).toBe(false)
      expect(wrong, nameOf(c)).not.toContain(defOf(c).explain)
    }
    const light: LGConfig = { task: 'light', circuit: 'and-not-c' }
    expect(working(light, engine.solve(light))).toMatch(/A on, B on and C off/)
    expect(madeText(light, engine.initial(light))).toMatch(/The lamp is off with A off, B off and C off/)
    const b: LGConfig = { task: 'build', circuit: 'xor' }
    expect(madeText(b, { sw: [false, false], seen: [0], picks: [CHOICES.indexOf('OR')] })).toMatch(/You chose OR\. With A on and B on your lamp is on, but the wanted row has it off\./)
  })
})

describe('reading the config', () => {
  it('reads reasonable phrasings', () => {
    expect(engine.parse({ task: 'light', circuit: 'AND gate' })).toEqual({ task: 'light', circuit: 'and' })
    expect(engine.parse({ task: 'Build the circuit', circuit: 'NOT gate' })).toEqual({ task: 'build', circuit: 'not' })
    expect(engine.parse({ circuit: 'Inverter' })).toEqual({ task: 'light', circuit: 'not' })
    expect(engine.parse({ task: 'match the truth table', gate: 'exclusive OR' })).toEqual({ task: 'build', circuit: 'xor' })
    expect(engine.parse({ task: 'explore', expression: 'A AND NOT B' })).toEqual({ task: 'light', circuit: 'and-not' })
    expect(engine.parse({ task: 'light', expression: '(A OR B) AND C' })).toEqual({ task: 'light', circuit: 'or-and' })
    expect(engine.parse({ task: 'light', expression: '(A AND B) OR C' })).toEqual({ task: 'light', circuit: 'and-or' })
    expect(engine.parse({ task: 'light', expression: 'A · B + C' })).toEqual({ task: 'light', circuit: 'and-or' })
    expect(engine.parse({ task: 'light', expression: 'A ∧ ¬B' })).toEqual({ task: 'light', circuit: 'and-not' })
    expect(engine.parse({ task: 'light', expression: 'A AND B AND NOT C' })).toEqual({ task: 'light', circuit: 'and-not-c' })
    expect(engine.parse({ task: 'build', circuit: 'NAND gate' })).toEqual({ task: 'build', circuit: 'nand' })
    expect(engine.parse({ task: 'light', circuit: 'and-not-c' })).toEqual({ task: 'light', circuit: 'and-not-c' })
  })

  it('returns null only for what cannot be read at all', () => {
    expect(engine.parse(null)).toBeNull()
    expect(engine.parse('and')).toBeNull()
    expect(engine.parse({})).toBeNull()
    expect(engine.parse({ task: 'dance', circuit: 'and' })).toBeNull()
    expect(engine.parse({ task: 'light' })).toBeNull()
    expect(engine.parse({ task: 'light', circuit: 5 })).toBeNull()
    expect(engine.parse({ task: 'light', circuit: '__proto__' })).not.toBeNull()
    expect(engine.faults(engine.parse({ task: 'light', circuit: '__proto__' })!)).toHaveLength(1)
  })

  it('A OR B AND C is not read as (A OR B) AND C', () => {
    expect(engine.parse({ task: 'light', expression: 'A OR B AND C' })!.circuit).not.toBe('or-and')
  })

  it('refuses only what cannot be drawn, with a nearby example that works', () => {
    const cases: [LGConfig, RegExp][] = [
      [{ task: 'light', circuit: 'half-adder' }, /and, or, not, nand, nor, xor/],
      [{ task: 'build', circuit: 'not' }, /nothing to build/],
    ]
    for (const [c, says] of cases) {
      const f = engine.faults(c)
      expect(f, nameOf(c)).toHaveLength(1)
      expect(f[0], nameOf(c)).toMatch(says)
      const fixed = engine.parse({ ...c, circuit: f[0].match(/e\.g\. circuit "([\w-]+)"/)?.[1] ?? 'nand' })!
      expect(engine.faults(fixed), nameOf(fixed)).toEqual([])
      expect(engine.check(fixed, engine.solve(fixed)).ok).toBe(true)
    }
    for (const [c] of cases) {
      expect(() => renderToStaticMarkup(createElement(LogicGatesView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

describe('the prompt must not give the answer away', () => {
  const pf = (c: LGConfig, p: string) => engine.promptFaults!(c, p)
  const light: LGConfig = { task: 'light', circuit: 'and-not-c' }
  const build: LGConfig = { task: 'build', circuit: 'nand' }
  const build2: LGConfig = { task: 'build', circuit: 'and-or' }

  it('asking for the outcome is fine', () => {
    expect(pf(light, 'Tap a switch to flip it on or off. Find a way to light the lamp.')).toEqual([])
    expect(pf(light, 'Flip the switches and watch the wires. Can you light the lamp?')).toEqual([])
    expect(pf(build, 'Tap the arrows to change the gate, and tap the switches to test each setting. Make your lamp match the wanted row for every setting.')).toEqual([])
    expect(pf(build2, 'Make your lamp follow the wanted row. Change the gates and test every setting.')).toEqual([])
  })

  it('which setting, which gate, or what a gate does is not', () => {
    for (const p of ['Turn on A and B to light the lamp.', 'Light the lamp by turning A on and keeping C off.', 'The lamp is lit only when both switches are on.', 'Find the setting where either switch lights it.', 'At least one switch must be on.', 'An AND gate gives 1 only when its inputs are 1.', 'Set switch C off.']) {
      expect(pf(light, p), p).toHaveLength(1)
    }
    for (const p of ['Use a NAND gate.', 'Choose NOR for gate 1.', 'Pick an AND gate then an OR gate.', 'Use the exclusive OR.', 'The lamp goes off only when both are on.', 'Use an inverter.']) {
      expect(pf(build, p), p).toHaveLength(1)
    }
  })

  it('what the card does not show is refused too', () => {
    for (const p of ['Drag the gates into place.', 'Connect the wires.', 'Write the Boolean expression.', 'Build a half adder.', 'Simplify the circuit.', 'Draw the truth table.', 'Complete the truth table.']) {
      expect(pf(light, p), p).toHaveLength(1)
      expect(pf(light, p)[0], p).toMatch(/does not show/)
    }
  })

  it('the fix each one offers fits its own config, and passes', () => {
    for (const c of ALL) {
      const fix = pf(c, 'Turn on A and drag the gate.')[0].match(/\("([^"]+)"\)/)![1]
      expect(pf(c, fix), nameOf(c)).toEqual([])
      expect(fix).toMatch(c.task === 'light' ? /light the lamp/ : /wanted row/)
    }
    expect(pf(build2, 'Turn on A.')[0]).toContain('change the gates')
    expect(pf(build, 'Turn on A.')[0]).toContain('change the gate,')
  })

  it('passes the examples in its own catalogue entry', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"logic-gates", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(engine.promptFaults!(c, f[1]), f[1]).toEqual([])
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).task))).toEqual(new Set(['light', 'build']))
  })
})

describe('when the tutor is shown it', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "logic-gates"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'logic-gates')

  it('is offered for the stations it is made for', () => {
    for (const st of [
      'Logic gates and logic circuits', 'Logic circuits and Boolean algebra', 'The role of logic gates', 'Logic gates', 'Chapter 7: Logic gates and truth tables', 'Combining logic gates',
      'NOT gates and inverters', 'NAND and NOR gates', 'The XOR gate', 'Digital logic', 'Boolean logic', 'Logic diagrams', 'Unit 4: Digital circuits',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is not offered for other uses of the words', () => {
    for (const st of [
      'Logic puzzles', 'Logical reasoning', 'Propositional logic and truth tables', 'Predicate logic', 'Mathematical logic', 'Fuzzy logic', 'Ladder logic', 'Boolean search terms',
      'Gate control theory of pain', 'Voltage-gated ion channels', 'The Watergate scandal', 'Golden Gate Bridge', 'Gates of the city', 'Floodgates', 'Truth and lies in sources',
      'Electric circuits', 'Series and parallel circuits', 'Circuit builder', 'Data representation', 'Binary numbers', 'Venn diagrams and sets', 'Networks and the internet', 'Fetch-decode-execute',
      'The AND rule in probability', 'Either or conjunctions', 'Neither nor', 'Switching costs', 'Light switches',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })

  it('is registered, with its config in its catalogue entry', () => {
    expect(getEngine('logic-gates')).toBe(engine)
    expect(engine.isolates).toBe('consequence')
    expect(engine.prompt).toMatch(/SCENE "logic-gates"/)
    expect(engine.prompt).toMatch(/"pattern":"scene"/)
    expect(engine.prompt).toMatch(/"success": \{ "kind":"scene" \}/)
    expect(engine.prompt).toMatch(/"apparatus":"scene:logic-gates"/)
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    for (const id of CIRCUIT_IDS) expect(engine.prompt).toContain(id)
  })
})

describe('the drawing', { timeout: 30_000 }, () => {
  type Box = { left: number; right: number; top: number; bottom: number }
  const hits = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const gateBox = (g: { kind: keyof typeof OUT_X; left: number; cy: number }): Box => ({ left: g.left - 6, right: g.left + OUT_X[g.kind] + 2, top: g.cy - 22, bottom: g.cy + 22 })
  const labelBox = (x: number, y: number, text: string): Box => ({ left: x - (text.length * 7.5) / 2, right: x + (text.length * 7.5) / 2, top: y - 12, bottom: y + 3 })

  it('everything sits inside the plate, apart, and every label sits nearer its own part', () => {
    for (const c of ALL) {
      const lay = layoutOf(c)
      const boxes = lay.gates.map((g) => ({ id: g.id, box: gateBox(g) }))
      boxes.forEach((a, i) => {
        expect(a.box.left, nameOf(c)).toBeGreaterThan(70)
        expect(a.box.right, nameOf(c)).toBeLessThan(lay.lamp.x - 24)
        expect(a.box.top, nameOf(c)).toBeGreaterThan(4)
        boxes.forEach((o, j) => { if (j > i) expect(hits(a.box, o.box), `${nameOf(c)} ${a.id} ${o.id}`).toBe(false) })
      })
      const labels = [
        ...lay.gates.map((g) => ({ text: g.kind === 'NAND' || g.kind === 'NOR' ? g.kind : g.kind, x: g.cx, y: g.cy + 36, own: { x: g.cx, y: g.cy } })),
        { text: 'Lamp', x: lay.lamp.x, y: lay.lamp.y + 42, own: { x: lay.lamp.x, y: lay.lamp.y } },
      ]
      for (const t of labels) {
        const b = labelBox(t.x, t.y, t.text)
        expect(b.bottom, `${t.text} ${nameOf(c)}`).toBeLessThanOrEqual(H)
        expect(b.right, `${t.text} ${nameOf(c)}`).toBeLessThanOrEqual(W)
        for (const g of boxes) expect(hits(b, g.box), `${t.text} on ${g.id} ${nameOf(c)}`).toBe(false)
        const mine = Math.hypot(t.x - t.own.x, t.y - 12 - t.own.y)
        for (const o of labels) if (o !== t) expect(hits(b, labelBox(o.x, o.y, o.text)), `${t.text} / ${o.text} ${nameOf(c)}`).toBe(false)
        for (const o of labels) if (o !== t) expect(mine, `${t.text} nearer ${o.text}`).toBeLessThan(Math.hypot(t.x - o.own.x, t.y - 12 - o.own.y))
      }
      // The switches' letters sit above their own switch, clear of the others.
      lay.inputs.forEach((i, k) => lay.inputs.forEach((o, j) => { if (j > k) expect(Math.abs(i.y - o.y), nameOf(c)).toBeGreaterThanOrEqual(SWITCH_H + 8) }))
    }
  })

  it('no wire runs through a gate it does not feed', () => {
    for (const c of ALL) {
      const lay = layoutOf(c)
      for (const w of lay.wires) {
        const segs: Box[] = w.a.y === w.b.y
          ? [{ left: w.a.x, right: w.b.x, top: w.a.y - 1, bottom: w.a.y + 1 }]
          : [
            { left: w.a.x, right: w.mx, top: w.a.y - 1, bottom: w.a.y + 1 },
            { left: w.mx - 1, right: w.mx + 1, top: Math.min(w.a.y, w.b.y), bottom: Math.max(w.a.y, w.b.y) },
            { left: w.mx, right: w.b.x, top: w.b.y - 1, bottom: w.b.y + 1 },
          ]
        for (const g of lay.gates) {
          if (g.id === w.from || g.id === w.to) continue
          for (const s of segs) expect(hits(s, gateBox(g)), `${nameOf(c)} ${w.from}>${w.to} through ${g.id}`).toBe(false)
        }
      }
    }
  })

  it('every wire goes forward, from its source to its gate, and each gate has all its inputs wired', () => {
    for (const c of ALL) {
      const lay = layoutOf(c)
      const def = defOf(c)
      for (const w of lay.wires) {
        expect(w.a.x, nameOf(c)).toBeLessThan(w.b.x)
        expect(w.mx, nameOf(c)).toBeGreaterThanOrEqual(w.a.x)
        expect(w.mx, nameOf(c)).toBeLessThanOrEqual(w.b.x)
      }
      for (const gate of def.gates) expect(lay.wires.filter((w) => w.to === gate.id).length, `${nameOf(c)} ${gate.id}`).toBe(gate.in.length)
      expect(lay.wires.filter((w) => w.to === 'lamp')).toHaveLength(1)
    }
  })

  it('agrees with what the view writes out as literals', () => {
    // View.tsx cannot read config's constants at load time: it writes its own and this test holds them together.
    expect(W).toBe(CW)
    expect(H).toBe(CH)
    expect(SWITCH_W).toBeLessThanOrEqual(66)
    const c = ALL[0]
    const html = renderToStaticMarkup(createElement(LogicGatesView, { config: c, state: engine.initial(c), setState: () => {}, marked: 'idle', reduced: true, locked: false }))
    expect(html).toContain(`viewBox="0 0 ${W} ${H}"`)
    for (const id of CIRCUIT_IDS) expect(CIRCUITS[id].gates.length).toBeGreaterThan(0)
  })
})

describe('the scene on the board', { timeout: 30_000 }, () => {
  const card = (cfg: unknown, prompt: string) =>
    renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'logic-gates', config: cfg }, success: { kind: 'scene' } } },
    } as never)))
  const raw = (cfg: LGConfig, state: LGState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = false) =>
    renderToStaticMarkup(createElement(LogicGatesView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')
  const EX: [LGConfig, string][] = [
    [{ task: 'light', circuit: 'and-not-c' }, 'Tap a switch to flip it on or off. Find a way to light the lamp.'],
    [{ task: 'light', circuit: 'or' }, 'Tap a switch to flip it on or off. Find a way to light the lamp.'],
    [{ task: 'build', circuit: 'nand' }, 'Tap the arrows to change the gate, and tap the switches to test each setting. Make your lamp match the wanted row for every setting.'],
    [{ task: 'build', circuit: 'and-or' }, 'Tap the arrows to change the gates, and tap the switches to test each setting. Make your lamp match the wanted row for every setting.'],
  ]

  it('before marking, nothing says the answer, the rule or the right gate', () => {
    for (const [cfg, prompt] of EX) {
      const html = card(cfg, prompt)
      expect(html, nameOf(cfg)).toContain('<button')
      const shown = text(html.replace(prompt, '')) + ' ' + attrs(html)
      const def = defOf(cfg)
      for (const secret of ['Yes', 'is lit by', 'lit by', 'turns C round', def.explain.slice(0, 20), 'matches the wanted', 'wanted row has', 'You chose']) expect(shown, `${secret} in ${nameOf(cfg)}`).not.toContain(secret)
      // The answer gates are not named before marking on build; the learner's own pick is all that shows.
      if (cfg.task === 'build') {
        const picks = engine.initial(cfg).picks
        const kinds = kindsOf(cfg, picks)
        const right = kindsOf(cfg, engine.solve(cfg).picks)
        for (const s of slotsOf(def)) if (kinds[s.id] !== right[s.id]) expect(html.includes(`data-kind="${right[s.id]}"`) && html.includes(`>${right[s.id]}</span>`), nameOf(cfg)).toBe(false)
      }
    }
  })

  it('light names its gates and the lamp and shows the table filling', () => {
    const c: LGConfig = { task: 'light', circuit: 'and-not-c' }
    const t = text(raw(c, engine.initial(c), 'idle'))
    for (const name of ['AND', 'NOT', 'Lamp', 'Wire carrying 1', 'Wire carrying 0']) expect(t).toContain(name)
    const idle = raw(c, engine.initial(c), 'idle')
    // One column tried: one digit for the lamp, the rest dots.
    expect([...idle.matchAll(/>·</g)]).toHaveLength(7)
    const solved = raw(c, engine.solve(c), 'right')
    expect([...solved.matchAll(/>·</g)]).toHaveLength(0)
  })

  it('build shows the wanted row from the start and a Yours row that fills with the settings tried', () => {
    const c: LGConfig = { task: 'build', circuit: 'xor' }
    const idle = raw(c, engine.initial(c), 'idle')
    expect(text(idle)).toContain('Wanted')
    expect(text(idle)).toContain('Yours')
    expect([...idle.matchAll(/>·</g)]).toHaveLength(3)
    const tried = raw(c, { ...engine.initial(c), sw: [false, true], seen: [0, 1] }, 'idle')
    expect([...tried.matchAll(/>·</g)]).toHaveLength(2)
    // The wanted row is the same whatever the learner picks.
    const want = wantedRow(c).map((v) => (v ? 1 : 0)).join('')
    expect(want).toBe('0110')
  })

  it('marking gives the rule, and what was made when wrong', () => {
    const l: LGConfig = { task: 'light', circuit: 'and-not-c' }
    expect(text(raw(l, engine.solve(l), 'right'))).toContain('Yes. The lamp is lit')
    expect(text(raw(l, engine.initial(l), 'wrong'))).toContain('The lamp is off with')
    const b: LGConfig = { task: 'build', circuit: 'nand' }
    expect(text(raw(b, engine.solve(b), 'right'))).toContain('The gate is NAND')
    expect(text(raw(b, engine.initial(b), 'wrong'))).toContain('You chose')
  })

  it('showing the answer draws the answer, whatever the learner had left', () => {
    const b: LGConfig = { task: 'build', circuit: 'nand' }
    const html = raw(b, engine.initial(b), 'shown')
    expect(html).toContain('data-kind="NAND"')
    expect(text(html)).toContain('The gate is NAND')
  })

  it('every control is a real button with its own label, and all lock when solved', () => {
    for (const [cfg] of EX) {
      const idle = raw(cfg, engine.initial(cfg), 'idle')
      const def = defOf(cfg)
      const buttons = [...idle.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)]
      expect(buttons.length, nameOf(cfg)).toBe(def.inputs.length + (cfg.task === 'build' ? slotsOf(def).length * 2 : 0))
      expect(new Set(buttons.map((m) => m[1])).size, nameOf(cfg)).toBe(buttons.length)
      for (const m of buttons) expect(m[0], m[1]).toContain('type="button"')
      expect(idle, nameOf(cfg)).toContain('nodrag')
      expect(raw(cfg, engine.solve(cfg), 'right').match(/<button[^>]*disabled/g)?.length, nameOf(cfg)).toBe(buttons.length)
    }
  })

  it('the picture changes with every flip and every gate step, and nothing animates under reduced motion', () => {
    for (const [cfg] of EX) {
      const s = engine.initial(cfg)
      const first = raw(cfg, s, 'idle', true)
      expect(first, nameOf(cfg)).not.toMatch(/transition:\s*[a-z]/)
      expect(first, nameOf(cfg)).not.toContain('lg-flow')
      for (let i = 0; i < s.sw.length; i++) {
        expect(raw(cfg, { ...s, sw: s.sw.map((b, k) => (k === i ? !b : b)) }, 'idle', true), `${nameOf(cfg)} switch ${i}`).not.toBe(first)
      }
      s.picks.forEach((p, i) => {
        const next = { ...s, picks: s.picks.map((q, k) => (k === i ? (q + 1) % CHOICES.length : q)) }
        expect(raw(cfg, next, 'idle', true), `${nameOf(cfg)} gate ${i}`).not.toBe(first)
      })
    }
    expect(raw(EX[0][0], engine.initial(EX[0][0]), 'idle', false)).toMatch(/transition:stroke 220ms/)
  })

  it('a change runs along the wires: later wires wait longer', () => {
    const lay = layoutOf({ task: 'light', circuit: 'and-or' })
    const depths = lay.wires.map((w) => w.fromDepth)
    expect(Math.max(...depths)).toBeGreaterThan(Math.min(...depths))
    const html = raw({ task: 'light', circuit: 'and-or' }, engine.initial({ task: 'light', circuit: 'and-or' }), 'idle')
    expect(html).toMatch(/stroke-width 220ms ease 0ms/)
    expect(html).toMatch(/stroke-width 220ms ease 220ms/)
  })

  it('wires carry the right value: a blue wire only where the signal is 1', () => {
    const c: LGConfig = { task: 'light', circuit: 'and-or' }
    const sw = [true, true, false]
    const html = raw(c, { sw, seen: [6], picks: [] }, 'idle')
    const w = wiresOf(c, sw, [])
    expect(w.g1).toBe(true)
    expect(html).toContain('data-wire="g1&gt;g2" data-high="1"')
    expect(html).toContain('data-wire="C&gt;g2" data-high="0"')
    expect(html).toContain('data-lamp="1"')
  })

  it('screen-reader text says what is seen, and never whether it is right', () => {
    for (const [cfg] of EX) {
      const html = raw(cfg, engine.initial(cfg), 'idle')
      expect(attrs(html)).toMatch(/The lamp is (lit|off)/)
      expect(attrs(html) + text(html)).not.toMatch(/correct|wrong|matches the wanted|Yes\./)
    }
  })

  it('keyboard: the controls are buttons, so Tab and Enter work, and nothing takes the arrow keys', () => {
    const html = raw(EX[2][0], engine.initial(EX[2][0]), 'idle')
    expect(html).not.toMatch(/onKeyDown|tabindex="-1"/)
  })

  it('no text under 12 px, and only flat colour', () => {
    for (const [cfg] of EX) for (const marked of ['idle', 'right', 'wrong'] as const) {
      const html = raw(cfg, marked === 'right' ? engine.solve(cfg) : engine.initial(cfg), marked)
      for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      for (const m of html.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
      expect(html).not.toMatch(/Gradient|filter=|drop-shadow|box-shadow/)
    }
  })
})
