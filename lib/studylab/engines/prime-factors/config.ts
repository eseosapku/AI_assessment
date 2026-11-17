// lib/studylab/engines/prime-factors/config.ts
//
// Prime factorisation as something the learner pulls apart. A factor tree accepts every proper factor pair,
// not just smallest-prime-first; gold endpoints are primes. The second task pairs equal prime tiles one copy at
// a time, then reads the shared product (HCF) or every prime with each shared pair used once (LCM).
// All arithmetic is exact integer arithmetic. The mathematical facts are the Fundamental Theorem of Arithmetic
// and the usual prime-factor HCF/LCM rules (Mathigon, Divisibility and Primes; Cambridge IGCSE 0580).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { PrimeFactorsView } from './View'

export type TreeConfig = { task: 'tree'; number: number }
export type PairConfig = { task: 'pair'; a: number; b: number; find: 'hcf' | 'lcm' }
export type PrimeConfig = TreeConfig | PairConfig

/** A split id is its path from the root: '' then 'l', 'r', 'll', ... . */
export type TreeState = { splits?: Record<string, [number, number]> }
/** For each prime, how many equal pairs have been moved to the middle. */
export type PairState = { paired?: Record<string, number> }
export type PrimeState = TreeState | PairState

export const MIN_NUMBER = 2
export const MAX_NUMBER = 360
export const MAX_PRIMES = 6
export const MAX_SHARED = 4

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false
  if (n % 2 === 0) return n === 2
  for (let d = 3; d * d <= n; d += 2) if (n % d === 0) return false
  return true
}

export function factorPairs(n: number): number[] {
  if (!Number.isInteger(n) || n < 4) return []
  const out: number[] = []
  for (let d = 2; d * d <= n; d++) if (n % d === 0) out.push(d)
  return out
}

export function primeFactors(n: number): number[] {
  const out: number[] = []
  let left = Math.max(0, Math.floor(n))
  for (let p = 2; p * p <= left; p++) {
    while (left % p === 0) { out.push(p); left /= p }
  }
  if (left > 1) out.push(left)
  return out
}

export const product = (factors: number[]) => factors.reduce((p, n) => p * n, 1)
export const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b)

export function countsOf(factors: number[]): Map<number, number> {
  const out = new Map<number, number>()
  for (const p of factors) out.set(p, (out.get(p) ?? 0) + 1)
  return out
}

export function sharedCounts(a: number, b: number): Map<number, number> {
  const aa = countsOf(primeFactors(a))
  const bb = countsOf(primeFactors(b))
  const out = new Map<number, number>()
  for (const [p, n] of aa) if (bb.has(p)) out.set(p, Math.min(n, bb.get(p)!))
  return out
}

export const sharedTotal = (a: number, b: number) => [...sharedCounts(a, b).values()].reduce((s, n) => s + n, 0)

export function indexParts(factors: number[]): { prime: number; power: number }[] {
  return [...countsOf(factors)].sort((a, b) => a[0] - b[0]).map(([prime, power]) => ({ prime, power }))
}

export const expandedText = (factors: number[]) => factors.length ? [...factors].sort((a, b) => a - b).join(' × ') : 'none yet'
export const indexText = (factors: number[]) => indexParts(factors).map(({ prime, power }) => power === 1 ? `${prime}` : `${prime}${superscript(power)}`).join(' × ')
export const superscript = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])

// ---------------------------------------------------------------------------
// Tree state and marking.

export function splitOf(state: TreeState | null | undefined, id: string): [number, number] | null {
  const raw = state?.splits?.[id]
  return Array.isArray(raw) && raw.length === 2 && raw.every((n) => Number.isInteger(n) && n >= 2) ? [raw[0], raw[1]] : null
}

export function nodeNumber(config: TreeConfig, state: TreeState, id: string): number {
  if (id === '') return config.number
  const parent = id.slice(0, -1)
  const pair = splitOf(state, parent)
  if (!pair) return 0
  const n = pair[id.endsWith('l') ? 0 : 1]
  return nodeNumber(config, state, parent) === pair[0] * pair[1] ? n : 0
}

export type TreeNode = { id: string; n: number; depth: number; children: [string, string] | null }
export function treeNodes(config: TreeConfig, state: TreeState): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (id: string, depth: number) => {
    const n = nodeNumber(config, state, id)
    if (!n) return
    const pair = splitOf(state, id)
    const valid = pair && pair[0] * pair[1] === n && pair.every((v) => v >= 2 && v < n) ? pair : null
    out.push({ id, n, depth, children: valid ? [id + 'l', id + 'r'] : null })
    if (valid) { walk(id + 'l', depth + 1); walk(id + 'r', depth + 1) }
  }
  walk('', 0)
  return out
}

export function treeLeaves(config: TreeConfig, state: TreeState): TreeNode[] {
  return treeNodes(config, state).filter((n) => !n.children)
}

export const remainingComposites = (config: TreeConfig, state: TreeState) => treeLeaves(config, state).filter((n) => !isPrime(n.n))
export const treeDone = (config: TreeConfig, state: TreeState) => remainingComposites(config, state).length === 0 && treeLeaves(config, state).length > 1

/** A canonical solution: split off the smallest prime each time. */
export function solvedTree(n: number): TreeState {
  const splits: Record<string, [number, number]> = {}
  const walk = (id: string, value: number) => {
    if (isPrime(value)) return
    const p = factorPairs(value)[0]
    splits[id] = [p, value / p]
    walk(id + 'l', p)
    walk(id + 'r', value / p)
  }
  walk('', n)
  return { splits }
}

// ---------------------------------------------------------------------------
// Pair state and marking.

export function pairedOf(config: PairConfig, state: PairState): Map<number, number> {
  const allowed = sharedCounts(config.a, config.b)
  const out = new Map<number, number>()
  for (const [p, max] of allowed) {
    const raw = state?.paired?.[String(p)]
    const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(max, Math.floor(raw))) : 0
    if (n) out.set(p, n)
  }
  return out
}

export const pairedProduct = (config: PairConfig, state: PairState) => product([...pairedOf(config, state)].flatMap(([p, n]) => Array.from({ length: n }, () => p)))
export const lcmAt = (config: PairConfig, state: PairState) => (config.a * config.b) / pairedProduct(config, state)
export const pairDone = (config: PairConfig, state: PairState) => sharedTotal(config.a, config.b) === [...pairedOf(config, state).values()].reduce((s, n) => s + n, 0)

export function solvedPairs(config: PairConfig): PairState {
  return { paired: Object.fromEntries(sharedCounts(config.a, config.b)) }
}

// ---------------------------------------------------------------------------
// What marking says. Before marking only the learner's current products are shown.

export function working(config: PrimeConfig, state: PrimeState): string {
  if (config.task === 'tree') {
    const leaves = treeLeaves(config, state as TreeState).map((n) => n.n)
    return `Yes. ${config.number} = ${expandedText(leaves)} = ${indexText(leaves)}. Every route to the leaves gives these same primes, in whatever order you write them.`
  }
  const paired = pairedOf(config, state as PairState)
  const shared = [...paired].flatMap(([p, n]) => Array.from({ length: n }, () => p))
  if (config.find === 'hcf') return `Yes. HCF(${config.a}, ${config.b}) = ${pairedProduct(config, state as PairState)}. Multiply the shared primes: ${expandedText(shared)}.`
  return `Yes. LCM(${config.a}, ${config.b}) = ${lcmAt(config, state as PairState)}. Use each shared pair once, and all the primes left in the two rows.`
}

export function madeText(config: PrimeConfig, state: PrimeState): string {
  if (config.task === 'tree') {
    const left = remainingComposites(config, state as TreeState)
    if (!left.length) return 'This tree has nothing to split.'
    const primes = treeLeaves(config, state as TreeState).filter((n) => isPrime(n.n)).map((n) => n.n)
    return `Prime leaves so far: ${expandedText(primes)}. ${left.map((n) => n.n).join(' and ')} ${left.length === 1 ? 'is' : 'are'} still composite, so split ${left.length === 1 ? 'it' : 'them'} again.`
  }
  const made = pairedOf(config, state as PairState)
  const wanted = sharedCounts(config.a, config.b)
  const missing = [...wanted].flatMap(([p, n]) => Array.from({ length: n - (made.get(p) ?? 0) }, () => p))
  const pairs = [...made.values()].reduce((s, n) => s + n, 0)
  if (!pairs) return 'No matching primes are paired yet. Tap one prime in each row to move an equal pair into the middle.'
  return `You made ${pairs} ${pairs === 1 ? 'pair' : 'pairs'}. ${expandedText(missing)} can still be matched in both rows.`
}

// ---------------------------------------------------------------------------
// Broad semantic reading; faults refuses only numbers the picture cannot hold.

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const keyOf = (raw: unknown) => typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[‐‑‒–—−]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''
function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string' && raw.trim()) {
    const m = raw.trim().replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
    if (m) return Number(m[0])
  }
  return null
}

const TREE_WORDS = ['tree', 'factor-tree', 'factor-trees', 'prime-tree', 'split', 'factorise', 'factorize', 'factorisation', 'factorization', 'prime-factorisation', 'prime-factorization', 'prime-factors', 'product-of-primes', 'index-form', 'decompose', 'decomposition']
const PAIR_WORDS = ['pair', 'pairs', 'pair-primes', 'venn', 'hcf-lcm', 'hcf', 'lcm', 'highest-common-factor', 'lowest-common-multiple', 'least-common-multiple', 'gcf', 'gcd']

function goodPrompt(config: PrimeConfig): string {
  if (config.task === 'tree') return `Tap a composite tile, choose a factor with − and +, then press Split. Break ${config.number} into primes.`
  return `Tap a prime in the ${config.a} row, then an equal prime in the ${config.b} row. Pair all the shared primes to find the ${config.find.toUpperCase()}.`
}

function rangeFault(n: number, label: string, example: number): string[] {
  if (!Number.isInteger(n)) return [`${label} must be a whole number: use e.g. ${example}.`]
  if (n < MIN_NUMBER || n > MAX_NUMBER) return [`${label} ${n} is outside the drawable range ${MIN_NUMBER} to ${MAX_NUMBER}: use e.g. ${example}.`]
  if (primeFactors(n).length > MAX_PRIMES) return [`${label} ${n} has more than ${MAX_PRIMES} prime factors, too many tiles for the card: use e.g. ${example}.`]
  return []
}

export const primeFactorsEngine: SceneEngine<PrimeConfig, PrimeState> = {
  id: 'prime-factors',
  // Distinctive phrases only: a bare "factors", "product", "number" or "square" would catch unrelated stations.
  covers: ['prime factorisation', 'prime factorization', 'prime factors', 'factor trees', 'HCF', 'LCM'],
  phrases: [
    'prime factor', 'prime factors', 'factor tree', 'factor trees', 'product of prime factors', 'product of its prime factors',
    'prime decomposition', 'prime factor decomposition', 'express as a product of primes', 'highest common factor', 'highest common factors',
    'lowest common multiple', 'lowest common multiples', 'least common multiple', 'least common multiples', 'HCF and LCM', 'LCM and HCF',
    'HCF from prime factors', 'LCM from prime factors', 'shared prime factors', 'repeated division by primes',
  ],
  notFor: [
    'sets and Venn diagrams', 'set notation', 'union and intersection', 'Venn diagram of numbers', 'algebraic factorisation', 'algebraic factorization',
    'factorising algebraic expressions', 'factorizing algebraic expressions', 'factorise quadratics', 'factorize quadratics', 'place value', 'number sequences',
    'prime number sequences', 'prime gaps', 'distribution of primes', 'sieve of Eratosthenes', 'square roots from prime factors', 'cube roots from prime factors',
  ],
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    const a = readNumber(first(src, ['a', 'first', 'numberA', 'firstNumber', 'left']))
    const b = readNumber(first(src, ['b', 'second', 'numberB', 'secondNumber', 'right']))
    const number = readNumber(first(src, ['number', 'n', 'value', 'target', 'of']))
    const pairShape = a !== null && b !== null
    const task = PAIR_WORDS.includes(word) || (word === 'common' && pairShape) ? 'pair'
      : TREE_WORDS.includes(word) ? 'tree'
        : pairShape ? 'pair' : word === '' && number !== null ? 'tree' : null
    if (task === 'pair') {
      if (a === null || b === null) return null
      const findRaw = keyOf(first(src, ['find', 'goal', 'ask', 'result']) ?? (word === 'lcm' || word === 'lowest-common-multiple' || word === 'least-common-multiple' ? 'lcm' : 'hcf'))
      if (!['hcf', 'lcm', 'highest-common-factor', 'lowest-common-multiple', 'least-common-multiple', 'gcf', 'gcd', 'both'].includes(findRaw)) return null
      // "both" uses the same pairing act and reads the LCM; a second card can ask HCF.
      const find = findRaw === 'lcm' || findRaw === 'lowest-common-multiple' || findRaw === 'least-common-multiple' || findRaw === 'both' ? 'lcm' : 'hcf'
      return { task, a, b, find }
    }
    if (task === 'tree') return number === null ? null : { task, number }
    return null
  },

  faults(config) {
    if (config.task === 'tree') {
      const range = rangeFault(config.number, 'number', 360)
      if (range.length) return range
      if (isPrime(config.number)) return [`${config.number} is already prime, so there is nothing to split: use a composite number such as 360.`]
      return []
    }
    const out = [...rangeFault(config.a, 'a', 84), ...rangeFault(config.b, 'b', 180)]
    if (out.length) return out
    if (config.a === config.b) return [`The numbers are both ${config.a}, so every tile pairs immediately with no comparison to make: use e.g. a 84 and b 180.`]
    if (sharedTotal(config.a, config.b) === 0) return [`${config.a} and ${config.b} share no prime factors, so there are no pairs to make: use e.g. a 84 and b 180.`]
    if (sharedTotal(config.a, config.b) > MAX_SHARED) return [`The numbers share more than ${MAX_SHARED} prime tiles, too many for the middle row: use e.g. a 84 and b 180.`]
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'tree') {
      const primes = primeFactors(config.number)
      const expanded = expandedText(primes).replace(/[×^]/g, '.?')
      const givesProduct = new RegExp(expanded, 'i').test(text) || new RegExp(`${config.number}\\s*=\\s*\\d+\\s*[×x*]`, 'i').test(text) || /\b\d+\s*(?:\^|²|³|⁴|⁵|⁶)\s*[×x*]/i.test(text)
      if (givesProduct) out.push(`the prompt gives the prime factorisation away, which the learner is to build: name only the number and the splitting gesture ("${example}")`)
    } else {
      const answer = config.find === 'hcf' ? gcd(config.a, config.b) : (config.a * config.b) / gcd(config.a, config.b)
      const answerSaid = new RegExp(`\\b(?:HCF|LCM|highest common factor|lowest common multiple|least common multiple)\\b[^.!?]{0,35}\\b${answer}\\b|\\b${answer}\\b[^.!?]{0,35}\\b(?:HCF|LCM)\\b`, 'i').test(text)
      const shared = [...sharedCounts(config.a, config.b)].flatMap(([p, n]) => Array.from({ length: n }, () => p))
      const sharedSaid = new RegExp(`shared[^.!?]*${expandedText(shared).replace(/×/g, '[×x*]')}`, 'i').test(text)
      if (answerSaid || sharedSaid) out.push(`the prompt gives the ${config.find.toUpperCase()} or its shared primes away: name the two numbers and the pairing gesture only ("${example}")`)
    }
    if (/\bdrag\b|\bdrop\b|\btype (?:the )?answer\b|\bwrite (?:the )?answer\b|\bthree (?:numbers|integers)\b|\bsquare roots?\b|\bcube roots?\b|\bbuses\b|\btiles? (?:the )?(?:floor|room|wall)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it uses taps, steppers and a Split button, with no typing, dragging, three-number HCF/LCM, roots or word-problem scene ("${example}")`)
    }
    return out
  },

  initial(config) { return config.task === 'tree' ? { splits: {} } : { paired: {} } },

  check(config, state) {
    if (config.task === 'tree') {
      const left = remainingComposites(config, state as TreeState)
      return { ok: treeDone(config, state as TreeState), wrongIds: left.map((n) => n.id || 'root') }
    }
    const made = pairedOf(config, state as PairState)
    const wanted = sharedCounts(config.a, config.b)
    return { ok: pairDone(config, state as PairState), wrongIds: [...wanted].filter(([p, n]) => made.get(p) !== n).map(([p]) => String(p)) }
  },

  solve(config) { return config.task === 'tree' ? solvedTree(config.number) : solvedPairs(config) },
  View: PrimeFactorsView,

  prompt: `SCENE "prime-factors" -- prime factorisation on a quiet light panel, with flat crafted number tiles. Gold tiles are prime and cannot split again; pale blue tiles are composite. Everything changes immediately with the learner's move, and reduced motion shows the same new still frame without movement.
  tree: the learner taps a composite tile, chooses any proper factor with small − / + steppers, and presses Split. Two branches grow and the factor tiles move apart; selecting another composite continues that branch. Every valid factor pair is accepted, not just smallest-prime-first. The card shows the current prime leaves and, once complete, their expanded and index-form products. It holds back the finished factorisation until the learner makes it; marking says it and that every route gives the same primes. number: a composite integer from 4 to 360 with at most 6 prime factors, e.g. 360 = 2³ × 3² × 5 (do not put that factorisation in the learner's prompt).
  pair: two rows show every prime factor of a and b, including repeats. The learner taps a tile in one row and an equal tile in the other; both visibly move to a shared-pair row in the middle. Tap a middle tile to unpair. A live product answers: shared product for HCF, or all primes with each shared pair once for LCM. a and b: integers 2 to 360, at most 6 prime factors each, different, sharing 1 to 4 prime tiles. find: "hcf" or "lcm". Marking names the exact answer and the prime rule; when wrong it says which primes still match.
  For: factor trees, writing a number as a product of prime factors, repeated primes and index form, uniqueness of prime factorisation, HCF and LCM from prime factors and shared-prime Venn reasoning. Not for general set Venn diagrams, algebraic factorisation, place value, number sequences, prime distribution, roots, three-number HCF/LCM or animated bus/tile word problems.
  Prompts must say the gesture and goal but never give the tree's prime product, a completed index form, the HCF/LCM value, or the list of shared primes. No dragging or answer typing.
  config: { "task":"tree", "number":360 }  -- prompt "Tap a composite tile, choose a factor with − and +, then press Split. Break 360 into primes."
       or { "task":"tree", "number":84 }  -- the same prompt with 84
       or { "task":"pair", "a":84, "b":180, "find":"hcf" }  -- prompt "Tap a prime in the 84 row, then an equal prime in the 180 row. Pair all the shared primes to find the HCF."
       or { "task":"pair", "a":84, "b":180, "find":"lcm" }  -- the same prompt ending LCM
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a composite tile, choose a factor with − and +, then press Split. Break 360 into primes.",
    "payload": { "engine":"prime-factors", "config": { "task":"tree", "number":360 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:prime-factors", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a composite tile, choose a factor with − and +, then press Split. Break 84 into primes.",
    "payload": { "engine":"prime-factors", "config": { "task":"tree", "number":84 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:prime-factors", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a prime in the 84 row, then an equal prime in the 180 row. Pair all the shared primes to find the HCF.",
    "payload": { "engine":"prime-factors", "config": { "task":"pair", "a":84, "b":180, "find":"hcf" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:prime-factors", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a prime in the 84 row, then an equal prime in the 180 row. Pair all the shared primes to find the LCM.",
    "payload": { "engine":"prime-factors", "config": { "task":"pair", "a":84, "b":180, "find":"lcm" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:prime-factors", "why":"..." } }`,
}

registerEngine(primeFactorsEngine as SceneEngine<unknown, unknown>)
