// lib/studylab/engines/eye/config.ts
//
// The eye worked by its own muscles, and the eye answers (see .superpowers/bakeoff/eye/design.md).
//   focus -- the side cut: set the ciliary muscle so the light from a close flower or a far tree meets on the retina;
//   pupil -- the front view: set the iris's circular and radial muscles for bright sun or a dim room.
//
// Rules, computed here and never read from the drawing:
//   - ciliary contracted: ligaments slack, lens fat (bends light more: right for a near object);
//     ciliary relaxed: ligaments tight, lens thin (right for a far object);
//   - circular contracted squeezes the pupil narrow, radial contracted pulls it wide; both the same leaves it medium.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { EyeView } from './View'

export type Muscle = 'relaxed' | 'contracted'
export type Meets = 'behind' | 'on' | 'front'
export type PupilSize = 'narrow' | 'medium' | 'wide'

export type EyeConfig =
  | { kind: 'focus'; object: 'near' | 'far' }
  | { kind: 'pupil'; light: 'bright' | 'dim' }
  /** Read but not drawn: faults refuses it and says what works instead. `asked` is what was asked for. */
  | { kind: 'other'; asked: string }
  | { kind: 'focus'; object: 'other'; asked: string }
  | { kind: 'pupil'; light: 'other'; asked: string }

export type EyeState = { ciliary: Muscle; circular: Muscle; radial: Muscle }

// ---------------------------------------------------------------------------
// The rules.

/** Where the light from the thing meets, for the lens the ciliary muscle makes. */
export function meets(object: 'near' | 'far', ciliary: Muscle): Meets {
  if (object === 'near') return ciliary === 'contracted' ? 'on' : 'behind'
  return ciliary === 'relaxed' ? 'on' : 'front'
}

export function pupilSize(circular: Muscle, radial: Muscle): PupilSize {
  if (circular === radial) return 'medium'
  return circular === 'contracted' ? 'narrow' : 'wide'
}

/** The state, read safely: anything missing or corrupt reads as relaxed. */
export function readState(state: Partial<EyeState> | null | undefined): EyeState {
  const m = (v: unknown): Muscle => (v === 'contracted' ? 'contracted' : 'relaxed')
  return { ciliary: m(state?.ciliary), circular: m(state?.circular), radial: m(state?.radial) }
}

type Drawn = Extract<EyeConfig, { kind: 'focus'; object: 'near' | 'far' } | { kind: 'pupil'; light: 'bright' | 'dim' }>

/** A config the card can draw; the rest are refused by faults. */
export function drawable(config: EyeConfig): config is Drawn {
  return (config.kind === 'focus' && (config.object === 'near' || config.object === 'far')) ||
    (config.kind === 'pupil' && (config.light === 'bright' || config.light === 'dim'))
}

export function done(config: EyeConfig, state: Partial<EyeState> | null | undefined): boolean {
  if (!drawable(config)) return false
  const s = readState(state)
  if (config.kind === 'focus') return meets(config.object, s.ciliary) === 'on'
  return config.light === 'bright'
    ? s.circular === 'contracted' && s.radial === 'relaxed'
    : s.radial === 'contracted' && s.circular === 'relaxed'
}

// ---------------------------------------------------------------------------
// Words on the card. Before marking, only observations; never right or wrong.

export function captionText(config: EyeConfig, state: Partial<EyeState> | null | undefined): string {
  const s = readState(state)
  if (config.kind === 'focus') {
    return s.ciliary === 'contracted'
      ? 'The ciliary muscle is contracted: the ligaments are slack and the lens is fat.'
      : 'The ciliary muscle is relaxed: the ligaments are pulled tight and the lens is thin.'
  }
  const size = pupilSize(s.circular, s.radial)
  if (size === 'narrow') return 'The circular muscle is contracted, squeezing the pupil narrow.'
  if (size === 'wide') return 'The radial muscle is contracted, pulling the pupil wide.'
  return s.circular === 'contracted'
    ? 'Both iris muscles are contracted, pulling against each other: the pupil stays medium.'
    : 'Both iris muscles are relaxed: the pupil rests at a medium size.'
}

export function goalText(config: EyeConfig): string {
  if (config.kind === 'focus') return config.object === 'far' ? 'See the far tree sharply' : 'See the close flower sharply'
  return config.kind === 'pupil' && config.light === 'dim' ? 'Dim room: let in enough light to see' : 'Bright sun: keep the retina safe'
}

const MEETS_WORDS: Record<Meets, string> = { behind: 'Behind the retina', on: 'On the retina', front: 'In front of the retina' }
const SIZE_WORDS: Record<PupilSize, string> = { narrow: 'Narrow', medium: 'Medium', wide: 'Wide' }

/** The live measure: its label and its value for the state shown. */
export function measureOf(config: EyeConfig, state: Partial<EyeState> | null | undefined): { label: string; value: string } {
  const s = readState(state)
  if (config.kind === 'focus') {
    return { label: 'Light meets', value: MEETS_WORDS[meets(config.object === 'far' ? 'far' : 'near', s.ciliary)] }
  }
  return { label: 'Pupil', value: SIZE_WORDS[pupilSize(s.circular, s.radial)] }
}

/** What a correct card says. */
export function working(config: EyeConfig): string {
  if (config.kind === 'focus') {
    return config.object === 'far'
      ? "Sharp. The ciliary muscle relaxed, the ligaments pulled tight and the lens grew thinner, so the far tree's light meets on the retina."
      : "Sharp. The ciliary muscle contracted, the ligaments went slack and the lens grew fatter, so the close flower's light meets on the retina."
  }
  return config.kind === 'pupil' && config.light === 'dim'
    ? 'You can see. The radial muscle contracted, and the wide pupil lets in more light. It is a reflex.'
    : 'Safe. The circular muscle contracted, and the narrow pupil lets in less light. It is a reflex.'
}

/** What a wrong card says: what the learner made, and why that fails. */
export function madeText(config: EyeConfig, state: Partial<EyeState> | null | undefined): string {
  const s = readState(state)
  if (config.kind === 'focus') {
    return config.object === 'far'
      ? 'Blurred. With the ciliary muscle contracted the lens stays fat, so the light from the far tree meets in front of the retina.'
      : 'Blurred. With the ciliary muscle relaxed the lens stays thin, so the light from the close flower meets behind the retina.'
  }
  const size = pupilSize(s.circular, s.radial)
  const bright = config.kind === 'pupil' && config.light === 'bright'
  if (size === 'medium') {
    const how = s.circular === 'contracted' ? 'Both muscles pull against each other' : 'Neither muscle is pulling'
    return `${how}: the pupil stays medium and too ${bright ? 'much bright' : 'little'} light gets in.`
  }
  return bright
    ? 'The pupil is wide: bright sunlight floods in and could damage the retina.'
    : 'The pupil is narrow: too little light gets in to see in the dim room.'
}

export function describe(config: EyeConfig, state: Partial<EyeState> | null | undefined): string {
  const s = readState(state)
  if (config.kind === 'focus') {
    const near = config.object !== 'far'
    const tight = s.ciliary === 'relaxed'
    const m = meets(near ? 'near' : 'far', s.ciliary)
    return `Side cut of an eye looking at ${near ? 'a flower held close' : 'a tree far away'}. The ciliary muscle is ${s.ciliary}, the suspensory ligaments are ${tight ? 'tight' : 'slack'} and the lens is ${tight ? 'thin' : 'fat'}. Light from the ${near ? 'flower' : 'tree'} meets ${m === 'on' ? 'on' : m === 'behind' ? 'behind' : 'in front of'} the retina, so its upside-down picture there is ${m === 'on' ? 'sharp' : 'blurred'}. Labelled: cornea, iris, lens, ciliary muscle, suspensory ligaments, retina, fovea, blind spot, optic nerve.`
  }
  const bright = config.kind === 'pupil' && config.light === 'bright'
  return `Front view of an eye in ${bright ? 'bright sunlight' : 'a dim room'}. The circular muscle round the pupil is ${s.circular} and the radial muscle across the iris is ${s.radial}; the pupil is ${pupilSize(s.circular, s.radial)}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const hasWord = (key: string, words: string[]) => key.split('-').some((w) => words.includes(w))

function readKind(raw: unknown): 'focus' | 'pupil' | 'other' | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string') return 'other'
  const key = keyOf(raw)
  if (!key) return null
  if (hasWord(key, ['focus', 'focusing', 'focuses', 'accommodation', 'ciliary', 'lens', 'near', 'far', 'distance', 'sharp'])) return 'focus'
  if (hasWord(key, ['pupil', 'iris', 'reflex', 'light', 'bright', 'dim', 'circular', 'radial'])) return 'pupil'
  return 'other'
}

export const FOCUS_EXAMPLE = '{ "kind":"focus", "object":"near" }'
export const PUPIL_EXAMPLE = '{ "kind":"pupil", "light":"dim" }'

export const goodPrompt = {
  nearFocus: 'You look at a flower held close to your eye. Use the Ciliary muscle buttons until the flower is sharp on the retina.',
  farFocus: 'Now look up at a tree far away. Pick a button for the ciliary muscle so the light from the tree meets on the retina.',
  bright: 'You step out into bright sun. Set the circular and radial muscles with their buttons, the way the pupil reflex would, to keep the retina safe.',
  dim: 'The lights go down. Set the two iris muscles with their buttons, the way the reflex would, so you can still see.',
} as const

const FOCUS_TELLS = [
  'contract', 'contracts', 'contracted', 'contracting', 'relax', 'relaxes', 'relaxed', 'relaxing', 'tighten', 'tight', 'taut',
  'slack', 'loose', 'loosen', 'fat', 'fatter', 'thick', 'thicker', 'thin', 'thinner', 'round', 'rounder', 'convex', 'bulge',
]
const PUPIL_TELLS = [
  'narrow', 'narrower', 'narrows', 'smaller', 'shrink', 'constrict', 'widen', 'wider', 'widens', 'bigger', 'larger', 'dilate',
  'contract', 'contracts', 'contracted', 'relax', 'relaxes', 'relaxed',
]

export const eyeEngine: SceneEngine<EyeConfig, EyeState> = {
  id: 'eye',
  covers: ['the eye', 'structure of the eye', 'parts of the eye', 'the pupil reflex', 'the iris reflex', 'accommodation', 'focusing the eye', 'how the eye focuses', 'how we see'],
  phrases: ['eye', 'pupil', 'iris', 'lens', 'cornea', 'retina', 'fovea', 'blind spot', 'optic nerve', 'ciliary muscle', 'suspensory ligaments', 'accommodation', 'focus'],
  notFor: [
    'refraction', 'converging lens', 'converging lenses', 'diverging lens', 'lens equation', 'focal length', 'electromagnetic spectrum', 'nerve impulses', 'nerve impulse', 'reflex arc', 'reflex arcs',
    'long sight', 'short sight', 'long-sighted', 'short-sighted', 'myopia', 'hypermetropia', 'glasses', 'contact lenses', 'correcting sight', 'the ear', 'hearing',
    'eye of the storm', 'eye of a needle', 'camera', 'microscope',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.kind && typeof o.kind === 'object' ? (o.kind as Record<string, unknown>) : null
    const src = nested ?? o
    const rawKind = first(src, nested ? ['kind', 'task', 'type'] : ['kind', 'task', 'type', 'mode', 'view'])
    const rawObject = first(src, ['object', 'target', 'distance', 'looking-at', 'lookingAt', 'subject'])
    const rawLight = first(src, ['light', 'lighting', 'brightness', 'level', 'condition'])
    let kind = readKind(rawKind)
    if (kind === null) kind = rawLight !== undefined && rawObject === undefined ? 'pupil' : 'focus'
    if (kind === 'other') return { kind: 'other', asked: typeof rawKind === 'string' ? rawKind.trim() : String(rawKind) }
    if (kind === 'focus') {
      if (rawObject === undefined || rawObject === null || rawObject === '') return { kind: 'focus', object: 'near' }
      const key = keyOf(rawObject)
      if (hasWord(key, ['very', 'middle', 'mid', 'medium', 'between', 'intermediate'])) return { kind: 'focus', object: 'other', asked: typeof rawObject === 'string' ? rawObject.trim() : String(rawObject) }
      if (hasWord(key, ['near', 'close', 'closer', 'nearby', 'flower', 'book', 'reading'])) return { kind: 'focus', object: 'near' }
      if (hasWord(key, ['far', 'distant', 'distance', 'tree', 'faraway', 'away'])) return { kind: 'focus', object: 'far' }
      return { kind: 'focus', object: 'other', asked: typeof rawObject === 'string' ? rawObject.trim() : String(rawObject) }
    }
    if (rawLight === undefined || rawLight === null || rawLight === '') return { kind: 'pupil', light: 'bright' }
    const key = keyOf(rawLight)
    if (hasWord(key, ['bright', 'sun', 'sunny', 'sunlight', 'high', 'light'])) return { kind: 'pupil', light: 'bright' }
    if (hasWord(key, ['dim', 'low', 'dark', 'darkness', 'night'])) return { kind: 'pupil', light: 'dim' }
    return { kind: 'pupil', light: 'other', asked: typeof rawLight === 'string' ? rawLight.trim() : String(rawLight) }
  },

  faults(config) {
    if (config.kind === 'other') {
      return [`Only two things are drawn, focusing on a near or far thing (${FOCUS_EXAMPLE}) and the pupil in bright or dim light (${PUPIL_EXAMPLE}), not "${config.asked}": long sight, short sight, glasses and contact lenses are not built. Use ${FOCUS_EXAMPLE}.`]
    }
    if (config.kind === 'focus' && config.object === 'other') {
      return [`The eye looks at a flower held close ("near") or a tree far away ("far"), not "${config.asked}": use ${FOCUS_EXAMPLE}.`]
    }
    if (config.kind === 'pupil' && config.light === 'other') {
      return [`The pupil card is in "bright" sun or a "dim" room, not "${config.asked}": use ${PUPIL_EXAMPLE}.`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const list = config.kind === 'pupil' ? PUPIL_TELLS : FOCUS_TELLS
    const found = list.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text))
    if (config.kind === 'pupil' && /\b(?:less|more) light\b/i.test(text)) found.push('less or more light')
    return found.length
      ? [`the prompt gives the answer away with ${found.map((w) => `"${w}"`).join(', ')}: say only the gesture and the situation, e.g. "${config.kind === 'pupil' ? goodPrompt.dim : goodPrompt.nearFocus}"`]
      : []
  },

  initial(config) {
    if (config.kind === 'focus') return { ciliary: config.object === 'far' ? 'contracted' : 'relaxed', circular: 'relaxed', radial: 'relaxed' }
    if (config.kind === 'pupil' && config.light === 'dim') return { ciliary: 'relaxed', circular: 'contracted', radial: 'relaxed' }
    return { ciliary: 'relaxed', circular: 'relaxed', radial: 'contracted' }
  },

  check(config, state) {
    const ok = done(config, state)
    if (ok) return { ok, wrongIds: [] }
    const s = readState(state)
    const want = eyeEngine.solve(config)
    const wrongIds = (['ciliary', 'circular', 'radial'] as const).filter((k) => {
      if (config.kind === 'focus') return k === 'ciliary' && s[k] !== want[k]
      return k !== 'ciliary' && s[k] !== want[k]
    })
    return { ok, wrongIds }
  },

  solve(config) {
    if (config.kind === 'focus') return { ciliary: config.object === 'far' ? 'relaxed' : 'contracted', circular: 'relaxed', radial: 'relaxed' }
    if (config.kind === 'pupil' && config.light === 'dim') return { ciliary: 'relaxed', circular: 'relaxed', radial: 'contracted' }
    return { ciliary: 'relaxed', circular: 'contracted', radial: 'relaxed' }
  },

  View: EyeView,

  prompt: `SCENE "eye" -- the human eye worked by its own muscles, drawn as the real thing on a quiet light panel. "focus": the eye cut through from the side (cornea, iris, lens, ciliary muscle, suspensory ligaments, retina, fovea, blind spot, optic nerve) looking at a flower held close or a tree far away; three rays of light from the top of the thing bend at the cornea and the lens and meet on the retina (where the thing's upside-down picture is sharp) or in front of or behind it (where the picture is blurred). The learner presses the ciliary muscle's Relaxed or Contracted button: the muscle darkens and bulges in, the ligaments go slack, the lens swells fat, the rays swing and the picture on the retina sharpens or blurs. "pupil": the eye from the front in bright sun or a dim room, with the iris's circular and radial muscles drawn in; the learner sets each muscle Relaxed or Contracted and the pupil narrows or widens (one press gives a medium pupil, two finish it).
  For: the eye and its parts, accommodation (how the eye focuses on near and far things), the pupil reflex (bright and dim light), how we see. It answers "the lens moves in and out", "a thick lens is for far things" and "the pupil reflex is a choice".
  Before marking the card names the parts, shows the muscle states, a live caption and a readout ("Light meets" or "Pupil"), and never says right or wrong. Marking says what happened and why. The prompt must say the gesture and the situation only: do NOT say which muscle state to pick, or words such as contract, relax, tight, slack, thick, thin, fatter, narrow, wider, dilate, constrict.
  Not drawn: long sight, short sight, glasses, contact lenses, the ear, nerves, other animals' eyes.
  config: { "kind":"focus", "object":"near" }  -- the prompt says "${goodPrompt.nearFocus}"
       or { "kind":"focus", "object":"far" }  -- the prompt says "${goodPrompt.farFocus}"
       or { "kind":"pupil", "light":"bright" }  -- the prompt says "${goodPrompt.bright}"
       or { "kind":"pupil", "light":"dim" }  -- the prompt says "${goodPrompt.dim}"
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt.farFocus}",
    "payload": { "engine":"eye", "config": { "kind":"focus", "object":"far" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:eye", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt.dim}",
    "payload": { "engine":"eye", "config": { "kind":"pupil", "light":"dim" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:eye", "why":"..." } }`,
}

registerEngine(eyeEngine as SceneEngine<unknown, unknown>)
