// lib/studylab/engines/sets-logic/config.ts
//
// Two-set Venn diagrams as four yes/no decisions, not four mysterious shapes.
//   shade  -- tap whole regions until every region where the rule is true is yellow;
//   counts -- split totals for A, B, both and the universal set into the four regions.
//
// The research behind the misconceptions is the supplied digest of Twinkl's GCSE set-notation
// teaching account, Save My Exams (Edexcel/OCR), Third Space Learning's Venn symbols guide,
// Tutopiya's Cambridge IGCSE 0580 notes, AQA Bridging the Gap pocket 5 and an IB examiner report.
// In particular: union means OR and keeps the overlap; complement includes outside both circles;
// a total for A covers A-only and both; and the overlap is counted once in a union.
// The teaching move -- words such as both/either/only/neither before notation -- comes from those
// sources. No code or artwork is copied. Three-set diagrams, subset proofs and probability questions
// are deliberately left out: two clear acts beat a crowded all-purpose notation worksheet.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SetsLogicView } from './View'

export const REGION_IDS = ['a', 'both', 'b', 'outside'] as const
export type RegionId = (typeof REGION_IDS)[number]
export type SetContext = 'sports' | 'numbers'

export type ExprKey =
  | 'A' | 'B' | 'and' | 'or' | 'notA' | 'notB'
  | 'aNotB' | 'notAaB' | 'neither' | 'notBoth'
  | 'notAandNotB' | 'notAorNotB' | 'notAorB' | 'aOrNotB'
  | 'exactlyOne' | 'universal' | 'empty'

export type ShadeConfig = { task: 'shade'; expression: ExprKey; context: SetContext }
export type CountsConfig = {
  task: 'counts'
  context: SetContext
  totalA: number
  totalB: number
  both: number
  universal: number
}
export type SetsConfig = ShadeConfig | CountsConfig
export type SetsState = { shaded?: RegionId[]; counts?: number[] }

export const MAX_TOTAL = 60

/** A region is a pair of answers: in A? in B? Order: A only, both, B only, neither. */
export const MEMBERSHIP: Record<RegionId, readonly [boolean, boolean]> = {
  a: [true, false],
  both: [true, true],
  b: [false, true],
  outside: [false, false],
}

export const REGION_NAMES: Record<RegionId, string> = {
  a: 'only A',
  both: 'both A and B',
  b: 'only B',
  outside: 'neither A nor B',
}

type ExprInfo = { symbol: string; words: string; mask: readonly boolean[] }
export const EXPRESSIONS: Record<ExprKey, ExprInfo> = {
  A: { symbol: 'A', words: 'in A', mask: [true, true, false, false] },
  B: { symbol: 'B', words: 'in B', mask: [false, true, true, false] },
  and: { symbol: 'A ∩ B', words: 'in both A and B (intersection)', mask: [false, true, false, false] },
  or: { symbol: 'A ∪ B', words: 'in A or B, or both (union)', mask: [true, true, true, false] },
  notA: { symbol: 'A′', words: 'not in A (complement of A)', mask: [false, false, true, true] },
  notB: { symbol: 'B′', words: 'not in B (complement of B)', mask: [false, true, false, true] },
  aNotB: { symbol: 'A ∩ B′', words: 'in A but not in B', mask: [true, false, false, false] },
  notAaB: { symbol: 'A′ ∩ B', words: 'in B but not in A', mask: [false, false, true, false] },
  neither: { symbol: '(A ∪ B)′', words: 'not in A or B: neither', mask: [false, false, false, true] },
  notBoth: { symbol: '(A ∩ B)′', words: 'not in both A and B', mask: [true, false, true, true] },
  notAandNotB: { symbol: 'A′ ∩ B′', words: 'not in A and not in B', mask: [false, false, false, true] },
  notAorNotB: { symbol: 'A′ ∪ B′', words: 'not in A or not in B', mask: [true, false, true, true] },
  notAorB: { symbol: 'A′ ∪ B', words: 'not in A, or in B', mask: [false, true, true, true] },
  aOrNotB: { symbol: 'A ∪ B′', words: 'in A, or not in B', mask: [true, true, false, true] },
  exactlyOne: { symbol: '(A ∪ B) ∩ (A ∩ B)′', words: 'in exactly one of A and B', mask: [true, false, true, false] },
  universal: { symbol: 'ℰ', words: 'anywhere in the universal set', mask: [true, true, true, true] },
  empty: { symbol: '∅', words: 'the empty set: no regions', mask: [false, false, false, false] },
}

export const selectedRegions = (expression: ExprKey): RegionId[] =>
  REGION_IDS.filter((_, i) => EXPRESSIONS[expression].mask[i])

export function shadedOf(config: SetsConfig, state: SetsState): RegionId[] {
  const shaded = state?.shaded
  if (config.task !== 'shade' || !Array.isArray(shaded)) return []
  return REGION_IDS.filter((id) => shaded.includes(id))
}

export function expectedCounts(config: CountsConfig): number[] {
  const a = config.totalA - config.both
  const b = config.totalB - config.both
  const outside = config.universal - a - config.both - b
  return [a, config.both, b, outside]
}

/** A safe drawing state; the fixed overlap always agrees with the given total. */
export function countsOf(config: CountsConfig, state: SetsState): number[] {
  const raw = Array.isArray(state?.counts) ? state.counts : []
  return REGION_IDS.map((_, i) => {
    if (i === 1) return config.both
    const n = raw[i]
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_TOTAL ? n : 0
  })
}

const validCount = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_TOTAL
export function countsValid(config: CountsConfig): boolean {
  const expected = expectedCounts(config)
  return [config.totalA, config.totalB, config.both, config.universal].every(validCount) &&
    expected.every(validCount) && expected.some((n, i) => i !== 1 && n > 0)
}

export function done(config: SetsConfig, state: SetsState): boolean {
  if (config.task === 'shade') {
    const made = shadedOf(config, state)
    const wanted = selectedRegions(config.expression)
    return made.length === wanted.length && wanted.every((id) => made.includes(id))
  }
  const made = countsOf(config, state)
  return expectedCounts(config).every((n, i) => made[i] === n)
}

const listRegions = (ids: RegionId[]) => ids.length === 0 ? 'nothing' : ids.map((id) => REGION_NAMES[id]).join(', ')

export function working(config: SetsConfig, state: SetsState): string {
  if (config.task === 'shade') {
    const e = EXPRESSIONS[config.expression]
    const ids = selectedRegions(config.expression)
    return `Yes. ${e.symbol} means ${e.words}. ${ids.length === 4 ? 'All four regions fit.' : `The matching ${ids.length === 1 ? 'region is' : 'regions are'} ${listRegions(ids)}.`}`
  }
  const [a, both, b, outside] = expectedCounts(config)
  const union = a + both + b
  return `Yes. A only = ${config.totalA} − ${both} = ${a}; B only = ${config.totalB} − ${both} = ${b}. In A or B: ${a} + ${both} + ${b} = ${union}, so neither = ${config.universal} − ${union} = ${outside}. The overlap is counted once.`
}

export function madeText(config: SetsConfig, state: SetsState): string {
  if (config.task === 'shade') {
    const made = shadedOf(config, state)
    const wanted = selectedRegions(config.expression)
    const missing = wanted.filter((id) => !made.includes(id))
    const extra = made.filter((id) => !wanted.includes(id))
    const e = EXPRESSIONS[config.expression]
    const detail = missing.length && extra.length
      ? `Missing: ${listRegions(missing)}. Extra: ${listRegions(extra)}.`
      : missing.length ? `Missing: ${listRegions(missing)}.` : extra.length ? `Extra: ${listRegions(extra)}.` : ''
    return `You shaded ${listRegions(made)}. ${detail} ${e.symbol} means ${e.words}.`
  }
  const made = countsOf(config, state)
  const want = expectedCounts(config)
  const opening = `You made A only ${made[0]}, both ${made[1]}, B only ${made[2]} and neither ${made[3]}.`
  if (made[0] !== want[0]) return `${opening} A's total of ${config.totalA} is split between A only and both: those two regions must add to ${config.totalA}.`
  if (made[2] !== want[2]) return `${opening} B's total of ${config.totalB} is split between B only and both: those two regions must add to ${config.totalB}.`
  const union = made[0] + made[1] + made[2]
  return `${opening} A or B has ${union}, counted with the overlap once. That leaves ${config.universal - union} outside both circles.`
}

// ---------------------------------------------------------------------------
// Broad reading of the tutor's semantic config.

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ')
  : ''

function readContext(raw: unknown): SetContext {
  const k = keyOf(raw)
  return /number|integer|even|multiple|1\s*[-–]\s*20/.test(k) ? 'numbers' : 'sports'
}

function readNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string' && raw.trim() !== '') {
    const match = raw.trim().match(/-?\d+(?:\.\d+)?/)
    if (match) return Number(match[0])
  }
  return null
}

type Mask = boolean[]
const andMask = (a: Mask, b: Mask) => a.map((v, i) => v && b[i])
const orMask = (a: Mask, b: Mask) => a.map((v, i) => v || b[i])
const notMask = (a: Mask) => a.map((v) => !v)

/** A tiny set-expression parser. Intersection binds more tightly than union; primes
 * complement the immediately preceding set or bracketed expression. This distinction
 * is exactly what (A ∪ B)′ and A′ ∪ B need, so stripping brackets is not an option. */
function evaluateExpression(source: string): Mask | null {
  const s = source.toLowerCase()
    .replace(/[’′`]/g, "'")
    .replace(/∩/g, ' and ').replace(/∪/g, ' or ')
    .replace(/\b(intersection|intersect)\b/g, ' and ')
    .replace(/\bunion\b/g, ' or ')
    .replace(/\bcomplement of\b/g, ' not ')
    .replace(/\bnot in\b/g, ' not ')
    .replace(/\bboth a and b\b/g, ' a and b ')
    .replace(/\beither a or b(?: or both)?\b/g, ' a or b ')
    .replace(/\ba but not b\b/g, ' a and not b ')
    .replace(/\bb but not a\b/g, ' not a and b ')
    .replace(/\bin\b/g, ' ').replace(/\bset\b/g, ' ')
  const tokens = s.match(/\(|\)|'|\bnot\b|\band\b|\bor\b|\ba\b|\bb\b|ℰ|∅/g)
  if (!tokens) return null
  // No unrecognised characters or words may be silently discarded.
  const residue = s.replace(/\(|\)|'|\bnot\b|\band\b|\bor\b|\ba\b|\bb\b|ℰ|∅/g, '').trim()
  if (residue) return null
  let at = 0
  let orExpr: () => Mask | null
  const unary = (): Mask | null => {
    if (tokens[at] === 'not') { at++; const m = unary(); return m ? notMask(m) : null }
    let m: Mask | null = null
    if (tokens[at] === '(') {
      at++
      m = orExpr()
      if (tokens[at] !== ')') return null
      at++
    } else if (tokens[at] === 'a' || tokens[at] === 'b') {
      m = tokens[at] === 'a' ? [...EXPRESSIONS.A.mask] : [...EXPRESSIONS.B.mask]
      at++
    } else if (tokens[at] === 'ℰ') { at++; m = [true, true, true, true] }
    else if (tokens[at] === '∅') { at++; m = [false, false, false, false] }
    else return null
    if (!m) return null
    while (tokens[at] === "'") { m = notMask(m); at++ }
    return m
  }
  const andExpr = (): Mask | null => {
    let m = unary()
    while (m && tokens[at] === 'and') { at++; const r = unary(); m = r ? andMask(m, r) : null }
    return m
  }
  orExpr = (): Mask | null => {
    let m = andExpr()
    while (m && tokens[at] === 'or') { at++; const r = andExpr(); m = r ? orMask(m, r) : null }
    return m
  }
  const result = orExpr()
  return result && at === tokens.length ? result : null
}

/** Read words and the textbook symbols. Ambiguous strings are not guessed at. */
export function readExpression(raw: unknown): ExprKey | null {
  if (typeof raw !== 'string') return null
  const plain = keyOf(raw).replace(/[’′`]/g, "'").replace(/\s+/g, ' ').trim()
  if (/^(exactly one|exactly one of a and b|one or the other|one or other|a xor b)$/.test(plain)) return 'exactlyOne'
  if (/^(neither|neither a nor b|outside both|outside a and b)$/.test(plain)) return 'neither'
  if (/^(everything|all|universal|universal set|ℰ)$/.test(plain)) return 'universal'
  if (/^(empty|empty set|none|null set|∅)$/.test(plain)) return 'empty'
  if (/^(only a|a only)$/.test(plain)) return 'aNotB'
  if (/^(only b|b only)$/.test(plain)) return 'notAaB'
  // Equivalent rules have equivalent masks, but keep the notation the tutor
  // asked for: A′ ∩ B′ and (A ∪ B)′ are a comparison this card teaches.
  if (/^a\s*'\s*(?:∩|and)\s*b\s*'$/.test(plain)) return 'notAandNotB'
  if (/^a\s*'\s*(?:∪|or)\s*b\s*'$/.test(plain)) return 'notAorNotB'
  const mask = evaluateExpression(raw)
  if (!mask) return null
  const match = (Object.entries(EXPRESSIONS) as [ExprKey, ExprInfo][]).find(([, e]) => e.mask.every((v, i) => v === mask[i]))
  return match?.[0] ?? null
}

const goodCounts = { task: 'counts', context: 'sports', totalA: 12, totalB: 9, both: 4, universal: 30 } as const
const goodShade = { task: 'shade', expression: 'or', context: 'sports' } as const

function goodPrompt(config: SetsConfig): string {
  if (config.task === 'shade') {
    const e = EXPRESSIONS[config.expression]
    return `Tap a region to shade it yellow, and tap again to unshade it. Shade every region for ${e.symbol}: ${e.words}.`
  }
  return `Use the − and + buttons to fill in A only, B only and neither. In ${config.universal}, A has ${config.totalA}, B has ${config.totalB}, and ${config.both} are in both. Count the overlap once.`
}

export const setsLogicEngine: SceneEngine<SetsConfig, SetsState> = {
  id: 'sets-logic',
  covers: ['sets', 'Venn diagrams', 'set notation', 'union', 'intersection', 'complement', 'subsets'],
  phrases: [
    'Venn diagram', 'Venn diagram problems', 'two set Venn diagrams', 'three set Venn diagrams',
    'universal set', 'elements of a set', 'element of a set', 'the empty set', 'shading regions',
    'shade regions', 'complement of a set', 'union and intersection', 'probability from a Venn diagram',
    'probability from Venn diagrams', 'sets and Venn diagrams', 'set language',
  ],
  notFor: [
    'data set', 'data sets', 'sets of data', 'statistical data', 'statistics',
    'set square', 'set squares', 'setting up', 'mindset', 'sets and reps', 'sets and repetitions',
    'logic gate', 'logic gates', 'truth table', 'truth tables', 'boolean algebra', 'boolean logic',
    'logical fallacy', 'logical fallacies', 'argument and logic', 'program logic', 'logic errors',
    'classifying living things', 'dichotomous key', 'dichotomous keys', 'flowchart keys',
    'road intersection', 'road intersections', 'trade union', 'trade unions', 'complementary angles',
    'complementary colours', 'complementary colors', 'integers and rationals', 'rational and irrational numbers',
  ],
  isolates: 'membership',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const taskKey = keyOf(rawTask).replace(/[\s_]+/g, '-')
    const rawExpression = first(src, ['expression', 'rule', 'set', 'shade', 'operation'])
    const rawA = first(src, ['totalA', 'aTotal', 'inA', 'nA', 'a'])
    const rawB = first(src, ['totalB', 'bTotal', 'inB', 'nB', 'b'])
    const rawBoth = first(src, ['both', 'overlap', 'intersection', 'aAndB'])
    const rawAll = first(src, ['universal', 'total', 'universe', 'classTotal', 'nE'])
    const task = /count|total|fill|number/.test(taskKey) ? 'counts'
      : /shade|region|colour|color/.test(taskKey) ? 'shade'
        : rawExpression !== undefined ? 'shade'
          : rawA !== undefined || rawB !== undefined || rawBoth !== undefined || rawAll !== undefined ? 'counts' : null
    if (!task) return null
    const context = readContext(first(src, ['context', 'theme', 'items', 'elements']))
    if (task === 'shade') {
      const expression = readExpression(rawExpression === undefined ? 'A ∪ B' : rawExpression)
      return expression ? { task, expression, context } : null
    }
    const totalA = readNumber(rawA)
    const totalB = readNumber(rawB)
    const both = readNumber(rawBoth)
    const universal = readNumber(rawAll)
    if (totalA === null || totalB === null || both === null || universal === null) return null
    return { task, context, totalA, totalB, both, universal }
  },

  faults(config) {
    if (config.task === 'shade') {
      return config.expression === 'empty'
        ? ['The empty set selects no regions, so an unshaded card would already be solved: use e.g. expression "(A ∪ B)′" to shade neither region instead.']
        : []
    }
    const example = `totalA 12, totalB 9, both 4, universal ${goodCounts.universal}`
    if (![config.totalA, config.totalB, config.both, config.universal].every(validCount)) {
      return [`Every total must be a whole number from 0 to ${MAX_TOTAL}: use e.g. ${example}.`]
    }
    const [a, both, b, outside] = expectedCounts(config)
    if (a < 0 || b < 0) return [`Both cannot exceed the total for A or B: with both ${both}, use e.g. totalA ${Math.max(12, both)} and totalB ${Math.max(9, both)}, or use ${example}.`]
    if (outside < 0) return [`A and B together contain ${a + both + b}, more than the universal total ${config.universal}: raise universal to at least ${a + both + b}, or use ${example}.`]
    if (outside > MAX_TOTAL) return [`Neither would be ${outside}, above the card's ${MAX_TOTAL} limit: lower the totals, or use ${example}.`]
    if (!countsValid(config)) return [`All three unknown regions would start at their answers, so there is nothing to do: use e.g. ${example}.`]
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'shade') {
      if (/\b(?:[1-4]|one|two|three|four)\s+regions?\b|\band nothing else\b|\bjust the (?:middle|centre|center|overlap)\b|\ball except\b|\beverything outside\b|\boutside both circles\b|\bshade\s+(?:only\s+)?(?:a|b)\s+only\s+and\b/i.test(text)) {
        out.push(`The prompt names the regions or their count, which the learner is to work out: ask for the set rule only ("${example}")`)
      }
    } else {
      const numeric = String.raw`(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)`
      const regionAnswer = new RegExp(`\\b(?:a only|only a|b only|only b|neither|outside both)\\b[^.?!]{0,18}\\b${numeric}\\b|\\b${numeric}\\b[^.?!]{0,18}\\b(?:a only|only a|b only|only b|neither|outside both)\\b`, 'i')
      if (regionAnswer.test(text) || /\bn\s*\(\s*a\s*∪\s*b\s*\)\s*=\s*\d+|\ba\s*∪\s*b\s*=\s*\d+/i.test(text)) {
        out.push(`The prompt gives a region count the learner is to work out: give only the totals for A, B, both and the universal set ("${example}")`)
      }
    }
    if (/\bdrag\b|\bdrop\b|\bplace (?:the )?(?:numbers|people|elements)\b|\bthree circles\b|\bthree-set\b|\bsubset\b|⊆|⊂|\bprobability\b|\btruth table\b/i.test(text)) {
      out.push(`The prompt promises something this card does not do: it taps regions or changes counts on a two-set diagram, with no dragging, three sets, subset proof or probability question ("${example}")`)
    }
    return out
  },

  initial(config) {
    return config.task === 'shade' ? { shaded: [] } : { counts: [0, config.both, 0, 0] }
  },

  check(config, state) {
    const ok = done(config, state)
    if (ok) return { ok, wrongIds: [] }
    if (config.task === 'shade') {
      const made = shadedOf(config, state)
      const wanted = selectedRegions(config.expression)
      return { ok, wrongIds: REGION_IDS.filter((id) => made.includes(id) !== wanted.includes(id)) }
    }
    const made = countsOf(config, state)
    const want = expectedCounts(config)
    return { ok, wrongIds: REGION_IDS.filter((_, i) => made[i] !== want[i]) }
  },

  solve(config) {
    return config.task === 'shade' ? { shaded: selectedRegions(config.expression) } : { counts: expectedCounts(config) }
  },

  View: SetsLogicView,

  prompt: `SCENE "sets-logic" -- a carefully drawn two-set Venn diagram on a quiet light panel. A rounded rectangle is the universal set, labelled ℰ, with overlapping circles A and B. Its four regions are directly named only A, both, only B and neither. Set A and set B have short context labels (football/tennis in a class, or even numbers/multiples of 3 in the numbers 1 to 20). Every symbol on the card is also said in words.
  shade: the rule is shown in symbols and words. The learner taps whole regions to shade them yellow; a second tap unshades them. This makes union include the overlap, complement include the outside, and A′ ∪ B different from (A ∪ B)′. expression: A, B, A ∩ B, A ∪ B, A′, B′, A ∩ B′, A′ ∩ B, (A ∪ B)′, (A ∩ B)′, A′ ∩ B′, A′ ∪ B′, A′ ∪ B, A ∪ B′, exactly one, ℰ. Ordinary words such as "only A", "neither", "not A or B" and "exactly one" are accepted. The empty set is refused because an unshaded start would solve it.
  counts: the card gives totals for A, B, both and ℰ, then the learner sets A only, B only and neither with small − / + steppers (hold to repeat; arrow keys also work). Both is fixed at its given value. Each region shows its current count, and a live "In A or B" readout adds the three inside regions so the overlap is counted once. Use whole-number totals from 0 to 60 with a real solution and at least one nonzero unknown. context: "sports" or "numbers", optional, default sports.
  For: set language and notation, two-set Venn diagrams, union/intersection/complement, universal and empty sets, the four regions, completing Venn counts, and the denominator ideas behind probability from a Venn diagram. It builds the region reasoning behind subsets, but does not draw a subset relation or three circles. It does not place individual elements or calculate a probability. Not for data sets/statistics, set squares, PE sets and reps, logic gates, truth tables, Boolean algebra, argument/fallacies, program logic or dichotomous keys.
  Before marking it shows only the rule or given totals, current shading and current counts; it does not name the correct regions or compute the missing counts. Marking says what was made and then the matching regions or exact split. Prompts must give the gesture and the rule/given totals, not the answer regions, their number, the unknown counts, or a probability to calculate.
  config: { "task":"shade", "expression":"A ∪ B", "context":"sports" }
       or { "task":"shade", "expression":"(A ∪ B)′", "context":"numbers" }
       or { "task":"counts", "totalA":12, "totalB":9, "both":4, "universal":30, "context":"sports" }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a region to shade it yellow, and tap again to unshade it. Shade every region for A ∪ B: in A or B, or both (union).",
    "payload": { "engine":"sets-logic", "config": { "task":"shade", "expression":"A ∪ B", "context":"sports" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:sets-logic", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap a region to shade it yellow, and tap again to unshade it. Shade every region for (A ∪ B)′: not in A or B, neither.",
    "payload": { "engine":"sets-logic", "config": { "task":"shade", "expression":"(A ∪ B)′", "context":"numbers" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:sets-logic", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the − and + buttons to fill in A only, B only and neither. In 30 students, A has 12, B has 9, and 4 are in both. Count the overlap once.",
    "payload": { "engine":"sets-logic", "config": { "task":"counts", "totalA":12, "totalB":9, "both":4, "universal":30, "context":"sports" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:sets-logic", "why":"..." } }`,
}

registerEngine(setsLogicEngine as SceneEngine<unknown, unknown>)
