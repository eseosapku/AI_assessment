// lib/studylab/engines/enzyme-rate/config.ts
//
// A rate you draw yourself. The learner changes one condition on a real school practical, the practical answers back, and
// each reading lands as a dot on a graph with no curve printed on it, so the exam graph is made by hand:
//   enzyme   -- a tube of enzyme and its substrate in a water bath, with a lens on four enzyme molecules. Step the temperature or
//               the pH, or the substrate concentration. Heat a tube past its best and cool it again: the rate does not come back,
//               so the graph makes a loop instead of retracing itself. A fresh tube starts a new line.
//   limiting -- pondweed under a lamp, giving off oxygen. Push the lamp closer and the rate climbs, then goes flat however close the
//               lamp gets. Raise the other factor and the line jumps, and the lamp works again.
//
// The rules, all computed here and never read from the drawing:
//   temperature: rate = 96 x 2^((T - 40) / 10), times the fraction of molecules still intact, set by the hottest this tube has been;
//   pH: a rate for each step away from the enzyme's best pH, times the fraction intact, set by the furthest this tube has been;
//   substrate: one reading for each enzyme molecule with a substrate in it, so rate = 20 x min(substrate, molecules);
//   limiting: rate = min(6 x light, 6 + 6 x other), Blackman's law of limiting factors as the sharp corner the syllabuses draw.
// A marked enzyme card must also have a reading past the answer, because a peak or a plateau cannot be known from one side.
//
// Facts:
//   - Reaction rate roughly doubling for each 10 degree rise (Q10 about 2), an optimum near 37 C for human enzymes, the active site changing
//     shape past it, and denaturing at extremes of pH: the usual school account (Seneca's Cambridge IGCSE notes, 5.1.2; HSC Biology Y11 M1 L14,
//     which also uses catalase tubes at 10, 37 and 70 C). The bath steps in tens, so the fastest step here is 40 C, and the card says 37 C is the true figure.
//   - Best pH: pepsin about 2, salivary amylase about 7, trypsin and pancreatic lipase about 8, liver catalase about 7. These are
//     the rounded textbook figures, from general knowledge of the syllabuses, not measured data.
//   - How much of a tube survives a given heat or pH is a teaching model, chosen to give the textbook curve shape. Real
//     denaturing also depends on time. Close to the best pH the fall is reversible and only far from it is the damage kept.
//   - The sharp corner on the limiting graph is an idealisation. Real curves bend more gradually, a criticism made of Blackman's own
//     curves (TutorChase, CIE A level 13.2.2, states the law). Temperature stops at 30 C on this card, below where the plant's enzymes denature.
//
// Ideas taken, never code or art:
//   - a live graph joined to the molecular reason for it: dmccreary's Enzyme Activity Explorer. Its curve is printed and the learner only
//     moves a cursor along it, which is reading; here nothing is printed until the learner has made the dots;
//   - catalase tubes at different temperatures: the HSC lesson above, which collects the gas; foam height as the measure is the familiar
//     school version, from general knowledge, and it shows one tap's change better than a volume on a scale;
//   - "enzymes are killed" and "denaturing is peptide bonds breaking" as the misconceptions to answer: the AP Biology chief reader's 2005
//     report and Castelino's "How I teach enzymes" (STEM Learning), both read only as search excerpts because the files would not open;
//     "light keeps raising the rate" and having students mark where their own line flattens: flipeducation.ai's lesson pages, also excerpts.
// Refused:
//   - a slider along a printed curve (the Explorer's form): it shows the answer first;
//   - inhibitors, Vmax and Km, enzyme concentration as its own axis, and respiration: each would need a picture of its own;
//   - a barrel with staves for limiting factors: a neat analogy, but it would show which factor is lowest, which is the thing to find;
//   - the third factor on one card: one lamp and one other factor keeps the graph readable, and two cards compare them.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { EnzymeRateView } from './View'

export const ENZYMES = ['catalase', 'amylase', 'pepsin', 'trypsin', 'lipase'] as const
export type EnzymeName = (typeof ENZYMES)[number]
export const FACTORS = ['temperature', 'ph', 'substrate'] as const
export type FactorName = (typeof FACTORS)[number]
export const SECONDS = ['co2', 'temperature'] as const
export type SecondName = (typeof SECONDS)[number]

export const SITES_MIN = 2
export const SITES_MAX = 5
export const DEFAULT_SITES = 4
export const TARGET_MIN = 13
export const TARGET_MAX = 30
export const DEFAULT_TARGET = 24

export type EnzymeRateConfig =
  /** factor: what the learner changes. A word outside the lists still parses, and faults says what would work. */
  | { task: 'enzyme'; factor: string; enzyme: string; sites?: number }
  /** second: what changes beside the lamp. target: the bubbles a minute to reach. */
  | { task: 'limiting'; second: string; target: number }

/** Enzyme cards keep the levels each tube has been at, in order. Limiting cards keep the two settings and the readings taken. */
export type EnzymeRateState = { tubes?: number[][]; light?: number; second?: number; seen?: number[][] }

export type Shows = 'foam' | 'iodine' | 'cubes' | 'fat'
export type EnzymeFacts = {
  name: EnzymeName
  substrate: string
  shows: Shows
  bestPh: number
  /** Two steps from its best, where nothing is harmed yet, and not always on the same side. */
  startPh: number
  where: string
  /** What the rate is read as, on the graph and under it. */
  title: string
  unit: string
  caption: string
}

export const FACTS: Record<EnzymeName, EnzymeFacts> = {
  catalase: { name: 'catalase', substrate: 'hydrogen peroxide', shows: 'foam', bestPh: 7, startPh: 5, where: 'in the cells of the liver', title: 'Foam in a minute, mm', unit: ' mm', caption: 'Catalase splits hydrogen peroxide. The oxygen makes foam.' },
  amylase: { name: 'amylase', substrate: 'starch', shows: 'iodine', bestPh: 7, startPh: 9, where: 'in the mouth', title: 'Starch gone in a minute, %', unit: '%', caption: 'Amylase breaks down starch. Iodine stays dark while starch is left.' },
  pepsin: { name: 'pepsin', substrate: 'protein', shows: 'cubes', bestPh: 2, startPh: 4, where: 'in the acid of the stomach', title: 'Egg white gone in a minute, %', unit: '%', caption: 'Pepsin digests the protein in egg white, and the cubes shrink.' },
  trypsin: { name: 'trypsin', substrate: 'protein', shows: 'cubes', bestPh: 8, startPh: 10, where: 'in the small intestine', title: 'Egg white gone in a minute, %', unit: '%', caption: 'Trypsin digests the protein in egg white, and the cubes shrink.' },
  lipase: { name: 'lipase', substrate: 'fat', shows: 'fat', bestPh: 8, startPh: 6, where: 'in the small intestine', title: 'Fat gone in a minute, %', unit: '%', caption: 'Lipase digests fat. The yellow layer thins as it works.' },
}

export const TEMPS = [0, 10, 20, 30, 40, 50, 60, 70]
export const BEST_TEMP = 40
export const START_TEMP = 20
export const PHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
export const SUBSTRATES = [1, 2, 3, 4, 5, 6]
export const LIGHTS = [1, 2, 3, 4, 5]
export const OTHERS = [1, 2, 3, 4, 5]
/** The same five steps of the other factor, read as a water temperature. */
export const OTHER_TEMPS = [10, 15, 20, 25, 30]
/** The top of the rate axis: 100 on an enzyme card, 36 bubbles a minute on a limiting card. */
export const RATE_TOP = 100
export const BUBBLE_TOP = 36

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const isEnzyme = (name: string): name is EnzymeName => (ENZYMES as readonly string[]).includes(name)
const isFactor = (name: string): name is FactorName => (FACTORS as readonly string[]).includes(name)
const isSecond = (name: string): name is SecondName => (SECONDS as readonly string[]).includes(name)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type EnzymeCard = Extract<EnzymeRateConfig, { task: 'enzyme' }>
type LimitCard = Extract<EnzymeRateConfig, { task: 'limiting' }>

/** The enzyme a config draws. A config faults refuses still draws something, so nothing can crash on it. */
export const factsOf = (c: EnzymeCard): EnzymeFacts => (isEnzyme(c.enzyme) ? FACTS[c.enzyme] : FACTS.catalase)
export const factorOf = (c: EnzymeCard): FactorName => (isFactor(c.factor) ? c.factor : 'temperature')
export const secondOfCard = (c: LimitCard): SecondName => (isSecond(c.second) ? c.second : 'co2')
export const sitesOf = (c: EnzymeCard): number => (Number.isInteger(c.sites) ? clamp(c.sites as number, SITES_MIN, SITES_MAX) : DEFAULT_SITES)

export function levelsOf(c: EnzymeCard): number[] {
  const f = factorOf(c)
  return f === 'temperature' ? TEMPS : f === 'ph' ? PHS : SUBSTRATES
}

export function startOf(c: EnzymeCard): number {
  const f = factorOf(c)
  return f === 'temperature' ? START_TEMP : f === 'ph' ? factsOf(c).startPh : SUBSTRATES[0]
}

export function bestOf(c: EnzymeCard): number {
  const f = factorOf(c)
  return f === 'temperature' ? BEST_TEMP : f === 'ph' ? factsOf(c).bestPh : sitesOf(c)
}

// ---------------------------------------------------------------------------
// The state, read safely.

export function tubesOf(c: EnzymeCard, s: EnzymeRateState): number[][] {
  const grid = levelsOf(c)
  const raw = s?.tubes
  const tubes = Array.isArray(raw) ? raw.filter(Array.isArray).map((t) => t.filter((v) => grid.includes(v))).filter((t) => t.length > 0) : []
  return tubes.length ? tubes : [[startOf(c)]]
}
export const tubeOf = (c: EnzymeCard, s: EnzymeRateState): number[] => { const all = tubesOf(c, s); return all[all.length - 1] }
export const atOf = (c: EnzymeCard, s: EnzymeRateState): number => { const t = tubeOf(c, s); return t[t.length - 1] }

const fromGrid = (v: unknown, grid: number[]) => (typeof v === 'number' && grid.includes(v) ? v : grid[0])
export const lightOf = (s: EnzymeRateState): number => fromGrid(s?.light, LIGHTS)
export const otherOf = (s: EnzymeRateState): number => fromGrid(s?.second, OTHERS)

/** Every reading taken on a limiting card, the present one included, each once. */
export function seenOf(s: EnzymeRateState): [number, number][] {
  const raw = Array.isArray(s?.seen) ? s.seen : []
  const out: [number, number][] = []
  const add = (l: number, o: number) => { if (!out.some((p) => p[0] === l && p[1] === o)) out.push([l, o]) }
  for (const p of raw) if (Array.isArray(p) && LIGHTS.includes(p[0]) && OTHERS.includes(p[1])) add(p[0], p[1])
  add(lightOf(s), otherOf(s))
  return out
}

// ---------------------------------------------------------------------------
// The moves. The view calls these and nothing else changes the state.

/** One step of the enzyme card's condition: the tube has now been there too. */
export function stepped(c: EnzymeCard, s: EnzymeRateState, by: 1 | -1): EnzymeRateState {
  const grid = levelsOf(c)
  const tubes = tubesOf(c, s)
  const at = atOf(c, s)
  const next = grid[grid.indexOf(at) + by]
  if (next === undefined) return { tubes }
  return { tubes: [...tubes.slice(0, -1), [...tubes[tubes.length - 1], next]] }
}

/** A new tube, straight into the bath as it stands: if the bath is too hot for it, it suffers at once. */
export function freshTube(c: EnzymeCard, s: EnzymeRateState): EnzymeRateState {
  return { tubes: [...tubesOf(c, s), [atOf(c, s)]] }
}

export function limitStepped(s: EnzymeRateState, which: 'light' | 'second', by: 1 | -1): EnzymeRateState {
  const light = which === 'light' ? clamp(lightOf(s) + by, LIGHTS[0], LIGHTS[LIGHTS.length - 1]) : lightOf(s)
  const second = which === 'second' ? clamp(otherOf(s) + by, OTHERS[0], OTHERS[OTHERS.length - 1]) : otherOf(s)
  return { light, second, seen: seenOf({ light, second, seen: seenOf(s) }) }
}

// ---------------------------------------------------------------------------
// The biology.

const PH_RATES = [96, 60, 24, 8, 2]

/** The rate at this level if every molecule in the tube were still intact. */
export function rawRate(c: EnzymeCard, level: number): number {
  const f = factorOf(c)
  if (f === 'temperature') return 96 * 2 ** ((level - BEST_TEMP) / 10)
  if (f === 'ph') return PH_RATES[Math.min(Math.abs(level - factsOf(c).bestPh), PH_RATES.length - 1)]
  return 20 * Math.min(level, sitesOf(c))
}

/** The fraction of the tube's molecules that keep their shape, after everything this tube has been through. */
export function intactOf(c: EnzymeCard, tube: number[]): number {
  const f = factorOf(c)
  if (f === 'temperature') {
    const hottest = Math.max(...tube)
    return hottest <= BEST_TEMP ? 1 : hottest <= BEST_TEMP + 10 ? 1 / 4 : 0
  }
  if (f === 'ph') {
    const far = Math.max(...tube.map((v) => Math.abs(v - factsOf(c).bestPh)))
    return far <= 2 ? 1 : far === 3 ? 1 / 2 : 0
  }
  return 1
}

/** The rate a tube gives now: the level it is at, and what it has been through. */
export const tubeRate = (c: EnzymeCard, tube: number[]): number => rawRate(c, tube[tube.length - 1]) * intactOf(c, tube)
export const rateOf = (c: EnzymeCard, s: EnzymeRateState): number => tubeRate(c, tubeOf(c, s))

/** A reading on the far side of the answer, from any tube: nothing else shows a peak or a plateau has been passed. */
export function bracketed(c: EnzymeCard, s: EnzymeRateState): boolean {
  const best = bestOf(c)
  const side = Math.sign(startOf(c) - best)
  return tubesOf(c, s).flat().some((v) => v !== best && Math.sign(v - best) !== side)
}

export const lightCap = (l: number) => 6 * l
export const otherCap = (o: number) => 6 + 6 * o
export const limitRate = (l: number, o: number) => Math.min(lightCap(l), otherCap(o))
/** The fewest steps of each that reach the target: each factor on its own, because the rate is the smaller of the two. */
export function neededFor(target: number): { light: number; second: number } {
  // Kept on the scales, so a target faults refuses still has settings to name and solve still ends.
  return { light: clamp(Math.ceil(target / 6), LIGHTS[0], LIGHTS[LIGHTS.length - 1]), second: clamp(Math.ceil((target - 6) / 6), OTHERS[0], OTHERS[OTHERS.length - 1]) }
}
export type Limit = 'light' | 'other' | 'both'
export const limitAt = (l: number, o: number): Limit => (lightCap(l) < otherCap(o) ? 'light' : lightCap(l) > otherCap(o) ? 'other' : 'both')

export const otherName = (second: SecondName) => (second === 'co2' ? 'carbon dioxide' : 'temperature')
export const otherValue = (second: SecondName, o: number) => (second === 'co2' ? String(o) : `${OTHER_TEMPS[o - 1]} °C`)

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function done(c: EnzymeRateConfig, s: EnzymeRateState): boolean {
  if (c.task === 'limiting') {
    const need = neededFor(c.target)
    return lightOf(s) === need.light && otherOf(s) === need.second
  }
  return atOf(c, s) === bestOf(c) && intactOf(c, tubeOf(c, s)) === 1 && bracketed(c, s)
}

// ---------------------------------------------------------------------------
// What the picture is told. The view draws these and works nothing out.

export type Point = { x: number; y: number }
export type Trace = { now: boolean; key: string; points: Point[] }

/** The dots on the graph: one line for each tube, or for each setting of the other factor. */
export function tracesOf(c: EnzymeRateConfig, s: EnzymeRateState): Trace[] {
  if (c.task === 'limiting') {
    const now = otherOf(s)
    const seen = seenOf(s)
    return OTHERS.filter((o) => seen.some((p) => p[1] === o)).map((o) => ({
      now: o === now,
      key: `o${o}`,
      points: seen.filter((p) => p[1] === o).map((p) => p[0]).sort((a, b) => a - b).map((l) => ({ x: l, y: limitRate(l, o) })),
    }))
  }
  // The last three tubes are enough to compare: older ones would only clutter the graph.
  return tubesOf(c, s).slice(-3).map((tube, i, all) => ({
    now: i === all.length - 1,
    key: `t${i}`,
    points: tube.map((v, k) => ({ x: v, y: tubeRate(c, tube.slice(0, k + 1)) })),
  }))
}

/** The curve as it really is, drawn only once the card is marked. */
export function idealOf(c: EnzymeRateConfig, s: EnzymeRateState): Point[] {
  if (c.task === 'limiting') return LIGHTS.map((l) => ({ x: l, y: limitRate(l, otherOf(s)) }))
  return levelsOf(c).map((v) => ({ x: v, y: rawRate(c, v) * intactOf(c, [v]) }))
}

export type Molecule = { intact: boolean; busy: boolean }
export type LensView = { molecules: Molecule[]; free: number; pace: number }

/** How much of the substrate is in a site at any moment, at each temperature below the best. */
const busyAtTemp = (t: number) => (t >= BEST_TEMP ? 4 : t >= 30 ? 2 : 1)
const busyAtPh = [4, 3, 1, 1, 0]

/** The molecules in the lens: how many keep their shape, how many hold a substrate, and how fast the rest drift. */
export function lensOf(c: EnzymeCard, s: EnzymeRateState): LensView {
  const f = factorOf(c)
  const at = atOf(c, s)
  if (f === 'substrate') {
    const n = sitesOf(c)
    const busy = Math.min(at, n)
    return { molecules: Array.from({ length: n }, (_, i) => ({ intact: true, busy: i >= n - busy })), free: Math.max(0, at - n), pace: 5 }
  }
  const tube = tubeOf(c, s)
  const intact = Math.round(4 * intactOf(c, tube))
  const wanted = f === 'temperature' ? busyAtTemp(at) : busyAtPh[Math.min(Math.abs(at - factsOf(c).bestPh), busyAtPh.length - 1)]
  const busy = Math.min(intact, tubeRate(c, tube) > 0 ? Math.max(1, wanted) : 0)
  return {
    // The last intact one fills first, so an empty active site stays near the row of names.
    molecules: Array.from({ length: 4 }, (_, i) => ({ intact: i < intact, busy: i < intact && i >= intact - busy })),
    free: 3,
    pace: f === 'temperature' ? 8 - at / 14 : 5,
  }
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds back the answer and every word for it.

const num = (v: number) => String(Math.round(v))

/** A level in the words the card uses for it. */
export function levelText(c: EnzymeCard, v: number): string {
  const f = factorOf(c)
  return f === 'temperature' ? `${v} °C` : f === 'ph' ? `pH ${v}` : `${v}%`
}

/** What the tube has been through, read off the tube: the highest temperature, or the pH range. */
export function beenText(c: EnzymeCard, s: EnzymeRateState): string {
  const tube = tubeOf(c, s)
  if (factorOf(c) === 'temperature') return `${Math.max(...tube)} °C`
  const lo = Math.min(...tube)
  const hi = Math.max(...tube)
  return lo === hi ? `pH ${lo}` : `pH ${lo} to ${hi}`
}

export function working(c: EnzymeRateConfig, s: EnzymeRateState): string {
  if (c.task === 'limiting') {
    return `Yes. ${limitRate(lightOf(s), otherOf(s))} bubbles a minute, with nothing wasted. The factor in shortest supply set the rate: the limiting factor. Raising anything else changed nothing, so the line went flat.`
  }
  const f = factorOf(c)
  const facts = factsOf(c)
  const best = bestOf(c)
  if (f === 'temperature') {
    return `Yes. ${best} °C is the fastest step here, and human enzymes peak near 37 °C. Colder, molecules collide less often, and warming brings the rate back. Hotter, the active site changes shape: the enzyme is denatured, not killed, and cooling cannot mend it.`
  }
  if (f === 'ph') {
    return `Yes. pH ${best} is where ${facts.name} works fastest, ${facts.where}. Each enzyme has its own best pH. A little away, the substrate fits less well and the rate can recover. Far away, the active site changes shape for good: denatured.`
  }
  return `Yes. ${best}% is the least that gives the top rate. Below it, the substrate limits the rate. Above it every active site is busy and the rest must wait, so the line goes flat. Only more enzyme would lift it.`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(c: EnzymeRateConfig, s: EnzymeRateState): string {
  if (c.task === 'limiting') {
    const l = lightOf(s)
    const o = otherOf(s)
    const r = limitRate(l, o)
    if (r < c.target) return `You stopped at ${r} bubbles a minute, and the aim is ${c.target}.`
    return `You reached ${r} bubbles a minute, but with more than you needed: something could come down a step and still reach ${c.target}.`
  }
  const f = factorOf(c)
  const facts = factsOf(c)
  const tube = tubeOf(c, s)
  const at = atOf(c, s)
  const best = bestOf(c)
  const unit = facts.unit
  const rate = `${num(tubeRate(c, tube))}${unit} a minute`
  if (f === 'substrate') {
    if (at < best) return `At ${at}% the rate is ${rate}, and it can go faster.`
    if (at > best) return `At ${at}% the rate is ${rate}, and less ${facts.substrate} gives that rate too.`
    return `At ${at}% the rate is ${rate}, but you have not tried any more than this, so you cannot tell yet whether more would help.`
  }
  const whereNow = levelText(c, at)
  if (intactOf(c, tube) < 1) {
    // Still at its worst it has had no chance to recover, so say only what it is doing.
    const worst = f === 'temperature' ? Math.max(...tube) === at : Math.max(...tube.map((v) => Math.abs(v - best))) === Math.abs(at - best)
    if (worst) return `At ${whereNow} the rate is ${rate}, and a tube can go faster than that.`
    return `This tube has been ${f === 'temperature' ? 'as hot as' : 'through'} ${beenText(c, s)}, and now at ${whereNow} its rate is ${rate}. It has not recovered, so that tube cannot show the fastest rate.`
  }
  if (at !== best) return `You left it at ${whereNow}, at ${rate}, and it can go faster.`
  return `${rate.charAt(0).toUpperCase()}${rate.slice(1)} at ${whereNow}, but you have tested only one side of it, so you cannot tell yet that this is the fastest.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/\bpH\b/g, 'ph').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

type TaskWord = { task: 'enzyme'; factor?: string } | { task: 'limiting' }
const ENZYME_TASK: TaskWord = { task: 'enzyme' }
const LIMITING_TASK: TaskWord = { task: 'limiting' }
const AT = (factor: string): TaskWord => ({ task: 'enzyme', factor })

const TASK_WORDS: Record<string, TaskWord> = {
  enzyme: ENZYME_TASK, enzymes: ENZYME_TASK, 'enzyme-rate': ENZYME_TASK, 'enzyme-action': ENZYME_TASK, 'enzyme-activity': ENZYME_TASK, optimum: ENZYME_TASK, 'find-the-optimum': ENZYME_TASK, 'find-optimum': ENZYME_TASK,
  denature: ENZYME_TASK, denatures: ENZYME_TASK, denaturing: ENZYME_TASK, denaturation: ENZYME_TASK, denatured: ENZYME_TASK, 'lock-and-key': ENZYME_TASK, 'active-site': ENZYME_TASK, 'rate-curve': ENZYME_TASK, fastest: ENZYME_TASK,
  temperature: AT('temperature'), temp: AT('temperature'), heat: AT('temperature'), heating: AT('temperature'), warm: AT('temperature'), warming: AT('temperature'), 'water-bath': AT('temperature'), 'effect-of-temperature': AT('temperature'), 'optimum-temperature': AT('temperature'),
  ph: AT('ph'), acidity: AT('ph'), 'effect-of-ph': AT('ph'), 'optimum-ph': AT('ph'), 'ph-curve': AT('ph'), buffer: AT('ph'),
  substrate: AT('substrate'), 'substrate-concentration': AT('substrate'), concentration: AT('substrate'), saturate: AT('substrate'), saturation: AT('substrate'), plateau: AT('substrate'), 'effect-of-substrate': AT('substrate'), 'effect-of-substrate-concentration': AT('substrate'),
  // Not drawn, so faults can say what would work, in place of a config that "could not be read".
  'enzyme-concentration': AT('enzyme-concentration'), 'enzyme-amount': AT('enzyme-amount'), inhibitor: AT('inhibitor'), inhibitors: AT('inhibitor'), inhibition: AT('inhibitor'),
  limiting: LIMITING_TASK, 'limiting-factor': LIMITING_TASK, 'limiting-factors': LIMITING_TASK, photosynthesis: LIMITING_TASK, 'rate-of-photosynthesis': LIMITING_TASK, 'photosynthesis-rate': LIMITING_TASK, pondweed: LIMITING_TASK, lamp: LIMITING_TASK,
  light: LIMITING_TASK, 'light-intensity': LIMITING_TASK, 'plant-nutrition': LIMITING_TASK, greenhouse: LIMITING_TASK, bubbles: LIMITING_TASK, 'bubble-counter': LIMITING_TASK,
}

const FACTOR_WORDS: Record<string, FactorName> = {
  temperature: 'temperature', temp: 'temperature', heat: 'temperature', warmth: 'temperature', 'water-bath': 'temperature',
  ph: 'ph', acidity: 'ph', 'ph-level': 'ph', buffer: 'ph',
  substrate: 'substrate', 'substrate-concentration': 'substrate', concentration: 'substrate', 'amount-of-substrate': 'substrate', 'hydrogen-peroxide': 'substrate', starch: 'substrate',
}

const SECOND_WORDS: Record<string, SecondName> = {
  co2: 'co2', co: 'co2', 'co-2': 'co2', carbon: 'co2', 'carbon-dioxide': 'co2', 'carbon-dioxide-concentration': 'co2', 'co2-concentration': 'co2', 'sodium-hydrogencarbonate': 'co2',
  temperature: 'temperature', temp: 'temperature', heat: 'temperature', warmth: 'temperature', 'water-temperature': 'temperature',
}

const ENZYME_WORDS: Record<string, EnzymeName> = {
  catalase: 'catalase', 'liver-catalase': 'catalase', liver: 'catalase',
  amylase: 'amylase', 'salivary-amylase': 'amylase', 'pancreatic-amylase': 'amylase', carbohydrase: 'amylase', ptyalin: 'amylase',
  pepsin: 'pepsin', 'stomach-protease': 'pepsin', 'gastric-protease': 'pepsin',
  trypsin: 'trypsin', protease: 'trypsin', 'pancreatic-protease': 'trypsin',
  lipase: 'lipase', 'pancreatic-lipase': 'lipase',
}

/** A number, or one written with its noun; null when it cannot be read at all. */
function readCount(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*[a-z% ]*$/i)
    return m ? Number(m[1]) + 0 : null
  }
  return typeof raw === 'number' && Number.isFinite(raw) ? raw + 0 : null
}

/** What a prompt can safely say: the gesture and the aim. Every config has one, and it passes promptFaults. */
export function goodPrompt(c: EnzymeRateConfig): string {
  if (c.task === 'limiting') {
    const other = otherName(secondOfCard(c))
    return `Tap the buttons to move the lamp and change the ${other}. Reach ${c.target} bubbles a minute without using any more light or ${other} than you need.`
  }
  const f = factorOf(c)
  const facts = factsOf(c)
  if (f === 'substrate') return `Tap the buttons to change the ${facts.substrate}. Get the top rate from ${facts.name}, without using any more ${facts.substrate} than you need.`
  const what = f === 'temperature' ? 'water bath' : 'pH'
  const sides = f === 'temperature' ? 'hotter and colder' : 'higher and lower'
  return `Tap the buttons to change the ${what}, and take a fresh tube whenever you want one. Test ${sides} to find the fastest ${facts.name} can go, then leave a tube running at that rate.`
}

const NOT_SHOWN = /\bdrag\b|\bslide\b|\bslider\b|\binhibit|\bV\s?max\b|\bKm\b|\bMichaelis|\brespir|\byeast\b|\bfood tests?\b|\bbenedict|\bbiuret|\bchromatograph|\bstomata\b/i
/** Words for what happens past the best: the thing to find out. */
const HARM = /\bdenatur|\bkill|\bcook|\bruin|\bdestroy|\bdamag|\bdie[sd]?\b|\bdead\b|\birreversib|\bpermanent|\bfor good\b|\b(?:not|never|won['’]t|can['’]t|cannot|n['’]t)\s+(?:\w+\s+)?(?:come back|comes back|recover|recovers|return|returns|mend)\b|\bshape\b|\bunfold|\bwarp/i

export const enzymeRateEngine: SceneEngine<EnzymeRateConfig, EnzymeRateState> = {
  id: 'enzyme-rate',
  // Few and distinctive: `scenesFor` matches a covers word by its first five letters, so "catalase" here would catch "catalyst",
  // "substrate" would catch "substitution", and "photosynthesis" would catch "photons". Everything else is a whole phrase.
  covers: ['enzymes', 'denaturation', 'denaturing', 'denatured', 'amylase', 'pepsin', 'trypsin', 'lipase'],
  phrases: [
    'photosynthesis', 'limiting factor', 'limiting factors', 'plant nutrition', 'autotrophic nutrition',
    'substrate concentration', 'active site', 'active sites', 'lock and key', 'lock-and-key', 'induced fit', 'catalase', 'biological catalyst', 'biological catalysts',
  ],
  // Near misses: the same words about something else, and enzyme or photosynthesis topics this card cannot draw.
  notFor: [
    // "limiting" in chemistry, calculus and accounts, and limits on populations.
    'limiting reagent', 'limiting reagents', 'limiting reactant', 'limiting reactants', 'rate limiting step', 'rate determining step', 'limits of functions', 'limit of a function',
    'budget', 'budgets', 'budgeting', 'budgetary', 'contribution per', 'key factor', 'labour hours', 'machine hours', 'production planning', 'linear programming',
    'population growth', 'population size', 'limiting factors population', 'population limiting factors', 'carrying capacity', 'density dependent', 'density independent', 'limiting factors ecosystem', 'limiting factors ecosystems', 'limiting factors habitat',
    // Enzymes this card does not show at work.
    'restriction enzyme', 'restriction enzymes', 'ligase enzyme', 'dna ligase', 'dna polymerase', 'immobilised enzymes', 'immobilising enzymes', 'immobilized enzymes', 'immobilizing enzymes', 'immobilised enzyme',
    'enzyme inhibitor', 'enzyme inhibitors', 'enzyme inhibition', 'competitive inhibition', 'competitive inhibitors', 'non competitive inhibition', 'affinity of different enzymes', 'enzyme technology', 'enzymes technology', 'industrial enzymes', 'enzymes in industry', 'enzymes industry', 'washing powder', 'washing powders', 'biological washing',
    'naming enzymes', 'criteria for naming enzymes', 'types of enzymes', 'importance of enzymes',
    // Denatured something else.
    'denatured alcohol', 'denatured ethanol', 'methylated spirits', 'dna denaturation', 'denaturation of dna', 'denaturing dna',
    // Photosynthesis this card does not show.
    'light dependent', 'light independent', 'dark reaction', 'dark reactions', 'calvin cycle', 'photolysis', 'photophosphorylation', 'carbon assimilation', 'chloroplast', 'chloroplasts', 'photosynthetic pigments', 'chromatography', 'structure of the leaf', 'leaf structure', 'adaptations to photosynthesis', 'adaptation of plants for photosynthesis', 'adaptations for photosynthesis',
    'equation for photosynthesis', 'word equation', 'importance of photosynthesis', 'necessity of chlorophyll', 'testing a leaf', 'test for starch', 'tests for starch', 'carbon cycle', 'artificial photosynthesis', 'compensation point', 'bacterial photosynthesis',
    // Plant nutrition as a soil and fertiliser topic.
    'soil fertility', 'soil nutrients', 'plant nutrients', 'essential nutrients', 'essential elements', 'mineral nutrition', 'mineral nutrients', 'mineral deficiency', 'nutrient deficiency', 'deficiency symptoms', 'fertiliser', 'fertilisers', 'fertilizer', 'fertilizers', 'manure', 'manures',
    // A lock and key that is not a molecule.
    'enzyme free', 'encryption', 'cryptography', 'cipher', 'ciphers', 'public key', 'private key', 'padlock', 'locksmith', 'door lock',
  ],
  // The learner changes how much of one thing there is, step by step: the amount is the whole experiment.
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
    const rawEnzyme = first(src, ['enzyme', 'catalyst'])
    const rawFactor = first(src, ['factor', 'vary', 'variable', 'change', 'condition'])
    const rawSecond = first(src, ['second', 'with', 'other', 'against', 'vary', 'factor'])
    const rawTarget = first(src, ['target', 'aim', 'goal', 'bubbles'])
    const rawSites = first(src, ['sites', 'molecules', 'enzymeMolecules', 'amount'])
    const factorWord = keyOf(rawFactor)
    const plantFactor = factorWord === 'light' || factorWord === 'light-intensity' || (has(SECOND_WORDS, factorWord) && SECOND_WORDS[factorWord] === 'co2')
    const kind: TaskWord | null = word ? TASK_WORDS[word]
      : rawTarget !== undefined || first(src, ['second', 'with', 'other', 'against']) !== undefined || plantFactor ? LIMITING_TASK
        : rawEnzyme !== undefined || rawFactor !== undefined ? ENZYME_TASK : null
    if (!kind) return null

    if (kind.task === 'limiting') {
      if (rawSecond !== undefined && typeof rawSecond !== 'string') return null
      const key = keyOf(rawSecond)
      // Light is on every limiting card already, so naming it asks for nothing else.
      const second = !key || key === 'light' || key === 'light-intensity' ? 'co2' : has(SECOND_WORDS, key) ? SECOND_WORDS[key] : key
      const target = rawTarget === undefined ? DEFAULT_TARGET : readCount(rawTarget)
      return target === null ? null : { task: 'limiting', second, target }
    }

    if (rawEnzyme !== undefined && typeof rawEnzyme !== 'string') return null
    if (rawFactor !== undefined && typeof rawFactor !== 'string') return null
    const enzymeKey = keyOf(rawEnzyme)
    const enzyme = !enzymeKey ? 'catalase' : has(ENZYME_WORDS, enzymeKey) ? ENZYME_WORDS[enzymeKey] : enzymeKey
    const factorKey = keyOf(rawFactor)
    const factor = kind.factor ?? (!factorKey ? 'temperature' : has(FACTOR_WORDS, factorKey) ? FACTOR_WORDS[factorKey] : factorKey)
    if (factor !== 'substrate') return { task: 'enzyme', factor, enzyme }
    const sites = rawSites === undefined ? DEFAULT_SITES : readCount(rawSites)
    return sites === null ? null : { task: 'enzyme', factor, enzyme, sites }
  },

  faults(c) {
    const out: string[] = []
    if (c.task === 'limiting') {
      if (!isSecond(c.second)) out.push(`There is no "${c.second}" to change on this card: it draws a lamp, and either carbon dioxide or temperature beside it, e.g. second "co2".`)
      if (!Number.isInteger(c.target)) out.push(`A target of ${c.target} bubbles a minute cannot be counted: use a whole number, e.g. target ${DEFAULT_TARGET}.`)
      else if (c.target > TARGET_MAX) out.push(`A target of ${c.target} bubbles a minute is more than the nearest lamp can drive (${TARGET_MAX}): use e.g. target ${DEFAULT_TARGET}.`)
      else if (c.target < TARGET_MIN) out.push(`A target of ${c.target} bubbles a minute takes the lamp alone, so nothing would ever go flat (${TARGET_MIN} or more): use e.g. target ${DEFAULT_TARGET}.`)
      return out
    }
    if (!isFactor(c.factor)) out.push(`There is no "${c.factor}" experiment on this card: use factor temperature, ph or substrate, e.g. factor "temperature".`)
    if (!isEnzyme(c.enzyme)) out.push(`There is no "${c.enzyme}" drawn here: use one of ${ENZYMES.join(', ')}, e.g. enzyme "catalase".`)
    if (c.factor === 'substrate' && (!Number.isInteger(c.sites) || (c.sites as number) < SITES_MIN || (c.sites as number) > SITES_MAX)) {
      out.push(`${c.sites} enzyme molecules will not fit the lens: sites must be ${SITES_MIN} to ${SITES_MAX}, e.g. sites ${DEFAULT_SITES}.`)
    }
    return out
  },

  promptFaults(c, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(c)
    const out: string[] = []
    let gives = false
    let absent = NOT_SHOWN.test(text)
    if (c.task === 'limiting') {
      const second = secondOfCard(c)
      gives = /\bplateau|\blevels? off|\bflat\b|\bflatten|\bstops? (?:rising|increasing|helping|working)|\b(?:does|changes|do|change) nothing\b|\bno (?:effect|difference)\b|\bsaturat|\bshortest supply\b|\b(?:light|lamp|carbon dioxide|co2|co₂|temperature|warmth)\s+(?:is|becomes|will become|was)\s+(?:the\s+)?limit|\blimited by\b|\bholding it back is\b|\b(?:lamp|light|level|step)\s+(?:at\s+|to\s+)?[1-5]\b|\b(?:one|two|three|four|five|\d)\s+(?:more\s+)?(?:steps?|taps?|moves?)\b|\btake turns\b|\balternat/i.test(text)
      absent = absent || /\bfresh tube\b|\bliver\b|\bcatalase\b|\bactive sites?\b|\bwater bath\b/i.test(text)
        || (second === 'co2' ? /\btemperature\b|\bwarm|\bheat|\bthermometer\b/i : /\bcarbon dioxide\b|\bco2\b|\bco₂\b|\bgas bottle\b/i).test(text)
    } else {
      const f = factorOf(c)
      absent = absent || /\blamp\b|\bpondweed\b|\bphotosynth/i.test(text) || (f === 'substrate' && /\bfresh tube\b/i.test(text))
      if (f === 'temperature') {
        gives = HARM.test(text) || /\b(?:3[5-9]|4[0-5])\s*(?:°|degrees?\b|deg\b|c\b)|\b(?:thirty[- ]seven|forty)\b|\bbody temperature\b|\bbody heat\b|\bblood heat\b|\bpeak\b|\bbell\b|\boptimum\s+(?:is|of|at)\b|\bcollisions?\b|\bcollide|\bkinetic\b/i.test(text)
      } else if (f === 'ph') {
        gives = HARM.test(text) || /\bpH\s*(?:of\s*|=\s*)?\d|\bacid|\balkal|\bneutral\b|\bbasic\b|\bstomach\b|\bduoden|\bsmall intestine\b|\bmouth\b|\bsaliva|\bpeak\b|\bbell\b/i.test(text)
      } else {
        gives = /\bplateau|\blevels? off|\bflat\b|\bflatten|\bsaturat|\bevery (?:active )?site|\ball (?:of )?(?:the )?(?:active )?sites\b|\bsites? (?:are |is )?(?:full|busy)\b|\bstops? (?:rising|increasing|helping|speeding)|\bwaiting\b|\bqueue\b|\b\d+\s*(?:%|per ?cent\b)|\benzyme (?:is|becomes) limit|\blimited by\b|\bmore enzyme\b/i.test(text)
      }
    }
    if (gives) out.push(`the prompt gives the answer away: it says where the best is or what will happen, which the learner is to find with the buttons -- ask for the outcome only ("${example}")`)
    if (absent) out.push(`the prompt promises something the card does not show: it draws ${c.task === 'limiting' ? `a lamp, pondweed and the ${otherName(secondOfCard(c))}` : 'a tube in a water bath and a lens on the enzyme'}, and the learner taps buttons -- ask for that ("${example}")`)
    return out
  },

  initial(c) {
    return c.task === 'limiting' ? { light: LIGHTS[0], second: OTHERS[0], seen: [[LIGHTS[0], OTHERS[0]]] } : { tubes: [[startOf(c)]] }
  },

  check(c, s) {
    return { ok: done(c, s), wrongIds: [] }
  },

  /** A real run of taps: over the top, back to the best, and a fresh tube if the first has suffered. */
  solve(c) {
    if (c.task === 'limiting') {
      const need = neededFor(c.target)
      // The two factors take turns, as the walls would make a person do, so the graph it draws is the real one.
      let state: EnzymeRateState = enzymeRateEngine.initial(c)
      while (lightOf(state) < need.light || otherOf(state) < need.second) {
        const l = lightOf(state)
        const o = otherOf(state)
        const which: 'light' | 'second' = l >= need.light ? 'second' : o >= need.second ? 'light' : lightCap(l) <= otherCap(o) ? 'light' : 'second'
        state = limitStepped(state, which, 1)
      }
      return state
    }
    const grid = levelsOf(c)
    const start = startOf(c)
    const best = bestOf(c)
    const away = Math.sign(best - start)
    const over = grid[grid.indexOf(best) + away] ?? grid[grid.indexOf(best) - away]
    const path: number[] = [start]
    while (path[path.length - 1] !== over) path.push(grid[grid.indexOf(path[path.length - 1]) + away])
    path.push(best)
    return intactOf(c, path) === 1 ? { tubes: [path] } : { tubes: [path, [best]] }
  },

  View: EnzymeRateView,

  prompt: `SCENE "enzyme-rate" -- a real school practical on a quiet light panel, answering each tap, with a graph the learner draws by taking readings. The graph starts with one dot and no curve printed on it. The rate is read in numbers under the picture, always for the setting now in use.
  For: how enzymes work, the active site and lock and key, the effect of temperature, pH and substrate concentration on rate, the optimum, denaturing, and limiting factors in photosynthesis. It answers "enzymes are killed by heat", "a cooled enzyme recovers", "more substrate always means faster" and "more light always means more photosynthesis". For the rate of chemical reactions use rates-equilibrium. Do not use it for limiting reagents, limits in calculus, rates in maths or finance, limiting factors in budgets or populations, restriction enzymes, inhibitors, Vmax and Km, the light-dependent reactions, leaf structure, or plant mineral nutrition.
  enzyme: a glass beaker water bath with a thermometer on a hot plate, holding a test tube, with a lens on the enzyme molecules (each with its active site) and their substrate. Under it a stepper and, for temperature and pH, a "Fresh tube" button.
    factor "temperature": the bath steps from 0 to 70 °C in tens, starting at 20 °C. Cooling only slows a tube and warming brings it back; a tube taken past its best keeps the damage, so the dots on the way down lie far below the dots on the way up. Its best step is 40 °C for every enzyme here.
    factor "ph": the buffer steps from pH 1 to 13, with a strip of pH paper on the card, and the bath stays at 37 °C. Best: catalase 7, amylase 7, pepsin 2, trypsin 8, lipase 8. Near its best the rate falls and recovers; three or more steps away the damage stays.
    factor "substrate": 1% to 6%, with sites: 2 to 5 enzyme molecules, default ${DEFAULT_SITES}. The lens shows each site filling, then the rest of the substrate waiting. Its answer is sites% (the least that gives the top rate).
    enzyme: catalase (liver, foam rising in the tube), amylase (starch with iodine, blue-black clearing), pepsin or trypsin (egg-white cubes shrinking), lipase (a layer of fat thinning). Default catalase. Marking needs the tube at its best, unharmed, and a reading past the best, so the learner must go over the top to pass.
  limiting: pondweed under a glass funnel in a beaker, with a test tube collecting oxygen, a lamp that moves nearer on a bench, and a stream of bubbles. second: "co2" (a gas bottle with a gauge) or "temperature" (a thermometer, 10 to 30 °C). target: bubbles a minute to reach, ${TARGET_MIN} to ${TARGET_MAX}, default ${DEFAULT_TARGET}, drawn as a dashed line on the graph of rate against light. Each setting of the second factor gets its own line. Marking needs the target reached with neither factor a step higher than needed.
  Before marking the card shows the drawing, the rate, the dots and short names (foam, liver, starch, egg white, fat, pH paper, enzyme, active site, substrate, lamp, pondweed, oxygen, CO₂, aim). It holds back the best level, the words optimum and denatured, the reason for each shape on the graph, and which factor is limiting. Molecules that have lost their shape are drawn changed and named "changed shape". Marking names all of it, on the graph and in words, and draws the true curve. The prompt must ask for the outcome only: do NOT give the best temperature or pH, say that heat denatures or that the enzyme will not recover, or say where the line goes flat or which factor limits.
  config: { "task":"enzyme", "factor":"temperature", "enzyme":"catalase" }  -- the prompt says "${goodPrompt({ task: 'enzyme', factor: 'temperature', enzyme: 'catalase' })}"
       or { "task":"enzyme", "factor":"ph", "enzyme":"pepsin" }  -- the prompt says "${goodPrompt({ task: 'enzyme', factor: 'ph', enzyme: 'pepsin' })}"
       or { "task":"enzyme", "factor":"substrate", "enzyme":"catalase", "sites":4 }  -- the prompt says "${goodPrompt({ task: 'enzyme', factor: 'substrate', enzyme: 'catalase', sites: 4 })}"
       or { "task":"limiting", "second":"co2", "target":24 }  -- the prompt says "${goodPrompt({ task: 'limiting', second: 'co2', target: 24 })}"
       or { "task":"limiting", "second":"temperature", "target":18 }  -- the prompt says "${goodPrompt({ task: 'limiting', second: 'temperature', target: 18 })}"
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'enzyme', factor: 'temperature', enzyme: 'catalase' })}",
    "payload": { "engine":"enzyme-rate", "config": { "task":"enzyme", "factor":"temperature", "enzyme":"catalase" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:enzyme-rate", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'enzyme', factor: 'ph', enzyme: 'pepsin' })}",
    "payload": { "engine":"enzyme-rate", "config": { "task":"enzyme", "factor":"ph", "enzyme":"pepsin" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:enzyme-rate", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'enzyme', factor: 'substrate', enzyme: 'catalase', sites: 4 })}",
    "payload": { "engine":"enzyme-rate", "config": { "task":"enzyme", "factor":"substrate", "enzyme":"catalase", "sites":4 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:enzyme-rate", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'limiting', second: 'co2', target: 24 })}",
    "payload": { "engine":"enzyme-rate", "config": { "task":"limiting", "second":"co2", "target":24 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:enzyme-rate", "why":"..." } }`,
}

registerEngine(enzymeRateEngine as SceneEngine<unknown, unknown>)
