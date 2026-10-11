// scripts/figure-library/levels.ts
export type Band = 'P' | 'LS' | 'UP' | 'AL'

const RWANDA_SENIOR: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }

/**
 * The level band a book teaches at (spec 5.1). `certain: false` means no
 * level marker was found and upper secondary was assumed; the export lists
 * those books so they can be checked.
 */
export function levelBand(book: string): { band: Band; certain: boolean } {
  const n = String(book ?? '').toLowerCase()
  const sure = (band: Band) => ({ band, certain: true })
  // IGCSE first: "English as a Second Language" contains "as" but is not AS Level.
  if (/igcse|\bo level\b/.test(n)) return sure('UP')
  if (/\bas\b.*\blevel\b|\ba level\b/.test(n)) return sure('AL')
  if (/senior secondary/.test(n)) return sure('UP')
  if (/junior secondary|lower secondary/.test(n)) return sure('LS')
  const senior = n.match(/\bsenior (one|two|three|four|five|six)\b/)?.[1]
  const rwandaS = senior ? RWANDA_SENIOR[senior] : Number(n.match(/\bs\.?\s?([1-6])\b/)?.[1] ?? NaN)
  if (Number.isInteger(rwandaS)) return sure(rwandaS <= 3 ? 'LS' : 'UP')
  if (/\bp\s?[1-6]\b|\bprimary\b|read aloud/.test(n)) return sure('P')
  const stage = Number(n.match(/\b(?:stage|book|learners?|science|mathematics|computing|schools)\s*(\d{1,2})\b/)?.[1] ?? NaN)
  if (Number.isInteger(stage)) return sure(stage <= 6 ? 'P' : stage <= 9 ? 'LS' : 'UP')
  return { band: 'UP', certain: false }
}
