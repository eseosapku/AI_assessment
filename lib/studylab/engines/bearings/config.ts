// lib/studylab/engines/bearings/config.ts
//
// A course-setting compass on drawing paper. The learner turns a blue course arrow and the
// clockwise sector grows from the local north line. Two tasks share that one physical idea:
//   set  -- turn from A towards B on the bearing named on the card;
//   back -- the outward course A to B is fixed; turn the return course from B towards A.
// Bearings are whole degrees clockwise from north, 000 to 359 (000 rather than 360). A back
// bearing is (outward + 180) modulo 360. Sources are in research.md.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { BearingsView } from './View'

export type BearingsConfig =
  | { task: 'set'; target: number }
  | { task: 'back'; outward: number }
export type BearingsState = { angle?: number }

/** Two degrees is under 3 px at the handle: a difference the drawing can just show. */
export const BEARING_TOLERANCE = 2
export const bearingGap = (a: number, b: number) => Math.min(norm360(a - b), norm360(b - a))

/** Whole degrees; the handle and buttons use the same unit. */
export const norm360 = (n: number) => ((Math.round(n) % 360) + 360) % 360
export const bearingText = (n: number) => `${String(norm360(n)).padStart(3, '0')}°`
export const targetOf = (c: BearingsConfig) => norm360(c.task === 'set' ? c.target : c.outward + 180)
export const angleOf = (s: BearingsState | null | undefined) => typeof s?.angle === 'number' && Number.isFinite(s.angle) ? norm360(s.angle) : 0

export function initialAngle(c: BearingsConfig): number {
  return c.task === 'set' ? norm360(c.target + 180) : norm360(c.outward)
}

export function working(c: BearingsConfig, state?: BearingsState): string {
  const near = state !== undefined && angleOf(state) !== targetOf(c)
  const prefix = near ? `Near enough — the exact answer is ${bearingText(targetOf(c))}. ` : 'Yes: '
  if (c.task === 'set') return `${prefix}${bearingText(c.target)} is measured clockwise from north. ${norm360(c.target) < 100 ? 'The leading zero makes three figures.' : 'Bearings always use three figures.'}`
  const out = norm360(c.outward)
  const back = norm360(out + 180)
  return `${prefix}back to A is ${bearingText(back)}. Parallel north lines make the return a half turn: ${bearingText(out)} ${out < 180 ? '+' : '−'} 180° = ${bearingText(back)}.`
}

export function madeText(c: BearingsConfig, state: BearingsState): string {
  const a = angleOf(state)
  if (c.task === 'set') return `Your arrow is on ${bearingText(a)}, not the course asked for. Follow the blue sector clockwise from north.`
  return `Your return arrow is on ${bearingText(a)}. At B it needs to point back to A; both north lines stay parallel.`
}

const keyOf = (raw: unknown) => typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
function degrees(raw: unknown): number | null {
  if (raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^([-+]?\d+(?:\.\d+)?)\s*(?:°|degrees?|deg)?$/i)
  return m ? Number(m[1]) : null
}
const nearby = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(359, Math.round(n))) : 45

export function goodPrompt(c: BearingsConfig): string {
  return c.task === 'set'
    ? `Drag the blue handle to set the course from A to B to ${bearingText(c.target)}. The arrow keys turn it too.`
    : `The outward course from A to B is ${bearingText(c.outward)}. Drag the blue handle at B to point the return course back to A. The arrow keys turn it too.`
}

export const bearingsEngine: SceneEngine<BearingsConfig, BearingsState> = {
  id: 'bearings',
  covers: ['bearings', 'three figure bearings'],
  phrases: [
    'three figure bearings', 'three-figure bearings', '3 figure bearings', 'back bearings', 'back bearing', 'return bearings', 'return bearing', 'reverse bearings',
    'compass bearings', 'navigation bearings', 'bearings and navigation', 'bearings and scale drawings', 'scale drawings and bearings', 'navigation courses', 'compass directions in maths', 'navigation and compass directions in maths',
  ],
  notFor: [
    'grid references', 'map references', 'contours', 'magnetic fields', 'magnetism', 'plotting compass', 'electromagnetism', 'vectors', 'vector geometry',
    'angle facts', 'loci', 'constructions', 'right angled trigonometry', 'right-angled trigonometry', 'sine rule', 'cosine rule', 'unit circle',
  ],
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    const backWords = ['back', 'back-bearing', 'back-bearings', 'return', 'return-bearing', 'return-course', 'reverse', 'reverse-bearing', 'home', 'homeward']
    const setWords = ['set', 'set-bearing', 'bearing', 'three-figure-bearing', 'course', 'set-course', 'outward', 'plot', 'steer']
    const task = backWords.includes(word) ? 'back' : setWords.includes(word) ? 'set' : !word && first(src, ['outward', 'fromA', 'outwardBearing']) !== undefined ? 'back' : !word ? 'set' : null
    if (!task) return null
    if (task === 'back') {
      const rawOutward = first(src, ['outward', 'outwardBearing', 'fromA', 'bearing', 'course', 'target'])
      const outward = rawOutward === undefined ? 50 : degrees(rawOutward)
      return outward === null ? null : { task, outward }
    }
    const rawTarget = first(src, ['target', 'bearing', 'course', 'direction', 'angle'])
    const target = rawTarget === undefined ? 45 : degrees(rawTarget)
    return target === null ? null : { task, target }
  },

  faults(c) {
    const value = c.task === 'set' ? c.target : c.outward
    const field = c.task === 'set' ? 'target' : 'outward'
    if (!Number.isInteger(value) || value < 0 || value > 359) {
      return [`${field} ${value} is not a whole-degree bearing from 0 to 359: use e.g. ${field} ${nearby(value)} (north 0, east 90, south 180, west 270).`]
    }
    return []
  },

  promptFaults(c, prompt) {
    const out: string[] = []
    const example = goodPrompt(c)
    if (!/\b(?:drag|turn|rotate|move|arrow keys)\b/i.test(prompt)) out.push(`the prompt does not say the gesture: ask the learner to drag or turn the blue course handle ("${example}")`)
    if (c.task === 'back') {
      const answer = targetOf(c)
      const numeric = [...prompt.matchAll(/(\d+(?:\.\d+)?)\s*(?:°|degrees?\b)/gi)].map((m) => Number(m[1]))
      if (numeric.some((n) => norm360(n) === answer && norm360(n) !== norm360(c.outward)) || /add|subtract|plus|minus|half[- ]turn|180\s*(?:°|degrees?)?\s*(?:rule|away|difference)/i.test(prompt)) {
        out.push(`the prompt gives away the return bearing or the half-turn rule the learner is to discover: state only the outward course and the gesture ("${example}")`)
      }
    }
    if (/scale|kilomet|\bkm\b|\bmiles?\b|distance|sine|cosine|tangent|vector|grid reference|magnetic north|declination|multi[- ]leg|second leg/i.test(prompt)) {
      out.push(`the prompt promises something this card does not show: it turns one course on a compass, with no distances, route legs, vectors or trigonometry ("${example}")`)
    }
    return out
  },

  initial: (c) => ({ angle: initialAngle(c) }),
  check(c, state) {
    const ok = typeof state?.angle === 'number' && Number.isFinite(state.angle) && bearingGap(angleOf(state), targetOf(c)) <= BEARING_TOLERANCE
    return { ok, wrongIds: ok ? [] : ['course'] }
  },
  solve: (c) => ({ angle: targetOf(c) }),
  View: BearingsView,

  prompt: `SCENE "bearings" -- a carefully drawn compass on a quiet sheet of drawing paper. A fixed north line and a live blue clockwise sector meet at the starting point. The learner drags the large blue handle on the course arrow (or focuses it and uses arrow keys, or uses the two 1-degree buttons). The course arrow turns, the swept sector changes and a live three-figure readout answers. Nothing is marked by the drawing.
  set: B is placed on the required ray. Turn the course from A towards B until the live course equals the target printed on the card. target is a whole degree 0 to 359; 0 is north, 90 east, 180 south, 270 west.
  back: A and B and the outward course A to B are shown, with parallel north lines at both points. The outward number is printed. Turn the return arrow at B until it points back to A. The back bearing is held back until marked, when the parallel north lines and +/−180 degrees are explained. outward is a whole degree 0 to 359.
  For: Cambridge IGCSE three-figure bearings, clockwise from north, bearing of B from A, local north lines, back/return/reverse bearings and the language of navigation courses. Not drawn: scale conversions, distances, multi-leg journeys, vectors, trigonometry, sine/cosine rules, magnetic declination or map grid references.
  The prompt must say the drag/turn gesture. For back it must state the outward bearing but must NOT print the return answer, say to add/subtract 180, or state the half-turn rule. A visible 2-degree tolerance is accepted and the marked sentence gives the exact answer.
  config: { "task":"set", "target":45 } -- prompt "Drag the blue handle to set the course from A to B to 045°. The arrow keys turn it too."
       or { "task":"back", "outward":50 } -- prompt "The outward course from A to B is 050°. Drag the blue handle at B to point the return course back to A. The arrow keys turn it too."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the blue handle to set the course from A to B to 045°. The arrow keys turn it too.",
    "payload": { "engine":"bearings", "config": { "task":"set", "target":45 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:bearings", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The outward course from A to B is 050°. Drag the blue handle at B to point the return course back to A. The arrow keys turn it too.",
    "payload": { "engine":"bearings", "config": { "task":"back", "outward":50 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:bearings", "why":"..." } }`,
}

registerEngine(bearingsEngine as SceneEngine<unknown, unknown>)
