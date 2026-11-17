// lib/studylab/engines/specific-heat/config.ts
//
// Equal masses of water and aluminium on electric heaters. The learner sets energy, in kJ, and two real
// thermometers answer. In `match` each sample has its own heater control and both must reach one temperature;
// in `shared` one control gives both samples exactly the same energy and a named one must reach its goal.
//
// Physics (no phase change, no losses, no work done on or by a sample): E = m c deltaT, so
// deltaT = E / (m c). OpenStax College Physics 14.2 gives c(aluminium) = 900 J/(kg degC) and
// c(water) = 4186; Cambridge IGCSE school calculations use the rounded 4200 J/(kg degC), as here.
// https://openstax.org/books/college-physics/pages/14-2-temperature-change-and-heat-capacity

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SpecificHeatView } from './View'

export type MaterialName = 'water' | 'aluminium'
export type HeatConfig =
  | { task: 'match'; target: number; mass: number }
  | { task: 'shared'; material: MaterialName; target: number; mass: number }
export type HeatState = { water?: number; aluminium?: number; energy?: number }

/** Rounded school values, J/(kg degC). */
export const SPECIFIC_HEAT: Record<MaterialName, number> = { water: 4200, aluminium: 900 }
export const MATERIAL_NAMES: MaterialName[] = ['water', 'aluminium']
export const START_TEMP = 20
export const SCALE_MAX = 160
export const ENERGY_MAX = 180
export const ENERGY_STEP = 3
export const MASSES = [1, 2]
/** A visibly close thermometer reading counts. Exact energies are supplied with the mark. */
export const TEMP_TOLERANCE = 2

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
export const isMaterial = (v: unknown): v is MaterialName => typeof v === 'string' && has(SPECIFIC_HEAT, v)

/** Energy in kJ, sanitised for drawing. Stored work outside the controls is not accepted by `done`. */
export function energyFor(config: HeatConfig, state: HeatState, material: MaterialName): number {
  const raw = config.task === 'shared' ? state?.energy : state?.[material]
  return typeof raw === 'number' && Number.isFinite(raw) ? clamp(raw, 0, ENERGY_MAX) : 0
}

export function temperature(config: HeatConfig, energyKJ: number, material: MaterialName): number {
  return START_TEMP + (energyKJ * 1000) / (config.mass * SPECIFIC_HEAT[material])
}

export function temperatureFor(config: HeatConfig, state: HeatState, material: MaterialName): number {
  return temperature(config, energyFor(config, state, material), material)
}

/** The exact energy for one sample, in kJ. */
export function requiredEnergy(config: HeatConfig, material: MaterialName): number {
  return (config.mass * SPECIFIC_HEAT[material] * (config.target - START_TEMP)) / 1000
}

const near = (a: number, b: number) => Math.abs(a - b) <= TEMP_TOLERANCE + 1e-9
// solve may give a decimal kJ value between the coarse steps; the 2 °C tolerance accepts it.
const onControl = (e: number) => Number.isFinite(e) && e >= 0 && e <= ENERGY_MAX

export function done(config: HeatConfig, state: HeatState): boolean {
  if (!state || typeof state !== 'object') return false
  if (config.task === 'shared') {
    const e = state.energy
    return typeof e === 'number' && onControl(e) && near(temperature(config, e, config.material), config.target)
  }
  return MATERIAL_NAMES.every((m) => {
    const e = state[m]
    return typeof e === 'number' && onControl(e) && near(temperature(config, e, m), config.target)
  })
}

const degrees = (t: number) => `${t.toFixed(1).replace('.0', '')} °C`
const kJ = (e: number) => `${Number(e.toFixed(2))} kJ`
const exact = (a: number, b: number) => Math.abs(a - b) < 1e-8

/** What a correct card says, including the exact values when a visible near-miss was accepted. */
export function working(config: HeatConfig, state: HeatState): { lead: string; detail: string } {
  const rise = config.target - START_TEMP
  if (config.task === 'match') {
    const w = requiredEnergy(config, 'water')
    const a = requiredEnergy(config, 'aluminium')
    const close = exact(energyFor(config, state, 'water'), w) && exact(energyFor(config, state, 'aluminium'), a)
    return {
      lead: `${close ? 'Yes' : 'Near enough'}: exactly ${kJ(w)} (water), ${kJ(a)} (aluminium).`,
      detail: `E = mcΔT. Water's c is 4200 J/(kg °C), aluminium's is 900: the same mass and rise needs different energy.`,
    }
  }
  const e = requiredEnergy(config, config.material)
  const other: MaterialName = config.material === 'water' ? 'aluminium' : 'water'
  const close = exact(energyFor(config, state, config.material), e)
  return {
    lead: `${close ? 'Yes' : 'Near enough'}: exactly ${kJ(e)} to each takes ${config.material} to ${degrees(config.target)}.`,
    detail: `E = mcΔT. c(water) = 4200, c(aluminium) = 900 J/(kg °C). This dose takes ${other} to ${degrees(temperature(config, e, other))}.`,
  }
}

/** What a wrong card says: only what the learner's own apparatus now shows. */
export function madeText(config: HeatConfig, state: HeatState): string {
  const w = temperatureFor(config, state, 'water')
  const a = temperatureFor(config, state, 'aluminium')
  if (config.task === 'match') return `Water is at ${degrees(w)} and aluminium at ${degrees(a)}. The goal is ${degrees(config.target)} for both.`
  return `You gave each sample ${kJ(energyFor(config, state, config.material))}: water is at ${degrees(w)} and aluminium at ${degrees(a)}. The goal is ${degrees(config.target)} for ${config.material}.`
}

// ---------------------------------------------------------------------------
// Reading semantic configs broadly; faults refuses only what the apparatus cannot honestly show.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*(?:°\s*c|degrees?(?:\s*celsius)?|kg|kilograms?)$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}
function readMaterial(raw: unknown): MaterialName {
  if (raw === undefined) return 'water'
  const k = keyOf(raw).replace(/-(?:sample|block|beaker)$/, '')
  if (k === 'aluminum' || k === 'metal' || k === 'aluminium-block') return 'aluminium'
  // Keep an unknown name so faults can say what to change instead of silently drawing water.
  return (k === 'water' || k === 'aluminium' ? k : k || 'water') as MaterialName
}

const TASK_WORDS: Record<string, 'match' | 'shared'> = {
  match: 'match', matching: 'match', 'match-temperature': 'match', 'same-temperature': 'match', 'equal-temperature': 'match', 'both': 'match', 'compare': 'match', 'comparison': 'match', 'separate': 'match', independent: 'match',
  shared: 'shared', share: 'shared', 'same-energy': 'shared', 'equal-energy': 'shared', 'one-heater': 'shared', 'single-energy': 'shared', 'energy': 'shared', 'temperature-rise': 'shared',
}

export const goodPrompt = (c: HeatConfig) => c.task === 'match'
  ? `Drag each energy slider until both thermometers reach ${c.target} °C. Use − or + for small steps.`
  : `Drag the energy slider until the ${c.material} reaches ${c.target} °C. Both samples get the same energy; use − or + for small steps.`

/** A nearby clean example for a refusal. */
function exampleFor(c: HeatConfig): HeatConfig {
  if (c.task === 'match') {
    for (const mass of MASSES) for (const target of [40, 30, 50]) {
      const candidate: HeatConfig = { task: 'match', target, mass }
      if (faultsFor(candidate).length === 0) return candidate
    }
  }
  const material = c.task === 'shared' ? c.material : 'water'
  for (const mass of MASSES) for (const target of material === 'water' ? [40, 30, 50] : [60, 40, 80, 30]) {
    const candidate: HeatConfig = { task: 'shared', material, target, mass }
    if (faultsFor(candidate).length === 0) return candidate
  }
  return { task: 'shared', material: 'water', target: 40, mass: 1 }
}

function faultsFor(c: HeatConfig): string[] {
  const out: string[] = []
  if (!MASSES.includes(c.mass)) out.push(`The samples are drawn as 1 kg or 2 kg, not ${c.mass} kg: use e.g. mass 1.`)
  if (!Number.isInteger(c.target) || c.target < 30 || c.target > 90 || c.target % 10 !== 0) {
    out.push(`The goal must be a whole 10 °C from 30 to 90 °C above the 20 °C start, not ${c.target} °C: use e.g. target ${c.task === 'shared' && c.material === 'aluminium' ? 60 : 40}.`)
  }
  if (out.length) return out
  const needed = MATERIAL_NAMES.map((m) => requiredEnergy(c, m))
  if (c.task === 'match' && needed.some((e) => e > ENERGY_MAX)) {
    const eg = exampleFor(c)
    const fix = eg.task === 'match' ? `target ${eg.target}, mass ${eg.mass}` : 'target 40, mass 1'
    return [`Reaching ${c.target} °C with ${c.mass} kg of water needs more than the ${ENERGY_MAX} kJ control holds: use e.g. task "match", ${fix}.`]
  }
  if (c.task === 'shared') {
    const e = requiredEnergy(c, c.material)
    const other: MaterialName = c.material === 'water' ? 'aluminium' : 'water'
    if (e > ENERGY_MAX || temperature(c, e, other) > SCALE_MAX || temperature(c, e, c.material) > SCALE_MAX || (other === 'water' && temperature(c, e, other) >= 100)) {
      const eg = exampleFor(c)
      const fix = eg.task === 'shared' ? `material "${eg.material}", target ${eg.target}, mass ${eg.mass}` : 'material "water", target 40, mass 1'
      return [`That dose would take a sample beyond the ${SCALE_MAX} °C thermometers (or boil the water): use e.g. ${fix}.`]
    }
  }
  return out
}

export const specificHeatEngine: SceneEngine<HeatConfig, HeatState> = {
  id: 'specific-heat',
  // No bare "heat", "water" or "temperature": those belong to many neighbouring stations.
  covers: ['calorimetry'],
  phrases: [
    'specific heat', 'specific heats', 'specific heat capacity', 'specific heat capacities', 'heat capacity', 'thermal capacity', 'thermal capacities',
    'heating materials', 'heating different materials', 'energy and temperature rise', 'temperature rise', 'temperature rises', 'energy for heating',
    'difference between heat and temperature', 'heat and temperature', 'heat energy and temperature', 'specific heat capacity equation',
    'water and aluminium', 'water and aluminum', 'heating water and aluminium', 'hot water bottles', 'water in radiators', 'coastal climates',
  ],
  notFor: [
    'conduction', 'convection', 'thermal radiation', 'heat transfer', 'thermal transfer', 'insulation', 'thermal insulation', 'conductors and insulators',
    'latent heat', 'specific latent heat', 'changes of state', 'change of state', 'melting and boiling', 'particle model', 'particles',
    'energy stores', 'energy transfers', 'energy track', 'density', 'pressure', 'thermal equilibrium', 'mixing liquids', 'chemical calorimetry', 'enthalpy',
  ],
  isolates: 'quantity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const material = readMaterial(first(src, ['material', 'substance', 'sample', 'focus']))
    const rawTarget = first(src, ['target', 'temperature', 'goal', 'finalTemperature', 'final'])
    const target = rawTarget === undefined ? (material === 'aluminium' ? 60 : 40) : readNumber(rawTarget)
    const rawMass = first(src, ['mass', 'kg', 'massKg']) ?? first(o, ['mass', 'kg', 'massKg'])
    const mass = rawMass === undefined ? 1 : readNumber(rawMass)
    if (target === null || mass === null) return null
    const task = word ? TASK_WORDS[word] : first(src, ['material', 'substance', 'sample', 'focus']) !== undefined ? 'shared' : 'match'
    return task === 'match' ? { task, target, mass } : { task, material, target, mass }
  },

  faults(config) {
    if (config.task === 'shared' && !isMaterial(config.material)) {
      return ['There is no such sample drawn here: use water or aluminium, e.g. material "water", target 40, mass 1.']
    }
    return faultsFor(config)
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (/\bE\s*=\s*m\s*c|\bQ\s*=\s*m\s*c|mcΔ|4200|4[,.]?200|\b900\s*J|\b(?:specific heat|heat capacity)\b|\bneeds?\s+(?:more|less)\s+energy\b|\bmore\s+energy\s+than\b|\b\d+(?:\.\d+)?\s*(?:kJ|kilojoules?)\b/i.test(text)) {
      out.push(`the prompt gives the answer or method away: the energy, the equation, the specific heat values or which material needs more -- ask only for the thermometer goal ("${example}")`)
    }
    if (/\b(?:conduction|convection|radiation|insulat|latent|melt|boil|steam|particles?|stopwatch|seconds?|minutes?|mass slider|change the mass)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it has energy sliders and two thermometers, with no heat-transfer, timing, mass or state-change controls ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'match' ? { water: 0, aluminium: 0 } : { energy: 0 }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    return config.task === 'match'
      ? { water: requiredEnergy(config, 'water'), aluminium: requiredEnergy(config, 'aluminium') }
      : { energy: requiredEnergy(config, config.material) }
  },

  View: SpecificHeatView,

  prompt: `SCENE "specific-heat" -- equal masses of water and aluminium on electric heaters, drawn as a real glass beaker of blue water and a silver metal block, each with a red thermometer on a quiet light panel. The learner drags slim energy sliders (or taps − / + for 3 kJ steps); both thermometer columns and digital readings ease to their new temperatures, and the heater coils respond. Orange dashed lines mark the goal temperatures. The other sample is always heated too, so the contrast is visible.
  For: specific heat capacity, thermal/heat capacity, heating different materials, energy needed for a temperature rise, E = mcΔT, and the difference between heat energy and temperature. It answers "the same energy means the same temperature" and "a hotter sample must have received more energy".
  match: independent energy sliders for water and aluminium. The learner makes both reach the same goal, discovering the different energies. config: { "task":"match", "target":40, "mass":1 }. target is 30, 40 or 50 °C in whole 10 °C steps, from a 20 °C start; mass is 1 or 2 kg. The 180 kJ control and 160 °C scale limit some combinations (mass 2 works at target 30 or 40).
  shared: one energy slider supplies exactly the same energy to both. The learner lands the named material on its goal while the other responds differently. config: { "task":"shared", "material":"water", "target":40, "mass":1 }; material is water or aluminium, target 30 to 90 °C in 10 °C steps, mass 1 or 2 kg. Configurations whose other sample would pass 160 °C or whose water would boil are refused with a nearby example.
  Controls run 0 to 180 kJ in 3 kJ steps. Marking allows a visible 2 °C tolerance and gives the exact energy with "Near enough" when needed. Before marking the card shows live energies and temperatures, the equal masses and goals, but no c values, equation, required energy or verdict. Marking supplies E = mcΔT and c(water) = 4200, c(aluminium) = 900 J/(kg °C).
  Not drawn: conduction, convection, radiation, insulation, thermal equilibrium or mixing, changes of state, particles, a stopwatch, variable mass, unknown-material identification, or chemical calorimetry.
  The prompt must name the gesture and goal only: do NOT give an energy in kJ, E = mcΔT, specific heat values, or say which material needs more energy. Do not promise timing, heat transfer, boiling or mass controls.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag each energy slider until both thermometers reach 40 °C. Use − or + for small steps.",
    "payload": { "engine":"specific-heat", "config": { "task":"match", "target":40, "mass":1 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:specific-heat", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag each energy slider until both thermometers reach 30 °C. Use − or + for small steps.",
    "payload": { "engine":"specific-heat", "config": { "task":"match", "target":30, "mass":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:specific-heat", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the energy slider until the water reaches 40 °C. Both samples get the same energy; use − or + for small steps.",
    "payload": { "engine":"specific-heat", "config": { "task":"shared", "material":"water", "target":40, "mass":1 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:specific-heat", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the energy slider until the aluminium reaches 60 °C. Both samples get the same energy; use − or + for small steps.",
    "payload": { "engine":"specific-heat", "config": { "task":"shared", "material":"aluminium", "target":60, "mass":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:specific-heat", "why":"..." } }`,
}

registerEngine(specificHeatEngine as SceneEngine<unknown, unknown>)
