// lib/studylab/engines/energy-track/config.ts
//
// A ball on a track, and three bars that answer back. One bench, two jobs, one drawing language:
//   release -- raise or lower the ball on the left hill until it just climbs to a flag on the right hill;
//              a rough patch of floor in the middle takes some of the height away as heat;
//   rough   -- the ball's start is fixed; roughen or smooth the floor until it just climbs to the flag.
//
// The physics, all computed here and never read from the drawing (track in "marks": one mark is one step of height):
//   energy in the height store, E = m g h, becomes motion on the way down and height again on the way up;
//   the walls are smooth, so only the rough floor takes energy, and a constant friction force F over a floor of
//   length d takes F d: the same number of marks off the height however fast the ball goes. The ball's mass
//   multiplies every store (and the friction) and so cancels from the height it reaches;
//   total energy never changes: height + motion + heat = what the ball started with, at every instant.
//
// Ideas taken, never code or art (research notes for the owner):
//   - PhET "Energy Skate Park" (and Podolefsky et al., "Implicit scaffolding in interactive simulations", arXiv
//     1306.6544): a bar chart of the energy forms that answers the ball's every position, a friction setting that
//     moves energy into a thermal bar rather than deleting it, and the advice to meet the no-friction case first.
//     Here the three bars sit beside the track and a dashed line marks the total, so conservation is a line the
//     motion bar touches at the bottom of the hill;
//   - the classroom literature on energy "used up" or lost when a thing stops, and on friction as an energy
//     destroyer (ball stops, energy gone): the heat bar grows by exactly what the height bar lost. Nothing vanishes;
//   - a heavier ball goes faster or higher: the heavy ball has taller bars in every store and reaches the same
//     flag, which marking says in a sentence;
//   - TI "Energetic Coasters" and the UCLA BEAM marble-track lesson: build, release, compare the turning height
//     with the start, with and without friction.
//
// Refused: a free-form track editor (hard to mark, and the learner draws a picture rather than reasoning);
// a speed read-out (a number is not an energy store); a loop of repeated passes (the ball seems to stick).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { EnergyTrackView } from './View'

export const TASKS = ['release', 'rough'] as const
export type Task = (typeof TASKS)[number]
export type Ball = 'light' | 'heavy'

export type EnergyTrackConfig =
  /** flag: how many marks up the right hill the flag stands; rough: the marks of height the floor takes. */
  | { task: 'release'; flag: number; rough: number; ball: Ball }
  /** release: the marks up the left hill the ball starts; flag: the mark on the right hill the ball must just reach. */
  | { task: 'rough'; release: number; flag: number; ball: Ball }

/** What the learner has set, whole numbers: how high the ball starts, or how rough the floor is. */
export type EnergyTrackState = { release?: number; rough?: number }

// ---------------------------------------------------------------------------
// The track, in marks. Left wall x 0..WALL, floor WALL..WALL+FLOOR, right wall after that.

export const WALL = 9
export const FLOOR = 7
export const RELEASE_MAX = WALL
export const FLAG = { lo: 2, hi: 6 }
export const ROUGH_FIXED = { lo: 0, hi: 3 }
/** The floor settings of the rough bench. */
export const ROUGH_SET = { lo: 0, hi: 4 }
export const MASS: Record<Ball, number> = { light: 1, heavy: 1.5 }

export const heightAt = (x: number) => (x <= WALL ? WALL - x : x <= WALL + FLOOR ? 0 : x - WALL - FLOOR)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Where the ball starts along the track, given how high it is released. */
export const startX = (release: number) => WALL - release
/** Where the ball turns round (or stops): the x it reaches before its motion runs out. */
export function endX(release: number, rough: number): number {
  if (release > rough) return WALL + FLOOR + (release - rough)
  return WALL + (rough === 0 ? 0 : (FLOOR * release) / rough)
}
/** How high up the right hill the ball gets; 0 when the floor takes it all. */
export const reach = (release: number, rough: number) => Math.max(0, release - rough)

/** Marks of height the floor has taken by the time the ball is at x. */
export const lossAt = (x: number, rough: number) => rough * clamp((x - WALL) / FLOOR, 0, 1)

export type Stores = { height: number; motion: number; heat: number }
/** The three stores, at x, for a ball of the given mass. They always add up to release x mass. */
export function stores(release: number, rough: number, mass: number, x: number): Stores {
  const at = Math.min(x, endX(release, rough))
  const height = heightAt(at)
  const heat = lossAt(at, rough)
  const motion = Math.max(0, release - height - heat)
  return { height: height * mass, motion: motion * mass, heat: heat * mass }
}

/** The ball's speed along x in marks per second: a walking pace, with a little left so it never stalls. */
export const speedAt = (release: number, rough: number, x: number) => 2.4 * Math.sqrt(Math.max(0, release - heightAt(x) - lossAt(x, rough))) + 0.6
/** One time step of the run, never past the end. */
export const advance = (release: number, rough: number, x: number, dt: number) =>
  Math.min(endX(release, rough), x + dt * speedAt(release, rough, x))

// ---------------------------------------------------------------------------
// Starting positions and reading what the learner has set.

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi

export function releaseAnswer(config: EnergyTrackConfig): number {
  return config.task === 'release' ? config.flag + config.rough : config.release
}
export function roughAnswer(config: EnergyTrackConfig): number {
  return config.task === 'rough' ? config.release - config.flag : config.rough
}
/** Where the ball begins: well away from the answer, so the first run misses by plenty. */
export function startRelease(config: Extract<EnergyTrackConfig, { task: 'release' }>): number {
  const a = releaseAnswer(config)
  return a + 3 <= RELEASE_MAX ? a + 3 : a - 3
}
export function startRough(config: Extract<EnergyTrackConfig, { task: 'rough' }>): number {
  const a = roughAnswer(config)
  return a <= 2 ? a + 2 : a - 2
}

/** What is actually set right now, read from the state with a fallback to the start. */
export function madeRelease(config: EnergyTrackConfig, state: EnergyTrackState): number {
  if (config.task === 'rough') return config.release
  return isInt(state?.release, 1, RELEASE_MAX) ? state.release : startRelease(config)
}
export function madeRough(config: EnergyTrackConfig, state: EnergyTrackState): number {
  if (config.task === 'release') return config.rough
  return isInt(state?.rough, ROUGH_SET.lo, ROUGH_SET.hi) ? state.rough : startRough(config)
}
export const madeReach = (config: EnergyTrackConfig, state: EnergyTrackState) => reach(madeRelease(config, state), madeRough(config, state))
export const reached = (config: EnergyTrackConfig, state: EnergyTrackState) => madeReach(config, state) === config.flag

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no number at all.

const marks = (n: number) => `${n} ${n === 1 ? 'mark' : 'marks'}`

export function working(config: EnergyTrackConfig, state: EnergyTrackState): string {
  const release = madeRelease(config, state)
  const rough = madeRough(config, state)
  const heavy = config.ball === 'heavy' ? ' The heavy ball has more energy in every store, but it climbs to the same mark, because its extra weight cancels.' : ''
  if (rough === 0) {
    return `Yes. The floor is smooth, so no energy was lost: the height store became the motion store at the bottom and then became height again. The ball started ${marks(release)} up and climbed ${marks(config.flag)}.${heavy}`
  }
  return `Yes. The ball started ${marks(release)} up. The rough floor turned ${marks(rough)} of its height energy into heat, which is not lost, just spread out, so it climbed only ${marks(config.flag)}. Height + motion + heat always add up to the energy it started with.${heavy}`
}

export function madeText(config: EnergyTrackConfig, state: EnergyTrackState): string {
  const release = madeRelease(config, state)
  const rough = madeRough(config, state)
  const up = madeReach(config, state)
  if (release <= rough) {
    return `The ball started ${marks(release)} up, and the rough floor turned all of its height energy into heat before it got across: it stopped on the floor.`
  }
  return `The ball started ${marks(release)} up, the floor took ${marks(rough)} as heat, and it climbed ${marks(up)}. The flag is ${marks(config.flag)} up.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

function readTask(raw: unknown): Task | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '')
  const alias: Record<string, Task> = {
    release: 'release', drop: 'release', height: 'release', climb: 'release', reach: 'release', start: 'release', 'release-height': 'release',
    'start-height': 'release', 'gravitational-potential-energy': 'release', gpe: 'release', 'potential-energy': 'release', 'kinetic-energy': 'release',
    'energy-stores': 'release', 'energy-transfer': 'release', 'energy-transfers': 'release', 'conservation-of-energy': 'release', 'energy-conservation': 'release',
    rough: 'rough', roughness: 'rough', friction: 'rough', floor: 'rough', surface: 'rough', heat: 'rough', thermal: 'rough', 'thermal-energy': 'rough',
    'rough-floor': 'rough', 'set-the-floor': 'rough', 'energy-loss': 'rough', 'wasted-energy': 'rough',
  }
  return Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null
}

function readNumber(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const key = raw.trim().toLowerCase()
    const words: Record<string, number> = { smooth: 0, none: 0, nothing: 0, frictionless: 0, 'no friction': 0, slight: 1, slightly: 1, little: 1, some: 2, medium: 2, rough: 3, 'very rough': 3 }
    if (Object.prototype.hasOwnProperty.call(words, key)) return words[key]
    if (key === '') return null
    const n = Number(key.replace(/\s*(marks?|units?|steps?)$/i, ''))
    return Number.isFinite(n) && Math.abs(n) <= 1000 ? n + 0 : null
  }
  return typeof raw === 'number' && Number.isFinite(raw) && Math.abs(raw) <= 1000 ? raw + 0 : null
}

function readBall(raw: unknown): Ball {
  const key = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return /heavy|big|large|massive|bowling|2 ?kg|more mass|heavier/.test(key) ? 'heavy' : 'light'
}

const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const nearInt = (v: number, lo: number, hi: number) => clamp(Number.isFinite(v) ? Math.round(v) : lo, lo, hi)

export const energyTrackEngine: SceneEngine<EnergyTrackConfig, EnergyTrackState> = {
  id: 'energy-track',
  // `covers` matches on any single word, so only a distinctive one lives here; the rest are whole phrases.
  covers: ['kinetic'],
  phrases: [
    'kinetic energy', 'gravitational potential energy', 'gravitational energy', 'potential energy', 'gpe', 'energy stores', 'energy store', 'stores of energy',
    'energy transfer', 'energy transfers', 'energy transformation', 'energy transformations', 'conservation of energy', 'energy conservation',
    'law of conservation of energy', 'principle of conservation of energy', 'conservation of mechanical energy', 'mechanical energy', 'work energy and power', 'work power energy', 'work power and energy',
    'work and energy', 'work energy', 'energy and work', 'energy and motion', 'energy changes in motion', 'energy dissipation', 'dissipated energy', 'wasted energy',
    'energy on a roller coaster', 'roller coaster energy', 'energy of a moving object', 'energy and friction',
  ],
  // Near misses: the same words about something that is not a ball on a track.
  notFor: [
    'kinetic theory', 'kinetic model', 'kinetic molecular', 'particle model', 'kinetic energy of particles', 'kinetic energy of gas', 'kinetic energy of molecules', 'kinetics', 'reaction kinetics',
    'kinetic friction', 'chemical kinetics', 'enzyme kinetics', 'rates of reaction',
    'energy transfer in food', 'energy transfers in food', 'energy transfer in ecosystems', 'energy transfer in an ecosystem', 'energy transfer in cells', 'energy transfers in cells',
    'energy transfer through', 'energy transfer between trophic', 'energy flow', 'energy stores in the body', 'energy stores in organisms', 'energy store in the body',
    'energy stores in plants', 'energy in food', 'food energy', 'energy in the diet', 'energy requirements', 'energy budget',
    'electrical energy', 'energy in circuits', 'energy transfers in circuits', 'energy transfer in circuits', 'energy transfer in electrical', 'electric potential energy',
    'elastic potential energy', 'elastic energy', 'energy in springs', 'spring energy', 'energy in waves', 'wave energy', 'energy of a photon', 'photon energy',
    'thermal energy transfer', 'energy transfer by heating', 'energy transfer by conduction', 'energy transfer by radiation', 'conduction convection and radiation', 'heat transfer', 'thermal energy store',
    'bond energy', 'bond energies', 'energy changes in reactions', 'energy changes in chemical reactions', 'reaction profile', 'energy profile', 'activation energy', 'enthalpy',
    'potential energy diagram', 'potential energy surface', 'potential energy of electrons', 'nuclear energy', 'binding energy', 'energy levels', 'energy level diagram',
    'renewable energy', 'energy resources', 'energy sources', 'fossil fuels', 'power station', 'generating electricity', 'energy bills', 'energy efficiency of', 'energy management',
    'conservation of mass', 'conservation of momentum', 'wildlife conservation', 'conservation of species', 'conservation of biodiversity', 'conservation area', 'soil conservation',
    'water conservation', 'energy conservation in', 'conserving energy', 'energy saving', 'energy policy', 'energy consumption', 'energy demand',
    'work done by a force', 'work done on', 'power of a machine', 'kinetic art', 'potential customers', 'potential career', 'potential difference',
  ],
  // The learner sets a height or a roughness: how much, which is a quantity.
  isolates: 'quantity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const task = readTask(nested ? first(nested, ['kind', 'task', 'type']) : first(o, ['task', 'kind', 'type']))
    if (!task) return null
    const ball = readBall(first(src, ['ball', 'mass', 'object', 'weight']))
    const rawFlag = first(src, ['flag', 'target', 'goal', 'mark', 'reach', 'climb', 'height'])
    if (task === 'release') {
      const rawRough = first(src, ['rough', 'roughness', 'friction', 'loss', 'heat', 'floor'])
      const rough = rawRough === undefined ? 0 : readNumber(rawRough)
      const flag = rawFlag === undefined ? 4 : readNumber(rawFlag)
      return rough === null || flag === null ? null : { task, flag, rough, ball }
    }
    const rawRelease = first(src, ['release', 'start', 'drop', 'from', 'start_height'])
    const release = rawRelease === undefined ? 7 : readNumber(rawRelease)
    const flag = rawFlag === undefined ? (release === null ? 4 : clamp(release - 2, FLAG.lo, FLAG.hi)) : readNumber(rawFlag)
    return release === null || flag === null ? null : { task, release, flag, ball }
  },

  faults(config) {
    const whole = (name: string, v: number) => (Number.isInteger(v) ? null : `${name} must be a whole number of marks, e.g. ${name} ${Math.round(v)}.`)
    if (config.task === 'release') {
      const bad = whole('flag', config.flag) ?? whole('rough', config.rough)
      if (bad) return [bad]
      if (config.flag < FLAG.lo || config.flag > FLAG.hi) {
        const eg = nearInt(config.flag, FLAG.lo, FLAG.hi)
        return [`A flag ${config.flag} marks up ${config.flag > FLAG.hi ? 'leaves no room above it for the ball to be released from' : 'is too low to show the ball climbing'}: flag must be from ${FLAG.lo} to ${FLAG.hi}, e.g. flag ${eg}.`]
      }
      if (config.rough < ROUGH_FIXED.lo || config.rough > ROUGH_FIXED.hi) {
        return [`A floor that takes ${config.rough} marks is not drawn: rough must be from ${ROUGH_FIXED.lo} (smooth) to ${ROUGH_FIXED.hi}, e.g. rough ${nearInt(config.rough, ROUGH_FIXED.lo, ROUGH_FIXED.hi)}.`]
      }
      return []
    }
    const bad = whole('release', config.release) ?? whole('flag', config.flag)
    if (bad) return [bad]
    if (config.flag < FLAG.lo || config.flag > FLAG.hi) {
      return [`A flag ${config.flag} marks up is not drawn: flag must be from ${FLAG.lo} to ${FLAG.hi}, e.g. flag ${nearInt(config.flag, FLAG.lo, FLAG.hi)}.`]
    }
    const lost = config.release - config.flag
    if (config.release > RELEASE_MAX) {
      return [`A release ${config.release} marks up is higher than the hill (${RELEASE_MAX}): release must be at most ${RELEASE_MAX}, e.g. release ${Math.min(RELEASE_MAX, config.flag + 2)}, flag ${config.flag}.`]
    }
    if (lost < 1 || lost > ROUGH_SET.hi) {
      const flag = clamp(config.release - 2, FLAG.lo, FLAG.hi)
      const release = Math.min(RELEASE_MAX, flag + 2)
      return [`The floor must take between 1 and ${ROUGH_SET.hi} marks, so release must be 1 to ${ROUGH_SET.hi} marks above the flag: ${lost < 1 ? 'a ball released no higher than the flag can never reach it' : 'that much is more than the roughest floor takes'}, e.g. release ${release}, flag ${release - 2}.`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = config.task === 'release'
      ? 'Press the + and − buttons to raise or lower the ball until it just reaches the flag.'
      : 'Press the + and − buttons to change the floor until the ball just reaches the flag.'
    const numbers = /\b\d+\s*(?:marks?|units?|steps?|joules?|j|m|cm|metres?)\b|=\s*\d/i.test(text)
    const idea = /\bhigher\b|\bsame height\b|\bequal|\bconserv|\blose|\blost\b|\bloses\b|\bfriction\b|\bheat(?:s|ed|ing)?\b|\bthermal\b|\bwasted?\b|\bturns? into\b|\bconvert(?:s|ed|ing)?\b|\btransferr?ed?\b|\bmore energy\b|\benergy\b|\bgravity\b|\bpotential\b|\bkinetic\b|\brougher\b|\bsmoother\b|\broughen\b|\bsmooth(?:en)?\b/i.test(text)
    return numbers || idea
      ? [`the prompt gives the answer away: it says a number, the rule, or what the floor does with the energy, which the learner is to find with the ${config.task === 'release' ? 'ball' : 'floor'} -- ask for the outcome only ("${example}")`]
      : []
  },

  initial(config) {
    return config.task === 'release' ? { release: startRelease(config) } : { rough: startRough(config) }
  },

  check(config, state) {
    return { ok: reached(config, state), wrongIds: [] }
  },

  solve(config) {
    return config.task === 'release' ? { release: releaseAnswer(config) } : { rough: roughAnswer(config) }
  },

  View: EnergyTrackView,

  prompt: `SCENE "energy-track" -- a ball on a track, and three coloured bars that answer back: a dark flat stage with a hill on each side of a floor, a ball, a flag on the right hill, and three bars called height, motion and heat with a dashed line at the total. The learner taps round + and - buttons; the ball runs down the left hill, across the floor and up the right, and the bars rise and fall as it goes: height turns into motion at the bottom, motion into height again, and a rough floor (orange teeth) puts some into heat. The ball stops climbing and turns where its motion runs out. There are no numbers on the card before marking; marking gives the marks and says where the energy went.
  For: energy stores and transfers, gravitational potential energy, kinetic energy, conservation of energy, why a ball does not climb as high after a rough patch, and that energy is not used up but moves to the heat store. Also that a heavier ball does not go higher or faster.
  release: the learner raises or lowers the ball on the left hill (the + and - buttons) until it just climbs to the flag. Config: flag: marks up the right hill, whole number 2 to 6; rough: marks the floor takes as heat, 0 (smooth) to 3; ball: "light" or "heavy" (default light). With rough 0 the ball climbs to exactly the height it started; with rough 2 it must be released 2 marks higher than the flag. Marking says what the floor took.
  rough: the ball's start is fixed; the learner makes the floor rougher or smoother (+ and -) until the ball just reaches the flag. Config: release: marks up the left hill, up to 9; flag: marks up the right hill, 2 to 6; release minus flag must be 1 to 4 (the roughness that works). ball as above.
  ball "heavy": a bigger ball with taller bars in every store; it climbs to the same height, which marking says.
  Not drawn: other track shapes, loops, ramps with angles, springs, air resistance, speed read-outs, joules, masses in kg. Do not use it for energy in food chains or cells, electrical energy, kinetic theory of particles, bond energies, renewable energy sources, energy bills, or conservation of wildlife.
  Before marking the card shows only what happens, with short names on the things (ball, flag, floor, height, motion, heat, total). It holds back every mark count and the rule. The prompt must ask for the outcome only: do NOT say a number of marks, which way to move the ball or the floor, that the floor takes energy, that energy is conserved, lost, wasted or bconvert(?:s|ed|ing)?b, or name the stores.
  config: { "task":"release", "flag":4, "rough":2, "ball":"light" }  -- the prompt says "Press the + and − buttons to raise or lower the ball until it just reaches the flag."
       or { "task":"rough", "release":7, "flag":4, "ball":"heavy" }  -- the prompt says "Press the + and − buttons to change the floor until the ball just reaches the flag."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Press the + and − buttons to raise or lower the ball until it just reaches the flag.",
    "payload": { "engine":"energy-track", "config": { "task":"release", "flag":4, "rough":2, "ball":"light" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:energy-track", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Press the + and − buttons to change the floor until the ball just reaches the flag.",
    "payload": { "engine":"energy-track", "config": { "task":"rough", "release":7, "flag":4, "ball":"heavy" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"quantity", "apparatus":"scene:energy-track", "why":"..." } }`,
}

registerEngine(energyTrackEngine as SceneEngine<unknown, unknown>)
