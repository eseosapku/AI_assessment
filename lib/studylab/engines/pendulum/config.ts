// lib/studylab/engines/pendulum/config.ts
//
// The pendulum timing bench (see .superpowers/bakeoff/pendulum/design.md).
// The student sets the string, the bob and the pull-back, presses Release, and the card times ten complete swings.
// Only the string changes the time: T = 2 pi root(L / g). The bob and the pull-back never enter the formula.
//   match   -- time one swing to a goal time given in seconds;
//   change  -- make a pendulum swing more slowly (or faster) than it does at the start;
//   compare -- time it twice, changing only the bob, only the pull-back or only the string, to find what matters.
//
// Rules are computed here and never read from the drawing. This file has its own copy of the formula; a test checks
// it agrees with the picture's.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { PendulumView } from './View'

export type LengthCm = 25 | 50 | 75 | 100
export type Bob = 'wood' | 'steel'
export type PullDeg = 5 | 10
export type Setup = { lengthCm: LengthCm; bob: Bob; pullDeg: PullDeg }
export type Phase = 'set' | 'swinging' | 'timed'
export type Variable = 'bob' | 'pull' | 'length'

/** A start as the tutor may write it: read broadly, then refused by faults when it cannot be drawn. */
export type StartIn = { lengthCm: number; bob: string; pullDeg: number }

export type PendulumConfig =
  | { kind: 'match'; targetCm: number; start: StartIn }
  | { kind: 'change'; direction: string; start: StartIn }
  | { kind: 'compare'; variable: string; start: StartIn }
  /** Read but not drawn: faults refuses it. */
  | { kind: 'other'; asked: string; start: StartIn }

export type PendulumState = Setup & { phase: Phase; runId: number; runs: Setup[] }

export const LENGTHS: LengthCm[] = [25, 50, 75, 100]
export const BOBS: Bob[] = ['wood', 'steel']
export const PULLS: PullDeg[] = [5, 10]
export const DEFAULT_START: Setup = { lengthCm: 50, bob: 'wood', pullDeg: 5 }

// ---------------------------------------------------------------------------
// The physics.

const G = 9.81
/** Time for one complete swing in seconds. Only the length matters. */
export function periodOf(lengthCm: number): number {
  return 2 * Math.PI * Math.sqrt(lengthCm / 100 / G)
}
/** What the stopwatch shows for ten swings, to 0.1 s: 10.0, 14.2, 17.4, 20.1. */
export function tenSwings(lengthCm: number): number {
  return Math.round(periodOf(lengthCm) * 100) / 10
}
export const tenText = (lengthCm: number) => tenSwings(lengthCm).toFixed(1)
/** One swing is the ten-swing time divided by ten: 1.00, 1.42, 1.74, 2.01. */
export const oneText = (lengthCm: number) => (tenSwings(lengthCm) / 10).toFixed(2)

export const lengthText = (lengthCm: number) => (lengthCm === 100 ? '1 m' : `${lengthCm} cm`)
export const bobWord = (bob: Bob) => (bob === 'wood' ? 'wooden' : 'steel')
export const bobLabel = (bob: Bob) => (bob === 'wood' ? 'Wooden, 50 g' : 'Steel, 500 g')

const isLength = (v: unknown): v is LengthCm => LENGTHS.includes(v as LengthCm)
const isBob = (v: unknown): v is Bob => v === 'wood' || v === 'steel'
const isPull = (v: unknown): v is PullDeg => v === 5 || v === 10

const setupOf = (s: Setup): Setup => ({ lengthCm: s.lengthCm, bob: s.bob, pullDeg: s.pullDeg })

/** Which of the three fields differ between two setups. */
export function differs(a: Setup, b: Setup): Variable[] {
  const out: Variable[] = []
  if (a.bob !== b.bob) out.push('bob')
  if (a.pullDeg !== b.pullDeg) out.push('pull')
  if (a.lengthCm !== b.lengthCm) out.push('length')
  return out
}

/** The state, read safely: anything corrupt reads as the default setup, not yet swinging. */
export function readState(state: Partial<PendulumState> | null | undefined): PendulumState {
  const one = (r: unknown): Setup | null => {
    const o = (r ?? {}) as Partial<Setup>
    return isLength(o.lengthCm) && isBob(o.bob) && isPull(o.pullDeg) ? { lengthCm: o.lengthCm, bob: o.bob, pullDeg: o.pullDeg } : null
  }
  const cur = one(state) ?? DEFAULT_START
  const runs = Array.isArray(state?.runs) ? (state.runs.map(one).filter(Boolean) as Setup[]) : []
  const phase: Phase = state?.phase === 'swinging' || state?.phase === 'timed' ? state.phase : 'set'
  const runId = typeof state?.runId === 'number' && state.runId >= 0 ? Math.floor(state.runId) : 0
  return { ...cur, phase, runId, runs }
}

/** A config the card can draw (faults is empty). */
function startOf(config: PendulumConfig): Setup {
  const s = config.start
  return { lengthCm: s.lengthCm as LengthCm, bob: s.bob as Bob, pullDeg: s.pullDeg as PullDeg }
}

/** The indexes in `runs` of the latest pair that differs in exactly `variable`, or null. */
export function fairPair(runs: Setup[], variable: string): [number, number] | null {
  for (let j = runs.length - 1; j >= 1; j--) {
    for (let i = j - 1; i >= 0; i--) {
      const d = differs(runs[i], runs[j])
      if (d.length === 1 && d[0] === variable) return [i, j]
    }
  }
  return null
}

export function done(config: PendulumConfig, state: Partial<PendulumState> | null | undefined): boolean {
  if (faults(config).length) return false
  const s = readState(state)
  if (s.phase !== 'timed') return false
  if (config.kind === 'match') return s.lengthCm === config.targetCm
  if (config.kind === 'change') return config.direction === 'slower' ? s.lengthCm > config.start.lengthCm : s.lengthCm < config.start.lengthCm
  if (config.kind === 'compare') return fairPair(s.runs, config.variable) !== null
  return false
}

// ---------------------------------------------------------------------------
// Words on the card. Before marking, only observations; never right or wrong.

export function captionText(state: Partial<PendulumState> | null | undefined): string {
  const s = readState(state)
  if (s.phase === 'swinging') return 'The stopwatch is timing ten complete swings: each one goes out and back to the dashed release point.'
  if (s.phase === 'timed') return `Ten swings took ${tenText(s.lengthCm)} s, so one swing takes ${oneText(s.lengthCm)} s.`
  const bob = s.bob === 'wood' ? 'wooden bob (50 g)' : 'steel bob (500 g)'
  return `A ${bob} hangs on a ${lengthText(s.lengthCm)} string, to be pulled back ${s.pullDeg}° and let go. Press Release to time ten swings.`
}

export function goalText(config: PendulumConfig): string {
  if (config.kind === 'match') return `One swing in ${oneText(config.targetCm)} s`
  if (config.kind === 'change') return config.direction === 'faster' ? 'Swing more quickly' : 'Swing more slowly'
  if (config.kind === 'compare') {
    return config.variable === 'pull' ? 'Time it with each pull back' : config.variable === 'length' ? 'Time it with two strings' : 'Time it with each bob'
  }
  return ''
}

/** The live measure: one swing's time once a run has finished. */
export function measureOf(state: Partial<PendulumState> | null | undefined): { label: string; value: string } {
  const s = readState(state)
  return { label: 'One swing', value: s.phase === 'timed' ? `${oneText(s.lengthCm)} s` : '—' }
}

const pullName = (n: number) => `${n}°`

/** What a marked card says, from the timings in the notebook. */
export function verdictText(config: PendulumConfig, state: Partial<PendulumState> | null | undefined): string {
  const s = readState(state)
  if (config.kind === 'other') return ''
  const ok = done(config, s)
  if (s.phase !== 'timed') return 'Nothing has been timed yet. Press Release to time ten swings.'
  const y = oneText(s.lengthCm)
  if (config.kind === 'match') {
    const z = oneText(config.targetCm)
    if (ok) return `One swing now takes ${y} s, the goal time.`
    return `One swing took ${y} s against a goal of ${z} s: ${tenSwings(s.lengthCm) < tenSwings(config.targetCm) ? 'quicker' : 'slower'} than the goal.`
  }
  if (config.kind === 'change') {
    const start = startOf(config)
    const x = oneText(start.lengthCm)
    const slower = config.direction === 'slower'
    if (ok) return `Now ${y} s a swing, ${slower ? 'slower' : 'faster'} than the ${x} s it started at.`
    if (s.lengthCm === start.lengthCm) {
      const what = s.bob !== start.bob ? 'changing the bob made no difference' : s.pullDeg !== start.pullDeg ? 'pulling it back a different amount made no difference' : 'nothing was changed'
      return `The time did not move (${x} s both times): ${what}.`
    }
    return `It now swings ${slower ? 'faster' : 'slower'} than before: ${y} s a swing against ${x} s.`
  }
  const v = config.variable as Variable
  const pair = fairPair(s.runs, v)
  if (pair) {
    const a = s.runs[pair[0]]
    const b = s.runs[pair[1]]
    if (v === 'bob') return `The ${bobWord(a.bob)} bob and the ${bobWord(b.bob)} bob both took ${tenText(a.lengthCm)} s for ten swings, so the bob made no difference.`
    if (v === 'pull') return `Pulled back ${pullName(a.pullDeg)} and ${pullName(b.pullDeg)}, both took ${tenText(a.lengthCm)} s for ten swings, so the pull-back made no difference.`
    const [lo, hi] = a.lengthCm < b.lengthCm ? [a, b] : [b, a]
    return `The ${lengthText(lo.lengthCm)} string took ${tenText(lo.lengthCm)} s and the ${lengthText(hi.lengthCm)} string took ${tenText(hi.lengthCm)} s: the longer string took longer.`
  }
  if (s.runs.length < 2) return 'Only one timing so far: a comparison needs two.'
  const d = differs(s.runs[s.runs.length - 2], s.runs[s.runs.length - 1])
  if (d.length === 0) return 'The last two timings used the same setting, so there is nothing to compare.'
  if (d.length === 1) return `The last two timings differ in the ${d[0] === 'pull' ? 'pull-back' : d[0]}, which is not the thing being tested.`
  return 'Two or more things changed between the last two timings: change only the one being tested.'
}

/** Which notebook rows the verdict refers to (soft highlight, after marking only). */
export function markedRows(config: PendulumConfig, state: Partial<PendulumState> | null | undefined): number[] {
  const s = readState(state)
  const n = s.runs.length
  if (n === 0 || config.kind === 'other') return []
  if (config.kind === 'match') return [n - 1]
  if (config.kind === 'change') {
    const start = startOf(config)
    for (let i = n - 2; i >= 0; i--) if (differs(s.runs[i], start).length === 0) return [i, n - 1]
    return [n - 1]
  }
  const pair = fairPair(s.runs, config.variable)
  if (pair) return pair
  return n >= 2 ? [n - 2, n - 1] : [n - 1]
}

export function describe(state: Partial<PendulumState> | null | undefined): string {
  const s = readState(state)
  const timing = s.phase === 'timed' ? ` The stopwatch shows ten swings in ${tenText(s.lengthCm)} s.` : s.phase === 'swinging' ? ' The stopwatch is running.' : ' The stopwatch reads 0.0.'
  return `A pendulum with a ${lengthText(s.lengthCm)} string and a ${bobWord(s.bob)} bob, pulled back ${s.pullDeg} degrees, beside a metre rule.${timing} ${s.runs.length} timing${s.runs.length === 1 ? '' : 's'} in the notebook.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '')
const hasWord = (key: string, words: string[]) => key.split('-').some((w) => words.includes(w))

/** A length in cm: 50, "50", "50 cm", "1 m", "0.75 m". Unreadable is -1. */
function readLength(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : -1
  if (typeof raw !== 'string') return -1
  const m = raw.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(cm|centimet(?:re|er)s?|m|metres?|meters?)?$/)
  if (!m) return -1
  const n = Number(m[1])
  const unit = m[2]
  return unit === 'm' || (unit && /^met/.test(unit)) ? Math.round(n * 100) : n
}
function readPull(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : -1
  if (typeof raw !== 'string') return -1
  const m = raw.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(?:°|deg|degrees?)?$/)
  return m ? Number(m[1]) : -1
}
function readBob(raw: unknown): string {
  const key = keyOf(raw)
  if (hasWord(key, ['wood', 'wooden', 'light', 'lighter'])) return 'wood'
  if (hasWord(key, ['steel', 'metal', 'iron', 'heavy', 'heavier'])) return 'steel'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}
function readStart(o: Record<string, unknown>): StartIn {
  const nested = o.start && typeof o.start === 'object' ? (o.start as Record<string, unknown>) : null
  const src = nested ?? o
  const l = first(src, ['lengthCm', 'length', 'string', 'stringLength'])
  const b = first(src, ['bob', 'mass', 'ball'])
  const p = first(src, ['pullDeg', 'pull', 'angle', 'pullBack'])
  return {
    lengthCm: l === undefined ? DEFAULT_START.lengthCm : readLength(l),
    bob: b === undefined ? DEFAULT_START.bob : readBob(b),
    pullDeg: p === undefined ? DEFAULT_START.pullDeg : readPull(p),
  }
}
function readVariable(raw: unknown): string {
  const key = keyOf(raw)
  if (key === 'bob' || hasWord(key, ['bob']) ) return 'bob'
  if (hasWord(key, ['pull', 'angle', 'amplitude', 'release'])) return 'pull'
  if (hasWord(key, ['length']) || key === 'string') return 'length'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}
function readDirection(raw: unknown): string {
  const key = keyOf(raw)
  if (hasWord(key, ['slower', 'slow', 'slowly', 'longer', 'increase'])) return 'slower'
  if (hasWord(key, ['faster', 'fast', 'quicker', 'quick', 'quickly', 'shorter'])) return 'faster'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}

const EXAMPLE_MATCH = '{ "kind":"match", "targetCm":100, "start":{ "lengthCm":25, "bob":"steel", "pullDeg":10 } }'
const EXAMPLE_CHANGE = '{ "kind":"change", "direction":"slower", "start":{ "lengthCm":50, "bob":"wood", "pullDeg":5 } }'
const EXAMPLE_COMPARE = '{ "kind":"compare", "variable":"bob", "start":{ "lengthCm":75, "bob":"wood", "pullDeg":5 } }'

function faults(config: PendulumConfig): string[] {
  if (config.kind === 'other') {
    return [`Only three tasks are built: time one swing to a goal (${EXAMPLE_MATCH}), make it swing slower or faster (${EXAMPLE_CHANGE}) and compare two timings (${EXAMPLE_COMPARE}), not "${config.asked}". Use ${EXAMPLE_COMPARE}.`]
  }
  const out: string[] = []
  const s = config.start
  if (!isLength(s.lengthCm)) out.push(`The string starts at 25, 50, 75 or 100 cm, not ${s.lengthCm} cm: use "lengthCm":50.`)
  if (!isBob(s.bob)) out.push(`The bob is "wood" or "steel", not "${s.bob}": use "bob":"wood".`)
  if (!isPull(s.pullDeg)) out.push(`The bob is pulled back 5 or 10 degrees, not ${s.pullDeg} (a big swing breaks "the time does not depend on it"): use "pullDeg":10.`)
  if (config.kind === 'match') {
    if (!isLength(config.targetCm)) out.push(`The goal is the time of one of the four strings (25, 50, 75 or 100 cm), not ${config.targetCm} cm: use ${EXAMPLE_MATCH}.`)
    else if (config.targetCm === s.lengthCm) out.push(`The goal is already met by the start (${s.lengthCm} cm), so there is nothing to do: use ${EXAMPLE_MATCH}.`)
  } else if (config.kind === 'change') {
    if (config.direction !== 'slower' && config.direction !== 'faster') out.push(`The direction is "slower" or "faster", not "${config.direction}": use ${EXAMPLE_CHANGE}.`)
    else if (config.direction === 'slower' && s.lengthCm === 100) out.push(`Nothing is longer than a 1 m string, so it cannot be made slower: start at 75 cm or less, e.g. ${EXAMPLE_CHANGE}, or use "faster".`)
    else if (config.direction === 'faster' && s.lengthCm === 25) out.push(`Nothing is shorter than a 25 cm string, so it cannot be made faster: start at 50 cm or more, e.g. "direction":"faster" from 50 cm, or use "slower".`)
  } else if (config.variable !== 'bob' && config.variable !== 'pull' && config.variable !== 'length') {
    out.push(`Only the bob, the pull-back and the string length can be compared, not "${config.variable}": use ${EXAMPLE_COMPARE}.`)
  }
  return out
}

// ---------------------------------------------------------------------------
// Prompts.

/** The answer-giving words: the string, which way it goes, "only one thing matters". */
const STRING_TELLS = [/\bstrings?\b/i, /\blengths?\b/i, /\blengthen(?:s|ed|ing)?\b/i, /\bshorten(?:s|ed|ing)?\b/i, /\b\d+(?:\.\d+)?\s*(?:cm|centimet(?:re|er)s?|m|metres?|meters?)\b/i, /\b(?:metre|meter)\b/i]
const DIRECTION_TELLS = [/\blong(?:er)?\b/i, /\bshort(?:er)?\b/i]
const IDEA_TELLS = [/\bonly one thing\b/i, /\bno difference\b/i, /\b(?:doesn't|does not|don't|do not|won't|will not)\s+(?:change|matter|affect)\b/i, /\bindependent\b/i, /\bdepends?\b/i, /\bconstant\b/i]
const ALL_TELLS = [/\bformula\b/i, /2\s*π|\b2\s*pi\b/i, /√/, /\bg\b/, /\bperiod depends\b/i]

export const EXAMPLES: { prompt: string; config: PendulumConfig }[] = [
  {
    prompt: 'Make a pendulum that takes 2.01 s for one complete swing. Change whatever you think matters, press Release, and let the stopwatch time ten swings.',
    config: { kind: 'match', targetCm: 100, start: { lengthCm: 25, bob: 'steel', pullDeg: 10 } },
  },
  {
    prompt: 'This pendulum swings a little too fast. Make it swing more slowly: change one thing, then press Release to time it.',
    config: { kind: 'change', direction: 'slower', start: { lengthCm: 50, bob: 'wood', pullDeg: 5 } },
  },
  {
    prompt: 'Does a heavier bob swing faster? Time the pendulum with the wooden bob and with the steel bob, changing nothing else.',
    config: { kind: 'compare', variable: 'bob', start: { lengthCm: 75, bob: 'wood', pullDeg: 5 } },
  },
  {
    prompt: 'Does pulling the bob back further make each swing take longer? Time it pulled back 5° and 10°, keeping everything else the same.',
    config: { kind: 'compare', variable: 'pull', start: { lengthCm: 100, bob: 'steel', pullDeg: 5 } },
  },
]

function promptFaults(config: PendulumConfig, prompt: string): string[] {
  const text = prompt.replace(/\s+/g, ' ')
  const lists = [ALL_TELLS]
  if (config.kind === 'match' || config.kind === 'change') lists.push(STRING_TELLS, DIRECTION_TELLS, IDEA_TELLS)
  else if (config.kind === 'compare') lists.push(STRING_TELLS, IDEA_TELLS, config.variable === 'length' ? DIRECTION_TELLS : [])
  const found = lists.flat().map((r) => text.match(r)?.[0]).filter((w): w is string => !!w)
  return found.length
    ? [`the prompt gives the answer away with ${found.map((w) => `"${w}"`).join(', ')}: say only the situation and the gesture, e.g. "${EXAMPLES[1].prompt}"`]
    : []
}

const catalogue = EXAMPLES.map((e, i) => `  ${i === 0 ? '   ' : 'or '}${JSON.stringify(e.config)}  -- the prompt says "${e.prompt}"`).join('\n')

export const pendulumEngine: SceneEngine<PendulumConfig, PendulumState> = {
  id: 'pendulum',
  covers: ['pendulums', 'the simple pendulum', 'period of a pendulum', 'investigating a pendulum', 'timing oscillations', 'what affects the swing of a pendulum'],
  phrases: ['pendulum', 'simple pendulum', 'period', 'time period', 'one complete swing', 'oscillation', 'bob', 'time ten swings', 'length of the string'],
  notFor: [
    'springs', "hooke's law", 'hookes law', 'mass-spring oscillators', 'waves', 'frequency', 'energy stores', 'energy transfers', 'energy transfer', 'kinetic energy', 'gravitational potential energy',
    'planning a fair test', 'fair test', 'fair tests', 'clocks', 'telling the time', 'telling time',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawKind = first(o, ['kind', 'task', 'type', 'mode'])
    const start = readStart(o)
    const target = first(o, ['targetCm', 'target', 'goal', 'targetLength'])
    const direction = first(o, ['direction', 'change'])
    const variable = first(o, ['variable', 'test', 'tested', 'investigate'])
    let kind: 'match' | 'change' | 'compare' | 'other' | null = null
    if (rawKind !== undefined) {
      const key = keyOf(rawKind)
      if (hasWord(key, ['match', 'target', 'goal', 'hit', 'time'])) kind = 'match'
      else if (hasWord(key, ['change', 'slower', 'faster', 'slow', 'fast', 'direction'])) kind = 'change'
      else if (hasWord(key, ['compare', 'investigate', 'investigation', 'fair', 'variable', 'test'])) kind = 'compare'
      else kind = 'other'
    } else if (variable !== undefined) kind = 'compare'
    else if (target !== undefined && typeof target === 'number') kind = 'match'
    else if (direction !== undefined) kind = 'change'
    if (kind === null) return null
    if (kind === 'other') return { kind: 'other', asked: String(rawKind), start }
    if (kind === 'match') return { kind: 'match', targetCm: target === undefined ? -1 : readLength(target), start }
    if (kind === 'change') return { kind: 'change', direction: direction === undefined ? '' : readDirection(direction), start }
    return { kind: 'compare', variable: variable === undefined ? '' : readVariable(variable), start }
  },

  faults,
  promptFaults,

  initial(config) {
    const start = startOf(config)
    return { ...start, phase: 'set', runId: 0, runs: [] }
  },

  check(config, state) {
    const ok = done(config, state)
    return { ok, wrongIds: ok ? [] : ['run'] }
  },

  solve(config) {
    const start = startOf(config)
    if (config.kind === 'match') {
      const that = { ...start, lengthCm: config.targetCm as LengthCm }
      return { ...that, phase: 'timed', runId: 1, runs: [that] }
    }
    if (config.kind === 'change') {
      const that = { ...start, lengthCm: (config.direction === 'faster' ? 25 : 100) as LengthCm }
      return { ...that, phase: 'timed', runId: 2, runs: [start, that] }
    }
    let that: Setup = start
    if (config.kind === 'compare') {
      if (config.variable === 'bob') that = { ...start, bob: start.bob === 'wood' ? 'steel' : 'wood' }
      else if (config.variable === 'pull') that = { ...start, pullDeg: start.pullDeg === 5 ? 10 : 5 }
      else that = { ...start, lengthCm: (start.lengthCm === 100 ? 75 : start.lengthCm + 25) as LengthCm }
    }
    return { ...that, phase: 'timed', runId: 2, runs: [start, that] }
  },

  View: PendulumView,

  prompt: `SCENE "pendulum" -- a school pendulum on a clamp stand beside a metre rule, with a stopwatch, a pencil tally and a results notebook. The learner sets the string (25 cm, 50 cm, 75 cm, 1 m), the bob (wooden 50 g or steel 500 g, both the same size) and the pull-back (5 or 10 degrees), presses Release, and the card times ten complete swings (the bob comes back to the dashed release point ten times, a tally stroke for each), then divides by ten to give one swing. Every timing is written in the notebook, so settings can be compared side by side. Only the string changes the time (1.00, 1.42, 1.74 and 2.01 s a swing); the bob and the pull-back do not.
  Tasks: "match" (time one swing to a goal time in seconds), "change" (make it swing more slowly or more quickly than it does at the start), "compare" (time it with each bob, each pull-back or two strings, changing one thing at a time, to find what matters).
  For: pendulums, the simple pendulum, the period of a pendulum, investigating a pendulum, timing oscillations, what affects the swing. It answers "a heavier bob swings faster", "a bigger swing takes longer" and "a pendulum's time depends on the bob".
  Before marking the card shows the setting, a caption, the goal and "One swing" readout and the notebook, and never says right or wrong. The prompt must say the situation and the gesture, with the goal as a time or a question about the bob or pull-back: do NOT name the string, its length, "longer" or "shorter" for match and change, any length in cm or m, "only one thing matters", the formula, or that something makes no difference.
  Not drawn: springs, energy stores, frequency, pendulum clocks, a swing angle above 10 degrees, other strings than 25, 50, 75 and 100 cm.
  config examples (start is the first setting shown; omit it for 50 cm, wood, 5 degrees):
${catalogue}
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${EXAMPLES[1].prompt}",
    "payload": { "engine":"pendulum", "config": ${JSON.stringify(EXAMPLES[1].config)} },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:pendulum", "why":"..." } }`,
}

registerEngine(pendulumEngine as SceneEngine<unknown, unknown>)
