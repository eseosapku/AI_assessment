// lib/studylab/engines/circle-theorems-kimi31/config.ts
//
// Dynamic circle geometry: the learner deforms a real figure and reads two live angles.
//   centre     -- slide C off minor arc AB; O stays fixed while C changes, then stays
//                 constant all round the other arc (the same-segment result as well);
//   semicircle -- slide B until AB passes through O, and the angle at C becomes 90°;
//   tangent    -- turn a secant through P until its other intersection Q merges with P,
//                 and the radius becomes perpendicular to the line.
//
// All marking is angular, never pixel-based. Drag states snap to whole degrees. A diameter
// or tangent within ANGLE_TOLERANCE visibly looks right and passes, with the exact value
// supplied after marking. The centre task instead uses the exact arc on which C lies.
//
// Classroom/design sources are in research.md. The geometry is elementary Euclidean
// geometry: an inscribed angle is half the central angle on the same arc; a diameter
// subtends a right angle; a tangent is perpendicular to the radius at its contact point.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CircleTheoremsView } from './View'

export type CircleTask = 'centre' | 'semicircle' | 'tangent'
export type CircleConfig =
  | { task: 'centre'; central: number }
  | { task: 'semicircle' }
  | { task: 'tangent' }
/** c and b are positions on the circumference, in degrees; delta turns the line from its tangent. */
export type CircleState = { c?: number; b?: number; delta?: number }

export const ANGLE_TOLERANCE = 4
export const CENTRE_MIN = 30
export const CENTRE_MAX = 170
export const TANGENT_MIN = -35
export const TANGENT_MAX = 35
export const SEMI_MIN = -55
export const SEMI_MAX = 150

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
export const norm = (n: number) => ((n % 360) + 360) % 360
const clean = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? n : fallback
export const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')

export function readState(config: CircleConfig, state: CircleState | null | undefined): Required<CircleState> {
  const s = state ?? {}
  return {
    c: norm(clean(s.c, -90)),
    b: clamp(clean(s.b, 90), SEMI_MIN, SEMI_MAX),
    delta: clamp(clean(s.delta, -20), TANGENT_MIN, TANGENT_MAX),
  }
}

/** A and B are symmetric about the top of the circle; the minor arc runs over the top. */
export function centrePositions(central: number): { a: number; b: number } {
  return { a: -90 - central / 2, b: -90 + central / 2 }
}

/** Position within the directed arc A -> B, in [0,360). */
export function arcPosition(config: CircleConfig, state: CircleState | null | undefined): number {
  if (config.task !== 'centre') return 0
  const s = readState(config, state)
  return norm(s.c - centrePositions(config.central).a)
}

export function centreAngleAtC(config: CircleConfig, state: CircleState | null | undefined): number {
  if (config.task !== 'centre') return 0
  const p = arcPosition(config, state)
  // On minor arc AB, the angle stands on the major arc; otherwise on minor arc AB.
  return (p <= config.central ? 360 - config.central : config.central) / 2
}

/** The fixed semicircle construction has A=180°, C=270° and movable B. */
export function semiAngles(state: CircleState | null | undefined): { centre: number; atC: number } {
  const b = readState({ task: 'semicircle' }, state).b
  // For B either side of the diameter, C lies on the other arc: one exact formula.
  return { centre: 180 - b, atC: (180 - b) / 2 }
}

/** Acute angle between the radius OP and the rotating line. */
export function tangentAngle(state: CircleState | null | undefined): number {
  const d = readState({ task: 'tangent' }, state).delta
  return 90 - Math.abs(d)
}

/** Geometric crossings; near-tangent states still honestly have two until they coincide. */
export function crossings(state: CircleState | null | undefined): number {
  return Math.abs(readState({ task: 'tangent' }, state).delta) < 0.5 ? 1 : 2
}

export function isSolved(config: CircleConfig, state: CircleState | null | undefined): boolean {
  if (config.task === 'centre') {
    const p = arcPosition(config, state)
    // Keep C visibly clear of A and B, as well as on the unhighlighted arc.
    return p >= config.central + 6 && p <= 354
  }
  if (config.task === 'semicircle') return Math.abs(readState(config, state).b) <= ANGLE_TOLERANCE
  return Math.abs(readState(config, state).delta) <= ANGLE_TOLERANCE
}

function wrong(config: CircleConfig, state: CircleState): string {
  if (config.task === 'centre') {
    return `C is on the highlighted arc: O = ${config.central}° and C = ${fmt(centreAngleAtC(config, state))}° stand on different arcs AB. On the other arc, O is twice C; angles in the same segment are equal.`
  }
  if (config.task === 'semicircle') {
    const a = semiAngles(state)
    return `AB does not pass through O yet: O = ${fmt(a.centre)}° and C = ${fmt(a.atC)}°. When AB is a diameter, the angle in a semicircle is exactly 90°.`
  }
  return `The line still cuts the circle at P and Q, and the angle at P is ${fmt(tangentAngle(state))}°. At one crossing, Q merges with P: a tangent meets the radius at exactly 90°.`
}

function right(config: CircleConfig, state: CircleState, shown: boolean): string {
  const lead = shown ? 'The completed figure.' : 'Yes.'
  if (config.task === 'centre') {
    return `${lead} O = ${config.central}° and C = ${fmt(centreAngleAtC(config, state))}°, so the angle at the centre is twice the angle at the circumference on the same arc AB. Moving C around this arc leaves its angle unchanged: angles in the same segment are equal.`
  }
  if (config.task === 'semicircle') {
    const b = Math.abs(readState(config, state).b)
    const near = b > 0 ? ` Near enough: the exact answer is 180° at O and 90° at C.` : ''
    return `${lead} AB passes through O, so it is a diameter. The angle in a semicircle is a right angle: C = 90°.${near}`
  }
  const d = Math.abs(readState(config, state).delta)
  if (d > 0) return `${lead} Near enough: Q is close to P and the angle is ${fmt(tangentAngle(state))}°. At exact contact Q merges with P; a tangent meets the radius at exactly 90°.`
  return `${lead} Q has merged with P, so the line only touches the circle. It is a tangent, and the angle between a tangent and the radius at the point of contact is 90°.`
}

// ---------------------------------------------------------------------------
// Reading semantic tutor configs generously.

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const TASKS: Record<string, CircleTask> = {
  centre: 'centre', center: 'centre', 'centre-angle': 'centre', 'center-angle': 'centre',
  'angle-at-centre': 'centre', 'angle-at-center': 'centre', 'angle-at-the-centre': 'centre', 'angle-at-the-center': 'centre',
  'central-angle': 'centre', 'inscribed-angle': 'centre', 'inscribed-angles': 'centre', 'same-arc': 'centre',
  'same-segment': 'centre', 'angles-in-the-same-segment': 'centre', 'angles-in-same-segment': 'centre',
  semicircle: 'semicircle', 'semi-circle': 'semicircle', 'angle-in-a-semicircle': 'semicircle', 'angle-in-semicircle': 'semicircle',
  'angles-in-a-semicircle': 'semicircle', thales: 'semicircle', 'thales-theorem': 'semicircle', diameter: 'semicircle',
  tangent: 'tangent', tangents: 'tangent', 'tangent-radius': 'tangent', 'radius-tangent': 'tangent',
  'tangent-and-radius': 'tangent', 'tangent-perpendicular-radius': 'tangent', 'tangent-line': 'tangent', secant: 'tangent',
}
function readNumber(raw: unknown): number | null {
  if (raw === undefined) return 120
  if (typeof raw === 'string') {
    const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:°|deg(?:rees)?)?$/i)
    return m ? Number(m[1]) : null
  }
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

const examplePrompt = (config: CircleConfig) => config.task === 'centre'
  ? 'Drag C off the highlighted arc AB. Compare the live angles at O and C. You can also use the step buttons.'
  : config.task === 'semicircle'
    ? 'Drag B around the circle until AB passes through the centre O. Watch the angle at C. You can also use the step buttons.'
    : 'Drag the blue handle to turn the line until it touches the circle only at P. Watch the angle at P. You can also use the step buttons.'

export const circleTheoremsEngine: SceneEngine<CircleConfig, CircleState> = {
  id: 'circle-theorems',
  covers: ['circumference', 'semicircle', 'cyclic'],
  phrases: [
    'circle theorem', 'circle theorems', 'circle geometry', 'circle properties', 'angles in circles', 'angles in a circle',
    'angle in a semicircle', 'angle at the centre', 'angle at the center', 'angle at centre', 'angle at center',
    'angles in the same segment', 'angles in same segment', 'same segment theorem', 'inscribed angle theorem',
    'cyclic quadrilateral', 'cyclic quadrilaterals', 'tangent to a circle', 'tangents to a circle', 'tangent radius',
    'tangent and radius', 'alternate segment theorem', 'chords and tangents', 'geometric reasoning with circles',
    'geometrical reasoning with circles', 'circle proofs', 'circle proof',
  ],
  notFor: [
    'area of a circle', 'area and circumference', 'circumference of a circle', 'arc length', 'sector area', 'area of sectors',
    'equation of a circle', 'equation of circles', 'coordinate geometry', 'unit circle', 'trigonometry', 'trigonometric',
    'sine and cosine', 'sin cos tan', 'compass construction', 'compass constructions', 'constructions and loci', 'loci',
    'bearings', 'circular motion', 'centripetal', 'circulatory system', 'circle of life', 'pie chart', 'pie charts',
  ],
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'theorem', 'mode']))
    if (!word || !Object.prototype.hasOwnProperty.call(TASKS, word)) return null
    const task = TASKS[word]
    if (task !== 'centre') return { task }
    const central = readNumber(first(src, ['central', 'centreAngle', 'centerAngle', 'centralAngle', 'angle', 'atCentre', 'atCenter']))
    return central === null ? null : { task, central }
  },

  faults(config) {
    if (config.task !== 'centre') return []
    if (config.central < CENTRE_MIN || config.central > CENTRE_MAX) {
      return [`A centre angle of ${fmt(config.central)}° leaves too little room to distinguish the arcs: use ${CENTRE_MIN}° to ${CENTRE_MAX}°, e.g. central 120.`]
    }
    if (config.central % 2 !== 0) {
      return [`The centre angle ${fmt(config.central)}° gives a half-degree circumference angle: use an even whole number, e.g. central ${config.central < CENTRE_MAX ? config.central + 1 : config.central - 1}.`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const out: string[] = []
    const example = examplePrompt(config)
    if (config.task === 'centre' && /\b(?:twice|double|doubling|half|halve|halving|same segment|equal angles|angles? (?:are|is) equal|\b2\s*[×x*])\b/i.test(prompt)) {
      out.push(`the prompt states the centre/circumference relationship the learner is to discover: ask only for the move and comparison ("${example}")`)
    }
    if (config.task === 'semicircle' && /90\s*(?:°|degrees?)|right angle|perpendicular|thales/i.test(prompt)) {
      out.push(`the prompt gives away the semicircle result: ask for AB through O and let the live angle show what happens ("${example}")`)
    }
    if (config.task === 'tangent' && /90\s*(?:°|degrees?)|right angle|perpendicular/i.test(prompt)) {
      out.push(`the prompt gives away the tangent/radius result: ask for one crossing and let the live angle show what happens ("${example}")`)
    }
    if (/\b(?:type|enter|choose|select|multiple.choice|drag and drop)\b/i.test(prompt)) {
      out.push(`the prompt names an interaction the card does not use: the learner drags a point or handle, or uses its step buttons ("${example}")`)
    }
    return out
  },

  initial: () => ({}),
  check(config, state) {
    const ok = isSolved(config, state)
    return { ok, wrongIds: ok ? [] : [config.task === 'centre' ? 'c' : config.task === 'semicircle' ? 'b' : 'delta'] }
  },
  solve: (config) => config.task === 'centre' ? { c: 90 } : config.task === 'semicircle' ? { b: 0 } : { delta: 0 },
  View: CircleTheoremsView,

  prompt: `SCENE "circle-theorems" -- hands-on Euclidean circle geometry on a quiet pale panel. A real circle, named points, chords/radii, shaded angle arcs and large blue drag handles. Two live measurements answer every move. Before marking the card gives no theorem name or relationship. Marking names the result and states the exact angles.
  For IGCSE circle theorems and geometric reasons: angle at the centre twice the angle at the circumference on the same arc; angles in the same segment; angle in a semicircle; a tangent perpendicular to the radius at contact. It also makes "same arc" visible and turns a secant into a tangent as two crossings merge.
  centre: fixed A, B and O with minor arc AB highlighted. Drag C off that arc and compare O and C. Moving C on the new arc leaves C constant. config {"task":"centre","central":120}; central is an even number from 30 to 170, default 120.
  semicircle: A and C fixed. Drag B until AB passes through O. The live centre and circumference angles become 180 and 90. Within 4 degrees passes as near enough. config {"task":"semicircle"}.
  tangent: radius OP fixed. Drag the blue handle to rotate the secant through P until Q merges with P and there is one crossing. The live angle at P becomes 90. Within 4 degrees passes as near enough. config {"task":"tangent"}.
  All handles also work with arrow keys, and quiet -/+ step buttons move 10 degrees (5 for the tangent). Reduced motion still updates every position and measurement.
  Not for circle area/circumference calculations, arc length or sectors, equations of circles, unit-circle trigonometry, constructions/loci, bearings or circular motion. Cyclic quadrilaterals, alternate segment, equal tangents and chord bisection are not drawn; do not promise them.
  The prompt must name the drag and goal but must NOT state twice/half/equal for centre, 90/right angle for semicircle or tangent, or any answer relationship.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag C off the highlighted arc AB. Compare the live angles at O and C. You can also use the step buttons.",
    "payload": { "engine":"circle-theorems", "config": { "task":"centre", "central":120 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:circle-theorems", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag B around the circle until AB passes through the centre O. Watch the angle at C. You can also use the step buttons.",
    "payload": { "engine":"circle-theorems", "config": { "task":"semicircle" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:circle-theorems", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the blue handle to turn the line until it touches the circle only at P. Watch the angle at P. You can also use the step buttons.",
    "payload": { "engine":"circle-theorems", "config": { "task":"tangent" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:circle-theorems", "why":"..." } }`,
}

export const markedText = (config: CircleConfig, state: CircleState, marked: 'right' | 'wrong' | 'shown') =>
  marked === 'wrong' ? wrong(config, state) : right(config, state, marked === 'shown')

registerEngine(circleTheoremsEngine as SceneEngine<unknown, unknown>)
