// lib/studylab/engines/transformers/config.ts
//
// The lab transformer (see .superpowers/bakeoff/transformers/design.md).
// The student winds turns onto the secondary coil; each turn adds supplyVolts / primaryTurns volts, so Vs = Vp x Ns / Np.
//   turns  -- wind the secondary until the lamp is lit at its rating;
//   supply -- the transformer is wound right but a battery drives it: find the change that lights the lamp.
// Rules are computed here and never read from the drawing.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { TransformersView } from './View'

export type Supply = 'ac' | 'dc'
export type TurnsConfig = { kind: 'turns'; supplyVolts: number; primaryTurns: number; lampRating: number; startTurns: number }
export type SupplyConfig = { kind: 'supply'; supplyVolts: number; primaryTurns: number; lampRating: number }
export type OtherConfig = { kind: 'other'; asked: string }
export type Real = TurnsConfig | SupplyConfig
export type TransformersConfig = Real | OtherConfig
export type TransformersState = { supply: Supply; turns: number; blown: boolean }

export const MAX_TURNS = 12
export const BATTERY_VOLTS = [3, 6, 9, 12]

const fmt = (n: number) => String(Number(n.toFixed(2)))
export const voltsText = (n: number) => `${fmt(n)} V`

// ---------------------------------------------------------------------------
// The physics.

/** Turns the secondary needs for the lamp to get exactly its rating (may be fractional for a bad config). */
export function answerTurns(c: Real): number {
  return (c.lampRating * c.primaryTurns) / c.supplyVolts
}
export const stepVolts = (c: Real) => c.supplyVolts / c.primaryTurns

/** The lamp's voltage: a.c. gives Vp x Ns / Np, a battery gives nothing in the secondary. */
export function lampVolts(c: Real, s: TransformersState): number {
  return s.supply === 'ac' ? (c.supplyVolts * s.turns) / c.primaryTurns : 0
}
/** At twice its rating the lamp blows. Integer-safe: Vs >= 2 x rating. */
export function blows(c: Real, s: Pick<TransformersState, 'supply' | 'turns'>): boolean {
  return s.supply === 'ac' && c.supplyVolts * s.turns >= 2 * c.lampRating * c.primaryTurns - 1e-9
}

export function readState(state: Partial<TransformersState> | null | undefined): TransformersState {
  const t = Number(state?.turns)
  return {
    supply: state?.supply === 'dc' ? 'dc' : 'ac',
    turns: Number.isFinite(t) ? Math.min(MAX_TURNS, Math.max(1, Math.round(t))) : 1,
    blown: state?.blown === true,
  }
}

/** A move (turns or supply): applies it, and blows the lamp when it gets twice its rating. */
export function move(c: Real, state: Partial<TransformersState> | null | undefined, patch: Partial<TransformersState>): TransformersState {
  const s = readState({ ...readState(state), ...patch })
  return { ...s, blown: s.blown || blows(c, s) }
}
/** Fit a new lamp: allowed only when it would not blow at once. */
export function canFit(c: Real, s: TransformersState): boolean {
  return s.blown && !blows(c, s)
}
export function fitLamp(c: Real, state: Partial<TransformersState> | null | undefined): TransformersState {
  const s = readState(state)
  return canFit(c, s) ? { ...s, blown: false } : s
}

export function done(config: TransformersConfig, state: Partial<TransformersState> | null | undefined): boolean {
  if (config.kind === 'other' || faults(config).length) return false
  const s = readState(state)
  return s.supply === 'ac' && !s.blown && Math.abs(s.turns - answerTurns(config)) < 1e-9
}

// ---------------------------------------------------------------------------
// Words on the card. Before marking, only observations; never right or wrong.

export function goalText(config: TransformersConfig): string {
  if (config.kind === 'other') return ''
  return config.kind === 'turns' ? `Light the ${fmt(config.lampRating)} V lamp at its proper brightness` : `Make the ${fmt(config.lampRating)} V lamp light`
}

export function measureOf(config: Real, state: Partial<TransformersState> | null | undefined): { label: string; value: string } {
  return { label: 'Lamp voltage', value: voltsText(lampVolts(config, readState(state))) }
}

export function captionText(config: Real, state: Partial<TransformersState> | null | undefined): string {
  const s = readState(state)
  const vs = lampVolts(config, s)
  const r = config.lampRating
  if (s.blown) return `The lamp's filament has burnt through. Reduce the lamp's voltage, then fit a new lamp.`
  if (s.supply === 'dc') return 'The battery gives a steady current, so the field in the core stands still and the lamp stays dark.'
  const lead = config.kind === 'supply' ? 'The field in the core keeps reversing. ' : ''
  if (vs < r - 1e-9) return `${lead}The lamp gets ${voltsText(vs)}, less than the ${fmt(r)} V it is made for, so it glows dimly.`
  if (vs <= r + 1e-9) return `${lead}The lamp gets ${voltsText(vs)}.`
  return `${lead}The lamp gets ${voltsText(vs)}, more than the ${fmt(r)} V it is made for, so it glares and will not last.`
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** What a marked card says. */
export function verdictText(config: TransformersConfig, state: Partial<TransformersState> | null | undefined): string {
  if (config.kind === 'other') return ''
  const s = readState(state)
  const ok = done(config, s)
  const n = Math.round(answerTurns(config))
  const np = config.primaryTurns
  const vs = lampVolts(config, s)
  const turnsRule = () => {
    const g = gcd(n, np)
    const a = n / g
    const b = np / g
    const kind = n < np ? ' Fewer turns on the secondary than the primary is a step-down transformer.' : n > np ? ' More turns on the secondary than the primary is a step-up transformer.' : ' The same turns on both coils gives the same voltage.'
    const part = a === b ? 'the whole' : a === 1 && b === 2 ? 'half' : `${a}/${b}`
    return `The secondary has ${n} turns to the primary's ${np}, so the lamp gets ${part} of ${fmt(config.supplyVolts)} V: ${voltsText(n * stepVolts(config))}.${kind}`
  }
  if (ok) {
    if (config.kind === 'turns') return `${turnsRule()} The supply's needle shows it giving the power the lamp takes: power in equals power out.`
    return 'Only a changing current makes a changing field, and only a changing field in the core makes a voltage in the secondary.'
  }
  const wrongTurns = () => {
    const step = `Each turn adds ${voltsText(stepVolts(config))}.`
    if (s.blown) return `${step} The lamp blew when it got twice the ${fmt(config.lampRating)} V it is made for.`
    return `${step} With ${s.turns} ${s.turns === 1 ? 'turn' : 'turns'} the lamp got ${voltsText(vs)} and it is made for ${fmt(config.lampRating)} V.`
  }
  if (config.kind === 'supply' && s.supply === 'dc') return 'On the battery the field is steady, so nothing is made in the secondary, however many turns there are.'
  return wrongTurns()
}

export function describe(config: Real, state: Partial<TransformersState> | null | undefined): string {
  const s = readState(state)
  const vs = lampVolts(config, s)
  return `A transformer with ${config.primaryTurns} turns on the primary coil and ${s.turns} on the secondary, driven by a ${fmt(config.supplyVolts)} V ${s.supply === 'ac' ? 'a.c. supply' : 'battery'}. The voltmeter across the ${fmt(config.lampRating)} V lamp reads ${voltsText(vs)}${s.blown ? ', and the lamp has burnt out' : ''}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '')
const hasWord = (key: string, words: string[]) => key.split('-').some((w) => words.includes(w))

/** A number: 12, "12", "12 V", "6 turns". Unreadable is NaN. */
function readNum(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN
  if (typeof raw !== 'string') return NaN
  const m = raw.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:v|volts?|turns?)?$/)
  return m ? Number(m[1]) : NaN
}

function parse(raw: unknown): TransformersConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const rawKind = first(o, ['kind', 'task', 'type', 'mode'])
  const sv = first(o, ['supplyVolts', 'supplyVoltage', 'volts', 'primaryVolts', 'vp'])
  const pt = first(o, ['primaryTurns', 'np', 'primary'])
  const lr = first(o, ['lampRating', 'lamp', 'lampVolts', 'rating', 'ratedVolts'])
  const st = first(o, ['startTurns', 'start', 'secondaryTurns', 'ns'])
  let kind: 'turns' | 'supply' | 'other' | null = null
  if (rawKind !== undefined) {
    const key = keyOf(rawKind)
    if (hasWord(key, ['supply', 'battery', 'dc', 'ac', 'current', 'switch', 'power', 'pack'])) kind = 'supply'
    else if (hasWord(key, ['turns', 'turn', 'wind', 'winding', 'secondary', 'ratio', 'step'])) kind = 'turns'
    else kind = 'other'
  } else if ([sv, pt, lr, st].some((v) => v !== undefined)) kind = 'turns'
  if (kind === null) return null
  if (kind === 'other') return { kind: 'other', asked: String(rawKind) }
  const num = (v: unknown, d: number) => (v === undefined ? d : readNum(v))
  if (kind === 'turns') {
    return { kind: 'turns', supplyVolts: num(sv, 12), primaryTurns: num(pt, 6), lampRating: num(lr, 6), startTurns: num(st, 1) }
  }
  return { kind: 'supply', supplyVolts: num(sv, 6), primaryTurns: num(pt, 4), lampRating: num(lr, 12) }
}

const EX_TURNS_CFG: TransformersConfig = { kind: 'turns', supplyVolts: 12, primaryTurns: 6, lampRating: 6, startTurns: 1 }
const EX_TURNS = JSON.stringify(EX_TURNS_CFG)
const EX_SUPPLY = JSON.stringify({ kind: 'supply', supplyVolts: 6, primaryTurns: 4, lampRating: 12 })

const inRange = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi

function faults(config: TransformersConfig): string[] {
  if (config.kind === 'other') {
    return [`Only two tasks are built: wind the secondary to light a lamp (${EX_TURNS}) and a battery that leaves the lamp dark (${EX_SUPPLY}), not "${config.asked}". Use ${EX_TURNS}.`]
  }
  const out: string[] = []
  if (config.kind === 'supply') {
    if (!BATTERY_VOLTS.includes(config.supplyVolts)) out.push(`The battery is made of 1.5 V cells, so the supply is 3, 6, 9 or 12 V, not ${config.supplyVolts} V: use ${EX_SUPPLY}.`)
  } else if (!inRange(config.supplyVolts, 2, 24)) out.push(`The supply is 2 to 24 V, not ${config.supplyVolts} V: use ${EX_TURNS}.`)
  if (!inRange(config.primaryTurns, 1, MAX_TURNS) || !Number.isInteger(config.primaryTurns)) out.push(`The primary coil has 1 to 12 whole turns, not ${config.primaryTurns}: use ${EX_TURNS}.`)
  if (!inRange(config.lampRating, 1.5, 36)) out.push(`The lamp is rated 1.5 to 36 V, not ${config.lampRating} V: use ${EX_TURNS}.`)
  if (config.kind === 'turns' && (!inRange(config.startTurns, 1, MAX_TURNS) || !Number.isInteger(config.startTurns))) out.push(`The secondary starts with 1 to 12 whole turns, not ${config.startTurns}: use ${EX_TURNS}.`)
  if (out.length) return out
  const n = answerTurns(config)
  const whole = Math.round(n)
  if (Math.abs(n - whole) > 1e-9 || whole < 1 || whole > MAX_TURNS) {
    out.push(`A ${fmt(config.lampRating)} V lamp on ${fmt(config.supplyVolts)} V with ${config.primaryTurns} primary turns needs ${fmt(n)} secondary turns, but the secondary takes whole turns from 1 to 12: change the lamp or the primary turns, e.g. ${EX_TURNS}.`)
    return out
  }
  if (config.kind === 'turns') {
    if (config.supplyVolts * 6 < config.lampRating * config.primaryTurns) out.push(`Each turn would add only ${fmt(stepVolts(config))} V, under a sixth of the lamp's ${fmt(config.lampRating)} V, so neighbouring turns would look alike: use a bigger step, e.g. ${EX_TURNS}.`)
    if (config.startTurns === whole) out.push(`The secondary starts on the answer (${whole} turns), so there is nothing to do: start on 1 turn, e.g. ${EX_TURNS}.`)
    else if (blows(config, { supply: 'ac', turns: config.startTurns })) out.push(`The start would blow the lamp at once (${config.startTurns} turns gives twice its rating): start on 1 turn, e.g. ${EX_TURNS}.`)
  }
  return out
}

// ---------------------------------------------------------------------------
// Prompts.

export const EXAMPLES: { prompt: string; config: TransformersConfig }[] = [
  { prompt: 'Wind turns onto the secondary coil until the 6 V lamp glows at its proper brightness.', config: EX_TURNS_CFG },
  { prompt: 'The supply gives 6 V, but this lamp is made for 18 V. Wind the secondary coil until the lamp is lit properly.', config: { kind: 'turns', supplyVolts: 6, primaryTurns: 2, lampRating: 18, startTurns: 1 } },
  { prompt: 'Wind or unwind the secondary coil so the 12 V lamp is lit as it should be.', config: { kind: 'turns', supplyVolts: 24, primaryTurns: 8, lampRating: 12, startTurns: 1 } },
  { prompt: 'The lamp is wired to the secondary coil but stays dark. Find a way to make it light.', config: { kind: 'supply', supplyVolts: 6, primaryTurns: 4, lampRating: 12 } },
]

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const TURNS_TELLS = [/\bstep[- ]?(?:up|down)\b/i, /\b(?:more|fewer|less)\s+turns\b/i, /\bhalf\b/i, /\bdouble\b/i, /\btwice\b/i, /\btimes as many\b/i]
const SUPPLY_TELLS = [/\ba\.c\b\.?/i, /\bac\b/i, /\balternating\b/i, /\bmains\b/i, /\bpower pack\b/i, /\bchanging current\b/i, /\bswitch the supply\b/i, /\binstead of the battery\b/i]

function promptFaults(config: TransformersConfig, prompt: string): string[] {
  if (config.kind === 'other') return []
  const text = prompt.replace(/\s+/g, ' ')
  const found: string[] = []
  if (config.kind === 'turns') {
    for (const r of TURNS_TELLS) { const m = text.match(r)?.[0]; if (m) found.push(m) }
    const n = Math.round(answerTurns(config))
    const m = text.match(new RegExp(`\\b(?:${n}|${WORDS[n - 1] ?? 'x'})\\s+(?:\\w+\\s+)?turns?\\b`, 'i'))?.[0]
    if (m) found.push(m)
  } else {
    for (const r of SUPPLY_TELLS) { const m = text.match(r)?.[0]; if (m) found.push(m) }
  }
  return found.length ? [`the prompt gives the answer away with ${found.map((w) => `"${w}"`).join(', ')}: say only the situation and the gesture, e.g. "${EXAMPLES[0].prompt}"`] : []
}

const catalogue = EXAMPLES.map((e, i) => `  ${i === 0 ? '   ' : 'or '}${JSON.stringify(e.config)}  -- the prompt says "${e.prompt}"`).join('\n')

export const transformersEngine: SceneEngine<TransformersConfig, TransformersState> = {
  id: 'transformers',
  covers: ['turns ratio', 'step-up transformer', 'step-down transformer'],
  phrases: [
    'transformer', 'transformers', 'the transformer equation', 'transformer equation', 'step-up transformers', 'step-down transformers',
    'step-up and step-down transformers', 'step up and step down transformers', 'how a transformer works', 'primary and secondary coils',
    'primary coil', 'secondary coil', 'transformers and the national grid',
  ],
  notFor: [
    'transformations of shapes', 'geometric transformations', 'energy transformations', 'transformation of energy', 'electric motors', 'motor effect',
    'electric generators', 'a.c. generator', 'dynamo',
  ],
  isolates: 'quantity',

  parse,
  faults,
  promptFaults,

  initial(config) {
    if (config.kind === 'other') return { supply: 'ac', turns: 1, blown: false }
    if (config.kind === 'supply') return { supply: 'dc', turns: Math.round(answerTurns(config)), blown: false }
    return { supply: 'ac', turns: config.startTurns, blown: false }
  },

  check(config, state) {
    const ok = done(config, state)
    return { ok, wrongIds: ok ? [] : ['lamp'] }
  },

  solve(config) {
    if (config.kind === 'other') return { supply: 'ac', turns: 1, blown: false }
    return { supply: 'ac', turns: Math.round(answerTurns(config)), blown: false }
  },

  View: TransformersView,

  prompt: `SCENE "transformers" -- a school demountable transformer on a bench: a laminated iron core, a primary coil (every turn drawn) fed by a supply, and a secondary coil wired to a lamp with a voltmeter across it. The learner winds turns onto the secondary one at a time (+ and -); each turn adds the same voltage, so the lamp's voltage is the supply's scaled by secondary turns over primary turns (Vs/Vp = Ns/Np). The lamp glows dim, proper or glaring by its voltage and blows at twice its rating (then "Fit a new lamp"). The voltmeter and the supply's current needle follow each turn. A battery in place of the a.c. supply leaves the field in the core standing still and the lamp dark.
  Tasks: "turns" (wind the secondary until the lamp is lit at its rating; the secondary starts on startTurns) and "supply" (already wound right, but a battery drives it; the learner switches to the a.c. supply). All volts are whole numbers; the answer N = lampRating x primaryTurns / supplyVolts must be a whole number from 1 to 12.
  For: the turns ratio, step-up and step-down transformers, how a transformer works. Not drawn: pylons and cable heating, efficiency, eddy currents, calculating currents.
  Before marking the card shows the goal, the "Lamp voltage" readout and a caption, and never says right or wrong. The prompt must say the situation and the gesture: do NOT give the number of turns, "step up", "step down", "more turns", "half", "double", "twice", and for the supply task do NOT say a.c., alternating, mains, power pack, changing current or "instead of the battery".
  config examples:
${catalogue}
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${EXAMPLES[0].prompt}",
    "payload": { "engine":"transformers", "config": ${JSON.stringify(EXAMPLES[0].config)} },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:transformers", "why":"..." } }`,
}

registerEngine(transformersEngine as SceneEngine<unknown, unknown>)
