type ReviewMcq = {
  options?: unknown
  correct_answer?: unknown
  explanation?: unknown
  [key: string]: unknown
}

/** Make the stored key explicit without changing option order or historical scoring. */
export function alignReviewExplanation<T extends ReviewMcq>(question: T): T {
  if (!Array.isArray(question.options)) return question
  const index = Number(question.correct_answer)
  if (!Number.isInteger(index) || index < 0 || index >= question.options.length) return question
  const answer = String(question.options[index] ?? '').trim()
  if (!answer) return question

  const explanation = String(question.explanation ?? '').trim()
  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`^${escaped}\\s+is\\s+(?:the\\s+)?correct`, 'i').test(explanation)) return question

  return { ...question, explanation: `${answer} is the correct answer.${explanation ? ` ${explanation}` : ''}` }
}
