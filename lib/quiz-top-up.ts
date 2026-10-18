/**
 * Topping up a quiz that came back short, before the learner starts it.
 *
 * A quiz is written in ONE request of at most 30 seconds (Amplify's limit). Off the live logs, a
 * 40-question Primary Science quiz on three chapters wrote 50, lost 16 to duplicate checks and 2
 * to the checker, and was at 18 seconds with 32 -- no time for a second pass, so it shipped 32 of
 * 40. About one quiz in four came back short, nearly every 40-question one, and replays of that
 * quiz gave 29, 30 and 30. Asking the model differently moved the loss, it did not remove it.
 *
 * So the client asks again, for just the missing questions, in a follow-up request with 30
 * seconds of its own. The request carries the paper so far, so the route tells the model what is
 * already asked and leaves those figures out; the route appends what it writes to the quiz it
 * already saved and charges nothing for it.
 *
 * This module is both halves: `completeShortQuiz` for the forms, `parseTopUp` / `topUpAllowed`
 * for the route.
 */

/** Follow-up requests per quiz. The first usually fills it; the second takes what the first lost. */
export const TOP_UP_ROUNDS = 2
/** The most one follow-up asks for: about what one 30-second request can write and check. */
export const TOP_UP_MAX_MISSING = 25
/** No quiz grows past this, however it is asked. */
export const TOP_UP_MAX_TOTAL = 60
/** A follow-up belongs to a quiz just made, not to any old one. */
export const TOP_UP_WINDOW_MS = 30 * 60_000

type Question = { question?: unknown; image_url?: unknown; id?: unknown; [key: string]: unknown }
export type QuizData = { questions: Question[]; assessment_id?: unknown; [key: string]: unknown }

/** The route's own duplicate key: case, spacing and punctuation do not make a new question. */
export function stemKey(stem: unknown): string {
  return String(stem ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '').trim()
}

const questionsOf = (data: unknown): Question[] => {
  const qs = (data as QuizData | null)?.questions
  return Array.isArray(qs) ? qs.filter((q): q is Question => Boolean(q) && typeof q === 'object') : []
}

const imagesOf = (qs: Question[]): string[] =>
  [...new Set(qs.map((q) => String(q.image_url ?? '').trim()).filter(Boolean))]

/** The follow-up request for a short quiz, or null when there is nothing to ask for. */
export function topUpBody(payload: Record<string, any>, data: QuizData): (Record<string, any> & {
  count: number; topUp: { assessmentId: unknown; have: string[]; images: string[] }
}) | null {
  const questions = questionsOf(data)
  const missing = Math.floor(Number(payload?.count) || 0) - questions.length
  if (missing <= 0) return null
  // Saved, or the route has nothing to append to.
  const id = data?.assessment_id
  if (id === undefined || id === null || id === '' || id === 'auto') return null
  // A Checkpoint paper is built slot by slot to a mark scheme and fills itself.
  if (String(payload?.curriculum ?? '').toLowerCase() === 'checkpoint' || Array.isArray(payload?.paperSlots)) return null
  return {
    ...payload,
    count: Math.min(missing, TOP_UP_MAX_MISSING),
    topUp: {
      assessmentId: id,
      have: questions.map((q) => String(q.question ?? '').trim()).filter(Boolean),
      images: imagesOf(questions),
    },
  }
}

/** The quiz with the follow-up's questions appended: none already on the paper, numbered from 1. */
export function mergeTopUp(data: QuizData, extra: unknown): QuizData {
  const questions = questionsOf(data)
  const keys = new Set(questions.map((q) => stemKey(q.question)))
  const images = new Set(imagesOf(questions))
  const added: Question[] = []
  for (const q of Array.isArray(extra) ? extra : []) {
    if (!q || typeof q !== 'object') continue
    const key = stemKey((q as Question).question)
    const image = String((q as Question).image_url ?? '').trim()
    if (!key || keys.has(key) || (image && images.has(image))) continue
    keys.add(key)
    if (image) images.add(image)
    added.push(q as Question)
  }
  return { ...data, questions: [...questions, ...added].map((q, i) => ({ ...q, id: i + 1 })) }
}

type Post = (body: Record<string, any>, signal?: AbortSignal) => Promise<{ ok: boolean; data: any }>

const postToRoute: Post = async (body, signal) => {
  const res = await fetch('/api/generate-assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const text = await res.text()
  return { ok: res.ok, data: text ? JSON.parse(text) : null }
}

/**
 * The quiz, topped up to the count asked for where follow-up requests can do it.
 *
 * Never throws and never makes things worse: a failed or empty follow-up means the learner starts
 * with the questions already written, as before.
 */
export async function completeShortQuiz<T extends QuizData>(
  data: T,
  payload: Record<string, any>,
  options: { post?: Post; onTopUp?: (missing: number) => void; signal?: AbortSignal } = {},
): Promise<T> {
  const post = options.post ?? postToRoute
  let current: QuizData = data
  for (let round = 0; round < TOP_UP_ROUNDS; round++) {
    if (options.signal?.aborted) break
    const body = topUpBody(payload, current)
    if (!body) break
    options.onTopUp?.(body.count)
    let res: { ok: boolean; data: any }
    try {
      res = await post(body, options.signal)
    } catch {
      break
    }
    if (!res?.ok) break
    const merged = mergeTopUp(current, res.data?.questions)
    if (merged.questions.length <= current.questions.length) break
    current = merged
  }
  return current as T
}

export interface TopUp { assessmentId: string; have: string[]; images: string[] }

/** The route's reading of a follow-up request, or null for anything else. */
export function parseTopUp(raw: unknown): TopUp | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = r.assessmentId
  if (!(typeof id === 'string' || typeof id === 'number') || String(id).trim() === '') return null
  const strings = (v: unknown, max: number) =>
    (Array.isArray(v) ? v : []).filter((s): s is string => typeof s === 'string' && s.trim() !== '')
      .map((s) => s.trim().slice(0, 600)).slice(0, max)
  return { assessmentId: String(id).trim(), have: strings(r.have, TOP_UP_MAX_TOTAL), images: strings(r.images, TOP_UP_MAX_TOTAL) }
}

/**
 * May this follow-up add to that saved quiz?
 *
 * The same learner's (or, signed out, an unowned one), made in the last half hour, asking for no
 * more than one request writes, and leaving the quiz no longer than TOP_UP_MAX_TOTAL. That bounds
 * what a follow-up -- which skips the subscription count -- can ever write to one quiz's worth.
 */
export function topUpAllowed(
  row: { user_id?: unknown; created_at?: unknown; n?: unknown } | undefined | null,
  userId: string,
  missing: number,
  now = Date.now(),
): boolean {
  if (!row) return false
  const owner = String(row.user_id ?? '').trim()
  if (owner !== String(userId ?? '').trim()) return false
  const made = Date.parse(String(row.created_at ?? ''))
  if (!Number.isFinite(made) || now - made > TOP_UP_WINDOW_MS || made - now > 60_000) return false
  if (!(missing > 0) || missing > TOP_UP_MAX_MISSING) return false
  return (Number(row.n) || 0) + missing <= TOP_UP_MAX_TOTAL
}
