// scripts/figure-library/write.ts
import type { Store } from './store'
import { LEVELS } from './review'

export interface WriteItem { figureId: string; subject: string; band: string; topic: string; shows: string; image: string }
export interface Written { kind: 'mcq' | 'short'; stem: string; options: string[]; answer: string; accepted: string[]; explanation: string }
export interface Check { keep: boolean; reason: string }

export const writerTag = (model: string) => (/sonnet/.test(model) ? 'sonnet' : /haiku/.test(model) ? 'haiku' : 'model')

const letter = (i: number) => String.fromCharCode(65 + i)

/** The house rules from the vetted-question pipeline, for a real image (spec 5.3 step 5). */
export function writePrompt(item: WriteItem): string {
  return [
    `Write up to three questions for a ${item.subject} quiz, answered by a learner at ${LEVELS[item.band] ?? item.band}.`,
    `Topic: ${item.topic}.`,
    `The image is attached. It shows: ${item.shows}`,
    '',
    'Rules:',
    `- Each question is about something the image shows, and is answered by looking at it and knowing the ${item.subject} of this topic at this level.`,
    '- Ask what a learner would be asked: what it is, what a part is or does, what process or idea it shows, what would happen, or what can be seen or read in it. Never trivia (counting things, colours for their own sake), and never something only an expert could tell from this image.',
    '- A word printed on the image is never the answer.',
    '- Multiple choice: four options, exactly one right, the wrong ones plausible to a learner. Give "answer" as the index of the right option.',
    '- Short answer: one word, a number or a short phrase of at most four words, with every fair way of writing it in "accepted".',
    '- Begin with one short sentence that sets it up, such as "Look at the photograph." Keep each question under 30 words.',
    '- Fewer good questions are better than three weak ones. If the image cannot carry a good question on this topic, return {"questions": []}.',
    '',
    'Return JSON only, shaped like this:',
    '{"questions":[{"kind":"mcq","stem":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."},{"kind":"short","stem":"...","answer":"...","accepted":["..."],"explanation":"..."}]}',
  ].join('\n')
}

/** A seeded order, so the right option lands anywhere but always in the same place for the same question. */
function shuffled<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261
  for (let k = 0; k < seed.length; k++) h = Math.imul(h ^ seed.charCodeAt(k), 16777619) >>> 0
  const next = () => {
    h = (h + 0x6d2b79f5) >>> 0
    let t = Math.imul(h ^ (h >>> 15), h | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The writer's reply, checked in code: at most three questions, each well formed, or refused with a reason. */
export function parseWritten(raw: unknown, seed: string): { questions: Written[]; refused: string[] } {
  const list = raw && typeof raw === 'object' ? (raw as { questions?: unknown }).questions : undefined
  if (!Array.isArray(list)) throw new Error('The reply has no questions list')
  const questions: Written[] = []
  const refused: string[] = []
  list.slice(0, 3).forEach((q, i) => {
    const r = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>
    const stem = String(r.stem ?? '').trim()
    const explanation = String(r.explanation ?? '').trim()
    if (!stem || stem.length > 300) {
      refused.push(`Q${i + 1}: no stem, or one too long`)
    } else if (r.kind === 'mcq') {
      const options = Array.isArray(r.options) ? r.options.map((o) => String(o).trim()) : []
      const answer = Number(r.answer)
      if (options.length !== 4 || options.some((o) => !o) || new Set(options.map((o) => o.toLowerCase())).size !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) {
        refused.push(`Q${i + 1}: needs four different options and the index of the right one`)
      } else {
        const order = shuffled([0, 1, 2, 3], `${seed}#${i}`)
        questions.push({ kind: 'mcq', stem, options: order.map((k) => options[k]), answer: String(order.indexOf(answer)), accepted: [], explanation })
      }
    } else if (r.kind === 'short') {
      const answer = String(r.answer ?? '').trim()
      if (!answer || answer.length > 40 || answer.split(/\s+/).length > 4) {
        refused.push(`Q${i + 1}: a short answer must be at most four words`)
      } else {
        const forms = [answer, ...(Array.isArray(r.accepted) ? r.accepted.map((a) => String(a).trim()) : [])]
        questions.push({ kind: 'short', stem, options: [], answer, accepted: forms.filter((a, k) => a && forms.indexOf(a) === k), explanation })
      }
    } else {
      refused.push(`Q${i + 1}: kind must be mcq or short`)
    }
  })
  return { questions, refused }
}

/** The strict check, a separate call by the same model, which sees each key (spec 5.3 step 6). */
export function checkPrompt(item: WriteItem, questions: Written[]): string {
  const list = questions.map((q, i) => q.kind === 'mcq'
    ? `${i + 1}. [multiple choice] ${q.stem}\n${q.options.map((o, k) => `   ${letter(k)}) ${o}`).join('\n')}\n   Key: ${letter(Number(q.answer))}`
    : `${i + 1}. [short answer] ${q.stem}\n   Key: ${q.answer}${q.accepted.length > 1 ? ` (also accepted: ${q.accepted.slice(1).join('; ')})` : ''}`,
  ).join('\n\n')
  return [
    `You are a strict checker for a ${item.subject} quiz at ${LEVELS[item.band] ?? item.band}, on the topic "${item.topic}". The image is attached.`,
    'Keep a question only if all of these hold:',
    '- the image clearly shows what the question needs, and a learner at this level could answer from the image and their knowledge;',
    '- the key is right, and for multiple choice no other option is also right;',
    '- it is about this topic, it is not trivia, and its answer is not a word printed on the image.',
    'Otherwise drop it, and say why in a few words.',
    '',
    list,
    '',
    'Reply with JSON only: {"verdicts":[{"n":1,"keep":true,"reason":""}]}',
  ].join('\n')
}

/** A verdict for every question, or the check is refused: a missing verdict is never read as a keep. */
export function parseChecked(raw: unknown, count: number): Check[] {
  const list = raw && typeof raw === 'object' ? (raw as { verdicts?: unknown }).verdicts : undefined
  if (!Array.isArray(list)) throw new Error('The check has no verdicts list')
  return Array.from({ length: count }, (_, i) => {
    const v = (list as Record<string, unknown>[]).find((x) => x && Number(x.n) === i + 1)
    if (!v || typeof v.keep !== 'boolean') throw new Error(`The check does not judge question ${i + 1}`)
    return { keep: v.keep, reason: String(v.reason ?? '') }
  })
}

/** Screened-kept images this writer has not written for yet. */
export function toWrite(db: Store, o: { writer: string; figureIds?: readonly string[]; limit?: number }): WriteItem[] {
  const rows = db.prepare(`SELECT f.id, f.subject, f.band, f.asset, s.shows, MIN(t.name) AS topic FROM figures f
    JOIN screenings s ON s.figure_id = f.id AND s.keep = 1
    JOIN figure_topics ft ON ft.figure_id = f.id JOIN topics t ON t.key = ft.topic_key
    WHERE f.id NOT IN (SELECT figure_id FROM question_checks WHERE writer = ?)
    GROUP BY f.id ORDER BY f.id`).all(o.writer) as { id: string; subject: string; band: string; asset: string; shows: string; topic: string }[]
  const wanted = o.figureIds ? new Set(o.figureIds) : null
  return rows.filter((r) => !wanted || wanted.has(r.id)).slice(0, o.limit ?? rows.length)
    .map((r) => ({ figureId: r.id, subject: r.subject, band: r.band, topic: r.topic, shows: r.shows, image: r.asset }))
}

/** Saves one image's questions: kept ones into figure_questions, every one (or the lack of one) into question_checks. */
export function saveWritten(db: Store, o: { figureId: string; writer: string; band: string; questions: Written[]; checks: Check[]; refused?: string[] }): number {
  const tag = writerTag(o.writer)
  const at = new Date().toISOString()
  let kept = 0
  db.exec('BEGIN')
  try {
    const check = db.prepare(`INSERT INTO question_checks (question_id, figure_id, writer, keep, reason, question, at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(question_id) DO UPDATE SET keep = excluded.keep, reason = excluded.reason, question = excluded.question, at = excluded.at`)
    const put = db.prepare(`INSERT INTO figure_questions (id, figure_id, n, band, kind, stem, options, answer, accepted, explanation, model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    db.prepare('DELETE FROM figure_questions WHERE figure_id = ? AND model = ?').run(o.figureId, o.writer)
    if (!o.questions.length) {
      check.run(`${o.figureId}#${tag}#0`, o.figureId, o.writer, 0, (o.refused ?? []).join('; ') || 'no question written', '{}', at)
    }
    o.questions.forEach((q, i) => {
      const id = `${o.figureId}#${tag}#${i + 1}`
      const c = o.checks[i] ?? { keep: false, reason: 'not checked' }
      check.run(id, o.figureId, o.writer, c.keep ? 1 : 0, c.reason, JSON.stringify(q), at)
      if (c.keep) put.run(id, o.figureId, ++kept, o.band, q.kind, q.stem, JSON.stringify(q.options), q.answer, JSON.stringify(q.accepted), q.explanation, o.writer)
    })
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return kept
}
