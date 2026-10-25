/**
 * A sum where the paper is not about sums.
 *
 * Moved out of the generate-assessment route, where it had no test. Untested,
 * it deleted an English paper's 25-mark composition --
 *
 *   "Write an article for your school magazine explaining the difference
 *    between a fact and an opinion. Write about 400 words."
 *
 * -- for carrying a digit and the word "difference". The digit was the length
 * of the essay.
 */
import { isWritingTask } from './passage-question-match'

/** Does the subject or a chosen topic call for calculation? */
export function allowsArithmeticForSelection(subject: string, topics: string[]): boolean {
  const subjectText = (subject || '').toLowerCase()
  const topicText = (topics || []).join(' ').toLowerCase()
  const subjectAllows = /\b(math|mathematics|statistics|physics|chemistry|science|economics|accounting)\b/.test(subjectText)
  const topicAllows = /\b(number|addition|subtraction|multiplication|division|fraction|decimal|percent|percentage|ratio|proportion|equation|algebra|geometry|measure|measurement|length|area|perimeter|volume|angle|graph|chart|data|statistics|probability|time|speed|distance|temperature|money|currency|budget|discount|interest|velocity|acceleration|deceleration|motion|kinematic|displacement|force|momentum|energy|gravity)\b/.test(topicText)
  return subjectAllows || topicAllows
}

/**
 * "Write about 400 words", "in no more than 20 words", "150-200 words": a
 * length, not a quantity in a calculation.
 */
const WORD_LIMIT = /\b\d+(?:\s*(?:-|–|to)\s*\d+)?\s+words?\b/gi

export function isLikelyOffTopicMathQuestion(q: any, subject: string, topics: string[]): boolean {
  // Only skip filtering when the selected subject/topics explicitly allow calculations.
  // The AI prompt already forbids arithmetic on other subjects; this is a narrow backup
  // for obvious primary-style word problems — not cross-subject keyword matching.
  if (allowsArithmeticForSelection(subject, topics)) return false
  const raw = String(q?.question ?? '')
  if (!raw.trim()) return true
  if (isWritingTask(raw)) return false
  const question = raw.toLowerCase().replace(WORD_LIMIT, ' ')

  const hasDigits = /\d/.test(question)
  // Detect arithmetic expressions (e.g., "12 + 7", "9/3"), not unit notation like m/s.
  const hasArithmeticExpression = /\d\s*[+\-*=/]\s*\d/.test(question)
  // "left", "share", "difference" and "times" on their own deleted English
  // and History questions that merely contained a paragraph number. A real
  // word problem still matches "how many are left" below, or an operator.
  const arithmeticWords = /\b(add|added|sum|total|altogether|in\s+all|subtract|minus|plus|remain|remaining|increase|decrease|multiply|product|divide|quotient)\b/.test(question)
  const storyPattern = /\bhas\s+\d+.*\b(give|gives|gave|get|gets|got|buy|buys|bought|take|takes|took|lose|loses|lost|more|less)\b.*\bhow\s+many\b/.test(question)
  const howManyTotal = /\bhow\s+many\b/.test(question) && /\b(total|altogether|left|remain|remaining|now|in\s+all|sum)\b/.test(question)

  return (hasDigits && hasArithmeticExpression) || (hasDigits && (arithmeticWords || storyPattern || howManyTotal))
}
