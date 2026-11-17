// lib/studylab/engines/chemical-tests/config.ts
//
// Qualitative analysis as a practical: test an unknown, watch the result, then identify it.
// The picture never marks the answer. These tables are the rules used by both drawing and marking.
//
// Sources (Cambridge IGCSE Chemistry 0620 observations):
// https://www.minichemistry.com/learning/g3p-qualitative-analysis-lesson.html
// https://www.tutopiya.com/blog/cambridge-igcse-chemistry/identification-of-ions-and-gases-cambridge-igcse-chemistry/
// https://edu.rsc.org/infographics/how-to-carry-out-flame-tests/4024075.article
// Acidification with nitric acid precedes silver-nitrate and barium-nitrate tests. Aluminium and zinc
// agree through both stages of NaOH; excess ammonia distinguishes them. Ammonium and nitrate procedures
// are deliberately not offered: their warming/f foil stages need different apparatus.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ChemicalTestsView } from './View'

export const CATIONS = ['aluminium', 'calcium', 'copper', 'iron-2', 'iron-3', 'zinc'] as const
export const ANIONS = ['carbonate', 'chloride', 'bromide', 'iodide', 'sulfate'] as const
export const FLAMES = ['lithium', 'sodium', 'potassium', 'calcium', 'copper'] as const
export const GASES = ['hydrogen', 'oxygen', 'carbon-dioxide', 'ammonia', 'chlorine'] as const
export const CATION_REAGENTS = ['sodium-hydroxide', 'ammonia'] as const
export const ANION_REAGENTS = ['dilute-acid', 'silver-nitrate', 'barium-nitrate'] as const
export const DETECTORS = ['glowing-splint', 'lighted-splint', 'limewater', 'damp-red-litmus'] as const

export type CationId = (typeof CATIONS)[number]
export type AnionId = (typeof ANIONS)[number]
export type SolutionId = CationId | AnionId
export type FlameId = (typeof FLAMES)[number]
export type GasId = (typeof GASES)[number]
export type ReagentId = (typeof CATION_REAGENTS)[number] | (typeof ANION_REAGENTS)[number]
export type DetectorId = (typeof DETECTORS)[number]

export type ChemicalConfig =
  | { task: 'solution'; sample: string }
  | { task: 'flame'; sample: string }
  | { task: 'gas'; sample: string }

/** stages are completed drops for each reagent; gas stage 1 applies a tool, stage 2 shows its result. */
export type ChemicalState = {
  tests?: Record<string, number>
  reagent?: string
  answer?: string | null
  heated?: boolean
  detector?: string | null
  stage?: number
}

export const MAX_DROPS = 3
export const SPECIES_NAMES: Record<string, string> = {
  aluminium: 'aluminium ions', calcium: 'calcium ions', copper: 'copper(II) ions',
  'iron-2': 'iron(II) ions', 'iron-3': 'iron(III) ions', zinc: 'zinc ions',
  carbonate: 'carbonate ions', chloride: 'chloride ions', bromide: 'bromide ions', iodide: 'iodide ions', sulfate: 'sulfate ions',
  lithium: 'lithium ions', sodium: 'sodium ions', potassium: 'potassium ions',
  hydrogen: 'hydrogen', oxygen: 'oxygen', 'carbon-dioxide': 'carbon dioxide', ammonia: 'ammonia', chlorine: 'chlorine',
}
export const FORMULAE: Record<string, string> = {
  aluminium: 'Al³⁺', calcium: 'Ca²⁺', copper: 'Cu²⁺', 'iron-2': 'Fe²⁺', 'iron-3': 'Fe³⁺', zinc: 'Zn²⁺',
  carbonate: 'CO₃²⁻', chloride: 'Cl⁻', bromide: 'Br⁻', iodide: 'I⁻', sulfate: 'SO₄²⁻',
  lithium: 'Li⁺', sodium: 'Na⁺', potassium: 'K⁺',
  hydrogen: 'H₂', oxygen: 'O₂', 'carbon-dioxide': 'CO₂', ammonia: 'NH₃', chlorine: 'Cl₂',
}
export const REAGENT_NAMES: Record<ReagentId, string> = {
  'sodium-hydroxide': 'Sodium hydroxide', ammonia: 'Aqueous ammonia', 'dilute-acid': 'Dilute acid',
  'silver-nitrate': 'Silver nitrate', 'barium-nitrate': 'Barium nitrate',
}
export const DETECTOR_NAMES: Record<DetectorId, string> = {
  'glowing-splint': 'Glowing splint', 'lighted-splint': 'Lighted splint', limewater: 'Limewater', 'damp-red-litmus': 'Damp red litmus',
}
export const FLAME_COLOURS: Record<FlameId, { name: string; colour: string; inner: string }> = {
  lithium: { name: 'red', colour: '#D84343', inner: '#F59B88' },
  sodium: { name: 'yellow', colour: '#E6B929', inner: '#FFF0A3' },
  potassium: { name: 'lilac', colour: '#A987C8', inner: '#E2D0F0' },
  calcium: { name: 'orange-red', colour: '#DE6B38', inner: '#FFC07E' },
  copper: { name: 'blue-green', colour: '#38A99B', inner: '#9BE2D4' },
}

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
export const isCation = (s: string): s is CationId => (CATIONS as readonly string[]).includes(s)
export const isAnion = (s: string): s is AnionId => (ANIONS as readonly string[]).includes(s)
export const isSolution = (s: string): s is SolutionId => isCation(s) || isAnion(s)
export const isFlame = (s: string): s is FlameId => (FLAMES as readonly string[]).includes(s)
export const isGas = (s: string): s is GasId => (GASES as readonly string[]).includes(s)
export const isReagent = (s: string): s is ReagentId => has(REAGENT_NAMES, s)
export const isDetector = (s: string): s is DetectorId => has(DETECTOR_NAMES, s)

export const safeSolution = (s: string): SolutionId => isSolution(s) ? s : 'zinc'
export const safeFlame = (s: string): FlameId => isFlame(s) ? s : 'potassium'
export const safeGas = (s: string): GasId => isGas(s) ? s : 'oxygen'
export const reagentsFor = (sample: string): readonly ReagentId[] => isAnion(sample) ? ANION_REAGENTS : CATION_REAGENTS

export type Precipitate = 'white' | 'cream' | 'yellow' | 'light blue' | 'green' | 'red-brown'
export type SolutionResult = {
  precipitate: Precipitate | null
  dissolves: boolean
  /** The solution left when the precipitate dissolves, where its colour matters. */
  solution?: 'colourless' | 'dark blue'
  gas?: 'carbon dioxide'
}

const ppt = (precipitate: Precipitate, dissolves = false, solution?: 'colourless' | 'dark blue'): SolutionResult => ({ precipitate, dissolves, solution })
const NONE: SolutionResult = { precipitate: null, dissolves: false }

/** The final result, after a little and then excess. This table, not a drawn colour, drives marking. */
export const SOLUTION_RESULTS: Record<SolutionId, Partial<Record<ReagentId, SolutionResult>>> = {
  aluminium: { 'sodium-hydroxide': ppt('white', true, 'colourless'), ammonia: ppt('white') },
  calcium: { 'sodium-hydroxide': ppt('white'), ammonia: NONE },
  copper: { 'sodium-hydroxide': ppt('light blue'), ammonia: ppt('light blue', true, 'dark blue') },
  'iron-2': { 'sodium-hydroxide': ppt('green'), ammonia: ppt('green') },
  'iron-3': { 'sodium-hydroxide': ppt('red-brown'), ammonia: ppt('red-brown') },
  zinc: { 'sodium-hydroxide': ppt('white', true, 'colourless'), ammonia: ppt('white', true, 'colourless') },
  carbonate: { 'dilute-acid': { precipitate: null, dissolves: false, gas: 'carbon dioxide' }, 'silver-nitrate': NONE, 'barium-nitrate': NONE },
  chloride: { 'dilute-acid': NONE, 'silver-nitrate': ppt('white'), 'barium-nitrate': NONE },
  bromide: { 'dilute-acid': NONE, 'silver-nitrate': ppt('cream'), 'barium-nitrate': NONE },
  iodide: { 'dilute-acid': NONE, 'silver-nitrate': ppt('yellow'), 'barium-nitrate': NONE },
  sulfate: { 'dilute-acid': NONE, 'silver-nitrate': NONE, 'barium-nitrate': ppt('white') },
}

export function resultOf(sample: string, reagent: string): SolutionResult {
  const id = safeSolution(sample)
  return SOLUTION_RESULTS[id][reagent as ReagentId] ?? NONE
}

export function stageOf(state: ChemicalState | null | undefined, reagent: string): number {
  const n = state?.tests?.[reagent]
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(MAX_DROPS, Math.round(n))) : 0
}

/** The observations a student can honestly record at each stage. */
export function observationAt(sample: string, reagent: ReagentId, stage: number): string {
  if (stage <= 0) return 'Nothing added yet: watch for a change.'
  if (reagent !== 'dilute-acid' && isAnion(sample) && stage === 1) return 'Acidified with dilute nitric acid.'
  const r = resultOf(sample, reagent)
  const excess = stage >= MAX_DROPS
  if (r.gas) return excess ? 'Bubbles of gas; the limewater turns milky.' : 'Bubbles rise through the acid.'
  if (!r.precipitate) return excess ? 'No visible change, even in excess.' : 'No visible change.'
  if (excess && r.dissolves) return `The ${r.precipitate} precipitate dissolves in excess, leaving a ${r.solution ?? 'colourless'} solution.`
  return `${r.dissolves && excess ? '' : 'A '}${r.precipitate} precipitate${excess ? ' remains in excess.' : ' forms.'}`
}

const sameResult = (a: SolutionResult, b: SolutionResult) => a.precipitate === b.precipitate && a.dissolves === b.dissolves && a.solution === b.solution && a.gas === b.gas

/** Every species consistent with all completed tests. A test counts only once excess has been reached. */
export function candidates(sample: string, state: ChemicalState | null | undefined): SolutionId[] {
  const all: SolutionId[] = isAnion(sample) ? [...ANIONS] : [...CATIONS]
  const done = reagentsFor(sample).filter((r) => stageOf(state, r) >= MAX_DROPS)
  if (!done.length) return all
  return all.filter((id) => done.every((r) => sameResult(resultOf(id, r), resultOf(sample, r))))
}

export function evidenceComplete(config: Extract<ChemicalConfig, { task: 'solution' }>, state: ChemicalState | null | undefined): boolean {
  return candidates(config.sample, state).length === 1 && candidates(config.sample, state)[0] === config.sample
}

export type GasEvent = 'pop' | 'relights' | 'milky' | 'blue-litmus' | 'bleached-litmus' | 'splint-out' | 'no-change'
export const CORRECT_DETECTOR: Record<GasId, DetectorId> = {
  hydrogen: 'lighted-splint', oxygen: 'glowing-splint', 'carbon-dioxide': 'limewater',
  ammonia: 'damp-red-litmus', chlorine: 'damp-red-litmus',
}
/** A lighted splint is used for hydrogen; the same wooden splint is drawn glowing for oxygen. */
export function gasEvent(sample: string, detector: string): GasEvent {
  const gas = safeGas(sample)
  if (!isDetector(detector)) return 'no-change'
  if (detector === 'limewater') return gas === 'carbon-dioxide' ? 'milky' : 'no-change'
  if (detector === 'damp-red-litmus') {
    if (gas === 'ammonia') return 'blue-litmus'
    if (gas === 'chlorine') return 'bleached-litmus'
    return 'no-change'
  }
  if (gas === 'hydrogen') return 'pop'
  if (gas === 'oxygen') return 'relights'
  return 'splint-out'
}

export const GAS_OBSERVATIONS: Record<GasEvent, string> = {
  pop: 'A squeaky pop, with a tiny flash.', relights: 'The glowing splint bursts into flame.',
  milky: 'The limewater turns milky.', 'blue-litmus': 'The damp red litmus turns blue.',
  'bleached-litmus': 'The damp red litmus is bleached white.', 'splint-out': 'The splint goes out.',
  'no-change': 'No visible change.',
}

export function gasStage(state: ChemicalState | null | undefined): number {
  const n = state?.stage
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(2, Math.round(n))) : 0
}
export function detectorOf(state: ChemicalState | null | undefined): DetectorId | null {
  return state?.detector && isDetector(state.detector) ? state.detector : null
}
export function answerOf(state: ChemicalState | null | undefined): string {
  return typeof state?.answer === 'string' ? state.answer : ''
}

// ---------------------------------------------------------------------------
// Sentences shown only after marking.

const name = (id: string) => SPECIES_NAMES[id] ?? id
const formula = (id: string) => FORMULAE[id] ?? ''

export function working(config: ChemicalConfig, state: ChemicalState): string {
  if (config.task === 'flame') {
    const f = FLAME_COLOURS[safeFlame(config.sample)]
    return `Yes. The ${f.name} flame identifies ${name(config.sample)}, ${formula(config.sample)}. The colour comes from light emitted as excited electrons return to lower energy levels.`
  }
  if (config.task === 'gas') {
    const detector = CORRECT_DETECTOR[safeGas(config.sample)]
    const event = gasEvent(config.sample, detector)
    return `Yes. ${GAS_OBSERVATIONS[event]} This identifies ${name(config.sample)}, ${formula(config.sample)}.`
  }
  const used = reagentsFor(config.sample).filter((r) => stageOf(state, r) >= MAX_DROPS)
  const seen = used.map((r) => `${REAGENT_NAMES[r]}: ${observationAt(config.sample, r, MAX_DROPS).toLowerCase()}`).join(' ')
  // Kept to two short lines so the marked card stays under the height limit.
  if (config.sample === 'zinc') {
    return `Yes: ${name('zinc')}, ${formula('zinc')}. Its white precipitate dissolves in excess sodium hydroxide and in excess ammonia. Aluminium’s would stay in excess ammonia.`
  }
  if (config.sample === 'aluminium') {
    return `Yes: ${name('aluminium')}, ${formula('aluminium')}. Its white precipitate dissolves in excess sodium hydroxide but stays in excess ammonia. Zinc’s would dissolve in both.`
  }
  return `Yes. ${seen} This identifies ${name(config.sample)}, ${formula(config.sample)}.`
}

export function madeText(config: ChemicalConfig, state: ChemicalState): string {
  if (config.task === 'flame') {
    if (!state.heated) return 'The wire loop has not been in the flame yet, so there is no flame colour to use.'
    const picked = answerOf(state)
    return `You saw a ${FLAME_COLOURS[safeFlame(config.sample)].name} flame${picked ? ` and chose ${name(picked)}` : ''}. That flame colour belongs to ${name(config.sample)}, ${formula(config.sample)}.`
  }
  if (config.task === 'gas') {
    const detector = detectorOf(state)
    if (!detector || gasStage(state) < 2) return 'Finish a test and watch its result before identifying the gas.'
    const event = gasEvent(config.sample, detector)
    const picked = answerOf(state)
    const positive = detector === CORRECT_DETECTOR[safeGas(config.sample)]
    return positive
      ? `${GAS_OBSERVATIONS[event]}${picked ? ` You chose ${name(picked)}.` : ''} This result identifies ${name(config.sample)}, ${formula(config.sample)}.`
      : `${GAS_OBSERVATIONS[event]} That is not a unique positive test for one gas here. ${DETECTOR_NAMES[CORRECT_DETECTOR[safeGas(config.sample)]]} gives the identifying result: ${GAS_OBSERVATIONS[gasEvent(config.sample, CORRECT_DETECTOR[safeGas(config.sample)])].toLowerCase()}`
  }
  const possible = candidates(config.sample, state)
  const picked = answerOf(state)
  if (possible.length > 2) return 'These results do not identify one ion yet. Add reagent to excess; use a fresh portion with another reagent if you need it.'
  if (possible.length === 2) {
    const pair = possible.map((id) => name(id).replace(/ ions$/, '')).join(' or ')
    return `These results fit ${pair}. Try the other reagent on a fresh portion, and compare what happens in excess.`
  }
  return `Your test evidence fits ${name(config.sample)}, ${formula(config.sample)}${picked ? `, but you chose ${name(picked)}` : ''}. Read the final colour and what happened in excess.`
}

// ---------------------------------------------------------------------------
// Broad semantic parsing; faults gives a usable nearby example.

const keyOf = (raw: unknown) => typeof raw === 'string' || typeof raw === 'number'
  ? String(raw).trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    .replace(/aluminum/g, 'aluminium').replace(/sulph/g, 'sulf').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    .replace(/[⁺⁻]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const SAMPLE_WORDS: Record<string, string> = {
  al: 'aluminium', al3: 'aluminium', aluminium: 'aluminium', 'aluminium-ion': 'aluminium', 'aluminium-ions': 'aluminium',
  ca: 'calcium', ca2: 'calcium', calcium: 'calcium', 'calcium-ion': 'calcium', 'calcium-ions': 'calcium',
  cu: 'copper', cu2: 'copper', copper: 'copper', 'copper-2': 'copper', 'copper-ii': 'copper', 'copper-2-ion': 'copper', 'copper-ii-ions': 'copper', 'copper-ions': 'copper',
  fe2: 'iron-2', 'iron-2': 'iron-2', 'iron-ii': 'iron-2', 'iron-2-ion': 'iron-2', 'iron-ii-ions': 'iron-2', ferrous: 'iron-2',
  fe3: 'iron-3', 'iron-3': 'iron-3', 'iron-iii': 'iron-3', 'iron-3-ion': 'iron-3', 'iron-iii-ions': 'iron-3', ferric: 'iron-3',
  zn: 'zinc', zn2: 'zinc', zinc: 'zinc', 'zinc-ion': 'zinc', 'zinc-ions': 'zinc',
  co3: 'carbonate', 'co3-2': 'carbonate', carbonate: 'carbonate', 'carbonate-ion': 'carbonate', 'carbonate-ions': 'carbonate',
  cl: 'chloride', chloride: 'chloride', 'chloride-ion': 'chloride', 'chloride-ions': 'chloride',
  br: 'bromide', bromide: 'bromide', 'bromide-ion': 'bromide', 'bromide-ions': 'bromide',
  i: 'iodide', iodide: 'iodide', 'iodide-ion': 'iodide', 'iodide-ions': 'iodide',
  so4: 'sulfate', 'so4-2': 'sulfate', sulfate: 'sulfate', 'sulfate-ion': 'sulfate', 'sulfate-ions': 'sulfate',
  li: 'lithium', lithium: 'lithium', 'lithium-ion': 'lithium', 'lithium-ions': 'lithium',
  na: 'sodium', sodium: 'sodium', 'sodium-ion': 'sodium', 'sodium-ions': 'sodium',
  k: 'potassium', potassium: 'potassium', 'potassium-ion': 'potassium', 'potassium-ions': 'potassium',
  h2: 'hydrogen', hydrogen: 'hydrogen', 'hydrogen-gas': 'hydrogen',
  o2: 'oxygen', oxygen: 'oxygen', 'oxygen-gas': 'oxygen',
  co2: 'carbon-dioxide', 'carbon-dioxide': 'carbon-dioxide', 'carbon-dioxide-gas': 'carbon-dioxide',
  nh3: 'ammonia', ammonia: 'ammonia', 'ammonia-gas': 'ammonia',
  cl2: 'chlorine', chlorine: 'chlorine', 'chlorine-gas': 'chlorine',
}
const TASK_WORDS: Record<string, ChemicalConfig['task']> = {
  solution: 'solution', solutions: 'solution', ion: 'solution', ions: 'solution', cation: 'solution', cations: 'solution', anion: 'solution', anions: 'solution',
  'solution-test': 'solution', 'ion-test': 'solution', 'identify-ion': 'solution', 'identify-solution': 'solution', precipitate: 'solution', 'precipitate-test': 'solution', 'qualitative-analysis': 'solution',
  flame: 'flame', flames: 'flame', 'flame-test': 'flame', 'flame-tests': 'flame', 'metal-flame': 'flame',
  gas: 'gas', gases: 'gas', 'gas-test': 'gas', 'test-gas': 'gas', 'identify-gas': 'gas', splint: 'gas', limewater: 'gas',
}

function readSample(raw: unknown): string | null {
  if (raw === undefined) return ''
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const key = keyOf(raw).replace(/^(?:aqueous|unknown|sample)-/, '').replace(/-solution$/, '')
  return has(SAMPLE_WORDS, key) ? SAMPLE_WORDS[key] : key
}

const goodPrompt = (config: ChemicalConfig) => config.task === 'solution'
  ? 'Choose a reagent, then tap Add a drop until excess. Use fresh portions if you need them, watch what happens, and select the ion present.'
  : config.task === 'flame'
    ? 'Drag the wire loop into the blue flame, or tap it. Watch the flame, then select the metal ion present.'
    : 'Choose a test tool, tap to use it, then tap again to see the result. Watch, then select the gas present.'

export const chemicalTestsEngine: SceneEngine<ChemicalConfig, ChemicalState> = {
  id: 'chemical-tests',
  covers: ['cations', 'anions'],
  phrases: [
    'flame test', 'flame tests', 'tests for ions', 'testing for ions', 'identifying cations', 'identifying anions',
    'tests for gases', 'gas tests', 'chemical analysis', 'qualitative analysis', 'identifying an unknown salt',
    'identify an unknown salt', 'unknown salts', 'precipitate tests', 'silver nitrate test', 'barium nitrate test',
    'limewater test', 'squeaky pop test', 'identification of ions and gases',
  ],
  notFor: [
    'chromatography', 'purity', 'titration', 'acids and alkalis', 'acids alkalis and indicators', 'indicators',
    'ph scale', 'products of electrolysis', 'electrolysis', 'rates of reaction', 'solubility calculations',
  ],
  isolates: 'identity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    if (word && !has(TASK_WORDS, word)) return null
    const sample = readSample(first(src, ['sample', 'unknown', 'ion', 'gas', 'salt', 'species', 'substance']))
    if (sample === null) return null
    let task = word ? TASK_WORDS[word] : null
    if (!task) {
      if (isGas(sample)) task = 'gas'
      else if (isAnion(sample) || isCation(sample)) task = 'solution'
      else if (isFlame(sample)) task = 'flame'
    }
    if (!task) return null
    const fallback = task === 'solution' ? 'zinc' : task === 'flame' ? 'potassium' : 'oxygen'
    return { task, sample: sample || fallback }
  },

  faults(config) {
    if (config.task === 'solution' && !isSolution(config.sample)) {
      return [`There is no "${config.sample}" solution test drawn: use one of ${[...CATIONS, ...ANIONS].join(', ')}, e.g. sample "zinc".`]
    }
    if (config.task === 'flame' && !isFlame(config.sample)) {
      return [`There is no "${config.sample}" flame test drawn: use lithium, sodium, potassium, calcium or copper, e.g. sample "potassium".`]
    }
    if (config.task === 'gas' && !isGas(config.sample)) {
      return [`There is no "${config.sample}" gas test drawn: use hydrogen, oxygen, carbon-dioxide, ammonia or chlorine, e.g. sample "oxygen".`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const id = config.sample
    const aliases = [name(id), name(id).replace(/ ions$/, ''), formula(id), id.replace(/-/g, ' ')].filter(Boolean)
    if (aliases.some((a) => text.toLowerCase().includes(a.toLowerCase()))) {
      out.push(`the prompt names the unknown, which the learner is to identify from an experiment -- leave it unnamed ("${example}")`)
    }
    const result = config.task === 'solution' ? resultOf(config.sample, reagentsFor(config.sample)[0])
      : null
    const clues = config.task === 'flame' ? [FLAME_COLOURS[safeFlame(config.sample)].name]
      : config.task === 'gas' ? [GAS_OBSERVATIONS[gasEvent(config.sample, CORRECT_DETECTOR[safeGas(config.sample)])].replace(/\.$/, ''), ...(config.sample === 'oxygen' ? ['relight', 'relights', 'bursts into flame'] : [])]
        : [...new Set(reagentsFor(config.sample).flatMap((r) => {
          const x = resultOf(config.sample, r)
          return [x.precipitate ? `${x.precipitate} precipitate` : '', x.gas ? 'limewater turns milky' : '', x.dissolves && config.sample !== 'calcium' ? 'dissolves in excess' : '']
        }))].filter(Boolean) as string[]
    if (clues.some((c) => c && text.toLowerCase().includes(c.toLowerCase())) || (result?.gas && /effervescence|bubbles of gas/i.test(text))) {
      out.push(`the prompt gives the experimental result away, which the learner should discover by doing the test -- ask only for the test and identification ("${example}")`)
    }
    if (/\bsmell|\bwarm(?:ing)?\b|\bheat(?:ing)?\b|\btype (?:the|in)\b|\benter the name\b|\bdrag (?:the )?ions?\b|\bmix (?:two|the) unknowns?\b|\bwrite an? equation\b/i.test(text)) {
      out.push(`the prompt promises an action the card does not provide: it uses drops, a wire loop or a test tool, then a selection -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'solution' ? { tests: {}, reagent: reagentsFor(config.sample)[0], answer: null }
      : config.task === 'flame' ? { heated: false, answer: null }
        : { detector: null, stage: 0, answer: null }
  },

  check(config, state) {
    const s = state ?? {}
    if (config.task === 'solution') {
      const evidence = isSolution(config.sample) && evidenceComplete(config, s)
      const ok = evidence && answerOf(s) === config.sample
      return { ok, wrongIds: ok ? [] : evidence ? ['answer'] : ['evidence'] }
    }
    if (config.task === 'flame') {
      const evidence = isFlame(config.sample) && s.heated === true
      const ok = evidence && answerOf(s) === config.sample
      return { ok, wrongIds: ok ? [] : evidence ? ['answer'] : ['flame'] }
    }
    const evidence = isGas(config.sample) && detectorOf(s) === CORRECT_DETECTOR[config.sample] && gasStage(s) >= 2
    const ok = evidence && answerOf(s) === config.sample
    return { ok, wrongIds: ok ? [] : evidence ? ['answer'] : ['test'] }
  },

  solve(config) {
    if (config.task === 'flame') return { heated: true, answer: config.sample }
    if (config.task === 'gas') return { detector: CORRECT_DETECTOR[safeGas(config.sample)], stage: 2, answer: config.sample }
    let state: ChemicalState = { tests: {}, reagent: reagentsFor(config.sample)[0], answer: null }
    for (const r of reagentsFor(config.sample)) {
      state = { ...state, tests: { ...state.tests, [r]: MAX_DROPS } }
      if (evidenceComplete(config, state)) break
    }
    return { ...state, answer: config.sample }
  },

  View: ChemicalTestsView,

  prompt: `SCENE "chemical-tests" -- real laboratory apparatus on a quiet light panel. The sample is always unknown until marked. The learner performs a test, watches the observable, then selects the ion or gas from a native select (choices are ordered by name). Marking uses the actual chemical results and whether those results uniquely identify the sample, never the drawing or a lucky guess.
  solution: a dropper bottle, falling drops and a glass test tube. Choose sodium hydroxide or aqueous ammonia for a cation, or dilute acid / silver nitrate / barium nitrate for an anion, using the reagent stepper. Tap Add a drop three times to move from a little to excess; changing reagent uses a fresh portion and keeps earlier results. Coloured precipitates visibly form, grow, remain or dissolve. Acidified anion tests show nitric-acid acidification as a separate stage. Carbonate has a delivery tube and limewater that turns milky. Identification passes only when all completed results leave exactly one possibility; aluminium and zinc therefore need a second reagent. Samples: cations aluminium, calcium, copper, iron-2, iron-3, zinc; anions carbonate, chloride, bromide, iodide, sulfate.
  flame: a Bunsen burner and a nichrome wire loop with a visible grip. Drag the loop into the blue flame, or tap it; the whole flame changes to the sample's colour. Samples lithium (red), sodium (yellow), potassium (lilac), calcium (orange-red), copper (blue-green).
  gas: a gas tube and four real test tools. Choose a lighted splint, glowing splint, limewater or damp red litmus; one tap applies it, the next shows the labelled result. Hydrogen pops with the lighted splint, oxygen relights the glowing splint, carbon dioxide makes limewater milky, ammonia turns the litmus blue, chlorine bleaches it. A splint going out is drawn but is not accepted as a unique positive identification. Samples hydrogen, oxygen, carbon-dioxide, ammonia, chlorine.
  For: IGCSE identification of aqueous cations and anions, flame tests, gas tests and unknown salts. Not for ammonium/nitrate warming procedures, mixtures, chromatography, purity, indicators, titration or electrolysis.
  Before marking the card shows the apparatus, reagent/tool names, live observations and answer choices, but never which choice is right. Marking names the ion/gas and formula and explains the discriminating evidence. The prompt must NOT name the sample, its flame/precipitate colour, solubility in excess or positive gas result, and must not promise warming, smelling, typing or equation writing.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Choose a reagent, then tap Add a drop until excess. Use fresh portions if you need them, watch what happens, and select the ion present.",
    "payload": { "engine":"chemical-tests", "config": { "task":"solution", "sample":"zinc" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"identity", "apparatus":"scene:chemical-tests", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the wire loop into the blue flame, or tap it. Watch the flame, then select the metal ion present.",
    "payload": { "engine":"chemical-tests", "config": { "task":"flame", "sample":"potassium" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"identity", "apparatus":"scene:chemical-tests", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Choose a test tool, tap to use it, then tap again to see the result. Watch, then select the gas present.",
    "payload": { "engine":"chemical-tests", "config": { "task":"gas", "sample":"oxygen" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"identity", "apparatus":"scene:chemical-tests", "why":"..." } }`,
}

registerEngine(chemicalTestsEngine as SceneEngine<unknown, unknown>)
