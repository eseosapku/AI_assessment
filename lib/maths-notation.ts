/**
 * Maths written the way a printed paper writes it.
 *
 * A live Mathematics paper printed
 *
 *   "Substitute x = 3 into the formula y = 2x^2 - 5x + 4."
 *   "Calculate 3 + 4 * 2 - 6 / 3 using the correct order of operations."
 *
 * with a literal caret and a programmer's asterisk. Cambridge prints 2x² and
 * 4 × 2, and a thirteen-year-old who has never written code does not read
 * `^` as a power at all.
 *
 * The page already renders anything inside $...$ as proper maths, so that is
 * left exactly alone -- this only tidies the plain text around it. Backticks
 * are left alone too, since the same route serves Computing papers where `*`
 * is multiplication in the language being taught.
 *
 * Deliberately narrow:
 *  - a caret followed by a SINGLE digit becomes a superscript. `x^10` and
 *    `2^(n+1)` are left as written: there is no plain-text form of those that
 *    is clearer than the original, and getting one wrong is worse.
 *  - `*` becomes `×` only between two operands. A trailing footnote asterisk
 *    or a bullet is not multiplication.
 *  - `/` is NOT touched. "3/4" is a fraction, and turning it into 3 ÷ 4 would
 *    change what the question asks.
 */

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
}

/** Tidy one run of plain text that is not inside $...$ or backticks. */
function tidy(plain: string): string {
  return plain
    // x^2, 10^3, (a+b)^2 -- a single digit exponent not followed by another.
    .replace(/([A-Za-z0-9)])\^(\d)(?!\d)/g, (_m, base: string, d: string) => base + SUPERSCRIPT[d])
    // 4 * 2, 4*2, x * y, 3 * (x + 1) -- an asterisk with an operand either side.
    // The left operand may already be a superscript from the line above.
    .replace(/([A-Za-z0-9)⁰¹²³⁴⁵⁶⁷⁸⁹])\s*\*\s*(?=[A-Za-z0-9(])/g, '$1 × ')
}

/** The stem with its plain-text maths printed as a paper prints it. */
export function prettyMaths(stem: unknown): string {
  const text = String(stem ?? '')
  if (!text) return text
  // Split on $...$ and `...` so those segments pass through untouched.
  return text
    .split(/(\$[^$]+\$|`[^`]+`)/g)
    .map((part) => (/^(\$[^$]+\$|`[^`]+`)$/.test(part) ? part : tidy(part)))
    .join('')
}
