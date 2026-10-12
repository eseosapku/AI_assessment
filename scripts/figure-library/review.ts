// scripts/figure-library/review.ts
import fs from 'node:fs'
import path from 'node:path'
import { readJson, type Store } from './store'
import type { ImageInput } from './claude'

/**
 * The blind review: the reviewer answers each question without seeing the key, and code
 * compares. 'p1a-review' was the first run, which showed the key and let a reviewer pass
 * items it had itself called ambiguous; its verdicts stay in the store as history.
 */
export const REVIEW_JOB = 'p1a-blind'
/** Spec 3.3: a family passes a blind review of 30 items scoring 27 or better. */
export const REVIEW_SIZE = 30
export const PASS_MARK = 27
/** A figure (about 800 tokens), the prompt (about 600) and a worked check of each question (about 450 out). */
export const REVIEW_USD_PER_ITEM = 0.008

export const LEVELS: Record<string, string> = {
  P: 'Primary (ages 6 to 11)',
  LS: 'Lower Secondary (ages 11 to 14)',
  UP: 'Upper Secondary: IGCSE, senior secondary, WAEC (ages 14 to 17)',
  AL: 'AS and A Level (ages 16 to 18)',
}

/** `tolerance`: how far from the key a reading from a curve is still right, as the question states it; 0 or absent is exact. */
export interface ReviewQuestion { n: number; kind: string; stem: string; options: string[]; answer: string; accepted: string[]; tolerance?: number }
export interface ReviewItem { figureId: string; family: string; subject: string; band: string; preview: string; questions: ReviewQuestion[] }
export interface QuestionVerdict {
  n: number
  /** The answer as the key gives it, for the record and the rejection reason. */
  key: string
  ownAnswer: string
  /** Worked out in code: the reviewer's own answer is the key. */
  keyCorrect: boolean
  answerable: boolean
  /** Exactly one answer is right: for multiple choice, no other option is also right. */
  singleAnswer: boolean
  problem: string
}
export interface Verdict { pass: boolean; figureClear: boolean; educational: boolean; questions: QuestionVerdict[]; problems: string[] }

const letter = (i: number) => String.fromCharCode(65 + i)

/**
 * The words sent with the figure. Blind twice over: nothing says how the figure was made
 * or what family it is from, and no answer key is shown, so the key cannot lead the
 * reviewer's own answer.
 */
export function reviewPrompt(item: ReviewItem): string {
  const questions = item.questions.map((q) => {
    if (q.kind === 'mcq') {
      const options = q.options.map((o, i) => `   ${letter(i)}) ${o}`).join('\n')
      return `${q.n}. [multiple choice] ${q.stem}\n${options}`
    }
    return `${q.n}. [short answer] ${q.stem}`
  }).join('\n\n')
  // Only where a question states a tolerance: an exact reading's marker gives no slack, so there
  // "readings could differ by a square" stays a real objection.
  const estimate = item.questions.some((q) => (q.tolerance ?? 0) > 0)
  return [
    'You are checking one exam figure and its questions before they are given to students.',
    `Subject: ${item.subject}. Level: ${LEVELS[item.band] ?? item.band}.`,
    '',
    'The figure is attached. These are its questions:',
    '',
    questions,
    '',
    'Answer each question yourself, from the figure and the question alone, as a careful student would.',
    'Give a multiple-choice answer as its letter. Then judge:',
    '- answerable: a student at this level can answer it from the figure and the question alone; nothing is unclear or missing.',
    '- single_answer: exactly one answer is right; for multiple choice, no other option is also right.'
      + (estimate ? ' An estimate read from a graph counts as one answer when careful readings agree to within one small square, as a mark scheme accepts that range.' : ''),
    '- figure_clear: every label, number and line the questions need is legible and unambiguous; nothing overlaps or is cut off.',
    '- educational: the figure teaches or tests something real in this subject at this level.',
    '',
    'Reply with JSON only, in this shape:',
    '{"questions":[{"n":1,"worked":"one or two lines","own_answer":"...","answerable":true,"single_answer":true,"problem":""}],"figure_clear":true,"educational":true,"problems":[]}',
  ].join('\n')
}

// ".7" is 0.7; a hyphen after a digit joins a range ("12-13"), it is not a minus sign.
const NUMBER = /(?<![\d.])-?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*\d+(?:\.\d+)?)?/g

/** Every number in an answer, a fraction as its value: "9/25", "18/50" and "0.36" are one answer. */
function numbersIn(text: string): number[] {
  return (text.replace(/[\u2212\u2013\u2014]/g, '-').match(NUMBER) ?? []).map((t) => {
    const [a, b] = t.split('/').map((x) => Number(x.trim()))
    return b === undefined ? a : a / b
  })
}

/** Lowercased and single-spaced, without a closing full stop or a leading article. */
function words(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/[.,;:!?]+$/g, '').trim().replace(/^(?:the|an?)\s+/, '')
}

/** A letter on its own or before a bracket, stop or space: "A", "(A)", "A) Mango", "A. Mango". */
const LETTER = /^\(?([a-z])(?:[).:]|\s|$)/i

/**
 * Whether the reviewer's own answer is the key. Multiple choice: the same letter, or the
 * option's words. A numeric key: the same numbers in the same order, whatever the units
 * ("40 students", "07:30" against "7:30", "(3, -2)"); for a one-number key, every number the
 * reviewer writes is it ("1/10 (0.1)" restates it), or within the tolerance the question states
 * ("about 55 (accept 54 to 57)"). Other numbers in the accepted list are other forms of the key
 * ("80 mm" for 8 cm), never other right answers. An answer typed exactly as an accepted form is
 * right, as the student would be marked. Otherwise the same words.
 */
export function agrees(q: ReviewQuestion, own: string): boolean {
  const text = own.trim()
  if (q.kind === 'mcq') {
    const key = Number(q.answer)
    const m = LETTER.exec(text)
    if (m) return m[1].toUpperCase().charCodeAt(0) - 65 === key
    return words(text) === words(q.options[key] ?? '')
  }
  const expected = numbersIn(q.answer)
  if (expected.length) {
    const mine = numbersIn(text)
    const same = (a: number, b: number) => Math.abs(a - b) < 1e-9
    const near = (a: number) => Math.abs(a - expected[0]) <= (q.tolerance ?? 0) + 1e-9
    const reached = expected.length === 1
      ? mine.length > 0 && mine.every(near)
      : mine.length === expected.length && mine.every((v, i) => same(v, expected[i]))
    return reached || q.accepted.some((form) => words(form) === words(text))
  }
  return (q.accepted.length ? q.accepted : [q.answer]).some((form) => words(form) === words(text))
}

/**
 * A reviewer's "not a single answer" is met by the question's own tolerance when every number it
 * wrote lies inside it (agrees() checks that): "13 or 14" is one right answer to a marker who
 * accepts 12 to 16. Only a question that states a tolerance; elsewhere the objection stands.
 */
function hedgeInside(q: ReviewQuestion, keyCorrect: boolean): boolean {
  return keyCorrect && q.kind !== 'mcq' && (q.tolerance ?? 0) > 0
}

/**
 * The reviewer's reply as a verdict. Whether each key is right is worked out here, by
 * comparing the reviewer's own answer with it; the pass is worked out from the parts and
 * never taken from the model; and a reply that leaves out an answer or a judgement is
 * refused rather than read as a pass.
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
    const own = typeof v?.own_answer === 'string' || typeof v?.own_answer === 'number' ? String(v.own_answer).trim() : ''
    if (!v || !own || typeof v.answerable !== 'boolean' || typeof v.single_answer !== 'boolean') {
      throw new Error(`The review does not answer and judge question ${q.n}`)
    }
    const key = q.kind === 'mcq' ? `${letter(Number(q.answer))}) ${q.options[Number(q.answer)]}` : q.answer
    const keyCorrect = agrees(q, own)
    return {
      n: q.n, key, ownAnswer: own, keyCorrect, answerable: v.answerable, singleAnswer: v.single_answer || hedgeInside(q, keyCorrect),
      problem: String(v.problem ?? ''),
    }
  })
  const problems = Array.isArray(r.problems) ? r.problems.map(String).filter(Boolean) : []
  const pass = r.figure_clear && r.educational && questions.every((q) => q.keyCorrect && q.answerable && q.singleAnswer)
  return { pass, figureClear: r.figure_clear, educational: r.educational, questions, problems }
}

/**
 * Figures to review in a job, leaving out any already reviewed, so a stopped run carries on
 * without paying twice. Drawn families: up to `size` per family, earliest seeds first,
 * rejected ones included. Given `figureIds` (real images): those figures, with the full
 * image and only the questions `writer` wrote; one with none from that writer is left out.
 */
export function itemsToReview(db: Store, o: { job: string; size: number; families?: readonly string[]; figureIds?: readonly string[]; writer?: string }): ReviewItem[] {
  const reviewed = db.prepare('SELECT 1 FROM reviews WHERE job = ? AND figure_id = ?')
  const questionsOf = db.prepare(`SELECT n, kind, stem, options, answer, accepted, tolerance FROM figure_questions
    WHERE figure_id = ? AND (? IS NULL OR model = ?) ORDER BY n`)
  const toItem = (f: { id: string; family: string; subject: string; band: string; preview: string | null }): ReviewItem => ({
    figureId: f.id, family: f.family, subject: f.subject, band: f.band, preview: f.preview ?? '',
    questions: (questionsOf.all(f.id, o.writer ?? null, o.writer ?? null) as { n: number; kind: string; stem: string; options: string; answer: string; accepted: string; tolerance: number }[])
      .map((q) => ({ n: q.n, kind: q.kind, stem: q.stem, options: readJson<string[]>(q.options, []), answer: q.answer, accepted: readJson<string[]>(q.accepted, []), tolerance: Number(q.tolerance) || 0 })),
  })
  if (o.figureIds) {
    const pick = db.prepare(`SELECT id, COALESCE(family, origin) AS family, subject, band,
      CASE WHEN origin = 'drawn' THEN preview ELSE asset END AS preview FROM figures WHERE id = ?`)
    return o.figureIds.flatMap((id) => {
      const f = pick.get(id) as { id: string; family: string; subject: string; band: string; preview: string | null } | undefined
      if (!f || reviewed.get(o.job, id)) return []
      const item = toItem(f)
      return item.questions.length ? [item] : []
    })
  }
  const families = o.families?.length
    ? o.families
    : (db.prepare("SELECT DISTINCT family FROM figures WHERE origin = 'drawn' ORDER BY family").all() as { family: string }[]).map((r) => r.family)
  const pick = db.prepare("SELECT id, family, subject, band, preview FROM figures WHERE origin = 'drawn' AND family = ? ORDER BY seed LIMIT ?")
  const items: ReviewItem[] = []
  for (const family of families) {
    for (const f of pick.all(family, o.size) as { id: string; family: string; subject: string; band: string; preview: string | null }[]) {
      if (!reviewed.get(o.job, f.id)) items.push(toItem(f))
    }
  }
  return items
}

function reasonFor(v: Verdict): string {
  const parts = [
    ...(v.figureClear ? [] : ['figure unclear']),
    ...(v.educational ? [] : ['not educational']),
    ...v.questions
      .filter((q) => !q.keyCorrect || !q.answerable || !q.singleAnswer)
      .map((q) => {
        const why = [
          ...(q.keyCorrect ? [] : [`the reviewer answered "${q.ownAnswer}", the key is ${q.key}`]),
          ...(q.singleAnswer ? [] : ['more than one answer is right']),
          ...(q.answerable ? [] : ['not answerable from the figure']),
        ]
        return `Q${q.n}: ${why.join('; ')}${q.problem ? `: ${q.problem}` : ''}`
      }),
    ...v.problems,
  ]
  return (parts.join('; ') || 'failed review').slice(0, 600)
}

/** Records one verdict, replacing any earlier one for this job. A failed figure is rejected, with the reasons. */
export function saveVerdict(db: Store, o: { job: string; model: string; figureId: string; verdict: Verdict; mark?: boolean }): void {
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO reviews (job, figure_id, model, pass, detail, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(job, figure_id) DO UPDATE SET model = excluded.model, pass = excluded.pass, detail = excluded.detail, at = excluded.at`)
      .run(o.job, o.figureId, o.model, o.verdict.pass ? 1 : 0, JSON.stringify(o.verdict), new Date().toISOString())
    // A comparison of writers judges questions, not the image: it leaves the figure's status alone.
    if (o.mark !== false) {
      if (o.verdict.pass) {
        db.prepare("UPDATE figures SET status = 'stored', reason = NULL WHERE id = ? AND status = 'rejected'").run(o.figureId)
      } else {
        db.prepare("UPDATE figures SET status = 'rejected', reason = ? WHERE id = ?").run(reasonFor(o.verdict), o.figureId)
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/**
 * Recomputes every verdict in a job from what its reviewer said, under the current rules
 * (after agrees() learns another fair way of writing an answer). Nothing is sent or paid
 * for. Returns how many verdicts changed.
 */
export function regrade(db: Store, job: string, writer?: string): number {
  const rows = db.prepare('SELECT figure_id AS id, model, detail FROM reviews WHERE job = ? ORDER BY figure_id')
    .all(job) as { id: string; model: string; detail: string }[]
  const questionsOf = db.prepare('SELECT n, kind, stem, options, answer, accepted, tolerance FROM figure_questions WHERE figure_id = ? AND (? IS NULL OR model = ?)')
  let changed = 0
  for (const r of rows) {
    const v = readJson<Verdict | null>(r.detail, null)
    if (!v?.questions) continue
    const qs = (questionsOf.all(r.id, writer ?? null, writer ?? null) as { n: number; kind: string; stem: string; options: string; answer: string; accepted: string; tolerance: number }[])
      .map((q) => ({ ...q, options: readJson<string[]>(q.options, []), accepted: readJson<string[]>(q.accepted, []), tolerance: Number(q.tolerance) || 0 }))
    const questions = v.questions.map((q) => {
      const asked = qs.find((x) => x.n === q.n)
      if (!asked) return q
      const keyCorrect = agrees(asked, q.ownAnswer)
      return { ...q, keyCorrect, singleAnswer: q.singleAnswer || hedgeInside(asked, keyCorrect) }
    })
    const pass = v.figureClear && v.educational && questions.every((q) => q.keyCorrect && q.answerable && q.singleAnswer)
    if (pass !== v.pass || questions.some((q, i) => q.keyCorrect !== v.questions[i].keyCorrect)) {
      // A writer's job judges that writer's questions, never the image itself.
      saveVerdict(db, { job, model: r.model, figureId: r.id, verdict: { ...v, questions, pass }, mark: !writer })
      changed++
    }
  }
  return changed
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

/**
 * Approves the drawn figures of every family that passes its blind review in this job (27 of 30):
 * all its figures not rejected, including those beyond the reviewed sample, since a family is
 * judged as a whole. P2 serves figures with status 'approved'.
 */
export function approveDrawn(db: Store, job: string): { approved: number; families: string[] } {
  const families = familyScores(db, job).filter((s) => s.passes).map((s) => s.family)
  const approve = db.prepare("UPDATE figures SET status = 'approved', reason = NULL WHERE origin = 'drawn' AND family = ? AND status <> 'rejected'")
  let approved = 0
  for (const family of families) approved += Number(approve.run(family).changes)
  return { approved, families }
}

/**
 * Passes whose reviewer still wrote a concern. The verdict stands, but a person reads
 * these before a family is approved: a reviewer has passed items it called ambiguous.
 */
export function notedPasses(db: Store, job: string): { figureId: string; notes: string }[] {
  const rows = db.prepare('SELECT figure_id AS id, detail FROM reviews WHERE job = ? AND pass = 1 ORDER BY figure_id')
    .all(job) as { id: string; detail: string }[]
  return rows.flatMap((r) => {
    const v = readJson<Partial<Verdict>>(r.detail, {})
    const notes = [...(v.problems ?? []), ...(v.questions ?? []).map((q) => q.problem)].filter(Boolean).join('; ')
    return notes ? [{ figureId: r.id, notes }] : []
  })
}

const IMAGE_TYPES: Record<string, ImageInput['mediaType']> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

/** The figure's image for a model, typed by its extension, or null when missing: then nothing is sent or paid for. */
export function previewImage(lib: string, item: Pick<ReviewItem, 'preview'>): ImageInput | null {
  if (!item.preview) return null
  const file = path.join(lib, item.preview)
  const mediaType = IMAGE_TYPES[path.extname(file).toLowerCase()]
  if (!mediaType || !fs.existsSync(file)) return null
  return { mediaType, data: fs.readFileSync(file).toString('base64') }
}

/** Questions in a job that pass on every count: the measure two writers are compared on (spec 5.5). */
export function cleanRate(db: Store, job: string): { figures: number; questions: number; clean: number; rate: number } {
  const rows = db.prepare('SELECT detail FROM reviews WHERE job = ?').all(job) as { detail: string }[]
  let questions = 0
  let clean = 0
  for (const r of rows) {
    const v = readJson<Partial<Verdict>>(r.detail, {})
    for (const q of v.questions ?? []) {
      questions++
      if (v.figureClear && v.educational && q.keyCorrect && q.answerable && q.singleAnswer) clean++
    }
  }
  return { figures: rows.length, questions, clean, rate: questions ? clean / questions : 0 }
}

/**
 * Approves real images for the library (spec 5.3: a figure is approved when it has at least one
 * kept question). Screened-in images with this writer's kept questions are approved, except:
 * questions the blind review failed are dropped (and recorded in question_checks), and an image the
 * reviewer judged unclear or not educational, or left with no question, is rejected. Images the
 * review did not sample are approved on the screen and the check alone. P2 publishes real figures
 * with status 'approved' and their figure_questions.
 */
export function approveReal(db: Store, o: { writer: string; job: string }): { approved: number; rejected: number; questionsDropped: number } {
  const figures = (db.prepare(`SELECT f.id FROM figures f JOIN screenings s ON s.figure_id = f.id AND s.keep = 1
    WHERE f.origin <> 'drawn' AND f.status <> 'rejected' AND EXISTS (SELECT 1 FROM figure_questions q WHERE q.figure_id = f.id AND q.model = ?)
    ORDER BY f.id`).all(o.writer) as { id: string }[]).map((r) => r.id)
  const review = db.prepare('SELECT detail FROM reviews WHERE job = ? AND figure_id = ?')
  const dropOne = db.prepare('DELETE FROM figure_questions WHERE figure_id = ? AND model = ? AND n = ?')
  const idOf = db.prepare('SELECT id FROM figure_questions WHERE figure_id = ? AND model = ? AND n = ?')
  const left = db.prepare('SELECT COUNT(*) AS n FROM figure_questions WHERE figure_id = ? AND model = ?')
  const record = db.prepare(`INSERT INTO question_checks (question_id, figure_id, writer, keep, reason, question, at)
    VALUES (?, ?, ?, 0, 'failed the blind review', '{}', ?)
    ON CONFLICT(question_id) DO UPDATE SET keep = 0, reason = excluded.reason, at = excluded.at`)
  const setStatus = db.prepare('UPDATE figures SET status = ?, reason = ? WHERE id = ?')
  const at = new Date().toISOString()
  let approved = 0
  let rejected = 0
  let questionsDropped = 0
  db.exec('BEGIN')
  try {
    for (const id of figures) {
      const row = review.get(o.job, id) as { detail: string } | undefined
      const v = row ? readJson<Partial<Verdict>>(row.detail, {}) : null
      const failing = !v ? [] : (v.figureClear && v.educational)
        ? (v.questions ?? []).filter((q) => !(q.keyCorrect && q.answerable && q.singleAnswer)).map((q) => q.n)
        : (db.prepare('SELECT n FROM figure_questions WHERE figure_id = ? AND model = ?').all(id, o.writer) as { n: number }[]).map((q) => q.n)
      for (const n of failing) {
        const q = idOf.get(id, o.writer, n) as { id: string } | undefined
        if (!q) continue
        record.run(q.id, id, o.writer, at)
        dropOne.run(id, o.writer, n)
        questionsDropped++
      }
      if (Number((left.get(id, o.writer) as { n: number }).n) > 0) {
        setStatus.run('approved', null, id)
        approved++
      } else {
        setStatus.run('rejected', 'failed the blind review', id)
        rejected++
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return { approved, rejected, questionsDropped }
}
