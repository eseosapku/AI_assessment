// lib/studylab/engines/motor-effect/config.ts
//
// Cambridge IGCSE Physics 0625: the motor effect and a simple d.c. motor.
// The kicking wire is perpendicular to a uniform field, with fixed active length. Its
// direction follows conventional current and field; its drawn deflection grows with current.
// The single-loop motor has ideal contacts and prescribed quarter-turn steps (not a voltage,
// speed or back-emf simulation). Split-ring current reverses at each dead centre; slip-ring
// current does not, so past upright the forces push the coil back and it stops upright.
// Directions follow F = I L x B with x right, y up, z towards the viewer: field from the N pole
// behind the wire to the S pole in front is +z, current down is -y, so the force is -x (left).
// Sources are named in research.md.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MotorEffectView } from './View'

export type Swing = 'left' | 'right'
export type Contacts = 'slip' | 'split'
export type MotorConfig =
  | { task: 'wire'; swing: string; amps: number }
  | { task: 'motor' }
export type MotorState = {
  amps?: number
  supply?: 1 | -1
  poles?: 1 | -1
  contacts?: Contacts
  /** Quarter-turns made, 0 to 4. Slip rings never get past 1: the coil stops upright. */
  angle?: number
  /** Times a slip-ring coil was pushed on past upright and swung back; each one replays the swing. */
  pushes?: number
}

export const CURRENT_MIN = 1
export const CURRENT_MAX = 3
export const FULL_TURN = 4

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASKS: Record<string, MotorConfig['task']> = {
  wire: 'wire', 'kicking-wire': 'wire', kick: 'wire', force: 'wire', 'force-on-a-wire': 'wire',
  'current-carrying-wire': 'wire', 'current-carrying-conductor': 'wire', conductor: 'wire',
  'motor-effect': 'wire', 'motor-effect-wire': 'wire', fleming: 'wire', 'flemings-left-hand-rule': 'wire', 'fleming-s-left-hand-rule': 'wire',
  motor: 'motor', 'dc-motor': 'motor', 'd-c-motor': 'motor', 'direct-current-motor': 'motor',
  commutator: 'motor', 'split-ring': 'motor', 'split-ring-commutator': 'motor', coil: 'motor',
}

function readAmps(raw: unknown): number | null {
  if (raw === undefined) return 2
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:a|amps?|amperes?)?$/i)
  return m ? Number(m[1]) : null
}

function parseConfig(raw: unknown): MotorConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
  const src = nested ?? o
  const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
  const k = keyOf(rawTask)
  if (k && !own(TASKS, k)) return null
  const direction = first(src, ['swing', 'direction', 'way', 'force', 'target'])
  const task = k ? TASKS[k] : direction !== undefined || first(src, ['current', 'amps', 'amperes']) !== undefined ? 'wire'
    : first(src, ['contacts', 'commutator']) !== undefined ? 'motor' : null
  if (!task) return null
  if (task === 'motor') return { task }
  const amps = readAmps(first(src, ['current', 'amps', 'amperes']))
  if (amps === null) return null
  let swing = 'left'
  if (direction !== undefined) {
    if (typeof direction !== 'string') return null
    swing = keyOf(direction).replace(/^(?:to-the|towards?|the)-/, '').replace(/-?$/, '')
  }
  return { task, swing, amps }
}

/** +1 means the starting spatial force, -1 the other way. Reversing both cancels. */
export const forceSign = (state: MotorState): number => (state.supply === -1 ? -1 : 1) * (state.poles === -1 ? -1 : 1)
export const cleanAmps = (state: MotorState): number => typeof state?.amps === 'number' && Number.isFinite(state.amps)
  ? Math.max(0, Math.min(CURRENT_MAX, Math.round(state.amps))) : 0
/** For marking only: a current the controls cannot make is never right. */
const exactAmps = (state: MotorState): number => typeof state?.amps === 'number' && Number.isInteger(state.amps) && state.amps >= 0 && state.amps <= CURRENT_MAX
  ? state.amps : -1
export const cleanAngle = (state: MotorState): number => typeof state?.angle === 'number' && Number.isFinite(state.angle)
  ? Math.max(0, Math.min(FULL_TURN, Math.round(state.angle))) : 0
export const cleanContacts = (state: MotorState): Contacts => state?.contacts === 'split' ? 'split' : 'slip'

export function wireWay(config: MotorConfig, state: MotorState): Swing | 'still' {
  if (config.task !== 'wire' || cleanAmps(state) === 0) return 'still'
  // Supply 1 sends current down the wire; poles 1 puts N behind it. F = I L x B then points left.
  return forceSign(state) > 0 ? 'left' : 'right'
}

/** One press, one labelled quarter-turn. A split ring coasts through its contact gaps. */
export function nextMotorAngle(state: MotorState): number {
  const a = cleanAngle(state)
  if (a >= FULL_TURN) return FULL_TURN
  if (cleanContacts(state) === 'split') return a + 1
  // Slip rings: the current never reverses, so past upright the forces turn the coil back. It stops upright.
  return 1
}

export function nextMotorState(state: MotorState): MotorState {
  const contacts = cleanContacts(state)
  const angle = nextMotorAngle(state)
  const pushes = contacts === 'slip' && cleanAngle(state) >= 1 ? (state.pushes ?? 0) + 1 : state.pushes ?? 0
  return { contacts, angle, pushes }
}

export function motorSolved(config: MotorConfig, state: MotorState): boolean {
  return config.task === 'motor' && cleanContacts(state) === 'split' && cleanAngle(state) >= FULL_TURN
}

export function wireSolved(config: MotorConfig, state: MotorState): boolean {
  if (config.task !== 'wire') return false
  return exactAmps(state) === config.amps && wireWay(config, state) === config.swing
}

const side = (way: Swing | 'still') => way === 'still' ? 'is hanging still' : `swings ${way}`

export function wireFeedback(config: MotorConfig, state: MotorState, ok: boolean): string[] {
  if (config.task !== 'wire') return []
  const amps = cleanAmps(state)
  const made = amps === 0 ? 'No current flows, so the wire hangs still.' : `The wire ${side(wireWay(config, state))} at ${amps} A.`
  const rule = 'Reverse supply or magnets to reverse the force; both cancels. More current means more force.'
  if (ok) return [`Yes. ${made}`, rule]
  return [made, `The aim is ${config.swing} at ${config.amps} A. ${rule}`]
}

export function motorFeedback(config: MotorConfig, state: MotorState, ok: boolean): string[] {
  if (config.task !== 'motor') return []
  if (ok) return [
    'Yes. The split ring carried the coil through 360°.',
    'Fixed brushes exchange half-rings every half-turn, reversing coil current and keeping the force turning one way.',
  ]
  const a = cleanAngle(state) * 90
  if (cleanContacts(state) === 'slip') return [
    a ? 'Slip rings: the coil swings to upright, then the forces push it back. It stops at 90°.' : 'Slip rings: the coil has not turned yet.',
    'With slip rings the current never reverses, so past upright the forces turn it back. Try the other contacts.',
  ]
  return [`The split ring is fitted, but the coil has turned only ${a}° of 360°.`, 'Keep pressing Turn 90°. At each gap the current pauses; momentum carries the coil through before the current reverses.']
}

export function goodPrompt(config: MotorConfig): string {
  return config.task === 'wire'
    ? `Use the current, supply and magnet controls to make the copper wire swing ${config.swing} at ${config.amps} A.`
    : 'Try the contacts, then press Turn 90° to move the coil. Make the coil complete one full turn.'
}

function faults(config: MotorConfig): string[] {
  if (config.task === 'motor') return []
  const out: string[] = []
  if (config.swing !== 'left' && config.swing !== 'right') out.push(`The wire can only swing left or right in this apparatus, not "${config.swing}": use e.g. swing "left".`)
  if (!Number.isInteger(config.amps) || config.amps < CURRENT_MIN || config.amps > CURRENT_MAX) {
    const near = Math.max(CURRENT_MIN, Math.min(CURRENT_MAX, Math.round(config.amps) || 2))
    out.push(`The target current must be a whole number from ${CURRENT_MIN} to ${CURRENT_MAX} A so its swing is clearly visible: use e.g. current ${near}.`)
  }
  return out
}

function promptFaults(config: MotorConfig, prompt: string): string[] {
  const example = goodPrompt(config)
  if (config.task === 'wire') {
    if (/revers(?:e|ing|ed).{0,45}(?:force|swing|kick)|(?:force|swing|kick).{0,45}revers|both.{0,25}cancel|swap\s+the\s+magnets|reverse\s+the\s+(?:supply|current)|current\s+(?:up|down)(?:wards)?|north\s+(?:at\s+)?(?:front|back)/i.test(prompt)) {
      return [`the prompt gives away the control setting or the reversal rule the learner is to discover: ask only for the swing and current ("${example}")`]
    }
    if (/drag|turn\s+(?:the\s+)?coil|commutator|split[- ]ring|slip[- ]ring|loudspeaker|charged\s+particles?/i.test(prompt)) {
      return [`the prompt promises a different apparatus: this card is a swinging straight wire with current, supply and magnet controls ("${example}")`]
    }
    return []
  }
  if (/split[- ]ring|commutat|revers(?:e|es|ing|ed)\s+(?:the\s+)?current|exchange\s+(?:the\s+)?brushes|use\s+the\s+other\s+contacts|slip\s+rings?\s+(?:turn|rock|oscillat)/i.test(prompt)) {
    return [`the prompt gives away which contacts work or what they do: let the learner try both and watch ("${example}")`]
  }
  if (/drag|reverse\s+the\s+supply|swap\s+the\s+magnets|current\s+in\s+amperes|loudspeaker|charged\s+particles?/i.test(prompt)) {
    return [`the prompt promises controls this motor does not have: it changes contacts and turns in 90° steps ("${example}")`]
  }
  return []
}

export const motorEffectEngine: SceneEngine<MotorConfig, MotorState> = {
  id: 'motor-effect',
  covers: ['motor effect', 'electric motors', 'dc motor', 'd.c. motor'],
  phrases: [
    'force on a current-carrying conductor', 'force on a current carrying conductor', 'current-carrying conductor in a magnetic field',
    'Fleming left-hand rule', 'Fleming left hand rule', 'Flemings left-hand rule', 'Flemings left hand rule',
    'electric motor', 'dc motors', 'd.c. motors', 'direct current motor', 'direct current motors',
    'split-ring commutator', 'split ring commutator', 'commutator and brushes', 'motor effect wire',
  ],
  notFor: [
    'electromagnetic induction', 'induced emf', 'induced current', 'electric generator', 'electric generators', 'ac generator', 'dc generator',
    'transformer', 'transformers', 'field around a magnet', 'magnetic field patterns', 'plotting compass',
    'electric circuits', 'series circuits', 'parallel circuits', 'turning forces', 'principle of moments', 'moment of a force',
    'motor neurone', 'motor neurones', 'motor neuron', 'motor neurons', 'motor proteins', 'motor development', 'motor skills', 'motor vehicles',
  ],
  // The learner changes the conditions and sees their consequence: a kick or continuous turning.
  isolates: 'consequence',
  parse: parseConfig,
  faults,
  promptFaults,
  initial: (config) => config.task === 'wire'
    ? { amps: 0, supply: 1, poles: 1 }
    : { contacts: 'slip', angle: 0 },
  check(config, state) {
    const safe = state ?? {}
    if (config.task === 'wire') {
      const wrongIds: string[] = []
      if (exactAmps(safe) !== config.amps) wrongIds.push('current')
      if (wireWay(config, safe) !== config.swing) wrongIds.push('direction')
      return { ok: wrongIds.length === 0, wrongIds }
    }
    const wrongIds: string[] = []
    if (cleanContacts(safe) !== 'split') wrongIds.push('contacts')
    if (cleanAngle(safe) < FULL_TURN) wrongIds.push('angle')
    return { ok: wrongIds.length === 0, wrongIds }
  },
  solve: (config) => config.task === 'wire'
    ? { amps: config.amps, supply: config.swing === 'left' ? 1 : -1, poles: 1 }
    : { contacts: 'split', angle: FULL_TURN },
  View: MotorEffectView,
  prompt: `SCENE "motor-effect" -- real school apparatus on a quiet light panel. Two hands-on task kinds for Cambridge IGCSE Physics 0625.
  wire: a copper rod hangs between the N pole of a magnet behind it and the S pole in front of it (drawn see-through), with field arrows running from back to front and a conventional-current arrow on the rod. It visibly kicks left or right when current flows, further for more current. The learner sets Current (0 to 3 A), Reverse supply and Swap N and S. The goal is repeated in plain words under the picture: swing left or right at a given current. Reversing one thing flips the force; reversing both cancels. No dot/cross vector notation is used. config: { "task":"wire", "swing":"left" | "right", "current":1 | 2 | 3 } (current is also accepted as "amps"; default 2).
  motor: the textbook 3D view of a copper single-loop coil between N and S poles, its axle running towards the viewer to the contacts, fixed carbon brushes and a d.c. supply. Force arrows are always up on the right-hand side and down on the left. The learner changes between slip rings and a split ring, then presses Turn 90° and watches the coil turn. With slip rings it swings to upright, overshoots and is pushed back: it stops upright. The split ring carries it through 360°, reversing the current at each half-turn. The live measure says how many degrees of one full turn it has made. config: { "task":"motor" }.
  For: the motor effect, force on a current-carrying conductor, Fleming's left-hand rule, d.c. motors, split-ring commutator and brushes. It answers "reversing both current and field reverses the force twice", "a bigger current only changes speed, not force", and "any rotating contacts keep a motor turning".
  Not drawn: loudspeakers, charged-particle beams, numerical force or F = BIL, field strength controls, multiple turns, back-emf, generators, induction and transformers. Do not use it for those.
  Before marking the card shows the apparatus, live movement, the requested outcome and the learner's current or angle. It does not name the needed supply/magnet arrangement or say which motor contacts work. Feedback says what the learner made and the rule. The prompt must name the goal and gesture but not the setting, reversal rule, winning contacts or current-reversal explanation.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the current, supply and magnet controls to make the copper wire swing left at 2 A.",
    "payload": { "engine":"motor-effect", "config": { "task":"wire", "swing":"left", "current":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:motor-effect", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Use the current, supply and magnet controls to make the copper wire swing right at 3 A.",
    "payload": { "engine":"motor-effect", "config": { "task":"wire", "swing":"right", "current":3 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:motor-effect", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Try the contacts, then press Turn 90° to move the coil. Make the coil complete one full turn.",
    "payload": { "engine":"motor-effect", "config": { "task":"motor" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:motor-effect", "why":"..." } }`,
}

registerEngine(motorEffectEngine as SceneEngine<unknown, unknown>)
