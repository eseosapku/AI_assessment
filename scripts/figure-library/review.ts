// scripts/figure-library/review.ts
import fs from 'node:fs'
import path from 'node:path'
import { readJson, type Store } from './store'
import type { ImageInput } from './claude'

export const REVIEW_JOB = 'p1a-review'
/** Spec 3.3: a family passes a blind review of 30 items scoring 27 or better. */
export const REVIEW_SIZE = 30
export const PASS_MARK = 27
/** A figure (about 800 tokens), the prompt (about 600) and a worked check of each question (about 450 out). */
export const REVIEW_USD_PER_ITEM = 0.008

const LEVELS: Record<string, string> = {
  P: 'Primary (ages 6 to 11)',
  LS: 'Lower Secondary (ages 11 to 14)',
  UP: 'Upper Secondary: IGCSE, senior secondary, WAEC (ages 14 to 17)',
  AL: 'AS and A Level (ages 16 to 18)',
}

export interface ReviewQuestion { n: number; kind: string; stem: string; options: string[]; answer: string; accepted: string[] }
export interface ReviewItem { figureId: string; family: string; subject: string; band: string; preview: string; questions: ReviewQuestion[] }
export interface QuestionVerdict { n: number; ownAnswer: string; keyCorrect: boolean; answerable: boolean; problem: string }
export interface Verdict { pass: boolean; figureClear: boolean; educational: boolean; questions: QuestionVerdict[]; problems: string[] }

const letter = (i: number) => String.fromCharCode(65 + i)

/** The words sent with the figure. Blind: nothing says how the figure was made or what family it is from. */
export function reviewPrompt(item: ReviewItem): string {
  const questions = item.questions.map((q) => {
    if (q.kind === 'mcq') {
      const options = q.options.map((o, i) => `   ${letter(i)}) ${o}`).join('\n')
      return `${q.n}. [multiple choice] ${q.stem}\n${options}\n   Key: ${letter(Number(q.answer))}`
    }
    const also = q.accepted.slice(1)
    return `${q.n}. [short answer] ${q.stem}\n   Key: ${q.answer}${also.length ? ` (also accepted: ${also.join('; ')})` : ''}`
  }).join('\n\n')
  return [
    'You are checking one exam figure and its questions before they are given to students.',
    `Subject: ${item.subject}. Level: ${LEVELS[item.band] ?? item.band}.`,
    '',
    'The figure is attached. These are its questions, each with its answer key:',
    '',
    questions,
    '',
    'For each question, work it out yourself from the figure first, then compare your answer with the key.',
    'Judge:',
    '- key_correct: the key is the right answer, and for multiple choice no other option is also right.',
    '- answerable: a student at this level can answer it from the figure and the question alone; nothing is unclear or missing.',
    '- figure_clear: every label, number and line the questions need is legible and unambiguous; nothing overlaps or is cut off.',
    '- educational: the figure teaches or tests something real in this subject at this level.',
    '',
    'Reply with JSON only, in this shape:',
    '{"questions":[{"n":1,"worked":"one or two lines","own_answer":"...","key_correct":true,"answerable":true,"problem":""}],"figure_clear":true,"educational":true,"problems":[]}',
  ].join('\n')
}

/**
 * The reviewer's reply as a verdict. The pass is worked out here from its
 * parts, never taken from the model, and a reply that leaves out a question
 * or a judgement is refused rather than read as a pass.
 */
export function parseVerdict(raw: unknown, item: ReviewItem): Verdict {
  if (!raw || typeof raw !== 'object') throw new Error('The review is not a JSON object')
  const r = raw as { questions?: unknown; figure_clear?: unknown; educational?: unknown; problems?: unknown }
  if (typeof r.figure_clear !== 'boolean' || typeof r.educational !== 'boolean') {
    throw new Error('The review has no figure_clear or educational judgement')
  }
  const given = Array.isArray(r.questions) ? (r.questions as Record<string, unknown>[]) : []
  const questions = item.questions.map((q) => {
    const v = given.find((x) => x && Number(x.n) === q.n)
    if (!v || typeof v.key_correct !== 'boolean' || typeof v.answerable !== 'boolean') {
      throw new Error(`The review does not judge question ${q.n}`)
    }
    return { n: q.n, ownAnswer: String(v.own_answer ?? ''), keyCorrect: v.key_correct, answerable: v.answerable, problem: String(v.problem ?? '') }
  })
  const problems = Array.isArray(r.problems) ? r.problems.map(String).filter(Boolean) : []
  const pass = r.figure_clear && r.educational && questions.every((q) => q.keyCorrect && q.answerable)
  return { pass, figureClear: r.figure_clear, educational: r.educational, questions, problems }
}

/**
 * Up to `size` figures from each family, earliest seeds first, leaving out
 * any this job has already reviewed, so a stopped run carries on without
 * paying twice. Rejected figures stay in the sample: they count against the
 * family.
 */
export function itemsToReview(db: Store, o: { job: string; size: number; families?: readonly string[] }): ReviewItem[] {
  const families = o.families?.length
    ? o.families
    : (db.prepare("SELECT DISTINCT family FROM figures WHERE origin = 'drawn' ORDER BY family").all() as { family: string }[]).map((r) => r.family)
  const pick = db.prepare("SELECT id, family, subject, band, preview FROM figures WHERE origin = 'drawn' AND family = ? ORDER BY seed LIMIT ?")
  const reviewed = db.prepare('SELECT 1 FROM reviews WHERE job = ? AND figure_id = ?')
  const questionsOf = db.prepare('SELECT n, kind, stem, options, answer, accepted FROM figure_questions WHERE figure_id = ? ORDER BY n')
  const items: ReviewItem[] = []
  for (const family of families) {
    for (const f of pick.all(family, o.size) as { id: string; family: string; subject: string; band: string; preview: string | null }[]) {
      if (reviewed.get(o.job, f.id)) continue
      const questions = (questionsOf.all(f.id) as { n: number; kind: string; stem: string; options: string; answer: string; accepted: string }[])
        .map((q) => ({ n: q.n, kind: q.kind, stem: q.stem, options: readJson<string[]>(q.options, []), answer: q.answer, accepted: readJson<string[]>(q.accepted, []) }))
      items.push({ figureId: f.id, family: f.family, subject: f.subject, band: f.band, preview: f.preview ?? '', questions })
    }
  }
  return items
}

function reasonFor(v: Verdict): string {
  const parts = [
    ...(v.figureClear ? [] : ['figure unclear']),
    ...(v.educational ? [] : ['not educational']),
    ...v.questions
      .filter((q) => !q.keyCorrect || !q.answerable)
      .map((q) => `Q${q.n}: ${q.problem || (q.keyCorrect ? 'not answerable' : `key wrong (reviewer: ${q.ownAnswer})`)}`),
    ...v.problems,
  ]
  return (parts.join('; ') || 'failed review').slice(0, 600)
}

/** Records one verdict, replacing any earlier one for this job. A failed figure is rejected, with the reasons. */
export function saveVerdict(db: Store, o: { job: string; model: string; figureId: string; verdict: Verdict }): void {
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(job, figure_id) DO UPDATE SET model = excluded.model, pass = excluded.pass, detail = excluded.detail, at = excluded.at`)
      .run(o.job, o.figureId, o.model, o.verdict.pass ? 1 : 0, JSON.stringify(o.verdict), new Date().toISOString())
    if (o.verdict.pass) {
      db.prepare("UPDATE figures SET status = 'stored', reason = NULL WHERE id = ? AND status = 'rejected'").run(o.figureId)
    } else {
      db.prepare("UPDATE figures SET status = 'rejected', reason = ? WHERE id = ?").run(reasonFor(o.verdict), o.figureId)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export interface FamilyScore { family: string; reviewed: number; passed: number; passes: boolean }

/** Each family's score in this job. A family passes at 27 of 30; fewer than 30 reviewed is not yet a pass. */
export function familyScores(db: Store, job: string): FamilyScore[] {
  const rows = db.prepare(`SELECT f.family AS family, COUNT(*) AS reviewed, SUM(r.pass) AS passed
    FROM reviews r JOIN figures f ON f.id = r.figure_id WHERE r.job = ? GROUP BY f.family ORDER BY f.family`)
    .all(job) as { family: string; reviewed: number; passed: number }[]
  return rows.map((r) => ({
    family: r.family,
    reviewed: Number(r.reviewed),
    passed: Number(r.passed),
    passes: Number(r.reviewed) >= REVIEW_SIZE && Number(r.passed) >= PASS_MARK,
  }))
}

/** The figure's PNG for the reviewer, or null when the file is missing: then nothing is sent or paid for. */
export function previewImage(lib: string, item: Pick<ReviewItem, 'preview'>): ImageInput | null {
  if (!item.preview) return null
  const file = path.join(lib, item.preview)
  if (!fs.existsSync(file)) return null
  return { mediaType: 'image/png', data: fs.readFileSync(file).toString('base64') }
}
