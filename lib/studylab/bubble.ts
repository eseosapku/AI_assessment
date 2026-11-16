// lib/studylab/bubble.ts
import type { ChatMessage } from './types'

/**
 * Kana's speech bubble: what it says, and where on the board it can say it.
 *
 * The chat is a drawer now, closed by default, so the tutor's latest line has
 * to be readable without opening anything -- and it must never sit on top of
 * the work it is talking about. Brilliant's bubble covered the problem three
 * times in our walk-through; placement here is decided against the rects of
 * whatever is in the spotlight.
 */

export interface TutorLine {
  /** Position in the transcript, so a new line can be told from the same one. */
  index: number
  text: string
  tone: 'say' | 'refusal' | 'error'
  /** Only on the very last message: an old error retrying an old action would surprise. */
  retryAction?: Record<string, unknown>
}

/** The newest thing the tutor said, skipping bookkeeping and interactive cards. */
export function latestLine(messages: ChatMessage[]): TutorLine | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'assistant') continue
    if (m.kind && m.kind !== 'refusal' && m.kind !== 'error') continue
    if (!m.content?.trim()) continue
    const line: TutorLine = { index: i, text: m.content, tone: m.kind ?? 'say' }
    if (m.retryAction && i === messages.length - 1) line.retryAction = m.retryAction
    return line
  }
  return null
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Room left between the bubble and the work, so it never sits flush against a card. */
const MARGIN = 8
/** Gap between Kana and its bubble. */
const GAP = 12
/** How far above Kana the bubble may rise to clear the bar, and in what steps. */
const LIFT_STEP = 24
const MAX_LIFT = 96

function inside(r: Rect, board: Rect): boolean {
  return r.x >= board.x && r.y >= board.y && r.x + r.w <= board.x + board.w && r.y + r.h <= board.y + board.h
}

function clear(r: Rect, avoid: Rect[]): boolean {
  return avoid.every(
    (a) =>
      r.x + r.w <= a.x - MARGIN ||
      r.x >= a.x + a.w + MARGIN ||
      r.y + r.h <= a.y - MARGIN ||
      r.y >= a.y + a.h + MARGIN,
  )
}

/**
 * Where the bubble goes: beside Kana, then above it (rising a little if a bar
 * reaches in underneath), then the same places as a one-line pill. If none is
 * free, the pill beside Kana -- the smallest thing that can still be read and
 * opened.
 */
export function placeBubble(input: {
  board: Rect
  inky: Rect
  avoid: Rect[]
  size: { w: number; h: number }
  compact: { w: number; h: number }
}): { x: number; y: number; compact: boolean; tail: 'left' | 'bottom'; w?: number } {
  const { board, inky, avoid, size, compact } = input
  const beside = (s: { w: number; h: number }) => ({ x: inky.x + inky.w + GAP, y: inky.y + inky.h - s.h, ...s })
  const above = (s: { w: number; h: number }) => ({ x: inky.x, y: inky.y - GAP - s.h, ...s })

  // A bar along the foot of the board can reach in under Kana; a little
  // higher than just-above is still Kana's bubble, and clear of it.
  const lifted = (s: { w: number; h: number }) => {
    const out: Rect[] = []
    for (let up = LIFT_STEP; up <= MAX_LIFT; up += LIFT_STEP) out.push({ ...above(s), y: above(s).y - up })
    return out
  }
  const fallback = { rect: beside(compact), compact: true, tail: 'left' as const }
  const candidates = [
    { rect: beside(size), compact: false, tail: 'left' as const },
    { rect: above(size), compact: false, tail: 'bottom' as const },
    ...lifted(size).map((rect) => ({ rect, compact: false, tail: 'bottom' as const })),
    fallback,
    { rect: above(compact), compact: true, tail: 'bottom' as const },
    ...lifted(compact).map((rect) => ({ rect, compact: true, tail: 'bottom' as const })),
  ]
  const pick = candidates.find((c) => inside(c.rect, board) && clear(c.rect, avoid))
  if (pick) return { x: pick.rect.x, y: pick.rect.y, compact: pick.compact, tail: pick.tail }
  // Nothing is free. On a phone even the pill beside Kana runs off the board,
  // so there it narrows to the room there is, and its line truncates.
  const room = board.x + board.w - MARGIN - fallback.rect.x
  const { x, y } = fallback.rect
  return room < compact.w ? { x, y, compact: true, tail: 'left', w: Math.max(room, 0) } : { x, y, compact: true, tail: 'left' }
}

/** Room between the arrow's tip and the part, so the part's glow stays clear. */
const ARROW_GAP = 6

/**
 * The arrow from Kana's bubble to the part it points at: from the bubble's edge,
 * along the line between the two centres, to just short of the part. Null when
 * they touch or overlap -- there is nowhere for an arrow to go.
 */
export function arrowBetween(from: Rect, to: Rect): { x1: number; y1: number; x2: number; y2: number } | null {
  const room: Rect = { x: to.x - ARROW_GAP, y: to.y - ARROW_GAP, w: to.w + 2 * ARROW_GAP, h: to.h + 2 * ARROW_GAP }
  const touching =
    from.x < room.x + room.w && from.x + from.w > room.x && from.y < room.y + room.h && from.y + from.h > room.y
  if (touching) return null
  const start = edgeToward(from, centre(to))
  const end = edgeToward(room, centre(from))
  const r = (v: number) => Math.round(v * 10) / 10
  return { x1: r(start.x), y1: r(start.y), x2: r(end.x), y2: r(end.y) }
}

function centre(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Where the line from a rect's centre toward a point leaves the rect. */
function edgeToward(r: Rect, target: { x: number; y: number }): { x: number; y: number } {
  const c = centre(r)
  const dx = target.x - c.x
  const dy = target.y - c.y
  const s = Math.min(dx ? r.w / 2 / Math.abs(dx) : Infinity, dy ? r.h / 2 / Math.abs(dy) : Infinity)
  return { x: c.x + dx * s, y: c.y + dy * s }
}
