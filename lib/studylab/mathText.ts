// lib/studylab/mathText.ts

/**
 * Puts every maths delimiter the model uses into the one the renderer reads.
 *
 * The cards and the chat render `$…$` and `$$…$$`. The model also writes the
 * other standard pair, and a check on completing the square asked the learner
 * to "Factor and simplify the perfect square trinomial: \(x^2 + 10x + 25\)" —
 * with the backslashes and brackets on screen, in a maths lesson.
 *
 * Display maths is converted first, so the two-character `\[` is not mistaken
 * for anything else. A lone `\(` with no partner is left exactly as it is:
 * unbalanced delimiters are text, and turning one into a stray `$` would put
 * the rest of the card into maths mode.
 */
export function toDollarMath(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => `$$${inner}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) => `$${inner}$`)
}
