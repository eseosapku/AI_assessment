import cards from './practice-cards.json'
import { familyFor } from '@/lib/studylab/subjectFamily'

/**
 * A practice card for a chapter, from a list judged once by a model
 * (scripts/build-practice-cards.ts): "<family>:<lowercased name>" -> [engine id, example index].
 * The family is read from the chapter's real book name, the same way the script builds the keys.
 * For each name in turn (the section, then the others, then the chapter) the first listed entry wins.
 * No entry means null, never a guess. This file imports no engines, so the rack stays light; the
 * live card checks the engine and example exist when it plays them.
 */
export function pickPracticeEntry(
  names: readonly string[],
  bookName: string,
  list: Record<string, [string, number]> = cards as unknown as Record<string, [string, number]>,
): { engineId: string; exampleIndex: number } | null {
  const family = familyFor(bookName).name
  for (const name of names) {
    const hit = list[`${family}:${name.toLowerCase().trim()}`]
    if (hit) return { engineId: hit[0], exampleIndex: hit[1] }
  }
  return null
}
