// lib/studylab/check/answers.ts
import type { CheckpointQuestion, QuizCell } from '../types'
import { blanksIn } from '../quiz'
import { attemptText } from '../attempt'
import { regionsFor } from './diagramRegions'

/**
 * A question's answer as a card holds it, whichever card asks: an option's
 * index, written text, or what was placed or tapped ('' for an empty place).
 */
export type Answer = number | string | string[] | undefined

/** Where a card starts: the answer saved with it, or nothing given yet. */
export function initialAnswer(q: CheckpointQuestion, given: QuizCell['given']): Answer {
  if (q.format === 'mcq') return typeof given === 'number' ? given : undefined
  if (q.format === 'match') return Array.isArray(given) ? given : q.pairs.map(() => '')
  if (q.format === 'code') return typeof given === 'string' ? given : q.starter ?? ''
  if (q.format === 'fill') return places(given, blanksIn(q.text))
  if (q.format === 'order') return places(given, q.items.length)
  if (q.format === 'tap') return Array.isArray(given) ? given.filter((g): g is string => typeof g === 'string') : []
  return typeof given === 'string' ? given : ''
}

/** A saved fill or order back in its places, '' where nothing was put. */
function places(given: QuizCell['given'], n: number): string[] {
  const saved = Array.isArray(given) ? given : []
  return Array.from({ length: n }, (_, i) => (typeof saved[i] === 'string' ? saved[i] : ''))
}

/** The answer as given, in words: what Get help sends for the tutor to read back. */
export function attemptOf(q: CheckpointQuestion, a: Answer): string {
  if (q.format === 'mcq') return attemptText({ kind: 'mcq', options: q.options, chosen: typeof a === 'number' ? a : undefined })
  if (q.format === 'match') return attemptText({ kind: 'match', pairs: q.pairs, given: Array.isArray(a) ? a : [] })
  if (q.format === 'fill') return attemptText({ kind: 'fill', text: q.text, given: Array.isArray(a) ? a : [] })
  if (q.format === 'order') return attemptText({ kind: 'order', given: Array.isArray(a) ? a : [] })
  if (q.format === 'tap') {
    const labels = new Map((regionsFor(q.figure)?.regions ?? []).map((r) => [r.id, r.label]))
    return attemptText({ kind: 'tap', parts: (Array.isArray(a) ? a : []).map((id) => labels.get(id) ?? id) })
  }
  return attemptText({ kind: 'text', text: typeof a === 'string' ? a : '' })
}

/** Blank is not an answer: an empty box or a half-matched list cannot be checked. */
export function isAnswered(q: CheckpointQuestion, a: Answer): boolean {
  if (q.format === 'mcq') return typeof a === 'number'
  if (q.format === 'match') return Array.isArray(a) && a.length === q.pairs.length && a.every((g) => g.trim() !== '')
  // Every blank and every place filled; at least one part tapped.
  if (q.format === 'fill' || q.format === 'order') return Array.isArray(a) && a.length > 0 && a.every((g) => g.trim() !== '')
  if (q.format === 'tap') return Array.isArray(a) && a.length > 0
  return typeof a === 'string' && a.trim() !== ''
}
