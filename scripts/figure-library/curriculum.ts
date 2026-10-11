// scripts/figure-library/curriculum.ts
import { subjectKey } from './subjects'
import { levelBand, type Band } from './levels'

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
