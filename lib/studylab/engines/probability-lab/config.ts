// lib/studylab/engines/probability-lab/config.ts
//
// Probability as a thing you build and then test, with real spinners and dice:
//   spinner -- a spinner with equal sectors, all plain. The learner taps sectors to colour them until a colour has the
//              chance the card asks for, and can spin it 1, 10 or 100 times at a time. A line of relative frequency
//              draws itself as the spins pile up: it wobbles over a few spins and settles over many, and a dotted line
//              marks the chance asked for. The spins are a fixed run, taken from the layout itself (a seeded hash), so
//              the same spinner always spins the same way and marking never looks at them;
//   space   -- two dice, and a grid of every pair they can land on, first die across and second die down. The learner
//              marks with a counter every pair that makes the event, and can roll the dice to see a pair land in the grid.
//
// The rules, all computed here and never read from the drawing:
//   spinner: a colour's chance is the number of its sectors over all sectors, compared by cross-multiplying whole numbers;
//   space:   the event is a rule over the pairs (a, b), and the marked pairs must be exactly the pairs it makes.
//
// Ideas taken, never code or art:
//   - record relative frequencies after more and more spins and set them beside the theoretical value, with a real-looking
//     spinner: the Virginia DOE spinner activity (read in summary); PhET's Plinko Probability, which batches 100 trials and sets
//     the heap against the ideal (summary only);
//   - the misconceptions: short runs "should even out" and small samples obey the law of large numbers (Tversky and
//     Kahneman, 1971, as cited in Leavy and Hourigan's summary), so the graph is allowed to wobble early and the learner
//     must keep spinning; and the two dice taken as unordered, so a 5 and a 6 looks as likely as two 6s (an NCTM handout
//     on the equiprobability misconception; Fischbein et al., 1991, via a Springer paper), so the grid keeps first die and
//     second die as its two axes and (5, 6) and (6, 5) are two squares;
//   - the sample space is the biggest predictor of equiprobability errors (Keren, 1984, cited in a PME paper), hence the
//     grid task.
// Refused:
//   - tree diagrams, conditional probability and distributions: a tree is a diagram to fill in and the learner would only
//     be typing fractions, so those stations are ruled out and it needs its own scene;
//   - several spinners, coins, cards and a Galton board on one card: one thing to handle, and the two shown are enough;
//   - a live readout of the exact chance of the learner's spinner, which would make the task a matter of matching a number.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ProbabilityLabView } from './View'

export const COLOURS = ['red', 'blue', 'green', 'yellow'] as const
export type ColourName = (typeof COLOURS)[number]
export const SECTORS_MIN = 4
export const SECTORS_MAX = 12
export const MAX_SPINS = 1000
export const STEPS = [1, 10, 100] as const
export const DICE_SIDES = [4, 6] as const

export type Target = { colour: string; chance: string }
export type ProbConfig =
  /** spinner: each target colour and its chance as a reduced fraction "p/q". Unknown colours and odd chances still parse; faults says what works. */
  | { task: 'spinner'; sectors: number; targets: Target[] }
  /** space: how many faces each die has, and the event, as a canonical phrase ("total 8", "doubles"). */
  | { task: 'space'; dice: number; event: string }

export type ProbState = { cells?: string[]; spins?: number; picks?: string[]; rolls?: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b

// ---------------------------------------------------------------------------
// Fractions

export type Frac = { p: number; q: number }
export const reduce = (p: number, q: number): Frac => {
  const g = gcd(p, q) || 1
  return { p: p / g, q: q / g }
}
export const fracText = (f: Frac) => `${f.p}/${f.q}`
export function fracOf(text: string): Frac | null {
  const m = /^(\d+)\/(\d+)$/.exec(text)
  if (!m || Number(m[2]) === 0) return null
  return reduce(Number(m[1]), Number(m[2]))
}

// ---------------------------------------------------------------------------
// The spinner

export const FILL: Record<string, string> = { plain: '#F3EEE3', red: '#D2534B', blue: '#3E7CC4', green: '#4C9A6A', yellow: '#F2C14E' }

const isColour = (c: string): c is ColourName => (COLOURS as readonly string[]).includes(c)

/** The colours a sector can be, besides plain: the targets, and a spare so a single target is not the only choice. */
export function paletteOf(targets: Target[]): string[] {
  const named = targets.map((t) => t.colour).filter((c, i, all) => isColour(c) && all.indexOf(c) === i)
  if (named.length >= 2) return named
  const spare = ['yellow', 'blue', 'green', 'red'].find((c) => !named.includes(c))!
  return [...named, spare]
}

/** The sectors the learner has coloured, always the right length and always colours the spinner has. */
export function cellsOf(config: Extract<ProbConfig, { task: 'spinner' }>, state: ProbState): string[] {
  const pal = paletteOf(config.targets)
  const n = Number.isInteger(config.sectors) && config.sectors > 0 ? config.sectors : SECTORS_MIN
  const raw = Array.isArray(state?.cells) ? state.cells : []
  return Array.from({ length: n }, (_, i) => (typeof raw[i] === 'string' && pal.includes(raw[i]) ? raw[i] : 'plain'))
}

export const countOf = (cells: string[], colour: string) => cells.filter((c) => c === colour).length

/** How many sectors a target needs: its chance times the sectors, a whole number when faults passes. */
export function needed(sectors: number, t: Target): number {
  const f = fracOf(t.chance)
  return f ? (f.p * sectors) / f.q : NaN
}

export const spinsOf = (state: ProbState) => {
  const s = typeof state?.spins === 'number' && Number.isFinite(state.spins) ? Math.floor(state.spins) : 0
  return Math.max(0, Math.min(MAX_SPINS, s))
}

/** A number from 0 up to 1 that depends only on the key and the index: the same spinner spins the same way every time. */
export function unit(key: string, i: number): number {
  let h = 2166136261 >>> 0
  for (let k = 0; k < key.length; k++) {
    h ^= key.charCodeAt(k)
    h = Math.imul(h, 16777619)
  }
  h ^= Math.imul(i + 1, 0x9e3779b1)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Where the needle stops on spin `i`, as a share of a full turn, and the sector it is in. */
export function spinAt(cells: string[], i: number): { turn: number; sector: number } {
  const turn = unit(cells.join(','), i)
  return { turn, sector: Math.min(cells.length - 1, Math.floor(turn * cells.length)) }
}

/** The colour each of the first `count` spins landed on. */
export function spinColours(cells: string[], count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(cells[spinAt(cells, i).sector])
  return out
}

/** The share of the first k spins that landed on `colour`, for k = 1 to the number of spins. */
export function runningShare(landed: string[], colour: string): number[] {
  let hits = 0
  return landed.map((c, k) => {
    if (c === colour) hits++
    return hits / (k + 1)
  })
}

// ---------------------------------------------------------------------------
// The dice

export type Pair = { a: number; b: number }
export const pairId = (a: number, b: number) => `${a}-${b}`

type Ev = { kind: 'total' | 'atleast' | 'atmost' | 'has' | 'difference'; n: number } | { kind: 'doubles' | 'botheven' | 'firstlarger' }

export function eventOf(text: string): Ev | null {
  const m = /^(total|total at least|total at most|has|difference) (\d+)$/.exec(text)
  if (m) {
    const kind = m[1] === 'total' ? 'total' : m[1] === 'total at least' ? 'atleast' : m[1] === 'total at most' ? 'atmost' : (m[1] as 'has' | 'difference')
    return { kind, n: Number(m[2]) }
  }
  if (text === 'doubles' || text === 'both even' || text === 'first larger') return { kind: text === 'doubles' ? 'doubles' : text === 'both even' ? 'botheven' : 'firstlarger' }
  return null
}

export function makes(ev: Ev, a: number, b: number): boolean {
  switch (ev.kind) {
    case 'total': return a + b === ev.n
    case 'atleast': return a + b >= ev.n
    case 'atmost': return a + b <= ev.n
    case 'has': return a === ev.n || b === ev.n
    case 'difference': return Math.abs(a - b) === ev.n
    case 'doubles': return a === b
    case 'botheven': return a % 2 === 0 && b % 2 === 0
    default: return a > b
  }
}

export function allPairs(d: number): Pair[] {
  const out: Pair[] = []
  for (let b = 1; b <= d; b++) for (let a = 1; a <= d; a++) out.push({ a, b })
  return out
}

/** The ids of the pairs the event makes, for dice of d faces. */
export function eventPairs(config: Extract<ProbConfig, { task: 'space' }>): string[] {
  const ev = eventOf(config.event)
  const d = Number.isInteger(config.dice) && config.dice >= 2 ? config.dice : 6
  if (!ev) return []
  return allPairs(d).filter((p) => makes(ev, p.a, p.b)).map((p) => pairId(p.a, p.b))
}

export const sidesOf = (config: Extract<ProbConfig, { task: 'space' }>) => (Number.isInteger(config.dice) && config.dice >= 2 && config.dice <= 12 ? config.dice : 6)

export function picksOf(config: Extract<ProbConfig, { task: 'space' }>, state: ProbState): string[] {
  const d = sidesOf(config)
  const raw = Array.isArray(state?.picks) ? state.picks : []
  return allPairs(d).map((p) => pairId(p.a, p.b)).filter((id) => raw.includes(id))
}

export const rollsOf = (state: ProbState) => {
  const r = typeof state?.rolls === 'number' && Number.isFinite(state.rolls) ? Math.floor(state.rolls) : 0
  return Math.max(0, Math.min(MAX_SPINS, r))
}

/** Roll `i` of the two dice, always the same sequence for the same dice. */
export function rollAt(d: number, i: number): Pair {
  return { a: 1 + Math.min(d - 1, Math.floor(unit(`dice${d}a`, i) * d)), b: 1 + Math.min(d - 1, Math.floor(unit(`dice${d}b`, i) * d)) }
}

export function eventPhrase(text: string): string {
  const ev = eventOf(text)
  if (!ev) return text
  switch (ev.kind) {
    case 'total': return `a total of ${ev.n}`
    case 'atleast': return `a total of ${ev.n} or more`
    case 'atmost': return `a total of ${ev.n} or less`
    case 'has': return `at least one ${ev.n}`
    case 'difference': return `a difference of ${ev.n}`
    case 'doubles': return 'doubles'
    case 'botheven': return 'both dice even'
    default: return 'the first die larger than the second'
  }
}

// ---------------------------------------------------------------------------
// Marking: from the rules, always.

export function doneSpinner(config: Extract<ProbConfig, { task: 'spinner' }>, state: ProbState): boolean {
  if (config.targets.length === 0) return false
  const cells = cellsOf(config, state)
  return config.targets.every((t) => {
    const need = needed(config.sectors, t)
    return Number.isInteger(need) && need >= 1 && countOf(cells, t.colour) === need
  })
}

export function wrongSpinner(config: Extract<ProbConfig, { task: 'spinner' }>, state: ProbState): string[] {
  const cells = cellsOf(config, state)
  return config.targets.filter((t) => countOf(cells, t.colour) !== needed(config.sectors, t)).map((t) => t.colour)
}

export function wrongPairs(config: Extract<ProbConfig, { task: 'space' }>, state: ProbState): { extra: string[]; missing: string[] } {
  const want = eventPairs(config)
  const got = picksOf(config, state)
  return { extra: got.filter((id) => !want.includes(id)), missing: want.filter((id) => !got.includes(id)) }
}

export function doneSpace(config: Extract<ProbConfig, { task: 'space' }>, state: ProbState): boolean {
  const want = eventPairs(config)
  if (want.length === 0) return false
  const w = wrongPairs(config, state)
  return w.extra.length === 0 && w.missing.length === 0
}

export function done(config: ProbConfig, state: ProbState): boolean {
  return config.task === 'spinner' ? doneSpinner(config, state) : doneSpace(config, state)
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card says no chance and no count.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const sectorsText = (k: number, n: number) => `${k} of ${n} sectors`
const pairsText = (k: number) => `${k} ${k === 1 ? 'pair' : 'pairs'}`

export function working(config: ProbConfig, state: ProbState): string {
  if (config.task === 'spinner') {
    const cells = cellsOf(config, state)
    const parts = config.targets.map((t) => {
      const k = countOf(cells, t.colour)
      return `${cap(t.colour)} covers ${sectorsText(k, cells.length)}, a chance of ${t.chance}`
    })
    return `Yes. ${parts.join('. ')}. Spin it again and again: the line wobbles over a few spins and settles near the chance over many.`
  }
  const d = sidesOf(config)
  const ids = eventPairs(config)
  const f = reduce(ids.length, d * d)
  const unordered = ids.some((id) => { const [a, b] = id.split('-'); return a !== b })
  const mirror = unordered ? ' The dice are different, so a 2 then a 5 is a different pair from a 5 then a 2.' : ''
  const share = f.q === d * d ? `${ids.length}/${d * d}` : `${ids.length}/${d * d}, which is ${fracText(f)}`
  return `Yes. ${pairsText(ids.length)} out of ${d * d} make ${eventPhrase(config.event)}, a chance of ${share}.${mirror}`
}

export function madeText(config: ProbConfig, state: ProbState): string {
  if (config.task === 'spinner') {
    const cells = cellsOf(config, state)
    return config.targets.map((t) => {
      const k = countOf(cells, t.colour)
      const f = reduce(k, cells.length)
      const same = k === needed(config.sectors, t)
      return `${cap(t.colour)} covers ${sectorsText(k, cells.length)}, a chance of ${k === 0 ? '0' : fracText(f)}, which ${same ? 'is the chance asked for' : 'is not the chance asked for'}.`
    }).join(' ')
  }
  const w = wrongPairs(config, state)
  const marked = picksOf(config, state).length
  if (marked === 0) return 'No pair is marked yet.'
  const bits: string[] = [`You marked ${pairsText(marked)}.`]
  bits.push(w.extra.length ? `${w.extra.length} of them ${w.extra.length === 1 ? 'does' : 'do'} not make it.` : 'Each one does make it.')
  bits.push(w.missing.length ? `${pairsText(w.missing.length)} that ${w.missing.length === 1 ? 'makes' : 'make'} it ${w.missing.length === 1 ? 'is' : 'are'} not marked.` : 'No pair that makes it is left out.')
  return bits.join(' ')
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
const PART: Record<string, number> = { half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4, fourth: 4, fourths: 4, fifth: 5, fifths: 5, sixth: 6, sixths: 6, eighth: 8, eighths: 8, tenth: 10, tenths: 10, twelfth: 12, twelfths: 12 }

/** A chance as the tutor might write it: 1/3, 0.25, 25%, "a quarter", "3 in 8". Reduced, or null when it is not a whole-number fraction. */
export function readChance(raw: unknown): Frac | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null
    return raw <= 1 ? fromDecimal(raw) : raw <= 100 ? fromDecimal(raw / 100) : null
  }
  if (typeof raw !== 'string') return null
  const t = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  let m = /^(\d+)\s*(?:\/|in|out of|over)\s*(\d+)$/.exec(t)
  if (m) return Number(m[2]) > 0 && Number(m[1]) <= Number(m[2]) ? reduce(Number(m[1]), Number(m[2])) : null
  m = /^(\d+(?:\.\d+)?)\s*%$/.exec(t)
  if (m) return fromDecimal(Number(m[1]) / 100)
  if (/^\d*\.\d+$|^\d+$/.test(t)) return readChance(Number(t))
  m = /^(?:(\w+)\s+)?(halves|half|thirds?|quarters?|fourths?|fifths?|sixths?|eighths?|tenths?|twelfths?)$/.exec(t)
  if (m) {
    const top = m[1] === undefined ? 1 : m[1] in NUM ? NUM[m[1]] : /^\d+$/.test(m[1]) ? Number(m[1]) : NaN
    const q = PART[m[2]]
    return Number.isFinite(top) && top <= q ? reduce(top, q) : null
  }
  return null
}

function fromDecimal(x: number): Frac | null {
  if (!(x > 0 && x <= 1)) return null
  for (let q = 1; q <= SECTORS_MAX; q++) {
    const p = Math.round(x * q)
    if (p >= 1 && Math.abs(p / q - x) < 0.0034) return reduce(p, q)
  }
  return null
}

function readColour(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().toLowerCase()
  return t === '' ? null : t
}

function readTarget(colour: unknown, chance: unknown): Target | null {
  const c = readColour(colour)
  if (c === null) return null
  if (typeof chance !== 'string' && typeof chance !== 'number') return null
  const f = readChance(chance)
  return { colour: c, chance: f ? fracText(f) : String(chance).trim() }
}

/** The fewest sectors that hold every target exactly and show a few of each, in range, or a plain default when none can. */
export function defaultSectors(targets: Target[]): number {
  let l = 1
  for (const t of targets) {
    const f = fracOf(t.chance)
    if (f) l = lcm(l, f.q)
  }
  if (l > SECTORS_MAX) return 8
  let n = l
  while (n < 6 && n + l <= SECTORS_MAX) n += l
  return Math.max(n, SECTORS_MIN <= l ? l : l * Math.ceil(SECTORS_MIN / l))
}

function readTargets(o: Record<string, unknown>): Target[] | null {
  const list = first(o, ['targets', 'colours', 'colors', 'goals'])
  const map = first(o, ['chances', 'probabilities'])
  const out: Target[] = []
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      const t = readTarget(first(r, ['colour', 'color', 'name']), first(r, ['chance', 'probability', 'p']))
      if (!t) return null
      out.push(t)
    }
    return out
  }
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
      const t = readTarget(k, v)
      if (!t) return null
      out.push(t)
    }
    return out
  }
  const c = first(o, ['colour', 'color', 'target'])
  const p = first(o, ['chance', 'probability', 'p'])
  if (c === undefined && p === undefined) return []
  const t = readTarget(c === undefined ? 'red' : c, p)
  return t ? [t] : null
}

const EVENT_NOTE = 'e.g. event "total 7"'

/** An event as a person says it, in the form the card keeps: "sum of 8", "at least one six", "the dice match". */
export function readEvent(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.toLowerCase().replace(/[^a-z0-9<>=\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  if (t === '') return null
  const num = (s: string | undefined) => (s === undefined ? NaN : /^\d+$/.test(s) ? Number(s) : NUM[s] ?? NaN)
  const NW = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
  if (/\bdoubles?\b|\bsame (?:number|score|face|value)\b|\bmatch(?:ing|es)?\b|\bboth the same\b|\bboth dice (?:the same|match)/.test(t)) return 'doubles'
  if (/\bboth (?:dice |are |numbers )*even\b|\btwo even\b/.test(t)) return 'both even'
  if (/\bfirst (?:die |dice |number )?(?:is |are )?(?:larger|bigger|greater|higher)\b/.test(t)) return 'first larger'
  let m = new RegExp(`\\b(?:differ(?:ence)?|differs?)\\D*?${NW}\\b`).exec(t)
  if (m && !Number.isNaN(num(m[1]))) return `difference ${num(m[1])}`
  if (/\b(?:total|sum|score|add(?:s|ed)?(?: up)?|adding)\b/.test(t)) {
    m = new RegExp(`(?:at least|no less than|minimum of|\\bover or equal to|>=)\\s*${NW}\\b|${NW}\\s*(?:or more|or higher|or greater|or over|\\+)`).exec(t)
    if (m) return `total at least ${num(m[1] ?? m[2])}`
    m = new RegExp(`(?:more than|greater than|bigger than|larger than|above|over|>)\\s*${NW}\\b`).exec(t)
    if (m) return `total at least ${num(m[1]) + 1}`
    m = new RegExp(`(?:at most|no more than|maximum of|<=)\\s*${NW}\\b|${NW}\\s*(?:or less|or fewer|or lower|or under)`).exec(t)
    if (m) return `total at most ${num(m[1] ?? m[2])}`
    m = new RegExp(`(?:less than|fewer than|smaller than|below|under|<)\\s*${NW}\\b`).exec(t)
    if (m) return `total at most ${num(m[1]) - 1}`
    m = new RegExp(`\\b${NW}\\b`).exec(t.replace(/\b(?:total|sum|score)\b/g, ' '))
    if (m && !Number.isNaN(num(m[1]))) return `total ${num(m[1])}`
  }
  m = new RegExp(`(?:at least one|any|either|a|an|one)\\s+${NW}\\b`).exec(t)
  if (m && !Number.isNaN(num(m[1])) && !/\btotal|sum\b/.test(t)) return `has ${num(m[1])}`
  return t
}

const SPIN_WORDS = new Set(['spinner', 'spinners', 'spin', 'wheel', 'build', 'make', 'colour', 'color', 'relative-frequency', 'experiment', 'experimental-probability', 'trials', 'chance'])
const SPACE_WORDS = new Set(['space', 'sample-space', 'sample', 'dice', 'two-dice', 'grid', 'outcomes', 'pairs', 'event', 'events', 'list', 'sample-space-grid', 'outcome-grid', 'roll'])

export const probabilityLabEngine: SceneEngine<ProbConfig, ProbState> = {
  id: 'probability-lab',
  // Distinctive words only. "chance" and "likely" are everyday words, so they go in whole phrases, with notFor for the near misses.
  covers: ['probability', 'probabilities', 'dice', 'spinners', 'spinner', 'randomness'],
  phrases: [
    'chance', 'chances', 'chance and probability', 'probability and chance', 'chance events', 'games of chance', 'likelihood', 'how likely', 'more likely', 'equally likely', 'likely outcomes', 'likely events', 'the likelihood of events',
    'relative frequency', 'relative frequencies', 'experimental probability', 'theoretical probability', 'estimating probability', 'estimating probabilities', 'expected frequency', 'expected outcomes',
    'sample space', 'sample spaces', 'sample space diagram', 'sample space diagrams', 'possible outcomes', 'listing outcomes', 'outcomes of events', 'experiments, events and outcomes', 'experiments events and outcomes', 'events and outcomes', 'random events', 'random experiments', 'fair and unfair', 'fair game', 'fair games', 'fair spinner', 'fair dice', 'probability scale', 'rolling dice', 'two dice', 'law of large numbers', 'simple probability', 'basic probability', 'probability of an event', 'probability of events', 'mutually exclusive events',
  ],
  // Near misses: probability that is not a spinner or a pair of dice, and "chance" about something else.
  notFor: [
    'conditional probability', 'conditional probabilities', 'probability distribution', 'probability distributions', 'probability density', 'probability density function', 'probability functions', 'binomial distribution', 'binomial probability', 'normal distribution', 'poisson distribution', 'discrete random variable', 'discrete random variables', 'continuous random variable', 'continuous random variables', 'random variables', 'tree diagram', 'tree diagrams', 'probability tree', 'probability trees', 'venn diagram', 'venn diagrams',
    'bayes', 'bayes theorem', 'expected value', 'expectation', 'permutation', 'permutations', 'combination', 'combinations', 'counting principles', 'independent events', 'dependent events', 'cumulative probability', 'geometric distribution', 'hypothesis testing', 'significance', 'confidence intervals', 'random sampling', 'sampling', 'monte carlo',
    'genetic probability', 'probability of inheritance', 'inheritance', 'genetics', 'punnett', 'mutation', 'mutations', 'chance mutation', 'chance mutations', 'natural selection', 'radioactive decay', 'half life', 'half-life', 'quantum', 'wave function', 'electron probability', 'orbital', 'orbitals',
    'chance of rain', 'weather', 'risk assessment', 'insurance', 'chance encounter', 'chance discovery', 'second chance', 'second chances', 'equal opportunities', 'equal opportunity', 'chance cards', 'monopoly', 'gambling', 'lottery',
    'dice rolling in games', 'dice game design', 'game design', 'diced', 'dicing',
  ],
  // The learner changes the sectors, or the pairs: what they make decides the chance.
  isolates: 'quantity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const word = keyOf(first(o, ['task', 'kind', 'type', 'mode']))
    const hasEvent = first(o, ['event', 'diceEvent', 'rule', 'dice', 'sides', 'faces']) !== undefined
    const hasSpin = first(o, ['sectors', 'segments', 'slices', 'targets', 'chances', 'probabilities', 'colour', 'color', 'chance', 'probability', 'p', 'colours', 'colors', 'goals']) !== undefined
    const asSpace = SPACE_WORDS.has(word) ? true : SPIN_WORDS.has(word) ? false : null
    const isSpace = asSpace ?? (hasEvent && !hasSpin ? true : hasSpin ? false : null)
    if (word && asSpace === null && !hasEvent && !hasSpin) return null
    if (isSpace === null) return null
    if (isSpace) {
      const rawEvent = first(o, ['event', 'rule', 'outcome'])
      const diceRaw = first(o, ['dice', 'sides', 'faces', 'die'])
      const dice = diceRaw === undefined ? 6 : typeof diceRaw === 'number' ? diceRaw : typeof diceRaw === 'string' && /^\d+$/.test(diceRaw.trim()) ? Number(diceRaw.trim()) : /d(\d+)/i.test(String(diceRaw)) ? Number(/d(\d+)/i.exec(String(diceRaw))![1]) : null
      if (dice === null || !Number.isFinite(dice)) return null
      const event = rawEvent === undefined ? 'doubles' : readEvent(rawEvent)
      if (event === null) return null
      return { task: 'space', dice, event }
    }
    const targets = readTargets(o)
    if (targets === null) return null
    const secRaw = first(o, ['sectors', 'segments', 'slices', 'parts', 'size'])
    let sectors: number
    if (secRaw === undefined) sectors = defaultSectors(targets)
    else {
      const v = typeof secRaw === 'string' && secRaw.trim() !== '' ? Number(secRaw.trim().replace(/\s*(?:sectors?|segments?|slices?|parts?)$/i, '')) : secRaw
      if (typeof v !== 'number' || !Number.isFinite(v)) return null
      sectors = v + 0
    }
    return { task: 'spinner', sectors, targets }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'spinner') {
      const t = config.targets
      if (t.length === 0) out.push('A spinner needs a colour and a chance for it, e.g. colour "red", chance "1/4".')
      if (t.length > 2) out.push(`A spinner can ask for at most two colours, and this asks for ${t.length}: use e.g. colour "red", chance "1/4".`)
      const seen: string[] = []
      for (const x of t) {
        if (!isColour(x.colour)) out.push(`There is no "${x.colour}" on the spinner: use ${COLOURS.join(', ')}, e.g. colour "red".`)
        else if (seen.includes(x.colour)) out.push(`"${x.colour}" is asked for twice: give each colour one chance, e.g. colour "red", chance "1/4".`)
        seen.push(x.colour)
        const f = fracOf(x.chance)
        if (!f) out.push(`The chance "${x.chance}" cannot be read as a fraction: use e.g. chance "1/4" (or 25%, or "a quarter").`)
        else if (f.p >= f.q) out.push(`A chance of ${x.chance} would colour every sector: ask for less than 1, e.g. chance "1/4".`)
        else if (f.q > SECTORS_MAX) out.push(`A chance of ${x.chance} needs more sectors than a spinner holds (${SECTORS_MAX}): use e.g. chance "1/4".`)
      }
      const fs = t.map((x) => fracOf(x.chance)).filter((f): f is Frac => !!f && f.p < f.q && f.q <= SECTORS_MAX)
      if (fs.length === t.length && t.length > 0) {
        const total = fs.reduce((s, f) => s + f.p / f.q, 0)
        if (total > 1 + 1e-9) out.push(`The chances add up to more than 1, so they cannot all fit on one spinner: use e.g. red "1/4" and blue "1/2".`)
        const l = fs.reduce((a, f) => lcm(a, f.q), 1)
        if (l > SECTORS_MAX) out.push(`These chances need ${l} sectors, more than a spinner holds (${SECTORS_MAX}): use chances over 2, 3, 4, 6, 8 or 12 such as "1/4", e.g. chance "1/4".`)
        else if (!Number.isInteger(config.sectors) || config.sectors < SECTORS_MIN || config.sectors > SECTORS_MAX || config.sectors % l !== 0) {
          out.push(`${config.sectors} sectors cannot show these chances exactly (sectors must be a multiple of ${l}, ${SECTORS_MIN} to ${SECTORS_MAX}): use e.g. sectors ${defaultSectors(t)}.`)
        }
      } else if (!Number.isInteger(config.sectors) || config.sectors < SECTORS_MIN || config.sectors > SECTORS_MAX) {
        out.push(`${config.sectors} sectors is outside what a spinner holds (${SECTORS_MIN} to ${SECTORS_MAX}): use e.g. sectors 8.`)
      }
      return out
    }
    const d = config.dice
    if (!(DICE_SIDES as readonly number[]).includes(d)) out.push(`The grid is drawn for dice of 4 or 6 faces, not ${d}: use e.g. dice 6.`)
    const ev = eventOf(config.event)
    if (!ev) {
      out.push(`The event "${config.event}" is not one the grid can mark: use "total 7", "total at least 9", "total at most 4", "doubles", "has 6", "difference 2", "both even" or "first larger" (${EVENT_NOTE}).`)
      return out
    }
    if ((DICE_SIDES as readonly number[]).includes(d)) {
      if (ev.kind === 'total' && (ev.n < 2 || ev.n > 2 * d)) out.push(`Two dice of ${d} faces total from 2 to ${2 * d}, so ${ev.n} cannot happen: use e.g. event "total ${d + 1}".`)
      else if (ev.kind === 'has' && (ev.n < 1 || ev.n > d)) out.push(`A die of ${d} faces shows 1 to ${d}, so ${ev.n} cannot happen: use e.g. event "has ${d}".`)
      else if (ev.kind === 'difference' && (ev.n < 1 || ev.n > d - 1)) out.push(`Two dice of ${d} faces differ by 1 to ${d - 1} (0 is doubles): use e.g. event "difference 2".`)
      else {
        const k = eventPairs(config).length
        if (k === 0) out.push(`No pair of dice makes that event: use e.g. event "total ${d + 1}".`)
        else if (k === d * d) out.push(`Every pair makes that event, so there is nothing to choose: use e.g. event "total ${d + 1}".`)
      }
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const NW = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
    if (config.task === 'spinner') {
      const parts = '(?:sectors?|sections?|slices?|segments?|wedges?|parts?)'
      const count = new RegExp(`\\b(?:colou?r|paint|shade|fill|make|use|turn|set|cover)\\s+(?:exactly\\s+)?${NW}\\s+(?:of\\s+(?:the\\s+)?)?(?:\\w+\\s+)?${parts}\\b|\\b${NW}\\s+of\\s+the\\s+${NW}\\s+${parts}\\b|\\b${NW}\\s+(?:red|blue|green|yellow)\\s+${parts}\\b|\\bequal\\s+to\\s+\\d+\\s*/\\s*\\d+\\s+of\\b`, 'i').test(text)
      const rule = /\bnumerator\b|\bdenominator\b|\bfavourable|\bfavorable|\btotal number of (?:sectors|outcomes)|\bdivide\b|\bfavourable outcomes\b/i.test(text)
      if (count || rule) out.push(`the prompt gives the answer away: it says how many sectors to colour or how to work the chance out, which the learner is to find -- ask for the chance only ("${example}")`)
      if (/\bdrag\b|\bcoin\b|\bflip|\bdice\b|\bdie\b|\bcards?\b|\btree\b|\bbag\b|\bgalton|\bshake|\broll\b|\bcompare two spinners|\bpredict\b/i.test(text)) {
        out.push(`the prompt promises something the card does not show: it draws one spinner whose sectors are tapped and spun, with no dice, coins or trees -- ask for that ("${example}")`)
      }
    } else {
      const d = sidesOf(config)
      const lists = /\(\s*\d+\s*,\s*\d+\s*\)/.test(text)
      const number = [...text.matchAll(/\b(\d+)\s+(?:ways|pairs|outcomes|cells|squares|combinations|possibilities)\b/gi)].some((m) => Number(m[1]) !== d * d)
      const shape = /\bdiagonal|\banti-?diagonal|\bsymmetr|\bmirror|\bone row\b|\bone column\b|\bstaircase\b/i.test(text)
      if (lists || number || shape) out.push(`the prompt gives the answer away: it lists pairs, counts them or says where they sit, which the learner is to find in the grid -- ask for the event only ("${example}")`)
      if (/\bspin|\bspinner\b|\bcoin\b|\bflip|\btree\b|\bbag\b|\bcards?\b|\bdrag\b|\bcolou?r\b|\bsum the probabilit|\bpredict\b/i.test(text)) {
        out.push(`the prompt promises something the card does not show: it draws two dice and a grid of pairs, and the learner taps squares to mark them -- ask for that ("${example}")`)
      }
    }
    return out
  },

  initial(config) {
    return config.task === 'spinner' ? { cells: Array.from({ length: Math.max(1, config.sectors) }, () => 'plain'), spins: 0 } : { picks: [], rolls: 0 }
  },

  check(config, state) {
    if (config.task === 'spinner') return { ok: doneSpinner(config, state), wrongIds: wrongSpinner(config, state) }
    const w = wrongPairs(config, state)
    return { ok: doneSpace(config, state), wrongIds: [...w.extra, ...w.missing] }
  },

  solve(config) {
    if (config.task === 'space') return { picks: eventPairs(config), rolls: 0 }
    const cells = Array.from({ length: config.sectors }, () => 'plain')
    let at = 0
    for (const t of config.targets) {
      const k = needed(config.sectors, t)
      for (let i = 0; i < k && at < cells.length; i++) cells[at++] = t.colour
    }
    return { cells, spins: 0 }
  },

  View: ProbabilityLabView,

  prompt: `SCENE "probability-lab" -- real probability equipment on a quiet light panel, in two tasks.
  spinner: a round spinner board with equal sectors, all cream to start, a rim with pegs and a needle on a hub. The learner taps a sector to colour it (it cycles plain, then each colour on offer, then plain again). Under the picture, Spin turns the needle once, x10 and x100 spin it ten or a hundred times at once, and Clear wipes the spins. A line graph draws itself as spins pile up: the share of spins that landed on the goal colour, which wobbles over a few spins and settles over many, with a dotted line and a fraction at the chance the card asks for. A row of small counters shows the last results. The spins are a fixed run that depends only on how the sectors are coloured, so the same spinner always spins the same way.
  space: two dice drawn with pips, and a 6 by 6 grid (or 4 by 4) of every pair they can land on, the first die across the top and the second die down the side, so a 2 then a 5 and a 5 then a 2 are two squares. The learner taps squares to mark them with a counter, and Roll throws the pair and rings the square it lands in.
  For: probability from first principles, equally likely outcomes, relative frequency settling as trials grow, theoretical against experimental probability, sample spaces for two dice, listing every outcome and counting those that make an event. It answers "a short run should even out", "more spins make the results exact" and "a 5 and a 6 is the same as a 6 and a 5".
  spinner config: "colour" and "chance" (a fraction like "1/3", or "25%", or "a quarter") for one goal colour, or "chances": { "red": "1/4", "blue": "1/2" } for two goal colours; "sectors" 4 to 12 (optional: chosen to fit the chances, and sectors must be a multiple of every chance's denominator, so "1/4" works on 4, 8 or 12 sectors). Colours: red, blue, green, yellow. A single goal colour gets a spare colour too, so colouring is a choice. The goal is met by exactly the sectors the chance needs: 1/3 of 12 is 4. Choose chances with denominators 2, 3, 4, 6, 8 or 12, and use more sectors than the fraction's denominator for equivalent fractions (1/4 on 8 sectors).
  space config: "dice" 4 or 6 (default 6), and "event": "total 7", "total at least 9", "total at most 4", "doubles", "has 6" (at least one 6), "difference 2", "both even" or "first larger" (the first die larger than the second). Events may also be written as a phrase such as "sum of 8" or "at least one six".
  Not drawn: tree diagrams, conditional probability, probability distributions, coins, cards, bags, a Galton board, expected value. Do not use it for those or for genetics, or radioactive decay.
  Before marking the card shows the spinner you made and how it spins, the share of spins landing on each goal colour with the target as a dotted line, and the grid with counters on the squares you marked and the dice that rolled. It never says the exact chance of your spinner or how many pairs make the event. Marking says how many sectors cover each colour and the chance, or how many pairs fit the event and the chance. The prompt must ask for the chance or the event only and name the gesture: do NOT say how many sectors to colour, how to work out a chance, how many pairs there are, list pairs such as (2, 6), or say where they sit (a diagonal).
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a sector to colour it, and spin to test your spinner. Make a spinner where red has a 1/3 chance.",
    "payload": { "engine":"probability-lab", "config": { "task":"spinner", "colour":"red", "chance":"1/3", "sectors":12 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:probability-lab", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a sector to colour it, and spin to test your spinner. Make a spinner where red has a 1/4 chance and blue has a 1/2 chance.",
    "payload": { "engine":"probability-lab", "config": { "task":"spinner", "chances": { "red":"1/4", "blue":"1/2" }, "sectors":8 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:probability-lab", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a square to mark that pair of dice with a counter. Mark every pair that gives a total of 8.",
    "payload": { "engine":"probability-lab", "config": { "task":"space", "dice":6, "event":"total 8" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:probability-lab", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a square to mark that pair of dice with a counter. Mark every pair that makes doubles.",
    "payload": { "engine":"probability-lab", "config": { "task":"space", "dice":4, "event":"doubles" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:probability-lab", "why":"..." } }`,
}

/** What a prompt can safely say: the gesture and the aim. */
function goodPrompt(config: ProbConfig): string {
  if (config.task === 'spinner') {
    const list = config.targets.slice(0, 2).map((t) => `${t.colour} has a ${isColour(t.colour) && fracOf(t.chance) ? t.chance : '1/4'} chance`)
    const said = list.length ? list.join(' and ') : 'red has a 1/4 chance'
    return `Tap a sector to colour it, and spin to test your spinner. Make a spinner where ${said}.`
  }
  return `Tap a square to mark that pair of dice with a counter. Mark every pair that gives ${eventOf(config.event) ? eventPhrase(config.event) : 'a total of 7'}.`
}

registerEngine(probabilityLabEngine as SceneEngine<unknown, unknown>)
