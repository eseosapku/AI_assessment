// lib/studylab/engines/flowchart/flowchart.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import {
  flowchartEngine as engine, CHARTS, CHART_IDS, CHART_W, FLOWCHARTS, MACHINES, MAX_PRESSES,
  anchor, atOf, bezAt, chartFor, edgeLabelAt, edgePoints, everyAt, finalState, goalId, goalNames, goodPrompt, inputValues, isMachine, machineEdgeGeometry, machineEdgeText,
  madeText, nextState, nodeOf, outline, pathWords, pressesOf, resolveGoal, routeOf, runChart, shortestPresses, solveAt, startAt, stateOf, statesVisited, textOfEnd, tw, unasked, working,
  type FcConfig, type FcState, type FlowChart, type Machine, type Pt,
} from './config'
import { FlowchartView, SPEED, W, durationOf, lengthAt, pointAt } from './View'
import { getEngine, sceneCatalogue, scenesFor } from '../registry'
import { ActivityNode } from '@/components/studylab/activities/ActivityNode'

vi.spyOn(console, 'error').mockImplementation(() => {})

const flows = FLOWCHARTS
const goalsOf = (c: (typeof CHARTS)[number]): string[] => (isMachine(c) ? c.states.filter((s) => s.id !== c.start).map((s) => s.id) : c.nodes.filter((n) => n.kind === 'out').map((n) => n.id))
const ALL: FcConfig[] = CHARTS.flatMap((c) => goalsOf(c).map((goal) => ({ task: isMachine(c) ? ('machine' as const) : ('run' as const), chart: c.id, goal })))

// ---------------------------------------------------------------------------
// Geometry helpers.

type Box = { x0: number; y0: number; x1: number; y1: number }
const boxOf = (n: { x: number; y: number; w: number; h: number }): Box => ({ x0: n.x - n.w / 2, y0: n.y - n.h / 2, x1: n.x + n.w / 2, y1: n.y + n.h / 2 })
const grow = (b: Box, m: number): Box => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m })
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const inside = (p: Pt, poly: Pt[]) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (poly[i].y > p.y !== poly[j].y > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) c = !c
  }
  return c
}
/** Is any part of this box inside the shape itself (not just its bounding box)? */
function touches(box: Box, n: FlowChart['nodes'][number]): boolean {
  if (n.kind === 'start' || n.kind === 'out') return hit(box, boxOf(n))
  const poly = outline(n)
  for (let x = box.x0; x <= box.x1; x += 1) for (let y = box.y0; y <= box.y1; y += 1) if (inside({ x, y }, poly)) return true
  return false
}
const walk = (pts: Pt[], step = 1): Pt[] => {
  const out: Pt[] = []
  for (let i = 0; i + 1 < pts.length; i++) {
    const n = Math.max(1, Math.ceil(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) / step))
    for (let k = 0; k < n; k++) out.push({ x: pts[i].x + ((pts[i + 1].x - pts[i].x) * k) / n, y: pts[i].y + ((pts[i + 1].y - pts[i].y) * k) / n })
  }
  out.push(pts[pts.length - 1])
  return out
}
const near = (p: Pt, pts: Pt[]) => Math.min(...pts.map((q) => Math.hypot(p.x - q.x, p.y - q.y)))

// ---------------------------------------------------------------------------
describe('the charts, from first principles', () => {
  it('every chart has a unique id, and the ids the tutor can name are exactly these', () => {
    expect(new Set(CHART_IDS).size).toBe(CHARTS.length)
    expect(CHART_IDS).toEqual(['grade', 'ride', 'password', 'heating', 'minibeasts', 'vertebrates', 'turnstile', 'lock'])
  })

  it.each(flows.map((c) => [c.id, c] as const))('%s: every shape is on the plate, apart from the others, and every arrow joins two shapes', (_id, c) => {
    expect(c.H).toBeLessThanOrEqual(300)
    const boxes = c.nodes.map((n) => ({ n, b: boxOf(n) }))
    for (const { n, b } of boxes) {
      expect(b.x0, n.id).toBeGreaterThanOrEqual(4)
      expect(b.x1, n.id).toBeLessThanOrEqual(CHART_W - 4)
      expect(b.y0, n.id).toBeGreaterThanOrEqual(4)
      expect(b.y1, n.id).toBeLessThanOrEqual(c.H - 4)
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(hit(grow(boxes[i].b, 3), boxes[j].b), `${boxes[i].n.id} ${boxes[j].n.id}`).toBe(false)
    expect(new Set(c.nodes.map((n) => n.id)).size).toBe(c.nodes.length)
    for (const e of c.edges) {
      expect(c.nodes.some((n) => n.id === e.from)).toBe(true)
      expect(c.nodes.some((n) => n.id === e.to)).toBe(true)
    }
  })

  it.each(flows.map((c) => [c.id, c] as const))('%s: each diamond has exactly one Yes and one No arrow, and every other shape has one way on (or none, at an end)', (_id, c) => {
    for (const n of c.nodes) {
      const out = c.edges.filter((e) => e.from === n.id)
      if (n.kind === 'decision') {
        expect(out.map((e) => e.when).sort(), n.id).toEqual([false, true])
        expect(n.test, n.id).toBeTruthy()
      } else if (n.kind === 'out') expect(out, n.id).toHaveLength(0)
      else expect(out, n.id).toHaveLength(1)
    }
    // Only the arrows out of a diamond carry a Yes or No.
    for (const e of c.edges) expect(e.when === undefined, `${e.from}->${e.to}`).toBe(nodeOf(c, e.from).kind !== 'decision')
  })

  it.each(flows.map((c) => [c.id, c] as const))('%s: no arrow passes through a shape it does not join', (_id, c) => {
    c.edges.forEach((e) => {
      const pts = walk(edgePoints(c, e))
      for (const n of c.nodes) {
        if (n.id === e.from || n.id === e.to) continue
        const b = boxOf(n)
        for (const p of pts) expect(p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1, `${e.from}->${e.to} through ${n.id}`).toBe(false)
      }
    })
  })

  it.each(flows.map((c) => [c.id, c] as const))('%s: the words fit their shapes at 12 px, and the token has room beside them', (_id, c) => {
    for (const n of c.nodes) {
      if (n.kind === 'decision') expect(tw(n.text), n.id).toBeLessThanOrEqual(n.w * 0.74)
      else if (n.kind === 'input') expect(tw(n.text), n.id).toBeLessThanOrEqual(n.w - 24)
      else expect(tw(n.text), n.id).toBeLessThanOrEqual(n.w - 40)
    }
  })

  it.each(flows.map((c) => [c.id, c] as const))('%s: Yes and No sit beside their own arrow, clear of every shape and arrow', (_id, c) => {
    c.edges.forEach((e, k) => {
      if (e.when === undefined) return
      const p = edgeLabelAt(c, e)
      const wide = tw(e.when ? 'Yes' : 'No')
      const box: Box = { x0: p.anchor === 'middle' ? p.x - wide / 2 : p.x, y0: p.y - 6, x1: p.anchor === 'middle' ? p.x + wide / 2 : p.x + wide, y1: p.y + 6 }
      expect(box.x0).toBeGreaterThan(2)
      expect(box.x1).toBeLessThan(CHART_W - 2)
      for (const n of c.nodes) expect(touches(box, n), `${e.from}->${e.to} label meets ${n.id}`).toBe(false)
      // Nearer its own arrow than any other arrow.
      const own = near({ x: (box.x0 + box.x1) / 2, y: p.y }, walk(edgePoints(c, e)))
      c.edges.forEach((o, j) => {
        if (j === k) return
        expect(own, `${e.from}->${e.to} vs ${o.from}->${o.to}`).toBeLessThan(near({ x: (box.x0 + box.x1) / 2, y: p.y }, walk(edgePoints(c, o))))
      })
      // Clear of every arrow's line (the label is beside it, not on it).
      for (const o of c.edges) for (const q of walk(edgePoints(c, o))) expect(q.x >= box.x0 && q.x <= box.x1 && q.y >= box.y0 && q.y <= box.y1, `${e.from}->${e.to} sits on a line`).toBe(false)
    })
  })

  it('a token run always ends at an end, along arrows that join up, and every end can be reached', () => {
    for (const c of flows) {
      const reached = new Set<string>()
      for (const at of everyAt(c)) {
        const run = runChart(c, at)
        expect(nodeOf(c, run.end).kind, c.id).toBe('out')
        expect(run.nodes[0]).toBe('start')
        run.edges.forEach((k, i) => {
          expect(c.edges[k].from).toBe(run.nodes[i])
          expect(c.edges[k].to).toBe(run.nodes[i + 1])
        })
        reached.add(run.end)
      }
      expect([...reached].sort(), c.id).toEqual(c.nodes.filter((n) => n.kind === 'out').map((n) => n.id).sort())
    }
  })

  it('takes the branches a person counts on', () => {
    const g = FLOWCHARTS.find((c) => c.id === 'grade')!
    const end = (mark: number) => runChart(g, { mark }).end
    expect([end(20), end(16), end(15), end(10), end(9), end(0)]).toEqual(['distinction', 'distinction', 'pass', 'pass', 'resit', 'resit'])
    const v = FLOWCHARTS.find((c) => c.id === 'vertebrates')!
    const idx = (name: string) => inputValues(v.inputs[0]).indexOf(name)
    expect(runChart(v, { covering: idx('hair'), gills: 1 }).end).toBe('mammal')
    expect(runChart(v, { covering: idx('feathers'), gills: 0 }).end).toBe('bird')
    expect(runChart(v, { covering: idx('moist skin'), gills: 1 }).end).toBe('amphibian')
    expect(runChart(v, { covering: idx('scales'), gills: 1 }).end).toBe('fish')
    expect(runChart(v, { covering: idx('scales'), gills: 0 }).end).toBe('reptile')
    const m = FLOWCHARTS.find((c) => c.id === 'minibeasts')!
    const at = (shell: number, legs: number, wings: number) => ({ shell, legs, wings })
    expect(runChart(m, at(1, 0, 0)).end).toBe('snail')
    expect(runChart(m, at(0, 1, 0)).end).toBe('spider')
    expect(runChart(m, at(0, 0, 0)).end).toBe('ant')
    expect(runChart(m, at(0, 0, 1)).end).toBe('housefly')
    expect(runChart(m, at(0, 0, 2)).end).toBe('bee')
    const h = FLOWCHARTS.find((c) => c.id === 'heating')!
    expect(runChart(h, { temp: 0, window: 1 }).end).toBe('window-warning')
    expect(runChart(h, { temp: 0, window: 0 }).end).toBe('heater-on')
    expect(runChart(h, { temp: 14, window: 0 }).end).toBe('heater-off')
  })

  it('a key asks only what it needs: the traits it never asked about are named', () => {
    const m = FLOWCHARTS.find((c) => c.id === 'minibeasts')!
    expect(unasked(m, runChart(m, { shell: 0, legs: 1, wings: 0 }))).toEqual(['wings'])
    expect(unasked(m, runChart(m, { shell: 1, legs: 0, wings: 0 }))).toEqual(['legs', 'wings'])
  })

  it('reads inputs safely: anything out of range or of the wrong type counts for the start', () => {
    const g = FLOWCHARTS[0]
    expect(atOf(g, { at: { mark: 999 } })).toEqual({ mark: 20 })
    expect(atOf(g, { at: { mark: -4 } })).toEqual({ mark: 0 })
    expect(atOf(g, { at: { mark: 'x' as never } })).toEqual({ mark: 9 })
    expect(atOf(g, { at: { mark: 3.5 } })).toEqual({ mark: 9 })
    expect(atOf(g, undefined)).toEqual({ mark: 9 })
    expect(atOf(g, { at: null as never })).toEqual({ mark: 9 })
    expect(atOf(g, { presses: ['coin'] })).toEqual({ mark: 9 })
  })
})

// ---------------------------------------------------------------------------
describe('the machines, from first principles', () => {
  it.each(MACHINES.map((m) => [m.id, m] as const))('%s: exactly one arrow answers every button in every state', (_id, m) => {
    for (const s of m.states) {
      for (const ev of m.events) {
        const arrows = m.edges.filter((e) => e.from === s.id && e.on.includes(ev.id))
        expect(arrows, `${s.id} ${ev.id}`).toHaveLength(1)
      }
    }
    for (const e of m.edges) {
      expect(m.states.some((s) => s.id === e.from)).toBe(true)
      expect(m.states.some((s) => s.id === e.to)).toBe(true)
      for (const id of e.on) expect(m.events.some((x) => x.id === id)).toBe(true)
    }
  })

  it.each(MACHINES.map((m) => [m.id, m] as const))('%s: every state can be reached by some presses, and the start is a state', (_id, m) => {
    expect(m.states.some((s) => s.id === m.start)).toBe(true)
    for (const s of m.states) {
      const path = shortestPresses(m, s.id)
      expect(finalState(m, path), s.id).toBe(s.id)
    }
  })

  it.each(MACHINES.map((m) => [m.id, m] as const))('%s: the states are on the plate, apart, and their names fit inside', (_id, m) => {
    expect(m.H).toBeLessThanOrEqual(220)
    for (const s of m.states) {
      expect(s.x - m.r, s.id).toBeGreaterThanOrEqual(4)
      expect(s.x + m.r, s.id).toBeLessThanOrEqual(CHART_W - 4)
      expect(s.y + m.r, s.id).toBeLessThanOrEqual(m.H - 4)
      expect(tw(s.text), s.id).toBeLessThanOrEqual(2 * m.r - 8)
    }
    for (let i = 0; i < m.states.length; i++) for (let j = i + 1; j < m.states.length; j++) {
      expect(Math.hypot(m.states[i].x - m.states[j].x, m.states[i].y - m.states[j].y)).toBeGreaterThanOrEqual(2 * m.r + 24)
    }
  })

  it.each(MACHINES.map((m) => [m.id, m] as const))('%s: each arrow stays on the plate and clear of the states it does not join', (_id, m) => {
    for (const e of m.edges) {
      const g = machineEdgeGeometry(m, e)
      const pts = Array.from({ length: 41 }, (_, i) => bezAt(g, i / 40))
      for (const p of pts) {
        expect(p.x).toBeGreaterThan(2)
        expect(p.x).toBeLessThan(CHART_W - 2)
        expect(p.y).toBeGreaterThan(2)
        expect(p.y).toBeLessThan(m.H - 2)
      }
      for (const s of m.states) {
        if (s.id === e.from || s.id === e.to) continue
        for (const p of pts) expect(Math.hypot(p.x - s.x, p.y - s.y), `${e.from}->${e.to} through ${s.id}`).toBeGreaterThan(m.r + 2)
      }
      // The arrow starts and ends on the edge of its two circles.
      expect(Math.hypot(g.p0.x - stateOf(m, e.from).x, g.p0.y - stateOf(m, e.from).y)).toBeCloseTo(m.r, 1)
      expect(Math.hypot(g.p1.x - stateOf(m, e.to).x, g.p1.y - stateOf(m, e.to).y)).toBeCloseTo(m.r, 1)
    }
  })

  it.each(MACHINES.map((m) => [m.id, m] as const))('%s: each label sits on the plate, clear of every state, and nearer its own arrow than any other', (_id, m) => {
    const curves = m.edges.map((e) => Array.from({ length: 41 }, (_, i) => bezAt(machineEdgeGeometry(m, e), i / 40)))
    m.edges.forEach((e, k) => {
      const p = machineEdgeGeometry(m, e).label
      const wide = tw(machineEdgeText(m, e))
      expect(p.x - wide / 2, machineEdgeText(m, e)).toBeGreaterThan(2)
      expect(p.x + wide / 2).toBeLessThan(CHART_W - 2)
      expect(p.y - 6).toBeGreaterThan(2)
      expect(p.y + 6).toBeLessThan(m.H - 2)
      for (const s of m.states) {
        // The nearest point of the label's box to the state's centre.
        const dx = Math.max(p.x - wide / 2 - s.x, 0, s.x - (p.x + wide / 2))
        const dy = Math.max(p.y - 6 - s.y, 0, s.y - (p.y + 6))
        expect(Math.hypot(dx, dy), `${machineEdgeText(m, e)} meets ${s.id}`).toBeGreaterThan(m.r + 1)
      }
      const own = near(p, curves[k])
      curves.forEach((c, j) => {
        if (j !== k) expect(own, `${machineEdgeText(m, e)} vs arrow ${j}`).toBeLessThan(near(p, c))
      })
      // And not sitting on any arrow's line.
      curves.forEach((c, j) => expect(c.some((q) => q.x >= p.x - wide / 2 && q.x <= p.x + wide / 2 && q.y >= p.y - 6 && q.y <= p.y + 6), `label ${machineEdgeText(m, e)} on arrow ${j}`).toBe(false))
    })
  })

  it('the turnstile and the lock behave as people say they do', () => {
    const t = MACHINES.find((m) => m.id === 'turnstile')!
    expect(nextState(t, 'locked', 'coin')).toBe('unlocked')
    expect(nextState(t, 'locked', 'push')).toBe('locked')
    expect(nextState(t, 'unlocked', 'coin')).toBe('unlocked')
    expect(nextState(t, 'unlocked', 'push')).toBe('locked')
    const l = MACHINES.find((m) => m.id === 'lock')!
    expect(finalState(l, ['2', '3', '1'])).toBe('open')
    expect(finalState(l, ['2', '3', '2'])).toBe('locked')
    expect(finalState(l, ['1', '2', '3'])).toBe('two')
    expect(finalState(l, ['3', '2', '2'])).toBe('locked')
    expect(finalState(l, ['2', '3', '1', '2'])).toBe('open')
    expect(shortestPresses(l, 'open')).toEqual(['2', '3', '1'])
    expect(shortestPresses(l, 'one')).toEqual(['2'])
  })

  it('reads presses safely: only this machine’s buttons, and no more than a card holds', () => {
    const t = MACHINES[0]
    expect(pressesOf(t, undefined)).toEqual([])
    expect(pressesOf(t, { presses: 'coin' as never })).toEqual([])
    expect(pressesOf(t, { presses: ['coin', 'kick', 7 as never, 'push'] })).toEqual(['coin', 'push'])
    expect(pressesOf(t, { presses: Array.from({ length: 40 }, () => 'coin') })).toHaveLength(MAX_PRESSES)
    expect(statesVisited(t, ['coin', 'push'])).toEqual(['locked', 'unlocked', 'locked'])
  })

  it('the view stops at the same number of presses as the config', () => {
    const view = readFileSync(join(process.cwd(), 'lib/studylab/engines/flowchart/View.tsx'), 'utf8')
    expect(view).toContain(`n >= ${MAX_PRESSES}`)
    expect(view).not.toContain('n >= 12 &&')
  })
})

// ---------------------------------------------------------------------------
describe('marking: every valid card starts unsolved and can be solved', { timeout: 30_000 }, () => {
  it('has a card for every end and every state it can be asked for', () => {
    expect(ALL.length).toBe(27)
  })

  it('initial is unsolved and solve passes, for every chart and every goal', () => {
    for (const c of ALL) {
      const cfg = engine.parse(c)!
      expect(cfg, JSON.stringify(c)).not.toBeNull()
      expect(engine.faults(cfg), JSON.stringify(c)).toEqual([])
      expect(engine.check(cfg, engine.initial(cfg)).ok, `${JSON.stringify(c)} starts solved`).toBe(false)
      expect(engine.check(cfg, engine.solve(cfg)).ok, `${JSON.stringify(c)} cannot be solved`).toBe(true)
    }
  })

  it('also for the goal a tutor leaves out, and the default is never already done', () => {
    for (const ch of CHARTS) {
      const cfg = engine.parse({ chart: ch.id })!
      expect(cfg.goal).toBe(ch.defaultGoal)
      expect(engine.faults(cfg)).toEqual([])
      expect(engine.check(cfg, engine.initial(cfg)).ok).toBe(false)
      expect(engine.check(cfg, engine.solve(cfg)).ok).toBe(true)
    }
  })

  it('a run goal is met by every setting that ends there, not only the nearest', () => {
    for (const c of flows) {
      for (const goal of goalsOf(c)) {
        const cfg = engine.parse({ chart: c.id, goal })!
        const met = everyAt(c).filter((at) => runChart(c, at).end === goal)
        expect(met.length, `${c.id} ${goal}`).toBeGreaterThan(0)
        for (const at of met) expect(engine.check(cfg, { at }).ok).toBe(true)
        for (const at of everyAt(c).filter((a) => runChart(c, a).end !== goal)) expect(engine.check(cfg, { at }).ok).toBe(false)
      }
    }
  })

  it('a machine goal is met by any presses that end there, however long', () => {
    const l = MACHINES.find((m) => m.id === 'lock')!
    const cfg = engine.parse({ chart: 'lock', goal: 'open' })!
    expect(engine.check(cfg, { presses: ['1', '1', '2', '3', '1'] }).ok).toBe(true)
    expect(engine.check(cfg, { presses: ['2', '3', '1', '3'] }).ok).toBe(true)
    expect(engine.check(cfg, { presses: ['2', '3'] }).ok).toBe(false)
    expect(engine.check(cfg, { presses: [] }).ok).toBe(false)
    expect(shortestPresses(l, 'open')).toHaveLength(3)
  })

  it('the solution is the nearest one: fewest changes from the start', () => {
    const g = FLOWCHARTS[0]
    expect(solveAt(g, 'pass')).toEqual({ mark: 9 + 1 })
    expect(solveAt(g, 'resit')).toEqual({ mark: 9 })
    expect(startAt(g, 'resit')).toEqual({ mark: 10 })
    expect(startAt(g, 'pass')).toEqual({ mark: 9 })
  })

  it('marking never reads anything but the rules: a garbled state is just the start', () => {
    const cfg = engine.parse({ chart: 'grade', goal: 'Pass' })!
    for (const junk of [undefined, null, {}, { at: 5 }, { at: { mark: 'ten' } }, { presses: 'x' }, { at: [] }] as unknown[]) {
      expect(() => engine.check(cfg, junk as FcState)).not.toThrow()
    }
    const m = engine.parse({ chart: 'lock', goal: 'open' })!
    for (const junk of [undefined, null, {}, { presses: 5 }, { presses: [null, {}] }, { at: {} }] as unknown[]) {
      expect(() => engine.check(m, junk as FcState)).not.toThrow()
    }
  })

  it('says what the token did once marked, and never before', () => {
    const cfg = engine.parse({ chart: 'minibeasts', goal: 'Spider' })!
    const s = { at: { shell: 0, legs: 1, wings: 0 } }
    expect(working(cfg, s)).toMatch(/^Yes\. The token took No at "has a shell\?", Yes at "8 legs\?" and ended at Spider\./)
    expect(working(cfg, s)).toContain('never asked about wings')
    expect(madeText(cfg, { at: { shell: 0, legs: 0, wings: 2 } })).toBe('With these settings the token took No at "has a shell?", No at "8 legs?", Yes at "has wings?", Yes at "4 wings?" and ended at Bee.')
    const lock = engine.parse({ chart: 'lock', goal: 'open' })!
    expect(working(lock, { presses: ['2', '3', '1'] })).toMatch(/^Yes\. 3 presses took the machine from locked to open\./)
    expect(madeText(lock, { presses: [] })).toBe('Nothing has been pressed, so the machine is still locked.')
    expect(madeText(lock, { presses: ['2'] })).toBe('After 1 press the machine is 1 right.')
    expect(pathWords(FLOWCHARTS[0], runChart(FLOWCHARTS[0], { mark: 20 }))).toBe('Yes at "mark ≥ 16?"')
  })
})

// ---------------------------------------------------------------------------
describe('parse', () => {
  it('reads broadly: aliases, cases, articles, plurals, the goal by id or by its words', () => {
    expect(engine.parse({ chart: 'Grade', goal: 'Pass' })).toEqual({ task: 'run', chart: 'grade', goal: 'pass' })
    expect(engine.parse({ chart: 'the exam grade flowchart', goal: 'a Distinction' })).toEqual({ task: 'run', chart: 'grade', goal: 'distinction' })
    expect(engine.parse({ chart: 'minibeast key', goal: 'spiders' })).toEqual({ task: 'run', chart: 'minibeasts', goal: 'spider' })
    expect(engine.parse({ chart: 'invertebrate-key', target: 'House fly' })).toEqual({ task: 'run', chart: 'minibeasts', goal: 'housefly' })
    expect(engine.parse({ key: 'vertebrates', outcome: 'AMPHIBIAN' })).toEqual({ task: 'run', chart: 'vertebrates', goal: 'amphibian' })
    expect(engine.parse({ chart: 'coin turnstile', state: 'Unlocked' })).toEqual({ task: 'machine', chart: 'turnstile', goal: 'unlocked' })
    expect(engine.parse({ chart: 'combination lock', goal: '2 right' })).toEqual({ task: 'machine', chart: 'lock', goal: 'two' })
    expect(engine.parse({ chart: 'keypad-lock', goal: 'OPEN' })).toEqual({ task: 'machine', chart: 'lock', goal: 'open' })
    expect(engine.parse({ chart: 'ride', goal: 'With adult' })).toEqual({ task: 'run', chart: 'ride', goal: 'with-adult' })
    expect(engine.parse({ chart: 'password', goal: 'add a digit' })).toEqual({ task: 'run', chart: 'password', goal: 'add-digit' })
    expect(engine.parse({ chart: 'heating', goal: 'heater on' })).toEqual({ task: 'run', chart: 'heating', goal: 'heater-on' })
    expect(engine.parse({ chart: 'grade', task: 'run', extra: 1 })).toEqual({ task: 'run', chart: 'grade', goal: 'pass' })
  })

  it('a chart or goal it does not know still parses, and faults says what would work', () => {
    const odd = engine.parse({ chart: 'loops', goal: 'Pass' })!
    expect(odd.chart).toBe('loops')
    expect(engine.faults(odd)[0]).toMatch(/There is no chart "loops".*grade, ride, password, heating, minibeasts, vertebrates, turnstile, lock, e\.g\. chart "grade", goal "Pass"/)
    const wrong = engine.parse({ chart: 'grade', goal: 'Merit' })!
    expect(wrong.goal).toBe('Merit')
    expect(engine.faults(wrong)[0]).toBe('"Merit" is not an end of the "grade" chart: use one of Distinction, Pass, Resit, e.g. goal "Distinction".')
    const m = engine.parse({ chart: 'turnstile', goal: 'broken' })!
    expect(engine.faults(m)[0]).toMatch(/not a state of the "turnstile" chart: use one of locked, unlocked, e\.g\. goal "unlocked"/)
    expect(engine.faults(engine.parse({ chart: 'grade', goal: '' })!)).toEqual([])
  })

  it('refuses a machine goal that is where it starts, with an example that works', () => {
    const c = engine.parse({ chart: 'turnstile', goal: 'locked' })!
    const f = engine.faults(c)
    expect(f).toHaveLength(1)
    expect(f[0]).toContain('starts in "locked"')
    const fixed = engine.parse({ chart: 'turnstile', goal: /e\.g\. goal "([^"]*)"/.exec(f[0])![1] })!
    expect(engine.faults(fixed)).toEqual([])
    const l = engine.parse({ chart: 'lock', goal: 'locked' })!
    expect(engine.faults(l)).toHaveLength(1)
  })

  it('returns null only for what cannot be read at all', () => {
    for (const bad of [null, undefined, 3, 'grade', [], {}, { goal: 'Pass' }, { chart: 3 }, { chart: '' }, { chart: {} }, { chart: 'grade', goal: {} }, { chart: 'grade', goal: [] }]) {
      expect(engine.parse(bad), JSON.stringify(bad)).toBeNull()
    }
    expect(engine.parse({ chart: 'grade', goal: 3 })).not.toBeNull()
  })

  it('resolves a goal by id or words, and a goal that is not there is null', () => {
    const c = chartFor({ task: 'run', chart: 'grade', goal: '' })
    expect(resolveGoal(c, 'Distinction')).toBe('distinction')
    expect(resolveGoal(c, 'resit')).toBe('resit')
    expect(resolveGoal(c, '')).toBeNull()
    expect(resolveGoal(c, 'start')).toBeNull()
    expect(goalNames(c)).toEqual(['Distinction', 'Pass', 'Resit'])
    expect(goalId({ task: 'run', chart: 'grade', goal: 'nonsense' })).toBe('pass')
  })

  it('draws a chart even for a config that faults, so nothing can crash on it', () => {
    expect(chartFor({ task: 'run', chart: 'nonsense', goal: 'x' }).id).toBe('grade')
    expect(chartFor({ task: 'machine', chart: 'nonsense', goal: 'x' }).id).toBe('turnstile')
    for (const cfg of [{ task: 'run', chart: 'nonsense', goal: 'x' }, { task: 'machine', chart: 'nonsense', goal: 'x' }] as FcConfig[]) {
      expect(() => engine.initial(cfg)).not.toThrow()
      expect(() => engine.solve(cfg)).not.toThrow()
      expect(() => renderToStaticMarkup(createElement(FlowchartView, { config: cfg, state: engine.initial(cfg), setState: () => {}, marked: 'idle', reduced: true, locked: false }))).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
describe('promptFaults', () => {
  const cfgOf = (chart: string, goal?: string) => engine.parse(goal === undefined ? { chart } : { chart, goal })!
  const pf = (cfg: FcConfig, prompt: string) => engine.promptFaults!(cfg, prompt)

  it('passes the prompt the card suggests, for every chart and every goal', () => {
    for (const c of ALL) {
      const cfg = engine.parse(c)!
      expect(pf(cfg, goodPrompt(cfg)), goodPrompt(cfg)).toEqual([])
    }
  })

  it('passes the examples in its own catalogue entry, and names the isolates it is registered with', () => {
    const found = [...engine.prompt.matchAll(/"prompt":"([^"]*)",\s*"payload": \{ "engine":"flowchart", "config": (\{[^}]*\})/g)]
    expect(found.length).toBe(3)
    for (const f of found) {
      const c = engine.parse(JSON.parse(f[2]))!
      expect(c, f[2]).not.toBeNull()
      expect(engine.faults(c), f[2]).toEqual([])
      expect(pf(c, f[1]), f[1]).toEqual([])
      expect(f[1]).toBe(goodPrompt(c))
    }
    expect(new Set(found.map((f) => JSON.parse(f[2]).chart))).toEqual(new Set(['grade', 'minibeasts', 'lock']))
    for (const m of engine.prompt.matchAll(/"isolates":\s*"(\w+)"/g)) expect(m[1]).toBe(engine.isolates)
    // The whole entry is valid JSON in its createActivity examples.
    for (const m of engine.prompt.matchAll(/^ {2}(\{ "type":"createActivity"[\s\S]*?\n[\s\S]*?\n[\s\S]*?\n? ?[\s\S]*?\})\s*(?=\n {2}\{|$)/gm)) expect(() => JSON.parse(m[1])).not.toThrow()
  })

  it('refuses a prompt that gives a value, a trait, a button, an order or a count', () => {
    for (const [chart, goal, text] of [
      ['grade', 'Pass', 'Set the mark to 12 and watch the token run. Make it finish at “Pass”.'],
      ['grade', 'Distinction', 'Make the mark more than 15 so the token finishes at “Distinction”.'],
      ['grade', 'Pass', 'Find a mark between the two boundaries so the token finishes at “Pass”.'],
      ['ride', 'Ride alone', 'Make the rider tall enough to finish at “Ride alone”.'],
      ['password', 'Accepted', 'Give the password a digit and a capital letter, and make it finish at “Accepted”.'],
      ['heating', 'Heater on', 'Make the room cold so the token finishes at “Heater on”.'],
      ['minibeasts', 'Spider', 'Describe a specimen with eight legs and watch the token run down the key. Make the key name it “Spider”.'],
      ['minibeasts', 'Snail', 'Give the specimen a shell so the key names it “Snail”.'],
      ['vertebrates', 'Bird', 'Choose feathers and watch the token. Make the key name it “Bird”.'],
      ['vertebrates', 'Fish', 'Give it scales and gills so the key says “Fish”.'],
      ['turnstile', 'unlocked', 'Insert a coin to move the token. Get the machine into the state “unlocked”.'],
      ['lock', 'open', 'Press the buttons in the right order. Get the machine into the state “open”.'],
      ['lock', 'open', 'Enter the code to get the machine into the state “open”.'],
      ['lock', 'open', 'Press 2, then 3, then 1 to reach “open”.'],
      ['lock', 'open', 'Press three buttons to reach “open”.'],
    ] as const) {
      const f = pf(cfgOf(chart, goal), text)
      expect(f.length, text).toBeGreaterThan(0)
      expect(f.join(' '), text).toContain('gives the answer away')
    }
  })

  it('refuses a prompt that promises the card will mark something else or do something else', () => {
    const g = cfgOf('grade', 'Pass')
    for (const text of [
      'Use the controls to reach “Pass” with the fewest changes.',
      'Press as few buttons as you can to reach “Pass”.',
      'Draw the flowchart and make it finish at “Pass”.',
      'Build a flowchart that finishes at “Pass”.',
      'Write the pseudocode, then make the token finish at “Pass”.',
      'Complete the trace table so the token finishes at “Pass”.',
      'Add a loop and make it finish at “Pass”.',
      'Label the symbols, then make it finish at “Pass”.',
    ]) {
      expect(pf(g, text).length, text).toBeGreaterThan(0)
    }
    expect(pf(cfgOf('turnstile', 'unlocked'), 'Reach “unlocked” in the shortest way.').join(' ')).toContain('does not mark')
  })

  it('lets the aim and the gesture through, in a tutor’s own words', () => {
    for (const [chart, goal, text] of [
      ['grade', 'Pass', 'Change the mark with the slider under the chart and watch the token run. Make it finish at “Pass”.'],
      ['grade', 'Resit', 'Use the controls below the chart. Where does the token stop? Make it finish at “Resit”.'],
      ['ride', 'With adult', 'Use the controls under the chart to set the rider, then make the token finish at “With adult”.'],
      ['minibeasts', 'Bee', 'Use the controls under the key to describe a specimen. Make the key name it “Bee”.'],
      ['vertebrates', 'Mammal', 'Describe a specimen with the controls under the key and see where the token goes. Make it end at “Mammal”.'],
      ['turnstile', 'unlocked', 'Press the buttons under the chart and watch the token. Get the machine into the state “unlocked”.'],
      ['lock', 'one', 'Press the buttons under the chart to move the token. Get the machine into the state “1 right”.'],
      ['lock', 'two', 'Press the buttons under the chart until the machine is in “2 right”.'],
    ] as const) {
      expect(pf(cfgOf(chart, goal), text), text).toEqual([])
    }
  })

  it('every refusal carries an example that works for the config it refuses', () => {
    for (const c of ALL) {
      const cfg = engine.parse(c)!
      const f = pf(cfg, 'Set it to 12.')
      expect(f.length).toBeGreaterThan(0)
      const example = /\("([^)]*)"\)\s*$/.exec(f[0])![1]
      expect(pf(cfg, example), example).toEqual([])
      expect(example).toBe(goodPrompt(cfg))
    }
  })
})

// ---------------------------------------------------------------------------
describe('the token’s walk in time', () => {
  it('starts in the left cap of Start, walks along every arrow of the run, and ends in the left cap of its end', () => {
    for (const c of flows) {
      for (const at of everyAt(c).slice(0, 30)) {
        const run = runChart(c, at)
        const r = routeOf(c, run)
        const total = r.segs.reduce((s, x) => s + x.len, 0)
        expect(total).toBeCloseTo(r.total, 6)
        for (let i = 1; i < r.segs.length; i++) {
          expect(r.segs[i].a.x).toBeCloseTo(r.segs[i - 1].b.x, 6)
          expect(r.segs[i].a.y).toBeCloseTo(r.segs[i - 1].b.y, 6)
        }
        const start = nodeOf(c, 'start')
        const end = nodeOf(c, run.end)
        expect(pointAt(r, 0, { x: 0, y: 0 }).x).toBeCloseTo(start.x - start.w / 2 + 12, 6)
        expect(pointAt(r, r.total, { x: 0, y: 0 }).x).toBeCloseTo(end.x - end.w / 2 + 12, 6)
        run.edges.forEach((k) => {
          expect(r.edgeStart[k]).toBeLessThan(r.edgeEnd[k])
          expect(r.nodeAt[c.edges[k].to]).toBeCloseTo(r.edgeEnd[k], 6)
        })
        run.nodes.forEach((id) => expect(r.nodeAt[id]).toBeDefined())
      }
    }
  })

  it('walks at a walking pace, pausing at diamonds, and never goes backwards', () => {
    for (const c of flows) {
      const r = routeOf(c, runChart(c, atOf(c, undefined)))
      const d = durationOf(r)
      expect(d).toBeGreaterThan(r.total / SPEED - 1e-9)
      expect(d).toBeLessThan(6)
      expect(d).toBeGreaterThan(0.5)
      let prev = -1
      for (let t = 0; t <= d + 0.1; t += 0.02) {
        const L = lengthAt(r, t)
        expect(L).toBeGreaterThanOrEqual(prev - 1e-9)
        prev = L
      }
      expect(lengthAt(r, d + 1)).toBeCloseTo(r.total, 6)
      expect(lengthAt(r, 0)).toBe(0)
    }
  })

  it('pauses for a moment on reaching a diamond', () => {
    const g = FLOWCHARTS[0]
    const r = routeOf(g, runChart(g, { mark: 12 }))
    const pausing = r.segs.filter((s) => s.pause > 0)
    expect(pausing.length).toBe(2)
    // Through the pause the token does not move.
    let at = 0
    for (const s of r.segs) {
      at += s.len / SPEED
      if (s.pause) {
        expect(lengthAt(r, at + s.pause / 2)).toBeCloseTo(lengthAt(r, at), 6)
        break
      }
    }
  })
})

// ---------------------------------------------------------------------------
describe('the view', () => {
  const root = join(process.cwd(), 'lib/studylab/engines/flowchart')
  const src = readFileSync(join(root, 'View.tsx'), 'utf8')
  const render = (cfg: FcConfig, state: FcState, marked: 'idle' | 'right' | 'wrong' | 'shown', reduced = true) =>
    renderToStaticMarkup(createElement(FlowchartView, { config: cfg, state, setState: () => {}, marked, reduced, locked: marked === 'right' }))
  const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '\"').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
  const attrs = (html: string) => [...html.matchAll(/aria-[a-z]+="([^"]*)"/g)].map((m) => m[1]).join(' ')

  it('its plate agrees with the config, and its keys do not let the board move the card', () => {
    expect(W).toBe(CHART_W)
    expect(src).toContain('stopPropagation')
    expect(src).toContain('touch-none')
    expect(src).toContain('whitespace-nowrap')
    expect(src).toContain('focus-visible')
    expect(src).not.toMatch(/capitalize/)
    expect(src).not.toMatch(/linear-gradient|radial-gradient|bg-gradient|drop-shadow|boxShadow|shadow-(?:sm|md|lg|xl)/)
  })

  it('draws every chart, with no NaN, every shape named, and every control a real button or spinbutton', () => {
    for (const c of CHARTS) {
      const cfg = engine.parse({ chart: c.id })!
      const html = render(cfg, engine.initial(cfg), 'idle')
      expect(html, c.id).not.toMatch(/NaN|undefined|Infinity/)
      const words = text(html)
      if (isMachine(c)) for (const s of c.states) expect(words, s.id).toContain(s.text)
      else for (const n of c.nodes) expect(words, n.id).toContain(n.text)
      for (const b of html.matchAll(/<button[^>]*>/g)) expect(b[0], c.id).toMatch(/aria-label="[^"]+"/)
      expect(html).toContain('role="img"')
    }
  })

  it('a run card holds nothing of the answer before it is marked, in the picture, the text or the aria', () => {
    for (const c of ALL) {
      const cfg = engine.parse(c)!
      const html = render(cfg, engine.initial(cfg), 'idle')
      const t = text(html)
      expect(t, JSON.stringify(c)).not.toMatch(/\bYes\. |Near enough|never asked|took the machine|With these settings|After \d+ presses?|Nothing has been pressed/)
      expect(attrs(html), JSON.stringify(c)).not.toMatch(/\b(?:correct|wrong|goal|answer|solved|aim|target|well done)\b/i)
      expect(html).not.toMatch(/data-goal|data-solved|data-answer/)
    }
  })

  it('says what the token did once marked, and the word right or wrong only through the page', () => {
    const cfg = engine.parse({ chart: 'grade', goal: 'Pass' })!
    expect(text(render(cfg, { at: { mark: 12 } }, 'right'))).toContain('Yes. The token took No at "mark ≥ 16?", Yes at "mark ≥ 10?" and ended at Pass.')
    expect(text(render(cfg, { at: { mark: 4 } }, 'wrong'))).toContain('With these settings the token took No at "mark ≥ 16?", No at "mark ≥ 10?" and ended at Resit.')
    const shown = text(render(cfg, { at: { mark: 4 } }, 'shown'))
    expect(shown).toContain('ended at Pass')
    const lock = engine.parse({ chart: 'lock', goal: 'open' })!
    expect(text(render(lock, { presses: ['2', '1'] }, 'wrong'))).toContain('After 2 presses the machine is locked.')
    expect(text(render(lock, { presses: [] }, 'shown'))).toContain('3 presses took the machine from locked to open')
  })

  it('every move changes the drawing: a still frame under reduced motion shows the new path', () => {
    const cfg = engine.parse({ chart: 'grade', goal: 'Pass' })!
    const a = render(cfg, { at: { mark: 9 } }, 'idle')
    const b = render(cfg, { at: { mark: 10 } }, 'idle')
    expect(a).not.toBe(b)
    const trail = (h: string) => /data-trail="1"/.test(h) ? /<path d="([^"]*)"[^>]*data-trail/.exec(h)![1] : ''
    expect(trail(a)).not.toBe(trail(b))
    expect(text(a)).toContain('Resit')
    expect(/data-readout="end">([^<]*)</.exec(a)![1]).toBe('Resit')
    expect(/data-readout="end">([^<]*)</.exec(b)![1]).toBe('Pass')
    // One diamond's branch is lit and the other is not.
    expect(a).toContain('data-branch="no"')
    const m = engine.parse({ chart: 'turnstile', goal: 'unlocked' })!
    const p0 = render(m, { presses: [] }, 'idle')
    const p1 = render(m, { presses: ['coin'] }, 'idle')
    expect(p0).not.toBe(p1)
    expect(/data-state="locked" data-here="(\d)"/.exec(p0)![1]).toBe('1')
    expect(/data-state="locked" data-here="(\d)"/.exec(p1)![1]).toBe('0')
    expect(/data-state="unlocked" data-here="(\d)"/.exec(p1)![1]).toBe('1')
    expect(/data-readout="now">([^<]*)</.exec(p1)![1]).toBe('unlocked')
    expect(/data-readout="presses">([^<]*)</.exec(p1)![1]).toBe('1')
  })

  it('a press that changes nothing still draws: the token loops, and the arrow it took is lit', () => {
    const m = engine.parse({ chart: 'turnstile', goal: 'unlocked' })!
    const html = render(m, { presses: ['push'] }, 'idle')
    expect(/data-state="locked" data-here="(\d)"/.exec(html)![1]).toBe('1')
    expect(html).toContain('data-hot="1"')
  })

  it('the controls reflect the inputs, and lock when the card is marked right', () => {
    const cfg = engine.parse({ chart: 'password', goal: 'Accepted' })!
    const open = render(cfg, { at: { length: 3, digit: 1, capital: 0 } }, 'idle')
    expect(open).toContain('7 letters')
    expect(open).toMatch(/aria-label="Has a digit: Yes"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*aria-label="Has a digit: Yes"/)
    expect(open).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Has a digit/)
    const done = render(cfg, { at: { length: 6, digit: 1, capital: 1 } }, 'right')
    expect(done).toMatch(/<button[^>]*disabled=""/)
    const m = engine.parse({ chart: 'lock', goal: 'open' })!
    expect(render(m, { presses: ['2', '3', '1'] }, 'right')).toMatch(/<button[^>]*aria-label="Press 1"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Press 1"/)
    expect(render(m, { presses: [] }, 'idle')).not.toMatch(/<button[^>]*aria-label="Press 1"[^>]*disabled=""/)
  })

  it('shows what each colour and shape is, on the card, before anything is touched', () => {
    const run = text(render(engine.parse({ chart: 'grade' })!, { at: {} }, 'idle'))
    expect(run).toContain('Token')
    expect(run).toContain('Path taken')
    expect(run).toContain('Yes')
    expect(run).toContain('No')
    const mach = text(render(engine.parse({ chart: 'turnstile' })!, { presses: [] }, 'idle'))
    expect(mach).toContain('Token')
    expect(mach).toContain('Current state')
  })

  it('the keyboard hint is shown only to keyboard users', () => {
    const html = render(engine.parse({ chart: 'grade' })!, { at: {} }, 'idle')
    expect(html).toContain('fc-kbd hidden')
    expect(src).toContain('has(button:focus-visible)')
  })

  it('names sit in sentence case, and no label is below 12 px', () => {
    expect(src).not.toMatch(/uppercase|capitalize/)
    for (const m of src.matchAll(/text-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    for (const m of src.matchAll(/fontSize=\{(\d+)\}/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12)
    for (const c of CHARTS) {
      const names = isMachine(c) ? c.states.map((s) => s.text) : c.nodes.map((n) => n.text)
      for (const n of names) expect(n, `${c.id} ${n}`).not.toMatch(/^[A-Z][a-z]*(?: [A-Z][a-z]+)+$/)
    }
  })

  it('goes through the page: the prompt prints, and the card draws its own view', () => {
    const prompt = goodPrompt(engine.parse({ chart: 'grade', goal: 'Pass' })!)
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(ActivityNode as never, {
      id: 'n1', data: { spec: { pattern: 'scene', prompt, payload: { engine: 'flowchart', config: { chart: 'grade', goal: 'Pass' } }, success: { kind: 'scene' } } },
    } as never)))
    expect(html).toContain('Make it finish at')
    expect(html).toContain('Token')
    expect(html).not.toMatch(/Yes\. The token/)
    expect(text(html)).not.toContain('With these settings')
  })
})

// ---------------------------------------------------------------------------
describe('the catalogue', () => {
  const offered = (st: string) => sceneCatalogue(st).includes('SCENE "flowchart"')
  const madeFor = (st: string) => scenesFor(st).some((e) => e.id === 'flowchart')

  it('is registered under its id, and the tutor can read what it is for', () => {
    expect(getEngine('flowchart')?.id).toBe('flowchart')
    expect(engine.prompt).toContain('SCENE "flowchart"')
    for (const id of CHART_IDS) expect(engine.prompt, id).toContain(id)
    for (const c of CHARTS) for (const g of goalNames(c)) expect(engine.prompt, g).toContain(g)
    expect(engine.prompt).toContain('do NOT give a value')
    expect(engine.isolates).toBe('consequence')
  })

  it('is offered for the stations it is made for, by the names the books use', () => {
    for (const st of [
      'Algorithms and flowcharts', 'Flowchart algorithms', 'Selection in flowcharts', 'Flowcharts with conditional statements', 'Chapter 7: Algorithm design and flow charts',
      'Dichotomous key of identification of organism', 'Identification keys', 'Using a dichotomous key', 'Grouping and identifying organisms', 'Identifying organisms with a key',
      'Finite state machines', 'State machines and state diagrams', 'The turnstile: a state machine', 'Classification of living organisms: using keys', 'Vertebrates', 'Minibeasts',
    ]) {
      expect(offered(st), st).toBe(true)
      expect(madeFor(st), st).toBe(true)
    }
  })

  it('is left out of the stations it is a near miss for', () => {
    for (const st of [
      'Cash flow forecasts', 'Energy flow in food chains', 'Primary key and foreign key', 'Public key encryption', 'Key stage 3 skills', 'Key terms and definitions', 'Keyboard shortcuts', 'Map keys and symbols',
      'Decision trees in probability', 'Tree diagrams', 'Data flow diagrams', 'Blood flow through the heart', 'Water flow in rivers', 'Making decisions in business', 'States of matter', 'Changes of state',
      'Social networks', 'Arms of government', 'The water cycle', 'Flow of control in programs', 'Workflow management', 'Organisation charts', 'Gantt charts', 'Musical keys and key signatures',
      'The nitrogen cycle', 'Sonnets and rhyme schemes', 'Food chains', 'Sorting and searching algorithms', 'Traffic flow', 'Pie charts and bar charts',
      'Flowchart of the water cycle', 'Flow chart for the carbon cycle', 'Flow diagram of the digestive process',
    ]) {
      expect(offered(st), st).toBe(false)
      expect(madeFor(st), st).toBe(false)
    }
  })
})

// A map of every shape, for the test above to read: text and kinds stay in sentence case and short.
describe('the words on the charts', () => {
  it('every end and state has a short, unique, plain name', () => {
    for (const c of CHARTS) {
      const names = isMachine(c) ? c.states.map((s) => s.text) : c.nodes.filter((n) => n.kind === 'out').map((n) => n.text)
      expect(new Set(names.map((n) => n.toLowerCase())).size, c.id).toBe(names.length)
      for (const n of names) {
        expect(n.length).toBeLessThanOrEqual(16)
        expect(n).not.toMatch(/[^\w ’'’-]/)
      }
    }
  })

  it('textOfEnd reads both kinds of chart', () => {
    expect(textOfEnd(CHARTS[0], 'pass')).toBe('Pass')
    expect(textOfEnd(MACHINES[1], 'one')).toBe('1 right')
  })

  it('anchors sit on the shapes’ edges', () => {
    const c = FLOWCHARTS[0]
    const d = nodeOf(c, 'd1')
    expect(anchor(d, 'b').y).toBe(d.y + d.h / 2)
    expect(anchor(d, 'r').x).toBe(d.x + d.w / 2)
    expect(machineEdgeText(MACHINES[0] as Machine, MACHINES[0].edges[0])).toBe('coin')
    expect(machineEdgeText(MACHINES[1] as Machine, MACHINES[1].edges[6])).toBe('any')
    expect(machineEdgeText(MACHINES[1] as Machine, MACHINES[1].edges[3])).toBe('1, 3')
  })
})
