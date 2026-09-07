/**
 * Student-facing longform hints.
 *
 * One clear, comprehensive hint per question — never one line per mark that
 * ends up repeating the stem. Built from what the question actually asks.
 */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'with', 'that', 'this', 'from', 'what',
  'which', 'when', 'how', 'why', 'who', 'into', 'onto', 'over', 'under',
  'about', 'their', 'there', 'these', 'those', 'will', 'would', 'should',
  'could', 'can', 'may', 'has', 'have', 'had', 'been', 'being', 'does',
  'did', 'not', 'all', 'any', 'each', 'its', 'his', 'her', 'they', 'them',
  'you', 'your', 'one', 'two', 'must', 'student', 'answer', 'include',
  'mention', 'using', 'used', 'use', 'mark', 'marks', 'point', 'points',
  'provide', 'consider', 'analyse', 'analyze', 'explain', 'describe',
])

const MAX_HINT_CHARS = 320

export function hintTokens(value: string): string[] {
  return (String(value || '').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length > 3 && !STOPWORDS.has(w),
  )
}

export function tokenOverlapRatio(source: string, against: string): number {
  const a = hintTokens(source)
  if (a.length === 0) return 0
  const b = new Set(hintTokens(against))
  let hit = 0
  for (const t of a) if (b.has(t)) hit += 1
  return hit / a.length
}

/** True if the hint restates a criterion or the model answer too closely. */
export function hintLeaksAnswer(
  hint: string,
  criteria: string[] | string = [],
  modelAnswer: string = '',
): boolean {
  const text = String(hint || '').trim()
  if (!text) return true
  if (text.length > MAX_HINT_CHARS) return true

  const list = Array.isArray(criteria)
    ? criteria.map((c) => String(c ?? '').trim()).filter(Boolean)
    : [String(criteria || '').trim()].filter(Boolean)

  const lower = text.toLowerCase()
  for (const crit of list) {
    if (lower === crit.toLowerCase()) return true
    if (tokenOverlapRatio(text, crit) >= 0.55) return true
    const quoted = crit.match(/["'“”](.{8,80})["'“”]/)
    if (quoted?.[1] && lower.includes(quoted[1].toLowerCase())) return true
  }
  if (modelAnswer && tokenOverlapRatio(text, modelAnswer) >= 0.4) return true
  return false
}

function cleanText(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function finalize(text: string): string {
  let t = cleanText(text)
  if (!t) return ''
  t = t.charAt(0).toUpperCase() + t.slice(1)
  if (!/[.?!]$/.test(t)) t += '.'
  if (t.length > MAX_HINT_CHARS) {
    const cut = t.slice(0, MAX_HINT_CHARS - 1)
    const at = cut.lastIndexOf(' ')
    t = `${(at > 80 ? cut.slice(0, at) : cut).trim()}…`
  }
  return t
}

/** Split a multi-part stem into labelled slices, if any. */
export function labelledParts(question: string): string[] {
  const q = cleanText(question)
  if (!q) return []

  const labelRe = /\(([a-d]|[ivx]+)\)/gi
  const starts: number[] = []
  let match: RegExpExecArray | null
  while ((match = labelRe.exec(q)) !== null) starts.push(match.index)

  if (starts.length < 2) return []

  return starts.map((from, i) => {
    const to = i + 1 < starts.length ? starts[i + 1] : q.length
    return cleanText(q.slice(from, to).replace(/^\([a-d]|[ivx]+\)\s*/i, ''))
  }).filter(Boolean)
}

/** Break the stem into the main demands the student must cover. */
export function questionDemands(question: string): string[] {
  const parts = labelledParts(question)
  if (parts.length >= 2) return parts

  const q = cleanText(question)
  if (!q) return []

  // Split on sentence ends or "Provide/Consider/Include" follow-ons.
  const chunks = q
    .split(/(?<=[.!?])\s+|(?=\b(?:Provide|Consider|Include|Give|Discuss)\b)/i)
    .map((c) => cleanText(c.replace(/^[(\[]?[a-zivx0-9]{1,4}[)\].:]\s*/i, '')))
    .filter((c) => c.length > 8)

  if (chunks.length >= 2) return chunks
  return [q]
}

/**
 * Soften rubric lines into coverage cues (answer-only words removed).
 * Used only to remind students what *kinds* of points to hit.
 */
function coverageCues(
  criteria: string[],
  question: string,
  modelAnswer: string,
): string[] {
  const qTokens = new Set(hintTokens(question))
  const answerOnly = new Set(
    hintTokens(modelAnswer).filter((t) => !qTokens.has(t)),
  )

  return criteria
    .map((raw) => {
      const words = String(raw || '').split(/\s+/).filter(Boolean)
      const kept = words.filter((w) => {
        const t = w.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (!t || t.length <= 3) return true
        if (STOPWORDS.has(t)) return true
        if (answerOnly.has(t)) return false
        return true
      })
      let line = cleanText(kept.join(' '))
        .replace(/^(states?|explains?|identifies?|describes?|uses?|gives?|names?|shows?)\s+/i, '')
      if (line.length < 8 || line.length > 90) return ''
      if (tokenOverlapRatio(line, modelAnswer) >= 0.45) return ''
      return line
    })
    .filter(Boolean)
    .slice(0, 3)
}

function pickBestIncomingHint(
  incoming: string[],
  criteria: string[],
  modelAnswer: string,
  question: string,
): string {
  const unique: string[] = []
  for (const raw of incoming) {
    const h = cleanText(raw)
    if (!h) continue
    if (hintLeaksAnswer(h, criteria, modelAnswer)) continue
    // Skip near-copies of the question stem (the duplicate problem).
    if (tokenOverlapRatio(h, question) >= 0.75) continue
    const isDup = unique.some(
      (u) => tokenOverlapRatio(h, u) >= 0.7 || h.toLowerCase() === u.toLowerCase(),
    )
    if (!isDup) unique.push(h)
  }
  if (unique.length === 0) return ''
  // Prefer the longest useful unique hint.
  return unique.sort((a, b) => b.length - a.length)[0]
}

/**
 * One comprehensive hint for the whole question.
 * Prefer a good AI/teacher hint; otherwise synthesise from the question's demands.
 */
export function buildLongformHint(
  question: string,
  criteria: unknown,
  modelAnswer: string = '',
  incomingHints: unknown = [],
): string {
  const q = cleanText(question)
  const list = Array.isArray(criteria)
    ? criteria.map((c) => String(c ?? '').trim()).filter(Boolean)
    : []
  const incoming = Array.isArray(incomingHints)
    ? incomingHints.map((h) => String(h ?? '').trim()).filter(Boolean)
    : []

  const fromIncoming = pickBestIncomingHint(incoming, list, modelAnswer, q)
  if (fromIncoming) return finalize(fromIncoming)

  const demands = questionDemands(q)
  const cues = coverageCues(list, q, modelAnswer)

  let hint = ''
  if (demands.length >= 2) {
    const a = demands[0].replace(/[.?!]$/, '')
    const b = demands[1].replace(/[.?!]$/, '')
    hint = `Structure your answer around both demands: ${a}; then ${b}`
  } else if (demands.length === 1) {
    const demand = demands[0].replace(/[.?!]$/, '')
    hint = `Stay focused on this: ${demand} — develop the idea fully rather than listing short points`
  }

  if (cues.length > 0) {
    const cueText = cues.join('; ')
    hint = hint
      ? `${hint}. Make sure you also cover: ${cueText}`
      : `Cover these angles in your answer: ${cueText}`
  }

  if (!hint && q) {
    hint = `Re-read the question carefully and answer every part of it in linked sentences`
  }

  const candidate = finalize(hint)
  if (candidate && !hintLeaksAnswer(candidate, list, modelAnswer)) return candidate

  // Fallback that never copies the stem or the mark scheme.
  return finalize(
    demands.length >= 2
      ? 'Answer every labelled part of the question, and link your points so a marker can follow the full argument'
      : 'Address the full question in a clear chain of reasoning — not a single short statement',
  )
}

/** @deprecated Prefer buildLongformHint — kept for tests that check leak logic. */
export function hintFromQuestion(
  question: string,
  criterion: string,
  opts: { modelAnswer?: string } = {},
): string {
  return buildLongformHint(question, [criterion], opts.modelAnswer ?? '', [])
}

export function alignLongformHints(
  criteria: unknown,
  hints: unknown,
  modelAnswer: string = '',
  question: string = '',
): string[] {
  const hint = buildLongformHint(question, criteria, modelAnswer, hints)
  return hint ? [hint] : []
}

export function attachLongformHints<T extends Record<string, any>>(
  question: T,
): T & { hints?: string[] } {
  if (!question || question.type !== 'longform') return question
  const hints = alignLongformHints(
    question.marking_criteria,
    question.hints,
    String(question.model_answer ?? ''),
    String(question.question ?? ''),
  )
  return { ...question, hints }
}

export function stripLongformHints<T extends Record<string, any>>(question: T): T {
  if (!question || typeof question !== 'object') return question
  const { hints: _hints, ...rest } = question
  return rest as T
}

export function prepareLongformQuestionsForStudent<T extends Record<string, any>>(
  questions: T[],
  includeHints: boolean,
): T[] {
  if (!Array.isArray(questions)) return []
  return questions.map((q) => {
    if (q?.type !== 'longform') return q
    return includeHints ? attachLongformHints(q) : stripLongformHints(q)
  })
}

/** Always 0 or 1 hint for the student UI. */
export function studentHintsOf(
  question: { type?: string; hints?: unknown } | null | undefined,
): string[] {
  if (!question || question.type !== 'longform') return []
  if (!Array.isArray(question.hints)) return []
  const first = question.hints.map((h) => String(h ?? '').trim()).find(Boolean)
  return first ? [first] : []
}
