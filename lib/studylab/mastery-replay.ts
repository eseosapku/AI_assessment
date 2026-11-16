import { nextLatest, type LatestColumns } from './mastery-latest'
import { scoreQuestions } from './mastery-write'

function parse(value: unknown): unknown {
  if (typeof value !== 'string') return value
  return JSON.parse(value)
}

/**
 * Replays saved results (oldest first) into latest-attempt columns, keyed
 * `${topicId}:${subtopicId}` with the same zeros save-result writes
 * (section `0:sid`, chapter `tid:0`). A result that cannot be parsed is skipped.
 */
export function replayResults(
  results: { questions_data: unknown; answers: unknown; longform_grades: unknown }[],
): Map<string, LatestColumns> {
  const out = new Map<string, LatestColumns>()
  for (const r of results) {
    let scored
    try {
      scored = scoreQuestions(parse(r.questions_data), parse(r.answers), parse(r.longform_grades))
    } catch {
      continue
    }
    if (!scored.scoredAny) continue
    const apply = (key: string, b: { correct: number; total: number }) => {
      out.set(key, nextLatest(out.get(key), null, b.correct, b.total))
    }
    for (const [sid, b] of scored.sections) apply(`0:${sid}`, b)
    for (const [tid, b] of scored.chapters) apply(`${tid}:0`, b)
  }
  return out
}
