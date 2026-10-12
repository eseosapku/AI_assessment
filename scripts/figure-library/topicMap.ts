// scripts/figure-library/topicMap.ts
import type { Concept } from './concepts'
import type { FigureKind } from './figureKinds'
import type { Band } from './levels'
import type { Store } from './store'
import { costUsd } from './spend'
import { HAIKU } from './claude'

export const MAX_SUBTOPICS = 60

const BAND_LABEL: Record<Band, string> = {
  P: 'Primary',
  LS: 'Lower secondary',
  UP: 'Upper secondary (IGCSE, WAEC, JAMB, Rwanda S4-S6, NERDC SSS)',
  AL: 'AS and A Level',
}

export interface TopicInput {
  subject: string
  band: Band
  book: string
  name: string
  subtopics: readonly string[]
}

export interface TopicMap {
  concepts: string[]
  kinds: string[]
  terms: string[]
  visual: 'high' | 'medium' | 'low'
  subtopics: { concepts: string[]; kinds: string[] }[]
  dropped: number
}

export interface StagedRow {
  key: string
  subject: string
  band: Band
  book: string
  name: string
}

/** Concepts taught at the topic's level, unless that leaves too few to choose from. */
export function conceptsForBand(all: readonly Concept[], band: Band): Concept[] {
  const fit = all.filter((c) => c.bands.includes(band))
  return fit.length >= 20 ? fit : [...all]
}

/** `recheck` is the kinds a topic was mapped to before, when it got too few. */
export function topicPrompt(t: TopicInput, concepts: readonly Concept[], kinds: readonly FigureKind[], recheck?: readonly string[]): string {
  const subs = t.subtopics.slice(0, MAX_SUBTOPICS)
  const local = (id: string) => id.slice(t.subject.length + 1)
  return [
    'Plan the figures for one school topic.',
    `SUBJECT: ${t.subject}`,
    `LEVEL: ${BAND_LABEL[t.band]}`,
    `BOOK: ${t.book}`,
    `TOPIC: ${t.name}`,
    subs.length ? `SUBTOPICS:\n${subs.map((s, i) => `${i}. ${s}`).join('\n')}` : 'SUBTOPICS: none',
    '',
    `CONCEPTS for this subject (id: name):\n${concepts.map((c) => `${local(c.id)}: ${c.name}`).join('\n')}`,
    '',
    `FIGURE KINDS (id: what it is; drawn = drawn from data, real = a real image):\n${kinds.map((k) => `${k.id}: ${k.label} (${k.drawn ? 'drawn' : 'real'})`).join('\n')}`,
    '',
    'Choose:',
    '- concepts: the concept ids this topic teaches (1 to 8).',
    '- kinds: every figure kind a teacher of this subject would actually put in a test on this topic at this level. A kind fits only if a student could answer a real question about the topic from that figure. Do not pad: a labelled-diagram template only for something with parts to label (a cell, an organ, a machine), probability diagrams only for probability, maps only for places. Fewer kinds that truly fit are better than many weak ones.',
    '- terms: up to 8 short search terms for finding REAL images a question can be asked about on Wikimedia Commons: a labelled diagram, a specimen, a micrograph, apparatus, a landform, a map, a historical source, a document. For example "onion cell micrograph" or "oxbow lake aerial". Never buildings, offices, people at work or generic scenes. Empty, with no real kinds, if no real image could carry a question on this topic.',
    '- visual: "high" if this topic is naturally taught with figures, "medium" if partly, "low" if it is mostly words (for example essay writing).',
    '- subtopics: for each subtopic by number, its concept ids and kinds.',
    ...(recheck?.length
      ? [`This topic was mapped before to only: ${recheck.join(', ')}. Read the FIGURE KINDS list again and add every kind that genuinely fits, whether drawn or real. Do not pad: a kind still has to carry a real question on this topic.`]
      : []),
    'Reply with JSON only: {"concepts":[],"kinds":[],"terms":[],"visual":"","subtopics":[{"i":0,"concepts":[],"kinds":[]}]}',
  ].join('\n')
}

export function parseTopicMap(
  raw: unknown,
  subject: string,
  valid: { concepts: ReadonlySet<string>; kinds: ReadonlySet<string> },
  subtopicCount: number,
): TopicMap | null {
  const r = (raw ?? {}) as Record<string, unknown>
  let dropped = 0
  const pick = (xs: unknown, accept: (s: string) => string | null): string[] => {
    const out: string[] = []
    for (const x of Array.isArray(xs) ? xs : []) {
      const v = accept(String(x).trim())
      if (!v) dropped++
      else if (!out.includes(v)) out.push(v)
    }
    return out
  }
  const concept = (s: string) => {
    const id = s.startsWith(`${subject}.`) ? s : `${subject}.${s}`
    return valid.concepts.has(id) ? id : null
  }
  const kind = (s: string) => (valid.kinds.has(s) ? s : null)

  const concepts = pick(r.concepts, concept).slice(0, 8)
  const kinds = pick(r.kinds, kind)
  if (!concepts.length || !kinds.length) return null

  const terms = (Array.isArray(r.terms) ? r.terms : [])
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length >= 2 && t.length <= 60)
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 8)
  const visual = r.visual === 'high' || r.visual === 'low' ? r.visual : 'medium'
  const subtopics = Array.from({ length: subtopicCount }, () => ({ concepts: [] as string[], kinds: [] as string[] }))
  for (const s of Array.isArray(r.subtopics) ? r.subtopics : []) {
    const item = (s ?? {}) as Record<string, unknown>
    const i = Number(item.i)
    if (!Number.isInteger(i) || i < 0 || i >= subtopicCount) continue
    subtopics[i] = { concepts: pick(item.concepts, concept), kinds: pick(item.kinds, kind) }
  }
  return { concepts, kinds, terms, visual, subtopics, dropped }
}

/**
 * One topic's expected cost, from its own prompt: about 3.5 characters a token
 * in, and about 300 tokens out plus 45 for each subtopic sent. A flat guess of
 * 4,500 in and 700 out overstated the trial by about 60%.
 */
export function estimateMapUsd(promptChars: number, subtopics: number): number {
  return costUsd(HAIKU, Math.ceil(promptChars / 3.5), 300 + 45 * Math.min(subtopics, MAX_SUBTOPICS))
}

/** Topics with no plan yet, so a stopped run resumes where it left off. */
export function topicsToMap(db: Store, o: { limit?: number; subject?: string; redo?: boolean; keys?: readonly string[] }): StagedRow[] {
  const keys = o.keys ?? []
  const where = [
    o.redo ? '1 = 1' : 'm.topic_key IS NULL',
    o.subject ? 't.subject = ?' : '1 = 1',
    keys.length ? `t.key IN (${keys.map(() => '?').join(', ')})` : '1 = 1',
  ].join(' AND ')
  const sql = `SELECT t.key, t.subject, t.band, t.book, t.name FROM topics t LEFT JOIN topic_map m ON m.topic_key = t.key WHERE ${where} ORDER BY t.subject, t.key${o.limit ? ` LIMIT ${Math.max(1, Math.floor(o.limit))}` : ''}`
  const params = [...(o.subject ? [o.subject] : []), ...keys]
  return db.prepare(sql).all(...params) as StagedRow[]
}

export function saveTopicMap(db: Store, topicKey: string, subtopicKeys: readonly string[], map: TopicMap, model: string): void {
  db.exec('BEGIN')
  db.prepare(`INSERT OR REPLACE INTO topic_map (topic_key, concepts, kinds, terms, visual, dropped, model, mapped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(topicKey, JSON.stringify(map.concepts), JSON.stringify(map.kinds), JSON.stringify(map.terms), map.visual, map.dropped, model, new Date().toISOString())
  const sub = db.prepare('INSERT OR REPLACE INTO subtopic_map (subtopic_key, concepts, kinds) VALUES (?, ?, ?)')
  map.subtopics.forEach((s, i) => { if (subtopicKeys[i]) sub.run(subtopicKeys[i], JSON.stringify(s.concepts), JSON.stringify(s.kinds)) })
  db.exec('COMMIT')
}
