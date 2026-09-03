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
export function boardSummary(
  canvas: Pick<CanvasState, 'nodes'> | null | undefined,
  messages: { role: string; content?: string }[] = [],
): BoardSummary {
  const nodes = canvas?.nodes ?? []

  const cards = nodes
    .filter((n) => isCardKind(n.type) && !n.hidden)
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
    else if (isCardKind(n.type) && !n.data.aside) {
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

  return { cards, checkedSteps, cardsSinceCheck, askedByStep, recent }
}

/** Narrows an unknown request body's `board` field without trusting its shape. */
export function parseBoardSummary(raw: unknown): BoardSummary {
  const empty: BoardSummary = {
    cards: [], checkedSteps: [], cardsSinceCheck: {}, askedByStep: {}, recent: [],
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
