// lib/studylab/material/lessonPrompt.ts
import type { MaterialSpec } from './types'

/**
 * A lesson's activity, drawn as a material, under the instruction written for
 * the lesson. The converters each carry a sentence of their own ("Place the
 * cards in order along the track"), which is right for no lesson in
 * particular; it stays only where the lesson wrote nothing.
 */
export function withLessonPrompt(material: MaterialSpec, activity: { prompt?: unknown }): MaterialSpec {
  const own = typeof activity.prompt === 'string' ? activity.prompt.trim() : ''
  return own ? { ...material, prompt: own } : material
}
