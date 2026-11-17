// lib/studylab/engines/reactivity-series-kimi31/config.ts
//
// Two small laboratory experiments, not a reactivity quiz. The learner lowers a metal strip into a solution,
// watches, and reports the observation. Aluminium has one preparation step first: rub its dull surface with
// emery paper. The drawing shows only observables before marking; names, equations and reasons come with the mark.
//
// Chemistry: Cambridge IGCSE Chemistry 0620's reactivity series and displacement rules. The practical observations
// follow the RSC's metal/salt investigation: https://edu.rsc.org/experiments/displacement-reactions-between-metals-and-their-salts/720.article
// Copper(II) sulfate is blue, iron(II) sulfate pale green, zinc sulfate and silver nitrate colourless. Copper is
// reddish brown and silver a light grey coating. Aluminium's protective oxide is discussed by the RSC at
// https://edu.rsc.org/exhibition-chemistry/dancing-flames/2000045.article . The acid result is the usual initial
// observation, not a claim that oxide-coated aluminium never reacts with hydrochloric acid.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ReactivitySeriesView } from './View'

export const CARD_WIDTH = 360
export const CARD_HEIGHT = 284

export type MetalId = 'zinc' | 'iron' | 'copper' | 'silver'
export type SolutionId = 'zinc-sulfate' | 'iron-sulfate' | 'copper-sulfate' | 'silver-nitrate'
export type Observation = 'coating' | 'none'

export type ReactivityConfig =
  | { task: 'displace'; metal: string; solution: string }
  | { task: 'aluminium' }

export type ReactivityState = {
  dipped?: boolean
  observed?: Observation | null
  rubbed?: number
}

export interface Metal {
  id: MetalId
  name: string
  symbol: string
  charge: number
  rank: number
  colour: string
  edge: string
}

// A relative order for the four metals used here; the numbers are only an ordering, not electrode potentials.
export const METALS: Record<MetalId, Metal> = {
  zinc: { id: 'zinc', name: 'zinc', symbol: 'Zn', charge: 2, rank: 30, colour: '#9AAAB5', edge: '#566672' },
  iron: { id: 'iron', name: 'iron', symbol: 'Fe', charge: 2, rank: 20, colour: '#727D84', edge: '#414A51' },
  copper: { id: 'copper', name: 'copper', symbol: 'Cu', charge: 2, rank: 10, colour: '#C67B52', edge: '#81462E' },
  silver: { id: 'silver', name: 'silver', symbol: 'Ag', charge: 1, rank: 0, colour: '#D8DDE1', edge: '#7D8992' },
}

export interface Solution {
  id: SolutionId
  name: string
  formula: string
  metal: MetalId
  anion: 'sulfate' | 'nitrate'
  liquid: string
}

export const SOLUTIONS: Record<SolutionId, Solution> = {
  'zinc-sulfate': { id: 'zinc-sulfate', name: 'zinc sulfate', formula: 'ZnSO₄', metal: 'zinc', anion: 'sulfate', liquid: '#E5EFF1' },
  'iron-sulfate': { id: 'iron-sulfate', name: 'iron(II) sulfate', formula: 'FeSO₄', metal: 'iron', anion: 'sulfate', liquid: '#C9DDBB' },
  'copper-sulfate': { id: 'copper-sulfate', name: 'copper(II) sulfate', formula: 'CuSO₄', metal: 'copper', anion: 'sulfate', liquid: '#70B5DF' },
  'silver-nitrate': { id: 'silver-nitrate', name: 'silver nitrate', formula: 'AgNO₃', metal: 'silver', anion: 'nitrate', liquid: '#E5EFF1' },
}

export const METAL_IDS = Object.keys(METALS) as MetalId[]
export const SOLUTION_IDS = Object.keys(SOLUTIONS) as SolutionId[]

const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key)
export const isMetal = (id: string): id is MetalId => has(METALS, id)
export const isSolution = (id: string): id is SolutionId => has(SOLUTIONS, id)

/** Safe fallbacks mean even a config with a fault can be server-rendered without crashing. */
export const metalOf = (id: string): Metal => isMetal(id) ? METALS[id] : METALS.zinc
export const solutionOf = (id: string): Solution => isSolution(id) ? SOLUTIONS[id] : SOLUTIONS['copper-sulfate']

export interface Reaction {
  product: MetalId
  coating: string
  coatingColour: string
  coatingEdge: string
  after: string
  equation: string
  ionic: string
  explanation: string
}

const nitrateFormula = (metal: Metal) => `${metal.symbol}(NO₃)${metal.charge === 2 ? '₂' : ''}`
const sulfateFormula = (metal: Metal) => `${metal.symbol}SO₄`

/** The reaction, worked out from relative reactivity and ion charges, never from what was drawn. */
export function reactionOf(config: ReactivityConfig): Reaction | null {
  if (config.task !== 'displace' || !isMetal(config.metal) || !isSolution(config.solution)) return null
  const added = METALS[config.metal]
  const solution = SOLUTIONS[config.solution]
  const dissolved = METALS[solution.metal]
  if (added.rank <= dissolved.rank) return null
  const product = dissolved
  const silver = solution.anion === 'nitrate'
  const newFormula = silver ? nitrateFormula(added) : sulfateFormula(added)
  const equation = silver
    ? `${added.symbol} + 2AgNO₃ → ${newFormula} + 2Ag`
    : `${added.symbol} + ${solution.formula} → ${newFormula} + ${product.symbol}`
  const ionic = silver
    ? `${added.symbol} + 2Ag⁺ → ${added.symbol}²⁺ + 2Ag`
    : `${added.symbol} + ${product.symbol}²⁺ → ${added.symbol}²⁺ + ${product.symbol}`
  const newSolution = added.id === 'copper' ? 'blue' : added.id === 'iron' ? 'pale green' : 'colourless'
  const explanation = `${cap(added.name)} loses electrons more readily than ${product.name}, so it displaces ${product.name} from ${solution.name}; ${product.name} ions gain the electrons to form the coating.`
  return {
    product: product.id,
    coating: product.id === 'copper' ? 'reddish-brown' : product.id === 'silver' ? 'light grey' : 'dark grey',
    coatingColour: product.colour,
    coatingEdge: product.edge,
    after: newSolution,
    equation,
    ionic,
    explanation,
  }
}

export function dippedOf(state: ReactivityState | null | undefined): boolean {
  return state?.dipped === true
}
export function rubbedOf(state: ReactivityState | null | undefined): number {
  const n = state?.rubbed
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0
}
export function observationOf(state: ReactivityState | null | undefined): Observation | null {
  return state?.observed === 'coating' || state?.observed === 'none' ? state.observed : null
}

export function done(config: ReactivityConfig, state: ReactivityState): boolean {
  if (!dippedOf(state)) return false
  if (config.task === 'aluminium') return rubbedOf(state) === 3
  const observed = observationOf(state)
  return observed !== null && (observed === 'coating') === (reactionOf(config) !== null)
}

export function oxideActive(config: ReactivityConfig, state: ReactivityState): boolean {
  return config.task === 'aluminium' && rubbedOf(state) === 3 && dippedOf(state)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function working(config: ReactivityConfig, state: ReactivityState): string {
  if (config.task === 'aluminium') {
    return 'Yes — gas bubbles form once the dull surface has been rubbed away. Aluminium is reactive, but a thin aluminium oxide layer normally protects it. Rubbing exposes the metal to the acid.'
  }
  const reaction = reactionOf(config)
  if (reaction) return `Yes — a ${reaction.coating} coating formed. ${reaction.explanation}`
  const metal = metalOf(config.metal)
  const solution = solutionOf(config.solution)
  return `Yes — no visible change is right. ${cap(metal.name)} is less reactive than ${metalOf(solution.metal).name}, so it cannot displace it from ${solution.name}. The strip and solution stay unchanged.`
}

export function madeText(config: ReactivityConfig, state: ReactivityState): string {
  if (config.task === 'aluminium') {
    const rubbed = rubbedOf(state)
    if (!dippedOf(state)) return rubbed === 3
      ? 'The surface is now bright, but the strip is still above the acid. Dip it in to test the exposed aluminium.'
      : 'The strip has not been tested in the acid yet. Rub its dull surface with the emery paper, then dip it in.'
    return rubbed === 0
      ? 'The unrubbed strip is in the acid, with no visible reaction at first. Lift it out and rub the dull surface with the emery paper.'
      : `The strip is in the acid, but only ${rubbed} of the 3 rubs have been made. Lift it out and finish rubbing the dull surface away.`
  }
  if (!dippedOf(state)) return 'The strip has not been dipped yet. Put it into the solution, watch, then choose what you observe.'
  const observed = observationOf(state)
  if (!observed) return 'The strip is in the solution. Choose the observation that matches what you can see.'
  const reaction = reactionOf(config)
  const metal = metalOf(config.metal)
  const solution = solutionOf(config.solution)
  if (reaction) {
    return observed === 'none'
      ? `You said no change, but a ${reaction.coating} coating formed on the strip. ${reaction.explanation}`
      : `You said a coating formed, which matches the observation. ${reaction.explanation}`
  }
  return `You said a coating formed, but the strip and solution are unchanged. ${cap(metal.name)} is less reactive than ${metalOf(solution.metal).name}, so no displacement happens.`
}

export function equationsOf(config: ReactivityConfig, state: ReactivityState): string[] {
  if (config.task === 'aluminium') {
    return oxideActive(config, state)
      ? ['2Al + 6HCl → 2AlCl₃ + 3H₂']
      : []
  }
  const reaction = reactionOf(config)
  return reaction ? [reaction.equation, reaction.ionic] : []
}

// ---------------------------------------------------------------------------
// Reading a semantic config broadly; faults gives a usable nearby example.

const keyOf = (raw: unknown) => typeof raw === 'string' || typeof raw === 'number'
  ? String(raw).trim().toLowerCase().replace(/aluminum/g, 'aluminium').replace(/sulph/g, 'sulf')
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const METAL_WORDS: Record<string, MetalId> = {
  zinc: 'zinc', zn: 'zinc', 'zinc-strip': 'zinc', 'zinc-metal': 'zinc',
  iron: 'iron', fe: 'iron', 'iron-strip': 'iron', 'iron-metal': 'iron',
  copper: 'copper', cu: 'copper', 'copper-strip': 'copper', 'copper-metal': 'copper',
  silver: 'silver', ag: 'silver', 'silver-strip': 'silver', 'silver-metal': 'silver',
}
const SOLUTION_WORDS: Record<string, SolutionId> = {
  'zinc-sulfate': 'zinc-sulfate', 'zinc-sulfate-solution': 'zinc-sulfate', 'aqueous-zinc-sulfate': 'zinc-sulfate', znso4: 'zinc-sulfate',
  'iron-sulfate': 'iron-sulfate', 'iron-2-sulfate': 'iron-sulfate', 'iron-ii-sulfate': 'iron-sulfate', 'ferrous-sulfate': 'iron-sulfate', 'iron-sulfate-solution': 'iron-sulfate', 'iron-2-sulfate-solution': 'iron-sulfate', feso4: 'iron-sulfate',
  'copper-sulfate': 'copper-sulfate', 'copper-2-sulfate': 'copper-sulfate', 'copper-ii-sulfate': 'copper-sulfate', 'copper-sulfate-solution': 'copper-sulfate', 'copper-2-sulfate-solution': 'copper-sulfate', 'aqueous-copper-sulfate': 'copper-sulfate', cuso4: 'copper-sulfate',
  'silver-nitrate': 'silver-nitrate', 'silver-nitrate-solution': 'silver-nitrate', 'aqueous-silver-nitrate': 'silver-nitrate', agno3: 'silver-nitrate',
}
const DISPLACE_WORDS = new Set(['displace', 'displacement', 'displacement-reaction', 'metal-displacement', 'reactivity', 'reactivity-series', 'test', 'test-metal', 'metal-solution', 'salt-solution'])
const OXIDE_WORDS = new Set(['aluminium', 'aluminum', 'oxide', 'oxide-layer', 'aluminium-oxide', 'aluminium-oxide-layer', 'aluminium-acid', 'aluminium-and-acid', 'rub-aluminium'])

function readMetal(raw: unknown): string {
  const key = keyOf(raw)
  return has(METAL_WORDS, key) ? METAL_WORDS[key] : key || 'zinc'
}
function readSolution(raw: unknown): string {
  let key = keyOf(raw).replace(/^(?:dilute|aqueous)-/, '').replace(/-solution$/, '')
  key = key.replace(/^copper-ii-/, 'copper-2-').replace(/^iron-ii-/, 'iron-2-')
  return has(SOLUTION_WORDS, key) ? SOLUTION_WORDS[key] : key || 'copper-sulfate'
}

const goodPrompt = (config: ReactivityConfig) => config.task === 'aluminium'
  ? 'Tap the emery paper to rub the aluminium strip, then drag it into the dilute hydrochloric acid, or tap it. Make gas bubbles appear.'
  : `Drag the ${metalOf(config.metal).name} strip into the ${solutionOf(config.solution).name}, or tap it. Watch what happens, then choose the observation that matches.`

export const reactivitySeriesEngine: SceneEngine<ReactivityConfig, ReactivityState> = {
  id: 'reactivity-series',
  covers: ['reactivity'],
  phrases: [
    'reactivity series', 'displacement reaction', 'displacement reactions', 'metal displacement', 'displacement of metals',
    'more reactive metals', 'less reactive metals', 'metals reacting with acids', 'metal acid reactions',
    'aluminium oxide layer', 'why aluminium seems unreactive', 'reactions of metals with salt solutions',
  ],
  notFor: [
    'electrolysis', 'electrolytic extraction', 'extraction of aluminium', 'extraction of metals', 'blast furnace',
    'periodic table', 'group trends', 'acids and ph', 'ph scale', 'rates of reaction', 'rate of reaction', 'reaction rates',
    'physical properties of metals', 'displacement in physics', 'distance and displacement', 'displacement and distance',
    'displacement time graphs', 'vector displacement', 'corrosion', 'sacrificial protection', 'metals with water',
    'metals reacting with water', 'reactions with steam', 'alkali metals and water',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const metalRaw = first(src, ['metal', 'strip', 'addedMetal', 'added'])
    const solutionRaw = first(src, ['solution', 'salt', 'compound', 'electrolyte'])
    const word = keyOf(rawTask)
    const aluminium = OXIDE_WORDS.has(word) || (!word && keyOf(metalRaw) === 'aluminium')
    if (aluminium) return { task: 'aluminium' }
    if (word && !DISPLACE_WORDS.has(word)) return null
    if (!word && metalRaw === undefined && solutionRaw === undefined) return null
    return { task: 'displace', metal: readMetal(metalRaw), solution: readSolution(solutionRaw) }
  },

  faults(config) {
    if (config.task === 'aluminium') return []
    const out: string[] = []
    if (!isMetal(config.metal)) out.push(`Metal "${config.metal}" has no strip drawn here: use zinc, iron, copper or silver, e.g. metal "zinc".`)
    if (!isSolution(config.solution)) out.push(`Solution "${config.solution}" is not drawn here: use zinc sulfate, iron(II) sulfate, copper(II) sulfate or silver nitrate, e.g. solution "copper-sulfate".`)
    if (isMetal(config.metal) && isSolution(config.solution) && config.metal === SOLUTIONS[config.solution].metal) {
      out.push(`The strip and the dissolved metal are both ${config.metal}, so this cannot compare two metals: use e.g. metal "${config.metal === 'copper' ? 'zinc' : 'copper'}" with solution "${config.solution}".`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'displace') {
      if (/\b(?:more|less)\s+reactive\b|\bno\s+(?:visible\s+)?(?:reaction|change)\b|\bwill\s+(?:not\s+)?react\b|\bdoes\s+not\s+react\b|\b(?:will|can|cannot|can't|does|must)\s+displace\b|\breddish[- ]brown\b|\blight grey\b|\bsolution\s+(?:turns|becomes|fades)\b|\b electrons?\s+(?:are\s+)?(?:lost|gained|transferred)\b|→|->/i.test(text)) {
        out.push(`the prompt gives the experimental result or its explanation away, which the learner should see after dipping -- ask only for the test and observation ("${example}")`)
      }
    } else if (/\boxide\s+layer\b|\bprotective\s+(?:layer|coating)\b|\bmore\s+reactive\b|\bhydrogen\s+(?:is|gas\s+is)\s+(?:made|produced|formed)\b|→|->/i.test(text)) {
      out.push(`the prompt explains the hidden result before the experiment -- ask the learner to rub and dip, without naming the oxide layer or giving an equation ("${example}")`)
    }
    if (/\b(?:drag|move|place)\s+(?:the\s+)?ions?\b|\border\s+the\s+(?:metals|series)\b|\bblast furnace\b|\belectrolysis\b|\bsacrificial\b|\bwater\s+and\s+steam\b|\bmeasure\s+the\s+rate\b/i.test(text)) {
      out.push(`the prompt promises something this card does not show: it is one metal strip, one solution and direct observation -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'aluminium' ? { dipped: false, rubbed: 0 } : { dipped: false, observed: null }
  },

  check(config, state) {
    const ok = done(config, state)
    const wrongIds = ok ? [] : config.task === 'aluminium' ? [!dippedOf(state) ? 'strip' : 'oxide'] : [!dippedOf(state) ? 'strip' : 'observation']
    return { ok, wrongIds }
  },

  solve(config) {
    if (config.task === 'aluminium') return { dipped: true, rubbed: 3 }
    return { dipped: true, observed: reactionOf(config) ? 'coating' : 'none' }
  },

  View: ReactivitySeriesView,

  prompt: `SCENE "reactivity-series" -- two real, quiet laboratory experiments on a light panel, with a glass beaker, a labelled solution and a movable metal strip with a grip.
  displace: the learner drags the strip down into the named metal salt solution, or taps it; tap again to lift it out. If displacement happens, a material-coloured coating visibly grows on the immersed strip and the solution changes colour (blue copper(II) sulfate fades, iron(II) sulfate is pale green). If it cannot happen, nothing changes. After dipping, two small buttons ask for the observation: "A coating" or "No change". Marking is right when the report matches the actual observation. Marking then names the displacement, explains relative reactivity and electron loss, and gives the symbol and net ionic equations where a reaction occurred. Both reacting and non-reacting pairs are useful; there is no product to guess before doing the test.
  aluminium: tap the emery paper three times to rub away the dull surface, then dip the aluminium strip in dilute hydrochloric acid (or tap it). The prepared strip visibly bubbles; an unrubbed strip shows no initial reaction. Lift it out to finish rubbing if it was dipped too soon. Marking explains the protective aluminium oxide layer and gives the acid equation.
  For: using the reactivity series, metal displacement in aqueous salts, observations and no-reaction evidence, electron loss by a more reactive metal, and why aluminium seems unreactive. Supported metals: zinc, iron, copper, silver. Solutions: zinc sulfate, iron(II) sulfate, copper(II) sulfate, silver nitrate. The strip's metal must differ from the solution's metal. Not for: electrolysis itself, extraction methods or the blast furnace, periodic trends, pH, rates, metal/water/steam comparisons, corrosion or sacrificial protection, or displacement as distance in physics.
  config: { "task":"displace", "metal":"zinc", "solution":"copper-sulfate" }
       or { "task":"displace", "metal":"copper", "solution":"zinc-sulfate" }
       or { "task":"displace", "metal":"copper", "solution":"silver-nitrate" }
       or { "task":"aluminium" }
  Before marking the card shows the named reactants and only what can be observed. It holds back whether this is called displacement, which metal is more reactive, product names and all equations. The prompt must not state the result, the relative reactivity, the oxide layer's role, a colour change or an equation, and must not promise ion dragging, ordering a series or extraction.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the zinc strip into the copper(II) sulfate, or tap it. Watch what happens, then choose the observation that matches.",
    "payload": { "engine":"reactivity-series", "config": { "task":"displace", "metal":"zinc", "solution":"copper-sulfate" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:reactivity-series", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the copper strip into the zinc sulfate, or tap it. Watch what happens, then choose the observation that matches.",
    "payload": { "engine":"reactivity-series", "config": { "task":"displace", "metal":"copper", "solution":"zinc-sulfate" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:reactivity-series", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the copper strip into the silver nitrate, or tap it. Watch what happens, then choose the observation that matches.",
    "payload": { "engine":"reactivity-series", "config": { "task":"displace", "metal":"copper", "solution":"silver-nitrate" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:reactivity-series", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the emery paper to rub the aluminium strip, then drag it into the dilute hydrochloric acid, or tap it. Make gas bubbles appear.",
    "payload": { "engine":"reactivity-series", "config": { "task":"aluminium" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:reactivity-series", "why":"..." } }`,
}

registerEngine(reactivitySeriesEngine as SceneEngine<unknown, unknown>)
