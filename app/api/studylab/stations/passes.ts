// app/api/studylab/stations/passes.ts
import { buildModelCandidates, callGemma, parseJsonRobust } from '@/lib/bedrock'
import { modelForJob, fallbackForJob } from '@/lib/studylab/lessonJobs'
import { advertiseVocabulary } from '@/lib/studylab/material/advertiseVocabulary'
import { isValidPart } from '@/lib/studylab/point'
import {
  checkExplore, checkName, checkPracticeCheck, verifyBundleCode,
  type AuthoredCut, type BundlePass, type Outcome, type StationBundle,
} from '@/lib/studylab/stationBundle'
import type { Pass } from '@/lib/studylab/stationJobs'
import type { LessonStep } from '@/lib/studylab/lessonRun'
import { stationSystemPrompt } from '../tutor/system-prompt'
import { stagePrompt } from '../tutor/stagePrompt'
import { materialRules } from '../tutor/dispatch'
import { fitPictures } from '@/lib/studylab/meaning/art'
import { dropArguable } from '@/lib/studylab/arguable'
import { scenesFor } from '@/lib/studylab/engines'

/**
 * The passes that write a station ahead of the learner, one per request, each
 * well inside Amplify's 30 s: explore; name it, once for each way the explore
 * can go; practice and the check; and verify -- the code checks, then a judge.
 *
 * Every pass checks its own part as soon as it is parsed, so a bad part is
 * written again at once rather than discovered at the end.
 */
export interface PassContext {
  title: string
  subject?: string | null
  step: LessonStep
  /** 1-based, as cards count steps. */
  stepNo: number
  plan: LessonStep[]
  version: string
  partial: Partial<StationBundle>
  /** What a checker found wrong with this pass last time it was written. */
  fix?: string
}

export type PassResult =
  | { ok: true; partial?: Partial<StationBundle>; bundle?: StationBundle }
  | { ok: false; reason: string; redo?: BundlePass }

export interface PassOptions {
  signal?: AbortSignal
  usage?: { requestId: string; userId: string | null }
}

/** Output budgets that keep each call inside the 20 s a pass may take. Measured in the live audit. */
// The judge at 350 was cut off mid-quote, quoting a whole feedback line (audit 7).
const BUDGET: Record<Pass, number> = { explore: 1500, name: 1000, practice_check: 1400, verify: 900 }

/**
 * Only the asked-for model's own ids. Refused, a call moves on to Gemma 3 12B,
 * and a station written or judged by it is worse than one taught live: found
 * when the author model was refused on purpose, and the passes kept answering.
 */
function onlyModel(model: string): number {
  return new Set(buildModelCandidates(model)).size
}

/** Indentation is output a pass waits for and nobody reads. */
const COMPACT = 'Write the JSON compact -- no indentation or line breaks.'

/** A sort or match with an arguable item has no right answer to check. */
const UNARGUABLE = [
  'In a sort, a match or an order, every item has exactly one right place by the textbook definition -- leave out',
  'any item or step a teacher could argue (an omnivore in a food chain; dressing before or after brushing teeth).',
  'Never sort by a judgement (more or less reliable, more or less important): sort by a property the topic defines.',
].join('\n')

/** As much of the explore item as a later pass reads: enough for any material the catalogue builds. */
const EXPLORE_CHARS = 3000

const OUTCOMES: readonly Outcome[] = ['solved', 'helped', 'untried']

function context(ctx: PassContext): string {
  const plan = ctx.plan.map((s, i) => `  ${i + 1}. ${s.title} -- ${s.goal}${i === ctx.stepNo - 1 ? ' [THIS STATION]' : ''}`).join('\n')
  return [
    'WRITING AHEAD -- you are writing one station of this lesson before the student reaches it. You cannot see',
    'the student: write for the board as it will be, and never claim to know what they did unless told below.',
    '',
    `LESSON: ${ctx.title}`,
    ctx.subject ? `SUBJECT: ${ctx.subject}` : '',
    'THE PLAN:',
    plan,
    '',
    `THIS STATION (step ${ctx.stepNo}): ${ctx.step.title} -- ${ctx.step.goal}`,
    `Set "step": ${ctx.stepNo} on everything you write.`,
    // Found live: a naming card read "The explore item shows this".
    'The student never sees the words "explore item", "station", "stage" or "pass": in anything they read, name',
    'a thing as it appears (the slider, the sort, the bars).',
  ].filter((l) => l !== '').join('\n')
}

/**
 * The explore item a later pass builds on, whole: its items, labels and answer.
 * Told only its prompt, the name pass described toast-making steps the sort did
 * not have, and a practice item drifted from a balance to chemical equations.
 */
function exploreSummary(ctx: PassContext): string {
  const e = ctx.partial.explore
  if (!e) return ''
  const { id, step: _step, ...item } = e.action as unknown as Record<string, unknown>
  return [
    `THE EXPLORE ITEM ALREADY WRITTEN FOR THIS STATION (id "${String(id)}"):`,
    `  Kana's opening line: "${e.opening}"`,
    `  The item, exactly as the student gets it: ${JSON.stringify(item).slice(0, EXPLORE_CHARS)}`,
  ].join('\n')
}

const EXPLORE_ASK = [
  'A "vary" material models a relationship. Say what it is and cite where it comes from (a law, a textbook',
  'result, measured data) in "relationship" -- never a formula you made up.',
  '',
  'Reply with JSON only, not the turn shape above:',
  '{ "opening": "<one line on what to notice, never the instructions>",',
  '  "action": <ONE createActivity or build_material, or a practice card titled "Predict: ...">,',
  '  "intent": { "goal", "isolates", "apparatus", "why" } (required for a material),',
  '  "relationship": { "statement": "...", "source": "..." } (a vary material only),',
  '  "hints": ["<after a first miss>", "<after a second>"] }',
  UNARGUABLE,
  COMPACT,
].join('\n')

const NAME_ASK = [
  'STAGE: NAME IT -- name the idea the explore item shows. Write the naming card ONCE, then what Kana says for',
  'each way the explore can go:',
  '  "card": ONE createCard ("concept" or "worked") that names the idea and shows it on the explore item. Write it',
  '          so it is true whatever the student did -- no "you found", no result of theirs.',
  '  "solved": { "say" } -- they solved it first time: one line that builds on the result they reached.',
  '  "helped": { "say", "card" } -- they solved it after a hint or two: one line on the result and the step that',
  '          was hard, and ONE short card on that step (or leave the card out).',
  '  "untried": { "say", "card" } -- they moved on without finishing: one line, and ONE short card showing what the',
  '          explore item shows when it is done, as a demonstration. Never describe a result they did not reach.',
  '  "point": the part of the explore item that shows the idea, as the board names it -- "piece-<id>" for one of',
  '          its items, "slot-<id>" for a slot -- or leave it out.',
  'Describe only what the explore item above holds: its items, labels and answer, as they are written there.',
  '',
  'Reply with JSON only: { "card": {...}, "solved": { "say": "..." }, "helped": { "say": "...", "card": {...} },',
  '  "untried": { "say": "...", "card": {...} }, "point": "piece-..." }',
  COMPACT,
].join('\n')

const PRACTICE_CHECK_ASK = [
  'STAGE: PRACTICE -- ONE near-twin of the explore: the same kind of thing with one thing changed, not harder.',
  'A "practice" card with "answer", "rubric" and the full "steps"; a "practice" card carrying a "question" to answer by',
  'hand (an mcq, or a fill, order or tap from QUESTION FORMATS) and the full "steps"; or a material variant.',
  '',
  'STAGE: CHECK -- two questions on this station, gate "hard". The first is a multiple choice. The second is answered',
  'by hand -- a fill, an order or a tap from QUESTION FORMATS -- wherever the idea has words to fill in, steps to put in',
  'order or a part to point at; a "short" question otherwise. Write each multiple-choice question from its',
  'slips: decide the mistake first, then work out the option that mistake gives, then write the feedback for it:',
  '  { "format": "mcq", "prompt": "...", "right": { "option": "...", "feedback": "<why it is right>" },',
  '    "wrong": [ { "slip": "<the mistake, in words>", "option": "<what that mistake gives, worked out from it>",',
  '                 "feedback": "<for a student who made that slip>" } ] }   -- two or three wrong options.',
  'A "short" question carries a "rubric" that accepts the idea in any words. A fill, order or tap is written exactly',
  'as QUESTION FORMATS shows.',
  '',
  'Reply with JSON only: { "practice": { "say": "...", "action": {...} },',
  '  "check": { "say": "<at most eight words>", "questions": [...] } }',
  UNARGUABLE,
  COMPACT,
].join('\n')

/** A refusal that means the material tried fits no apparatus: the next try is a predict item. */
// A missing picture is the same dead end: "Reading climate graphs" labelled a bar chart three times over it.
const SCHEMA_REFUSED = /apparatus's schema|which the board cannot draw|not something the board can build|the catalogue has no diagram of it/
const PREDICT_NOW =
  'This time, open with a "Predict: ..." practice card -- no material: the one tried last time cannot be drawn here.'
const PRACTICE_CARD_NOW =
  'This time, make the practice item a "practice" card -- no material: the one tried last time cannot be drawn here.'

/** Said to a pass written again: what was refused last time. */
function lastTime(fix: string | undefined): string {
  return fix ? `LAST TIME -- this part was written before and refused for this: "${fix.slice(0, 600)}". Write it again without that fault.` : ''
}

/** What the station is about, in words: its lesson, step and goal. */
const stationOf = (ctx: PassContext) => `${ctx.title} ${ctx.step.title} ${ctx.step.goal}`

/**
 * A scene made for this station's idea, said outright. In the catalogue alone,
 * "States of matter" still came back as a card to read with the particle
 * scene listed above it.
 */
function sceneHint(ctx: PassContext): string[] {
  const fits = scenesFor(stationOf(ctx))
  if (fits.length === 0) return []
  return ['', `A SCENE IS MADE FOR THIS STATION: ${fits.map((e) => `"${e.id}"`).join(' or ')}. Build the explore item as that scene -- it draws and marks this idea exactly -- unless it truly cannot show this step.`]
}

function prompt(pass: Exclude<Pass, 'verify'>, ctx: PassContext): string {
  const head = [stationSystemPrompt(), '', context(ctx), ...(ctx.fix ? ['', lastTime(ctx.fix)] : [])]
  if (pass === 'explore') {
    // Told to fit the schema or switch, logic gates went back to a material every
    // time; after a schema refusal the choice is made for it.
    const predictNow = ctx.fix && SCHEMA_REFUSED.test(ctx.fix) ? ['', PREDICT_NOW] : []
    return [...head, '', stagePrompt('explore', { missed: [], pace: 'step' }), '', materialRules(stationOf(ctx)), advertiseVocabulary(), '', EXPLORE_ASK, ...sceneHint(ctx), ...predictNow].join('\n')
  }
  if (pass === 'name') return [...head, '', exploreSummary(ctx), '', NAME_ASK].join('\n')
  const cardNow = ctx.fix && SCHEMA_REFUSED.test(ctx.fix) ? ['', PRACTICE_CARD_NOW] : []
  return [...head, '', exploreSummary(ctx), '', materialRules(stationOf(ctx)), '', PRACTICE_CHECK_ASK, ...cardNow].join('\n')
}

/** The station's ids, whatever the model chose: nothing it writes may collide on the board. */
function rename(actions: unknown[], ids: Map<string, string>): unknown[] {
  const re = (v: unknown) => (typeof v === 'string' && ids.has(v) ? ids.get(v) : v)
  return actions.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const a = { ...(raw as Record<string, unknown>) }
    if ('id' in a) a.id = re(a.id)
    if ('from' in a) a.from = re(a.from)
    if ('to' in a) a.to = re(a.to)
    if ('nodeId' in a) a.nodeId = re(a.nodeId)
    return a
  })
}

function stepped<T>(action: T, stepNo: number): T {
  return action && typeof action === 'object' ? ({ ...(action as object), step: stepNo } as T) : action
}

async function ask(pass: Exclude<Pass, 'verify'>, ctx: PassContext, opts: PassOptions): Promise<Record<string, unknown> | null> {
  const raw = await callGemma(prompt(pass, ctx), {
    maxTokens: BUDGET[pass],
    temperature: 0.5,
    model: modelForJob('author'),
    fallbackModel: fallbackForJob('author'),
    maxCandidates: onlyModel(modelForJob('author')),
    signal: opts.signal,
    usage: opts.usage ? { feature: `station_${pass}`, requestId: opts.usage.requestId, userId: opts.usage.userId } : undefined,
  })
  try {
    const parsed = parseJsonRobust(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * The explore reply as asked, read out of the two other shapes it came back
 * in: the live turn's ({ say, actions }), which the system prompt teaches, and
 * a list around the one object. Each cost a whole try before.
 */
function asExplore(got: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!got) return null
  if (Array.isArray(got)) {
    const list = got as unknown[]
    const pieces = list.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x))
    const one = pieces.find((x) => 'action' in x && 'opening' in x)
    if (one) return one
    // One object split into pieces, a key or two each.
    const merged = Object.assign({}, ...pieces) as Record<string, unknown>
    if (merged.action) return merged
    return { list: `a list of ${list.length} (${list.map((x) => (Array.isArray(x) ? 'list' : typeof x)).join(', ')})` }
  }
  if (got.action || !Array.isArray(got.actions)) return got
  const item = (got.actions as Record<string, unknown>[]).find((a) =>
    a?.type === 'createActivity' || a?.type === 'build_material' || (a?.type === 'createCard' && a.card === 'practice'))
  return item ? { ...got, opening: got.opening ?? got.say, action: item } : got
}

async function explore(ctx: PassContext, opts: PassOptions): Promise<PassResult> {
  const got = asExplore(await ask('explore', ctx, opts))
  if (!got) return { ok: false, reason: 'the explore pass did not come back as JSON' }
  // What it held instead tells a misread shape from an empty reply.
  if (!got.action || typeof got.action !== 'object') {
    const held = typeof got.list === 'string' ? got.list : Object.keys(got).join(', ') || 'nothing'
    return { ok: false, reason: `the reply had no "action" -- it held: ${held}. Reply in the shape asked: { "opening", "action", "intent", "hints" }` }
  }
  // The live schema puts the intent on the material itself, and the model
  // follows it; it is taken from either place and kept off the action, as the
  // live path keeps it off the board.
  const { intent: onAction, ...bare } = (got.action ?? {}) as Record<string, unknown>
  const intent = got.intent ?? onAction
  // Pictures that do not show their items come off here, as they would at
  // serve time: the card keeps its words, and the writer is not sent back.
  const { action } = fitPictures(stepped({ ...bare, id: `${ctx.step.id}-explore` }, ctx.stepNo))
  const e = {
    opening: String(got.opening ?? '').trim(),
    action: action as never,
    ...(intent ? { intent: intent as never } : {}),
    ...(got.relationship ? { relationship: got.relationship as never } : {}),
    hints: Array.isArray(got.hints) ? got.hints.filter((h): h is string => typeof h === 'string') : [],
  }
  const problems = checkExplore(e)
  return problems.length ? { ok: false, reason: problems.join('; ') } : { ok: true, partial: { explore: e } }
}

/**
 * The name-it cuts, built around one naming card written once. The three cuts
 * differ where the outcome matters -- the line Kana says, and the card each
 * adds: the hard step for "helped", what the item shows when done for
 * "untried". Written three times over, the cards came back the same and the
 * pass ran close to its time.
 */
async function name(ctx: PassContext, opts: PassOptions): Promise<PassResult> {
  const exploreId = String((ctx.partial.explore?.action as { id?: unknown } | undefined)?.id ?? '')
  if (!exploreId) return { ok: false, reason: 'no explore item to name', redo: 'explore' }
  const got = await ask('name', ctx, opts)
  if (!got) return { ok: false, reason: 'the name pass did not come back as JSON' }
  const asCard = (raw: unknown, id: string): Record<string, unknown> | null =>
    raw && typeof raw === 'object' ? stepped({ ...(raw as Record<string, unknown>), type: 'createCard', id }, ctx.stepNo) : null
  const naming = asCard(got.card, `${ctx.step.id}-name`)
  if (!naming) return { ok: false, reason: 'the name pass wrote no naming card ("card")' }
  // A part no renderer draws points at the whole item instead.
  const part = typeof got.point === 'string' ? got.point.trim() : ''
  const point = typeof got.point === 'string' ? [{ type: 'point', nodeId: exploreId, ...(isValidPart(part) ? { part } : {}) }] : []
  const join = (from: unknown, to: unknown) => ({ type: 'connect', from, to })
  const cuts: Partial<Record<Outcome, AuthoredCut>> = {}
  for (const o of OUTCOMES) {
    const cut = got[o] as { say?: unknown; card?: unknown } | undefined
    if (!cut || typeof cut !== 'object') continue
    const own = o === 'solved' ? null : asCard(cut.card, `${ctx.step.id}-${o}-1`)
    const actions = !own
      ? [naming, join(exploreId, naming.id), ...point]
      : o === 'untried'
        ? [own, naming, join(exploreId, own.id), join(own.id, naming.id), ...point]
        : [naming, own, join(exploreId, naming.id), join(naming.id, own.id), ...point]
    cuts[o] = { say: String(cut.say ?? '').trim(), actions: actions as never }
  }
  const problems = checkName(cuts, exploreId)
  return problems.length ? { ok: false, reason: problems.join('; ') } : { ok: true, partial: { name: cuts as StationBundle['name'] } }
}

/**
 * A multiple-choice question written from its slips, as the board takes it:
 * options and feedback in step, the right one at a place set by the prompt.
 * Written the other way -- an option first, its slip explained after -- the
 * feedback misdescribed its own option on fractions and binary, retry after
 * retry. A question already in the board's shape passes through.
 */
function fromSlips(raw: unknown, i: number): unknown {
  const q = raw as { id?: unknown; prompt?: unknown; right?: { option?: unknown; feedback?: unknown }; wrong?: unknown } | null
  // Any other question is kept as written, with an id if it came without one.
  if (!q || typeof q !== 'object') return raw
  if (!q.right || typeof q.right !== 'object' || !Array.isArray(q.wrong)) return typeof q.id === 'string' && q.id ? q : { ...q, id: `q${i + 1}` }
  const wrong = (q.wrong as { option?: unknown; feedback?: unknown }[]).filter((w) => w && typeof w === 'object')
  const prompt = String(q.prompt ?? '')
  const at = [...prompt].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % (wrong.length + 1)
  const options = wrong.map((w) => String(w.option ?? ''))
  const optionFeedback = wrong.map((w) => String(w.feedback ?? ''))
  options.splice(at, 0, String(q.right.option ?? ''))
  optionFeedback.splice(at, 0, String(q.right.feedback ?? ''))
  return { id: typeof q.id === 'string' && q.id ? q.id : `q${i + 1}`, format: 'mcq', prompt, options, answer: at, optionFeedback }
}

async function practiceCheck(ctx: PassContext, opts: PassOptions): Promise<PassResult> {
  const got = await ask('practice_check', ctx, opts)
  if (!got) return { ok: false, reason: 'the practice and check pass did not come back as JSON' }
  const p = got.practice as { say?: unknown; action?: unknown } | undefined
  const c = got.check as { say?: unknown; questions?: unknown } | undefined
  // A material's intent comes off the action and is kept beside it, as the explore's is.
  const { intent: onAction, ...bare } = ((p?.action as Record<string, unknown>) ?? {})
  const practiceIntent = (p as { intent?: unknown } | undefined)?.intent ?? onAction
  const practice = {
    say: String(p?.say ?? '').trim(),
    action: fitPictures(stepped({ ...bare, id: `${ctx.step.id}-practice` }, ctx.stepNo)).action as never,
    ...(practiceIntent ? { intent: practiceIntent as never } : {}),
  }
  const check = { say: String(c?.say ?? '').trim(), questions: (Array.isArray(c?.questions) ? c.questions.map(fromSlips) : []) as never }
  const problems = checkPracticeCheck(practice, check)
  return problems.length ? { ok: false, reason: problems.join('; ') } : { ok: true, partial: { practice, check } }
}

/** The judge's brief. A relationship is asked about only when the station has one. */
function judgeAsk(hasRelationship: boolean): string {
  return [
    'You check one station of a lesson before a student sees it. First write, in "truth", one line on what is',
    'actually true about the idea this station teaches' + (hasRelationship ? ' -- and how the quantity the student varies really affects the output' : '') + '.',
    'Then compare the station with that. Fail it ONLY for a definite error you can quote from it, word for word,',
    'of one of these kinds:',
    '  - "false-statement": a statement that is false (quote it, and say what is true);',
    '  - "wrong-key": an answer key that is wrong;',
    '  - "feedback-mismatch": a feedback line that does not fit the option it is written for;',
    '  - "arguable-item": a sort, match, order or fill with an item whose right place a teacher could argue (quote the item).',
    ...(hasRelationship
      ? ['  - "false-statement" too: a material whose slider and output model a relationship that is not true -- a "relationship" that disagrees with your "truth": quote it.']
      : []),
    'Whether an item tests the goal well, or could be harder or clearer, is not one of these kinds.',
    'Never fail it for style, difficulty, or a way you would have taught it differently. If you cannot quote a',
    'definite error, it passes. Name the part to write again -- the earliest part the error starts in: when a later',
    'part only follows an error an earlier part made, name the earlier one. "explore" (the material, opening, hints' + (hasRelationship ? ', relationship' : '') + '),',
    '"name" (the three name-it versions) or "practice_check" (the practice item and the check).',
    '',
    '"quote" is the shortest exact text that shows the error -- the item, the words -- never a whole question or',
    'feedback line; "truth" and "reason" are one short sentence each.',
    'Reply with JSON only: { "truth": "...", "ok": true } or',
    '{ "truth": "...", "ok": false, "kind": "false-statement" | "wrong-key" | "feedback-mismatch" | "arguable-item",',
    '  "pass": "explore" | "name" | "practice_check", "quote": "<the exact wrong text>", "reason": "<what is true>" }',
    COMPACT,
  ].join('\n')
}

/** The errors a judge may fail a station for. Anything else is a view on teaching, and the station stands. */
const ERROR_KINDS = new Set(['false-statement', 'wrong-key', 'feedback-mismatch', 'arguable-item'])

/** Every string in the station, flattened: what a judge's quote must come from. */
function stationText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(stationText).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(stationText).join(' ')
  return ''
}
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** What the judge made of a station: a pass, or a definite error it quoted, with the part to write again. */
type Judgement = { ok: true } | { ok: false; reason: string; redo?: BundlePass; kind?: string; quote?: string }

async function judgeStation(bundle: StationBundle, ctx: PassContext, opts: PassOptions): Promise<Judgement> {
  const raw = await callGemma(
    [judgeAsk(!!bundle.explore.relationship), '', `STATION: ${ctx.step.title} -- ${ctx.step.goal} (${ctx.subject ?? 'lesson'}: ${ctx.title})`, '', JSON.stringify(bundle)].join('\n'),
    {
      maxTokens: BUDGET.verify,
      temperature: 0,
      model: modelForJob('judge'),
      fallbackModel: fallbackForJob('judge'),
      maxCandidates: Math.max(onlyModel(modelForJob('judge')), onlyModel(modelForJob('plan'))),
      signal: opts.signal,
      usage: opts.usage ? { feature: 'station_judge', requestId: opts.usage.requestId, userId: opts.usage.userId } : undefined,
    },
  )
  let verdict: { ok?: unknown; kind?: unknown; pass?: unknown; quote?: unknown; reason?: unknown }
  try {
    verdict = parseJsonRobust(raw)
  } catch {
    // How it ended tells a reply cut off at its budget from one that was never JSON.
    const text = String(raw ?? '')
    return { ok: false, reason: `the judge did not come back as JSON (${text.length} characters, ending "${text.slice(-60)}")` }
  }
  if (verdict?.ok === true) return { ok: true }
  // A failure has to be a definite error of a kind the judge was given. A
  // practice failed twice live for "not assessing the goal" -- a judgement on
  // teaching -- and it quoted the station, so the quote alone let it through.
  if (!ERROR_KINDS.has(String(verdict?.kind))) return { ok: true }
  // A failure has to quote the station. A judge that names an error which is
  // not in it -- "3/9 does not match", a vary complaint about a sort -- invented
  // it, and the station stands.
  const quote = squash(String(verdict?.quote ?? ''))
  if (!quote || !squash(stationText(bundle)).includes(quote)) return { ok: true }
  // The part to write again: the one the judge named, or else the one its
  // quote comes from.
  const named = ['explore', 'name', 'practice_check'].includes(String(verdict?.pass)) ? (verdict.pass as BundlePass) : null
  const redo: BundlePass =
    named ??
    (squash(stationText(bundle.explore)).includes(quote) ? 'explore' : squash(stationText(bundle.name)).includes(quote) ? 'name' : 'practice_check')
  return { ok: false, reason: String(verdict?.reason ?? 'the judge failed it'), redo, kind: String(verdict.kind), quote: String(verdict.quote) }
}

async function verify(ctx: PassContext, opts: PassOptions): Promise<PassResult> {
  const code = verifyBundleCode({ version: ctx.version, stepId: ctx.step.id, ...ctx.partial })
  if (!code.ok) return { ok: false, reason: code.reasons.join('; '), redo: code.pass }
  const first = await judgeStation(code.bundle, ctx, opts)
  if (first.ok) return { ok: true, bundle: code.bundle }
  // An item a teacher could argue comes out where the rest still stands, and
  // the station is judged again: written again, the part came back with
  // another one (milk's pH, a rubber ball's density, a butterfly's level).
  const fixed = first.kind === 'arguable-item' && first.quote ? dropArguable(code.bundle, first.quote) : null
  const recheck = fixed ? verifyBundleCode(fixed) : null
  if (recheck?.ok) {
    const second = await judgeStation(recheck.bundle, ctx, opts)
    if (second.ok) return { ok: true, bundle: recheck.bundle }
    return { ok: false, reason: second.reason, ...(second.redo ? { redo: second.redo } : {}) }
  }
  return { ok: false, reason: first.reason, ...(first.redo ? { redo: first.redo } : {}) }
}

/** Runs one pass of one station. */
export async function runPass(pass: Pass, ctx: PassContext, opts: PassOptions = {}): Promise<PassResult> {
  if (pass === 'explore') return explore(ctx, opts)
  if (pass === 'name') return name(ctx, opts)
  if (pass === 'practice_check') return practiceCheck(ctx, opts)
  return verify(ctx, opts)
}
