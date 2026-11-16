// lib/studylab/kana/poses.ts

/**
 * Kana's poses, as props for the drawing. Named here so the board can ask for
 * what Kana is doing ("point", "celebrate") rather than which wing goes where.
 */
export type KanaPose = 'happy' | 'open' | 'wink' | 'think' | 'talking' | 'surprised' | 'sleepy' | 'wave' | 'point' | 'fly' | 'celebrate' | 'concerned'
export type KanaEyes = 'happy' | 'open' | 'wink' | 'think' | 'surprised' | 'sleepy' | 'concerned'
export type KanaWing = 'down' | 'up' | 'point' | 'wave'
export type KanaBeak = 'closed' | 'open' | 'smile'

export interface KanaProps {
  /** Rendered width in px. */
  size?: number
  pose?: KanaPose
  eyes?: KanaEyes
  /** The right wing's pose; `wave` moves when `t` is given. */
  wing?: KanaWing
  /** The right wing's raise, 0..1, overriding `wing`. */
  wingT?: number
  /** The left wing's raise, 0..1. */
  wingL?: number
  beak?: KanaBeak
  /** Both wings beat. Needs `t`. */
  flap?: boolean
  /** The beak moves. Needs `t`; without it, the beak just stays open. */
  talking?: boolean
  /** Seconds. Drives the idle bob, breathing, blink, flap, talk and wave. Leave it out and Kana holds still. */
  t?: number
  /** Idle bob in px; 0 to disable. */
  bob?: number
  /** Whole-body lean in degrees, pivoting at the feet. */
  tilt?: number
  /** Where the pupils look, -1..1 each way. */
  look?: { x: number; y: number }
  blush?: boolean
  /** For small places (the Ask Kana pill, chat avatars): no pin, tie or feather detail. */
  simple?: boolean
  /** Names Kana for screen readers; without it Kana is decoration. */
  title?: string
}

const POSES: Record<KanaPose, Partial<KanaProps>> = {
  happy: { eyes: 'happy' },
  open: { eyes: 'open' },
  wink: { eyes: 'wink' },
  think: { eyes: 'think', look: { x: 0.8, y: -0.8 }, wingT: 0.85 },
  talking: { eyes: 'open', talking: true },
  surprised: { eyes: 'surprised' },
  sleepy: { eyes: 'sleepy' },
  wave: { eyes: 'happy', wing: 'wave' },
  point: { eyes: 'open', look: { x: 1, y: 0 }, wing: 'point', tilt: 6 },
  fly: { eyes: 'open', wingT: 1, wingL: 1, flap: true, tilt: 8 },
  celebrate: { eyes: 'happy', wingT: 1, wingL: 1, blush: true },
  concerned: { eyes: 'concerned', tilt: -5 },
}

export function poseProps(pose: KanaPose): Partial<KanaProps> {
  return POSES[pose]
}

/** How long a flight between cards takes. */
export const FLIGHT_MS = 1500

/** How far above the higher end a flight arcs, in board units. */
const FLIGHT_LIFT = 180

/** Where Kana is, `k` (0..1) of the way through a flight: a quadratic arc, easing in and out. */
const POKES: KanaPose[] = ['wink', 'surprised', 'celebrate']
/** How far off the pointer has to be for her eyes to reach the edge. */
const LOOK_REACH = 300

/** What she does when tapped, in turn. */
export function pokePose(times: number): KanaPose {
  return POKES[times % POKES.length]
}

/** Where to look to see the pointer, as far as her eyes go. */
export function lookAt(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const along = (d: number) => Math.max(-1, Math.min(1, d / LOOK_REACH))
  return { x: along(to.x - from.x), y: along(to.y - from.y) }
}

export function flightPoint(from: { x: number; y: number }, to: { x: number; y: number }, k: number): { x: number; y: number } {
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
  const q = (a: number, b: number, c: number) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * b + e * e * c
  return {
    x: q(from.x, (from.x + to.x) / 2, to.x),
    y: q(from.y, Math.min(from.y, to.y) - FLIGHT_LIFT, to.y),
  }
}
