// lib/studylab/engines/particles/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ParticlesView } from './View'

export type MatterState = 'solid' | 'liquid' | 'gas'
export const STATES: readonly MatterState[] = ['solid', 'liquid', 'gas']

/** Melting and boiling points, °C, at standard pressure (wax: paraffin, a typical school sample). */
export const SUBSTANCES = {
  water: { name: 'water', melt: 0, boil: 100 },
  ethanol: { name: 'ethanol', melt: -114, boil: 78 },
  iron: { name: 'iron', melt: 1538, boil: 2862 },
  nitrogen: { name: 'nitrogen', melt: -210, boil: -196 },
  oxygen: { name: 'oxygen', melt: -218, boil: -183 },
  wax: { name: 'wax', melt: 60, boil: 370 },
  mercury: { name: 'mercury', melt: -39, boil: 357 },
  salt: { name: 'salt (sodium chloride)', melt: 801, boil: 1465 },
} as const
export type SubstanceId = keyof typeof SUBSTANCES

export type ParticlesConfig = { substance: SubstanceId; task: { kind: 'make-state'; state: MatterState } | { kind: 'explore' } }
/** The temperature the learner has set, °C; `seen` is the states passed through, for explore. */
export type ParticlesState = { temp: number; seen?: MatterState[] }

/** Absolute zero, °C. */
const ZERO = -273.15

export function stateAt(substance: SubstanceId, temp: number): MatterState {
  const s = SUBSTANCES[substance]
  return temp < s.melt ? 'solid' : temp < s.boil ? 'liquid' : 'gas'
}

/** Particles' average speed, relative: it goes as the square root of absolute temperature. */
export function meanSpeed(temp: number): number {
  return Math.sqrt(Math.max(0, temp - ZERO))
}

/** A step for the temperature slider that keeps it to about a hundred positions. */
export function stepFor(substance: SubstanceId): number {
  const [lo, hi] = range(substance)
  const span = hi - lo
  return [1, 2, 5, 10, 20, 50, 100].find((s) => span / s <= 120) ?? 100
}

/** The slider's range: from well below melting to well above boiling, never below absolute zero. */
export function range(substance: SubstanceId): [number, number] {
  const s = SUBSTANCES[substance]
  const margin = Math.max(20, (s.boil - s.melt) * 0.4)
  const snap = (v: number, up: boolean) => (up ? Math.ceil(v / 10) * 10 : Math.floor(v / 10) * 10)
  return [Math.max(snap(s.melt - margin, false), -270), snap(s.boil + margin, true)]
}

/** The middle of a state's band, on the slider's steps. */
function middleOf(substance: SubstanceId, state: MatterState): number {
  const s = SUBSTANCES[substance]
  const [lo, hi] = range(substance)
  const step = stepFor(substance)
  const mid = state === 'solid' ? (lo + s.melt) / 2 : state === 'liquid' ? (s.melt + s.boil) / 2 : (s.boil + hi) / 2
  return Math.round(mid / step) * step
}

const word = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase() : '')

export const particlesEngine: SceneEngine<ParticlesConfig, ParticlesState> = {
  id: 'particles',
  covers: ['states of matter', 'melting and boiling', 'the particle model', 'heating and particle motion', 'changes of state'],
  isolates: 'magnitude',

  parse(raw) {
    const r = raw as { substance?: unknown; task?: { kind?: unknown; state?: unknown } } | null
    const substance = word(r?.substance).split(/\s|\(/)[0] as SubstanceId
    if (!r || !Object.prototype.hasOwnProperty.call(SUBSTANCES, substance)) return null
    if (r.task?.kind === 'explore') return { substance, task: { kind: 'explore' } }
    const state = word(r.task?.state) as MatterState
    if (r.task?.kind !== 'make-state' || !STATES.includes(state)) return null
    return { substance, task: { kind: 'make-state', state } }
  },

  // Every config parse accepts can reach every state within its range (pinned by the tests).
  faults() {
    return []
  },

  initial(config) {
    if (config.task.kind === 'explore') return { temp: middleOf(config.substance, 'solid'), seen: ['solid'] }
    // A neighbouring state, so the learner has a change of state to make.
    const from: MatterState = config.task.state === 'liquid' ? 'solid' : 'liquid'
    return { temp: middleOf(config.substance, from), seen: [] }
  },

  check(config, state) {
    if (config.task.kind === 'explore') return { ok: new Set(state.seen ?? []).size >= 3, wrongIds: [] }
    return { ok: stateAt(config.substance, state.temp) === config.task.state, wrongIds: [] }
  },

  solve(config) {
    return config.task.kind === 'explore' ? { temp: middleOf(config.substance, 'gas'), seen: [...STATES] } : { temp: middleOf(config.substance, config.task.state) }
  },

  View: ParticlesView,

  prompt: `SCENE "particles" -- a box of a substance's particles at the temperature the learner sets: packed in a
  regular pattern and vibrating (solid), close but sliding past each other (liquid), far apart and fast (gas), their
  speed rising with temperature. Melting and boiling points are real. For: states of matter, melting and boiling,
  the particle model, what heating does to particles.
  substances: water, ethanol, iron, nitrogen, oxygen, wax, mercury, salt
  config: { "substance":"wax", "task": { "kind":"make-state", "state":"<solid | liquid | gas>" } }  -- heat or cool it
          into that state; or { "substance":"water", "task": { "kind":"explore" } }  -- done once all three are seen
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Heat the wax until it is a liquid.",
    "payload": { "engine":"particles", "config": { "substance":"wax", "task": { "kind":"make-state", "state":"liquid" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:particles", "why":"..." } }`,
}

registerEngine(particlesEngine as SceneEngine<unknown, unknown>)
