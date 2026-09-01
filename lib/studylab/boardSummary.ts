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
  cards: { id: string; title: string; step: number }[]
  /** Step numbers that already carry a checkpoint. */
  checkedSteps: number[]
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
    }))
    // A card with no title cannot be recognised or referred to, so listing it
    // would only spend tokens.
    .filter((c) => c.title.length > 0)
    .slice(-MAX_CARDS)

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

  return { cards, checkedSteps, recent }
}

/** Narrows an unknown request body's `board` field without trusting its shape. */
export function parseBoardSummary(raw: unknown): BoardSummary {
  const empty: BoardSummary = { cards: [], checkedSteps: [], recent: [] }
  if (!raw || typeof raw !== 'object') return empty
  const b = raw as Partial<BoardSummary>

  return {
    cards: (Array.isArray(b.cards) ? b.cards : [])
      .filter(
        (c): c is { id: string; title: string; step: number } =>
          !!c && typeof c === 'object' && typeof c.id === 'string' && typeof c.title === 'string',
      )
      .map((c) => ({ id: c.id, title: c.title, step: Number(c.step) || 0 }))
      .slice(0, MAX_CARDS),
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
