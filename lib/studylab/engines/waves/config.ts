// lib/studylab/engines/waves/config.ts
//
// Waves on a rope. The learner shakes one end of a rope (how fast, how far) and one big wave answers.
// One orange dot marks a point on the rope: it only goes up and down while the wave goes past.
//
// The physics, all of it exact (integers and one division, never floats in marking):
//   - the rope sets the wave's speed, never the hand: v = 12 m/s on the thin rope, 6 m/s on the thick rope;
//   - shaking f times a second makes waves of length v / f (v = f x wavelength);
//   - the height of the wave is how far the hand moves, and has no effect on the speed;
//   - where the thin rope joins the thick rope, the shaking rate (frequency) carries on unchanged, so the
//     wavelength alone shortens, to 6 / f.
// Ideas taken (not code or art) from PhET "Wave on a String" (frequency and amplitude as two separate
// controls, a marked bead on the string), and the classroom literature on the misconceptions "a bigger wave
// or a faster shake travels faster", "the rope travels along with the wave" and "frequency changes in a new
// medium" (IOP Spark BEST diagnostics "Faster waves"; The Physics Classroom, Characteristics of Sound Waves).
// Amplitude is kept the same across the join for clarity (a real join would also reflect some of the wave).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'

export const TASKS = ['match', 'slow'] as const
export type Task = (typeof TASKS)[number]

export const FREQ_MIN = 1
export const FREQ_MAX = 6
export const AMP_MIN = 1
export const AMP_MAX = 4
/** The slow task keeps the shake small and fixed so the wavelength is the one thing to find. */
export const SLOW_FREQ_MAX = 4
export const SLOW_AMP = 3

export const ROPE_LENGTH = 12 // metres
export const SPEED_THIN = 12 // metres per second
export const SPEED_THICK = 6
export const JOIN = 6 // metres along the rope where the thick rope starts (slow task)

export type WavesConfig =
  | { task: 'match'; frequency: number; amplitude: number }
  | { task: 'slow'; frequency: number }

/** What the learner has set: shakes a second, and how far the hand moves (the slow task ignores `a`). */
export type WavesState = { f?: number; a?: number }

// ---------------------------------------------------------------------------
// Exact arithmetic.

export type Rat = { n: number; d: number }
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
export function rat(n: number, d = 1): Rat {
  const g = gcd(n, d) || 1
  return { n: n / g, d: d / g }
}
export function ratText(r: Rat): string {
  const v = r.n / r.d
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
}
/** The length of one wave, in metres, as an exact fraction. */
export const wavelength = (speed: number, f: number): Rat => rat(speed, f)
/** Compares two exact fractions without division. */
export const cmp = (a: Rat, b: Rat) => Math.sign(a.n * b.d - b.n * a.d)

const isFreq = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= FREQ_MIN && v <= max
const isAmp = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= AMP_MIN && v <= AMP_MAX

/** Where the learner's controls begin: always away from the target, so the scene starts unsolved. */
export function startOf(config: WavesConfig): { f: number; a: number } {
  if (config.task === 'slow') return { f: config.frequency <= 2 ? SLOW_FREQ_MAX : FREQ_MIN, a: SLOW_AMP }
  return { f: config.frequency <= 3 ? 5 : 1, a: config.amplitude <= 2 ? AMP_MAX : AMP_MIN }
}

export function made(state: WavesState, config: WavesConfig): { f: number; a: number } {
  const s = startOf(config)
  const f = isFreq(state?.f, FREQ_MAX) ? (state.f as number) : s.f
  const a = isAmp(state?.a) ? (state.a as number) : s.a
  return config.task === 'slow' ? { f, a: SLOW_AMP } : { f, a }
}

/** The speed of the wave where the learner is matching it. */
export const speedOf = (task: Task) => (task === 'slow' ? SPEED_THICK : SPEED_THIN)

type Cmp = 'longer' | 'shorter' | 'same'
function lengthVs(config: WavesConfig, f: number): Cmp {
  const c = cmp(wavelength(speedOf(config.task), f), wavelength(speedOf(config.task), config.frequency))
  return c > 0 ? 'longer' : c < 0 ? 'shorter' : 'same'
}

/** What a correct card says once marked: the numbers, the rule, and what the dot did. */
export function working(config: WavesConfig): string {
  if (config.task === 'slow') {
    const f = config.frequency
    return `Yes. Both ropes were shaken ${f} ${f === 1 ? 'time' : 'times'} a second, and the orange dots rose and fell at that same rate on both. But the wave goes only ${SPEED_THICK} m each second on the thick rope, so its waves are ${ratText(wavelength(SPEED_THICK, f))} m long (${ratText(wavelength(SPEED_THIN, f))} m on the thin rope): ${SPEED_THICK} = ${f} x ${ratText(wavelength(SPEED_THICK, f))}.`
  }
  const f = config.frequency
  return `Yes. You shook ${f} ${f === 1 ? 'time' : 'times'} a second, so each wave is ${ratText(wavelength(SPEED_THIN, f))} m long. The wave goes ${SPEED_THIN} m each second whatever you do: ${SPEED_THIN} = ${f} x ${ratText(wavelength(SPEED_THIN, f))}. The orange dot only went up and down.`
}

/** What a wrong card says: what the learner made, against the dashed wave, with no number of the answer. */
export function madeText(config: WavesConfig, state: WavesState): string {
  const { f, a } = made(state, config)
  const len = lengthVs(config, f)
  const lengthPart = len === 'same' ? 'the right length' : `${len} than the dashed ones`
  if (config.task === 'slow') {
    return `On the thick rope you made waves ${ratText(wavelength(SPEED_THICK, f))} m long, ${lengthPart}. The orange dots rose and fell at the same rate on both ropes.`
  }
  const hv = a === config.amplitude ? 'the right height' : a > config.amplitude ? 'taller than the dashed ones' : 'lower than the dashed ones'
  return `You made waves ${ratText(wavelength(SPEED_THIN, f))} m long, ${lengthPart}, and ${hv}. The wave went ${SPEED_THIN} m each second all the same.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

function readTask(raw: unknown): Task | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '')
  const alias: Record<string, Task> = {
    match: 'match', make: 'match', 'make-the-wave': 'match', 'make-this-wave': 'match', shake: 'match', rope: 'match', wavelength: 'match',
    'match-the-wave': 'match', 'wave-speed': 'match', 'wave-equation': 'match', 'frequency-and-wavelength': 'match',
    slow: 'slow', slower: 'slow', medium: 'slow', 'new-medium': 'slow', 'slower-medium': 'slow', thick: 'slow', heavy: 'slow',
    'thick-rope': 'slow', 'heavy-rope': 'slow', 'two-ropes': 'slow', refraction: 'slow', 'change-of-medium': 'slow', 'enter-a-slower-medium': 'slow',
  }
  return Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null
}

function readNumber(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*(hz|hertz|m|cm|metres?)$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000 ? v + 0 : null
}
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

export const wavesEngine: SceneEngine<WavesConfig, WavesState> = {
  id: 'waves',
  // Distinctive single words only. "amplitude" alone would catch sine graphs, "frequency" would catch frequency tables,
  // "wave" would catch a heat wave or a microwave, "sound" would catch "sound reasoning": those are phrases below.
  covers: ['wavelength', 'wavelengths', 'ultrasound', 'infrasound'],
  notFor: ['heat waves', 'heat wave', 'ocean', 'coast', 'coastal', 'mexican waves', 'waves of migration'],
  phrases: [
    'waves', 'sound waves', 'wave speed', 'wave motion', 'wave equation', 'wave properties', 'wave model', 'wave behaviour', 'wave behavior',
    'wave frequency', 'wave amplitude', 'transverse waves', 'longitudinal waves', 'frequency and wavelength', 'wavelength and frequency',
    'amplitude and frequency', 'frequency and amplitude', 'speed of sound', 'speed of waves', 'speed of a wave', 'pitch and loudness',
    'loudness and pitch', 'sound and hearing', 'sound and light', 'light and sound', 'sound energy', 'properties of sound', 'properties of waves',
    'characteristics of waves', 'types of waves', 'describing waves', 'sound and music', 'making sound',
  ],
  // The learner varies a magnitude (how fast, how far) and sees what it does to the wave.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const task = readTask(nested ? first(nested, ['kind', 'task']) : o.task)
    if (!task) return null
    const frequency = readNumber(first(src, ['frequency', 'freq', 'hz', 'shakes', 'rate', 'f', 'target']))
    if (frequency === null) return null
    if (task === 'slow') return { task, frequency }
    const amplitude = readNumber(first(src, ['amplitude', 'amp', 'height', 'size', 'distance', 'a']))
    return amplitude === null ? null : { task, frequency, amplitude }
  },

  faults(config) {
    const out: string[] = []
    const max = config.task === 'slow' ? SLOW_FREQ_MAX : FREQ_MAX
    if (!Number.isInteger(config.frequency) || config.frequency < FREQ_MIN || config.frequency > max) {
      const near = Math.max(FREQ_MIN, Math.min(max, Math.round(Number.isFinite(config.frequency) ? config.frequency : 3)))
      out.push(`frequency must be a whole number of shakes a second from ${FREQ_MIN} to ${max}${config.task === 'slow' ? ' (the thick rope\'s waves must stay long enough to draw)' : ''}, e.g. frequency ${near}.`)
    }
    if (config.task === 'match' && (!Number.isInteger(config.amplitude) || config.amplitude < AMP_MIN || config.amplitude > AMP_MAX)) {
      const near = Math.max(AMP_MIN, Math.min(AMP_MAX, Math.round(Number.isFinite(config.amplitude) ? config.amplitude : 2)))
      out.push(`amplitude must be a whole number of metres from ${AMP_MIN} to ${AMP_MAX}, e.g. amplitude ${near}.`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = config.task === 'slow'
      ? 'The rope gets thicker part way along. Shake the end so the wave on the thick part matches the dashed green wave.'
      : 'Shake the end of the rope so the wave matches the dashed green wave.'
    const numbers = /\b\d+(?:\.\d+)?\s*(?:hz|hertz|shakes?|times a second|times per second|per second|a second|m long|metres?|meters?|m\/s|cm)\b/i.test(text)
    const rule = /\bv\s*=\s*f|speed\s*=\s*frequency|frequency\s*(?:x|times|×|\*)\s*wavelength|wave equation/i.test(text)
    const direction = /\b(?:shake|shaking|wave|waves)\b[^.]{0,30}\b(?:faster|slower|harder|gentler|more often|less often|more quickly)\b|\b(?:faster|slower|harder|gentler|more|fewer)\s+(?:shakes|shaking)\b/i.test(text)
    const slowIdea = config.task === 'slow' &&
      /\b(?:slow(?:s|er|ed)?|shorter|squeez\w*|halv\w*|same frequency|frequency (?:stays|is|does|doesn't|remains)|unchanged|bunch\w*|compress\w*)\b/i.test(text)
    return numbers || rule || direction || slowIdea
      ? [`the prompt gives the answer away: it says a number, the rule, which way to change the shaking${config.task === 'slow' ? ', or what the thick rope does to the wave' : ''}, which the learner is to find by shaking -- ask for the outcome only ("${example}")`]
      : []
  },

  initial(config) {
    const s = startOf(config)
    return config.task === 'slow' ? { f: s.f } : { f: s.f, a: s.a }
  },

  check(config, state) {
    const { f, a } = made(state, config)
    const ok = f === config.frequency && (config.task === 'slow' || a === config.amplitude)
    return { ok, wrongIds: ok ? [] : config.task === 'slow' || f !== config.frequency ? ['f'] : ['a'] }
  },

  solve(config) {
    return config.task === 'slow' ? { f: config.frequency } : { f: config.frequency, a: config.amplitude }
  },

  View: null as never, // set below, once the view module has loaded

  prompt: `SCENE "waves" -- waves on a rope. The learner shakes one end of a rope with two round +/- buttons (how fast, how far) and one big wave answers, travelling away from the hand. An orange dot marks one point on the rope with a thin vertical line through it: it only goes up and down while the wave goes past. A dashed green wave is the target. The rope's wave speed never changes with the shaking, so a faster shake squeezes the waves shorter. Before marking there are no numbers, no formula and no words for the answer; marking gives the wavelength, the speed and the rule (speed = shakes a second x wavelength) or says what the learner made against the dashed wave.
  match: make a wave like the dashed green one. Two buttons: how fast (shakes a second, 1 to 6) and how far (height, 1 to 4 m). The learner has to find how fast and how far to shake. Teaches wavelength, frequency, amplitude and v = f x wavelength.
  slow: the rope turns thick half way (the wave goes half as fast there). One button: how fast. The dashed green target is drawn over the thick part only; the learner finds the shaking that makes that wave. Two orange dots, one on each rope, bob at the same rate; the waves are shorter on the thick rope. Teaches that frequency stays the same and wavelength changes when a wave enters a slower medium.
  For: waves, wave speed, frequency, wavelength, amplitude, transverse waves, sound waves as pitch (frequency) and loudness (amplitude), waves entering a new medium.
  match: frequency is a whole number 1 to 6; amplitude is a whole number 1 to 4. slow: frequency is a whole number 1 to 4.
  Not drawn: interference, reflection, longitudinal waves, a sound trace, or amplitude loss. Do not use it for heat waves, microwaves or other things that only share the word.
  config: { "task":"match", "frequency":3, "amplitude":2 }  -- the prompt says "Shake the end of the rope so the wave matches the dashed green wave." (do NOT say faster, slower, a number of shakes, a wavelength or v = f x wavelength)
       or { "task":"slow", "frequency":2 }  -- the prompt says "The rope gets thicker part way along. Shake the end so the wave on the thick part matches the dashed green wave." (do NOT say the wave slows, shortens, or that the frequency stays the same)
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Shake the end of the rope so the wave matches the dashed green wave.",
    "payload": { "engine":"waves", "config": { "task":"match", "frequency":3, "amplitude":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:waves", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The rope gets thicker part way along. Shake the end so the wave on the thick part matches the dashed green wave.",
    "payload": { "engine":"waves", "config": { "task":"slow", "frequency":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:waves", "why":"..." } }`,
}

import { WavesView } from './View'
wavesEngine.View = WavesView

registerEngine(wavesEngine as SceneEngine<unknown, unknown>)
