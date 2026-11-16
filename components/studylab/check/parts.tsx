'use client'
import type { KeyboardEvent } from 'react'
import { ResultBadge } from './ResultBadge'

/** What a new-format answer's parts know about the check they are in. */
export interface PartsState {
  locked: boolean
  /** Marked, right or wrong: each part shows how it went. */
  marked: boolean
  /** The right answer is on show (revealed, or a miss in a test). */
  showAnswer: boolean
  mode: 'learn' | 'test'
}

/** The tone of a marked part, as an mcq option takes it. */
export function partTone(right: boolean, mode: 'learn' | 'test'): string {
  return right ? 'var(--ss-good)' : mode === 'learn' ? 'var(--ss-warn)' : 'var(--ss-bad)'
}

export function PartBadge({ right, mode }: { right: boolean; mode: 'learn' | 'test' }) {
  return <ResultBadge kind={right ? 'correct' : 'wrong'} tone={mode === 'learn' ? 'warn' : 'bad'} />
}

/**
 * Arrow keys move between the parts of an answer in reading order, the way
 * they move between mcq options; the board, which moves a selected card with
 * them, never sees them. Backspace or Delete empties a filled place.
 */
export function onPartsKey(e: KeyboardEvent<HTMLElement>, clear?: (part: string) => void) {
  const here = (e.target as HTMLElement).closest<HTMLElement>('[data-part]')
  if (!here) return
  if ((e.key === 'Backspace' || e.key === 'Delete') && clear) {
    e.preventDefault()
    e.stopPropagation()
    clear(here.dataset.part ?? '')
    return
  }
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  e.preventDefault()
  e.stopPropagation()
  const all = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-part]:not([disabled])')]
  const next = all[(all.indexOf(here) + step + all.length) % all.length]
  next?.focus()
}
