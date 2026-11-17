// lib/studylab/engines/periodic-groups/config.ts
//
// Two Group I / Group VII bench experiments, not a Periodic Table quiz.
//   water  -- a wrapped Group I sample is dropped into cold water. Its floating, melting, movement,
//             fizzing and possible lilac flame identify it. Products are named only after marking.
//   halide -- one halogen water is added to a distilled-water control, then to an aqueous halide.
//             Comparing the two wells distinguishes displacement from dilution; the learner names
//             the halogen that was in the halide.
//
// Chemistry: Cambridge IGCSE Chemistry 0620, Group I and Group VII. Observations from Chemistry
// LibreTexts (Jim Clark), https://chem.libretexts.org/.../Reactions_of_Group_1_Elements_with_Water :
// Li floats and fizzes without melting; Na melts to a fast-moving silvery ball; K reacts faster and
// burns with a lilac flame. All form MOH(aq) and H2. Halogen displacement and the essential water
// control follow the RSC microscale practical, https://edu.rsc.org/practical/displacement-reactions-practical-videos-14-16-students/4012012.article .
// Aqueous colours here are the usual dilute school solutions: chlorine water pale yellow-green,
// bromine water orange, iodine solution brown. A clear solution may be coloured.
// The card does not claim that more heat per mole is released down Group I (RSC, Exploding some myths).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { PeriodicGroupsView } from './View'

export const CARD_WIDTH = 360
export const CARD_HEIGHT = 268

export const ALKALI_IDS = ['lithium', 'sodium', 'potassium'] as const
export const HALOGEN_IDS = ['chlorine', 'bromine', 'iodine'] as const
export const HALIDE_IDS = ['sodium-chloride', 'sodium-bromide', 'sodium-iodide', 'potassium-chloride', 'potassium-bromide', 'potassium-iodide']
export type AlkaliId = (typeof ALKALI_IDS)[number]
export type HalogenId = (typeof HALOGEN_IDS)[number]
export type HalideId = 'sodium-chloride' | 'sodium-bromide' | 'sodium-iodide' | 'potassium-chloride' | 'potassium-bromide' | 'potassium-iodide'

export type PeriodicConfig =
  | { task: 'water'; metal: string }
  | { task: 'halide'; halide: string }

export type PeriodicState = {
  /** Water: the sample has been dropped; stage 0 ready, 1 floating, 2 reacting, 3 reacted. */
  tested?: boolean
  /** Halide: halogen water chosen; stage 0 ready, 1 control done, 2 test done. */
  added?: string | null
  stage?: number
  /** The learner's identification, made only after the observation. */
  answer?: string | null
}

export interface Alkali {
  id: AlkaliId
  name: string
  symbol: string
  hydroxide: string
  observation: string
  bubbles: number
  melts: boolean
  flame: boolean
  speed: number
}

export const ALKALIS: Record<AlkaliId, Alkali> = {
  lithium: { id: 'lithium', name: 'lithium', symbol: 'Li', hydroxide: 'lithium hydroxide', observation: 'It kept its solid shape and fizzed steadily.', bubbles: 5, melts: false, flame: false, speed: 0 },
  sodium: { id: 'sodium', name: 'sodium', symbol: 'Na', hydroxide: 'sodium hydroxide', observation: 'It melted into a silvery ball and darted over the water.', bubbles: 8, melts: true, flame: false, speed: 1 },
  potassium: { id: 'potassium', name: 'potassium', symbol: 'K', hydroxide: 'potassium hydroxide', observation: 'It melted, rushed over the water and burned with a lilac flame.', bubbles: 11, melts: true, flame: true, speed: 1.7 },
}

export interface Halogen {
  id: HalogenId
  name: string
  symbol: string
  colour: string
  edge: string
  liquid: string
  rank: number
}

export const HALOGENS: Record<HalogenId, Halogen> = {
  chlorine: { id: 'chlorine', name: 'chlorine', symbol: 'Cl', colour: 'pale yellow-green', edge: '#71833A', liquid: '#E1E5AA', rank: 3 },
  bromine: { id: 'bromine', name: 'bromine', symbol: 'Br', colour: 'orange', edge: '#8B481E', liquid: '#D99155', rank: 2 },
  iodine: { id: 'iodine', name: 'iodine', symbol: 'I', colour: 'brown', edge: '#68472D', liquid: '#9B7956', rank: 1 },
}

export interface Halide {
  id: HalideId
  name: string
  alkali: 'sodium' | 'potassium'
  alkaliSymbol: 'Na' | 'K'
  halogen: HalogenId
  formula: string
}

export const HALIDES: Record<HalideId, Halide> = {
  'sodium-chloride': { id: 'sodium-chloride', name: 'sodium chloride', alkali: 'sodium', alkaliSymbol: 'Na', halogen: 'chlorine', formula: 'NaCl' },
  'sodium-bromide': { id: 'sodium-bromide', name: 'sodium bromide', alkali: 'sodium', alkaliSymbol: 'Na', halogen: 'bromine', formula: 'NaBr' },
  'sodium-iodide': { id: 'sodium-iodide', name: 'sodium iodide', alkali: 'sodium', alkaliSymbol: 'Na', halogen: 'iodine', formula: 'NaI' },
  'potassium-chloride': { id: 'potassium-chloride', name: 'potassium chloride', alkali: 'potassium', alkaliSymbol: 'K', halogen: 'chlorine', formula: 'KCl' },
  'potassium-bromide': { id: 'potassium-bromide', name: 'potassium bromide', alkali: 'potassium', alkaliSymbol: 'K', halogen: 'bromine', formula: 'KBr' },
  'potassium-iodide': { id: 'potassium-iodide', name: 'potassium iodide', alkali: 'potassium', alkaliSymbol: 'K', halogen: 'iodine', formula: 'KI' },
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
export const isAlkali = (id: string): id is AlkaliId => has(ALKALIS, id)
export const isHalogen = (id: string): id is HalogenId => has(HALOGENS, id)
export const isHalide = (id: string): id is HalideId => has(HALIDES, id)
export const alkaliOf = (id: string): Alkali => isAlkali(id) ? ALKALIS[id] : ALKALIS.lithium
export const halogenOf = (id: string): Halogen => isHalogen(id) ? HALOGENS[id] : HALOGENS.chlorine
export const halideOf = (id: string): Halide => isHalide(id) ? HALIDES[id] : HALIDES['potassium-bromide']

export function stageOf(config: PeriodicConfig, state: PeriodicState | null | undefined): number {
  const max = config.task === 'water' ? 3 : 2
  const n = state?.stage
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0
}

export function addedOf(state: PeriodicState | null | undefined): string | null {
  return typeof state?.added === 'string' ? state.added : null
}

export function answerOf(state: PeriodicState | null | undefined): string | null {
  return typeof state?.answer === 'string' ? state.answer : null
}

/** The only halogen water that releases the halide's own halogen: a more reactive one. */
export function neededHalogen(config: PeriodicConfig): HalogenId {
  const h = config.task === 'halide' ? halideOf(config.halide).halogen : 'bromine'
  return h === 'chlorine' ? 'bromine' : h === 'bromine' ? 'chlorine' : 'bromine'
}

export function displaces(added: string, halide: string): boolean {
  return isHalogen(added) && isHalide(halide) && HALOGENS[added].rank > HALOGENS[HALIDES[halide].halogen].rank
}

export function equationOf(config: PeriodicConfig, added?: string | null): string {
  if (config.task === 'water') {
    const m = alkaliOf(config.metal)
    return `2${m.symbol} + 2H₂O → 2${m.symbol}OH + H₂`
  }
  const salt = halideOf(config.halide)
  const h = halogenOf(added ?? neededHalogen(config))
  const product = halogenOf(salt.halogen)
  return `${h.symbol}₂ + 2${salt.formula} → 2${salt.alkaliSymbol}${h.symbol} + ${product.symbol}₂`
}

export function done(config: PeriodicConfig, state: PeriodicState): boolean {
  const answer = answerOf(state)
  if (config.task === 'water') return state.tested === true && stageOf(config, state) === 3 && answer === config.metal
  const added = addedOf(state)
  return added !== null && displaces(added, config.halide) && stageOf(config, state) === 2 && answer === halideOf(config.halide).halogen
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function working(config: PeriodicConfig, state: PeriodicState): string {
  if (config.task === 'water') {
    const m = alkaliOf(config.metal)
    return `Yes — the sample was ${m.name}. ${m.observation} The colourless solution contains ${m.hydroxide}, and hydrogen gas was made. Reactivity increases down Group I: lithium, then sodium, then potassium.`
  }
  const salt = halideOf(config.halide)
  const added = halogenOf(addedOf(state) ?? neededHalogen(config))
  const product = halogenOf(salt.halogen)
  return `Yes — ${salt.name} contains ${product.name.toLowerCase()} as its halide. ${cap(added.name)} is more reactive, so it displaced ${product.name.toLowerCase()} from the solution. The control shows the added water's own colour; the test well shows ${product.colour} ${product.name}.`
}

export function madeText(config: PeriodicConfig, state: PeriodicState): string {
  const answer = answerOf(state)
  if (config.task === 'water') {
    const m = alkaliOf(config.metal)
    if (state.tested !== true || stageOf(config, state) < 3) return 'The test is not finished. Keep watching until the sample has reacted, then name it.'
    if (!answer) return 'The reaction is finished. Use its appearance, movement and fizzing to name the sample.'
    return `You chose ${answer}. ${m.observation} That identifies the sample as ${m.name}, not ${answer}. Group I reactions become more vigorous down the group.`
  }
  const salt = halideOf(config.halide)
  const product = halogenOf(salt.halogen)
  const added = addedOf(state)
  if (!added) return 'Choose a halogen water and run both the water control and the test before naming the halogen.'
  if (stageOf(config, state) < 2) return 'The control is done, but the halide test is not. Add the same drops to the halide, then compare the wells.'
  if (!displaces(added, config.halide)) return `${cap(halogenOf(added).name)} cannot displace ${product.name.toLowerCase()} from ${salt.name}. The control changed colour only because it was diluted; the test well stayed unchanged. A more reactive halogen is needed.`
  if (!answer) return 'The two wells now have different colours. Name the halogen that was combined in the original halide.'
  return `You chose ${answer}, but the test well made ${product.colour} ${product.name}. So ${salt.name} contained ${product.name.toLowerCase()} as its halide, not ${answer}.`
}

// ---------------------------------------------------------------------------
// Reading a semantic config broadly. Unknown substances still parse; faults offers a nearby working one.

const keyOf = (raw: unknown) => typeof raw === 'string' || typeof raw === 'number'
  ? String(raw).trim().toLowerCase().replace(/sulph/g, 'sulf').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const WATER_WORDS = new Set(['water', 'water-reaction', 'alkali-water', 'alkali-metals', 'alkali-metal', 'group-i', 'group-1', 'identify', 'identify-metal', 'unknown-metal', 'react-with-water'])
const HALIDE_WORDS = new Set(['halide', 'halides', 'halogen', 'halogens', 'displace', 'displacement', 'halogen-displacement', 'group-vii', 'group-7', 'identify-halogen', 'test-halide'])

function readMetal(raw: unknown): string {
  let key = keyOf(raw).replace(/^(?:unknown|wrapped|sample)-/, '').replace(/-(?:metal|sample)$/, '')
  if (key === 'li') key = 'lithium'
  if (key === 'na') key = 'sodium'
  if (key === 'k') key = 'potassium'
  return key || 'sodium'
}

function readHalide(raw: unknown): string {
  let key = keyOf(raw).replace(/^(?:aqueous|solution)-/, '').replace(/-(?:solution|aq)$/, '')
  key = key.replace(/^nacl$/, 'sodium-chloride').replace(/^nabr$/, 'sodium-bromide').replace(/^nai$/, 'sodium-iodide')
    .replace(/^kcl$/, 'potassium-chloride').replace(/^kbr$/, 'potassium-bromide').replace(/^ki$/, 'potassium-iodide')
  return key || 'potassium-bromide'
}

const goodPrompt = (config: PeriodicConfig) => config.task === 'water'
  ? 'Drop the sample in and watch each stage. Then name the unknown alkali metal from what you see.'
  : `Choose a halogen water, add drops to the water control and then to the ${halideOf(config.halide).name}. Compare the wells and name the halogen in the original halide.`

export const periodicGroupsEngine: SceneEngine<PeriodicConfig, PeriodicState> = {
  id: 'periodic-groups',
  covers: ['alkali', 'halogens'],
  phrases: [
    'periodic table', 'the periodic table', 'group i', 'group 1', 'group vii', 'group 7', 'alkali metal', 'alkali metals',
    'group i metals', 'group 1 metals', 'group vii elements', 'halogen displacement', 'halogen displacement reactions',
    'displacement of halogens', 'trends in groups', 'group trends', 'reactivity down the group', 'reactions of alkali metals with water',
  ],
  notFor: [
    'reactivity series', 'metal displacement', 'displacement of metals', 'metals reacting with acids', 'metal acid reactions',
    'extraction of metals', 'electrolysis', 'atomic structure', 'electron shells', 'electronic configuration', 'ionic bonding', 'covalent bonding',
    'periodic table data', 'periodic table chart', 'chart of the periodic table', 'noble gases', 'transition elements', 'transition metals',
    'acids and alkalis', 'acids and bases', 'ph scale', 'neutralisation', 'titration', 'alkaline earth',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const metal = first(src, ['metal', 'sample', 'element'])
    const halide = first(src, ['halide', 'salt', 'solution', 'compound'])
    const word = keyOf(rawTask)
    if (word && !WATER_WORDS.has(word) && !HALIDE_WORDS.has(word)) return null
    const task = word ? WATER_WORDS.has(word) ? 'water' : 'halide' : halide !== undefined ? 'halide' : metal !== undefined ? 'water' : null
    if (!task) return null
    return task === 'water' ? { task, metal: readMetal(metal) } : { task, halide: readHalide(halide) }
  },

  faults(config) {
    if (config.task === 'water') {
      return isAlkali(config.metal) ? [] : [`There is no "${config.metal}" water sample drawn here: use lithium, sodium or potassium, e.g. metal "sodium".`]
    }
    const out: string[] = []
    if (!isHalide(config.halide)) out.push(`There is no "${config.halide}" halide solution drawn here: use a sodium or potassium chloride, bromide or iodide, e.g. halide "potassium-bromide".`)
    else if (config.halide.endsWith('chloride')) out.push(`No halogen on this card can displace chlorine from ${halideOf(config.halide).name}, so there is no successful experiment: use a bromide or iodide, e.g. halide "potassium-bromide".`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'water') {
      if (/\b(?:it|sample|metal)\s+(?:is|was)\s+(?:lithium|sodium|potassium)\b|\b(?:lithium|sodium|potassium)\s+(?:floats|melts|fizzes|burns|darts|reacts)\b|\bmelts?\s+into\b|\blilac\s+flame\b|\bkeeps?\s+its\s+shape\b|\bmore\s+reactive\b|\bincreases\s+down\b|\b(?:lithium|sodium|potassium)\s+hydroxide\b|→|->/i.test(text)) {
        out.push(`the prompt gives the sample's identity, observation or product away, which the learner is to see and name -- ask for the test only ("${example}")`)
      }
    } else if (/\b(?:more|less)\s+reactive\b|\bdisplaces?\b|\bno\s+(?:reaction|change)\b|\bturns?\s+(?:orange|brown|yellow)\b|\b(?:orange|brown)\s+(?:solution|product|colour)\b|\b chlorine\s+water\b|\bbromine\s+water\b|\biodine\s+(?:water|solution)\b|→|->/i.test(text)) {
      out.push(`the prompt names the reagent, result or explanation the experiment is for -- ask the learner to choose, compare and identify ("${example}")`)
    }
    if (/\border\s+(?:the\s+)?(?:metals|halogens|group)\b|\bdrag\s+(?:electrons|ions|atoms)\b|\belectron\s+shells?\b|\bnoble\s+gases?\b|\btransition\s+(?:elements|metals)\b|\bmelting\s+points?\b|\bdensit(?:y|ies)\b|\bclick\s+(?:an?\s+)?element\s+on\s+the\s+table\b/i.test(text)) {
      out.push(`the prompt promises something this card does not show: it is one water reaction or one controlled halide test, not a full Periodic Table or a data chart -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'water' ? { tested: false, stage: 0, answer: null } : { added: null, stage: 0, answer: null }
  },

  check(config, state) {
    const ok = done(config, state)
    if (ok) return { ok, wrongIds: [] }
    if (config.task === 'water') return { ok, wrongIds: [state.tested && stageOf(config, state) === 3 ? 'answer' : 'reaction'] }
    return { ok, wrongIds: [addedOf(state) && stageOf(config, state) === 2 ? 'answer' : 'experiment'] }
  },

  solve(config) {
    return config.task === 'water'
      ? { tested: true, stage: 3, answer: config.metal }
      : { added: neededHalogen(config), stage: 2, answer: halideOf(config.halide).halogen }
  },

  View: PeriodicGroupsView,

  prompt: `SCENE "periodic-groups" -- two real Group I / Group VII bench experiments on a quiet light panel. Every run button advances one labelled stage, and reduced motion shows the same stages as stills.
  water: a small wrapped Group I sample beside a glass trough of cold water. Press "Drop it in", then the labelled watch/finish buttons: it floats, then lithium keeps its shape and fizzes steadily, sodium melts into a silvery ball that darts about, or potassium melts, rushes about and burns with a lilac flame. The last frame leaves a colourless solution. The learner then chooses lithium, sodium or potassium as the sample's identity. Marking names the hydroxide, hydrogen and gives the equation; reactivity increases down Group I. config: { "task":"water", "metal":"lithium" } (or sodium or potassium).
  halide: a dropper of chlorine, bromine or iodine water (chosen with previous/next stepper buttons) above two ceramic wells: a distilled-water control and the named aqueous halide. The first button adds drops to the control; the second adds the same drops to the halide. The control exposes dilution. If the added halogen is more reactive, the test well changes to bromine orange or iodine brown; otherwise it stays colourless. The learner then names the halogen combined in the original halide. A wrong reagent gives no successful test and must be changed. Marking explains displacement and gives the equation. config: { "task":"halide", "halide":"potassium-bromide" } or sodium-bromide, sodium-iodide or potassium-iodide. Chloride configs are refused because no available halogen can displace chlorine.
  For: Group I alkali metals reacting with cold water, identifying Li/Na/K from observations, Group VII halogen displacement, reactivity trends in groups, and why a water control matters. Not for: the general reactivity series or metal displacement, atomic shells, bonding, melting-point/density charts, noble gases, transition elements, or a full interactive Periodic Table.
  Before marking the card shows only the named starting materials and direct observations, never the unknown's identity, products, equation or relative-reactivity verdict. The prompt must not give those away or promise ordering, shells, ion dragging, a complete table, melting points or densities.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drop the sample in and watch each stage. Then name the unknown alkali metal from what you see.",
    "payload": { "engine":"periodic-groups", "config": { "task":"water", "metal":"sodium" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:periodic-groups", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drop the sample in and watch each stage. Then name the unknown alkali metal from what you see.",
    "payload": { "engine":"periodic-groups", "config": { "task":"water", "metal":"potassium" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:periodic-groups", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Choose a halogen water, add drops to the water control and then to the potassium bromide. Compare the wells and name the halogen in the original halide.",
    "payload": { "engine":"periodic-groups", "config": { "task":"halide", "halide":"potassium-bromide" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:periodic-groups", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Choose a halogen water, add drops to the water control and then to the sodium iodide. Compare the wells and name the halogen in the original halide.",
    "payload": { "engine":"periodic-groups", "config": { "task":"halide", "halide":"sodium-iodide" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:periodic-groups", "why":"..." } }`,
}

registerEngine(periodicGroupsEngine as SceneEngine<unknown, unknown>)
