/**
 * Finding screens the design tokens never reached.
 *
 * The report card sat at 54 hardcoded Tailwind palette classes long after the
 * light palette was retuned to AA, because the retune changed the `ss-*`
 * variables and that file used none of them. `text-gray-400` on white is
 * 2.8:1; `text-amber-600` at 12px is 3.3:1. Both fail 1.4.3, and no sweep
 * caught them because every sweep was scoped to a plan the report card was
 * never in.
 *
 * A count per file is a blunt instrument, and deliberately so: it makes no
 * claim that each match is a bug. It says only that a file has not been
 * converted, and that it must not get worse.
 */

/** Tailwind's numbered colour scales — the ones that bypass the tokens. */
export const PALETTE_CLASS =
  /\b(?:text|bg|border|ring|from|via|to|divide|outline|decoration|placeholder|caret|shadow|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|\d{3})\b/g

export function countPaletteEscapes(source: string): number {
  return (source.match(PALETTE_CLASS) ?? []).length
}

export interface RatchetResult {
  /** Files that grew past their recorded count, or appeared with escapes. */
  regressions: Array<{ file: string; baseline: number; actual: number }>
  /** Files that improved — the baseline should be lowered to lock the win in. */
  improvements: Array<{ file: string; baseline: number; actual: number }>
}

/**
 * A one-way ratchet. New files must be clean; converted files must not
 * backslide. Anything already dirty is allowed to stay dirty, so the guard can
 * be adopted today rather than after a 49-file rewrite.
 */
export function checkRatchet(
  actual: Record<string, number>,
  baseline: Record<string, number>,
): RatchetResult {
  const regressions: RatchetResult['regressions'] = []
  const improvements: RatchetResult['improvements'] = []

  for (const [file, count] of Object.entries(actual)) {
    const allowed = baseline[file] ?? 0
    if (count > allowed) regressions.push({ file, baseline: allowed, actual: count })
    else if (count < allowed) improvements.push({ file, baseline: allowed, actual: count })
  }
  // A baselined file that no longer appears has been fully converted.
  for (const [file, allowed] of Object.entries(baseline)) {
    if (!(file in actual) && allowed > 0) {
      improvements.push({ file, baseline: allowed, actual: 0 })
    }
  }
  return { regressions, improvements }
}
