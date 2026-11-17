// lib/studylab/engines/similarity/config.ts
// Similarity as something the hand does: pull one corner and every corresponding length
// follows, or grow a square/cube and whole copies of the original appear.
// Maths and IGCSE contexts: CIMT, https://www.cimt.org.uk/sif/geometry/g4/interactive/s2.html
// Correspondence and the additive misconception: Illustrative Mathematics,
// https://curriculum.illustrativemathematics.org/MS/teachers/3/2/9/index.html
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SimilarityView } from './View'

export type LengthConfig = {
  task: 'length'
  layout: 'pair' | 'nested'
  /** A prepared correct, well-spaced diagram, not a coordinate set. */
  variant: number
  /** Enlarged-to-small or small-to-enlarged: the direction of the scale factor. */
  direction: 'up' | 'down'
}
export type GrowConfig = {
  task: 'grow'
  solid: 'square' | 'cube'
  /** Area of the small square, or volume of the small cube, in the displayed unit. */
  base: number
  /** Target area or volume; the learner finds the length factor. */
  target: number
  unit: 'cm' | 'm' | 'mm'
}
export type SimConfig = LengthConfig | GrowConfig
export type SimState = { scale: number }

export const SCALE_STEP = 0.25
export const SCALE_MIN = 0.5
export const SCALE_MAX = 3
/** A visible 0.05 of the small shape, not pixel-perfect tracing. */
export const SCALE_TOLERANCE = 0.05

export type LengthProblem = {
  small: { base: number; height: number; slant: number }
  large: { base: number; height: number; slant: number }
  /** A side of the large triangle the learner must make. */
  missing: 'base' | 'height' | 'slant'
  scale: number
}

// True similar triangles, with one corresponding side of each given. The other small side
// and the requested large side are held back. In nested form, height means the sloping side
// from the common apex, and base is the parallel cross-side.
const PAIR_PROBLEMS: Record<number, LengthProblem> = {
  1: { small: { base: 4, height: 3, slant: 5 }, large: { base: 10, height: 7.5, slant: 12.5 }, missing: 'slant', scale: 2.5 },
  2: { small: { base: 5, height: 4, slant: 6 }, large: { base: 7.5, height: 6, slant: 9 }, missing: 'height', scale: 1.5 },
  3: { small: { base: 4, height: 3, slant: 5 }, large: { base: 7, height: 5.25, slant: 8.75 }, missing: 'base', scale: 1.75 },
}
const NESTED_PROBLEMS: Record<number, LengthProblem> = {
  1: { small: { base: 4, height: 5, slant: 6 }, large: { base: 8, height: 10, slant: 12 }, missing: 'base', scale: 2 },
  2: { small: { base: 3, height: 4, slant: 5 }, large: { base: 6, height: 8, slant: 10 }, missing: 'slant', scale: 2 },
  3: { small: { base: 6, height: 4, slant: 5 }, large: { base: 9, height: 6, slant: 7.5 }, missing: 'height', scale: 1.5 },
}
export const PAIR_VARIANTS = Object.keys(PAIR_PROBLEMS).map(Number)
export const NESTED_VARIANTS = Object.keys(NESTED_PROBLEMS).map(Number)

export function problemOf(config: LengthConfig): LengthProblem {
  const table = config.layout === 'nested' ? NESTED_PROBLEMS : PAIR_PROBLEMS
  return table[config.variant] ?? table[1]
}

export function targetScale(config: SimConfig): number {
  if (config.task === 'length') return problemOf(config).scale
  return config.solid === 'square' ? Math.sqrt(config.target / config.base) : Math.cbrt(config.target / config.base)
}

export function readScale(raw: unknown): number {
  const n = (raw as { scale?: unknown } | null)?.scale
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(n / SCALE_STEP) * SCALE_STEP)) : 1
}

export function solved(config: SimConfig, state: unknown): boolean {
  return Math.abs(readScale(state) - targetScale(config)) <= SCALE_TOLERANCE + 1e-9
}

export function startScale(config: SimConfig): number {
  const target = targetScale(config)
  for (const s of [1, 1.25, 0.75, 1.5, 2, 2.5, 3, 0.5]) if (Math.abs(s - target) > SCALE_TOLERANCE) return s
  return SCALE_MIN
}

const keyOf = (raw: unknown) => typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const num = (raw: unknown): number | null => {
  const v = typeof raw === 'string' && raw.trim() ? Number(raw.trim().replace(/[a-z²³\s]+$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const TASKS: Record<string, SimConfig['task']> = {
  length: 'length', lengths: 'length', triangle: 'length', triangles: 'length', similar: 'length', 'similar-triangle': 'length', 'similar-triangles': 'length', 'missing-length': 'length', 'missing-lengths': 'length', 'scale-factor': 'length', nested: 'length',
  grow: 'grow', growth: 'grow', area: 'grow', areas: 'grow', volume: 'grow', volumes: 'grow', 'similar-areas': 'grow', 'similar-volumes': 'grow', 'area-scale': 'grow', 'volume-scale': 'grow',
}
const LAYOUTS: Record<string, LengthConfig['layout']> = { pair: 'pair', separate: 'pair', two: 'pair', triangles: 'pair', nested: 'nested', inside: 'nested', parallel: 'nested', 'parallel-sides': 'nested', 'triangle-within': 'nested' }

export const fmt = (n: number) => Number(n.toFixed(2)).toString()
const squared = (unit: string) => `${unit}²`
const cubed = (unit: string) => `${unit}³`
export function unitOf(config: GrowConfig, power?: 2 | 3): string {
  const p = power ?? (config.solid === 'cube' ? 3 : 2)
  return p === 3 ? cubed(config.unit) : squared(config.unit)
}
export function factorWord(n: number): string {
  if (Math.abs(n - 0.5) < 0.001) return '½'
  if (Math.abs(n - 0.25) < 0.001) return '¼'
  return fmt(n)
}

export function working(config: SimConfig): string {
  const k = targetScale(config)
  if (config.task === 'length') {
    const p = problemOf(config)
    const name = p.missing === 'base' ? 'base' : p.missing === 'height' ? 'left side' : 'right side'
    return `Yes. The scale factor is ${factorWord(k)}, so the missing ${name} is ${fmt(p.small[p.missing])} × ${factorWord(k)} = ${fmt(p.large[p.missing])} cm. The angles stay equal while every corresponding length uses that same factor.`
  }
  const copies = config.target / config.base
  if (config.solid === 'square') return `Yes. Length factor ${factorWord(k)} gives area factor ${factorWord(k)}² = ${copies}. The larger square holds ${copies} copies of the smaller one: ${config.base} × ${copies} = ${config.target} ${unitOf(config)}.`
  return `Yes. Length factor ${factorWord(k)} gives volume factor ${factorWord(k)}³ = ${copies}. The larger cube holds ${copies} copies of the smaller one: ${config.base} × ${copies} = ${config.target} ${unitOf(config)}.`
}

export function madeText(config: SimConfig, state: unknown): string {
  const k = readScale(state)
  const target = targetScale(config)
  if (config.task === 'length') {
    const p = problemOf(config)
    const value = p.small[p.missing] * k
    return `You used length factor ${factorWord(k)}, making that side ${fmt(value)} cm. ${Math.abs(value - p.large[p.missing]) < 0.005 ? 'Near enough.' : `It does not match the ${fmt(p.large[p.missing])} cm side yet.`} The exact length factor is ${factorWord(target)}.`
  }
  const made = config.base * (config.solid === 'square' ? k * k : k * k * k)
  const name = config.solid === 'square' ? 'area' : 'volume'
  return `You used length factor ${factorWord(k)}, making ${name} ${fmt(made)} ${unitOf(config)}, not ${config.target} ${unitOf(config)}. The exact length factor is ${factorWord(target)}: ${name} scales by its ${config.solid === 'square' ? 'square' : 'cube'}.`
}

function goodPrompt(config: SimConfig): string {
  if (config.task === 'length') {
    const p = problemOf(config)
    return `Drag the blue corner until the blue triangle is similar to the grey one and its ${p.missing === 'base' ? 'base' : p.missing === 'height' ? 'left side' : 'right side'} is ${fmt(p.large[p.missing])} cm. You can also use the length factor buttons.`
  }
  const name = config.solid === 'square' ? 'area' : 'volume'
  return `Drag the blue corner until the larger ${config.solid} has ${name} ${config.target} ${unitOf(config)}. You can also use the length factor buttons.`
}

export const similarityEngine: SceneEngine<SimConfig, SimState> = {
  id: 'similarity',
  covers: ['similarity'],
  phrases: [
    'similar shapes', 'similar triangles', 'similar figures', 'similar solids', 'scale factor', 'scale factors',
    'areas of similar shapes', 'volumes of similar shapes', 'areas and volumes of similar shapes', 'area and volume scale factors',
    'length area volume scale factors', 'congruence and similarity', 'similarity and congruence',
  ],
  notFor: [
    'enlargement as a transformation', 'centre of enlargement', 'center of enlargement', 'negative scale factor', 'transformations',
    'ratio and proportion', 'bar model', 'map scales', 'map scale', 'scale drawings', 'scale drawing', 'maps and scale',
    'trigonometry', 'sohcahtoa', 'area formulas', 'volume formulas', 'area and perimeter', 'volume of prisms', 'surface area',
    'similar matrices', 'triangle of forces', 'self similarity', 'fractals',
  ],
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode', 'topic']))
    const rawSolid = first(src, ['solid', 'shape', 'figure', 'measure'])
    const solidWord = keyOf(rawSolid)
    const task = word ? (own(TASKS, word) ? TASKS[word] : null) : rawSolid !== undefined || first(src, ['target', 'base', 'area', 'volume']) !== undefined ? 'grow' : 'length'
    if (!task) return null
    if (task === 'length') {
      const layoutWord = keyOf(first(src, ['layout', 'diagram', 'arrangement'])) || (word === 'nested' ? 'nested' : 'pair')
      const layout = own(LAYOUTS, layoutWord) ? LAYOUTS[layoutWord] : layoutWord as LengthConfig['layout']
      const rawVariant = first(src, ['variant', 'version', 'example', 'case'])
      const variant = rawVariant === undefined ? 1 : num(rawVariant)
      if (variant === null) return null
      const dir = keyOf(first(src, ['direction', 'way']))
      const direction = dir === 'down' || dir === 'shrink' || dir === 'reduce' ? 'down' : 'up'
      return { task, layout, variant: Math.trunc(variant), direction }
    }
    const solid = solidWord === 'cube' || solidWord === 'cubes' || solidWord === 'volume' || solidWord === '3d' || word === 'volume' || word === 'volumes' || word === 'similar-volumes' || word === 'volume-scale' ? 'cube' : solidWord ? solidWord as GrowConfig['solid'] : 'square'
    const rawTarget = first(src, ['target', 'area', 'volume', 'targetArea', 'targetVolume'])
    const rawBase = first(src, ['base', 'small', 'original', 'start'])
    const target = rawTarget === undefined ? (solid === 'cube' ? 64 : 36) : num(rawTarget)
    const base = rawBase === undefined ? (solid === 'cube' ? 8 : 9) : num(rawBase)
    if (target === null || base === null) return null
    const u = keyOf(first(src, ['unit', 'units'])) || 'cm'
    const unit = u === 'm' || u === 'metres' || u === 'meters' ? 'm' : u === 'mm' || u === 'millimetres' || u === 'millimeters' ? 'mm' : u === 'cm' || u === 'centimetres' || u === 'centimeters' ? 'cm' : u as GrowConfig['unit']
    return { task, solid, target, base, unit }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'length') {
      const variants = config.layout === 'nested' ? NESTED_VARIANTS : config.layout === 'pair' ? PAIR_VARIANTS : null
      if (!variants) out.push(`Layout "${config.layout}" is not drawn: use "pair" for two separate triangles or "nested" for one inside another with parallel sides, e.g. { "task":"length", "layout":"nested", "variant":1 }.`)
      else if (!variants.includes(config.variant)) out.push(`Variant ${config.variant} does not exist for the ${config.layout} layout: use ${variants.join(', ')}. Each is a prepared similar-triangle problem, e.g. "variant":1.`)
      if (config.direction !== 'up') out.push('This version always starts with the small grey triangle and grows the blue one. Use "direction":"up"; shrinking the large triangle is left for a later version.')
      return out
    }
    if (config.solid !== 'square' && config.solid !== 'cube') {
      out.push(`A ${config.solid} is not tiled here: use solid "square" for area or "cube" for volume, e.g. { "task":"grow", "solid":"square", "base":9, "target":36, "unit":"cm" }.`)
      return out
    }
    if (!['cm', 'm', 'mm'].includes(config.unit)) out.push(`Unit "${config.unit}" is not drawn: use cm, m or mm, e.g. "unit":"cm".`)
    if (!(config.base > 0) || !(config.target > 0)) out.push('The base and target must be positive, e.g. base 9 and target 36.')
    else {
      const k = targetScale(config)
      const nearest = Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(k / SCALE_STEP) * SCALE_STEP))
      if (k < SCALE_MIN || k > SCALE_MAX || ![2, 3].includes(k)) {
        out.push(`Target ${config.target} gives length factor ${fmt(k)}; whole copies of the original are visible only at factors 2 or 3. Use target ${config.base * (config.solid === 'square' ? nearest * nearest : nearest ** 3)} for a nearby factor, or base 9 target 36 for a square (base 8 target 64 for a cube).`)
      }
      if (!Number.isInteger(config.base) || !Number.isInteger(config.target)) out.push('Use whole-number base and target measures so the copies and labels stay clear, e.g. base 9 and target 36 for a square.')
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const out: string[] = []
    const k = targetScale(config)
    const answer = config.task === 'length' ? problemOf(config).large[problemOf(config).missing] : k
    const number = String(answer).replace('.', '\\.')
    if (new RegExp(`(?:factor|scale|×|x\\s*=|answer\\s*(?:is|=))[^.?!]{0,18}${number}(?!\\d)`, 'i').test(text) || new RegExp(`\\b${number}\\s*(?:times|x|×)\\b`, 'i').test(text)) {
      out.push(`the prompt gives the length factor away (${factorWord(k)}), which the learner is to find by resizing: name the target measure only ("${goodPrompt(config)}").`)
    }
    if (config.task === 'grow') {
      const power = config.solid === 'square' ? 2 : 3
      if (new RegExp(`(?:k|factor|length)s?\\s*(?:\\^|²|³|\\*\\*)|(?:square|cube)d?\\s+(?:the\\s+)?(?:length|scale|factor)|\\b${power}\\s+(?:times|copies)`, 'i').test(text)) {
        out.push(`the prompt says the area/volume rule, which the copies are there to reveal: ask for the target ${config.solid === 'square' ? 'area' : 'volume'} only ("${goodPrompt(config)}").`)
      }
    }
    if (/\brotate\b|\bflip\b|\bcentre of enlargement\b|\bcenter of enlargement\b|\btype\b|\benter\b|\bSSS\b|\bSAS\b|\bASA\b|\bRHS\b|\bmap\b|\bprotractor\b/i.test(text)) {
      out.push(`the prompt promises something the card does not do: it only resizes the blue shape with a corner or buttons ("${goodPrompt(config)}").`)
    }
    if (!/\b(?:drag|buttons?|tap|press)\b/i.test(text)) out.push(`the prompt must say the gesture: drag the blue corner or use the length factor buttons ("${goodPrompt(config)}").`)
    return out
  },

  initial: (config) => ({ scale: startScale(config) }),
  check: (config, state) => ({ ok: solved(config, state), wrongIds: [] }),
  solve: (config) => ({ scale: targetScale(config) }),
  View: SimilarityView,

  prompt: `SCENE "similarity" -- accurate similar shapes on a quiet light panel. The learner pulls one blue corner (or uses a small length-factor stepper) and the blue shape answers at once. The two task families:
  length: a grey triangle and a blue triangle with matching angle arcs. The learner grows the blue triangle until one named side reaches the labelled target length. The live factor and all three blue lengths change together; matching angles stay fixed. "pair" draws two separate corresponding triangles; "nested" draws a small triangle inside a larger one with parallel cross-sides and arrow marks. variant 1, 2 or 3 chooses a prepared problem and which side is sought. direction "up" only. The prompt must name the labelled target side and its cm value (which the card also shows) and the gesture, but not the scale factor.
  grow: a small grey square or isometric cube beside a growing blue one. At length factor 2 or 3 the large shape visibly partitions into 4/9 whole squares or 8/27 whole cubes. The learner grows it to the target area (square) or volume (cube). base is the original area/volume and target the wanted area/volume; both are positive whole numbers, with target/base respectively a perfect square/cube of 2 or 3. unit cm, m or mm. Default square base 9 target 36; default cube base 8 target 64. The prompt names target and gesture, not the length factor or the k²/k³ rule.
  For IGCSE 0580 similar shapes, similar triangles, scale factor, missing corresponding lengths, nested triangles with parallel sides, and areas/volumes of similar shapes. Not for enlargement from a centre, transformations, map scales, ratio bar models, area/volume formulas, trigonometry, or congruence proofs: SSS, SAS, ASA and RHS are not taught by this card.
  Before marking the card shows the given lengths, the live length factor and the learner's live area/volume; it holds back the exact answer and the general rule. Marking says the exact factor, calculation and what the copies mean. No prompt may state the factor or rule. The card draws and responds to every gesture named here; there is no typing.
  config: { "task":"length", "layout":"nested", "variant":1, "direction":"up" } -- prompt "Drag the blue corner until the blue triangle is similar to the grey one and its base is 8 cm. You can also use the length factor buttons."
       or { "task":"grow", "solid":"square", "base":9, "target":36, "unit":"cm" } -- prompt "Drag the blue corner until the larger square has area 36 cm². You can also use the length factor buttons."
       or { "task":"grow", "solid":"cube", "base":8, "target":64, "unit":"cm" } -- prompt "Drag the blue corner until the larger cube has volume 64 cm³. You can also use the length factor buttons."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the blue corner until the blue triangle is similar to the grey one and its base is 8 cm. You can also use the length factor buttons.",
    "payload": { "engine":"similarity", "config": { "task":"length", "layout":"nested", "variant":1, "direction":"up" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:similarity", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the blue corner until the larger square has area 36 cm². You can also use the length factor buttons.",
    "payload": { "engine":"similarity", "config": { "task":"grow", "solid":"square", "base":9, "target":36, "unit":"cm" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:similarity", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the blue corner until the larger cube has volume 64 cm³. You can also use the length factor buttons.",
    "payload": { "engine":"similarity", "config": { "task":"grow", "solid":"cube", "base":8, "target":64, "unit":"cm" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:similarity", "why":"..." } }`,
}

registerEngine(similarityEngine as SceneEngine<unknown, unknown>)
