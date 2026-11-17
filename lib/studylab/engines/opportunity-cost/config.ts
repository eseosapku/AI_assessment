// lib/studylab/engines/opportunity-cost/config.ts
//
// Scarcity made tangible. In `choice`, one afternoon cannot hold every activity: the learner puts the single
// next-best rejected activity in the give-up tray. In `ppc`, six whole workers move between two crops; output
// and a point on the production possibility curve answer every transfer.
//
// Economics sources: EconEdLink's Opportunity Cost -- Consumers (only the second choice, never the sum of all
// alternatives) and Plotting Potential Production (fixed resources allocated between two goods); Cambridge 0455
// revision guidance and Khan Academy's PPC lesson summary (maximum combinations, increasing opportunity cost as
// less suitable resources are transferred). URLs are in research.md. The production figures are a disclosed,
// fictional teaching model, not agricultural data.

import type { SceneEngine } from '../types'
import { registerEngine } from '../registry'
import { OpportunityCostView } from './View'

export type Activity = { id: string; name: string; detail: string }
export type ChoiceScenario = { chosen: Activity; options: Activity[]; next: string; time: string }
export type OpportunityConfig =
  | { task: 'choice'; scenario: string }
  | { task: 'ppc'; scenario: string; mix: string }
export type OpportunityState = { picked?: string; wheat?: number }

/** Deliberately the same activities in both stories: preference, not price or the picture, decides the cost. */
const CINEMA: Activity = { id: 'cinema', name: 'Cinema', detail: 'with friends' }
const FOOTBALL: Activity = { id: 'football', name: 'Football', detail: 'in the park' }
const STUDY: Activity = { id: 'study', name: 'Study', detail: 'for the test' }
const WORK: Activity = { id: 'work', name: 'Café shift', detail: '4 pm to 7 pm' }

export const CHOICES: Record<string, ChoiceScenario> = {
  afternoon: { chosen: WORK, options: [CINEMA, FOOTBALL, STUDY], next: 'study', time: 'One free afternoon' },
  weekend: { chosen: STUDY, options: [WORK, CINEMA, FOOTBALL], next: 'cinema', time: 'One free Saturday' },
}

/** Output in tonnes when 0..6 workers grow that crop. The other crop gets the remaining workers. */
export const CROP_OUTPUT = [0, 12, 22, 30, 36, 40, 42]
export const WORKERS = 6
export const MIX_WORKERS: Record<string, number> = { balanced: 3, 'more-wheat': 4, 'more-vegetables': 2 }

export const has = (o: object, k: string | number) => Object.prototype.hasOwnProperty.call(o, k)
export const choiceOf = (config: OpportunityConfig): ChoiceScenario =>
  config.task === 'choice' && has(CHOICES, config.scenario) ? CHOICES[config.scenario] : CHOICES.afternoon
export const wheatWorkers = (config: OpportunityConfig): number =>
  config.task === 'ppc' && has(MIX_WORKERS, config.mix) ? MIX_WORKERS[config.mix] : MIX_WORKERS.balanced

/** State is read defensively: saved work or a tutor-written state cannot make the scene crash or pass accidentally. */
export const pickedOf = (state: OpportunityState | null | undefined): string => typeof state?.picked === 'string' ? state.picked : ''
export const workersOf = (state: OpportunityState | null | undefined): number =>
  typeof state?.wheat === 'number' && Number.isInteger(state.wheat) ? Math.max(0, Math.min(WORKERS, state.wheat)) : 0

export const outputAt = (wheat: number): { wheat: number; vegetables: number } => ({
  wheat: CROP_OUTPUT[wheat],
  vegetables: CROP_OUTPUT[WORKERS - wheat],
})

/** The sacrifice made by the last worker transferred to wheat at this production mix. */
export function costAt(wheat: number): { gainedWheat: number; lostVegetables: number } {
  const before = outputAt(Math.max(0, wheat - 1))
  const after = outputAt(wheat)
  return { gainedWheat: after.wheat - before.wheat, lostVegetables: before.vegetables - after.vegetables }
}

export function working(config: OpportunityConfig, state: OpportunityState): string {
  if (config.task === 'choice') {
    const c = choiceOf(config)
    const next = c.options.find((o) => o.id === c.next)!
    return `Yes. ${next.name} is the opportunity cost: your next-best alternative. The other rejected activities are not added to it.`
  }
  const made = outputAt(workersOf(state))
  const cost = costAt(workersOf(state))
  return `Yes. ${made.wheat} tonnes of wheat and ${made.vegetables} tonnes of vegetables. The last transfer gained ${cost.gainedWheat} tonnes of wheat and gave up ${cost.lostVegetables} tonnes of vegetables: the opportunity cost. Costs rise as less suitable workers move to wheat.`
}

export function madeText(config: OpportunityConfig, state: OpportunityState): string {
  if (config.task === 'choice') {
    const c = choiceOf(config)
    const picked = c.options.find((o) => o.id === pickedOf(state))
    if (!picked) return `You have not put an activity in the tray yet. You chose ${c.chosen.name}; what was the next-best thing you gave up?`
    return `You put ${picked.name} in the tray. Opportunity cost is only the next-best alternative, not every activity you rejected.`
  }
  const made = outputAt(workersOf(state))
  const want = outputAt(wheatWorkers(config))
  return `You made ${made.wheat} tonnes of wheat and ${made.vegetables} tonnes of vegetables. The order is ${want.wheat} tonnes of wheat and ${want.vegetables} tonnes of vegetables, with all six workers used.`
}

// ---------------------------------------------------------------------------
// Broad parsing; narrow, actionable refusal.

const keyOf = (raw: unknown) => typeof raw === 'string'
  ? raw.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  : ''
const first = (o: Record<string, unknown>, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined)

function readTask(raw: unknown): 'choice' | 'ppc' | null {
  const k = keyOf(raw)
  if (/^(choice|choose|next-best|next-best-alternative|opportunity-cost|scarcity|basic-economic-problem|consumer-choice|time-choice)$/.test(k)) return 'choice'
  if (/^(ppc|ppf|production-possibility|production-possibilities|production-possibility-curve|production-possibilities-curve|production-possibility-frontier|farm|workers|allocate|allocation|resource-allocation)$/.test(k)) return 'ppc'
  return null
}
function readScenario(raw: unknown, task: 'choice' | 'ppc'): string {
  const k = keyOf(raw)
  if (!k) return task === 'choice' ? 'afternoon' : 'farm'
  if (task === 'ppc') return /farm|crop|wheat|vegetable|agricultur/.test(k) ? 'farm' : k
  if (/weekend|saturday|study|revision/.test(k)) return 'weekend'
  if (/afternoon|work|cafe|shift|part-time/.test(k)) return 'afternoon'
  return k
}
function readMix(raw: unknown): string {
  const k = keyOf(raw)
  if (!k || /balanced|balance|equal|mixed|middle|both/.test(k)) return 'balanced'
  if (/more-wheat|mostly-wheat|wheat-heavy|extra-wheat|^wheat$/.test(k)) return 'more-wheat'
  if (/more-vegetable|mostly-vegetable|vegetable-heavy|extra-vegetable|^vegetables?$/.test(k)) return 'more-vegetables'
  return k
}

function goodPrompt(config: OpportunityConfig): string {
  if (config.task === 'choice') {
    const c = choiceOf(config)
    return `You choose ${c.chosen.name}. Tap the next-best activity you give up, or drag it into the Give up tray.`
  }
  const want = outputAt(wheatWorkers(config))
  return `Tap minus or plus to move workers between the crops. Fill the order: ${want.wheat} tonnes of wheat and ${want.vegetables} tonnes of vegetables.`
}

export const opportunityCostEngine: SceneEngine<OpportunityConfig, OpportunityState> = {
  id: 'opportunity-cost',
  covers: ['opportunity cost', 'PPC'],
  phrases: [
    'scarcity', 'scarcity and choice', 'choice and scarcity', 'economic choice', 'economic choices',
    'basic economic problem', 'the basic economic problem', 'economic problem', 'unlimited wants', 'limited resources',
    'production possibility curve', 'production possibility curves', 'production possibilities curve', 'production possibilities curves',
    'production possibility frontier', 'production possibilities frontier', 'PPF', 'PPCs', 'production possibility diagrams',
    'factors of production', 'land labour capital enterprise', 'land labor capital enterprise', 'resource allocation', 'allocation of resources',
  ],
  notFor: [
    'supply and demand', 'demand and supply', 'price determination', 'price elasticity', 'PED', 'PES', 'market equilibrium',
    'international trade', 'comparative advantage', 'absolute advantage', 'gains from trade', 'specialisation of countries', 'tariffs',
    'business costs', 'break-even', 'breakeven', 'business finance', 'total revenue', 'profit and loss',
    'inflation', 'macroeconomics', 'macro economy', 'monetary policy', 'fiscal policy', 'exchange rates', 'interest rates',
    'opportunity cost of capital', 'capital budgeting',
  ],
  isolates: 'consequence',

  parse(raw) {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const nested = o.task && typeof o.task === 'object' ? o.task as Record<string, unknown> : null
    const src = nested ?? o
    const rawTask = first(src, nested ? ['kind', 'task', 'type'] : ['task', 'kind', 'type', 'mode'])
    const rawMix = first(src, ['mix', 'combination', 'order', 'output'])
    let task = rawTask === undefined ? null : readTask(rawTask)
    if (!task && rawMix !== undefined) task = 'ppc'
    if (!task) return null
    const scenario = readScenario(first(src, ['scenario', 'example', 'story', 'situation', 'goods', 'good']), task)
    return task === 'choice' ? { task, scenario } : { task, scenario, mix: readMix(rawMix) }
  },

  faults(config) {
    if (config.task === 'choice') {
      return has(CHOICES, config.scenario) ? [] : [
        `There is no "${config.scenario}" choice story drawn here: use scenario "afternoon" or "weekend", e.g. { "task":"choice", "scenario":"afternoon" }.`,
      ]
    }
    const out: string[] = []
    if (config.scenario !== 'farm') out.push(`There is no "${config.scenario}" production model drawn here: use scenario "farm" for wheat and vegetables, e.g. { "task":"ppc", "scenario":"farm", "mix":"balanced" }.`)
    if (!has(MIX_WORKERS, config.mix)) out.push(`There is no "${config.mix}" production mix: use "balanced", "more-wheat" or "more-vegetables", e.g. mix "balanced".`)
    return out
  },

  promptFaults(config, prompt) {
    const text = prompt.toLowerCase().replace(/\s+/g, ' ')
    const example = goodPrompt(config)
    const out: string[] = []
    if (config.task === 'choice') {
      const c = choiceOf(config)
      const answer = c.options.find((o) => o.id === c.next)!
      const plain = answer.name.toLowerCase()
      const named = new RegExp(`(?:next[ -]best|opportunity cost|give up|given up|forgo|forgone|sacrific\\w*|second choice|drag|tap|choose|select|put)[^.?!]{0,45}\\b${plain}\\b|\\b${plain}\\b[^.?!]{0,45}(?:next[ -]best|opportunity cost|give up|given up|forgo|forgone|sacrific\\w*|second choice|tray)`, 'i').test(text)
      if (named || /\b(?:all|both|every|sum|total)\b[^.?!]{0,35}(?:alternatives?|activities|given up|forgone)/i.test(text)) {
        out.push(`the prompt gives the opportunity cost away or adds every rejected activity: the learner must identify the single next-best one -- name only the activity chosen and the gesture ("${example}")`)
      }
      if (/\b(?:price|money|cash|dollars?|pounds?|revenue|profit|ppc|ppf|production possibility|workers?)\b/i.test(text)) {
        out.push(`the prompt promises something this choice card does not show: it uses one afternoon and activity cards, not money, workers or a production curve -- ask for that ("${example}")`)
      }
    } else {
      const solution = wheatWorkers(config)
      const assignment = new RegExp(`\\b${solution}\\s+(?:of the\s+)?workers?|\\b(?:move|transfer|add|put|assign)\\s+(?:one|two|three|four|1|2|3|4)\\s+workers?`, 'i').test(text)
      const direction = /\b(?:move|transfer|add|put|assign)\b[^.?!]{0,35}\b(?:to|into|towards?)\s+(?:wheat|vegetables?)\b/i.test(text)
      const answer = /\bopportunity cost\b[^.?!]{0,60}\b(?:is|=)\b|\b(?:gains?|gives? up|forgo\\w*|sacrific\\w*)\s+\d+\s+tonnes?/i.test(text)
      if (assignment || direction || answer) out.push(`the prompt gives the worker allocation or opportunity cost away, which the learner is to discover -- name the gesture and order only ("${example}")`)
      const want = outputAt(solution)
      const stated = /(\d+)\s*(?:t\b|tonnes?\s+of)\s*(?:tonnes?\s+of\s+)?wheat[^.?!]{0,35}?(\d+)\s*(?:t\b|tonnes?\s+of)\s*(?:tonnes?\s+of\s+)?(?:veg|vegetables?)/i.exec(text)
      if (stated && (Number(stated[1]) !== want.wheat || Number(stated[2]) !== want.vegetables)) {
        out.push(`the prompt's order (${stated[1]} tonnes of wheat and ${stated[2]} tonnes of vegetables) does not match this mix: write ${want.wheat} tonnes of wheat and ${want.vegetables} tonnes of vegetables, e.g. "${example}"`)
      }
      if (/\b(?:drag|draw the curve|shift the curve|economic growth|more resources|unemployed|outside the curve|supply|demand|price|trade|tariff)/i.test(text)) {
        out.push(`the prompt promises something this PPC card does not show: six fully employed workers move between crops and the point moves along the curve; it does not shift the curve or model trade -- ask for the order ("${example}")`)
      }
    }
    return out
  },

  initial(config) { return config.task === 'choice' ? { picked: '' } : { wheat: 0 } },

  check(config, state) {
    if (config.task === 'choice') {
      const c = choiceOf(config)
      const picked = pickedOf(state)
      return { ok: picked === c.next, wrongIds: picked && picked !== c.next ? ['choice'] : [] }
    }
    return { ok: workersOf(state) === wheatWorkers(config), wrongIds: workersOf(state) === wheatWorkers(config) ? [] : ['workers'] }
  },

  solve(config) { return config.task === 'choice' ? { picked: choiceOf(config).next } : { wheat: wheatWorkers(config) } },

  View: OpportunityCostView,

  prompt: `SCENE "opportunity-cost" -- scarcity and the next-best alternative forgone, as two small hands-on cards on quiet light panels, for Cambridge IGCSE Economics 0455 and Business Studies.
  choice: one stated activity is already chosen for one afternoon or Saturday. Three illustrated alternatives (cinema, football, study or café shift) can be tapped, or dragged into a dashed Give up tray. The chosen alternative visibly moves into the tray. The learner must select the single NEXT-BEST rejected activity, not every alternative and not a money cost. scenario: afternoon (café shift chosen; study is next best) or weekend (study chosen; cinema is next best). Alternative order is alphabetical and reveals no ranking.
  ppc: six whole workers stand in real wheat and vegetable fields. One minus/plus stepper transfers a worker, both crops' tonne outputs change, and the current point walks along a bowed production possibility curve. All six workers are always used. The learner fills an exact two-crop order. scenario: farm only. mix: balanced (30 tonnes wheat + 30 tonnes vegetables), more-wheat (36 + 22), or more-vegetables (22 + 30). The fictional output model for either crop with 0..6 workers is 0,12,22,30,36,40,42 tonnes; transferring less suitable workers creates increasing opportunity cost. Marking names the exact crop gained and forgone by the last transfer.
  For: scarcity, the basic economic problem, choice, opportunity cost as the next-best alternative forgone, allocation of scarce factors of production, PPC/PPF maximum combinations and increasing opportunity cost. It answers "opportunity cost means all alternatives or only money" and "more of one good can appear without less of another". Not drawn: inside/outside PPC points, unemployment, PPC shifts or growth, prices, supply/demand, revenue, trade or comparative advantage.
  Before marking the card shows the activities or the six workers, live outputs, the order and the current point. It never identifies the next-best option or states the opportunity cost. Marking names the selected alternative or exact output and sacrifice. Prompts must name the gesture and goal only: do NOT name the next-best activity, say which way/how many workers to move, or reveal the forgone output. Do not promise dragging on PPC; it uses minus/plus buttons.
  config: { "task":"choice", "scenario":"afternoon" } -- the prompt says "You choose Café shift. Tap the next-best activity you give up, or drag it into the Give up tray."
       or { "task":"choice", "scenario":"weekend" } -- the prompt says "You choose Study. Tap the next-best activity you give up, or drag it into the Give up tray."
       or { "task":"ppc", "scenario":"farm", "mix":"balanced" } -- the prompt says "Tap minus or plus to move workers between the crops. Fill the order: 30 tonnes of wheat and 30 tonnes of vegetables."
       or { "task":"ppc", "scenario":"farm", "mix":"more-wheat" } -- the prompt says "Tap minus or plus to move workers between the crops. Fill the order: 36 tonnes of wheat and 22 tonnes of vegetables."
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"You choose Café shift. Tap the next-best activity you give up, or drag it into the Give up tray.",
    "payload": { "engine":"opportunity-cost", "config": { "task":"choice", "scenario":"afternoon" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:opportunity-cost", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"You choose Study. Tap the next-best activity you give up, or drag it into the Give up tray.",
    "payload": { "engine":"opportunity-cost", "config": { "task":"choice", "scenario":"weekend" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:opportunity-cost", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus to move workers between the crops. Fill the order: 30 tonnes of wheat and 30 tonnes of vegetables.",
    "payload": { "engine":"opportunity-cost", "config": { "task":"ppc", "scenario":"farm", "mix":"balanced" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:opportunity-cost", "why":"..." } }
  { "type":"createActivity", "spec": { "pattern":"scene", "prompt":"Tap minus or plus to move workers between the crops. Fill the order: 36 tonnes of wheat and 22 tonnes of vegetables.",
    "payload": { "engine":"opportunity-cost", "config": { "task":"ppc", "scenario":"farm", "mix":"more-wheat" } },
    "success": { "kind":"scene" } }, "intent": { "goal":"...", "isolates":"consequence", "apparatus":"scene:opportunity-cost", "why":"..." } }`,
}

registerEngine(opportunityCostEngine as SceneEngine<unknown, unknown>)
