/**
 * Normalising text into the tokens a keyword match runs on.
 *
 * Shared, deliberately. Two taggers need the same normalising — the subtopic
 * tagger in `app/api/generate-assessment/route.ts`, which maps a question to a
 * curriculum subtopic, and the Cambridge Checkpoint strand tagger in
 * `lib/checkpoint-strands.ts`. A second copy of a text function drifts: one
 * gains a stopword, the other does not, and two questions that should match the
 * same area stop agreeing for a reason nobody can see from either file.
 *
 * Done locally — NO extra AI call, so no extra credits.
 */

export const TAG_STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'with', 'that', 'this', 'from', 'what', 'which', 'when', 'how', 'why',
  'who', 'whom', 'into', 'onto', 'over', 'under', 'between', 'about', 'their', 'there', 'these', 'those',
  'will', 'would', 'should', 'could', 'can', 'may', 'might', 'has', 'have', 'had', 'been', 'being', 'does',
  'did', 'not', 'all', 'any', 'each', 'its', 'his', 'her', 'they', 'them', 'you', 'your', 'one', 'two',
  'following', 'true', 'false', 'best', 'most', 'correct', 'answer', 'option', 'options', 'question',
  'explain', 'describe', 'state', 'define', 'list', 'name', 'give', 'show', 'work', 'out', 'use', 'using',
])

/**
 * The matchable words in a string: lowercase, alphanumeric runs only, nothing
 * three characters or shorter, and no stopword.
 *
 * Never throws — it is fed model output and curriculum names alike.
 */
export function tagTokens(value: string): string[] {
  return (String(value || '').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length > 2 && !TAG_STOPWORDS.has(w)
  )
}
