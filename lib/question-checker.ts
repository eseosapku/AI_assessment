/**
 * A second pair of eyes on every question, before a learner sees it.
 *
 * Ten papers were reviewed question by question on 2026-10-01: answers checked
 * against the reading text, every sum worked, every figure read. Only about a
 * third of the questions came through clean, on Nova Lite and on Nova Pro
 * alike. Most of what was wrong was not something a rule can see -- a mean of
 * 25, 15, 30 and 10 keyed as 12.5; "the phase before a full moon" keyed
 * "waning gibbous"; "Name one force acting on the bicycle" accepting only two
 * of the five right answers -- and all of it was obvious to a careful reader.
 *
 * So a careful reader checks. The generator is unchanged; this reads what it
 * wrote, mends the answer key or mark scheme where the question is sound and
 * only its answer is wrong, and removes the question where the question itself
 * is broken -- the route's top-up passes then write a replacement, which is
 * checked in turn. It never rewrites a question: a checker that writes
 * questions is a second generator with nobody checking it.
 *
 * Everything here is pure; the model call is the caller's.
 */

export interface CheckContext {
  subject: string
  /** "Primary Stage 6" or "Lower Secondary Stage 9". */
  stage: string
  /** The reading text every question on the paper is set on, if any. */
  passage?: string
  /** One line per OTHER question on the paper, for spotting repeats. */
  others: string[]
}

export interface Verdict {
  id: number
  verdict: 'ok' | 'fix' | 'drop'
  why?: string
  /** Every answer a marker should accept, for a one-word/one-number answer. */
  accepted?: string[]
  /** The 0-based index of the one correct option of a ring-around. */
  correct_option?: number
  /** The 0-based indices of every true statement of a tick list. */
  correct_options?: number[]
  /** For a table: the heading of the right column, for each row in order. */
  correct_columns?: string[]
  /** A replacement mark scheme with exactly one point per mark. */
  mark_scheme?: string[]
  /** A corrected explanation, when the shown one contradicts the answer. */
  explanation?: string
}

type Q = Record<string, any>

const RUBRIC = `You are checking questions an AI wrote for a Cambridge Checkpoint practice paper, before a learner sees them. Be a strict, careful examiner. Work out every answer yourself -- do the arithmetic, check the science, find the answer in the reading text, read the figure data. Never trust the key you are shown.

A figure is described to you as FIGURE DATA (its exact numbers and labels), a list of the text drawn on it, or a description. Use only that. NEVER guess or invent what a figure shows: if a question's answer depends on values you were not given, judge only what you can see, and do not "work out" an answer from imagined values.

For each question give ONE verdict:

"ok"   -- the question is answerable from what the learner is shown, sensible for the stage, and its key/mark scheme is right.

"fix"  -- the QUESTION is sound but its answer is wrong or too narrow. Give the corrected field(s) only:
          "accepted": every answer a fair marker would accept (include common correct alternatives, singular/plural, with/without units) -- for a one-word or one-number answer
          "correct_option": 0-based index of the one right option -- for a ring-around (mcq)
          "correct_options": 0-based indices of ALL true statements -- for a tick list
          "correct_columns": the column heading for each row, in order -- for a table
          "mark_scheme": one creditable point per step the answer needs -- at least as many points as the scheme shown
          "explanation": a corrected explanation, when the one shown contradicts the right answer (the learner reads it after answering)
          If an open question ("name one...", "give a reason...") has more right answers than a key can list, prefer "drop".

"drop" -- the QUESTION itself is broken. Drop it when ANY of these is true:
          - it needs something the learner cannot see or is not told (a figure, table, text, earlier part or data that is not there; a figure that does not show what it asks about)
          - it gives the answer away (the answer is in the question, its scenario, or printed on the figure)
          - it is beyond the stage (Primary Stage 6 is about age 11, Lower Secondary Stage 9 about age 14)
          - it is not a question for this subject, or a comprehension question about something the text does not contain, or about the wrong paragraph
          - it repeats a question listed under OTHER QUESTIONS, or an earlier one in this batch (same demand, however worded)
          - it is garbled, ungrammatical, cut off, uses American spelling, or contains instructions meant for the writer
          - a ring-around has two right options, or none

Return ONLY a JSON array, one object per question, in order. "id" is the question's number as a plain number (Q3 -> 3):
[{"id": <number>, "work": "<your own working or check, under 25 words>", "verdict": "ok"|"fix"|"drop", "why": "<under 20 words, for fix or drop>", ...fix fields}]`

const letter = (i: number) => String.fromCharCode(65 + i)

function describeFigure(q: Q): string[] {
  const lines: string[] = []
  if (q.figure_spec) lines.push(`FIGURE DATA (what the drawing shows): ${JSON.stringify(q.figure_spec).slice(0, 1200)}`)
  else if (typeof q.diagram_svg === 'string') {
    const text = [...q.diagram_svg.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1].trim()).filter(Boolean)
    lines.push(`FIGURE (drawn; the only text on it): ${JSON.stringify(text.slice(0, 40))}`)
  }
  if (q.figure_description) lines.push(`FIGURE (picture; what it shows): ${String(q.figure_description).slice(0, 900)}`)
  else if (q.image_url && !q.figure_spec) lines.push('FIGURE: a picture is shown, but nothing is known about what it shows.')
  return lines
}

function describe(q: Q): string {
  const kind = q.type === 'interactive' ? q.kind : q.type
  // No marks: before seating they are a slot's by POSITION, and the checker
  // dropped "a two-word answer worth 25 marks" that seating would have made
  // worth one. Seating owns marks.
  const out = [`--- Q${q.id} ${kind}`]
  if (q.scenario) out.push(`SCENARIO: ${q.scenario}`)
  out.push(`QUESTION: ${q.question}`)
  out.push(...describeFigure(q))
  if (Array.isArray(q.options)) {
    const right = new Set(Array.isArray(q.correct_indices) ? q.correct_indices : [q.correct_answer])
    q.options.forEach((o: unknown, i: number) => out.push(`   ${right.has(i) ? '*' : ' '} ${letter(i)}. ${o}`))
  }
  if (Array.isArray(q.items)) {
    out.push(`COLUMNS: ${JSON.stringify(q.categories ?? [])}`)
    q.items.forEach((it: unknown, i: number) => out.push(`   row "${it}" -> ${q.categories?.[q.correct_category?.[i]] ?? '?'}`))
  }
  if (q.short_answer) out.push(`ANSWER KEY: ${JSON.stringify(q.short_answer.accepted ?? [])}`)
  if (Array.isArray(q.marking_criteria) && q.marking_criteria.length) {
    out.push(`MARK SCHEME: ${q.marking_criteria.map((c: unknown, i: number) => `(${i + 1}) ${c}`).join(' ')}`)
  }
  if (q.explanation) out.push(`EXPLANATION (shown to the learner afterwards): ${String(q.explanation).slice(0, 400)}`)
  return out.join('\n')
}

export function buildCheckPrompt(questions: readonly Q[], ctx: CheckContext): string {
  return [
    RUBRIC,
    '',
    `PAPER: ${ctx.subject}, ${ctx.stage}.`,
    ...(ctx.passage
      ? ['', 'READING TEXT (shown above every question; paragraphs lettered A, B, C... in order):', '"""', ctx.passage.trim(), '"""']
      : []),
    ...(ctx.others.length ? ['', 'OTHER QUESTIONS ON THIS PAPER (for spotting repeats only):', ...ctx.others] : []),
    '',
    'QUESTIONS TO CHECK:',
    ...questions.map(describe),
  ].join('\n')
}

/** The verdict array out of a reply, tolerating prose and code fences around it. */
export function parseVerdicts(reply: unknown): Verdict[] {
  const text = String(reply ?? '')
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    // "Q1" as well as 1: the questions are shown as "--- Q1", and the model
    // copies the label. Read as a bare number, every verdict was discarded.
    const idOf = (x: unknown) => Number(String(x ?? '').replace(/^\s*q/i, ''))
    return parsed.filter((v): v is Verdict =>
      v && typeof v === 'object' && Number.isFinite(idOf(v.id)) && ['ok', 'fix', 'drop'].includes(v.verdict))
      .map((v) => ({ ...v, id: idOf(v.id) }))
  } catch {
    return []
  }
}

const strings = (x: unknown): string[] | null =>
  Array.isArray(x) && x.length > 0 && x.every((s) => typeof s === 'string' && s.trim()) ? x.map((s: string) => s.trim()) : null

/**
 * Apply one fix. Returns false when the fix cannot be applied safely -- a
 * column that does not exist, an option out of range, a mark scheme still
 * short of the marks -- and the question is then dropped: a checker that
 * says "wrong" and cannot say what is right has still said "wrong".
 */
function applyFix(q: Q, v: Verdict): boolean {
  let applied = false
  const accepted = strings(v.accepted)
  if (accepted) {
    if (!q.short_answer) return false
    q.short_answer = { ...q.short_answer, accepted }
    applied = true
  }
  if (v.correct_option !== undefined) {
    const i = Number(v.correct_option)
    if (q.type !== 'mcq' || !Array.isArray(q.options) || !Number.isInteger(i) || i < 0 || i >= q.options.length) return false
    q.correct_answer = i
    applied = true
  }
  if (v.correct_options !== undefined) {
    const idx = Array.isArray(v.correct_options) ? v.correct_options.map(Number) : []
    if (!Array.isArray(q.options) || idx.length === 0 || idx.some((i) => !Number.isInteger(i) || i < 0 || i >= q.options.length)) return false
    q.correct_indices = [...new Set(idx)].sort((a, b) => a - b)
    applied = true
  }
  if (v.correct_columns !== undefined) {
    const cols = strings(v.correct_columns)
    const cats: string[] = Array.isArray(q.categories) ? q.categories.map(String) : []
    if (!cols || !Array.isArray(q.items) || cols.length !== q.items.length) return false
    const idx = cols.map((c) => cats.findIndex((cat) => cat.trim().toLowerCase() === c.toLowerCase()))
    if (idx.some((i) => i < 0)) return false
    q.correct_category = idx
    applied = true
  }
  if (v.mark_scheme !== undefined) {
    const scheme = strings(v.mark_scheme)
    const before = Array.isArray(q.marking_criteria) ? q.marking_criteria.length : 0
    // Fewer points than it replaces is not a mend: marks would be lost.
    if (!scheme || scheme.length < Math.max(1, before)) return false
    q.marking_criteria = scheme
    applied = true
  }
  if (typeof v.explanation === 'string' && v.explanation.trim()) {
    q.explanation = v.explanation.trim()
    applied = true
  }
  return applied
}

export function applyVerdicts<T extends Q>(questions: readonly T[], verdicts: readonly Verdict[]): {
  kept: T[]
  dropped: { id: number; why: string }[]
  fixed: number
} {
  const byId = new Map(verdicts.map((v) => [v.id, v]))
  const kept: T[] = []
  const dropped: { id: number; why: string }[] = []
  let fixed = 0
  for (const q of questions) {
    const v = byId.get(Number(q.id))
    if (!v) {
      kept.push(q)
      continue
    }
    if (v.verdict === 'drop') {
      dropped.push({ id: Number(q.id), why: String(v.why ?? '').slice(0, 160) })
      continue
    }
    if (v.verdict === 'fix') {
      if (!applyFix(q, v)) {
        dropped.push({ id: Number(q.id), why: `unfixable: ${String(v.why ?? '').slice(0, 140)}` })
        continue
      }
      fixed++
    }
    ;(q as Q).checked = true
    kept.push(q)
  }
  return { kept, dropped, fixed }
}

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** One line per question, for the repeats list another batch is shown. */
export function oneLine(q: Q): string {
  const answer = q.short_answer?.accepted?.[0]
  return `Q${q.id}: ${String(q.question ?? '').slice(0, 140)}${answer ? `  [answer: ${String(answer).slice(0, 40)}]` : ''}`
}
