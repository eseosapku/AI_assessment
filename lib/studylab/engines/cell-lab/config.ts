// lib/studylab/engines/cell-lab/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { CellLabView } from './View'

/**
 * Two ideas in cell biology that a hand can make obvious.
 *
 * diffusion / osmosis: a tank split by a membrane. The learner taps solute particles
 * into or out of the LEFT side (0 to 10); the RIGHT side is fixed by the
 * tutor. The membrane lets solute through (diffusion) or only water through (osmosis).
 * Particles cross both ways all the time; the difference between the two ways is
 * the net movement. The task is to set the left so that the net movement goes the
 * way asked, or is nil. Movement does not stop when the net is nil: it carries on
 * both ways, equally. That is the misconception this scene is for (along with
 * "particles want to go somewhere").
 *
 * surface-area: a cube is cut into n x n x n equal cubes. The volume does not
 * change, the surface area grows n times, so the surface area to volume ratio of
 * each piece is n times the block's. This is why small cells exchange materials
 * well and why large ones need a different arrangement.
 *
 * Source for the model: Cambridge IGCSE Biology 0610, topic 3 (movement into and
 * out of cells: diffusion as net movement from higher to lower concentration;
 * osmosis as net movement of water through a partially permeable membrane from a
 * more dilute to a more concentrated solution) and topic 2 (surface area to volume
 * ratio, worked on cubes). The depiction rate rule is the standard kinetic one:
 * the number of particles of a kind that hit the membrane, and so may cross, is in
 * proportion to how many of them are on that side. For water that is "12 minus
 * the solute", the rest of a side being water. Nothing is "wanted": every particle
 * moves at random, and the net movement is only the difference of the two ways.
 *
 * Narrowed on purpose: the cell is not drawn as animal or plant (turgid, lysis and
 * plasmolysis can be argued about wall, size and bursting), so the scene claims
 * only net movement of water. Every number is exact whole-number arithmetic. The
 * animation is a depiction; marking uses only the rule in `netOf` and `slice`.
 */

export const TASKS = ['diffusion', 'osmosis', 'surface-area'] as const
export type Task = (typeof TASKS)[number]
export type Net = 'left' | 'right' | 'none'

/** Solute particles the learner can put on the left, and the range the tutor may fix the right in. */
export const LEFT_MAX = 10
export const RIGHT_MIN = 1
export const RIGHT_MAX = 9
/** A side is 12 in all: whatever is not solute is water. */
export const WATER = 12

export const SIDE_MIN = 2
export const SIDE_MAX = 12
export const TIMES_MIN = 2
export const TIMES_MAX = 4
export const SIDE_DEFAULT = 6

export type CellLabConfig =
  | { task: 'diffusion' | 'osmosis'; right: number; net: Net }
  | { task: 'surface-area'; side: number; times: number }

/** left: solute particles on the left. pieces: cubes along each edge. */
export type CellLabState = { left?: number; pieces?: number }

// ---------------------------------------------------------------------------
// Membrane.

export type Passing = 'solute' | 'water'
export const passingOf = (task: 'diffusion' | 'osmosis'): Passing => (task === 'diffusion' ? 'solute' : 'water')

/** What crosses the membrane each way: proportional to how many of the kind are on the side it leaves. */
export function crossing(task: 'diffusion' | 'osmosis', left: number, right: number): { toRight: number; toLeft: number } {
  return passingOf(task) === 'solute'
    ? { toRight: left, toLeft: right }
    : { toRight: WATER - left, toLeft: WATER - right }
}

/** The net movement of the thing that crosses: the difference of the two ways. */
export function netOf(task: 'diffusion' | 'osmosis', left: number, right: number): Net {
  const c = crossing(task, left, right)
  return c.toRight > c.toLeft ? 'right' : c.toRight < c.toLeft ? 'left' : 'none'
}

export const thingOf = (task: 'diffusion' | 'osmosis') => (task === 'diffusion' ? 'solute particles' : 'water')

const leftOk = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= LEFT_MAX

/** Where the left starts: balanced when the task is to unbalance it, off balance when the task is to balance it. */
export function startLeft(right: number, net: Net): number {
  if (net !== 'none') return right
  return right <= 5 ? right + 3 : right - 3
}

/** The settings of the left that meet the goal. */
export function goodLefts(config: Extract<CellLabConfig, { right: number }>): number[] {
  const out: number[] = []
  for (let l = 0; l <= LEFT_MAX; l++) if (netOf(config.task, l, config.right) === config.net) out.push(l)
  return out
}

export function solveLeft(config: Extract<CellLabConfig, { right: number }>): number {
  const good = goodLefts(config)
  // The clearest one: furthest from the right, so the shown answer is plain to see.
  return good.reduce((best, l) => (Math.abs(l - config.right) > Math.abs(best - config.right) ? l : best), good[0])
}

/** The two ways, said once the card is marked. */
export function membraneWorking(config: Extract<CellLabConfig, { right: number }>, left: number): string {
  const { task, right } = config
  const c = crossing(task, left, right)
  const net = netOf(task, left, right)
  const thing = task === 'diffusion' ? 'Solute' : 'Water'
  const both = `${thing} crossed both ways: ${c.toRight} to the right for every ${c.toLeft} to the left.`
  if (net === 'none') {
    return `${both} The two ways are equal, so there is no net movement. It never stopped: it carries on crossing both ways, equally.`
  }
  if (task === 'diffusion') {
    const from = net === 'right' ? 'left' : 'right'
    return `${both} The net movement is to the ${net}: from the ${from}, with more solute, to the ${net}, with less.`
  }
  return `${both} The net movement is to the ${net}, toward the side with more solute and so less water.`
}

/** What the learner made, said back when it is wrong: never what to change. */
export function madeMembrane(config: Extract<CellLabConfig, { right: number }>, left: number): string {
  const { task, right } = config
  const net = netOf(task, left, right)
  const made = `You put ${left} solute ${left === 1 ? 'particle' : 'particles'} on the left against ${right} on the right`
  if (net === 'none') return `${made}: the same crossed each way, so there is no net movement.`
  return `${made}: more ${thingOf(task)} crossed to the ${net} than came back.`
}

// ---------------------------------------------------------------------------
// Surface area to volume.

export type Rat = { n: number; d: number }
const gcd = (a: number, b: number): number => {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}
export function rat(n: number, d = 1): Rat {
  const g = gcd(n, d)
  return { n: n / g, d: d / g }
}
/** 3, 3.6, 0.75: up to two places, from an exact fraction. */
export function ratText(r: Rat): string {
  return `${Number((r.n / r.d).toFixed(2))}`
}

export const cubes = (pieces: number) => pieces ** 3

/** The block's surface area to volume ratio, 6 / side, and the cut pieces', 6n / side, as exact fractions. */
export const ratioOf = (side: number, pieces: number): Rat => rat(6 * pieces, side)

export function sliceWorking(side: number, pieces: number): string {
  const vol = side ** 3
  const before = 6 * side * side
  const after = before * pieces
  const part = rat(side, pieces)
  const edge = part.d === 1 ? `${part.n}` : ratText(part)
  return (
    `A ${side} cm cube has ${before} cm² of surface for ${vol} cm³: ${ratText(ratioOf(side, 1))} : 1. ` +
    `Cut into ${cubes(pieces)} cubes of ${edge} cm, the volume is still ${vol} cm³ but the surface is ${after} cm²: ` +
    `${ratText(ratioOf(side, pieces))} : 1, ${pieces} times as much surface for the volume.`
  )
}

export function madeSlice(config: Extract<CellLabConfig, { task: 'surface-area' }>, pieces: number): string {
  void config
  if (pieces <= 1) return 'You have not cut the block: its surface for its volume is the block\'s own.'
  return `You cut it into ${cubes(pieces)} cubes, ${pieces} along each edge: ${pieces} times the whole block's surface for its volume.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

function readTask(raw: unknown): Task | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '')
  const alias: Record<string, Task> = {
    diffusion: 'diffusion', diffuse: 'diffusion', diffusing: 'diffusion',
    osmosis: 'osmosis', osmotic: 'osmosis',
    'surface-area': 'surface-area', 'surface-area-to-volume': 'surface-area', 'surface-area-to-volume-ratio': 'surface-area',
    'sa-v': 'surface-area', 'sa-v-ratio': 'surface-area', slice: 'surface-area', cut: 'surface-area', cutting: 'surface-area', 'cut-the-cube': 'surface-area',
  }
  return Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null
}

function readNet(raw: unknown): Net | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  if (/\b(none|no net|nothing|neither|equal|even|balance|balanced|same|zero|stays?|no movement)\b/.test(s) && !/\b(to|toward|towards|into)\s+(the\s+)?(left|right)\b/.test(s)) return 'none'
  const to = /\b(?:to|toward|towards|into)\s+(?:the\s+)?(left|right)\b/.exec(s)
  if (to) return to[1] as Net
  const word = /\b(left|right)\b/.exec(s)
  return word ? (word[1] as Net) : null
}

function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000 ? v + 0 : null
}

/** A strength given in words: dilute, medium, concentrated. */
function readStrength(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().toLowerCase()
  if (/^(dilute|weak|low)$/.test(s)) return 2
  if (/^(medium|moderate|middle)$/.test(s)) return 5
  if (/^(concentrated|strong|high)$/.test(s)) return 8
  return null
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

export const cellLabEngine: SceneEngine<CellLabConfig, CellLabState> = {
  id: 'cell-lab',
  // Distinctive words only. "cell" alone would catch electrochemical cells and prison cells; bare "diffusion" would catch
  // "diffusion of innovations" in business, so diffusion is offered as the whole phrases below.
  covers: ['diffusion', 'osmosis', 'osmotic', 'turgid', 'flaccid', 'plasmolysis', 'plasmolysed'],
  phrases: [
    'diffusion and osmosis', 'diffusion across', 'diffusion through', 'diffusion in cells', 'diffusion of gases', 'diffusion of oxygen',
    'diffusion of molecules', 'diffusion of particles', 'diffusion of solutes', 'diffusion of substances', 'diffusion in liquids',
    'passive transport', 'cell membrane', 'cell membranes', 'partially permeable membrane', 'selectively permeable membrane',
    'semi permeable membrane', 'concentration gradient', 'movement into and out of cells', 'transport in cells',
    'surface area to volume', 'surface area volume ratio', 'size of cells',
  ],
  // The learner varies what is on one side, or how finely a block is cut.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const task = readTask(nested ? first(nested, ['kind', 'task']) : o.task)
    if (!task) return null
    if (task === 'surface-area') {
      const sideRaw = first(src, ['side', 'size', 'edge', 'length'])
      const side = sideRaw === undefined ? SIDE_DEFAULT : readNumber(sideRaw)
      const times = readNumber(first(src, ['times', 'multiple', 'factor', 'target']))
      return side === null || times === null ? null : { task, side, times }
    }
    const rr = first(src, ['right', 'inside', 'other', 'fixed'])
    const right = readNumber(rr) ?? readStrength(rr)
    const net = readNet(first(src, ['net', 'toward', 'towards', 'direction', 'goal']))
    return right === null || net === null ? null : { task, right, net }
  },

  faults(config) {
    const out: string[] = []
    if (config.task === 'surface-area') {
      const { side, times } = config
      if (!Number.isInteger(side) || side < SIDE_MIN || side > SIDE_MAX) {
        out.push(`side must be a whole number of cm from ${SIDE_MIN} to ${SIDE_MAX}, e.g. side 6.`)
      }
      if (!Number.isInteger(times)) out.push(`times must be a whole number from ${TIMES_MIN} to ${TIMES_MAX}, e.g. times 3.`)
      else if (times < TIMES_MIN) out.push(`times ${times} is already true of the uncut block, so there is nothing to find. Use times from ${TIMES_MIN} to ${TIMES_MAX}, e.g. times 3.`)
      else if (times > TIMES_MAX) out.push(`times ${times} is more than the block can be cut to show (${TIMES_MAX} pieces along an edge, 64 cubes): use times from ${TIMES_MIN} to ${TIMES_MAX}, e.g. times ${TIMES_MAX}.`)
      return out
    }
    const { right } = config
    if (!Number.isInteger(right) || right < RIGHT_MIN || right > RIGHT_MAX) {
      const near = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, Math.round(Number.isFinite(right) ? right : 5)))
      out.push(`right must be a whole number of solute particles from ${RIGHT_MIN} to ${RIGHT_MAX} (the left has 0 to ${LEFT_MAX}), e.g. right ${near}.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    if (config.task === 'surface-area') {
      const k = config.times
      const unit = '(?:small |little |equal |identical )?(?:cubes|pieces|parts|cells|blocks|slices)'
      const said =
        new RegExp(`(?<![\\d.])${k ** 3}\\s*${unit}`, 'i').test(text) ||
        new RegExp(`(?<![\\d.])${k}\\s*${unit}\\s*(?:along|on|per|each|across|in each)`, 'i').test(text) ||
        new RegExp(`(?:cut|slice|divide|split)\\w*\\s+(?:it\\s+|the block\\s+)?(?:in|into)\\s+${k}\\b`, 'i').test(text) ||
        new RegExp(`(?<![\\d.])${k - 1}\\s*cuts?\\b`, 'i').test(text) ||
        /\b6\s*n\b|\bsix\s+n\b/i.test(text) ||
        /smaller.{0,40}(?:larger|bigger|greater|higher)/i.test(text)
      return said
        ? ['the prompt gives the answer away: it says how many pieces, cuts or cubes, or states the rule, which the learner is to find by cutting -- ask for the outcome only ("Cut the block into equal cubes so that each has at least 3 times the block\'s surface area for its volume.")']
        : []
    }
    const name = config.task === 'diffusion' ? 'solute particles' : 'water'
    const example = `Add or take away solute on the left so that, overall, ${name} ${config.task === 'diffusion' ? 'move' : 'moves'} from the left to the right.`
    const side =
      /\b(?:dilute|diluted|concentrated|stronger|weaker|more solute|less solute|fewer solute|more particles|fewer particles|more water|less water)\b/i.test(text) ||
      /\b(?:higher|lower|greater|equal|same|unequal|different)\s+(?:concentrations?|strengths?)\b/i.test(text) ||
      /\b(?:equilibrium|balanced|gradient)\b/i.test(text)
    const rule =
      /\bfrom\s+(?:a\s+|the\s+)?(?:high|low|more|less|dilute|concentrated)/i.test(text) ||
      /\b(?:toward|towards|to|into)\s+the\s+(?:more|less|side|region|solution)\b/i.test(text) ||
      /\bwater potential\b/i.test(text)
    return side || rule
      ? [`the prompt gives the answer away: it says how the two sides compare or which way the rule runs, which the learner is to find by setting the left -- ask for the outcome only ("${example}")`]
      : []
  },

  initial(config) {
    if (config.task === 'surface-area') return { pieces: 1 }
    return { left: startLeft(config.right, config.net) }
  },

  check(config, state) {
    if (config.task === 'surface-area') {
      const ok = Number.isInteger(state?.pieces) && (state.pieces as number) >= config.times
      return { ok, wrongIds: ok ? [] : ['pieces'] }
    }
    const left = state?.left
    const ok = leftOk(left) && netOf(config.task, left, config.right) === config.net
    return { ok, wrongIds: ok ? [] : ['left'] }
  },

  solve(config) {
    if (config.task === 'surface-area') return { pieces: config.times }
    return { left: solveLeft(config) }
  },

  View: CellLabView,

  prompt: `SCENE "cell-lab" -- movement across a membrane, and why cells are small. The learner changes what is on one side; the engine moves the particles, shows what crosses each way, and marks it.
  diffusion / osmosis: one tank split by a membrane. The learner taps + and - under the LEFT side to drop solute particles in or take them
    out (0 to 10 big dots, one a particle); the RIGHT side is fixed by you. Two lanes of dots cross the membrane, one each way, and a lane
    carries as many dots as cross that way. In diffusion the membrane lets the solute through; in osmosis only water crosses and the water
    visibly rises on one side. The lanes carry on both ways even when they are equal. Before marking there are no numbers and nothing says
    which way is net. Marking says the two ways in numbers and the net.
    The task is the net movement of what crosses: toward the right, toward the left, or none.
  surface-area: a cube drawn in the middle, a skin bar and an inside bar below it. The learner drags the handle to cut the cube into 1, 8,
    27 or 64 equal cubes; the pieces spread apart, the skin bar grows in groups, the inside bar stays the same. The task is to cut it so
    each piece has at least "times" the block's surface area for its volume. Marking says the surface and volume in cm.
  For: diffusion, osmosis, concentration gradient, partially permeable membranes, surface area to volume ratio, why cells are small.
  diffusion/osmosis: right is a whole number of solute particles, 1 to 9 (or "dilute", "medium", "concentrated"); net is "right", "left" or "none"
    (the way the thing that crosses moves overall: solute for diffusion, water for osmosis; right means from the left chamber to the right).
    Not drawn: a cell wall, animal or plant cells, bursting; say in the prompt that the left side is "outside the cell" if you want that.
  surface-area: side is the block's edge in whole cm, 2 to 12 (default 6); times is 2 to 4.
  config: { "task":"diffusion", "right":4, "net":"right" }  -- the prompt says "Add or take away solute on the left so that, overall, solute particles move from the left to the right." (do NOT say which side has more)
       or { "task":"osmosis", "right":6, "net":"none" }  -- the prompt says "The membrane lets only water through. Add or take away solute on the left so that no water moves across overall." (do NOT say equal, balanced or the same)
       or { "task":"surface-area", "side":6, "times":3 }  -- the prompt says "Cut the block into equal cubes so that each has at least 3 times the block's surface area for its volume." (do NOT say how many cubes or cuts)
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Add or take away solute on the left so that, overall, solute particles move from the left to the right.",
    "payload": { "engine":"cell-lab", "config": { "task":"diffusion", "right":4, "net":"right" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:cell-lab", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The membrane lets only water through. Add or take away solute on the left so that no water moves across overall.",
    "payload": { "engine":"cell-lab", "config": { "task":"osmosis", "right":6, "net":"none" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:cell-lab", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Cut the block into equal cubes so that each has at least 3 times the block's surface area for its volume.",
    "payload": { "engine":"cell-lab", "config": { "task":"surface-area", "side":6, "times":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:cell-lab", "why":"..." } }`,
}

registerEngine(cellLabEngine as SceneEngine<unknown, unknown>)
