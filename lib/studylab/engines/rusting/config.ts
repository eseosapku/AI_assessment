// lib/studylab/engines/rusting/config.ts
//
// "Leave it a week" (see .superpowers/bakeoff/rusting/design.md).
// A real nail stands in a boiling tube. The student sets what reaches it (water, air) or how it is protected
// (paint, grease, zinc, a magnesium strip, scratched or not), presses Leave for a week, and the nail answers:
// rust appears only where water AND air both reach bare iron.
//   needs   -- set the water and the air to meet a goal (rust it, keep it shiny with water, keep it shiny with air, rust it most);
//   protect -- choose a protection and a scratch to meet a goal (still works after a scratch, works only until scratched, no rust).
//
// Rules are computed here and never read from the drawing.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { RustingView } from './View'

export type Water = 'none' | 'tap' | 'salt'
export type Air = 'in' | 'out'
export type Protection = 'none' | 'paint' | 'grease' | 'zinc' | 'magnesium'
export type RustAt = 'everywhere' | 'scratch' | 'nowhere'

/** A task as the tutor may write it: read broadly, then refused by faults when it cannot be drawn. */
export type RustConfig =
  | { kind: 'needs'; goal: string; salt?: boolean }
  | { kind: 'protect'; goal: string; options?: string[] }
  /** Read but not drawn: faults refuses it. */
  | { kind: 'other'; asked: string }

export type RustState = { water: Water; air: Air; protection: Protection; scratched: boolean; left: boolean }

export const WEEK = 7
export const NEEDS_GOALS = ['rust', 'shinyWet', 'shinyAir', 'rustMost']
export const PROTECT_GOALS = ['scratchProof', 'untilScratched', 'keepShiny']
export const PROTECTIONS: Protection[] = ['none', 'paint', 'grease', 'zinc', 'magnesium']
export const DEFAULT_OPTIONS: Protection[] = ['none', 'paint', 'zinc', 'magnesium']

const isWater = (v: unknown): v is Water => v === 'none' || v === 'tap' || v === 'salt'
const isAir = (v: unknown): v is Air => v === 'in' || v === 'out'
const isProtection = (v: unknown): v is Protection => PROTECTIONS.includes(v as Protection)
const reactive = (p: Protection) => p === 'zinc' || p === 'magnesium'
const barrier = (p: Protection) => p === 'paint' || p === 'grease'

/** The options offered, for a config that has passed faults. */
export function optionsOf(config: RustConfig): Protection[] {
  return config.kind === 'protect' && config.options ? (config.options as Protection[]) : DEFAULT_OPTIONS
}

/** The state, read safely: anything corrupt reads as a fresh nail in tap water, open to the air. */
export function readState(state: Partial<RustState> | null | undefined): RustState {
  const s = state ?? {}
  return {
    water: isWater(s.water) ? s.water : 'tap',
    air: isAir(s.air) ? s.air : 'in',
    protection: isProtection(s.protection) ? s.protection : 'none',
    scratched: s.scratched === true,
    left: s.left === true,
  }
}

/** Where rust shows after a week. Rust needs water, air and bare iron; a barrier fails at a scratch; zinc and magnesium corrode instead. */
export function rustAt(state: Partial<RustState> | null | undefined): RustAt {
  const s = readState(state)
  if (s.water === 'none' || s.air === 'out') return 'nowhere'
  if (s.protection === 'none') return 'everywhere'
  if (barrier(s.protection)) return s.scratched ? 'scratch' : 'nowhere'
  return 'nowhere'
}

export type Reason = 'not-left' | 'not-scratched' | 'right' | 'wrong'

/** Why the state is or is not a pass. 'not-left' and 'not-scratched' are not wrong answers: the test has not been run. */
export function reasonOf(config: RustConfig, state: Partial<RustState> | null | undefined): Reason {
  const s = readState(state)
  if (config.kind === 'other' || faults(config).length) return 'wrong'
  if (!s.left) return 'not-left'
  if (config.kind === 'needs') {
    if (config.goal === 'rust') return s.water !== 'none' && s.air === 'in' ? 'right' : 'wrong'
    if (config.goal === 'shinyWet') return s.water !== 'none' && s.air === 'out' ? 'right' : 'wrong'
    if (config.goal === 'shinyAir') return s.water === 'none' && s.air === 'in' ? 'right' : 'wrong'
    return s.water === 'salt' && s.air === 'in' ? 'right' : 'wrong'
  }
  if (config.goal === 'scratchProof') {
    if (!s.scratched) return 'not-scratched'
    return reactive(s.protection) ? 'right' : 'wrong'
  }
  if (config.goal === 'untilScratched') {
    if (!s.scratched && barrier(s.protection)) return 'not-scratched'
    return s.scratched && barrier(s.protection) ? 'right' : 'wrong'
  }
  return rustAt(s) === 'nowhere' ? 'right' : 'wrong'
}

export function done(config: RustConfig, state: Partial<RustState> | null | undefined): boolean {
  return reasonOf(config, state) === 'right'
}

// ---------------------------------------------------------------------------
// Words on the card. Before marking, only observations; never right or wrong.

export function goalText(config: RustConfig): string {
  if (config.kind === 'other') return ''
  switch (config.goal) {
    case 'rust': return 'Make the nail rust'
    case 'shinyWet': return 'Keep it shiny, with water in the tube'
    case 'shinyAir': return 'Keep it shiny, with air in the tube'
    case 'rustMost': return 'Rust it as much as you can'
    case 'scratchProof': return 'No rust, even when scratched'
    case 'untilScratched': return 'Protect it, but only until it is scratched'
    default: return 'No rust after a week'
  }
}

/** The live "Rust:" readout: what is on the nail on this day. */
export function readoutText(state: Partial<RustState> | null | undefined, day: number): string {
  const s = readState(state)
  if (!s.left) return 'Not left yet'
  const where = rustAt(s)
  if (where === 'nowhere') return day >= WEEK ? 'None' : 'None yet'
  if (day < (where === 'scratch' ? 2 : 1.5)) return 'None yet'
  if (where === 'scratch') return 'At the scratch'
  return day >= WEEK ? 'All over' : 'Spots'
}

const protectionName = (p: Protection) => (p === 'none' ? 'no protection' : p === 'zinc' ? 'a zinc coat' : p === 'magnesium' ? 'a magnesium strip wrapped round it' : `a coat of ${p}`)

/** The caption under the picture: the set-up before the week, what is visible once it has passed. */
export function captionText(config: RustConfig, state: Partial<RustState> | null | undefined, day: number): string {
  const s = readState(state)
  if (config.kind === 'other') return ''
  if (s.left && day >= WEEK) {
    const where = rustAt(s)
    if (where === 'everywhere') return 'After a week: rust all over the nail, with flakes of rust on the bottom of the tube.'
    if (where === 'scratch') return 'After a week: no rust except at the scratch, where it is creeping in under the coat.'
    if (s.protection === 'zinc') {
      return s.scratched
        ? 'After a week: no rust. The zinc around the scratch has turned white, and the scratch itself is still grey.'
        : 'After a week: no rust. A few white specks have formed on the zinc.'
    }
    if (s.protection === 'magnesium') return 'After a week: no rust. The magnesium strip is thinner and crusted white.'
    return 'After a week: no change to the nail.'
  }
  if (s.left) return `A week is passing: day ${Math.min(WEEK, Math.max(0, Math.round(day)))} of ${WEEK}.`
  if (config.kind === 'protect') {
    return `The nail has ${protectionName(s.protection)}${s.scratched ? ' and a scratch that goes through to the iron' : ''}, in tap water and open to the air.${s.scratched ? '' : ' A scratch would go through to the iron.'}`
  }
  const w = s.water === 'salt' ? 'salt water' : 'tap water'
  if (s.water !== 'none' && s.air === 'in') return `The nail sits in ${w}, open to the air.`
  if (s.water !== 'none') return `The nail sits in boiled ${s.water === 'salt' ? 'salt ' : ''}water: boiling drove out the dissolved air, and a layer of oil stops it coming back.`
  if (s.air === 'in') return 'The nail sits on cotton wool over a drying agent, which soaks up water from the air. The stopper keeps damp room air out.'
  return 'The nail is sunk in oil.'
}

/** What a marked card says. Right says why; wrong says what was missing or what failed. */
export function verdictText(config: RustConfig, state: Partial<RustState> | null | undefined): string {
  const s = readState(state)
  if (config.kind === 'other') return ''
  const reason = reasonOf(config, s)
  if (reason === 'not-left') return 'The nail has not been left yet. Press Leave for a week first.'
  if (reason === 'not-scratched') return 'This goal is about a scratch. Scratch the nail, leave it for a week and test again.'
  const ok = reason === 'right'
  const p = s.protection
  if (config.kind === 'needs') {
    if (config.goal === 'rust') {
      if (ok) return 'Rust needs water and air (oxygen) together, and both reached the iron.'
      if (s.water === 'none' && s.air === 'out') return 'There was no water and no air, so the nail did not rust. It needs both.'
      return s.water === 'none' ? 'There was no water, so the nail did not rust. It needs water and air.' : 'No air reached the nail, so it did not rust. It needs water and air.'
    }
    if (config.goal === 'shinyWet') {
      if (ok) return 'There was water, but no air (oxygen) reached the nail, so it stayed shiny. Rust needs both.'
      return s.water === 'none' ? 'There was no water in the tube, so this misses the goal.' : 'Air reached the nail as well as the water, so it rusted.'
    }
    if (config.goal === 'shinyAir') {
      if (ok) return 'Air reached the nail, but there was no water, so it stayed shiny. Rust needs both.'
      return s.water !== 'none' ? 'There was water as well as air, so the nail rusted.' : 'No air reached the nail, so this misses the goal of keeping air in the tube.'
    }
    if (ok) return 'Salt in the water speeds rusting up, so this nail rusted more than it would in tap water.'
    if (s.water === 'none') return 'There was no water, so the nail did not rust.'
    if (s.air === 'out') return 'No air reached the nail, so it did not rust.'
    return 'It rusted, but not as much as it can: salt in the water would make it rust faster.'
  }
  if (config.goal === 'scratchProof') {
    if (ok) {
      return p === 'zinc'
        ? 'Zinc is more reactive than iron, so it corrodes instead of the iron, even at a scratch. This is how galvanising protects steel.'
        : 'Magnesium is more reactive than iron, so it corrodes instead of the iron, even where it does not cover it. This is sacrificial protection.'
    }
    return p === 'none' ? 'A bare nail has no protection, so it rusted.' : 'The coat is only a barrier: water and air got in at the scratch, so rust started there.'
  }
  if (config.goal === 'untilScratched') {
    if (ok) return 'A coat is a barrier: it works only while it is whole. At the scratch, water and air reached the iron and it rusted.'
    if (p === 'none') return 'A bare nail has no protection to lose.'
    return `${p === 'zinc' ? 'Zinc' : 'Magnesium'} is more reactive than iron, so it kept working after the scratch. A barrier would have stopped.`
  }
  if (ok) {
    return barrier(p)
      ? 'The coat kept water and air off the iron, so there was no rust. It works only while it is whole.'
      : 'The zinc or magnesium is more reactive than iron, so it corrodes instead and the iron stays shiny.'
  }
  if (p === 'none') return 'A bare nail has no protection, so it rusted.'
  return 'The scratch let water and air through the coat, so rust started there.'
}

/** For the screen reader: the set-up, not whether it is right. */
export function describe(state: Partial<RustState> | null | undefined): string {
  const s = readState(state)
  const where = s.water === 'none' ? (s.air === 'in' ? 'in dry air' : 'in oil') : `in ${s.water === 'salt' ? 'salt' : 'tap'} water, ${s.air === 'in' ? 'open to the air' : 'boiled, under oil'}`
  const prot = s.protection === 'none' ? '' : s.protection === 'magnesium' ? ', with a magnesium strip wrapped round it' : `, coated with ${s.protection}`
  return `A nail ${where}${prot}${s.scratched ? ', scratched' : ''}${s.left ? ', left for a week' : ''}.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const compact = (raw: unknown) => keyOf(raw).replace(/-/g, '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '')
const hasWord = (key: string, words: string[]) => key.split('-').some((w) => words.includes(w))

function readGoal(raw: unknown): string {
  const c = compact(raw)
  const map: Record<string, string> = {
    rust: 'rust', makeitrust: 'rust', makerust: 'rust', rusting: 'rust',
    shinywet: 'shinyWet', shinywithwater: 'shinyWet', keepshinywet: 'shinyWet',
    shinyair: 'shinyAir', shinywithair: 'shinyAir', keepshinyair: 'shinyAir',
    rustmost: 'rustMost', mostrust: 'rustMost', rustfastest: 'rustMost', fastestrust: 'rustMost',
    scratchproof: 'scratchProof', afterscratch: 'scratchProof', survivesscratch: 'scratchProof',
    untilscratched: 'untilScratched', onlyuntilscratched: 'untilScratched', barrier: 'untilScratched',
    keepshiny: 'keepShiny', norust: 'keepShiny', shiny: 'keepShiny',
  }
  return map[c] ?? (typeof raw === 'string' ? raw.trim() : String(raw))
}
function readProtection(raw: unknown): string {
  const key = keyOf(raw)
  if (hasWord(key, ['none', 'nothing', 'bare', 'unprotected'])) return 'none'
  if (hasWord(key, ['paint', 'painted', 'painting'])) return 'paint'
  if (hasWord(key, ['grease', 'greased', 'greasing', 'oil', 'oiled'])) return 'grease'
  if (hasWord(key, ['zinc', 'galvanised', 'galvanized', 'galvanising', 'galvanizing'])) return 'zinc'
  if (hasWord(key, ['magnesium', 'mg'])) return 'magnesium'
  return typeof raw === 'string' ? raw.trim() : String(raw)
}

const EXAMPLE_RUST = '{ "kind":"needs", "goal":"rust" }'
const EXAMPLE_SCRATCH = '{ "kind":"protect", "goal":"scratchProof" }'
const EXAMPLE_MOST = '{ "kind":"needs", "goal":"rustMost", "salt":true }'
const EXAMPLE_KEEP = '{ "kind":"protect", "goal":"keepShiny" }'

function faults(config: RustConfig): string[] {
  if (config.kind === 'other') {
    return [`Only two tasks are built: set what reaches the nail (${EXAMPLE_RUST}) and choose how it is protected (${EXAMPLE_SCRATCH}), not "${config.asked}". Use ${EXAMPLE_RUST}.`]
  }
  if (config.kind === 'needs') {
    if (!NEEDS_GOALS.includes(config.goal)) return [`The goal for "needs" is rust, shinyWet, shinyAir or rustMost, not "${config.goal}": use ${EXAMPLE_RUST}.`]
    if (config.goal === 'rustMost' && config.salt !== true) return [`"rustMost" needs the salt water offered, or there is only tap water to choose: add "salt":true, e.g. ${EXAMPLE_MOST}.`]
    return []
  }
  const out: string[] = []
  if (!PROTECT_GOALS.includes(config.goal)) return [`The goal for "protect" is scratchProof, untilScratched or keepShiny, not "${config.goal}": use ${EXAMPLE_SCRATCH}.`]
  const o = config.options
  if (o !== undefined) {
    const known = o.every((x) => isProtection(x))
    if (!Array.isArray(o) || o.length < 2 || o.length > 4 || new Set(o).size !== o.length || !known) {
      return [`"options" is two to four different protections from none, paint, grease, zinc and magnesium (or leave it out for ${JSON.stringify(DEFAULT_OPTIONS)}): use ${EXAMPLE_SCRATCH}.`]
    }
  }
  const opts = o === undefined ? DEFAULT_OPTIONS : (o as Protection[])
  if (config.goal === 'scratchProof') {
    if (!opts.some(reactive)) out.push(`"scratchProof" needs "zinc" or "magnesium" among the options, or nothing can pass: add one, e.g. ${EXAMPLE_SCRATCH}.`)
    else if (!opts.some((p) => !reactive(p))) out.push(`Every option would pass "scratchProof", so there is nothing to choose between: add "paint" to the options, e.g. ${EXAMPLE_SCRATCH}.`)
  } else if (config.goal === 'untilScratched') {
    if (!opts.some(barrier)) out.push(`"untilScratched" needs "paint" or "grease" among the options, or nothing can pass: add one, e.g. { "kind":"protect", "goal":"untilScratched" }.`)
    else if (!opts.some((p) => !barrier(p))) out.push(`Every option is a barrier, so there is nothing to choose between: add "zinc" to the options, e.g. { "kind":"protect", "goal":"untilScratched" }.`)
  } else if (!opts.some((p) => !reactive(p)) || !opts.some((p) => p !== 'none')) {
    out.push(`No option can fail "keepShiny", so there is nothing to choose between: add "paint" to the options, e.g. ${EXAMPLE_KEEP}.`)
  }
  return out
}

// ---------------------------------------------------------------------------
// Prompts.

const TELLS: Record<string, RegExp[]> = {
  rust: [/\bwater and (?:the )?air\b/i, /\bair and (?:the )?water\b/i, /\bwater and oxygen\b/i, /\boxygen and water\b/i, /\bopen to the air\b/i, /\btap water\b/i],
  shinyWet: [/\boil\b/i, /\bboil/i, /\bno air\b/i, /\bwithout air\b/i, /\bair out\b/i, /\bkeep the air\b/i, /\boxygen out\b/i],
  shinyAir: [/\bdry\b/i, /\bdrying agent\b/i, /\bcalcium chloride\b/i, /\bno water\b/i, /\bwithout water\b/i, /\bwater out\b/i, /\bstopper\b/i],
  rustMost: [/\bsalt/i, /\bsea\b/i, /\bbrine\b/i],
  scratchProof: [/\bzinc\b/i, /\bmagnesium\b/i, /\bgalvan/i, /\bsacrificial\b/i, /\bmore reactive\b/i, /\bcorrodes instead\b/i],
  untilScratched: [/\bpaint/i, /\bgrease/i, /\boil\b/i, /\bbarrier/i],
}

function promptFaults(config: RustConfig, prompt: string): string[] {
  if (config.kind === 'other') return []
  const text = prompt.replace(/\s+/g, ' ')
  const found = (TELLS[config.goal] ?? []).map((r) => text.match(r)?.[0]).filter((w): w is string => !!w)
  return found.length
    ? [`the prompt gives the answer away with ${found.map((w) => `"${w}"`).join(', ')}: say only the situation and the gesture, e.g. "${EXAMPLES[0].prompt}"`]
    : []
}

export const EXAMPLES: { prompt: string; config: RustConfig }[] = [
  { prompt: 'Use the buttons to set up a tube where this nail will rust, then leave it for a week.', config: { kind: 'needs', goal: 'rust' } },
  { prompt: 'Keep water in the tube, but stop the nail rusting. Change what reaches it, then leave it for a week.', config: { kind: 'needs', goal: 'shinyWet' } },
  { prompt: 'Make the nail rust as much as it can in one week. Choose the water and the air, then leave it.', config: { kind: 'needs', goal: 'rustMost', salt: true } },
  { prompt: 'Pick a protection, scratch the nail, and leave it in water for a week. Find one that still stops the iron rusting.', config: { kind: 'protect', goal: 'scratchProof' } },
]

const catalogue = EXAMPLES.map((e, i) => `  ${i === 0 ? '   ' : 'or '}${JSON.stringify(e.config)}  -- the prompt says "${e.prompt}"`).join('\n')

export const rustingEngine: SceneEngine<RustConfig, RustState> = {
  id: 'rusting',
  covers: ['rusting', 'rust', 'corrosion', 'galvanising', 'galvanizing', 'galvanised', 'galvanized'],
  phrases: [
    'conditions for rusting', 'preventing rusting', 'prevention of rusting', 'rust prevention', 'corrosion of iron', 'corrosion of metals', 'preventing corrosion',
    'sacrificial protection', 'sacrificial metal', 'sacrificial anode', 'barrier methods', 'barrier protection', 'zinc coating',
  ],
  notFor: [
    'reactivity series', 'displacement reactions', 'alloys', 'stainless steel', 'properties of alloys', 'electrolysis', 'electroplating', 'rates of reaction', 'rate of reaction',
    'corrosive substances', 'hazard symbols', 'plant rust', 'rust fungus', 'rust programming language',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawKind = first(o, ['kind', 'task', 'type', 'mode'])
    const rawGoal = first(o, ['goal', 'objective', 'aim'])
    const goal = rawGoal === undefined ? undefined : readGoal(rawGoal)
    let kind: 'needs' | 'protect' | 'other' | null = null
    if (rawKind !== undefined) {
      const key = keyOf(rawKind)
      if (hasWord(key, ['needs', 'need', 'conditions', 'condition', 'setup', 'set'])) kind = 'needs'
      else if (hasWord(key, ['protect', 'protection', 'prevent', 'prevention', 'protecting'])) kind = 'protect'
      else kind = 'other'
    } else if (goal !== undefined) {
      kind = NEEDS_GOALS.includes(goal) ? 'needs' : PROTECT_GOALS.includes(goal) ? 'protect' : null
    }
    if (kind === null) return null
    if (kind === 'other') return { kind: 'other', asked: String(rawKind) }
    if (kind === 'needs') {
      const salt = o.salt === true || o.salt === 'true'
      return { kind: 'needs', goal: goal ?? 'rust', ...(salt ? { salt: true } : {}) }
    }
    const rawOpts = first(o, ['options', 'protections', 'choices'])
    const options = Array.isArray(rawOpts) ? rawOpts.map(readProtection) : undefined
    return { kind: 'protect', goal: goal ?? 'scratchProof', ...(options ? { options } : {}) }
  },

  faults,
  promptFaults,

  initial(config) {
    if (config.kind === 'needs' && config.goal === 'rust') return { water: 'none', air: 'in', protection: 'none', scratched: false, left: false }
    return { water: 'tap', air: 'in', protection: 'none', scratched: false, left: false }
  },

  check(config, state) {
    const ok = done(config, state)
    return { ok, wrongIds: ok ? [] : ['nail'] }
  },

  solve(config) {
    const base = { protection: 'none' as Protection, scratched: false, left: true }
    if (config.kind === 'needs') {
      if (config.goal === 'shinyWet') return { ...base, water: 'tap', air: 'out' }
      if (config.goal === 'shinyAir') return { ...base, water: 'none', air: 'in' }
      if (config.goal === 'rustMost') return { ...base, water: 'salt', air: 'in' }
      return { ...base, water: 'tap', air: 'in' }
    }
    const opts = optionsOf(config)
    const tap = { water: 'tap' as Water, air: 'in' as Air, left: true }
    if (config.kind === 'protect' && config.goal === 'scratchProof') return { ...tap, protection: opts.find(reactive) ?? 'zinc', scratched: true }
    if (config.kind === 'protect' && config.goal === 'untilScratched') return { ...tap, protection: opts.find(barrier) ?? 'paint', scratched: true }
    return { ...tap, protection: opts.includes('zinc') ? 'zinc' : opts.find((p) => p !== 'none') ?? 'paint', scratched: false }
  },

  View: RustingView,

  prompt: `SCENE "rusting" -- a real nail in a boiling tube. The learner sets what reaches the nail (water: none, tap or salt; air: kept out or let in) or how it is protected (nothing, paint, grease, a zinc coat, a magnesium strip; scratched or not), presses Leave for a week, and the week plays day by day: rust creeps in only where water and air both reach bare iron, flakes fall and settle, and the water browns. Under scratched paint a blister grows out from the scratch; around a scratch in zinc the coat turns white while the scratch stays grey; a magnesium strip thins and crusts white. Where nothing rusts, the days pass and the nail does not change.
  Tasks: "needs" (set the water and the air to meet a goal: "rust", "shinyWet" keep it shiny with water in the tube, "shinyAir" keep it shiny with air in the tube, "rustMost" as much rust as possible, which needs "salt":true to offer salt water) and "protect" (the nail always sits in tap water, open to the air; goals "scratchProof" a protection that still works after a scratch, "untilScratched" a protection that works only until it is scratched, "keepShiny" no rust after a week; "options" is two to four of none, paint, grease, zinc, magnesium, default none, paint, zinc, magnesium).
  For: rusting, the conditions for rusting, preventing rusting, barrier methods, sacrificial protection, galvanising. It answers "iron rusts in water alone", "a coat of paint protects iron even when scratched" and "rust needs only air".
  Before marking the card shows the set-up, a caption, the goal and a live "Rust:" readout, and never says right or wrong. The prompt must say the situation and the gesture: do NOT name the answer (for rust: water and air together, oxygen, tap water, open to the air; for shinyWet: oil, boiling, "no air"; for shinyAir: drying agent, "no water", the stopper; for rustMost: salt, sea, brine; for scratchProof: zinc, magnesium, galvanising, sacrificial, more reactive; for untilScratched: paint, grease, oil, barrier).
  Not drawn: other metals, acid rain, electroplating, rust rates over longer than a week, other coatings than paint, grease, zinc and magnesium.
  config examples (omit "options" for the default four):
${catalogue}
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"${EXAMPLES[0].prompt}",
    "payload": { "engine":"rusting", "config": ${JSON.stringify(EXAMPLES[0].config)} },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:rusting", "why":"..." } }`,
}

registerEngine(rustingEngine as SceneEngine<unknown, unknown>)
