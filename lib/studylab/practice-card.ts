import { scenesFor } from '@/lib/studylab/engines'
import { examplesOf, type SceneExample } from '@/lib/studylab/engines/examples'

const wordsOf = (s: string) => s.toLowerCase().match(/[a-z]{5,}/g) ?? []

/** Two words share when each has 5+ letters and the first five letters agree (expanding / expand). */
const shares = (a: string, b: string) => wordsOf(a).some((x) => wordsOf(b).some((y) => x.slice(0, 5) === y.slice(0, 5)))

/**
 * A real practice card for a chapter: for each name in turn (the section, then
 * the others, then the chapter), the first example of a matching scene whose own
 * prompt shares a word with that name. Nothing fitting means null, never a guess.
 */
export function pickPracticeCard(names: readonly string[]): { engineId: string; example: SceneExample } | null {
  for (const name of names) {
    for (const engine of scenesFor(name)) {
      const example = examplesOf(engine).find((e) => shares(name, e.prompt))
      if (example) return { engineId: engine.id, example }
    }
  }
  return null
}
