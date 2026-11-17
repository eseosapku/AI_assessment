// lib/studylab/engines/standard-form/config.ts
//
// A digit tape slides behind a fixed place-value frame. Multiplying or dividing by ten moves the
// digits, not the decimal point. In `write`, the learner balances an ordinary number as a × 10^n;
// in `expand`, they slide a given a × 10^n out into its full ordinary decimal. All arithmetic is
// done on decimal strings: no float ever decides a digit, a power, or a mark.
//
// Teaching sources (ideas only, no code or artwork): the NCETM place-value account of digits moving
// between columns; Desmos's separation of correct form from correct value; Science Primer's repeated
// multiplication/division by ten. Cambridge IGCSE's rule is 1 <= a < 10 with an integer power.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { StandardFormView } from './View'

export const MAX_COLUMNS = 10
export const MAX_SIGNIFICANT_DIGITS = 7
export const MAX_POWER = 9

export type StandardFormConfig =
  | { task: 'write'; value: string }
  | { task: 'expand'; coefficient: string; power: number }

/** Positive means the tape has moved right; negative means left. */
export type StandardFormState = { move: number }

/** digits × 10^exp, with no leading or trailing zero in digits (except zero itself). */
export type Decimal = { digits: string; exp: number; negative?: boolean }
export type TapeDigit = { digit: string; place: number; fromTape: boolean; index: number }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const integer = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw + 0 : null
  if (typeof raw === 'string' && /^[-+]?\d+$/.test(raw.trim())) return Number(raw.trim())
  return null
}

/** Read a decimal or scientific-notation string without passing its value through Number. */
export function readDecimal(raw: unknown): Decimal | null {
  if (raw === null || raw === undefined || typeof raw === 'boolean' || typeof raw === 'object') return null
  let text = String(raw).trim().replace(/[−–]/g, '-').replace(/[,\s_]/g, '')
  text = text.replace(/[×⋅]/g, 'x').replace(/\*\*/g, '^')
  const sci = text.match(/^([^xX]+?)(?:[xX](?:\*\s*)?10(?:\^?\{?([-+]?\d+)\}?)?|[eE]([-+]?\d+))$/)
  let power = 0
  if (sci) {
    text = sci[1]
    power = Number(sci[2] ?? sci[3] ?? 1)
    if (!Number.isSafeInteger(power)) return null
  } else if (/[xXeE^]/.test(text)) return null
  const m = text.match(/^([-+]?)(\d*)(?:\.(\d*))?$/)
  if (!m || (!m[2] && !m[3])) return null
  const negative = m[1] === '-'
  const joined = `${m[2]}${m[3] ?? ''}`
  if (!/^\d+$/.test(joined)) return null
  const point = m[2].length
  const trimmed = joined.replace(/^0+/, '')
  if (!trimmed) return { digits: '0', exp: 0, negative: false }
  const lead = joined.length - joined.replace(/^0+/, '').length
  const trailing = (trimmed.match(/0*$/)?.[0].length ?? 0)
  const digits = trimmed.slice(0, trimmed.length - trailing || undefined)
  const exp = point - lead - digits.length + power
  if (!Number.isSafeInteger(exp) || Math.abs(exp) > 100) return null
  return { digits, exp, negative }
}

export function canonicalDecimal(raw: unknown): string | null {
  const d = readDecimal(raw)
  return d ? decimalText(d) : null
}

/** Every digit, including leading and placeholder zeros, with its place-value power. */
export function tapeDigits(d: Decimal): TapeDigit[] {
  const out: TapeDigit[] = []
  let index = 0
  const push = (digit: string, place: number, fromTape: boolean) => out.push({ digit, place, fromTape, index: index++ })
  if (d.digits === '0') {
    push('0', 0, true)
    return out
  }
  if (d.exp >= 0) {
    const full = d.digits + '0'.repeat(d.exp)
    const high = full.length - 1
    ;[...full].forEach((digit, i) => push(digit, high - i, i < d.digits.length))
    return out
  }
  const point = d.digits.length + d.exp
  if (point > 0) {
    ;[...d.digits].forEach((digit, i) => push(digit, point - 1 - i, true))
    return out
  }
  push('0', 0, false)
  for (let p = -1; p >= point; p--) push('0', p, false)
  ;[...d.digits].forEach((digit, i) => push(digit, point - 1 - i, true))
  return out
}

/** The exact ordinary decimal, with no grouping and no floating-point conversion. */
export function decimalText(d: Decimal): string {
  const sign = d.negative && d.digits !== '0' ? '-' : ''
  if (d.digits === '0') return '0'
  const chars = tapeDigits(d)
  const high = chars[0].place
  const low = chars[chars.length - 1].place
  let out = ''
  for (let p = high; p >= low; p--) {
    if (p === -1) out += '.'
    out += chars.find((c) => c.place === p)?.digit ?? '0'
  }
  return sign + out
}

export function standardExponent(d: Decimal): number {
  return d.digits === '0' ? 0 : d.exp + d.digits.length - 1
}

/** a × 10^n, normalized so 1 <= a < 10 for a positive nonzero number. */
export function standardParts(d: Decimal): { coefficient: Decimal; power: number } {
  const power = standardExponent(d)
  return { coefficient: { digits: d.digits, exp: 1 - d.digits.length, negative: d.negative }, power }
}

export function baseOf(config: StandardFormConfig): Decimal {
  const d = readDecimal(config.task === 'write' ? config.value : config.coefficient)
  return d ?? { digits: '0', exp: 0 }
}

/** The decimal currently on the frame. Moving right divides its value by ten. */
export function currentDecimal(config: StandardFormConfig, move: number): Decimal {
  const base = baseOf(config)
  return { ...base, exp: base.exp - move }
}

export function currentPower(config: StandardFormConfig, move: number): number {
  return config.task === 'write' ? move : config.power
}

export function targetMove(config: StandardFormConfig): number {
  return config.task === 'write' ? standardExponent(baseOf(config)) : -config.power
}

export function moveBounds(config: StandardFormConfig): { lo: number; hi: number } {
  const target = targetMove(config)
  // Start, solution, and one equal-but-wrong form on either side of the solution.
  return { lo: Math.min(0, target - 1), hi: Math.max(0, target + 1) }
}

export function readMove(config: StandardFormConfig, raw: unknown): number {
  const move = (raw as StandardFormState | null)?.move
  if (typeof move !== 'number' || !Number.isFinite(move)) return 0
  const b = moveBounds(config)
  return clamp(Math.round(move), b.lo, b.hi)
}

export function isStandard(d: Decimal): boolean {
  // A positive terminating decimal is between 1 and 10 exactly when its leading
  // significant digit is in the ones column.
  return !d.negative && d.digits !== '0' && standardExponent(d) === 0
}

/** Every significant digit must remain in the window at every reachable position. */
export function frameFits(config: StandardFormConfig): boolean {
  const target = targetMove(config)
  const base = baseOf(config)
  const highDigit = standardExponent(base)
  const lowDigit = highDigit - base.digits.length + 1
  const moves = [0, target - 1, target, target + 1]
  const high = Math.max(0, ...moves.map((move) => highDigit - move))
  const low = Math.min(0, ...moves.map((move) => lowDigit - move))
  return high - low + 1 <= MAX_COLUMNS && Math.abs(target) <= MAX_POWER
}

/** The fixed columns: every start, finish and reachable significant digit fits. */
export function frameOf(config: StandardFormConfig): { high: number; low: number } {
  const target = targetMove(config)
  const base = baseOf(config)
  const highDigit = standardExponent(base)
  const lowDigit = highDigit - base.digits.length + 1
  const moves = [0, target - 1, target, target + 1]
  let high = Math.max(0, ...moves.map((move) => highDigit - move))
  let low = Math.min(0, ...moves.map((move) => lowDigit - move))
  while (high - low + 1 < MAX_COLUMNS) {
    const roomAbove = 4 - high
    const roomBelow = -4 - low
    if ((roomAbove >= roomBelow && high < MAX_POWER + 2) || low <= -MAX_POWER - 2) high++
    else low--
  }
  return { high, low }
}

export function ordinaryLeft(config: StandardFormConfig): string {
  return decimalText(baseOf(config))
}

export function expressionLeft(config: StandardFormConfig): { coefficient: string; power: number } {
  if (config.task === 'write') return { coefficient: ordinaryLeft(config), power: 0 }
  return { coefficient: decimalText(baseOf(config)), power: config.power }
}

/** The two sides printed live on the card. Their exact equality follows from currentDecimal. */
export function liveEquation(config: StandardFormConfig, move: number): { left: string; right: Decimal; power: number } {
  if (config.task === 'write') return { left: ordinaryLeft(config), right: currentDecimal(config, move), power: move }
  return { left: `${decimalText(baseOf(config))} × 10^${config.power}`, right: currentDecimal(config, move), power: config.power }
}

export function done(config: StandardFormConfig, raw: unknown): boolean {
  const move = (raw as StandardFormState | null)?.move
  return typeof move === 'number' && Number.isInteger(move) && move === targetMove(config)
}

const powerWords: Record<string, string> = { '-9': 'nine', '-8': 'eight', '-7': 'seven', '-6': 'six', '-5': 'five', '-4': 'four', '-3': 'three', '-2': 'two', '-1': 'one', '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine' }
const direction = (move: number) => move > 0 ? 'right' : 'left'
const count = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'column' : 'columns'}`
const product = (coefficient: string, power: number) => `${coefficient} × 10^${power}`

export function working(config: StandardFormConfig, raw: unknown): string {
  const move = (raw as StandardFormState | null)?.move
  const travelled = typeof move === 'number' && Number.isFinite(move) ? Math.round(move) : 0
  const now = decimalText(currentDecimal(config, travelled))
  const way = direction(travelled)
  if (config.task === 'write') {
    const small = standardExponent(baseOf(config)) < 0
    return `Yes. ${ordinaryLeft(config)} = ${product(now, travelled)}. The digits moved ${count(travelled)} ${way}, and ${now} is at least 1 and less than 10.${small ? ' The negative power makes a small number, not a negative number.' : ''}`
  }
  const positive = config.power > 0
  return `Yes. ${product(decimalText(baseOf(config)), config.power)} = ${now}. The digits moved ${count(travelled)} ${way}; zeros fill the empty columns.${positive ? '' : ' A negative power makes a small number, not a negative number.'}`
}

export function madeText(config: StandardFormConfig, raw: unknown): string {
  const move = readMove(config, raw)
  const now = decimalText(currentDecimal(config, move))
  if (config.task === 'write') {
    const made = product(now, move)
    if (baseOf(config).negative) return `You made ${made}. This card uses positive numbers in standard form.`
    if (now.startsWith('0.')) return `You made ${made}, which still equals ${ordinaryLeft(config)}. The first number is less than 1; standard form needs it to be at least 1.`
    return `You made ${made}, which still equals ${ordinaryLeft(config)}. The first number is 10 or more; standard form needs it to be less than 10.`
  }
  if (readMove(config, raw) === 0) return `You left the digits at ${now}. Use the given power to choose how far to slide them.`
  return `You made ${now}. That is not the ordinary value of ${product(decimalText(baseOf(config)), config.power)}; each column changes the digits' value ten times.`
}

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, StandardFormConfig['task']> = {
  write: 'write', writing: 'write', convert: 'write', 'standard-form': 'write', 'standard-index-form': 'write', 'scientific-notation': 'write', 'to-standard-form': 'write', 'write-standard-form': 'write', ordinary: 'write', 'ordinary-to-standard': 'write', 'decimal-to-standard': 'write',
  expand: 'expand', expanded: 'expand', 'ordinary-number': 'expand', 'to-ordinary': 'expand', 'standard-to-ordinary': 'expand', 'from-standard-form': 'expand', 'write-ordinary': 'expand', evaluate: 'expand',
}

function goodPrompt(config: StandardFormConfig): string {
  return config.task === 'write'
    ? `Slide the digit tape, or use the arrow buttons, to write ${ordinaryLeft(config)} in standard form.`
    : `Slide the digit tape, or use the arrow buttons, to write ${product(decimalText(baseOf(config)), config.power)} as an ordinary number.`
}

function suggestedPower(power: number): number {
  return power === 0 ? 5 : clamp(Math.round(power), -MAX_POWER, MAX_POWER) || 5
}

export const standardFormEngine: SceneEngine<StandardFormConfig, StandardFormState> = {
  id: 'standard-form',
  // Only "scientific notation" is distinctive word by word. Everything with a common word is a phrase:
  // a bare "standard", "form", "power" or "number" would catch unrelated stations.
  covers: ['scientific notation'],
  phrases: [
    'standard form', 'standard index form', 'standard-form notation', 'scientific form', 'standard scientific notation',
    'writing numbers in standard form', 'write numbers in standard form', 'writing in standard form', 'convert to standard form', 'converting to standard form',
    'powers of ten', 'power of ten', 'powers of 10', 'power of 10', 'multiplying by powers of ten', 'dividing by powers of ten',
    'multiplying by 10 100 and 1000', 'dividing by 10 100 and 1000', 'very large and very small numbers', 'large and small numbers in standard form',
    'ordinary numbers and standard form', 'standard form and ordinary numbers', 'negative powers for small numbers',
  ],
  notFor: [
    'place value counters', 'base ten blocks', 'counters-place-value', 'rounding', 'rounded', 'significant figures', 'decimal places',
    'binary', 'file sizes', 'file size', 'data-representation', 'laws of indices', 'laws of exponents', 'index laws', 'algebraic indices',
    'standard deviation', 'standard units', 'standard algorithms', 'standard form of a line', 'standard form of a quadratic', 'vertex form',
    'multiplying standard form', 'dividing standard form', 'calculations in standard form', 'adding standard form', 'subtracting standard form',
  ],
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawValue = first(src, ['value', 'number', 'ordinary', 'decimal', 'target', 'n'])
    const rawCoefficient = first(src, ['coefficient', 'a', 'mantissa'])
    const rawPower = first(src, ['power', 'exponent', 'index', 'n'])
    const expression = first(src, ['expression', 'standardForm', 'standard', 'scientific'])
    const word = keyOf(rawTask)
    if (word && !TASK_WORDS[word]) return null
    const fromExpression = typeof expression === 'string' && /(?:[xX×⋅]|[eE])/.test(expression)
    const task = word ? TASK_WORDS[word] : rawCoefficient !== undefined || rawPower !== undefined || fromExpression ? 'expand' : rawValue !== undefined ? 'write' : null
    if (!task) return null
    if (task === 'write') {
      const value = canonicalDecimal(rawValue ?? expression)
      return value === null ? null : { task, value }
    }
    let coefficient = rawCoefficient
    let power = integer(rawPower)
    if (coefficient === undefined && fromExpression) {
      const d = readDecimal(expression)
      if (!d) return null
      coefficient = decimalText({ digits: d.digits, exp: 1 - d.digits.length, negative: d.negative })
      power ??= standardExponent(d)
    }
    const value = canonicalDecimal(coefficient)
    if (value === null) return null
    return { task, coefficient: value, power: power ?? 0 }
  },

  faults(config) {
    const out: string[] = []
    const base = baseOf(config)
    if (base.digits === '0') out.push(`Zero has no nonzero first digit for standard form: use e.g. ${config.task === 'write' ? 'value "384000"' : 'coefficient "3.84", power 5'}.`)
    if (base.negative) out.push(`This card teaches positive a with 1 <= a < 10, so it does not draw negative values: use e.g. ${config.task === 'write' ? 'value "384000"' : 'coefficient "3.84", power 5'}.`)
    if (base.digits.length > MAX_SIGNIFICANT_DIGITS) out.push(`${decimalText(base)} has ${base.digits.length} significant digits; the tape holds at most ${MAX_SIGNIFICANT_DIGITS}: use fewer, e.g. ${config.task === 'write' ? 'value "384000"' : 'coefficient "3.84"'}.`)
    if (config.task === 'expand') {
      if (!Number.isInteger(config.power) || Math.abs(config.power) > MAX_POWER) out.push(`The power must be a whole number from -${MAX_POWER} to ${MAX_POWER}: use e.g. power ${suggestedPower(config.power)}.`)
      else if (config.power === 0) out.push(`A power of 0 leaves the coefficient unchanged, so there is no tape move to make: use e.g. coefficient "3.84", power 5.`)
      if (!isStandard(base) && base.digits !== '0' && !base.negative) {
        const normal = standardParts(base)
        out.push(`${decimalText(base)} is not a standard-form coefficient (1 <= a < 10): use coefficient "${decimalText(normal.coefficient)}", power ${config.power + normal.power}.`)
      }
    } else {
      const e = standardExponent(base)
      if (base.digits !== '0' && !base.negative && e === 0) out.push(`${decimalText(base)} is already between 1 and 10, so the card would start solved: use e.g. value "${decimalText({ ...base, exp: base.exp + 3 })}".`)
      if (Math.abs(e) > MAX_POWER) out.push(`${decimalText(base)} needs power ${e}; this tape works with powers from -${MAX_POWER} to ${MAX_POWER}: use e.g. value "384000" or "0.0032".`)
    }
    if (!frameFits(config)) out.push(`The starting and finishing numbers span more than ${MAX_COLUMNS} place-value columns: use a nearby value such as ${config.task === 'write' ? '"384000" or "0.0032"' : 'coefficient "3.84", power 5'}.`)
    return out
  },

  promptFaults(config, prompt) {
    const given = config.task === 'write' ? ordinaryLeft(config) : product(decimalText(baseOf(config)), config.power)
    const text = prompt.replace(/\s+/g, ' ').replaceAll(given, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const answer = config.task === 'write'
      ? product(decimalText(standardParts(baseOf(config)).coefficient), standardExponent(baseOf(config)))
      : decimalText(currentDecimal(config, targetMove(config)))
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const answerSaid = text.toLowerCase().includes(answer.toLowerCase()) || new RegExp(escaped.replace(/\\\^/g, '(?:\\^|\\*\\*)')).test(text)
    const directionSaid = /\b(?:left|right|forwards?|backwards?)\b/i.test(text)
    const moveCount = new RegExp(`\\b(?:${Math.abs(targetMove(config))}|${powerWords[String(Math.abs(targetMove(config)))]})\\s+(?:places?|columns?|digits?|times?)\\b`, 'i').test(text)
    const otherProduct = /\d+(?:\.\d+)?\s*(?:×|x|\*)\s*10/i.test(text)
    if (answerSaid || directionSaid || moveCount || (config.task === 'write' && otherProduct)) {
      out.push(`the prompt gives the answer away: it names the result, the direction or the number of columns, which the learner works out with the tape -- name only the given value ("${example}")`)
    }
    if (!/\b(?:slide|drag|move|arrow|tap|step)\b/i.test(prompt)) out.push(`the prompt does not say what to do: tell the learner to slide the digit tape or use its arrow buttons ("${example}")`)
    if (/\b(?:type|enter|key\s*in|choose|select|multiple.choice|order|compare|add|subtract|two\s+(?:numbers|expressions)|round|significant)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it slides one digit tape and converts one value, with no typing, choices, ordering or arithmetic between numbers ("${example}")`)
    }
    return out
  },

  initial: () => ({ move: 0 }),
  check: (config, state) => ({ ok: done(config, state), wrongIds: [] }),
  solve: (config) => ({ move: targetMove(config) }),
  View: StandardFormView,

  prompt: `SCENE "standard-form" -- a printed digit tape sliding behind a fixed ten-column place-value frame on a quiet light panel. The decimal point stays fixed between ones and tenths. Every digit, including placeholder zeros, has its own column. Drag the tape or use the two arrow buttons; each move visibly changes the digits and the exact live equation. No typing.
  write: an ordinary number is shown and the learner balances it as a × 10^n, keeping the same value. The power changes with each column. The task is complete when a is at least 1 and less than 10; equal but nonstandard forms such as 38.4 × 10^4 and 0.384 × 10^6 remain drawable and are marked with what was made.
  expand: a standard-form a × 10^n is shown. The learner slides its digits until the full ordinary number appears, with zeros filling empty columns. The given product and the current ordinary value stay exactly equal on the card.
  For: standard form / scientific notation, converting large and small numbers both ways, powers of ten, multiplying and dividing by 10, 100 and 1000, and the misconceptions that the decimal point itself moves, that 34 × 10^3 is standard form, or that a negative power makes a negative number.
  config write: { "task":"write", "value":"384000" } -- value is a positive finite decimal string (an ordinary or scientific string is accepted), up to 7 significant digits and standard power -9 to 9. A value already between 1 and 10 is refused because it would start solved.
       or { "task":"expand", "coefficient":"3.84", "power":5 } -- coefficient must be positive, nonzero and at least 1 but less than 10; power is a nonzero whole number from -9 to 9. Start and finish must fit in 10 columns.
  Not drawn: negative numbers, ordering several numbers, arithmetic between two standard-form numbers, general index laws, rounding or significant figures, place-value counters, binary and file sizes.
  Before marking the card shows only the given value, the live digits and equation, place values and the direction/distance moved. It holds back the finishing value, direction and number of columns. The prompt must say the gesture and name the given value only: do NOT give the result, "left"/"right", or how many columns to move.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide the digit tape, or use the arrow buttons, to write 384000 in standard form.",
    "payload": { "engine":"standard-form", "config": { "task":"write", "value":"384000" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:standard-form", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide the digit tape, or use the arrow buttons, to write 0.0032 in standard form.",
    "payload": { "engine":"standard-form", "config": { "task":"write", "value":"0.0032" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:standard-form", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide the digit tape, or use the arrow buttons, to write 3.84 × 10^5 as an ordinary number.",
    "payload": { "engine":"standard-form", "config": { "task":"expand", "coefficient":"3.84", "power":5 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:standard-form", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide the digit tape, or use the arrow buttons, to write 9.1 × 10^-3 as an ordinary number.",
    "payload": { "engine":"standard-form", "config": { "task":"expand", "coefficient":"9.1", "power":-3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:standard-form", "why":"..." } }`,
}

registerEngine(standardFormEngine as SceneEngine<unknown, unknown>)
