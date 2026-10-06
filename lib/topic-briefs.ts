/**
 * What a textbook chapter teaches at its stage, and what its learners have
 * not met yet (scripts/build-topic-briefs.ts).
 *
 * Without it a quiz prompt has the chapter's name and an age band, and the
 * writer fills the gap from its general idea of the topic: the area of a
 * circle in a Stage 3 Measurement quiz, at age eight, where the book counts
 * squares.
 *
 * Server-only: reads data/topic-briefs.json.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface TopicBrief {
  book: string
  topic: string
  level: string
  stage: number | null
  teaches: string
  notYet: string
  example: string
}

export const briefKey = (textbookId: unknown, topic: unknown) => `${Number(textbookId)}|${String(topic ?? '').trim()}`

let cache: Record<string, TopicBrief> | null = null

function load(): Record<string, TopicBrief> {
  if (cache) return cache
  try {
    cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'topic-briefs.json'), 'utf8'))
  } catch {
    cache = {}
  }
  return cache!
}

/** Test seam. */
export function resetTopicBriefs(briefs?: Record<string, TopicBrief>): void {
  cache = briefs ?? null
}

/** The briefs for the chapters a quiz is on, in the order asked, skipping any not written. */
export function briefsFor(textbookId: unknown, topics: readonly string[], briefs = load()): TopicBrief[] {
  if (!Number.isFinite(Number(textbookId))) return []
  return topics.map((t) => briefs[briefKey(textbookId, t)]).filter((b): b is TopicBrief => Boolean(b))
}

/**
 * The prompt block. It outranks the generic level guidance, which was
 * written for any curriculum and asks a Stage 4 statistics quiz for the mean.
 */
export function buildBriefBlock(briefs: readonly TopicBrief[]): string {
  if (!briefs.length) return ''
  const one = (b: TopicBrief) => [
    `Chapter "${b.topic}" — ${b.level}:`,
    `- It teaches: ${b.teaches}`,
    ...(b.notYet ? [`- NOT taught yet at this stage, so never ask it: ${b.notYet}`] : []),
    ...(b.example ? [`- A question at the right level: ${b.example}`] : []),
  ].join('\n')
  return [
    '**WHAT THE LEARNER\'S BOOK TEACHES (overrides any other level guidance in this prompt):**',
    'Write only about what these chapters teach, at this level. A question that needs anything from a later stage is wrong, however well written.',
    ...briefs.map(one),
  ].join('\n')
}
