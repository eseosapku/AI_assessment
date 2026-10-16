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

const trim = (base: string) => base.replace(/\/+$/, '')

/** The asset paths of library figures among a student's seen images, for leaving them out of a sample. */
export function seenAssets(images: ReadonlySet<string>, base: string): string[] {
  const prefix = `${trim(base)}/`
  return [...images].filter((i) => i.startsWith(prefix)).map((i) => i.slice(prefix.length))
}

export async function libraryFiguresPg(db: Database, o: {
  topicIds: readonly number[]; excludeAssets?: readonly string[]; limit?: number; base?: string; timeoutMs?: number
}): Promise<{ figures: LibraryFigure[]; questions: Map<string, VettedQuestion[]> }> {
  const empty = { figures: [] as LibraryFigure[], questions: new Map<string, VettedQuestion[]>() }
  const topicIds = o.topicIds.filter((n) => Number.isFinite(n))
  if (!topicIds.length) return empty
  const base = trim(o.base ?? process.env.FIGURE_ASSET_BASE ?? '')

  const work = async () => {
    const { rows } = await db.query<FigureRow>(
      `SELECT f.id, f.origin, f.family, f.kind, f.asset, f.credit, f.shows, f.topic, f.book, f.books
         FROM figure_library f
        WHERE f.id IN (SELECT figure_id FROM figure_library_topics WHERE topic_id = ANY($1::int[]))
          AND NOT (f.asset = ANY($2::text[]))
        ORDER BY random() LIMIT $3`,
      [topicIds, [...(o.excludeAssets ?? [])], o.limit ?? 300],
    )
    if (!rows.length) return empty
    const { rows: qs } = await db.query<QuestionRow>(
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
      timer = setTimeout(() => { console.error('Figure library lookup timed out'); resolve(empty) }, o.timeoutMs ?? 2000)
    })
    return await Promise.race([work(), slow])
  } catch (err) {
    console.error('Figure library unavailable:', (err as Error).message)
    return empty
  } finally {
    clearTimeout(timer)
  }
}
