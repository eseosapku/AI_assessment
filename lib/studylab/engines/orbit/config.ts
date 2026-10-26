// lib/studylab/engines/orbit/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { OrbitView } from './View'

/** The eight phases, in order from new moon, a 45-degree band each. */
export const PHASES = [
  'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
  'full', 'waning-gibbous', 'third-quarter', 'waning-crescent',
] as const
export type PhaseId = (typeof PHASES)[number]

/** How each phase is said. */
export const PHASE_NAMES: Record<PhaseId, string> = {
  'new': 'new moon', 'waxing-crescent': 'waxing crescent', 'first-quarter': 'first quarter', 'waxing-gibbous': 'waxing gibbous',
  'full': 'full moon', 'waning-gibbous': 'waning gibbous', 'third-quarter': 'third quarter', 'waning-crescent': 'waning crescent',
}

export type OrbitConfig = { task: { kind: 'make-phase'; phase: PhaseId } | { kind: 'explore' } }
/**
 * The Moon's angle round its orbit in degrees, measured from the Sun line as
 * seen from above the North Pole: 0 is between Earth and Sun (new moon), 90 a
 * quarter of the way round (first quarter), 180 behind Earth (full). `seen`
 * is the phases passed through, for explore.
 */
export type OrbitState = { moon: number; seen?: PhaseId[] }

/** How far either side of a phase's centre still counts as that phase when marking. */
export const TOLERANCE = 15

const norm = (deg: number) => ((deg % 360) + 360) % 360
const centre = (phase: PhaseId) => PHASES.indexOf(phase) * 45
/** The shorter way round between two angles. */
export const apart = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b))
  return Math.min(d, 360 - d)
}

/** The fraction of the disc Earth sees lit: 0 at new moon, 1 at full. */
export function litFraction(moon: number): number {
  return (1 - Math.cos((norm(moon) * Math.PI) / 180)) / 2
}

/** The phase at an angle: each phase owns 22.5 degrees either side of its centre. */
export function phaseAt(moon: number): PhaseId {
  return PHASES[Math.round(norm(moon) / 45) % 8]
}

/** "First quarter", "first-quarter", "Full Moon" all name their phase. */
function readPhase(raw: unknown): PhaseId | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase().replace(/\s+moon$/, '').replace(/[\s_]+/g, '-')
  return (PHASES as readonly string[]).includes(key) ? (key as PhaseId) : key === 'last-quarter' ? 'third-quarter' : null
}

export const orbitEngine: SceneEngine<OrbitConfig, OrbitState> = {
  id: 'orbit',
  covers: ['phases of the Moon', 'why the Moon changes shape', 'the lit half always faces the Sun', 'waxing and waning'],
  isolates: 'position',

  parse(raw) {
    const task = (raw as { task?: { kind?: unknown; phase?: unknown } } | null)?.task
    if (!task || typeof task !== 'object') return null
    if (task.kind === 'explore') return { task: { kind: 'explore' } }
    if (task.kind !== 'make-phase') return null
    const phase = readPhase(task.phase)
    return phase ? { task: { kind: 'make-phase', phase } } : null
  },

  // Every config parse accepts is solvable and starts unsolved by construction.
  faults() {
    return []
  },

  initial(config) {
    // Opposite the asked phase, so the learner has half an orbit to think through.
    return config.task.kind === 'make-phase' ? { moon: norm(centre(config.task.phase) + 180), seen: [] } : { moon: 0, seen: ['new'] }
  },

  check(config, state) {
    if (config.task.kind === 'explore') return { ok: new Set(state.seen ?? []).size >= 4, wrongIds: [] }
    return { ok: apart(state.moon, centre(config.task.phase)) <= TOLERANCE, wrongIds: [] }
  },

  solve(config) {
    return config.task.kind === 'make-phase' ? { moon: centre(config.task.phase) } : { moon: 135, seen: ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous'] }
  },

  View: OrbitView,

  prompt: `SCENE "orbit" -- the Sun, Earth and Moon from above, beside the Moon as seen from Earth. The learner
  drags the Moon round its orbit (or steps it with the arrow keys); the engine lights the half facing the Sun
  and draws the phase Earth sees. For: the phases of the Moon, waxing and waning, why the Moon changes shape.
  config: { "task": { "kind":"make-phase", "phase":"<new | waxing crescent | first quarter | waxing gibbous |
            full | waning gibbous | third quarter | waning crescent>" } }  -- move the Moon to where Earth sees it
       or { "task": { "kind":"explore" } }  -- free play, done once four phases have been seen
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Move the Moon to where we see a first quarter.",
    "payload": { "engine":"orbit", "config": { "task": { "kind":"make-phase", "phase":"first quarter" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:orbit", "why":"..." } }`,
}

registerEngine(orbitEngine as SceneEngine<unknown, unknown>)
