// lib/studylab/stationBundle.ts
import type { CheckpointQuestion, TutorAction } from './types'
import { isValidAction } from './actions'
import { isValidQuestion } from './quiz'
import { validateSpec } from './activities/validate'
import { parseIntent, checkIntent, checkMaterialIntent, type TeachingIntent } from './activities/intent'
import { unmatchedArt } from './activities/artMatch'
import { getApparatus } from './material/canon'
import { validateMaterial } from './material/validate'
import { isSolvable } from './material/solvable'

/**
 * A station written ahead of the learner: the explore item, name-it cards for
 * each way the explore can go, a practice item and the check.
 *
 * It is served with no model in the loop, so anything wrong with it reaches
 * the learner as it is. `verifyBundleCode` makes every check code can make --
 * the same ones the live path makes on a material, plus the keys and feedback
 * of the check -- before a judge is asked about facts.
 */
export interface AuthoredExplore {
  /** Inky's opening line: what to notice, never the instructions. */
  opening: string
  /** A material (createActivity / build_material), or a "Predict:" practice card where none fits. */
  action: TutorAction
  intent?: TeachingIntent
  /** A `vary` material's relationship, cited: an invented formula must say where it comes from. */
  relationship?: { statement: string; source: string }
  /** What Inky says after a miss, in order. */
  hints: string[]
}

export interface AuthoredCut {
  say: string
  /** One or two cards, the connects between them, and at most one point. */
  actions: TutorAction[]
}

export interface AuthoredItem {
  say: string
  action: TutorAction
}

export interface AuthoredCheck {
  say: string
  questions: CheckpointQuestion[]
}

/** The name-it cards for each way the explore can go. */
export type Outcome = 'solved' | 'helped' | 'untried'

export interface StationBundle {
  /** What it was written for (`stationVersion`): a bundle for an older step is never served. */
  version: string
  stepId: string
  explore: AuthoredExplore
  name: Record<Outcome, AuthoredCut>
  practice: AuthoredItem
  check: AuthoredCheck
}

export type BundlePass = 'explore' | 'name' | 'practice_check'

export type BundleVerdict =
  | { ok: true; bundle: StationBundle }
  | { ok: false; pass: BundlePass; reasons: string[] }

const OUTCOMES: readonly Outcome[] = ['solved', 'helped', 'untried']

const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const typeOf = (a: unknown): string => String((a as { type?: unknown } | null)?.type ?? '')

/** A material or a predict item, judged as the live path judges one. */
function materialProblems(action: unknown, rawIntent: unknown, needIntent: boolean): { problems: string[]; intent: TeachingIntent | null } {
  const a = action as Record<string, unknown>
  const type = typeOf(a)
  const intent = parseIntent(rawIntent)
  if (type === 'createCard') {
    if (a.card !== 'practice') return { problems: ['a card to read is not something to handle'], intent }
    if (!text(a.answer) || !Array.isArray(a.steps) || a.steps.length === 0) {
      return { problems: ['a practice item needs its answer and worked steps'], intent }
    }
    return { problems: [], intent }
  }
  if (type === 'createActivity') {
    if (!validateSpec(a.spec)) return { problems: ['the activity spec is malformed'], intent }
    if (!intent) return { problems: needIntent ? ['a material needs its intent'] : [], intent }
    const verdict = checkIntent(intent, a.spec)
    if (!verdict.ok) return { problems: [verdict.reason], intent }
    const wordy = unmatchedArt(a.spec as never)
    if (wordy.length) return { problems: [`words where the catalogue has pictures: ${wordy.join(', ')}`], intent }
    return { problems: [], intent }
  }
  if (type === 'build_material') {
    if (!intent) return { problems: ['a material needs its intent'], intent }
    const apparatus = getApparatus(intent.apparatus)
    if (!apparatus) return { problems: [`unknown apparatus "${intent.apparatus}"`], intent }
    const validation = validateMaterial(a.spec, apparatus.maxVaryingTraits)
    if (!validation.ok) return { problems: [validation.reason], intent }
    const verdict = checkMaterialIntent(intent, validation.spec)
    if (!verdict.ok) return { problems: [verdict.reason], intent }
    if (!isSolvable(validation.spec).ok) return { problems: ['the material cannot be solved'], intent }
    return { problems: [], intent }
  }
  return { problems: [`"${type || 'nothing'}" is not a material or a practice item`], intent }
}

/** What is wrong with an explore item, if anything. */
export function checkExplore(e: Partial<AuthoredExplore> | undefined): string[] {
  if (!e || typeof e !== 'object') return ['no explore item']
  const out: string[] = []
  if (!text(e.opening)) out.push('no opening line')
  if (!isValidAction(e.action)) out.push('the explore item is not a valid action')
  else {
    const isPredict = typeOf(e.action) === 'createCard'
    if (isPredict && !/^\s*predict\b/i.test(String((e.action as { title?: unknown }).title ?? ''))) {
      out.push('a card that opens a station must be a "Predict:" item')
    }
    const { problems, intent } = materialProblems(e.action, e.intent, !isPredict)
    out.push(...problems)
    // A `vary` models a relationship; one the model made up passed every
    // other check. It has to say what it is and where it comes from.
    if (intent?.isolates === 'magnitude' && !(text(e.relationship?.statement) && text(e.relationship?.source))) {
      out.push('a vary material must cite the relationship it models, with a source')
    }
  }
  if (e.hints !== undefined && !(Array.isArray(e.hints) && e.hints.every((h) => typeof h === 'string'))) out.push('hints must be lines of text')
  return out
}

function cutProblems(cut: Partial<AuthoredCut> | undefined, outcome: Outcome, ids: Set<string>): string[] {
  if (!cut || typeof cut !== 'object' || !Array.isArray(cut.actions)) return [`no name-it cut for "${outcome}"`]
  const out: string[] = []
  if (typeof cut.say !== 'string') out.push(`the "${outcome}" cut says nothing`)
  const cards = cut.actions.filter((a) => typeOf(a) === 'createCard')
  const points = cut.actions.filter((a) => typeOf(a) === 'point')
  if (cards.length < 1 || cards.length > 2) out.push(`the "${outcome}" cut must have one or two cards, not ${cards.length}`)
  if (points.length > 1) out.push(`the "${outcome}" cut points more than once`)
  for (const a of cut.actions) {
    if (!['createCard', 'connect', 'point'].includes(typeOf(a))) out.push(`the "${outcome}" cut builds a "${typeOf(a)}"`)
    else if (!isValidAction(a)) out.push(`the "${outcome}" cut has an invalid ${typeOf(a)}`)
  }
  for (const p of points) {
    const target = String((p as { nodeId?: unknown }).nodeId ?? '')
    if (!ids.has(target)) out.push(`the "${outcome}" cut points at "${target}", which is not in this station`)
  }
  return out
}

function questionProblems(q: CheckpointQuestion, i: number): string[] {
  if (!isValidQuestion(q)) return [`question ${i + 1} is malformed`]
  if (q.format === 'mcq') {
    const out: string[] = []
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) out.push(`question ${i + 1}'s key is out of range`)
    const fb = q.optionFeedback
    if (!Array.isArray(fb) || fb.length !== q.options.length) out.push(`question ${i + 1} needs a feedback line for every option`)
    else fb.forEach((line, j) => {
      if (j !== q.answer && !text(line)) out.push(`question ${i + 1}'s option ${j + 1} has nothing to say to whoever picks it`)
    })
    return out
  }
  if (q.format === 'short' && !text(q.rubric)) return [`question ${i + 1} has no rubric to mark it by`]
  return []
}

/** What is wrong with a practice item and its check, if anything. */
export function checkPracticeCheck(p: Partial<AuthoredItem> | undefined, c: Partial<AuthoredCheck> | undefined): string[] {
  const out: string[] = []
  if (!p || typeof p !== 'object' || !isValidAction(p.action)) out.push('no valid practice item')
  else out.push(...materialProblems(p.action, undefined, false).problems)
  if (!c || typeof c !== 'object' || !Array.isArray(c.questions)) out.push('no check')
  else {
    if (c.questions.length < 1 || c.questions.length > 2) out.push(`a check has one or two questions, not ${c.questions.length}`)
    c.questions.forEach((q, i) => out.push(...questionProblems(q, i)))
  }
  return out
}

/** What is wrong with the three name-it cuts, given the explore item's id. */
export function checkName(name: Partial<Record<Outcome, AuthoredCut>> | undefined, exploreId: string): string[] {
  const ids = new Set<string>([exploreId])
  for (const o of OUTCOMES) for (const a of name?.[o]?.actions ?? []) if (typeOf(a) === 'createCard') ids.add(String((a as { id?: unknown }).id))
  return OUTCOMES.flatMap((o) => cutProblems(name?.[o], o, ids))
}

/** Every check code can make on a station, by the pass that wrote what failed. */
export function verifyBundleCode(raw: unknown): BundleVerdict {
  const b = (raw ?? {}) as Partial<StationBundle>
  const explore = checkExplore(b.explore)
  if (!text(b.version) || !text(b.stepId)) explore.unshift('no version or step')
  if (explore.length) return { ok: false, pass: 'explore', reasons: explore }

  const name = checkName(b.name, String((b.explore!.action as { id?: unknown }).id ?? ''))
  if (name.length) return { ok: false, pass: 'name', reasons: name }

  const pc = checkPracticeCheck(b.practice, b.check)
  if (pc.length) return { ok: false, pass: 'practice_check', reasons: pc }
  return { ok: true, bundle: b as StationBundle }
}
