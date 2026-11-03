// lib/studylab/engines/logic-gates/config.ts
//
// Real switches lighting a real lamp through standard drawn gate symbols. The wires carry the signal: a wire is blue and
// thick when it carries a 1, grey and thin when it carries a 0, and the change runs along the circuit from the switches to the
// lamp, so a learner watches a flip travel through the gates. Two jobs:
//   light -- the circuit is drawn, gates and all. Flip the switches until the lamp lights. A truth table builds itself, one
//            column for each setting the learner has tried;
//   build -- the lamp must follow a wanted row of a truth table. The learner changes the gates (a stepper for each) and flips
//            the switches to test settings; their own row fills in for the settings they have tried.
//
// The rules, all computed here and never read from the drawing:
//   the value of every wire follows from the switches and the gates (AND, OR, NOT, NAND, NOR, XOR);
//   light is right when the lamp is lit; build is right when the lamp matches the wanted row in every one of the 2^n settings
//   (any circuit with that table passes, not only the one the writer had in mind).
//
// Facts: the usual school gates and their truth tables (AND 1 only when all inputs are 1; OR 1 unless all are 0; NOT flips; NAND
// is AND then NOT; NOR is OR then NOT; XOR 1 when the inputs differ), drawn with the distinctive (ANSI/MIL) symbols that
// Cambridge IGCSE, OCR and AQA papers use. Truth-table rows run in the usual counting order, A the leftmost digit.
//
// Ideas taken, never code or art:
//   - concrete first: start with real switches and a lamp that you press and see before the symbols (computing-teacher guidance
//     collected on flipeducation.ai, which cites no study), hence the lever switches and the lit bulb;
//   - test first, then see the table: Cambridge's outreach logic-gate activity let students experiment with a simulator before
//     giving them the truth table as a hint, hence the table that fills as you try settings, and the wanted row only in `build`;
//   - Nand Game (nandgame.com): you handle the gates themselves and the machine answers at once. The gate is the thing handled.
//   - the misconceptions: OR heard as the English "either, not both", AND and OR confused because both react to an input, and
//     gates treated as arithmetic. `light` on an OR gate with both switches on, and XOR beside OR, answer the first two.
// Refused:
//   - drawing the wires yourself: a placement puzzle that tests the mouse, and the circuits here are small enough to read;
//   - Boolean algebra by hand (simplifying, De Morgan, Karnaugh maps), adders, flip-flops and memory: algebra is symbols with no
//     act, and the rest needs sequence in time, which is a different scene.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { LogicGatesView } from './View'

export const GATE_KINDS = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'] as const
export type GateKind = (typeof GATE_KINDS)[number]
/** What a gate stepper offers. NOT is never a choice: it has one input and is always fixed. */
export const CHOICES: GateKind[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR']

type GateDef = { id: string; kind: GateKind; in: string[] }
type CircuitDef = { id: string; inputs: string[]; gates: GateDef[]; says: string; explain: string }

const g = (id: string, kind: GateKind, ...input: string[]): GateDef => ({ id, kind, in: input })

export const CIRCUITS: Record<string, CircuitDef> = {
  and: { id: 'and', inputs: ['A', 'B'], gates: [g('g1', 'AND', 'A', 'B')], says: 'A AND B', explain: 'An AND gate gives 1 only when all of its inputs are 1.' },
  or: { id: 'or', inputs: ['A', 'B'], gates: [g('g1', 'OR', 'A', 'B')], says: 'A OR B', explain: 'An OR gate gives 1 when at least one input is 1, and that includes both.' },
  not: { id: 'not', inputs: ['A'], gates: [g('g1', 'NOT', 'A')], says: 'NOT A', explain: 'A NOT gate turns its input round: 1 becomes 0 and 0 becomes 1.' },
  nand: { id: 'nand', inputs: ['A', 'B'], gates: [g('g1', 'NAND', 'A', 'B')], says: 'A NAND B', explain: 'NAND is AND followed by NOT: it gives 0 only when all inputs are 1.' },
  nor: { id: 'nor', inputs: ['A', 'B'], gates: [g('g1', 'NOR', 'A', 'B')], says: 'A NOR B', explain: 'NOR is OR followed by NOT: it gives 1 only when all inputs are 0.' },
  xor: { id: 'xor', inputs: ['A', 'B'], gates: [g('g1', 'XOR', 'A', 'B')], says: 'A XOR B', explain: 'XOR gives 1 when its two inputs are different.' },
  'and-not': {
    id: 'and-not', inputs: ['A', 'B'], gates: [g('n1', 'NOT', 'B'), g('g1', 'AND', 'A', 'n1')], says: 'A AND NOT B',
    explain: 'The NOT gate turns B round first, so the AND gate sees A and the opposite of B.',
  },
  'or-and': {
    id: 'or-and', inputs: ['A', 'B', 'C'], gates: [g('g1', 'OR', 'A', 'B'), g('g2', 'AND', 'g1', 'C')], says: '(A OR B) AND C',
    explain: 'The OR gate passes on a 1 if A or B is on, but the AND gate also needs C on.',
  },
  'and-or': {
    id: 'and-or', inputs: ['A', 'B', 'C'], gates: [g('g1', 'AND', 'A', 'B'), g('g2', 'OR', 'g1', 'C')], says: '(A AND B) OR C',
    explain: 'The AND gate needs A and B together, but C reaches the OR gate on its own.',
  },
  'three-and': {
    id: 'three-and', inputs: ['A', 'B', 'C'], gates: [g('g1', 'AND', 'A', 'B'), g('g2', 'AND', 'g1', 'C')], says: 'A AND B AND C',
    explain: 'Each AND gate needs both of its inputs, so all three switches have to be on.',
  },
  'and-not-c': {
    id: 'and-not-c', inputs: ['A', 'B', 'C'], gates: [g('g1', 'AND', 'A', 'B'), g('n1', 'NOT', 'C'), g('g2', 'AND', 'g1', 'n1')], says: '(A AND B) AND NOT C',
    explain: 'The lamp needs A and B on, and the NOT gate turns C round, so C has to be off.',
  },
  'xor-and': {
    id: 'xor-and', inputs: ['A', 'B', 'C'], gates: [g('g1', 'XOR', 'A', 'B'), g('g2', 'AND', 'g1', 'C')], says: '(A XOR B) AND C',
    explain: 'The XOR gate gives 1 when A and B differ, and the AND gate then needs C on as well.',
  },
}
export const CIRCUIT_IDS = Object.keys(CIRCUITS)
/** The circuits the build task can use: those with a gate that can be changed. */
export const BUILD_IDS = CIRCUIT_IDS.filter((id) => CIRCUITS[id].gates.some((x) => x.kind !== 'NOT'))

export type LGConfig = { task: 'light' | 'build'; circuit: string }
/** sw: each switch on or off; seen: the settings (row numbers) tried; picks: build only, each changeable gate as an index into CHOICES. */
export type LGState = { sw: boolean[]; seen: number[]; picks: number[] }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
export const defOf = (config: LGConfig): CircuitDef => (has(CIRCUITS, config.circuit) ? CIRCUITS[config.circuit] : CIRCUITS.and)
export const slotsOf = (def: CircuitDef): GateDef[] => def.gates.filter((x) => x.kind !== 'NOT')
export const rowsOf = (def: CircuitDef) => 1 << def.inputs.length
export const rowIndex = (sw: boolean[]) => sw.reduce((i, b) => i * 2 + (b ? 1 : 0), 0)
export const rowSwitches = (n: number, row: number): boolean[] => Array.from({ length: n }, (_, i) => Boolean(row & (1 << (n - 1 - i))))

function gateValue(kind: GateKind, v: boolean[]): boolean {
  switch (kind) {
    case 'AND': return v.every(Boolean)
    case 'OR': return v.some(Boolean)
    case 'NOT': return !v[0]
    case 'NAND': return !v.every(Boolean)
    case 'NOR': return !v.some(Boolean)
    default: return v[0] !== v[1]
  }
}

// ---------------------------------------------------------------------------
// The state, read safely.

export function cleanState(config: LGConfig, state: unknown): LGState {
  const def = defOf(config)
  const n = def.inputs.length
  const s = (state && typeof state === 'object' ? state : {}) as Partial<LGState>
  const sw = Array.isArray(s.sw) && s.sw.length === n ? s.sw.map(Boolean) : Array.from({ length: n }, () => false)
  const seen = Array.isArray(s.seen) ? [...new Set(s.seen.filter((r) => Number.isInteger(r) && r >= 0 && r < 1 << n))].sort((a, b) => a - b) : []
  const slots = slotsOf(def).length
  const picks = Array.isArray(s.picks) && s.picks.length === slots ? s.picks.map((p) => (Number.isInteger(p) && p >= 0 && p < CHOICES.length ? p : 0)) : Array.from({ length: slots }, () => 0)
  return { sw, seen: seen.includes(rowIndex(sw)) ? seen : [...seen, rowIndex(sw)].sort((a, b) => a - b), picks }
}

/** The kind each gate really is: as drawn on `light`, as picked on `build`. */
export function kindsOf(config: LGConfig, picks: number[]): Record<string, GateKind> {
  const def = defOf(config)
  const out: Record<string, GateKind> = {}
  let k = 0
  for (const gate of def.gates) {
    if (config.task === 'build' && gate.kind !== 'NOT') out[gate.id] = CHOICES[picks[k++] ?? 0]
    else out[gate.id] = gate.kind
  }
  return out
}

/** Every wire's value, by name: the switches, then each gate's output. */
export function wiresOf(config: LGConfig, sw: boolean[], picks: number[]): Record<string, boolean> {
  const def = defOf(config)
  const kinds = kindsOf(config, picks)
  const v: Record<string, boolean> = {}
  def.inputs.forEach((name, i) => { v[name] = Boolean(sw[i]) })
  for (const gate of def.gates) v[gate.id] = gateValue(kinds[gate.id], gate.in.map((r) => v[r]))
  return v
}
export const lampOf = (config: LGConfig, sw: boolean[], picks: number[]): boolean => {
  const def = defOf(config)
  return wiresOf(config, sw, picks)[def.gates[def.gates.length - 1].id]
}

/** The solution's picks on a build card: each changeable gate as the writer's circuit has it. */
const solutionPicks = (def: CircuitDef) => slotsOf(def).map((x) => CHOICES.indexOf(x.kind))
/** The lamp, row by row, of the circuit as drawn (light) or as the writer built it (build's wanted row). */
export function wantedRow(config: LGConfig): boolean[] {
  const def = defOf(config)
  const picks = solutionPicks(def)
  const asDrawn: LGConfig = { task: 'build', circuit: config.circuit }
  return Array.from({ length: rowsOf(def) }, (_, r) => lampOf(asDrawn, rowSwitches(def.inputs.length, r), picks))
}
export function yourRow(config: LGConfig, picks: number[]): boolean[] {
  const def = defOf(config)
  return Array.from({ length: rowsOf(def) }, (_, r) => lampOf(config, rowSwitches(def.inputs.length, r), picks))
}

// ---------------------------------------------------------------------------
// Marking.

export function done(config: LGConfig, raw: unknown): boolean {
  const state = cleanState(config, raw)
  if (config.task === 'light') return lampOf(config, state.sw, state.picks)
  const want = wantedRow(config)
  return yourRow(config, state.picks).every((v, i) => v === want[i])
}

function startPicks(config: LGConfig): number[] {
  const def = defOf(config)
  const n = slotsOf(def).length
  const want = wantedRow(config)
  const total = CHOICES.length ** n
  for (let code = 0; code < total; code++) {
    const picks = Array.from({ length: n }, (_, i) => Math.floor(code / CHOICES.length ** (n - 1 - i)) % CHOICES.length)
    if (!yourRow(config, picks).every((v, i) => v === want[i])) return picks
  }
  return Array.from({ length: n }, () => 0)
}

/** The first setting, in counting order, where the lamp is off (light) or the first setting where it is on. */
function firstRow(config: LGConfig, lit: boolean): number {
  const def = defOf(config)
  for (let r = 0; r < rowsOf(def); r++) if (lampOf(config, rowSwitches(def.inputs.length, r), []) === lit) return r
  return 0
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no count and no rule.

const onOff = (v: boolean) => (v ? 'on' : 'off')
export function settingText(config: LGConfig, sw: boolean[]): string {
  const parts = defOf(config).inputs.map((name, i) => `${name} ${onOff(sw[i])}`)
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
const nameList = (kinds: GateKind[]) => kinds.join(', ')

export function working(config: LGConfig, raw: unknown): string {
  const def = defOf(config)
  const state = cleanState(config, raw)
  if (config.task === 'light') {
    const lit = wantedRow(config).map((v, r) => (v ? r : -1)).filter((r) => r >= 0)
    const total = rowsOf(def)
    const which = lit.length <= 2 ? ` It is lit by ${lit.map((r) => settingText(config, rowSwitches(def.inputs.length, r))).join(' and by ')}.` : ` It is lit by ${lit.length} of the ${total} settings.`
    return `Yes. The lamp is lit: ${def.says}.${which} ${def.explain}`
  }
  const picks = kindsOf(config, state.picks)
  const slots = slotsOf(def).map((x) => picks[x.id])
  const named = slots.length === 1 ? `The gate is ${slots[0]}.` : `The gates are ${nameList(slots)}.`
  return `Yes. The lamp matches the wanted row in every setting. ${named} ${def.explain}`
}

export function madeText(config: LGConfig, raw: unknown): string {
  const def = defOf(config)
  const state = cleanState(config, raw)
  if (config.task === 'light') return `The lamp is off with ${settingText(config, state.sw)}. Try other settings and watch where the wires go grey.`
  const want = wantedRow(config)
  const yours = yourRow(config, state.picks)
  const bad = yours.findIndex((v, i) => v !== want[i])
  const sw = rowSwitches(def.inputs.length, bad < 0 ? 0 : bad)
  const slots = slotsOf(def)
  const picks = kindsOf(config, state.picks)
  const named = slots.length === 1 ? `You chose ${picks[slots[0].id]}.` : `You chose ${slots.map((x) => picks[x.id]).join(' and ')}.`
  return `${named} With ${settingText(config, sw)} your lamp is ${onOff(yours[bad])}, but the wanted row has it ${onOff(want[bad])}.`
}

// ---------------------------------------------------------------------------
// The drawing's layout, worked out here so the tests can hold it apart.

export const W = 360
export const H = 200
export const SWITCH_X = 66
export const LAMP_X = 322
export type PinPt = { x: number; y: number }
export type Wire = { from: string; to: string; fromDepth: number; a: PinPt; b: PinPt; mx: number }
export type GateAt = { id: string; kind: GateKind; cx: number; cy: number; depth: number; left: number; inPins: PinPt[]; out: PinPt; slot: number }
export type Layout = {
  inputs: { name: string; y: number }[]
  gates: GateAt[]
  wires: Wire[]
  lamp: { x: number; y: number; depth: number }
  maxDepth: number
}

/** How far a symbol runs from its input side to its output pin. */
export const OUT_X: Record<GateKind, number> = { AND: 48, OR: 50, XOR: 50, NOT: 44, NAND: 56, NOR: 58 }
const INPUT_YS: Record<number, number[]> = { 1: [100], 2: [62, 138], 3: [36, 98, 152] }
const COLUMNS: Record<number, number[]> = { 1: [178], 2: [140, 232] }

export function layoutOf(config: LGConfig): Layout {
  const def = defOf(config)
  const ys = INPUT_YS[def.inputs.length]
  const inputs = def.inputs.map((name, i) => ({ name, y: ys[i] }))
  const depth: Record<string, number> = {}
  const yOf: Record<string, number> = {}
  inputs.forEach((i) => { depth[i.name] = 0; yOf[i.name] = i.y })
  for (const gate of def.gates) {
    depth[gate.id] = 1 + Math.max(...gate.in.map((r) => depth[r]))
    yOf[gate.id] = gate.in.reduce((s, r) => s + yOf[r], 0) / gate.in.length
  }
  const maxDepth = Math.max(...def.gates.map((x) => depth[x.id]))
  const cols = COLUMNS[maxDepth]
  const slotIds = slotsOf(def).map((x) => x.id)
  const gates: GateAt[] = def.gates.map((gate) => {
    const cx = cols[depth[gate.id] - 1]
    const cy = yOf[gate.id]
    const left = cx - OUT_X[gate.kind] / 2
    const order = [...gate.in].sort((a, b) => yOf[a] - yOf[b])
    const pinX = gate.kind === 'XOR' ? left - 6 : left
    const inPins = order.map((_, i) => ({ x: pinX, y: cy + (order.length === 1 ? 0 : i === 0 ? -11 : 11) }))
    return { id: gate.id, kind: gate.kind, cx, cy, depth: depth[gate.id], left, inPins, out: { x: left + OUT_X[gate.kind], y: cy }, slot: slotIds.indexOf(gate.id) }
  })
  const at = (id: string) => gates.find((x) => x.id === id)!
  const wires: Wire[] = []
  for (const gate of def.gates) {
    const mine = at(gate.id)
    const order = [...gate.in].sort((a, b) => yOf[a] - yOf[b])
    order.forEach((src, i) => {
      const a = has(depth, src) && depth[src] === 0 ? { x: SWITCH_X, y: yOf[src] } : at(src).out
      wires.push({ from: src, to: gate.id, fromDepth: depth[src], a, b: mine.inPins[i], mx: mine.inPins[i].x - 12 })
    })
  }
  const last = gates[gates.length - 1]
  wires.push({ from: last.id, to: 'lamp', fromDepth: last.depth, a: last.out, b: { x: LAMP_X - 17, y: last.cy }, mx: (last.out.x + LAMP_X - 17) / 2 })
  return { inputs, gates, wires, lamp: { x: LAMP_X, y: last.cy, depth: maxDepth + 1 }, maxDepth }
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'light' | 'build'> = {
  light: 'light', 'light-the-lamp': 'light', 'light-it': 'light', lamp: 'light', switch: 'light', switches: 'light', toggle: 'light', flip: 'light', find: 'light', explore: 'light',
  test: 'light', try: 'light', predict: 'light', trace: 'light', 'truth-table': 'light', 'truth-tables': 'light', play: 'light', inputs: 'light', 'set-the-inputs': 'light',
  build: 'build', make: 'build', choose: 'build', pick: 'build', design: 'build', match: 'build', 'match-the-table': 'build', 'match-the-truth-table': 'build', construct: 'build',
  create: 'build', reverse: 'build', identify: 'build', 'which-gate': 'build', 'choose-the-gate': 'build', 'choose-gates': 'build', gates: 'build', 'build-the-circuit': 'build', fix: 'build',
}

const ALIASES: Record<string, string> = {
  'and-gate': 'and', 'or-gate': 'or', 'not-gate': 'not', 'nand-gate': 'nand', 'nor-gate': 'nor', 'xor-gate': 'xor', inverter: 'not', invert: 'not', exclusive: 'xor', 'exclusive-or': 'xor', eor: 'xor', 'exclusive-or-gate': 'xor',
  'not-and': 'nand', 'not-or': 'nor', 'and-then-not': 'nand', 'or-then-not': 'nor',
  'and-with-not': 'and-not', 'and-not-gate': 'and-not', 'not-b': 'and-not', 'three-input-and': 'three-and', 'and-and': 'three-and', 'and-and-not': 'and-not-c',
}
/** Written expressions, as a tutor might give them, with their brackets (they matter: A OR B AND C is not (A OR B) AND C). */
const EXPRESSIONS: Record<string, string> = {
  'A AND B': 'and', 'A OR B': 'or', 'NOT A': 'not', 'A NAND B': 'nand', 'A NOR B': 'nor', 'A XOR B': 'xor',
  'A AND NOT B': 'and-not', 'A AND ( NOT B )': 'and-not',
  '( A OR B ) AND C': 'or-and', '( A AND B ) OR C': 'and-or', 'A AND B OR C': 'and-or',
  'A AND B AND C': 'three-and', '( A AND B ) AND C': 'three-and', 'A AND ( B AND C )': 'three-and',
  '( A AND B ) AND NOT C': 'and-not-c', 'A AND B AND NOT C': 'and-not-c',
  '( A XOR B ) AND C': 'xor-and',
}

function expressionOf(raw: string): string {
  return raw
    .replace(/[∧·.&*]+/g, ' AND ').replace(/[∨+|]+/g, ' OR ').replace(/[¬!~]/g, ' NOT ').replace(/[⊕^]/g, ' XOR ')
    .toUpperCase().replace(/[^A-Z()]+/g, ' ').replace(/([()])/g, ' $1 ').replace(/\s+/g, ' ').trim()
}

export function readCircuit(raw: string): string {
  const key = keyOf(raw).replace(/^(?:a|an|the)-/, '')
  if (has(CIRCUITS, key)) return key
  if (has(ALIASES, key)) return ALIASES[key]
  const bare = key.replace(/-(?:gate|gates|circuit)$/, '')
  if (has(CIRCUITS, bare)) return bare
  if (has(ALIASES, bare)) return ALIASES[bare]
  const ex = expressionOf(raw)
  if (has(EXPRESSIONS, ex)) return EXPRESSIONS[ex]
  return key
}

/** What a prompt can safely say: the gesture and the aim. */
const goodPrompt = (config: LGConfig) => {
  if (config.task === 'light') return 'Tap a switch to flip it on or off. Find a way to light the lamp.'
  const many = slotsOf(defOf(config)).length > 1
  return `Tap the arrows to change the ${many ? 'gates' : 'gate'}, and tap the switches to test each setting. Make your lamp match the wanted row for every setting.`
}

export const logicGatesEngine: SceneEngine<LGConfig, LGState> = {
  id: 'logic-gates',
  // Few and distinctive: a covers word matches a station by itself. Everything else is a whole phrase, and the phrases keep
  // clear of "AND gate" and "OR gate" alone, whose short words drop out and leave the bare word "gate".
  covers: ['NAND', 'XOR', 'Boolean'],
  phrases: [
    'logic gate', 'logic gates', 'logic circuit', 'logic circuits', 'logic diagram', 'logic diagrams', 'digital logic', 'boolean logic', 'boolean algebra', 'boolean expressions',
    'truth tables for logic gates', 'combining logic gates', 'combining gates', 'combined logic gates', 'not gate', 'not gates', 'nor gate', 'nor gates', 'nand gate', 'nand gates', 'xor gate', 'xor gates',
    'logic gates and truth tables', 'role of logic gates', 'logic and gates', 'gates and truth tables', 'logic gate circuits', 'digital circuits',
  ],
  notFor: [
    'logic puzzles', 'logic puzzle', 'logical reasoning', 'logical fallacies', 'logical fallacy', 'propositional logic', 'predicate logic', 'mathematical logic', 'symbolic logic', 'deductive logic', 'deductive reasoning', 'logic and sets',
    'fuzzy logic', 'ladder logic', 'programmable logic', 'logic programming', 'boolean search', 'boolean searches', 'boolean operators in search', 'search engines', 'database queries', 'sql queries',
    'golf gates', 'water gates', 'gate control theory', 'gated community', 'stomatal gates', 'ion gates', 'gated ion channels', 'voltage-gated channels', 'voltage gated channels',
  ],
  // The learner changes the switches and the gates: what the circuit does for each setting.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawTask = first(o, ['task', 'kind', 'type', 'mode'])
    const rawCircuit = first(o, ['circuit', 'gate', 'expression', 'logic', 'function', 'name', 'gates'])
    if (typeof rawCircuit !== 'string' || rawCircuit.trim() === '') return null
    let task: 'light' | 'build' = 'light'
    if (rawTask !== undefined) {
      if (typeof rawTask !== 'string') return null
      const word = keyOf(rawTask)
      if (!has(TASK_WORDS, word)) return null
      task = TASK_WORDS[word]
    }
    return { task, circuit: readCircuit(rawCircuit) }
  },

  faults(config) {
    const out: string[] = []
    if (!has(CIRCUITS, config.circuit)) {
      out.push(`There is no "${config.circuit}" circuit drawn here: use one of ${CIRCUIT_IDS.join(', ')}, e.g. circuit "and-not".`)
    } else if (config.task === 'build' && !BUILD_IDS.includes(config.circuit)) {
      out.push(`A NOT gate alone has no gate to choose, so there is nothing to build: use task "light" for it, or e.g. circuit "nand" to build.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const rule = /\bonly when\b|\bwhen\s+(?:both|either|all|any|neither|one|no)\b|\b(?:both|neither|either)\b|\bat least one\b|\bexactly one\b|\ball\s+(?:of\s+)?(?:the\s+|three\s+|two\s+)?(?:switches|inputs)\b|\bno switch|\bevery switch\b|\boutputs?\s+[01]\b|\bgives?\s+[01]\b|\b(?:an?|the) (?:output|answer) is [01]\b/i.test(text)
    const setting = /\b(?:[Tt]urn|[Ff]lip|[Ss]et|[Pp]ut|[Ll]eave|[Kk]eep|[Ss]witch)\s+(?:(?:on|off)\s+)?(?:switch(?:es)?\s+)?[ABC]\b|\b[ABC]\s+(?:is\s+|must be\s+|should be\s+)?(?:on|off)\b|\bwith\s+(?:switch\s+)?[ABC]\s+(?:on|off)\b/.test(text)
    // On `build` the gates are the answer; on `light` they are drawn and named.
    const named = config.task === 'build' && (/\b(?:NAND|NOR|XOR)\b|\b(?:AND|OR|NOT)\s+gates?\b|\b[Ee]xclusive[- ](?:or|OR)\b|\binverter\b|\b(?:use|choose|pick|select|fit|need|try)\s+(?:an?\s+|the\s+)?(?:AND|OR|NOT)\b/.test(text))
    if (rule || setting || named) {
      out.push(`the prompt gives the answer away: it says which gate, which setting or what a gate does, which the learner is to find with the switches -- ask for the outcome only ("${example}")`)
    }
    if (/\bdrag\b|\bdraw\b|\bwire (?:up|the)\b|\bconnect\b|\bplace\b|\bexpression\b|\bbinary\b|\badders?\b|\bflip-?flops?\b|\btransistors?\b|\bmultiplex|\bKarnaugh|\bsimplif|\bDe Morgan|\bwrite\b|\btype\b|\bfill in\b|\bcomplete the (?:truth )?table\b|\bmemory\b|\bCPU\b|\bbattery\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws switches, gates and a lamp, and the learner taps switches${config.task === 'build' ? ' and the gate arrows' : ''} -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    const def = defOf(config)
    const n = def.inputs.length
    if (config.task === 'light') {
      const row = firstRow(config, false)
      return { sw: rowSwitches(n, row), seen: [row], picks: [] }
    }
    return { sw: rowSwitches(n, 0), seen: [0], picks: startPicks(config) }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    const def = defOf(config)
    const n = def.inputs.length
    if (config.task === 'light') {
      const row = firstRow(config, true)
      return { sw: rowSwitches(n, row), seen: [...new Set([firstRow(config, false), row])].sort((a, b) => a - b), picks: [] }
    }
    return { sw: rowSwitches(n, 0), seen: Array.from({ length: rowsOf(def) }, (_, r) => r), picks: solutionPicks(def) }
  },

  View: LogicGatesView,

  prompt: `SCENE "logic-gates" -- real switches lighting a real lamp through standard gate symbols, on a quiet light panel. Lever switches on the left (A, B and sometimes C), logic gates drawn with the usual symbols (AND, OR, NOT, NAND, NOR, XOR), and a lamp on the right. The wires carry the signal: a wire carrying 1 is thick and blue with small dots running along it, a wire carrying 0 is thin and grey, and a flip travels along the wires from the switches to the lamp. Under the picture a truth table, one column for each setting of the switches, with the setting being shown highlighted. The learner taps the switches to flip them.
  For: logic gates, truth tables, combined logic circuits, AND OR NOT NAND NOR XOR, tracing a signal through a circuit, Boolean logic as a circuit. It answers "OR means one or the other, not both", "AND and OR do the same thing", and "a gate adds its inputs".
  light: the circuit is drawn with every gate named. The learner flips switches until the lamp lights. The truth table fills one column at a time as they try settings, so by trying they build the table. Before marking the lamp state is shown but not how many settings light it or which. Marking says the setting that lights it and the rule.
  build: the learner must make the lamp follow a wanted row of a truth table. Each changeable gate has a stepper (arrows with the gate's name: AND, OR, NAND, NOR or XOR; a NOT gate is fixed), and the switches test settings: a "Yours" row fills in for each setting tried, beside the "Wanted" row. Any circuit with the wanted table passes. Marking says which gates and why.
  circuit: one of and, or, not, nand, nor, xor (one gate; "not" has one switch), and-not (A AND NOT B), or-and ((A OR B) AND C), and-or ((A AND B) OR C), three-and (A AND B AND C), and-not-c ((A AND B) AND NOT C), xor-and ((A XOR B) AND C). "build" works for every circuit except not (it has no gate to choose).
  Not drawn: wiring the circuit yourself, Boolean algebra by hand (simplifying, De Morgan, Karnaugh maps), adders, flip-flops, memory, transistors, or binary numbers. Do not use it for logic puzzles, logical fallacies or propositional logic in maths, Boolean search terms, or fuzzy logic.
  Before marking it shows the switches, the gates (named on light; on build only as the learner's own choice), the lamp, the wire values and the table of tried settings. It holds back the setting that lights the lamp and the gate that is right. The prompt must ask for the outcome only: do NOT say which setting lights the lamp, which gate to choose, or what a gate does ("only when both", "either", "gives 1").
  config: { "task":"light", "circuit":"and-not-c" }  -- the prompt says "Tap a switch to flip it on or off. Find a way to light the lamp."
       or { "task":"build", "circuit":"nand" }  -- the prompt says "Tap the arrows to change the gate, and tap the switches to test each setting. Make your lamp match the wanted row for every setting."
       or { "task":"build", "circuit":"and-or" }  -- the prompt says "Tap the arrows to change the gates, and tap the switches to test each setting. Make your lamp match the wanted row for every setting."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a switch to flip it on or off. Find a way to light the lamp.",
    "payload": { "engine":"logic-gates", "config": { "task":"light", "circuit":"and-not-c" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:logic-gates", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the arrows to change the gate, and tap the switches to test each setting. Make your lamp match the wanted row for every setting.",
    "payload": { "engine":"logic-gates", "config": { "task":"build", "circuit":"nand" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:logic-gates", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the arrows to change the gates, and tap the switches to test each setting. Make your lamp match the wanted row for every setting.",
    "payload": { "engine":"logic-gates", "config": { "task":"build", "circuit":"and-or" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:logic-gates", "why":"..." } }`,
}

registerEngine(logicGatesEngine as SceneEngine<unknown, unknown>)
