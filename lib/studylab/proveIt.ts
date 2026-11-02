// lib/studylab/proveIt.ts
import type { LessonRun } from './lessonRun'

/** What the Prove-it quiz is about: the lesson's stations, by name, so it covers all of them. */
export function proveItTopics(run: Pick<LessonRun, 'steps'> | null, fallback: string | null | undefined): string[] {
  const stations = (run?.steps ?? []).map((s) => s.title?.trim()).filter((t): t is string => !!t)
  if (stations.length > 0) return [...new Set(stations)]
  return fallback ? [fallback] : []
}
