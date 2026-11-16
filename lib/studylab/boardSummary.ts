// lib/studylab/boardSummary.ts
import { isCardKind } from './blocks'
import type { CanvasState, StudyNode } from './types'

/**
 * What the teaching job needs to know about the board it is building on.
 *
 * The tutor writes cards onto a canvas that already has cards on it. Without
 * being told what is there it has no way to avoid repeating itself, and no id
 * to connect a new card to — so it invents both. That is exactly what happened:
 * four near-identical cards on one idea, and "see the card" pointing at a card
 * that was never created, because the reducer drops a create whose title
 * duplicates one already on the board.
 *
 * Kept deliberately thin — ids, titles and step numbers, not bodies. The point
 * is to let the model recognise what exists, not to re-read the whole lesson
 * back to it on every turn.
 */
export interface BoardSummary {
  /** Cards already on the canvas, oldest first. */
  cards: { id: string; title: string; step: number; kind: string; aside?: boolean }[]
  /** Step numbers that already carry a checkpoint. */
  checkedSteps: number[]
  /**
   * Cards on each step added since that step's most recent check.
   *
   * `checkedSteps` alone cannot tell a step that has been checked and settled
   * from one whose check was FAILED and is being re-taught. Reading it as "this
   * step is done being checked" meant a missed question left the step
   * unclosable: the tutor re-taught, and re-taught, and never asked again.
   */
  cardsSinceCheck: Record<number, number>
  /**
   * A card made in answer to a question does not count. The check arrives after
   * a step's worth of teaching, counted off the board — so three questions,
   * each answered with a card, used to bring the check forward and the step got
   * taught less than one nobody asked anything about.
   */
  /**
   * Questions already put to the learner, by step.
   *
   * A retry after a miss asked the same question again, worded a shade
   * differently — three checks stacked on one step, all asking why someone
   * plays the world's smallest violin, none of them a second chance at
   * anything. The check job is told what it has already asked.
   */
  askedByStep: Record<number, string[]>
  /**
   * The practice problem the learner missed on each step, while it is still
   * the latest practice there -- the next item is a near-twin of it. One
   * answered right after it clears it.
   */
  missedByStep: Record<number, string[]>
  /**
   * How the first hands-on card of each step -- a station's explore item --
   * went: solved, tried, or not touched, and what they wrote on a predict
   * item. The name turn builds on this; without it, it narrated results the
   * learner never reached.
   */
  exploreByStep: Record<number, Explored>
  /** The last few chat turns, so the tutor does not repeat its own sentences. */
  recent: { role: 'user' | 'assistant'; text: string }[]
}

/** Card titles are compared case-insensitively by the reducer; match that. */
function titleOf(node: StudyNode): string {
  return (node.data.title ?? '').trim()
}

const MAX_CARDS = 60
const MAX_RECENT = 6
const RECENT_CHARS = 240

/**
 * Reduces the live canvas and transcript to the facts the tutor must not guess.
 *
 * Runs on the client, because the client holds the authoritative canvas — the
 * server's copy is a debounced autosave and can be up to a beat behind, which
 * is precisely the window in which a duplicate gets created.
 */
export interface Explored {
  outcome: 'solved' | 'tried' | 'untried'
  attempts: number
  /** What they wrote, on a practice or predict item. The student's own words. */
  answer?: string
}

const OUTCOMES = new Set(['solved', 'tried', 'untried'])

function exploredOf(n: StudyNode): Explored {
  const d = n.data as {
    activityState?: { status?: string; attempts?: number }
    materialState?: { status?: string; attempts?: number }
    practice?: { state?: string; attempts?: number; attempt?: string; revealed?: boolean }
  }
  if (n.type === 'practice') {
    const p = d.practice ?? {}
    const answered = p.state === 'correct' || p.state === 'incorrect' || p.state === 'close'
    const outcome: Explored['outcome'] = p.state === 'correct' ? 'solved' : answered || p.revealed ? 'tried' : 'untried'
    const attempts = Number(p.attempts) || (answered ? 1 : 0)
    const answer = String(p.attempt ?? '').trim().slice(0, MISSED_CHARS)
    return answer ? { outcome, attempts, answer } : { outcome, attempts }
  }
  const s = n.type === 'activity' ? d.activityState : d.materialState
  const attempts = Number(s?.attempts) || 0
  const outcome: Explored['outcome'] = s?.status === 'solved' ? 'solved' : s?.status === 'in_progress' || attempts > 0 ? 'tried' : 'untried'
  return { outcome, attempts }
}

export function boardSummary(
  canvas: Pick<CanvasState, 'nodes'> | null | undefined,
  messages: { role: string; content?: string }[] = [],
): BoardSummary {
  const nodes = canvas?.nodes ?? []

  // The homework question counts as a card here even though it is not a
  // `CardKind`: the tutor has to know it is on the board so it can connect its
  // working to it. Left off the list, the first card of a homework step had
  // nothing to hang from and was laid out on top of the question instead.
  const cards = nodes
    .filter(
      (n) =>
        (isCardKind(n.type) || n.type === 'question' || n.type === 'activity' || n.type === 'material') &&
        !n.hidden,
    )
    .map((n) => ({
      id: n.id,
      title: titleOf(n),
      step: Number(n.data.step) || 0,
      // Carried so the prompt can notice a run of one card type. Told to use
      // variety in the abstract the model produces concept cards and nothing
      // else; told it has just made four concept cards, it does not.
      kind: String(n.type),
      ...(n.data.aside ? { aside: true as const } : {}),
    }))
    // A card with no title cannot be recognised or referred to, so listing it
    // would only spend tokens.
    .filter((c) => c.title.length > 0)
    .slice(-MAX_CARDS)

  // Walked in board order: a checkpoint resets its step's counter, so what
  // remains is what has been taught since the learner was last asked.
  const cardsSinceCheck: Record<number, number> = {}
  for (const n of nodes) {
    if (n.hidden) continue
    const step = Number(n.data.step) || 0
    if (step < 1) continue
    if (n.type === 'quiz' || n.type === 'checkpointHeader') cardsSinceCheck[step] = 0
    else if ((isCardKind(n.type) || n.type === 'activity' || n.type === 'material') && !n.data.aside) {
      cardsSinceCheck[step] = (cardsSinceCheck[step] ?? 0) + 1
    }
  }

  // Hidden ones count. A check that was failed is hidden rather than deleted
  // precisely so this survives it: a question the learner has already been
  // asked and missed must not come back reworded, whether or not it is still
  // on screen. (`checkedSteps` and `cardsSinceCheck` still skip hidden nodes —
  // a failed check is not a step that has been checked.)
  const askedByStep: Record<number, string[]> = {}
  for (const n of nodes) {
    const q = n.data.quiz
    if (!q) continue
    const step = Number(n.data.step) || 0
    const prompt = String(q.question?.prompt ?? '').trim()
    if (step < 1 || !prompt) continue
    askedByStep[step] = [...(askedByStep[step] ?? []), prompt].slice(-6)
  }

  // Quiz cells carry their step on the node like any other; a step that already
  // has one has been tested, and testing it twice is the complaint the old
  // prompt's "rule 3a" existed to prevent.
  const checkedSteps = [
    ...new Set(
      nodes
        .filter((n) => (n.type === 'quiz' || n.type === 'checkpointHeader') && !n.hidden)
        .map((n) => Number(n.data.step) || 0)
        .filter((s) => s > 0),
    ),
  ].sort((a, b) => a - b)

  const recent = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_RECENT)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      text: (m.content ?? '').trim().slice(0, RECENT_CHARS),
    }))
    .filter((m) => m.text.length > 0)

  // The latest practice on each step, in board order; missed ("incorrect", or
  // "close", which is still a miss) means the next item is a near-twin of it.
  const latestPractice: Record<number, StudyNode> = {}
  for (const n of nodes) {
    const step = Number(n.data.step) || 0
    if (n.type === 'practice' && !n.hidden && step > 0) latestPractice[step] = n
  }
  const missedByStep: Record<number, string[]> = {}
  for (const [step, n] of Object.entries(latestPractice)) {
    const state = (n.data as { practice?: { state?: string } }).practice?.state
    const prompt = String(n.data.body || n.data.title || '').trim().slice(0, MISSED_CHARS)
    if ((state === 'incorrect' || state === 'close') && prompt) missedByStep[Number(step)] = [prompt]
  }

  const exploreByStep: Record<number, Explored> = {}
  for (const n of nodes) {
    const step = Number(n.data.step) || 0
    if (n.hidden || step < 1 || step in exploreByStep) continue
    if (n.type === 'activity' || n.type === 'material' || n.type === 'practice') exploreByStep[step] = exploredOf(n)
  }

  return { cards, checkedSteps, cardsSinceCheck, askedByStep, missedByStep, exploreByStep, recent }
}

/** Enough of a missed problem for the tutor to set its twin. */
const MISSED_CHARS = 300

/** Narrows an unknown request body's `board` field without trusting its shape. */
export function parseBoardSummary(raw: unknown): BoardSummary {
  const empty: BoardSummary = {
    cards: [], checkedSteps: [], cardsSinceCheck: {}, askedByStep: {}, missedByStep: {}, exploreByStep: {}, recent: [],
  }
  if (!raw || typeof raw !== 'object') return empty
  const b = raw as Partial<BoardSummary>

  return {
    cards: (Array.isArray(b.cards) ? b.cards : [])
      .filter(
        (c): c is { id: string; title: string; step: number; kind: string; aside?: boolean } =>
          !!c && typeof c === 'object' && typeof c.id === 'string' && typeof c.title === 'string',
      )
      .map((c) => ({
        id: c.id,
        title: c.title,
        step: Number(c.step) || 0,
        kind: typeof c.kind === 'string' ? c.kind : 'concept',
        ...(c.aside === true ? { aside: true as const } : {}),
      }))
      .slice(0, MAX_CARDS),
    askedByStep:
      b.askedByStep && typeof b.askedByStep === 'object'
        ? Object.fromEntries(
            Object.entries(b.askedByStep)
              .map(([k, v]) => [Number(k), (Array.isArray(v) ? v : []).filter((x) => typeof x === 'string')])
              .filter(([k]) => Number.isInteger(k)),
          )
        : {},
    exploreByStep:
      b.exploreByStep && typeof b.exploreByStep === 'object'
        ? Object.fromEntries(
            Object.entries(b.exploreByStep as Record<string, unknown>)
              .map(([k, v]): [number, Explored | null] => {
                const e = v as Partial<Explored> | null
                if (!e || typeof e !== 'object' || !OUTCOMES.has(String(e.outcome))) return [Number(k), null]
                const out: Explored = { outcome: e.outcome as Explored['outcome'], attempts: Number(e.attempts) || 0 }
                if (typeof e.answer === 'string' && e.answer.trim()) out.answer = e.answer.slice(0, MISSED_CHARS)
                return [Number(k), out]
              })
              .filter((pair): pair is [number, Explored] => Number.isInteger(pair[0]) && pair[1] !== null),
          )
        : {},
    missedByStep:
      b.missedByStep && typeof b.missedByStep === 'object'
        ? Object.fromEntries(
            Object.entries(b.missedByStep)
              .map(([k, v]) => [
                Number(k),
                (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, MISSED_CHARS)).slice(0, 3),
              ])
              .filter(([k, v]) => Number.isInteger(k) && (v as string[]).length > 0),
          )
        : {},
    cardsSinceCheck:
      b.cardsSinceCheck && typeof b.cardsSinceCheck === 'object'
        ? Object.fromEntries(
            Object.entries(b.cardsSinceCheck)
              .map(([k, v]) => [Number(k), Number(v)])
              .filter(([k, v]) => Number.isInteger(k) && Number.isFinite(v)),
          )
        : {},
    checkedSteps: (Array.isArray(b.checkedSteps) ? b.checkedSteps : [])
      .map((s) => Number(s))
      .filter((s) => Number.isInteger(s) && s > 0),
    recent: (Array.isArray(b.recent) ? b.recent : [])
      .filter(
        (m): m is { role: 'user' | 'assistant'; text: string } =>
          !!m && typeof m === 'object' && typeof m.text === 'string',
      )
      .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), text: m.text }))
      .slice(-MAX_RECENT),
  }
}
