// lib/studylab/engines/population-pyramid/config.ts
//
// A country's people drawn as a population pyramid, male on the left and female on the right, one rung for every ten years of
// age. The learner sets the country's birth rate and death rate (per 1000 people a year) and the people visibly age up the
// pyramid, decade by decade, for fifty years: the babies born since the start climb a rung every decade, those who were here at
// the start climb out of the top. The shape the pyramid ends up in is the answer the rates give. Two task kinds:
//   match  -- the pyramid starts in one shape and a dashed outline shows another; set the rates so that, fifty years on, the
//             pyramid fills the outline;
//   steady -- set the rates so that the country has about the same number of people fifty years on as it has now.
//
// The model (all computed here, never read from the drawing). Nine rungs a sex: 0-9 ... 70-79 and 80+. Each decade:
//   the average population over the decade is A = P / (1 - (birth - death) / 200), so births B = birth/100 * A and deaths
//   D = death/100 * A are exactly the rates asked for, with the population growing during the decade as it really does;
//   the deaths D are shared out over the cohorts by how likely each age is to die (infants and the old most, children and young
//   adults least), with a factor of 1.15 for men and 0.87 for women so the old end of the pyramid leans female; a single scale is
//   found by bisection so that exactly D people die;
//   every cohort moves up one rung (the 70-79s join the 80+), and the babies born fill the bottom rung, 512 boys to 488 girls.
// The pyramid a card starts from is the settled shape of the model at that shape's own rates (a long run at fixed rates),
// scaled to 10 million people.
//
// Marking is exact rules on that model, with a margin a learner can see:
//   match  -- half the sum of the differences between the learner's pyramid and the outline, rung by rung, as shares of the
//             population, is at most MATCH_TOL (8 per cent of the people standing in a different rung). The outline is the
//             model run at the target shape's rates, so it can always be filled exactly;
//   steady -- the population after fifty years is within STEADY_TOL (6 per cent) of what it is now.
//
// Facts:
//   - birth and death rates are per 1000 people per year (the crude rates a geography course uses); natural increase is their
//     difference; the demographic transition model's stages, in their usual school form: Stage 2 high birth rate with a falling
//     death rate (wide base, expansive), Stage 4 both low (straight sides, stationary), Stage 5 birth rate below the death rate
//     (narrow base, constrictive). The rates used here are round figures in the range real countries show (a birth rate near 40
//     in the youngest countries, near 8 in the oldest), not the figures of any one country;
//   - infant mortality highest, falling to a low through childhood and young adulthood, rising steeply after 50: the shape of
//     every life table; the relative weights are written from general knowledge of the shape, not fitted to one table;
//   - 105 boys are born for every 100 girls, and men die younger on average, so the oldest rungs lean female.
//
// Ideas taken, never code or art:
//   - the cohort-component way of making a pyramid change: each rung moves up a rung, births fill the bottom, and the
//     pyramid's shape is the history of the rates (the cohort model in public pyramid simulators, and the Habitable Planet
//     demographics lab: a population does not change its shape at once, because the people already born must age through it);
//   - the misconceptions listed in teaching guides: a wide base always means fast growth; a pyramid shows only births and deaths;
//     the horizontal axis is a count rather than a share; every country passes the stages at the same speed; the stages follow
//     the birth and death rates, not the pyramid's shape;
//   - the key move: the whole pyramid replays from the starting year, so the learner watches the babies climb and the old
//     leave, and sees why the base is where the change shows first.
// Refused:
//   - migration, life expectancy as a separate dial, and real countries' data: each makes a second dial, and the real figures need
//     a source this build does not have; a card with three dials teaches none of them;
//   - the exact stage names as the task: a pyramid's shape is not its stage, and the card says so once it is marked;
//   - births tied to the number of women of child-bearing age (a fertility rate): it would add population momentum, which this
//     crude-rate model does not claim to show.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { PopulationPyramidView } from './View'

export const SHAPES = ['wide-base', 'even', 'narrow-base'] as const
export type Shape = (typeof SHAPES)[number]

export const BANDS = 9
export const DECADES = 5
export const START_TOTAL = 10
export const BIRTH_MIN = 6
export const BIRTH_MAX = 46
export const DEATH_MIN = 6
export const DEATH_MAX = 30
/** Half the sum of rung-by-rung differences in share: how much of the population stands in another rung. */
export const MATCH_TOL = 0.08
export const STEADY_TOL = 0.06

/** Birth and death rates per 1000 a year: where each shape's pyramid settles, and where the outline of that shape is drawn. */
export const RATES: Record<Shape, { birth: number; death: number }> = {
  'wide-base': { birth: 40, death: 14 },
  even: { birth: 12, death: 12 },
  'narrow-base': { birth: 6, death: 12 },
}
/**
 * The outline a `match` card asks for, by where the pyramid starts and where it is to go: the rates that fifty years from that
 * start make the target shape. They differ from the starting rates, because a pyramid only reaches a new shape after the people
 * already born have aged through it.
 */
const TARGETS: Record<Shape, Partial<Record<Shape, { birth: number; death: number }>>> = {
  'wide-base': { even: { birth: 14, death: 10 }, 'narrow-base': { birth: 6, death: 12 } },
  even: { 'wide-base': { birth: 40, death: 10 }, 'narrow-base': { birth: 6, death: 12 } },
  'narrow-base': { 'wide-base': { birth: 40, death: 10 }, even: { birth: 12, death: 12 } },
}
export const targetRates = (from: Shape, to: Shape) => TARGETS[from][to] ?? RATES[to]

export type PyConfig =
  /** match: the pyramid starts as `from`; the outline is `to`. A word outside the shapes still parses; faults says what would work. */
  | { task: 'match'; from: string; to: string }
  /** steady: the pyramid starts as `from`; hold the number of people. */
  | { task: 'steady'; from: string }

/** What the learner has set. */
export type PyState = { birth: number; death: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const isShape = (s: string): s is Shape => (SHAPES as readonly string[]).includes(s)

// ---------------------------------------------------------------------------
// The people. A rung holds those who were here at the start (o) and those born since (f), so the two can be told apart.

export type Band = { o: number; f: number }
export type Pyr = { m: Band[]; f: Band[] }
export type Moved = { m: Band[]; f: Band[]; newM: Band; newF: Band }
export type Run = { states: Pyr[]; moves: Moved[] }

export const sz = (b: Band) => b.o + b.f
export const totalOf = (p: Pyr) => p.m.reduce((s, b) => s + sz(b), 0) + p.f.reduce((s, b) => s + sz(b), 0)
const zero = (): Band => ({ o: 0, f: 0 })
const plus = (a: Band, b: Band): Band => ({ o: a.o + b.o, f: a.f + b.f })
const times = (a: Band, k: number): Band => ({ o: a.o * k, f: a.f * k })

/** How likely each age is to die in the decade ahead, relative to the others: by the rung a cohort starts the decade in. */
const AGE_WEIGHT = [0.8, 0.4, 1, 1.6, 3.75, 9, 22, 50, 400]
const NEWBORN_WEIGHT = 5
const MEN = 1.15
const WOMEN = 0.87
const BOYS = 0.512

/** The share of each group that dies, scaled together so that exactly `deaths` people die. */
function allocate(sizes: number[], weights: number[], deaths: number): number[] {
  if (deaths <= 0) return sizes.map(() => 0)
  const dead = (s: number) => sizes.reduce((sum, n, i) => sum + n * Math.min(1, s * weights[i]), 0)
  let lo = 0
  let hi = 1e6
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (dead(mid) < deaths) lo = mid
    else hi = mid
  }
  return weights.map((w) => Math.min(1, hi * w))
}

/** One decade of the model. */
export function step(p: Pyr, birth: number, death: number): { next: Pyr; moved: Moved } {
  const P = totalOf(p)
  const g = (birth - death) / 200
  const A = P / (1 - g)
  const B = (birth / 100) * A
  const D = (death / 100) * A
  const born = [B * BOYS, B * (1 - BOYS)]
  const sizes = [...p.m.map(sz), ...p.f.map(sz), born[0], born[1]]
  const weights = [...AGE_WEIGHT.map((w) => w * MEN), ...AGE_WEIGHT.map((w) => w * WOMEN), NEWBORN_WEIGHT * MEN, NEWBORN_WEIGHT * WOMEN]
  const die = allocate(sizes, weights, D)
  const live = (list: Band[], at: number) => list.map((b, r) => times(b, 1 - die[at + r]))
  const mm = live(p.m, 0)
  const mf = live(p.f, BANDS)
  const newM: Band = { o: 0, f: born[0] * (1 - die[2 * BANDS]) }
  const newF: Band = { o: 0, f: born[1] * (1 - die[2 * BANDS + 1]) }
  const climb = (s: Band[], baby: Band): Band[] => [baby, ...s.slice(0, BANDS - 2), plus(s[BANDS - 2], s[BANDS - 1])]
  return { next: { m: climb(mm, newM), f: climb(mf, newF) }, moved: { m: mm, f: mf, newM, newF } }
}

const startMemo = new Map<string, Pyr>()
/** The years of rates that make each starting pyramid: a long run at fixed rates, and for an old population a recent fall in births. */
const HISTORY: Record<Shape, { birth: number; death: number; decades: number }[]> = {
  'wide-base': [{ birth: 40, death: 14, decades: 16 }],
  even: [{ birth: 12, death: 12, decades: 16 }],
  'narrow-base': [{ birth: 12, death: 12, decades: 12 }, { birth: 10, death: 11, decades: 1 }, { birth: 8, death: 11, decades: 1 }, { birth: 7, death: 11, decades: 1 }, { birth: 6, death: 11, decades: 1 }],
}
/** The pyramid a shape has at the start, as 10 million people who were all here at the start. */
export function startOf(shape: Shape): Pyr {
  const known = startMemo.get(shape)
  if (known) return known
  const flat = (): Band[] => Array.from({ length: BANDS }, () => ({ o: 1, f: 0 }))
  let p: Pyr = { m: flat(), f: flat() }
  for (const h of HISTORY[shape]) for (let i = 0; i < h.decades; i++) p = step(p, h.birth, h.death).next
  const k = START_TOTAL / totalOf(p)
  const fold = (list: Band[]): Band[] => list.map((b) => ({ o: (b.o + b.f) * k, f: 0 }))
  const out = { m: fold(p.m), f: fold(p.f) }
  startMemo.set(shape, out)
  return out
}

const runMemo = new Map<string, Run>()
/** Fifty years from a starting shape at the given rates: the pyramid at every decade, and how each cohort moved between them. */
export function simulate(from: Shape, birth: number, death: number): Run {
  const key = `${from}|${birth}|${death}`
  const known = runMemo.get(key)
  if (known) return known
  const states = [startOf(from)]
  const moves: Moved[] = []
  for (let i = 0; i < DECADES; i++) {
    const s = step(states[i], birth, death)
    states.push(s.next)
    moves.push(s.moved)
  }
  const run = { states, moves }
  if (runMemo.size > 4000) runMemo.clear()
  runMemo.set(key, run)
  return run
}

/** Every rung of both sides as a share of the whole: men 0-9 up to 80+, then women. */
export function shares(p: Pyr): number[] {
  const t = totalOf(p)
  return [...p.m, ...p.f].map((b) => sz(b) / t)
}
export const distance = (a: number[], b: number[]) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / 2

/** How much wider the bottom rung is than the average of the rungs from 20 to 59: the number that says what kind of base a pyramid has. */
export function baseRatio(p: Pyr): number {
  const at = (r: number) => sz(p.m[r]) + sz(p.f[r])
  return at(0) / ((at(2) + at(3) + at(4) + at(5)) / 4)
}

/** What a pyramid's base looks like, in plain words. The ranges are the same ones the marked sentences use. */
export function baseWords(p: Pyr): string {
  const q = baseRatio(p)
  if (q >= 1.8) return 'a wide base'
  if (q >= 1.2) return 'a base wider than the middle'
  if (q >= 0.9) return 'a base about as wide as the middle'
  if (q >= 0.7) return 'a base narrower than the middle'
  return 'a narrow base'
}

// ---------------------------------------------------------------------------
// What the learner has set, read safely.

export const clampRate = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(hi, Math.max(lo, n))
}

export const fromOf = (config: PyConfig): Shape => (isShape(config.from) ? config.from : 'wide-base')
export const toOf = (config: PyConfig): Shape => (config.task === 'match' && isShape(config.to) ? config.to : 'even')

export function ratesOf(config: PyConfig, state: PyState): { birth: number; death: number } {
  const r = RATES[fromOf(config)]
  return {
    birth: clampRate(state?.birth, BIRTH_MIN, BIRTH_MAX, r.birth),
    death: clampRate(state?.death, DEATH_MIN, DEATH_MAX, r.death),
  }
}

export function runOf(config: PyConfig, state: PyState): Run {
  const r = ratesOf(config, state)
  return simulate(fromOf(config), r.birth, r.death)
}

/** The outline a match card draws: fifty years at the target shape's rates. */
export function ghostOf(config: PyConfig): Pyr {
  const t = targetRates(fromOf(config), toOf(config))
  return simulate(fromOf(config), t.birth, t.death).states[DECADES]
}

/**
 * How far a side's bar may run, as a per cent of the whole population: the widest bar the card's own pyramids draw (its start,
 * the fifty years at the starting rates, and the answer), rounded up to an even number so the axis ticks read cleanly.
 * Bars beyond it, from extreme sliders, are drawn to the edge.
 */
export function axisOf(config: PyConfig): number {
  const runs = [runOf(config, populationPyramidEngine.initial(config)), runOf(config, populationPyramidEngine.solve(config))]
  const widest = Math.max(...runs.flatMap((r) => r.states.flatMap((p) => shares(p))), ...(config.task === 'match' ? shares(ghostOf(config)) : []))
  return Math.max(10, Math.ceil((widest * 100) / 2) * 2)
}

export const finalOf = (config: PyConfig, state: PyState) => runOf(config, state).states[DECADES]

/** How far the learner's pyramid is from the outline. */
export const gapOf = (config: PyConfig, state: PyState) => distance(shares(finalOf(config, state)), shares(ghostOf(config)))
/** Change in the number of people after fifty years, as a fraction. */
export const changeOf = (config: PyConfig, state: PyState) => totalOf(finalOf(config, state)) / START_TOTAL - 1

export function done(config: PyConfig, state: PyState): boolean {
  return config.task === 'match' ? gapOf(config, state) <= MATCH_TOL : Math.abs(changeOf(config, state)) <= STEADY_TOL
}

// ---------------------------------------------------------------------------
// The picture at any moment of the fifty years, so the people can be seen climbing between one decade and the next.

/** One cohort as drawn: which side, how far up (0 is the bottom rung; between two whole numbers it is on its way), how many. */
export type Bar = { side: 'm' | 'f'; row: number; o: number; f: number; fade: number }

const lerp = (a: number, b: number, s: number) => a + (b - a) * s

/**
 * The pyramid at time `t`, in decades from the start (0 to DECADES). On a whole decade every cohort sits on its rung. Between
 * two, each cohort slides up to the next rung losing the people who die; the babies come up from below; the 70-79s melt into the
 * 80+ rung. `total` is the number of people in millions at that moment.
 */
export function frameOf(run: Run, t: number): { bars: Bar[]; total: number } {
  const at = Math.min(DECADES, Math.max(0, t))
  const k = Math.min(DECADES - 1, Math.floor(at))
  const s = at - k
  const from = run.states[k]
  const moved = run.moves[k]
  const bars: Bar[] = []
  for (const side of ['m', 'f'] as const) {
    for (let r = 0; r < BANDS; r++) {
      const a = from[side][r]
      const b = moved[side][r]
      const o = lerp(a.o, b.o, s)
      const f = lerp(a.f, b.f, s)
      if (r === BANDS - 1) {
        // The oldest rung keeps its people, and takes in the cohort below as it arrives.
        const c = moved[side][r - 1]
        const arriving = from[side][r - 1]
        const w = s * s
        bars.push({ side, row: r, o: o + w * lerp(arriving.o, c.o, s), f: f + w * lerp(arriving.f, c.f, s), fade: 1 })
      } else {
        bars.push({ side, row: r + s, o, f, fade: r === BANDS - 2 ? 1 - s * s : 1 })
      }
    }
    const baby = side === 'm' ? moved.newM : moved.newF
    if (s > 0) bars.push({ side, row: -1 + s, o: 0, f: baby.f * s, fade: 1 })
  }
  return { bars: bars.filter((x) => x.fade > 0 && x.o + x.f > 1e-9), total: lerp(totalOf(from), totalOf(run.states[k + 1]), s) }
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card says no shape name, no stage and no count of the answer.

const NAMES: Record<Shape, { base: string; kind: string; why: string }> = {
  'wide-base': {
    base: 'a wide base',
    kind: 'an expansive pyramid, typical of Stage 2',
    why: 'Many babies are born and most grow up, so every younger cohort is bigger than the one above it.',
  },
  even: {
    base: 'a base about as wide as the middle',
    kind: 'a stationary pyramid, typical of Stage 4',
    why: 'Births and deaths are both low and close to equal, so the newest cohorts are about the same size.',
  },
  'narrow-base': {
    base: 'a narrow base',
    kind: 'a constrictive pyramid, typical of Stage 5',
    why: 'Fewer babies are born than there are grown-ups, so every younger cohort is smaller than the one above it.',
  },
}

const per = (n: number) => `${n} per 1000`

export function working(config: PyConfig, state: PyState): string {
  const r = ratesOf(config, state)
  if (config.task === 'match') {
    const to = toOf(config)
    const t = targetRates(fromOf(config), to)
    const exact = r.birth === t.birth && r.death === t.death
    const note = exact ? '' : `Near enough: the outline was drawn with a birth rate of ${per(t.birth)} and a death rate of ${per(t.death)}. `
    const bulge = to === 'even' && fromOf(config) === 'wide-base' ? ' The bulge higher up is the big generation that was young at the start, still ageing through.' : ''
    return `Yes. Fifty years on, your pyramid fills the outline. ${note}It has ${NAMES[to].base}: ${NAMES[to].kind}. ${NAMES[to].why}${bulge}`
  }
  const pct = Math.round(changeOf(config, state) * 100)
  const tail = Math.abs(pct) <= 0 ? 'The number of people is the same.' : `Near enough: the number of people changed by ${pct > 0 ? '+' : ''}${pct}%.`
  const close = r.birth === r.death ? 'equal' : 'close to equal'
  return `Yes. ${tail} Births of ${per(r.birth)} and deaths of ${per(r.death)} are ${close}, so the country neither grows nor shrinks. The pyramid still changed shape, as the people already alive aged through it.`
}

export function madeText(config: PyConfig, state: PyState): string {
  if (config.task === 'match') {
    const mine = baseWords(finalOf(config, state))
    const theirs = baseWords(ghostOf(config))
    if (mine === theirs) return `Fifty years on, your pyramid has ${mine}, like the outline, but it does not fit the outline yet: compare the rungs one by one.`
    return `Fifty years on, your pyramid has ${mine}. The outline has ${theirs}.`
  }
  const c = changeOf(config, state)
  const pct = Math.round(Math.abs(c) * 100)
  return `Fifty years on, your country has ${pct}% ${c > 0 ? 'more' : 'fewer'} people than it has now. It has not held steady yet.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const SHAPE_WORDS: Record<string, Shape> = {
  wide: 'wide-base', 'wide-base': 'wide-base', 'wide-based': 'wide-base', 'wide-bottom': 'wide-base', broad: 'wide-base', 'broad-base': 'wide-base', 'wide-at-the-base': 'wide-base',
  expansive: 'wide-base', young: 'wide-base', youthful: 'wide-base', 'young-population': 'wide-base', pyramid: 'wide-base', triangle: 'wide-base', triangular: 'wide-base',
  'stage-2': 'wide-base', 'stage-two': 'wide-base', 'rapid-growth': 'wide-base', growing: 'wide-base', 'fast-growing': 'wide-base', developing: 'wide-base',
  even: 'even', column: 'even', straight: 'even', 'straight-sided': 'even', 'straight-sides': 'even', stationary: 'even', rectangular: 'even', rectangle: 'even', tower: 'even',
  'stage-4': 'even', 'stage-four': 'even', stable: 'even', 'low-birth-low-death': 'even', 'low-and-stable': 'even',
  narrow: 'narrow-base', 'narrow-base': 'narrow-base', 'narrow-based': 'narrow-base', 'narrow-bottom': 'narrow-base', constrictive: 'narrow-base', ageing: 'narrow-base', aging: 'narrow-base',
  inverted: 'narrow-base', 'top-heavy': 'narrow-base', 'stage-5': 'narrow-base', 'stage-five': 'narrow-base', declining: 'narrow-base', shrinking: 'narrow-base', old: 'narrow-base', elderly: 'narrow-base',
  'ageing-population': 'narrow-base', 'aging-population': 'narrow-base',
}

const TASK_WORDS: Record<string, 'match' | 'steady'> = {
  match: 'match', shape: 'match', target: 'match', make: 'match', build: 'match', reach: 'match', fit: 'match', outline: 'match', transition: 'match', 'demographic-transition': 'match',
  'demographic-transition-model': 'match', dtm: 'match', change: 'match', 'change-shape': 'match', predict: 'match', forecast: 'match', 'population-pyramid': 'match', pyramid: 'match', pyramids: 'match',
  'population-structure': 'match', 'age-structure': 'match', transform: 'match', 'reach-the-shape': 'match',
  steady: 'steady', hold: 'steady', 'hold-steady': 'steady', balance: 'steady', 'zero-growth': 'steady', 'no-growth': 'steady', 'stop-growth': 'steady', 'stop-growing': 'steady',
  'same-size': 'steady', 'natural-increase': 'steady', 'population-size': 'steady', 'keep-steady': 'steady', 'stable-population': 'steady', replacement: 'steady',
}

function readShape(raw: unknown): string {
  let key = keyOf(raw).replace(/^(?:a|an|the)-/, '')
  // "wide-base-pyramid" is "wide-base"; a word already known is left alone ("population-pyramid" is never a shape).
  for (let i = 0; i < 2 && !has(SHAPE_WORDS, key); i++) key = key.replace(/-(?:pyramid|shape|population|structure|profile)$/, '')
  return has(SHAPE_WORDS, key) ? SHAPE_WORDS[key] : key
}

const goodPrompt = (config: PyConfig) => (config.task === 'match'
  ? 'Drag the birth rate and death rate sliders until the pyramid, 50 years on, fills the dashed outline. Press Play to watch the people age.'
  : 'Drag the birth rate and death rate sliders so the country has about the same number of people 50 years on as it has now. Press Play to watch the people age.')

export const populationPyramidEngine: SceneEngine<PyConfig, PyState> = {
  id: 'population-pyramid',
  // Few and distinctive. "Population" and "pyramid" are common words (food pyramids, pyramids in maths and history, populations in
  // biology), so everything else is a whole phrase.
  covers: ['demography', 'demographic', 'demographics'],
  phrases: [
    'population pyramid', 'population pyramids', 'age sex pyramid', 'age sex pyramids', 'age structure', 'age structures', 'age sex structure', 'population structure', 'population structures',
    'demographic transition', 'demographic transition model', 'demographic change', 'demographic structure', 'population change', 'population growth', 'population trends', 'population and settlement',
    'population in rwanda', 'population of rwanda', 'population studies', 'population data', 'birth rate', 'birth rates', 'death rate', 'death rates', 'birth and death rates', 'natural increase',
    'natural change', 'ageing population', 'aging population', 'ageing populations', 'youthful population', 'dependency ratio', 'overpopulation', 'population policies', 'population policy',
  ],
  // Near misses: populations of living things, and the other pyramids.
  notFor: [
    'population ecology', 'population genetics', 'population dynamics of', 'bacterial population', 'bacterial populations', 'bacteria population', 'bacterial growth', 'population growth curve', 'population growth curves',
    'yeast population', 'microbial population', 'animal populations', 'animal population', 'plant populations', 'plant population', 'predator prey', 'carrying capacity', 'logistic growth', 'gene pool', 'allele',
    'ecology', 'ecosystem', 'ecosystems', 'food chain', 'food chains', 'food web', 'food webs', 'species',
    'food pyramid', 'food pyramids', 'pyramid of numbers', 'pyramids of numbers', 'pyramid of biomass', 'pyramids of biomass', 'pyramid of energy', 'pyramids of energy', 'energy pyramid', 'energy pyramids', 'ecological pyramid', 'ecological pyramids',
    'egyptian pyramids', 'pyramids of giza', 'great pyramid', 'ancient egypt', 'mayan pyramids', 'pyramid volume', 'volume of a pyramid', 'volume of pyramids', 'surface area of pyramids', 'surface area of a pyramid', 'square based pyramid', 'square based pyramids',
    'triangular pyramid', 'pyramid scheme', 'pyramid schemes', 'pyramid selling', 'pyramid of needs', 'hierarchy of needs', 'maslow', 'pyramid marketing', 'organisational pyramid',
    'sampling population', 'target population', 'population mean', 'population variance', 'population standard deviation', 'population parameter', 'sample and population', 'populations and samples',
  ],
  // The learner sets two rates and reads the consequence in the shape of the people.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawTask = first(o, ['task', 'kind', 'type', 'mode'])
    const rawFrom = first(o, ['from', 'start', 'begin', 'now', 'today', 'shape'])
    const rawTo = first(o, ['to', 'target', 'goal', 'end', 'future', 'outline'])
    if (rawFrom !== undefined && typeof rawFrom !== 'string') return null
    if (rawTo !== undefined && typeof rawTo !== 'string') return null
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) {
      // A shape's name as the task is a match for that shape.
      if (!has(SHAPE_WORDS, word) || rawTo !== undefined) return null
      return { task: 'match', from: rawFrom === undefined ? 'wide-base' : readShape(rawFrom), to: readShape(word) }
    }
    const task = word ? TASK_WORDS[word] : rawTo !== undefined ? 'match' : rawFrom !== undefined ? 'steady' : null
    if (!task) return null
    const from = rawFrom === undefined ? 'wide-base' : readShape(rawFrom)
    if (task === 'steady') return { task, from }
    const to = rawTo === undefined ? (from === 'even' ? 'narrow-base' : 'even') : readShape(rawTo)
    return { task, from, to }
  },

  faults(config) {
    const out: string[] = []
    const shapeList = SHAPES.join(', ')
    if (!isShape(config.from)) out.push(`There is no "${config.from}" pyramid drawn here: the start must be one of ${shapeList}, e.g. from "wide-base".`)
    if (config.task === 'match') {
      if (!isShape(config.to)) out.push(`There is no "${config.to}" outline drawn here: the target must be one of ${shapeList}, e.g. to "even".`)
      else if (config.to === config.from) out.push(`The pyramid already has the shape of the outline, so there is nothing to change: use e.g. from "${config.from}" to "${config.from === 'even' ? 'narrow-base' : 'even'}".`)
    } else if (config.from === 'even') {
      out.push('A pyramid that starts with a base about as wide as the middle already holds the same number of people, so there is nothing to find: use e.g. from "wide-base".')
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const numbers = /\b\d+(?:\.\d+)?\s*(?:per|\/|in every)\s*(?:1[, ]?000|thousand)\b|\b(?:birth|death)\s+rates?\s+(?:of|to|at|=|is|are|should be|must be)\s*\d|\bset\s+(?:the\s+)?(?:birth|death)[^.]*\bto\s+\d/i.test(text)
    const direction = /\b(?:raise|lower|increase|decrease|reduce|boost|higher|lower|more babies|fewer babies|fewer births|more births|fewer deaths|more deaths|falling|rising|keep (?:the )?(?:birth|death)|cut (?:the )?(?:birth|death)|drop (?:the )?(?:birth|death))\b/i.test(text)
    const names = /\bexpansive|\bconstrictive|\bstationary|\bstage ?(?:[1-5]|one|two|three|four|five)\b|\bdemographic transition|\bdtm\b|\bwide[- ]based?\b|\bnarrow[- ]based?\b|\bcolumn|\bstraight[- ]sided|\binverted\b|\btop[- ]heavy|\bageing|\baging|\byoung population/i.test(text)
    const equal = config.task === 'steady' && /\bequal|\bsame as (?:the )?(?:birth|death)|\bbalanc|\bnatural (?:increase|decrease|change)|\bzero growth|\bno growth|\bbirths? (?:=|matches?|minus) deaths?|\bbirth rate (?:=|matches?|minus) (?:the )?death rate/i.test(text)
    if (numbers || direction || names || equal) {
      out.push(`the prompt gives the answer away: it says a rate, which way to move one, or what the shape or the rates are called, which the learner is to find with the sliders -- ask for the outcome only ("${example}")`)
    }
    const years = [...text.matchAll(/\b(\d+)\s*(years?|decades?)\b/gi)].some((m) => (m[2].toLowerCase().startsWith('year') ? Number(m[1]) !== 50 : Number(m[1]) !== 5))
    if (years || /\b(?:migrat|immigra|emigra|life expectancy|fertility|\bTFR\b|dependency|famine|\bwar\b|disease|epidemic|one[- ]child|\bpolicy\b|\bpolicies\b|medicine|healthcare|education of women|contracepti)/i.test(text)
      || /\b(?:drag|move|click|tap|add|remove)\s+(?:the\s+)?(?:bars?|people|ages?|rungs?|cohorts?)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it has two sliders (birth rate and death rate), a fixed 50 years, and a pyramid that fills in by itself -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    const r = RATES[fromOf(config)]
    return { birth: r.birth, death: r.death }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'match') {
      const t = targetRates(fromOf(config), toOf(config))
      return { birth: t.birth, death: t.death }
    }
    const d = RATES[fromOf(config)].death
    return { birth: d, death: d }
  },

  View: PopulationPyramidView,

  prompt: `SCENE "population-pyramid" -- a country's people drawn as a real population pyramid on a quiet light panel: men on the left, women on the right, one rung for every ten years of age (0-9 up to 80+), each side's bars measured as a share of the whole population along a labelled axis. The learner drags two sliders, the birth rate and the death rate (per 1000 people a year), and the pyramid at once shows what fifty years of those rates make of the people. Press Play and the years run decade by decade: every cohort climbs a rung, those alive at the start are drawn pale and those born since are drawn strong, so the babies are seen climbing the pyramid while the old leave the top; a slider scrubs through the years. Readouts under the picture give the year and the number of people in millions.
  For: population pyramids and age structure, birth rate, death rate and natural increase, the demographic transition model, ageing and youthful populations, why a population grows or shrinks. It answers "a wide base means the population is already big", "the pyramid is only about births" and "the shape of a pyramid changes at once when the rates change".
  match: the pyramid starts as one shape and a dashed outline shows another; the learner sets the rates so that fifty years on the pyramid fills the outline (within 8 per cent of the people in a different rung). from and to: wide-base (many children, the youngest countries), even (low births and deaths, a base about as wide as the middle) or narrow-base (few children, the oldest populations); from and to must differ.
  steady: set the rates so that the country has about the same number of people fifty years on as now (within 6 per cent). from: wide-base or narrow-base (not even, which already holds steady).
  Not drawn: migration, life expectancy, fertility rates, real countries' data, causes of change such as war, disease or policy, or a count of the stage. Do not use it for populations of animals, plants or bacteria, food pyramids, or pyramids in maths and history.
  Before marking the card shows the sliders, the pyramid, the outline (match), the years and the number of people. It holds back the stage names, the words expansive, stationary and constrictive, and the rates that the outline was drawn with; marking gives them. The prompt must ask for the outcome only: do NOT give a rate, say which way to move a slider, name a stage or shape, or say that the rates are equal.
  config: { "task":"match", "from":"wide-base", "to":"even" }  -- the prompt says "Drag the birth rate and death rate sliders until the pyramid, 50 years on, fills the dashed outline. Press Play to watch the people age."
       or { "task":"match", "from":"even", "to":"narrow-base" }  -- the same prompt
       or { "task":"steady", "from":"wide-base" }  -- the prompt says "Drag the birth rate and death rate sliders so the country has about the same number of people 50 years on as it has now. Press Play to watch the people age."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the birth rate and death rate sliders until the pyramid, 50 years on, fills the dashed outline. Press Play to watch the people age.",
    "payload": { "engine":"population-pyramid", "config": { "task":"match", "from":"wide-base", "to":"even" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:population-pyramid", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the birth rate and death rate sliders until the pyramid, 50 years on, fills the dashed outline. Press Play to watch the people age.",
    "payload": { "engine":"population-pyramid", "config": { "task":"match", "from":"even", "to":"narrow-base" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:population-pyramid", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the birth rate and death rate sliders so the country has about the same number of people 50 years on as it has now. Press Play to watch the people age.",
    "payload": { "engine":"population-pyramid", "config": { "task":"steady", "from":"wide-base" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:population-pyramid", "why":"..." } }`,
}

registerEngine(populationPyramidEngine as SceneEngine<unknown, unknown>)
