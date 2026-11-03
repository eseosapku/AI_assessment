// lib/studylab/engines/fair-test/config.ts
//
// A real experiment on a bench: two ramps side by side, a toy car on each, and a ruler along the floor. Lane A is
// fixed. The learner sets up lane B (plan, fix) or rolls both cars again and again (repeat), and the apparatus itself
// changes with every move: books go under a ramp, blocks onto a car, sandpaper onto a ramp, carpet onto the floor.
//   plan   -- lane B starts exactly like lane A. Set it up so that the test is fair for the factor named in the prompt:
//             that factor differs, the rest are the same.
//   fix    -- lane B starts set up unfairly (too much differs, or the wrong thing differs). Make the test fair.
//   repeat -- the lanes differ in the one factor, and the cars are rolled again and again. A run or two can point the
//             wrong way by chance; the learner rolls until they can trust which lane sends its car further.
//
// The rules, all computed here and never read from the drawing:
//   a test is fair exactly when the factor being tested is the only one that differs between the lanes;
//   a result is trusted from the third run on: the data are fixed so that one run or two put the wrong lane ahead,
//   and from three runs on the averages always put the right lane ahead (the tests prove it for every config).
//
// Facts:
//   - the usual primary and lower-secondary language: the factor you change is the independent variable, the thing you
//     measure is the dependent variable, the factors you keep the same are the control variables (UK National Curriculum
//     "working scientifically": planning fair tests, repeat readings; the Cambridge Primary and Lower Secondary
//     "scientific enquiry" strand uses the same words);
//   - "repeat and take a mean; three is the usual minimum": common classroom guidance (e.g. the ASE and CLEAPSS practical
//     guidance), and the sample plans for the ramp investigation use three repeats at each height;
//   - the directions are the ordinary physics: a higher ramp sends a car further; sandpaper on the ramp and carpet on the
//     floor both cut the distance. The distances (cm) are made up for the card and say so nowhere as measured data.
//     Car load is NOT offered for the repeat task: with wheels on a smooth ramp the effect of mass is small and
//     arguable, so the card does not pretend to show it.
//
// Ideas taken, never code or art:
//   - the toy-car ramp as the classic fair-test investigation, with heights repeated three times (several classroom
//     lesson plans for 3-5 ETS1-3 style "plan and carry out fair tests in which variables are controlled");
//   - "release the car, never push it": a pushed car is a different test (several of the same plans);
//   - the misconception that a fair test is one where "everybody gets a turn", and children who change several things at
//     once (Children's Misconceptions in Primary Science, Studies in Science Education 2001); and chance mistaken for a
//     real difference, cured by a bigger sample (UC Berkeley "Understanding Science", fair tests: a do-it-yourself guide);
//   - from the best explorables: let the learner build the apparatus and see it change, rather than tick a list.
// Refused:
//   - plants on a windowsill, pendulums, dissolving: a second apparatus would split the card; this one is the ramp;
//   - timing, speed and graphs: a different skill (reading and plotting), and the card shows none of it;
//   - more than one factor to test at once, and "controls" in the sense of a comparison group: different ideas.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { FairTestView } from './View'

export const FACTORS = ['height', 'load', 'ramp', 'floor'] as const
export type FactorId = (typeof FACTORS)[number]

export type FactorInfo = {
  /** The row's name. */
  label: string
  /** The words in a sentence. */
  lower: string
  /** What lane A has, and the one other thing lane B can have. */
  a: string
  b: string
  /** How a prompt names it. */
  noun: string
}

export const FACTOR_INFO: Record<FactorId, FactorInfo> = {
  height: { label: 'Ramp height', lower: 'ramp height', a: '2 books', b: '4 books', noun: 'the height of the ramp' },
  load: { label: 'Car load', lower: 'car load', a: 'empty', b: '2 blocks', noun: 'the load on the car' },
  ramp: { label: 'Ramp surface', lower: 'ramp surface', a: 'smooth card', b: 'sandpaper', noun: 'the surface of the ramp' },
  floor: { label: 'Floor surface', lower: 'floor surface', a: 'wood', b: 'carpet', noun: 'the floor the car rolls along' },
}

export const FLAWS = ['extra', 'swapped'] as const
export const REPEAT_FACTORS = ['height', 'ramp', 'floor'] as const
export const RUNS_NEEDED = 3
export const RUNS_MAX = 6

export type FairConfig =
  /** plan: set lane B up to test `change`. A name outside the four still parses, and faults says what would work. */
  | { task: 'plan'; change: string }
  /** fix: lane B starts unfair. flaw: extra (the factor and one more differ) or swapped (only a different one differs). */
  | { task: 'fix'; change: string; flaw: string }
  /** repeat: the lanes differ in `change`; roll until the result can be trusted. */
  | { task: 'repeat'; change: string }

/** What the learner has done: the factors lane B differs in, or the runs rolled so far. */
export type FairState = { diff?: string[]; runs?: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
export const isFactor = (s: string): s is FactorId => (FACTORS as readonly string[]).includes(s)
const factorOf = (config: FairConfig): FactorId => (isFactor(config.change) ? config.change : 'height')
export const nextFactor = (f: FactorId): FactorId => FACTORS[(FACTORS.indexOf(f) + 1) % FACTORS.length]

// ---------------------------------------------------------------------------
// Lane B's settings, read safely.

/** The factors lane B differs from lane A in, each once, in the bench's own order. */
export function differing(config: FairConfig, state: FairState): FactorId[] {
  const raw = config.task === 'repeat' ? [factorOf(config)] : state?.diff
  if (!Array.isArray(raw)) return []
  return FACTORS.filter((f) => raw.includes(f))
}

/** What a lane has for each factor. Lane A is always the first setting. */
export type Setup = { books: 2 | 4; load: boolean; sandpaper: boolean; carpet: boolean }
export const laneA: Setup = { books: 2, load: false, sandpaper: false, carpet: false }
export function laneB(config: FairConfig, state: FairState): Setup {
  const d = differing(config, state)
  return { books: d.includes('height') ? 4 : 2, load: d.includes('load'), sandpaper: d.includes('ramp'), carpet: d.includes('floor') }
}

// ---------------------------------------------------------------------------
// Marking: from the rule, always.

export function runsDone(config: FairConfig, state: FairState): number {
  const r = state?.runs
  return config.task === 'repeat' && typeof r === 'number' && Number.isFinite(r) ? Math.max(0, Math.min(RUNS_MAX, Math.floor(r))) : 0
}

export function fairNow(config: FairConfig, state: FairState): boolean {
  const d = differing(config, state)
  return d.length === 1 && d[0] === factorOf(config)
}

export function done(config: FairConfig, state: FairState): boolean {
  if (config.task === 'repeat') return runsDone(config, state) >= RUNS_NEEDED
  return fairNow(config, state)
}

// ---------------------------------------------------------------------------
// The data for the repeat task: how far each car rolled, in cm, run after run. Made up, and fixed, so that the first
// two runs put the wrong lane ahead and every count of three runs or more puts the right one ahead.

const BASE = 60
/** Lane B's true average minus lane A's: a higher ramp sends it further, sandpaper and carpet cut it. */
const DELTA: Record<string, number> = { height: 18, ramp: -14, floor: -16 }
const NOISE_A = [10, 9, -7, 2, -3, 0]
const NOISE_B = [-10, -9, 6, -2, 3, 0]

/** Each run's distances for both lanes, for the first `n` runs. */
export function distances(change: string, n: number): { a: number[]; b: number[] } {
  const delta = has(DELTA, change) ? DELTA[change] : DELTA.height
  const sign = delta > 0 ? 1 : -1
  const a: number[] = []
  const b: number[] = []
  for (let i = 0; i < Math.min(n, RUNS_MAX); i++) {
    a.push(BASE + sign * NOISE_A[i])
    b.push(BASE + delta + sign * NOISE_B[i])
  }
  return { a, b }
}

export const meanOf = (xs: number[]): number => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0)
/** Which lane the first n runs put ahead: 'A', 'B', or 'level' when the averages are the same. */
export function leader(change: string, n: number): 'A' | 'B' | 'level' {
  const { a, b } = distances(change, n)
  const diff = b.reduce((s, x) => s + x, 0) - a.reduce((s, x) => s + x, 0)
  return diff > 0 ? 'B' : diff < 0 ? 'A' : 'level'
}
/** The lane that really goes further. */
export const truth = (change: string): 'A' | 'B' => (has(DELTA, change) && DELTA[change] < 0 ? 'A' : DELTA[change] > 0 ? 'B' : 'B')

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds nothing of it.

const say = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const listOf = (fs: FactorId[]) => {
  const names = fs.map((f) => FACTOR_INFO[f].lower)
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** What a correct card says: what the learner found, and the idea in its words. */
export function working(config: FairConfig, state: FairState): string {
  const f = factorOf(config)
  if (config.task === 'repeat') {
    const n = runsDone(config, state)
    const { a, b } = distances(f, n)
    const first = leader(f, 1)
    const word = FACTOR_INFO[f].lower
    return `Yes. ${say(n, 'run', 'runs')}: lane A averaged ${meanOf(a)} cm and lane B ${meanOf(b)} cm. The very first run put lane ${first} ahead, which was chance. Repeating the test and taking the average evens that out, so the difference left is the ${word}.`
  }
  const rest = FACTORS.filter((x) => x !== f).map((x) => FACTOR_INFO[x].lower)
  return `Yes. Lane B changes only the ${FACTOR_INFO[f].lower}. That is what you change, and the distance rolled is what you measure. ${rest[0][0].toUpperCase()}${rest[0].slice(1)}, ${rest[1]} and ${rest[2]} stay the same, so none of them can explain a difference.`
}

/** What a wrong card says: what the learner made, never what it should be. */
export function madeText(config: FairConfig, state: FairState): string {
  const f = factorOf(config)
  if (config.task === 'repeat') {
    const n = runsDone(config, state)
    if (n === 0) return 'Nothing has been rolled yet, so there is nothing to compare.'
    const { a, b } = distances(f, n)
    const lead = leader(f, n)
    const show = lead === 'level' ? 'The lanes are level' : `Lane ${lead} is ahead`
    return `After ${say(n, 'run', 'runs')} ${show.charAt(0).toLowerCase()}${show.slice(1)}: A averages ${meanOf(a)} cm, B ${meanOf(b)} cm. That gap could still be chance. Roll more and see whether it holds.`
  }
  const d = differing(config, state)
  const test = FACTOR_INFO[f].lower
  if (d.length === 0) return 'Lane B is set up exactly like lane A, so there is nothing to compare.'
  if (!d.includes(f)) return `Lane B differs in ${listOf(d)}, but not in ${test}, so this test cannot show whether ${test} matters.`
  return `Lane B differs in ${listOf(d)}. If the cars roll different distances, you could not say which of those caused it.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const TASK_WORDS: Record<string, 'plan' | 'fix' | 'repeat'> = {
  plan: 'plan', 'plan-a-test': 'plan', 'plan-a-fair-test': 'plan', 'fair-test': 'plan', fair: 'plan', make: 'plan', 'set-up': 'plan', setup: 'plan', design: 'plan', build: 'plan', control: 'plan', 'control-variables': 'plan', variables: 'plan', compare: 'plan', choose: 'plan',
  fix: 'fix', fault: 'fix', 'find-the-fault': 'fix', spot: 'fix', unfair: 'fix', 'unfair-test': 'fix', mend: 'fix', correct: 'fix', repair: 'fix', improve: 'fix', evaluate: 'fix', 'make-fair': 'fix', 'fix-the-test': 'fix',
  repeat: 'repeat', repeats: 'repeat', repeated: 'repeat', 'repeat-readings': 'repeat', reliability: 'repeat', reliable: 'repeat', repeatability: 'repeat', runs: 'repeat', trials: 'repeat', average: 'repeat', mean: 'repeat', 'repeat-the-test': 'repeat',
}

function factorFrom(k: string): FactorId | null {
  if (/height|steep|slope|incline|angle|books?/.test(k)) return 'height'
  if (/load|weight|mass|heav|block|cargo/.test(k)) return 'load'
  if (/ramp|sandpaper|rough|smooth|friction|texture/.test(k) && !/floor|carpet/.test(k)) return 'ramp'
  if (/floor|carpet|ground|surface|wood/.test(k)) return 'floor'
  return null
}
const readChange = (raw: unknown): string => {
  const k = keyOf(raw).replace(/^(?:the|a|an)-/, '')
  return factorFrom(k) ?? k
}
const readFlaw = (raw: unknown): string => {
  const k = keyOf(raw)
  if (['extra', 'also', 'too-many', 'more', 'two', 'additional', 'several', 'many'].includes(k) || /^(?:too-many|extra|more-than)/.test(k)) return 'extra'
  if (['swapped', 'swap', 'wrong', 'wrong-thing', 'wrong-factor', 'other', 'changed-the-wrong-thing', 'mixed-up'].includes(k) || /^wrong/.test(k)) return 'swapped'
  return k
}

/** The prompt each kind of config is shown with: the gesture, the aim, and the factor named. */
export const goodPrompt = (config: FairConfig): string => {
  const noun = FACTOR_INFO[factorOf(config)].noun
  if (config.task === 'plan') return `Tap the buttons to set up lane B as a fair test of whether ${noun} changes how far the car rolls. Lane A is already set up.`
  if (config.task === 'fix') return `Lane B is set up to test whether ${noun} changes how far the car rolls, but the test is not fair yet. Tap the buttons to fix lane B.`
  return `The lanes differ in ${noun}. Tap Roll both cars to let both cars go, and keep rolling until you are sure which lane sends its car further.`
}

/** Words that name each factor in a prompt. */
const MENTION: Record<FactorId, RegExp> = {
  height: /\bheight|\bhigh(?:er)?\b|\bsteep|\bslope|\bincline|\bbooks?\b/i,
  load: /\bload|\bweight|\bheav|\bmass\b|\bblocks?\b|\bcargo/i,
  ramp: /\bsandpaper|\bfriction|\brough|\bsmooth\b|ramp['’]?s?\s+(?:surface|covering|material|texture)|(?:surface|covering|material|texture)\s+of\s+the\s+ramp/i,
  floor: /\bfloor|\bcarpet|\bflooring|\bwood(?:en)?\b|\bground\b|\bsurface\s+the\s+car/i,
}

export const fairTestEngine: SceneEngine<FairConfig, FairState> = {
  id: 'fair-test',
  // One distinctive word. "fair", "test" and "variable" are everywhere (fair trade, tests for ions, algebraic variables), so
  // everything else is a whole phrase.
  covers: ['repeatability'],
  phrases: [
    'fair test', 'fair tests', 'fair testing', 'a fair test', 'planning a fair test', 'planning fair tests', 'unfair test', 'unfair tests', 'making a test fair', 'making it a fair test',
    'control variable', 'control variables', 'controlling variables', 'controlled variables', 'controlling the variables', 'changing variables', 'identifying variables', 'investigating variables',
    'independent variable', 'independent variables', 'dependent variable', 'dependent variables', 'independent and dependent variables', 'variables in an investigation', 'variables in experiments', 'variables in science',
    'planning an investigation', 'planning investigations', 'planning experiments', 'planning an experiment', 'planning and carrying out investigations', 'scientific enquiry', 'scientific enquiries', 'scientific investigations', 'scientific investigation',
    'working scientifically', 'enquiry skills', 'investigation skills', 'practical investigations', 'practical skills', 'practical work skills', 'planning analysis and evaluation', 'planning and evaluation',
    'repeat readings', 'repeated readings', 'repeat measurements', 'repeated measurements', 'repeating measurements', 'repeating experiments', 'repeating investigations', 'reliable results', 'reliability of results', 'reliability of data', 'reliability of evidence',
    'making results reliable', 'accuracy and reliability', 'reliable and valid', 'validity and reliability', 'fair comparisons', 'fair comparison',
  ],
  // Near misses: variables of other kinds, fairness of other kinds, tests of other kinds, and practical skills of other crafts.
  notFor: [
    'algebraic variables', 'variables in algebra', 'variables and constants', 'variables and expressions', 'variables and equations', 'using variables', 'programming variables', 'variables in programming', 'variables and data types', 'variables and assignment', 'variables in code', 'global variables', 'local variables',
    'random variables', 'discrete random variables', 'continuous random variables', 'random variable', 'variable costs', 'fixed and variable costs', 'variable cost', 'dependent and independent events', 'independent events', 'dependent events', 'independent and dependent events',
    'dependent variable in regression', 'regression', 'scatter graphs', 'scatter diagrams', 'correlation', 'categorical variables', 'continuous variables', 'discrete variables', 'quantitative variables', 'qualitative variables', 'bivariate',
    'fair trade', 'fairtrade', 'fair share', 'fair shares', 'fair trial', 'fair play', 'fair game', 'fair games', 'fair dice', 'fair coin', 'fair price', 'fair prices', 'fair wages', 'fair pay', 'fair division', 'fair society', 'fair treatment', 'fair rules', 'fair elections',
    'hypothesis test', 'hypothesis tests', 'hypothesis testing', 'statistical test', 'statistical tests', 'significance test', 'significance tests', 'test for starch', 'food tests', 'tests for ions', 'ion tests', 'flame tests', 'gas tests', 'test for gases', 'test for proteins', 'tests for carbohydrates',
    'blood test', 'blood tests', 'driving test', 'unit test', 'unit tests', 'test data', 'testing software', 'software testing', 'program testing', 'testing and debugging', 'stress test', 'testing and evaluation',
    'woodwork', 'cooking', 'food preparation', 'practical skills in food', 'art', 'sewing', 'textiles', 'metalwork', 'sports', 'reliability engineering', 'reliability of sources', 'reliability of a source', 'source reliability', 'reliability of historical sources',
  ],
  // The learner decides which of a set of factors go in the group that changes and the group that stays the same.
  isolates: 'membership',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const rawTask = first(o, ['task', 'kind', 'type', 'mode'])
    const rawChange = first(o, ['change', 'variable', 'factor', 'test', 'tested', 'independent', 'vary', 'changing'])
    const rawFlaw = first(o, ['flaw', 'fault', 'mistake', 'problem'])
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const task = word ? TASK_WORDS[word] : rawFlaw !== undefined ? 'fix' : rawChange !== undefined || o.runs !== undefined ? (o.runs !== undefined ? 'repeat' : 'plan') : null
    if (!task) return null
    if (rawChange !== undefined && typeof rawChange !== 'string') return null
    const change = rawChange === undefined ? 'height' : readChange(rawChange)
    if (task === 'plan') return { task, change }
    if (task === 'repeat') return { task, change }
    if (rawFlaw !== undefined && typeof rawFlaw !== 'string') return null
    return { task, change, flaw: rawFlaw === undefined ? 'extra' : readFlaw(rawFlaw) }
  },

  faults(config) {
    const out: string[] = []
    if (!isFactor(config.change)) {
      out.push(`There is no "${config.change}" on this bench: the factors are ramp height, car load, ramp surface and floor surface, e.g. change "height".`)
    } else if (config.task === 'repeat' && !(REPEAT_FACTORS as readonly string[]).includes(config.change)) {
      out.push(`Car load makes no clear difference to how far a car rolls on a ramp, so the repeat task will not draw it: use e.g. change "height" (or "ramp", "floor").`)
    }
    if (config.task === 'fix' && !(FLAWS as readonly string[]).includes(config.flaw)) {
      out.push(`There is no "${config.flaw}" flaw: use flaw "extra" (too much differs) or "swapped" (the wrong thing differs), e.g. flaw "extra".`)
    }
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const f = factorOf(config)
    if (config.task === 'repeat') {
      const count = /\b(?:\d+|two|three|four|five|six|several|a few|many)\s+(?:\w+\s+)?(?:runs?|times|repeats?|goes|rolls|readings|trials|tests)\b|\bat least\b|\baverage|\bmeans?\b|\brepeat|\bagain and again\b|\bmore than once\b|\boutlier|\banomal|\bchance\b|\bluck\b/i.test(text)
      const lane = /\blane\s+[AB]\b[^.?!]*\b(?:further|farther|faster|more|less|shorter|wins?|longer)\b/i.test(text)
      if (count || lane) out.push(`the prompt gives the answer away: it says how many runs, that results should be averaged, or which lane goes further, which the learner is to find by rolling -- ask for the outcome only ("${example}")`)
    } else {
      const rule = /\bonly\b|\bjust\b|\bsingle\b|\bone (?:thing|variable|factor|change)\b|\bsame\b|\bconstant\b|\bidentical\b|\bcontrol(?:led|s)?\b|\bunchanged\b|\beverything else\b|\bnothing else\b|\bother (?:things|variables|factors)\b|\bexcept\b|\bkeep\b|\bheld?\b|\bdiffers?\b|\bdiffering\b/i.test(text)
      const flaw = config.task === 'fix' && /\bextra\b|\btoo many\b|\bmore than one\b|\bwrong (?:thing|factor|variable|one)\b|\bswapped\b|\bmixed up\b|\bshould not\b|\bshouldn't\b|\bbecause\b/i.test(text)
      if (rule || flaw) out.push(`the prompt gives the answer away: it says what must stay the same, how many things differ or what is wrong, which the learner is to work out -- ask for the outcome only ("${example}")`)
    }
    if (/\bstopwatch|\btimer?\b|\bseconds?\b|\bspeed|\bgraph|\bplants?\b|\btemperature|\bforce ?meter|\bresults? table|\bdrag\b|\bslide\b|\bwindowsill|\bpendulum|\bdissol/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws a ramp, a car and a ruler, and the learner taps buttons or rolls the cars -- ask for that ("${example}")`)
    }
    const names = FACTORS.filter((x) => MENTION[x].test(text))
    if (!names.includes(f)) {
      out.push(`the prompt does not name what is being tested: this card tests ${FACTOR_INFO[f].lower}, so name it ("${example}")`)
    } else if (names.some((x) => x !== f) && config.task !== 'repeat') {
      out.push(`the prompt names another factor besides the ${FACTOR_INFO[f].lower}, which tells the learner what to leave alone -- name only the one being tested ("${example}")`)
    }
    return out
  },

  initial(config) {
    if (config.task === 'repeat') return { runs: 0 }
    if (config.task === 'plan') return { diff: [] }
    const f = factorOf(config)
    const next = nextFactor(f)
    return { diff: config.flaw === 'swapped' ? [next] : [f, next] }
  },

  check(config, state) {
    if (!isFactor(config.change)) return { ok: false, wrongIds: [] }
    const ok = done(config, state)
    if (ok || config.task === 'repeat') return { ok, wrongIds: [] }
    const f = factorOf(config)
    const d = differing(config, state)
    return { ok, wrongIds: [...d.filter((x) => x !== f), ...(d.includes(f) ? [] : [f])] }
  },

  solve(config) {
    return config.task === 'repeat' ? { runs: RUNS_NEEDED } : { diff: [factorOf(config)] }
  },

  View: FairTestView,

  prompt: `SCENE "fair-test" -- a real experiment on a bench, drawn on a quiet light panel: two toy-car ramps side by side, lane A above lane B, each ramp on a stack of books with a small red pickup truck at the top, rolling onto a floor, with one ruler in centimetres below. The learner never reads a table: they handle the apparatus. Every move changes the drawing at once: books go under a ramp, two grey blocks onto a car, sandpaper onto the ramp, carpet onto the floor. Both cars are let go, never pushed, and the distance each rolls is what is measured.
  For: planning a fair test, the variable you change, the variable you measure and the variables you keep the same (control variables), and repeating a test so the result can be trusted (repeat readings, reliability). It answers "a fair test is where everyone gets a turn", "change a few things to be sure" and "one go is enough".
  plan: lane A is set, and lane B starts exactly like lane A. Four rows of two buttons set what lane B has: ramp height (2 books or 4 books), car load (empty or 2 blocks), ramp surface (smooth card or sandpaper) and floor surface (wood or carpet). The learner sets lane B up as a fair test of the factor named in the prompt. change: height, load, ramp or floor.
  fix: the same bench, but lane B starts set up unfairly. change: as above. flaw: extra (the factor and one other differ; the default) or swapped (only a different factor differs, the wrong one). The learner mends it.
  repeat: lane B differs from A in the one factor, no rows to set. The learner taps Roll both cars again and again (up to 6 runs); each run the cars roll and a dot marks where each stopped, and Clear starts over. The first runs can point to the wrong lane by chance. change: height (B has the higher ramp), ramp (B has sandpaper) or floor (B has carpet); not load.
  Not drawn: plants and windowsills, timing, speed, graphs and tables, pushing the car, more than one factor under test. Do not use it for algebra or programming variables, random variables, fair trade or fair division, chemical tests for ions and gases, or hypothesis tests in statistics.
  Before marking the card shows the bench, the buttons and what each setting looks like; it holds back whether lane B is fair, and (in repeat) the averages and which lane really goes further. Marking says what the learner made, and why. The prompt must name the factor being tested and the gesture only: do NOT say that only one thing should change, what to keep the same, how many things differ or what is wrong, how many runs to roll, that results are averaged, or which lane goes further.
  config: { "task":"plan", "change":"height" }  -- the prompt says "Tap the buttons to set up lane B as a fair test of whether the height of the ramp changes how far the car rolls. Lane A is already set up."
       or { "task":"fix", "change":"floor", "flaw":"extra" }  -- the prompt says "Lane B is set up to test whether the floor the car rolls along changes how far the car rolls, but the test is not fair yet. Tap the buttons to fix lane B."
       or { "task":"repeat", "change":"ramp" }  -- the prompt says "The lanes differ in the surface of the ramp. Tap Roll both cars to let both cars go, and keep rolling until you are sure which lane sends its car further."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the buttons to set up lane B as a fair test of whether the height of the ramp changes how far the car rolls. Lane A is already set up.",
    "payload": { "engine":"fair-test", "config": { "task":"plan", "change":"height" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:fair-test", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Lane B is set up to test whether the floor the car rolls along changes how far the car rolls, but the test is not fair yet. Tap the buttons to fix lane B.",
    "payload": { "engine":"fair-test", "config": { "task":"fix", "change":"floor", "flaw":"extra" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:fair-test", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"The lanes differ in the surface of the ramp. Tap Roll both cars to let both cars go, and keep rolling until you are sure which lane sends its car further.",
    "payload": { "engine":"fair-test", "config": { "task":"repeat", "change":"ramp" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"membership", "apparatus":"scene:fair-test", "why":"..." } }`,
}

registerEngine(fairTestEngine as SceneEngine<unknown, unknown>)
