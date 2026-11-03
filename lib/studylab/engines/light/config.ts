// lib/studylab/engines/light/config.ts
//
// A dark room and one bold ray of light. Three benches, one drawing language:
//   mirror    -- turn a mirror; the ray swings twice as fast and folds about the normal;
//   bend-in, bend-out, trap -- swing a lamp round a half-disc of glass; the ray bends at the flat face,
//                never at the curved one, and past the critical angle it stops getting out at all;
//   lens      -- slide a candle; every ray through the lens lands on a screen, and the blur tightens
//                into a sharp, upside-down picture.
//
// The physics, all computed here and never read from the drawing:
//   reflection: angle in = angle out, both from the normal;
//   refraction: sin(i) = n sin(r), with n a named refractive index;
//   partial reflection at a face inside the glass: the Fresnel equations for unpolarised light;
//   thin lens: a ray meeting the lens at height h leaves with its slope changed by -h / f, which gives
//   1/u + 1/v = 1/f without ever being told it.
//
// Refractive indices, for visible light: water 1.33, diamond 2.42 (OpenStax College Physics, Table 25.1);
// glass 1.5, the value school syllabuses use (Sang, Cambridge IGCSE Physics); perspex (PMMA) 1.49.
//
// Ideas taken, never code or art:
//   - the half-disc on a ring is the Hartl optical disc, the classic school practical, and the ray that
//     thins as it nears the critical angle is PhET "Bending Light" (ray strength shown with reflection);
//   - the screen and the "circle of confusion" are Ciechanowski's "Cameras and Lenses": a point out of focus
//     lands as a disc, so the picture here is the sharp picture dilated by that disc;
//   - many rays through every part of the lens, because the "three special rays" are a way of drawing, and
//     students (and teachers) read them as the only light: Goldberg and McDermott, Am. J. Phys. 55 (1987),
//     and the half-covered-lens literature;
//   - light as something that travels from the source to the eye, moving visibly along the ray: IOP Spark on
//     students who do not see light as existing between a source and its effect (Guesne 1985; Andersson and
//     Karrqvist). The eye only answers when light reaches it; it sends nothing out.
//   - angles fixed to the normal, never the surface: Physics Classroom on the commonest beginner's error.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { LightView } from './View'

export const TASKS = ['mirror', 'bend-in', 'bend-out', 'trap', 'lens'] as const
export type Task = (typeof TASKS)[number]
type GlassTask = 'bend-in' | 'bend-out' | 'trap'

export const MATERIALS: Record<string, number> = { glass: 1.5, water: 1.33, perspex: 1.49, diamond: 2.42 }
const MATERIAL_NAMES = Object.keys(MATERIALS)

export type LightConfig =
  /** target: the angle from the normal the light must arrive at; it sets where the eye sits. */
  | { task: 'mirror'; target: number }
  /** target: how far from the normal the eye sits, on the far side of the flat face. */
  | { task: GlassTask; material: string; target: number }
  /** size: how many times taller than the candle the sharp picture is; it sets where the screen stands. */
  | { task: 'lens'; size: number }

/**
 * What the learner has set, all in whole numbers a test can walk through:
 * turn is the bearing of the mirror's normal; lamp the bearing of the lamp round the ring; u the candle's
 * distance from the lens in cm.
 */
export type LightState = { turn?: number; lamp?: number; u?: number }

// ---------------------------------------------------------------------------
// Bearings: degrees clockwise from straight up the card, in (-180, 180].

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const wrap = (b: number) => {
  const w = ((b % 360) + 360) % 360
  return w > 180 ? w - 360 : w
}
/** The shorter way round between two bearings. */
export const apart = (a: number, b: number) => Math.abs(wrap(a - b))

/** How close the ray must come to the middle of the eye, in degrees, to count as reaching it. */
export const AIM = 5
/** The mirror turns the ray twice as far as it turns itself, so a hand has to land it within half this: 4 degrees of mirror. */
export const MIRROR_AIM = 8

// ---------------------------------------------------------------------------
// The mirror: lamp and eye stay put; the mirror turns about the point the ray strikes.

export const LAMP_AT = -50
export const TURN_MIN = -60
export const TURN_MAX = 30
export const MIRROR_TARGET = { lo: 15, hi: 60 }

/** The angle between the ray in and the normal: positive with the lamp anticlockwise of the normal. */
export const mirrorIn = (turn: number) => wrap(turn - LAMP_AT)
/** The ray leaves as far the other side of the normal as it came in. */
export const mirrorOut = (turn: number) => wrap(turn + mirrorIn(turn))
export const mirrorEye = (target: number) => wrap(LAMP_AT + 2 * target)
export const mirrorSolved = (target: number) => LAMP_AT + target

// ---------------------------------------------------------------------------
// The half-disc: the lamp rides a ring, so its ray always aims at the centre of the flat face and meets
// the curved face square-on, unbent. Bearing 0 is the air side of the normal, 180 the glass side.

export const indexOf = (material: string) =>
  Object.prototype.hasOwnProperty.call(MATERIALS, material) ? MATERIALS[material] : 1.5

export const criticalAngle = (n: number) => deg(Math.asin(1 / n))

/** The share of the light reflected at a face inside the glass, by the Fresnel equations, unpolarised. */
export function reflectedShare(i: number, n: number): number {
  const s = n * Math.sin(rad(i))
  if (s >= 1) return 1
  const ci = Math.cos(rad(i))
  const ct = Math.sqrt(1 - s * s)
  const rs = ((n * ci - ct) / (n * ci + ct)) ** 2
  const rp = ((ci - n * ct) / (ci + n * ct)) ** 2
  return (rs + rp) / 2
}

export type Trace = {
  /** The lamp is on the air side of the flat face. */
  inAir: boolean
  /** The angle to the normal on the lamp's side of the flat face. */
  i: number
  /** The angle to the normal beyond the flat face; null when no light gets through. */
  r: number | null
  /** Bearing of the main ray once it has left the flat face. */
  out: number
  trapped: boolean
  /** Bearing of the part reflected back inside the glass; null for a lamp in the air (drawn as nothing). */
  bounce: number | null
  /** The share of the light that goes the way of `bounce`. */
  share: number
}

export function trace(lamp: number, n: number): Trace {
  const b = wrap(lamp)
  const side = b < 0 ? -1 : 1
  if (Math.abs(b) <= 90) {
    const i = Math.abs(b)
    const r = deg(Math.asin(Math.sin(rad(i)) / n))
    return { inAir: true, i, r, out: wrap(-side * (180 - r)), trapped: false, bounce: null, share: 0 }
  }
  const i = 180 - Math.abs(b)
  const s = n * Math.sin(rad(i))
  const bounce = wrap(-side * (180 - i))
  if (s >= 1) return { inAir: false, i, r: null, out: bounce, trapped: true, bounce, share: 1 }
  const r = deg(Math.asin(s))
  return { inAir: false, i, r, out: wrap(-side * r), trapped: false, bounce, share: reflectedShare(i, n) }
}

/** Where the eye sits: always on the right. */
export function glassEye(task: GlassTask, target: number): number {
  return task === 'bend-out' ? target : 180 - target
}

/** What can be asked: an eye inside this range is reached by one path only, the one the task is about. */
export function glassRange(task: GlassTask, n: number): { lo: number; hi: number } {
  const c = criticalAngle(n)
  if (task === 'bend-in') return { lo: 10, hi: Math.floor(c - AIM - 3) }
  if (task === 'bend-out') return { lo: 20, hi: 70 }
  return { lo: Math.ceil(c + AIM + 3), hi: 75 }
}

/** The lamp's bearing, in whole degrees, that sends the light straight to the eye. */
export function glassSolved(task: GlassTask, n: number, target: number): number {
  if (task === 'bend-in') return -Math.round(deg(Math.asin(Math.min(1, n * Math.sin(rad(target))))))
  if (task === 'bend-out') return -(180 - Math.round(deg(Math.asin(Math.sin(rad(target)) / n))))
  return -(180 - Math.round(target))
}

/**
 * Where the lamp begins, with a bend big enough to see at once. To reach an eye on the far side of the flat face the
 * lamp has to come round the other way, so the light begins by going nowhere near it, and the learner sees the whole
 * fan on the way. A trap begins on the right side but well short of the critical angle.
 */
function glassStart(task: GlassTask, n: number): number {
  if (task === 'trap') return -(180 - Math.round(criticalAngle(n) * 0.75))
  if (task === 'bend-in') return 78
  return 180 - Math.round(deg(Math.asin(Math.sin(rad(65)) / n)))
}

// ---------------------------------------------------------------------------
// The lens: a converging lens of focal length 10 cm, a candle that slides, a screen that stays.

export const FOCAL = 10
/** The candle's height, and how far from the lens's middle the outermost rays pass, both in cm. */
export const CANDLE = 11.8
export const APERTURE = 11.4
export const U_MIN = 6
export const U_MAX = 31
export const SIZE = { lo: 0.5, hi: 2.5 }
/** The rays from the tip of the flame count as met when they land within this of each other's middle, in cm. */
export const SHARP = 2

export const screenAt = (size: number) => FOCAL * (1 + size)
export const candleFor = (size: number) => FOCAL * (1 + 1 / size)

/** Where a ray from the tip of the flame lands on the screen, in cm from the axis, up being positive. */
export function landing(u: number, h: number, v: number): number {
  const slope = (h - CANDLE) / u // on its way to the lens
  return h + (slope - h / FOCAL) * v // the lens changes its slope by -h / f
}
/** How far the rays through the edge of the lens land from the one through its middle. */
export const blur = (u: number, v: number) => Math.abs(landing(u, APERTURE, v) - landing(u, 0, v))
/** Where the rays meet, beyond the lens; null when they spread and never do. */
export const meetAt = (u: number): number | null => (u > FOCAL ? (FOCAL * u) / (u - FOCAL) : null)

// ---------------------------------------------------------------------------
// Reading what the learner has set.

const isTurn = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= TURN_MIN && v <= TURN_MAX
const isLamp = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > -180 && v <= 180
const isU = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v * 2) && v >= U_MIN && v <= U_MAX

export function startTurn(target: number): number {
  return clamp(mirrorSolved(target) + (target <= 45 ? 25 : -25), TURN_MIN, TURN_MAX)
}
export const startU = (size: number) => (size >= 1 ? 28 : 12)

export const madeTurn = (config: Extract<LightConfig, { task: 'mirror' }>, state: LightState) =>
  isTurn(state?.turn) ? state.turn : startTurn(config.target)
export const madeLamp = (config: Extract<LightConfig, { task: GlassTask }>, state: LightState) =>
  isLamp(state?.lamp) ? state.lamp : glassStart(config.task, indexOf(config.material))
export const madeU = (config: Extract<LightConfig, { task: 'lens' }>, state: LightState) =>
  isU(state?.u) ? state.u : startU(config.size)

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function reached(config: LightConfig, state: LightState): boolean {
  if (config.task === 'mirror') {
    const turn = madeTurn(config, state)
    return Math.abs(mirrorIn(turn)) < 90 && apart(mirrorOut(turn), mirrorEye(config.target)) <= MIRROR_AIM
  }
  if (config.task === 'lens') return blur(madeU(config, state), screenAt(config.size)) <= SHARP
  const t = trace(madeLamp(config, state), indexOf(config.material))
  return apart(t.out, glassEye(config.task, config.target)) <= AIM
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no number at all.

const one = (v: number) => {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
const whole = (v: number) => String(Math.round(v))
const indexText = (n: number) => String(n)

function timesTall(m: number): string {
  if (Math.abs(m - 1) < 0.02) return 'the same height as'
  if (Math.abs(m - 0.5) < 0.02) return 'half as tall as'
  if (Math.abs(m - 2) < 0.02) return 'twice as tall as'
  return `${one(m)} times as tall as`
}

/** What a correct card says: the numbers, the rule, and the misconception it answers. */
export function working(config: LightConfig, state: LightState): string {
  if (config.task === 'mirror') {
    const i = Math.abs(mirrorIn(madeTurn(config, state)))
    const lead = i === config.target ? 'Yes.' : `Near enough: the exact answer is ${config.target}°.`
    return `${lead} In at ${i}° to the normal, out at ${i}°: the angle in always equals the angle out. Measure from the normal, not the mirror's surface, which would give ${90 - i}°.`
  }
  if (config.task === 'lens') {
    const v = screenAt(config.size)
    const lead = Math.abs(madeU(config, state) - candleFor(config.size)) <= 0.25 ? 'Yes.' : `Near enough: the sharpest place is ${one(candleFor(config.size))} cm from the lens.`
    return `${lead} All the rays from the tip of the flame, through every part of the lens, meet at one point on the screen. The picture is upside down and ${timesTall(config.size)} the candle. 1/u + 1/v = 1/f: 1/${one(candleFor(config.size))} + 1/${one(v)} = 1/${FOCAL}.`
  }
  const n = indexOf(config.material)
  const t = trace(madeLamp(config, state), n)
  if (config.task === 'trap') {
    return `Yes. Past ${one(criticalAngle(n))}°, the critical angle of ${config.material}, no light gets out: the flat face acts as a perfect mirror, in at ${whole(t.i)}°, out at ${whole(t.i)}°. That is total internal reflection. sin c = 1 ÷ ${indexText(n)}.`
  }
  const r = t.r ?? 0
  if (config.task === 'bend-in') {
    return `Yes. ${whole(t.i)}° to the normal in air became ${whole(r)}° in ${config.material}: the ray slows as it enters and bends towards the normal. sin ${whole(t.i)}° ÷ sin ${whole(r)}° = ${indexText(n)}, the refractive index.`
  }
  return `Yes. ${whole(t.i)}° to the normal in ${config.material} became ${whole(r)}° in air: the ray speeds up as it leaves and bends away from the normal. sin ${whole(r)}° ÷ sin ${whole(t.i)}° = ${indexText(n)}, the refractive index.`
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: LightConfig, state: LightState): string {
  if (config.task === 'mirror') {
    const turn = madeTurn(config, state)
    const i = Math.abs(mirrorIn(turn))
    return `In at ${i}° to the normal, out at ${i}°, and it missed the eye by ${whole(apart(mirrorOut(turn), mirrorEye(config.target)))}°.`
  }
  if (config.task === 'lens') {
    const u = madeU(config, state)
    const v = screenAt(config.size)
    const meet = meetAt(u)
    if (meet === null) return u === FOCAL
      ? 'From here the rays leave the lens side by side and never meet, so the screen only gets a wide patch of light.'
      : 'From this close the rays are still spreading after the lens and never meet, so the screen only gets a wide patch of light.'
    const gap = Math.abs(meet - v)
    return `The rays from the tip of the flame meet ${one(gap)} cm ${meet < v ? 'in front of' : 'behind'} the screen, so they land ${one(blur(u, v) * 2)} cm apart and the picture is a blur.`
  }
  const n = indexOf(config.material)
  const t = trace(madeLamp(config, state), n)
  const miss = whole(apart(t.out, glassEye(config.task, config.target)))
  if (t.trapped) return `All your light stayed inside the ${config.material}, reflected at ${whole(t.i)}°, and it missed the eye by ${miss}°.`
  if (t.inAir) return `Your ray made ${whole(t.i)}° with the normal in air and ${whole(t.r ?? 0)}° in the ${config.material}, and it missed the eye by ${miss}°.`
  if (config.task === 'trap') return `Your ray met the flat face at ${whole(t.i)}° inside the ${config.material}, and most of it got out, at ${whole(t.r ?? 0)}° in air.`
  return `Your ray made ${whole(t.i)}° with the normal in the ${config.material} and ${whole(t.r ?? 0)}° in air, and it missed the eye by ${miss}°.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

function readTask(raw: unknown): Task | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '')
  const alias: Record<string, Task> = {
    mirror: 'mirror', reflect: 'mirror', reflection: 'mirror', 'plane-mirror': 'mirror', 'turn-the-mirror': 'mirror', 'law-of-reflection': 'mirror',
    'bend-in': 'bend-in', 'bend-into': 'bend-in', into: 'bend-in', enter: 'bend-in', entering: 'bend-in', refract: 'bend-in', refraction: 'bend-in', 'refract-in': 'bend-in',
    'into-glass': 'bend-in', 'air-to-glass': 'bend-in', 'into-the-glass': 'bend-in', snell: 'bend-in', 'snell-s-law': 'bend-in', bend: 'bend-in',
    'bend-out': 'bend-out', out: 'bend-out', leave: 'bend-out', leaving: 'bend-out', exit: 'bend-out', 'refract-out': 'bend-out', 'out-of-glass': 'bend-out',
    'glass-to-air': 'bend-out', 'out-of-the-glass': 'bend-out',
    trap: 'trap', trapped: 'trap', tir: 'trap', 'total-internal-reflection': 'trap', 'critical-angle': 'trap', critical: 'trap', 'optical-fibre': 'trap', 'optical-fiber': 'trap',
    lens: 'lens', 'thin-lens': 'lens', 'converging-lens': 'lens', 'convex-lens': 'lens', focus: 'lens', projector: 'lens', image: 'lens', 'lens-image': 'lens',
  }
  return Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null
}

function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== ''
    ? Number(raw.trim().replace(/\s*(°|deg|degs|degrees?|x|times)$/i, ''))
    : raw
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000 ? v + 0 : null
}

function readSize(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const key = raw.trim().toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim()
    const words: Record<string, number> = {
      half: 0.5, 'half size': 0.5, 'half as tall': 0.5, 'half as big': 0.5, smaller: 0.5, diminished: 0.5,
      same: 1, 'same size': 1, equal: 1, 'equal size': 1, 'same height': 1,
      twice: 2, double: 2, 'twice as tall': 2, 'twice as big': 2, 'two times': 2, bigger: 2, larger: 2, magnified: 2, enlarged: 2,
    }
    if (Object.prototype.hasOwnProperty.call(words, key)) return words[key]
  }
  return readNumber(raw)
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const defaultTarget = (task: Task, n: number): number => {
  if (task === 'mirror') return 40
  const { lo, hi } = glassRange(task as GlassTask, n)
  if (task === 'bend-in') return clamp(30, lo, hi)
  if (task === 'bend-out') return 50
  return clamp(Math.round((lo + hi) / 10) * 5, lo, hi)
}

/** A value of the range close to the one asked for, ending in 0 or 5 where it can. */
const near = (v: number, lo: number, hi: number) => {
  const r = Number.isFinite(v) ? Math.round(v / 5) * 5 : lo
  return clamp(r, lo, hi)
}

export const lightEngine: SceneEngine<LightConfig, LightState> = {
  id: 'light',
  // Distinctive words only, and few: `scenesFor` matches a covers word by its first five letters, so "refraction"
  // here would catch "verse and refrain", and "optics" would catch "optical storage". The rest are whole phrases.
  covers: ["Snell's law"],
  phrases: [
    'refraction', 'refractive index', 'refract', 'refracts', 'refracted', 'refracting', 'bending light', 'bending of light', 'light bends',
    'reflection of light', 'law of reflection', 'laws of reflection', 'light reflects', 'reflected light', 'reflecting light',
    'plane mirror', 'plane mirrors', 'mirrors and reflection', 'reflection in mirrors', 'angle of incidence', 'angle of reflection', 'incident ray', 'reflected ray',
    'light rays', 'rays of light', 'ray of light', 'ray diagram', 'ray diagrams', 'ray optics', 'optics', 'how light travels',
    'total internal reflection', 'critical angle', 'optical fibre', 'optical fibres', 'optical fiber', 'optical fibers', 'fibre optics', 'fiber optics',
    'lens', 'lenses', 'optical instruments', 'the way we see things', 'how we see things',
  ],
  // Near misses: the same words about something else, and the things this bench does not draw.
  notFor: [
    'through the lens', 'critical lens', 'theoretical lens', 'analytical lens', 'historical lens', 'cultural lens', 'feminist lens', 'marxist lens', 'lens flare',
    'curved mirror', 'curved mirrors', 'concave mirror', 'concave mirrors', 'convex mirror', 'convex mirrors', 'spherical mirror', 'spherical mirrors',
    'angle of attack', 'insolation', 'solar radiation', 'seasons', 'sound waves', 'seismic waves', 'water waves',
  ],
  // The learner sets where a thing sits: the mirror's turn, the lamp round its ring, the candle on its rail.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const task = readTask(nested ? first(nested, ['kind', 'task', 'type']) : first(o, ['task', 'kind', 'type']))
    if (!task) return null
    if (task === 'lens') {
      const raws = first(src, ['size', 'magnification', 'times', 'scale', 'picture', 'image'])
      const size = raws === undefined ? 2 : readSize(raws)
      return size === null ? null : { task, size }
    }
    const rawTarget = first(src, ['target', 'angle', 'eye', 'degrees', 'at'])
    if (task === 'mirror') {
      const target = rawTarget === undefined ? defaultTarget(task, 1) : readNumber(rawTarget)
      return target === null ? null : { task, target }
    }
    const rawMaterial = first(src, ['material', 'medium', 'block', 'substance'])
    const material = rawMaterial === undefined ? 'glass' : typeof rawMaterial === 'string' ? rawMaterial.trim().toLowerCase().replace(/^(?:a|an|the)\s+/, '').replace(/\s+block$/, '').replace(/^(?:crown|acrylic)\s*(?:glass)?$/, (m) => (m.startsWith('crown') ? 'glass' : 'perspex')) : null
    if (!material) return null
    const target = rawTarget === undefined ? defaultTarget(task, indexOf(material)) : readNumber(rawTarget)
    return target === null ? null : { task, material, target }
  },

  faults(config) {
    if (config.task === 'lens') {
      const { lo, hi } = SIZE
      if (config.size >= lo && config.size <= hi) return []
      const say = config.size > hi
        ? `A picture ${one(config.size)} times the candle's height needs a screen beyond the edge of the card`
        : `A picture ${one(config.size)} times the candle's height needs a candle beyond the edge of the card`
      return [`${say}: size must be from ${lo} to ${hi}, e.g. size ${config.size > hi ? 2 : 0.5}.`]
    }
    if (config.task === 'mirror') {
      const { lo, hi } = MIRROR_TARGET
      if (!Number.isInteger(config.target)) return [`target must be a whole number of degrees from ${lo} to ${hi}, e.g. target ${near(config.target, lo, hi)}.`]
      if (config.target >= lo && config.target <= hi) return []
      return [`A target of ${one(config.target)}° puts the eye where the mirror cannot send the light: the angle must be from ${lo}° to ${hi}°, e.g. target ${near(config.target, lo, hi)}.`]
    }
    if (!Object.prototype.hasOwnProperty.call(MATERIALS, config.material)) {
      return [`There is no refractive index here for "${config.material}": use one of ${MATERIAL_NAMES.join(', ')}, e.g. material "glass".`]
    }
    const n = indexOf(config.material)
    const { lo, hi } = glassRange(config.task, n)
    const c = one(criticalAngle(n))
    const eg = near(config.target, lo, hi)
    if (!Number.isInteger(config.target)) return [`target must be a whole number of degrees from ${lo} to ${hi}, e.g. target ${eg}.`]
    if (config.target >= lo && config.target <= hi) return []
    if (config.task === 'bend-in' && config.target > hi) {
      return [`Light from the air bends no further than ${c}° from the normal inside ${config.material} (n = ${n}), and the eye must sit clear of that: a target of ${one(config.target)}° cannot be reached, so use from ${lo}° to ${hi}°, e.g. target ${eg}.`]
    }
    if (config.task === 'trap' && config.target < lo) {
      return [`At ${one(config.target)}° light still escapes from ${config.material}, or the eye sits too close to the ${c}° critical angle to be sure: the eye must be from ${lo}° to ${hi}°, e.g. target ${eg}.`]
    }
    return [`A target of ${one(config.target)}° is too near the ${config.target > hi ? 'surface' : 'normal'} for the bend to show: use from ${lo}° to ${hi}°, e.g. target ${eg}.`]
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = {
      mirror: 'Turn the mirror by its white knob until the light from the lamp reaches the eye.',
      'bend-in': `Swing the lamp round the ring by its white knob until its light reaches the eye on the far side of the ${'material' in config ? config.material : 'glass'}.`,
      'bend-out': `Swing the lamp round under the ${'material' in config ? config.material : 'glass'} by its white knob until its light comes out of the flat face and reaches the eye.`,
      trap: `Swing the lamp round under the ${'material' in config ? config.material : 'glass'} by its white knob until its light reaches the eye.`,
      lens: 'Slide the candle along by its white knob until the picture on the screen is sharp.',
    }[config.task]
    const numbers = /\b\d+(?:\.\d+)?\s*(?:°|degrees?\b|deg\b|cm\b|times\b)|\b(?:twice|double|half)\s+(?:the|as)\b|=\s*\d/i.test(text)
    let idea = false
    if (config.task === 'mirror') {
      idea = /\bequal(?:s|ly)?\b|\bsame angle\b|\bangle in\b.*\bangle out\b|\bi\s*=\s*r\b|\bclockwise\b|\banticlockwise\b|\bturn\b[^.]{0,20}\b(?:left|right)\b|\bbisect|\bhalfway\b|\btwice as fast\b/i.test(text)
    } else if (config.task === 'lens') {
      idea = /\bupside[- ]down\b|\binverted\b|\breal image\b|\bfocal\b|\b2f\b|\bbeyond f\b|\bbetween f\b|\bcloser\b|\bnearer\b|\bfurther\b|\bfarther\b|\baway from the lens\b|\btowards? the lens\b|\b1\/u\b|\blens formula\b|\bmagnif/i.test(text)
    } else {
      idea = /\btowards? the normal\b|\baway from the normal\b|\bbends? (?:towards?|away)\b|\bslows?\b|\bspeeds? up\b|\bfaster\b|\bslower\b|\bsnell\b|\bsin\b|\bn\s*=|\bcritical\b|\btotal internal\b|\binternal reflection\b|\bbounces?\b|\breflect(?:s|ed|ing)?\b|\btrapp?(?:ed|s)?\b|\bmirror\b/i.test(text)
    }
    return numbers || idea
      ? [`the prompt gives the answer away: it says a number, the rule or which way to move, which the learner is to find with the ${config.task === 'mirror' ? 'mirror' : config.task === 'lens' ? 'candle' : 'lamp'} -- ask for the outcome only ("${example}")`]
      : []
  },

  initial(config) {
    if (config.task === 'mirror') return { turn: startTurn(config.target) }
    if (config.task === 'lens') return { u: startU(config.size) }
    return { lamp: glassStart(config.task, indexOf(config.material)) }
  },

  check(config, state) {
    return { ok: reached(config, state), wrongIds: [] }
  },

  solve(config) {
    if (config.task === 'mirror') return { turn: mirrorSolved(config.target) }
    if (config.task === 'lens') return { u: clamp(Math.round(candleFor(config.size) * 2) / 2, U_MIN, U_MAX) }
    return { lamp: glassSolved(config.task, indexOf(config.material), config.target) }
  },

  View: LightView,

  prompt: `SCENE "light" -- ray optics in a dark room: one bold ray of yellow light, on a flat dark stage, with a white knob for the one thing the learner handles. Light visibly travels along the ray away from the source. There are no numbers, angle values or rule on the card before marking; marking gives the angles and the rule, or says what the learner made.
  For: reflection in a plane mirror, the law of reflection, the normal, refraction, Snell's law, refractive index, total internal reflection, the critical angle, optical fibres, converging lenses and how a lens forms an image.
  mirror: a lamp and an eye stay put; the learner turns the mirror by its white knob and the reflected ray swings twice as fast. A dashed normal stands on the mirror, with one slice labelled "in" and one "out" between each ray and the normal. The eye lights up when the ray reaches it. Target: the angle in degrees from the normal the light must arrive at, whole number, 15 to 60. Marking says the two equal angles, from the normal and not the surface.
  bend-in: a half-disc of a material, flat face up, on a ring. The learner swings the lamp round the ring from the air side; the ray bends at the flat face and reaches the ring on the far side; a dashed line shows the straight-on path. Target: how far from the normal the eye sits inside the material, whole number. Marking gives sin i / sin r = n.
  bend-out: the same, with the lamp under the half-disc and the eye in the air above the flat face. Target: how far from the normal the eye sits, in air, 20 to 70.
  trap: the same, with the lamp under the half-disc and the eye also under it, where only total internal reflection can send the light. As the lamp swings, the ray in air thins and the reflected ray thickens until no light gets out. Target: how far from the normal the eye sits. Marking names total internal reflection and the critical angle.
  material: glass (n 1.5), water (1.33), perspex (1.49) or diamond (2.42). Target ranges are: bend-in glass 10-33, water 10-40, perspex 10-34, diamond 10-16; trap glass 50-75, water 57-75, perspex 51-75, diamond 33-75.
  lens: a candle on a rail, a converging lens, a screen. The learner slides the candle by its white knob. Five rays leave the tip of the flame through every part of the lens and land on the screen; the picture on the screen is a dim blur until the rays meet there, then it sharpens, and it is upside down. Size: how many times taller than the candle the sharp picture is, 0.5 to 2.5, or "half", "same" or "twice". Marking gives the distances and 1/u + 1/v = 1/f.
  Not drawn: curved mirrors, diverging lenses, virtual images, rectangular blocks, prisms, colour, shadows. Do not use it for light microscopes, light intensity in photosynthesis, light-dependent resistors or mirror lines in geometry.
  Before marking the card shows only what the light does, with short names on the things (lamp, eye, mirror, normal, in, out; or air and the material's name; or candle, lens, screen). The eye's iris fills with yellow, or the picture sharpens, only when the light gets there. It holds back every angle, distance and rule. The prompt must ask for the outcome only: do NOT say a number, that the angles are equal, which way to turn or slide, that the ray bends towards or away from the normal, that light is trapped or reflected inside, or that the picture is upside down.
  config: { "task":"mirror", "target":40 }  -- the prompt says "Turn the mirror by its white knob until the light from the lamp reaches the eye."
       or { "task":"bend-in", "material":"glass", "target":30 }  -- the prompt says "Swing the lamp round the ring by its white knob until its light reaches the eye on the far side of the glass."
       or { "task":"bend-out", "material":"water", "target":50 }  -- the prompt says "Swing the lamp round under the water by its white knob until its light comes out of the flat face and reaches the eye."
       or { "task":"trap", "material":"glass", "target":60 }  -- the prompt says "Swing the lamp round under the glass by its white knob until its light reaches the eye."
       or { "task":"lens", "size":2 }  -- the prompt says "Slide the candle along by its white knob until the picture on the screen is sharp."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Turn the mirror by its white knob until the light from the lamp reaches the eye.",
    "payload": { "engine":"light", "config": { "task":"mirror", "target":40 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:light", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Swing the lamp round the ring by its white knob until its light reaches the eye on the far side of the glass.",
    "payload": { "engine":"light", "config": { "task":"bend-in", "material":"glass", "target":30 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:light", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Swing the lamp round under the water by its white knob until its light comes out of the flat face and reaches the eye.",
    "payload": { "engine":"light", "config": { "task":"bend-out", "material":"water", "target":50 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:light", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Swing the lamp round under the glass by its white knob until its light reaches the eye.",
    "payload": { "engine":"light", "config": { "task":"trap", "material":"glass", "target":60 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:light", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide the candle along by its white knob until the picture on the screen is sharp.",
    "payload": { "engine":"light", "config": { "task":"lens", "size":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:light", "why":"..." } }`,
}

registerEngine(lightEngine as SceneEngine<unknown, unknown>)
