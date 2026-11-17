// lib/studylab/engines/nuclear-fission/config.ts
//
// Two small nuclear experiments, drawn as apparatus rather than answered as quizzes.
//   reactor -- lower real control rods through a cutaway core. One split has led to three, and the learner
//              chooses how many of those three splits' neutrons reach the next generation. Nine, seven,
//              five, three or no new fissions happen; three is a steady chain and none is shutdown.
//   fusion  -- squeeze a hot deuterium fuel pellet in a steel press. The positive nuclei approach and
//              swerve apart at small gaps, then visibly join only at the closest setting, releasing a
//              neutron and energy. The fixed 15 million °C is the Sun-core school value, so pressure is
//              the one thing the hand changes.
//
// The rules are exact integers, never read from the drawing. Dragging snaps to the same four detents the
// stepper buttons reach, so there is no invisible precision test. The picture answers every move.
//
// Physics and scope:
//   - U-235 can release two or three neutrons; this card draws a three-neutron branch and says so. A steady
//     chain has one neutron per fission, on average, causing another fission. Control rods absorb neutrons;
//     the moderator slows them. RevisionDojo's IB/IGCSE reactor note and PhET Nuclear Fission learning goals:
//     https://www.revisiondojo.com/student-faq/chain-reaction-nuclear-reactor
//     https://phet.colorado.edu/en/simulations/nuclear-fission
//   - The three-generation layout is causal: 1 -> 3 -> up to 9. The rods affect only the last journey, so
//     the learner always compares three fissions in the previous generation with the new generation.
//   - D + D -> He-3 + n is one real deuterium-deuterium branch: nucleon number 2+2 = 3+1 and proton number
//     1+1 = 2+0. No claim is made that it is the only branch. High temperature and pressure overcome the
//     repulsion of positive nuclei; the visual model is qualitative, not a fusion-rate or Lawson calculation.
//     https://visualize-it.github.io/nuclear_fusion/simulation.html
//
// Ideas taken, never code or art: PhET's neutron-caused event and hand-controlled rods; Visualize It's
// repel-then-fuse event under heating/compression. Refused: weapons, a power grid, a crowded cloud of nuclei,
// moderator controls (its different job must not be confused with the rods), and a nuclear-equation editor.
// Nuclei are intentionally schematic clusters, not scale drawings of 235 nucleons.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { NuclearFissionView } from './View'

export const ROD_MAX = 4
export const SQUEEZE_MAX = 4
export const STEADY_DEPTH = 3
export const STOP_DEPTH = 4
/** One neutron from each of three fissions survives at depth 3; at depth 4 the rods catch those too. */
export const ABSORB_AT = [2, 4, 1, 3, 4, 3, 1, 4, 2] as const

export type ReactorGoal = string
export type NuclearConfig =
  | { task: 'reactor'; goal: ReactorGoal }
  | { task: 'fusion'; pairs: number }
/** One shared depth state makes stored work easy to read; only the field for this task is used. */
export type NuclearState = { depth?: number; squeeze?: number }

const whole = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max

/** What the learner actually set. Bad stored work safely opens the apparatus, but can never pass check. */
export function madeDepth(state: NuclearState | null | undefined): number {
  return whole(state?.depth, ROD_MAX) ? state.depth : 0
}
export function madeSqueeze(state: NuclearState | null | undefined): number {
  return whole(state?.squeeze, SQUEEZE_MAX) ? state.squeeze : 0
}

/** The next generation, from the absorption rule: depth 0..4 gives 9, 7, 5, 3, 0. */
export function nextFissions(depth: number): number {
  const d = whole(depth, ROD_MAX) ? depth : 0
  return ABSORB_AT.filter((at) => at > d).length
}
export const surviving = (depth: number): number[] => ABSORB_AT.flatMap((at, i) => (at > depth ? [i] : []))
export const targetDepth = (config: Extract<NuclearConfig, { task: 'reactor' }>) => (config.goal === 'stop' ? STOP_DEPTH : STEADY_DEPTH)

export function done(config: NuclearConfig, state: NuclearState | null | undefined): boolean {
  if (config.task === 'reactor') return whole(state?.depth, ROD_MAX) && state.depth === targetDepth(config)
  return whole(state?.squeeze, SQUEEZE_MAX) && state.squeeze === SQUEEZE_MAX
}

// ---------------------------------------------------------------------------
// What marking says. Before marking the observable is there, but not the product names or verdict.

const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function working(config: NuclearConfig): string {
  if (config.task === 'fusion') {
    return `Yes. Each pair of deuterium nuclei made helium-3, releasing a neutron and energy: 2 + 2 = 3 + 1 nucleons. High temperature and pressure overcame the positive nuclei's repulsion.`
  }
  if (config.goal === 'stop') {
    return 'Yes. No new fissions: the rods absorbed all nine neutrons from the previous three splits, so the chain stopped. The moderator only slows neutrons.'
  }
  return 'Yes. Three fissions led to three more: one neutron per split continues the steady chain. The control rods absorbed the other six; the moderator only slows neutrons.'
}

export function madeText(config: NuclearConfig, state: NuclearState | null | undefined): string {
  if (config.task === 'fusion') {
    const n = madeSqueeze(state)
    if (n === 0) return 'The press is open. The hot deuterium nuclei move, but each pair turns away before joining: the positive nuclei repel one another.'
    return `At squeeze ${n} of ${SQUEEZE_MAX}, each pair approaches and then swerves apart. The deuterium nuclei are still separate, so no fusion has happened yet.`
  }
  const d = madeDepth(state)
  const next = nextFissions(d)
  const rods = d === 0 ? 'Your rods are out of the core.' : `Your rods are at depth ${d} of ${ROD_MAX}.`
  if (config.goal === 'stop') {
    return `${rods} ${say(next, 'new fission still follows', 'new fissions still follow')} the previous three, so the chain reaction has not stopped.`
  }
  if (next === 0) return `${rods} No new fissions follow: you stopped the chain instead of keeping it steady.`
  if (next === 3) return `${rods} Three fissions led to three more: that is a steady chain reaction.`
  return `${rods} Three fissions led to ${next}, so the next generation is ${next > 3 ? 'growing' : 'smaller'}, not steady.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's semantic config. Unknown goals and out-of-range counts parse, then get a useful refusal.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, NuclearConfig['task']> = {
  reactor: 'reactor', 'nuclear-reactor': 'reactor', fission: 'reactor', 'nuclear-fission': 'reactor', chain: 'reactor', 'chain-reaction': 'reactor',
  'chain-reactions': 'reactor', criticality: 'reactor', critical: 'reactor', 'control-rods': 'reactor', rods: 'reactor', 'reactor-control': 'reactor',
  'control-the-chain-reaction': 'reactor', 'steady-chain-reaction': 'reactor',
  fusion: 'fusion', 'nuclear-fusion': 'fusion', fuse: 'fusion', join: 'fusion', 'join-nuclei': 'fusion',
  'fusion-in-the-sun': 'fusion', sun: 'fusion', star: 'fusion', press: 'fusion', 'fusion-press': 'fusion', 'high-temperature-and-pressure': 'fusion',
}

const GOAL_WORDS: Record<string, ReactorGoal> = {
  steady: 'steady', stable: 'steady', constant: 'steady', critical: 'steady', criticality: 'steady', sustained: 'steady', sustain: 'steady',
  'steady-rate': 'steady', 'steady-chain': 'steady', 'steady-chain-reaction': 'steady', 'same-rate': 'steady', 'one-for-one': 'steady',
  stop: 'stop', stopped: 'stop', shutdown: 'stop', 'shut-down': 'stop', 'shut-it-down': 'stop', halt: 'stop', 'stop-the-chain-reaction': 'stop',
}

function readCount(raw: unknown): number | null {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(/\s*(?:pairs?|nuclei)$/i, '')) : raw
  return typeof v === 'number' && Number.isFinite(v) ? v + 0 : null
}

export const goodPrompt = (config: NuclearConfig): string => {
  if (config.task === 'fusion') return 'Drag the steel press plates together, or use the + and − buttons, until each pair of nuclei joins.'
  return config.goal === 'stop'
    ? 'Drag the control rods down, or use the + and − buttons, until no new fissions follow.'
    : 'Drag the control rods down, or use the + and − buttons, until each generation has the same number of fissions.'
}

export const nuclearFissionEngine: SceneEngine<NuclearConfig, NuclearState> = {
  id: 'nuclear-fission',
  // Distinctive single words; everything a generic station might also say is a whole phrase. Atom owns structure,
  // half-life decay and radiation, and energy-track general energy resources.
  covers: ['fission', 'fusion'],
  phrases: [
    'nuclear fission', 'nuclear fusion', 'fission and fusion', 'fusion and fission', 'chain reaction', 'chain reactions', 'nuclear chain reaction',
    'nuclear reactor', 'nuclear reactors', 'reactor control', 'control rods', 'nuclear energy', 'nuclear power', 'uranium-235 fission',
    'fusion in the sun', 'fusion in stars', 'why fusion needs high temperature', 'fusion temperature and pressure',
    'nuclear equations for fission', 'nuclear equations for fusion', 'fission nuclear equations', 'fusion nuclear equations',
  ],
  notFor: [
    'radioactive decay', 'radioactivity', 'half-life', 'half life', 'half-lives', 'nuclear decay', 'decay equations', 'alpha decay', 'beta decay', 'gamma decay',
    'alpha beta and gamma', 'alpha beta gamma', 'penetrating power', 'radiation penetration', 'background radiation', 'uses of radiation', 'radiation safety',
    'atomic structure', 'electron shells', 'electronic configuration', 'isotopes and nuclide notation', 'protons neutrons and electrons',
    'energy resources', 'energy sources', 'renewable energy', 'fossil fuels', 'generating electricity', 'power station', 'power stations', 'energy efficiency',
    'nuclear weapons', 'nuclear weapon', 'atomic bomb', 'atomic bombs', 'hydrogen bomb', 'nuclear weapons history', 'Hiroshima', 'Nagasaki', 'Manhattan project',
    'nuclear waste', 'radioactive waste', 'nuclear disasters', 'Chernobyl', 'Fukushima',
  ],
  // The learner varies how far the rods or press plates are inserted.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    let word = keyOf(rawTask)
    const rawGoal = first(src, ['goal', 'aim', 'mode', 'target', 'reaction'])
    const rawPairs = first(src, ['pairs', 'pairCount', 'pair_count', 'nucleiPairs'])
    // A bare goal is enough to choose the reactor; "fusion" anywhere in the task chooses fusion.
    if (!word && rawPairs !== undefined) word = 'fusion'
    if (!word && rawGoal !== undefined) word = 'reactor'
    if (!word) return null
    if (!Object.prototype.hasOwnProperty.call(TASK_WORDS, word)) return null
    const task = TASK_WORDS[word]
    if (task === 'fusion') {
      const pairs = rawPairs === undefined ? 2 : readCount(rawPairs)
      return pairs === null ? null : { task, pairs }
    }
    if (rawGoal !== undefined && typeof rawGoal !== 'string') return null
    const key = rawGoal === undefined ? 'steady' : keyOf(rawGoal)
    return { task, goal: Object.prototype.hasOwnProperty.call(GOAL_WORDS, key) ? GOAL_WORDS[key] : key }
  },

  faults(config) {
    if (config.task === 'reactor') {
      return Object.prototype.hasOwnProperty.call(GOAL_WORDS, config.goal)
        ? []
        : [`There is no "${config.goal}" reactor aim here: goal must be "steady" (three new fissions) or "stop" (none), e.g. goal "steady".`]
    }
    return config.pairs === 1 || config.pairs === 2
      ? []
      : [`${config.pairs} deuterium pairs will not fit the press (1 or 2 pairs, each at least 12 px across): use e.g. pairs 2.`]
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'reactor') {
      const answer = config.goal === 'stop'
        ? /\b(?:depth\s*4|4\s*(?:notches?|steps?|levels?)|fully\s+(?:insert|lower|down)|all\s+(?:the\s+)?way\s+down)\b/i.test(text)
        : /\b(?:depth\s*3|3\s*(?:notches?|steps?|levels?)|six\s+neutrons?|absorb(?:s|ing)?\s+(?:the\s+)?(?:other\s+)?6|one\s+neutron\s+from\s+each|one\s+neutron\s+per)\b/i.test(text)
      if (answer) out.push(`the prompt gives the rod setting or neutron count away, which the learner is to find by watching the generations -- ask for the outcome only ("${example}")`)
      if (/\b(?:moderator|coolant|turbine|generator|control\s+temperature|fire\s+a\s+neutron|remove\s+fuel|boron|cadmium)\b/i.test(text)) {
        out.push(`the prompt promises controls or apparatus the card does not have: only the control rods move, while the moderator is fixed -- ask for that ("${example}")`)
      }
    } else {
      if (/\bhelium(?:-|\s)?3\b|\b\d\s*\+\s*\d\s*=\s*\d\s*\+\s*\d\b|\b(?:squeeze|press|close|push)(?:\s+\w+){0,2}\s+(?:4|four|fully|maximum|all\s+the\s+way)\b|\b(?:fully|maximum)\s+(?:squeeze|press|close)/i.test(text)) {
        out.push(`the prompt names the fusion product or the exact press setting, which the learner is to discover -- ask only for the nuclei to join ("${example}")`)
      }
      if (/\b(?:temperature\s+(?:slider|control)|change\s+(?:the\s+)?temperature|heat\s+(?:it|the\s+fuel)|tokamak|magnetic\s+confinement|chain\s+reaction|control\s+rods?)\b/i.test(text)) {
        out.push(`the prompt promises a different apparatus: this card fixes the temperature and moves only the steel press plates -- ask for that ("${example}")`)
      }
    }
    return out
  },

  initial(config) {
    return config.task === 'reactor' ? { depth: 0 } : { squeeze: 0 }
  },

  check(config, state) {
    return { ok: done(config, state), wrongIds: [] }
  },

  solve(config) {
    return config.task === 'reactor' ? { depth: targetDepth(config) } : { squeeze: SQUEEZE_MAX }
  },

  View: NuclearFissionView,

  prompt: `SCENE "nuclear-fission" -- two hands-on nuclear experiments on a quiet light apparatus panel: a fission reactor whose chain reaction the learner controls, and a fusion press that squeezes deuterium nuclei together. The learner changes one depth and the event happens in the drawing.
  reactor: a cutaway graphite-moderated core shows a causal chain: one uranium-235 split has produced three fissions, and those three release nine blue neutrons towards the next generation. The learner drags the bank of three steel control rods down (or uses + and −); the rods ease down and visibly intercept neutrons. Depths 0,1,2,3,4 produce 9,7,5,3,0 new fissions. Every split draws two smaller daughter nuclei, three neutrons and a gold energy burst. Live readouts compare previous fissions (3) with new fissions. Aim "steady" needs depth 3, where one neutron per fission continues the chain; aim "stop" needs depth 4. The moderator is fixed: a caption and marking distinguish slowing neutrons from absorbing them. Nuclei are schematic, not 235-circle scale models.
  fusion: one or two pairs of deuterium nuclei (each drawn as a proton and neutron) move inside a steel press at a fixed 15 million °C. The learner drags either broad press plate inward, or uses + and −. At settings 0 to 3 the positive nuclei approach but visibly swerve apart under repulsion. At setting 4 each pair joins into a three-particle nucleus (two red protons and one pale neutron), releasing one blue neutron per pair and a gold energy burst. Reduced motion shows the same event as a still frame. Marking names helium-3 and gives nucleon conservation 2+2=3+1; that name and equation are absent before marking. pairs: 1 or 2 (default 2).
  For: nuclear fission and fusion, uranium-235 splitting, daughters and released neutrons/energy, chain reactions, steady and uncontrolled multiplication, reactor control rods versus moderator, why fusion needs very high temperature and pressure, and the particle accounting behind fission/fusion equations. It answers "the moderator absorbs the neutrons", "control rods slow them", and "any collision makes fusion".
  config: { "task":"reactor", "goal":"steady" }  -- prompt "Drag the control rods down, or use the + and − buttons, until each generation has the same number of fissions."
       or { "task":"reactor", "goal":"stop" }  -- prompt "Drag the control rods down, or use the + and − buttons, until no new fissions follow."
       or { "task":"fusion", "pairs":2 }  -- prompt "Drag the steel press plates together, or use the + and − buttons, until each pair of nuclei joins."
  Marking is by the exact snapped setting, never by pixels. Reactor marking says the new count and what steady or stopped means; wrong marking says what the learner made. Fusion marking names helium-3 only afterwards. Before marking there is no verdict or hidden product name in text or ARIA. The prompt must not reveal a rod depth, "six neutrons", "one neutron from each fission", helium-3, or "fully close the press". Do not promise a movable moderator, temperature control, neutron-firing button, turbine, coolant loop, weapon, or an equation editor.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the control rods down, or use the + and − buttons, until each generation has the same number of fissions.",
    "payload": { "engine":"nuclear-fission", "config":  { "task":"reactor", "goal":"steady" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:nuclear-fission", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Drag the steel press plates together, or use the + and − buttons, until each pair of nuclei joins.",
    "payload": { "engine":"nuclear-fission", "config":  { "task":"fusion", "pairs":2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:nuclear-fission", "why":"..." } }`,
}

registerEngine(nuclearFissionEngine as SceneEngine<unknown, unknown>)
