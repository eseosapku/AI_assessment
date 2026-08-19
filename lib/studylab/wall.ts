/**
 * The knowledge wall: a gap map you do not have to navigate.
 *
 * The original rendered subject → topic → subtopic as a pan-and-zoom graph
 * canvas. Measured on live data, the median student has **twelve** assessed
 * topics and the busiest has ninety — every one of which fits on a single
 * screen. A canvas that has to be panned, zoomed and expanded to reveal twelve
 * things costs far more than it shows, which is why it read as unintuitive.
 *
 * So the tree is flattened into tiles, grouped by subject, sorted so the gaps
 * come first. Nothing is hidden, nothing needs opening, and the metaphor stays
 * literal: your knowledge is a wall, and the gaps are the holes in it.
 */

export type MasteryStatus = 'gap' | 'developing' | 'mastered' | 'not_assessed'

export interface WallTile {
  /** Stable identity for React and for selection. */
  key: string
  label: string
  status: MasteryStatus
  accuracy: number | null
  attempts: number
  lastAssessed: string | null
  /** Ids the study action needs to build a lesson on exactly this. */
  textbook_id: number | null
  topic_id: number | null
  subtopic_id: number | null
  /** The topic a subtopic belongs to, for context in the detail panel. */
  parentTopic: string | null
  /** True when the tile is a topic with no subtopic breakdown beneath it. */
  isTopicLevel: boolean
}

export interface WallSection {
  subject: string
  tiles: WallTile[]
  counts: Record<MasteryStatus, number>
  /** Assessed tiles that are mastered, over assessed tiles. Null when none are. */
  solidRatio: { solid: number; assessed: number } | null
}

/** Gaps first, then shaky, then untested, then solid. */
const STATUS_ORDER: Record<MasteryStatus, number> = {
  gap: 0,
  developing: 1,
  not_assessed: 2,
  mastered: 3,
}

/** Shapes accepted from the gap-map API, kept loose so a schema tweak cannot crash the page. */
interface RawSubtopic {
  id?: unknown
  name?: unknown
  status?: unknown
  accuracy?: unknown
  attempts?: unknown
  last_assessed?: unknown
}
interface RawTopic extends RawSubtopic {
  subtopics?: unknown
  topic_level_only?: unknown
}
interface RawSubject {
  id?: unknown
  name?: unknown
  topics?: unknown
}

function asStatus(value: unknown): MasteryStatus {
  const s = String(value ?? '')
  return s === 'gap' || s === 'developing' || s === 'mastered' ? s : 'not_assessed'
}

function asNumberOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Flattens one subject to its finest available grain.
 *
 * A topic with subtopics contributes its subtopics, not itself: showing both
 * would double-count the same knowledge and make the wall's proportions lie.
 * A topic without subtopics contributes itself, which is the best resolution
 * the data has — and on the NERDC corpus, where no topic has subtopics at all,
 * it is the only resolution there is.
 */
export function tilesForSubject(subject: RawSubject): WallTile[] {
  const subjectName = String(subject?.name ?? '').trim()
  const textbookId = asId(subject?.id)
  const topics = Array.isArray(subject?.topics) ? (subject.topics as RawTopic[]) : []
  const tiles: WallTile[] = []

  for (const topic of topics) {
    const topicId = asId(topic?.id)
    const topicName = String(topic?.name ?? '').trim() || 'Untitled topic'
    const subtopics = Array.isArray(topic?.subtopics) ? (topic.subtopics as RawSubtopic[]) : []

    if (subtopics.length > 0) {
      for (const sub of subtopics) {
        const subId = asId(sub?.id)
        tiles.push({
          key: `s:${subjectName}:${topicId ?? 'x'}:${subId ?? Math.random().toString(36).slice(2)}`,
          label: String(sub?.name ?? '').trim() || 'Untitled',
          status: asStatus(sub?.status),
          accuracy: asNumberOrNull(sub?.accuracy),
          attempts: Number(sub?.attempts) || 0,
          lastAssessed: sub?.last_assessed ? String(sub.last_assessed) : null,
          textbook_id: textbookId,
          topic_id: topicId,
          subtopic_id: subId,
          parentTopic: topicName,
          isTopicLevel: false,
        })
      }
      continue
    }

    tiles.push({
      key: `t:${subjectName}:${topicId ?? Math.random().toString(36).slice(2)}`,
      label: topicName,
      status: asStatus(topic?.status),
      accuracy: asNumberOrNull(topic?.accuracy),
      attempts: Number(topic?.attempts) || 0,
      lastAssessed: topic?.last_assessed ? String(topic.last_assessed) : null,
      textbook_id: textbookId,
      topic_id: topicId,
      subtopic_id: null,
      parentTopic: null,
      isTopicLevel: true,
    })
  }

  return tiles
}

function countByStatus(tiles: readonly WallTile[]): Record<MasteryStatus, number> {
  const counts: Record<MasteryStatus, number> = { gap: 0, developing: 0, mastered: 0, not_assessed: 0 }
  for (const t of tiles) counts[t.status]++
  return counts
}

/**
 * Builds the wall.
 *
 * Sorted so the work comes first: weakest status first, and within a status the
 * lowest accuracy first. A student opening this should be looking at what needs
 * doing without reading past what they have already mastered.
 */
export function buildWall(subjects: readonly unknown[], canonicalise: (s: string) => string = (s) => s): WallSection[] {
  const bySubject = new Map<string, WallTile[]>()

  for (const raw of subjects ?? []) {
    const subject = raw as RawSubject
    const name = canonicalise(String(subject?.name ?? '').trim())
    if (!name) continue
    const tiles = tilesForSubject(subject)
    if (tiles.length === 0) continue
    bySubject.set(name, [...(bySubject.get(name) ?? []), ...tiles])
  }

  const sections: WallSection[] = []
  for (const [subject, tiles] of bySubject) {
    tiles.sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (byStatus !== 0) return byStatus
      const aa = a.accuracy ?? 101
      const bb = b.accuracy ?? 101
      if (aa !== bb) return aa - bb
      return a.label.localeCompare(b.label)
    })

    const counts = countByStatus(tiles)
    const assessed = counts.gap + counts.developing + counts.mastered
    sections.push({
      subject,
      tiles,
      counts,
      solidRatio: assessed > 0 ? { solid: counts.mastered, assessed } : null,
    })
  }

  // Subjects with the most gaps first — the wall should open on the work.
  sections.sort((a, b) => {
    if (b.counts.gap !== a.counts.gap) return b.counts.gap - a.counts.gap
    if (b.counts.developing !== a.counts.developing) return b.counts.developing - a.counts.developing
    return a.subject.localeCompare(b.subject)
  })
  return sections
}

/** Totals across the whole wall, for the summary strip. */
export function wallSummary(sections: readonly WallSection[]): Record<MasteryStatus, number> {
  const total: Record<MasteryStatus, number> = { gap: 0, developing: 0, mastered: 0, not_assessed: 0 }
  for (const s of sections) {
    for (const k of Object.keys(total) as MasteryStatus[]) total[k] += s.counts[k]
  }
  return total
}

/**
 * The few worth fixing first, across every subject.
 *
 * Only genuine gaps — offering a "fix this" card for something already
 * developing would push a student off the thing that is actually failing.
 */
export function priorityTiles(sections: readonly WallSection[], limit = 3): WallTile[] {
  return sections
    .flatMap((s) => s.tiles.map((t) => ({ ...t, subject: s.subject })))
    .filter((t) => t.status === 'gap')
    .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101))
    .slice(0, limit)
}
