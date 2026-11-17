// lib/studylab/engines/homeostasis/config.ts
//
// The learner is the control centre and must choose the right responses. Glucose: each dose of insulin moves one
// gold glucose particle from the blood into the liver store (as glycogen); each dose of glucagon moves one back out.
// In the type 1 diabetes model the pancreas makes no insulin, so insulin is injected. Temperature: the learner sets
// the skin's blood vessels, sweating and shivering; only the two right responses together reach the normal band,
// and a wrong one visibly pushes the reading the other way.
//
// Biology: ABPI Schools, "Homeostasis -- sugar balance and temperature control" (read 2026):
// insulin promotes glucose uptake and conversion to liver/muscle glycogen; glucagon promotes liver glycogen
// breakdown and glucose release. The hypothalamus coordinates sweating/vasodilation when hot and
// shivering/vasoconstriction when cold. Kiesewetter & Schmiemann (CBE Life Sci Educ 2022, PMC9582828) found
// novices often leave the loop open, hence the visible return of the regulated value.
//
// These are qualitative teaching models: one particle is 1 mmol/L, and each skin response shifts the core
// temperature by a fixed amount. They are not physiological simulations, clinical thresholds or a dosing guide.
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { HomeostasisView } from './View'

export const DIRECTIONS = ['high', 'low', 'hot', 'cold'] as const
export type Direction = (typeof DIRECTIONS)[number]
export type HomeostasisConfig = { task: 'glucose' | 'temperature'; direction: string; diabetes: boolean }
export type Vessels = 'narrow' | 'normal' | 'wide'
export type HomeostasisState = { insulin?: number; glucagon?: number; vessels?: Vessels; sweat?: number; shiver?: number }

/** Glucose particles in the whole model: blood plus the liver store. */
export const PARTICLES = 12
export const GLUCOSE_BAND = { low: 4, high: 6 }
export const TEMPERATURE_BAND = { low: 36.5, high: 37.5 }
/** Sweating and shivering each have three settings: none, some, lots. */
export const RESPONSE_MAX = 2
const VESSEL_EFFECT: Record<Vessels, number> = { narrow: 0.6, normal: 0, wide: -0.8 }
const SWEAT_EFFECT = -0.5
const SHIVER_EFFECT = 0.6

const count = (n: unknown, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max ? n : 0
export const startBlood = (config: HomeostasisConfig) => (config.direction === 'low' ? 3 : 10)
export const startTemperature = (config: HomeostasisConfig) => (config.direction === 'cold' ? 35 : 39)
export const insulinOf = (state: HomeostasisState | null | undefined) => count(state?.insulin, PARTICLES)
export const glucagonOf = (state: HomeostasisState | null | undefined) => count(state?.glucagon, PARTICLES)
export const vesselsOf = (state: HomeostasisState | null | undefined): Vessels => state?.vessels === 'narrow' || state?.vessels === 'wide' ? state.vessels : 'normal'
export const sweatOf = (state: HomeostasisState | null | undefined) => count(state?.sweat, RESPONSE_MAX)
export const shiverOf = (state: HomeostasisState | null | undefined) => count(state?.shiver, RESPONSE_MAX)

/** Gold particles in the blood: each insulin dose stores one in the liver, each glucagon dose releases one. */
export function bloodCount(config: HomeostasisConfig, state: HomeostasisState): number {
  return Math.max(1, Math.min(PARTICLES, startBlood(config) - insulinOf(state) + glucagonOf(state)))
}
export const storeCount = (config: HomeostasisConfig, state: HomeostasisState) => PARTICLES - bloodCount(config, state)

export function readingOf(config: HomeostasisConfig, state: HomeostasisState): number {
  if (config.task === 'glucose') return bloodCount(config, state)
  const t = startTemperature(config) + VESSEL_EFFECT[vesselsOf(state)] + SWEAT_EFFECT * sweatOf(state) + SHIVER_EFFECT * shiverOf(state)
  return Math.round(t * 10) / 10
}
export const bandOf = (config: HomeostasisConfig) => (config.task === 'glucose' ? GLUCOSE_BAND : TEMPERATURE_BAND)
export const unitOf = (config: HomeostasisConfig) => (config.task === 'glucose' ? 'mmol/L' : '°C')
export function inNormalBand(config: HomeostasisConfig, state: HomeostasisState): boolean {
  const v = readingOf(config, state)
  const band = bandOf(config)
  return v >= band.low - 1e-9 && v <= band.high + 1e-9
}
export const readingText = (config: HomeostasisConfig, state: HomeostasisState) => `${readingOf(config, state).toFixed(1)} ${unitOf(config)}`
export const bandText = (config: HomeostasisConfig) => {
  const band = bandOf(config)
  return `${band.low.toFixed(1)}–${band.high.toFixed(1)} ${unitOf(config)}`
}
/** How many heat-loss arrows leave the skin: wider vessels and more sweat lose more heat. */
export const heatLoss = (state: HomeostasisState) => Math.max(0, Math.min(4, 1 + (vesselsOf(state) === 'wide' ? 1 : vesselsOf(state) === 'narrow' ? -1 : 0) + sweatOf(state)))

export function working(config: HomeostasisConfig, state: HomeostasisState): string {
  const value = readingText(config, state)
  if (config.task === 'temperature') {
    return config.direction === 'hot'
      ? `Yes: ${value}. Wider skin blood vessels (vasodilation) bring more blood near the surface, and sweat takes heat away as it evaporates, so the body cools back to normal. That return is negative feedback.`
      : `Yes: ${value}. Narrower skin blood vessels (vasoconstriction) keep warm blood away from the surface, and shivering muscles release heat, so the body warms back to normal. That return is negative feedback.`
  }
  if (config.diabetes) {
    return `Yes: ${value}. In type 1 diabetes the pancreas makes no insulin, so it is injected. The insulin made the liver take in glucose and store it as glycogen. This card is a model, not a dosing guide.`
  }
  return config.direction === 'high'
    ? `Yes: ${value}. Insulin from the pancreas made the liver take in glucose and store it as glycogen, so blood glucose fell back to normal. That return is negative feedback.`
    : `Yes: ${value}. Glucagon from the pancreas made the liver break down glycogen and release glucose, so blood glucose rose back to normal. That return is negative feedback.`
}

export function madeText(config: HomeostasisConfig, state: HomeostasisState): string {
  const value = readingText(config, state)
  const band = bandOf(config)
  const where = readingOf(config, state) < band.low ? 'below' : 'above'
  if (config.task === 'glucose') {
    const did = `You gave ${insulinOf(state)} insulin and ${glucagonOf(state)} glucagon.`
    return `Blood glucose is ${value}, ${where} the normal band (${bandText(config)}). ${did} Watch which way each one moves the gold glucose.`
  }
  return `Core temperature is ${value}, ${where} the normal band (${bandText(config)}). Watch what each response does to the heat leaving the skin.`
}

const keyOf = (raw: unknown) => (typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

const TASK_WORDS: Record<string, 'glucose' | 'temperature'> = {
  glucose: 'glucose', sugar: 'glucose', 'blood-glucose': 'glucose', 'blood-sugar': 'glucose', 'glucose-control': 'glucose', 'blood-glucose-control': 'glucose',
  insulin: 'glucose', glucagon: 'glucose', glycogen: 'glucose', diabetes: 'glucose', diabetic: 'glucose', 'type-1-diabetes': 'glucose', 'type-one-diabetes': 'glucose',
  temperature: 'temperature', 'body-temperature': 'temperature', thermoregulation: 'temperature', 'temperature-regulation': 'temperature', 'temperature-control': 'temperature',
  skin: 'temperature', sweating: 'temperature', shivering: 'temperature', vasodilation: 'temperature', vasoconstriction: 'temperature',
}
const DIRECTION_WORDS: Record<string, Direction> = {
  high: 'high', raised: 'high', rise: 'high', rising: 'high', hyperglycaemia: 'high', hyperglycemia: 'high', meal: 'high', 'after-a-meal': 'high', 'after-meal': 'high', lower: 'high', decrease: 'high', insulin: 'high', 'type-1-diabetes': 'high', 'type-one-diabetes': 'high', diabetes: 'high',
  low: 'low', fallen: 'low', fall: 'low', falling: 'low', hypoglycaemia: 'low', hypoglycemia: 'low', exercise: 'low', 'after-exercise': 'low', raise: 'low', increase: 'low', glucagon: 'low',
  hot: 'hot', warm: 'hot', heat: 'hot', overheating: 'hot', 'too-hot': 'hot', cooling: 'hot', cool: 'hot', sweating: 'hot', vasodilation: 'hot',
  cold: 'cold', coolng: 'cold', 'too-cold': 'cold', warming: 'cold', shivering: 'cold', vasoconstriction: 'cold',
}
function boolOf(raw: unknown): boolean | null {
  if (raw === undefined) return false
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  const k = keyOf(raw)
  if (['true', 'yes', 'diabetes', 'diabetic', 'type-1-diabetes', 'type-one-diabetes', '1'].includes(k)) return true
  if (['false', 'no', 'none', 'healthy', '0', ''].includes(k)) return false
  return null
}

export function goodPrompt(config: HomeostasisConfig): string {
  if (config.task === 'temperature') {
    return config.direction === 'hot'
      ? 'A hot room has raised the core temperature. Choose the body’s responses to bring it back into the normal band.'
      : 'A cold room has lowered the core temperature. Choose the body’s responses to bring it back into the normal band.'
  }
  if (config.diabetes) return 'This person has type 1 diabetes and has just eaten. Bring the blood glucose back into the normal band.'
  return config.direction === 'high'
    ? 'A meal has raised the blood glucose. Choose what the pancreas releases to bring it back into the normal band.'
    : 'Exercise has lowered the blood glucose. Choose what the pancreas releases to bring it back into the normal band.'
}

export const homeostasisEngine: SceneEngine<HomeostasisConfig, HomeostasisState> = {
  id: 'homeostasis',
  // Distinctive topic words; general coordination is a phrase so nerve-impulses keeps its stations.
  covers: ['homeostasis', 'thermoregulation', 'insulin', 'glucagon', 'diabetes'],
  phrases: [
    'negative feedback', 'blood glucose', 'blood sugar', 'control of blood glucose', 'blood glucose control', 'blood sugar control',
    'control of body temperature', 'body temperature regulation', 'temperature regulation', 'temperature control in humans',
    'diabetes', 'type 1 diabetes', 'type one diabetes', 'insulin and glucagon', 'glucose and glycogen', 'glycogen storage',
    'sweating and shivering', 'vasodilation and vasoconstriction', 'skin and temperature control', 'internal environment',
  ],
  notFor: [
    'nerve impulse', 'nerve impulses', 'reflex arc', 'reflex arcs', 'reflex action', 'synapse', 'synapses', 'neurones', 'neurotransmission',
    'hormones and glands', 'endocrine glands', 'endocrine system', 'adrenaline', 'plant hormones', 'tropisms', 'menstrual cycle',
    'kidney', 'kidneys', 'excretion', 'water balance', 'osmoregulation', 'urine', 'dialysis',
    'enzyme rate', 'enzyme activity', 'enzymes and temperature', 'effect of temperature on enzymes', 'denaturation',
    'thermal transfer', 'heat transfer', 'conduction', 'convection', 'thermal insulation', 'specific heat capacity', 'physics of cooling',
    'blood pressure', 'blood calcium',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type', 'name'] : ['task', 'kind', 'type', 'mode', 'mechanism'])
    const rawDirection = first(src, ['direction', 'start', 'starting', 'condition', 'from', 'challenge'])
    const rawDiabetes = first(src, ['diabetes', 'diabetic', 'type1', 'typeOne'])
    const taskWord = keyOf(rawTask)
    const directionWord = keyOf(rawDirection)
    if (rawTask !== undefined && typeof rawTask !== 'string') return null
    if (rawDirection !== undefined && typeof rawDirection !== 'string') return null
    const said = boolOf(rawDiabetes)
    if (said === null) return null
    // A task or condition that names diabetes is the type 1 model, unless the config says otherwise.
    const diabetes = rawDiabetes === undefined ? /diabet|type-1|type-one/.test(taskWord) || /diabet|type-1|type-one/.test(keyOf(rawDirection)) : said
    const fromTask = has(TASK_WORDS, taskWord) ? TASK_WORDS[taskWord] : ''
    const fromDirection = has(DIRECTION_WORDS, directionWord) ? DIRECTION_WORDS[directionWord] : ''
    const task = fromTask || (fromDirection === 'high' || fromDirection === 'low' ? 'glucose' : fromDirection ? 'temperature' : diabetes ? 'glucose' : '')
    if (!task) return null
    const direction = fromDirection || (task === 'glucose' ? 'high' : 'hot')
    return { task, direction, diabetes }
  },

  faults(config) {
    const out: string[] = []
    const valid = config.task === 'glucose' ? ['high', 'low'] : ['hot', 'cold']
    if (!valid.includes(config.direction)) {
      out.push(`There is no "${config.direction}" starting condition for ${config.task}: use ${valid.join(' or ')}, e.g. { task: "${config.task}", direction: "${valid[0]}", diabetes: false }.`)
    }
    if (config.task === 'temperature' && config.diabetes) out.push('Diabetes belongs to the blood glucose model, not the skin: set diabetes false, or use { task: "glucose", direction: "high", diabetes: true }.')
    if (config.task === 'glucose' && config.direction === 'low' && config.diabetes) out.push('This type 1 diabetes model shows insulin treatment for high glucose, not glucagon: use direction "high", or set diabetes false for low glucose.')
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    let gives = false
    let absent = /\bdrag\b|\bslide|\bslider\b|\border the\b|\bfeedback loop diagram\b|\bkidney\b|\breflex arc\b|\benzyme\b|\btype 2\b|\binsulin units?\b|\b\d+\s*(?:units?|IU)\b/i.test(text)
    if (config.task === 'glucose') {
      gives = /\binsulin\b|\bglucagon\b|\bglycogen\b|\binject|\bnegative feedback\b|\b(?:one|two|three|four|five|six|\d+)\s+(?:steps?|taps?|doses?)\b/i.test(text)
      absent = absent || (config.task === 'glucose' && /\bsweat|\bshiver|\bvaso|\bthermometer\b/i.test(text))
    } else {
      gives = /\bsweat|\bshiver|\bvasodilat|\bvasoconstrict|\bnegative feedback\b|\bhypothalamus\b|\b(?:one|two|three|four|five|six|\d+)\s+(?:steps?|taps?)\b/i.test(text)
      absent = absent || /\binsulin\b|\bglucagon\b|\bglycogen\b|\bliver\b|\bpancreas\b/i.test(text)
    }
    if (gives) out.push(`the prompt gives the answer away: it names the hormone or response, or says how many doses, which the learner must choose -- ask for the outcome only ("${example}")`)
    if (absent) out.push(`the prompt promises something the card does not show: it has ${config.task === 'glucose' ? 'insulin and glucagon buttons, a blood vessel, pancreas and liver' : 'blood-vessel, sweating and shivering controls on a skin section'} and a live reading -- ask for that ("${example}")`)
    return out
  },

  initial(config) {
    return config.task === 'glucose' ? { insulin: 0, glucagon: 0 } : { vessels: 'normal', sweat: 0, shiver: 0 }
  },
  check(config, state) {
    const safe = state ?? {}
    if (inNormalBand(config, safe)) return { ok: true, wrongIds: [] }
    if (config.task === 'glucose') return { ok: false, wrongIds: [config.direction === 'low' ? 'glucagon' : 'insulin'] }
    return { ok: false, wrongIds: ['vessels', config.direction === 'hot' ? 'sweat' : 'shiver'] }
  },
  solve(config) {
    if (config.task === 'glucose') return config.direction === 'low' ? { insulin: 0, glucagon: 2 } : { insulin: 5, glucagon: 0 }
    return config.direction === 'cold' ? { vessels: 'narrow', sweat: 0, shiver: 2 } : { vessels: 'wide', sweat: 2, shiver: 0 }
  },
  View: HomeostasisView,

  prompt: `SCENE "homeostasis" -- a quiet light panel with a live reading on a scale with a green normal band. The learner is the control centre and CHOOSES the responses; a wrong choice visibly pushes the reading the other way. Marking accepts any reading inside the band.
  glucose: a blood vessel with gold glucose particles, the pancreas and a liver with a store. Two buttons, Release insulin and Release glucagon: each insulin dose moves one particle from the blood into the liver store, each glucagon dose moves one back out (1 particle = 1 mmol/L). direction "high" starts at 10.0 after a meal; "low" starts at 3.0 after exercise. With diabetes true (direction high only) the pancreas is marked as making no insulin and the button is Inject insulin; no dose units or clinical guidance.
  temperature: a skin section with sweat gland, blood vessel and muscle, and heat arrows leaving the surface. Three controls: skin blood vessels narrower/normal/wider, sweating none/some/lots, shivering none/some/lots. direction "hot" starts at 39.0 °C, "cold" at 35.0 °C; only the two right responses together reach the band (36.5–37.5 °C).
  For: homeostasis as keeping the internal environment within limits, negative feedback, blood glucose after meals/exercise, insulin and glucagon, glycogen storage, type 1 diabetes treated with insulin, body temperature, sweating, shivering, vasodilation and vasoconstriction. Not for type 2 diabetes, reflex arcs, synapses, general endocrine glands, kidneys/water balance, enzyme-rate graphs, blood pressure/calcium, or physical heat-transfer calculations.
  Before marking the card names the controls (insulin, glucagon, vessels, sweating, shivering) but not what they do: glycogen, vasodilation/vasoconstriction and negative feedback are explained only after marking. The prompt gives the disturbance and the goal; it must NOT name insulin, glucagon, glycogen, sweating, shivering or vasodilation, say how many doses, or promise dragging, a feedback-loop diagram or real insulin units.
  config: { "task":"glucose", "direction":"high", "diabetes":false }
       or { "task":"glucose", "direction":"low", "diabetes":false }
       or { "task":"glucose", "direction":"high", "diabetes":true }
       or { "task":"temperature", "direction":"hot", "diabetes":false }
       or { "task":"temperature", "direction":"cold", "diabetes":false }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"A meal has raised the blood glucose. Choose what the pancreas releases to bring it back into the normal band.",
    "payload": { "engine":"homeostasis", "config": { "task":"glucose", "direction":"high", "diabetes":false } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:homeostasis", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Exercise has lowered the blood glucose. Choose what the pancreas releases to bring it back into the normal band.",
    "payload": { "engine":"homeostasis", "config": { "task":"glucose", "direction":"low", "diabetes":false } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:homeostasis", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"This person has type 1 diabetes and has just eaten. Bring the blood glucose back into the normal band.",
    "payload": { "engine":"homeostasis", "config": { "task":"glucose", "direction":"high", "diabetes":true } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:homeostasis", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"A hot room has raised the core temperature. Choose the body’s responses to bring it back into the normal band.",
    "payload": { "engine":"homeostasis", "config": { "task":"temperature", "direction":"hot", "diabetes":false } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:homeostasis", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"A cold room has lowered the core temperature. Choose the body’s responses to bring it back into the normal band.",
    "payload": { "engine":"homeostasis", "config": { "task":"temperature", "direction":"cold", "diabetes":false } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:homeostasis", "why":"..." } }`,
}

registerEngine(homeostasisEngine as SceneEngine<unknown, unknown>)
