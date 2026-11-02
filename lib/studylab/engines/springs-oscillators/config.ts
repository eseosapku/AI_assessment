// lib/studylab/engines/springs-oscillators/config.ts
//
// A spring hanging from a bar, and bold weights stacking below it.
// The learner taps round + and − buttons to add or remove unit masses.
// Each mass stretches the spring by the same amount, and a dashed target
// line shows where the bottom of the weight stack must reach.
//
// The physics:
//   F = kx (Hooke's law). Each mass weighs 1 N. Extension per mass = 1/k cm.
//   The learner adds masses until the weight stack reaches the target line.
//   Source: standard GCSE/IGCSE Hooke's law practical (retort stand, spring, masses).
//
// Ideas taken, never code or art:
//   - PhET Masses and Springs: hanging discrete weights on a spring and watching
//     it extend is the core interaction. Each mass adds the same extension.
//     The damped bounce on each change mimics what happens on a real retort stand.
//   - Wikipedia, Hooke's law: F = kx, the proportional region. The linear
//     relationship between force and extension is the whole idea.
//   - Wikipedia, Simple harmonic motion: T = 2π√(m/k), period independent
//     of amplitude — the biggest student misconception. Left for a later version
//     because matching frequencies visually is frustrating (osmosis-card problems).
//
// What I refused, and why:
//   - Oscillation/period as a task kind: needs continuous time-dependent animation,
//     and the learner cannot match a frequency by eye. Left for a second pass.
//   - Elastic limit: adds a break in the drawing without a clean single interaction.
//   - Two springs side by side: breaks the brief's "one thing to handle."
//   - Energy stored in a spring: requires area under the graph, not a direct act.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SpringsView } from './View'

export const MASS_WEIGHT = 1
export const MAX_MASSES = 8
export const MIN_ANSWER = 2

export type SpringsConfig = {
  k: number
  extension: number
}

export type SpringsState = {
  masses: number
}

export const answerMasses = (c: SpringsConfig) => Math.round(c.k * c.extension / MASS_WEIGHT)

export const extensionFor = (k: number, masses: number) => masses * MASS_WEIGHT / k

export const fmt = (v: number): string => {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

export function working(c: SpringsConfig, s: SpringsState): string {
  const n = s.masses
  const ext = extensionFor(c.k, n)
  const force = n * MASS_WEIGHT
  const per = fmt(extensionFor(c.k, 1))
  return `Yes. ${n} weight${n === 1 ? '' : 's'} × ${MASS_WEIGHT} N = ${force} N. ` +
    `The spring stretched ${fmt(ext)} cm: each weight added the same ${per} cm. ` +
    `F = kx, so ${force} = ${fmt(c.k)} × ${fmt(ext)}.`
}

export function madeText(c: SpringsConfig, s: SpringsState): string {
  const n = s.masses
  if (n === 0) return 'You hung no weights. The spring is at rest.'
  const ext = extensionFor(c.k, n)
  const force = n * MASS_WEIGHT
  const gap = fmt(Math.abs(ext - c.extension))
  const dir = ext < c.extension ? 'short of' : 'past'
  return `You hung ${n} weight${n === 1 ? '' : 's'}, pulling ${force} N. ` +
    `The spring stretched ${fmt(ext)} cm: ${gap} cm ${dir} the target.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const STIFFNESS: Record<string, number> = {
  'very soft': 0.5, 'very-soft': 0.5,
  soft: 1, loose: 1, weak: 1,
  medium: 2, normal: 2, standard: 2,
  stiff: 3, firm: 3, strong: 3,
  'very stiff': 4, 'very-stiff': 4, hard: 4,
}

function readK(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const key = raw.trim().toLowerCase().replace(/\s+/g, ' ')
    if (Object.prototype.hasOwnProperty.call(STIFFNESS, key)) return STIFFNESS[key]
    const n = Number(key.replace(/\s*(n\/?cm|n\/?m|n per cm|newtons? per (?:centi)?met(?:re|er))$/i, ''))
    return Number.isFinite(n) && n > 0 && n <= 100 ? n : null
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw <= 100) return raw
  return null
}

function readExtension(raw: unknown): number | null {
  if (typeof raw === 'string') {
    const n = Number(raw.trim().replace(/\s*(cm|units?|centimetre|centimeter)s?$/i, ''))
    return Number.isFinite(n) && n > 0 && n <= 100 ? n : null
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 && raw <= 100) return raw
  return null
}

const pick = (o: Record<string, unknown>, keys: string[]) =>
  keys.map((k) => o[k]).find((v) => v !== undefined)

function nearExample(k: number, extension: number): number {
  const masses = k * extension / MASS_WEIGHT
  const clamped = Math.max(MIN_ANSWER, Math.min(MAX_MASSES, Math.round(masses)))
  return clamped * MASS_WEIGHT / k
}

export const springsEngine: SceneEngine<SpringsConfig, SpringsState> = {
  id: 'springs-oscillators',

  covers: ["Hooke's law"],
  phrases: [
    'springs', 'spring constant', 'spring balance', 'spring balances',
    'force and extension', 'extension and force',
    'elastic deformation', 'elasticity', 'elastic behaviour', 'elastic behavior',
    'oscillation', 'oscillations', 'simple harmonic motion',
    'mass on a spring', 'mass-spring system',
  ],
  notFor: [
    'hot springs', 'spring water', 'spring season', 'spring equinox',
    'spring tide', 'spring tides', 'oscillating reactions',
    'chemical oscillations', 'oscillating universe',
    'parallel springs', 'series springs', 'parallel and series',
  ],

  isolates: 'quantity',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawK = pick(o, ['k', 'stiffness', 'spring_constant', 'springConstant', 'constant'])
    const k = rawK === undefined ? 2 : readK(rawK)
    if (k === null) return null
    const rawExt = pick(o, ['extension', 'stretch', 'target', 'length', 'x', 'displacement'])
    const extension = rawExt === undefined ? 3 : readExtension(rawExt)
    if (extension === null) return null
    return { k, extension }
  },

  faults(config) {
    const masses = config.k * config.extension / MASS_WEIGHT
    const rounded = Math.round(masses)
    if (Math.abs(masses - rounded) > 0.01) {
      const eg = nearExample(config.k, config.extension)
      const n = answerMasses({ k: config.k, extension: eg })
      return [`With k = ${fmt(config.k)} and extension ${fmt(config.extension)}, the learner needs ${fmt(masses)} masses, which is not whole: use e.g. extension ${fmt(eg)} (${n} masses).`]
    }
    if (rounded < MIN_ANSWER) {
      const eg = MIN_ANSWER * MASS_WEIGHT / config.k
      return [`Extension ${fmt(config.extension)} with k = ${fmt(config.k)} needs only ${rounded} mass: with just one there is nothing to compare. Use at least extension ${fmt(eg)} (${MIN_ANSWER} masses).`]
    }
    if (rounded > MAX_MASSES) {
      const eg = MAX_MASSES * MASS_WEIGHT / config.k
      return [`Extension ${fmt(config.extension)} with k = ${fmt(config.k)} needs ${rounded} masses, but the spring holds at most ${MAX_MASSES}: use e.g. extension ${fmt(eg)} (${MAX_MASSES} masses).`]
    }
    return []
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const answer = answerMasses(config)
    const gives = /\bF\s*=\s*k\s*[x×]\b|\bkx\b|\bHooke/i.test(text)
      || /\bproportional/i.test(text)
      || /\bspring constant\b/i.test(text)
      || new RegExp(`\\b${answer}\\s*(masses|mass|weights?|blocks?)`, 'i').test(text)
      || /\b\d+\s*(?:N\b|newton|cm\b|centi)/i.test(text)
      || /\badd\s+\d|\bremove\s+\d|\bhang\s+\d/i.test(text)
    if (gives) {
      return ['the prompt gives the answer away: it names a count, a force, a distance, or the rule -- ask for the outcome only ("Hang weights on the spring by its round buttons until it stretches to the dashed line.")']
    }
    return []
  },

  initial() {
    return { masses: 0 }
  },

  check(config, state) {
    const n = typeof state?.masses === 'number' && Number.isInteger(state.masses) && state.masses >= 0 && state.masses <= MAX_MASSES
      ? state.masses : -1
    return { ok: n === answerMasses(config), wrongIds: [] }
  },

  solve(config) {
    return { masses: answerMasses(config) }
  },

  View: SpringsView,

  prompt: `SCENE "springs-oscillators" -- a vertical spring hanging from a bar on a dark stage, with bold orange weight blocks stacking below it and round + and − buttons on either side. The learner taps + to hang a unit mass and − to remove one. Each mass stretches the spring by the same amount (Hooke's law: F = kx), and a dashed target line shows where the bottom of the weight stack must reach. The spring bounces briefly on each change, then settles. There are no force, extension or spring-constant values on the card before marking; marking gives the force, the extension and F = kx.
For: Hooke's law, springs, spring constant, force and extension, elasticity, elastic deformation.
config: { "k": <spring constant in N/cm>, "extension": <target extension in cm> }. k × extension must be a whole number from 2 to 8 (the number of unit masses needed). k may also be named: "soft" (1), "medium" (2), "stiff" (3).
  e.g. { "k": 2, "extension": 3 } — 6 masses (6 N stretches a 2 N/cm spring 3 cm).
  e.g. { "k": 1, "extension": 5 } — 5 masses (5 N stretches a 1 N/cm spring 5 cm).
  e.g. { "k": 0.5, "extension": 8 } — 4 masses (4 N stretches a 0.5 N/cm spring 8 cm).
Not drawn: oscillation, period, elastic limit, parallel or series springs, energy stored in a spring. Do not use it for spring tides, spring seasons, hot springs, or oscillating chemical reactions.
Before marking the card shows only the spring stretching, the orange weight blocks, the target line, the round buttons and two short labels (spring, target). It holds back every number. The prompt must ask for the outcome only: do NOT name the force, the number of masses, the extension, the spring constant, F = kx, or say "Hooke's law" or "proportional".
config: { "k": 2, "extension": 3 } -- the prompt says "Hang weights on the spring by its round buttons until it stretches to the dashed line."
{ "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Hang weights on the spring by its round buttons until it stretches to the dashed line.",
  "payload": { "engine":"springs-oscillators", "config": { "k": 2, "extension": 3 } },
  "success": { "kind":"scene" } }, "intent": { "goal":"show how a spring's extension depends on the number of weights hung from it", "isolates":"quantity", "apparatus":"scene:springs-oscillators", "why":"this is Hooke's law seen as a thing the learner does, not a formula to memorise" } }`,
}

registerEngine(springsEngine as SceneEngine<unknown, unknown>)
