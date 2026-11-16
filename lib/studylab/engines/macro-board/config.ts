// lib/studylab/engines/macro-board/config.ts
//
// The economy as one real machine, after Bill Phillips's water computer of 1949: a glass tank where the water is the
// money going round. Three pipes pour in at the top (investment, government spending, exports), three drain from the floor
// (saving, tax, imports). The learner has one lever, and a lever is only ever a way of turning certain valves:
//   steer    -- something has knocked spending, and the water stands away from the full-capacity mark. Bring it back;
//   conflict -- costs have jumped, so the mark where prices are steady has slid down below the mark where everyone works.
//               Reach the one you are asked for, and see what the other costs.
//
// The rules, all computed here and never read from the drawing. With J pouring in ($bn a year) and a share L of every
// dollar leaking away (%), the level moves by J - L x level / 100 and stops at level = 100 J / L. That is the income-expenditure
// model and its multiplier 100 / L, exactly, and the reason the water stops by itself: the leaks run harder the higher it stands.
// With the starting valves J = L = 40, so full capacity is $100bn, and the level is on the mark exactly when J = L.
//
// One level drives both results, and that is the idea of the card:
//   below full capacity a worker the water has not reached is out of work: unemployment 4% + 0.4 points per $1bn under $95bn;
//   above the prices-steady mark a tag the water has passed is lit: inflation 2% + 0.3 points per $1bn over the mark + $5bn.
// A demand shock leaves the two marks together, so one level fixes both. A cost shock pulls them apart by $30bn.
// These are teaching numbers, chosen to read and to count, and the catalogue says the machine is a simple model and no forecast.
//
// Facts:
//   - higher interest rates make borrowing dearer so firms invest less, and pay savers more so they save rather than spend:
//     Bank of England, "Why are interest rates in the UK going up?" (explainer). Hence two valves on that lever;
//   - a stronger exchange rate makes exports dearer abroad and imports cheaper at home; injections and leakages, the multiplier,
//     demand-pull and cost-push inflation and the conflicts between macroeconomic aims: Cambridge IGCSE Economics 0455 section 4,
//     AS & A Level 9708. Written from general knowledge of those syllabuses, not checked against the documents in this build.
//
// Ideas taken, never code or art:
//   - water as money, valves as policy, tax and imports as drains, and that watching it run made it far easier to see how the parts
//     depend on each other: the Phillips Machine, or MONIAC (Wikipedia's account of it). Its treasury tank, floats, cords and pumps are left behind;
//   - a decision that works through a transmission mechanism and takes time to arrive: Eureka Simulations' "Chair the MPC", which
//     has its learner set Bank Rate over six rounds. Its rounds, quantitative easing and forward guidance are left behind;
//   - the misconceptions. Good things are assumed to go together, so "a good policy brings jobs and low prices": the good-begets-good
//     heuristic (Leiser & Aroch, Applied Psychology 2009, read in summary), which the split marks answer. People expect a level to
//     copy its inflow, and misjudge when it moves and by how much: Booth Sweeney & Sterman, "Bathtub Dynamics" (2000), which is
//     why the leaks visibly thicken as the water climbs, and why the rise is bigger than the turn of the valve.
// Refused:
//   - four dials and two gauges: the obvious card, and it would show that policy has effects without showing any reason why;
//   - AD/AS curves: a graph of the same idea, one more picture to decode, and supply-demand already draws that kind of diagram;
//   - the production possibility curve, which the coverage map grouped here: a different idea, with a different act, needing its own scene;
//   - round-by-round lags, the budget deficit, the current account, money creation and supply-side policy: more labels, and no new act.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { MacroBoardView } from './View'

export const LEVERS = ['interest', 'tax', 'spending', 'exchange'] as const
export type Lever = (typeof LEVERS)[number]
export const DEMAND_SHOCKS = ['investment-fall', 'exports-fall', 'saving-rise', 'saving-fall', 'investment-rise', 'exports-rise'] as const
export const COST_SHOCKS = ['oil', 'harvest'] as const
export const AIMS = ['prices', 'jobs'] as const
export type Aim = (typeof AIMS)[number]
export const TASKS = ['steer', 'conflict'] as const

/** What the writer asked for. A word outside the lists still parses, and faults says what would work. */
export type MacroConfig = { task: string; shock: string; lever: string; aim: string }
/** How many clicks the lever has been moved from where it started. */
export type MacroState = { step: number }

export type Pipe = 'investment' | 'government' | 'exports' | 'saving' | 'tax' | 'imports'
/** The first three are $bn a year pouring in; the last three are the % of each dollar that leaks away. */
export type Flows = Record<Pipe, number>
export const IN_PIPES: Pipe[] = ['investment', 'government', 'exports']
export const OUT_PIPES: Pipe[] = ['saving', 'tax', 'imports']
export const BASE: Flows = { investment: 10, government: 20, exports: 10, saving: 10, tax: 20, imports: 10 }

export const FULL_CAPACITY = 100
/** Where prices are steady once costs have jumped. */
export const COST_MARK = 70
/** On the mark means within this much of it. Within it no worker is out and no tag is lit. */
export const BAND = 5
export const MIN_LEVEL = 60
export const MAX_LEVEL = 150
export const MAX_STEPS = 4

type LeverInfo = {
  name: string
  /** In a sentence. */
  said: string
  moves: Partial<Flows>
  value(step: number): string
  less: string
  more: string
}

export const LEVER_INFO: Record<Lever, LeverInfo> = {
  interest: { name: 'Interest rate', said: 'the interest rate', moves: { investment: -2, saving: 2 }, value: (k) => `${5 + k}%`, less: 'Lower the interest rate', more: 'Raise the interest rate' },
  tax: { name: 'Tax rate', said: 'the tax rate', moves: { tax: 4 }, value: (k) => `${20 + 4 * k}%`, less: 'Lower the tax rate', more: 'Raise the tax rate' },
  spending: { name: 'Government spending', said: 'government spending', moves: { government: 4 }, value: (k) => `$${20 + 4 * k}bn`, less: 'Lower government spending', more: 'Raise government spending' },
  exchange: { name: 'Exchange rate', said: 'the exchange rate', moves: { exports: -2, imports: 2 }, value: (k) => `$${(1 + k / 10).toFixed(2)}`, less: 'Lower the exchange rate', more: 'Raise the exchange rate' },
}

type ShockInfo = { kind: 'slump' | 'boom' | 'cost'; pipe: Pipe; by: number; story: string }

export const SHOCK_INFO: Record<string, ShockInfo> = {
  'investment-fall': { kind: 'slump', pipe: 'investment', by: -8, story: 'Firms have stopped investing.' },
  'exports-fall': { kind: 'slump', pipe: 'exports', by: -8, story: 'The world is buying fewer of our exports.' },
  'saving-rise': { kind: 'slump', pipe: 'saving', by: 12, story: 'People are worried: they save more and spend less.' },
  'saving-fall': { kind: 'boom', pipe: 'saving', by: -8, story: 'People feel well off: they save less and spend more.' },
  'investment-rise': { kind: 'boom', pipe: 'investment', by: 8, story: 'Firms are investing heavily.' },
  'exports-rise': { kind: 'boom', pipe: 'exports', by: 12, story: 'The world is buying far more of our exports.' },
  oil: { kind: 'cost', pipe: 'imports', by: 8, story: 'The oil we import has doubled in price, so costs are up.' },
  harvest: { kind: 'cost', pipe: 'imports', by: 8, story: 'The harvest has failed, so food is imported and costs more.' },
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
export const isLever = (l: string): l is Lever => (LEVERS as readonly string[]).includes(l)
export const isCost = (config: MacroConfig) => has(SHOCK_INFO, config.shock) && SHOCK_INFO[config.shock].kind === 'cost'
/** A config faults refuses still gets a machine, so nothing can crash on it. */
const leverOf = (config: MacroConfig): Lever => (isLever(config.lever) ? config.lever : 'interest')
const shockOf = (config: MacroConfig): ShockInfo => (has(SHOCK_INFO, config.shock) ? SHOCK_INFO[config.shock] : SHOCK_INFO['investment-fall'])
export const leverInfo = (config: MacroConfig) => LEVER_INFO[leverOf(config)]
export const shockInfo = (config: MacroConfig) => shockOf(config)
export const movedPipes = (config: MacroConfig) => Object.keys(leverInfo(config).moves) as Pipe[]

// ---------------------------------------------------------------------------
// The machine.

/** The valves after the shock, and after `step` clicks of the lever. A valve cannot close further than shut. */
export function flowsOf(config: MacroConfig, step: number): Flows {
  const shock = shockOf(config)
  const moves = leverInfo(config).moves
  const out = { ...BASE }
  out[shock.pipe] += shock.by
  for (const pipe of movedPipes(config)) out[pipe] = out[pipe] + (moves[pipe] ?? 0) * step
  for (const pipe of [...IN_PIPES, ...OUT_PIPES]) out[pipe] = Math.max(0, out[pipe])
  return out
}

export const pouring = (f: Flows) => f.investment + f.government + f.exports
export const leaking = (f: Flows) => f.saving + f.tax + f.imports
/** Where the water stops: what leaks out matches what pours in. */
export const levelOf = (f: Flows) => (100 * pouring(f)) / leaking(f)

const levelAt = (config: MacroConfig, step: number) => levelOf(flowsOf(config, step))
const inTank = (level: number) => level >= MIN_LEVEL && level <= MAX_LEVEL

/** How far the lever goes each way: to the end of its travel, or to where the tank runs dry or brims. */
export function stepRange(config: MacroConfig): { min: number; max: number } {
  let min = 0
  let max = 0
  while (min > -MAX_STEPS && inTank(levelAt(config, min - 1))) min--
  while (max < MAX_STEPS && inTank(levelAt(config, max + 1))) max++
  return { min, max }
}

/** The state, read safely: anything else counts as the lever where it started, and it stays within its travel. */
export function stepOf(config: MacroConfig, state: MacroState): number {
  const raw = state?.step
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return 0
  const { min, max } = stepRange(config)
  return Math.max(min, Math.min(max, raw))
}

export const priceMark = (config: MacroConfig) => (isCost(config) ? COST_MARK : FULL_CAPACITY)
export const aimOf = (config: MacroConfig): Aim => (isCost(config) && config.aim === 'prices' ? 'prices' : 'jobs')
/** The mark the card asks for. */
export const targetMark = (config: MacroConfig) => (aimOf(config) === 'prices' ? COST_MARK : FULL_CAPACITY)

/** The workers on the left of the tank, as the levels they stand at. One the water has not reached is out of work. */
export const WORKER_RUNGS = [95, 85, 75, 65]
/** The five price tags on the right, starting just over the prices-steady mark. One the water has passed is lit. */
export function tagRungs(config: MacroConfig): number[] {
  return [0, 1, 2, 3, 4].map((k) => priceMark(config) + BAND + 10 * k)
}
export const workersOut = (level: number) => WORKER_RUNGS.filter((rung) => level < rung).length
export const tagsLit = (config: MacroConfig, level: number) => tagRungs(config).filter((rung) => level > rung).length

/** % out of work: the rate at full employment, and more as the level falls short of it. */
export const unemployment = (level: number) => 4 + 0.4 * Math.max(0, FULL_CAPACITY - BAND - level)
/** % a year: the target while the water is at or under the mark, and more as it goes past. */
export const inflation = (config: MacroConfig, level: number) => 2 + 0.3 * Math.max(0, level - priceMark(config) - BAND)

export const pct = (n: number) => `${Math.round(n)}%`
export const money = (n: number) => `$${Math.round(n)}bn`

// ---------------------------------------------------------------------------
// Marking: exact, from the valves. All the flows are whole numbers, so this compares without a float.

export function onMark(config: MacroConfig, step: number): boolean {
  const f = flowsOf(config, step)
  const mark = targetMark(config)
  const made = 100 * pouring(f)
  return (mark - BAND) * leaking(f) <= made && made <= (mark + BAND) * leaking(f)
}

// ---------------------------------------------------------------------------
// What is said once marked. Before that the card holds no verdict at all.

function whyLever(config: MacroConfig, step: number): string {
  const up = step > 0
  const from = leverInfo(config).value(0)
  const to = leverInfo(config).value(step)
  const moved = `from ${from} to ${to}`
  switch (leverOf(config)) {
    case 'interest':
      return up
        ? `You raised the interest rate ${moved}. Dearer borrowing means firms invest less, and saving pays more, so people spend less.`
        : `You cut the interest rate ${moved}. Cheaper borrowing means firms invest more, and saving pays less, so people spend more.`
    case 'tax':
      return up
        ? `You raised tax ${moved}. More of each wage leaks away, so less is spent again.`
        : `You cut tax ${moved}. People keep more of each wage, so more is spent again.`
    case 'exchange':
      return up
        ? `You raised the exchange rate ${moved}. Exports are dearer abroad, so less pours in; imports are cheaper here, so more leaks out.`
        : `You lowered the exchange rate ${moved}. Exports are cheaper abroad, so more pours in; imports are dearer here, so less leaks out.`
    default: {
      const gap = money(Math.abs(levelAt(config, step) - levelAt(config, 0)))
      return up
        ? `You raised government spending ${moved}, and income rose ${gap}: the multiplier. Each dollar is spent again, with some leaking away each time.`
        : `You cut government spending ${moved}, and income fell ${gap}: the multiplier works downwards too.`
    }
  }
}

/** What a correct card says: what the learner did, why it works, and the misconception it answers. */
export function working(config: MacroConfig, state: MacroState): string {
  const step = stepOf(config, state)
  const f = flowsOf(config, step)
  const level = levelOf(f)
  if (!isCost(config)) {
    return `Yes. Back at full capacity. ${whyLever(config, step)} Now ${money(pouring(f))} pours in and ${money(pouring(f))} leaks out, so the water holds still.`
  }
  const p = pct(inflation(config, level))
  const lead = aimOf(config) === 'prices' ? `Yes. Prices are steady at ${p}, but unemployment is ${pct(unemployment(level))}.` : `Yes. Jobs are back, but prices are rising at ${p}.`
  return `${lead} ${whyLever(config, step)} Costs pulled the two marks apart, so one level cannot reach both: the government must choose.`
}

/** What a wrong card says: what the learner made, never which way to go. */
export function madeText(config: MacroConfig, state: MacroState): string {
  const step = stepOf(config, state)
  const level = levelAt(config, step)
  const mark = targetMark(config)
  const name = mark === FULL_CAPACITY ? 'full capacity' : 'the prices-steady mark'
  const made = `at ${money(level)}, with unemployment ${pct(unemployment(level))} and inflation ${pct(inflation(config, level))}.`
  if (step === 0) return `The lever has not moved, so the water is still ${level < mark ? 'below' : 'above'} ${name}, ${made}`
  return `The water settled ${level < mark ? 'below' : 'above'} ${name}, ${made}`
}

// ---------------------------------------------------------------------------
// Reading the tutor's config.

const keyOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

/** Whatever way a writer names the event; order matters, since "cost-push inflation" holds the word inflation. */
function readShock(raw: string): string {
  const k = keyOf(raw)
  if (has(SHOCK_INFO, k)) return k
  const down = /fall|fell|falling|drop|collapse|slump|down|weak|fewer|less|lower|cut|decline|stop/.test(k)
  const up = /rise|rising|boom|up|more|strong|higher|increase|surge|heav/.test(k)
  if (/harvest|drought|crop|food/.test(k)) return 'harvest'
  if (/oil|fuel|energy|cost-push|costpush|stagflation|supply-shock|import-price/.test(k)) return 'oil'
  if (/export/.test(k)) return down ? 'exports-fall' : up ? 'exports-rise' : k
  if (/invest|confidence/.test(k)) return /confidence/.test(k) ? (/(rise|boom|up|more|high)/.test(k) ? 'investment-rise' : 'investment-fall') : down ? 'investment-fall' : up ? 'investment-rise' : k
  if (/sav/.test(k)) return up && !down ? 'saving-rise' : down ? 'saving-fall' : k
  if (/world-recession|global-recession/.test(k)) return 'exports-fall'
  if (/recession|slump|unemploy|depress|low-demand|demand-deficient|cyclical/.test(k)) return 'investment-fall'
  if (/boom|overheat|inflation|demand-pull|too-much-spending/.test(k)) return 'saving-fall'
  return k
}

function readLever(raw: string): string {
  const k = keyOf(raw)
  if (isLever(k)) return k
  if (/interest|monetary|bank-rate|base-rate|^rates?$|^mpr$|central-bank|money-supply/.test(k)) return 'interest'
  if (/exchange|currency|forex/.test(k)) return 'exchange'
  if (/supply-side|tariff|quota|minimum-wage|subsid/.test(k)) return k
  if (/(^|-)tax/.test(k)) return 'tax'
  if (/spending|expenditure|fiscal|budget|^government$|^g$/.test(k)) return 'spending'
  return k
}

function readAim(raw: string): string {
  const k = keyOf(raw)
  if (/price|inflation/.test(k)) return 'prices'
  if (/job|work|employ|capacity|growth|output/.test(k)) return 'jobs'
  return k
}

function readTask(raw: string): string {
  const k = keyOf(raw)
  if (/conflict|trade-?off|cost-push|stagflation|supply-shock|choose/.test(k)) return 'conflict'
  if (/steer|fix|stabili[sz]e|policy|correct|balance|make|restore|bring-back|shock/.test(k)) return 'steer'
  return k
}

/** What a prompt can safely say: the gesture and the mark, never which way or how far. */
function goodPrompt(config: MacroConfig): string {
  const name = leverInfo(config).name
  const gesture = `Tap the minus or plus on ${name} and watch the water settle.`
  if (!isCost(config)) return `${gesture} Bring it back to the full-capacity mark.`
  return aimOf(config) === 'prices' ? `${gesture} Bring it to the prices-steady mark, and see what happens to the workers.` : `${gesture} Bring it to the full-capacity mark, and see what happens to the price tags.`
}

/** The words for moving this lever, so a prompt about one lever is not refused for another's. */
const LEVER_WORDS: Record<Lever, string> = {
  interest: '(?:interest rates?|the rates?|rates|bank rate|base rate|cost of borrowing)',
  tax: '(?:tax(?:es|ation)?|income tax|tax rates?)',
  spending: '(?:government spending|public spending|government expenditure|public expenditure|the government spends?)',
  exchange: '(?:exchange rates?|the currency|its currency|our currency|our money)',
}
const MOVES = '(?:cut|cuts|cutting|lower|lowers|lowering|reduc\\w*|rais\\w*|increas\\w*|decreas\\w*|hik\\w*|boost\\w*|put up|putting up|bring down|bringing down|push up|push down|drop\\w*|tighten\\w*|eas(?:e|es|ing))'
const WAYS = '(?:up|down|higher|lower|rise|rises|rising|fall|falls|falling|more|less)'

export const macroBoardEngine: SceneEngine<MacroConfig, MacroState> = {
  id: 'macro-board',
  // Few and distinctive: `scenesFor` matches a covers word by its first five letters, so "inflation" here would catch
  // "inflammation", "recession" would catch "recessive" and "macroeconomics" would catch "macromolecules". The rest are whole phrases.
  covers: ['unemployment', 'stagflation'],
  phrases: [
    'macroeconomics', 'macroeconomic', 'macroeconomy', 'macro economy', 'macro economics', 'government and the macroeconomy',
    'fiscal policy', 'fiscal policies', 'monetary policy', 'monetary policies', 'fiscal and monetary', 'monetary and fiscal',
    'interest rate', 'interest rates', 'rate of interest', 'rates of interest',
    'inflation', 'demand pull', 'cost push', 'price stability', 'full employment',
    'recession', 'recessions', 'business cycle', 'business cycles', 'trade cycle', 'trade cycles', 'economic cycle', 'economic cycles', 'boom and bust', 'boom and slump',
    'exchange rate', 'exchange rates', 'government spending', 'public spending', 'government expenditure', 'public expenditure', 'tax and spending', 'taxation and spending',
    'aggregate demand', 'injections and leakages', 'leakages and injections', 'injections and withdrawals', 'withdrawals and injections',
    'circular flow', 'circular flow of income', 'national income', 'multiplier effect', 'keynesian multiplier', 'fiscal multiplier', 'investment multiplier', 'spending multiplier',
    'external economic influences', 'economic influences on business', 'phillips machine', 'moniac',
  ],
  // Near misses: the same words about something else, and economics this card cannot draw.
  notFor: [
    'compound interest', 'simple interest', 'calculating interest', 'interest calculation', 'interest calculations', 'interest earned', 'savings account', 'savings accounts', 'bank account', 'bank accounts', 'loan repayment', 'loan repayments', 'mortgage repayment', 'mortgage repayments', 'annual percentage rate', 'percentage multiplier', 'percentage multipliers',
    'cosmic inflation', 'cosmological inflation', 'inflation of the universe', 'inflationary universe', 'tyre inflation', 'tire inflation', 'balloon inflation', 'lung inflation', 'grade inflation', 'weimar', 'ruhr', 'hyperinflation',
    'measuring inflation', 'price index', 'consumer price index', 'retail price index', 'index numbers', 'measuring unemployment', 'claimant count', 'labour force survey',
    'types of unemployment', 'frictional unemployment', 'structural unemployment', 'seasonal unemployment', 'youth unemployment', 'unemployment benefit', 'unemployment benefits',
    'cliff recession', 'coastal recession', 'glacial recession', 'glacier recession', 'gum recession', 'beach recession', 'shoreline recession', 'recession limb', 'hydrograph',
    'conversion', 'conversions', 'converting currency', 'converting currencies', 'convert currency', 'convert currencies', 'convert money', 'converting money', 'exchange rate calculation', 'exchange rate calculations', 'currency calculations',
    'exchange rate determination', 'determination of exchange rates', 'fixed exchange rate', 'fixed exchange rates', 'floating exchange rate', 'floating exchange rates', 'demand for currency', 'supply of currency',
    'circular flow of blood', 'circular flow of water', 'circular flow of nutrients', 'circular flow of air',
    'measuring national income', 'national income accounting', 'output method', 'expenditure method', 'income method',
    'tourism', 'industrial location', 'regional development', 'cumulative causation',
    'aggregate supply', 'lras', 'sras', 'production possibility', 'production possibilities', 'opportunity cost', 'indirect taxes',
    'spending on health', 'spending on healthcare', 'spending on education', 'spending on roads', 'spending on defence',
  ],
  // The learner moves one lever and reads what follows from it: the level, then the jobs and the prices.
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? (o.task as Record<string, unknown>) : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawShock = first(src, ['shock', 'problem', 'event', 'situation', 'scenario', 'cause'])
    const rawLever = first(src, ['lever', 'policy', 'tool', 'instrument', 'control'])
    const rawAim = first(src, ['aim', 'target', 'goal', 'objective'])
    for (const field of [rawTask, rawShock, rawLever, rawAim]) if (field !== undefined && typeof field !== 'string') return null
    const asked = rawTask === undefined ? '' : readTask(rawTask as string)
    const shock = rawShock === undefined ? (asked === 'conflict' ? 'oil' : 'investment-fall') : readShock(rawShock as string)
    const costly = has(SHOCK_INFO, shock) && SHOCK_INFO[shock].kind === 'cost'
    // A cost shock is a conflict whatever it was called. Any other word stays, for faults to name.
    const task = costly || asked === 'conflict' ? 'conflict' : asked === '' ? 'steer' : asked
    return { task, shock, lever: rawLever === undefined ? 'interest' : readLever(rawLever as string), aim: rawAim === undefined ? 'prices' : readAim(rawAim as string) }
  },

  faults(config) {
    const out: string[] = []
    if (!(TASKS as readonly string[]).includes(config.task)) out.push(`There is no task "${config.task}" on this card: use task "steer" (bring the water back after a shock) or task "conflict" (a jump in costs pulls the two marks apart), e.g. { "task":"steer", "shock":"exports-fall", "lever":"interest" }.`)
    if (!has(SHOCK_INFO, config.shock)) out.push(`The card has no "${config.shock}" event: use one of ${[...DEMAND_SHOCKS, ...COST_SHOCKS].join(', ')}, e.g. shock "investment-fall".`)
    else if (config.task === 'conflict' && !isCost(config)) out.push(`"${config.shock}" moves spending and leaves the two marks together, so there is no conflict to show: use shock "oil" or "harvest" for a conflict, or task "steer" for this event.`)
    if (!isLever(config.lever)) out.push(`The card has no "${config.lever}" lever: it turns only ${LEVERS.join(', ')}, because each of those works a valve on the tank. Use e.g. lever "interest".`)
    if (isCost(config) && !(AIMS as readonly string[]).includes(config.aim)) out.push(`The card has no aim "${config.aim}": use aim "prices" (the prices-steady mark) or aim "jobs" (the full-capacity mark), e.g. aim "prices".`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    const lever = leverOf(config)
    const words = LEVER_WORDS[lever]
    const says = new RegExp(`\\b${MOVES}\\b[^.?!]{0,24}\\b${words}\\b|\\b${words}\\b[^.?!]{0,16}\\b${WAYS}\\b`, 'i').test(text)
    const named = /\bexpansionary\b|\bcontractionary\b|\bstimul\w*|\bdampen\w*|\bcool(?:s|ing)? (?:the|down)\b|\b(?:tight|loose|easy) (?:money|monetary|fiscal)\b/i.test(text)
      || (lever === 'exchange' && /\bappreciat\w*|\bdepreciat\w*|\bdevalu\w*|\brevalu\w*|\b(?:strong|weak)(?:er)?\s+(?:the\s+)?(?:currency|money|exchange|pound|naira|dollar|franc|shilling|rand)\b/i.test(text))
    const solved = macroBoardEngine.solve(config)
    const amount = leverInfo(config).value(solved.step)
    const howFar = text.includes(amount) || /\b(?:one|two|three|four|\d)\s+(?:steps?|taps?|clicks?|presses|notches|points?)\b/i.test(text)
    if (says || named || howFar) out.push(`the prompt gives the answer away: it says which way or how far to move the lever, which the learner is to find on the machine -- ask for the mark only ("${example}")`)
    if (isCost(config) && /\btrade-?offs?\b|\bconflicts?\b|\bsacrific\w*|\bat the (?:cost|expense)\b|\bcosts? (?:of |in )?jobs\b|\b(?:lose|lost|losing) jobs\b|\bjob losses\b|\b(?:cannot|can(?:no|')t) (?:have|reach|fix|get|hit) both\b|\bone or the other\b|\bout of work\b.*\bprices\b/i.test(text)) {
      out.push(`the prompt gives the answer away: it says what reaching the mark will cost, which the learner is to see for themselves -- ask for the mark only ("${example}")`)
    }
    if (/\b2\.5\b|\btwo and a half\b|\bmultipl\w+ (?:is|of|by)\b/i.test(text)) out.push(`the prompt gives the answer away: it says how much further the water goes than the valve is turned, which is what marking reveals -- ask for the mark only ("${example}")`)
    if (/\bdrag\b|\bslid(?:e|er)\b|\bdials?\b|\bgauges?\b|\bgraphs?\b|\bcurves?\b|\bAD\/AS\b|\baggregate supply\b|\bdeficit\b|\bdebt\b|\bcurrent account\b|\bbalance of (?:payments|trade)\b|\bmoney supply\b|\bmortgages?\b|\bproduction possibilit/i.test(text)) {
      out.push(`the prompt promises something the card does not show: it draws a tank, six pipes with valves, workers and price tags, and the learner taps a minus or plus -- ask for that ("${example}")`)
    }
    return out
  },

  initial() {
    return { step: 0 }
  },

  check(config, state) {
    return { ok: onMark(config, stepOf(config, state)), wrongIds: [] }
  },

  solve(config) {
    const { min, max } = stepRange(config)
    for (let far = 1; far <= MAX_STEPS; far++) {
      for (const k of [-far, far]) if (k >= min && k <= max && onMark(config, k)) return { step: k }
    }
    return { step: 0 }
  },

  View: MacroBoardView,

  prompt: `SCENE "macro-board" -- the whole economy as one real machine, after Phillips's water computer: a glass tank on a quiet light panel, where the water is the money going round, with its value on it. Three pipes pour in at the top (Investment, Government, Exports) and three drain from the floor (Saving, Tax, Imports), each with a brass valve and a stream as thick as what it carries, in three columns. The water stops by itself where what leaks out matches what pours in, because the leaks run harder the higher it stands. Workers stand beside the tank on the left: one the water has not reached is hollow, out of work. Price tags stack on the right: one the water has passed is lit. The learner has ONE control, a stepper under the picture for one lever, and the valves that lever turns are coloured: interest rate turns Investment and Saving, tax rate turns Tax, government spending turns Government, exchange rate turns Exports and Imports. Each tap turns those valves, the streams change at once and the water climbs or falls for about a second. Readouts give unemployment and inflation. It is a simple model and no forecast.
  For: interest rates, tax and government spending as policy, monetary and fiscal policy, exchange rates and what they do to the economy, inflation (demand-pull and cost-push), unemployment from too little spending, recession and boom, the circular flow of income, injections and leakages, the multiplier, conflicts between macroeconomic aims, external economic influences on business. It answers "a good policy brings jobs and low prices together", "income rises only by what was added" and "the level copies the valve".
  steer: spending has been knocked by the shock, so the water stands away from the full-capacity mark, and the learner brings it back with the one lever. shock: investment-fall, exports-fall, saving-rise (too low); saving-fall, investment-rise, exports-rise (too high). Marked on the settled level, exactly, within a band round the mark.
  conflict: a jump in costs has slid the prices-steady mark far below the full-capacity mark, so the water starts between them with workers out and tags lit. shock: oil or harvest. aim: prices (reach the prices-steady mark) or jobs (reach the full-capacity mark). Either can be reached and neither fixes both: marking says what the other cost. Use it after a steer card, so the learner has seen one level fix both first.
  lever: interest, tax, spending or exchange. Any lever works with any shock.
  Not drawn: AD/AS or Phillips curves, the production possibility curve, the budget deficit and debt, the current account, money creation and banks, supply-side policy, tariffs. Do not use it for compound interest, currency conversion, measuring inflation, types of unemployment or measuring national income.
  Before marking the card shows the water, the marks, the streams, the workers, the tags, the lever's value and the two readouts, and a sentence naming the event. It holds back which way to move the lever and how far. Marking says what was made and why it works. The prompt must ask for the mark only: do NOT say which way to move the lever or how far, name it expansionary or contractionary, say what reaching the mark will cost, or give the multiplier's size.
  config: { "task":"steer", "shock":"investment-fall", "lever":"interest" }  -- the prompt says "Tap the minus or plus on Interest rate and watch the water settle. Bring it back to the full-capacity mark."
       or { "task":"steer", "shock":"saving-fall", "lever":"spending" }  -- the prompt says "Tap the minus or plus on Government spending and watch the water settle. Bring it back to the full-capacity mark."
       or { "task":"conflict", "shock":"oil", "lever":"interest", "aim":"prices" }  -- the prompt says "Tap the minus or plus on Interest rate and watch the water settle. Bring it to the prices-steady mark, and see what happens to the workers."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the minus or plus on Interest rate and watch the water settle. Bring it back to the full-capacity mark.",
    "payload": { "engine":"macro-board", "config": { "task":"steer", "shock":"investment-fall", "lever":"interest" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:macro-board", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the minus or plus on Government spending and watch the water settle. Bring it back to the full-capacity mark.",
    "payload": { "engine":"macro-board", "config": { "task":"steer", "shock":"saving-fall", "lever":"spending" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:macro-board", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap the minus or plus on Interest rate and watch the water settle. Bring it to the prices-steady mark, and see what happens to the workers.",
    "payload": { "engine":"macro-board", "config": { "task":"conflict", "shock":"oil", "lever":"interest", "aim":"prices" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:macro-board", "why":"..." } }`,
}

registerEngine(macroBoardEngine as SceneEngine<unknown, unknown>)
