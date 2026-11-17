// lib/studylab/engines/telling-time/config.ts
//
// A geared teaching clock. The learner turns one thing, the long minute hand; the short hour hand
// follows at exactly hour + minute/60, as it does on a real clock. The digital readout follows too.
//   set     -- make a given 12-hour or 24-hour time;
//   elapsed -- move forward from a start time to an end time, with the minutes passed kept live.
// All times are whole minutes from midnight. Marking reads that integer, never an SVG angle.
//
// Teaching sources: NRICH's Two Clocks (an analogue face is two superimposed scales),
// https://nrich.maths.org/problems/two-clocks ; Visnos's linked-hand teaching clock,
// https://visnos.com/demos/clock ; Jillian Starr on geared clocks and counting on to an hour,
// https://jillianstarrteaching.com/elapsed-time/ . No code or artwork is copied.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { TellingTimeView } from './View'

export type TimeFormat = '12' | '24'
export type TimeConfig =
  | { task: 'set'; target: number; format: TimeFormat }
  | { task: 'elapsed'; start: number; end: number }
export type TimeState = { minutes: number }

export const DAY = 1440
export const HALF_DAY = 720
export const MAX_ELAPSED = 360
/** A set card opens 45 minutes away: a clear move, never a near miss. */
export const SET_BACK = 45

export const mod = (n: number, m: number) => ((n % m) + m) % m
export const wall = (minutes: number) => mod(minutes, HALF_DAY)
export const elapsedOf = (config: Extract<TimeConfig, { task: 'elapsed' }>) => mod(config.end - config.start, DAY)
export const currentOf = (config: TimeConfig, state: TimeState): number =>
  config.task === 'set' ? mod(readMinutes(state, 0), DAY) : mod(config.start + readMinutes(state, 0), DAY)

/** Stored work is read defensively. The initial state is supplied separately by initial(). */
export function readMinutes(state: unknown, fallback: number): number {
  const n = (state as { minutes?: unknown } | null)?.minutes
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(-60, Math.min(1500, Math.round(n))) : fallback
}

export const two = (n: number) => String(n).padStart(2, '0')
export function digital(minutes: number, format: TimeFormat): string {
  const at = mod(Math.round(minutes), DAY)
  const h = Math.floor(at / 60)
  const m = at % 60
  if (format === '24') return `${two(h)}:${two(m)}`
  const suffix = h < 12 ? 'am' : 'pm'
  return `${h % 12 || 12}:${two(m)} ${suffix}`
}

/** The usual classroom wording, including minutes to the next hour. */
export function timeWords(minutes: number): string {
  const at = wall(minutes)
  const h = Math.floor(at / 60)
  const m = at % 60
  const here = h || 12
  const next = (h + 1) % 12 || 12
  if (m === 0) return `${here} o'clock`
  if (m === 15) return `quarter past ${here}`
  if (m === 30) return `half past ${here}`
  if (m === 45) return `quarter to ${next}`
  if (m < 30) return `${m} minute${m === 1 ? '' : 's'} past ${here}`
  return `${60 - m} minute${m === 59 ? '' : 's'} to ${next}`
}

export function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hs = h ? `${h} hour${h === 1 ? '' : 's'}` : ''
  const ms = m ? `${m} minute${m === 1 ? '' : 's'}` : ''
  return h && m ? `${hs} ${ms}` : hs || ms || '0 minutes'
}

/** The marked explanation, including the exact count across an hour where there is one. */
export function working(config: TimeConfig): string {
  if (config.task === 'set') {
    const target = config.target
    const words = timeWords(target)
    const tip = target % 60 === 0
      ? 'The minute hand points to 12.'
      : `The hour hand has passed ${Math.floor(wall(target) / 60) || 12}.`
    return `Yes. ${words.charAt(0).toUpperCase() + words.slice(1)} is ${digital(target, config.format)}. ${tip}`
  }
  const duration = elapsedOf(config)
  const endHour = Math.ceil(config.start / 60) * 60
  const first = Math.min(duration, Math.max(0, endHour - config.start))
  const rest = duration - first
  const count = first > 0 && rest > 0
    ? ` Count on ${durationText(first)} to ${digital(endHour, '24')}, then ${durationText(rest)}.`
    : ' Both hands move together.'
  return `Yes. ${durationText(duration)} passes.${count}`
}

export function madeText(config: TimeConfig, state: TimeState): string {
  const current = currentOf(config, state)
  if (config.task === 'set') {
    return `You set ${digital(current, config.format)}: ${timeWords(current)}. The hour hand shows the hour already passed.`
  }
  const passed = readMinutes(state, 0)
  return `You moved forward ${durationText(passed)} to ${digital(current, '24')}. Keep turning to ${digital(config.end, '24')}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's ordinary time language.

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().toLowerCase().replace(/[’']/g, '').replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-z0-9:]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

const SMALL_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
}
function numberWord(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw)
  const parts = raw.split('-').filter(Boolean)
  if (parts.length === 1 && own(SMALL_NUMBERS, parts[0])) return SMALL_NUMBERS[parts[0]]
  if (parts.length === 2 && (parts[0] === 'twenty' || parts[0] === 'thirty' || parts[0] === 'forty' || parts[0] === 'fifty') && own(SMALL_NUMBERS, parts[1])) {
    return SMALL_NUMBERS[parts[0]] + SMALL_NUMBERS[parts[1]]
  }
  return null
}

/** A clock time in minutes from midnight. Out-of-range values survive parse so faults can suggest a fix. */
export function readTime(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const text = raw.trim().toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').replace(/\./g, ':')
  if (!text) return null
  let m = /^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/.exec(text)
  if (m) {
    const h = Number(m[1])
    const mins = Number(m[2])
    if (m[3]) return hWithSuffix(h, m[3] as 'am' | 'pm') + mins
    // The half marks an unreadable minute count for faults; 13:70 must not become a valid 14:10.
    return h * 60 + mins + (mins > 59 ? 0.5 : 0)
  }
  m = /^(\d{1,2})\s*(am|pm)$/.exec(text)
  if (m) return hWithSuffix(Number(m[1]), m[2] as 'am' | 'pm')
  m = /^(\d{1,2}|twelve)\s*o'?clock(?:\s*(am|pm))?$/.exec(text)
  if (m) {
    const h = m[1] === 'twelve' ? 12 : Number(m[1])
    return m[2] ? hWithSuffix(h, m[2] as 'am' | 'pm') : h * 60
  }
  m = /^(half|quarter)\s+(past|to)\s+(\d{1,2}|twelve)(?:\s*(am|pm))?$/.exec(text)
  if (m) {
    const h = m[3] === 'twelve' ? 12 : Number(m[3])
    const base = m[4] ? hWithSuffix(h, m[4] as 'am' | 'pm') : h * 60
    if (base === null) return null
    const mins = m[1] === 'half' ? 30 : 15
    return m[2] === 'past' ? base + mins : base - mins
  }
  m = /^([a-z0-9-]+)\s+minutes?\s+(past|to)\s+(\d{1,2}|twelve)(?:\s*(am|pm))?$/.exec(text)
  if (m) {
    const mins = numberWord(m[1])
    if (mins === null) return null
    const h = m[3] === 'twelve' ? 12 : Number(m[3])
    const base = m[4] ? hWithSuffix(h, m[4] as 'am' | 'pm') : h * 60
    if (base === null) return null
    return m[2] === 'past' ? base + mins : base - mins
  }
  // "half past three" and friends: hour names, not only digits.
  m = /^(half|quarter)\s+(past|to)\s+([a-z]+)(?:\s*(am|pm))?$/.exec(text)
  if (m) {
    const h = numberWord(m[3])
    if (h === null || h < 1 || h > 12) return null
    const base = m[4] ? hWithSuffix(h, m[4] as 'am' | 'pm') : h * 60
    const mins = m[1] === 'half' ? 30 : 15
    return m[2] === 'past' ? base! + mins : base! - mins
  }
  return null
}

function hWithSuffix(h: number, suffix: 'am' | 'pm'): number {
  if (h >= 1 && h <= 12) return (h % 12) * 60 + (suffix === 'pm' ? HALF_DAY : 0)
  // Deliberately retain a bad hour as out of range for a useful fault.
  return (h - (suffix === 'pm' ? 12 : 0)) * 60
}

const TASK_WORDS: Record<string, TimeConfig['task']> = {
  set: 'set', 'set-clock': 'set', 'set-the-clock': 'set', show: 'set', 'show-time': 'set', 'make-time': 'set',
  'tell-time': 'set', 'telling-time': 'set', analogue: 'set', digital: 'set', 'digital-time': 'set', '24-hour': 'set', '12-hour': 'set',
  elapsed: 'elapsed', 'elapsed-time': 'elapsed', interval: 'elapsed', intervals: 'elapsed', 'time-interval': 'elapsed',
  'time-intervals': 'elapsed', duration: 'elapsed', 'count-on': 'elapsed', 'time-passed': 'elapsed', 'time-passing': 'elapsed',
}

function readFormat(raw: unknown, target: number): TimeFormat | null {
  if (raw === undefined || raw === null || raw === '') return target >= 720 || target < 0 ? '24' : '12'
  const k = keyOf(raw).replace(/-?clock$/, '').replace(/-?format$/, '').replace(/-?hour$/, '')
  if (k === '12' || k === 'am-pm' || k === '12h') return '12'
  if (k === '24' || k === '24h' || k === 'twenty-four') return '24'
  return null
}

function validTime(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < DAY && n % 60 < 60
}
const exampleSet = (format: TimeFormat = '12') => `{ "task":"set", "target":"3:30 pm", "format":"${format}" }`
const exampleElapsed = '{ "task":"elapsed", "start":"09:45", "end":"11:20" }'

function goodPrompt(config: TimeConfig): string {
  return config.task === 'set'
    ? `Drag the orange grip on the minute hand to set ${digital(config.target, config.format)}. Use − or + for one minute at a time.`
    : `Drag the orange grip on the minute hand forward from ${digital(config.start, '24')} to ${digital(config.end, '24')}. Watch the time passed.`
}

export const tellingTimeEngine: SceneEngine<TimeConfig, TimeState> = {
  id: 'telling-time',
  // No bare "time": it catches every distance-time graph, reaction time and historical timeline.
  covers: ['analogue', 'horology'],
  phrases: [
    'telling time', 'telling the time', 'tell the time', 'read the time', 'reading the time', 'time telling',
    'analog clock', 'analog clocks', 'analogue clock', 'analogue clocks', 'analogue and digital', 'analog and digital',
    'reading a clock', 'reading clocks', 'read a clock', 'read clocks', 'clock face', 'clock faces', 'clock hands',
    'oclock', 'o clock', 'half past', 'quarter past', 'quarter to', 'minutes past', 'minutes to',
    '12-hour clock', '12 hour clock', '24-hour clock', '24 hour clock', '12-hour time', '24-hour time', 'am and pm', 'am pm',
    'digital time', 'digital clocks and analogue', 'analogue and digital time', 'analog and digital time',
    'time interval', 'time intervals', 'elapsed time', 'time elapsed', 'passing time', 'time passing', 'duration of time',
  ],
  notFor: [
    'speed distance time', 'distance speed time', 'distance-time', 'speed-time', 'velocity time', 'motion graph', 'travel graph',
    'timeline', 'historical time', 'history timeline', 'dates and events', 'geological time',
    'clock angles', 'angles on a clock', 'clockwise and anticlockwise', 'turns and angles', 'rotation', 'transformations',
    'cpu clock', 'clock cycles', 'clock speed', 'body clock', 'biological clock', 'circadian', 'reaction time', 'half-life',
    'digital conversion', 'converting analogue', 'sampling rate', 'analogue sensors', 'analogue meters',
    'analogue signal', 'analogue signals', 'analogue electronics', 'analogue circuits',
  ],
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    if (word && !own(TASK_WORDS, word)) return null
    const task = own(TASK_WORDS, word) ? TASK_WORDS[word]
      : first(src, ['start', 'from']) !== undefined ? 'elapsed'
        : first(src, ['target', 'time', 'show']) !== undefined ? 'set' : null
    if (!task) return null
    if (task === 'set') {
      const target = readTime(first(src, ['target', 'time', 'show', 'value', 'at']))
      if (target === null) return null
      const format = readFormat(first(src, ['format', 'clock', 'display', 'hour']) ?? first(o, ['format', 'clock', 'display', 'hour']), target)
      return format ? { task, target, format } : null
    }
    const start = readTime(first(src, ['start', 'from', 'begin']))
    const end = readTime(first(src, ['end', 'to', 'finish', 'until']))
    return start === null || end === null ? null : { task, start, end }
  },

  faults(config) {
    if (config.task === 'set') {
      if (!validTime(config.target)) {
        return [`${config.target} is not a time this one-day clock can show: use 00:00 to 23:59 with minutes below 60, e.g. ${exampleSet(config.format)}.`]
      }
      return []
    }
    if (!validTime(config.start) || !validTime(config.end)) {
      return [`The start and end must be real one-day times from 00:00 to 23:59, with minutes below 60: use e.g. ${exampleElapsed}.`]
    }
    const duration = elapsedOf(config)
    if (duration === 0) return [`The start and end are the same, so no time passes: use two different times, e.g. ${exampleElapsed}.`]
    if (duration > MAX_ELAPSED) return [`That interval is ${durationText(duration)}, longer than the six hours this card is for: use e.g. ${exampleElapsed}.`]
    return []
  },

  promptFaults(config, prompt) {
    const out: string[] = []
    const example = goodPrompt(config)
    if (/\b(?:hour hand|short hand)\s+(?:to|at|on|between|points?|halfway)\b|\bminute hand\s+(?:to|at|on|points?)\s+(?:the\s+)?\d+\b/i.test(prompt)) {
      out.push(`the prompt says where a hand belongs, which the learner is to work out -- name only the time and the gesture ("${example}")`)
    }
    if (/\b(?:drag|move|turn)\s+(?:the\s+)?(?:hour|short)\s+hand\b|\bsecond hand\b|\btimetable\b|\bstopwatch\b|\bangles?\b|\bprotractor\b/i.test(prompt)) {
      out.push(`the prompt promises a control or picture this card does not have: only the orange minute-hand grip moves, and both hands are linked -- ask for that ("${example}")`)
    }
    if (config.task === 'elapsed') {
      const d = elapsedOf(config)
      const h = Math.floor(d / 60)
      const m = d % 60
      const forms = [`${d} minutes`, `${d} minute`, h && m ? `${h} hours? ${m} minutes?` : '', h && !m ? `${h} hours?` : '', !h ? `${m} minutes?` : '']
      if (forms.some((f) => f && new RegExp(`\\b${f}\\b`, 'i').test(prompt))) {
        out.push(`the prompt gives the interval away: the learner is to see how much time passes -- give only the start and end ("${example}")`)
      }
    }
    return out
  },

  initial(config) {
    return { minutes: config.task === 'set' ? config.target - SET_BACK : 0 }
  },

  check(config, state) {
    const minutes = (state as { minutes?: unknown } | null)?.minutes
    const wanted = config.task === 'set' ? config.target : elapsedOf(config)
    return { ok: typeof minutes === 'number' && Number.isInteger(minutes) && minutes === wanted, wrongIds: [] }
  },

  solve(config) {
    return { minutes: config.task === 'set' ? config.target : elapsedOf(config) }
  },

  View: TellingTimeView,

  prompt: `SCENE "telling-time" -- a real geared teaching clock on a quiet light panel, with numbered hours, minute ticks, a short dark hour hand and a long blue minute hand with an orange grip. Turning the orange grip moves the minute hand; the hour hand creeps between the numbers with it, exactly as hour + minute/60. A digital readout follows the hands. Before marking the card shows the learner's own time and live measure, never a target hand position or whether it is right.
  For: setting and reading analogue clocks, the linked hour and minute hands, o'clock/half past/quarter past/quarter to and individual minutes, matching 12-hour digital time with am/pm or 24-hour time, and short elapsed-time intervals including crossing an hour. The act is always turning the minute hand; − and + move one minute, and arrow keys work too (Page Up/Down move 15 minutes).
  task "set": target is the time to make, format is "12" (e.g. 3:30 pm) or "24" (e.g. 15:30). The target is named on the card as the goal. The clock starts 45 minutes away.
  task "elapsed": start and end are given on the card; the learner turns forward from start to end. The live "Time passed" measure counts hours and minutes. It handles 1 minute to 6 hours, including running past midnight. An earlier end means the following day. Marking gives the exact interval and a count-on step through the next hour.
  Write ordinary target times: "3:30 pm", "15:30", "half past 3", "quarter to 8", "twenty-five minutes past 3", or a whole number of minutes from midnight. Start/end accept the same forms. Do not use for reading-only quizzes, independent hand placement, second hands, clock angles, timetables, dates/history, or speed/distance/time.
  The prompt must name the goal and the gesture, but must not say where either hand points or how far apart they are. For elapsed, do not print the interval duration. No separate answer clock is shown; the learner's own hands are the answer.
  config: { "task":"set", "target":"3:30 pm", "format":"12" } -- prompt: "Drag the orange grip on the minute hand to set 3:30 pm. Use − or + for one minute at a time."
       or { "task":"set", "target":"15:45", "format":"24" } -- prompt: "Drag the orange grip on the minute hand to set 15:45. Use − or + for one minute at a time."
       or { "task":"elapsed", "start":"09:45", "end":"11:20" } -- prompt: "Drag the orange grip on the minute hand forward from 09:45 to 11:20. Watch the time passed."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the orange grip on the minute hand to set 3:30 pm. Use − or + for one minute at a time.",
    "payload": { "engine":"telling-time", "config": { "task":"set", "target":"3:30 pm", "format":"12" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:telling-time", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the orange grip on the minute hand to set 15:45. Use − or + for one minute at a time.",
    "payload": { "engine":"telling-time", "config": { "task":"set", "target":"15:45", "format":"24" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:telling-time", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the orange grip on the minute hand forward from 09:45 to 11:20. Watch the time passed.",
    "payload": { "engine":"telling-time", "config": { "task":"elapsed", "start":"09:45", "end":"11:20" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:telling-time", "why":"..." } }`,
}

registerEngine(tellingTimeEngine as SceneEngine<unknown, unknown>)
