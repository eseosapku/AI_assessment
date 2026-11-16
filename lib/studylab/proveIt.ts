// lib/studylab/proveIt.ts
import type { LessonRun } from './lessonRun'

/**
 * What the checker is told about a Prove-it quiz. A figure question matched on loose
 * wording put an extrapolation graph on a quiz about completing the square.
 */
export function lessonQuizScope(topics: string[]): string {
  return `This quiz follows a lesson that covered: ${topics.join('; ')}. A question on anything else does not belong on it: drop it.`
}

/** What the Prove-it quiz is about: the lesson's stations, by name, so it covers all of them. */
export function proveItTopics(run: Pick<LessonRun, 'steps'> | null, fallback: string | null | undefined): string[] {
  const stations = (run?.steps ?? []).map((s) => s.title?.trim()).filter((t): t is string => !!t)
  if (stations.length > 0) return [...new Set(stations)]
  return fallback ? [fallback] : []
}
