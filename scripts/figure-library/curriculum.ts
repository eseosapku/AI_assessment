// scripts/figure-library/curriculum.ts
import { subjectKey } from './subjects'
import { levelBand, type Band } from './levels'
import type { Store } from './store'

export type Source = 'rwanda' | 'cambridge' | 'nerdc' | 'waec' | 'jamb' | 'checkpoint'

export interface StagedTopic {
  key: string
  source: Source
  textbookId: number | null
  book: string
  subject: string
  band: Band
  name: string
}

export interface StagedSubtopic {
  key: string
  topicKey: string
  name: string
}

export interface DbBook { textbook_id: number; textbook_name: string; curriculum: number }
export interface DbTopic { topic_id: number; textbook_id: number; topic: string }
export interface DbSubtopic { subtopic_id: number; topic_id: number; subtopic: string }
export interface SyllabusSubject { name: string; topics: readonly string[] }
export interface CheckpointSyllabus { programme: 'primary' | 'lower-secondary'; name: string; code: string; strands: readonly string[] }

// Curricula 3 and 4 are WAEC and JAMB past-paper banks filed by year; their
// real topics come from the syllabus modules instead.
const SOURCE_OF: Record<number, Source> = { 0: 'rwanda', 1: 'cambridge', 2: 'nerdc' }

/** A name as a prompt shows it. The stored name keeps every character, since lookups need the exact string. */
export function displayName(name: string): string {
  return String(name ?? '')
    .replace(/\\b$/, '')
    .replace(/[\x00-\x1f]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Writes a fresh export over an earlier one. A topic plan stays only while its
 * topic is unchanged: a new name, subject, level or subtopic list clears it
 * (plans map subtopics by position, and WAEC/JAMB keys are positions in the
 * syllabus). Topics production no longer has are removed from staging.
 */
export function stageCurriculum(db: Store, rows: { topics: readonly StagedTopic[]; subtopics: readonly StagedSubtopic[] }): { added: number; changed: number; removed: number } {
  const before = new Map((db.prepare('SELECT key, subject, band, name FROM topics').all() as { key: string; subject: string; band: string; name: string }[]).map((r) => [r.key, r]))
  const signature = (list: readonly { topicKey: string; key: string; name: string }[]) => {
    const out = new Map<string, string>()
    for (const s of [...list].sort((a, b) => a.key.localeCompare(b.key))) out.set(s.topicKey, `${out.get(s.topicKey) ?? ''}${s.key}=${s.name}\n`)
    return out
  }
  const subsBefore = signature((db.prepare('SELECT topic_key AS topicKey, key, name FROM subtopics').all() as { topicKey: string; key: string; name: string }[]))
  const subsAfter = signature(rows.subtopics)
  const keepTopics = new Set(rows.topics.map((t) => t.key))
  const keepSubs = new Set(rows.subtopics.map((s) => s.key))

  const clearPlan = (topicKey: string) => {
    db.prepare('DELETE FROM subtopic_map WHERE subtopic_key IN (SELECT key FROM subtopics WHERE topic_key = ?)').run(topicKey)
    db.prepare('DELETE FROM topic_map WHERE topic_key = ?').run(topicKey)
  }
  const upTopic = db.prepare(`INSERT INTO topics (key, source, textbook_id, book, subject, band, name) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET source = excluded.source, textbook_id = excluded.textbook_id, book = excluded.book,
      subject = excluded.subject, band = excluded.band, name = excluded.name`)
  const upSub = db.prepare(`INSERT INTO subtopics (key, topic_key, name) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET topic_key = excluded.topic_key, name = excluded.name`)

  let added = 0, changed = 0, removed = 0
  db.exec('BEGIN')
  try {
    for (const key of before.keys()) {
      if (keepTopics.has(key)) continue
      clearPlan(key)
      db.prepare('DELETE FROM subtopics WHERE topic_key = ?').run(key)
      db.prepare('DELETE FROM topics WHERE key = ?').run(key)
      removed++
    }
    for (const t of rows.topics) {
      const old = before.get(t.key)
      if (!old) added++
      else if (old.name !== t.name || old.subject !== t.subject || old.band !== t.band || (subsBefore.get(t.key) ?? '') !== (subsAfter.get(t.key) ?? '')) {
        clearPlan(t.key)
        changed++
      }
      upTopic.run(t.key, t.source, t.textbookId, t.book, t.subject, t.band, t.name)
    }
    for (const r of db.prepare('SELECT key FROM subtopics').all() as { key: string }[]) {
      if (keepSubs.has(r.key)) continue
      db.prepare('DELETE FROM subtopic_map WHERE subtopic_key = ?').run(r.key)
      db.prepare('DELETE FROM subtopics WHERE key = ?').run(r.key)
    }
    for (const s of rows.subtopics) upSub.run(s.key, s.topicKey, s.name)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return { added, changed, removed }
}

export function curriculumRows(input: {
  books: readonly DbBook[]
  topics: readonly DbTopic[]
  subtopics: readonly DbSubtopic[]
  waec: readonly SyllabusSubject[]
  jamb: readonly SyllabusSubject[]
  checkpoint: readonly CheckpointSyllabus[]
}): { topics: StagedTopic[]; subtopics: StagedSubtopic[]; unmapped: string[]; uncertain: string[] } {
  const bookById = new Map(input.books.map((b) => [Number(b.textbook_id), b]))
  const topics: StagedTopic[] = []
  const unmapped = new Set<string>()
  const uncertain = new Set<string>()

  for (const t of input.topics) {
    const book = bookById.get(Number(t.textbook_id))
    const source = book ? SOURCE_OF[Number(book.curriculum)] : undefined
    if (!book || !source || !displayName(t.topic)) continue
    const subject = subjectKey(book.textbook_name)
    if (subject === 'other') unmapped.add(book.textbook_name)
    const level = levelBand(book.textbook_name)
    if (!level.certain) uncertain.add(book.textbook_name)
    topics.push({ key: `db:${t.topic_id}`, source, textbookId: Number(book.textbook_id), book: book.textbook_name, subject, band: level.band, name: String(t.topic) })
  }

  const staged = new Set(topics.map((t) => t.key))
  const subtopics = input.subtopics
    .filter((s) => staged.has(`db:${s.topic_id}`) && displayName(s.subtopic))
    .map((s) => ({ key: `db:${s.subtopic_id}`, topicKey: `db:${s.topic_id}`, name: String(s.subtopic) }))

  for (const [source, list] of [['waec', input.waec], ['jamb', input.jamb]] as const) {
    for (const s of list) {
      const subject = subjectKey(s.name)
      if (subject === 'other') unmapped.add(s.name)
      s.topics.forEach((name, i) => topics.push({ key: `${source}:${s.name}:${i}`, source, textbookId: null, book: `${source.toUpperCase()} ${s.name}`, subject, band: 'UP', name }))
    }
  }

  for (const c of input.checkpoint) {
    const subject = subjectKey(c.name)
    if (subject === 'other') unmapped.add(c.name)
    c.strands.forEach((name, i) => topics.push({
      key: `checkpoint:${c.programme}:${c.code}:${i}`,
      source: 'checkpoint',
      textbookId: null,
      book: `Checkpoint ${c.name} ${c.code}`,
      subject,
      band: c.programme === 'primary' ? 'P' : 'LS',
      name,
    }))
  }

  return { topics, subtopics, unmapped: [...unmapped].sort(), uncertain: [...uncertain].sort() }
}
