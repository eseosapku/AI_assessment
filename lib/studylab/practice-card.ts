import cards from './practice-cards.json'
import { getEngine } from '@/lib/studylab/engines'
import { examplesOf, type SceneExample } from '@/lib/studylab/engines/examples'
import { familyFor } from '@/lib/studylab/subjectFamily'

/**
 * A real practice card for a chapter, from a list judged once by a model
 * (scripts/build-practice-cards.ts): "<family>:<lowercased name>" -> [engine id, example index].
 * For each name in turn (the section, then the others, then the chapter) the first listed card
 * that still exists wins. No entry means null, never a guess.
 */
export function pickPracticeCard(
  names: readonly string[],
  subject: string,
  list: Record<string, [string, number]> = cards as unknown as Record<string, [string, number]>,
): { engineId: string; example: SceneExample } | null {
  const family = familyFor(subject).name
  for (const name of names) {
    const hit = list[`${family}:${name.toLowerCase().trim()}`]
    if (!hit) continue
    const engine = getEngine(hit[0])
    const example = engine ? examplesOf(engine)[hit[1]] : undefined
    if (engine && example) return { engineId: engine.id, example }
  }
  return null
}
