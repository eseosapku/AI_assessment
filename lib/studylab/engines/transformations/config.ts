// lib/studylab/engines/transformations/config.ts
//
// A shape, a dashed target, and the one thing that makes a transformation what it is, which the learner handles:
//   reflect   -- slide a mirror line (or turn it) until the shape's mirror image lands on the target;
//   rotate    -- drag the centre pin and pick a turn until the turned shape lands on the target;
//   enlarge   -- drag the centre pin and pick a scale factor until the enlarged image lands on the target;
//   translate -- drag the arrow's head (the column vector) until the moved shape lands on the target.
// The image answers at once, with the construction lines that make the idea plain: equal distances to the mirror, rays
// from the centre, the same move for every point. Nothing says whether it is right until it is marked.
//
// The rules, all exact and computed here, never read from the drawing:
//   every point of the image is found from whole-number coordinates (a scale of 1/2 is held over a common denominator),
//   and the card passes exactly when every vertex of the image is on the matching vertex of the target.
//
// Facts: the four transformations of the school syllabuses (Cambridge IGCSE 0580 / 0607 topics "reflection, rotation,
// enlargement and translation"); reflection in x = k, y = k, y = x + c, y = -x + c; rotation by 90 or 180 degrees about
// any point; enlargement from any centre by a whole, half or negative scale factor; translation by a column vector.
//
// Ideas taken, never code or art:
//   - the learner moves the thing that DEFINES the transformation (the mirror line, the centre, the vector) and the image
//     answers: Desmos Activity Builder transformation lessons and GeoGebra's reflection/rotation applets, where students move
//     the line of reflection and the centre rather than the shape; the "Transformation Golf" challenge of landing an image on a target;
//   - rays from the centre of enlargement through every vertex, and the image on the ray (teaching guides, Maths with David,
//     the Victorian "Enlargement transformations" lesson), which answers measuring from the origin instead of from the centre;
//   - the misconceptions: reflecting over the wrong axis; a mirror line that is neither horizontal nor vertical (Kuchemann, 1981,
//     via a classroom resource); clockwise taken for anticlockwise; the centre left out; enlargement as adding the same amount
//     (ERIC EJ1139043 on eighth-graders' transformation errors; thirdspacelearning and mathspanda notes).
// Refused:
//   - combined transformations and "describe it fully" writing: a text box on a picture, and the card marks by landing;
//   - shear, stretch, glide reflections, matrix transformations: a different idea and a harder one;
//   - a centre or mirror line off the whole-number grid: the learner cannot place it exactly.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { TransformationsView } from './View'

export const TASKS = ['reflect', 'rotate', 'enlarge', 'translate'] as const
export type Task = (typeof TASKS)[number]
export const SHAPES = ['L', 'triangle'] as const
export type ShapeName = (typeof SHAPES)[number]

export const MIRRORS = ['vertical', 'horizontal', 'diagonal'] as const
export const TURNS = ['clockwise', 'anticlockwise', 'half'] as const
export const SCALES = ['2', '3', '1/2', '-1', '-2'] as const

/** The grid is 12 across and 10 up, with the origin in the middle. */
export const GRID = { xMin: -6, xMax: 6, yMin: -5, yMax: 5 }

export type TfConfig = {
  task: Task
  shape: string
  /** reflect: the mirror; rotate: the turn; enlarge: the scale factor; translate: unused. */
  kind: string
  /** Which of the prepared placements to use, from 1. */
  variant: number
}

export type Dir = 'v' | 'h' | 'up' | 'down'
export type Turn = 0 | 90 | -90 | 180
export type TfState = {
  dir: Dir
  k: number
  cx: number
  cy: number
  /** Positive is clockwise. */
  turn: Turn
  scale: number
  vx: number
  vy: number
}

export type Pt = [number, number]
/** A point over a common denominator: (x / d, y / d). */
export type Exact = { x: number; y: number; d: number }

// ---------------------------------------------------------------------------
// The shapes. Neither has a mirror line, so a reflection, a turn and a slide all look different.

export const BASE: Record<ShapeName, Pt[]> = {
  L: [[0, 0], [2, 0], [2, 1], [1, 1], [1, 3], [0, 3]],
  triangle: [[0, 0], [3, 0], [1, 2]],
}
const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)

// ---------------------------------------------------------------------------
// The prepared placements: where the shape stands, and the answer. Each was checked to stay on the grid for both shapes.

type Reflection = { o: Pt; dir: Dir; k: number }
type Placement = { o: Pt; c: Pt }

export const REFLECTIONS: Record<(typeof MIRRORS)[number], Reflection[]> = {
  vertical: [{ o: [-4, -2], dir: 'v', k: 1 }, { o: [-5, 1], dir: 'v', k: -1 }, { o: [1, -3], dir: 'v', k: 0 }],
  horizontal: [{ o: [-4, -4], dir: 'h', k: 0 }, { o: [0, 1], dir: 'h', k: 0 }, { o: [2, -4], dir: 'h', k: 0 }],
  diagonal: [{ o: [0, -4], dir: 'up', k: 0 }, { o: [1, 0], dir: 'down', k: 0 }, { o: [-1, -3], dir: 'up', k: 2 }],
}
export const ROTATIONS: Placement[] = [{ o: [1, 0], c: [0, 0] }, { o: [-4, -3], c: [0, 0] }, { o: [0, -4], c: [1, 0] }]
export const ENLARGEMENTS: Record<(typeof SCALES)[number], Placement[]> = {
  '2': [{ o: [-4, -3], c: [-5, -4] }, { o: [1, -3], c: [3, -4] }, { o: [-3, -1], c: [-4, 2] }],
  // Only the triangle: three times the L is taller than the grid.
  '3': [{ o: [-3, -2], c: [-3, -2] }, { o: [-4, -3], c: [-3, -2] }, { o: [-3, -2], c: [-3, -1] }],
  // The shape starts twice the size, so the half is on the grid's points.
  '1/2': [{ o: [-5, -3], c: [1, 1] }, { o: [0, -4], c: [-2, 0] }, { o: [-6, -5], c: [0, -1] }],
  '-1': [{ o: [1, 1], c: [0, 0] }, { o: [-4, -3], c: [1, 0] }],
  '-2': [{ o: [-3, -2], c: [0, 0] }, { o: [0, -3], c: [2, -1] }],
}
export const TRANSLATIONS: { o: Pt; v: Pt }[] = [{ o: [-5, -3], v: [5, 2] }, { o: [1, 2], v: [-4, -3] }, { o: [-4, 0], v: [3, -4] }, { o: [-5, 1], v: [6, -2] }]

export const scaleParts = (scale: number): { n: number; d: number } => (scale === 0.5 ? { n: 1, d: 2 } : { n: scale, d: 1 })
export const scaleOfKind = (kind: string): number => (kind === '1/2' ? 0.5 : Number(kind))

export type Scenario = {
  shape: Pt[]
  /** The target, in whole numbers. */
  target: Pt[]
  /** The state that lands on it. */
  answer: TfState
}

export const START: TfState = { dir: 'v', k: 0, cx: 0, cy: 0, turn: 0, scale: 1, vx: 0, vy: 0 }

const place = (pts: Pt[], o: Pt): Pt[] => pts.map(([x, y]) => [x + o[0], y + o[1]])

// ---------------------------------------------------------------------------
// The maths. Exact: a point is (x / d, y / d).

export function imageOf(task: Task, shape: Pt[], s: TfState): Exact[] {
  return shape.map(([x, y]): Exact => {
    if (task === 'reflect') {
      if (s.dir === 'v') return { x: 2 * s.k - x, y, d: 1 }
      if (s.dir === 'h') return { x, y: 2 * s.k - y, d: 1 }
      if (s.dir === 'up') return { x: y - s.k, y: x + s.k, d: 1 } // the line y = x + k
      return { x: s.k - y, y: s.k - x, d: 1 } // the line y = -x + k
    }
    if (task === 'rotate') {
      const dx = x - s.cx
      const dy = y - s.cy
      if (s.turn === 90) return { x: s.cx + dy, y: s.cy - dx, d: 1 }
      if (s.turn === -90) return { x: s.cx - dy, y: s.cy + dx, d: 1 }
      if (s.turn === 180) return { x: s.cx - dx, y: s.cy - dy, d: 1 }
      return { x, y, d: 1 }
    }
    if (task === 'enlarge') {
      const { n, d } = scaleParts(s.scale)
      return { x: s.cx * d + (x - s.cx) * n, y: s.cy * d + (y - s.cy) * n, d }
    }
    return { x: x + s.vx, y: y + s.vy, d: 1 }
  })
}

const whole = (e: Exact) => e.x % e.d === 0 && e.y % e.d === 0

/** The scenario a config draws, or null when it has none. */
export function scenarioOf(config: TfConfig): Scenario | null {
  const base = has(BASE, config.shape) ? BASE[config.shape as ShapeName] : null
  if (!base) return null
  const at = config.variant - 1
  if (!Number.isInteger(at) || at < 0) return null
  if (config.task === 'reflect') {
    const list = has(REFLECTIONS, config.kind) ? REFLECTIONS[config.kind as (typeof MIRRORS)[number]] : null
    const r = list?.[at]
    if (!r) return null
    const shape = place(base, r.o)
    const answer = { ...START, dir: r.dir, k: r.k }
    return { shape, answer, target: imageOf('reflect', shape, answer).map((e) => [e.x, e.y] as Pt) }
  }
  if (config.task === 'rotate') {
    const p = ROTATIONS[at]
    if (!p || !(TURNS as readonly string[]).includes(config.kind)) return null
    const shape = place(base, p.o)
    const turn: Turn = config.kind === 'clockwise' ? 90 : config.kind === 'anticlockwise' ? -90 : 180
    const answer = { ...START, cx: p.c[0], cy: p.c[1], turn }
    return { shape, answer, target: imageOf('rotate', shape, answer).map((e) => [e.x, e.y] as Pt) }
  }
  if (config.task === 'enlarge') {
    const list = has(ENLARGEMENTS, config.kind) ? ENLARGEMENTS[config.kind as (typeof SCALES)[number]] : null
    const p = list?.[at]
    if (!p) return null
    const shape = place(config.kind === '1/2' ? base.map(([x, y]) => [x * 2, y * 2] as Pt) : base, p.o)
    const answer = { ...START, cx: p.c[0], cy: p.c[1], scale: scaleOfKind(config.kind) }
    const image = imageOf('enlarge', shape, answer)
    if (!image.every(whole)) return null
    return { shape, answer, target: image.map((e) => [e.x / e.d, e.y / e.d] as Pt) }
  }
  const t = TRANSLATIONS[at]
  if (!t) return null
  const shape = place(base, t.o)
  const answer = { ...START, vx: t.v[0], vy: t.v[1] }
  return { shape, answer, target: imageOf('translate', shape, answer).map((e) => [e.x, e.y] as Pt) }
}

/** The scenario to draw for any config at all, so a view can never crash on one faults refuses. */
export function safeScenario(config: TfConfig): Scenario {
  return scenarioOf(config)
    ?? scenarioOf({ task: config.task, shape: 'L', kind: DEFAULT_KIND[config.task], variant: 1 })
    ?? scenarioOf({ task: 'translate', shape: 'L', kind: '', variant: 1 })!
}

const DEFAULT_KIND: Record<Task, string> = { reflect: 'vertical', rotate: 'clockwise', enlarge: '2', translate: '' }

/** A state read safely: anything missing or wild falls back to the start. */
export function readState(state: unknown): TfState {
  const s = (state && typeof state === 'object' ? state : {}) as Record<string, unknown>
  const int = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : fallback)
  const dir: Dir = s.dir === 'h' || s.dir === 'up' || s.dir === 'down' ? s.dir : 'v'
  const turn: Turn = s.turn === 90 || s.turn === -90 || s.turn === 180 ? s.turn : 0
  const scale = typeof s.scale === 'number' && [-2, -1, 0.5, 1, 2, 3].includes(s.scale) ? s.scale : 1
  return {
    dir, k: int(s.k, ...kRange(dir), 0), cx: int(s.cx, GRID.xMin, GRID.xMax, 0), cy: int(s.cy, GRID.yMin, GRID.yMax, 0), turn, scale,
    vx: int(s.vx, -12, 12, 0), vy: int(s.vy, -10, 10, 0),
  }
}

/** How far a mirror line can slide in each direction, still crossing the grid. */
export function kRange(dir: Dir): [number, number] {
  if (dir === 'v') return [GRID.xMin, GRID.xMax]
  if (dir === 'h') return [GRID.yMin, GRID.yMax]
  return [-8, 8]
}

export const num = (n: number) => (n < 0 ? `−${-n}` : `${n}`)
export const pointText = (x: number, y: number) => `(${num(x)}, ${num(y)})`
export function lineText(dir: Dir, k: number): string {
  if (dir === 'v') return `x = ${num(k)}`
  if (dir === 'h') return `y = ${num(k)}`
  const lead = dir === 'up' ? 'y = x' : 'y = −x'
  return k === 0 ? lead : k > 0 ? `${lead} + ${k}` : `${lead} − ${-k}`
}
export const turnText = (t: Turn) => (t === 90 ? 'a quarter turn clockwise' : t === -90 ? 'a quarter turn anticlockwise' : t === 180 ? 'a half turn' : 'no turn')
export const scaleText = (s: number) => (s === 0.5 ? '½' : num(s))

// ---------------------------------------------------------------------------
// Marking: from the exact image, always.

export function landed(config: TfConfig, state: unknown): boolean {
  const sc = scenarioOf(config)
  if (!sc) return false
  const image = imageOf(config.task, sc.shape, readState(state))
  return image.every((e, i) => e.x === sc.target[i][0] * e.d && e.y === sc.target[i][1] * e.d)
}

/** What a correct card says: what the learner found, and the idea behind it. */
export function working(config: TfConfig, state: unknown): string {
  const s = readState(state)
  switch (config.task) {
    case 'reflect':
      return `Yes. The mirror line is ${lineText(s.dir, s.k)}. Every point is the same distance from the line as its image, on the other side, so the line sits halfway between them and the shape is turned over.`
    case 'rotate':
      return `Yes. ${turnText(s.turn).replace(/^a /, 'A ')} about ${pointText(s.cx, s.cy)}. Every point stays the same distance from the centre and swings round it, and the shape is the same size and not turned over.`
    case 'enlarge':
      if (s.scale < 0) return `Yes. Scale factor ${num(s.scale)} from ${pointText(s.cx, s.cy)}. The negative sign puts each image point on the opposite side of the centre, on the ray through its original point, and the shape is turned upside down.`
      if (s.scale < 1) return `Yes. Scale factor ½ from ${pointText(s.cx, s.cy)}. Each image point is half as far from the centre as its original, on the same ray, so the shape shrinks.`
      return `Yes. Scale factor ${s.scale} from ${pointText(s.cx, s.cy)}. Each image point is ${s.scale} times as far from the centre as its original, on the same ray, so every length is ${s.scale} times as long.`
    default:
      return `Yes. The vector ${pointText(s.vx, s.vy)}: ${Math.abs(s.vx)} ${s.vx < 0 ? 'left' : 'right'} and ${Math.abs(s.vy)} ${s.vy < 0 ? 'down' : 'up'}. Every point moves by the same amount, so the shape keeps its size and its direction.`
  }
}

/** What a wrong card says: what the learner made, never where the answer is. */
export function madeText(config: TfConfig, state: unknown): string {
  const s = readState(state)
  switch (config.task) {
    case 'reflect':
      return `You reflected the shape in the line ${lineText(s.dir, s.k)}, and the image is not on the target. Each point and its image are equally far from the line.`
    case 'rotate':
      if (s.turn === 0) return 'The shape has not been turned yet, so the image is the shape itself. A rotation needs a centre and a turn.'
      return `You made ${turnText(s.turn)} about ${pointText(s.cx, s.cy)}, and the image is not on the target. A rotation needs the right centre as well as the right turn.`
    case 'enlarge':
      if (s.scale === 1) return 'A scale factor of 1 leaves the shape where it is. An enlargement needs a centre and a scale factor.'
      return `You used scale factor ${scaleText(s.scale)} from ${pointText(s.cx, s.cy)}, and the image is not on the target. Every distance from the centre is multiplied by the scale factor.`
    default:
      if (s.vx === 0 && s.vy === 0) return 'The shape has not moved yet, so the image is the shape itself.'
      return `You moved the shape by the vector ${pointText(s.vx, s.vy)}, and the image is not on the target. Every point moves by the same amount.`
  }
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[^a-z0-9/.\-½×]+/g, '-').replace(/^-+(?!\d)|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, Task> = {
  reflect: 'reflect', reflection: 'reflect', reflections: 'reflect', reflecting: 'reflect', mirror: 'reflect', 'mirror-line': 'reflect', 'line-of-reflection': 'reflect', 'reflect-in-a-line': 'reflect', flip: 'reflect',
  rotate: 'rotate', rotation: 'rotate', rotations: 'rotate', rotating: 'rotate', turn: 'rotate', turning: 'rotate', 'centre-of-rotation': 'rotate', 'center-of-rotation': 'rotate',
  enlarge: 'enlarge', enlargement: 'enlarge', enlargements: 'enlarge', enlarging: 'enlarge', dilate: 'enlarge', dilation: 'enlarge', dilations: 'enlarge', scale: 'enlarge', scaling: 'enlarge', 'scale-factor': 'enlarge', 'centre-of-enlargement': 'enlarge', 'center-of-enlargement': 'enlarge', resize: 'enlarge',
  translate: 'translate', translation: 'translate', translations: 'translate', translating: 'translate', vector: 'translate', vectors: 'translate', 'column-vector': 'translate', 'column-vectors': 'translate', slide: 'translate', shift: 'translate', move: 'translate',
}

const MIRROR_WORDS: Record<string, string> = {
  vertical: 'vertical', 'vertical-line': 'vertical', upright: 'vertical', 'x-equals': 'vertical', 'y-axis': 'vertical', 'up-and-down': 'vertical',
  horizontal: 'horizontal', 'horizontal-line': 'horizontal', 'x-axis': 'horizontal', flat: 'horizontal', 'y-equals': 'horizontal',
  diagonal: 'diagonal', 'diagonal-line': 'diagonal', sloping: 'diagonal', slanted: 'diagonal', 'y-x': 'diagonal', 'y=x': 'diagonal', 'y=-x': 'diagonal',
}
const TURN_WORDS: Record<string, string> = {
  clockwise: 'clockwise', cw: 'clockwise', '90-clockwise': 'clockwise', '90': 'clockwise', 'quarter-turn-clockwise': 'clockwise', 'quarter-clockwise': 'clockwise', '90-degrees-clockwise': 'clockwise', right: 'clockwise',
  anticlockwise: 'anticlockwise', 'anti-clockwise': 'anticlockwise', counterclockwise: 'anticlockwise', 'counter-clockwise': 'anticlockwise', acw: 'anticlockwise', ccw: 'anticlockwise', '-90': 'anticlockwise', '270': 'anticlockwise',
  '90-anticlockwise': 'anticlockwise', '90-anti-clockwise': 'anticlockwise', 'quarter-turn-anticlockwise': 'anticlockwise', 'quarter-anticlockwise': 'anticlockwise', '90-degrees-anticlockwise': 'anticlockwise', left: 'anticlockwise',
  half: 'half', 'half-turn': 'half', '180': 'half', '180-degrees': 'half', 'point-reflection': 'half',
}
const SCALE_WORDS: Record<string, string> = {
  '2': '2', '2.0': '2', x2: '2', '×2': '2', double: '2', doubled: '2', twice: '2', two: '2', 'scale-factor-2': '2',
  '3': '3', '3.0': '3', x3: '3', '×3': '3', triple: '3', tripled: '3', three: '3', 'scale-factor-3': '3',
  '1/2': '1/2', '0.5': '1/2', half: '1/2', halved: '1/2', '½': '1/2', 'scale-factor-1/2': '1/2', 'one-half': '1/2', reduction: '1/2', reduce: '1/2', shrink: '1/2',
  '-1': '-1', 'minus-1': '-1', 'negative-one': '-1', 'scale-factor--1': '-1',
  '-2': '-2', 'minus-2': '-2', negative: '-2', 'negative-two': '-2', 'scale-factor--2': '-2', 'negative-scale-factor': '-2',
}

function readKind(task: Task, raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_KIND[task]
  const k = typeof raw === 'number' ? String(raw) : keyOf(raw)
  if (task === 'reflect') return has(MIRROR_WORDS, k) ? MIRROR_WORDS[k] : k
  if (task === 'rotate') return has(TURN_WORDS, k) ? TURN_WORDS[k] : k
  if (task === 'enlarge') return has(SCALE_WORDS, k) ? SCALE_WORDS[k] : k
  return ''
}

function readShape(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return 'L'
  const k = keyOf(raw).replace(/-?shape$/, '')
  if (k === 'l') return 'L'
  if (k === 'triangle' || k === 'scalene-triangle' || k === 'right-triangle') return 'triangle'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}

/** A prompt that gives the gesture and the aim, and nothing the card keeps back. */
export const goodPrompt = (config: TfConfig): string => {
  switch (config.task) {
    case 'reflect':
      return 'Slide the mirror line, or turn it with the direction buttons, until the reflected shape lands exactly on the dashed target.'
    case 'rotate':
      return 'Drag the pin to set the centre, and choose a turn, until the turned shape lands exactly on the dashed target.'
    case 'enlarge':
      return 'Drag the pin to set the centre, and choose the scale factor, until the new shape lands exactly on the dashed target.'
    default:
      return "Drag the arrow's head, or use the buttons, until the moved shape lands exactly on the dashed target."
  }
}

const KINDS_OF: Record<Task, readonly string[]> = { reflect: MIRRORS, rotate: TURNS, enlarge: SCALES, translate: [] }
const variantsOf = (config: TfConfig): number => {
  if (config.task === 'reflect') return has(REFLECTIONS, config.kind) ? REFLECTIONS[config.kind as (typeof MIRRORS)[number]].length : 0
  if (config.task === 'rotate') return ROTATIONS.length
  if (config.task === 'enlarge') return has(ENLARGEMENTS, config.kind) ? ENLARGEMENTS[config.kind as (typeof SCALES)[number]].length : 0
  return TRANSLATIONS.length
}

export const transformationsEngine: SceneEngine<TfConfig, TfState> = {
  id: 'transformations',
  // Few words, and every one distinctive: a covers word matches a station by its plural, and "reflection", "rotation",
  // "translation", "transformation" and "vector" are all words of light, crops, protein synthesis, energy and forces.
  covers: ['enlargement'],
  phrases: [
    'transformations of shapes', 'transformations of shape', 'transformation of shapes', 'geometric transformations', 'geometrical transformations', 'transformation geometry', 'transformations and vectors', 'vectors and transformations',
    'shapes and transformations', 'transformations on a grid', 'transformations in the plane', 'transformations of the plane', 'plane transformations', 'rigid transformations', 'rigid motions',
    'reflection rotation translation', 'reflections rotations translations', 'reflections and rotations', 'rotations and reflections', 'reflection and rotation', 'rotation and reflection', 'reflection and translation', 'translation and reflection',
    'rotation and translation', 'translation and rotation', 'translations and reflections', 'translations and rotations', 'reflection in a line', 'reflections in a line', 'reflecting shapes', 'reflecting a shape', 'reflecting in a line',
    'line of reflection', 'lines of reflection', 'mirror line', 'mirror lines', 'rotation about a point', 'rotations about a point', 'rotating shapes', 'rotating a shape', 'rotate a shape', 'centre of rotation', 'center of rotation',
    'angle of rotation', 'translating shapes', 'translating a shape', 'translation of shapes', 'translation by a vector', 'translation vector', 'translation vectors', 'enlarging shapes', 'enlarging a shape', 'enlarge a shape',
    'enlargement and similarity', 'centre of enlargement', 'center of enlargement', 'enlargement scale factor', 'scale factor enlargement', 'dilations', 'dilation of shapes', 'column vector', 'column vectors', 'vectors on a grid', 'vectors in two dimensions',
    'vector notation', 'position vectors', 'free vectors', 'vectors and translations', 'vectors and geometry', 'transformations',
  ],
  // Near misses: transformations and reflections and rotations and vectors of other kinds.
  notFor: [
    'energy transformation', 'energy transformations', 'transformation of energy', 'transformations of energy', 'energy transfer and transformation', 'energy conversions',
    'bacterial transformation', 'transformation of bacteria', 'genetic transformation', 'gene transformation', 'transformation in bacteria', 'dna transformation', 'cell transformation', 'cancer transformation', 'malignant transformation',
    'transformation of matter', 'chemical transformation', 'chemical transformations', 'physical transformation', 'transformation of substances', 'phase transformation', 'metamorphosis',
    'translation of mrna', 'protein translation', 'translation and transcription', 'transcription and translation', 'gene expression', 'protein synthesis', 'language translation', 'translating texts', 'translation studies', 'literary translation',
    'reflection of light', 'light reflection', 'reflection and refraction', 'refraction and reflection', 'total internal reflection', 'reflection of sound', 'sound reflection', 'reflection of waves', 'wave reflection', 'reflection of radiation', 'reflection of heat',
    'laws of reflection', 'law of reflection', 'plane mirrors', 'plane mirror', 'curved mirrors', 'concave mirrors', 'convex mirrors', 'mirror images', 'reflection and absorption', 'reflective writing', 'self reflection', 'personal reflection', 'reflection journal', 'reflection questions',
    'crop rotation', 'rotation of crops', 'rotation of the earth', 'earth rotation', 'rotation of the moon', 'rotational motion', 'rotational kinetic energy', 'rotational dynamics', 'rotation of rigid bodies', 'moments and rotation', 'rotating machines', 'rotating frames',
    'scalars and vectors', 'scalar and vector', 'scalar and vector quantities', 'vector quantities', 'vector addition', 'adding vectors', 'resultant vector', 'resultant vectors', 'resolving vectors', 'resolving forces', 'velocity vector', 'velocity vectors', 'force vectors', 'vector diagram', 'vector diagrams',
    'disease vectors', 'vectors of disease', 'vector borne', 'vector control', 'gene vectors', 'cloning vector', 'cloning vectors', 'plasmid vectors', 'viral vectors', 'vectors in genetic engineering',
    'vector graphics', 'vector images', 'vector fields', 'vector calculus', 'dot product', 'cross product', 'scalar product', 'vector product', 'matrix transformation', 'matrix transformations', 'matrices and transformations', 'transformations of graphs', 'graph transformations', 'transformations of functions', 'function transformations', 'transforming graphs', 'transformations of curves',
    'enlargement of the heart', 'enlarged heart', 'enlargement of organs', 'prostate enlargement', 'thyroid enlargement', 'photograph enlargement', 'photo enlargement',
    'similar shapes', 'similar triangles', 'similarity and congruence', 'scale drawings', 'scale drawing', 'maps and scale', 'map scales', 'model scales',
  ],
  // The learner moves the mirror, the centre or the vector, and the image answers: where things are.
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode', 'transformation']))
    const task = has(TASK_WORDS, word) ? TASK_WORDS[word] : null
    if (!task) return null
    const shape = readShape(first(src, ['shape', 'figure', 'object']))
    const given = task === 'reflect' ? first(src, ['mirror', 'line', 'mirrorLine', 'mirror_line', 'axis', 'lineOfReflection', 'direction'])
      : task === 'rotate' ? first(src, ['turn', 'angle', 'rotation', 'direction'])
        : task === 'enlarge' ? first(src, ['scale', 'scaleFactor', 'scale_factor', 'factor', 'enlargement', 'kind'])
          : undefined
    const kind = readKind(task, given === word ? undefined : given)
    const rawVariant = first(src, ['variant', 'version', 'example', 'case', 'level'])
    const variant = rawVariant === undefined ? 1 : typeof rawVariant === 'number' ? rawVariant : Number(String(rawVariant).trim())
    if (!Number.isFinite(variant)) return null
    return { task, shape, kind, variant: Math.trunc(variant) }
  },

  faults(config) {
    const out: string[] = []
    const field = config.task === 'reflect' ? 'mirror' : config.task === 'rotate' ? 'turn' : 'scale'
    const eg = (c: { shape?: string } = {}) => JSON.stringify({ task: config.task, shape: 'L', ...(config.task === 'translate' ? {} : { [field]: DEFAULT_KIND[config.task] }), variant: 1, ...c })
    if (!has(BASE, config.shape)) {
      out.push(`There is no "${config.shape}" shape drawn here: use one of ${SHAPES.join(', ')}, e.g. ${eg()}.`)
      return out
    }
    const kinds = KINDS_OF[config.task]
    if (kinds.length && !kinds.includes(config.kind)) {
      const note = config.task === 'enlarge' ? ' (2, 3, 1/2, -1 or -2)' : ''
      out.push(`${field} "${config.kind}" cannot be drawn: use one of ${kinds.join(', ')}${note}, e.g. "${field}":"${DEFAULT_KIND[config.task]}".`)
      return out
    }
    const count = variantsOf(config)
    if (config.variant < 1 || config.variant > count) {
      out.push(`variant ${config.variant} does not exist for this transformation: use 1 to ${count}, e.g. "variant":1.`)
      return out
    }
    if (config.task === 'enlarge' && config.kind === '3' && config.shape === 'L') {
      out.push('Three times the L is taller than the grid, so scale factor 3 is drawn only with the triangle: use "shape":"triangle", or scale factor 2.')
    }
    if (!scenarioOf(config)) out.push('This transformation cannot be drawn with these settings: use e.g. ' + eg() + '.')
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const pair = /[([]\s*[-−–]?\s*\d+\s*[,;]\s*[-−–]?\s*\d+\s*[)\]]/.test(text)
    const equation = /\b[xy]\s*=\s*[-−]?\s*[xy\d]/i.test(text)
    const where = /\b(?:origin|vertex|vertices|corner|corners|centre of the shape|center of the shape|midpoint|middle of)\b/i.test(text)
    const specific = config.task === 'reflect'
      ? equation || /\bvertical|\bhorizontal|\bdiagonal|\bslop(?:e|ing)|\bx-axis|\by-axis|\bupright|\bflat line\b/i.test(text)
      : config.task === 'rotate'
        ? /\bquarter\b|\bhalf[- ]turn|\b(?:90|180|270)\b|\bclockwise|\banti-?clockwise|\bcounter-?clockwise|\bright angle|\bupside[- ]down/i.test(text)
        : config.task === 'enlarge'
          ? /\bdouble|\btriple|\btwice|\bthree times|\bhalf\b|\bhalve|\bshrink|\bsmaller|\bbigger|\blarger|\bnegative|\b(?:twice|three|two)\b|\bscale factor\s+(?:of\s+)?[-−]?[\d½]|[×x]\s*[-−]?\d|\bratio/i.test(text)
          : /\b\d+\s*(?:squares?|units?|steps?)\b|\b(?:right|left|up|down|across|upwards|downwards)\b(?!.*\bbuttons?\b)|\bvector\s*[([]|\bcolumn vector\b|\bnorth|\bsouth|\beast|\bwest/i.test(text)
    // "until it lands" is the aim; a position or a size for the centre is not.
    if (pair || where || specific) {
      out.push(`the prompt gives the answer away: it says a mirror line, a turn, a scale factor, a vector or a position, which the learner is to find -- ask for the outcome only ("${example}")`)
    }
    if (/\bdescribe|\bname the|\bstate the|\bwrite down|\bwhat transformation|\bwhich transformation|\btype\b|\benter\b|\bmatri(?:x|ces)\b|\bshear|\bstretch|\bglide|\bcombin|\bthen reflect|\bfollowed by|\btwo transformations|\btracing paper|\bruler|\bcompass|\bprotractor|\bplot\b|\bcalculate/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it has a shape, a dashed target and the thing to move, and no box to write in -- ask for that ("${example}")`)
    }
    return out
  },

  initial(config) {
    // The first mirror line that is not the asked one, so a reflection never starts solved; the others start at the identity.
    const tries: TfState[] = [START, { ...START, dir: 'h' }, { ...START, dir: 'up' }, { ...START, dir: 'down' }, { ...START, k: 1 }]
    return tries.find((t) => !landed(config, t)) ?? { ...START, k: 2 }
  },

  check(config, state) {
    return { ok: landed(config, state), wrongIds: [] }
  },

  solve(config) {
    return { ...safeScenario(config).answer }
  },

  View: TransformationsView,

  prompt: `SCENE "transformations" -- a coordinate grid with a grey shape, a dashed blue target shape, and an orange image of the shape that answers the learner at once. The learner handles the one thing that defines the transformation, and the image follows: a mirror line they slide and turn (reflection), a pin they drag for the centre and a turn they choose (rotation), a pin and a scale factor (enlargement), or an arrow whose head they drag (translation by a column vector). Thin dashed construction lines show the idea as it moves: each point and its image the same distance from the mirror, rays from the centre through every point, the same move for every point. The task is always to land the image exactly on the target. Whole-number positions only, with stepper buttons as well as dragging.
  For: transformations of shapes on a grid: reflection in a line, rotation about a centre, enlargement from a centre with a scale factor (including a fraction and a negative one), translation by a column vector.
  task: "reflect", "rotate", "enlarge" or "translate".
  shape: "L" (default) or "triangle". Neither has a mirror line of its own, so a reflection, a turn and a slide look different.
  mirror (reflect): "vertical" (a line x = k), "horizontal" (a line y = k) or "diagonal" (y = x, y = -x or y = x + 2). Default vertical.
  turn (rotate): "clockwise" (a quarter turn), "anticlockwise" (a quarter turn) or "half" (180 degrees). Always about a grid point. Default clockwise.
  scale (enlarge): 2, 3 (triangle only), "1/2" (the shape starts twice the size), -1 or -2. Always from a grid point. Default 2.
  variant: 1 to 3 (translate: 1 to 4; enlarge by -1 or -2: 1 to 2), a different prepared placement and answer. Optional, default 1; use a different variant each time the same task is asked again.
  Not drawn: combined transformations, shears, stretches, matrices, finding the equation or the vector in words, the invariant point, tracing paper. Do not use it for reflection of light, rotation of crops, protein translation, energy transformations, scalar and vector quantities in physics, similar shapes or scale drawings, or transformations of graphs.
  Before marking the card shows the shape, the target, the image as the learner has it, the construction lines, and the learner's own settings (the line's equation, the centre, the turn, the scale factor, the vector). It holds back which mirror line, centre, turn, scale factor or vector is right. Marking says what the right one was and why. The prompt must ask for the outcome only: do NOT write the mirror line, an equation, a centre, a vector, a turn or its direction, a scale factor, or whether the shape grows, shrinks or turns over, and do not ask the learner to describe or write anything.
  config: { "task":"reflect", "shape":"L", "mirror":"vertical", "variant":1 }  -- the prompt says "Slide the mirror line, or turn it with the direction buttons, until the reflected shape lands exactly on the dashed target."
       or { "task":"rotate", "shape":"triangle", "turn":"half", "variant":2 }  -- the prompt says "Drag the pin to set the centre, and choose a turn, until the turned shape lands exactly on the dashed target."
       or { "task":"enlarge", "shape":"L", "scale":2, "variant":1 }  -- the prompt says "Drag the pin to set the centre, and choose the scale factor, until the new shape lands exactly on the dashed target."
       or { "task":"translate", "shape":"L", "variant":1 }  -- the prompt says "Drag the arrow's head, or use the buttons, until the moved shape lands exactly on the dashed target."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Slide the mirror line, or turn it with the direction buttons, until the reflected shape lands exactly on the dashed target.",
    "payload": { "engine":"transformations", "config": { "task":"reflect", "shape":"L", "mirror":"vertical", "variant":1 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:transformations", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the pin to set the centre, and choose a turn, until the turned shape lands exactly on the dashed target.",
    "payload": { "engine":"transformations", "config": { "task":"rotate", "shape":"triangle", "turn":"half", "variant":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:transformations", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the pin to set the centre, and choose the scale factor, until the new shape lands exactly on the dashed target.",
    "payload": { "engine":"transformations", "config": { "task":"enlarge", "shape":"L", "scale":2, "variant":1 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:transformations", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the arrow's head, or use the buttons, until the moved shape lands exactly on the dashed target.",
    "payload": { "engine":"transformations", "config": { "task":"translate", "shape":"L", "variant":1 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:transformations", "why":"..." } }`,
}

registerEngine(transformationsEngine as SceneEngine<unknown, unknown>)
