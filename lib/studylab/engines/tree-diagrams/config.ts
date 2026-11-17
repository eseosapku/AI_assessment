// lib/studylab/engines/tree-diagrams/config.ts
//
// The bag and the tree (see .superpowers/bakeoff/tree-diagrams/design.md).
// Counters are taken from a bag one at a time and land at the ends of a probability tree. Each branch's fraction is read from
// what is in the bag at that moment, and a chance bar is cut down to a share at each draw.
//   find   -- the handling is fixed ("keep them out" or "put the first back"); draw pairs until one fits the goal;
//   choose -- the pair is fixed; decide whether the first counter goes back so the pair has the target chance.
//
// Rules are computed here, from the bag and the draws, never from the drawing.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { TreeView } from './View'
import type { Colour, Pick, Tried } from './Picture'

export type { Colour, Pick, Tried }

/** A config as the tutor may write it: read broadly, then refused by faults when it cannot be drawn. */
export type TreeConfig = {
  kind: string
  colours: string[]
  bag: number[]
  put?: string
  goal?: string
  chance?: number[]
  pair?: number[]
}

export type TreeState = { first: Pick | null; back: boolean; second: Pick | null; tried: Tried[] }

export const COLOURS: Colour[] = ['red', 'blue', 'green', 'yellow']
export const ORDER: [Pick, Pick][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
]
const DEFAULT_COLOURS: [Colour, Colour] = ['red', 'blue']
const DEFAULT_BAG: [number, number] = [3, 2]

/** A config the card can draw (faults is empty), with every field settled. */
export type Strict = {
  kind: 'find' | 'choose'
  colours: [Colour, Colour]
  bag: [number, number]
  put: 'out' | 'back'
  goal: 'chance' | 'most' | 'least'
  chance: [number, number] | null
  pair: [Pick, Pick] | null
}

export function strict(c: TreeConfig): Strict {
  return {
    kind: c.kind === 'choose' ? 'choose' : 'find',
    colours: c.colours as [Colour, Colour],
    bag: c.bag as [number, number],
    put: c.kind === 'choose' ? 'out' : c.put === 'back' ? 'back' : 'out',
    goal: c.kind === 'choose' ? 'chance' : c.goal === 'most' ? 'most' : c.goal === 'least' ? 'least' : 'chance',
    chance: c.chance ? [c.chance[0], c.chance[1]] : null,
    pair: c.pair ? [c.pair[0] as Pick, c.pair[1] as Pick] : null,
  }
}

// ---------------------------------------------------------------------------
// The arithmetic. Fractions are kept unsimplified (6/20) and compared by cross-multiplying.

export type Frac = { n: number; d: number }
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
export const fracText = (f: Frac) => `${f.n}/${f.d}`
/** "6/20 = 3/10" when it simplifies, "9/25" when it does not. */
export function eqText(f: Frac): string {
  const g = gcd(f.n, f.d) || 1
  return g > 1 ? `${f.n}/${f.d} = ${f.n / g}/${f.d / g}` : `${f.n}/${f.d}`
}
export const sameFrac = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d
const simple = (f: Frac): Frac => {
  const g = gcd(f.n, f.d) || 1
  return { n: f.n / g, d: f.d / g }
}

const total = (s: Strict) => s.bag[0] + s.bag[1]

/** The second branch: what is in the bag for the second draw, as a fraction. */
export function secondOf(s: Strict, f: Pick, sec: Pick, back: boolean): Frac {
  return { n: s.bag[sec] - (sec === f && !back ? 1 : 0), d: back ? total(s) : total(s) - 1 }
}
/** The whole pair: first branch times second branch, unsimplified. */
export function chanceOf(s: Strict, f: Pick, sec: Pick, back: boolean): Frac {
  const q = secondOf(s, f, sec, back)
  return { n: s.bag[f] * q.n, d: total(s) * q.d }
}
const firstOf = (s: Strict, f: Pick): Frac => ({ n: s.bag[f], d: total(s) })

/** The pairs a student can actually draw under a handling (a second counter must exist). */
function drawable(s: Strict, back: boolean): [Pick, Pick][] {
  return ORDER.filter(([f, sec]) => chanceOf(s, f, sec, back).n > 0)
}

const greater = (a: Frac, b: Frac) => a.n * b.d > b.n * a.d

/** Does this finished pair meet the goal of a find task? Ties all pass. */
function fits(s: Strict, f: Pick, sec: Pick): boolean {
  const back = s.put === 'back'
  const mine = chanceOf(s, f, sec, back)
  if (mine.n === 0) return false
  const pool = drawable(s, back).map(([a, b]) => chanceOf(s, a, b, back))
  if (s.goal === 'chance') return s.chance !== null && sameFrac(mine, { n: s.chance[0], d: s.chance[1] })
  if (s.goal === 'most') return pool.every((p) => !greater(p, mine))
  return pool.every((p) => !greater(mine, p))
}

const pairsThatFit = (s: Strict): [Pick, Pick][] => ORDER.filter(([f, sec]) => fits(s, f, sec))

// ---------------------------------------------------------------------------
// The state, read safely: anything corrupt reads as the start.

const isPick = (v: unknown): v is Pick => v === 0 || v === 1

export function readState(state: Partial<TreeState> | null | undefined): TreeState {
  const first = isPick(state?.first) ? state!.first : null
  const second = first !== null && isPick(state?.second) ? state!.second : null
  const back = first !== null && state?.back === true
  const tried: Tried[] = Array.isArray(state?.tried)
    ? (state!.tried as Partial<Tried>[]).filter((t) => isPick(t?.first) && isPick(t?.second) && typeof t?.back === 'boolean').map((t) => ({ first: t.first as Pick, second: t.second as Pick, back: t.back as boolean }))
    : []
  return { first, back, second: second as Pick | null, tried }
}

/** How many counters of colour c are in the bag now. */
export function inBag(config: TreeConfig, state: Partial<TreeState> | null | undefined, c: Pick): number {
  const s = strict(config)
  const t = readState(state)
  return s.bag[c] - (t.first === c && !t.back ? 1 : 0) - (t.second === c ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Marking.

function ready(config: TreeConfig): boolean {
  return faults(config).length === 0
}

export function check(config: TreeConfig, state: Partial<TreeState> | null | undefined): { ok: boolean; wrongIds: string[] } {
  const t = readState(state)
  if (!ready(config) || t.first === null || t.second === null) return { ok: false, wrongIds: ['pair'] }
  const s = strict(config)
  if (s.kind === 'find') {
    const ok = t.back === (s.put === 'back') && fits(s, t.first, t.second)
    return { ok, wrongIds: ok ? [] : ['pair'] }
  }
  const [pf, ps] = s.pair!
  if (t.first !== pf || t.second !== ps) return { ok: false, wrongIds: ['pair'] }
  const ok = sameFrac(chanceOf(s, pf, ps, t.back), { n: s.chance![0], d: s.chance![1] })
  return { ok, wrongIds: ok ? [] : ['handling'] }
}

// ---------------------------------------------------------------------------
// Words on the card. Before marking, only observations; never right or wrong.

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
const pairName = (s: Strict, f: Pick, sec: Pick) => `${s.colours[f]} then ${s.colours[sec]}`
const targetText = (s: Strict) => (s.chance ? `${s.chance[0]}/${s.chance[1]}` : '')

export function goalText(config: TreeConfig): string {
  if (!ready(config)) return ''
  const s = strict(config)
  if (s.kind === 'choose') return `${cap(pairName(s, s.pair![0], s.pair![1]))}, with a chance of ${targetText(s)}`
  if (s.goal === 'most') return 'Find a most likely pair'
  if (s.goal === 'least') return 'Find a least likely pair'
  return `Find the pair with a chance of ${targetText(s)}`
}

export function handlingText(config: TreeConfig): string {
  if (!ready(config)) return ''
  const s = strict(config)
  if (s.kind === 'choose') return 'You decide if the first goes back.'
  return s.put === 'back' ? 'The first counter goes back.' : 'The first counter stays out.'
}

export const MEASURE_LABEL = 'Chance of these draws'

export function measureOf(config: TreeConfig, state: Partial<TreeState> | null | undefined): { label: string; value: string } {
  const t = readState(state)
  if (!ready(config) || t.first === null) return { label: MEASURE_LABEL, value: 'Nothing taken yet' }
  const s = strict(config)
  const one = firstOf(s, t.first)
  if (t.second === null) return { label: MEASURE_LABEL, value: fracText(one) }
  const two = secondOf(s, t.first, t.second, t.back)
  return { label: MEASURE_LABEL, value: `${fracText(one)} × ${fracText(two)} = ${fracText(chanceOf(s, t.first, t.second, t.back))}` }
}

export function captionText(config: TreeConfig, state: Partial<TreeState> | null | undefined): string {
  if (!ready(config)) return ''
  const s = strict(config)
  const t = readState(state)
  const T = total(s)
  if (t.first === null) return `The bag holds ${s.bag[0]} ${s.colours[0]} and ${s.bag[1]} ${s.colours[1]} counters. Take one out.`
  const f = t.first
  const one = firstOf(s, f)
  const said = `${s.bag[f]} of the ${T} were ${s.colours[f]}, so the first branch is ${fracText(one)}.`
  if (t.second !== null) {
    const two = secondOf(s, f, t.second, t.back)
    return `The second draw kept ${fracText(two)} of the ${fracText(one)} piece. The chance of the pair is the product.`
  }
  if (t.back) return 'The bag is whole again, so the next branches match the first ones.'
  if (s.kind === 'find' && s.put === 'back') return `${said} Put it back before the next draw.`
  if (s.kind === 'choose') return `${said} The next branches show the bag without it. You may put it back.`
  const gone = ([0, 1] as Pick[]).filter((c) => s.bag[c] - (c === f ? 1 : 0) === 0)
  const zero = gone.length ? ` No ${s.colours[gone[0]]} is left, so that branch is 0.` : ''
  return `${said} ${T - 1} are left, and the next branches come from them.${zero}`
}

/** What a marked card says, from the draws. */
export function verdictText(config: TreeConfig, state: Partial<TreeState> | null | undefined): string {
  if (!ready(config)) return ''
  const s = strict(config)
  const t = readState(state)
  if (t.first === null || t.second === null) return 'No pair has been drawn yet. Take two counters out.'
  const { first: f, second: sec, back } = t
  const mine = chanceOf(s, f, sec, back)
  const name = cap(pairName(s, f, sec))
  const ok = check(config, t).ok

  if (s.kind === 'choose') {
    const [pf, ps] = s.pair!
    const wanted = cap(pairName(s, pf, ps))
    if (f !== pf || sec !== ps) return `${name} is not the pair the goal asks for. The goal is ${pairName(s, pf, ps)}.`
    const q = secondOf(s, pf, ps, back)
    const other = secondOf(s, pf, ps, !back)
    if (ok) {
      const how = back ? `Put back, the bag is whole again: ${q.n} of ${q.d} are ${s.colours[ps]}` : `Kept out, ${q.n} of the ${q.d} left are ${s.colours[ps]}`
      return `${how}, so ${wanted.toLowerCase()} has ${fracText(firstOf(s, pf))} × ${fracText(q)} = ${eqText(mine)}.`
    }
    return `${back ? 'Put back' : 'Kept out'}, this pair has ${fracText(firstOf(s, pf))} × ${fracText(q)} = ${eqText(mine)}, not ${targetText(s)}. ${back ? 'Keeping it out' : 'Putting it back'} leaves ${other.n} of ${other.d} ${s.colours[ps]}.`
  }

  const needBack = s.put === 'back'
  if (back !== needBack) return `The first counter was ${back ? 'put back' : 'kept out'}, but this task has it ${needBack ? 'put back' : 'kept out'}. Start again.`
  if (s.goal === 'chance') {
    if (ok) return `${name} has a chance of ${eqText(mine)}, the chance asked for.`
    return `${name} has a chance of ${eqText(mine)}, not ${targetText(s)}. Try another pair.`
  }
  const most = s.goal === 'most'
  if (ok) {
    const ties = pairsThatFit(s)
      .filter(([a, b]) => !(a === f && b === sec))
      .map(([a, b]) => pairName(s, a, b))
    const tie = ties.length ? ` ${cap(ties.join(' and '))} ties it.` : ''
    return `${name} has a chance of ${eqText(mine)}. No pair is ${most ? 'more' : 'less'} likely.${tie}`
  }
  const beater = drawable(s, back).find(([a, b]) => {
    const o = chanceOf(s, a, b, back)
    return most ? greater(o, mine) : greater(mine, o)
  })
  if (beater) {
    const o = chanceOf(s, beater[0], beater[1], back)
    return `${name} has a chance of ${eqText(mine)}, but ${pairName(s, beater[0], beater[1])} has ${eqText(o)}, which is ${most ? 'more' : 'less'} likely.`
  }
  return `${name} has a chance of ${eqText(mine)}. Try another pair.`
}

export function describe(config: TreeConfig, state: Partial<TreeState> | null | undefined): string {
  if (!ready(config)) return ''
  const s = strict(config)
  const t = readState(state)
  const a = inBag(config, t, 0)
  const b = inBag(config, t, 1)
  const drawn = t.first === null ? 'No counter has been taken out yet.' : `The first counter was ${s.colours[t.first]}${t.back ? ' and went back' : ' and stays out'}.${t.second !== null ? ` The second counter was ${s.colours[t.second]}.` : ''}`
  return `A bag with ${a} ${s.colours[0]} and ${b} ${s.colours[1]} counters in it, and a probability tree for two draws. ${drawn}`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const firstOf_ = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '')
const hasWord = (key: string, words: string[]) => key.split('-').some((w) => words.includes(w))
const num = (v: unknown): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && /^\s*-?\d+(?:\.\d+)?\s*$/.test(v)) return Number(v)
  return Number.NaN
}

function readColours(raw: unknown): string[] {
  if (raw === undefined) return [...DEFAULT_COLOURS]
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\s*(?:,|\band\b|&|\/)\s*/i) : []
  return list.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : String(v)))
}

function readBag(raw: unknown, colours: string[]): number[] {
  if (raw === undefined) return [...DEFAULT_BAG]
  if (Array.isArray(raw)) return raw.map(num)
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return colours.map((c) => num(o[c]))
  }
  return []
}

function readChance(raw: unknown): number[] | undefined {
  if (raw === undefined) return undefined
  if (Array.isArray(raw)) return raw.map(num)
  if (typeof raw === 'string') {
    const m = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
    return m ? [Number(m[1]), Number(m[2])] : [Number.NaN, Number.NaN]
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return [num(o.n ?? o.numerator), num(o.d ?? o.denominator)]
  }
  return [Number.NaN, Number.NaN]
}

function readPair(raw: unknown, colours: string[]): number[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return [-1, -1]
  return raw.map((v) => {
    if (v === 0 || v === 1) return v
    if (typeof v === 'string') {
      const k = colours.indexOf(v.trim().toLowerCase())
      if (k >= 0) return k
      const n = num(v)
      if (n === 0 || n === 1) return n
    }
    return -1
  })
}

function readPut(raw: unknown): string | undefined {
  if (raw === undefined) return undefined
  if (raw === true) return 'back'
  if (raw === false) return 'out'
  const key = keyOf(raw)
  if (hasWord(key, ['out', 'without', 'keep', 'kept', 'stays', 'no'])) return 'out'
  if (hasWord(key, ['back', 'replace', 'replaced', 'replacement', 'return', 'returned', 'with', 'independent'])) return 'back'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}

function readGoal(raw: unknown): string | undefined {
  if (raw === undefined) return undefined
  const key = keyOf(raw)
  if (hasWord(key, ['least', 'lowest', 'smallest', 'unlikely', 'unlikeliest'])) return 'least'
  if (hasWord(key, ['most', 'highest', 'largest', 'biggest', 'likeliest', 'likely'])) return 'most'
  if (hasWord(key, ['chance', 'probability', 'target', 'match'])) return 'chance'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}

export const EXAMPLES: { prompt: string; config: TreeConfig }[] = [
  {
    prompt: 'Take two counters out, one at a time, and keep them out. Find the pair with a chance of 1/10.',
    config: { kind: 'find', colours: ['red', 'blue'], bag: [3, 2], put: 'out', goal: 'chance', chance: [1, 10] },
  },
  {
    prompt: 'Take two counters out and keep them out. Find a pair that is most likely.',
    config: { kind: 'find', colours: ['green', 'yellow'], bag: [2, 2], put: 'out', goal: 'most' },
  },
  {
    prompt: 'Take a counter, put it back, then take another. Find the pair that is least likely.',
    config: { kind: 'find', colours: ['red', 'blue'], bag: [3, 2], put: 'back', goal: 'least' },
  },
  {
    prompt: 'Take out red, then red. Decide what to do with the first counter so that two reds have a chance of 9/25.',
    config: { kind: 'choose', colours: ['red', 'blue'], bag: [3, 2], chance: [9, 25], pair: [0, 0] },
  },
]
const EX_FIND = JSON.stringify(EXAMPLES[0].config)
const EX_CHOOSE = JSON.stringify(EXAMPLES[3].config)

/** The nearest bag that can be drawn: each count 1 to 6, the total 3 to 9. */
function nearBag(bag: number[]): number[] {
  const b = [0, 1].map((i) => Math.min(6, Math.max(1, Math.round(Number.isFinite(bag[i]) ? bag[i] : 3))))
  while (b[0] + b[1] > 9) b[b[0] >= b[1] ? 0 : 1]--
  while (b[0] + b[1] < 3) b[b[0] <= b[1] ? 0 : 1]++
  return b
}

const validChance = (c: number[] | undefined) => !!c && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1]) && c[0] > 0 && c[0] < c[1] && c[1] <= 100

export function faults(config: TreeConfig): string[] {
  if (config.kind !== 'find' && config.kind !== 'choose') {
    return [`Only two tasks are built: find a pair that fits a goal (${EX_FIND}) and choose whether the first counter goes back (${EX_CHOOSE}), not "${config.kind}". Use ${EX_FIND}.`]
  }
  const out: string[] = []
  const cs = config.colours
  if (!Array.isArray(cs) || cs.length !== 2 || cs.some((c) => !COLOURS.includes(c as Colour)) || cs[0] === cs[1]) {
    out.push(`The two counters need two different colours from red, blue, green and yellow, not ${JSON.stringify(cs)}: use "colours":["red","blue"].`)
  }
  const bag = config.bag
  if (!Array.isArray(bag) || bag.length !== 2 || bag.some((n) => !Number.isInteger(n) || n < 1 || n > 6) || bag[0] + bag[1] < 3 || bag[0] + bag[1] > 9) {
    out.push(`Each colour needs 1 to 6 counters and the bag 3 to 9 in all, not ${JSON.stringify(bag)}: use "bag":${JSON.stringify(nearBag(Array.isArray(bag) ? bag : []))}.`)
  }
  if (config.kind === 'find') {
    if (config.pair !== undefined) out.push(`A find task cannot give the pair, because the pair is the answer: drop "pair", e.g. ${EX_FIND}.`)
    if (config.put !== 'out' && config.put !== 'back') out.push(`"put" is "out" or "back", not "${config.put}": use "put":"out".`)
    if (config.goal !== 'chance' && config.goal !== 'most' && config.goal !== 'least') out.push(`"goal" is "chance", "most" or "least", not "${config.goal}": use "goal":"chance".`)
    if (config.goal === 'chance' && !validChance(config.chance)) out.push(`A chance goal needs "chance":[n,d] with whole numbers and 0 < n < d <= 100, not ${JSON.stringify(config.chance)}: use "chance":[1,10].`)
  } else {
    if (config.put !== undefined) out.push(`A choose task decides the handling itself, so it takes no "put": drop it, e.g. ${EX_CHOOSE}.`)
    if (config.goal === 'most' || config.goal === 'least') out.push(`A choose task aims at a chance, not "${config.goal}": use ${EX_CHOOSE}.`)
    if (config.chance === undefined || config.pair === undefined) out.push(`A choose task needs both "chance" and "pair": use ${EX_CHOOSE}.`)
    else {
      if (!validChance(config.chance)) out.push(`"chance" needs whole numbers with 0 < n < d <= 100, not ${JSON.stringify(config.chance)}: use "chance":[9,25].`)
      if (!Array.isArray(config.pair) || config.pair.length !== 2 || config.pair.some((p) => p !== 0 && p !== 1)) out.push(`"pair" is two picks, each 0 (the first colour) or 1 (the second), not ${JSON.stringify(config.pair)}: use "pair":[0,0].`)
    }
  }
  if (out.length) return out

  const s = strict(config)
  if (s.kind === 'find') {
    const back = s.put === 'back'
    const pool = drawable(s, back)
    if (s.goal === 'chance') {
      const target = { n: s.chance![0], d: s.chance![1] }
      const hit = pool.filter(([f, sec]) => sameFrac(chanceOf(s, f, sec, back), target))
      if (hit.length === 0) {
        const alt = drawable(s, !back).some(([f, sec]) => sameFrac(chanceOf(s, f, sec, !back), target))
        const near = simple(chanceOf(s, pool[0][0], pool[0][1], back))
        return [`No pair can be drawn with a chance of ${fracText(target)} when the first counter is ${back ? 'put back' : 'kept out'}: use ${alt ? `"put":"${back ? 'out' : 'back'}"` : `"chance":[${near.n},${near.d}]`}.`]
      }
      if (hit.length === pool.length) return [`Every pair that can be drawn has a chance of ${fracText(target)}, so there is nothing to find: use a bag like [3,2] with "chance":[1,10].`]
    } else {
      const chances = pool.map(([f, sec]) => chanceOf(s, f, sec, back))
      if (chances.every((c) => sameFrac(c, chances[0]))) return [`Every pair that can be drawn is equally likely, so no pair is ${s.goal === 'most' ? 'most' : 'least'} likely: use a bag like [3,1] or [3,2].`]
    }
    return []
  }
  const [pf, ps] = s.pair!
  const target = { n: s.chance![0], d: s.chance![1] }
  const outC = chanceOf(s, pf, ps, false)
  const backC = chanceOf(s, pf, ps, true)
  if (!sameFrac(outC, target) && !sameFrac(backC, target)) {
    const a = simple(backC)
    const b = simple(outC)
    return [`${cap(pairName(s, pf, ps))} has a chance of ${a.n}/${a.d} with the first counter put back and ${b.n}/${b.d} kept out, never ${fracText(target)}: use "chance":[${a.n},${a.d}] or "chance":[${b.n},${b.d}].`]
  }
  return []
}

// ---------------------------------------------------------------------------
// Prompts.

const WORKING = [/×/, /\btimes\b/i, /\d\s*[x*]\s*\d/, /\b\d+\s*\/\s*\d+\s*[x×*]/i]
const HANDLING = [/\breplacement\b/i, /\breplace(?:d)?\b/i, /\bput (?:it )?back\b/i, /\bkeep (?:it|them|that) out\b/i, /\bkept out\b/i, /\bstays? out\b/i, /\bgoes back\b/i, /\bgo back\b/i, /\breturn(?:s|ed)?\b/i]

export function promptFaults(config: TreeConfig, prompt: string): string[] {
  const text = prompt.replace(/\s+/g, ' ')
  const found: string[] = []
  const add = (rs: RegExp[]) => rs.forEach((r) => { const m = text.match(r)?.[0]; if (m) found.push(m) })
  add(WORKING)
  if (faults(config).length === 0) {
    const s = strict(config)
    if (s.kind === 'choose') add(HANDLING)
    else {
      const names = `(?:${s.colours.join('|')})`
      add([new RegExp(`\\b${names}s?,?\\s+then\\s+(?:an? )?${names}s?\\b`, 'i'), new RegExp(`\\btwo\\s+${names}s?\\b`, 'i'), new RegExp(`\\bboth\\s+${names}s?\\b`, 'i'), new RegExp(`\\b${names}s?\\s+and\\s+(?:an? )?${names}s?\\b`, 'i')])
      const answers = pairsThatFit(s)
      if (answers.every(([a, b]) => a !== b)) add([/\bone of each\b/i, /\bdifferent colou?rs?\b/i, /\bmixed\b/i])
      if (answers.every(([a, b]) => a === b)) add([/\bsame colou?r\b/i, /\bmatching\b/i, /\bthe same\b/i])
      if (s.goal !== 'chance') {
        const pool = drawable(s, s.put === 'back').map(([f, sec]) => chanceOf(s, f, sec, s.put === 'back'))
        for (const m of text.matchAll(/\b(\d+)\s*\/\s*(\d+)\b/g)) {
          const frac = { n: Number(m[1]), d: Number(m[2]) }
          if (frac.d > 0 && pool.some((p) => sameFrac(p, frac))) found.push(m[0])
        }
      }
    }
  } else {
    add(HANDLING)
  }
  return found.length
    ? [`the prompt gives the answer away with ${[...new Set(found)].map((w) => `"${w}"`).join(', ')}: say only the situation and the gesture, e.g. "${EXAMPLES[0].prompt}"`]
    : []
}

const catalogue = EXAMPLES.map((e, i) => `  ${i === 0 ? '   ' : 'or '}${JSON.stringify(e.config)}  -- the prompt says "${e.prompt}"`).join('\n')

export const treeEngine: SceneEngine<TreeConfig, TreeState> = {
  id: 'tree-diagrams',
  covers: ['tree diagram', 'tree diagrams', 'probability tree', 'probability trees'],
  phrases: [
    'probability tree diagram', 'probability tree diagrams', 'tree diagrams for probability', 'combined events', 'probability of combined events', 'combined probability',
    'probability of two events', 'independent events', 'dependent events', 'independent and dependent events', 'with replacement', 'without replacement',
    'with and without replacement', 'conditional probability', 'conditional probability with trees', 'multiplying probabilities', 'counters in a bag',
  ],
  notFor: [
    'factor tree', 'factor trees', 'family tree', 'family trees', 'evolutionary tree', 'evolutionary trees', 'phylogenetic tree', 'phylogenetic trees', 'decision tree', 'decision trees',
    'binary tree', 'binary trees', 'tree data structure', 'tree of life', 'syntax tree', 'parse tree', 'tree rings', 'sample space diagram', 'sample space diagrams', 'Venn diagram',
    'Venn diagrams', 'relative frequency', 'two-way table', 'two-way tables',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const o = raw as Record<string, unknown>
    const colours = readColours(firstOf_(o, ['colours', 'colors', 'counters']))
    const bag = readBag(firstOf_(o, ['bag', 'counts', 'contents']), colours)
    const putRaw = firstOf_(o, ['put', 'handling', 'replacement'])
    const goalRaw = firstOf_(o, ['goal', 'aim'])
    const chance = readChance(firstOf_(o, ['chance', 'target', 'probability']))
    const pair = readPair(firstOf_(o, ['pair', 'draw', 'draws']), colours)
    const kindRaw = firstOf_(o, ['kind', 'task', 'type', 'mode'])
    let kind: string
    if (kindRaw !== undefined) {
      const key = keyOf(kindRaw)
      if (hasWord(key, ['choose', 'decide', 'handling', 'choice'])) kind = 'choose'
      else if (hasWord(key, ['find', 'search', 'pair', 'draw', 'goal'])) kind = 'find'
      else kind = String(kindRaw).trim()
    } else kind = pair !== undefined ? 'choose' : 'find'
    const out: TreeConfig = { kind, colours, bag }
    const put = readPut(putRaw)
    const goal = readGoal(goalRaw)
    if (kind === 'find') {
      out.put = put ?? 'out'
      out.goal = goal ?? 'chance'
    } else {
      if (put !== undefined) out.put = put
      if (goal !== undefined) out.goal = goal
    }
    if (chance !== undefined) out.chance = chance
    if (pair !== undefined) out.pair = pair
    return out
  },

  faults,
  promptFaults,

  initial() {
    return { first: null, back: false, second: null, tried: [] }
  },

  check,

  solve(config) {
    const s = strict(config)
    if (s.kind === 'find') {
      const [f, sec] = pairsThatFit(s)[0]
      return { first: f, back: s.put === 'back', second: sec, tried: [] }
    }
    const [pf, ps] = s.pair!
    const target = { n: s.chance![0], d: s.chance![1] }
    const back = sameFrac(chanceOf(s, pf, ps, true), target)
    return { first: pf, back, second: ps, tried: [] }
  },

  View: TreeView,

  prompt: `SCENE "tree-diagrams" -- a cloth bag of two colours of counters beside a probability tree for two draws, with a chance bar from 0 to 1 under it. The learner takes counters out one at a time: each counter lifts out of the bag and lands at the end of its branch, and each branch's fraction is read from what is in the bag at that moment (3/5, then 2/4 when the first stays out, or 3/5 again when it goes back). The bar starts whole and each draw keeps only its share of it, so "a part of a part" is the product along a path. Keeping the first counter out visibly changes the bag, so the second branches change. Marking reveals all four ends of the tree.
  Tasks: "find" (the handling is fixed in the prompt: "put":"out" keeps the first counter out, "put":"back" puts it back; the learner draws pairs until one fits the goal: "goal":"chance" with "chance":[n,d], or "most" or "least" likely) and "choose" (the pair is fixed, "pair":[0,0] with 0 the first colour and 1 the second, "chance":[n,d] is the target, and the learner decides whether the first counter goes back).
  For: tree diagrams, probability trees, combined events, with and without replacement, independent and dependent events, multiplying probabilities. Not drawn: more than two draws, more than two colours, adding end results for "either way" questions, sample space diagrams.
  Before marking the card shows the goal, the handling, the live chance of these draws and a caption, and never says right or wrong. The prompt must say the situation and the gesture, never any working (no "×", "times", "3/5 × 2/4"). For find, do NOT name the answer pair ("red then red", "two blues", "both red", "red and blue"), say "one of each", "mixed" or "different colours" when the answers are mixed pairs, or give a fraction equal to a pair's chance for most/least. For choose, do NOT say whether the first counter goes back ("replacement", "put it back", "keep it out", "kept out", "stays out", "goes back", "return").
  config examples (colours default to red and blue, bag to [3,2]; colours[0] is the upper branch):
${catalogue}
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${EXAMPLES[3].prompt}",
    "payload": { "engine":"tree-diagrams", "config": ${JSON.stringify(EXAMPLES[3].config)} },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:tree-diagrams", "why":"..." } }`,
}

registerEngine(treeEngine as SceneEngine<unknown, unknown>)
