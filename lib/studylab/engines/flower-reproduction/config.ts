// lib/studylab/engines/flower-reproduction/config.ts
//
// A flower cut in half, and the two journeys that make a seed.
//   pollinate -- a bee hovers by the flower. The learner flies it to the part that makes pollen, then to the part that
//                catches it: pollen only sticks on the sticky stigma;
//   fertilise -- pollen grains already sit on the stigma. The learner steers the tip of each grain's tube down the
//                style into an ovule. The grain stays where it is; its nucleus travels down the tube and joins the egg.
//                Each ovule takes one tube.
//
// Facts (checked against the CIE O level / IGCSE revision notes in .superpowers/bakeoff/flower-reproduction/research.md):
//   - pollination is pollen landing on a stigma (from an anther, by an insect here); fertilisation is the male nucleus
//     joining the female nucleus in the ovule, after a pollen tube grows down the style;
//   - the whole grain does not travel to the ovule; one pollen nucleus fertilises one ovule, which becomes a seed, and the
//     ovary becomes the fruit.
// Refused: wind pollination, seed dispersal, naming the fruit as a task (no honest hands-on act in a card this size).
//
// Geometry lives in View.tsx; marking here reads only the state's own part names and tube ends, never the drawing.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { FlowerReproductionView } from './View'

export const FLOWERS = ['buttercup', 'poppy', 'geranium'] as const
export const PARTS = ['anther', 'stigma', 'style', 'ovary', 'petal', 'filament', 'sepal'] as const
export type PartName = (typeof PARTS)[number]

export const GRAINS_MIN = 1
export const GRAINS_MAX = 3
export const OVULES_MIN = 2
export const OVULES_MAX = 5
export const DEFAULT_GRAINS = 2
export const DEFAULT_OVULES = 4
/** Pollen the bee leaves when it lands loaded on the stigma. */
export const DEPOSIT = 3

export type FlowerConfig =
  | { task: 'pollinate'; flower: string }
  | { task: 'fertilise'; flower: string; grains: number; ovules: number }

export type Pt = { x: number; y: number }
export type FlowerState = {
  /** pollinate: where the bee hovers (undefined: at its start), the part it is on, whether it carries pollen, grains on the stigma. */
  bee?: Pt
  on?: PartName | null
  loaded?: boolean
  picked?: boolean
  grains?: number
  /** fertilise: per grain, the tube's tip while it is being steered, and the ovule it has reached. */
  tips?: (Pt | null)[]
  to?: (number | null)[]
}

const PLAIN = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const POLLINATE_WORDS = /pollinat|bee|insect|carry|anther|stigma|pollen transfer/
const FERTILISE_WORDS = /fertilis|fertiliz|tube|ovule|seed|nucleus|nuclei|grow/

function readTask(raw: Record<string, unknown>): 'pollinate' | 'fertilise' | null {
  const t = raw.task
  const text = PLAIN(typeof t === 'string' ? t : typeof t === 'object' && t ? String((t as Record<string, unknown>).kind ?? '') : '')
  if (FERTILISE_WORDS.test(text)) return 'fertilise'
  if (POLLINATE_WORDS.test(text)) return 'pollinate'
  if (!text) {
    if ('grains' in raw || 'ovules' in raw) return 'fertilise'
    return 'pollinate'
  }
  return null
}
const whole = (v: unknown, fallback: number): number | null => {
  if (v === undefined || v === null || v === '') return fallback
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}
const flowerWord = (v: unknown): string => (typeof v === 'string' && v.trim() ? PLAIN(v) : 'buttercup')

export const isFlower = (f: string): f is (typeof FLOWERS)[number] => (FLOWERS as readonly string[]).includes(f)
/** The flower a config draws: refused names still get a drawing. */
export const flowerOf = (c: FlowerConfig): (typeof FLOWERS)[number] => (isFlower(c.flower) ? c.flower : 'buttercup')

// ---------------------------------------------------------------------------
// The rules.

/** The bee lands on a part: on an anther it loads pollen; loaded on the stigma it leaves pollen there. Nowhere else changes anything. */
export function land(state: FlowerState, part: PartName | null, at?: Pt): FlowerState {
  const next: FlowerState = { ...state, on: part }
  if (at) next.bee = at
  if (part === 'anther') {
    next.loaded = true
    next.picked = true
  }
  if (part === 'stigma' && state.loaded) next.grains = DEPOSIT
  return next
}

export const stigmaGrains = (state: FlowerState): number => (typeof state?.grains === 'number' && state.grains > 0 ? state.grains : 0)

/** Per grain, the ovule its tube has reached, read safely; an ovule is taken once. */
export function reached(config: Extract<FlowerConfig, { task: 'fertilise' }>, state: FlowerState): (number | null)[] {
  const raw = Array.isArray(state?.to) ? state.to : []
  const taken = new Set<number>()
  return Array.from({ length: config.grains }, (_, i) => {
    const o = raw[i]
    if (typeof o !== 'number' || !Number.isInteger(o) || o < 0 || o >= config.ovules || taken.has(o)) return null
    taken.add(o)
    return o
  })
}

export function done(config: FlowerConfig, state: FlowerState): boolean {
  if (config.task === 'pollinate') return stigmaGrains(state) > 0
  return reached(config, state).every((o) => o !== null)
}

export function madeSentence(config: FlowerConfig, state: FlowerState): string {
  if (config.task === 'pollinate') {
    if (stigmaGrains(state) > 0) return 'The bee carried pollen from an anther to the stigma, and it stuck there. That is pollination.'
    if (!state?.picked) return 'The bee never touched an anther, so it picked up no pollen. Pollen is made in the anthers.'
    if (state?.loaded) return 'The bee carried pollen but never landed on the stigma. Pollen only sticks on the stigma, so the flower was not pollinated.'
    return 'The flower was not pollinated.'
  }
  const got = reached(config, state).filter((o) => o !== null).length
  if (got === config.grains) return 'Every pollen grain grew a tube down the style to its own ovule. Each ovule is fertilised and becomes a seed.'
  return `${got} of ${config.grains} pollen tubes reached an ovule. A tube must grow all the way down the style before fertilisation can happen.`
}


export function goodPrompt(config: FlowerConfig): string {
  return config.task === 'pollinate'
    ? 'Drag the bee to the part of the flower that makes pollen, then drag it to the part that must catch it.'
    : `Drag the tip of each pollen grain's tube down into the flower, to the place where a seed will start.`
}

export const flowerReproductionEngine: SceneEngine<FlowerConfig, FlowerState> = {
  id: 'flower-reproduction',
  covers: ['pollination', 'pollinated', 'pollinate', 'pollinators', 'pollinator', 'stamens', 'stigma', 'carpels', 'carpel', 'ovules', 'petals', 'sepals'],
  phrases: [
    'parts of a flower', 'flower parts', 'parts of flowers', 'structure of a flower', 'flower structure', 'structure of flowers', 'flowers and reproduction',
    'reproduction in flowering plants', 'sexual reproduction in plants', 'sexual reproduction in flowering plants', 'plant reproduction', 'reproduction in plants', 'flower reproduction',
    'fertilisation in plants', 'fertilization in plants', 'fertilisation in flowers', 'fertilization in flowers', 'fertilisation in flowering plants', 'plant fertilisation',
    'pollen tube', 'pollen tubes', 'pollen grains', 'insect pollination', 'insect pollinated', 'wind pollination', 'anther', 'anthers', 'male and female parts of a flower', 'reproductive parts of a flower',
  ],
  notFor: [
    'seed dispersal', 'dispersal of seeds', 'seed germination', 'germination', 'asexual reproduction', 'vegetative propagation', 'human reproduction', 'human reproductive system',
    'reproductive system', 'hay fever', 'pollen count', 'pollen allergy', 'water pollination', 'artificial pollination', 'pollinator decline', 'honey bees', 'beekeeping',
    'cross pollination of crops', 'plant breeding', 'selective breeding', 'genetic cross', 'in vitro fertilisation', 'ivf',
  ],
  isolates: 'structure',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const task = readTask(r)
    if (!task) return null
    const flower = flowerWord(r.flower)
    if (task === 'pollinate') return { task, flower }
    const grains = whole(r.grains, DEFAULT_GRAINS)
    const ovules = whole(r.ovules, DEFAULT_OVULES)
    if (grains === null || ovules === null) return null
    return { task, flower, grains, ovules }
  },

  faults(config) {
    const out: string[] = []
    if (!isFlower(config.flower)) out.push(`Flower "${config.flower}" is not drawn: use ${FLOWERS.join(', ')}.`)
    if (config.task === 'fertilise') {
      const { grains, ovules } = config
      if (!Number.isInteger(grains) || grains < GRAINS_MIN || grains > GRAINS_MAX) out.push(`grains must be a whole number from ${GRAINS_MIN} to ${GRAINS_MAX} (use e.g. ${DEFAULT_GRAINS}).`)
      else if (!Number.isInteger(ovules) || ovules < OVULES_MIN || ovules > OVULES_MAX) out.push(`ovules must be a whole number from ${OVULES_MIN} to ${OVULES_MAX} (use e.g. ${DEFAULT_OVULES}).`)
      else if (grains > ovules) out.push(`${grains} grains cannot each fertilise their own ovule when there are only ${ovules}: use e.g. grains ${Math.min(grains, ovules)} with ovules ${ovules}, or grains 2 with ovules 4.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'pollinate') {
      if (/\banthers?\b|\bstigma\b|\bstamens?\b|\bcarpel\b|\bpistil\b/i.test(text)) out.push(`The prompt names the parts the bee must visit, which the learner is to work out from the labels: ask for the journey in general words ("${example}")`)
    } else if (/\bovules?\b|\bstyle\b|\bone (?:tube|grain) (?:per|for each)\b|\beach ovule\b|\bits own ovule\b|\bdifferent ovule\b/i.test(text)) {
      out.push(`The prompt names the part the tube must reach, or the one-tube-per-ovule rule, which the card shows only as the learner works: ask for the tubes in general words ("${example}")`)
    }
    if (/\bwind\b|\bdisperse|\bdispersal\b|\bgerminat|\bfruit\b|\bresult(?:s)? in\b|\bmake(?:s)? a seed\b/i.test(text)) {
      out.push(`The prompt promises something this card does not show: it has one flower, a bee and pollen tubes, with no wind, dispersal, germination or fruit task ("${example}")`)
    }
    if (/\bfertilis|\bfertiliz/i.test(text) && config.task === 'pollinate') out.push(`This task is pollination, not fertilisation: ("${example}")`)
    return out
  },

  initial(config) {
    return config.task === 'pollinate' ? {} : { tips: Array.from({ length: config.grains }, () => null), to: Array.from({ length: config.grains }, () => null) }
  },

  check(config, state) {
    const ok = done(config, state)
    if (ok) return { ok, wrongIds: [] }
    if (config.task === 'pollinate') return { ok, wrongIds: ['stigma'] }
    return { ok, wrongIds: reached(config, state).flatMap((o, i) => (o === null ? [`grain-${i}`] : [])) }
  },

  solve(config) {
    if (config.task === 'pollinate') return { on: 'stigma', loaded: true, picked: true, grains: DEPOSIT }
    return { tips: Array.from({ length: config.grains }, () => null), to: Array.from({ length: config.grains }, (_, i) => i) }
  },

  View: FlowerReproductionView,

  prompt: `SCENE "flower-reproduction" -- a flower cut in half on a quiet light panel, drawn as the real thing: petals, sepals, stamens (filament and anther) either side, and in the middle a carpel with a sticky stigma, a style and an ovary holding ovules. Parts carry short direct labels. A live line under the picture reads out what the learner has done, without saying whether it is right.
  pollinate: a bee hovers by the flower. The learner drags it (touch, mouse, or arrow keys and Enter) and it lands on whichever part it is dropped on. On an anther it picks up yellow pollen; carrying pollen onto the stigma leaves grains stuck there; landing anywhere else changes nothing. flower: "buttercup", "poppy" or "geranium" (colour only), default buttercup. Readouts: "Pollen on the bee" and "Grains left on the flower".
  fertilise: pollen grains (grains, ${GRAINS_MIN} to ${GRAINS_MAX}, default ${DEFAULT_GRAINS}) already sit on the stigma, and the ovary holds ovules (${OVULES_MIN} to ${OVULES_MAX}, default ${DEFAULT_OVULES}, never fewer than grains). The learner drags the tip of each grain's tube: it follows the style down, then goes free inside the ovary. Dropped on an ovule it snaps in, the grain stays where it was, the pollen nucleus travels down the tube and joins the egg, and the ovule is drawn fertilised. An ovule takes one tube. Readout: "Tubes in ovules". Marked right: the fertilised ovules are drawn as seeds and the ovary as the swelling fruit.
  For: parts of a flower and their jobs, insect pollination, pollen reaching the stigma, the pollen tube and fertilisation, ovule to seed and ovary to fruit. The card shows an insect-pollinated flower only: for wind pollination it can still show what pollination is, but it does not draw a wind-pollinated flower. Not for seed dispersal, germination, asexual reproduction, human reproduction, or genetics.
  Before marking it names the flower's parts and the pollen the learner moves, and nothing about which part to visit or which part a tube must reach. Marking says what was made in words ("The bee never touched an anther...", "2 of 3 pollen tubes reached an ovule"). Prompts must say the gesture only: do NOT name the anther, stigma, style or ovule in the prompt, say that tubes need their own ovule, or promise wind, dispersal or fruit tasks.
  config: { "task":"pollinate", "flower":"buttercup" }  -- the prompt says "${goodPrompt({ task: 'pollinate', flower: 'buttercup' })}"
       or { "task":"fertilise", "flower":"poppy", "grains":2, "ovules":4 }  -- the prompt says "${goodPrompt({ task: 'fertilise', flower: 'poppy', grains: 2, ovules: 4 })}"
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'pollinate', flower: 'buttercup' })}",
    "payload": { "engine":"flower-reproduction", "config": { "task":"pollinate", "flower":"buttercup" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:flower-reproduction", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'fertilise', flower: 'poppy', grains: 2, ovules: 4 })}",
    "payload": { "engine":"flower-reproduction", "config": { "task":"fertilise", "flower":"poppy", "grains":2, "ovules":4 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"structure", "apparatus":"scene:flower-reproduction", "why":"..." } }`,
}

registerEngine(flowerReproductionEngine as SceneEngine<unknown, unknown>)
