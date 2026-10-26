// lib/studylab/bubble.ts
import type { ChatMessage } from './types'

/**
 * Inky's speech bubble: what it says, and where on the board it can say it.
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
/** Gap between Inky and its bubble. */
const GAP = 12

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
 * Where the bubble goes: beside Inky, then above it, then the same two places
 * as a one-line pill. If none is free, the pill beside Inky -- the smallest
 * thing that can still be read and opened.
 */
export function placeBubble(input: {
  board: Rect
  inky: Rect
  avoid: Rect[]
  size: { w: number; h: number }
  compact: { w: number; h: number }
}): { x: number; y: number; compact: boolean; tail: 'left' | 'bottom' } {
  const { board, inky, avoid, size, compact } = input
  const beside = (s: { w: number; h: number }) => ({ x: inky.x + inky.w + GAP, y: inky.y + inky.h - s.h, ...s })
  const above = (s: { w: number; h: number }) => ({ x: inky.x, y: inky.y - GAP - s.h, ...s })

  const candidates = [
    { rect: beside(size), compact: false, tail: 'left' as const },
    { rect: above(size), compact: false, tail: 'bottom' as const },
    { rect: beside(compact), compact: true, tail: 'left' as const },
    { rect: above(compact), compact: true, tail: 'bottom' as const },
  ]
  const pick = candidates.find((c) => inside(c.rect, board) && clear(c.rect, avoid)) ?? candidates[2]
  return { x: pick.rect.x, y: pick.rect.y, compact: pick.compact, tail: pick.tail }
}
