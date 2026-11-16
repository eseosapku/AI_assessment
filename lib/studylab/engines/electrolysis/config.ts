// lib/studylab/engines/electrolysis-kimi31/config.ts
//
// A working DC electrolysis cell. The learner plugs the red (positive) and black (negative)
// leads onto two electrode terminals. Only then do ions migrate and the electrode events
// happen. Marking is from the connections, never from the animation.
//
// Chemistry: Cambridge IGCSE 0620 electrode reactions, checked against RSC class experiments:
// brine https://edu.rsc.org/experiments/electrolysis-of-brine/735.article and copper(II)
// sulfate https://edu.rsc.org/experiments/electrolysis-of-copperii-sulfate-solution/476.article .
// Water is represented by H+ and OH-, the simplified model used at IGCSE. With copper anodes,
// copper dissolves instead of oxygen forming. Molten lead(II) bromide and alumina in cryolite
// use the standard binary-electrolyte model.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ElectrolysisView } from './View'

export type Side = 'left' | 'right'
export type Product = 'hydrogen' | 'chlorine' | 'oxygen' | 'copper' | 'lead' | 'bromine' | 'aluminium'
export type Ion = { symbol: string; charge: 1 | -1 }
export type ElectrodeEvent = {
  product?: Product
  kind: 'gas' | 'metal' | 'dissolve' | 'pool'
  equation: string
  observation: string
  gas?: 'clear' | 'green' | 'brown'
  metal?: 'copper' | 'lead' | 'aluminium'
}
export type Cell = {
  key: string
  name: string
  formula: string
  material: 'carbon' | 'copper'
  liquid: string
  ions: Ion[]
  cathode: ElectrodeEvent
  anode: ElectrodeEvent
}

export type ElectrolysisConfig =
  | { task: 'products'; electrolyte: string; electrodes: string; product: string; side: string }
  | { task: 'purify'; side: string }
export type ElectrolysisState = { red?: Side | null; black?: Side | null }

const gas = (product: Product, equation: string, observation: string, colour: 'clear' | 'green' | 'brown' = 'clear'): ElectrodeEvent => ({ product, kind: 'gas', equation, observation, gas: colour })
const metal = (product: Product, kind: 'metal' | 'pool', equation: string, observation: string): ElectrodeEvent => ({ product, kind, equation, observation, metal: product === 'copper' ? 'copper' : product === 'lead' ? 'lead' : 'aluminium' })
const C = (symbol: string): Ion => ({ symbol, charge: 1 })
const A = (symbol: string): Ion => ({ symbol, charge: -1 })
const twice = (ions: Ion[]): Ion[] => [...ions, ...ions]

export const CELLS: Record<string, Cell> = {
  'lead-bromide': {
    key: 'lead-bromide', name: 'molten lead(II) bromide', formula: 'PbBr₂(l)', material: 'carbon', liquid: '#F4E7CF',
    ions: twice([C('Pb²⁺'), A('Br⁻'), A('Br⁻')]),
    cathode: metal('lead', 'metal', 'Pb²⁺ + 2e⁻ → Pb', 'a silvery lead coating forms'),
    anode: gas('bromine', '2Br⁻ → Br₂ + 2e⁻', 'brown bromine gas bubbles off', 'brown'),
  },
  brine: {
    key: 'brine', name: 'concentrated aqueous sodium chloride', formula: 'NaCl(aq), concentrated', material: 'carbon', liquid: '#E6F2F5',
    ions: twice([C('Na⁺'), A('Cl⁻'), C('H⁺'), A('OH⁻')]),
    cathode: gas('hydrogen', '2H⁺ + 2e⁻ → H₂', 'hydrogen bubbles form; Na⁺ stays in solution'),
    anode: gas('chlorine', '2Cl⁻ → Cl₂ + 2e⁻', 'pale green chlorine bubbles form; OH⁻ stays in solution', 'green'),
  },
  'dilute-brine': {
    key: 'dilute-brine', name: 'dilute aqueous sodium chloride', formula: 'NaCl(aq), dilute', material: 'carbon', liquid: '#E6F2F5',
    ions: twice([C('Na⁺'), A('Cl⁻'), C('H⁺'), A('OH⁻')]),
    cathode: gas('hydrogen', '2H⁺ + 2e⁻ → H₂', 'hydrogen bubbles form; Na⁺ stays in solution'),
    anode: gas('oxygen', '4OH⁻ → O₂ + 2H₂O + 4e⁻', 'oxygen bubbles form in preference to chlorine'),
  },
  'sulfuric-acid': {
    key: 'sulfuric-acid', name: 'dilute sulfuric acid', formula: 'H₂SO₄(aq), dilute', material: 'carbon', liquid: '#EDF4F6',
    ions: twice([C('H⁺'), C('H⁺'), A('SO₄²⁻'), A('OH⁻')]),
    cathode: gas('hydrogen', '2H⁺ + 2e⁻ → H₂', 'hydrogen bubbles form'),
    anode: gas('oxygen', '4OH⁻ → O₂ + 2H₂O + 4e⁻', 'oxygen bubbles form; twice as much hydrogen forms as oxygen'),
  },
  'copper-carbon': {
    key: 'copper-carbon', name: 'aqueous copper(II) sulfate with carbon electrodes', formula: 'CuSO₄(aq)', material: 'carbon', liquid: '#CDE5F4',
    ions: twice([C('Cu²⁺'), A('SO₄²⁻'), C('H⁺'), A('OH⁻')]),
    cathode: metal('copper', 'metal', 'Cu²⁺ + 2e⁻ → Cu', 'a pink-brown copper coating forms'),
    anode: gas('oxygen', '4OH⁻ → O₂ + 2H₂O + 4e⁻', 'oxygen bubbles form'),
  },
  'copper-copper': {
    key: 'copper-copper', name: 'aqueous copper(II) sulfate with copper electrodes', formula: 'CuSO₄(aq)', material: 'copper', liquid: '#CDE5F4',
    ions: twice([C('Cu²⁺'), A('SO₄²⁻'), C('H⁺'), A('OH⁻')]),
    cathode: metal('copper', 'metal', 'Cu²⁺ + 2e⁻ → Cu', 'the cathode gains a copper coating'),
    anode: { kind: 'dissolve', equation: 'Cu → Cu²⁺ + 2e⁻', observation: 'the copper anode dissolves, making Cu²⁺ ions', metal: 'copper' },
  },
  cryolite: {
    key: 'cryolite', name: 'aluminium oxide dissolved in molten cryolite', formula: 'Al₂O₃ in molten cryolite', material: 'carbon', liquid: '#EEE9DF',
    ions: twice([C('Al³⁺'), A('O²⁻'), A('O²⁻')]),
    cathode: metal('aluminium', 'pool', 'Al³⁺ + 3e⁻ → Al', 'molten aluminium collects at the cathode'),
    anode: gas('oxygen', '2O²⁻ → O₂ + 4e⁻', 'oxygen bubbles form at the carbon anode'),
  },
}

export const PRODUCT_NAMES: Product[] = ['hydrogen', 'chlorine', 'oxygen', 'copper', 'lead', 'bromine', 'aluminium']
export const ELECTROLYTE_NAMES = ['lead-bromide', 'brine', 'dilute-brine', 'sulfuric-acid', 'copper-carbon', 'copper-copper', 'cryolite']
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const keyOf = (raw: unknown) => typeof raw === 'string' || typeof raw === 'number'
  ? String(raw).trim().toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    .replace(/[²³]/g, '').replace(/[⁺⁻]/g, '').replace(/\(ii\)/g, '2').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''

const ELECTROLYTES: Record<string, string> = {
  'lead-bromide': 'lead-bromide', 'lead-2-bromide': 'lead-bromide', 'molten-lead-bromide': 'lead-bromide', 'molten-lead-2-bromide': 'lead-bromide', 'molten-lead2-bromide': 'lead-bromide', pbbr2: 'lead-bromide',
  brine: 'brine', 'concentrated-brine': 'brine', 'sodium-chloride': 'brine', 'aqueous-sodium-chloride': 'brine', 'concentrated-sodium-chloride': 'brine', 'concentrated-aqueous-sodium-chloride': 'brine', nacl: 'brine',
  'dilute-brine': 'dilute-brine', 'dilute-sodium-chloride': 'dilute-brine', 'dilute-aqueous-sodium-chloride': 'dilute-brine',
  'sulfuric-acid': 'sulfuric-acid', 'sulphuric-acid': 'sulfuric-acid', 'dilute-sulfuric-acid': 'sulfuric-acid', 'dilute-sulphuric-acid': 'sulfuric-acid', h2so4: 'sulfuric-acid',
  'copper-sulfate': 'copper-carbon', 'copper-sulphate': 'copper-carbon', 'copper-2-sulfate': 'copper-carbon', 'copper-2-sulphate': 'copper-carbon', 'aqueous-copper-sulfate': 'copper-carbon', 'aqueous-copper-2-sulfate': 'copper-carbon', cuso4: 'copper-carbon',
  cryolite: 'cryolite', alumina: 'cryolite', 'aluminium-oxide': 'cryolite', 'aluminum-oxide': 'cryolite', 'aluminium-oxide-in-cryolite': 'cryolite', 'aluminium-oxide-in-molten-cryolite': 'cryolite', 'extraction-of-aluminium': 'cryolite',
}
const PRODUCTS: Record<string, Product> = {
  hydrogen: 'hydrogen', h2: 'hydrogen', chlorine: 'chlorine', cl2: 'chlorine', oxygen: 'oxygen', o2: 'oxygen',
  copper: 'copper', cu: 'copper', lead: 'lead', pb: 'lead', bromine: 'bromine', br2: 'bromine', aluminium: 'aluminium', aluminum: 'aluminium', al: 'aluminium',
}
const TASKS: Record<string, 'products' | 'purify'> = {
  products: 'products', product: 'products', electrolysis: 'products', electrolyse: 'products', 'predict-products': 'products', 'make-product': 'products', make: 'products', extraction: 'products', electroplate: 'products', electroplating: 'products',
  purify: 'purify', purification: 'purify', 'purification-of-copper': 'purify', refine: 'purify', refining: 'purify', 'purify-copper': 'purify', 'copper-purification': 'purify', 'copper-refining': 'purify', 'electrolytic-refining': 'purify',
}

export function cellOf(config: ElectrolysisConfig): Cell {
  if (config.task === 'purify') return CELLS['copper-copper']
  if (config.electrolyte === 'copper-carbon' && config.electrodes === 'copper') return CELLS['copper-copper']
  return has(CELLS, config.electrolyte) ? CELLS[config.electrolyte] : CELLS.brine
}
export const sideOf = (config: ElectrolysisConfig): Side => config.side === 'right' ? 'right' : 'left'
export const other = (side: Side): Side => side === 'left' ? 'right' : 'left'
export function readSide(raw: unknown): string {
  const k = keyOf(raw)
  if (['left', 'l', 'lhs', 'left-hand', '1'].includes(k)) return 'left'
  if (['right', 'r', 'rhs', 'right-hand', '2'].includes(k)) return 'right'
  return k || 'left'
}

/** The complete circuit, or null when current cannot pass through the electrolyte. */
export function circuitOf(state: ElectrolysisState | null | undefined): { positive: Side; negative: Side } | null {
  const red = state?.red
  const black = state?.black
  if ((red !== 'left' && red !== 'right') || (black !== 'left' && black !== 'right') || red === black) return null
  return { positive: red, negative: black }
}
export function requiredCircuit(config: ElectrolysisConfig): { positive: Side; negative: Side } {
  const target = sideOf(config)
  if (config.task === 'purify') return { positive: other(target), negative: target }
  const cell = cellOf(config)
  return cell.anode.product === config.product ? { positive: target, negative: other(target) } : { positive: other(target), negative: target }
}
export function eventAt(config: ElectrolysisConfig, circuit: { positive: Side; negative: Side }, side: Side): ElectrodeEvent {
  const cell = cellOf(config)
  return circuit.positive === side ? cell.anode : cell.cathode
}

export function validConfig(config: ElectrolysisConfig): boolean {
  if (config.side !== 'left' && config.side !== 'right') return false
  if (config.task === 'purify') return true
  const cell = cellOf(config)
  const supportedElectrolyte = config.electrodes === 'copper' ? config.electrolyte === 'copper-carbon' : has(CELLS, config.electrolyte) && config.electrolyte !== 'copper-copper'
  return supportedElectrolyte && (config.electrodes === 'carbon' || config.electrodes === 'copper') && (cell.cathode.product === config.product || cell.anode.product === config.product)
}

export type Verdict = { title: string; detail: string; equations: string[] }
const productList = (config: ElectrolysisConfig, circuit: { positive: Side; negative: Side }) => (['left', 'right'] as Side[]).map((side) => {
  const e = eventAt(config, circuit, side)
  return e.product ? `${e.product} at the ${side} electrode` : `copper dissolving at the ${side} electrode`
}).join(' and ')

export function verdict(config: ElectrolysisConfig, state: ElectrolysisState, ok: boolean): Verdict {
  const cell = cellOf(config)
  const circuit = circuitOf(state)
  const target = sideOf(config)
  const wanted = requiredCircuit(config)
  if (!circuit) {
    return { title: 'The circuit is not complete.', detail: state?.red && state.red === state.black ? `Both leads are on the ${state.red} electrode, so no current passes through the electrolyte. Put one lead on each electrode.` : 'Connect the red positive lead and black negative lead to opposite electrodes, then watch what happens.', equations: [] }
  }
  const cathodeSide = circuit.negative
  const anodeSide = circuit.positive
  const equations = [`Cathode (−), ${cathodeSide}: ${cell.cathode.equation}`, `Anode (+), ${anodeSide}: ${cell.anode.equation}`]
  if (!ok) {
    const aim = config.task === 'purify' ? `To purify copper on the ${target}, that electrode must be the cathode.` : `To make ${config.product} on the ${target}, that electrode must be the ${cell.anode.product === config.product ? 'anode (positive)' : 'cathode (negative)'}.`
    return { title: `You made ${productList(config, circuit)}.`, detail: `${aim} Put the red lead on the ${wanted.positive} and the black lead on the ${wanted.negative}.`, equations }
  }
  if (config.task === 'purify') {
    return { title: `Yes — copper has transferred onto the pure ${target} electrode.`, detail: `The impure copper anode dissolves. Cu²⁺ ions move to the pure cathode, gain electrons and form pure copper.`, equations }
  }
  return { title: `Yes — ${config.product} forms at the ${target} electrode.`, detail: `At the cathode, ${cell.cathode.observation}. At the anode, ${cell.anode.observation}.`, equations }
}

const goodPrompt = (config: ElectrolysisConfig) => config.task === 'purify'
  ? `Drag the red and black plugs onto the electrode terminals, or tap a plug to move it. Purify the copper by coating the pure electrode on the ${sideOf(config)}.`
  : `Drag the red and black plugs onto the electrode terminals, or tap a plug to move it. Make ${config.product} at the ${sideOf(config)} electrode.`

export const electrolysisEngine: SceneEngine<ElectrolysisConfig, ElectrolysisState> = {
  id: 'electrolysis',
  covers: ['electrolysis', 'electroplating'],
  phrases: ['electrolytic cell', 'electrolytic cells', 'electrolytes in chemistry', 'products of electrolysis', 'electrolysis of brine', 'molten electrolysis', 'aqueous electrolysis', 'anode and cathode', 'half-equations at electrodes', 'purifying copper', 'purification of copper', 'electrolytic refining', 'extraction of aluminium'],
  notFor: ['electrolytes in the body', 'electrolytes in blood', 'sports drinks', 'electric circuits', 'current electricity', 'electrochemical cells', 'galvanic cells', 'voltaic cells', 'batteries', 'fuel cells', 'ionic bonding', 'electron configuration', 'static electricity', 'electromagnets', 'electrolysis hair removal', 'hair removal'],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = src.task ?? src.kind ?? src.type ?? src.mode ?? (src.pureSide !== undefined || src.purify ? 'purify' : 'products')
    const task = TASKS[keyOf(rawTask)]
    if (!task) return null
    const side = readSide(src.side ?? src.targetSide ?? src.pureSide ?? src.electrodeSide ?? 'left')
    if (task === 'purify') return { task, side }
    const electrolyteRaw = keyOf(src.electrolyte ?? src.solution ?? src.compound ?? src.cell ?? 'brine')
    const electrolyte = has(ELECTROLYTES, electrolyteRaw) ? ELECTROLYTES[electrolyteRaw] : electrolyteRaw
    const electrodeRaw = keyOf(src.electrodes ?? src.electrode ?? src.electrodeMaterial ?? 'carbon')
    const electrodes = ['carbon', 'graphite', 'inert', 'platinum'].includes(electrodeRaw) ? 'carbon' : ['copper', 'cu'].includes(electrodeRaw) ? 'copper' : electrodeRaw
    const productRaw = keyOf(src.product ?? src.target ?? src.make ?? 'hydrogen')
    const product = has(PRODUCTS, productRaw) ? PRODUCTS[productRaw] : productRaw
    return { task, electrolyte, electrodes, product, side }
  },

  faults(config) {
    const out: string[] = []
    if (config.side !== 'left' && config.side !== 'right') out.push(`side "${config.side}" cannot be drawn: use side "left" or "right".`)
    if (config.task === 'purify') return out
    if (config.electrolyte === 'copper-copper') out.push('For copper electrodes, set electrolyte "copper-sulfate" and electrodes "copper".')
    else if (!has(CELLS, config.electrolyte)) out.push(`Electrolyte "${config.electrolyte}" is not one this cell can draw: use "lead-bromide", "brine", "dilute-brine", "sulfuric-acid", "copper-sulfate" or "cryolite", e.g. electrolyte "brine".`)
    if (!['carbon', 'copper'].includes(config.electrodes)) out.push(`Electrodes "${config.electrodes}" cannot be drawn here: use "carbon" (including inert or platinum) or "copper".`)
    if (config.electrodes === 'copper' && config.electrolyte !== 'copper-carbon') out.push('Copper electrodes are drawn only in aqueous copper(II) sulfate: use electrolyte "copper-sulfate" and electrodes "copper", or choose electrodes "carbon".')
    if (!has(PRODUCTS, config.product)) out.push(`Product "${config.product}" is not supported: choose hydrogen, chlorine, oxygen, copper, lead, bromine or aluminium, e.g. product "hydrogen".`)
    else if (has(CELLS, config.electrolyte) && cellOf(config).cathode.product !== config.product && cellOf(config).anode.product !== config.product) {
      const made = [cellOf(config).cathode.product, cellOf(config).anode.product].filter(Boolean).join(' and ')
      out.push(`${cellOf(config).name} makes ${made}, not ${config.product}: change the product to ${made.split(' and ')[0]}, or use an electrolyte that makes ${config.product}.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (/\b(?:cathode|anode)\b/i.test(text) || /\b(?:red|black|positive|negative)\b[^.?!]*\b(?:on|onto|to|connect(?:ed|s)?(?:\s+to)?|attach(?:ed|es)?(?:\s+to)?|goes)\b[^.?!]*\b(?:left|right)\b/i.test(text) || /\b(?:left|right)\b[^.?!]*\b(?:red|black|positive|negative)\b/i.test(text) || /→|->|\be[⁻−-]\b/.test(text)) {
      out.push(`the prompt gives the wiring or electrode identity away, which the learner should work out from the product -- ask only for the product and side ("${example}")`)
    }
    if (/\b(?:drag|move|place)\s+(?:the\s+)?ions?\b|\b(?:type|write|balance)\b[^.?!]*(?:half|equation)|\bvoltage\b|\bcurrent\s+(?:slider|control)|\btest\s+(?:the\s+)?gas|\bsmell\b|\bcollect\s+(?:the\s+)?gas/i.test(text)) {
      out.push(`the prompt promises a control or observation the card does not have: the learner connects the two leads and watches bubbles, coatings and ions -- ask for that ("${example}")`)
    }
    return out
  },

  initial: () => ({ red: null, black: null }),
  check(config, state) {
    const circuit = circuitOf(state)
    const wanted = requiredCircuit(config)
    const ok = validConfig(config) && !!circuit && circuit.positive === wanted.positive && circuit.negative === wanted.negative
    return { ok, wrongIds: ok || !circuit ? [] : ['leads'] }
  },
  solve(config) {
    const wanted = requiredCircuit(config)
    return { red: wanted.positive, black: wanted.negative }
  },
  View: ElectrolysisView,

  prompt: `SCENE "electrolysis" -- a real 6 V DC cell on a quiet light panel: power pack, red positive and black negative leads with movable plugs, two material-specific electrodes in a glass beaker, and large labelled ions in the named electrolyte. The learner drags each plug to a terminal, or taps a plug to cycle loose/left/right. With one lead on each electrode the ions visibly migrate, then the actual events happen: clear or coloured gas bubbles, copper or lead coating, a copper anode getting thinner, or molten aluminium collecting. Swapping the leads swaps the electrode reactions. Nothing runs while the circuit is open.
  For: IGCSE electrolysis, ions carrying charge, cathode/anode polarity, products of molten and aqueous electrolytes, concentration effects in sodium chloride, half-equations explained after observation, electroplating, purification of copper and aluminium extraction. It answers "the cathode is always on the left", "electrons carry charge through the solution" and "the metal always comes out of solution".
  products config: { "task":"products", "electrolyte":"brine", "electrodes":"carbon", "product":"hydrogen", "side":"left" }. side is left or right: where the requested product must form. electrolyte options and supported products:
    "lead-bromide" (molten lead(II) bromide): lead or bromine, carbon electrodes;
    "brine" (concentrated aqueous sodium chloride): hydrogen or chlorine, carbon electrodes;
    "dilute-brine": hydrogen or oxygen, carbon electrodes;
    "sulfuric-acid" (dilute): hydrogen or oxygen, carbon electrodes;
    "copper-sulfate": copper always; oxygen with electrodes "carbon", a dissolving anode with electrodes "copper";
    "cryolite" (aluminium oxide in molten cryolite): aluminium or oxygen, carbon electrodes.
  electrodes is "carbon" or "copper" (copper only with copper-sulfate). Parse also accepts common names and formulae. Use products for electroplating copper onto the requested side.
  purify config: { "task":"purify", "side":"left" }. One electrode is impure copper, the other pure copper. The learner must dissolve the impure anode and coat the pure cathode on the requested side.
  Before marking the card shows the electrolyte name/formula, electrode materials, ion symbols, polarity of the supply, wiring and visible observations. It holds back the product names, anode/cathode names and half-equations until marked. Marking names what was actually made, including reversed wiring, and gives both half-equations. The prompt must name the desired product and side but must NOT say anode/cathode, which lead goes where, or a half-equation. Do not ask learners to drag ions, write equations, alter voltage, test/smell gas or collect gas: the card does none of those.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the red and black plugs onto the electrode terminals, or tap a plug to move it. Make hydrogen at the left electrode.",
    "payload": { "engine":"electrolysis", "config": { "task":"products", "electrolyte":"brine", "electrodes":"carbon", "product":"hydrogen", "side":"left" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:electrolysis", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the red and black plugs onto the electrode terminals, or tap a plug to move it. Make copper at the right electrode.",
    "payload": { "engine":"electrolysis", "config": { "task":"products", "electrolyte":"copper-sulfate", "electrodes":"carbon", "product":"copper", "side":"right" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:electrolysis", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the red and black plugs onto the electrode terminals, or tap a plug to move it. Purify the copper by coating the pure electrode on the left.",
    "payload": { "engine":"electrolysis", "config": { "task":"purify", "side":"left" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:electrolysis", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the red and black plugs onto the electrode terminals, or tap a plug to move it. Make aluminium at the right electrode.",
    "payload": { "engine":"electrolysis", "config": { "task":"products", "electrolyte":"cryolite", "electrodes":"carbon", "product":"aluminium", "side":"right" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:electrolysis", "why":"..." } }`,
}

registerEngine(electrolysisEngine as SceneEngine<unknown, unknown>)
