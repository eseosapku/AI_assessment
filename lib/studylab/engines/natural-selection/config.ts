// lib/studylab/engines/natural-selection-kimi31/config.ts
//
// The learner IS the selection pressure. On bark, a tap sends a bird to eat that moth; in a Petri dish,
// a dose bursts the susceptible bacterial cells. Only then may the learner reproduce the survivors.
// The next population is computed from who survived, never from the drawing or a random roll.
//
// Model, deliberately small enough to see: ten organisms, one heritable visible variant, no new mutation
// during the task. Moth colour is inherited from the surviving adults in this simplified model; bacteria
// pass on their existing resistance. The resistant cells are present BEFORE treatment. Population sizes
// are restored to ten so the changing proportion, not exponential growth, is the observable.
// Sources and teaching decisions are in research.md. Cambridge 0610 wording: variation exists first;
// selection acts on individuals; survivors reproduce and pass on alleles; the population changes.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { NaturalSelectionView } from './View'

export const POPULATION = 10
export const HUNT_LIMIT = 4
export const DEFAULT_RESISTANT = 3

export type Bark = 'light' | 'dark'
export type MothColour = 'pale' | 'dark'
export type NaturalSelectionConfig =
  | { task: 'hunt'; bark: string }
  | { task: 'resistance'; resistant: number }

/** One shared state shape keeps stored work safe whichever task a card becomes. */
export type SelectionState = { eaten?: string[]; dose?: number; generation?: number }

const keyOf = (raw: unknown) => (typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : '')
const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)))

export const mothIds = () => Array.from({ length: POPULATION }, (_, i) => `m${i}`)
export const bacteriumIds = () => Array.from({ length: POPULATION }, (_, i) => `b${i}`)

/** Four dark and six pale parents. The ids, not their positions, carry the variation. */
export function parentColour(id: string): MothColour {
  const i = Number(id.replace(/^m/, ''))
  return Number.isInteger(i) && i >= 0 && i < 4 ? 'dark' : 'pale'
}

export function eatenOf(state: SelectionState | null | undefined): string[] {
  if (!state || !Array.isArray(state.eaten)) return []
  const valid = mothIds().filter((id) => state.eaten!.includes(id))
  return valid.slice(0, POPULATION)
}

export const generationOf = (state: SelectionState | null | undefined) =>
  state && Number.isInteger(state.generation) && (state.generation ?? 0) > 0 ? 1 : 0
export const doseOf = (state: SelectionState | null | undefined) =>
  state && Number.isFinite(state.dose) && (state.dose ?? 0) > 0 ? 1 : 0

export function barkOf(config: Extract<NaturalSelectionConfig, { task: 'hunt' }>): Bark {
  return config.bark === 'dark' ? 'dark' : 'light'
}

/** The contrasting moths are the visible ones on this bark. */
export const easiestColour = (config: Extract<NaturalSelectionConfig, { task: 'hunt' }>): MothColour =>
  barkOf(config) === 'dark' ? 'pale' : 'dark'

function countColours(ids: string[]): { pale: number; dark: number } {
  return {
    pale: ids.filter((id) => parentColour(id) === 'pale').length,
    dark: ids.filter((id) => parentColour(id) === 'dark').length,
  }
}

/** Largest-remainder shares of ten offspring, with the survivors' colours inherited. */
export function offspringColourCounts(eaten: string[]): { pale: number; dark: number } {
  const survivors = mothIds().filter((id) => !eaten.includes(id))
  if (!survivors.length) return { pale: 0, dark: 0 }
  const have = countColours(survivors)
  const paleExact = (have.pale * POPULATION) / survivors.length
  const darkExact = (have.dark * POPULATION) / survivors.length
  let pale = Math.floor(paleExact)
  let dark = Math.floor(darkExact)
  const left = POPULATION - pale - dark
  const paleFirst = paleExact - pale >= darkExact - dark
  pale += paleFirst ? left : 0
  dark += paleFirst ? 0 : left
  return { pale, dark }
}

/** Interleave survivors' descendants through the plate, never two colour clouds. */
const OFFSPRING_ORDER = [0, 3, 6, 9, 2, 5, 8, 1, 4, 7]
export function offspringColours(config: Extract<NaturalSelectionConfig, { task: 'hunt' }>, state: SelectionState): MothColour[] {
  if (!generationOf(state)) return mothIds().map(parentColour)
  const target = offspringColourCounts(eatenOf(state))
  const out = Array.from({ length: POPULATION }, () => 'pale' as MothColour)
  OFFSPRING_ORDER.slice(0, target.dark).forEach((slot) => { out[slot] = 'dark' })
  return out
}

/** A fixed permutation keeps resistant cells apart rather than making one coloured clump. */
const CELL_ORDER = [0, 5, 2, 8, 1, 6, 3, 9, 4, 7]
export function resistantNow(config: Extract<NaturalSelectionConfig, { task: 'resistance' }>): number {
  return clampInt(Number.isFinite(config.resistant) ? config.resistant : DEFAULT_RESISTANT, 1, POPULATION - 1)
}

export function cellResistant(config: Extract<NaturalSelectionConfig, { task: 'resistance' }>, id: string): boolean {
  const index = Number(id.replace(/^b/, ''))
  return CELL_ORDER.indexOf(index) >= 0 && CELL_ORDER.indexOf(index) < resistantNow(config)
}

/** The treatment never converts a cell: susceptible cells die, resistant ones survive. */
export function cellAlive(config: Extract<NaturalSelectionConfig, { task: 'resistance' }>, id: string, state: SelectionState): boolean {
  return !doseOf(state) || cellResistant(config, id)
}

/** After reproduction every vacant place receives a survivor's resistant descendant. */
export function offspringResistant(config: Extract<NaturalSelectionConfig, { task: 'resistance' }>, id: string, state: SelectionState): boolean {
  return generationOf(state) ? true : cellResistant(config, id)
}

export function countsNow(config: NaturalSelectionConfig, state: SelectionState): { pale: number; dark: number; resistant: number; susceptible: number; alive: number } {
  if (config.task === 'hunt') {
    if (generationOf(state)) {
      const next = offspringColourCounts(eatenOf(state))
      return { ...next, resistant: 0, susceptible: 0, alive: POPULATION }
    }
    const left = countColours(mothIds().filter((id) => !eatenOf(state).includes(id)))
    return { ...left, resistant: 0, susceptible: 0, alive: POPULATION - eatenOf(state).length }
  }
  if (generationOf(state)) return { pale: 0, dark: 0, resistant: POPULATION, susceptible: 0, alive: POPULATION }
  const resistant = bacteriumIds().filter((id) => cellAlive(config, id, state) && cellResistant(config, id)).length
  const alive = bacteriumIds().filter((id) => cellAlive(config, id, state)).length
  return { pale: 0, dark: 0, resistant, susceptible: alive - resistant, alive }
}

export function huntCorrect(config: Extract<NaturalSelectionConfig, { task: 'hunt' }>, state: SelectionState): boolean {
  const eaten = eatenOf(state)
  return eaten.length === HUNT_LIMIT && generationOf(state) === 1 && eaten.every((id) => parentColour(id) === easiestColour(config))
}

export function done(config: NaturalSelectionConfig, state: SelectionState): boolean {
  return config.task === 'hunt' ? huntCorrect(config, state) : doseOf(state) === 1 && generationOf(state) === 1
}

const say = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function working(config: NaturalSelectionConfig, state: SelectionState): string {
  const counts = countsNow(config, state)
  if (config.task === 'resistance') {
    return `Yes. The antibiotic killed the susceptible bacteria. The resistant bacteria were already present; they survived and reproduced, so all ${POPULATION} bacteria in the next generation are resistant. The antibiotic selected resistance — it did not create it.`
  }
  const visible = easiestColour(config)
  const better = visible === 'pale' ? 'dark' : 'pale'
  return `Yes. The ${visible} moths were easier for the bird to spot on ${barkOf(config)} bark. More ${better} moths survived and passed on their colour: the next generation has ${say(counts[better], `${better} moth`, `${better} moths`)} out of ${POPULATION}. The population changed; individual moths did not change colour.`
}

export function madeText(config: NaturalSelectionConfig, state: SelectionState): string {
  if (config.task === 'resistance') {
    if (!doseOf(state)) return 'The bacteria are untreated. Give the dose to see which cells survive.'
    if (!generationOf(state)) return `${say(countsNow(config, state).alive, 'bacterium', 'bacteria')} survived the dose. Let them reproduce to make the next generation.`
    return 'The dish shows the generation after treatment.'
  }
  const eaten = eatenOf(state)
  if (eaten.length !== HUNT_LIMIT) return `You ate ${say(eaten.length, 'moth')}. Eat exactly ${HUNT_LIMIT}, then let the survivors reproduce.`
  if (!generationOf(state)) return `You ate ${HUNT_LIMIT} moths. Their survivors have not reproduced yet.`
  const had = countColours(eaten)
  const next = offspringColourCounts(eaten)
  return `You ate ${say(had.pale, 'pale moth')} and ${say(had.dark, 'dark moth')}. Their offspring are ${next.pale} pale and ${next.dark} dark. The easiest moths for a bird to spot are those with more contrast against the bark.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's semantic config. Unknown values parse, then faults gives a usable nearby example.

const TASKS: Record<string, NaturalSelectionConfig['task']> = {
  hunt: 'hunt', moths: 'hunt', moth: 'hunt', 'peppered-moth': 'hunt', 'peppered-moths': 'hunt', predation: 'hunt', predator: 'hunt', bird: 'hunt', camouflage: 'hunt', bark: 'hunt', 'natural-selection': 'hunt',
  resistance: 'resistance', antibiotic: 'resistance', antibiotics: 'resistance', 'antibiotic-resistance': 'resistance', bacteria: 'resistance', bacterial: 'resistance', dish: 'resistance', 'petri-dish': 'resistance', superbugs: 'resistance',
}
const BARKS: Record<string, Bark> = {
  light: 'light', pale: 'light', birch: 'light', clean: 'light', unpolluted: 'light', lichen: 'light', 'light-bark': 'light', 'clean-bark': 'light', 'clean-birch': 'light', 'pale-birch': 'light', 'lichen-covered': 'light', 'pale-lichen-covered': 'light',
  dark: 'dark', soot: 'dark', sooty: 'dark', polluted: 'dark', pollution: 'dark', 'dark-bark': 'dark', 'soot-darkened': 'dark', 'soot-dark': 'dark',
}
function readCount(raw: unknown): number | null {
  if (raw === undefined) return DEFAULT_RESISTANT
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*(?:resistant\s*)?(?:bacteria|cells)?$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

function examplePrompt(config: NaturalSelectionConfig): string {
  return config.task === 'hunt'
    ? `On ${barkOf(config) === 'dark' ? 'soot-dark' : 'pale lichen-covered'} bark, be the bird. Tap ${HUNT_LIMIT} moths to eat them, then let the survivors reproduce. Eat the four that are easiest to spot.`
    : 'Tap the antibiotic dose, then let the survivors reproduce. Watch what the next generation is made of.'
}

export const naturalSelectionEngine: SceneEngine<NaturalSelectionConfig, SelectionState> = {
  id: 'natural-selection',
  covers: ['evolution', 'evolutionary', 'antibiotics', 'adaptation', 'camouflage'],
  phrases: [
    'natural selection', 'survival of the fittest', 'selection pressure', 'selection pressures', 'antibiotic resistance', 'antimicrobial resistance', 'resistant bacteria', 'bacterial resistance',
    'variation in a population', 'variation within a population', 'population variation', 'populations evolve', 'evolution of populations', 'allele frequency', 'changing allele frequency',
    'peppered moth', 'peppered moths', 'industrial melanism', 'natural selection in moths', 'adaptation by natural selection', 'adaptation and natural selection', 'natural selection and adaptation',
  ],
  notFor: [
    'punnett', 'monohybrid', 'genetic cross', 'genetic crosses', 'genetic diagram', 'genetic diagrams', 'history of life', 'classification key', 'classification keys', 'dichotomous', 'probability', 'dice',
    'selective breeding', 'artificial selection', 'continuous variation', 'discontinuous variation', 'hydrophytes', 'xerophytes', 'desert animals', 'arctic animals', 'antibiotic prescribing',
    'electrical resistance', 'resistance in circuits', 'resistors', 'air resistance', 'antibiotic immunity', 'immune response',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawBark = first(src, ['bark', 'environment', 'tree', 'woodland', 'background'])
    const rawResistant = first(src, ['resistant', 'resistance', 'initialResistant', 'resistantCells'])
    const word = keyOf(rawTask)
    const inferred = rawBark !== undefined ? 'hunt' : rawResistant !== undefined ? 'resistance' : null
    const task = word ? (has(TASKS, word) ? TASKS[word] : null) : inferred
    if (!task) return null
    if (task === 'hunt') {
      if (rawBark !== undefined && typeof rawBark !== 'string') return null
      const b = keyOf(rawBark === undefined ? 'light' : rawBark)
      return { task, bark: has(BARKS, b) ? BARKS[b] : b || 'light' }
    }
    const resistant = readCount(rawResistant)
    return resistant === null ? null : { task, resistant }
  },

  faults(config) {
    if (config.task === 'hunt') {
      return has(BARKS, config.bark) || config.bark === 'light' || config.bark === 'dark'
        ? []
        : [`There is no "${config.bark}" bark drawn here: use light (clean, lichen-covered) or dark (sooty, polluted), e.g. bark "dark".`]
    }
    if (!Number.isInteger(config.resistant) || config.resistant < 1 || config.resistant > POPULATION - 3) {
      return [`${config.resistant} resistant bacteria would not leave a clear selection and reproduction event: use 1 to ${POPULATION - 3}, so at least one survives and at least three are susceptible, e.g. resistant ${DEFAULT_RESISTANT}.`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const out: string[] = []
    const example = examplePrompt(config)
    if (config.task === 'hunt') {
      const colourAnswer = /\b(?:pale|light|white|dark|black)\s+moths?\b[\s\S]{0,55}\b(?:eat|eaten|spot|seen|visible|surviv|camouflag|easier|easiest|better|best)\b|\b(?:eat|spot|seen|visible|surviv|camouflag|easier|easiest|better|best)\b[\s\S]{0,55}\b(?:pale|light|white|dark|black)\s+moths?\b/i.test(prompt)
      if (colourAnswer || /\b\d+\s+(?:pale|dark)\b|\b(?:pale|dark)\s+(?:survivors?|offspring)\b|\ball\s+(?:pale|dark)\b/i.test(prompt)) {
        out.push(`the prompt gives the answer away: it says which colour to eat, survives or increases, which the learner must discover by hunting -- ask for the easiest to spot only ("${example}")`)
      }
    } else if (/\bresistant\s+(?:bacteria\s+)?surviv|\bsusceptible\s+(?:bacteria\s+)?(?:die|are killed)|\ball\s+(?:ten|10|\d+)\s+(?:are\s+)?resistant|\bresistance\s+(?:was|is)\s+already|\bdoes\s+not\s+create|\bselects?\s+resistance/i.test(prompt)) {
      out.push(`the prompt gives the answer away: it says which cells survive or what the next generation contains, which the dish shows after the learner acts -- ask for the treatment and reproduction only ("${example}")`)
    }
    if (/\bdrag\b|\btimed?\b|\bseconds?\b|\bPunnett\b|\bgenotype\b|\bselective breeding\b|\bartificial selection\b|\bnew mutation\b|\bmake (?:a |the )?mutation\b|\bgraph\b|\bdice\b/i.test(prompt)) {
      out.push(`the prompt promises something the card does not show: this is an untimed tap-and-watch population model with no crosses, new mutations, graphs or breeding choices -- ask for the gestures it has ("${example}")`)
    }
    return out
  },

  initial: () => ({ eaten: [], dose: 0, generation: 0 }),
  check(config, state) {
    const safe = state ?? {}
    if (done(config, safe)) return { ok: true, wrongIds: [] }
    if (config.task === 'hunt') {
      const eaten = eatenOf(safe)
      return { ok: false, wrongIds: !generationOf(safe) ? ['generation'] : eaten.length !== HUNT_LIMIT || !eaten.every((id) => parentColour(id) === easiestColour(config)) ? ['moths'] : ['generation'] }
    }
    return { ok: false, wrongIds: [!doseOf(safe) ? 'dose' : 'generation'] }
  },
  solve(config) {
    if (config.task === 'resistance') return { eaten: [], dose: 1, generation: 1 }
    const eaten = mothIds().filter((id) => parentColour(id) === easiestColour(config)).slice(0, HUNT_LIMIT)
    return { eaten, dose: 0, generation: 1 }
  },

  View: NaturalSelectionView,

  prompt: `SCENE "natural-selection" -- the learner applies a selection pressure to ten countable organisms on a quiet light picture panel, then reproduces the survivors and sees the population change.
  hunt: real pale and dark peppered moths rest on pale lichen-covered or soot-dark tree bark. Tap a moth and the bird flies to it and eats it. Eat four; then "Let survivors reproduce" replaces the parents with ten offspring whose colours come only from the survivors. The aim is to eat the four easiest to spot. No timer, score, dragging or randomness. A wrong hunt still produces offspring, so its consequence can be read. config { "task":"hunt", "bark":"light"|"dark" }.
  resistance: ten large bacterial cells in a glass Petri dish, some with gold centres (resistant) and some blue (susceptible), named on the card. Tap "Give antibiotic dose": an antibiotic drop enters and the susceptible cells crack and fade while the resistant cells remain. Then "Let survivors reproduce" refills all ten places with resistant descendants. The resistance is visibly present before treatment. config { "task":"resistance", "resistant":1 to 7, default 3 } (the number initially resistant).
  For: natural selection, survival of the fittest, selection pressure, variation within a population, camouflage and adaptation, peppered moths, antibiotic resistance, and why populations rather than individuals evolve. It answers "organisms change because they need to" and "antibiotics make bacteria resistant". This simplified model holds population size at ten and shows inherited visible variants, not molecular alleles.
  Not drawn: Punnett squares or genetic crosses, selective breeding or choosing parents, continuous/discontinuous variation graphs, hydrophyte/xerophyte features, new mutations during the task, horizontal gene transfer, antibiotic dosing courses, or a history-of-life timeline. Do not use it for those.
  Before marking the card shows the organisms, their visible variants, what is eaten or killed, and the offspring produced. It does not say which moths are easiest, what the offspring should be, or that resistance was selected. Marking says what the learner made and why. Prompts must give the tap gestures and aim, but NOT which moth colour to eat or which survives, the offspring counts, or that the antibiotic selects existing resistance. No drag or timed challenge.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"On soot-dark bark, be the bird. Tap 4 moths to eat them, then let the survivors reproduce. Eat the four that are easiest to spot.",
    "payload": { "engine":"natural-selection", "config": { "task":"hunt", "bark":"dark" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:natural-selection", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"On pale lichen-covered bark, be the bird. Tap 4 moths to eat them, then let the survivors reproduce. Eat the four that are easiest to spot.",
    "payload": { "engine":"natural-selection", "config": { "task":"hunt", "bark":"light" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:natural-selection", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the antibiotic dose, then let the survivors reproduce. Watch what the next generation is made of.",
    "payload": { "engine":"natural-selection", "config": { "task":"resistance", "resistant":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:natural-selection", "why":"..." } }`,
}

registerEngine(naturalSelectionEngine as SceneEngine<unknown, unknown>)
