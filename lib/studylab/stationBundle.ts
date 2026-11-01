// lib/studylab/stationBundle.ts
import type { CheckpointQuestion, TutorAction } from './types'
import { isValidAction } from './actions'
import { isValidQuestion, questionFault } from './quiz'
import { practiceQuestion } from './practice'
import { meaningFaults } from './meaning'
import { validateSpec } from './activities/validate'
import { parseIntent, checkIntent, checkMaterialIntent, type TeachingIntent } from './activities/intent'
import { unmatchedArt } from './activities/artMatch'
import { getApparatus } from './material/canon'
import { getEngine } from './engines/registry'
import { validateMaterial } from './material/validate'
import { isSolvable } from './material/solvable'

/** The question formats a practice card may carry. */
const BY_HAND_FORMATS = ['mcq', 'fill', 'order', 'tap']

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
  /** A material's intent, kept beside it as the explore keeps its own; put back on for the gates when served. */
  intent?: TeachingIntent
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

/**
 * A ranking by a judgement has no key a teacher could not argue. The prompt
 * says never sort by one, but on a station about reliability the writer did,
 * twice (audit 9: a diary "more reliable" than a news report a week later),
 * and the judge let it through. A multiple choice may still ask for the best.
 */
const JUDGED = /\b(?:more|less|most|least|how)\s+(?:reliable|trustworthy|important|significant|useful|valuable|effective|successful)\b|\bby\s+(?:their\s+|its\s+)?(?:reliability|importance|significance|usefulness)\b/i
const allText = (v: unknown): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? v.map(allText).join(' ') : v && typeof v === 'object' ? Object.values(v).map(allText).join(' ') : ''

/** The judgement a sort, an order or a match ranks by, if it ranks by one. */
function judgedRanking(item: unknown): string | null {
  const x = item as { type?: unknown; format?: unknown; question?: unknown } | null
  const ranks = ['createActivity', 'build_material'].includes(typeOf(x)) || ['order', 'match'].includes(String(x?.format))
  const ranked = ranks ? allText(item).match(JUDGED) : x?.question !== undefined ? judgedRanking(x.question) : null
  return ranked ? ranked[0] : null
}

const JUDGED_FIX = 'which a teacher could argue: rank by a property the topic defines (made at the time or later; primary or secondary), or ask for the best one as a multiple choice'

/** A material or a predict item, judged as the live path judges one. */
function materialProblems(action: unknown, rawIntent: unknown, needIntent: boolean): { problems: string[]; intent: TeachingIntent | null } {
  const a = action as Record<string, unknown>
  const type = typeOf(a)
  const intent = parseIntent(rawIntent)
  if (type === 'createCard') {
    if (a.card !== 'practice') return { problems: ['a card to read is not something to handle'], intent }
    // A question answered by hand carries its own key; the worked steps are still Show me how.
    if (a.question !== undefined) {
      const fault = !BY_HAND_FORMATS.includes(String((a.question as { format?: unknown } | null)?.format)) ? 'it must be an mcq, fill, order or tap' : questionFault(a.question)
      if (fault || !practiceQuestion(a.question, String(a.id))) return { problems: [`the practice question cannot be answered: ${fault ?? 'it is malformed'}`], intent }
      if (!Array.isArray(a.steps) || a.steps.length === 0) return { problems: ['a practice item needs its worked steps'], intent }
      return { problems: [], intent }
    }
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
    // Well-formed is not enough: it must move when moved, start unsolved, keep its answers to itself, and picture what it names.
    const meaning = meaningFaults(a)
    if (meaning.length) return { problems: meaning, intent }
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
    const meaning = meaningFaults({ ...a, spec: validation.spec })
    if (meaning.length) return { problems: meaning, intent }
    return { problems: [], intent }
  }
  return { problems: [`"${type || 'nothing'}" is not a material or a practice item`], intent }
}

/** What is wrong with an explore item, if anything. */
/**
 * Why an explore or practice item is not a valid action, put so the next try
 * can act on it: "not a valid action" alone sent a truth table back into
 * "compose" twice, and "no valid practice item" told the binary station
 * nothing at all.
 */
function invalidItem(action: unknown, what: 'explore' | 'practice'): string {
  const type = typeOf(action)
  const instead = what === 'explore'
    ? 'or, where none honestly fits this station, a "Predict: ..." practice card'
    : 'or a "practice" card with "answer", "rubric" and "steps"'
  if (type === 'createActivity' || type === 'build_material') {
    const pattern = String((action as { spec?: { pattern?: unknown } } | null)?.spec?.pattern ?? type)
    // A scene its engine cannot read is a config to write again, not a dead end:
    // called a schema fault, the next try left the scene for a predict card.
    if (pattern === 'scene') {
      const p = (action as { spec?: { payload?: { engine?: unknown; config?: unknown } } }).spec?.payload
      const engine = getEngine(p?.engine)
      if (!engine) return `there is no scene "${String(p?.engine ?? '')}": use one from the SCENES list, or a different ${what} item`
      const shape = engine.prompt.slice(engine.prompt.indexOf('config:'), engine.prompt.indexOf('{ "type"')).replace(/\s+/g, ' ').trim()
      const before = engine.prompt.match(/substances?:[^\n]*|elements?:[^\n]*/)?.[0] ?? ''
      return `the "${engine.id}" scene could not read its config ${JSON.stringify(p?.config ?? null).slice(0, 240)}: write it exactly in the shape its catalogue entry gives -- ${[before, shape].filter(Boolean).join(' ').slice(0, 700)}`
    }
    return (
      `the "${pattern}" material does not match its apparatus's schema (its payload, prompt or success rule). ` +
      `Write a different ${what} item: a material whose schema you can fill exactly, ${instead}`
    )
  }
  if (type === 'createCard') {
    const kind = String((action as { card?: unknown }).card ?? '')
    return `the ${what} item is a card of kind "${kind}", which the board cannot draw -- use a "practice" card${what === 'explore' ? ' titled "Predict: ..."' : ''}`
  }
  return `the ${what} item is not something the board can build (type "${type}")`
}

export function checkExplore(e: Partial<AuthoredExplore> | undefined): string[] {
  if (!e || typeof e !== 'object') return ['no explore item']
  const out: string[] = []
  if (!text(e.opening)) out.push('no opening line')
  if (!isValidAction(e.action)) out.push(invalidItem(e.action, 'explore'))
  else {
    const isPredict = typeOf(e.action) === 'createCard'
    if (isPredict && !/^\s*predict\b/i.test(String((e.action as { title?: unknown }).title ?? ''))) {
      out.push('a card that opens a station must be a "Predict:" item')
    }
    const { problems, intent } = materialProblems(e.action, e.intent, !isPredict)
    out.push(...problems)
    const judged = judgedRanking(e.action)
    if (judged) out.push(`the explore item ranks by a judgement ("${judged}"), ${JUDGED_FIX}`)
    // A `vary` models a relationship; one the model made up passed every
    // other check. It has to say what it is and where it comes from. A scene
    // isolates magnitude too, but its numbers are the engine's, sourced in its code.
    const scene = (e.action as { spec?: { pattern?: unknown } }).spec?.pattern === 'scene'
    if (intent?.isolates === 'magnitude' && !scene && !(text(e.relationship?.statement) && text(e.relationship?.source))) {
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
  // Said in words a pass can fix, where the format says why.
  const fault = questionFault(q)
  if (fault) return [`question ${i + 1} (${(q as { format?: unknown }).format}) cannot be answered: ${fault}`]
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
  if (!p || typeof p !== 'object' || !p.action) out.push('no practice item')
  else if (!isValidAction(p.action)) out.push(invalidItem(p.action, 'practice'))
  // Judged as serving judges it: a material without its intent passed here and
  // was refused at serve time, sending a station that was ready live.
  else out.push(...materialProblems(p.action, p.intent, true).problems)
  const judged = p && typeof p === 'object' ? judgedRanking(p.action) : null
  if (judged) out.push(`the practice item ranks by a judgement ("${judged}"), ${JUDGED_FIX}`)
  if (!c || typeof c !== 'object' || !Array.isArray(c.questions)) out.push('no check')
  else {
    if (c.questions.length < 1 || c.questions.length > 2) out.push(`a check has one or two questions, not ${c.questions.length}`)
    c.questions.forEach((q, i) => {
      out.push(...questionProblems(q, i))
      const ranked = judgedRanking(q)
      if (ranked) out.push(`question ${i + 1} ranks by a judgement ("${ranked}"), ${JUDGED_FIX}`)
    })
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
