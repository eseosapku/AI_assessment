/**
 * Figures from the figure library's local staging store, for quizzes on this machine (spec 5.6).
 * Read-only, and only when FIGURE_LIBRARY_DIR and FIGURE_ASSET_BASE are both set. Production reads
 * the published rows from Postgres instead (pg-source.ts, FIGURE_LIBRARY_SOURCE=postgres); the
 * switch and the naming helpers both sources share live here. Server-only.
 */
import path from 'node:path'
import type { TextbookFigure } from '@/lib/textbook-figure-bank'
import { openPhraseAnswer, type VettedQuestion } from '@/lib/figure-question-bank'

/** A library figure, with the source it came from (a drawn family, or a real image's collection). */
export interface LibraryFigure extends TextbookFigure { source: string }

export type StagingDb = { prepare(sql: string): { all(...p: unknown[]): unknown[] }; close(): void }
// Loaded at call time: bundlers and jiti rewrite a static import of node:sqlite.
const sqlite = () => (process as unknown as { getBuiltinModule(id: string): { DatabaseSync: new (f: string, o?: object) => StagingDb } })
  .getBuiltinModule('node:sqlite')

/** The staging store, opened read-only. */
export function openStaging(file: string): StagingDb {
  return new (sqlite().DatabaseSync)(file, { readOnly: true })
}

/** Where library figures come from: Postgres in production, the local staging store in development, or nowhere. */
export function librarySource(env: Record<string, string | undefined> = process.env): 'postgres' | 'local' | null {
  if (!env.FIGURE_ASSET_BASE) return null
  if (env.FIGURE_LIBRARY_SOURCE === 'postgres') return 'postgres'
  return env.FIGURE_LIBRARY_DIR ? 'local' : null
}

export function libraryEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return librarySource(env) !== null
}

/** What a reader calls each kind of real image, for the figure's description in a question. */
const NOUNS: Record<string, string> = {
  'photo.micrograph': 'micrograph', 'photo.landscape': 'photograph', 'photo.specimen': 'photograph',
  'photo.apparatus': 'photograph', 'photo.object': 'photograph', 'source.historical': 'source',
}

/** What a reader calls the figure in a question: a real image by its kind, a drawn one a diagram. */
export function nounFor(origin: string, kind: string): string {
  return origin !== 'drawn' ? NOUNS[kind] ?? 'image' : 'diagram'
}

const list = (s: unknown): string[] => {
  try {
    const v = JSON.parse(String(s ?? '[]'))
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

type QuestionRow = { kind: string; stem: string; options: string; answer: string; accepted: string; explanation: string }

export function toVetted(q: QuestionRow): VettedQuestion {
  if (q.kind === 'mcq') {
    return { kind: 'mcq', question: { type: 'mcq', question: q.stem, options: list(q.options), correct_answer: Number(q.answer), explanation: q.explanation ?? '' } }
  }
  return { kind: 'short', question: { type: 'longform', question: q.stem, marks: 1, short_answer: { accepted: list(q.accepted) }, explanation: q.explanation ?? '' } }
}

/** A drawn figure in words: its family, and the title it carries, where it has one. */
export function drawnShows(family: string | null, kind: string, spec: string | null): string {
  let title = ''
  try {
    title = String(JSON.parse(spec ?? '{}')?.title ?? '').trim()
  } catch {
    // No title: the family alone.
  }
  const name = (family ?? kind).replace(/_/g, ' ')
  return title ? `${name}: ${title}` : name
}

/**
 * The approved figures linked to any of these topics (database topic ids), shaped like bank
 * figures with ids "lib:<figure id>", and their questions in the vetted bank's format. A store
 * that cannot be opened gives nothing: the quiz is built without library figures.
 */
export function libraryFigures(o: { topicIds: readonly number[]; file?: string; base?: string }): { figures: LibraryFigure[]; questions: Map<string, VettedQuestion[]> } {
  const empty = { figures: [] as LibraryFigure[], questions: new Map<string, VettedQuestion[]>() }
  const keys = o.topicIds.filter((n) => Number.isFinite(n)).map((n) => `db:${n}`)
  if (!keys.length) return empty
  const file = o.file ?? path.join(process.env.FIGURE_LIBRARY_DIR ?? '', 'figures.db')
  const base = (o.base ?? process.env.FIGURE_ASSET_BASE ?? '').replace(/\/+$/, '')
  let db: StagingDb | null = null
  try {
    db = openStaging(file)
    const marks = keys.map(() => '?').join(', ')
    const rows = db.prepare(`SELECT f.id, f.origin, f.family, f.kind, f.asset, f.spec, f.credit, s.shows,
        MIN(t.name) AS topic, MIN(t.book) AS book, GROUP_CONCAT(DISTINCT t.textbook_id) AS books
      FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
      LEFT JOIN screenings s ON s.figure_id = f.id
      WHERE f.status = 'approved' AND ft.topic_key IN (${marks})
      GROUP BY f.id ORDER BY f.id`).all(...keys) as {
        id: string; origin: string; family: string | null; kind: string; asset: string; spec: string | null
        credit: string | null; shows: string | null; topic: string; book: string; books: string | null
      }[]
    const qs = db.prepare('SELECT kind, stem, options, answer, accepted, explanation FROM figure_questions WHERE figure_id = ? ORDER BY n')
    const figures: LibraryFigure[] = []
    const questions = new Map<string, VettedQuestion[]>()
    for (const r of rows) {
      const id = `lib:${r.id}`
      const real = r.origin !== 'drawn'
      figures.push({
        id, source: r.family ?? r.origin, textbookIds: String(r.books ?? '').split(',').filter(Boolean).map(Number).filter(Number.isFinite),
        textbookName: r.book, page: 0, localPath: `${base}/${r.asset}`,
        noun: nounFor(r.origin, r.kind),
        shows: (real && r.shows) || drawnShows(r.family, r.kind, real ? null : r.spec),
        labels: [], topic: r.topic, original: '',
        ...(real && r.credit ? { credit: r.credit } : {}),
      })
      // A short answer only a sentence can give is dropped, as the bank drops it: the
      // browser marks a short answer by exact match.
      const usable = (qs.all(r.id) as QuestionRow[]).map(toVetted)
        .filter((q) => !(q.kind === 'short' && openPhraseAnswer(q.question.short_answer.accepted, q.question.question)))
      questions.set(id, usable)
    }
    return { figures, questions }
  } catch (err) {
    console.error('Figure library unavailable:', (err as Error).message)
    return empty
  } finally {
    db?.close()
  }
}
