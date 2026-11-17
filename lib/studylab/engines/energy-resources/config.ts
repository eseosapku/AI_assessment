// lib/studylab/engines/energy-resources/config.ts
//
// Power the Valley (see .superpowers/bakeoff/energy-resources/design.md).
// The student builds wind turbines, rows of solar panels and coal power stations for a six-home valley town, and the town
// answers for each time of day the task sets: homes light only when there is enough electricity, and coal chimneys smoke,
// adding CO2, whenever coal fills the gap. Wind and sun fail on a still, dark evening and coal always smokes, so only a mix works.
//
// The numbers (computed here, never read from the drawing):
//   the town needs 6 homes' worth at every time; each built station makes up to 3 homes' worth;
//   wind turbine: 3 when windy, 0 when still;
//   solar row: 3 at noon and clear, 1 at noon and cloudy, 0 in the evening and at night (after sunset);
//   coal: turned up only as far as needed. CO2 is the coal's homes' worth added up over the task's times.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { EnergyView } from './View'

export type Time = 'noon' | 'evening' | 'night'
export type Wind = 'still' | 'windy'
export type Sky = 'clear' | 'cloudy'
/** A moment as the tutor may write it: read broadly, then refused by faults when it cannot be drawn. */
export type MomentIn = { time: string; wind: string; sky: string }
export type Moment = { time: Time; wind: Wind; sky: Sky }

export type PowerConfig = { kind: 'power-town'; moments: MomentIn[]; maxCo2: number | null; plots: number }
export type PowerState = { turbines: number; panels: number; coal: number; shown: number }

export const HOMES = 6
export const PER = 3
export const MAX_EACH = 3
export const DEFAULT_PLOTS = 4
export const MAX_CO2 = 54
export const TIMES: Time[] = ['noon', 'evening', 'night']
const WINDS: Wind[] = ['still', 'windy']
const SKIES: Sky[] = ['clear', 'cloudy']

// ---------------------------------------------------------------------------
// The model.

/** Homes' worth one row of solar panels makes. */
export function solarOf(time: Time, sky: Sky): number {
  if (time !== 'noon') return 0
  return sky === 'clear' ? 3 : 1
}

/** What the wind and the sun make together at a moment, before any coal. */
export function renewAt(m: Moment, s: Pick<PowerState, 'turbines' | 'panels'>): number {
  return PER * s.turbines * (m.wind === 'windy' ? 1 : 0) + s.panels * solarOf(m.time, m.sky)
}

/** What the coal makes at a moment: only as much as is needed, up to what is built. */
export function coalAt(m: Moment, s: Pick<PowerState, 'turbines' | 'panels' | 'coal'>): number {
  return Math.min(PER * s.coal, Math.max(0, HOMES - renewAt(m, s)))
}

export function litAt(m: Moment, s: Pick<PowerState, 'turbines' | 'panels' | 'coal'>): number {
  return Math.min(HOMES, renewAt(m, s) + coalAt(m, s))
}

export function co2Of(moments: Moment[], s: Pick<PowerState, 'turbines' | 'panels' | 'coal'>): number {
  return moments.reduce((sum, m) => sum + coalAt(m, s), 0)
}

const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_EACH
const isTime = (v: unknown): v is Time => TIMES.includes(v as Time)
const isWind = (v: unknown): v is Wind => WINDS.includes(v as Wind)
const isSky = (v: unknown): v is Sky => SKIES.includes(v as Sky)

/** The state, read safely: anything corrupt reads as nothing built, the first time shown. */
export function readState(state: Partial<PowerState> | null | undefined): PowerState {
  const c = (v: unknown) => (isCount(v) ? (v as number) : 0)
  const sh = typeof state?.shown === 'number' && Number.isInteger(state.shown) && state.shown >= 0 && state.shown <= 2 ? state.shown : 0
  return { turbines: c(state?.turbines), panels: c(state?.panels), coal: c(state?.coal), shown: sh }
}

/** The moments of a config the card can draw (faults is empty). */
export function momentsOf(config: PowerConfig): Moment[] {
  return config.moments.map((m) => ({ time: m.time as Time, wind: m.wind as Wind, sky: m.sky as Sky }))
}

export const stationsOf = (s: Pick<PowerState, 'turbines' | 'panels' | 'coal'>) => s.turbines + s.panels + s.coal

/** Every build that fits the plots, in the order solve prefers: least CO2, fewest stations, fewest coal, fewest turbines. */
function bestBuild(moments: Moment[], plots: number, maxCo2: number | null): { s: PowerState; co2: number } | null {
  let best: { s: PowerState; co2: number } | null = null
  const key = (b: { s: PowerState; co2: number }) => [b.co2, stationsOf(b.s), b.s.coal, b.s.turbines]
  for (let turbines = 0; turbines <= MAX_EACH; turbines++) {
    for (let panels = 0; panels <= MAX_EACH; panels++) {
      for (let coal = 0; coal <= MAX_EACH; coal++) {
        if (turbines + panels + coal > plots) continue
        const s = { turbines, panels, coal, shown: 0 }
        if (!moments.every((m) => litAt(m, s) === HOMES)) continue
        const co2 = co2Of(moments, s)
        if (maxCo2 !== null && co2 > maxCo2) continue
        const cand = { s, co2 }
        if (!best) { best = cand; continue }
        const a = key(cand)
        const b = key(best)
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) { if (a[i] < b[i]) best = cand; break }
        }
      }
    }
  }
  return best
}

export function done(config: PowerConfig, state: Partial<PowerState> | null | undefined): boolean {
  if (faults(config).length) return false
  const raw = state ?? {}
  if (!isCount(raw.turbines) || !isCount(raw.panels) || !isCount(raw.coal)) return false
  const s = readState(raw)
  if (stationsOf(s) > config.plots) return false
  const moments = momentsOf(config)
  if (!moments.every((m) => litAt(m, s) === HOMES)) return false
  return config.maxCo2 === null || co2Of(moments, s) <= config.maxCo2
}

// ---------------------------------------------------------------------------
// Words on the card. Before marking, only observations; never right or wrong.

const TIME_WORD: Record<Time, string> = { noon: 'Noon', evening: 'Evening, after sunset', night: 'Night' }
/** "at noon", "in the evening", "at night". */
export const timeAt = (t: Time) => (t === 'evening' ? 'in the evening' : t === 'night' ? 'at night' : 'at noon')
export const timeName = (t: Time) => (t === 'noon' ? 'Noon' : t === 'evening' ? 'Evening' : 'Night')
const homes = (k: number) => `${k} home${k === 1 ? '' : 's'}`
const list = (parts: string[]) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)
const plural = (k: number, one: string, many: string) => (k === 1 ? one : many)

/** The times of a task in words: "at noon, in the evening and at night". */
export function whenText(moments: Moment[]): string {
  return list(moments.map((m) => timeAt(m.time)))
}

export function goalText(config: PowerConfig): string {
  const moments = momentsOf(config)
  const base = `Light every home ${whenText(moments)}`
  if (config.maxCo2 === null) return base
  return config.maxCo2 === 0 ? `${base}, with no CO2` : `${base}, with no more than ${config.maxCo2} units of CO2`
}

/** What the CO2 total is called: "today" for several times, the one time otherwise. */
export function co2Label(moments: Moment[]): string {
  if (moments.length > 1) return 'CO2 today'
  return moments[0].time === 'evening' ? 'CO2 this evening' : moments[0].time === 'night' ? 'CO2 tonight' : 'CO2 at noon'
}

/** What the picture shows at the shown moment, as an observation. */
export function captionText(config: PowerConfig, state: Partial<PowerState> | null | undefined): string {
  const moments = momentsOf(config)
  const s = readState(state)
  const m = moments[Math.min(s.shown, moments.length - 1)]
  const head = `${TIME_WORD[m.time]}, ${m.wind} and ${m.sky}.`
  if (stationsOf(s) === 0) return `${head} Nothing is built yet, so the town has no power. Each station makes up to ${PER} homes' worth.`
  const parts: string[] = []
  if (s.turbines > 0) parts.push(m.wind === 'windy' ? plural(s.turbines, 'turbine turning', 'turbines turning') : plural(s.turbines, 'rotor still', 'rotors still'))
  if (s.panels > 0) parts.push(m.time === 'noon' ? (m.sky === 'clear' ? 'panels in full sun' : 'panels under cloud') : 'panels dark')
  if (s.coal > 0) {
    const out = coalAt(m, s)
    parts.push(out > 0 ? `coal burning for ${homes(out)}` : plural(s.coal, 'coal station idle', 'coal stations idle'))
  }
  const lit = litAt(m, s)
  const tail = lit < HOMES ? ` ${lit} of ${HOMES} homes have power.` : ''
  return `${head} ${parts.map((p, i) => (i === 0 ? p[0].toUpperCase() + p.slice(1) : p)).join(', ')}.${tail}`
}

export type Verdict =
  | { kind: 'empty' }
  | { kind: 'dark'; at: number; lit: number }
  | { kind: 'co2'; co2: number }
  | { kind: 'pass'; co2: number }

/** What marking found: nothing built, the first time homes went dark, too much CO2, or a pass. */
export function verdictOf(config: PowerConfig, state: Partial<PowerState> | null | undefined): Verdict {
  const s = readState(state)
  if (stationsOf(s) === 0) return { kind: 'empty' }
  const moments = momentsOf(config)
  const at = moments.findIndex((m) => litAt(m, s) < HOMES)
  if (at >= 0) return { kind: 'dark', at, lit: litAt(moments[at], s) }
  const co2 = co2Of(moments, s)
  if (config.maxCo2 !== null && co2 > config.maxCo2) return { kind: 'co2', co2 }
  return { kind: 'pass', co2 }
}

export function verdictText(config: PowerConfig, state: Partial<PowerState> | null | undefined): string {
  if (faults(config).length) return ''
  const moments = momentsOf(config)
  const v = verdictOf(config, state)
  const units = (k: number) => `${k} unit${k === 1 ? '' : 's'} of CO2`
  if (v.kind === 'empty') return 'There were no power stations, so no home had power.'
  if (v.kind === 'dark') {
    return `Homes went dark ${timeAt(moments[v.at].time)}: only ${v.lit} of ${HOMES} had power.`
  }
  const all = `Every home stayed lit ${whenText(moments)}.`
  if (v.kind === 'co2') return `All homes were lit, but coal made ${units(v.co2)} against a limit of ${config.maxCo2}.`
  if (config.maxCo2 === null) return `${all} Coal made ${units(v.co2)}.`
  return `${all} Coal made ${units(v.co2)}, within the limit of ${config.maxCo2}.`
}

/** Which moment the card should be showing once marked: the first where homes went dark, else the one the student chose. */
export function jumpTo(config: PowerConfig, state: Partial<PowerState> | null | undefined): number | null {
  const v = verdictOf(config, state)
  return v.kind === 'dark' ? v.at : null
}

export function describe(config: PowerConfig, state: Partial<PowerState> | null | undefined): string {
  const s = readState(state)
  return `A valley town of ${HOMES} homes with ${s.turbines} wind turbine${s.turbines === 1 ? '' : 's'}, ${s.panels} row${s.panels === 1 ? '' : 's'} of solar panels and ${s.coal} coal power station${s.coal === 1 ? '' : 's'}, on ${config.plots} places.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const hasWord = (key: string, words: string[]) => key.split('-').some((w) => words.includes(w))
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '')

function readTime(raw: unknown): string {
  const key = keyOf(raw)
  if (hasWord(key, ['noon', 'midday', 'day', 'daytime', 'afternoon', 'morning', 'sunny'])) return 'noon'
  if (hasWord(key, ['evening', 'dusk', 'sunset', 'twilight'])) return 'evening'
  if (hasWord(key, ['night', 'midnight', 'tonight'])) return 'night'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}
function readWind(raw: unknown): string {
  if (typeof raw === 'boolean') return raw ? 'windy' : 'still'
  const key = keyOf(raw)
  if (hasWord(key, ['still', 'calm', 'none', 'no']) ) return 'still'
  if (hasWord(key, ['windy', 'wind', 'breezy', 'blustery', 'gusty', 'yes'])) return 'windy'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}
function readSky(raw: unknown): string {
  const key = keyOf(raw)
  if (hasWord(key, ['cloudy', 'overcast', 'cloud', 'grey', 'gray'])) return 'cloudy'
  if (hasWord(key, ['clear', 'sunny', 'bright', 'fine', 'cloudless'])) return 'clear'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}
function readMoment(raw: unknown): MomentIn | null {
  if (typeof raw === 'string') return { time: readTime(raw), wind: 'still', sky: 'clear' }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const t = first(o, ['time', 'when', 'timeOfDay'])
  if (t === undefined) return null
  const w = first(o, ['wind', 'windy'])
  const k = first(o, ['sky', 'weather', 'cloud'])
  return { time: readTime(t), wind: w === undefined ? 'still' : readWind(w), sky: k === undefined ? 'clear' : readSky(k) }
}
/** A whole number: 6, "6", "6 units". Unreadable is -1. */
function readNumber(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : -1
  if (typeof raw !== 'string') return -1
  const m = raw.trim().toLowerCase().match(/^(-?\d+(?:\.\d+)?)\s*(?:units?|places?|plots?)?$/)
  return m ? Number(m[1]) : -1
}

const EX_MOMENTS = '[{"time":"noon","wind":"still","sky":"clear"},{"time":"evening","wind":"still","sky":"clear"}]'
const EXAMPLE_FIX = `{ "kind":"power-town", "moments":${EX_MOMENTS}, "maxCo2":6 }`

function faults(config: PowerConfig): string[] {
  const out: string[] = []
  const ms = config.moments
  let readable = true
  if (!Array.isArray(ms) || ms.length < 1 || ms.length > 3) {
    out.push(`A town day has 1 to 3 moments, in day order (noon, evening, night): use ${EXAMPLE_FIX}.`)
    readable = false
  } else {
    ms.forEach((m, i) => {
      if (!isTime(m.time)) { out.push(`Moment ${i + 1} has the time "${m.time}"; use "noon", "evening" or "night", e.g. ${EXAMPLE_FIX}.`); readable = false }
      if (!isWind(m.wind)) { out.push(`Moment ${i + 1} has the wind "${m.wind}"; use "still" or "windy", e.g. "wind":"still".`); readable = false }
      if (!isSky(m.sky)) { out.push(`Moment ${i + 1} has the sky "${m.sky}"; use "clear" or "cloudy", e.g. "sky":"clear".`); readable = false }
    })
    if (readable) {
      const idx = ms.map((m) => TIMES.indexOf(m.time as Time))
      if (idx.some((v, i) => i > 0 && v <= idx[i - 1])) {
        out.push(`The moments must be in day order (noon, then evening, then night) with each time used once, not ${ms.map((m) => m.time).join(', ')}: use ${EXAMPLE_FIX}.`)
        readable = false
      }
    }
  }
  const plotsOk = Number.isInteger(config.plots) && config.plots >= 2 && config.plots <= 6
  if (!plotsOk) out.push(`The valley has room for 2 to 6 stations, not ${config.plots}: use "plots":4.`)
  const co2Ok = config.maxCo2 === null || (Number.isInteger(config.maxCo2) && config.maxCo2 >= 0 && config.maxCo2 <= MAX_CO2)
  if (!co2Ok) out.push(`The CO2 limit is null (no limit) or a whole number from 0 to ${MAX_CO2}, not ${config.maxCo2}: use "maxCo2":6.`)
  if (readable && plotsOk && co2Ok && !bestBuild(momentsOf(config), config.plots, config.maxCo2)) {
    const free = bestBuild(momentsOf(config), config.plots, null)
    out.push(`No mix of stations lights every home within a CO2 limit of ${config.maxCo2}: raise it to ${free ? free.co2 : 6}, e.g. "maxCo2":${free ? free.co2 : 6}, or use "maxCo2":null.`)
  }
  return out
}

// ---------------------------------------------------------------------------
// Prompts.

/** The answer-giving words: a station next to a number or a build verb, what fails, the lesson itself. */
const STATION_TELLS = [
  /\b(one|two|three|[1-3])\s+(coal|wind|solar|turbines?|panels?|stations?)\b/i,
  /\b(use|build|add|need|choose|try)\s+(a\s+|the\s+|some\s+)?(coal|wind|solar)\b/i,
]
const FAIL_TELLS = [/\b(won'?t|doesn'?t|don'?t|can'?t|cannot)\s+work\b/i, /\buseless\b/i, /\bmakes? nothing\b/i, /\bstops?\b/i]
const LESSON_TELLS = [/\b(backup|reliable|unreliable|depends on the weather|no sun at night|sun (has )?set)\b/i]

export const EXAMPLES: { prompt: string; config: PowerConfig }[] = [
  {
    prompt: 'A still, dark winter evening. Tap the + buttons to build power stations until every home in the town is lit.',
    config: { kind: 'power-town', moments: [{ time: 'evening', wind: 'still', sky: 'clear' }], maxCo2: null, plots: 4 },
  },
  {
    prompt: 'A sunny, still noon. Use the + buttons to light every home without making any CO2.',
    config: { kind: 'power-town', moments: [{ time: 'noon', wind: 'still', sky: 'clear' }], maxCo2: 0, plots: 4 },
  },
  {
    prompt: 'Keep every home lit at noon and in the evening, with no more than 6 units of CO2. Build with the + buttons, then tap each time of day to watch.',
    config: { kind: 'power-town', moments: [{ time: 'noon', wind: 'still', sky: 'clear' }, { time: 'evening', wind: 'still', sky: 'clear' }], maxCo2: 6, plots: 4 },
  },
  {
    prompt: 'Light every home at noon, in the evening and at night, with no more than 6 units of CO2. Build with the + buttons and tap each time to watch.',
    config: {
      kind: 'power-town',
      moments: [{ time: 'noon', wind: 'windy', sky: 'cloudy' }, { time: 'evening', wind: 'windy', sky: 'clear' }, { time: 'night', wind: 'still', sky: 'clear' }],
      maxCo2: 6,
      plots: 4,
    },
  },
]

function promptFaults(config: PowerConfig, prompt: string): string[] {
  const text = prompt.replace(/\s+/g, ' ')
  const found = [...STATION_TELLS, ...FAIL_TELLS, ...LESSON_TELLS].map((r) => text.match(r)?.[0]).filter((w): w is string => !!w)
  const out: string[] = []
  if (found.length) out.push(`the prompt gives the answer away with ${found.map((w) => `"${w}"`).join(', ')}: say only the weather, the goal and the gesture, e.g. "${EXAMPLES[0].prompt}"`)
  // Say the gesture, in any plain words: the + buttons, or building; tapping or choosing the times of day.
  if (!/\+|button|build/i.test(text)) out.push(`the prompt must name the + buttons, e.g. "${EXAMPLES[0].prompt}"`)
  if (config.moments.length > 1 && !/\b(tap|press|choose|pick)\b|each time|time of day/i.test(text)) out.push(`the prompt must say to tap each time of day, e.g. "${EXAMPLES[2].prompt}"`)
  return out
}

const catalogue = EXAMPLES.map((e, i) => `  ${i === 0 ? '   ' : 'or '}${JSON.stringify(e.config)}  -- the prompt says "${e.prompt}"`).join('\n')

export const energyEngine: SceneEngine<PowerConfig, PowerState> = {
  id: 'energy-resources',
  covers: ['nonrenewable', 'renewables'],
  phrases: [
    'energy resources', 'energy resource', 'sources of energy', 'energy sources', 'renewable energy', 'renewable energy sources', 'renewable and non-renewable',
    'non-renewable energy', 'non-renewable resources', 'fossil fuels', 'fossil fuel', 'generating electricity', 'electricity generation', 'power station', 'power stations',
    'energy mix', 'wind power', 'wind energy', 'wind turbines', 'solar power', 'solar energy', 'solar panels', 'coal power', 'advantages and disadvantages of energy resources',
  ],
  notFor: [
    'energy stores', 'energy transfers', 'efficiency', 'transformers', 'national grid', 'greenhouse effect', 'global warming', 'climate change', 'fossil record', 'fossil evidence',
    'fossils', 'solar system', 'solar eclipse', 'electricity bills', 'cost of electricity', 'electrical power', 'energy in food', 'nuclear fission', 'nuclear fusion', 'nuclear power', 'urban renewal',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = (Array.isArray(raw) ? { moments: raw } : raw) as Record<string, unknown>
    const m = first(o, ['moments', 'times', 'timesOfDay', 'day'])
    let moments: MomentIn[] | null = null
    if (Array.isArray(m)) {
      const read = m.map(readMoment)
      moments = read.every((x) => x !== null) ? (read as MomentIn[]) : null
    } else if (m !== undefined) {
      const one = readMoment(m)
      moments = one ? [one] : null
    } else {
      const one = readMoment(o)
      moments = one ? [one] : null
    }
    if (moments === null) return null
    const lim = first(o, ['maxCo2', 'co2Limit', 'maxCO2', 'limit', 'co2'])
    const maxCo2 = lim === undefined || (typeof lim === 'string' && /^(none|no limit|null|unlimited)$/i.test(lim.trim())) ? null : readNumber(lim)
    const p = first(o, ['plots', 'places', 'room', 'sites'])
    return { kind: 'power-town', moments, maxCo2, plots: p === undefined ? DEFAULT_PLOTS : readNumber(p) }
  },

  faults,
  promptFaults,

  initial() {
    return { turbines: 0, panels: 0, coal: 0, shown: 0 }
  },

  check(config, state) {
    const ok = done(config, state)
    return { ok, wrongIds: ok ? [] : ['mix'] }
  },

  solve(config) {
    const best = bestBuild(momentsOf(config), config.plots, config.maxCo2)
    return best ? best.s : { turbines: 0, panels: 0, coal: 0, shown: 0 }
  },

  View: EnergyView,

  prompt: `SCENE "energy-resources" -- a valley town of six homes, with a ridge for wind turbines, a slope for rows of solar panels and a river for coal power stations. The learner taps + and - to build up to three of each (a limited number of places in all), and the town answers: the shown time of day plays out (the sun sinks behind the hills), homes light only when there is enough electricity for them, and coal chimneys smoke, adding CO2, whenever coal fills the gap. Each station makes up to 3 homes' worth; the town needs 6 at every time. Wind makes power only when it blows, solar only in daylight (less under cloud), coal whenever it is wanted. A task may have one, two or three times (noon, evening, night) and an optional CO2 limit; with two or more, the learner taps each time to watch it.
  Task: one kind, "power-town": light every home at every time of the task, within the CO2 limit if there is one, with the places given.
  For: energy resources, renewable and non-renewable energy, generating electricity, power stations, wind and solar power, fossil fuels, why a mix of sources is used. It answers "wind and solar are always enough" and "coal is the only dependable source".
  Before marking the card shows the weather, a caption, the goal, homes lit now, the CO2 total and the places left, and never says right or wrong. The prompt must say the weather, the goal and the gesture (the + buttons, and to tap each time when there are several): do NOT name a station next to a number or a build verb ("use solar", "two coal"), say what fails or stops ("wind won't work", "useless"), or name the lesson ("backup", "reliable", "no sun at night", "the sun has set").
  Not drawn: nuclear, hydroelectric, biomass or geothermal power; storage batteries; cost; the national grid; more than three times of day.
  config examples (moments in day order; "plots" defaults to 4, "maxCo2" to null):
${catalogue}
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${EXAMPLES[2].prompt}",
    "payload": { "engine":"energy-resources", "config": ${JSON.stringify(EXAMPLES[2].config)} },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:energy-resources", "why":"..." } }`,
}

registerEngine(energyEngine as SceneEngine<unknown, unknown>)
