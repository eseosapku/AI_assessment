// lib/studylab/engines/motion/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MotionView } from './View'

/**
 * One runner on one straight track, and the distance-time graph its journey
 * draws. The journey is a few stages: away at a steady speed, at rest, or back
 * towards the start. Everything is whole metres and whole seconds, so marking
 * is integer arithmetic and never compares floats.
 *
 * Sources for the facts: speed = distance / time, and the gradient of a
 * distance-time graph is the speed (a flat line is at rest, a falling line is
 * a return); the Cambridge IGCSE Physics 0625 and Combined Science 0653
 * syllabi, topic "Motion" (1.2), and the England KS3/GCSE motion topics. The
 * "graph is not a picture of the journey" misconception is documented by the
 * Institute of Physics SPARK note on graph-as-picture errors.
 */

export type StageKind = 'out' | 'rest' | 'back'
export type Stage = { kind: StageKind; seconds: number; speed: number }
export type TaskKind = 'walk-graph' | 'walk-story' | 'read-speed'
/** `ask` is the 1-based stage whose speed a read-speed task asks for. */
export type MotionConfig = { task: { kind: TaskKind; stages: Stage[]; ask?: number } }
/**
 * The learner's work. A walk keeps the runner's recorded position at each whole
 * second (`d[0]` is the start) and where the runner is now (`at`); a read keeps
 * the two flags (in whole seconds) and the speed chosen.
 */
export type MotionState = { d?: number[]; at?: number; a?: number; b?: number; answer?: number | null }

export const KINDS: TaskKind[] = ['walk-graph', 'walk-story', 'read-speed']
/** What a journey may be, so it fits a card and a syllabus (metres and seconds). */
export const LIMITS = { stages: 4, minSeconds: 2, maxSeconds: 6, totalSeconds: 12, maxSpeed: 4, maxMetres: 12 }
/** A recorded second passes when it is within this many metres of the journey (or of where it was half a second either side). */
export const TOLERANCE_METRES = 1

const key = (v: unknown) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z]/g, '') : '')
const KIND_WORDS: Record<string, TaskKind> = {
  walkgraph: 'walk-graph', walkthegraph: 'walk-graph', matchthegraph: 'walk-graph', matchgraph: 'walk-graph', walk: 'walk-graph',
  walkstory: 'walk-story', walkthestory: 'walk-story', readthestory: 'walk-story', story: 'walk-story', tellthestory: 'walk-story',
  readspeed: 'read-speed', measurespeed: 'read-speed', speedfromgraph: 'read-speed', findspeed: 'read-speed', readgradient: 'read-speed',
}
const STAGE_WORDS: Record<string, StageKind> = {
  out: 'out', away: 'out', forward: 'out', forwards: 'out', steady: 'out', outward: 'out', go: 'out', walk: 'out', run: 'out', moving: 'out', move: 'out',
  rest: 'rest', stop: 'rest', stopped: 'rest', still: 'rest', stay: 'rest', pause: 'rest', stand: 'rest', standing: 'rest', stationary: 'rest',
  back: 'back', return: 'back', returns: 'back', backwards: 'back', home: 'back', comeback: 'back', comingback: 'back', returning: 'back',
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/−/g, '-'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function readStage(raw: unknown): Stage | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const kind = STAGE_WORDS[key(r.kind ?? r.move ?? r.type ?? r.stage)]
  const seconds = num(r.seconds ?? r.time ?? r.duration ?? r.for ?? r.s)
  if (!kind || seconds === null || seconds <= 0) return null
  if (kind === 'rest') return { kind, seconds, speed: 0 }
  const speed = num(r.speed ?? r.rate ?? r.mps)
  return speed !== null && speed > 0 ? { kind, seconds, speed } : null
}

/** Positions in metres at each whole second, 0 to the end. */
export function positionsOf(stages: Stage[]): number[] {
  const out = [0]
  for (const s of stages) {
    const sign = s.kind === 'out' ? 1 : s.kind === 'back' ? -1 : 0
    for (let i = 0; i < s.seconds; i++) out.push(out[out.length - 1] + sign * s.speed)
  }
  return out
}
export const totalSeconds = (stages: Stage[]) => stages.reduce((n, s) => n + s.seconds, 0)
/** Where each stage starts and ends, in seconds. */
export function stageSpans(stages: Stage[]): { from: number; to: number }[] {
  let t = 0
  return stages.map((s) => ({ from: t, to: (t += s.seconds) }))
}
/** The scale of the track and graph: the top of the distance axis, in even metres, at least 6. */
export function trackLength(stages: Stage[]): number {
  return Math.max(6, 2 * Math.ceil(Math.max(...positionsOf(stages)) / 2))
}
/** The stage a read-speed task asks about: the one named, or the first that moves. */
export function askedIndex(config: MotionConfig): number {
  const { stages, ask } = config.task
  if (typeof ask === 'number' && Number.isInteger(ask) && ask >= 1 && ask <= stages.length) return ask - 1
  const i = stages.findIndex((s) => s.kind !== 'rest')
  return i < 0 ? 0 : i
}

/** How a stage is said once marked. */
export function stageName(s: Stage): string {
  if (s.kind === 'rest') return 'stopped'
  return `${s.kind === 'out' ? 'away' : 'coming back'} at ${s.speed} m/s`
}
/** The journey in words, for the story task (a question, not an answer). */
export function storyLines(stages: Stage[]): string[] {
  return stages.map((s) =>
    s.kind === 'rest' ? `Stops for ${s.seconds} s`
      : `${s.kind === 'out' ? 'Runs away from the start' : 'Comes back towards the start'} at ${s.speed} m/s for ${s.seconds} s`)
}

/* ---- marking: integer arithmetic in half-metres and half-seconds ---- */

/** The journey's position at half-second `t2` (in half-seconds), doubled so it stays whole. */
function doubledAt(pos: number[], t2: number): number {
  const i = Math.floor(t2 / 2)
  return t2 % 2 === 0 ? 2 * pos[i] : pos[i] + pos[i + 1]
}

/**
 * How far, in half-metres, a recorded position is from the journey at whole
 * second `i`: zero when it lies between what the journey is half a second
 * before and half a second after (so a hand a little early or late is fair).
 */
export function missHalfMetres(pos: number[], i: number, metres: number): number {
  const last = 2 * (pos.length - 1)
  const here = [2 * i - 1, 2 * i, 2 * i + 1].filter((t2) => t2 >= 0 && t2 <= last).map((t2) => doubledAt(pos, t2))
  const lo = Math.min(...here)
  const hi = Math.max(...here)
  const m2 = 2 * metres
  return Math.max(0, lo - m2, m2 - hi)
}

const wholeMetres = (v: unknown, top: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= top

/** The first recorded second that is off the journey, if any: its time, where the learner was, where the journey is. */
export function firstMiss(stages: Stage[], d: number[]): { second: number; was: number; wanted: number } | null {
  const pos = positionsOf(stages)
  for (let i = 1; i < d.length && i < pos.length; i++) {
    if (missHalfMetres(pos, i, d[i]) > 2 * TOLERANCE_METRES) return { second: i, was: d[i], wanted: pos[i] }
  }
  return null
}

/** What the learner made, said plainly, for when a walk is marked wrong. */
export function missSentence(stages: Stage[], d: number[]): string {
  const total = totalSeconds(stages)
  if (d.length < total + 1) return `You stopped at ${d.length - 1} s; the journey runs for ${total} s`
  const m = firstMiss(stages, d)
  if (!m) return ''
  const diff = m.was - m.wanted
  return `At ${m.second} s you were at ${m.was} m; the journey is at ${m.wanted} m (${Math.abs(diff)} m ${diff > 0 ? 'ahead' : 'behind'})`
}

/** A walk's recorded seconds, cleaned: whole metres on the track. */
export function recorded(state: MotionState | undefined, top: number): number[] {
  const d = Array.isArray(state?.d) ? state!.d : [0]
  return d.every((v) => wholeMetres(v, top)) && d.length > 0 ? d : [0]
}

function readKindOf(raw: unknown): TaskKind | null {
  const k = key(raw)
  return KIND_WORDS[k] ?? null
}

export const motionEngine: SceneEngine<MotionConfig, MotionState> = {
  id: 'motion',
  covers: ['velocity'],
  phrases: ['distance-time', 'speed distance', 'distance speed', 'speed and velocity', 'travel graph', 'travel graphs', 'motion graphs', 'calculating speed'],
  isolates: 'magnitude',

  parse(raw) {
    const task = (raw as { task?: Record<string, unknown> } | null)?.task
    if (!task || typeof task !== 'object') return null
    const kind = readKindOf(task.kind)
    const list = task.stages ?? task.journey
    if (!kind || !Array.isArray(list) || list.length < 1 || list.length > 12) return null
    const stages = list.map(readStage)
    if (stages.some((s) => !s)) return null
    const out: MotionConfig = { task: { kind, stages: stages as Stage[] } }
    if (kind === 'read-speed') {
      const ask = num(task.ask ?? task.stageNumber)
      if (ask !== null) out.task.ask = ask
    }
    return out
  },

  faults(config) {
    const { kind, stages } = config.task
    const f: string[] = []
    if (stages.length > LIMITS.stages) f.push(`a journey of ${stages.length} stages is more than a learner can follow (${LIMITS.stages}): use two or three stages`)
    stages.forEach((s, i) => {
      const n = i + 1
      if (!Number.isInteger(s.seconds) || s.seconds < LIMITS.minSeconds || s.seconds > LIMITS.maxSeconds)
        f.push(`stage ${n} lasts ${s.seconds} s: use a whole number of seconds from ${LIMITS.minSeconds} to ${LIMITS.maxSeconds}`)
      if (s.kind !== 'rest' && (!Number.isInteger(s.speed) || s.speed > LIMITS.maxSpeed))
        f.push(`stage ${n} has a speed of ${s.speed} m/s: use a whole number of m/s from 1 to ${LIMITS.maxSpeed}`)
      const p = stages[i - 1]
      if (p && p.kind === s.kind && p.speed === s.speed) f.push(`stages ${i} and ${n} are the same: join them into one longer stage`)
    })
    if (f.length) return f
    if (totalSeconds(stages) > LIMITS.totalSeconds) f.push(`the journey lasts ${totalSeconds(stages)} s, longer than the graph holds (${LIMITS.totalSeconds}): use shorter stages`)
    const pos = positionsOf(stages)
    if (Math.min(...pos) < 0) f.push('the runner would go back past the start, and the track starts there: use a shorter return or a longer way out')
    if (Math.max(...pos) > LIMITS.maxMetres) f.push(`the runner would reach ${Math.max(...pos)} m, past the end of the ${LIMITS.maxMetres} m track: use a lower speed or less time`)
    if (stages.every((s) => s.kind === 'rest')) f.push('the runner never moves, so the graph is a flat line and nothing is learnt: use at least one stage that moves')
    if (kind === 'read-speed') {
      const ask = config.task.ask
      if (ask !== undefined && !(Number.isInteger(ask) && ask >= 1 && ask <= stages.length)) f.push(`ask names stage ${ask} but the journey has ${stages.length}: use a stage from 1 to ${stages.length}`)
      else if (stages[askedIndex(config)].kind === 'rest') f.push('the stage asked about is a stop, which has no speed to read: use a stage that moves')
    }
    return f
  },

  promptFaults(config, prompt) {
    const { kind } = config.task
    const f: string[] = []
    // The tutor pictured a race on this card and said so: one runner, one journey, nothing to compare.
    if (/\b(two|three|four|several|multiple|many)\s+(runners?|journeys?|lines?|graphs?|objects?|people)\b|\bwhich\s+(runner|journey|line|graph|one)\b|\b(fastest|slowest)\b|\bcompare\b/i.test(prompt))
      f.push('this card has one runner and one journey, so it cannot show several to compare: ask about this one, e.g. "' + (kind === 'read-speed' ? 'How fast is the runner in the bold part?' : 'Hold the runner and move it so your graph follows the dashed path.') + '"')
    if (kind !== 'read-speed' && /\bwatch\b/i.test(prompt))
      f.push('nothing moves here by itself, the learner moves the runner: say so, e.g. "Hold the runner and move it so your graph follows the dashed path."')
    if (kind === 'read-speed') {
      if (/\d\s*(m\s*\/\s*s|metres? per second|meters? per second|ms-?1)/i.test(prompt))
        f.push('the prompt gives the speed away, which the learner is to measure from the graph: ask "How fast is the runner in the bold part?" without a number')
      if (/speed\s*=|distance\s*(÷|\/|divided by)\s*time|rise\s*(over|\/)\s*run|\bdivide\b/i.test(prompt))
        f.push('the prompt gives the method away (the formula): ask what the speed is, and let the learner work out how to find it from the triangle')
    }
    if (kind === 'walk-story' && /\b(flat|horizontal|steep|steeper|slope|slopes|sloping|straight line|line (goes|rises|falls|climbs))\b/i.test(prompt))
      f.push('the prompt describes the shape of the graph the learner is to make: ask them to tell the story with the runner, and leave the shape to the walk')
    return f
  },

  initial(config) {
    const { kind, stages } = config.task
    if (kind === 'read-speed') {
      const from = stageSpans(stages)[askedIndex(config)].from
      return { a: from, b: from, answer: null }
    }
    return { d: [0], at: 0 }
  },

  check(config, state) {
    const { kind, stages } = config.task
    if (kind === 'read-speed') {
      const i = askedIndex(config)
      const span = stageSpans(stages)[i]
      const { a, b, answer } = state ?? {}
      const on = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= span.from && v <= span.to
      const measured = on(a) && on(b) && Math.abs(a - b) >= 1
      return { ok: measured && typeof answer === 'number' && answer === stages[i].speed, wrongIds: [] }
    }
    const top = trackLength(stages)
    const total = totalSeconds(stages)
    const d = state?.d
    if (!Array.isArray(d) || d.length !== total + 1 || d[0] !== 0 || !d.every((v) => wholeMetres(v, top))) return { ok: false, wrongIds: [] }
    return { ok: firstMiss(stages, d) === null, wrongIds: [] }
  },

  solve(config) {
    const { kind, stages } = config.task
    if (kind === 'read-speed') {
      const i = askedIndex(config)
      const span = stageSpans(stages)[i]
      return { a: span.from, b: span.to, answer: stages[i].speed }
    }
    const d = positionsOf(stages)
    return { d, at: d[d.length - 1] }
  },

  View: MotionView,

  prompt: `SCENE "motion" -- one runner on a straight track (metres), and the distance-time graph of its journey beside it.
  The journey is 1 to 4 stages: "out" (away from the start at a steady speed), "rest" (stopped) or "back" (towards the
  start). In a walk task the learner holds the runner and moves it while the clock runs (arrow keys and Enter step it
  second by second), and the graph draws itself from what their hand did: stopping makes it flat, going faster makes
  it steeper, coming back makes it fall. Marked within 1 m (and half a second) at every second. In a read task the
  learner drags a flag along the bold part of a graph to make a rise-and-run triangle, then sets the speed.
  For: distance-time graphs, steady speed vs stopped vs coming back, speed as the steepness of the line, speed and
  velocity. The graph is not a picture of a hill: it is the runner's own movement over time.
  Before marking it shows only the axes, the runner and the target or story; it names no stage and no speed until marked.
  It is ONE runner on ONE journey: no race, no comparing runners, and nothing plays by itself. Say what the learner does with the runner.
  config: { "task": { "kind":"walk-graph | walk-story | read-speed",
            "stages":[ { "kind":"out | rest | back", "seconds":<whole 2-6>, "speed":<whole m/s 1-4; leave out for rest> } ],
            "ask":<read-speed only: which stage (1,2,3), a stage that moves; default the first that moves> } }
    Limits: at most 4 stages and 12 s in all; the runner stays between 0 and 12 m (a "back" never goes past the start).
    "walk-graph": the target graph is drawn dashed, and the learner walks it. Say in the prompt to hold the runner (the clock runs while it is held).
    "walk-story": the journey is told in words and the graph is blank until marked; the learner walks the story.
    "read-speed": the whole graph is shown, the asked stage in bold; the learner measures its steepness.
  Do not state a speed or the shape of the graph in the prompt of a read or story task (the card checks this).
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Hold the runner and move it so your graph follows the dashed path.",
    "payload": { "engine":"motion", "config": { "task": { "kind":"walk-graph", "stages":[ { "kind":"out", "seconds":3, "speed":2 }, { "kind":"rest", "seconds":2 }, { "kind":"back", "seconds":3, "speed":1 } ] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:motion", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"How fast is the runner in the bold part of the journey?",
    "payload": { "engine":"motion", "config": { "task": { "kind":"read-speed", "stages":[ { "kind":"out", "seconds":4, "speed":3 }, { "kind":"rest", "seconds":2 } ] } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:motion", "why":"..." } }`,
}

registerEngine(motionEngine as SceneEngine<unknown, unknown>)
