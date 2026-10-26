// lib/studylab/engines/counters-place-value/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CountersPlaceValueView } from './View'

/**
 * Place value with base-ten blocks, for whole numbers to 999: flats (hundreds),
 * rods (tens) and unit cubes (ones) in their columns on a place-value mat. The
 * learner adds and takes away blocks and exchanges ten of one kind for one of
 * the next, and back; the engine counts every column and marks the result.
 *
 * What it teaches, from the Cambridge Primary Mathematics curriculum framework
 * (0096, from 2020), Number, stages 1 to 4: composing, decomposing and
 * regrouping numbers -- from 10 to 20 at stage 1, 2-digit numbers "using tens
 * and ones" at stage 2, 3-digit numbers "using hundreds, tens and ones" at
 * stage 3 -- and adding and subtracting whole numbers with regrouping.
 *
 * There are no facts to look up: base ten is the whole model (ten ones are one
 * ten, ten tens are one hundred), and every count is a whole number, so all
 * marking is exact integer arithmetic.
 */

/** 0 hundreds, 1 tens, 2 ones: the columns, left to right. */
export type Place = 0 | 1 | 2
export const PLACES: readonly Place[] = [0, 1, 2]
/** How many flats, rods and unit cubes: [hundreds, tens, ones]. */
export type Blocks = [number, number, number]

export const KINDS = ['make', 'add', 'subtract', 'exchange'] as const
export type Kind = (typeof KINDS)[number]
/** make: "fewest" is marked right only in standard form (47 = 4 tens, 7 ones); "any" takes any blocks worth the number. */
export type Way = 'fewest' | 'any'

export type CountersTask =
  | { kind: 'make'; number: number; way: Way }
  | { kind: 'add'; numbers: [number, number] }
  | { kind: 'subtract'; numbers: [number, number] }
  | { kind: 'exchange'; number: number; hundreds?: number; tens?: number }
export type CountersConfig = { task: CountersTask }

/**
 * `mat`: the blocks on the mat -- make, exchange, and add or subtract once the
 * numbers are put together. `parts`: add's two numbers as built, subtract's
 * one, before that. `joined`: put together (add), or taking away has begun
 * (subtract). `taken`: what subtract has taken away.
 */
export type CountersState = { mat: Blocks; parts?: Blocks[]; joined?: boolean; taken?: Blocks }

/** The largest number on the mat: it has no thousands column. */
export const MAX = 999
/**
 * The most blocks a column of the mat holds: nine flats (999 needs no more),
 * and 29 rods or cubes -- three rows of ten, room for one or two exchanges ("52 is 4 tens and 12 ones",
 * or 3 tens and 22 ones). The view shows three full rows cleanly at the card's width.
 */
export const CAP: Blocks = [9, 29, 29]
/**
 * add, once put together, keeps a column to 19: every total it asks for is 20 or more, so no column's
 * count can ever be the total -- breaking every ten of 18 + 5 into ones would otherwise count out 23.
 */
export const ADD_CAP: Blocks = [9, 19, 19]
/** While a number is built for adding or subtracting, a column holds 0 to 9, as in a written number. */
export const BUILD_CAP = 9

const ZERO: Blocks = [0, 0, 0]
const SIZE = [100, 10, 1] as const

export const valueOf = (b: Blocks): number => 100 * b[0] + 10 * b[1] + b[2]
export const standard = (n: number): Blocks => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10]
/** Every column 0 to 9: the fewest blocks for its value, and the way the number is written. */
export const isStandard = (b: Blocks): boolean => b.every((c) => c <= 9)
export const sameBlocks = (a: Blocks, b: Blocks): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
const plus = (a: Blocks, b: Blocks): Blocks => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const copy = (b: Blocks): Blocks => [b[0], b[1], b[2]]

const NAMES: [string, string][] = [['hundred', 'hundreds'], ['ten', 'tens'], ['one', 'ones']]
/** "ten" or "tens", by how many. */
export const placeWord = (p: Place, n: number): string => NAMES[p][n === 1 ? 0 : 1]
export const countText = (p: Place, n: number): string => `${n} ${placeWord(p, n)}`

/** "2 hundreds, 3 tens and 14 ones"; empty columns are left out. */
export function blocksText(b: Blocks): string {
  const parts = PLACES.filter((p) => b[p] > 0).map((p) => countText(p, b[p]))
  if (parts.length === 0) return 'no blocks'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

const MINUS = '−'

// ---------------------------------------------------------------------------
// The task's numbers.

/** The answer add and subtract hide until marked: the total or the difference. */
export function resultOf(task: CountersTask): number | null {
  if (task.kind === 'add') return task.numbers[0] + task.numbers[1]
  if (task.kind === 'subtract') return task.numbers[0] - task.numbers[1]
  return null
}

/** Whether adding needs an exchange: a column (ones or tens) adds up to 10 or more. */
export function addNeedsExchange(a: number, b: number): boolean {
  const x = standard(a)
  const y = standard(b)
  return x[2] + y[2] >= 10 || x[1] + y[1] + (x[2] + y[2] >= 10 ? 1 : 0) >= 10
}

/** Whether subtracting needs a break: some column of the first number has fewer than the second's. */
export function subtractNeedsExchange(a: number, b: number): boolean {
  const x = standard(a)
  const y = standard(b)
  return PLACES.some((p) => x[p] < y[p])
}

/**
 * exchange: the blocks asked for. Hundreds not named stay as usual; with tens
 * named the ones make up the rest, and without, the ones stay as usual and the
 * tens make up the rest ("234 using 1 hundred" is 1 hundred, 13 tens, 4 ones).
 * Null when no blocks are worth the number that way.
 */
export function exchangeTarget(task: Extract<CountersTask, { kind: 'exchange' }>): Blocks | null {
  const n = task.number
  const usual = standard(n)
  const h = task.hundreds ?? usual[0]
  let t: number
  let o: number
  if (task.tens !== undefined) {
    t = task.tens
    o = n - 100 * h - 10 * t
  } else {
    o = usual[2]
    t = (n - 100 * h - o) / 10
  }
  const b: Blocks = [h, t, o]
  return b.every((c) => Number.isInteger(c) && c >= 0) ? b : null
}

/** The blocks a right answer leaves on the mat (make "any": the usual ones, one of many). */
export function targetOf(config: CountersConfig): Blocks | null {
  const task = config.task
  if (task.kind === 'exchange') return exchangeTarget(task)
  if (task.kind === 'make') return standard(task.number)
  return standard(resultOf(task)!)
}

/** The columns the mat shows: hundreds only when the task reaches 100. */
export function placesOf(config: CountersConfig): Place[] {
  const task = config.task
  const top = task.kind === 'add' ? task.numbers[0] + task.numbers[1] : task.kind === 'subtract' ? task.numbers[0] : task.number
  return top >= 100 ? [0, 1, 2] : [1, 2]
}

// ---------------------------------------------------------------------------
// Reading numbers, as the tutor writes them and as a prompt says them.

const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS_WORDS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const PLACE_WORDS: Record<string, Place> = { hundred: 0, hundreds: 0, ten: 1, tens: 1, one: 2, ones: 2 }
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
/** A count of one place a text gives: "4 tens". `whole` is the number when the count is its name ("three hundred"). */
export type Count = { n: number; place: Place; whole?: number }

/**
 * Every number a text says, in digits or words ("38", "sixty-three", "one
 * hundred and four"), and every count of a place it gives ("4 tens", "seven
 * ones", "a hundred").
 */
export function readNumbers(text: string): { numbers: number[]; counts: Count[] } {
  // Punctuation stays as a token of its own, so "three hundred, nineteen" is two numbers; a hyphen between
  // words ("sixty-three") does not, and a thousands comma ("1,000") is dropped.
  const toks = text.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/([a-z])[-‐–]([a-z])/g, '$1 $2')
    .match(/\d+|[a-z]+|[^\sa-z\d]/g) ?? []
  const numbers: number[] = []
  const counts: Count[] = []
  /** Reads "sixty three", "nineteen", "seven" from toks[i]: the value and the next index, or null. */
  const below100 = (i: number): [number, number] | null => {
    const w = toks[i]
    if (w === undefined) return null
    if (own(TENS_WORDS, w)) {
      const u = toks[i + 1]
      return u !== undefined && own(UNITS, u) && UNITS[u] > 0 ? [TENS_WORDS[w] + UNITS[u], i + 2] : [TENS_WORDS[w], i + 1]
    }
    if (own(TEENS, w)) return [TEENS[w], i + 1]
    if (own(UNITS, w)) return [UNITS[w], i + 1]
    return null
  }
  let i = 0
  while (i < toks.length) {
    const w = toks[i]
    let n: number
    let next: number
    let hundredsOnly = false
    if (/^\d+$/.test(w)) {
      n = Number(w)
      next = i + 1
    } else if ((w === 'a' || w === 'an') && toks[i + 1] !== undefined && own(PLACE_WORDS, toks[i + 1])) {
      // "a ten", "a hundred": one of that place.
      counts.push({ n: 1, place: PLACE_WORDS[toks[i + 1]], ...(toks[i + 1] === 'hundred' ? { whole: 100 } : {}) })
      if (toks[i + 1] === 'hundred') numbers.push(100)
      i += 2
      continue
    } else {
      const head = below100(i)
      if (!head) {
        i++
        continue
      }
      ;[n, next] = head
      if (n >= 1 && n <= 9 && toks[next] === 'hundred') {
        // "three hundred", "three hundred and four", "three hundred four".
        n *= 100
        next++
        hundredsOnly = true
        const skip = toks[next] === 'and' ? next + 1 : next
        const rest = below100(skip)
        if (rest && rest[0] > 0) {
          n += rest[0]
          next = rest[1]
          hundredsOnly = false
        }
      }
    }
    numbers.push(n)
    if (hundredsOnly) counts.push({ n: n / 100, place: 0, whole: n })
    else if (toks[next] !== undefined && own(PLACE_WORDS, toks[next])) {
      counts.push({ n, place: PLACE_WORDS[toks[next]] })
      next++
    }
    i = next
  }
  return { numbers, counts }
}

/** A whole number from 0 to 999 as the tutor writes it: 47, "47", "forty-seven". */
function readWhole(raw: unknown): number | null {
  let v: number | null = null
  if (typeof raw === 'number') v = raw
  else if (typeof raw === 'string') {
    const s = raw.trim()
    if (/^\d{1,4}$/.test(s)) v = Number(s)
    else {
      const read = readNumbers(s)
      v = read.numbers.length === 1 && s.split(/\s+/).length <= 6 ? read.numbers[0] : null
    }
  }
  return v !== null && Number.isInteger(v) && v >= 0 && v <= MAX ? v : null
}

const slug = (raw: string) => raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-')

const KIND_WORDS: Record<string, Kind> = {
  'make': 'make', 'make-number': 'make', 'make-a-number': 'make', 'build': 'make', 'build-number': 'make', 'show-number': 'make',
  'add': 'add', 'addition': 'add', 'adding': 'add', 'add-with-regrouping': 'add', 'add-with-exchange': 'add', 'add-and-regroup': 'add',
  'subtract': 'subtract', 'subtraction': 'subtract', 'subtracting': 'subtract', 'take-away': 'subtract', 'takeaway': 'subtract',
  'subtract-with-regrouping': 'subtract', 'subtract-with-exchange': 'subtract',
  'exchange': 'exchange', 'exchanging': 'exchange', 'another-way': 'exchange', 'show-another-way': 'exchange', 'regroup': 'exchange',
  'rename': 'exchange', 'partition': 'exchange',
}

function readKind(raw: unknown): Kind | null {
  if (typeof raw !== 'string') return null
  const key = slug(raw)
  return own(KIND_WORDS, key) ? KIND_WORDS[key] : null
}

/** "fewest", "fewest blocks", "standard"; "any", "any way". Unsaid is fewest. */
function readWay(t: Record<string, unknown>): Way | null {
  if (typeof t.fewest === 'boolean') return t.fewest ? 'fewest' : 'any'
  const raw = t.way ?? t.blocks
  if (raw === undefined) return 'fewest'
  if (typeof raw !== 'string') return null
  const key = slug(raw)
  if (['fewest', 'fewest-blocks', 'least', 'standard', 'usual'].includes(key)) return 'fewest'
  if (['any', 'any-way', 'anyway', 'any-blocks'].includes(key)) return 'any'
  return null
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

/** add and subtract name two numbers: `numbers: [a, b]`, or `a` and `b`. */
function readPair(t: Record<string, unknown>): [number, number] | null {
  const list = Array.isArray(t.numbers) ? t.numbers : null
  const raw = list ? (list.length === 2 ? list : null) : [first(t, ['a', 'first', 'from']), first(t, ['b', 'second', 'take'])]
  if (!raw) return null
  const a = readWhole(raw[0])
  const b = readWhole(raw[1])
  return a !== null && b !== null && a >= 1 && b >= 1 ? [a, b] : null
}

/** A count of blocks the tutor asks for, 0 to 99; undefined when unsaid. Null for one that cannot be read. */
function readCount(raw: unknown): number | undefined | null {
  if (raw === undefined) return undefined
  const v = readWhole(raw)
  return v !== null && v <= 99 ? v : null
}

// ---------------------------------------------------------------------------
// Moves: everything the learner can do, as pure functions the view and the tests share.

export type Move =
  /** Add a block: to the mat (make), or to a number being built (add, subtract; `row` says which). */
  | { kind: 'add'; place: Place; row?: number }
  | { kind: 'remove'; place: Place; row?: number }
  /** add: put the two numbers together. subtract: start taking away. */
  | { kind: 'join' }
  /** subtract: take a block away from the mat, or put one back. */
  | { kind: 'take'; place: Place }
  | { kind: 'return'; place: Place }
  /** Ten blocks of `place` become one of the place to its left. */
  | { kind: 'bundle'; place: Place }
  /** One block of `place` becomes ten of the place to its right. */
  | { kind: 'break'; place: Place }

export type Moved = { next: CountersState } | { refused: string }

function readBlocks(raw: unknown, cap: number | Blocks): Blocks | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null
  const limit = (p: number) => (typeof cap === 'number' ? cap : cap[p])
  return raw.every((v, p) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= limit(p)) ? [raw[0], raw[1], raw[2]] : null
}

/** The state the engine starts a task from. */
export function startOf(config: CountersConfig): CountersState {
  const task = config.task
  if (task.kind === 'make') return { mat: copy(ZERO) }
  if (task.kind === 'exchange') return { mat: standard(task.number) }
  if (task.kind === 'add') return { mat: copy(ZERO), parts: [copy(ZERO), copy(ZERO)], joined: false }
  return { mat: copy(ZERO), parts: [copy(ZERO)], joined: false, taken: copy(ZERO) }
}

/** A saved state read safely: anything it cannot read is as at the start. */
export function readState(config: CountersConfig, raw: unknown): CountersState {
  const start = startOf(config)
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const mat = readBlocks(r.mat, CAP) ?? start.mat
  if (!start.parts) return { mat }
  const list = Array.isArray(r.parts) && r.parts.length === start.parts.length ? r.parts.map((p) => readBlocks(p, BUILD_CAP)) : null
  const parts = list && list.every((p): p is Blocks => p !== null) ? list : start.parts
  const out: CountersState = { mat, parts, joined: r.joined === true }
  if (start.taken) out.taken = readBlocks(r.taken, CAP) ?? copy(ZERO)
  return out
}

/** Whether the numbers being built are the ones asked for. */
export function partsReady(config: CountersConfig, s: CountersState): boolean {
  const task = config.task
  if (task.kind !== 'add' && task.kind !== 'subtract') return false
  const parts = s.parts ?? []
  return task.kind === 'add'
    ? parts.length === 2 && valueOf(parts[0]) === task.numbers[0] && valueOf(parts[1]) === task.numbers[1]
    : parts.length === 1 && valueOf(parts[0]) === task.numbers[0]
}

/** Whether the learner is building add's or subtract's numbers, before they are put together. */
export const building = (config: CountersConfig, s: CountersState): boolean =>
  (config.task.kind === 'add' || config.task.kind === 'subtract') && !s.joined

/** Does a move, or says in a child's words why it cannot be done. */
export function apply(config: CountersConfig, raw: unknown, move: Move): Moved {
  const s = readState(config, raw)
  const task = config.task
  const shown = placesOf(config)
  const kind = task.kind
  if ('place' in move && !shown.includes(move.place)) return { refused: 'There is no hundreds column here.' }
  const done = (next: Partial<CountersState>): Moved => ({ next: { ...s, ...next } })

  if (move.kind === 'add' || move.kind === 'remove') {
    const p = move.place
    const name = placeWord(p, 2)
    if (kind === 'make') {
      const mat = copy(s.mat)
      if (move.kind === 'add') {
        if (mat[p] >= CAP[p]) return { refused: `No more room for ${name}.` }
        if (valueOf(mat) + SIZE[p] > MAX) return { refused: 'The mat only goes up to 999.' }
        mat[p]++
      } else {
        if (mat[p] === 0) return { refused: `There are no ${name} to take away.` }
        mat[p]--
      }
      return done({ mat })
    }
    if (!building(config, s)) {
      return { refused: kind === 'subtract' && s.joined ? 'Take blocks away, or swap them.' : 'You can only swap blocks now.' }
    }
    const row = move.row ?? 0
    const parts = (s.parts ?? []).map(copy)
    if (!parts[row]) return { refused: 'There is no such number to build.' }
    if (move.kind === 'add') {
      if (parts[row][p] >= BUILD_CAP) return { refused: `No more room for ${name}.` }
      parts[row][p]++
    } else {
      if (parts[row][p] === 0) return { refused: `There are no ${name} to take away.` }
      parts[row][p]--
    }
    return done({ parts })
  }

  if (move.kind === 'join') {
    if (kind !== 'add' && kind !== 'subtract') return { refused: 'There is nothing to put together.' }
    if (s.joined) return { refused: kind === 'add' ? 'They are together already.' : 'You are taking away already.' }
    if (!partsReady(config, s)) {
      return { refused: kind === 'add' ? `Make ${task.numbers[0]} and ${task.numbers[1]} first.` : `Make ${task.numbers[0]} first.` }
    }
    const parts = s.parts!
    return kind === 'add'
      ? done({ joined: true, mat: plus(parts[0], parts[1]) })
      : done({ joined: true, mat: copy(parts[0]), taken: copy(ZERO) })
  }

  if (move.kind === 'take' || move.kind === 'return') {
    const p = move.place
    if (kind !== 'subtract') return { refused: 'There is nothing to take away here.' }
    if (!s.joined) return { refused: `Make ${task.numbers[0]} first, then take away.` }
    const mat = copy(s.mat)
    const taken = copy(s.taken ?? ZERO)
    if (move.kind === 'take') {
      if (mat[p] === 0) return { refused: `There are no ${placeWord(p, 2)} left to take.` }
      if (taken[p] >= CAP[p]) return { refused: `No more room for ${placeWord(p, 2)}.` }
      mat[p]--
      taken[p]++
    } else {
      if (taken[p] === 0) return { refused: `You have not taken any ${placeWord(p, 2)}.` }
      if (mat[p] >= CAP[p]) return { refused: `No more room for ${placeWord(p, 2)}.` }
      mat[p]++
      taken[p]--
    }
    return done({ mat, taken })
  }

  // bundle and break: the value on the mat stays the same.
  if (building(config, s)) return { refused: kind === 'add' ? 'Put the numbers together first.' : 'Make the number first.' }
  const p = move.place
  const mat = copy(s.mat)
  const room = kind === 'add' ? ADD_CAP : CAP
  if (move.kind === 'bundle') {
    if (p === 0) return { refused: 'There is no thousands column.' }
    const up = (p - 1) as Place
    if (!shown.includes(up)) return { refused: 'There is no hundreds column here.' }
    if (mat[p] < 10) return { refused: `You need 10 ${placeWord(p, 2)} to make 1 ${placeWord(up, 1)}.` }
    if (mat[up] >= room[up]) return { refused: `No more room for ${placeWord(up, 2)}.` }
    mat[p] -= 10
    mat[up]++
    return done({ mat })
  }
  if (p === 2) return { refused: 'A one cannot be broken.' }
  const down = (p + 1) as Place
  if (mat[p] === 0) return { refused: `There is no ${placeWord(p, 1)} to break.` }
  if (mat[down] + 10 > room[down]) return { refused: `No room for 10 more ${placeWord(down, 2)}.` }
  mat[p]--
  mat[down] += 10
  return done({ mat })
}

// ---------------------------------------------------------------------------
// What the learner is told once marked: never before.

/** Marked right: the sentence that names the answer. */
export function saidWhenRight(config: CountersConfig, raw: unknown): { head: string; detail: string } {
  const task = config.task
  const s = readState(config, raw)
  if (task.kind === 'make') {
    return { head: `${task.number}`, detail: `${task.number} is ${blocksText(task.way === 'any' ? s.mat : standard(task.number))}.` }
  }
  if (task.kind === 'exchange') {
    return { head: `${task.number}`, detail: `${task.number} is ${blocksText(exchangeTarget(task) ?? s.mat)}, too.` }
  }
  const [a, b] = task.numbers
  const r = resultOf(task)!
  if (task.kind === 'add') return { head: `${a} + ${b} = ${r}`, detail: `${blocksText(standard(r))}.` }
  const left = standard(r)
  const one = left.filter((c) => c > 0).length === 1 && left.some((c) => c === 1)
  return { head: `${a} ${MINUS} ${b} = ${r}`, detail: `${blocksText(left)} ${one ? 'is' : 'are'} left.` }
}

/** A column with more than 9, said plainly: "You have 13 ones. That is more than 9." */
function tooMany(b: Blocks): string | null {
  const p = PLACES.find((q) => b[q] > 9)
  return p === undefined ? null : `You have ${countText(p, b[p])}. That is more than 9.`
}

/**
 * Marked wrong: what the learner made, in words. For add and subtract it never
 * composes the blocks into a number -- that number would be the answer.
 */
export function saidWhenWrong(config: CountersConfig, raw: unknown): string[] {
  const task = config.task
  const s = readState(config, raw)
  if (task.kind === 'make') {
    const v = valueOf(s.mat)
    if (v === 0) return ['There are no blocks on the mat yet.']
    if (v !== task.number) return [`You made ${v}.`]
    return [`You made ${v} with ${blocksText(s.mat)}.`, tooMany(s.mat) ? `${tooMany(s.mat)} You can use fewer blocks.` : '']
      .filter(Boolean)
  }
  if (task.kind === 'exchange') return [`You made ${task.number} with ${blocksText(s.mat)}.`]
  const [a, b] = task.numbers
  if (!s.joined) {
    if (!partsReady(config, s)) return task.kind === 'add' ? [`Make ${a} and ${b}, then put them together.`] : [`Make ${a}, then take away ${b}.`]
    return task.kind === 'add' ? [`Put ${a} and ${b} together.`] : [`Now take away ${b}.`]
  }
  if (task.kind === 'add') return [`You made ${blocksText(s.mat)}.`, tooMany(s.mat) ?? ''].filter(Boolean)
  const took = valueOf(s.taken ?? ZERO)
  if (took !== b) return [took === 0 ? `You have not taken any away. Take away ${b}.` : `You took away ${took}, not ${b}.`]
  return [`You have ${blocksText(s.mat)} left.`, tooMany(s.mat) ?? ''].filter(Boolean)
}

// ---------------------------------------------------------------------------
// The card's prompt.

/**
 * What a card's prompt would give away: add's total or subtract's difference
 * (in digits or words, or as its tens and ones), the blocks a make task asks
 * the learner to work out, or the count an exchange produces.
 */
export function promptFaults(config: CountersConfig, prompt: string): string[] {
  const task = config.task
  const { numbers, counts } = readNumbers(prompt)
  const out: string[] = []
  /** Counts in the prompt that are the given blocks' own, ignoring any that also describe `but`. */
  const stated = (b: Blocks, but: Blocks[] = []) =>
    counts.filter((c) => c.n > 0 && b[c.place] === c.n && !but.some((x) => x[c.place] === c.n))
  /** The number's place values ("40 and 7"), when every one of two or more is in the prompt. */
  const expanded = (n: number, but: number[] = []) => {
    const parts = standard(n).map((d, p) => d * SIZE[p]).filter((v) => v > 0)
    return parts.length >= 2 && parts.every((v) => numbers.includes(v) && !but.includes(v))
  }

  if (task.kind === 'make') {
    const usual = standard(task.number)
    const said = stated(usual).filter((c) => c.whole !== task.number)
    if (said.length || expanded(task.number)) {
      const what = said.length ? said.map((c) => countText(c.place, c.n)).join(' and ') : `${task.number} as its tens and ones`
      out.push(`The prompt gives the blocks away (${what}), which the learner is to work out from the number: name the number and ask ("Make ${task.number} with the fewest blocks.").`)
    }
  } else if (task.kind === 'exchange') {
    const target = exchangeTarget(task)
    if (target) {
      const found: Place = task.tens !== undefined ? 2 : 1
      if (counts.some((c) => c.place === found && c.n === target[found])) {
        const asked = task.tens !== undefined ? countText(1, task.tens) : countText(0, target[0])
        out.push(`The prompt says ${countText(found, target[found])}, which the learner finds by exchanging: say only how many to use ("Show ${task.number} using ${asked}.").`)
      }
    }
  } else {
    const [a, b] = task.numbers
    const r = resultOf(task)!
    const sign = task.kind === 'add' ? '+' : MINUS
    const said = stated(standard(r), [standard(a), standard(b)])
    if (numbers.includes(r) || said.length || expanded(r, [a, b])) {
      out.push(`The prompt gives the answer away (${a} ${sign} ${b} = ${r}), which the learner finds with the blocks: name the two numbers and ask ("${task.kind === 'add' ? `Add ${a} and ${b}.` : `Take ${b} away from ${a}.`}").`)
    }
  }
  return out
}

// ---------------------------------------------------------------------------

export const countersPlaceValueEngine: SceneEngine<CountersConfig, CountersState> & {
  promptFaults(config: CountersConfig, prompt: string): string[]
} = {
  id: 'counters-place-value',
  covers: [
    'place value', 'tens and ones', 'hundreds, tens and ones', '2-digit and 3-digit numbers', 'partitioning numbers',
    'composing and decomposing numbers', 'regrouping', 'exchanging tens and ones', 'subtraction with regrouping',
  ],
  isolates: 'quantity',

  parse(raw) {
    const task = (raw as { task?: unknown } | null)?.task
    if (!task || typeof task !== 'object') return null
    const t = task as Record<string, unknown>
    const kind = readKind(t.kind)
    if (!kind) return null
    if (kind === 'add' || kind === 'subtract') {
      const numbers = readPair(t)
      return numbers ? { task: { kind, numbers } } : null
    }
    const number = readWhole(first(t, ['number', 'n', 'value', 'target']))
    if (number === null || number < 1) return null
    if (kind === 'make') {
      const way = readWay(t)
      return way ? { task: { kind, number, way } } : null
    }
    const hundreds = readCount(t.hundreds)
    const tens = readCount(t.tens)
    if (hundreds === null || tens === null || (hundreds === undefined && tens === undefined)) return null
    return { task: { kind, number, ...(hundreds !== undefined ? { hundreds } : {}), ...(tens !== undefined ? { tens } : {}) } }
  },

  faults(config) {
    const task = config.task
    if (task.kind === 'make') return []
    if (task.kind === 'add') {
      const [a, b] = task.numbers
      if (a + b > MAX) return [`${a} + ${b} makes more than 999, and the mat has no thousands column: choose two numbers that add up to 999 or less.`]
      // Two numbers of ones put together are counted out as one column: "17 ones" is the total, before any exchange.
      if (a < 10 && b < 10) {
        return [`${a} + ${b} is only ones, so putting them together counts out the total in the ones column before anything is regrouped. Choose a 2-digit number for one of them (such as 18 + 5), or use make with "way":"fewest" for a teen number.`]
      }
      return addNeedsExchange(a, b) ? [] : [
        `${a} + ${b} needs no exchange: no column adds up to 10 or more, so nothing is regrouped. Choose numbers whose ones (or tens) add up to 10 or more, such as 38 + 25.`,
      ]
    }
    if (task.kind === 'subtract') {
      const [a, b] = task.numbers
      if (b >= a) return [`${a} ${MINUS} ${b} leaves ${b === a ? 'nothing' : 'less than nothing'}: choose a second number smaller than the first.`]
      return subtractNeedsExchange(a, b) ? [] : [
        `${a} ${MINUS} ${b} needs no exchange: every column of ${a} has enough to take ${b} away. Choose numbers where a column of the first is smaller than the second's, such as 52 ${MINUS} 17.`,
      ]
    }
    const n = task.number
    const usual = standard(n)
    const target = exchangeTarget(task)
    const asked = [task.hundreds !== undefined ? countText(0, task.hundreds) : '', task.tens !== undefined ? countText(1, task.tens) : '']
      .filter(Boolean).join(' and ')
    const fewer = usual[1] > 0 ? `${countText(1, usual[1] - 1)}` : usual[0] > 0 ? `${countText(0, usual[0] - 1)}` : ''
    const instead = fewer ? ` Ask for one or two fewer than usual, such as ${n} using ${fewer}.` : ''
    if (n < 10) return [`${n} is only ones, so there is no ten to exchange: choose a number of 10 or more.`]
    if (!target) {
      // The named blocks, with the hundreds the engine keeps when none are named, are worth more than the number.
      const h = task.hundreds ?? usual[0]
      const kept = task.tens !== undefined ? blocksText([h, task.tens, 0]) : countText(0, h)
      const name = task.hundreds === undefined && task.tens !== undefined && h > 0
        ? ` Name the hundreds as well (such as "hundreds":${h - 1}), or ask for fewer tens.`
        : instead
      return [`${kept} ${h + (task.tens ?? 0) === 1 ? 'is' : 'are'} already more than ${n}, so ${n} cannot be shown using ${asked}.${name}`]
    }
    if (sameBlocks(target, usual)) return [`${n} using ${asked} is how ${n} is usually made, so nothing is exchanged.${instead}`]
    const over = PLACES.find((p) => target[p] > CAP[p])
    if (over !== undefined) {
      return [`Showing ${n} using ${asked} needs ${countText(over, target[over])}, and a column holds at most ${CAP[over]}.${instead}`]
    }
    return []
  },

  promptFaults,

  initial(config) {
    return startOf(config)
  },

  check(config, raw) {
    const task = config.task
    const s = readState(config, raw)
    let ok: boolean
    if (task.kind === 'make') ok = valueOf(s.mat) === task.number && (task.way === 'any' || isStandard(s.mat))
    else if (task.kind === 'exchange') {
      const target = exchangeTarget(task)
      ok = !!target && sameBlocks(s.mat, target)
    } else if (task.kind === 'add') ok = !!s.joined && isStandard(s.mat) && valueOf(s.mat) === resultOf(task)
    else ok = !!s.joined && isStandard(s.mat) && valueOf(s.mat) === resultOf(task) && valueOf(s.taken ?? ZERO) === task.numbers[1]
    return { ok, wrongIds: [] }
  },

  solve(config) {
    const task = config.task
    if (task.kind === 'make') return { mat: standard(task.number) }
    if (task.kind === 'exchange') return { mat: exchangeTarget(task) ?? standard(task.number) }
    const [a, b] = task.numbers
    if (task.kind === 'add') return { mat: standard(a + b), parts: [standard(a), standard(b)], joined: true }
    return { mat: standard(Math.max(0, a - b)), parts: [standard(a)], joined: true, taken: standard(b) }
  },

  View: CountersPlaceValueView,

  prompt: `SCENE "counters-place-value" -- base-ten blocks on a place-value mat: flats (hundreds), rods (tens) and unit
  cubes (ones), each in its column, for whole numbers to 999 (Cambridge Primary stages 1-4, ages 5-9). The learner
  adds and takes away blocks with big + and - buttons (or the keyboard) and swaps 10 of one kind for 1 of the next
  ("10 ones -> 1 ten") or back ("1 ten -> 10 ones"); each column's count updates as they go. For: place value, tens
  and ones, hundreds tens and ones, partitioning and regrouping, adding and subtracting with an exchange.
  config: { "task": { "kind":"make", "number":<1-999>, "way":"<fewest | any>" } }  -- build the number on an empty
            mat, reading the blocks: its numeral shows only once marked. "fewest" (the default) is right only as 47 = 4 tens and 7 ones; "any"
            takes any blocks worth the number (3 tens and 17 ones)
       or { "task": { "kind":"exchange", "number":<10-999>, "tens":<how many tens to use> } }  -- or "hundreds",
            or both. The engine builds the number the usual way; the learner swaps blocks to show it another way
            (52 using 3 tens is 3 tens and 22 ones). Ask for one or two tens (or hundreds) fewer than usual:
            a column holds at most 29
       or { "task": { "kind":"add", "numbers":[<a>, <b>] } }  -- the learner builds both numbers, puts them
            together and swaps 10 for 1 where a column has 10 or more. Needs a column that adds up to 10 or more,
            one number of 10 or more, and a + b at most 999. The total stays hidden until it is marked
       or { "task": { "kind":"subtract", "numbers":[<a>, <b>] } }  -- a - b: the learner builds a, takes b away,
            and breaks a ten or a hundred where a column is short. Needs a column of a smaller than b's; b < a
  - the prompt names the numbers and asks. It never gives the total or difference, the blocks a make task needs
    ("4 tens and 7 ones"), or the count an exchange produces.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Add 38 and 25 with the blocks.",
    "payload": { "engine":"counters-place-value", "config": { "task": { "kind":"add", "numbers":[38, 25] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:counters-place-value", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Take 17 away from 52.",
    "payload": { "engine":"counters-place-value", "config": { "task": { "kind":"subtract", "numbers":[52, 17] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:counters-place-value", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Make 47 with the fewest blocks.",
    "payload": { "engine":"counters-place-value", "config": { "task": { "kind":"make", "number":47, "way":"fewest" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:counters-place-value", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Show 34 using only 2 tens.",
    "payload": { "engine":"counters-place-value", "config": { "task": { "kind":"exchange", "number":34, "tens":2 } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:counters-place-value", "why":"..." } }`,
}

registerEngine(countersPlaceValueEngine as SceneEngine<unknown, unknown>)
