/**
 * The figure library's approved figures from Postgres, for production quizzes (spec 2026-10-16 3.3).
 * Rows are published from the staging store by scripts/figure-library/publish.ts; files are on
 * CloudFront under FIGURE_ASSET_BASE. A lookup that fails or is slow gives nothing: the quiz is built
 * from the banks, as before. Server-only.
 */
import type { Database } from '@/lib/db'
import type { VettedQuestion } from '@/lib/figure-question-bank'
import { nounFor, toVetted, type LibraryFigure } from './local-source'

type FigureRow = { id: string; origin: string; family: string | null; kind: string; asset: string; credit: string | null
  shows: string | null; topic: string | null; book: string | null; books: string | null }
type QuestionRow = { figure_id: string; kind: string; stem: string; options: unknown; answer: string; accepted: unknown; explanation: string | null }

const trim = (base: string) => base.trim().replace(/\/+$/, '')

/** Library questions are multiple choice or short answer; a quiz's written kind has none to offer. */
const LIBRARY_KINDS = new Set(['mcq', 'short'])

type Query = Database['query']
/** The pool's statement-timeout runner, where the caller has one (lib/db.ts); stubs in tests may not. */
type WithTimeout = { withStatementTimeout?: <R>(ms: number, fn: (query: Query) => Promise<R>) => Promise<R> }

/** The asset paths of library figures among a student's seen images, for leaving them out of a sample. */
export function seenAssets(images: ReadonlySet<string>, base: string): string[] {
  const prefix = `${trim(base)}/`
  return [...images].filter((i) => i.startsWith(prefix)).map((i) => i.slice(prefix.length))
}

export async function libraryFiguresPg(db: Database & WithTimeout, o: {
  topicIds: readonly number[]; excludeAssets?: readonly string[]; limit?: number; base?: string; timeoutMs?: number
  /** The quiz's question kinds: only figures with a library question of one of them are sampled. */
  kinds?: readonly string[]
}): Promise<{ figures: LibraryFigure[]; questions: Map<string, VettedQuestion[]> }> {
  const empty = { figures: [] as LibraryFigure[], questions: new Map<string, VettedQuestion[]>() }
  const topicIds = o.topicIds.filter((n) => Number.isFinite(n))
  if (!topicIds.length) return empty
  const base = trim(o.base ?? process.env.FIGURE_ASSET_BASE ?? '')
  const limit = o.limit ?? 300
  const kinds = o.kinds ? o.kinds.filter((k) => LIBRARY_KINDS.has(k)) : null
  const timeoutMs = o.timeoutMs ?? 2000

  const work = async (query: Query) => {
    // The topic links are sampled first -- an index-only sort of narrow rows -- three times over, then
    // only those figures are fetched. Sorting whole figure rows at random took 812 ms on an 8,618-figure
    // topic; this takes 25-60 ms. A third of the figures have no multiple-choice question, so a quiz's
    // kinds are checked here rather than discovered after the sample is spent.
    const { rows } = await query<FigureRow>(
      `WITH pick AS (SELECT figure_id FROM figure_library_topics WHERE topic_id = ANY($1::int[]) ORDER BY random() LIMIT $3)
       SELECT f.id, f.origin, f.family, f.kind, f.asset, f.credit, f.shows, f.topic, f.book, f.books
         FROM figure_library f JOIN (SELECT DISTINCT figure_id FROM pick) p ON p.figure_id = f.id
        WHERE NOT (f.asset = ANY($2::text[]))
          AND ($5::text[] IS NULL OR EXISTS (SELECT 1 FROM figure_library_questions q WHERE q.figure_id = f.id AND q.kind = ANY($5::text[])))
        LIMIT $4`,
      [topicIds, [...(o.excludeAssets ?? [])], limit * 3, limit, kinds],
    )
    if (!rows.length) return empty
    const { rows: qs } = await query<QuestionRow>(
      `SELECT figure_id, kind, stem, options, answer, accepted, explanation
         FROM figure_library_questions WHERE figure_id = ANY($1::text[]) ORDER BY figure_id, n`,
      [rows.map((r) => r.id)],
    )
    const questions = new Map<string, VettedQuestion[]>()
    for (const q of qs) {
      const id = `lib:${q.figure_id}`
      questions.set(id, [...(questions.get(id) ?? []), toVetted({ kind: q.kind, stem: q.stem, options: JSON.stringify(q.options ?? []),
        answer: q.answer, accepted: JSON.stringify(q.accepted ?? []), explanation: q.explanation ?? '' })])
    }
    const figures: LibraryFigure[] = rows.map((r) => ({
      id: `lib:${r.id}`, source: r.family ?? r.origin,
      textbookIds: String(r.books ?? '').split(',').filter(Boolean).map(Number).filter(Number.isFinite),
      textbookName: r.book ?? '', page: 0, localPath: `${base}/${r.asset}`, noun: nounFor(r.origin, r.kind),
      shows: r.shows ?? '', labels: [], topic: r.topic ?? '', original: '',
      ...(r.origin !== 'drawn' && r.credit ? { credit: r.credit } : {}),
    }))
    return { figures, questions }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const slow = new Promise<typeof empty>((resolve) => {
      timer = setTimeout(() => { console.error('Figure library lookup timed out'); resolve(empty) }, timeoutMs)
    })
    // Where the pool can, the database abandons the lookup at the same deadline instead of running on.
    const lookup = db.withStatementTimeout
      ? db.withStatementTimeout(timeoutMs, (query) => work(query))
      : work((text, values) => db.query(text, values))
    return await Promise.race([lookup, slow])
  } catch (err) {
    console.error('Figure library unavailable:', (err as Error).message)
    return empty
  } finally {
    clearTimeout(timer)
  }
}
