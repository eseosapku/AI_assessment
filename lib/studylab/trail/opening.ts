// lib/studylab/trail/opening.ts
import type { ChatMessage, ChatPlan } from '../types'
import type { Insets } from './camera'
import { PAD, SPEAKER_H } from './layout'
import type { Point, Rect, TrailWorld } from './types'

/**
 * The moment before a lesson starts: the whole journey on the board, Kana's
 * question, and Start.
 */

const YES_NO_SHAPED = /^(have|has|do|does|did|can|could|is|are|would|will)\s/i

/** A question that can be answered yes or no gets two big answers. Anything else is the learner's to type. */
export function openingChips(question: string): string[] {
  return YES_NO_SHAPED.test(question.trim()) ? ['Yes, a bit', 'Not yet'] : []
}

/** One at a time. With none left, the only thing to do is Start. */
export function nextQuestion(questions: string[], asked: ReadonlySet<string>): string | null {
  return questions.find((q) => !asked.has(q)) ?? null
}

/** The plan on the table: the newest one, and only while it can still be answered. */
export function planFrom(messages: ChatMessage[]): ChatPlan | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.kind === 'plan') return m.plan?.live ? m.plan : null
  }
  return null
}

export const KANA_W = 150
const RESTING_BUBBLE_W = 420
/** Kana and her question stand in this much of the screen, above the button, while the whole board is in view. */
const OPENING_BAND = 150

/** With no card in focus, Kana waits on the plot the journey is at. */
export function restingSpot(world: TrailWorld): { kana: Point; bubble: Rect } | null {
  const plot = world.plots.find((p) => p.state === 'next' || p.state === 'current') ?? world.plots[world.plots.length - 1]
  if (!plot) return null
  const at = { x: plot.rect.x + PAD, y: plot.rect.y + PAD }
  return { kana: at, bubble: { x: at.x + KANA_W, y: at.y, w: RESTING_BUBBLE_W, h: SPEAKER_H } }
}

/**
 * The opening shows every station, zoomed far out, where a bubble drawn on the
 * board would be too small to read. So the camera leaves a band of screen for Kana.
 */
export function openingInsets(insets: Insets): Insets {
  return { ...insets, bottom: insets.bottom + OPENING_BAND }
}
