/**
 * Publishing the figure library to Postgres (spec 2026-10-16 3.2): approved figures that reach a
 * database topic, those links only, and the questions a quiz can mark, read from the staging store
 * in batches and inserted with ON CONFLICT DO NOTHING -- never an update or a delete, so a run that
 * stopped half way is simply run again. Used by scripts/figure-library/publish.ts.
 */
import path from 'node:path'
import type { Database } from '../db'
import { openPhraseAnswer } from '../figure-question-bank'
import { drawnShows, openStaging } from './local-source'

export const MIGRATION_FILE = path.join(process.cwd(), 'migrations', 'add-figure-library.sql')

export interface PublishBatch {
  figures: { id: string; origin: string; family: string | null; kind: string; subject: string; band: string; asset: string; preview: string | null
    width: number | null; height: number | null; credit: string | null; shows: string; topic: string; book: string; books: string }[]
  topics: { topic_id: number; figure_id: string }[]
  questions: { id: string; figure_id: string; n: number; kind: string; stem: string; options: string; answer: string; accepted: string
    explanation: string; tolerance: number }[]
}

const list = (s: unknown): string[] => {
  try {
    const v = JSON.parse(String(s ?? '[]'))
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export function* stagingBatches(file: string, size = 2000): Generator<PublishBatch> {
  const db = openStaging(file)
  try {
    const ids = (db.prepare(`SELECT DISTINCT f.id FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id
        WHERE f.status = 'approved' AND ft.topic_key LIKE 'db:%' ORDER BY f.id`).all() as { id: string }[]).map((r) => r.id)
    for (let i = 0; i < ids.length; i += size) {
      const chunk = ids.slice(i, i + size)
      const marks = chunk.map(() => '?').join(', ')
      const figs = db.prepare(`SELECT f.id, f.origin, f.family, f.kind, f.subject, f.band, f.asset, f.preview, f.width, f.height, f.spec, f.credit,
            s.shows, MIN(t.name) AS topic, MIN(t.book) AS book, GROUP_CONCAT(DISTINCT t.textbook_id) AS books
          FROM figures f JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
          LEFT JOIN screenings s ON s.figure_id = f.id
         WHERE f.id IN (${marks}) AND ft.topic_key LIKE 'db:%' GROUP BY f.id ORDER BY f.id`).all(...chunk) as Record<string, any>[]
      const links = db.prepare(`SELECT figure_id, topic_key FROM figure_topics
         WHERE figure_id IN (${marks}) AND topic_key LIKE 'db:%' ORDER BY topic_key, figure_id`).all(...chunk) as { figure_id: string; topic_key: string }[]
      const qs = db.prepare(`SELECT id, figure_id, n, kind, stem, options, answer, accepted, explanation, tolerance FROM figure_questions
         WHERE figure_id IN (${marks}) ORDER BY figure_id, n`).all(...chunk) as Record<string, any>[]
      yield {
        figures: figs.map((r) => ({
          id: r.id, origin: r.origin, family: r.family ?? null, kind: r.kind, subject: r.subject, band: r.band, asset: r.asset,
          preview: r.preview ?? null, width: r.width ?? null, height: r.height ?? null, credit: r.origin !== 'drawn' ? r.credit ?? null : null,
          shows: (r.origin !== 'drawn' && r.shows) || drawnShows(r.family ?? null, r.kind, r.origin === 'drawn' ? r.spec ?? null : null),
          topic: r.topic ?? '', book: r.book ?? '', books: String(r.books ?? ''),
        })),
        topics: links.map((l) => ({ topic_id: Number(l.topic_key.slice(3)), figure_id: l.figure_id })).filter((l) => Number.isInteger(l.topic_id)),
        // A short answer only a sentence can give is dropped, as the quiz drops it (local-source.ts).
        questions: qs.filter((q) => !(q.kind === 'short' && openPhraseAnswer(list(q.accepted), q.stem))).map((q) => ({
          id: q.id, figure_id: q.figure_id, n: Number(q.n), kind: q.kind, stem: q.stem, options: String(q.options ?? '[]'), answer: String(q.answer),
          accepted: String(q.accepted ?? '[]'), explanation: q.explanation ?? '', tolerance: Number(q.tolerance ?? 0),
        })),
      }
    }
  } finally {
    db.close()
  }
}

/** One batch, all or nothing, adding only rows not already there. `db` must be ONE connection (a pg Client). */
export async function writeBatch(db: Database, b: PublishBatch): Promise<void> {
  const col = <T, K extends keyof T>(rows: T[], k: K) => rows.map((r) => r[k])
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO figure_library (id, origin, family, kind, subject, band, asset, preview, width, height, credit, shows, topic, book, books)
      SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::int[], $10::int[],
                           $11::text[], $12::text[], $13::text[], $14::text[], $15::text[])
      ON CONFLICT DO NOTHING`,
      (['id', 'origin', 'family', 'kind', 'subject', 'band', 'asset', 'preview', 'width', 'height', 'credit', 'shows', 'topic', 'book', 'books'] as const)
        .map((k) => col(b.figures, k)))
    await db.query(`INSERT INTO figure_library_topics (topic_id, figure_id)
      SELECT * FROM unnest($1::int[], $2::text[]) ON CONFLICT DO NOTHING`, [col(b.topics, 'topic_id'), col(b.topics, 'figure_id')])
    await db.query(`INSERT INTO figure_library_questions (id, figure_id, n, kind, stem, options, answer, accepted, explanation, tolerance)
      SELECT id, figure_id, n, kind, stem, options::jsonb, answer, accepted::jsonb, explanation, tolerance
        FROM unnest($1::text[], $2::text[], $3::int[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::real[])
          AS t(id, figure_id, n, kind, stem, options, answer, accepted, explanation, tolerance)
      ON CONFLICT DO NOTHING`,
      (['id', 'figure_id', 'n', 'kind', 'stem', 'options', 'answer', 'accepted', 'explanation', 'tolerance'] as const).map((k) => col(b.questions, k)))
    await db.query('COMMIT')
  } catch (err) {
    await db.query('ROLLBACK')
    throw err
  }
}
