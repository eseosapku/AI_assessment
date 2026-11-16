// lib/studylab/engines/stocks-flows/config.ts
//
// A store with a flow in and a flow out: a glass tank, a bath, a lake, a herd, the air. The learner turns the two valves
// (whole steps on a stepper) and watches the level after a stretch of time, which they can scrub:
//   balance -- the flow in is fixed; set the other so the level stays where it began. A steady level does not mean no
//              flow: water is still running in and out at the same rate;
//   reach   -- one flow is fixed, the other is the learner's; bring the level to the aim line. The turn-it-down case:
//              the level can still rise (or fall) with the tap on, because it follows the gap between in and out.
//
// The rules, all computed here and never read from the drawing:
//   level after t steps = start + (in - out) * t, in whole units, clamped to the tank only for the picture
//   (a tank cannot hold less than nothing or more than its brim; with constant flows that clamp is exact);
//   the card is right when the unclamped level at the end equals the target (the start level, or the aim line).
//   Every flow is a whole number of notches, so marking never compares a float.
//
// Facts: none from data. The numbers are stylised and the card never says they are measured. Each setting's units
// keep rateScale x timeStep = levelScale, so the picture and the readouts agree (carbon: 4 Gt a year over 25 years is 100 Gt).
//
// Ideas taken, never code or art:
//   - the misconception: people expect the stock to follow the inflow, not the net of in and out. Booth Sweeney & Sterman,
//     "Bathtub dynamics: initial results of a systems thinking inventory" (System Dynamics Review, 2000); Cronin, Gonzalez
//     & Sterman (2009), who found it even in the simplest tasks. The card makes the gap visible as a level that moves;
//   - the same trap in climate: "turning down emissions" is read as the CO2 falling, when the stock only stops growing when
//     the taps match the plug. The Grantham Research Institute's explainer on climate as a stock-flow problem; the Climate
//     Interactive "Bathtub" sim facilitators' guide; Wisconsin GLBRC research brief on students' carbon cycle reasoning
//     (few leave school with a pool-and-flux model; most predict CO2 falls when emissions are cut);
//   - the acted-out bathtub game of the Systems Thinking Playbook, as a body-sized version of one tap and one drain.
// Refused:
//   - sketching the stock's graph from flow graphs: the classic test, but a drawing task with no way to mark by rule here;
//   - feedback loops (flows that depend on the level), growth curves and equations: they are a second idea. The card's flows
//     are constant, so it does not teach exponential growth or logistic curves and says so in `notFor`;
//   - the economics of stocks and flows (capital stock, circular flow): `macro-board` has a water tank of its own for that.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { StocksFlowsView } from './View'

export const TASKS = ['balance', 'reach'] as const
export type TaskName = (typeof TASKS)[number]
export const SETTINGS = ['bath', 'lake', 'population', 'carbon'] as const
export type SettingName = (typeof SETTINGS)[number]

export type StocksConfig = {
  task: TaskName
  /** A word outside the list still parses, and faults says what would work. */
  setting: string
  /** Which of the task's prepared problems, counting from 1. */
  variant: number
}

/** What the learner has set: the two flows in whole notches, and the moment on the time slider (marking ignores it). */
export type StocksState = { tap: number; drain: number; t: number }

export const CAP = 10
export const RATE_MAX = 5
export const STEPS = 3

type Case = {
  start: number
  tap: number
  drain: number
  /** The flow the learner turns. The other one is fixed. */
  adjust: 'tap' | 'drain'
  /** The level to reach after STEPS; for balance it is the start. */
  aim: number
}

/** Each starts unsolved, and its answer is a whole number in 0..RATE_MAX that is not the extreme the common mistake picks. */
export const CASES: Record<TaskName, Case[]> = {
  balance: [
    { start: 5, tap: 3, drain: 2, adjust: 'drain', aim: 5 },
    { start: 6, tap: 3, drain: 4, adjust: 'tap', aim: 6 },
    { start: 4, tap: 5, drain: 4, adjust: 'drain', aim: 4 },
  ],
  reach: [
    // Turned down, still rising: the level must still go up, only less.
    { start: 3, tap: 5, drain: 2, adjust: 'tap', aim: 6 },
    // To fall, do not shut the tap: shut, the tank would empty past the aim.
    { start: 7, tap: 5, drain: 3, adjust: 'tap', aim: 4 },
    // Level up by closing the drain a little.
    { start: 2, tap: 4, drain: 4, adjust: 'drain', aim: 8 },
    // Level down by opening the drain a little.
    { start: 8, tap: 2, drain: 2, adjust: 'drain', aim: 5 },
  ],
}

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)

export function caseOf(config: StocksConfig): Case {
  const list = CASES[config.task] ?? CASES.balance
  return list[Number.isInteger(config.variant) && config.variant >= 1 && config.variant <= list.length ? config.variant - 1 : 0]
}

// ---------------------------------------------------------------------------
// The settings: names and units. The picture is the same cut-away vessel; the walls, the liquid and the words change.

export type Setting = {
  /** The vessel in the picture. */
  wall: 'porcelain' | 'earth' | 'glass'
  liquid: string
  surface: string
  store: string
  /** "the water in the bath": what the prompt and the sentences call the stock. */
  thing: string
  /** The readout's name for it. */
  measure: string
  inName: string
  outName: string
  unit: string
  steps: string
  /** Displayed units per notch: of level, and of a flow per time unit. */
  levelScale: number
  rateScale: number
  /** Time units in one step. */
  timeStep: number
  level(n: number): string
  rate(n: number): string
}

export const SETTING: Record<SettingName, Setting> = {
  bath: {
    wall: 'porcelain', liquid: '#6FB1E6', surface: '#3F7FBF', store: 'Bath', thing: 'the water in the bath', measure: 'Water in the bath',
    inName: 'Tap', outName: 'Drain', unit: 'minute', steps: 'minutes', levelScale: 10, rateScale: 10, timeStep: 1,
    level: (n) => `${n * 10} L`, rate: (n) => `${n * 10} L/min`,
  },
  lake: {
    wall: 'earth', liquid: '#5FB7AE', surface: '#2F8A81', store: 'Lake', thing: 'the water in the lake', measure: 'Water in the lake',
    inName: 'Rain and rivers', outName: 'Outflow', unit: 'year', steps: 'years', levelScale: 10, rateScale: 10, timeStep: 1,
    level: (n) => `${n * 10} km³`, rate: (n) => `${n * 10} km³/yr`,
  },
  population: {
    wall: 'glass', liquid: '#DE9B55', surface: '#B8742F', store: 'Herd', thing: 'the herd', measure: 'Animals in the herd',
    inName: 'Births', outName: 'Deaths', unit: 'year', steps: 'years', levelScale: 100, rateScale: 100, timeStep: 1,
    level: (n) => `${n * 100}`, rate: (n) => `${n * 100} a year`,
  },
  carbon: {
    wall: 'glass', liquid: '#8995A4', surface: '#5A6675', store: 'Air', thing: 'the carbon in the air', measure: 'Carbon in the air',
    inName: 'Emissions', outName: 'Uptake', unit: 'year', steps: 'years', levelScale: 100, rateScale: 4, timeStep: 25,
    level: (n) => `${n * 100} Gt`, rate: (n) => `${n * 4} Gt/yr`,
  },
}

export const settingOf = (config: StocksConfig): Setting => (has(SETTING, config.setting) ? SETTING[config.setting as SettingName] : SETTING.bath)

/** "3 minutes" for the time a step count stands for. */
export const timeText = (config: StocksConfig, t: number): string => {
  const s = settingOf(config)
  const n = t * s.timeStep
  return `${n} ${n === 1 ? s.unit : s.steps}`
}

// ---------------------------------------------------------------------------
// The picture's frame, in one place so a test can hold labels and parts apart. Everything is on the 360 x 252 plate.

export const W = 360
export const H = 252
export const TANK = { left: 128, right: 232, top: 62, bottom: 192 }
export const UNIT = (TANK.bottom - TANK.top) / CAP
export const levelY = (level: number) => TANK.bottom - level * UNIT

export type Box = { left: number; right: number; top: number; bottom: number }
export type Pt = { x: number; y: number }
export type Tag = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; part: Pt }

export const WHEEL_IN: Pt = { x: 64, y: 26 }
export const WHEEL_OUT: Pt = { x: 270, y: 150 }
export const WHEEL_R = 10
export const STREAM_X = 150
export const DRAIN_X = 312

/** The solid parts a label must keep clear of. */
export const SOLIDS: { name: string; box: Box }[] = [
  { name: 'tap wheel', box: { left: 53, right: 75, top: 15, bottom: 37 } },
  { name: 'tap pipe', box: { left: 16, right: 156, top: 40, bottom: 52 } },
  { name: 'nozzle', box: { left: 144, right: 156, top: 40, bottom: 58 } },
  { name: 'drain wheel', box: { left: 259, right: 281, top: 139, bottom: 161 } },
  { name: 'drain pipe', box: { left: 232, right: 318, top: 174, bottom: 186 } },
  { name: 'drain spout', box: { left: 306, right: 318, top: 174, bottom: 198 } },
]

const tagWidth = (text: string) => text.length * 7
export function tagBox(t: Tag): Box {
  const wide = tagWidth(t.text)
  const left = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - wide : t.x - wide / 2
  return { left, right: left + wide, top: t.y - 12, bottom: t.y + 3 }
}

/** The names on the picture, placed on the things they name. `now` is the unclamped level at the end of the period. */
export function tagsOf(config: StocksConfig, level: number | null = null): Tag[] {
  const s = settingOf(config)
  const c = caseOf(config)
  const tags: Tag[] = [
    { text: s.inName, x: 84, y: 31, anchor: 'start', part: WHEEL_IN },
    { text: s.outName, x: WHEEL_OUT.x, y: 206, anchor: 'middle', part: { x: WHEEL_OUT.x, y: 180 } },
    { text: s.store, x: 180, y: 226, anchor: 'middle', part: { x: 180, y: 204 } },
    { text: 'Start', x: 228, y: levelY(c.start) - 4, anchor: 'end', part: { x: 200, y: levelY(c.start) } },
  ]
  if (config.task === 'reach') tags.push({ text: 'Aim', x: 228, y: levelY(c.aim) - 4, anchor: 'end', part: { x: 210, y: levelY(c.aim) } })
  if (level !== null && level > CAP) tags.push({ text: 'Overflows', x: 190, y: 48, anchor: 'start', part: { x: 216, y: 62 } })
  if (level !== null && level < 0) tags.push({ text: 'Empty', x: 180, y: 184, anchor: 'middle', part: { x: 180, y: 192 } })
  return tags
}

// ---------------------------------------------------------------------------
// The rules.

const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)
const clampRate = (n: number) => Math.max(0, Math.min(RATE_MAX, n))

/** The state, read safely: a whole number of notches, in range. Anything else counts as the start. */
export function settingsOf(config: StocksConfig, state: StocksState): { tap: number; drain: number; t: number } {
  const c = caseOf(config)
  const tap = whole(state?.tap) ? clampRate(state.tap) : c.tap
  const drain = whole(state?.drain) ? clampRate(state.drain) : c.drain
  const t = whole(state?.t) ? Math.max(0, Math.min(STEPS, state.t)) : STEPS
  // The fixed flow cannot be moved.
  return { tap: c.adjust === 'tap' ? tap : c.tap, drain: c.adjust === 'drain' ? drain : c.drain, t }
}

/** The level after t steps, in notches, ignoring the tank's walls. */
export const rawLevel = (config: StocksConfig, state: StocksState, t?: number): number => {
  const s = settingsOf(config, state)
  return caseOf(config).start + (s.tap - s.drain) * (t ?? s.t)
}
/** What the picture shows: the tank cannot hold more than its brim or less than nothing. Exact for constant flows. */
export const shownLevel = (config: StocksConfig, state: StocksState, t?: number): number => Math.max(0, Math.min(CAP, rawLevel(config, state, t)))

export const netOf = (config: StocksConfig, state: StocksState): number => {
  const s = settingsOf(config, state)
  return s.tap - s.drain
}
/** Where the level ends after the whole period, with the flows as set. */
export const endLevel = (config: StocksConfig, state: StocksState): number => rawLevel(config, state, STEPS)

export function done(config: StocksConfig, state: StocksState): boolean {
  return endLevel(config, state) === caseOf(config).aim
}

/** The flow that answers, found by trying every setting. */
export function answer(config: StocksConfig): number {
  const c = caseOf(config)
  for (let v = 0; v <= RATE_MAX; v++) {
    const state = { tap: c.adjust === 'tap' ? v : c.tap, drain: c.adjust === 'drain' ? v : c.drain, t: STEPS }
    if (done(config, state)) return v
  }
  return -1
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no count and no net.

const per = (config: StocksConfig) => settingOf(config).timeStep === 1 ? settingOf(config).unit : `${settingOf(config).timeStep} years`

/** Where the level goes and why, from the flows. */
function gap(config: StocksConfig, state: StocksState): string {
  const s = settingOf(config)
  const f = settingsOf(config, state)
  const net = f.tap - f.drain
  const ins = s.rate(f.tap)
  const outs = s.rate(f.drain)
  if (net === 0) return `${ins} in and ${outs} out: the same goes out as comes in, so the level stays put`
  const by = s.level(Math.abs(net))
  return `${ins} in and ${outs} out: ${net > 0 ? 'more goes in than out' : 'less goes in than out'}, so the level ${net > 0 ? 'rises' : 'falls'} by ${by} every ${per(config)}`
}

/** What a correct card says: what the learner found, and the misconception it answers. */
export function working(config: StocksConfig, state: StocksState): string {
  const s = settingOf(config)
  const c = caseOf(config)
  const f = settingsOf(config, state)
  const start = s.level(c.start)
  if (config.task === 'balance') {
    return `Yes. ${gap(config, state)}. Steady is not still: the level changes by in minus out, so it holds when they match.`
  }
  const up = c.aim > c.start
  const aim = s.level(c.aim)
  const kept = up
    ? `The flow in was turned down, yet the level still rises: it follows the gap between in and out, not the inflow alone.`
    : f.tap > 0 && c.adjust === 'tap'
      ? `The ${s.inName.toLowerCase()} is still running and the level still falls: it follows the gap between in and out, not the inflow alone.`
      : `The level follows the gap between in and out, so a small change in one flow moves it steadily.`
  return `Yes. ${gap(config, state)}, from ${start} to ${aim} after ${timeText(config, STEPS)}. ${kept}`
}

/** What a wrong card says: what the learner made, never what to set. */
export function madeText(config: StocksConfig, state: StocksState): string {
  const s = settingOf(config)
  const c = caseOf(config)
  const end = endLevel(config, state)
  const where = config.task === 'balance' ? `not where it started (${s.level(c.start)})` : `not at the aim (${s.level(c.aim)})`
  const lead = `You made ${gap(config, state)}.`
  if (end > CAP) return `${lead} It would go past the top of the scale (${s.level(CAP)}), so it ends full: ${where}.`
  if (end < 0) return `${lead} It would run out before then and end at nothing: ${where}.`
  return `${lead} After ${timeText(config, STEPS)} the level is ${s.level(end)}, ${where}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, TaskName> = {
  balance: 'balance', balanced: 'balance', 'balance-the-flows': 'balance', steady: 'balance', 'steady-state': 'balance', 'keep-steady': 'balance', 'hold-steady': 'balance', hold: 'balance',
  'hold-the-level': 'balance', 'keep-the-level': 'balance', constant: 'balance', 'keep-constant': 'balance', equilibrium: 'balance', stable: 'balance', level: 'balance',
  reach: 'reach', target: 'reach', aim: 'reach', 'reach-the-aim': 'reach', 'reach-the-target': 'reach', 'hit-the-target': 'reach', change: 'reach', raise: 'reach', lower: 'reach', rise: 'reach', fall: 'reach',
  fill: 'reach', 'fill-to': 'reach', predict: 'reach', make: 'reach', set: 'reach', 'turn-down': 'reach', 'turn-the-tap-down': 'reach', 'reverse': 'reach', 'get-to': 'reach',
}

const SETTING_WORDS: Record<string, SettingName> = {
  bath: 'bath', bathtub: 'bath', 'bath-tub': 'bath', tub: 'bath', tank: 'bath', 'water-tank': 'bath', sink: 'bath', 'the-bath': 'bath', 'bath-filling': 'bath', 'bathtub-model': 'bath',
  lake: 'lake', reservoir: 'lake', 'the-lake': 'lake', 'water-cycle': 'lake', 'the-water-cycle': 'lake', water: 'lake', river: 'lake', rivers: 'lake', rain: 'lake', catchment: 'lake', 'drainage-basin': 'lake', aquifer: 'lake', groundwater: 'lake', 'water-store': 'lake', 'water-balance': 'lake', hydrology: 'lake',
  population: 'population', populations: 'population', herd: 'population', animals: 'population', 'animal-population': 'population', 'population-size': 'population', 'population-growth': 'population', 'population-change': 'population',
  births: 'population', 'births-and-deaths': 'population', 'birth-and-death': 'population', 'birth-rate': 'population', organisms: 'population', species: 'population', fish: 'population', rabbits: 'population', people: 'population', 'natural-increase': 'population',
  carbon: 'carbon', 'carbon-cycle': 'carbon', 'the-carbon-cycle': 'carbon', 'carbon-store': 'carbon', 'carbon-in-the-air': 'carbon', atmosphere: 'carbon', 'the-atmosphere': 'carbon', co2: 'carbon', 'carbon-dioxide': 'carbon', air: 'carbon',
  emissions: 'carbon', climate: 'carbon', 'climate-change': 'carbon', 'greenhouse-gases': 'carbon', 'carbon-budget': 'carbon', 'global-warming': 'carbon',
}

function readSetting(raw: unknown): string {
  const key = keyOf(raw).replace(/^(?:a|an|the)-/, '')
  return has(SETTING_WORDS, key) ? SETTING_WORDS[key] : has(SETTING_WORDS, `the-${key}`) ? SETTING_WORDS[`the-${key}`] : key
}

function readVariant(raw: unknown): number | null {
  if (raw === undefined) return 1
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/^(?:variant|version|case|problem|example)\s*/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

const variantsFor = (task: TaskName) => CASES[task].length

/** What a prompt can safely say: the gesture and the aim, with the thing the setting is about. */
export function goodPrompt(config: StocksConfig): string {
  const s = settingOf(config)
  const c = caseOf(config)
  const mine = c.adjust === 'tap' ? s.inName : s.outName
  return config.task === 'balance'
    ? `Use the − and + buttons on ${mine} so that ${s.thing} is still at its start line after ${timeText(config, STEPS)}.`
    : `Use the − and + buttons on ${mine} to bring ${s.thing} to the aim line after ${timeText(config, STEPS)}.`
}

export const stocksFlowsEngine: SceneEngine<StocksConfig, StocksState> = {
  id: 'stocks-flows',
  // None on purpose: `scenesFor` matches a covers word by its first five letters and the catalogue by any one word, so "stock"
  // would catch stock control and stock markets, "flow" every flow chart, and "inflow" inflorescence. Everything is a whole phrase.
  covers: [],
  phrases: [
    'stocks and flows', 'stock and flow', 'stocks and flow', 'stock-flow', 'stores and flows', 'store and flows', 'inputs stores and flows', 'inputs outputs stores', 'inputs and outputs of a system',
    'inflows and outflows', 'inflow and outflow', 'bathtub model', 'bathtub dynamics', 'systems thinking', 'system dynamics',
    'carbon cycle', 'carbon cycles', 'the carbon cycle', 'carbon store', 'carbon stores', 'carbon sink', 'carbon sinks', 'carbon budget', 'carbon pools', 'carbon reservoirs',
    'water cycle', 'water cycles', 'the water cycle', 'hydrological cycle', 'hydrologic cycle', 'water balance', 'water budget', 'water stores', 'drainage basin system', 'global water cycle',
    'nutrient cycle', 'nutrient cycles', 'nutrient cycling', 'biogeochemical cycle', 'biogeochemical cycles',
    'population change', 'population growth', 'population size', 'population dynamics', 'changes in population', 'changes in population size', 'growth of populations',
    'birth rate', 'birth rates', 'death rate', 'death rates', 'birth and death rates', 'birth rates and death rates', 'births and deaths', 'natural increase', 'natural change', 'population balance',
    'greenhouse gas emissions', 'emissions and concentration', 'atmospheric carbon dioxide',
  ],
  // Near misses: the same words about economics, money or stock-keeping, and population or cycle ideas this card cannot draw.
  notFor: [
    'economy', 'economies', 'economic', 'economics', 'macroeconomics', 'inflation', 'unemployment', 'money', 'financial', 'finance', 'accounting', 'accounts', 'inventory', 'capital stock', 'stock of capital', 'capital',
    'stock market', 'stock markets', 'stock exchange', 'stock control', 'stock levels', 'stock valuation', 'stock turnover', 'stocks and shares', 'shares', 'investment', 'investments', 'portfolio', 'bonds',
    'cash flow', 'cash flows', 'circular flow', 'flow of funds', 'balance of payments', 'balance sheet', 'trade', 'trading', 'supply and demand', 'business',
    'exponential growth', 'exponential decay', 'exponential', 'logistic', 'growth curve', 'growth curves', 'sigmoid', 'doubling time', 'compound growth', 'compound interest', 'bacterial growth', 'bacterial growth curve',
    'population pyramid', 'population pyramids', 'population density', 'population distribution', 'population structure', 'population statistics', 'population census', 'ageing population', 'aging population',
    'population genetics', 'sampling', 'sample and population', 'population mean', 'population parameters', 'population explosion', 'demographic transition', 'demographic transition model', 'migration', 'urbanisation',
    'carbon dating', 'carbon compounds', 'carbon footprint', 'carbon tax', 'carbon trading', 'carbon capture', 'krebs cycle', 'citric acid cycle', 'calvin cycle', 'cell cycle', 'life cycle', 'life cycles', 'menstrual cycle',
    'rock cycle', 'nitrogen cycle', 'water of crystallisation', 'water treatment', 'water pollution', 'water supply', 'water table', 'flood hydrograph', 'storm hydrograph', 'hydrograph', 'flood risk',
    'flow chart', 'flow charts', 'flowchart', 'flowcharts', 'energy flow', 'food chains', 'food webs', 'blood flow', 'rate of flow', 'rates of flow', 'rate of change', 'ordinary differential equations', 'differential equations',
  ],
  // The learner changes how fast the level fills and drains: it is the gap between the two that moves it.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawTask = first(o, ['task', 'kind', 'type', 'mode'])
    const rawSetting = first(o, ['setting', 'context', 'scenario', 'system', 'store', 'subject', 'theme', 'model'])
    const rawVariant = first(o, ['variant', 'case', 'example', 'version', 'problem', 'level'])
    let task: TaskName
    if (rawTask === undefined) task = 'balance'
    else {
      if (typeof rawTask !== 'string') return null
      const word = keyOf(rawTask)
      if (!has(TASK_WORDS, word)) return null
      task = TASK_WORDS[word]
    }
    if (rawSetting !== undefined && typeof rawSetting !== 'string') return null
    const variant = readVariant(rawVariant)
    if (variant === null) return null
    return { task, setting: rawSetting === undefined ? 'bath' : readSetting(rawSetting), variant }
  },

  faults(config) {
    const out: string[] = []
    if (!has(SETTING, config.setting)) {
      out.push(`There is no "${config.setting}" setting drawn here: use one of ${SETTINGS.join(', ')}, e.g. setting "bath".`)
    }
    const n = variantsFor(config.task)
    if (!Number.isInteger(config.variant) || config.variant < 1 || config.variant > n) {
      out.push(`There is no variant ${config.variant} of ${config.task}: variant must be a whole number from 1 to ${n}, e.g. variant 1.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    // The rule, or the setting itself: that the flows must match, a count to set, or that something zero or off is needed.
    const rule = /\b(?:equal|equals|equally|same (?:as|rate|speed|amount)|match(?:es|ed|ing)?|even(?:ly)?|net\b|difference|gap\b|minus|subtract|cancel|offset|in(?:flow)? (?:and|=|equals) out(?:flow)?|as (?:fast|much) as)\b/i.test(text)
    const amount = /\b(?:set|turn|put|make|change|open|close|adjust|use|run|drop|lower|raise|reduce|increase)\b[^.?!]*\b(?:to|at|on|by|of)\s+(?:\d+|zero|none|nothing|one|two|three|four|five|half)\b|\b(?:to|at) (?:zero|nothing)\b|\b(?:turn|switch|shut|close|cut)(?:s|ting)? (?:it |them |the \w+ )?(?:off|completely|right off|fully)\b|\bshut\b|\bnot at all\b|\bwide open\b|\bfully open\b|\bin half\b|\bhalv(?:e|es|ed|ing)\b|\bdoubl(?:e|es|ed|ing)\b|\btwice\b|\bby (?:a|one) (?:third|quarter|notch|step)\b/i.test(text)
    const outcome = /\bstill (?:rise|rises|rising|fall|falls|falling|goes? up|goes? down|run|runs|running|flow|flows|flowing)\b|\bkeeps? (?:rising|falling|filling|draining)\b|\bwill (?:rise|fall|fill|drain|overflow|empty|stay|hold|keep)\b|\bwon't (?:rise|fall|stop)\b|\bmore (?:comes|goes|flows) in\b|\bless (?:comes|goes|flows) in\b|\bfaster than\b|\bslower than\b|\bmore than (?:it|the)\b|\bless than (?:it|the)\b|\bbigger than\b|\bsmaller than\b|\bthe level (?:rises|falls|follows|changes)\b/i.test(text)
    if (rule || amount || outcome) {
      out.push(`the prompt gives the answer away: it says what the flows must be, how to set them or what the level will do, which the learner is to find by turning the flow and watching the level -- ask for the outcome only ("${example}")`)
    }
    if (/\bdrag\b|\bgraph\b|\bplot\b|\bsketch\b|\bdraw\b|\bcurve\b|\bequation\b|\bformula\b|\bcalculat|\bfeedback\b|\bloop\b|\bpredict\b|\btype\b|\bexponential\b|\blogistic\b|\bwhich (?:one|valve|flow)\b|\bvalve\b|\bwheel\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: the learner presses the − and + buttons on the flow they turn and watches the level; there is no graph, equation or drawing task -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    const c = caseOf(config)
    return { tap: c.tap, drain: c.drain, t: STEPS }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    const c = caseOf(config)
    const v = answer(config)
    return { tap: c.adjust === 'tap' ? v : c.tap, drain: c.adjust === 'drain' ? v : c.drain, t: STEPS }
  },

  View: StocksFlowsView,

  prompt: `SCENE "stocks-flows" -- a store with one flow in and one flow out, drawn as a cut-away vessel on a quiet light panel: a bath with a tap and a drain, a lake with rain and rivers in and an outflow, a herd with births and deaths, or the air with emissions and uptake. A flow is a pipe with a hand-wheel and a stream whose width shows how fast it runs. The level in the vessel is read against a graduated scale; a dashed line marks where it started (Start), and in the "reach" task an orange line marks the Aim. The learner presses the − and + buttons on the one flow that is theirs (the other is fixed and shown as a number) and watches the level after three steps of time, which they can also scrub with a Time slider to see it at each step. A readout gives the level at the chosen time. Nothing says whether it is right until marked; marking says what was made and why the level did what it did.
  For: stocks and flows, the carbon cycle and the water cycle as stores and flows, populations with births and deaths (natural increase), a bath filling while it drains, inputs and outputs of a system. It answers the misconception that a stock follows its inflow, rather than the gap between inflow and outflow: a steady level has flow running in and out at the same rate, and turning a tap down does not turn the level down.
  balance: the flow in is fixed and the learner sets the other until the level stays at its Start line. variants 1 to 3 (1: drain turned, 2: tap turned, 3: drain turned at the largest flow).
  reach: one flow is fixed, the other is the learner's; bring the level to the Aim line after three steps. variants 1 to 4 (1: the tap is turned down and the level must still rise; 2: the level must fall without shutting the tap; 3: the drain is turned down to raise the level; 4: the drain is turned up to lower it). Shutting a flow off or matching the two flows on a reach card is marked wrong, with what was made.
  setting: bath (litres and minutes), lake (km³ and years), population (animals and years) or carbon (Gt and years; 25 years a step). Use two settings in turn to show it is the same idea.
  variant: which prepared problem, counting from 1; the engine owns every number, so any variant is correct and solvable.
  Not drawn: graphs of the level against time, flows that depend on the level (feedback), exponential or logistic growth, real data, the processes inside the cycles (evaporation, photosynthesis, decay), and anything about money or stock-keeping. Do not use it for the economy's circular flow, stock markets, stock control, cash flow, the nitrogen cycle's microbes, population pyramids or sampling.
  Before marking the card shows the vessel, both flows and their sizes, the Start line (and the Aim line in reach), and the level at the chosen time. It holds back the setting that answers, and any sentence about the gap between in and out. The prompt must ask for the outcome only: do NOT say what to set a flow to, that the flows must match or be equal, that something must be turned off, or what the level will do (rise, fall, keep rising).
  config: { "task":"balance", "setting":"bath", "variant":1 }  -- the prompt says "Use the − and + buttons on Drain so that the water in the bath is still at its start line after 3 minutes."
       or { "task":"reach", "setting":"carbon", "variant":2 }  -- the prompt says "Use the − and + buttons on Emissions to bring the carbon in the air to the aim line after 75 years."
       or { "task":"reach", "setting":"lake", "variant":3 }  -- the prompt says "Use the − and + buttons on Outflow to bring the water in the lake to the aim line after 3 years."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the − and + buttons on Drain so that the water in the bath is still at its start line after 3 minutes.",
    "payload": { "engine":"stocks-flows", "config": { "task":"balance", "setting":"bath", "variant":1 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:stocks-flows", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the − and + buttons on Emissions to bring the carbon in the air to the aim line after 75 years.",
    "payload": { "engine":"stocks-flows", "config": { "task":"reach", "setting":"carbon", "variant":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:stocks-flows", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the − and + buttons on Outflow to bring the water in the lake to the aim line after 3 years.",
    "payload": { "engine":"stocks-flows", "config": { "task":"reach", "setting":"lake", "variant":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:stocks-flows", "why":"..." } }`,
}

registerEngine(stocksFlowsEngine as SceneEngine<unknown, unknown>)
