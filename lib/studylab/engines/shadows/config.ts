// lib/studylab/engines/shadows/config.ts
//
// Two small shadow experiments, with the learner's hand doing the physics:
//   size -- slide a torch along a bench; straight rays past an opaque rabbit puppet make a larger or smaller
//           silhouette on a screen. Make the silhouette fit two blue marks.
//   day  -- slide the Sun along its daytime arc; a vertical stick's shadow swings round and changes length.
//           Find its shortest length.
//
// The science is geometric, and marking uses these rules, never pixels from the drawing. With a point source, a
// puppet of height H, source-puppet distance u and puppet-screen distance v, similar triangles give h = H(u+v)/u.
// A 100 cm shadow stick has shadow length L = 100/tan(elevation). The daylight model uses a 65 degree noon
// elevation and a symmetric day; it is a model of one day, not a claim that solar noon is 12:00 everywhere.
// Sources: BBC Bitesize, Light and shadows (torch/object investigation, shadow shape and daily change),
// https://www.bbc.co.uk/bitesize/topics/z3nnb9q/articles/z9wm7yc ; Science Learning Hub, Alternative conceptions
// about light and shadows (a shadow is the relative absence of light, not a thing or a reflection),
// https://www.sciencelearn.org.nz/resources/2783-alternative-conceptions-about-light-and-shadows
//
// Ideas taken, never code or art: direct source manipulation from the Singapore OSP shadow lab; drag-the-Sun
// observation from Tuva's Shifting Skies. Transparent/translucent transmission is deliberately not a third task:
// those materials can still cast faint, fuzzy or coloured shadows (Science Learning Hub, activity 2792).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { ShadowsView } from './View'

export type ShadowsConfig = { task: 'size'; height: number } | { task: 'day' }
export type ShadowsState = { distance?: number; time?: number }

export const PUPPET_CM = 12
export const SCREEN_CM = 10
export const D_MIN = 6
export const D_MAX = 30
export const HEIGHT_MIN = 18
export const HEIGHT_MAX = 24
/** A visible 0.75 cm is close enough; the exact height is named after marking. */
export const SIZE_TOL = 0.75
export const TIME_MIN = 8
export const TIME_MAX = 16
export const STICK_CM = 100
export const NOON_ELEVATION = 65
/** Within 12 cm of the shortest shadow, about half an hour either side in this model. */
export const DAY_TOL = 12

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const rounded = (v: number, step: number) => Math.round(v / step) * step

/** Shadow height in cm, from similar triangles. */
export function shadowHeight(distance: number): number {
  return (PUPPET_CM * (distance + SCREEN_CM)) / distance
}

export function elevationAt(time: number): number {
  return NOON_ELEVATION * Math.sin(((time - 6) * Math.PI) / 12)
}

/** Shadow-stick length in cm. The supported times keep the low-Sun shadow on the ground patch. */
export function shadowLength(time: number): number {
  return STICK_CM / Math.tan((elevationAt(time) * Math.PI) / 180)
}

export function startDistance(): number {
  return D_MAX
}

export function madeDistance(_config: Extract<ShadowsConfig, { task: 'size' }>, state: ShadowsState): number {
  const d = state?.distance
  return typeof d === 'number' && Number.isFinite(d) ? clamp(rounded(d, 0.5), D_MIN, D_MAX) : startDistance()
}

export function madeTime(state: ShadowsState): number {
  const t = state?.time
  return typeof t === 'number' && Number.isFinite(t) ? clamp(rounded(t, 0.25), TIME_MIN, TIME_MAX) : 8.5
}

export function clock(time: number): string {
  const mins = Math.round(time * 60)
  const h24 = Math.floor(mins / 60)
  const m = mins % 60
  const h = h24 % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`
}

export function sizeSolved(config: Extract<ShadowsConfig, { task: 'size' }>, state: ShadowsState): boolean {
  return Math.abs(shadowHeight(madeDistance(config, state)) - config.height) <= SIZE_TOL + 1e-9
}

export function daySolved(state: ShadowsState): boolean {
  return shadowLength(madeTime(state)) <= shadowLength(12) + DAY_TOL + 1e-9
}

export function goodPrompt(config: ShadowsConfig): string {
  return config.task === 'size'
    ? `Drag the torch by its white grip, or use the distance buttons, to make the rabbit’s shadow ${config.height} cm tall.`
    : 'Drag the Sun along its path, or use the time buttons, to make the stick’s shadow as short as you can.'
}

const numberText = (v: number) => String(Math.round(v * 10) / 10)

export function working(config: ShadowsConfig, state: ShadowsState): string {
  if (config.task === 'size') {
    const h = shadowHeight(madeDistance(config, state))
    const lead = Math.abs(h - config.height) < 0.05 ? 'Yes.' : `Near enough: the exact goal is ${config.height} cm.`
    return `${lead} Your rabbit shadow is ${numberText(h)} cm tall. Light travels in straight lines, so the shadow keeps the rabbit’s outline. Moving the torch closer makes the shadow bigger; moving it away makes it smaller.`
  }
  const t = madeTime(state)
  const lead = Math.abs(t - 12) < 0.01 ? 'Yes.' : 'Near enough: the shortest shadow is at 12:00 midday in this model.'
  return `${lead} At ${clock(t)}, the shadow is ${Math.round(shadowLength(t))} cm long. Around midday the Sun is highest and the shadow is shortest. Morning and afternoon shadows are longer and point in opposite directions.`
}

export function madeText(config: ShadowsConfig, state: ShadowsState): string {
  if (config.task === 'size') {
    const h = shadowHeight(madeDistance(config, state))
    return `Your rabbit shadow is ${numberText(h)} cm tall; the blue marks are ${config.height} cm apart.`
  }
  const t = madeTime(state)
  return `At ${clock(t)}, your stick’s shadow is ${Math.round(shadowLength(t))} cm long, pointing ${t < 12 ? 'west' : t > 12 ? 'east' : 'only a short way from the stick'}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's semantic config. Values outside the drawable range still parse; faults offers a nearby one.

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, ShadowsConfig['task']> = {
  size: 'size', 'shadow-size': 'size', 'change-size': 'size', 'changing-size': 'size', resize: 'size', bigger: 'size', smaller: 'size',
  torch: 'size', puppet: 'size', 'shadow-puppet': 'size', 'torch-and-screen': 'size', 'light-distance': 'size', 'move-light': 'size', 'move-the-light': 'size',
  day: 'day', sun: 'day', sunlight: 'day', 'shadow-stick': 'day', stick: 'day', 'through-the-day': 'day', 'through-day': 'day', daytime: 'day',
  shortest: 'day', 'shortest-shadow': 'day', midday: 'day', noon: 'day', 'sun-position': 'day', 'daily-shadows': 'day', 'shadows-through-the-day': 'day',
}

function readHeight(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const key = raw.trim().toLowerCase()
    if (key === 'twice' || key === 'double' || key === 'twice as tall') return PUPPET_CM * 2
    if (key === 'same' || key === 'same size') return PUPPET_CM
  }
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*cm$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

export const shadowsEngine: SceneEngine<ShadowsConfig, ShadowsState> = {
  id: 'shadows',
  // "shadow" is distinctive. Everything that includes the common word "light" is a whole phrase.
  covers: ['shadows', 'shadow formation', 'shadow stick'],
  phrases: [
    'shadow', 'how shadows form', 'how shadows are formed', 'forming shadows', 'changing the size of a shadow', 'change the size of a shadow',
    'shadow size', 'size of shadows', 'shadow shapes', 'shape of a shadow', 'shadow puppets', 'shadow puppet', 'torch shadows',
    'light travels in straight lines', 'light travelling in straight lines', 'straight lines and shadows', 'opaque objects block light',
    'shadows through the day', 'shadows during the day', 'changing shadows', 'sun shadows', 'length of a shadow', 'shadow length',
  ],
  notFor: [
    'reflection', 'refraction', 'plane mirror', 'lenses', 'day and night', 'day-night cycle', 'eclipse', 'eclipses', 'phases of the Moon',
    'electromagnetic spectrum', 'sound', 'sound waves', 'water waves', 'transparent materials', 'translucent materials',
    'transparent translucent and opaque', 'transparent, translucent and opaque', 'opaque translucent and transparent', 'light transmission',
  ],
  isolates: 'position',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    const rawHeight = first(src, ['height', 'target', 'targetHeight', 'shadowHeight', 'size'])
    if (word && !Object.prototype.hasOwnProperty.call(TASK_WORDS, word)) return null
    const task = word ? TASK_WORDS[word] : rawHeight !== undefined ? 'size' : first(src, ['time', 'day', 'sun']) !== undefined ? 'day' : null
    if (!task) return null
    if (task === 'day') return { task }
    const height = rawHeight === undefined ? 24 : readHeight(rawHeight)
    return height === null ? null : { task, height }
  },

  faults(config) {
    if (config.task === 'day') return []
    const near = clamp(Math.round(config.height), HEIGHT_MIN, HEIGHT_MAX)
    if (!Number.isInteger(config.height)) return [`The blue marks use whole centimetres: choose a height from ${HEIGHT_MIN} to ${HEIGHT_MAX} cm, e.g. height ${near}.`]
    if (config.height < HEIGHT_MIN || config.height > HEIGHT_MAX) {
      const why = config.height < HEIGHT_MIN ? 'would be too close to the starting shadow to make a clear change' : 'would put the torch beyond the edge of the bench'
      return [`A ${config.height} cm rabbit shadow ${why}: choose ${HEIGHT_MIN} to ${HEIGHT_MAX} cm, e.g. height ${near}.`]
    }
    const exact = (PUPPET_CM * SCREEN_CM) / (config.height - PUPPET_CM)
    if (Math.abs(shadowHeight(rounded(exact, 0.5)) - config.height) > SIZE_TOL) {
      return [`height ${config.height} falls between the torch's half-centimetre stops: use a nearby whole number such as 20 or 24 cm.`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const idea = config.task === 'size'
      ? /\bcloser\b[^.]{0,35}\bbigger\b|\bbigger\b[^.]{0,35}\bcloser\b|\bfurther\b[^.]{0,35}\bsmaller\b|\bfarther\b[^.]{0,35}\bsmaller\b|\bsimilar triangles\b|\bh\s*=|\bstraight lines\b/i.test(text)
      : /\bmidday\b|\bnoon\b|\b12(?::00)?\b|\bhighest\b|\boverhead\b|\bshortest\s+(?:at|around)\b|\bopposite directions?\b/i.test(text)
    if (idea) out.push(`the prompt gives the answer away: it states the relationship the learner is to discover by watching the shadow -- ask for the outcome only ("${example}")`)
    if (!/\bdrag\b|\bslide\b|\bmove\b|\bdistance buttons\b|\btime buttons\b/i.test(text)) {
      out.push(`the prompt must say the gesture: drag the ${config.task === 'size' ? 'torch by its white grip' : 'Sun along its path'}, or use the buttons ("${example}")`)
    }
    if (/\btransparent\b|\btranslucent\b|\breflect|\brefract|\beclipse\b|\bmultiple.choice\b|\btype\b|\benter (?:your|the|a)\b|\bwatch (?:a|the) (?:video|animation)\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it has one opaque ${config.task === 'size' ? 'puppet, torch and screen' : 'stick and Sun'}, and no transmission, reflection, typed answer or video ("${example}")`)
    }
    return out
  },

  initial: (config) => config.task === 'size' ? { distance: startDistance() } : { time: 8.5 },
  check(config, state) {
    const ok = config.task === 'size' ? sizeSolved(config, state) : daySolved(state)
    return { ok, wrongIds: ok ? [] : [config.task === 'size' ? 'torch' : 'sun'] }
  },
  solve(config) {
    if (config.task === 'day') return { time: 12 }
    const exact = (PUPPET_CM * SCREEN_CM) / (config.height - PUPPET_CM)
    return { distance: clamp(rounded(exact, 0.5), D_MIN, D_MAX) }
  },
  View: ShadowsView,

  prompt: `SCENE "shadows" -- two hands-on shadow experiments on quiet light panels, drawn as real apparatus. In "size", a torch with a white grip shines at an opaque wooden rabbit puppet in front of a screen. Two straight amber rays pass its outline; a rabbit-shaped silhouette on the screen grows or shrinks as the torch moves. Blue marks show the goal height. Live readouts name shadow height and torch-to-rabbit distance in cm. In "day", the learner drags a Sun along a dashed sky path above a wooden shadow stick. Its ground shadow swings from one side to the other and changes length; a live clock and shadow length in cm respond. Reduced motion gives the same still experiment after every move.
  For: shadows as blocked light, light travelling in straight lines, an opaque object making a shadow with its outline, changing shadow size by moving a light, and a shadow stick's length and direction through the day. It answers "a shadow is a solid thing", "a shadow is an exact same-size copy", and "only the object's size matters".
  size: make the rabbit shadow fit the blue marks. height: the goal in whole cm, 18 to 24; default 24 (18, 20 and 24 have exact half-centimetre stops; 19, 21 and 22 are accepted within the visible tolerance). The 12 cm puppet and fixed screen remain in place; only the torch moves. The start is unsolved. A visibly near shadow passes, and marking gives the exact height and the closer-larger/further-smaller rule.
  day: find the shortest stick shadow by dragging the Sun or using the time buttons, from 8:00 am to 4:00 pm. The model has a 65 degree maximum Sun elevation and a 100 cm stick. A shadow within 12 cm of the minimum passes; marking names 12:00 midday as the exact shortest point and explains the opposite morning/afternoon directions. This is one model day, not a claim that solar noon is 12:00 everywhere.
  Not drawn: transparent/translucent materials, penumbra from an extended source, multiple lights, reflection, refraction, eclipses, seasons, latitude or a year-long Sun path. Do not promise a material-sorting task, a video, typed measurements or an animation to watch: the learner moves the torch or Sun.
  Before marking the card shows only the apparatus, the observable shadow, the goal and live measurements. It holds back the distance-size relationship, "light travels in straight lines", midday/noon, the highest-Sun rule and the exact shortest time. The prompt must ask for the outcome and name the gesture; do NOT state those rules.
  config: { "task":"size", "height":24 }  -- the prompt says "Drag the torch by its white grip, or use the distance buttons, to make the rabbit’s shadow 24 cm tall."
       or { "task":"size", "height":20 }  -- the prompt says "Drag the torch by its white grip, or use the distance buttons, to make the rabbit’s shadow 20 cm tall."
       or { "task":"day" }  -- the prompt says "Drag the Sun along its path, or use the time buttons, to make the stick’s shadow as short as you can."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the torch by its white grip, or use the distance buttons, to make the rabbit’s shadow 24 cm tall.",
    "payload": { "engine":"shadows", "config": { "task":"size", "height":24 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:shadows", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the torch by its white grip, or use the distance buttons, to make the rabbit’s shadow 20 cm tall.",
    "payload": { "engine":"shadows", "config": { "task":"size", "height":20 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:shadows", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the Sun along its path, or use the time buttons, to make the stick’s shadow as short as you can.",
    "payload": { "engine":"shadows", "config": { "task":"day" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"position", "apparatus":"scene:shadows", "why":"..." } }`,
}

registerEngine(shadowsEngine as SceneEngine<unknown, unknown>)
