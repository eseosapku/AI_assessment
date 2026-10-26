// lib/studylab/engines/body-flow/config.ts
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { BodyFlowView } from './View'

/*
 * The routes, as the syllabus teaches them.
 *
 * Cambridge IGCSE Biology 0610 (syllabus for 2023-2025, kept in 2026-2028):
 * - 7.2 Digestive system: the alimentary canal is the mouth, oesophagus,
 *   stomach, small intestine (duodenum and ileum), large intestine (colon,
 *   rectum) and anus. The salivary glands, pancreas, liver and gall bladder are
 *   associated organs: food does not pass through them.
 * - 9.1-9.3 Transport in animals: the double circulation of a mammal, the four
 *   chambers of the heart, and the vena cava, aorta, pulmonary artery and
 *   pulmonary vein. Blood from the body returns in the vena cava to the right
 *   atrium, passes to the right ventricle and leaves in the pulmonary artery for
 *   the lungs; it comes back in the pulmonary vein to the left atrium, passes to
 *   the left ventricle and leaves in the aorta for the body. Blood on the right
 *   side is deoxygenated, on the left oxygenated.
 * - 11.1 Gas exchange in humans: the trachea, bronchi, bronchioles and alveoli
 *   of the breathing system (beside the oesophagus and above the diaphragm).
 * Cambridge Lower Secondary Science (0893), Biology (structure and function):
 * the human digestive, circulatory and breathing systems, by the same names.
 *
 * Narrowed on purpose: the airway runs nose and mouth, trachea, bronchus,
 * bronchiole, alveolus (the larynx and pharynx are left out); the small
 * intestine is one part (not duodenum and ileum); the venae cavae are one
 * vessel. Food goes one way only; air goes in and back out the same way.
 */

export type SystemId = 'circulation' | 'breathing' | 'digestion'
export const SYSTEM_IDS: readonly SystemId[] = ['circulation', 'breathing', 'digestion']

export interface PartDef {
  /** How it is said, after "the". */
  name: string
  /** Other ways a writer might name it. */
  also?: string[]
}

export interface SystemDef {
  /** What travels the route. */
  carries: 'blood' | 'air' | 'food'
  /** The parts on the route, in the order the blood, air or food passes them. */
  route: readonly string[]
  /** The route's end leads back to its start. */
  loop: boolean
  /** The same tubes carry it back out (breathing out). */
  twoWay: boolean
  /** Every part drawn, on the route or beside it. */
  parts: Record<string, PartDef>
}

export const SYSTEMS: Record<SystemId, SystemDef> = {
  circulation: {
    carries: 'blood',
    route: ['body', 'vena-cava', 'right-atrium', 'right-ventricle', 'pulmonary-artery', 'lungs', 'pulmonary-vein', 'left-atrium', 'left-ventricle', 'aorta'],
    loop: true,
    twoWay: false,
    parts: {
      'body': { name: 'body', also: ['body organs', 'organs', 'body tissues', 'tissues', 'body cells', 'rest of the body'] },
      'vena-cava': { name: 'vena cava', also: ['venae cavae', 'vena cavae', 'venacava', 'superior vena cava', 'inferior vena cava'] },
      'right-atrium': { name: 'right atrium' },
      'right-ventricle': { name: 'right ventricle' },
      'pulmonary-artery': { name: 'pulmonary artery', also: ['pulmonary arteries', 'pulmonary trunk'] },
      'lungs': { name: 'lungs', also: ['lung'] },
      'pulmonary-vein': { name: 'pulmonary vein', also: ['pulmonary veins'] },
      'left-atrium': { name: 'left atrium' },
      'left-ventricle': { name: 'left ventricle' },
      'aorta': { name: 'aorta' },
    },
  },
  breathing: {
    carries: 'air',
    route: ['nose-mouth', 'trachea', 'bronchus', 'bronchiole', 'alveolus'],
    loop: false,
    twoWay: true,
    parts: {
      'nose-mouth': { name: 'nose and mouth', also: ['nose', 'mouth', 'nose or mouth', 'mouth and nose', 'mouth or nose', 'nostrils', 'nasal cavity'] },
      'trachea': { name: 'trachea', also: ['windpipe'] },
      'bronchus': { name: 'bronchus', also: ['bronchi'] },
      'bronchiole': { name: 'bronchiole', also: ['bronchioles'] },
      'alveolus': { name: 'alveolus', also: ['alveoli', 'air sac', 'air sacs'] },
      // Beside the route: air never passes through them.
      'oesophagus': { name: 'oesophagus', also: ['esophagus', 'gullet'] },
      'diaphragm': { name: 'diaphragm' },
    },
  },
  digestion: {
    carries: 'food',
    route: ['mouth', 'oesophagus', 'stomach', 'small-intestine', 'large-intestine', 'rectum', 'anus'],
    loop: false,
    twoWay: false,
    parts: {
      'mouth': { name: 'mouth', also: ['mouth cavity', 'buccal cavity'] },
      'oesophagus': { name: 'oesophagus', also: ['esophagus', 'gullet', 'food pipe', 'foodpipe'] },
      'stomach': { name: 'stomach' },
      'small-intestine': { name: 'small intestine', also: ['small bowel', 'duodenum', 'ileum'] },
      'large-intestine': { name: 'large intestine', also: ['large bowel', 'colon'] },
      'rectum': { name: 'rectum' },
      'anus': { name: 'anus' },
      // Beside the route: food never passes through them.
      'liver': { name: 'liver' },
      'gall-bladder': { name: 'gall bladder', also: ['gallbladder'] },
      'pancreas': { name: 'pancreas' },
    },
  },
}

/** Blood rich in oxygen (red) or low in it (blue), as textbooks colour it; the beds change it halfway. */
export const OXYGEN: Record<string, 'oxygenated' | 'deoxygenated' | 'changes'> = {
  'vena-cava': 'deoxygenated', 'right-atrium': 'deoxygenated', 'right-ventricle': 'deoxygenated', 'pulmonary-artery': 'deoxygenated',
  'pulmonary-vein': 'oxygenated', 'left-atrium': 'oxygenated', 'left-ventricle': 'oxygenated', 'aorta': 'oxygenated',
  'lungs': 'changes', 'body': 'changes',
}

export type BodyFlowConfig = { task: { kind: 'trace-route'; system: SystemId; from: string; to: string } }
/** The parts the learner has tapped, in order, after the start. */
export type BodyFlowState = { taps: string[] }

/** "The Vena-Cava", "vena_cava " and "vena cava" read alike. */
const key = (raw: unknown) =>
  typeof raw === 'string'
    ? raw.trim().toLowerCase().replace(/[\s/_-]+/g, ' ').replace(/[.!?]+$/, '').replace(/^(the|a|an) /, '').trim()
    : ''

const SYSTEM_WORDS: Record<string, SystemId> = {
  'circulation': 'circulation', 'circulatory': 'circulation', 'circulatory system': 'circulation', 'double circulation': 'circulation',
  'blood circulation': 'circulation', 'blood': 'circulation', 'heart': 'circulation', 'cardiovascular': 'circulation', 'cardiovascular system': 'circulation',
  'breathing': 'breathing', 'breathing system': 'breathing', 'respiratory system': 'breathing', 'respiratory tract': 'breathing',
  'airways': 'breathing', 'airway': 'breathing', 'air': 'breathing', 'gas exchange system': 'breathing',
  'digestion': 'digestion', 'digestive system': 'digestion', 'digestive tract': 'digestion', 'alimentary canal': 'digestion',
  'gut': 'digestion', 'food': 'digestion', 'gastrointestinal tract': 'digestion',
}

/** The system a writer names. "Respiration" is refused: it is the chemical reaction in cells, not breathing. */
export function readSystem(raw: unknown): SystemId | null {
  return SYSTEM_WORDS[key(raw)] ?? null
}

/** The part a writer names in a system, on the route or beside it. */
export function readPart(system: SystemId, raw: unknown): string | null {
  const k = key(raw)
  if (!k) return null
  for (const [id, p] of Object.entries(SYSTEMS[system].parts)) {
    if (k === id.replace(/-/g, ' ') || k === p.name || p.also?.includes(k)) return id
  }
  return null
}

export const nameOf = (system: SystemId, id: string) => SYSTEMS[system].parts[id]?.name ?? id

/**
 * The stretch of the route from one part to another, both ends included, in
 * the order it is travelled; null when no such stretch exists. Round a loop
 * the same part at both ends is the whole circuit; air may run the airway
 * backwards (breathing out); food runs one way.
 */
export function stretch(system: SystemId, from: string, to: string): string[] | null {
  const s = SYSTEMS[system]
  const r = s.route
  const i = r.indexOf(from)
  const j = r.indexOf(to)
  if (i < 0 || j < 0) return null
  if (s.loop) {
    const n = r.length
    const steps = (j - i + n) % n || n
    return Array.from({ length: steps + 1 }, (_, k) => r[(i + k) % n])
  }
  if (i < j) return r.slice(i, j + 1)
  if (i > j && s.twoWay) return r.slice(j, i + 1).reverse()
  return null
}

/** The taps that answer the task: every part after the start, to the end. */
export function expected(config: BodyFlowConfig): string[] {
  const { system, from, to } = config.task
  return stretch(system, from, to)?.slice(1) ?? []
}

/** Which way the stretch runs along the route: +1 forward, -1 back (breathing out). */
function direction(config: BodyFlowConfig): 1 | -1 {
  const { system, from, to } = config.task
  const r = SYSTEMS[system].route
  return !SYSTEMS[system].loop && r.indexOf(from) > r.indexOf(to) ? -1 : 1
}

/** The part the blood, air or food reaches next from this one, going the stretch's way. */
export function nextOf(config: BodyFlowConfig, part: string): string | null {
  const s = SYSTEMS[config.task.system]
  const i = s.route.indexOf(part)
  if (i < 0) return null
  const j = i + direction(config)
  if (s.loop) return s.route[(j + s.route.length) % s.route.length]
  return s.route[j] ?? null
}

/** The learner's taps, whatever was stored. */
export function tapsOf(state: unknown): string[] {
  const taps = (state as { taps?: unknown } | null)?.taps
  return Array.isArray(taps) ? taps.filter((t): t is string => typeof t === 'string') : []
}

/**
 * Each tap judged as a step: true when the blood, air or food can go there
 * from the part before it (the start, for the first). Every tap after the
 * route reached its end is wrong, since the route had finished.
 */
export function markTaps(config: BodyFlowConfig, taps: readonly string[]): boolean[] {
  const { from, to } = config.task
  let prev = from
  let arrived = false
  return taps.map((t, i) => {
    if (arrived) return false
    const ok = nextOf(config, prev) === t
    prev = t
    // Round a whole loop, the start is also the end: a first tap on it is not arriving.
    if (t === to && (from !== to || i > 0)) arrived = true
    return ok
  })
}

const the = (system: SystemId, id: string) => `the ${nameOf(system, id)}`

/**
 * What the learner made, in words that name only the parts they tapped and
 * the task's two ends -- never a part of the route they have not found.
 */
export function describeWrong(config: BodyFlowConfig, taps: readonly string[]): string {
  const { system, from, to } = config.task
  const what = SYSTEMS[system].carries
  if (taps.length === 0) return `You have not traced a route yet: tap the part the ${what} reaches first.`
  const marks = markTaps(config, taps)
  const k = marks.indexOf(false)
  if (k < 0) return `Your route stops at ${the(system, taps[taps.length - 1])}, before it reaches ${the(system, to)}.`
  const before = taps.slice(0, k)
  const finished = before.some((t, i) => t === to && (from !== to || i > 0))
  if (finished) return `Your route reaches ${the(system, to)}, then goes on to ${the(system, taps[k])}.`
  const prev = k === 0 ? from : taps[k - 1]
  if (taps[k] === prev) return `Your route starts at ${the(system, from)}: tap where the ${what} goes next.`
  return `You sent the ${what} from ${the(system, prev)} to ${the(system, taps[k])}.`
}

/** The route in words, for once it is marked right or shown. */
export function describeRoute(config: BodyFlowConfig): string {
  const { system, from, to } = config.task
  const what = SYSTEMS[system].carries
  const via = expected(config).slice(0, -1).map((id) => the(system, id))
  const end = from === to ? `back to ${the(system, to)}` : `to ${the(system, to)}`
  if (via.length === 0) return `The ${what} goes from ${the(system, from)} ${end}.`
  const list = via.length === 1 ? via[0] : `${via.slice(0, -1).join(', ')} and ${via[via.length - 1]}`
  return `The ${what} goes from ${the(system, from)} through ${list} ${end}.`
}

/** Where the route's ends fall when the writer leaves them out: the whole route. */
function ends(system: SystemId, from: string | null, to: string | null): [string, string] | null {
  const s = SYSTEMS[system]
  const first = s.route[0]
  const last = s.route[s.route.length - 1]
  if (s.loop) return from && to ? [from, to] : !from && !to ? [first, first] : null
  return [from ?? first, to ?? last]
}

const given = (v: unknown) => v !== undefined && v !== null && v !== ''

/** Whether a text names a part, by any of its names, as a whole word ("bronchi" is not in "bronchioles"). */
function names(system: SystemId, id: string, text: string): boolean {
  const p = SYSTEMS[system].parts[id]
  return [p.name, ...(p.also ?? [])].some((w) =>
    new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s_-]+')}\\b`, 'i').test(text),
  )
}

/**
 * The card's prompt is read before anything is marked, so it may say where the
 * route starts and ends but not a part between: that is the answer.
 */
export function promptFaults(config: BodyFlowConfig, prompt: string): string[] {
  const { system, from, to } = config.task
  const between = expected(config).slice(0, -1).filter((id) => id !== from && id !== to)
  const said = between.filter((id) => names(system, id, prompt)).map((id) => the(system, id))
  if (!said.length) return []
  const list = said.length === 1 ? said[0] : `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}`
  return [
    `the prompt gives the answer away: it names ${list}, on the route the learner is to find -- ` +
      `name only where the ${SYSTEMS[system].carries} starts and ends ("Trace the ${SYSTEMS[system].carries} from ${the(system, from)} to ${the(system, to)}.")`,
  ]
}

export const bodyFlowEngine: SceneEngine<BodyFlowConfig, BodyFlowState> & { promptFaults(config: BodyFlowConfig, prompt: string): string[] } = {
  id: 'body-flow',
  covers: [
    'double circulation', 'circulatory system', 'blood flow through the heart', 'chambers of the heart',
    'digestive system', 'alimentary canal', 'breathing system', 'airways to the lungs',
  ],
  isolates: 'order',

  parse(raw) {
    const task = (raw as { task?: Record<string, unknown> } | null)?.task
    if (!task || typeof task !== 'object') return null
    if (!['trace route', 'trace'].includes(key(task.kind))) return null
    const system = readSystem(task.system)
    if (!system) return null
    const from = given(task.from) ? readPart(system, task.from) : null
    const to = given(task.to) ? readPart(system, task.to) : null
    if ((given(task.from) && !from) || (given(task.to) && !to)) return null
    const both = ends(system, from, to)
    if (!both || !stretch(system, both[0], both[1])) return null
    return { task: { kind: 'trace-route', system, from: both[0], to: both[1] } }
  },

  faults(config) {
    if (expected(config).length >= 2) return []
    // Next door: the only tap is the place the prompt already names.
    const { system, from, to } = config.task
    const what = SYSTEMS[system].carries
    const further = nextOf(config, to)
    const back = SYSTEMS[system].route[SYSTEMS[system].route.indexOf(from) - direction(config)]
    const wider = further && further !== from && stretch(system, from, further) ? [from, further] : back && stretch(system, back, to) ? [back, to] : null
    return [
      `From ${the(system, from)} the ${what} goes straight to ${the(system, to)}, so there is nothing to trace: the learner would only tap the place the prompt names. ` +
        `Choose a stretch with at least one part between${wider ? `, such as from ${the(system, wider[0])} to ${the(system, wider[1])}` : ''}.`,
    ]
  },

  initial() {
    return { taps: [] }
  },

  check(config, state) {
    const taps = tapsOf(state)
    const want = expected(config)
    const marks = markTaps(config, taps)
    const ok = taps.length === want.length && taps.every((t, i) => t === want[i])
    return { ok, wrongIds: [...new Set(taps.filter((_, i) => !marks[i]))] }
  },

  solve(config) {
    return { taps: expected(config) }
  },

  promptFaults,

  View: BodyFlowView,

  prompt: `SCENE "body-flow" -- a clean labelled diagram of a body system, every part a button: the heart's four chambers
  with the lungs above and the body below (blood coloured red where oxygenated, blue where deoxygenated); the airway from
  nose and mouth to the alveoli, beside the oesophagus and above the diaphragm; or the gut from mouth to anus, with the
  liver, gall bladder and pancreas beside it. The learner taps the parts in the order the blood, air or food passes
  them, from the start to the end; it is marked on the order, then the flow runs along the path. For: double
  circulation, blood flow through the heart, the route of air into the lungs, the route of food through the gut.
  config: { "task": { "kind":"trace-route", "system":"<circulation | breathing | digestion>", "from":"<part>", "to":"<part>" } }
    circulation (a loop: any two parts, or one part twice for the whole circuit): body, vena cava, right atrium,
      right ventricle, pulmonary artery, lungs, pulmonary vein, left atrium, left ventricle, aorta
    breathing (in, or back out the same way): nose and mouth, trachea, bronchus, bronchiole, alveolus
    digestion (one way only): mouth, oesophagus, stomach, small intestine, large intestine, rectum, anus
  Leave at least one part between "from" and "to". The prompt names only where it starts and ends, never the parts between.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Trace the blood from the body to the lungs.",
    "payload": { "engine":"body-flow", "config": { "task": { "kind":"trace-route", "system":"circulation", "from":"body", "to":"lungs" } } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"order", "apparatus":"scene:body-flow", "why":"..." } }`,
}

registerEngine(bodyFlowEngine as SceneEngine<unknown, unknown>)
