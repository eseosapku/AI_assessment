// lib/studylab/engines/half-life/config.ts
//
// A tray of real-looking nuclei, a decay curve under it, and time in the learner's hand. The nuclei go off like popcorn
// as the clock is dragged along: a sweep of the same length sets off half as many each time, and the hand feels it.
//   wait -- drag the clock until a fraction is left (half finds the half-life; a quarter or less is the usual exam sum, and
//           run on a named nuclide it is radioactive dating). With a background count it is the classic trap: the reading
//           never halves, only the source's share of it does.
//   draw -- before seeing it run, drag a bead at each half-life to how many will be left. The learner who thinks "half, then
//           the other half" draws a straight line to nothing, and is told so. Once right, a real run is laid over the beads.
//
// The rules, all computed here and never read from the drawing:
//   the amount left after t is start x 2^(-t / half-life), with background, if any, added on top and never falling;
//   time moves in quarters of a half-life, so a whole number of half-lives is always a place the clock can stop;
//   `wait` is right exactly at the whole number of half-lives that leaves the fraction asked for;
//   `draw` is right when every bead is within BEAD_TOLERANCE sixty-fourths of start / 2^n.
//
// The sample. Which nucleus goes is random, and New sample draws another. HOW MANY have gone at each stop of the clock is
// fixed to the nearest whole nucleus of the formula, so the count a learner reads can never contradict the marking. A real
// sample of 64 would wobble around this curve by several nuclei; the card says "about" where it speaks of a real sample, and
// this is the one idealisation in it.
//
// Facts:
//   half-lives are the rounded values school courses print, from NUBASE2020 (Kondev et al., Chinese Physics C 45, 030001). Carbon-14
//   is given as 5730 years, the figure syllabuses use (NUBASE2020 has 5700), and a writer's 5700 passes too. Decay products are the
//   immediate daughters. Half-life is unchanged by temperature or pressure, and is defined by nuclei or by count rate: Binding Blocks
//   (University of York) teacher notes. Background is subtracted before halving: the standard practical treatment in IGCSE and A-level.
//
// Ideas taken, never code or art:
//   - the two misconceptions the card is built against, "half of a nucleus has decayed after one half-life" and the failure to see that random
//     individuals give a predictable whole: Variability in student reasoning about radioactive decay as a stochastic process (Phys. Rev. Phys. Educ.
//     Res.), and Student understanding of emergent aspects of radioactivity (IJPCE). So nuclei here go all at once, and there is no half-gone drawing;
//   - "gone after two half-lives" and "only half decays, then it stops": the Physics Stuff half-life page and the classroom literature it lists;
//   - a grid above a curve, and a "new random sample" button that changes which go and leaves the curve alone: Physics Stuff's simulator, and the
//     random-nature learning goal of PhET's Radioactive Dating Game. Its 400 yellow squares are replaced by drawn nuclei, few enough to see;
//   - reading the half-life off a plot, and more than one halving of it: the Binding Blocks dice activity.
// Refused:
//   - dice, coins and M&Ms: a good bench activity, but on a screen a picture of dice is one step further from the nucleus;
//   - exact random samples: their half-life would disagree with the sum a learner is asked to do, so a marked card would argue with itself;
//   - alpha, beta and gamma, absorbers, decay equations, fission and fusion: other ideas, with other acts. They need scenes of their own.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { HalfLifeView } from './View'

/** The clock stops every quarter of a half-life, and runs for five half-lives. */
export const STEPS_PER_HALF_LIFE = 4
export const MAX_STEP = 20
export const LEFTS = [1 / 2, 1 / 4, 1 / 8, 1 / 16] as const
export const HALVES = [3, 4] as const
/** The most nuclei the tray draws, and the fewest a sample can have and still show the idea. */
export const DRAWN_MAX = 64
export const START_MIN = 16
export const START_MAX = 100000
export const HALF_LIFE_MAX = 99999
/** A bead's height, in sixty-fourths of the start, and how close to the true value it has to be. */
export const LEVELS = 64
export const BEAD_TOLERANCE = 3

export const MEASURES = ['nuclei', 'counts/min', 'counts/s', 'Bq'] as const
export type Measure = (typeof MEASURES)[number]

/** A GM tube gives a count. Activity is what the source does, and no counter on a bench reads it directly. */
export const isCount = (measure: Measure) => measure === 'counts/min' || measure === 'counts/s'

export const UNITS = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years', 'thousand years', 'million years', 'billion years'] as const

export type WaitConfig = {
  task: 'wait'
  /** The fraction to leave. */
  left: number
  halfLife: number
  unit: string
  /** What is there at the start: nuclei, or the first reading on the counter. */
  start: number
  measure: Measure
  /** Part of every reading, which never falls. */
  background: number
  nuclide: string | null
}
export type DrawConfig = {
  task: 'draw'
  /** How many half-lives have a bead. */
  halves: number
  start: number
  measure: Measure
  /** Optional: when given, the row under the graph reads in time, not in half-lives. */
  halfLife: number | null
  unit: string | null
  nuclide: string | null
}
export type HalfConfig = WaitConfig | DrawConfig
export type HalfState = {
  /** wait: where the clock is, in quarters of a half-life. */
  k?: number
  /** draw: each bead's height, in sixty-fourths of the start. */
  levels?: number[]
  /** draw: the bead moved last, whose number the tray shows. */
  at?: number
}

// ---------------------------------------------------------------------------
// Real nuclides. NUBASE2020, rounded as syllabuses round them; see the note above about carbon-14.

export type Nuclide = { name: string; symbol: string; halfLife: number; unit: string; product: string }
export const NUCLIDES: Nuclide[] = [
  { name: 'carbon-14', symbol: 'C', halfLife: 5730, unit: 'years', product: 'nitrogen-14' },
  { name: 'hydrogen-3', symbol: 'H', halfLife: 12.3, unit: 'years', product: 'helium-3' },
  { name: 'iodine-131', symbol: 'I', halfLife: 8, unit: 'days', product: 'xenon-131' },
  { name: 'cobalt-60', symbol: 'Co', halfLife: 5.3, unit: 'years', product: 'nickel-60' },
  { name: 'caesium-137', symbol: 'Cs', halfLife: 30, unit: 'years', product: 'barium-137' },
  { name: 'strontium-90', symbol: 'Sr', halfLife: 29, unit: 'years', product: 'yttrium-90' },
  { name: 'technetium-99m', symbol: 'Tc', halfLife: 6, unit: 'hours', product: 'technetium-99' },
  { name: 'uranium-238', symbol: 'U', halfLife: 4.5, unit: 'billion years', product: 'thorium-234' },
  { name: 'uranium-235', symbol: 'U', halfLife: 704, unit: 'million years', product: 'thorium-231' },
  { name: 'radon-222', symbol: 'Rn', halfLife: 3.8, unit: 'days', product: 'polonium-218' },
  { name: 'radium-226', symbol: 'Ra', halfLife: 1600, unit: 'years', product: 'radon-222' },
  { name: 'americium-241', symbol: 'Am', halfLife: 432, unit: 'years', product: 'neptunium-237' },
  { name: 'protactinium-234m', symbol: 'Pa', halfLife: 1.2, unit: 'minutes', product: 'uranium-234' },
  { name: 'polonium-210', symbol: 'Po', halfLife: 138, unit: 'days', product: 'lead-206' },
  { name: 'plutonium-239', symbol: 'Pu', halfLife: 24100, unit: 'years', product: 'uranium-235' },
  { name: 'thorium-234', symbol: 'Th', halfLife: 24, unit: 'days', product: 'protactinium-234' },
  { name: 'fluorine-18', symbol: 'F', halfLife: 110, unit: 'minutes', product: 'oxygen-18' },
  { name: 'sodium-24', symbol: 'Na', halfLife: 15, unit: 'hours', product: 'magnesium-24' },
  { name: 'phosphorus-32', symbol: 'P', halfLife: 14.3, unit: 'days', product: 'sulfur-32' },
]

const massOf = (n: Nuclide) => n.name.split('-')[1]
const elementOf = (n: Nuclide) => n.name.split('-')[0]
const NUCLIDE_WORDS: Record<string, Nuclide> = {}
for (const n of NUCLIDES) {
  const m = massOf(n)
  const e = elementOf(n)
  const s = n.symbol.toLowerCase()
  for (const w of [`${e}${m}`, `${m}${e}`, `${s}${m}`, `${m}${s}`]) NUCLIDE_WORDS[w] = n
}
NUCLIDE_WORDS.tritium = NUCLIDES[1]
NUCLIDE_WORDS.radiocarbon = NUCLIDES[0]
NUCLIDE_WORDS.technetium99 = NUCLIDES[6]
NUCLIDE_WORDS.protactinium234 = NUCLIDES[12]

export const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
export const knownNuclide = (name: string | null): Nuclide | null => (name && has(NUCLIDE_WORDS, squash(name)) ? NUCLIDE_WORDS[squash(name)] : null)

/** The name on the card for what has not decayed, and for what it has become. */
export function namesOf(config: HalfConfig): { parent: string; product: string } {
  const known = knownNuclide(config.nuclide)
  if (known) return { parent: known.name, product: known.product }
  return { parent: config.nuclide ?? 'not yet decayed', product: 'decayed' }
}

// ---------------------------------------------------------------------------
// The law, and numbers as they are written.

const SECONDS: Record<string, number> = {
  seconds: 1, minutes: 60, hours: 3600, days: 86400, weeks: 604800, months: 2629800, years: 31557600,
  'thousand years': 31557600e3, 'million years': 31557600e6, 'billion years': 31557600e9,
}

export const fractionAt = (k: number) => 2 ** (-k / STEPS_PER_HALF_LIFE)

/** The amount the graph plots at step k: what is left of the source, plus the background on top. */
export function amountAt(config: HalfConfig, k: number): number {
  const bg = config.task === 'wait' ? config.background : 0
  return bg + (config.start - bg) * fractionAt(k)
}

/** A number as a person writes it: two places at most, none and a comma from a thousand up. */
export function fmt(v: number): string {
  const a = Math.abs(v)
  if (a >= 1000) return Math.round(v).toLocaleString('en-GB')
  return String(Number(v.toFixed(2)))
}
/** The same, kept short for the graph's upright axis. */
export const fmtAxis = (v: number) => (Math.abs(v) >= 10000 ? `${Number((v / 1000).toFixed(1))}k` : fmt(v))

const SHORT: Record<string, string> = { seconds: 's', minutes: 'min', hours: 'h', 'thousand years': 'thousand y', 'million years': 'million y', 'billion years': 'billion y' }
/** Beside the clock's number, where room is short. */
export const shortUnit = (unit: string) => (has(SHORT, unit) ? SHORT[unit] : unit)
/** In a sentence: "1 minute", "24 minutes", "4.5 billion years". */
export const spelled = (v: number, unit: string) => `${fmt(v)} ${v === 1 ? unit.replace(/s$/, '') : unit}`

/** Round marks along the time axis: at most six labels, and nothing to do with the half-life. */
export function timeTicks(max: number): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0]
  const mag = 10 ** Math.floor(Math.log10(max))
  const step = [0.1, 0.2, 0.5, 1, 2, 5, 10].map((m) => m * mag).find((s) => max / s < 6) ?? mag
  const out: number[] = []
  for (let i = 0; i * step <= max + 1e-9; i++) out.push(Number((i * step).toFixed(6)))
  return out
}

/** Marks up the graph: quarters when they are whole numbers, else halves, else only the ends. */
export function amountTicks(start: number): number[] {
  if (start % 4 === 0) return [0, start / 4, start / 2, (3 * start) / 4, start]
  if (start % 2 === 0) return [0, start / 2, start]
  return [0, start]
}

export const isLeft = (v: number) => (LEFTS as readonly number[]).includes(v)
export const halvesFor = (left: number) => Math.round(-Math.log2(left))
export const targetStep = (config: WaitConfig) => halvesFor(config.left) * STEPS_PER_HALF_LIFE

const LEFT_WORD: Record<number, string> = { 1: 'half', 2: 'a quarter', 3: 'an eighth', 4: 'a sixteenth' }
export const leftWord = (config: WaitConfig) => LEFT_WORD[halvesFor(config.left)] ?? 'that fraction'

// ---------------------------------------------------------------------------
// The sample: which nucleus goes when. Seeded, so a frame can be redrawn and tested.

export type Sample = {
  /** How many nuclei the tray draws. */
  n: number
  /** The step at which each nucleus goes, by its place in the tray; Infinity if it outlasts the clock. */
  times: number[]
  /** Places in the tray, first to go first. */
  order: number[]
}

/** A small seeded generator (mulberry32): the same seed gives the same sample. */
function random(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const drawnOf = (start: number) => Math.max(1, Math.min(DRAWN_MAX, Math.round(start)))
export const leftAtStep = (n: number, k: number) => Math.round(n * fractionAt(k))

const sampleMemo = new Map<string, Sample>()
export function sampleOf(start: number, seed: number): Sample {
  const n = drawnOf(start)
  const key = `${n}/${seed}`
  const known = sampleMemo.get(key)
  if (known) return known
  const rand = random(seed)
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const times = Array.from({ length: n }, () => Infinity)
  let next = 0
  for (let k = 0; k < MAX_STEP; k++) {
    // How many go in this quarter of a half-life is the formula's; when within it each one goes is chance.
    const going = leftAtStep(n, k) - leftAtStep(n, k + 1)
    const within = Array.from({ length: going }, () => k + 0.04 + rand() * 0.92).sort((a, b) => a - b)
    for (const t of within) times[order[next++]] = t
  }
  const sample = { n, times, order }
  if (sampleMemo.size > 200) sampleMemo.clear()
  sampleMemo.set(key, sample)
  return sample
}

/** How many of a sample are still whole at a moment of the clock. */
export const stillWhole = (sample: Sample, k: number) => sample.times.filter((t) => t > k).length

// ---------------------------------------------------------------------------
// The state, read safely.

export function madeStep(state: HalfState | null | undefined): number | null {
  const k = state?.k
  return typeof k === 'number' && Number.isInteger(k) && k >= 0 && k <= MAX_STEP ? k : null
}

/** How many beads to draw: a refused count still draws something, so nothing can crash on it. */
export const beadsOf = (config: DrawConfig) => (Number.isFinite(config.halves) ? Math.max(0, Math.min(8, Math.round(config.halves))) : 0)

/** The beads, with anything impossible back at the start. */
export function madeLevels(config: DrawConfig, state: HalfState | null | undefined): number[] {
  const raw = Array.isArray(state?.levels) ? state!.levels! : []
  return Array.from({ length: beadsOf(config) }, (_, i) => {
    const v = raw[i]
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= LEVELS ? v : LEVELS
  })
}

export const trueLevel = (i: number) => LEVELS / 2 ** (i + 1)
/** A bead's height as the amount it stands for. */
export const amountOfLevel = (config: HalfConfig, level: number) => Math.round((config.start * level) / LEVELS)

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function done(config: HalfConfig, state: HalfState | null | undefined): boolean {
  if (config.task === 'wait') return madeStep(state) === targetStep(config)
  if (!Array.isArray(state?.levels) || state!.levels!.length !== beadsOf(config)) return false
  if (beadsOf(config) === 0) return false
  return madeLevels(config, state).every((v, i) => Math.abs(v - trueLevel(i)) <= BEAD_TOLERANCE)
}

export function wrongBeads(config: DrawConfig, state: HalfState | null | undefined): string[] {
  return madeLevels(config, state).flatMap((v, i) => (Math.abs(v - trueLevel(i)) <= BEAD_TOLERANCE ? [] : [`bead-${i + 1}`]))
}

// ---------------------------------------------------------------------------
// What is said once marked.

const noun = (config: HalfConfig) => (config.measure === 'nuclei' ? 'nuclei' : config.measure === 'Bq' ? 'activity' : 'count rate')

/** The amounts in turn, in words: "64, then 32, 16, 8". */
function chain(config: HalfConfig, from: number, to: number): string {
  const bg = config.task === 'wait' ? config.background : 0
  const list: string[] = []
  for (let m = from; m <= to; m++) list.push(fmt(Math.round((config.start - bg) * 2 ** -m)))
  return list.length > 1 ? `${list[0]}, then ${list.slice(1).join(', ')}` : list[0]
}

const COUNTLESS = 'A new sample loses different nuclei, about as many.'

/** What a correct card says. */
export function working(config: HalfConfig): string {
  if (config.task === 'draw') {
    const list = Array.from({ length: beadsOf(config) }, (_, i) => fmt(Math.round(config.start / 2 ** (i + 1))))
    const said = `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
    return `Yes. ${said}. Each half-life takes half of what is left, so the line curves and two half-lives do not empty it. The red line is one run of chance: each step is one nucleus going.`
  }
  const n = halvesFor(config.left)
  const unit = config.unit
  const answer = spelled(n * config.halfLife, unit)
  const each = spelled(config.halfLife, unit)
  if (config.background > 0) {
    const src = config.start - config.background
    const reading = fmt(Math.round(amountAt(config, n * STEPS_PER_HALF_LIFE)))
    const head = n === 1
      ? `Yes. ${answer}: the source's share of the reading has halved, from ${fmt(src)} to ${fmt(Math.round(src / 2))}.`
      : `Yes. ${answer}, which is ${n} half-lives of ${each}: the source's share of the reading went ${chain(config, 0, n)}.`
    return `${head} The counter reads ${reading} because the ${fmt(config.background)} background never falls, so take it off before halving anything.`
  }
  const what = noun(config)
  if (n === 1) {
    if (config.measure === 'nuclei') return `Yes. ${answer}: half the nuclei have gone, so that is the half-life. Another ${each} takes half of what is left, not all of it. ${COUNTLESS}`
    return `Yes. ${answer}: the ${what} has halved, so that is the half-life. It halves because half as many nuclei are left to decay. Another ${each} halves it again, and does not end it.`
  }
  if (config.measure === 'nuclei') return `Yes. ${answer}, which is ${n} half-lives of ${each}. ${chain(config, 0, n)}: each half-life takes half of what is left, so two half-lives do not empty it. ${COUNTLESS}`
  return `Yes. ${answer}, which is ${n} half-lives of ${each}. ${chain(config, 0, n)}: each half-life halves the ${what}, because half as many nuclei are left to decay.`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: HalfConfig, state: HalfState | null | undefined): string {
  if (config.task === 'draw') {
    const levels = madeLevels(config, state)
    const value = (level: number) => fmt(amountOfLevel(config, level))
    if (levels.every((v) => v === LEVELS)) return 'Your beads are all still at the start, which says nothing decays at all.'
    const rise = levels.findIndex((v, i) => v > (i === 0 ? LEVELS : levels[i - 1]))
    if (rise >= 0) return `Your line goes up after ${rise === 0 ? 'the start' : `${rise} half-li${rise === 1 ? 'fe' : 'ves'}`}, but a nucleus that has decayed does not come back.`
    const drops = levels.map((v, i) => (i === 0 ? LEVELS : levels[i - 1]) - v)
    const straight = Math.max(...drops) - Math.min(...drops) <= BEAD_TOLERANCE * 2 && Math.min(...drops) > 0
    if (straight) return 'Your line is straight: the same number go in every half-life, so the sample would run out. Does a half-life take a set number of nuclei?'
    const i = levels.findIndex((v, idx) => Math.abs(v - trueLevel(idx)) > BEAD_TOLERANCE)
    const before = i === 0 ? LEVELS : levels[i - 1]
    const from = i === 0 ? 'the start' : `half-life ${i}`
    const much = levels[i] * 2 > before ? 'less than half of them went' : 'more than half of them went'
    return `Between ${from} and half-life ${i + 1} your line goes from ${value(before)} to ${value(levels[i])}: ${much}.`
  }
  const k = madeStep(state) ?? 0
  if (k === 0) return 'The clock has not moved, so nothing has decayed yet.'
  const when = spelled((k * config.halfLife) / STEPS_PER_HALF_LIFE, config.unit)
  const reading = Math.round(amountAt(config, k))
  if (config.background > 0) {
    // The trap, by name: they have halved the whole reading.
    const nearest = Array.from({ length: MAX_STEP + 1 }, (_, j) => j).reduce((best, j) => (Math.abs(amountAt(config, j) - config.start / 2) < Math.abs(amountAt(config, best) - config.start / 2) ? j : best), 0)
    if (k === nearest) return `The counter reads ${fmt(reading)}, about half of its first reading. But ${fmt(config.background)} of every reading is background, and that part never falls.`
  }
  const more = fractionAt(k) > config.left
  const compare = `${more ? 'more' : 'less'} than ${leftWord(config)}`
  if (config.measure === 'nuclei') return `You stopped at ${when}, with ${fmt(reading)} of the ${fmt(config.start)} left. That is ${compare}.`
  if (config.measure === 'Bq') return `You stopped at ${when}, with an activity of ${fmt(reading)} Bq. That is ${compare} of where it started.`
  return `You stopped at ${when}, with the counter reading ${fmt(reading)}. The source has ${compare} of its ${noun(config)} left.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'wait' | 'draw'> = {
  wait: 'wait', wind: 'wait', 'wind-on': 'wait', 'wind-the-clock': 'wait', clock: 'wait', time: 'wait', run: 'wait', watch: 'wait', decay: 'wait', sample: 'wait', stop: 'wait',
  find: 'wait', 'find-half-life': 'wait', 'find-the-half-life': 'wait', 'half-life': 'wait', measure: 'wait', 'measure-half-life': 'wait', 'how-long': 'wait', 'time-to-fraction': 'wait',
  date: 'wait', dating: 'wait', age: 'wait', 'carbon-dating': 'wait', 'radioactive-dating': 'wait', reverse: 'wait', 'background': 'wait', 'background-count': 'wait',
  draw: 'draw', 'draw-curve': 'draw', 'draw-the-curve': 'draw', 'draw-graph': 'draw', curve: 'draw', 'decay-curve': 'draw', sketch: 'draw', plot: 'draw', graph: 'draw', predict: 'draw', prediction: 'draw', 'predict-the-curve': 'draw', make: 'draw', build: 'draw', beads: 'draw',
}

const UNIT_WORDS: Record<string, string> = {
  s: 'seconds', sec: 'seconds', secs: 'seconds', second: 'seconds', seconds: 'seconds',
  min: 'minutes', mins: 'minutes', minute: 'minutes', minutes: 'minutes',
  h: 'hours', hr: 'hours', hrs: 'hours', hour: 'hours', hours: 'hours',
  d: 'days', day: 'days', days: 'days', week: 'weeks', weeks: 'weeks', wk: 'weeks', month: 'months', months: 'months',
  y: 'years', yr: 'years', yrs: 'years', year: 'years', years: 'years',
  'thousand-years': 'thousand years', 'thousand-year': 'thousand years', kyr: 'thousand years', ka: 'thousand years',
  'million-years': 'million years', 'million-year': 'million years', myr: 'million years', ma: 'million years',
  'billion-years': 'billion years', 'billion-year': 'billion years', byr: 'billion years', ga: 'billion years',
}
const readUnit = (raw: unknown): string => {
  const key = keyOf(raw)
  return has(UNIT_WORDS, key) ? UNIT_WORDS[key] : key.replace(/-/g, ' ')
}

const toNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw !== 'string') return null
  const v = Number(raw.trim().replace(/,/g, ''))
  return raw.trim() !== '' && Number.isFinite(v) ? v + 0 : null
}

/** "8 minutes", "4.5 billion years", 8, "6h": a number and maybe a unit, and null when it is neither. */
function readDuration(raw: unknown): { value: number; unit: string | null } | null {
  const plain = toNumber(raw)
  if (plain !== null) return { value: plain, unit: null }
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^(-?[\d.,]+(?:e\d+)?)\s*([a-zA-Z][a-zA-Z -]*)$/)
  if (!m) return null
  const value = toNumber(m[1])
  return value === null ? null : { value, unit: readUnit(m[2]) }
}

/** Very long half-lives are written in the unit people use for them. */
function tidyDuration(value: number, unit: string): { value: number; unit: string } {
  if (unit === 'years' && value >= 1e9) return { value: value / 1e9, unit: 'billion years' }
  if (unit === 'years' && value >= 1e6) return { value: value / 1e6, unit: 'million years' }
  return { value, unit }
}

const FRACTION_WORDS: Record<string, number> = { half: 1 / 2, quarter: 1 / 4, third: 1 / 3, fifth: 1 / 5, eighth: 1 / 8, tenth: 1 / 10, sixteenth: 1 / 16, 'thirty-second': 1 / 32, thirtysecond: 1 / 32 }

/** A share of the sample, as "1/8", "an eighth", "12.5%", "1 in 8" or 0.125. Above 1 it is a count of what is left. */
function readShare(raw: unknown): { share: number } | { count: number } | null {
  const n = toNumber(raw)
  if (n !== null) return n > 0 && n < 1 ? { share: n } : { count: n }
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  const over = s.match(/^(\d+)\s*(?:\/|in|out of)\s*(\d+)$/)
  if (over && Number(over[2]) > 0) return { share: Number(over[1]) / Number(over[2]) }
  const pct = s.match(/^([\d.]+)\s*(?:%|percent|per cent)$/)
  if (pct) return { share: Number(pct[1]) / 100 }
  let word = s.replace(/ (?:left|remains?|remaining)$/, '').replace(/s$/, '')
  while (/^(?:only|just|about|an?|one)[\s-]+/.test(word)) word = word.replace(/^(?:only|just|about|an?|one)[\s-]+/, '')
  return has(FRACTION_WORDS, word) ? { share: FRACTION_WORDS[word] } : null
}

const MEASURE_WORDS: Record<string, Measure> = {
  nuclei: 'nuclei', nucleus: 'nuclei', atoms: 'nuclei', atom: 'nuclei', 'number-of-nuclei': 'nuclei', 'number-of-atoms': 'nuclei', mass: 'nuclei',
  count: 'counts/min', counts: 'counts/min', 'count-rate': 'counts/min', countrate: 'counts/min', 'counts-min': 'counts/min', 'counts-per-minute': 'counts/min', cpm: 'counts/min', 'count-rate-per-minute': 'counts/min', gm: 'counts/min', geiger: 'counts/min',
  'counts-s': 'counts/s', 'counts-per-second': 'counts/s', cps: 'counts/s', 'count-rate-per-second': 'counts/s',
  bq: 'Bq', becquerel: 'Bq', becquerels: 'Bq', activity: 'Bq',
}
const readMeasure = (raw: unknown): Measure | null => {
  const key = keyOf(raw)
  return has(MEASURE_WORDS, key) ? MEASURE_WORDS[key] : null
}

const nearestHalves = (n: number) => Math.max(3, Math.min(4, Math.round(n)))

/** The number on show at the right stop is not on show at the stops either side. */
export function standsAlone(config: WaitConfig): boolean {
  const k = targetStep(config)
  const read = (j: number) => Math.round(amountAt(config, j))
  return read(k) !== read(k - 1) && read(k) !== read(k + 1)
}

/** What a prompt can safely say: the gesture and the aim, with the sample named. */
export function goodPrompt(config: HalfConfig): string {
  if (config.task === 'draw') {
    const what = config.measure === 'nuclei' ? 'how many nuclei are left' : `what the ${noun(config)} reads`
    return `Before it runs, drag each bead up or down to show ${what} after that many half-lives.`
  }
  const gesture = 'Drag the clock handle along the time line, or tap + and -,'
  const word = leftWord(config)
  if (config.background > 0) return `The dashed line is the background count. ${gesture} until ${word === 'half' ? 'half' : `only ${word}`} of the source's nuclei ${word === 'half' ? 'have decayed' : 'are left'}.`
  if (config.measure !== 'nuclei') return `${gesture} until the ${noun(config)} has fallen to ${word} of where it started.`
  return word === 'half' ? `${gesture} until half of the nuclei have gone.` : `${gesture} until only ${word} of the nuclei are left.`
}

export const halfLifeEngine: SceneEngine<HalfConfig, HalfState> = {
  id: 'half-life',
  // Only what cannot catch anything else. `scenesFor` matches a covers word by its first five letters and `sceneCatalogue` by any single
  // word, so "half-life" would catch "half of a number" and "life cycles", and "radioactivity" would catch "radio waves": those are phrases.
  covers: ['Geiger'],
  phrases: [
    'half-life', 'half life', 'half-lives', 'half lives', 'halflife', 'radioactivity', 'radioactive decay', 'radioactive materials', 'radioactive isotopes', 'radioactive isotope', 'radioactive elements', 'radioisotope', 'radioisotopes',
    'nuclear decay', 'decay of nuclei', 'random decay', 'randomness and decay', 'random nature of decay', 'decay curve', 'decay curves', 'decay graph', 'decay graphs', 'decay constant',
    'rate of decay', 'carbon dating', 'radiocarbon', 'radiocarbon dating', 'radioactive dating', 'radiometric dating', 'radioisotope dating', 'count rate', 'background count', 'Geiger-Muller tube',
  ],
  // Other sciences' half-lives, the game, and the parts of radioactivity this card does not draw. Every one of these is checked by a test:
  // a word under three letters is dropped when phrases are matched, so "half-life 2" would rule out every half-life at all.
  notFor: [
    // Pharmacology and the body.
    'half-life of a drug', 'half-life of drugs', 'half-lives of drugs', 'half-life of the drug', 'drug half-life', 'drug half-lives', 'half-life of a medicine', 'half-life of medicines', 'half-life of a medication', 'half-life of medication',
    'elimination half-life', 'plasma half-life', 'biological half-life', 'half-life in the body', 'half-life of caffeine', 'caffeine half-life', 'half-life of alcohol', 'half-life of aspirin', 'half-life of paracetamol', 'half-life of ibuprofen', 'half-life of morphine', 'half-life of antibiotics', 'half-life of insulin', 'half-life of a hormone', 'half-life of hormones', 'half-life of mrna', 'half-life of proteins', 'half-life of a protein', 'half-life of an enzyme',
    'pharmacology', 'pharmacokinetics', 'pharmacist', 'pharmacy', 'drug dosing', 'dosage', 'dosing interval',
    // The game.
    'half-life game', 'half-life games', 'half-life video game', 'half-life series', 'half-life alyx', 'half-life franchise', 'half-life mod', 'gordon freeman', 'valve software', 'video game', 'video games', 'computer game', 'computer games', 'game design', 'esports',
    // Chemical kinetics: the same maths, a different idea, and a scene of its own.
    'first-order reaction', 'first-order reactions', 'first order reaction', 'first order reactions', 'first-order kinetics', 'first order kinetics', 'half-life of a reaction', 'half-life of reactions', 'half-life of a reactant', 'rate equation', 'rate equations', 'rate constant', 'order of reaction', 'orders of reaction', 'reaction kinetics', 'rates of reaction', 'rate of reaction',
    // Figures of speech and other things that decay.
    'half-life of knowledge', 'half-life of facts', 'half-life of skills', 'half-life of information', 'half-life of a fad', 'half-life of a tweet', 'half-life of plastic', 'half-life of plastics', 'half-life of pesticides', 'half-life of a pesticide', 'half-life of ddt',
    'tooth decay', 'dental decay', 'urban decay', 'orbital decay', 'memory decay', 'forgetting curve', 'ebbinghaus', 'sound decay', 'trace decay', 'bacterial decay', 'rate of decay of leaves', 'rate of decay of food', 'rate of decay of wood', 'rate of decay of organic',
    // Radioactivity this card does not draw.
    'alpha beta gamma', 'alpha decay', 'beta decay', 'gamma decay', 'alpha and beta decay', 'penetrating power', 'nuclear equation', 'nuclear equations', 'decay equation', 'decay equations', 'decay series', 'decay chain', 'decay chains', 'fission and fusion', 'nuclear fission', 'nuclear fusion', 'binding energy', 'mass defect',
    'discovering radioactivity', 'discovery of radioactivity', 'radioactivity all around', 'uses of radioactivity', 'application of radioactivity', 'applications of radioactivity', 'hazards of radioactivity', 'dangers of radioactivity', 'radioactivity safety',
    'radio waves', 'radio station', 'radio stations',
  ],
  // The learner varies how much time has passed, continuously, and watches how much is left.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const rawLevels = first(src, ['halves', 'beads'])
    const rawLeft = first(src, ['left', 'remaining', 'remain', 'fraction', 'fractionLeft', 'fraction_left', 'target', 'until'])
    const rawGone = first(src, ['decayed', 'gone', 'fractionDecayed', 'fraction_decayed'])
    const rawCount = first(src, ['halfLives', 'half_lives', 'halfLivesPassed', 'after', 'periods'])
    const rawHalf = first(src, ['halfLife', 'half_life', 'half-life', 'halflife', 'period', 'T'])
    const rawNuclide = first(src, ['nuclide', 'isotope', 'radioisotope', 'source', 'element', 'substance'])
    const rawBackground = first(src, ['background', 'bg', 'backgroundCount', 'background_count', 'backgroundRate', 'background_rate'])
    const rawActivity = first(src, ['activity', 'bq'])
    const rawRate = first(src, ['countRate', 'count_rate', 'rate', 'reading'])
    const rawNuclei = first(src, ['start', 'nuclei', 'atoms', 'N0', 'n0', 'initial', 'count', 'sample', 'number'])
    const rawMeasure = first(src, ['measure', 'quantity', 'axis', 'y'])
    if (!word && rawHalf === undefined && rawLeft === undefined && rawGone === undefined && rawCount === undefined && rawNuclide === undefined && rawNuclei === undefined && rawBackground === undefined && rawLevels === undefined && rawRate === undefined && rawActivity === undefined) return null
    const task = word ? TASK_WORDS[word] : rawLevels !== undefined ? 'draw' : 'wait'

    // The nuclide first: it can supply the half-life.
    let nuclide: string | null = null
    if (rawNuclide !== undefined && rawNuclide !== null) {
      if (typeof rawNuclide !== 'string') return null
      const text = rawNuclide.trim().replace(/\s+/g, ' ')
      nuclide = text === '' ? null : knownNuclide(text)?.name ?? text
    }
    const known = knownNuclide(nuclide)

    let halfLife: number | null = null
    let unit: string | null = null
    if (rawHalf !== undefined && rawHalf !== null) {
      const d = readDuration(rawHalf)
      if (!d) return null
      halfLife = d.value
      unit = d.unit
    }
    const rawUnit = first(src, ['unit', 'units', 'timeUnit', 'time_unit'])
    if (rawUnit !== undefined && rawUnit !== null) {
      if (typeof rawUnit !== 'string') return null
      unit = unit ?? readUnit(rawUnit)
    }
    if (halfLife === null && known) {
      halfLife = known.halfLife
      unit = known.unit
    }
    if (halfLife !== null) {
      const tidy = tidyDuration(halfLife, unit ?? 'minutes')
      halfLife = tidy.value
      unit = tidy.unit
    }

    // What the graph plots: a named measure, or what the amount was called.
    let measure: Measure | null = null
    if (rawMeasure !== undefined && rawMeasure !== null) {
      measure = readMeasure(rawMeasure)
      if (!measure) return null
    } else if (rawActivity !== undefined) measure = 'Bq'
    else if (rawRate !== undefined || rawBackground !== undefined) measure = 'counts/min'
    const given = rawActivity ?? rawRate ?? rawNuclei
    let start: number
    if (given === undefined || given === null) start = measure && measure !== 'nuclei' ? 240 : DRAWN_MAX
    else {
      const v = toNumber(given)
      if (v === null) return null
      start = v
    }
    const shown = measure ?? 'nuclei'

    if (task === 'draw') {
      let halves = 4
      if (rawLevels !== undefined && rawLevels !== null) {
        const n = toNumber(rawLevels)
        if (n === null) return null
        halves = n
      } else if (rawCount !== undefined && rawCount !== null) {
        const n = toNumber(rawCount)
        if (n === null) return null
        halves = n
      }
      return { task, halves, start, measure: shown, halfLife, unit, nuclide }
    }

    let left = 1 / 2
    if (rawLeft !== undefined && rawLeft !== null) {
      const s = readShare(rawLeft)
      if (!s) return null
      left = 'share' in s ? s.share : s.count / start
    } else if (rawGone !== undefined && rawGone !== null) {
      const s = readShare(rawGone)
      if (!s) return null
      left = 'share' in s ? 1 - s.share : 1 - s.count / start
    } else if (rawCount !== undefined && rawCount !== null) {
      const n = toNumber(rawCount)
      if (n === null) return null
      left = 2 ** -n
    }
    let background = 0
    if (rawBackground !== undefined && rawBackground !== null) {
      const b = toNumber(rawBackground)
      if (b === null) return null
      background = b
    }
    return { task, left, halfLife: halfLife ?? 8, unit: unit ?? 'minutes', start, measure: shown, background, nuclide }
  },

  faults(config) {
    const out: string[] = []
    const name = config.nuclide
    const known = knownNuclide(name)
    if (name && name.length > 18) out.push(`"${name}" is too long to name on the tray (18 letters): use a short name, e.g. nuclide "iodine-131".`)
    if (config.task === 'draw' && !(HALVES as readonly number[]).includes(config.halves)) {
      out.push(`${config.halves} beads will not fit the graph: halves must be 3 or 4, e.g. halves ${nearestHalves(Number.isFinite(config.halves) ? config.halves : 4)}.`)
    }
    if (config.halfLife !== null) {
      if (!(config.halfLife > 0)) out.push(`A half-life of ${config.halfLife} cannot be drawn: it must be above 0, e.g. halfLife 8.`)
      else if (config.halfLife > HALF_LIFE_MAX) out.push(`A half-life of ${fmt(config.halfLife)} is too long to write along the time axis (at most ${fmt(HALF_LIFE_MAX)}): use a larger unit, e.g. halfLife 4.5, unit "billion years".`)
      if (!config.unit || !has(SECONDS, config.unit)) out.push(`"${config.unit}" is not a unit the clock can show: use one of ${UNITS.join(', ')}, e.g. unit "minutes".`)
      else if (known && config.halfLife > 0) {
        const ratio = (config.halfLife * SECONDS[config.unit]) / (known.halfLife * SECONDS[known.unit])
        if (ratio < 0.97 || ratio > 1.03) out.push(`The half-life of ${known.name} is ${spelled(known.halfLife, known.unit)}, not ${spelled(config.halfLife, config.unit)}: leave halfLife out and the card uses the real one.`)
      }
    }
    if (!Number.isFinite(config.start) || config.start < START_MIN) out.push(`A sample of ${config.start} is too few to show a half-life (${START_MIN} or more): use e.g. start 64.`)
    else if (config.start > START_MAX) out.push(`${fmt(config.start)} is too long to write up the graph (at most ${fmt(START_MAX)}): use e.g. start 6400.`)
    if (config.task === 'wait') {
      if (!isLeft(config.left)) {
        out.push(`Leaving ${fmt(config.left * 100)}% is not a whole number of half-lives the clock can stop on: left must be 1/2, 1/4, 1/8 or 1/16, e.g. left "1/8".`)
      } else if (Number.isFinite(config.start) && config.start >= START_MIN && !standsAlone(config)) {
        // A learner who stops when the number is right must not be marked wrong: this stop's reading must be its own.
        out.push(config.background > 0
          ? `${fmt(amountAt(config, targetStep(config)))} is too close to the stops either side to tell apart: use a larger reading, e.g. start 140, background 20.`
          : `${fmt(config.start * config.left)} left of ${fmt(config.start)} is too few to tell from the stops either side: use a larger sample, e.g. start 64.`)
      }
      if (config.background < 0 || !Number.isFinite(config.background)) out.push(`A background of ${config.background} cannot be drawn: it must be 0 or more, e.g. background 20.`)
      else if (config.background > 0) {
        if (!isCount(config.measure)) out.push(`Background belongs to a count rate, not to ${config.measure === 'nuclei' ? 'nuclei' : 'activity'}: use measure "counts/min", e.g. measure "counts/min", start 140, background 20.`)
        else if (config.background > config.start / 4) out.push(`A background of ${fmt(config.background)} is too much of a first reading of ${fmt(config.start)} to see the source fall (a quarter at most): use e.g. start 140, background 20.`)
        else if (config.start - config.background < START_MIN) out.push(`Only ${fmt(config.start - config.background)} of that reading comes from the source: use e.g. start 140, background 20.`)
      }
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    // A number in the prompt as the answer: it may be written with a comma, and a count of nuclei is not a time.
    const says = (v: number) => new RegExp(`(?<![\\d.,-])${fmt(v).replace(/,/g, ',?').replace('.', '\\.')}(?![\\d]|\\.\\d|,\\d)(?!\\s*(?:%|nuclei|nucleus|atoms?|counts?|Bq|left|remain))`, 'i').test(text)
    if (config.task === 'wait') {
      const n = halvesFor(config.left)
      const time = /\b(?:\d+|two|three|four)\s+half[- ]lives\b/i.test(text)
      const answer = config.halfLife > 0 && (says(n * config.halfLife) || (n === 1 && says(config.halfLife)))
      const trap = config.background > 0 && (/\bsubtract|\btake (?:away|off)\b|\bminus\b|\bcorrect(?:ed)?\b|\bremov\w* (?:the )?background|\ballow(?:ing)? for\b/i.test(text) || says(amountAt(config, n * STEPS_PER_HALF_LIFE)))
      if (time || answer || trap) out.push(`the prompt gives the answer away: it says how long, how many half-lives or what the counter will read, which the learner is to find with the clock -- ask for the outcome only ("${example}")`)
      if (!isCount(config.measure) && /\bgeiger\b|\bGM tube\b|\bcount[- ]rate\b|\bcounter\b|\bbackground\b/i.test(text)) out.push(`the prompt promises something the card does not show: with measure "${config.measure}" it draws no counter and no background -- ask for ${config.measure === 'nuclei' ? 'nuclei' : 'activity'} ("${example}"), or use measure "counts/min"`)
    } else {
      const answers = Array.from({ length: beadsOf(config) }, (_, i) => Math.round(config.start / 2 ** (i + 1)))
      const numbers = answers.some((v) => new RegExp(`(?<![\\d.,])${fmt(v).replace(/,/g, ',?')}(?![\\d]|,\\d)`).test(text))
      const shape = /\bcurve[sd]?\b|\bexponential|\bstraight\b|\bhalv(?:e|es|ing)\b|\bhalf of\b|\bhalf again\b|\bnever (?:reach|run|empt)/i.test(text)
      if (numbers || shape) out.push(`the prompt gives the answer away: it says the numbers or the shape, which the learner is to predict with the beads -- ask for the prediction only ("${example}")`)
      if (/\bclock\b|\bwind\b|\bstepper\b|\btime line\b|\btimeline\b/i.test(text)) out.push(`the prompt promises something the card does not show: this task has beads and no clock -- ask for that ("${example}")`)
    }
    if (/\balpha\b|\bbeta\b|\bgamma\b|\babsorb|\bdecay equation|\bnuclear equation|\bmass number|\bproton number|\bfission\b|\bfusion\b|\bdice\b|\bcoins?\b|\bM&Ms?\b|\b(?:heat|cool|squeeze|compress)\s+(?:the|it|this)\b|\blisten\b|\bhear\b|\btype\s+(?:in|your|the|a)\b|\b(?:tap|click|pick|choose|select|follow)\s+(?:on\s+)?(?:a|an|one|the|each|any|which)\s+(?:single\s+)?nucle/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws nuclei going and a graph, and the learner ${config.task === 'wait' ? 'moves the clock' : 'moves the beads'} -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'wait' ? { k: 0 } : { levels: Array.from({ length: beadsOf(config) }, () => LEVELS) }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: config.task === 'draw' ? wrongBeads(config, state) : [] }
  },

  solve(config) {
    if (config.task === 'wait') return { k: targetStep(config) }
    return { levels: Array.from({ length: beadsOf(config) }, (_, i) => trueLevel(i)), at: beadsOf(config) - 1 }
  },

  View: HalfLifeView,

  prompt: `SCENE "half-life" -- radioactive decay, with time in the learner's hand. A quiet light panel holds a tray of up to 64 drawn nuclei, coral and grey clusters of protons and neutrons, named on the card, with a graph directly beneath. Each nucleus goes all at once, with a small flick, and turns pale: none ever goes partly. Which goes is random, and a New sample button changes which go and not how many; the count at each stop of the clock is the formula's, to the nearest nucleus.
  For: half-life, radioactive decay as a random process, decay curves, how long until a fraction is left, carbon dating, count rate and background count. It answers "half a nucleus has gone", "it is all gone after two half-lives", "you can tell which goes next" and "the reading halves" when there is background.
  wait: the learner drags the clock handle along the time axis, or taps + and -, and the nuclei go as it passes: the same sweep sets off half as many each half-life. A stair-step curve grows behind the handle. The clock stops every quarter of a half-life, up to 5 half-lives. It is right exactly at the time that leaves the fraction asked for. left: 1/2 (finds the half-life, default), 1/4, 1/8 or 1/16; "7/8 decayed" is read as decayed:"7/8". halfLife and unit: seconds, minutes, hours, days, weeks, months, years, thousand years, million years or billion years; default 8 minutes. nuclide: optional, e.g. "carbon-14", "iodine-131", "cobalt-60", "caesium-137", "technetium-99m", "uranium-238", which supplies the real half-life and names the tray; run it on carbon-14 for dating. start: how many at the start, 16 to 100000, default 64; with more than 64 each one drawn stands for many. measure: "nuclei" (default); "counts/min" or "counts/s", which draw a GM tube and a counter on the graph and plot the reading; or "Bq", which plots activity with no counter. background: with a count rate, a reading that never falls, drawn as a dashed line and included in start, at most a quarter of it; the half-life then comes where the source's share has halved, not the whole reading: this is the classic trap, and the wrong answer is named.
  draw: a prediction. The graph has a bead at each half-life, all starting at the top, and the learner drags each up or down, or uses arrow keys, to how many will be left. A line joins the beads, the numbers show in a row under the graph, and the tray shows the bead moved last. Right when every bead is within ${BEAD_TOLERANCE} sixty-fourths of the true value. Marked right, a real run is laid over the beads. A straight line, a rising line and each other mistake are said back. halves: 3 or 4 beads, default 4. halfLife and unit: optional, to read the row in time rather than in half-lives. start and measure as above, with no background.
  Not drawn: alpha, beta and gamma, absorbers, decay equations, fission and fusion, one nucleus on its own, the half-life of a drug or a chemical reaction. Do not use it for pharmacology, for first-order reactions, or for tooth decay or other rotting.
  Before marking the card shows the nuclei, the curve so far, the time on the clock and how many are left. It never prints the half-life, and the half-life is not marked on the axis. Marking says the time, the count of half-lives and why, and draws a half-life bracket along the axis. The prompt must ask for the outcome only: for wait, do NOT say how long, how many half-lives, or (with background) what the counter will read or that background must be taken off; a half-life may be stated only when left is not 1/2. For draw, do NOT say the numbers, that it curves or halves, or that it is not straight.
  config: { "task":"wait", "left":"1/2", "halfLife":8, "unit":"minutes" }  -- the prompt says "Drag the clock handle along the time line, or tap + and -, until half of the nuclei have gone."
       or { "task":"wait", "left":"1/8", "halfLife":6, "unit":"hours", "nuclide":"technetium-99m" }  -- the prompt says "The half-life of technetium-99m is 6 hours. Drag the clock handle along the time line, or tap + and -, until only an eighth of the nuclei are left."
       or { "task":"wait", "left":"1/2", "halfLife":12, "unit":"minutes", "measure":"counts/min", "start":140, "background":20 }  -- the prompt says "The dashed line is the background count. Drag the clock handle along the time line, or tap + and -, until half of the source's nuclei have decayed."
       or { "task":"draw", "halves":4, "start":64 }  -- the prompt says "Before it runs, drag each bead up or down to show how many nuclei are left after that many half-lives."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the clock handle along the time line, or tap + and -, until half of the nuclei have gone.",
    "payload": { "engine":"half-life", "config": { "task":"wait", "left":"1/2", "halfLife":8, "unit":"minutes" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:half-life", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The half-life of technetium-99m is 6 hours. Drag the clock handle along the time line, or tap + and -, until only an eighth of the nuclei are left.",
    "payload": { "engine":"half-life", "config": { "task":"wait", "left":"1/8", "halfLife":6, "unit":"hours", "nuclide":"technetium-99m" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:half-life", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The dashed line is the background count. Drag the clock handle along the time line, or tap + and -, until half of the source's nuclei have decayed.",
    "payload": { "engine":"half-life", "config": { "task":"wait", "left":"1/2", "halfLife":12, "unit":"minutes", "measure":"counts/min", "start":140, "background":20 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:half-life", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Before it runs, drag each bead up or down to show how many nuclei are left after that many half-lives.",
    "payload": { "engine":"half-life", "config": { "task":"draw", "halves":4, "start":64 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:half-life", "why":"..." } }`,
}

registerEngine(halfLifeEngine as SceneEngine<unknown, unknown>)
