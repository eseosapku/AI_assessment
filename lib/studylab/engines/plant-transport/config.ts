// lib/studylab/engines/plant-transport/config.ts
//
// A leafy shoot in a real bubble potometer. One environmental factor is changed with a quiet stepper;
// vapour, the xylem stream and the bubble all answer. The rate curves are a deliberately simple teaching
// model, not measured plant data: each has the direction and approximate shape required by Cambridge IGCSE
// Biology 0610. A potometer measures water UPTAKE, used to estimate transpiration, never vapour loss directly.
//
// Sources (read in research.md): Cambridge 0610 scope; Practical Biology's potometer method; Save My Exams on
// uptake versus transpiration; Open Source Physics @ Singapore's fan/heater/lamp virtual lab; TI Nspire's
// "When Water Leaves" humidity/temperature/wind manipulations. No code or artwork is copied.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { PlantTransportView } from './View'

export const FACTORS = ['wind', 'temperature', 'light', 'humidity'] as const
export type Factor = (typeof FACTORS)[number]
export type PlantConfig = { task: 'match' | 'limit'; factor: string; target: number }
export type PlantState = { level?: number }

export type Level = { value: number; rate: number }
export const LEVELS: Record<Factor, Level[]> = {
  // The water-uptake rates are illustrative mm of capillary travel per minute.
  wind: [
    { value: 0, rate: 0.55 }, { value: 1, rate: 0.75 }, { value: 2, rate: 1.0 },
    { value: 3, rate: 1.3 }, { value: 4, rate: 1.6 },
  ],
  temperature: [
    { value: 10, rate: 0.35 }, { value: 15, rate: 0.48 }, { value: 20, rate: 0.65 },
    { value: 25, rate: 0.95 }, { value: 30, rate: 1.25 }, { value: 35, rate: 1.55 }, { value: 40, rate: 1.9 },
  ],
  light: [
    { value: 0, rate: 0.15 }, { value: 250, rate: 0.45 }, { value: 500, rate: 0.7 },
    { value: 750, rate: 0.95 }, { value: 1000, rate: 1.25 },
  ],
  humidity: [
    { value: 30, rate: 1.5 }, { value: 45, rate: 1.0 }, { value: 60, rate: 0.75 },
    { value: 75, rate: 0.5 }, { value: 90, rate: 0.3 },
  ],
}

/** The match band is a tenth of a mm either side: visible in the live readout, not hidden precision. */
export const MATCH_TOLERANCE = 0.1
export const BASE_LEVEL: Record<Factor, number> = { wind: 0, temperature: 2, light: 1, humidity: 2 }
export const UNITS: Record<Factor, string> = { wind: 'm/s', temperature: '°C', light: 'lx', humidity: '%' }
export const FACTOR_NAMES: Record<Factor, string> = { wind: 'Wind speed', temperature: 'Temperature', light: 'Light intensity', humidity: 'Humidity' }

const isFactor = (f: string): f is Factor => (FACTORS as readonly string[]).includes(f)
export const factorOf = (c: PlantConfig): Factor => (isFactor(c.factor) ? c.factor : 'wind')
export const levelsOf = (c: PlantConfig): Level[] => LEVELS[factorOf(c)]
export const baseOf = (c: PlantConfig): number => BASE_LEVEL[factorOf(c)]

/** Stored work is read defensively; an impossible level is simply not solved. */
export function levelOf(c: PlantConfig, state: PlantState | null | undefined): number {
  const n = state?.level
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < levelsOf(c).length ? n : -1
}
export const rateAt = (c: PlantConfig, level: number): number => levelsOf(c)[level]?.rate ?? 0
export const valueAt = (c: PlantConfig, level: number): number => levelsOf(c)[level]?.value ?? 0
export const valueText = (c: PlantConfig, level: number): string => `${valueAt(c, level)} ${UNITS[factorOf(c)]}`
export const rateText = (rate: number): string => rate.toFixed(2)

export function nearestLevel(c: PlantConfig, target = c.target): number {
  const levels = levelsOf(c)
  let best = 0
  for (let i = 1; i < levels.length; i++) {
    if (Math.abs(levels[i].rate - target) < Math.abs(levels[best].rate - target)) best = i
  }
  return best
}

/** The least departure from room conditions whose rate reaches the aim, or -1 if none can. */
export function neededLevel(c: PlantConfig): number {
  for (let d = 0; d < levelsOf(c).length; d++) {
    for (const level of [baseOf(c) - d, baseOf(c) + d]) {
      if (level >= 0 && level < levelsOf(c).length && rateAt(c, level) + 1e-9 >= c.target) return level
    }
  }
  return -1
}

export function done(c: PlantConfig, state: PlantState): boolean {
  const level = levelOf(c, state)
  if (level < 0 || !Number.isFinite(c.target)) return false
  if (c.task === 'match') return Math.abs(rateAt(c, level) - c.target) <= MATCH_TOLERANCE + 1e-9
  const need = neededLevel(c)
  return need >= 0 && rateAt(c, level) + 1e-9 >= c.target && Math.abs(level - baseOf(c)) === Math.abs(need - baseOf(c))
}

const CHANGES: Record<Factor, { up: string; down: string }> = {
  wind: {
    up: 'Moving air carries water vapour away from the leaf, keeping a steep diffusion gradient.',
    down: 'Still air lets moist air collect around the leaf, so water vapour diffuses out more slowly.',
  },
  temperature: {
    up: 'Warmer conditions give water molecules more kinetic energy, so water evaporates faster from mesophyll cell surfaces.',
    down: 'Cooler conditions slow evaporation from the mesophyll cells.',
  },
  light: {
    up: 'Brighter light opens the stomata wider, so water vapour diffuses out faster.',
    down: 'Dimmer light lets the stomata narrow, so less water vapour escapes.',
  },
  humidity: {
    up: 'More humid air reduces the water-vapour concentration gradient, so diffusion out of the leaf slows.',
    down: 'Drier air makes a steeper water-vapour concentration gradient, so diffusion out of the leaf speeds up.',
  },
}

export function working(c: PlantConfig, state: PlantState): string {
  const level = levelOf(c, state)
  const f = factorOf(c)
  const rate = rateAt(c, level)
  const direction = level >= baseOf(c) ? 'up' : 'down'
  const mechanism = CHANGES[f][direction]
  const stream = 'Transpiration pull and cohesion keep the xylem column moving. A potometer measures water uptake, not vapour loss.'
  if (c.task === 'match') {
    const near = Math.abs(rate - c.target) > 0.005
    const opening = near
      ? `Near enough: ${rateText(rate)} mm/min; the exact aim is ${rateText(c.target)} mm/min.`
      : `Yes. ${rateText(rate)} mm/min at ${valueText(c, level)}.`
    return `${opening} ${mechanism} ${stream}`
  }
  return `Yes. ${rateText(rate)} mm/min, ${Math.abs(level - baseOf(c))} ${Math.abs(level - baseOf(c)) === 1 ? 'step' : 'steps'} from room conditions. ${mechanism} ${stream}`
}

export function madeText(c: PlantConfig, state: PlantState): string {
  const level = levelOf(c, state)
  if (level < 0) return 'No working setting has been made yet.'
  const rate = rateAt(c, level)
  if (c.task === 'match') {
    return `You set ${valueText(c, level)}, giving ${rateText(rate)} mm/min. The aim is ${rateText(c.target)} ± ${MATCH_TOLERANCE.toFixed(1)} mm/min.`
  }
  if (rate + 1e-9 < c.target) {
    return `You set ${valueText(c, level)}, giving ${rateText(rate)} mm/min, below the aim of ${rateText(c.target)} mm/min.`
  }
  return `You reached ${rateText(rate)} mm/min with ${Math.abs(level - baseOf(c))} steps from room conditions. The same aim can be reached with a smaller change.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's semantic config.

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const keyOf = (raw: unknown) => (typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'match' | 'limit'> = {
  match: 'match', 'match-rate': 'match', target: 'match', 'target-rate': 'match', potometer: 'match',
  transpiration: 'match', 'water-uptake': 'match', uptake: 'match', measure: 'match', rate: 'match',
  limit: 'limit', minimum: 'limit', 'minimum-change': 'limit', fewest: 'limit', 'fewest-steps': 'limit',
  efficient: 'limit', investigate: 'limit', factor: 'limit', factors: 'limit', 'factors-affecting-transpiration': 'limit',
}
const FACTOR_WORDS: Record<string, Factor> = {
  wind: 'wind', windy: 'wind', 'wind-speed': 'wind', air: 'wind', 'air-movement': 'wind', fan: 'wind',
  temperature: 'temperature', temp: 'temperature', heat: 'temperature', heater: 'temperature', warmth: 'temperature',
  light: 'light', 'light-intensity': 'light', lamp: 'light', brightness: 'light',
  humidity: 'humidity', 'relative-humidity': 'humidity', 'moist-air': 'humidity', humid: 'humidity',
}

function readTarget(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:mm(?:(?:\/|\s*(?:per\s*)?)(?:min|minute))?)$/i)
    return m ? Number(m[1]) + 0 : null
  }
  return typeof raw === 'number' && Number.isFinite(raw) ? raw + 0 : null
}

export function goodPrompt(c: PlantConfig): string {
  const f = factorOf(c)
  const name = FACTOR_NAMES[f].toLowerCase()
  if (c.task === 'match') {
    return `Tap + or − to change the ${name}. Make the water uptake as close to ${rateText(c.target)} mm/min as you can.`
  }
  return `Tap + or − to change the ${name}. Reach at least ${rateText(c.target)} mm/min of water uptake with as few steps from room conditions as you can.`
}

export const plantTransportEngine: SceneEngine<PlantConfig, PlantState> = {
  id: 'plant-transport',
  // Distinctive words in covers; everything whose words could belong elsewhere stays a whole phrase.
  covers: ['xylem', 'phloem', 'transpiration', 'translocation', 'potometer', 'potometers'],
  phrases: [
    'transport in plants', 'plant transport', 'water uptake by roots', 'water uptake', 'root hair cells', 'root hairs',
    'transpiration pull', 'transpiration stream', 'factors affecting transpiration', 'rate of transpiration',
    'water movement in plants', 'water transport in plants', 'xylem and phloem', 'source to sink', 'sources and sinks',
  ],
  notFor: [
    'photosynthesis', 'limiting factors', 'limiting factor', 'light dependent', 'calvin cycle', 'chlorophyll', 'test for starch',
    'osmosis in single cells', 'single cells', 'plasmolysis', 'turgidity', 'gas exchange in leaves', 'gas exchange', 'stomatal gas exchange',
    'water cycle', 'water cycles', 'hydrological cycle', 'hydrologic cycle', 'precipitation', 'condensation',
    'circulation of blood', 'blood circulation', 'double circulation', 'circulatory system', 'transpiration in humans',
    'mineral deficiency', 'plant nutrition', 'leaf structure', 'adaptations to photosynthesis',
  ],
  // The learner varies one environmental quantity and observes its consequence for the water stream.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type', 'name'] : ['task', 'kind', 'type', 'mode', 'experiment'])
    if (rawTask !== undefined && typeof rawTask !== 'string') return null
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const rawFactor = first(src, ['factor', 'vary', 'variable', 'change', 'condition'])
    if (rawFactor !== undefined && typeof rawFactor !== 'string') return null
    const fk = keyOf(rawFactor)
    const factor = !fk ? 'wind' : has(FACTOR_WORDS, fk) ? FACTOR_WORDS[fk] : fk
    const task = word ? TASK_WORDS[word] : 'match'
    const rawTarget = first(src, ['target', 'aim', 'rate', 'uptake'])
    const target = rawTarget === undefined ? (task === 'match' ? 1 : 1.2) : readTarget(rawTarget)
    return target === null ? null : { task, factor, target }
  },

  faults(c) {
    const out: string[] = []
    if (!isFactor(c.factor)) {
      out.push(`There is no "${c.factor}" control on this potometer: use factor wind, temperature, light or humidity, e.g. factor "wind".`)
      return out
    }
    if (!Number.isFinite(c.target)) {
      out.push('The uptake target must be a number of mm/min, e.g. target 1.')
      return out
    }
    if (c.task === 'match') {
      const near = nearestLevel(c)
      const gap = Math.abs(rateAt(c, near) - c.target)
      if (c.target <= 0 || gap > MATCH_TOLERANCE + 1e-9) {
        out.push(`No setting comes within ${MATCH_TOLERANCE.toFixed(1)} mm/min of ${c.target}: use e.g. target 1, which this factor can match.`)
      }
    } else {
      const levels = levelsOf(c)
      if (c.target <= levels[baseOf(c)].rate + 1e-9) {
        out.push(`The aim ${c.target} mm/min is already true at room conditions, so there is nothing to change: use e.g. target 1.2.`)
      } else if (neededLevel(c) < 0) {
        out.push(`The aim ${c.target} mm/min is beyond this factor's strongest setting (${Math.max(...levels.map((l) => l.rate)).toFixed(2)} mm/min): use e.g. target 1.2.`)
      }
    }
    return out
  },

  promptFaults(c, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(c)
    const out: string[] = []
    const f = factorOf(c)
    const solution = c.task === 'match' ? nearestLevel(c) : neededLevel(c)
    const value = valueAt(c, Math.max(0, solution))
    const unit = UNITS[f].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const number = String(value).replace(/\./g, '\\.')
    const exact = new RegExp(`\\b${number}\\s*${unit}\\b`, 'i').test(text)
    const direction = /\b(?:more|higher|increase[sd]?|raise[sd]?|stronger|brighter|warmer|hotter|less|lower|decrease[sd]?|reduce[sd]?|dimmer|cooler|colder|drier|more humid)\s+(?:the\s+)?(?:wind|air movement|temperature|heat|light|light intensity|humidity)\b/i.test(text)
      || /\b(?:wind|air movement|temperature|heat|light|light intensity|humidity)\s+(?:increases|decreases|speeds|slows|raises|lowers)\b/i.test(text)
    const count = /\b(?:\d+|one|two|three|four|five|six)\s+(?:steps?|taps?|clicks?)\b/i.test(text)
    const reason = /\bbecause\b|\bcohesion\b|\btranspiration pull\b|\bstomata\b|\bmesophyll\b|\bkinetic energy\b|\bdiffusion gradient\b/i.test(text)
    if (exact || direction || count || reason) {
      out.push(`the prompt gives the answer away: it names the setting, its direction, the number of steps or the mechanism, which the learner is to find -- ask for the outcome only ("${example}")`)
    }
    if (/\bdrag\b|\bslide\b|\bslider\b|\bstopwatch\b|\bgraph\b|\btable\b|\bweigh|\broot hairs?\b|\bsoil\b|\bphloem\b|\btranslocation\b|\bfruit\b|\bflash cards?\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws a cut shoot in a potometer and one environmental control, used with + and − -- ask for that ("${example}")`)
    }
    const named = FACTORS.filter((x) => new RegExp(`\\b${x === 'wind' ? 'wind|air movement|fan' : x === 'temperature' ? 'temperature|heat|heater' : x === 'light' ? 'light|lamp|brightness' : 'humidity|humid|moist air'}\\b`, 'i').test(text))
    if (named.length > 0 && !named.includes(f)) {
      out.push(`the prompt names ${named.join(' and ')}, but this card changes ${FACTOR_NAMES[f].toLowerCase()} -- name that control ("${example}")`)
    }
    return out
  },

  initial(c) {
    // A clearly wrong opening setting, not the room condition if that happens to match.
    const base = baseOf(c)
    if (c.task === 'match' && Math.abs(rateAt(c, base) - c.target) > MATCH_TOLERANCE) return { level: base }
    if (c.task === 'limit' && rateAt(c, base) < c.target) return { level: base }
    return { level: base === 0 ? Math.min(1, levelsOf(c).length - 1) : 0 }
  },

  check(c, state) {
    const ok = done(c, state)
    return { ok, wrongIds: ok ? [] : ['level'] }
  },

  solve(c) {
    return { level: c.task === 'match' ? nearestLevel(c) : Math.max(0, neededLevel(c)) }
  },

  View: PlantTransportView,

  prompt: `SCENE "plant-transport" -- a leafy cut shoot in a glass bubble potometer on a quiet light panel. A continuous blue xylem stream climbs the stem while water vapour leaves the leaves and the air bubble travels along the graduated capillary. One environmental device is drawn: a fan, heater and thermometer, lamp, or humidity dome and hygrometer. A + / − stepper changes wind speed (0–4 m/s), temperature (10–40 °C), light intensity (0–1000 lx) or humidity (30–90%). Every step visibly changes the plant, vapour, stream and bubble speed. A live readout says "Water uptake" in mm/min. Reduced motion gives still frames that change with every setting.
  For: transpiration, the transpiration stream and pull, cohesion in xylem, measuring water uptake with a potometer, and how wind speed, temperature, light intensity and humidity affect transpiration. It answers "roots pump water up", "the potometer measures vapour directly", and "more humidity means faster transpiration". Xylem carries water and mineral ions up from roots in the marked explanation; root hairs, phloem and translocation are NOT drawn, so do not promise them.
  match: make the live uptake as close as possible to target mm/min, within a visible ±0.10 mm/min band. factor: wind, temperature, light or humidity. target: a number that a setting can match within 0.10; default 1.0.
  limit: reach at least target mm/min with as few steps as possible from the labelled room conditions. The aim must be above the starting rate and no higher than this factor can reach; default 1.2. Marking accepts only the smallest departure from room conditions.
  Before marking the card shows the apparatus, factor value, room conditions, live uptake and target. It holds back which setting is needed, the direction of the factor's effect, and the words for the mechanism. Marking states the result and explains evaporation from mesophyll, diffusion through stomata, transpiration pull, cohesion, and why a potometer measures uptake rather than vapour directly.
  The prompt must name the factor, target and + / − gesture only. Do NOT give the needed setting, direction, number of steps or mechanism. Do NOT ask for dragging, timing, graphs, tables, roots, soil, phloem or translocation.
  config: { "task":"match", "factor":"wind", "target":1.0 }  -- the prompt says "${goodPrompt({ task: 'match', factor: 'wind', target: 1 })}"
       or { "task":"match", "factor":"light", "target":0.95 }  -- the prompt says "${goodPrompt({ task: 'match', factor: 'light', target: 0.95 })}"
       or { "task":"limit", "factor":"temperature", "target":1.2 }  -- the prompt says "${goodPrompt({ task: 'limit', factor: 'temperature', target: 1.2 })}"
       or { "task":"limit", "factor":"humidity", "target":1.2 }  -- the prompt says "${goodPrompt({ task: 'limit', factor: 'humidity', target: 1.2 })}"
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'match', factor: 'wind', target: 1 })}",
    "payload": { "engine":"plant-transport", "config": { "task":"match", "factor":"wind", "target":1.0 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:plant-transport", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'match', factor: 'light', target: 0.95 })}",
    "payload": { "engine":"plant-transport", "config": { "task":"match", "factor":"light", "target":0.95 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:plant-transport", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'limit', factor: 'temperature', target: 1.2 })}",
    "payload": { "engine":"plant-transport", "config": { "task":"limit", "factor":"temperature", "target":1.2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:plant-transport", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'limit', factor: 'humidity', target: 1.2 })}",
    "payload": { "engine":"plant-transport", "config": { "task":"limit", "factor":"humidity", "target":1.2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:plant-transport", "why":"..." } }`,
}

registerEngine(plantTransportEngine as SceneEngine<unknown, unknown>)
