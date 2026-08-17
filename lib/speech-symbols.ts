/**
 * Spoken equivalents for symbols a screen reader reads badly or not at all.
 *
 * From the tester report (A1, highest-priority accessibility fix): a visually
 * impaired tester found symbols announced as "enabled" or skipped entirely,
 * which makes a maths question meaningless. Screen readers vary wildly here —
 * some say "divided by" for ÷, some say nothing, some read the Unicode name.
 *
 * KaTeX already emits MathML for anything wrapped in $…$, and that path is
 * fine. This covers the far more common case: symbols sitting in ordinary
 * question text, options and explanations, where nothing marks them as maths.
 */

/**
 * Order matters: longer sequences first, so ≥ is not matched as > after some
 * earlier rule has already consumed the =.
 */
const SYMBOLS: ReadonlyArray<readonly [string, string]> = [
  ['≠', 'is not equal to'],
  ['≤', 'is less than or equal to'],
  ['≥', 'is greater than or equal to'],
  ['≈', 'is approximately'],
  ['±', 'plus or minus'],
  ['×', 'times'],
  ['÷', 'divided by'],
  ['√', 'the square root of'],
  ['∑', 'the sum of'],
  ['∏', 'the product of'],
  ['∫', 'the integral of'],
  ['∞', 'infinity'],
  ['∈', 'is in'],
  ['∉', 'is not in'],
  ['⊂', 'is a subset of'],
  ['∪', 'union'],
  ['∩', 'intersection'],
  ['→', 'gives'],
  ['⇌', 'in equilibrium with'],
  ['∴', 'therefore'],
  ['∵', 'because'],
  ['°', ' degrees'],
  ['π', 'pi'],
  ['θ', 'theta'],
  ['α', 'alpha'],
  ['β', 'beta'],
  ['Δ', 'delta'],
  ['µ', 'micro'],
  ['Ω', 'ohms'],
  ['½', 'one half'],
  ['¼', 'one quarter'],
  ['¾', 'three quarters'],
  ['²', ' squared'],
  ['³', ' cubed'],
  ['<', 'is less than'],
  ['>', 'is greater than'],
]

/** Fast test so untouched text skips the work entirely. */
const HAS_SYMBOL = new RegExp(`[${SYMBOLS.map(([s]) => s).join('')}]`)

/** Does this text contain anything worth spelling out? */
export function needsSpeechHint(text: unknown): boolean {
  const s = String(text ?? '')
  return s.length > 0 && HAS_SYMBOL.test(s)
}

/**
 * Rewrite symbols as words for assistive technology.
 *
 * The result is never shown; it is supplied alongside the visible text so
 * sighted readers keep the notation and screen-reader users hear a sentence.
 */
export function speakSymbols(text: unknown): string {
  let out = String(text ?? '')
  if (!out) return ''
  for (const [symbol, spoken] of SYMBOLS) {
    if (out.includes(symbol)) {
      out = out.split(symbol).join(` ${spoken} `)
    }
  }
  // Collapse the spacing the substitutions introduce, and keep punctuation
  // tight so the sentence still reads naturally aloud.
  return out.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
}
