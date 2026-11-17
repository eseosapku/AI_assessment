// lib/studylab/engines/food-tests/config.ts
//
// A small virtual food-test practical. The learner adds a reagent to a prepared food extract, works through the
// real stages, and reads the tube. In `test` they answer one nutrient question; in `identify` they run all five
// tests and select every nutrient found. Completed observations stay on the card when the reagent changes.
//
// Science: Practical Science's IGCSE food-test method and analysis (iodine orange-brown -> blue-black; Benedict's,
// heated at 80 C in a water bath, blue -> green/yellow/orange/brick-red; Biuret blue -> purple; ethanol followed by
// water -> a cloudy white emulsion). It also stresses that Benedict's detects reducing sugars, not glucose uniquely,
// and that its colour is only semi-quantitative. https://practical-science.com/2023/04/16/investigating-the-presence-of-starch-glucose-protein-and-fat-in-food-sample-igcse-prescribed-practical/
// DCPIP blue -> colourless is the Cambridge 0610 vitamin-C observation. No flame is drawn: the school method uses an
// electric water bath, and ethanol is flammable. Sugar levels here describe prepared teaching samples, not assays of
// every shop-bought food with the same name.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { FoodTestsView } from './View'

export const PANEL_WIDTH = 360
export const PANEL_HEIGHT = 200

export const NUTRIENTS = ['starch', 'reducing-sugar', 'protein', 'fat', 'vitamin-c'] as const
export type Nutrient = (typeof NUTRIENTS)[number]
export const REAGENTS = ['iodine', 'benedict', 'biuret', 'ethanol', 'dcpip'] as const
export type Reagent = (typeof REAGENTS)[number]

export type Sample = {
  /** On the sample tube and in the prompt, never a clue by itself. */
  name: string
  /** Kept as strings while reading, so faults can name an unsupported entry. */
  nutrients: string[]
  /** 0 none, 1 green, 2 yellow, 3 orange, 4 brick-red. */
  sugar: number
}
export type FoodConfig =
  | { task: 'test'; nutrient: string; sample: Sample }
  | { task: 'identify'; sample: Sample }

export type FoodState = {
  reagent?: string
  /** A stage for each reagent, retained while another tube is being tested. */
  stages?: Record<string, number>
  answer?: boolean | null
  found?: string[]
}

export const NUTRIENT_NAMES: Record<Nutrient, string> = {
  starch: 'starch',
  'reducing-sugar': 'reducing sugar',
  protein: 'protein',
  fat: 'fat',
  'vitamin-c': 'vitamin C',
}
export const REAGENT_NAMES: Record<Reagent, string> = {
  iodine: 'Iodine',
  benedict: "Benedict's",
  biuret: 'Biuret',
  ethanol: 'Ethanol',
  dcpip: 'DCPIP',
}
export const REAGENT_FOR: Record<Nutrient, Reagent> = {
  starch: 'iodine',
  'reducing-sugar': 'benedict',
  protein: 'biuret',
  fat: 'ethanol',
  'vitamin-c': 'dcpip',
}
const NUTRIENT_FOR = Object.fromEntries(REAGENTS.map((r) => [r, NUTRIENTS.find((n) => REAGENT_FOR[n] === r)!])) as Record<Reagent, Nutrient>
export const nutrientFor = (reagent: Reagent): Nutrient => NUTRIENT_FOR[reagent]

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const isNutrient = (v: string): v is Nutrient => has(NUTRIENT_NAMES, v)
const isReagent = (v: string): v is Reagent => has(REAGENT_NAMES, v)
export const safeNutrient = (v: string): Nutrient => (isNutrient(v) ? v : 'starch')
export const safeReagent = (v: unknown): Reagent => (typeof v === 'string' && isReagent(v) ? v : 'iodine')

/** The five canonical final appearances, from the actual sample data. */
export function positive(sample: Sample, nutrient: Nutrient): boolean {
  if (nutrient === 'reducing-sugar') return sample.sugar >= 1 && sample.sugar <= 4
  return sample.nutrients.includes(nutrient)
}
export function sampleNutrients(sample: Sample): Nutrient[] {
  return NUTRIENTS.filter((n) => positive(sample, n))
}

export const SUGAR_COLOURS = ['blue', 'green', 'yellow', 'orange', 'brick-red'] as const
export const SUGAR_AMOUNTS = ['no reducing sugar', 'a trace of reducing sugar', 'a little reducing sugar', 'a moderate amount of reducing sugar', 'a lot of reducing sugar'] as const
export const sugarLevel = (sample: Sample) => Math.max(0, Math.min(4, Math.round(Number.isFinite(sample.sugar) ? sample.sugar : 0)))

/** What the liquid looks like at a stage. Nothing here says positive or negative. */
export function observation(sample: Sample, reagent: Reagent, stage: number): string {
  if (stage <= 0) return reagent === 'dcpip' ? 'blue DCPIP, before extract' : 'pale food extract'
  if (reagent === 'iodine') return positive(sample, 'starch') ? 'blue-black' : 'orange-brown'
  if (reagent === 'biuret') return positive(sample, 'protein') ? 'purple' : 'blue'
  if (reagent === 'dcpip') return positive(sample, 'vitamin-c') ? 'colourless' : 'blue'
  if (reagent === 'benedict') {
    if (stage === 1) return 'blue, before heating'
    if (stage === 2) return 'warming at 80 °C'
    return SUGAR_COLOURS[sugarLevel(sample)]
  }
  if (stage === 1) return 'clear, before water'
  return positive(sample, 'fat') ? 'cloudy white' : 'clear'
}

/** The appearance used to colour the liquid while Benedict's is still in the bath. */
export function liquidColour(sample: Sample, reagent: Reagent, stage: number): string {
  if (stage <= 0) return '#E9E5D5'
  if (reagent === 'iodine') return positive(sample, 'starch') ? '#18243D' : '#B86B2E'
  if (reagent === 'biuret') return positive(sample, 'protein') ? '#8754A3' : '#347EB5'
  if (reagent === 'dcpip') return positive(sample, 'vitamin-c') ? '#EEF3F1' : '#2C69A5'
  if (reagent === 'benedict') {
    if (stage < 2) return '#2C79B5'
    return ['#2C79B5', '#508B5B', '#D4B83E', '#D98235', '#A74732'][sugarLevel(sample)]
  }
  if (stage >= 2 && positive(sample, 'fat')) return '#E3E8E5'
  return '#EAF1F2'
}

export const finalStage = (reagent: Reagent) => (reagent === 'benedict' ? 3 : reagent === 'ethanol' ? 2 : 1)
export const stageOf = (state: FoodState | null | undefined, reagent: Reagent) => {
  const n = state?.stages?.[reagent]
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(finalStage(reagent), Math.floor(n))) : 0
}
export const completed = (state: FoodState | null | undefined, reagent: Reagent) => stageOf(state, reagent) === finalStage(reagent)
export const selectedNutrients = (state: FoodState | null | undefined): Nutrient[] =>
  NUTRIENTS.filter((n) => Array.isArray(state?.found) && state.found.includes(n))

/** Stage names are printed by the view, so a process never jumps to its end. */
export function actionName(reagent: Reagent, stage: number): string {
  if (stage >= finalStage(reagent)) return 'Fresh tube'
  if (reagent === 'dcpip') return 'Add food extract'
  if (reagent === 'benedict') return ['Add Benedict’s', 'Heat in water bath', 'Lift out & observe'][stage]
  if (reagent === 'ethanol') return stage === 0 ? 'Add ethanol' : 'Add water'
  return `Add ${REAGENT_NAMES[reagent]}`
}
export function stageName(reagent: Reagent, stage: number): string {
  if (stage >= finalStage(reagent)) return 'Result recorded'
  if (reagent === 'benedict') return ['Next: add reagent', 'Next: heat gently', 'Next: read the tube'][stage]
  if (reagent === 'ethanol') return stage === 0 ? 'Next: add ethanol' : 'Next: add water'
  if (reagent === 'dcpip') return 'Next: add extract'
  return 'Next: add reagent'
}

// ---------------------------------------------------------------------------
// Prepared samples. Custom samples let the tutor make an honestly arbitrary unknown without implying a food assay.

const PREPARED: Record<string, Sample> = {
  water: { name: 'water', nutrients: [], sugar: 0 },
  'starch-solution': { name: 'starch solution', nutrients: ['starch'], sugar: 0 },
  'glucose-solution': { name: 'glucose solution', nutrients: ['reducing-sugar'], sugar: 3 },
  albumin: { name: 'albumin solution', nutrients: ['protein'], sugar: 0 },
  'egg-white': { name: 'egg-white extract', nutrients: ['protein'], sugar: 0 },
  oil: { name: 'oil extract', nutrients: ['fat'], sugar: 0 },
  potato: { name: 'potato extract', nutrients: ['starch'], sugar: 0 },
  milk: { name: 'milk extract', nutrients: ['protein', 'fat', 'reducing-sugar'], sugar: 1 },
  'orange-juice': { name: 'orange juice', nutrients: ['reducing-sugar', 'vitamin-c'], sugar: 2 },
  'apple-juice': { name: 'apple juice', nutrients: ['reducing-sugar', 'vitamin-c'], sugar: 3 },
}
export const SAMPLE_NAMES = Object.keys(PREPARED)

const keyOf = (raw: unknown) => (typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const SAMPLE_WORDS: Record<string, string> = {
  water: 'water', 'distilled-water': 'water', control: 'water',
  starch: 'starch-solution', 'starch-solution': 'starch-solution', 'starch-suspension': 'starch-solution',
  glucose: 'glucose-solution', 'glucose-solution': 'glucose-solution', sugar: 'glucose-solution',
  albumin: 'albumin', 'albumin-solution': 'albumin', protein: 'albumin', 'protein-solution': 'albumin',
  egg: 'egg-white', 'egg-white': 'egg-white', 'egg-white-solution': 'egg-white',
  oil: 'oil', 'olive-oil': 'oil', 'vegetable-oil': 'oil', fat: 'oil',
  potato: 'potato', 'potato-extract': 'potato', bread: 'potato',
  milk: 'milk', 'milk-extract': 'milk',
  orange: 'orange-juice', 'orange-juice': 'orange-juice',
  apple: 'apple-juice', 'apple-juice': 'apple-juice',
}
const NUTRIENT_WORDS: Record<string, Nutrient> = {
  starch: 'starch', amylose: 'starch',
  sugar: 'reducing-sugar', sugars: 'reducing-sugar', 'reducing-sugar': 'reducing-sugar', 'reducing-sugars': 'reducing-sugar', glucose: 'reducing-sugar', maltose: 'reducing-sugar', lactose: 'reducing-sugar', benedict: 'reducing-sugar', benedicts: 'reducing-sugar',
  protein: 'protein', proteins: 'protein', biuret: 'protein',
  fat: 'fat', fats: 'fat', lipid: 'fat', lipids: 'fat', oil: 'fat', ethanol: 'fat', emulsion: 'fat',
  'vitamin-c': 'vitamin-c', 'ascorbic-acid': 'vitamin-c', dcpip: 'vitamin-c',
}
const TASK_WORDS: Record<string, FoodConfig['task']> = {
  test: 'test', 'single-test': 'test', 'food-test': 'test', 'read-result': 'test', result: 'test', observe: 'test', 'test-nutrient': 'test',
  identify: 'identify', 'identify-nutrients': 'identify', unknown: 'identify', 'unknown-food': 'identify', 'food-analysis': 'identify', 'all-tests': 'identify', investigate: 'identify',
}
const SUGAR_WORDS: Record<string, number> = { none: 0, negative: 0, trace: 1, green: 1, low: 2, little: 2, yellow: 2, moderate: 3, medium: 3, orange: 3, high: 4, lots: 4, 'brick-red': 4, red: 4 }

function readSugar(raw: unknown): number | null {
  if (raw === undefined) return 0
  if (typeof raw === 'string') {
    const key = keyOf(raw)
    if (has(SUGAR_WORDS, key)) return SUGAR_WORDS[key]
    const m = key.match(/^([0-4])$/)
    return m ? Number(m[1]) : null
  }
  return typeof raw === 'number' && Number.isFinite(raw) ? raw + 0 : null
}

function readNutrientList(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return []
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,;+]|\band\b/i) : null
  if (!list) return null
  const out: string[] = []
  for (const item of list) {
    const key = keyOf(item)
    if (!key || ['none', 'nothing'].includes(key)) continue
    const nutrient = has(NUTRIENT_WORDS, key) ? NUTRIENT_WORDS[key] : key
    if (!out.includes(nutrient)) out.push(nutrient)
  }
  return out
}

function readSample(raw: unknown, contains: unknown, sugarRaw: unknown): Sample | null {
  if (raw !== undefined && typeof raw !== 'string' && typeof raw !== 'object') return null
  const object = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null
  const sugar = readSugar(object ? first(object, ['sugar', 'sugarLevel', 'level', 'concentration']) : sugarRaw)
  if (sugar === null) return null
  if (!object) {
    const given = raw === undefined ? 'potato' : raw
    if (typeof given !== 'string') return null
    const key = keyOf(given)
    const known = has(SAMPLE_WORDS, key) ? PREPARED[SAMPLE_WORDS[key]] : null
    if (known) {
      const extra = readNutrientList(contains)
      if (extra === null) return null
      return extra.length || sugarRaw !== undefined
        ? { name: known.name, nutrients: extra, sugar }
        : { ...known, nutrients: [...known.nutrients] }
    }
    const custom = readNutrientList(contains)
    if (custom === null) return null
    return { name: String(given).trim().replace(/\s+/g, ' ') || 'Food A', nutrients: custom.length || sugarRaw !== undefined ? custom : ['unknown'], sugar }
  }
  if (object.sample !== undefined || object.food !== undefined) return null
  const rawName = first(object, ['name', 'label'])
  if (rawName !== undefined && typeof rawName !== 'string' && typeof rawName !== 'number') return null
  const nutrients = readNutrientList(first(object, ['contains', 'nutrients', 'nutrientsPresent']) ?? contains)
  if (nutrients === null) return null
  return { name: String(rawName ?? 'Food A').trim().replace(/\s+/g, ' ') || 'Food A', nutrients, sugar }
}

function readNutrient(raw: unknown): string {
  if (raw === undefined) return 'starch'
  const key = keyOf(raw)
  return has(NUTRIENT_WORDS, key) ? NUTRIENT_WORDS[key] : key
}

const safeSample = (sample: Sample): Sample => ({
  name: typeof sample.name === 'string' && sample.name ? sample.name : 'Food A',
  nutrients: Array.isArray(sample.nutrients) ? sample.nutrients.filter((n): n is Nutrient => typeof n === 'string' && isNutrient(n)) : [],
  sugar: Number.isFinite(sample.sugar) ? Math.max(0, Math.min(4, Math.round(sample.sugar))) : 0,
})

export function working(config: FoodConfig, state: FoodState): string {
  const sample = safeSample(config.sample)
  if (config.task === 'identify') {
    const found = sampleNutrients(sample)
    if (!found.length) return 'Yes. All five results are negative: no tested nutrient was detected. An unchanged colour is useful evidence.'
    const list = found.map((n) => NUTRIENT_NAMES[n]).join(' and ')
    const sugar = positive(sample, 'reducing-sugar') ? ` Benedict’s ${SUGAR_COLOURS[sugarLevel(sample)]} means ${SUGAR_AMOUNTS[sugarLevel(sample)]}.` : ''
    return `Yes. The results show ${list}.${sugar}`
  }
  const nutrient = safeNutrient(config.nutrient)
  const reagent = REAGENT_FOR[nutrient]
  const seen = observation(sample, reagent, finalStage(reagent))
  const present = positive(sample, nutrient)
  if (nutrient === 'reducing-sugar') {
    return present
      ? `Yes. Benedict’s turned ${seen} after heating, which means ${SUGAR_AMOUNTS[sugarLevel(sample)]}. The colour estimates the amount; it does not measure an exact concentration.`
      : 'Yes. Benedict’s stayed blue after heating, so no reducing sugar was detected. An unchanged colour is a negative result, not a failed test.'
  }
  const changes: Record<Exclude<Nutrient, 'reducing-sugar'>, string> = {
    starch: 'Iodine turned blue-black',
    protein: 'Biuret turned purple',
    fat: 'The ethanol and water made a cloudy white emulsion',
    'vitamin-c': 'The blue DCPIP became colourless',
  }
  const negatives: Record<Exclude<Nutrient, 'reducing-sugar'>, string> = {
    starch: 'Iodine stayed orange-brown',
    protein: 'Biuret stayed blue',
    fat: 'The ethanol and water stayed clear',
    'vitamin-c': 'DCPIP stayed blue',
  }
  return `Yes. ${present ? changes[nutrient] : negatives[nutrient]}, so ${NUTRIENT_NAMES[nutrient]} ${present ? 'is present' : 'was not detected'}.`
}

export function madeText(config: FoodConfig, state: FoodState): string {
  const sample = safeSample(config.sample)
  if (config.task === 'identify') {
    const missing = REAGENTS.filter((r) => !completed(state, r))
    if (missing.length) return `You have ${REAGENTS.length - missing.length} of ${REAGENTS.length} completed results. Finish ${missing.map((r) => REAGENT_NAMES[r]).join(', ')} before concluding; one test cannot speak for the others.`
    const chosen = selectedNutrients(state)
    const list = chosen.length ? chosen.map((n) => NUTRIENT_NAMES[n]).join(', ') : 'no nutrients'
    return `You selected ${list}. Read each recorded appearance again: a colour change or cloudy emulsion is evidence for that test’s nutrient; an unchanged reagent colour is not.`
  }
  const nutrient = safeNutrient(config.nutrient)
  const reagent = REAGENT_FOR[nutrient]
  if (!completed(state, reagent)) {
    const current = safeReagent(state.reagent)
    return current === reagent
      ? `The ${REAGENT_NAMES[reagent]} test is not finished. Use each labelled stage until the final appearance is recorded.`
      : `The ${REAGENT_NAMES[current]} result cannot answer whether ${NUTRIENT_NAMES[nutrient]} is present. Complete the matching food test first.`
  }
  const seen = observation(sample, reagent, finalStage(reagent))
  return `The completed tube is ${seen}. You chose ${state.answer === true ? 'Present' : 'Not detected'}; read that appearance as the result of this test, not as a test that went wrong.`
}

export function goodPrompt(config: FoodConfig): string {
  if (config.task === 'identify') return `Run all five tests on ${config.sample.name} using the reagent selector and action button. Finish each stage, then tick every nutrient the results show.`
  return `Use the reagent selector and action button to test ${config.sample.name} for ${NUTRIENT_NAMES[safeNutrient(config.nutrient)]}. Follow each stage, then choose Present or Not detected.`
}

export const foodTestsEngine: SceneEngine<FoodConfig, FoodState> = {
  id: 'food-tests',
  covers: ['iodine', 'Benedict', 'Biuret', 'DCPIP', 'emulsion test'],
  phrases: [
    'food test', 'food tests', 'testing food', 'testing foods', 'testing foods for nutrients', 'food nutrient tests', 'nutrient tests', 'testing nutrients in food',
    'test for starch', 'iodine test', 'iodine test for starch', 'starch test', 'Benedict test', 'Benedicts test', 'test for reducing sugar', 'test for reducing sugars', 'reducing sugar test',
    'biuret test', 'test for protein', 'protein test', 'emulsion test', 'test for fat', 'test for fats', 'fat test', 'ethanol emulsion test',
    'DCPIP test', 'test for vitamin C', 'vitamin C test', 'identifying nutrients', 'unknown food nutrients', 'nutrients in an unknown food',
  ],
  notFor: [
    'halogen', 'halogens', 'chlorine', 'bromine', 'displacement reactions', 'iodine clock', 'clock reaction', 'thyroid',
    'tests for ions', 'testing for ions', 'ion tests', 'iodide ions', 'iodide test', 'tests for gases', 'gas tests', 'flame tests', 'unknown salts',
    'enzymes', 'enzyme rate', 'digestion', 'digestive system', 'photosynthesis', 'testing a leaf', 'leaf starch test',
    'chromatography', 'separating mixtures', 'balanced diet', 'healthy diet', 'nutrition labels', 'food chains', 'food webs', 'food preservation',
    'emulsion paint', 'emulsifying agents', 'emulsion polymerisation',
  ],
  isolates: 'membership',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    if (rawTask !== undefined && typeof rawTask !== 'string') return null
    const word = keyOf(rawTask)
    const rawNutrient = first(src, ['nutrient', 'for', 'target', 'testFor'])
    const assay = first(src, ['reagent', 'assay', 'test'])
    const taskNutrient = keyOf(word).replace(/^test-for-/, '').replace(/-test$/, '')
    const nutrientWord = (v: unknown) => {
      const key = keyOf(v)
      const reagent = key.replace(/s$/, '')
      return has(NUTRIENT_WORDS, key) ? NUTRIENT_WORDS[key] : isReagent(reagent) ? nutrientFor(reagent) : undefined
    }
    const inferred = word && nutrientWord(taskNutrient) ? 'test' : null
    if (word && !has(TASK_WORDS, word) && !inferred) return null
    const namedNutrient = rawNutrient ?? (assay !== undefined ? nutrientWord(assay) : undefined) ?? (inferred ? nutrientWord(taskNutrient) : undefined)
    const task = word && has(TASK_WORDS, word) ? TASK_WORDS[word] : inferred ?? (namedNutrient !== undefined ? 'test' : 'identify')
    const sample = readSample(first(src, ['sample', 'food', 'unknown']), first(src, ['contains', 'nutrients']), first(src, ['sugar', 'sugarLevel']))
    if (sample === null) return null
    return task === 'test' ? { task, nutrient: readNutrient(namedNutrient), sample } : { task, sample }
  },

  faults(config) {
    const out: string[] = []
    const s = config.sample
    if (config.task === 'test' && !isNutrient(config.nutrient)) out.push(`There is no "${config.nutrient}" single food test here: use starch, reducing-sugar, protein, fat or vitamin-c, e.g. nutrient "starch".`)
    if (s.nutrients.includes('unknown')) out.push(`There is no prepared sample data for "${s.name}": use one of ${SAMPLE_NAMES.join(', ')}, or a sample object such as { name:"Food A", contains:["starch"], sugar:0 }.`)
    const bad = s.nutrients.filter((n) => n !== 'unknown' && !isNutrient(n))
    if (bad.length) out.push(`This card has no test for ${bad.join(', ')}: contains may use starch, reducing-sugar, protein, fat and vitamin-c only, e.g. contains ["starch","protein"].`)
    if (!s.name || s.name.length > 18) out.push(`The sample name "${s.name}" will not fit its label: use 1 to 18 characters, e.g. name "Food A".`)
    if (!Number.isInteger(s.sugar) || s.sugar < 0 || s.sugar > 4) out.push(`Sugar level ${s.sugar} cannot be drawn: use 0 (blue), 1 (green), 2 (yellow), 3 (orange) or 4 (brick-red), e.g. sugar 3.`)
    const safeLevel = Number.isFinite(s.sugar) ? Math.max(0, Math.min(4, Math.round(s.sugar))) : 0
    if (s.sugar > 0 && !s.nutrients.includes('reducing-sugar')) out.push('A sugar level above 0 contradicts a sample without reducing-sugar: add "reducing-sugar" to contains, or set sugar to 0.')
    if (s.nutrients.includes('reducing-sugar') && safeLevel === 0) out.push('A sample containing reducing-sugar needs a visible Benedict’s colour: set sugar to 1, 2, 3 or 4, e.g. sugar 3.')
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const resultWords = /blue[- ]black|brick[- ]red|orange[- ]brown|cloudy white|turns? (?:blue|green|yellow|orange|red|purple|lilac|colourless|colorless|cloudy)|stays? (?:blue|clear|orange)|becomes? (?:purple|lilac|colourless|colorless|cloudy)|\bpositive result\b|\bnegative result\b/i
    const asserts = config.task === 'identify'
      ? NUTRIENTS.some((n) => {
          const name = NUTRIENT_NAMES[n].replace('-', '[- ]')
          return new RegExp(`\\b(?:contains?|has|have|includes?|shows?|found|present|tick|select|choose|mark)\\b[^.!?]*\\b${name}\\b|\\b${name}\\b[^.!?]*(?:is |are |was |were )?(?:present|found|detected|contained|absent|not detected|positive|negative)\\b`, 'i').test(text)
        })
      : new RegExp(`\\b${NUTRIENT_NAMES[safeNutrient(config.nutrient)].replace('-', '[- ]')}\\b[^.!?]*(?:present|detected|contained|positive|negative|not in|absent)|(?:present|detected|contained|positive|negative|absent)[^.!?]*\\b${NUTRIENT_NAMES[safeNutrient(config.nutrient)].replace('-', '[- ]')}\\b`, 'i').test(text)
    if (resultWords.test(text) || asserts) out.push(`the prompt gives the experimental result away, which the learner should read from the tube -- ask for the test and conclusion only ("${example}")`)
    if (/\btaste|\bsmell|\bdirect flame|\bBunsen|\bover a flame|\bmix all|\ball (?:the )?reagents (?:in|into) (?:one|the same)|\bdrag\b|\btype (?:the|in)\b|\bSudan\b|\bgrease spot\b|\bcolorimet/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it uses a reagent selector and staged action button, with no tasting, flame or other assays -- ask for that ("${example}")`)
    }
    return out
  },

  initial() {
    return { reagent: 'iodine', stages: {}, answer: null, found: [] }
  },

  check(config, state) {
    const s = state ?? {}
    if (config.task === 'identify') {
      const missing = REAGENTS.filter((r) => !completed(s, r))
      if (missing.length) return { ok: false, wrongIds: missing }
      const want = sampleNutrients(safeSample(config.sample))
      const got = selectedNutrients(s)
      const wrongIds = NUTRIENTS.filter((n) => want.includes(n) !== got.includes(n))
      return { ok: wrongIds.length === 0, wrongIds }
    }
    const nutrient = safeNutrient(config.nutrient)
    if (!completed(s, REAGENT_FOR[nutrient])) return { ok: false, wrongIds: ['evidence'] }
    const ok = s.answer === positive(safeSample(config.sample), nutrient)
    return { ok, wrongIds: ok ? [] : ['answer'] }
  },

  solve(config) {
    if (config.task === 'identify') {
      return {
        reagent: 'dcpip',
        stages: Object.fromEntries(REAGENTS.map((r) => [r, finalStage(r)])),
        answer: null,
        found: sampleNutrients(safeSample(config.sample)),
      }
    }
    const nutrient = safeNutrient(config.nutrient)
    const reagent = REAGENT_FOR[nutrient]
    return { reagent, stages: { [reagent]: finalStage(reagent) }, answer: positive(safeSample(config.sample), nutrient), found: [] }
  },

  View: FoodTestsView,

  prompt: `SCENE "food-tests" -- a real dropper bottle and glass test tube of prepared food extract on a quiet light panel. The learner chooses a reagent from a compact selector, then presses one staged action button. Drops fall and the liquid visibly changes. Iodine and Biuret finish in one step; for DCPIP the learner adds food extract to the blue reagent. Ethanol has separate Add ethanol / Add water steps; Benedict's has Add Benedict's / Heat in water bath / Lift out & observe, with the tube visibly lowered into an electric 80 °C bath. Reduced motion shows the same stages as still frames. The live caption names only the appearance (blue-black, orange-brown, purple, blue, cloudy white, clear, colourless, or a Benedict's colour), never positive or negative. Changing reagent keeps every completed result.
  For: Cambridge Lower Secondary and IGCSE 0610 food tests, iodine for starch, Benedict's for reducing sugars, Biuret for protein, the ethanol emulsion test for fat, DCPIP for vitamin C, reading positive and negative appearances, and using several results to identify an unknown. Benedict's colours green/yellow/orange/brick-red are explained as rising approximate amounts, never an exact concentration or proof of glucose specifically.
  test: complete the appropriate test and choose Present or Not detected. nutrient: starch, reducing-sugar, protein, fat or vitamin-c.
  identify: finish all five tests and tick every nutrient shown by the evidence. All completed observations appear in a small results grid.
  sample: a prepared name (water, starch-solution, glucose-solution, albumin, egg-white, oil, potato, milk, orange-juice, apple-juice), or an object { "name":"Food A", "contains":["starch","protein"], "sugar":0 }. contains may include any of starch, reducing-sugar, protein, fat, vitamin-c; an empty list is a valid all-negative unknown. If reducing-sugar is present, sugar is 1 green (trace), 2 yellow (a little), 3 orange (moderate) or 4 brick-red (a lot); otherwise sugar is 0. Sample names are at most 18 characters.
  Not drawn: Sudan or grease-spot tests, hydrolysis of non-reducing sugars, exact colorimetry, tasting, flames, digestion, enzymes, chromatography or balanced-diet advice. Do not use for ion/gas tests or testing a leaf for photosynthesis.
  Before marking the card shows the apparatus, reagent names, live appearances and conclusion controls; it never labels a result positive/negative, names the unknown's contents, or states a sugar amount. Marking explains each conclusion and the Benedict's amount. The prompt must NOT state the colour/result, say the nutrient is present or absent, list an unknown's contents, or promise tasting, smelling, a flame, dragging or another assay.
  { "type":"createActivity", "spec": { "pattern":"scene","prompt":"${goodPrompt({ task: 'test', nutrient: 'starch', sample: PREPARED.potato })}",
    "payload": { "engine":"food-tests", "config": { "task":"test", "nutrient":"starch", "sample":"potato" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:food-tests", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene","prompt":"${goodPrompt({ task: 'test', nutrient: 'reducing-sugar', sample: PREPARED['glucose-solution'] })}",
    "payload": { "engine":"food-tests", "config": { "task":"test", "nutrient":"reducing-sugar", "sample":"glucose-solution" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:food-tests", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene","prompt":"${goodPrompt({ task: 'identify', sample: { name: 'Food A', nutrients: ['starch', 'protein'], sugar: 0 } })}",
    "payload": { "engine":"food-tests", "config": { "task":"identify", "sample": { "name":"Food A", "contains":["starch","protein"], "sugar":0 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:food-tests", "why":"..." } }`,
}

registerEngine(foodTestsEngine as SceneEngine<unknown, unknown>)
