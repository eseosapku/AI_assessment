/**
 * Money and maths share the dollar sign.
 *
 * A live Mathematics paper printed
 *
 *   "Calculate the total amount of change from a $50 bill after buying three
 *    items costing $12.45, $8.99, and $15.75."
 *
 * and the renderer read "$50 bill after buying three items costing $" as a
 * maths expression, so the learner saw "50billafterbuyingthreeitemscosting"
 * in maths italics with the spaces gone. Every question with money in it
 * broke the same way.
 *
 * So when a stem contains money, the genuine maths spans in it are moved to
 * `\( ... \)` delimiters and every other dollar sign is left as the literal
 * character it is. The caller then renders with `\( \)` and `$$` only.
 *
 * What makes a span maths rather than money: an operator or a LaTeX command
 * inside it. "$2^3 \times 2^4$" and "$2 + 3$" are maths; "$50 bill after
 * buying three items costing $" and "$8.99, and $" are prices with words
 * between them.
 */

/** A dollar sign followed by an amount: $50, $12.45, $1,200. */
const MONEY = /\$\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?![\d^_])/

/** What a maths span has and a run of prose between two prices does not. */
const MATHS_INSIDE = /[=^_\\+×*÷/<>]|\\[a-zA-Z]/

/** True when this text has money in it and so needs `protectCurrency`. */
export function hasCurrency(text: unknown): boolean {
  return MONEY.test(String(text ?? ''))
}

/**
 * The text with maths spans as `\( ... \)` and currency left literal.
 *
 * Returns the text unchanged when it holds no money, so a stem without a
 * price is rendered exactly as it always was.
 */
export function protectCurrency(text: unknown): string {
  const s = String(text ?? '')
  if (!hasCurrency(s)) return s

  let out = ''
  let i = 0
  while (i < s.length) {
    const open = s.indexOf('$', i)
    if (open < 0) {
      out += s.slice(i)
      break
    }
    // "$$" is display maths and already has its own delimiter.
    if (s[open + 1] === '$') {
      const close = s.indexOf('$$', open + 2)
      const end = close < 0 ? s.length : close + 2
      out += s.slice(i, end)
      i = end
      continue
    }
    const close = s.indexOf('$', open + 1)
    if (close < 0) {
      out += s.slice(i)
      break
    }
    const inner = s.slice(open + 1, close)
    if (MATHS_INSIDE.test(inner)) {
      out += s.slice(i, open) + `\\(${inner}\\)`
      i = close + 1
    } else {
      // A price. Keep this dollar as text and look again from just after it:
      // the next one may be another price or may open real maths.
      out += s.slice(i, open + 1)
      i = open + 1
    }
  }
  return out
}
