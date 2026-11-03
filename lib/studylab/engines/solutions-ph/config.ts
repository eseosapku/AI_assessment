// lib/studylab/engines/solutions-ph/config.ts
//
// Real glassware for acids and alkalis, and the one move each idea turns on:
//   titrate -- a burette over a conical flask with an indicator in it. The learner opens the tap, a few cm3 at a time and then
//              a drop at a time, and stops the moment the indicator changes colour. For many drops nothing happens, then one
//              drop snaps the whole flask to the other colour. Going past cannot be undone, as in a real lab;
//   dilute  -- a rack of test tubes of universal indicator. Each new tube is 1 cm3 of the one before, made up to 10 cm3 with
//              water, and the learner adds tubes until the last one matches a target colour on the chart. The colour moves one
//              step along the chart for every tube, which is what a tenfold change in concentration does to pH.
//
// The rules, all computed here and never read from the drawing:
//   titration: the flask holds n(flask) = c x V mmol; each drop (0.05 cm3) adds c(burette) x 0.05 mmol of the other reagent,
//     one mole against one mole. The pH comes from the excess (exact equality is tested in integers, never in floats). The
//     indicator flips when the pH passes the middle of its range; the end-point is the first drop that does. A stop on that
//     drop or the one after it is right (one drop of grace); before it the colour has not changed, after it the learner went past.
//   dilution: pH of a strong monobasic acid is -log10 c, of a strong alkali 14 + log10 c, and a tenfold dilution moves it one
//     unit towards 7. Targets are limited to those a dilution can reach honestly (never 7, and no more than 5 tubes).
//
// Facts and sources:
//   - Phenolphthalein changes colourless to pink over pH 8.2-10.0; methyl orange red to yellow over pH 3.1-4.4: the usual
//     school ranges (Royal Society of Chemistry data, CIE/Edexcel indicator tables).
//   - Universal indicator colours by pH: the usual chart, red at 1 through green at 7 to purple at 14, as sold in school kits.
//   - Only strong, monobasic acids (HCl, HNO3) and strong alkalis (NaOH, KOH) are drawn: fully dissociated, 1:1. Sulfuric acid
//     is refused (two H+ per formula, and its second ionisation is not complete); weak acids are refused because the pH curve
//     has no sharp jump and the end-point would be argued over. Water's own ionisation is ignored, as in PhET's Acid-Base
//     Solutions, which matters only beyond pH 6 and 8, and the card stops short of that.
//
// Ideas taken, never code or art:
//   - the burette reading beside a tap you open in steps, and the drop-at-a-time approach to the end-point: the standard
//     technique, and the thing Labster's teaching notes say students find hardest (reading the burette, going slowly near the
//     change). Their lab, art and scoring are left behind;
//   - PhET "Acid-Base Solutions" (teacher guide): students confuse strength with concentration, and see pH as a measure of
//     strength. The card keeps to strong acids so that concentration is the only thing that varies, which is the cleaner
//     lesson, and refuses weak acids rather than draw them badly;
//   - the RSC's teaching notes on the pH scale: students read it as linear (pH 4 "twice as acidic" as pH 8). A tenfold dilution
//     that visibly moves the colour exactly one step is the cure, and PhET's pH Scale makes the same point with a log/linear
//     switch.
// Refused: a pH curve (a graph to read, not a move), weak acids and buffers (a different idea), swirling and a wash bottle
//   (craft that does not change the chemistry), and calculating the concentration inside the card (it needs typing, and the
//   marked card shows the working instead).

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { SolutionsView } from './View'

export const ACIDS = { 'hydrochloric acid': 'HCl', 'nitric acid': 'HNO3' } as const
export const ALKALIS = { 'sodium hydroxide': 'NaOH', 'potassium hydroxide': 'KOH' } as const
export const INDICATORS = ['phenolphthalein', 'methyl orange'] as const
export type IndicatorName = (typeof INDICATORS)[number]

export const VOLUMES = [20, 25] as const
export const CONCS = [0.05, 0.1, 0.2] as const
export const DILUTE_CONCS = [0.1, 0.01] as const

/** One drop, in cm3, and the burette's size. */
export const DROP = 0.05
export const DROPS_PER_CM3 = 20
export const BURETTE_CM3 = 50
export const MAX_DROPS = BURETTE_CM3 * DROPS_PER_CM3
/** The most titrant a card may need, leaving room above the end-point to overshoot into. */
export const MAX_NEED_CM3 = 45
export const MIN_NEED_CM3 = 5
export const MAX_TUBES = 5

export type SolutionsConfig =
  /** flask and burette hold an acid and an alkali, either way round; names that are not drawn still parse and fault says so. */
  | { task: 'titrate'; flask: string; burette: string; indicator: string; flaskVolume: number; flaskConc: number; buretteConc: number }
  /** substance: an acid or an alkali; concentration in mol/dm3; target: the pH the last tube must show. */
  | { task: 'dilute'; substance: string; concentration: number; target: number }

/** drops: titrant let out so far. steps: tubes made after the first. */
export type SolutionsState = { drops?: number; steps?: number }

const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
const isAcid = (s: string) => has(ACIDS, s)
const isAlkali = (s: string) => has(ALKALIS, s)
const known = (s: string) => isAcid(s) || isAlkali(s)

export const formulaOf = (s: string): string => (isAcid(s) ? ACIDS[s as keyof typeof ACIDS] : isAlkali(s) ? ALKALIS[s as keyof typeof ALKALIS] : s)

// ---------------------------------------------------------------------------
// Titration chemistry. Integer units wherever equality matters: concentrations in 0.05 mol/dm3, volumes in drops.

const unitsOf = (c: number) => Math.round(c * 20)

type Titr = Extract<SolutionsConfig, { task: 'titrate' }>

/** The drops that neutralise the flask exactly: n(flask) = n(burette), one to one. */
export function equivalenceDrops(c: Titr): number {
  return (unitsOf(c.flaskConc) * c.flaskVolume * 20) / unitsOf(c.buretteConc)
}
export const equivalenceCm3 = (c: Titr) => equivalenceDrops(c) * DROP

/** The pH in the flask after `drops` of titrant. Exactly 7 at equivalence; an excess of one drop is a pH of 10 or 4. */
export function phAt(c: Titr, drops: number): number {
  const excess = unitsOf(c.flaskConc) * c.flaskVolume * 20 - unitsOf(c.buretteConc) * drops
  if (excess === 0) return 7
  // excess is in units of 0.05 mol/dm3 x cm3 / 20, so this is mmol; mmol per cm3 is mol/dm3.
  const mmol = (Math.abs(excess) * 0.05) / 20
  const conc = mmol / (c.flaskVolume + drops * DROP)
  const acidic = (excess > 0) === isAcid(c.flask)
  return acidic ? -Math.log10(conc) : 14 + Math.log10(conc)
}

/** [pH where the colour starts to change, where it is done, colour below is 'acid form']. */
export const RANGES: Record<IndicatorName, { lo: number; hi: number }> = {
  phenolphthalein: { lo: 8.2, hi: 10.0 },
  'methyl orange': { lo: 3.1, hi: 4.4 },
}
const isIndicator = (s: string): s is IndicatorName => has(RANGES, s)

/** How far the indicator has gone from its low-pH colour to its high-pH colour, 0 to 1. */
export function indicatorFrac(ind: string, ph: number): number {
  const r = isIndicator(ind) ? RANGES[ind] : RANGES.phenolphthalein
  return Math.max(0, Math.min(1, (ph - r.lo) / (r.hi - r.lo)))
}
const highForm = (c: Titr, drops: number) => indicatorFrac(c.indicator, phAt(c, drops)) >= 0.5

/** The first drop at which the indicator has passed the middle of its change. */
export function endpointDrops(c: Titr): number {
  const start = highForm(c, 0)
  for (let d = 1; d <= MAX_DROPS; d++) if (highForm(c, d) !== start) return d
  return MAX_DROPS
}

/** The drops let out, read safely. */
export function dropsOf(state: SolutionsState): number {
  const d = state && typeof state === 'object' ? state.drops : 0
  return typeof d === 'number' && Number.isFinite(d) ? Math.max(0, Math.min(MAX_DROPS, Math.round(d))) : 0
}
export function stepsOf(state: SolutionsState): number {
  const s = state && typeof state === 'object' ? state.steps : 0
  return typeof s === 'number' && Number.isFinite(s) ? Math.max(0, Math.min(MAX_TUBES, Math.round(s))) : 0
}

export const GRACE = 1

export type Verdict = 'early' | 'right' | 'late'
export function titrationVerdict(c: Titr, drops: number): Verdict {
  const e = endpointDrops(c)
  return drops < e ? 'early' : drops <= e + GRACE ? 'right' : 'late'
}

// ---------------------------------------------------------------------------
// Dilution chemistry.

type Dil = Extract<SolutionsConfig, { task: 'dilute' }>

export function startPh(c: Dil): number {
  const p = Math.round(-Math.log10(c.concentration))
  return isAcid(c.substance) ? p : 14 - p
}
/** The pH of tube `n` (0 is the starting solution): one unit towards 7 per tenfold dilution. */
export const tubePh = (c: Dil, n: number) => startPh(c) + (isAcid(c.substance) ? n : -n)
export const stepsNeeded = (c: Dil) => Math.abs(c.target - startPh(c))

/** The targets a dilution of this solution can reach: one to five tubes away, short of neutral. */
export function reachable(c: Dil): number[] {
  const s = startPh(c)
  const out: number[] = []
  for (let n = 1; n <= MAX_TUBES; n++) {
    const t = isAcid(c.substance) ? s + n : s - n
    if (t >= 1 && t <= 14 && Math.abs(t - 7) >= 1) out.push(t)
  }
  return out
}

// ---------------------------------------------------------------------------
// Marking.

export function done(config: SolutionsConfig, state: SolutionsState): boolean {
  if (config.task === 'titrate') return titrationVerdict(config, dropsOf(state)) === 'right'
  return stepsOf(state) === stepsNeeded(config)
}

export const cm3 = (drops: number) => (drops * DROP).toFixed(2)
const num = (c: number) => (c >= 0.1 ? c.toFixed(3) : c.toFixed(3))

export function workingTitrate(c: Titr, drops: number): string {
  const eq = equivalenceCm3(c)
  const mol = (unitsOf(c.buretteConc) * 0.05 * eq) / 1000
  return `Yes. The colour changed at ${cm3(drops)} cm³.
The flask was exactly neutral at ${eq.toFixed(2)} cm³. ${formulaOf(c.burette)}: ${num(c.buretteConc)} × ${eq.toFixed(2)} ÷ 1000 = ${mol.toFixed(5)} mol, which reacts one to one with ${formulaOf(c.flask)}. So ${c.flaskVolume.toFixed(1)} cm³ of the flask held ${num(c.flaskConc)} mol/dm³.`
}

export function madeTitrate(c: Titr, drops: number): string {
  const v = titrationVerdict(c, drops)
  if (v === 'early') return drops === 0 ? 'Nothing has been added yet, so the colour has not changed.' : `${cm3(drops)} cm³ has been added and the colour has not changed yet.`
  return `You stopped at ${cm3(drops)} cm³, and the colour had already changed before you stopped. A real titration cannot be undone: start again and go in drops as the flask begins to change.`
}

const WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' }
export const word = (n: number) => WORDS[n] ?? String(n)

export function workingDilute(c: Dil, steps: number): string {
  const s = startPh(c)
  return `Yes. The last tube is pH ${c.target}.
Each tube is ten times more dilute than the one before, and the pH moves one whole unit towards 7 each time. From pH ${s} that took ${steps} ${steps === 1 ? 'tube' : 'tubes'}: ${Math.pow(10, steps).toLocaleString('en-GB')} times less concentrated, not ${steps} times.`
}
export function madeDilute(c: Dil, steps: number): string {
  const p = tubePh(c, steps)
  if (steps === 0) return 'No tube has been added, so the last tube is still the starting solution.'
  return `You made ${steps} ${steps === 1 ? 'tube' : 'tubes'}, so the last tube is a pH ${p} solution, not the target.`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[^a-z0-9.]+/g, ' ').replace(/\s+/g, ' ').trim() : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

const SUBSTANCE_WORDS: Record<string, string> = {
  'hydrochloric acid': 'hydrochloric acid', hcl: 'hydrochloric acid', hydrochloric: 'hydrochloric acid', 'dilute hydrochloric acid': 'hydrochloric acid', 'dilute hcl': 'hydrochloric acid',
  'nitric acid': 'nitric acid', hno3: 'nitric acid', nitric: 'nitric acid', 'dilute nitric acid': 'nitric acid',
  'sodium hydroxide': 'sodium hydroxide', naoh: 'sodium hydroxide', 'sodium hydroxide solution': 'sodium hydroxide', 'caustic soda': 'sodium hydroxide',
  'potassium hydroxide': 'potassium hydroxide', koh: 'potassium hydroxide', 'potassium hydroxide solution': 'potassium hydroxide',
  acid: 'hydrochloric acid', 'a strong acid': 'hydrochloric acid', 'strong acid': 'hydrochloric acid', alkali: 'sodium hydroxide', base: 'sodium hydroxide', 'a strong alkali': 'sodium hydroxide', 'strong alkali': 'sodium hydroxide',
}
const INDICATOR_WORDS: Record<string, IndicatorName> = {
  phenolphthalein: 'phenolphthalein', phenol: 'phenolphthalein', pp: 'phenolphthalein', 'methyl orange': 'methyl orange', methylorange: 'methyl orange', mo: 'methyl orange', methyl: 'methyl orange',
}
const TASK_WORDS: Record<string, 'titrate' | 'dilute'> = {
  titrate: 'titrate', titration: 'titrate', titrations: 'titrate', titre: 'titrate', burette: 'titrate', endpoint: 'titrate', 'end point': 'titrate', neutralise: 'titrate', neutralisation: 'titrate', neutralization: 'titrate',
  'acid base titration': 'titrate', 'find the end point': 'titrate', 'conical flask': 'titrate', 'add drops': 'titrate',
  dilute: 'dilute', dilution: 'dilute', dilutions: 'dilute', 'serial dilution': 'dilute', 'serial dilutions': 'dilute', ph: 'dilute', 'ph scale': 'dilute', 'universal indicator': 'dilute', 'tenfold dilution': 'dilute', concentration: 'dilute',
}

function readSubstance(raw: unknown): string | null {
  if (raw === undefined) return ''
  if (typeof raw !== 'string') return null
  const k = keyOf(raw).replace(/^(?:a|an|the|some)\s+/, '').replace(/\s+solution$/, '')
  return has(SUBSTANCE_WORDS, k) ? SUBSTANCE_WORDS[k] : k
}
function readIndicator(raw: unknown): string | null {
  if (raw === undefined) return 'phenolphthalein'
  if (typeof raw !== 'string') return null
  const k = keyOf(raw).replace(/\s+indicator$/, '')
  return has(INDICATOR_WORDS, k) ? INDICATOR_WORDS[k] : k
}
/** A number from 25, "25 cm3", "0.1 mol/dm3", "0.1 M", "pH 5". */
function readNumber(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const m = raw.replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}

const nearest = <T extends number>(list: readonly T[], x: number): T => list.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best))
const flaskDefault = (burette: string) => (isAcid(burette) ? 'sodium hydroxide' : 'hydrochloric acid')

/** What a prompt can safely say: the gesture and the aim. */
const goodPrompt = (c: SolutionsConfig) => (c.task === 'titrate'
  ? 'Open the tap to let the burette run into the flask: use the buttons to add titrant, a few cm³ at a time and then a drop at a time. Stop as soon as the indicator has changed colour.'
  : `Add tubes to the rack: each new tube is 1 cm³ of the one before made up to 10 cm³ with water. Keep going until the last tube is the colour of pH ${c.target} on the chart.`)

export const solutionsEngine: SceneEngine<SolutionsConfig, SolutionsState> = {
  id: 'solutions-ph',
  // Few words, since `scenesFor` matches a covers word by its first five letters ("neutralisation" would catch "neutrons").
  // Everything else is a whole phrase, matched token for token.
  covers: ['titration', 'burette', 'litmus', 'phenolphthalein', 'acidity', 'alkalinity'],
  phrases: [
    'neutralisation', 'neutralization', 'neutralisation reactions', 'acid alkali', 'acids alkalis', 'acids bases', 'acid base', 'acid base reactions', 'acid base indicators',
    'universal indicator', 'methyl orange', 'indicators scale', 'indicators acids', 'acidic alkaline', 'acidic neutral alkaline', 'preparation salts', 'concentration solutions', 'diluting acids', 'dilution acids',
    'acids reacting', 'properties acids', 'properties alkalis', 'strong acids alkalis',
  ],
  notFor: [
    'amino acid', 'amino acids', 'nucleic acid', 'nucleic acids', 'fatty acid', 'fatty acids', 'carboxylic acid', 'carboxylic acids', 'organic acids', 'acid rain', 'acid deposition', 'ocean acidification', 'stomach acid',
    'alkali metal', 'alkali metals', 'alkaline earth', 'alkaline batteries', 'alkaline battery', 'alkaline cells', 'number bases', 'number base', 'base pairs', 'base pair', 'dna bases', 'base units', 'base ten',
    'economic indicators', 'indicator species', 'key indicators', 'performance indicators', 'weak acids', 'weak acid', 'weak alkali', 'weak alkalis', 'buffer', 'buffers', 'buffer solutions', 'dissociation constant', 'dissociation constants',
    'acid dissociation', 'strong weak acids', 'strong and weak', 'lewis acids', 'lewis acid', 'bronsted lowry', 'organic chemistry', 'esterification', 'acid halides', 'acyl chlorides',
    'solubility', 'saturated solutions', 'solvents solutes', 'quadratic equations', 'simultaneous equations', 'solving equations', 'solution equations',
  ],
  // The learner varies a quantity continuously: drops of titrant, or the number of tenfold dilutions.
  isolates: 'magnitude',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const word = keyOf(rawTask)
    if (word && !has(TASK_WORDS, word)) return null
    const hasTitr = ['flask', 'burette', 'indicator', 'flaskVolume', 'flaskConc', 'buretteConc', 'titrant'].some((k) => src[k] !== undefined)
    const hasDil = ['target', 'substance', 'concentration', 'targetPh'].some((k) => src[k] !== undefined)
    const task = word ? TASK_WORDS[word] : hasTitr ? 'titrate' : hasDil ? 'dilute' : null
    if (!task) return null

    if (task === 'titrate') {
      const flaskRaw = first(src, ['flask', 'conical flask', 'acid', 'alkali', 'solution'])
      const buretteRaw = first(src, ['burette', 'titrant', 'added'])
      let flask = readSubstance(flaskRaw)
      let burette = readSubstance(buretteRaw)
      const indicator = readIndicator(first(src, ['indicator']))
      if (flask === null || burette === null || indicator === null) return null
      if (!flask && !burette) flask = 'hydrochloric acid'
      if (!burette) burette = flaskDefault(flask)
      if (!flask) flask = flaskDefault(burette)
      const vol = readNumber(first(src, ['flaskVolume', 'flask_volume', 'volume', 'flaskVol']))
      const fc = readNumber(first(src, ['flaskConc', 'flask_conc', 'flaskConcentration', 'concentration']))
      const bc = readNumber(first(src, ['buretteConc', 'burette_conc', 'buretteConcentration', 'titrantConc']))
      if (vol === null || fc === null || bc === null) return null
      return { task, flask, burette, indicator, flaskVolume: vol ?? 25, flaskConc: fc ?? 0.1, buretteConc: bc ?? 0.1 }
    }
    const substance = readSubstance(first(src, ['substance', 'solution', 'acid', 'alkali', 'liquid', 'start']))
    const conc = readNumber(first(src, ['concentration', 'conc', 'molarity']))
    const target = readNumber(first(src, ['target', 'targetPh', 'target_ph', 'ph', 'aim', 'goal']))
    if (substance === null || conc === null || target === null) return null
    return { task, substance: substance || 'hydrochloric acid', concentration: conc ?? 0.1, target: target ?? 4 }
  },

  faults(c) {
    const out: string[] = []
    const weak = (s: string) => /ethanoic|acetic|citric|carbonic|ammonia|weak|carbonate|sulfuric|sulphuric|phosphoric|oxalic|lactic/.test(s)
    const note = (s: string) => (weak(s) ? ' (weak acids and alkalis, and sulfuric acid with two hydrogens, are not drawn)' : '')
    const list = 'hydrochloric acid, nitric acid, sodium hydroxide, potassium hydroxide'
    if (c.task === 'titrate') {
      if (!known(c.flask)) out.push(`"${c.flask}"${note(c.flask)} is not a solution this card draws: use one of ${list}, e.g. flask "${isAcid(c.burette) ? 'sodium hydroxide' : 'hydrochloric acid'}".`)
      if (!known(c.burette)) out.push(`"${c.burette}"${note(c.burette)} is not a solution this card draws: use one of ${list}, e.g. burette "${isAlkali(c.flask) ? 'hydrochloric acid' : 'sodium hydroxide'}".`)
      if (known(c.flask) && known(c.burette) && isAcid(c.flask) === isAcid(c.burette)) {
        out.push(`the flask and the burette are both ${isAcid(c.flask) ? 'acids' : 'alkalis'}, which do not neutralise each other: use e.g. burette "${isAcid(c.flask) ? 'sodium hydroxide' : 'hydrochloric acid'}".`)
      }
      if (!isIndicator(c.indicator)) out.push(`there is no "${c.indicator}" indicator here (universal indicator and litmus change too gradually to find an end-point): use phenolphthalein or methyl orange, e.g. indicator "phenolphthalein".`)
      if (!(VOLUMES as readonly number[]).includes(c.flaskVolume)) out.push(`the flask volume ${c.flaskVolume} cm³ is not one the card draws (20 or 25): use e.g. flaskVolume ${nearest(VOLUMES, c.flaskVolume)}.`)
      if (!(CONCS as readonly number[]).includes(c.flaskConc)) out.push(`the flask concentration ${c.flaskConc} mol/dm³ is not one the card draws (0.05, 0.1 or 0.2): use e.g. flaskConc ${nearest(CONCS, c.flaskConc)}.`)
      if (!(CONCS as readonly number[]).includes(c.buretteConc)) out.push(`the burette concentration ${c.buretteConc} mol/dm³ is not one the card draws (0.05, 0.1 or 0.2): use e.g. buretteConc ${nearest(CONCS, c.buretteConc)}.`)
      if (!out.length) {
        const need = equivalenceCm3(c)
        if (need > MAX_NEED_CM3 || need < MIN_NEED_CM3) {
          const fix = CONCS.find((bc) => {
            const e = (unitsOf(c.flaskConc) * c.flaskVolume) / unitsOf(bc)
            return e <= MAX_NEED_CM3 && e >= MIN_NEED_CM3
          })
          out.push(`that mix needs ${Number(need.toFixed(2))} cm³ from the burette, ${need > MAX_NEED_CM3 ? `more than a 50 cm³ burette can show with room to spare (${MAX_NEED_CM3})` : `too little to show a drop-by-drop approach (${MIN_NEED_CM3} or more)`}: use e.g. buretteConc ${fix ?? 0.1}.`)
        }
      }
      return out
    }
    if (!known(c.substance)) out.push(`"${c.substance}"${note(c.substance)} is not a solution this card draws: use one of ${list}, e.g. substance "hydrochloric acid".`)
    if (!(DILUTE_CONCS as readonly number[]).includes(c.concentration)) out.push(`the concentration ${c.concentration} mol/dm³ is not one the card draws (0.1 or 0.01): use e.g. concentration ${nearest(DILUTE_CONCS, c.concentration)}.`)
    if (!out.length) {
      const ok = reachable(c)
      if (!ok.includes(c.target)) {
        const pick = ok.reduce((best, t) => (Math.abs(t - c.target) < Math.abs(best - c.target) ? t : best), ok[Math.floor(ok.length / 2)])
        out.push(`pH ${c.target} is not one that diluting ${isAcid(c.substance) ? 'an acid' : 'an alkali'} of pH ${startPh(c)} can reach in up to ${MAX_TUBES} tubes (dilution only moves it towards 7, and never as far as 7): use e.g. target ${pick}.`)
      }
    }
    return out
  },

  promptFaults(c, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(c)
    const out: string[] = []
    if (c.task === 'titrate') {
      const volume = /\b\d+(?:\.\d+)?\s*(?:cm3|cm³|ml|cc|drops?)(?![\w³])/i.test(text.replace(/\b(?:25|20)(?:\.0)?\s*(?:cm3|cm³|ml)\s+(?:of|flask)\b/gi, ''))
        || /\b(?:one|two|three|a single|a few)\s+drops?\b/i.test(text) || /\bjust\s+(?:past|after|over)\b|\bone\s+(?:more\s+)?drop\b|\bequivalence\b|\bexactly\s+neutral/i.test(text)
      const colour = /\bturns?\s+(?:pink|colourless|yellow|orange|red)\b|\b(?:pink|yellow|orange|red)\s+(?:permanently|persists)\b|\bfaint\s+pink\b|\bwhen\s+(?:the\s+)?(?:flask|solution)\s+(?:is|turns|goes)\b/i.test(text)
      if (volume || colour) out.push(`the prompt gives the answer away: it names an amount or a colour for the end-point, which the learner is to find by watching the flask -- ask for the outcome only ("${example}")`)
    } else {
      const many = /\b(?:\d+|one|two|three|four|five)\s+(?:tubes?|dilutions?|steps?|times|stages?)\b|\btenfold\b|\bten times\b|\b10\s*(?:times|fold|x)\b|\b(?:100|1000|10000)(?:-| )?(?:fold|times)\b|\bfactor\b|\bone\s+(?:whole\s+)?(?:ph\s+)?unit\b|÷|\blog(?:arithm)/i.test(text)
      if (many) out.push(`the prompt gives the answer away: it says how many tubes or what each does to the pH, which the learner is to find from the colours -- ask for the outcome only ("${example}")`)
    }
    if (/\bswirl|\bwash bottle|\bpipette\b|\bcalculate\b|\bgraph\b|\bcurve\b|\bdrag\b|\btype (?:in|the)\b|\benter the\b|\bmoles?\b|\bburette reading to\b|\bweak\b/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws a burette, a flask and the indicator colour (or a rack of tubes), operated with buttons, with no swirling, calculating or graph -- ask for that ("${example}")`)
    }
    return out
  },

  initial(c) {
    return c.task === 'titrate' ? { drops: 0 } : { steps: 0 }
  },

  check(c, s) {
    return { ok: done(c, s), wrongIds: [] }
  },

  solve(c) {
    return c.task === 'titrate' ? { drops: endpointDrops(c) } : { steps: stepsNeeded(c) }
  },

  View: SolutionsView,

  prompt: `SCENE "solutions-ph" -- real glassware on a quiet light panel.
  titrate: a burette (graduated 0 to 50 cm³, with a tap and a meniscus) over a conical flask on a white tile. The flask holds a measured volume of a strong acid or alkali with an indicator in it. Buttons let out titrant: 5 cm³, 1 cm³ or one drop (0.05 cm³) at a time, and the burette reading counts up. The flask stays one colour for a long time, then a single drop snaps it to the other. A titrant cannot be taken back: "Start again" refills the burette.
  dilute: a rack of test tubes of universal indicator. The first tube holds a strong acid or alkali; each tube added is 1 cm³ of the last made up to 10 cm³ with water, and the colour moves along. A colour chart of pH 1 to 14 below the rack has the target ringed.
  For: titration, burettes, indicators (phenolphthalein, methyl orange), neutralisation of an acid by an alkali, finding a concentration, the end-point, the pH scale and dilution, acids and alkalis. It answers "pH 3 is only a bit more acidic than pH 4" (it is ten times more concentrated), "you can go back a bit past the end-point" and "the colour changes gradually".
  Strong acids and alkalis only (hydrochloric acid, nitric acid, sodium hydroxide, potassium hydroxide). Not for: weak acids, buffers, sulfuric acid, pH curves, strength versus concentration of weak acids, amino or fatty acids, acid rain, solutions of equations.
  titrate config: flask and burette are one acid and one alkali, either way round; indicator "phenolphthalein" or "methyl orange"; flaskVolume 20 or 25 (cm³); flaskConc and buretteConc each 0.05, 0.1 or 0.2 (mol/dm³). The mix must need 5 to 45 cm³ from the burette. Marked right when the learner stops on the drop where the indicator has just changed (or the next drop); stopping early or going past is wrong.
  dilute config: substance (an acid or an alkali, strong), concentration 0.1 or 0.01 (mol/dm³, pH 1 or 2 for an acid, 13 or 12 for an alkali), target pH reachable in 1 to 5 tubes and never 7 (acid of 0.1: 2 to 6; 0.01: 3 to 6; alkali 0.1: 12 to 8; 0.01: 11 to 8). Marked right when the last tube is the target.
  Before marking the card shows the glassware, the indicator colour, the burette reading and the chart. It holds back the volume at the end-point, the concentration working and the number of tubes. Marking gives them with the reason; when wrong it says what was made. The prompt must ask for the outcome only: do NOT give a volume, a number of drops, tubes or dilutions, the colour at the end-point, or say each tube is ten times more dilute.
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Open the tap to let the burette run into the flask: use the buttons to add titrant, a few cm³ at a time and then a drop at a time. Stop as soon as the indicator has changed colour.",
    "payload": { "engine":"solutions-ph", "config": { "task":"titrate", "flask":"hydrochloric acid", "burette":"sodium hydroxide", "indicator":"phenolphthalein", "flaskVolume":25, "flaskConc":0.1, "buretteConc":0.2 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:solutions-ph", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Add tubes to the rack: each new tube is 1 cm³ of the one before made up to 10 cm³ with water. Keep going until the last tube is the colour of pH 5 on the chart.",
    "payload": { "engine":"solutions-ph", "config": { "task":"dilute", "substance":"hydrochloric acid", "concentration":0.1, "target":5 } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"magnitude", "apparatus":"scene:solutions-ph", "why":"..." } }`,
}

registerEngine(solutionsEngine as SceneEngine<unknown, unknown>)
