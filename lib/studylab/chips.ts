// lib/studylab/chips.ts

/**
 * The two chips after an explanation: the learner says whether it landed.
 * "Makes sense" moves on; "Not really" gets a question about what is unclear
 * before anything is explained again.
 */
export const COMPREHENSION_CHIPS = ['Makes sense', 'Not really'] as const

/**
 * What a clicked chip does. The two comprehension chips move on or ask what is
 * unclear; any other chip -- a diagnosis chip naming a sticking point, or one
 * the tutor offered -- is asked as a question, and the tutor explains that one
 * point.
 */
export function chipAction(label: string): 'advance' | 'diagnose' | 'ask' {
  const said = label.trim().toLowerCase()
  if (said === COMPREHENSION_CHIPS[0].toLowerCase()) return 'advance'
  if (said === COMPREHENSION_CHIPS[1].toLowerCase()) return 'diagnose'
  return 'ask'
}
