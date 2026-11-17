// lib/studylab/engines/respiration/config.ts
//
// Respiration made observable in two small, staged experiments:
//   muscle -- choose an exercise pace and advance five seconds at a time. Sprint demand outruns oxygen supply,
//             lactic acid appears, and resting clears it while breathing stays raised. The act is exercise then
//             recovery, not a stopwatch task or a choice between pathway names.
//   yeast  -- add glucose, then advance one minute at a time. Bubbles cross a delivery tube and the limewater
//             clouds, then turns milky. The evidence is drawn; the gas and ethanol are named only when marked.
//
// Sources (research.md has the design notes):
//   NSTA's respiration probe, including Haslam & Treagust's respiration/breathing misconception:
//     https://www.nsta.org/lesson-plan/respiration
//   Cambridge 0610 products, energy comparison and oxygen debt:
//     https://www.savemyexams.com/igcse/biology/cie/23/revision-notes/12-respiration/12-1-respiration/12-1-3-anaerobic-respiration/
//   Carbon dioxide as evidence in a yeast practical, with oil excluding oxygen and limewater as a qualitative test:
//     https://www.savemyexams.com/igcse/biology/edexcel/19/revision-notes/5-use-of-biological-resources/food-production/practical-investigating-anaerobic-respiration-in-yeast/
//   The model is deliberately qualitative. It does not invent ATP counts, gas concentrations or a lactate/fatigue law.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { RespirationView } from './View'

export const VIEW_W = 360
export const VIEW_H = 240
export const MUSCLE_STEP_SECONDS = 5
export const YEAST_STEP_MINUTES = 1
export const MAX_LACTIC = 6
export const MAX_SPOONS = 3
export const MAX_MINUTES = 4

export const PACES = ['rest', 'walk', 'jog', 'sprint'] as const
export type Pace = (typeof PACES)[number]
export type RespirationTask = 'muscle' | 'yeast'
export type RespirationConfig = { task: string }

/** Kept as plain data because stored work may be partial or malformed. */
export type RespirationState = {
  pace?: string
  seconds?: number
  lactic?: number
  sprinted?: boolean
  spoons?: number
  minutes?: number
}

export type MuscleState = { pace: Pace; seconds: number; lactic: number; sprinted: boolean }
export type YeastState = { spoons: number; minutes: number }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const whole = (n: unknown, fallback = 0) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback)
export const isTask = (task: string): task is RespirationTask => task === 'muscle' || task === 'yeast'
export const isPace = (pace: string): pace is Pace => (PACES as readonly string[]).includes(pace)

export function muscleOf(state: RespirationState): MuscleState {
  return {
    pace: typeof state?.pace === 'string' && isPace(state.pace) ? state.pace : 'rest',
    seconds: whole(state?.seconds),
    lactic: clamp(whole(state?.lactic), 0, MAX_LACTIC),
    sprinted: state?.sprinted === true,
  }
}

export function yeastOf(state: RespirationState): YeastState {
  return { spoons: clamp(whole(state?.spoons), 0, MAX_SPOONS), minutes: clamp(whole(state?.minutes), 0, MAX_MINUTES) }
}

/** One labelled, five-second stage. Walking and jogging meet oxygen demand in this simplified model. */
export function advanceMuscle(state: RespirationState): MuscleState {
  const s = muscleOf(state)
  const change = s.pace === 'sprint' ? 2 : s.pace === 'rest' ? -2 : 0
  return {
    ...s,
    seconds: s.seconds + MUSCLE_STEP_SECONDS,
    lactic: clamp(s.lactic + change, 0, MAX_LACTIC),
    sprinted: s.sprinted || s.pace === 'sprint',
  }
}

export function advanceYeast(state: RespirationState): YeastState {
  const s = yeastOf(state)
  return s.spoons === 0 ? s : { ...s, minutes: clamp(s.minutes + YEAST_STEP_MINUTES, 0, MAX_MINUTES) }
}

export function addGlucose(state: RespirationState): YeastState {
  const s = yeastOf(state)
  // Time spent with an empty flask does not count as fermentation time.
  return s.spoons === 0 ? { spoons: 1, minutes: 0 } : { ...s, spoons: clamp(s.spoons + 1, 0, MAX_SPOONS) }
}

export function limeAppearance(state: RespirationState): 'clear' | 'cloudy' | 'milky' {
  const s = yeastOf(state)
  if (s.spoons === 0 || s.minutes === 0) return 'clear'
  return s.minutes === 1 ? 'cloudy' : 'milky'
}

/** A visible supply/demand model, not physiological measurements. */
export function oxygenFor(pace: Pace, recovering = false): { supply: number; demand: number; breathing: string } {
  if (pace === 'sprint') return { supply: 3, demand: 6, breathing: 'Very fast and deep' }
  if (pace === 'jog') return { supply: 4, demand: 4, breathing: 'Fast' }
  if (pace === 'walk') return { supply: 3, demand: 3, breathing: 'Steady' }
  return recovering ? { supply: 4, demand: 2, breathing: 'Deep and fast' } : { supply: 2, demand: 2, breathing: 'Calm' }
}

export function muscleDone(state: RespirationState): boolean {
  const s = muscleOf(state)
  return s.sprinted && s.lactic === 0 && s.pace === 'rest' && s.seconds >= 2 * MUSCLE_STEP_SECONDS
}

export function yeastDone(state: RespirationState): boolean {
  const s = yeastOf(state)
  return s.spoons >= 1 && s.minutes >= 2
}

export function working(config: RespirationConfig): string {
  if (config.task === 'yeast') {
    return 'Yes. The bubbles were carbon dioxide. Yeast respired anaerobically (fermentation): glucose → ethanol + carbon dioxide, releasing a little energy. The gas turned limewater milky; ethanol stayed in the flask. This helps bread rise and makes alcohol in brewing. Yeast needs no lungs to respire.'
  }
  return 'Yes. You exercised, then recovered. Sprinting outran oxygen supply. Anaerobic: glucose → lactic acid, much less energy. Aerobic: glucose + oxygen → carbon dioxide + water. Extra oxygen at rest cleared the acid (oxygen debt), keeping breathing raised. Cells respire; lungs breathe.'
}

export function madeText(config: RespirationConfig, state: RespirationState): string {
  if (config.task === 'yeast') {
    const s = yeastOf(state)
    if (s.spoons === 0) return 'No glucose has been added, so the yeast has no fuel. The limewater is still clear.'
    if (s.minutes === 0) return 'Glucose is in the flask, but no time has passed for bubbles to reach the limewater.'
    if (s.minutes === 1) return 'A few bubbles have arrived and the limewater is only cloudy. Wait another minute for clear evidence.'
    return 'The limewater is milky, so the yeast has produced enough gas for clear evidence.'
  }
  const s = muscleOf(state)
  if (!s.sprinted) return 'You have not made lactic acid yet: at the paces you tried, oxygen supply met the muscle’s demand. Try harder exercise, then allow time to recover.'
  if (s.lactic > 0) return `You made lactic acid, but its level is still ${s.lactic}. Continue the recovery stages until it returns to 0.`
  return 'The lactic acid is cleared. Finish at rest to see the recovery complete.'
}

// ---------------------------------------------------------------------------
// Broad semantic reading. Unknown experiments parse, so faults can offer a working nearby example.

const keyOf = (raw: unknown) => (typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[₂]/g, '2').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)
const has = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key)

const TASK_WORDS: Record<string, RespirationTask> = {
  muscle: 'muscle', muscles: 'muscle', exercise: 'muscle', 'muscle-respiration': 'muscle', 'respiration-and-exercise': 'muscle',
  'exercise-and-recovery': 'muscle', recovery: 'muscle', 'oxygen-debt': 'muscle', 'oxygen-dept': 'muscle', 'lactic-acid': 'muscle',
  anaerobic: 'muscle', 'anaerobic-respiration': 'muscle', 'anaerobic-respiration-in-muscles': 'muscle', athlete: 'muscle', runner: 'muscle',
  respiration: 'muscle', 'cellular-respiration': 'muscle', aerobic: 'muscle', 'aerobic-respiration': 'muscle', 'respiration-is-not-breathing': 'muscle',
  yeast: 'yeast', fermentation: 'yeast', ferment: 'yeast', 'yeast-respiration': 'yeast', 'anaerobic-respiration-in-yeast': 'yeast',
  'yeast-fermentation': 'yeast', brewing: 'yeast', bread: 'yeast', limewater: 'yeast', 'yeast-and-limewater': 'yeast',
}

export function goodPrompt(config: RespirationConfig): string {
  return config.task === 'yeast'
    ? 'Tap Add glucose, then Wait 1 minute. Watch the bubbles and limewater. Get clear evidence that the yeast is respiring.'
    : 'Use the pace buttons and Next 5 seconds. Make lactic acid, then get its reading back to 0.'
}

export const respirationEngine: SceneEngine<RespirationConfig, RespirationState> = {
  id: 'respiration',
  // "Respiration" is distinctive. Every common neighbouring word stays in phrases or notFor.
  covers: ['respiration', 'aerobic respiration', 'anaerobic respiration', 'fermentation'],
  phrases: [
    'oxygen debt', 'oxygen debts', 'yeast respiration', 'respiration and exercise', 'exercise and respiration', 'muscle respiration',
    'respiration in muscles', 'respiration in muscle cells', 'respiration releases energy', 'energy released from glucose',
    'respiration is not breathing', 'respiration versus breathing', 'cellular respiration', 'lactic acid in muscles',
    'alcoholic fermentation', 'yeast and limewater', 'evidence for respiration',
  ],
  notFor: [
    'breathing system', 'mechanics of breathing', 'ventilation rate', 'lungs and gas exchange', 'gas exchange in the lungs',
    'gas exchange surfaces', 'respiratory system', 'heart and circulation', 'blood circulation', 'circulatory system',
    'photosynthesis', 'enzyme rate', 'enzyme activity', 'food tests', 'test for glucose', 'blood glucose control',
    'identification of gases', 'gas tests', 'chemical tests',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type', 'experiment'] : ['task', 'kind', 'type', 'mode', 'experiment'])
    const organism = keyOf(first(src, ['organism', 'cell', 'system']))
    const word = keyOf(rawTask)
    if (rawTask !== undefined && !word) return null
    if (!word && !organism) return null
    const task = has(TASK_WORDS, word) ? TASK_WORDS[word]
      : has(TASK_WORDS, organism) ? TASK_WORDS[organism]
        : word || organism
    return { task }
  },

  faults(config) {
    if (isTask(config.task)) return []
    return [`There is no "${config.task}" respiration experiment drawn here: use task "muscle" for exercise and recovery, or task "yeast" for fermentation and limewater.`]
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'yeast') {
      if (/\banaerobic|\baerobic|\bferment|\bethanol|\balcohol|\bcarbon dioxide\b|\bco2\b|\bco₂\b|\bmilky|\bcloudy|\bturns? (?:white|cloudy)|\bword equation/i.test(text)) {
        out.push(`the prompt gives the pathway or experimental result away, which the learner should discover with the yeast -- ask only for clear evidence ("${example}")`)
      }
      if (/\bdrag\b|\bslide\b|\bheat\b|\btemperature|\bwater bath|\bgas syringe|\bmeasure (?:the )?(?:volume|concentration)|\bwrite (?:an|the) equation|\bdead yeast|\bseeds?\b/i.test(text)) {
        out.push(`the prompt promises something the card does not show: it adds glucose and advances whole minutes, drawing bubbles and limewater -- ask for that ("${example}")`)
      }
    } else {
      if (/\banaerobic|\baerobic|\boxygen debt|\bglucose\s*(?:→|->|to)\s*lactic|\bsprint(?:ing)?\s+(?:makes|produces|causes|builds)|\bsprint(?:ing)?\s+(?:has|lacks|uses)\s+(?:no |enough )?oxygen|\bless energy|\bword equation/i.test(text)) {
        out.push(`the prompt gives the pathway, oxygen debt or the pace's result away, which the learner should discover by exercising -- ask for the outcome only ("${example}")`)
      }
      if (/\bdrag\b|\bslide\b|\bstopwatch|\btime (?:it|yourself)|\bheart rate|\bpulse|\bmeasure (?:the )?oxygen|\bwrite (?:an|the) equation|\bcontinuous|\breal time|\byeast\b|\blimewater\b/i.test(text)) {
        out.push(`the prompt promises something the card does not show: it uses pace buttons and labelled five-second stages -- ask for that ("${example}")`)
      }
    }
    return out
  },

  initial(config) {
    return config.task === 'yeast' ? { spoons: 0, minutes: 0 } : { pace: 'rest', seconds: 0, lactic: 0, sprinted: false }
  },

  check(config, state) {
    if (!isTask(config.task)) return { ok: false, wrongIds: ['task'] }
    const ok = config.task === 'yeast' ? yeastDone(state) : muscleDone(state)
    return { ok, wrongIds: ok ? [] : [config.task] }
  },

  solve(config) {
    return config.task === 'yeast'
      ? { spoons: 1, minutes: 2 }
      : { pace: 'rest', seconds: 10, lactic: 0, sprinted: true }
  },

  View: RespirationView,

  prompt: `SCENE "respiration" -- respiration made visible in one of two small, staged experiments on a quiet light panel.
  muscle: a runner with a close-up of a muscle cell and the blood supplying it. Use − and + to choose Rest, Walk, Jog or Sprint, then tap Next 5 seconds. Each tap is one labelled still/animated stage, never a stopwatch challenge. Sprint visibly outruns oxygen supply and adds lactic acid; walking and jogging meet demand; resting removes lactic acid in stages while breathing stays raised. A named lactic-acid meter and breathing readout answer every move. The goal is to make lactic acid, then return its reading to 0 at rest. Reduced motion shows the same stages as still frames.
  yeast: a conical flask of yeast in warm water with an oil layer, a stopper and a real delivery tube leading into limewater. Tap Add glucose (up to three spoons), then Wait 1 minute. One minute gives bubbles and cloudy limewater; two or more give an unmistakable milky result. Fresh mixture starts again. Glucose spoons and elapsed minutes are shown. The goal is clear evidence of yeast respiration, not gas identification. Reduced motion shows each stage as a still.
  For: respiration as energy release in living cells rather than breathing; aerobic versus anaerobic respiration; muscle lactic acid and recovery/oxygen debt; yeast fermentation and carbon-dioxide evidence; bread and brewing. Not for the breathing system, lungs/gas exchange, circulation, photosynthesis, enzyme temperature optima, food tests, generic gas identification, or seed experiments.
  Before marking both cards show the goal, apparatus/body, controls and live observations. Neither names aerobic or anaerobic respiration, oxygen debt, ethanol, carbon dioxide or a word equation. Marking gives the appropriate word equation, energy comparison and cell-versus-breathing explanation. The prompt must say the gesture and operational goal, never the pathway or result.
  config: { "task":"muscle" }  -- the prompt says "${goodPrompt({ task: 'muscle' })}"
       or { "task":"yeast" }  -- the prompt says "${goodPrompt({ task: 'yeast' })}"
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'muscle' })}",
    "payload": { "engine":"respiration", "config": { "task":"muscle" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:respiration", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${goodPrompt({ task: 'yeast' })}",
    "payload": { "engine":"respiration", "config": { "task":"yeast" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:respiration", "why":"..." } }`,
}

registerEngine(respirationEngine as SceneEngine<unknown, unknown>)
