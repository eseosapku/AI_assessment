import type { TextbookFigure } from '@/lib/textbook-figure-bank'

/**
 * A quiz's figures: the bank's first (spec 5.4: the existing banks stay first for their own
 * books), then the library's that have a question this quiz can use, up to the quiz's share.
 */
export function withLibrary<T extends Pick<TextbookFigure, 'id'>>(bank: readonly T[], library: readonly T[], target: number, usable: (f: T) => boolean): T[] {
  return [...bank, ...library.filter(usable)].slice(0, Math.max(0, target))
}
