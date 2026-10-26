/**
 * A PDF or notes page the student has to solve, not only summarise.
 *
 * "Quiz me on anything" names the paper after the topic ("Eigen decomposition"),
 * which is not the word "Mathematics". The generator then asked only what the
 * idea means, and a question that actually computed a value was removed as
 * off-topic arithmetic. If the source itself is a problem, the paper has to
 * contain problems.
 */

const SOLVE = /\b(calculat\w*|comput\w*|solv\w*|simplif\w*|evaluat\w*|determinant|eigen\w*|integrat\w*|derivativ\w*|differentiate|factoris\w*|factoriz\w*|inverse|polynomial|quadratic|simultaneous|equation|matrix|matrices|vector|svd|singular value|lu decomposition|linear algebra|linear system|gaussian elimination|row echelon)\b/i
const NOTATION = /[=≤≥≠±√∑∫^]|\\frac|\\int|\\sum|\\matrix|\\begin\{/
const MATRIX = /\[\s*-?\d+(?:\.\d+)?(?:\s*[, ]\s*-?\d+(?:\.\d+)?)+\s*\]/
const SUM = /\d+(?:\.\d+)?\s*[+\-*/^=]\s*-?\d+/

export function sourceNeedsWorkedProblems(text: unknown): boolean {
  const source = String(text ?? '')
  if (source.trim().length < 40) return false
  let score = 0
  if (SOLVE.test(source)) score += 2
  if (NOTATION.test(source)) score += 1
  if (MATRIX.test(source)) score += 2
  if (SUM.test(source)) score += 2
  return score >= 2
}

/** How many questions in a paper of `count` must make the student work a result. */
export function workedProblemTarget(count: number): number {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (n <= 0) return 0
  if (n === 1) return 1
  return Math.max(2, Math.round(n * 0.5))
}

export function workedProblemRules(count: number): string {
  const target = workedProblemTarget(count)
  if (target <= 0) return ''
  return `WORKED PROBLEMS — this source is something to solve and also to understand:
- ${target} of the ${count} questions make the student calculate, simplify, solve, or find a value. Put the matrix in the question. "Given A = [[4, 2], [1, 3]], find the eigenvalues" and "Perform LU decomposition on A = [[2, 1], [6, 5]]" are the right shape.
- The other questions are theory on the same material: a definition, a property, or when the method is the right one to use. A paper of only calculations is wrong, and a paper of only definitions is wrong.
- Write every number, matrix, vector, or expression a calculation needs INTO the question. They cannot see the PDF.
- Copy a matrix or equation the source already gives. If the source only describes the method, write a small example of that same method and put the numbers in the question.
- A calculation's answer is a number, a matrix, a vector, or a simplified expression. A theory question has one definite answer.
- Do NOT use the options "All of the above" or "None of the above".
- A short-answer problem sets short_answer.numeric to true when the answer is a number, and lists every accepted form.`
}

const ESSAY_OPENING = /^(?:describe|explain|discuss|compare|outline|what is the significance|what is the geometric interpretation|which of the following statements|which of the following is a property|which of the following is correct\b|which of the following is a correct statement|which decomposition method)\b/i
const OPENS_WITH_WORK = /^\s*(?:calculate|work out|compute|solve|simplify|evaluate|find|perform)\b/i
/** A matrix the student can actually compute with, in brackets or in LaTeX. */
const MATRIX_DATA = /\[\s*-?\d|\\+begin\{(?:pmatrix|bmatrix|matrix|vmatrix)/i
const MATRIX_TASK = /\b(?:calculat\w*|comput\w*|find|solve|simplif\w*|evaluat\w*|perform|determine|obtain|work out|decompos\w*|eigendecompos\w*|eigenvalues?|eigenvectors?|determinant|singular values?|\bsvd\b|\blu\b|\bqr\b|cholesky|inverse|diagonaliz\w*|factori[sz]\w*|product)\b/i

/**
 * A question the student can only answer by working a result.
 *
 * "Describe how SVD is used" and "which statement is correct" are not that,
 * even on a mathematics PDF. A real one names the job and includes the
 * matrix. "Given A = [[4, 2], [1, 3]], find the eigenvalues" does not open
 * with Calculate, and "Perform LU decomposition on A = ..." is still a
 * problem. Both were deleted, and the paper came back short.
 */
export function isWorkedProblemQuestion(question: {
  question?: unknown
  options?: unknown
  short_answer?: { numeric?: unknown } | null
} | null | undefined): boolean {
  if (!question || isLazyChoiceQuestion(question)) return false
  const stem = String(question.question ?? '').trim()
  if (!stem || ESSAY_OPENING.test(stem)) return false
  const options = Array.isArray(question.options) ? question.options.map((option) => String(option ?? '')) : []
  const blob = `${stem}\n${options.join('\n')}`
  const hasMatrix = MATRIX_DATA.test(blob)
  const hasDigits = /\d/.test(stem)
  if (!hasMatrix && !hasDigits) return false
  if (hasMatrix && MATRIX_TASK.test(stem)) return true
  if (OPENS_WITH_WORK.test(stem) && hasDigits) return true
  if (question.short_answer?.numeric === true && hasDigits) return true
  const results = options.filter((option) => /^-?\d/.test(option.trim()) || MATRIX_DATA.test(option)).length
  return results >= 3 && MATRIX_TASK.test(stem)
}

/** "All of the above" is a guess, not a worked answer. */
export function isLazyChoiceQuestion(question: { options?: unknown } | null | undefined): boolean {
  if (!Array.isArray(question?.options)) return false
  return question.options.some((option) =>
    /\b(?:all|none) of (?:the|these) (?:above|options|answers)\b/i.test(String(option ?? '')),
  )
}
