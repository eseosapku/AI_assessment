// lib/studylab/engines/dissolving/config.ts
//
// Two small dissolving experiments on a real beaker:
//   stir     -- drag the spoon sideways. A soluble solid's pile shrinks until it is gone; sand and chalk swirl
//               and settle again. The total mass never changes. Warm water and small pieces take fewer strokes.
//   saturate -- add 10 g spoonfuls to cold water until solid remains, then warm the same water and watch it
//               dissolve. Stirring is not offered as a way past a solubility limit.
//
// Science sources (see research.md):
//   BBC Bitesize, Dissolving: solute/solvent, soluble salt and sugar, insoluble sand and chalk, and the effects
//   of stirring, temperature and particle size. https://www.bbc.co.uk/bitesize/topics/zych6g8/articles/zs9sp4j
//   RSC, Conservation of mass in dissolving: no mass is lost when a solute disappears from sight.
//   https://edu.rsc.org/conservation-of-mass/conservation-of-mass-in-dissolving-and-precipitation-11-14-years/75.article
//   ACS middle-school sucrose table, about 204 and 288 g sucrose per 100 g water at 20 and 60 °C; Wikipedia's
//   sucrose entry independently gives 2.01 g/mL at 20 °C. https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson6.html
//   The 40 °C capacity is linearly interpolated for this school model and is never claimed as a measurement.
//   Stroke counts are a clear qualitative rate model, not laboratory timings.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { DissolvingView } from './View'

export const VIEW_W = 360
export const VIEW_H = 232
export const TEMPERATURES = [20, 40, 60] as const
// With 10 g water, three spoonfuls saturate it cold but still exceed its warm capacity: no solvable experiment.
export const WATERS = [15, 20, 25, 30] as const
export const SPOON_G = 10
export const SOLUTE_G = 10
export const WATER_IN_STIR_G = 20

export type Substance = 'sugar' | 'salt' | 'sand' | 'chalk'
export type Pieces = 'grains' | 'lumps'
export type DissolvingConfig =
  | { task: 'stir'; substance: string; temperature: number; pieces: string }
  | { task: 'saturate'; water: number }
export type DissolvingState = { strokes?: number; spoons?: number; temperature?: number; sawCold?: boolean }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const int = (raw: unknown, fallback = 0) => (typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : fallback)

export const isSoluble = (substance: string) => substance === 'sugar' || substance === 'salt'
export const isSubstance = (substance: string): substance is Substance => ['sugar', 'salt', 'sand', 'chalk'].includes(substance)
export const isPieces = (pieces: string): pieces is Pieces => pieces === 'grains' || pieces === 'lumps'

/** Strokes needed in the qualitative rate model. Insoluble solids get four trial stirs and always remain. */
export function strokesNeeded(config: DissolvingConfig): number {
  if (config.task !== 'stir') return 0
  if (!isSoluble(config.substance)) return 4
  let n = config.substance === 'sugar' ? 6 : 5
  if (config.pieces === 'lumps') n += 3
  if (config.temperature === 40) n -= 1
  if (config.temperature === 60) n -= 2
  return Math.max(3, n)
}

export function strokeCount(config: DissolvingConfig, state: DissolvingState): number {
  return config.task === 'stir' ? clamp(int(state?.strokes), 0, strokesNeeded(config)) : 0
}

/** Grams still visible as solid, from the rules rather than the drawing. */
export function solidLeft(config: DissolvingConfig, state: DissolvingState): number {
  if (config.task === 'stir') {
    if (!isSoluble(config.substance)) return SOLUTE_G
    const left = SOLUTE_G * (1 - strokeCount(config, state) / strokesNeeded(config))
    return Math.round(left * 10) / 10
  }
  const spoons = spoonCount(config, state)
  return Math.round(Math.max(0, spoons * SPOON_G - capacityG(config, temperatureOf(config, state))) * 10) / 10
}

export const totalMass = () => WATER_IN_STIR_G + SOLUTE_G

/** Sucrose solubility, in grams in this beaker, using 204 and 288 g per 100 g water. */
export function capacityG(config: DissolvingConfig, temperature: number): number {
  if (config.task !== 'saturate') return Infinity
  const per100 = 204 + ((clamp(temperature, 20, 60) - 20) / 40) * (288 - 204)
  return (config.water * per100) / 100
}

/** The first whole spoonful that leaves some solid in cold water. */
export function coldSpoons(config: DissolvingConfig): number {
  if (config.task !== 'saturate') return 0
  return Math.floor(capacityG(config, 20) / SPOON_G) + 1
}

export function spoonCount(config: DissolvingConfig, state: DissolvingState): number {
  return config.task === 'saturate' ? clamp(int(state?.spoons), 0, coldSpoons(config)) : 0
}

export function temperatureOf(config: DissolvingConfig, state: DissolvingState): number {
  if (config.task === 'stir') return config.temperature
  const n = int(state?.temperature, 20)
  return TEMPERATURES.reduce((best, t) => (Math.abs(t - n) < Math.abs(best - n) ? t : best), 20)
}

export function sawColdLimit(config: DissolvingConfig, state: DissolvingState): boolean {
  return config.task === 'saturate' && (state?.sawCold === true || (temperatureOf(config, state) === 20 && spoonCount(config, state) >= coldSpoons(config)))
}

export function done(config: DissolvingConfig, state: DissolvingState): boolean {
  if (config.task === 'stir') return strokeCount(config, state) >= strokesNeeded(config)
  return sawColdLimit(config, state) && temperatureOf(config, state) === 60 && spoonCount(config, state) >= coldSpoons(config) && solidLeft(config, state) === 0
}

const grams = (n: number) => `${Number(n.toFixed(1))} g`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function working(config: DissolvingConfig, state: DissolvingState): string {
  if (config.task === 'stir') {
    const s = config.substance
    if (isSoluble(s)) {
      return `Yes. The ${s} has dissolved: its particles are spread through the water, too small to see. It did not melt or vanish. Water is the solvent, ${s} is the solute, and together they make a solution. The total mass is still ${totalMass()} g.`
    }
    return `The ${s} is still at the bottom after stirring, so it is insoluble in water. Stirring cannot make every solid dissolve. The total mass is still ${totalMass()} g: none of the ${s} has vanished.`
  }
  const cold = capacityG(config, 20)
  const warm = capacityG(config, 60)
  return `Yes. At 20 °C the water could dissolve ${grams(cold)} of sugar, so the rest stayed at the bottom: the solution was saturated. At 60 °C it can dissolve ${grams(warm)}, enough for all ${spoonCount(config, state) * SPOON_G} g. Warmer water can dissolve more sugar; this does not mean the sugar melted.`
}

export function madeText(config: DissolvingConfig, state: DissolvingState): string {
  if (config.task === 'stir') {
    const strokes = strokeCount(config, state)
    if (strokes === 0) return `Nothing has been stirred yet. All ${SOLUTE_G} g of ${config.substance} is still visible.`
    if (isSoluble(config.substance)) return `You stirred ${strokes} ${strokes === 1 ? 'time' : 'times'}; ${grams(solidLeft(config, state))} of ${config.substance} is still visible. Keep stirring until no solid is left.`
    return `You stirred ${strokes} ${strokes === 1 ? 'time' : 'times'}. Watch for the ${config.substance} to settle before deciding what happened.`
  }
  const added = spoonCount(config, state)
  if (added === 0) return 'No sugar has been added yet.'
  if (!sawColdLimit(config, state)) return `You added ${grams(added * SPOON_G)} of sugar, but have not yet made solid remain in the cold water. Cool it to 20 °C and add another spoonful if you can.`
  if (temperatureOf(config, state) !== 60) return `At ${temperatureOf(config, state)} °C there is still ${grams(solidLeft(config, state))} of sugar at the bottom. Warm the water and watch the solid.`
  return `There is still ${grams(solidLeft(config, state))} of sugar at the bottom. First see solid remain at 20 °C, then warm the water.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const numberOf = (raw: unknown): number | null | undefined => {
  if (raw === undefined) return undefined
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const m = raw.replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}

const TASKS: Record<string, DissolvingConfig['task']> = {
  stir: 'stir', stirring: 'stir', dissolve: 'stir', dissolving: 'stir', disappear: 'stir', test: 'stir', 'solubility-test': 'stir',
  'speed-up': 'stir', 'dissolve-faster': 'stir', 'faster-dissolving': 'stir', 'speed-of-dissolving': 'stir', 'rate-of-dissolving': 'stir',
  saturate: 'saturate', saturated: 'saturate', saturation: 'saturate', solubility: 'saturate', 'solubility-limit': 'saturate', limit: 'saturate', 'warm-water': 'saturate',
}
const SUBSTANCES: Record<string, Substance> = {
  sugar: 'sugar', sucrose: 'sugar', 'white-sugar': 'sugar', 'granulated-sugar': 'sugar',
  salt: 'salt', 'table-salt': 'salt', 'sodium-chloride': 'salt', nacl: 'salt',
  sand: 'sand', 'sand-grains': 'sand', silica: 'sand',
  chalk: 'chalk', 'chalk-powder': 'chalk', 'calcium-carbonate': 'chalk', caco3: 'chalk',
}
const PIECES: Record<string, Pieces> = {
  grains: 'grains', grain: 'grains', crystals: 'grains', powder: 'grains', powdered: 'grains', fine: 'grains', small: 'grains', 'small-pieces': 'grains',
  lumps: 'lumps', lump: 'lumps', cubes: 'lumps', cube: 'lumps', coarse: 'lumps', large: 'lumps', 'large-pieces': 'lumps', 'big-pieces': 'lumps',
}

function readSubstance(raw: unknown): string | null {
  if (raw === undefined) return 'sugar'
  if (typeof raw !== 'string') return null
  const k = keyOf(raw).replace(/-?(?:powder|crystals|grains|solid)$/, '')
  return has(SUBSTANCES, k) ? SUBSTANCES[k] : k
}
function readPieces(raw: unknown): string | null {
  if (raw === undefined) return 'grains'
  if (typeof raw !== 'string') return null
  const k = keyOf(raw)
  if (k === 'fine-powder' || k === 'fine-grains' || k === 'small-grains') return 'grains'
  if (k === 'large-lumps' || k === 'sugar-cubes') return 'lumps'
  return has(PIECES, k) ? PIECES[k] : k
}

export const goodPrompt = (config: DissolvingConfig) => {
  if (config.task === 'saturate') return 'Add 10 g spoonfuls until some sugar stays at the bottom of the cold water. Then use the temperature buttons to warm the water until no solid is left.'
  return `Drag the spoon sideways to stir, or use Stir once. ${isSoluble(config.substance) ? 'Keep going until no solid is left, and watch the total mass.' : 'Stir four times, then watch what settles at the bottom.'}`
}

export const dissolvingEngine: SceneEngine<DissolvingConfig, DissolvingState> = {
  id: 'dissolving',
  covers: ['dissolving', 'solubility', 'solute'],
  phrases: [
    'making solutions', 'making a solution', 'what is a solution', 'solutions and mixtures', 'mixtures and solutions', 'the solvent', 'solvents',
    'dissolve', 'dissolves', 'dissolved', 'soluble and insoluble', 'soluble or insoluble', 'soluble substances', 'insoluble substances', 'soluble solids', 'insoluble solids',
    'solute and solvent', 'solute solvent solution', 'solutes and solvents', 'saturated solution', 'saturated solutions', 'saturation', 'speeding up dissolving', 'faster dissolving',
    'rate of dissolving', 'rates of dissolving', 'dissolving faster', 'dissolving and mass', 'mass conserved dissolving', 'dissolving is not melting',
  ],
  notFor: [
    'weathering', 'limestone', 'equations', 'simultaneous', 'quadratic', 'inequalities', 'solvent front', 'gases dissolved', 'dissolved oxygen', 'blood plasma',
    'concentration', 'dilution', 'acids and pH', 'acids', 'pH scale', 'neutralisation', 'titration',
    'separating mixtures', 'filtration', 'filtering', 'evaporation', 'crystallisation', 'crystallization', 'distillation', 'chromatography',
    'states of matter', 'changes of state', 'melting and freezing', 'melting and boiling', 'diffusion',
    'rates of reaction', 'rate of reaction', 'reaction rates', 'collision theory', 'catalysts', 'chemical equilibrium', 'dynamic equilibrium', 'supersaturation', 'Ksp',
    'gas solubility', 'solubility of gases', 'Henry law', 'solutions of equations', 'solution equations',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const taskKey = keyOf(rawTask)
    if (taskKey && !has(TASKS, taskKey)) return null
    const substanceRaw = first(src, ['substance', 'material', 'solute', 'solid'])
    const waterRaw = first(src, ['water', 'waterMass', 'water_mass', 'waterAmount'])
    const task = taskKey ? TASKS[taskKey] : waterRaw !== undefined ? 'saturate' : substanceRaw !== undefined ? 'stir' : null
    if (!task) return null
    if (task === 'saturate') {
      const water = numberOf(waterRaw)
      if (water === null) return null
      return { task, water: water ?? 20 }
    }
    const substance = readSubstance(substanceRaw)
    const pieces = readPieces(first(src, ['pieces', 'pieceSize', 'piece_size', 'particleSize', 'size', 'form']))
    const temperature = numberOf(first(src, ['temperature', 'temp', 'waterTemperature']))
    if (substance === null || pieces === null || temperature === null) return null
    return { task, substance, pieces, temperature: temperature ?? 20 }
  },

  faults(config) {
    if (config.task === 'saturate') {
      if (!(WATERS as readonly number[]).includes(config.water)) {
        const nearest = WATERS.reduce((a, b) => (Math.abs(a - config.water) < Math.abs(b - config.water) ? a : b))
        return [`this experiment needs 15, 20, 25 or 30 g of water, not ${config.water} g (10 g cannot dissolve its cold spoonfuls even when warm): use e.g. water ${nearest}.`]
      }
      return []
    }
    const out: string[] = []
    if (!isSubstance(config.substance)) out.push(`"${config.substance}" is not a solid this card can draw: use sugar, salt, sand or chalk, e.g. substance "sugar".`)
    if (!(TEMPERATURES as readonly number[]).includes(config.temperature)) {
      const nearest = TEMPERATURES.reduce((a, b) => (Math.abs(a - config.temperature) < Math.abs(b - config.temperature) ? a : b))
      out.push(`the water temperature must be 20, 40 or 60 °C, not ${config.temperature} °C: use e.g. temperature ${nearest}.`)
    }
    if (!isPieces(config.pieces)) out.push(`"${config.pieces}" is not a piece size this card draws: use pieces "grains" or "lumps", e.g. pieces "grains".`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'stir') {
      const answer = isSoluble(config.substance)
        ? /\b(?:will|does|can|must)\s+dissolve\b|\bsoluble\b|\bparticles\s+(?:spread|break)\b|\bmass\s+(?:stays|is conserved|does not change)\b|\bnot\s+melt/i.test(text)
        : /\b(?:will|does|can)\s+not\s+dissolve\b|\b(?:doesn't|won't|cannot|can't)\s+dissolve\b|\binsoluble\b|\bwill\s+(?:stay|remain|settle)\b/i.test(text)
      const strokes = new RegExp(`\\b${strokesNeeded(config)}\\s+(?:stirs?|strokes?|times)\\b`, 'i').test(text)
      if (answer || strokes) out.push(`the prompt gives the result away, which the learner should find by stirring and watching the solid and mass -- ask for the action only ("${example}")`)
    } else {
      if (/\bsaturat|\bsolubility\b|\bmaximum\b|\bno more can\b|\bwarmer water (?:can )?dissolves? more\b|\bmore sugar dissolves\b|\b\d+\s+spoonfuls?\b/i.test(text)) {
        out.push(`the prompt gives away the limit or what warming does, which the learner should discover with the spoonfuls -- ask for the observations only ("${example}")`)
      }
    }
    if (/\bfilter|\bfiltration|\bevaporat|\bcrystalli[sz]|\bdistil|\bchromatograph|\btype (?:in|the)|\benter the\b|\bchoose\s+(?:soluble|insoluble)|\bdrag the temperature\b/i.test(text)) {
      out.push(`the prompt promises something this card does not do: it only stirs a solid or adds spoonfuls and changes temperature with buttons ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'stir' ? { strokes: 0 } : { spoons: 0, temperature: 20, sawCold: false }
  },

  check(config, state) {
    return { ok: done(config, state ?? {}), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'stir') return { strokes: strokesNeeded(config) }
    return { spoons: coldSpoons(config), temperature: 60, sawCold: true }
  },

  View: DissolvingView,

  prompt: `SCENE "dissolving" -- a real glass beaker of water on a quiet light panel, with a spoon, visible solid crystals, and live mass readouts. Two hands-on task kinds, both marked from exact rules, never the drawing.
  stir: the learner drags the spoon sideways (or presses Stir once / Space on the spoon). Each stroke visibly swirls the solid and changes the pile. Sugar and salt gradually disappear; sand and chalk swirl and settle again. The card always shows the mass of solid left and the fixed total mass. It never shows the needed stroke count or says soluble/insoluble before marking. Warmer configured water and grains rather than lumps take fewer strokes. This is a qualitative rate model, not a timer. After four strokes an insoluble solid can be checked: the experiment itself, not a quiz choice, gives the answer. On marking, a dissolved solid is named solute, water solvent and the mixture a solution; mass conservation and dissolving-not-melting are stated.
  saturate: the learner adds 10 g spoonfuls of sugar to cold water until a visible layer remains, then warms the same water with a temperature stepper (20, 40, 60 °C) until the layer disappears. Adding stops at the first spoonful that leaves a cold residue, so there is no dead end. Warming early is allowed; cooling again shows the residue. At 20 °C real sucrose capacities are used (about 204 g per 100 g water), and at 60 °C about 288 g per 100 g. Before marking the card says only sugar added, solid at bottom and temperature; it does not say saturated, solubility, the numerical capacity, or that warming will dissolve more. Marking gives those numbers and the explanation.
  For: dissolving, solute/solvent/solution, soluble and insoluble sugar/salt/sand/chalk, stirring/warmth/piece size affecting dissolving speed, conservation of mass on dissolving, solubility and saturated sugar solutions, more sugar dissolving in warmer water.
  Not for: concentration or dilution, acids/pH, separating mixtures, filtration, evaporation/crystallisation, states of matter or diffusion, reaction rates, gases, supersaturation, Ksp or equilibrium.
  config: { "task":"stir", "substance":"sugar"|"salt"|"sand"|"chalk", "temperature":20|40|60, "pieces":"grains"|"lumps" }
       or { "task":"saturate", "water":15|20|25|30 }  (grams; default 20)
  Prompts must name the gesture. Do not state the result, solubility category, number of stirs, saturation limit, mass conservation, or what warming does before the learner tries it.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the spoon sideways to stir, or use Stir once. Keep going until no solid is left, and watch the total mass.",
    "payload": { "engine":"dissolving", "config": { "task":"stir", "substance":"sugar", "temperature":20, "pieces":"grains" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:dissolving", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the spoon sideways to stir, or use Stir once. Stir four times, then watch what settles at the bottom.",
    "payload": { "engine":"dissolving", "config": { "task":"stir", "substance":"sand", "temperature":20, "pieces":"grains" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:dissolving", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Add 10 g spoonfuls until some sugar stays at the bottom of the cold water. Then use the temperature buttons to warm the water until no solid is left.",
    "payload": { "engine":"dissolving", "config": { "task":"saturate", "water":20 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:dissolving", "why":"..." } }`,
}

registerEngine(dissolvingEngine as SceneEngine<unknown, unknown>)
