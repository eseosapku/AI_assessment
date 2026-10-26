/**
 * Is this question a calculation?
 *
 * Shared by the guard that refuses a calculation with no numbers in it
 * (`lib/answerable.ts`) and the renderer that decides what answer box to draw
 * (`app/assessment/page.tsx`), because two copies of this rule would drift and
 * then the paper and the screen would disagree about what a question is.
 *
 * The reason the renderer needs it: a multi-mark Maths question is a `written`
 * slot, which is right for MARKING -- part marks are for working, and working
 * is marked against criteria, not matched against a word list. But `written`
 * was also drawing the prose answer box, so a live paper showed
 *
 *   Calculate 3 + 4 x 2 - 6 / 3 using the correct order of operations.
 *   Write a detailed answer. Each mark has a specific criterion.
 *   [                                    ]
 *   0 words                        Aim for ~25-40 words
 *
 * The answer is 5. Nine of twenty-nine questions on that paper were shaped
 * that way. A calculation is answered in a working box with a final answer,
 * the way Cambridge prints it, and is not measured in words.
 */

/** Verbs that promise arithmetic. Bare "find" is not one -- see below. */
const COMPUTES = /^\s*(?:calculate|work out|compute)\b/i

/**
 * A linear-algebra demand. "Find" stays out of COMPUTES because
 * "Find the information stated in the text" is a reading question.
 * "Find the determinant of A = [[4, 2], [1, 3]]" is a calculation.
 */
const MATH_WORK = /^\s*(?:solve|simplify|evaluate|find)\b/i
const MATH_OBJECT = /\b(?:determinant|eigenvalues?|matrix|matrices|inverse|vector|equation|expression|polynomial|integral|derivative|singular value)\b/i
/** "Given A = [[4, 2], [1, 3]], find the eigenvalues" does not open with Calculate. */
const GIVEN_MATRIX = /\[\s*-?\d|\\+begin\{(?:pmatrix|bmatrix|matrix|vmatrix)/i
const MATRIX_JOB = /\b(?:find|calculate|compute|solve|perform|determine|obtain|work out|decompos\w*|eigendecompos\w*|eigenvalues?|eigenvectors?|determinant|inverse|singular values?|cholesky|diagonaliz\w*)\b/i

/**
 * A thing that has a numeric value.
 *
 * Required alongside the verb. "Find the information directly stated in the
 * text about the main character" is an English comprehension demand, and
 * treating it as a calculation deleted a good question off a live Reading
 * paper -- which is also why "find" is not a computing verb here.
 */
const QUANTITY =
  /\b(?:value|amount|number|total|sum|difference|product|quotient|area|perimeter|volume|capacity|mass|weight|length|width|height|depth|distance|speed|velocity|acceleration|time|duration|temperature|angle|probability|percentage|fraction|ratio|proportion|mean|median|mode|range|average|frequency|cost|price|density|force|pressure|energy|power|current|voltage|resistance|term)\b/i

/**
 * True when the demand is arithmetic rather than prose.
 *
 * A stem that also asks for explanation is NOT one of these: "Calculate the
 * mean and explain why it is misleading" earns its prose box.
 */
export function isCalculationDemand(stem: unknown): boolean {
  const text = String(stem ?? '').trim()
  if (!text) return false
  const solvesAMatrix = MATH_WORK.test(text) && MATH_OBJECT.test(text) && /\d/.test(text)
  const matrixJob = GIVEN_MATRIX.test(text) && MATRIX_JOB.test(text)
  if (/\b(?:interpretation|significance)\b/i.test(text)) return false
  if (!COMPUTES.test(text) && !solvesAMatrix && !matrixJob) return false
  if (/\b(?:explain|describe|justify|compare|discuss|why|suggest why|comment on)\b/i.test(text) && !matrixJob) {
    return false
  }
  // A bare "Calculate your answer carefully" is not a calculation demand.
  return QUANTITY.test(text) || /[\d+\-×x*/=]/.test(text) || solvesAMatrix || matrixJob
}

/** True when the stem names a quantity, whether or not it computes one. */
export function namesAQuantity(stem: unknown): boolean {
  return QUANTITY.test(String(stem ?? ''))
}

/** True when the stem opens with a computing verb. */
export function opensWithComputation(stem: unknown): boolean {
  return COMPUTES.test(String(stem ?? ''))
}
