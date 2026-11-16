// lib/studylab/engines/climate-station/config.ts
//
// A climate station: a real thermometer and rain gauge, a globe with the sun's rays landing on it, and the climate graph
// the station draws over a year (temperature as a line, rainfall as bars). The learner handles the station, and the idea
// answers back at once:
//   place -- a dashed graph is given and nothing else. Move the station about the globe (drag it, or step it) until its
//            own graph matches. The same beam of sunlight is seen spread over a longer or shorter patch of ground, and
//            the graph changes with it;
//   month -- one named station. Move through the year and read the instruments to find its warmest, coldest, wettest or
//            driest month. The sun's rays swing north and south with the months, the patch of ground they land on
//            widens and narrows, and the mercury follows a little behind.
//
// The rules, all computed here and never read from the drawing:
//   place: the station is at the target place;
//   month: the chosen month's value is within a tolerance a learner can see of the extreme value (1 degree, or 5% of the
//          rain axis), so a month that looks as warm or wet as the best is right. The exact month is said when marked.
//
// Facts:
//   - monthly temperature and rainfall for six real places, rounded (to 1 degree and to about 5 mm) from the published
//     climate normals of their national weather services, as summarised on each place's Wikipedia climate box. They are
//     for a school graph, not for a forecast, and each is within a degree or about a tenth of the real figure. Six places
//     were chosen so that the latitudes are far enough apart (13 degrees or more) to tell apart on a globe the size of a
//     phone card: Utqiagvik (Barrow) 71 N, London 51.5 N, Cairo 30 N, Singapore 1.3 N, Darwin 12.5 S, Sydney 34 S;
//   - the sun's declination for a month is Cooper's formula, 23.45 sin(360 (284 + n) / 365), n the day of the year on
//     the 15th. A beam of width w that meets the ground at incidence i covers w / cos i of it: that is the geometry drawn,
//     found by running the rays on to the globe's circle, not by a formula in the picture;
//   - the warmest and coldest months come a month or so after the solstice because the land and sea keep gaining (or
//     losing) heat while the sun is still higher (or lower) than the average: the seasonal lag, as the National Weather
//     Service and AccuWeather both explain it. The card says it only when the data show a one or two month gap.
//
// Ideas taken, never code or art:
//   - the misconception that seasons come from the distance to the sun, and the cure: the same beam spread thinner
//     (NASA's common student ideas for seasons; the Wikipedia article on the effect of the sun's angle on climate);
//   - novices reading a climate graph spend their eyes on the title and axes and mix up which mark is which (an eye
//     tracking study of climate graph reading, Clute Institute): so the line and bars each carry their own unit and colour,
//     and the instruments read the same scale as the graph;
//   - the instruments as the source of the graph: each month's mercury and rain gauge are the month's two marks.
// Refused:
//   - building the graph bar by bar: twelve months of two values is a fiddly chore and not an idea;
//   - wind, pressure and fronts (anemometer, barometer, pressure systems): a different idea that needs its own scene;
//   - a map of the world's climate zones: it would need every continent drawn and checked.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ClimateStationView } from './View'

export type StationId = 'barrow' | 'london' | 'cairo' | 'singapore' | 'darwin' | 'sydney'
export type Goal = 'warmest' | 'coldest' | 'wettest' | 'driest'
export const GOALS: Goal[] = ['warmest', 'coldest', 'wettest', 'driest']

export type Station = {
  id: StationId
  /** The short name. */
  name: string
  /** The name with its country. */
  full: string
  /** Degrees, north positive. */
  lat: number
  /** Mean temperature, whole degrees, January to December. */
  temp: number[]
  /** Rainfall, mm, January to December. */
  rain: number[]
  /** A sentence of why, said once marked. */
  note: string
}

export const STATIONS: Station[] = [
  {
    id: 'barrow', name: 'Utqiaġvik', full: 'Utqiaġvik, Alaska', lat: 71,
    temp: [-25, -26, -25, -17, -7, 1, 4, 3, -1, -9, -18, -23],
    rain: [4, 3, 3, 4, 4, 9, 23, 27, 17, 14, 6, 3],
    note: 'Far north the sun is low, and gone for weeks in winter, so it is cold in every month and very little falls.',
  },
  {
    id: 'london', name: 'London', full: 'London, UK', lat: 51.5,
    temp: [5, 6, 8, 11, 14, 17, 19, 19, 16, 12, 9, 6],
    rain: [55, 40, 40, 45, 50, 50, 45, 50, 50, 70, 70, 60],
    note: 'At middle latitudes the sun is lower in winter and higher in summer, so winters are cool and summers mild, with rain through the year.',
  },
  {
    id: 'cairo', name: 'Cairo', full: 'Cairo, Egypt', lat: 30,
    temp: [14, 16, 18, 22, 26, 29, 30, 30, 28, 25, 20, 16],
    rain: [5, 4, 4, 1, 0, 0, 0, 0, 0, 1, 3, 5],
    note: 'Near the tropic the sun is high and the air is dry, so summers are hot and almost no rain falls in any month.',
  },
  {
    id: 'singapore', name: 'Singapore', full: 'Singapore', lat: 1,
    temp: [27, 27, 28, 28, 29, 28, 28, 28, 28, 28, 27, 27],
    rain: [220, 115, 150, 165, 165, 135, 150, 150, 135, 160, 250, 290],
    note: 'On the equator the sun is high all year, so it is hot in every month and rain falls in every month.',
  },
  {
    id: 'darwin', name: 'Darwin', full: 'Darwin, Australia', lat: -12.5,
    temp: [29, 29, 29, 29, 28, 26, 25, 26, 28, 30, 30, 30],
    rain: [430, 370, 320, 100, 20, 2, 1, 5, 15, 55, 130, 250],
    note: 'Just south of the equator the sun is high all year, so it stays hot, but the rain comes in a wet season from December to March and almost none falls from May to September.',
  },
  {
    id: 'sydney', name: 'Sydney', full: 'Sydney, Australia', lat: -34,
    temp: [23, 23, 22, 19, 16, 13, 12, 13, 15, 18, 20, 22],
    rain: [100, 120, 130, 125, 115, 130, 100, 80, 70, 80, 85, 75],
    note: 'South of the equator the seasons are the other way round: the sun is highest in December, so the warmest months are December to March.',
  },
]
export const STATION_IDS = STATIONS.map((s) => s.id)

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3))

/** What counts as near enough: a degree, or a twentieth of the rain axis. Both are a few pixels on the graph. */
export const TOL_TEMP = 1
export const TOL_RAIN_FRAC = 0.05
/** More months than this within tolerance of the extreme and the question is not a question. */
export const MAX_ACCEPTED = 4
/** The month a place card begins in, and the one the sun's rays are shown at. */
export const PLACE_MONTH = 2

export type ClimateConfig =
  /** place: the station to find. */
  | { task: 'place'; place: string }
  /** month: the station, and which month to find. */
  | { task: 'month'; place: string; goal: string }

/** What the learner has done. */
export type ClimateState = { at?: string; month?: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
export const stationOf = (id: unknown): Station | null => (typeof id === 'string' ? STATIONS.find((s) => s.id === id) ?? null : null)
const STATIONS_BY_LAT = STATIONS.slice().sort((a, b) => b.lat - a.lat)
/** North to south: the order the station steps in. */
export const stationsNorthToSouth = (): Station[] => STATIONS_BY_LAT

export const latText = (lat: number) => `${Math.abs(lat)}° ${lat >= 0 ? 'N' : 'S'}`

// ---------------------------------------------------------------------------
// The axes. A place card shares one pair of axes among all places so that a dry place looks dry; a month card fits the
// axes to its one station.

export type Axes = { tMin: number; tMax: number; tStep: number; rMax: number; rStep: number }
const RAIN_STEPS: [number, number][] = [[50, 10], [100, 25], [150, 50], [300, 100], [500, 100]]
export const COMMON_AXES: Axes = { tMin: -30, tMax: 40, tStep: 10, rMax: 500, rStep: 100 }

export function fitAxes(s: Station): Axes {
  const lo = Math.min(...s.temp)
  const hi = Math.max(...s.temp)
  const tMin = Math.min(0, Math.floor(lo / 10) * 10)
  const tMax = Math.floor(hi / 10) * 10 + 10
  const wet = Math.max(...s.rain)
  const [rMax, rStep] = RAIN_STEPS.find(([m]) => m >= wet) ?? RAIN_STEPS[RAIN_STEPS.length - 1]
  return { tMin, tMax, tStep: 10, rMax, rStep }
}
export function axesOf(config: ClimateConfig): Axes {
  return config.task === 'place' ? COMMON_AXES : fitAxes(stationOf(config.place) ?? STATIONS[1])
}

// ---------------------------------------------------------------------------
// The sun. Declination for a month's 15th, Cooper's formula.

const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
export const declination = (month: number) => 23.45 * Math.sin((2 * Math.PI * (284 + DAYS_BEFORE[month] + 15)) / 365)
/** How high the sun stands at noon on the 15th, in degrees. */
export const noonHeight = (lat: number, month: number) => 90 - Math.abs(lat - declination(month))
const argBest = (values: number[], pick: 'max' | 'min') => values.reduce((best, v, i) => (pick === 'max' ? v > values[best] : v < values[best]) ? i : best, 0)
export const sunHighestMonth = (lat: number) => argBest(MONTHS.map((_, m) => noonHeight(lat, m)), 'max')
export const sunLowestMonth = (lat: number) => argBest(MONTHS.map((_, m) => noonHeight(lat, m)), 'min')

/** The station nearest a latitude, for the pointer on the globe. */
export function nearestStation(lat: number): Station {
  return STATIONS.reduce((best, s) => (Math.abs(s.lat - lat) < Math.abs(best.lat - lat) ? s : best), STATIONS[0])
}

// ---------------------------------------------------------------------------
// The question and what is accepted.

export const valuesOf = (s: Station, goal: Goal): number[] => (goal === 'warmest' || goal === 'coldest' ? s.temp : s.rain)
const toleranceOf = (s: Station, goal: Goal) => (goal === 'warmest' || goal === 'coldest' ? TOL_TEMP : fitAxes(s).rMax * TOL_RAIN_FRAC)
export const extremeOf = (s: Station, goal: Goal): number => {
  const v = valuesOf(s, goal)
  return goal === 'warmest' || goal === 'wettest' ? Math.max(...v) : Math.min(...v)
}
export const unitOf = (goal: Goal) => (goal === 'warmest' || goal === 'coldest' ? '°C' : 'mm')

/** The months a learner can see are as good as the best. */
export function acceptedMonths(s: Station, goal: Goal): number[] {
  const v = valuesOf(s, goal)
  const best = extremeOf(s, goal)
  const tol = toleranceOf(s, goal)
  return v.map((x, m) => (Math.abs(x - best) <= tol + 1e-9 ? m : -1)).filter((m) => m >= 0)
}
/** The months that have the exact extreme. */
export const exactMonths = (s: Station, goal: Goal): number[] => {
  const v = valuesOf(s, goal)
  const best = extremeOf(s, goal)
  return v.map((x, m) => (x === best ? m : -1)).filter((m) => m >= 0)
}

/** Where a month card begins: the month furthest from the best, so the start is clearly outside what is accepted. */
export function startMonth(s: Station, goal: Goal): number {
  const v = valuesOf(s, goal)
  const best = extremeOf(s, goal)
  const ok = acceptedMonths(s, goal)
  let at = 0
  let far = -1
  v.forEach((x, m) => {
    if (ok.includes(m)) return
    const gap = Math.abs(x - best)
    if (gap > far) { far = gap; at = m }
  })
  return at
}

export const isGoal = (g: unknown): g is Goal => typeof g === 'string' && (GOALS as string[]).includes(g)

/** The first place a place card puts the station: never the target. */
export const startPlace = (target: string): StationId => (['cairo', 'london', 'singapore'] as StationId[]).find((id) => id !== target) ?? 'cairo'

export const placeOf = (config: ClimateConfig, state: ClimateState): Station | null => {
  if (config.task === 'month') return stationOf(config.place)
  return stationOf(state?.at) ?? stationOf(startPlace(config.place))
}
export const monthOf = (config: ClimateConfig, state: ClimateState): number => {
  const m = state?.month
  if (typeof m === 'number' && Number.isInteger(m) && m >= 0 && m <= 11) return m
  const s = stationOf(config.place)
  return config.task === 'place' || !s || !isGoal(config.goal) ? PLACE_MONTH : startMonth(s, config.goal)
}

export function done(config: ClimateConfig, state: ClimateState): boolean {
  const target = stationOf(config.place)
  if (!target) return false
  if (config.task === 'place') return placeOf(config, state)?.id === target.id
  if (!isGoal(config.goal)) return false
  return acceptedMonths(target, config.goal).includes(monthOf(config, state))
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no name, count or reason.

const goalWords: Record<Goal, { adj: string; more: string }> = {
  warmest: { adj: 'warmest', more: 'warmer' },
  coldest: { adj: 'coldest', more: 'colder' },
  wettest: { adj: 'wettest', more: 'wetter' },
  driest: { adj: 'driest', more: 'drier' },
}

/** Three months in a row that hold the most (or least) of the year's rain, and their share. */
function rainSpell(s: Station, goal: 'wettest' | 'driest') {
  let at = 0
  let pick = goal === 'wettest' ? -1 : Infinity
  for (let m = 0; m < 12; m++) {
    const sum = s.rain[m] + s.rain[(m + 1) % 12] + s.rain[(m + 2) % 12]
    if (goal === 'wettest' ? sum > pick : sum < pick) { pick = sum; at = m }
  }
  const total = s.rain.reduce((a, b) => a + b, 0)
  return { from: MONTHS[at], to: MONTHS[(at + 2) % 12], share: Math.round((100 * pick) / (total || 1)) }
}

/** The why that goes with a month answer: the lag for temperature, the season for rain. */
export function whyMonth(s: Station, goal: Goal): string {
  if (goal === 'wettest' || goal === 'driest') {
    const r = rainSpell(s, goal)
    return `${r.share}% of the year's rain falls in the three months ${r.from} to ${r.to}.`
  }
  const best = exactMonths(s, goal)[0]
  const sun = goal === 'warmest' ? sunHighestMonth(s.lat) : sunLowestMonth(s.lat)
  const gap = (best - sun + 12) % 12
  const sunWord = goal === 'warmest' ? 'highest' : 'lowest'
  if (gap === 0) return `The sun is ${sunWord} in ${MONTHS[sun]}, the same month.`
  if (gap <= 2) {
    const keep = goal === 'warmest' ? 'keep gaining heat while the sun is still strong' : 'keep losing heat while the sun is still weak'
    return `The sun is ${sunWord} over ${s.name} in ${MONTHS[sun]}, and the ${goalWords[goal].adj} month comes ${gap === 1 ? 'a month' : 'two months'} later, because the land and sea ${keep}.`
  }
  return ''
}

const withValue = (s: Station, goal: Goal, m: number) => `${valuesOf(s, goal)[m]} ${unitOf(goal)}`

export function working(config: ClimateConfig, state: ClimateState): string {
  const target = stationOf(config.place)
  if (!target) return 'Yes.'
  if (config.task === 'place') return `Yes. That is ${target.full}, ${latText(target.lat)}. ${target.note}`
  const goal = config.goal as Goal
  const m = monthOf(config, state)
  const exact = exactMonths(target, goal)
  const names = exact.map((x) => MONTHS[x]).join(' and ')
  const head = exact.includes(m)
    ? `Yes. ${MONTHS[m]} is the ${goalWords[goal].adj} month in ${target.name}, with ${withValue(target, goal, m)}.`
    : `Yes. Near enough: ${MONTHS[m]} has ${withValue(target, goal, m)}, and the exact answer is ${names}, with ${extremeOf(target, goal)} ${unitOf(goal)}.`
  return `${head} ${whyMonth(target, goal)}`.trim()
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: ClimateConfig, state: ClimateState): string {
  if (config.task === 'place') {
    const s = placeOf(config, state) ?? STATIONS[0]
    const hot = argBest(s.temp, 'max')
    const wet = Math.max(...s.rain)
    return `You put the station at ${latText(s.lat)}. Its graph peaks at ${s.temp[hot]} °C in ${MONTHS[hot]}, and its wettest month has ${wet} mm. That is not the shape of the dashed graph.`
  }
  const s = stationOf(config.place) ?? STATIONS[0]
  const goal = isGoal(config.goal) ? config.goal : 'warmest'
  const m = monthOf(config, state)
  return `You chose ${MONTHS[m]}, with ${withValue(s, goal, m)}. Another month is ${goalWords[goal].more}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'place' | 'month'> = {
  place: 'place', find: 'place', 'find-the-place': 'place', 'find-the-station': 'place', match: 'place', 'match-the-graph': 'place', 'match-graph': 'place', locate: 'place', latitude: 'place', where: 'place', station: 'place', location: 'place', climate: 'place', 'climate-graph': 'place', 'which-place': 'place',
  month: 'month', months: 'month', 'find-the-month': 'month', read: 'month', 'read-the-graph': 'month', season: 'month', seasons: 'month', scrub: 'month', instruments: 'month', extreme: 'month', 'read-instruments': 'month', 'month-extreme': 'month',
}

const PLACE_WORDS: Record<string, StationId> = {
  barrow: 'barrow', utqiagvik: 'barrow', 'utqiagvik-alaska': 'barrow', 'barrow-alaska': 'barrow', 'point-barrow': 'barrow', polar: 'barrow', tundra: 'barrow',
  london: 'london', 'london-uk': 'london', 'london-england': 'london', 'temperate-maritime': 'london',
  cairo: 'cairo', 'cairo-egypt': 'cairo', 'hot-desert': 'cairo',
  singapore: 'singapore', 'equatorial': 'singapore',
  darwin: 'darwin', 'darwin-australia': 'darwin', 'tropical-wet-and-dry': 'darwin', savanna: 'darwin',
  sydney: 'sydney', 'sydney-australia': 'sydney',
}

const GOAL_WORDS: Record<string, Goal> = {
  warmest: 'warmest', hottest: 'warmest', warm: 'warmest', hot: 'warmest', 'warmest-month': 'warmest', 'hottest-month': 'warmest', 'highest-temperature': 'warmest', 'maximum-temperature': 'warmest', max: 'warmest', summer: 'warmest',
  coldest: 'coldest', coolest: 'coldest', cold: 'coldest', cool: 'coldest', 'coldest-month': 'coldest', 'coolest-month': 'coldest', 'lowest-temperature': 'coldest', 'minimum-temperature': 'coldest', min: 'coldest', winter: 'coldest',
  wettest: 'wettest', rainiest: 'wettest', wet: 'wettest', rainy: 'wettest', 'wettest-month': 'wettest', 'rainiest-month': 'wettest', 'highest-rainfall': 'wettest', 'most-rain': 'wettest',
  driest: 'driest', dry: 'driest', 'driest-month': 'driest', 'lowest-rainfall': 'driest', 'least-rain': 'driest',
}

const readPlace = (raw: unknown): string => {
  const key = keyOf(raw).replace(/^(?:a|an|the)-/, '').replace(/-?(?:climate|station|weather|graph)$/, '')
  return has(PLACE_WORDS, key) ? PLACE_WORDS[key] : key
}
const readGoal = (raw: unknown): string => {
  const key = keyOf(raw).replace(/^(?:the|find-the)-/, '')
  return has(GOAL_WORDS, key) ? GOAL_WORDS[key] : key
}

/** What a prompt can safely say: the gesture and the aim. */
const goodPrompt = (config: ClimateConfig) => {
  const s = stationOf(config.place)
  if (config.task === 'place') return 'Drag the station around the globe, or use the arrows, until its graph matches the dashed graph.'
  const goal = isGoal(config.goal) ? config.goal : 'warmest'
  return `Here is the climate of ${s?.full ?? 'London, UK'}. Use the month arrows, or tap the graph, to find its ${goalWords[goal].adj} month.`
}

const MONTH_NAME_RES = MONTHS.map((m, i) => (i === 4 ? /\bMay\b/ : new RegExp(`\\b${m}\\b|\\b${m.slice(0, 3)}\\b\\.?`, 'i')))

export const climateStationEngine: SceneEngine<ClimateConfig, ClimateState> = {
  id: 'climate-station',
  // Distinctive words only: "climate" alone would catch climate change policy and the business climate, and "station" and
  // "pressure" are everywhere. Everything else is a whole phrase.
  covers: ['climographs', 'thermometers'],
  phrases: [
    'weather', 'weather and climate', 'climate and weather', 'weather and seasons', 'seasonal weather', 'weather station', 'weather stations', 'weather instruments', 'measuring weather', 'recording weather', 'weather data',
    'climate graph', 'climate graphs', 'climate zones', 'climate zone', 'world climates', 'climate types', 'types of climate', 'climate and latitude', 'latitude and climate', 'climate and seasons', 'climate of the world',
    'climate and climate change', 'tropical climate', 'equatorial climate', 'desert climate', 'temperate climate', 'polar climate', 'arctic climate', 'mediterranean climate', 'tropical climates', 'equatorial climates', 'desert climates', 'temperate climates', 'polar climates', 'arctic climates', 'mediterranean climates', 'climate patterns',
    'temperature and rainfall', 'rainfall and temperature', 'rainfall patterns', 'temperature patterns', 'seasons of the year', 'the seasons', 'why we have seasons', 'four seasons', 'sun angle', 'angle of the sun',
    'going outside',
  ],
  notFor: [
    'effects of climate change', 'causes of climate change', 'impacts of climate change', 'impact of climate change', 'mitigating climate change', 'tackling climate change', 'combating climate change', 'managing climate change', 'responding to climate change',
    'climate change mitigation', 'climate change adaptation', 'climate change policy', 'climate action', 'climate crisis', 'climate emergency', 'climate summit', 'climate justice', 'climate negotiations', 'global warming', 'greenhouse effect', 'carbon footprint',
    'political climate', 'business climate', 'economic climate', 'investment climate', 'organisational climate', 'school climate', 'classroom climate', 'social climate', 'moral climate', 'work climate', 'climate of fear', 'climate of opinion',
    'weather forecast', 'weather forecasts', 'weather forecasting', 'weather map', 'weather maps', 'weather hazards', 'severe weather', 'extreme weather', 'space weather', 'weather derivatives', 'weather systems', 'weather and wind', 'wind and pressure', 'air pressure', 'atmospheric pressure',
    'tropical storms', 'tropical cyclones', 'hurricanes', 'cyclones', 'depressions', 'anticyclones', 'natural hazards', 'weather insurance', 'wind energy', 'wind power', 'renewable energy', 'solar energy', 'solar power', 'solar panels',
    'seasons of life', 'seasonal sales', 'seasonal unemployment', 'seasons of a series', 'vivaldi', 'four seasons hotel', 'season ticket', 'seasoning', 'service station', 'power station', 'railway station', 'police station', 'space station',
  ],
  // The learner moves a station about the globe, and through the year: where it is is what the graph answers to.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawTask = first(o, ['task', 'kind', 'type', 'mode'])
    const rawPlace = first(o, ['place', 'station', 'location', 'city', 'target', 'answer'])
    const rawGoal = first(o, ['goal', 'find', 'month', 'question', 'ask', 'extreme'])
    if (rawPlace !== undefined && typeof rawPlace !== 'string') return null
    if (rawGoal !== undefined && typeof rawGoal !== 'string') return null
    const word = keyOf(rawTask)
    // A goal named as the task ("warmest") is a month card.
    const goalAsTask = word !== '' && !has(TASK_WORDS, word) && has(GOAL_WORDS, word) ? GOAL_WORDS[word] : null
    if (word && !has(TASK_WORDS, word) && !goalAsTask) return null
    const task = goalAsTask ? 'month' : word ? TASK_WORDS[word] : rawGoal !== undefined ? 'month' : rawPlace !== undefined ? 'place' : null
    if (!task) return null
    const place = rawPlace === undefined ? '' : readPlace(rawPlace)
    if (task === 'place') return { task, place }
    return { task, place, goal: goalAsTask ?? (rawGoal === undefined ? 'warmest' : readGoal(rawGoal)) }
  },

  faults(config) {
    const out: string[] = []
    const s = stationOf(config.place)
    if (!s) {
      out.push(config.place === ''
        ? `A card needs a place: use one of ${STATION_IDS.join(', ')}, e.g. place "cairo".`
        : `There is no "${config.place}" station: use one of ${STATION_IDS.join(', ')}, e.g. place "cairo".`)
      return out
    }
    if (config.task === 'month') {
      if (!isGoal(config.goal)) {
        out.push(`There is no "${config.goal}" to find: goal must be ${GOALS.join(', ')}, e.g. goal "wettest".`)
        return out
      }
      const n = acceptedMonths(s, config.goal).length
      if (n > MAX_ACCEPTED) {
        const alt = GOALS.find((g) => g !== config.goal && acceptedMonths(s, g).length <= MAX_ACCEPTED && (g === 'warmest' || g === 'coldest') === (config.goal === 'warmest' || config.goal === 'coldest'))
          ?? GOALS.find((g) => acceptedMonths(s, g).length <= MAX_ACCEPTED)
        const why = config.goal === 'warmest' || config.goal === 'coldest' ? 'its temperature hardly changes through the year' : 'it is nearly dry for months on end'
        out.push(`${s.name}'s ${config.goal} month is not clear: ${why}, so ${n} months look the same. Use e.g. goal "${alt ?? 'wettest'}".`)
      }
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const s = stationOf(config.place)
    if (config.task === 'place') {
      const names = STATIONS.flatMap((x) => [x.name, x.full.split(',')[0], x.full.split(',')[1]?.trim()]).filter(Boolean) as string[]
      const named = names.some((n) => new RegExp(`\\b${n.normalize('NFD').replace(/[̀-ͯ]/g, '')}\\b`, 'i').test(text.normalize('NFD').replace(/[̀-ͯ]/g, ''))) || /\b(?:egypt|uk|england|alaska|australia|africa|asia|europe|arctic)\b/i.test(text)
      const gives = /\b(?:hot|cold|warm|cool|wet|dry|rainy|desert|polar|tundra|tropic\w*|equator\w*|monsoon|mediterranean|temperate|maritime|continental|savann?ah|sahara|hemisphere|north\w*|south\w*|latitudes?|degrees?|poles?|seasonal|summers?|winters?)\b|\d+\s*°/i.test(text)
      if (named || gives) {
        out.push(`the prompt gives the answer away: it names the place, its latitude or what its climate is like, which the learner is to find from the graph -- ask for the match only ("${example}")`)
      }
    } else if (s && isGoal(config.goal)) {
      const best = exactMonths(s, config.goal)
      const answers = acceptedMonths(s, config.goal)
      const said = [...new Set([...best, ...answers])].some((m) => MONTH_NAME_RES[m].test(text))
      const opposite: Record<Goal, RegExp> = {
        warmest: /\b(?:coldest|coolest|driest|wettest|rainiest)\b/i, coldest: /\b(?:warmest|hottest|driest|wettest|rainiest)\b/i,
        wettest: /\b(?:warmest|hottest|coldest|coolest|driest)\b/i, driest: /\b(?:warmest|hottest|coldest|coolest|wettest|rainiest)\b/i,
      }
      const lag = /\b(?:solstice|equinox|lag|a month (?:after|later)|after the sun|rainy season|wet season|dry season|monsoon)\b/i.test(text)
      if (said || lag) out.push(`the prompt gives the answer away: it names a month that is right, or says why it will be -- ask for the ${goalWords[config.goal].adj} month only ("${example}")`)
      if (opposite[config.goal].test(text)) out.push(`the prompt asks for something else: this card finds the ${goalWords[config.goal].adj} month -- ask for that ("${example}")`)
    }
    if (/\b(?:wind|winds|pressure|barometer|anemometer|humidity|hygrometer|cloud|clouds|fronts?|isobars?|forecasts?|satellites?|maps?|storms?|snow|fog|sunshine|visibility|wind vane|stevenson|continents?|ocean currents?|altitude|mountains?)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws a thermometer, a rain gauge, the sun on a globe and a climate graph, nothing else -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    if (config.task === 'place') return { at: startPlace(config.place), month: PLACE_MONTH }
    const s = stationOf(config.place) ?? STATIONS[1]
    return { at: s.id, month: startMonth(s, isGoal(config.goal) ? config.goal : 'warmest') }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    const s = stationOf(config.place) ?? STATIONS[1]
    if (config.task === 'place') return { at: s.id, month: PLACE_MONTH }
    const goal = isGoal(config.goal) ? config.goal : 'warmest'
    return { at: s.id, month: exactMonths(s, goal)[0] ?? 0 }
  },

  View: ClimateStationView,

  prompt: `SCENE "climate-station" -- a weather and climate station drawn on a quiet light panel: a globe seen from the side with the sun's parallel rays coming in from the left (a beam of them is gold, and where it lands is a thick gold patch of ground), a thermometer and a rain gauge reading the chosen month, and the climate graph under them: temperature as a red line on the left axis in °C, rainfall as blue bars on the right axis in mm, January to December. The learner changes where the station is (place cards: drag the station on the globe, or use the latitude arrows) or which month it is (the month arrows, or tapping the graph). The sun's patch of ground widens towards the poles and in winter, narrows in summer, and goes dark in polar night; the mercury, the water in the gauge and the marker on the graph follow the month.
  For: weather and climate, climate graphs (temperature line, rainfall bars), reading a climate graph, weather instruments (thermometer and rain gauge), how climate changes with latitude and with the seasons, why the sun's angle matters, the hottest, coldest, wettest and driest months of a place, the seasons in the southern hemisphere. It answers "the seasons come from the distance to the sun" and "it is hottest at midsummer".
  place: a dashed graph is given and the learner finds the place whose graph fits it, by moving the station. place: barrow (Utqiaġvik, Alaska, 71° N, polar), london (London, UK, 51.5° N, temperate), cairo (Cairo, Egypt, 30° N, hot desert), singapore (Singapore, 1° N, equatorial), darwin (Darwin, Australia, 12.5° S, wet and dry tropical), sydney (Sydney, Australia, 34° S, southern temperate). All place cards share one pair of axes, so a dry place looks dry. The name is held back until marked.
  month: one named place, and the learner finds its goal month with the instruments and graph. goal: warmest, coldest, wettest or driest. Some goals are refused where the answer is not clear (Singapore warmest or coldest, Darwin warmest or driest, Cairo driest, Utqiaġvik driest). A month that looks as good as the best is right ("Near enough") and the exact month is said when marked. The card says the sun's highest month and the one-month lag when marked.
  Not drawn: wind, pressure, anemometers, barometers, weather fronts and maps, forecasts, humidity, cloud, altitude, ocean currents, a map of the climate zones, building the graph bar by bar. Do not use it for climate change policy, the political or business climate, space weather, or the weather map.
  Before marking the card shows the globe, the instruments with their readings, and the graph, and names none of the places in a place card; it holds back the place, the month that is right and the reasons. The prompt must say the gesture (drag the station, or use the arrows; use the month arrows or tap the graph) and ask for the outcome only: do NOT name the place or say its latitude or what its weather is like on a place card, and do NOT name the right month or say why it is the right one on a month card.
  config: { "task":"place", "place":"cairo" }  -- the prompt says "Drag the station around the globe, or use the arrows, until its graph matches the dashed graph."
       or { "task":"month", "place":"london", "goal":"warmest" }  -- the prompt says "Here is the climate of London, UK. Use the month arrows, or tap the graph, to find its warmest month."
       or { "task":"month", "place":"sydney", "goal":"coldest" }  -- the prompt says "Here is the climate of Sydney, Australia. Use the month arrows, or tap the graph, to find its coldest month."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the station around the globe, or use the arrows, until its graph matches the dashed graph.",
    "payload": { "engine":"climate-station", "config": { "task":"place", "place":"cairo" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:climate-station", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Here is the climate of London, UK. Use the month arrows, or tap the graph, to find its warmest month.",
    "payload": { "engine":"climate-station", "config": { "task":"month", "place":"london", "goal":"warmest" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:climate-station", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Here is the climate of Sydney, Australia. Use the month arrows, or tap the graph, to find its coldest month.",
    "payload": { "engine":"climate-station", "config": { "task":"month", "place":"sydney", "goal":"coldest" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:climate-station", "why":"..." } }`,
}

registerEngine(climateStationEngine as SceneEngine<unknown, unknown>)
