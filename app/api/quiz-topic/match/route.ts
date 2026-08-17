import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeTopic, isUsableTopic } from '@/lib/quiz-topic'
import { CURRICULUM_REGISTRY } from '@/lib/curriculum-registry'

/**
 * Does a typed topic already exist in the curriculum?
 *
 * "Stories of Use" is a real Cambridge topic. Typed into *Quiz me on anything*
 * it was expanded from the model's general knowledge, which guessed literature
 * and drifted to poems — because the free-topic path never consulted the
 * curriculum tables at all.
 *
 * Matching first means the student gets the syllabus version of a topic that
 * genuinely exists, and the free-form path only handles what genuinely isn't
 * on any syllabus. That makes the feature stronger exactly where it was
 * failing.
 */

export interface TopicMatch {
  kind: 'topic' | 'subtopic'
  id: number
  name: string
  textbookId: number
  textbookName: string
  curriculumLabel: string
  /** Parent topic, for a subtopic match. */
  parentTopicId?: number
  parentTopicName?: string
}

/** Words too common to identify a topic. */
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'unit', 'part', 'introduction'])

function curriculumLabel(numeric: unknown): string {
  const n = Number(numeric)
  const found = Object.values(CURRICULUM_REGISTRY).find((c) => c.numeric === n)
  return found?.label ?? 'Curriculum'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const topic = normalizeTopic(body?.topic)
    if (!isUsableTopic(topic)) {
      return NextResponse.json({ matches: [] })
    }

    // Word overlap, not substring. The reported case proves why: a student
    // typed "stories of use" and there is no such topic — but there is "A
    // world of stories, poems and facts", which is what they were reaching
    // for, and which explains the quiz drifting to poems. A LIKE on the whole
    // phrase finds nothing; matching on shared significant words finds it.
    const words = topic
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))

    if (words.length === 0) return NextResponse.json({ matches: [] })

    const patterns = words.map((w) => `%${w}%`)

    const [topicRows, subtopicRows] = await Promise.all([
      db.query(
        `SELECT t.topic_id, t.topic, t.textbook_id, b.textbook_name, b.curriculum
           FROM topics t
           JOIN textbooks b ON b.textbook_id = t.textbook_id
          WHERE t.topic ILIKE ANY($1::text[])
          LIMIT 200`,
        [patterns],
      ),
      db.query(
        `SELECT s.subtopic_id, s.subtopic, s.topic_id, s.textbook_id,
                t.topic AS parent_topic, b.textbook_name, b.curriculum
           FROM subtopics s
           JOIN topics t ON t.topic_id = s.topic_id
           JOIN textbooks b ON b.textbook_id = s.textbook_id
          WHERE s.subtopic ILIKE ANY($1::text[])
          LIMIT 200`,
        [patterns],
      ),
    ])

    /**
     * Bidirectional word-boundary overlap.
     *
     * Whole words only: substring matching offered "Information" and
     * "Transformation" for "volcanic formation", which is the same false-match
     * class that once paired a chess quiz with a Golgi apparatus.
     *
     * Scored both ways and combined as a harmonic mean, so a tight match
     * ("Photosynthesis" for "photosynthesis") outranks a long title that merely
     * contains the word. One-sided scoring would rank "A world of stories,
     * poems and facts" equal to "Stories".
     */
    const candidateWords = (name: string): Set<string> =>
      new Set(
        name
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
      )

    const score = (name: string): number => {
      const cand = candidateWords(name)
      if (cand.size === 0) return 0
      const hits = words.filter((w) => cand.has(w)).length
      if (hits === 0) return 0
      const typedCoverage = hits / words.length
      const candidateCoverage = hits / cand.size
      return (2 * typedCoverage * candidateCoverage) / (typedCoverage + candidateCoverage)
    }

    const scored = [
      ...topicRows.rows.map((r: any) => ({
        match: {
          kind: 'topic' as const,
          id: Number(r.topic_id),
          name: String(r.topic),
          textbookId: Number(r.textbook_id),
          textbookName: String(r.textbook_name ?? ''),
          curriculumLabel: curriculumLabel(r.curriculum),
        } as TopicMatch,
        score: score(String(r.topic)),
      })),
      ...subtopicRows.rows.map((r: any) => ({
        match: {
          kind: 'subtopic' as const,
          id: Number(r.subtopic_id),
          name: String(r.subtopic),
          textbookId: Number(r.textbook_id),
          textbookName: String(r.textbook_name ?? ''),
          curriculumLabel: curriculumLabel(r.curriculum),
          parentTopicId: Number(r.topic_id),
          parentTopicName: String(r.parent_topic ?? ''),
        } as TopicMatch,
        score: score(String(r.subtopic)),
      })),
    ]

    // Half the typed words must appear. Below that the "match" is a
    // coincidence, and offering it would be worse than offering nothing.
    const seen = new Set<string>()
    const matches = scored
      .filter((s) => s.score >= 0.5)
      .sort((a, b) => b.score - a.score || a.match.name.length - b.match.name.length)
      .filter((s) => {
        const key = s.match.name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 4)
      .map((s) => s.match)

    return NextResponse.json({ matches })
  } catch (err) {
    // A failure here must never block the free-topic path — it is an offer,
    // not a gate.
    console.error('Topic match failed:', err)
    return NextResponse.json({ matches: [] })
  }
}
