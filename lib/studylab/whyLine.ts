// lib/studylab/whyLine.ts

const VERDICT = /^(?:correct|right|yes|exactly|indeed|that'?s (?:right|correct)|that is (?:right|correct)|well done|nice|good job|great)\s*[—–\-:,.!]+\s*/i

/**
 * The explanation shown after a question, whichever way it went. When a question
 * has no explanation of its own, "Why?" falls back to the feedback written for the
 * right option, and that often opens "Correct —": on screen after a wrong answer,
 * that reads as being told you were right.
 */
export function withoutVerdict(text: string): string {
  const rest = text.replace(VERDICT, '')
  return rest === text ? text : rest.charAt(0).toUpperCase() + rest.slice(1)
}
