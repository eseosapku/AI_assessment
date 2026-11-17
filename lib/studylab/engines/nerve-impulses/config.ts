// lib/studylab/engines/nerve-impulses/config.ts
//
// One chemical synapse, drawn large. An impulse has reached the sending neurone; the learner handles the
// molecular machinery, never the drawing's verdict:
//   transmit -- tap vesicles to release neurotransmitter. Molecules diffuse across the cleft and bind to
//               receptors; enough binding starts a new electrical impulse in the receiving neurone.
//   block    -- transmission is happening. Tap receptors to occupy them with a receptor-blocking drug;
//               too few available receptors stops the next impulse.
//
// The small numbers of vesicles/receptors are a deliberately simplified threshold model, not a biological
// constant. Marked sentences say "in this model". No ion mechanism, named drug or quantitative physiology
// is claimed. Mechanism and scope follow University of Utah Learn.Genetics and TeachMePhysiology (research.md).
import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { NerveImpulsesView } from './View'

export const VESICLES = ['v1', 'v2', 'v3'] as const
export const RECEPTORS = ['r1', 'r2', 'r3', 'r4'] as const
export type NerveTask = 'transmit' | 'block'
export type NerveConfig = { task: NerveTask; target: number }
export type NerveState = { released?: string[]; blocked?: string[] }

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const keyOf = (raw: unknown) => (typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : '')

const TASKS: Record<string, NerveTask> = {
  transmit: 'transmit', transmission: 'transmit', 'synaptic-transmission': 'transmit', synaptic: 'transmit', neurotransmission: 'transmit', synapse: 'transmit', synapses: 'transmit',
  release: 'transmit', 'release-neurotransmitter': 'transmit', 'release-transmitter': 'transmit', vesicles: 'transmit',
  fire: 'transmit', 'start-impulse': 'transmit', 'start-the-impulse': 'transmit', 'new-impulse': 'transmit',
  signal: 'transmit', send: 'transmit', 'pass-the-signal': 'transmit', 'cross-the-gap': 'transmit',
  block: 'block', blocked: 'block', blocker: 'block', 'receptor-blocker': 'block', 'block-receptors': 'block',
  drug: 'block', drugs: 'block', 'drug-action': 'block', inhibit: 'block', inhibition: 'block',
  stop: 'block', 'stop-impulse': 'block', 'stop-the-impulse': 'block', 'prevent-transmission': 'block',
}

function readTarget(raw: unknown): number | null {
  if (raw === undefined) return null
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim()) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

export function releasedOf(state: NerveState | null | undefined): string[] {
  const raw = state?.released
  if (!Array.isArray(raw)) return []
  return VESICLES.filter((id) => raw.includes(id))
}

export function blockedOf(state: NerveState | null | undefined): string[] {
  const raw = state?.blocked
  if (!Array.isArray(raw)) return []
  return RECEPTORS.filter((id) => raw.includes(id))
}

export function firing(config: NerveConfig, state: NerveState): boolean {
  return config.task === 'transmit'
    ? releasedOf(state).length >= config.target
    : RECEPTORS.length - blockedOf(state).length >= config.target
}

const noun = (task: NerveTask) => (task === 'transmit' ? 'vesicles released' : 'receptors left available')
const numberWord = (n: number) => ['no', 'one', 'two', 'three', 'four'][n] ?? String(n)

/** What the learner has made, said back only when marked wrong. */
export function madeText(config: NerveConfig, state: NerveState): string {
  if (config.task === 'transmit') {
    const n = releasedOf(state).length
    if (n === 0) return 'No vesicle has released its neurotransmitter. The electrical impulse does not jump across the gap.'
    return `${numberWord(n)[0].toUpperCase()}${numberWord(n).slice(1)} vesicle${n === 1 ? ' has' : 's have'} released neurotransmitter, but the next neurone is still quiet in this model.`
  }
  const n = blockedOf(state).length
  if (n === 0) return 'No receptor is occupied by the drug. Neurotransmitter can still bind, and the next neurone fires.'
  return `You occupied ${numberWord(n)} receptor${n === 1 ? '' : 's'} with the drug. Enough receptors remain available for the next neurone to fire in this model.`
}

/** The mechanism, and the exact model threshold, after a correct mark or when shown. */
export function working(config: NerveConfig, state: NerveState): string {
  if (config.task === 'transmit') {
    const n = releasedOf(state).length
    return `Yes. ${numberWord(n)[0].toUpperCase()}${numberWord(n).slice(1)} vesicle${n === 1 ? '' : 's'} released neurotransmitter. It diffused across the synaptic gap and bound to receptors, starting a new electrical impulse. This model needs at least ${numberWord(config.target)}.`
  }
  const n = blockedOf(state).length
  return `Yes. The drug occupies ${numberWord(n)} receptor${n === 1 ? '' : 's'}, leaving too few free: this model needs at least ${numberWord(config.target)} free receptor${config.target === 1 ? '' : 's'} to fire. Receptor binding has stopped the new impulse; some drugs act at synapses in this way.`
}

function examplePrompt(config: NerveConfig): string {
  return config.task === 'transmit'
    ? 'An impulse has reached the sending neurone. Tap vesicles to release neurotransmitter and start a new impulse in the receiving neurone.'
    : 'Tap receptors to occupy them with the drug. Stop the new impulse in the receiving neurone.'
}

export const nerveImpulsesEngine: SceneEngine<NerveConfig, NerveState> = {
  id: 'nerve-impulses',
  // Distinctive words only: "nerve" alone also catches dental nerves in unrelated contexts; every broader school
  // wording is a whole phrase. body-flow owns whole-body routes, cell-lab owns membrane diffusion in general.
  covers: ['synapses', 'synaptic', 'neurotransmission', 'neurotransmitters', 'neurones'],
  phrases: [
    'nerve impulses', 'nerve impulse', 'nervous system', 'nerves and neurones', 'sensory neurones', 'relay neurones', 'motor neurones',
    'electrical impulses', 'chemical synapse', 'chemical synapses', 'synaptic transmission', 'synaptic gap', 'synaptic cleft',
    'neurotransmitter release', 'neurotransmitter receptors', 'receptor proteins', 'drugs at synapses', 'drugs and synapses',
    'coordination and response', 'nervous coordination', 'neurone communication', 'neuron communication',
  ],
  notFor: [
    'reflex arc', 'reflex arcs', 'reflex action', 'reflex actions', 'withdrawal reflex', 'knee jerk', 'pupil reflex',
    'central nervous system', 'peripheral nervous system', 'brain and spinal cord', 'voluntary actions', 'involuntary actions',
    'hormones', 'endocrine system', 'endocrine glands', 'plant hormones', 'tropisms', 'phototropism', 'geotropism',
    'heart pacemaker', 'cardiac pacemaker', 'san', 'electric circuits', 'electrical circuits', 'circuit diagrams',
    'diffusion and osmosis', 'gas exchange', 'action potential graph', 'membrane potential', 'sodium potassium pump',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const word = keyOf(first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode']))
    if (!word || !has(TASKS, word)) return null
    const task = TASKS[word]
    const rawTarget = first(src, task === 'transmit'
      ? ['target', 'needed', 'threshold', 'vesicles', 'releases']
      : ['target', 'needed', 'threshold', 'available', 'receptors', 'unblocked'])
    const target = rawTarget === undefined ? (task === 'transmit' ? 2 : 2) : readTarget(rawTarget)
    return target === null ? null : { task, target }
  },

  faults(config) {
    const max = config.task === 'transmit' ? VESICLES.length : RECEPTORS.length
    if (Number.isInteger(config.target) && config.target >= 1 && config.target <= max) return []
    const near = Math.max(1, Math.min(max, Math.round(Number.isFinite(config.target) ? config.target : 2)))
    return [
      `${config.target} is not a possible number of ${noun(config.task)} here: target must be a whole number from 1 to ${max}, e.g. { task: "${config.task}", target: ${near} }.`,
    ]
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = examplePrompt(config)
    const part = config.task === 'transmit' ? '(?:vesicles?|releases?)' : '(?:receptors?|binding|available|unblocked)'
    const count = new RegExp(`\\b(?:\\d+|one|two|three|four|single)\\s+${part}\\b|\\b(?:at least|at most|exactly|minimum|maximum|threshold)\\b`, 'i').test(text)
    if (count) {
      return [`the prompt gives the answer away: it states the model's threshold, which the learner finds by watching the next neurone -- ask for the outcome only ("${example}")`]
    }
    if (/\bdrag|\bslide|\breflex arc|\bsensory neurone|\brelay neurone|\bmotor neurone|\bsodium|\bpotassium|\baction potential graph|\bvoltage|\bcalcium|\bacetylcholine|\badrenaline|\bnamed drug|\breuptake/i.test(text)) {
      return [`the prompt promises something the card does not show: it draws one chemical synapse, vesicles, neurotransmitter, receptors and an unspecified blocking drug -- ask for that ("${example}")`]
    }
    return []
  },

  initial(config) {
    return config.task === 'transmit' ? { released: [] } : { blocked: [] }
  },

  check(config, state) {
    const ok = config.task === 'transmit' ? firing(config, state) : !firing(config, state)
    return { ok, wrongIds: ok ? [] : [config.task === 'transmit' ? 'released' : 'blocked'] }
  },

  solve(config) {
    return config.task === 'transmit'
      ? { released: VESICLES.slice(0, Math.max(0, config.target)) }
      : { blocked: RECEPTORS.slice(0, RECEPTORS.length - config.target + 1) }
  },

  View: NerveImpulsesView,

  prompt: `SCENE "nerve-impulses" -- one large chemical synapse on a quiet light panel: a sending neurone terminal with three real vesicle buttons, a clear synaptic gap, and a receiving neurone with four membrane receptor buttons. An electrical impulse is visible in the sending neurone. Gold neurotransmitter molecules are named on the card. When released they spread across the gap and occupy receptors; enough receptor binding produces a visible new electrical impulse in the receiving neurone. This is a small threshold model, not a universal biological number. Reduced motion shows the same released/bound end states without movement.
  transmit: starts with no neurotransmitter released and the next neurone quiet. Tap vesicles to empty them; each releases three separated gold molecules. Make the receiving neurone start a new impulse. target is the number of vesicles needed, 1 to 3, default 2.
  block: starts with all vesicles released and the next neurone firing. Tap receptors to place a red drug molecule on them (tap again to remove it); bound neurotransmitter moves away. Stop the new impulse. target is how many free receptors the receiving neurone needs to fire, 1 to 4, default 2, so the default needs three of the four receptors blocked. Do not name a real drug: drugs have different mechanisms, and this card models only receptor blocking.
  For: synapses, synaptic transmission, neurotransmitter release, diffusion across the synaptic gap, receptor binding, one-way chemical transmission, electrical-chemical-electrical signalling, and how some drugs act at synapses. It answers "electricity jumps across the gap" and "the same impulse simply continues". Not drawn: the whole reflex arc, sensory/relay/motor routes, CNS/PNS organisation, voluntary actions, ions, voltage graphs, calcium, reuptake, named drugs, hormones or the eye. Use body-flow for tracing whole-body routes.
  Before marking the card shows the observable quiet/firing state, the molecules and receptors, but never the target number. Marking says what was made, or the exact model threshold and why. The prompt must give the tap gesture and ask for the outcome only: do NOT state how many vesicles or receptors, "at least", a threshold, or promise a reflex arc, ion mechanism, voltage graph or named drug.
  config: { "task":"transmit", "target":2 }  -- prompt: "An impulse has reached the sending neurone. Tap vesicles to release neurotransmitter and start a new impulse in the receiving neurone."
       or { "task":"block", "target":2 }  -- prompt: "Tap receptors to occupy them with the drug. Stop the new impulse in the receiving neurone."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"An impulse has reached the sending neurone. Tap vesicles to release neurotransmitter and start a new impulse in the receiving neurone.",
    "payload": { "engine":"nerve-impulses", "config": { "task":"transmit", "target":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:nerve-impulses", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap receptors to occupy them with the drug. Stop the new impulse in the receiving neurone.",
    "payload": { "engine":"nerve-impulses", "config": { "task":"block", "target":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:nerve-impulses", "why":"..." } }`,
}

registerEngine(nerveImpulsesEngine as SceneEngine<unknown, unknown>)
