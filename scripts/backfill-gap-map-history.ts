/**
 * Give old quizzes their place on the Learning Gap Map.
 *
 * Most quizzes taken before July 2026 were saved with no textbook and no
 * per-question subtopic tags, so they coloured nothing: students saw every
 * chapter "not tested" after a term of quizzes. Their questions and answers
 * were saved, though. This resolves each such quiz to its book, tags each
 * question with lib/question-tagging.ts (the same rule live quizzes use: two
 * shared words, never a guess), scores it from the student's saved answer,
 * and adds the result to topic_mastery exactly as save-result does.
 *
 * Which book: the quiz's subject when it is a book's exact name; otherwise
 * the one book in the student's class with the same subject. WAEC/JAMB
 * books are left out, as the map leaves them out.
 *
 * Read-only unless --apply. With --apply it writes topic_mastery rows
 * (adding to any that exist), fills the quiz's missing textbook_id -- which
 * is also what stops a second run from counting it twice -- and records
 * every change in --log so it can be undone.
 *
 *   npx jiti scripts/backfill-gap-map-history.ts                 # measure
 *   npx jiti scripts/backfill-gap-map-history.ts --apply --log=backfill-log.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import { tagQuestionsWithSubtopics } from '../lib/question-tagging'
import { canonicalSubject } from '../lib/canonical-subject'
import { isExamPrepCurriculumNumeric } from '../lib/curriculum-registry'

const ROOT = process.cwd()
const APPLY = process.argv.includes('--apply')
const LOG = (process.argv.find((a) => a.startsWith('--log=')) ?? '').slice('--log='.length)

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

/** A question's score as save-result works it out: 0..1, or null when it cannot be marked. */
function scoreOf(q: any, idx: number, answers: any, grades: any): number | null {
  if (q?.type === 'longform') {
    const g = grades?.[idx] ?? grades?.[String(idx)]
    const total = Number(g?.marks_total)
    return g && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(1, Number(g.marks_awarded ?? 0) / total)) : null
  }
  if (q?.type === 'mcq' || Array.isArray(q?.options)) {
    const mcq = answers && typeof answers === 'object' && answers.mcq ? answers.mcq : (answers ?? {})
    const given = mcq?.[idx] ?? mcq?.[String(idx)]
    return given !== undefined && given !== null && Number(given) === Number(q?.correct_answer) ? 1 : 0
  }
  return null
}

async function main() {
  if (APPLY && !LOG) throw new Error('--apply needs --log=<file> so the changes can be undone')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000, query_timeout: 120000 })
  const rows = (await pool.query(`
    SELECT r.id AS result_id, r.user_id::text AS user_id, r.answers, r.longform_grades, r.created_at,
           a.id AS assessment_id, a.subject, u.class AS cls,
           CASE WHEN jsonb_typeof(a.questions_data) = 'array' THEN a.questions_data ELSE '[]'::jsonb END AS qs
      FROM results r JOIN assessments a ON a.id = r.assessment_id LEFT JOIN users u ON u.id = r.user_id
     WHERE a.textbook_id IS NULL AND r.user_id IS NOT NULL`)).rows
  const books = (await pool.query('SELECT textbook_id, textbook_name, curriculum FROM textbooks')).rows
  const byName = new Map(books.map((b: any) => [String(b.textbook_name).trim().toLowerCase(), b]))
  const classBooks = new Map<string, any[]>()
  for (const r of (await pool.query('SELECT c.name, t.textbook_id, t.textbook_name, t.curriculum FROM classes c JOIN class_textbooks ct ON ct.class_id = c.id JOIN textbooks t ON t.textbook_id = ct.textbook_id')).rows) {
    const k = String(r.name).trim().toLowerCase()
    if (!classBooks.has(k)) classBooks.set(k, [])
    classBooks.get(k)!.push(r)
  }
  const subsOf = new Map<number, { id: number; name: string; topic_id: number | null }[]>()
  for (const s of (await pool.query('SELECT subtopic_id, subtopic, topic_id, textbook_id FROM subtopics')).rows) {
    const k = Number(s.textbook_id)
    if (!subsOf.has(k)) subsOf.set(k, [])
    subsOf.get(k)!.push({ id: Number(s.subtopic_id), name: String(s.subtopic), topic_id: s.topic_id == null ? null : Number(s.topic_id) })
  }

  // Per (student, book, subtopic): what to add. Per quiz: the book to record.
  const buckets = new Map<string, { user_id: string; textbook_id: number; subtopic_id: number; correct: number; total: number; last: Date }>()
  const assessmentBook = new Map<string, number>()
  const how: Record<string, number> = {}
  let placed = 0, questions = 0
  const students = new Set<string>()
  for (const r of rows) {
    const subject = String(r.subject ?? '').trim()
    let book: any = byName.get(subject.toLowerCase())
    let via = book ? 'exact book name' : ''
    if (!book && r.cls) {
      const want = canonicalSubject(subject)
      const cands = (classBooks.get(String(r.cls).trim().toLowerCase()) ?? []).filter((b: any) => canonicalSubject(b.textbook_name) === want)
      if (cands.length === 1) { book = cands[0]; via = 'subject + class' } else via = cands.length > 1 ? 'several books in class (left)' : 'no matching book'
    } else if (!book) via = 'no class on profile'
    if (book && isExamPrepCurriculumNumeric(Number(book.curriculum))) { book = null; via = 'exam prep (left out)' }
    how[via] = (how[via] ?? 0) + 1
    if (!book) continue
    const textbookId = Number(book.textbook_id)
    assessmentBook.set(String(r.assessment_id), textbookId)
    const qs: any[] = (Array.isArray(r.qs) ? r.qs : []).map((q: any) => ({ ...q, subtopic_id: undefined, topic_id: undefined }))
    tagQuestionsWithSubtopics(qs, subsOf.get(textbookId) ?? [])
    qs.forEach((q, idx) => {
      questions++
      if (!(Number(q.subtopic_id) > 0)) return
      const s = scoreOf(q, idx, r.answers, r.longform_grades)
      if (s === null) return
      placed++
      students.add(r.user_id)
      const key = `${r.user_id}|${textbookId}|${q.subtopic_id}`
      const b = buckets.get(key) ?? { user_id: r.user_id, textbook_id: textbookId, subtopic_id: Number(q.subtopic_id), correct: 0, total: 0, last: new Date(0) }
      b.correct += s
      b.total += 1
      const at = new Date(r.created_at)
      if (at > b.last) b.last = at
      buckets.set(key, b)
    })
  }

  console.log(`old results with no book: ${rows.length}`)
  console.log('how each resolves to a book:', how)
  console.log(`questions placed and scored: ${placed} of ${questions} | students gaining sections: ${students.size} | mastery rows to write: ${buckets.size} | quizzes to give a book: ${assessmentBook.size}`)
  if (!APPLY) { await pool.end(); console.log('Read-only. Run with --apply --log=<file> to write.'); return }

  const log: { mastery: any[]; assessments: { id: string; textbook_id: number }[] } = { mastery: [], assessments: [] }
  for (const b of buckets.values()) {
    const existing = (await pool.query(
      'SELECT attempts, correct, last_assessed FROM topic_mastery WHERE user_id = $1 AND textbook_id = $2 AND topic_id = 0 AND subtopic_id = $3 LIMIT 1',
      [b.user_id, b.textbook_id, b.subtopic_id])).rows[0]
    const addCorrect = Math.round(b.correct)
    const attempts = Number(existing?.attempts ?? 0) + b.total
    const correct = Number(existing?.correct ?? 0) + addCorrect
    const accuracy = attempts > 0 ? Math.round((correct / attempts) * 10000) / 100 : 0
    const last = existing?.last_assessed && new Date(existing.last_assessed) > b.last ? new Date(existing.last_assessed) : b.last
    await pool.query(
      `INSERT INTO topic_mastery (user_id, textbook_id, topic_id, subtopic_id, attempts, correct, accuracy, last_assessed, updated_at)
       VALUES ($1, $2, 0, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, textbook_id, topic_id, subtopic_id) DO UPDATE SET
         attempts = EXCLUDED.attempts, correct = EXCLUDED.correct, accuracy = EXCLUDED.accuracy,
         last_assessed = EXCLUDED.last_assessed, updated_at = EXCLUDED.updated_at`,
      [b.user_id, b.textbook_id, b.subtopic_id, attempts, correct, accuracy, last.toISOString()])
    log.mastery.push({ user_id: b.user_id, textbook_id: b.textbook_id, subtopic_id: b.subtopic_id, added_attempts: b.total, added_correct: addCorrect, existed: Boolean(existing) })
  }
  for (const [id, textbookId] of assessmentBook) {
    const res = await pool.query('UPDATE assessments SET textbook_id = $2 WHERE id = $1 AND textbook_id IS NULL', [id, textbookId])
    if (res.rowCount) log.assessments.push({ id, textbook_id: textbookId })
  }
  fs.writeFileSync(LOG, JSON.stringify(log, null, 1))
  await pool.end()
  console.log(`written: ${log.mastery.length} mastery rows, ${log.assessments.length} quizzes given a book. Undo log: ${LOG}`)
}

main().catch((e) => { console.error('failed:', e.message); process.exit(1) })
