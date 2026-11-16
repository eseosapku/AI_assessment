// lib/studylab/engines/flowchart/config.ts
//
// A token that runs through a chart and visibly takes each branch. Two ideas, one picture language:
//   run     -- a flowchart or an identification key. The learner sets the inputs (a mark, a height, a trait of a
//              specimen) with ordinary controls under the chart, and a token runs from Start, taking each diamond's
//              Yes or No branch and lighting the path, until it stops at an end. Aim: make it finish at the named end.
//   machine -- a state machine. The learner presses the machine's buttons; the token moves along the arrow for that
//              press, or stays put when there is no arrow that changes anything. Aim: get the machine into a named state.
//
// The rules, all computed here and never read from the drawing:
//   a diamond tests one input and has exactly one Yes branch and one No branch, so a given set of inputs takes exactly
//   one path; a machine has exactly one arrow for every (state, button), so a given list of presses ends in one state.
//   The card passes exactly when the token ends where the task named. Any inputs that get there will do.
//
// Facts: the charts are the usual school ones, written from general knowledge of the syllabuses (IGCSE / O Level
// computer science flowcharts: terminator, input/output, decision; Cambridge IGCSE biology vertebrate groups and a
// minibeast key; the coin turnstile as the standard two-state machine) and were not checked against a specification.
// The keys are simplified on purpose, as school keys are: a question is asked only of the traits it names.
//
// Ideas taken, never code or art:
//   - the learner as the one who runs the thing, not the one who labels it: following a key BACKWARDS to make an
//     imaginary organism (dichotomous-key lesson plans surveyed on ERIC EJ831466 and BIOS "Keys to the Ocean"), so the
//     card asks for an input that makes the token end at a name, rather than a quiz question at each fork;
//   - the usual flowchart faults (a diamond with one branch followed, the other forgotten; the diamond treated as if it
//     did the sum) are met by showing both labelled branches at every diamond and lighting only the one taken;
//   - the machine ignoring a button that has no arrow (inputs that cause no change: Brilliant's finite-state-machines
//     wiki on the turnstile) is shown as a loop arrow the token traces and returns from;
//   - tools that show a machine running on its input and the transition taken (FSMIPR, SIGCSE poster 2024).
// Refused: loops (algorithm-tracer does them), building or drawing a chart (a different, much larger scene), trace
// tables, symbols to match, accepting-state theory, and arbitrary charts written by the tutor (it names a chart).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { FlowchartView } from './View'

export const CHART_W = 360
export const MAX_PRESSES = 12

export type Side = 't' | 'b' | 'l' | 'r'
export type Pt = { x: number; y: number }

export type Test =
  | { v: string; op: 'yes' }
  | { v: string; op: 'is'; val: string }
  | { v: string; op: '>=' | '<'; val: number }

export type FlowInput =
  | { id: string; label: string; kind: 'toggle'; start: number }
  | { id: string; label: string; kind: 'steps'; values: (string | number)[]; start: number; unit?: string }

export type FNode = { id: string; kind: 'start' | 'input' | 'decision' | 'out'; text: string; x: number; y: number; w: number; h: number; test?: Test }
export type FEdge = { from: string; to: string; leave: Side; enter: Side; when?: boolean }
export type FlowChart = {
  kind: 'flow' | 'key'
  id: string
  name: string
  inputs: FlowInput[]
  nodes: FNode[]
  edges: FEdge[]
  H: number
  defaultGoal: string
  /** Words the prompt must not use: they say which way the token will go. */
  giveaways: RegExp
  /** What the readout says the token or key did. */
  readout: string
}

export type MEvent = { id: string; label: string; short: string }
export type MState = { id: string; text: string; x: number; y: number }
export type MEdge = { from: string; to: string; on: string[]; bulge?: number; loop?: boolean; /** The label sits inside the curve, between it and the states. */ labelIn?: boolean }
export type Machine = {
  kind: 'machine'
  id: string
  name: string
  events: MEvent[]
  r: number
  states: MState[]
  edges: MEdge[]
  start: string
  H: number
  defaultGoal: string
  giveaways: RegExp
}
export type Chart = FlowChart | Machine

export type FcConfig = { task: 'run' | 'machine'; chart: string; goal: string }
/** What the learner has done: input values as an index into each input's values, or the buttons pressed so far. */
export type FcState = { at?: Record<string, number>; presses?: string[] }

// ---------------------------------------------------------------------------
// The flowcharts and keys. All are ladders: each diamond sends one end off to the side and the token carries on
// down. The ladder is laid out here from its content, so a chart cannot be drawn with its parts overlapping.

const CX = 100
const SX = 280
export const tw = (s: string) => s.length * 6.8
const ovalW = (s: string) => Math.min(140, Math.max(76, Math.round(s.length * 7.2 + 44)))
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

type Rung = { q: string; test: Test; side: 'yes' | 'no'; out: { id: string; text: string } }

function ladder(o: {
  id: string; name: string; kind: 'flow' | 'key'; inputs: FlowInput[]; start: string; input?: string
  rungs: Rung[]; last: { id: string; text: string }; defaultGoal: string; giveaways: RegExp; readout: string
}): FlowChart {
  const nodes: FNode[] = [{ id: 'start', kind: 'start', text: o.start, x: CX, y: 20, w: ovalW(o.start), h: 24 }]
  const edges: FEdge[] = []
  let prev = 'start'
  let bottom = 32
  let prevWhen: boolean | undefined
  if (o.input) {
    const y = bottom + 12 + 13
    nodes.push({ id: 'input', kind: 'input', text: o.input, x: CX, y, w: Math.max(112, ovalW(o.input)), h: 26 })
    edges.push({ from: prev, to: 'input', leave: 'b', enter: 't' })
    prev = 'input'
    bottom = y + 13
  }
  o.rungs.forEach((r, i) => {
    const y = bottom + 12 + 17
    const id = `d${i + 1}`
    nodes.push({ id, kind: 'decision', text: r.q, x: CX, y, w: 128, h: 34, test: r.test })
    edges.push({ from: prev, to: id, leave: 'b', enter: 't', when: prevWhen })
    nodes.push({ id: r.out.id, kind: 'out', text: r.out.text, x: SX, y, w: ovalW(r.out.text), h: 26 })
    edges.push({ from: id, to: r.out.id, leave: 'r', enter: 'l', when: r.side === 'yes' })
    prev = id
    prevWhen = r.side !== 'yes'
    bottom = y + 17
  })
  const ly = bottom + 12 + 13
  nodes.push({ id: o.last.id, kind: 'out', text: o.last.text, x: CX, y: ly, w: ovalW(o.last.text), h: 26 })
  edges.push({ from: prev, to: o.last.id, leave: 'b', enter: 't', when: prevWhen })
  return { kind: o.kind, id: o.id, name: o.name, inputs: o.inputs, nodes, edges, H: ly + 13 + 12, defaultGoal: o.defaultGoal, giveaways: o.giveaways, readout: o.readout }
}

const toggle = (id: string, label: string): FlowInput => ({ id, label, kind: 'toggle', start: 0 })

export const FLOWCHARTS: FlowChart[] = [
  ladder({
    id: 'grade', name: 'Exam grade', kind: 'flow', start: 'Start', input: 'Input mark',
    inputs: [{ id: 'mark', label: 'Mark out of 20', kind: 'steps', values: range(0, 20), start: 9 }],
    rungs: [
      { q: 'mark ≥ 16?', test: { v: 'mark', op: '>=', val: 16 }, side: 'yes', out: { id: 'distinction', text: 'Distinction' } },
      { q: 'mark ≥ 10?', test: { v: 'mark', op: '>=', val: 10 }, side: 'yes', out: { id: 'pass', text: 'Pass' } },
    ],
    last: { id: 'resit', text: 'Resit' }, defaultGoal: 'pass', giveaways: /\b(?:boundar(?:y|ies)|threshold|cut-?off|pass mark|grade boundaries)\b/i, readout: 'Token ends at',
  }),
  ladder({
    id: 'ride', name: 'Theme park ride', kind: 'flow', start: 'Start', input: 'Input rider',
    inputs: [{ id: 'height', label: 'Height', kind: 'steps', values: range(10, 17).map((n) => n * 10), start: 4, unit: ' cm' }, toggle('adult', 'Adult with you')],
    rungs: [
      { q: 'height ≥ 120?', test: { v: 'height', op: '>=', val: 120 }, side: 'yes', out: { id: 'ride-alone', text: 'Ride alone' } },
      { q: 'with adult?', test: { v: 'adult', op: 'yes' }, side: 'yes', out: { id: 'with-adult', text: 'With adult' } },
    ],
    last: { id: 'too-small', text: 'Too small' }, defaultGoal: 'with-adult', giveaways: /\b(?:height limit|minimum height|tall enough|short enough|adult)\b/i, readout: 'Token ends at',
  }),
  ladder({
    id: 'password', name: 'Password check', kind: 'flow', start: 'Start', input: 'Input password',
    inputs: [{ id: 'length', label: 'Length', kind: 'steps', values: range(4, 12), start: 2, unit: ' letters' }, toggle('digit', 'Has a digit'), toggle('capital', 'Has a capital')],
    rungs: [
      { q: 'length ≥ 8?', test: { v: 'length', op: '>=', val: 8 }, side: 'no', out: { id: 'too-short', text: 'Too short' } },
      { q: 'has a digit?', test: { v: 'digit', op: 'yes' }, side: 'no', out: { id: 'add-digit', text: 'Add a digit' } },
      { q: 'has capital?', test: { v: 'capital', op: 'yes' }, side: 'no', out: { id: 'add-capital', text: 'Add a capital' } },
    ],
    last: { id: 'accepted', text: 'Accepted' }, defaultGoal: 'accepted', giveaways: /\b(?:long enough|capital letter|uppercase|upper case|digits?|numbers?|characters?|letters?)\b/i, readout: 'Token ends at',
  }),
  ladder({
    id: 'heating', name: 'Heating controller', kind: 'flow', start: 'Start', input: 'Input sensors',
    inputs: [{ id: 'temp', label: 'Temperature', kind: 'steps', values: range(10, 24), start: 8, unit: ' °C' }, toggle('window', 'Window open')],
    rungs: [
      { q: 'window open?', test: { v: 'window', op: 'yes' }, side: 'yes', out: { id: 'window-warning', text: 'Window warning' } },
      { q: 'temp < 18?', test: { v: 'temp', op: '<', val: 18 }, side: 'yes', out: { id: 'heater-on', text: 'Heater on' } },
    ],
    last: { id: 'heater-off', text: 'Heater off' }, defaultGoal: 'heater-on', giveaways: /\b(?:cold|warm|hot|cool|too cold|too hot|set ?point|degrees)\b/i, readout: 'Token ends at',
  }),
  ladder({
    id: 'minibeasts', name: 'Minibeast key', kind: 'key', start: 'Specimen',
    inputs: [toggle('shell', 'Shell'), { id: 'legs', label: 'Legs', kind: 'steps', values: [6, 8], start: 0 }, { id: 'wings', label: 'Wings', kind: 'steps', values: [0, 2, 4], start: 0 }],
    rungs: [
      { q: 'has a shell?', test: { v: 'shell', op: 'yes' }, side: 'yes', out: { id: 'snail', text: 'Snail' } },
      { q: '8 legs?', test: { v: 'legs', op: 'is', val: '8' }, side: 'yes', out: { id: 'spider', text: 'Spider' } },
      { q: 'has wings?', test: { v: 'wings', op: '>=', val: 2 }, side: 'no', out: { id: 'ant', text: 'Ant' } },
      { q: '4 wings?', test: { v: 'wings', op: 'is', val: '4' }, side: 'yes', out: { id: 'bee', text: 'Bee' } },
    ],
    last: { id: 'housefly', text: 'Housefly' }, defaultGoal: 'spider', giveaways: /\b(?:shells?|legs?|legged|wings?|winged|wingless|six|eight|antennae|insect|arachnid|mollusc)\b/i, readout: 'The key says',
  }),
  ladder({
    id: 'vertebrates', name: 'Vertebrate key', kind: 'key', start: 'Specimen',
    inputs: [{ id: 'covering', label: 'Skin covering', kind: 'steps', values: ['scales', 'moist skin', 'feathers', 'hair'], start: 0 }, toggle('gills', 'Gills')],
    rungs: [
      { q: 'has hair?', test: { v: 'covering', op: 'is', val: 'hair' }, side: 'yes', out: { id: 'mammal', text: 'Mammal' } },
      { q: 'feathers?', test: { v: 'covering', op: 'is', val: 'feathers' }, side: 'yes', out: { id: 'bird', text: 'Bird' } },
      { q: 'moist skin?', test: { v: 'covering', op: 'is', val: 'moist skin' }, side: 'yes', out: { id: 'amphibian', text: 'Amphibian' } },
      { q: 'has gills?', test: { v: 'gills', op: 'yes' }, side: 'yes', out: { id: 'fish', text: 'Fish' } },
    ],
    last: { id: 'reptile', text: 'Reptile' }, defaultGoal: 'bird', giveaways: /\b(?:hair|fur|furry|feathers?|feathered|scales?|scaly|moist|slimy|gills?|skin|wings?|lay eggs|warm-?blooded|cold-?blooded|live young)\b/i, readout: 'The key says',
  }),
]

// ---------------------------------------------------------------------------
// The state machines.

export const MACHINES: Machine[] = [
  {
    kind: 'machine', id: 'turnstile', name: 'Coin turnstile', start: 'locked', r: 36, H: 190, defaultGoal: 'unlocked',
    events: [{ id: 'coin', label: 'Insert coin', short: 'coin' }, { id: 'push', label: 'Push', short: 'push' }],
    states: [{ id: 'locked', text: 'locked', x: 95, y: 118 }, { id: 'unlocked', text: 'unlocked', x: 265, y: 118 }],
    edges: [
      { from: 'locked', to: 'unlocked', on: ['coin'], bulge: -34 },
      { from: 'unlocked', to: 'locked', on: ['push'], bulge: -34 },
      { from: 'locked', to: 'locked', on: ['push'], loop: true },
      { from: 'unlocked', to: 'unlocked', on: ['coin'], loop: true },
    ],
    giveaways: /\b(?:coins?|push(?:es|ed|ing)?|insert(?:s|ed|ing)?|pay(?:s|ing)?|turn(?:s|ed|ing)?|rotat\w*|ticket)\b/i,
  },
  {
    kind: 'machine', id: 'lock', name: 'Keypad lock', start: 'locked', r: 28, H: 182, defaultGoal: 'open',
    events: [{ id: '1', label: 'Press 1', short: '1' }, { id: '2', label: 'Press 2', short: '2' }, { id: '3', label: 'Press 3', short: '3' }],
    states: [{ id: 'locked', text: 'locked', x: 46, y: 92 }, { id: 'one', text: '1 right', x: 138, y: 92 }, { id: 'two', text: '2 right', x: 230, y: 92 }, { id: 'open', text: 'open', x: 322, y: 92 }],
    edges: [
      { from: 'locked', to: 'one', on: ['2'] },
      { from: 'one', to: 'two', on: ['3'] },
      { from: 'two', to: 'open', on: ['1'] },
      { from: 'locked', to: 'locked', on: ['1', '3'], loop: true },
      { from: 'one', to: 'locked', on: ['1', '2'], bulge: -16, labelIn: true },
      { from: 'two', to: 'locked', on: ['2', '3'], bulge: -50 },
      { from: 'open', to: 'open', on: ['1', '2', '3'], loop: true },
    ],
    giveaways: /\b(?:code|combination|sequence|order|digits?|numbers?|in turn|one after|then)\b/i,
  },
]

export const CHARTS: Chart[] = [...FLOWCHARTS, ...MACHINES]
export const CHART_IDS = CHARTS.map((c) => c.id)

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
export function chartOf(id: string): Chart | null {
  return CHARTS.find((c) => c.id === id) ?? null
}
export const isMachine = (c: Chart): c is Machine => c.kind === 'machine'

/** The chart a config draws; a config that faults still gets a chart, so nothing can crash on it. */
export function chartFor(config: FcConfig): Chart {
  return chartOf(config.chart) ?? (config.task === 'machine' ? MACHINES[0] : FLOWCHARTS[0])
}

// ---------------------------------------------------------------------------
// Geometry. Everything on the plate is placed here, so a test can check it without drawing anything.

export const nodeOf = (chart: FlowChart, id: string): FNode => chart.nodes.find((n) => n.id === id) ?? chart.nodes[0]

export function anchor(n: FNode, side: Side): Pt {
  if (side === 't') return { x: n.x, y: n.y - n.h / 2 }
  if (side === 'b') return { x: n.x, y: n.y + n.h / 2 }
  if (side === 'l') return { x: n.x - n.w / 2, y: n.y }
  return { x: n.x + n.w / 2, y: n.y }
}

/** Where the token rests in a rounded shape: in its left cap, clear of the words. */
export const capOf = (n: FNode): Pt => ({ x: n.x - n.w / 2 + 12, y: n.y })

/** The corners of a decision's diamond or an input's parallelogram. */
export function outline(n: FNode): Pt[] {
  if (n.kind === 'decision') return [{ x: n.x, y: n.y - n.h / 2 }, { x: n.x + n.w / 2, y: n.y }, { x: n.x, y: n.y + n.h / 2 }, { x: n.x - n.w / 2, y: n.y }]
  const s = 9
  return [{ x: n.x - n.w / 2 + s, y: n.y - n.h / 2 }, { x: n.x + n.w / 2, y: n.y - n.h / 2 }, { x: n.x + n.w / 2 - s, y: n.y + n.h / 2 }, { x: n.x - n.w / 2, y: n.y + n.h / 2 }]
}

/** The line an arrow follows, from the edge of one shape to the edge of the next, in right angles. */
export function edgePoints(chart: FlowChart, e: FEdge): Pt[] {
  const s = anchor(nodeOf(chart, e.from), e.leave)
  const t = anchor(nodeOf(chart, e.to), e.enter)
  const vertical = (side: Side) => side === 't' || side === 'b'
  if (vertical(e.leave) && vertical(e.enter)) {
    if (Math.abs(s.x - t.x) < 0.5) return [s, t]
    const my = (s.y + t.y) / 2
    return [s, { x: s.x, y: my }, { x: t.x, y: my }, t]
  }
  if (!vertical(e.leave) && !vertical(e.enter)) {
    if (Math.abs(s.y - t.y) < 0.5) return [s, t]
    const mx = (s.x + t.x) / 2
    return [s, { x: mx, y: s.y }, { x: mx, y: t.y }, t]
  }
  return !vertical(e.leave) ? [s, { x: t.x, y: s.y }, t] : [s, { x: s.x, y: t.y }, t]
}

/** Where Yes or No is written: on the first stretch of the arrow, clear of the line and of the shapes. */
export function edgeLabelAt(chart: FlowChart, e: FEdge): { x: number; y: number; anchor: 'start' | 'middle' } {
  const pts = edgePoints(chart, e)
  const a = pts[0]
  const b = pts[1]
  if (Math.abs(a.y - b.y) < 0.5) return { x: (a.x + b.x) / 2, y: a.y - 9, anchor: 'middle' }
  return { x: a.x + 8, y: a.y + Math.min(7, Math.abs(b.y - a.y) / 2) * Math.sign(b.y - a.y), anchor: 'start' }
}

type Bez = { p0: Pt; c1: Pt; c2: Pt; p1: Pt }
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

export function bezAt(g: Bez, t: number): Pt {
  const a = lerp(g.p0, g.c1, t)
  const b = lerp(g.c1, g.c2, t)
  const c = lerp(g.c2, g.p1, t)
  return lerp(lerp(a, b, t), lerp(b, c, t), t)
}

export const stateOf = (m: Machine, id: string): MState => m.states.find((s) => s.id === id) ?? m.states[0]

/** An arrow between states (a gentle curve, or straight) or a loop above a state, as a cubic curve. */
export function machineEdgeGeometry(m: Machine, e: MEdge): Bez & { label: Pt } {
  const a = stateOf(m, e.from)
  const b = stateOf(m, e.to)
  const r = m.r
  if (e.loop) {
    const p0 = { x: a.x - r * 0.5, y: a.y - r * 0.866 }
    const p1 = { x: a.x + r * 0.5, y: a.y - r * 0.866 }
    const c1 = { x: a.x - 30, y: a.y - r - 40 }
    const c2 = { x: a.x + 30, y: a.y - r - 40 }
    return { p0, c1, c2, p1, label: { x: a.x, y: a.y - 0.9665 * r - 30 - 10 } }
  }
  const bulge = e.bulge ?? 0
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const n = { x: -dy / len, y: dx / len }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const ctrl = { x: mid.x + n.x * bulge * 2, y: mid.y + n.y * bulge * 2 }
  const toward = (from: MState) => {
    const ux = ctrl.x - from.x
    const uy = ctrl.y - from.y
    const l = Math.hypot(ux, uy) || 1
    return { x: from.x + (ux / l) * r, y: from.y + (uy / l) * r }
  }
  const p0 = toward(a)
  const p1 = toward(b)
  const side = (bulge === 0 ? -1 : Math.sign(bulge)) * (e.labelIn ? -1 : 1)
  const apex = { x: 0.25 * p0.x + 0.5 * ctrl.x + 0.25 * p1.x, y: 0.25 * p0.y + 0.5 * ctrl.y + 0.25 * p1.y }
  const c1 = lerp(p0, ctrl, 2 / 3)
  const c2 = lerp(p1, ctrl, 2 / 3)
  return { p0, c1, c2, p1, label: { x: apex.x + n.x * side * 11, y: apex.y + n.y * side * 11 } }
}

export function machineEdgeText(m: Machine, e: MEdge): string {
  if (e.on.length === m.events.length) return 'any'
  return e.on.map((id) => m.events.find((x) => x.id === id)?.short ?? id).join(', ')
}

// ---------------------------------------------------------------------------
// Running a flowchart or key.

export const inputValues = (i: FlowInput): (string | number)[] => (i.kind === 'toggle' ? ['No', 'Yes'] : i.values)

/** The learner's inputs, each read safely as an index in range; anything else counts for nothing. */
export function atOf(chart: FlowChart, state: FcState | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const i of chart.inputs) {
    const raw = state?.at && typeof state.at === 'object' ? (state.at as Record<string, unknown>)[i.id] : undefined
    const max = inputValues(i).length - 1
    out[i.id] = typeof raw === 'number' && Number.isInteger(raw) ? Math.max(0, Math.min(max, raw)) : i.start
  }
  return out
}

export function valueText(i: FlowInput, index: number): string {
  const v = inputValues(i)[index]
  return i.kind === 'steps' && i.unit ? `${v}${i.unit}` : String(v)
}

export function holds(chart: FlowChart, at: Record<string, number>, t: Test): boolean {
  const input = chart.inputs.find((i) => i.id === t.v)
  if (!input) return false
  const idx = at[t.v] ?? input.start
  const v = inputValues(input)[idx]
  if (t.op === 'yes') return idx === 1
  if (t.op === 'is') return String(v) === t.val
  if (t.op === '>=') return Number(v) >= t.val
  return Number(v) < t.val
}

export type Run = { nodes: string[]; edges: number[]; end: string }

/** The token's walk: from Start, one branch at every diamond, to an end. */
export function runChart(chart: FlowChart, at: Record<string, number>): Run {
  const nodes = ['start']
  const edges: number[] = []
  let id = 'start'
  for (let guard = 0; guard < 40; guard++) {
    const n = nodeOf(chart, id)
    if (n.kind === 'out') break
    const options = chart.edges.map((e, k) => ({ e, k })).filter(({ e }) => e.from === id)
    const pick = n.kind === 'decision' ? options.find(({ e }) => e.when === holds(chart, at, n.test!)) : options[0]
    if (!pick) break
    edges.push(pick.k)
    id = pick.e.to
    nodes.push(id)
  }
  return { nodes, edges, end: id }
}

/** Every setting of the inputs, nearest the learner's start first. */
export function everyAt(chart: FlowChart): Record<string, number>[] {
  let all: Record<string, number>[] = [{}]
  for (const i of chart.inputs) {
    const n = inputValues(i).length
    all = all.flatMap((a) => Array.from({ length: n }, (_, k) => ({ ...a, [i.id]: k })))
  }
  const away = (a: Record<string, number>) => chart.inputs.reduce((s, i) => s + Math.abs(a[i.id] - i.start), 0)
  return all.sort((a, b) => away(a) - away(b))
}

export const endsOf = (chart: FlowChart): string[] => chart.nodes.filter((n) => n.kind === 'out').map((n) => n.id)

/** Where a given goal can be reached from: the nearest settings that end there. */
export function solveAt(chart: FlowChart, goal: string): Record<string, number> {
  return everyAt(chart).find((a) => runChart(chart, a).end === goal) ?? atOf(chart, undefined)
}

export function startAt(chart: FlowChart, goal: string): Record<string, number> {
  const own = atOf(chart, undefined)
  if (runChart(chart, own).end !== goal) return own
  return everyAt(chart).find((a) => runChart(chart, a).end !== goal) ?? own
}

export type Seg = { a: Pt; b: Pt; len: number; edge?: number; enter?: string; pause: number }
export type Route = { segs: Seg[]; total: number; edgeStart: Record<number, number>; edgeEnd: Record<number, number>; nodeAt: Record<string, number> }

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** The path the token walks as straight stretches, with where along it each shape and arrow is reached. */
export function routeOf(chart: FlowChart, run: Run): Route {
  const segs: Seg[] = []
  const edgeStart: Record<number, number> = {}
  const edgeEnd: Record<number, number> = {}
  const nodeAt: Record<string, number> = { start: 0 }
  let cur: Pt = capOf(nodeOf(chart, 'start'))
  let L = 0
  const push = (a: Pt, b: Pt, extra: Partial<Seg> = {}) => {
    const len = dist(a, b)
    if (len < 0.01) return
    segs.push({ a, b, len, pause: 0, ...extra })
    L += len
  }
  for (const k of run.edges) {
    const e = chart.edges[k]
    const pts = edgePoints(chart, e)
    push(cur, pts[0])
    edgeStart[k] = L
    for (let j = 1; j < pts.length; j++) push(pts[j - 1], pts[j], { edge: k })
    edgeEnd[k] = L
    const into = nodeOf(chart, e.to)
    const last = segs[segs.length - 1]
    if (last && last.edge === k) {
      last.enter = e.to
      last.pause = into.kind === 'decision' ? 0.2 : 0
    }
    nodeAt[e.to] = L
    cur = pts[pts.length - 1]
  }
  const end = nodeOf(chart, run.end)
  push(cur, capOf(end))
  return { segs, total: L, edgeStart, edgeEnd, nodeAt }
}

/** The words for the path: No at "has a shell?", Yes at "8 legs?". */
export function pathWords(chart: FlowChart, run: Run): string {
  const parts: string[] = []
  run.edges.forEach((k) => {
    const e = chart.edges[k]
    const from = nodeOf(chart, e.from)
    if (from.kind === 'decision') parts.push(`${e.when ? 'Yes' : 'No'} at "${from.text}"`)
  })
  return parts.join(', ')
}

/** Inputs the key never asked about on the way: a key asks only what it needs. */
export function unasked(chart: FlowChart, run: Run): string[] {
  const asked = new Set(run.nodes.map((id) => nodeOf(chart, id).test?.v).filter(Boolean) as string[])
  return chart.inputs.filter((i) => !asked.has(i.id)).map((i) => i.label.toLowerCase())
}

// ---------------------------------------------------------------------------
// Running a state machine.

export function nextState(m: Machine, from: string, event: string): string {
  const e = m.edges.find((x) => x.from === from && x.on.includes(event))
  return e ? e.to : from
}

/** The presses, read safely: only this machine's buttons, and no more than a card holds. */
export function pressesOf(m: Machine, state: FcState | undefined): string[] {
  const raw = state?.presses
  if (!Array.isArray(raw)) return []
  return raw.filter((p): p is string => typeof p === 'string' && m.events.some((e) => e.id === p)).slice(0, MAX_PRESSES)
}

export function statesVisited(m: Machine, presses: string[]): string[] {
  const out = [m.start]
  for (const p of presses) out.push(nextState(m, out[out.length - 1], p))
  return out
}

export const finalState = (m: Machine, presses: string[]) => statesVisited(m, presses)[presses.length]

/** The fewest presses to a state, by trying every button from every state in turn. */
export function shortestPresses(m: Machine, goal: string): string[] {
  const seen = new Map<string, string[]>([[m.start, []]])
  const queue = [m.start]
  while (queue.length) {
    const at = queue.shift()!
    for (const ev of m.events) {
      const to = nextState(m, at, ev.id)
      if (seen.has(to)) continue
      seen.set(to, [...seen.get(at)!, ev.id])
      queue.push(to)
    }
  }
  return seen.get(goal) ?? []
}

// ---------------------------------------------------------------------------
// Marking: from the rules, always.

export function goalId(config: FcConfig): string {
  const chart = chartFor(config)
  return resolveGoal(chart, config.goal) ?? chart.defaultGoal
}

export function result(config: FcConfig, state: FcState): string {
  const chart = chartFor(config)
  if (isMachine(chart)) return finalState(chart, pressesOf(chart, state))
  return runChart(chart, atOf(chart, state)).end
}

export function textOfEnd(chart: Chart, id: string): string {
  return isMachine(chart) ? stateOf(chart, id).text : nodeOf(chart, id).text
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card says only what the token did, never whether that is the aim.

const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function working(config: FcConfig, state: FcState): string {
  const chart = chartFor(config)
  if (isMachine(chart)) {
    const presses = pressesOf(chart, state)
    const from = chart.states.find((s) => s.id === chart.start)!.text
    return `Yes. ${say(presses.length, 'press', 'presses')} took the machine from ${from} to ${textOfEnd(chart, finalState(chart, presses))}. The state changes only along an arrow, and each press follows exactly one: a press with no arrow that changes anything leaves the machine where it was.`
  }
  const run = runChart(chart, atOf(chart, state))
  const asked = pathWords(chart, run)
  const skipped = unasked(chart, run)
  const closing = chart.kind === 'key' && skipped.length
    ? `The key never asked about ${skipped.join(' or ')}: a key asks only what it needs.`
    : chart.kind === 'key' ? 'A key asks one question at a time, and each answer rules out some of the names.' : 'A diamond tests the input and sends the token down exactly one of its two branches.'
  return `Yes. The token took ${asked || 'no decisions'} and ended at ${textOfEnd(chart, run.end)}. ${closing}`
}

export function madeText(config: FcConfig, state: FcState): string {
  const chart = chartFor(config)
  if (isMachine(chart)) {
    const presses = pressesOf(chart, state)
    const now = textOfEnd(chart, finalState(chart, presses))
    return presses.length === 0 ? `Nothing has been pressed, so the machine is still ${now}.` : `After ${say(presses.length, 'press', 'presses')} the machine is ${now}.`
  }
  const run = runChart(chart, atOf(chart, state))
  return `With these settings the token took ${pathWords(chart, run) || 'no decisions'} and ended at ${textOfEnd(chart, run.end)}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const norm = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9]+/g, '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const ALIASES: Record<string, string> = {
  grade: 'grade', grades: 'grade', mark: 'grade', marks: 'grade', 'exam-grade': 'grade', 'exam-marks': 'grade', 'grade-boundaries': 'grade', 'exam-result': 'grade',
  ride: 'ride', rides: 'ride', fairground: 'ride', 'theme-park': 'ride', 'theme-park-ride': 'ride', rollercoaster: 'ride', 'roller-coaster': 'ride', 'height-check': 'ride',
  password: 'password', passwords: 'password', 'password-check': 'password', 'password-checker': 'password', 'password-strength': 'password', 'password-validation': 'password',
  heating: 'heating', thermostat: 'heating', 'heating-system': 'heating', 'heating-controller': 'heating', 'smart-heating': 'heating', 'central-heating': 'heating',
  minibeasts: 'minibeasts', minibeast: 'minibeasts', invertebrates: 'minibeasts', invertebrate: 'minibeasts', insects: 'minibeasts', bugs: 'minibeasts', 'small-animals': 'minibeasts', 'invertebrate-key': 'minibeasts',
  vertebrates: 'vertebrates', vertebrate: 'vertebrates', 'vertebrate-groups': 'vertebrates', 'vertebrate-classes': 'vertebrates', 'animal-groups': 'vertebrates', animals: 'vertebrates',
  turnstile: 'turnstile', turnstiles: 'turnstile', 'coin-turnstile': 'turnstile', gate: 'turnstile', barrier: 'turnstile',
  lock: 'lock', 'combination-lock': 'lock', 'code-lock': 'lock', keypad: 'lock', 'keypad-lock': 'lock', safe: 'lock', 'door-lock': 'lock', 'pin-lock': 'lock',
}

function readChart(raw: unknown): string {
  const key = keyOf(raw).replace(/-?(?:flowchart|chart|key|machine|state-machine|decision-key|dichotomous-key|identification-key)$/, '').replace(/^(?:a|an|the)-/, '')
  return has(ALIASES, key) ? ALIASES[key] : key
}

/** The end or state a goal names: by its id or its words, ignoring case, spaces and a leading article. */
export function resolveGoal(chart: Chart, raw: string): string | null {
  const g = norm(raw.replace(/^\s*(?:a|an|the)\s+/i, ''))
  if (!g) return null
  const options = isMachine(chart)
    ? chart.states.map((s) => ({ id: s.id, words: [s.id, s.text] }))
    : chart.nodes.filter((n) => n.kind === 'out').map((n) => ({ id: n.id, words: [n.id, n.text] }))
  const hit = options.find((o) => o.words.some((w) => norm(w) === g || norm(w) + 's' === g || norm(w) === g + 's'))
  return hit ? hit.id : null
}

export const goalNames = (chart: Chart, skip?: string): string[] =>
  (isMachine(chart) ? chart.states.filter((s) => s.id !== skip).map((s) => s.text) : chart.nodes.filter((n) => n.kind === 'out').map((n) => n.text))

/** What a prompt can safely say: the gesture and the aim. */
export function goodPrompt(config: FcConfig): string {
  const chart = chartFor(config)
  const name = textOfEnd(chart, goalId(config))
  if (isMachine(chart)) return `Press the buttons under the chart to move the token from state to state. Get the machine into the state “${name}”.`
  if (chart.kind === 'key') return `Use the controls under the key to describe a specimen, and watch the token run down the key. Make the key name it “${name}”.`
  return `Use the controls under the chart to set the inputs, and watch the token run. Make it finish at “${name}”.`
}

export const flowchartEngine: SceneEngine<FcConfig, FcState> = {
  id: 'flowchart',
  // Distinctive words only: "key", "flow" and "decision" are everywhere. Everything else is a whole phrase.
  covers: ['flowcharts', 'dichotomous', 'turnstile'],
  phrases: [
    'flowchart', 'flowcharts', 'flow chart', 'flow charts', 'algorithms and flowcharts', 'flowchart algorithms', 'selection in flowcharts', 'decision symbol', 'decision symbols', 'decision box', 'decision boxes',
    'dichotomous key', 'dichotomous keys', 'identification key', 'identification keys', 'identifying organisms', 'identify organisms', 'identifying living things', 'identifying plants and animals', 'classification keys', 'classification key',
    'biological key', 'biological keys', 'vertebrates', 'invertebrates', 'minibeasts', 'vertebrate groups', 'vertebrate classes', 'classifying organisms', 'classification of living organisms', 'classification of organisms', 'classifying living things', 'classifying animals', 'grouping organisms', 'classifying vertebrates', 'using a key', 'using keys', 'branching key', 'branching keys',
    'state machine', 'state machines', 'finite state machine', 'finite state machines', 'finite-state machine', 'state diagram', 'state diagrams', 'state transition', 'state transitions',
  ],
  // Near misses: a flow of something else, a key that is not an identification key, a chart that is not a flowchart.
  notFor: [
    'cash flow', 'cash flows', 'energy flow', 'energy flows', 'water flow', 'blood flow', 'data flow', 'data flow diagram', 'data flow diagrams', 'flow diagram of', 'work flow', 'workflow', 'workflows', 'traffic flow', 'heat flow', 'current flow', 'flow rate', 'flow rates', 'flow of control', 'control flow', 'process flow',
    'organisation chart', 'organization chart', 'organisation charts', 'gantt chart', 'gantt charts', 'pie chart', 'pie charts', 'bar chart', 'bar charts', 'tree diagram', 'tree diagrams', 'probability tree', 'decision tree', 'decision trees',
    'primary key', 'foreign key', 'public key', 'private key', 'encryption key', 'security key', 'key stage', 'key terms', 'key words', 'key vocabulary', 'key skills', 'key concepts', 'key ideas', 'key features', 'map key', 'musical key', 'key signature', 'keyboard',
    'water cycle', 'carbon cycle', 'nitrogen cycle', 'rock cycle', 'life cycle', 'life cycles', 'cell cycle', 'states of matter', 'state of matter', 'change of state', 'changes of state', 'state symbols', 'government', 'arms of government', 'nation state', 'welfare state',
  ],
  // The learner varies the input, or the press, and sees where the token goes: what an input does to the outcome.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawChart = first(o, ['chart', 'flowchart', 'key', 'machine', 'diagram', 'scenario', 'example', 'name'])
    if (rawChart !== undefined && typeof rawChart !== 'string') return null
    if (rawChart === undefined) return null
    const chart = readChart(rawChart)
    if (!chart) return null
    const found = chartOf(chart)
    const rawGoal = first(o, ['goal', 'target', 'outcome', 'end', 'result', 'state', 'finish', 'answer'])
    if (rawGoal !== undefined && typeof rawGoal !== 'string' && typeof rawGoal !== 'number') return null
    const text = rawGoal === undefined ? '' : String(rawGoal).trim()
    const goal = found ? (text === '' ? found.defaultGoal : resolveGoal(found, text) ?? text) : text
    return { task: found && isMachine(found) ? 'machine' : 'run', chart, goal }
  },

  faults(config) {
    const out: string[] = []
    const chart = chartOf(config.chart)
    if (!chart) {
      out.push(`There is no chart "${config.chart}" drawn here: use one of ${CHART_IDS.join(', ')}, e.g. chart "grade", goal "Pass".`)
      return out
    }
    const goal = resolveGoal(chart, config.goal)
    const near = goalNames(chart, isMachine(chart) ? chart.start : undefined)[0]
    if (!goal) {
      out.push(`"${config.goal}" is not ${isMachine(chart) ? 'a state of' : 'an end of'} the "${chart.id}" chart: use one of ${goalNames(chart).join(', ')}, e.g. goal "${near}".`)
    } else if (isMachine(chart) && goal === chart.start) {
      out.push(`The ${chart.name.toLowerCase()} starts in "${stateOf(chart, chart.start).text}", so asking for it is already done: use another state, e.g. goal "${near}".`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const chart = chartFor(config)
    // The names of the ends are the aim, so they may appear; strip them before looking for numbers and trait words.
    let text = prompt.replace(/\s+/g, ' ')
    for (const n of goalNames(chart)) text = text.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const comparing = /\b(?:at least|at most|more than|less than|fewer|greater|exceeds?|exactly|higher than|lower than|bigger|smaller|big enough|small enough|old enough|tall enough)\b/i.test(text)
    const counting = /\b(?:\d+|one|two|three|four|five|once|twice)\s+(?:times|presses|buttons|steps|moves|legs|wings)\b/i.test(text)
    const digits = /\d/.test(text)
    const tells = chart.giveaways.test(text) || /\b(?:then|after that|in turn)\b/i.test(text) && isMachine(chart)
    if (comparing || digits || counting || tells) {
      out.push(`the prompt gives the answer away: it names a value, a trait, a button or an order, which the learner is to find with the controls -- ask for the end only ("${example}")`)
    }
    if (/\b(?:fewest|as few|minimum|shortest|quickest|fastest|least)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not mark: any inputs or presses that finish at the named end pass, so do not ask for the fewest -- ask for the end only ("${example}")`)
    }
    if (/\b(?:draw|build|construct|write|type|label|symbols?|pseudocode|python|trace table|loops?|repeat\w*|iterat\w*|code|program)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not do: it runs a chart that is already drawn, and the learner sets inputs or presses buttons -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    const chart = chartFor(config)
    return isMachine(chart) ? { presses: [] } : { at: startAt(chart, goalId(config)) }
  },

  check(config, state) {
    return { ok: result(config, state) === goalId(config), wrongIds: [] }
  },

  solve(config) {
    const chart = chartFor(config)
    return isMachine(chart) ? { presses: shortestPresses(chart, goalId(config)) } : { at: solveAt(chart, goalId(config)) }
  },

  View: FlowchartView,

  prompt: `SCENE "flowchart" -- a chart drawn on a quiet light panel with a yellow token that runs through it. The learner never edits the chart: they handle its inputs, and the token visibly takes each branch, lighting the path in blue and stopping at an end. Two kinds, chosen by the chart.
  Flowcharts and keys (run): real flowchart shapes (rounded Start, parallelogram input, diamonds with a labelled Yes and No, rounded ends). Controls under the chart set the inputs: a stepper and slider for a number, a stepper for a word, Yes/No for a trait. Each change sends the token round again, and a readout under the chart names the end it reached. A key is the same, with a specimen to describe. The aim is to make the token finish at a named end; any settings that do it pass.
  State machines (machine): circles for states with arrows for the buttons, and a token that sits in the current state. The learner presses the machine's buttons; the token travels along the arrow for that press, or loops back when the press changes nothing. The aim is to get the machine into a named state.
  For: flowcharts and algorithm design (selection, decisions, IF branches), dichotomous and identification keys, classification by key, finite-state machines and state diagrams, coin turnstile, keypad lock. It answers "a diamond has one way out", "a key asks one question at a time", and "a button changes the state only along an arrow".
  Not drawn: loops, building or drawing a chart, trace tables, naming the symbols, pseudocode, anything else a tutor might want a flowchart of (a cycle, a process, a government). Do not use it for cash flow, energy flow, data flow diagrams, decision trees in probability, or cryptographic keys.
  chart (the tutor names one): ${FLOWCHARTS.map((c) => `${c.id} (${c.kind === 'key' ? 'key' : 'flowchart'}: ${c.name.toLowerCase()}; ends ${goalNames(c).join(', ')})`).join('; ')}; ${MACHINES.map((m) => `${m.id} (state machine: ${m.name.toLowerCase()}; states ${m.states.map((s) => s.text).join(', ')}; it starts ${stateOf(m, m.start).text})`).join('; ')}.
  goal: the end or state the token must reach, by the name shown on the chart (optional: a good one is chosen). A machine's goal cannot be the state it starts in.
  Before marking the card shows the chart, the inputs and where the token ends. It never says whether that is the named end, and holds back every setting that gets there. Marking says the path the token took. The prompt must ask for the end only: do NOT give a value, a trait, a button, an order, a count or "the fewest", and do not promise drawing, loops or trace tables.
  config: { "chart":"grade", "goal":"Pass" }  -- the prompt says "Use the controls under the chart to set the inputs, and watch the token run. Make it finish at “Pass”."
       or { "chart":"minibeasts", "goal":"Spider" }  -- the prompt says "Use the controls under the key to describe a specimen, and watch the token run down the key. Make the key name it “Spider”."
       or { "chart":"lock", "goal":"open" }  -- the prompt says "Press the buttons under the chart to move the token from state to state. Get the machine into the state “open”."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the controls under the chart to set the inputs, and watch the token run. Make it finish at “Pass”.",
    "payload": { "engine":"flowchart", "config": { "chart":"grade", "goal":"Pass" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:flowchart", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the controls under the key to describe a specimen, and watch the token run down the key. Make the key name it “Spider”.",
    "payload": { "engine":"flowchart", "config": { "chart":"minibeasts", "goal":"Spider" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:flowchart", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Press the buttons under the chart to move the token from state to state. Get the machine into the state “open”.",
    "payload": { "engine":"flowchart", "config": { "chart":"lock", "goal":"open" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:flowchart", "why":"..." } }`,
}

registerEngine(flowchartEngine as SceneEngine<unknown, unknown>)
