// app/api/studylab/stations/passes.ts
import { callGemma, parseJsonRobust } from '@/lib/bedrock'
import { modelForJob, fallbackForJob } from '@/lib/studylab/lessonJobs'
import { advertiseVocabulary } from '@/lib/studylab/material/advertiseVocabulary'
import {
  checkExplore, checkName, checkPracticeCheck, verifyBundleCode,
  type AuthoredCut, type BundlePass, type Outcome, type StationBundle,
} from '@/lib/studylab/stationBundle'
import type { Pass } from '@/lib/studylab/stationJobs'
import type { LessonStep } from '@/lib/studylab/lessonRun'
import { stationSystemPrompt } from '../tutor/system-prompt'
import { stagePrompt } from '../tutor/stagePrompt'
import { materialRules } from '../tutor/dispatch'

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
}

export type PassResult =
  | { ok: true; partial?: Partial<StationBundle>; bundle?: StationBundle }
  | { ok: false; reason: string; redo?: BundlePass }

export interface PassOptions {
  signal?: AbortSignal
  usage?: { requestId: string; userId: string | null }
}

/** Output budgets that keep each call inside the 20 s a pass may take. Measured in the live audit. */
const BUDGET: Record<Pass, number> = { explore: 1500, name: 1400, practice_check: 1400, verify: 350 }

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
  ].filter((l) => l !== '').join('\n')
}

function exploreSummary(ctx: PassContext): string {
  const e = ctx.partial.explore
  if (!e) return ''
  const a = e.action as { type?: string; id?: string; title?: string; spec?: { prompt?: string } }
  return [
    'THE EXPLORE ITEM ALREADY WRITTEN FOR THIS STATION:',
    `  id "${a.id}", ${a.type === 'createCard' ? `a predict item: "${a.title}"` : `a material: "${a.spec?.prompt ?? ''}"`}`,
    `  Inky's opening line: "${e.opening}"`,
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
].join('\n')

const NAME_ASK = [
  'STAGE: NAME IT -- write three versions of the name-it turn, one for each way the explore can go:',
  '  "solved": they solved it first time -- build on the result they reached;',
  '  "helped": they solved it after a hint or two -- build on the result and on the step that was hard;',
  '  "untried": they moved on without trying it, or did not finish -- name the idea from the start.',
  'Never describe a result they did not reach in "untried".',
  'Each version: "say" (one line), and "actions": one or two createCard actions, a "connect" from the explore',
  'item to each card, and at most one "point" at the part of the explore item that shows the idea.',
  '',
  'Reply with JSON only: { "solved": { "say": "...", "actions": [...] }, "helped": {...}, "untried": {...} }',
].join('\n')

const PRACTICE_CHECK_ASK = [
  'STAGE: PRACTICE -- ONE near-twin of the explore: the same kind of thing with one thing changed, not harder.',
  'A "practice" card with "answer", "rubric" and the full "steps", or a material variant.',
  '',
  'STAGE: CHECK -- one or two questions on this station, gate "hard". Every MCQ gives "optionFeedback": one line',
  'for EACH option, written for a student who picked it -- why it is right, or what it missed. A "short"',
  'question carries a "rubric" that accepts the idea in any words.',
  '',
  'Reply with JSON only: { "practice": { "say": "...", "action": {...} },',
  '  "check": { "say": "<at most eight words>", "questions": [...] } }',
].join('\n')

function prompt(pass: Exclude<Pass, 'verify'>, ctx: PassContext): string {
  const head = [stationSystemPrompt(), '', context(ctx)]
  if (pass === 'explore') {
    return [...head, '', stagePrompt('explore', { missed: [], pace: 'step' }), '', materialRules(), advertiseVocabulary(), '', EXPLORE_ASK].join('\n')
  }
  if (pass === 'name') return [...head, '', exploreSummary(ctx), '', NAME_ASK].join('\n')
  return [...head, '', exploreSummary(ctx), '', materialRules(), '', PRACTICE_CHECK_ASK].join('\n')
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

async function explore(ctx: PassContext, opts: PassOptions): Promise<PassResult> {
  const got = await ask('explore', ctx, opts)
  if (!got) return { ok: false, reason: 'the explore pass did not come back as JSON' }
  // The live schema puts the intent on the material itself, and the model
  // follows it; it is taken from either place and kept off the action, as the
  // live path keeps it off the board.
  const { intent: onAction, ...bare } = (got.action ?? {}) as Record<string, unknown>
  const intent = got.intent ?? onAction
  const action = stepped({ ...bare, id: `${ctx.step.id}-explore` }, ctx.stepNo)
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

async function name(ctx: PassContext, opts: PassOptions): Promise<PassResult> {
  const exploreId = String((ctx.partial.explore?.action as { id?: unknown } | undefined)?.id ?? '')
  if (!exploreId) return { ok: false, reason: 'no explore item to name', redo: 'explore' }
  const got = await ask('name', ctx, opts)
  if (!got) return { ok: false, reason: 'the name pass did not come back as JSON' }
  const cuts: Partial<Record<Outcome, AuthoredCut>> = {}
  for (const o of OUTCOMES) {
    const cut = got[o] as { say?: unknown; actions?: unknown } | undefined
    if (!cut || !Array.isArray(cut.actions)) continue
    // The model's ids, mapped to the station's; its explore item is ours.
    const ids = new Map<string, string>()
    let n = 0
    for (const a of cut.actions) {
      const id = (a as { id?: unknown })?.id
      if ((a as { type?: unknown })?.type === 'createCard' && typeof id === 'string') ids.set(id, `${ctx.step.id}-${o}-${++n}`)
    }
    for (const a of cut.actions) {
      const r = a as { from?: unknown; nodeId?: unknown }
      for (const v of [r?.from, r?.nodeId]) if (typeof v === 'string' && !ids.has(v)) ids.set(v, exploreId)
    }
    cuts[o] = { say: String(cut.say ?? '').trim(), actions: rename(cut.actions, ids).map((a) => stepped(a, ctx.stepNo)) as never }
  }
  const problems = checkName(cuts, exploreId)
  return problems.length ? { ok: false, reason: problems.join('; ') } : { ok: true, partial: { name: cuts as StationBundle['name'] } }
}

async function practiceCheck(ctx: PassContext, opts: PassOptions): Promise<PassResult> {
  const got = await ask('practice_check', ctx, opts)
  if (!got) return { ok: false, reason: 'the practice and check pass did not come back as JSON' }
  const p = got.practice as { say?: unknown; action?: unknown } | undefined
  const c = got.check as { say?: unknown; questions?: unknown } | undefined
  const practice = { say: String(p?.say ?? '').trim(), action: stepped({ ...((p?.action as object) ?? {}), id: `${ctx.step.id}-practice` }, ctx.stepNo) as never }
  const check = { say: String(c?.say ?? '').trim(), questions: (Array.isArray(c?.questions) ? c.questions : []) as never }
  const problems = checkPracticeCheck(practice, check)
  return problems.length ? { ok: false, reason: problems.join('; ') } : { ok: true, partial: { practice, check } }
}

/** The judge's brief. A relationship is asked about only when the station has one. */
function judgeAsk(hasRelationship: boolean): string {
  return [
    'You check one station of a lesson before a student sees it. First write, in "truth", one line on what is',
    'actually true about the idea this station teaches' + (hasRelationship ? ' -- and how the quantity the student varies really affects the output' : '') + '.',
    'Then compare the station with that. Fail it ONLY for a definite error you can quote from it, word for word:',
    '  - a statement that is false (quote it, and say what is true);',
    '  - an answer key that is wrong;',
    '  - a feedback line that does not fit the option it is written for.',
    ...(hasRelationship
      ? ['  - a material whose slider and output model a relationship that is not true -- a "relationship" that disagrees with your "truth" is a definite error: quote it.']
      : []),
    'Never fail it for style, difficulty, or a way you would have taught it differently. If you cannot quote a',
    'definite error, it passes. Name the part to write again: "explore" (the material, opening, hints' + (hasRelationship ? ', relationship' : '') + '),',
    '"name" (the three name-it versions) or "practice_check" (the practice item and the check).',
    '',
    'Reply with JSON only: { "truth": "...", "ok": true } or',
    '{ "truth": "...", "ok": false, "pass": "explore" | "name" | "practice_check", "quote": "<the exact wrong text>", "reason": "<what is true>" }',
  ].join('\n')
}

/** Every string in the station, flattened: what a judge's quote must come from. */
function stationText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(stationText).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(stationText).join(' ')
  return ''
}
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

async function verify(ctx: PassContext, opts: PassOptions): Promise<PassResult> {
  const code = verifyBundleCode({ version: ctx.version, stepId: ctx.step.id, ...ctx.partial })
  if (!code.ok) return { ok: false, reason: code.reasons.join('; '), redo: code.pass }
  const raw = await callGemma(
    [judgeAsk(!!code.bundle.explore.relationship), '', `STATION: ${ctx.step.title} -- ${ctx.step.goal} (${ctx.subject ?? 'lesson'}: ${ctx.title})`, '', JSON.stringify(code.bundle)].join('\n'),
    {
      maxTokens: BUDGET.verify,
      temperature: 0,
      model: modelForJob('judge'),
      fallbackModel: fallbackForJob('judge'),
      signal: opts.signal,
      usage: opts.usage ? { feature: 'station_judge', requestId: opts.usage.requestId, userId: opts.usage.userId } : undefined,
    },
  )
  let verdict: { ok?: unknown; pass?: unknown; quote?: unknown; reason?: unknown }
  try {
    verdict = parseJsonRobust(raw)
  } catch {
    return { ok: false, reason: 'the judge did not come back as JSON' }
  }
  if (verdict?.ok === true) return { ok: true, bundle: code.bundle }
  // A failure has to quote the station. A judge that names an error which is
  // not in it -- "3/9 does not match", a vary complaint about a sort -- invented
  // it, and the station stands.
  const quote = squash(String(verdict?.quote ?? ''))
  if (!quote || !squash(stationText(code.bundle)).includes(quote)) return { ok: true, bundle: code.bundle }
  // The part to write again: the one the judge named, or else the one its
  // quote comes from.
  const b = code.bundle
  const named = ['explore', 'name', 'practice_check'].includes(String(verdict?.pass)) ? (verdict.pass as BundlePass) : null
  const redo: BundlePass =
    named ??
    (squash(stationText(b.explore)).includes(quote) ? 'explore' : squash(stationText(b.name)).includes(quote) ? 'name' : 'practice_check')
  return { ok: false, reason: String(verdict?.reason ?? 'the judge failed it'), redo }
}

/** Runs one pass of one station. */
export async function runPass(pass: Pass, ctx: PassContext, opts: PassOptions = {}): Promise<PassResult> {
  if (pass === 'explore') return explore(ctx, opts)
  if (pass === 'name') return name(ctx, opts)
  if (pass === 'practice_check') return practiceCheck(ctx, opts)
  return verify(ctx, opts)
}
