/**
 * Student-facing longform hints.
 *
 * Each hint sits next to one marking criterion: it names the *kind* of point
 * a marker wants (a reason, a named term, a piece of evidence) without
 * stating the mark itself or copying the model answer.
 */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'with', 'that', 'this', 'from', 'what',
  'which', 'when', 'how', 'why', 'who', 'into', 'onto', 'over', 'under',
  'about', 'their', 'there', 'these', 'those', 'will', 'would', 'should',
  'could', 'can', 'may', 'has', 'have', 'had', 'been', 'being', 'does',
  'did', 'not', 'all', 'any', 'each', 'its', 'his', 'her', 'they', 'them',
  'you', 'your', 'one', 'two', 'must', 'should', 'student', 'answer',
  'include', 'mention', 'using', 'used', 'use',
])

const MAX_HINT_CHARS = 180

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

/** A nudge that names the *shape* of the mark without the content. */
export function scaffoldHint(criterion: string): string {
  const c = String(criterion || '').toLowerCase()
  if (/quote|evidence|extract|passage|refer/.test(c)) {
    return 'Back this part with a short piece of evidence from the text — a phrase is enough, not a long quotation.'
  }
  if (/calculat|working|show your|formula|substitut/.test(c)) {
    return 'Show the method for this part, not only the final value.'
  }
  if (/compare|contrast|difference|similar/.test(c)) {
    return 'Make a clear comparison: what is alike or different, and in what way.'
  }
  if (/evaluat|judg|to what extent|weigh/.test(c)) {
    return 'Take a position and support it — a list of points with no judgement misses this mark.'
  }
  if (/explain|because|reason|why|account for/.test(c)) {
    return 'Give a reason here, not only a label — a marker wants to see why this is true.'
  }
  if (/defin|name|identif|state|term/.test(c)) {
    return 'A precise name or term is needed in this part — avoid a vague description.'
  }
  if (/describ|feature|characteristic/.test(c)) {
    return 'Describe a specific feature, not a general comment that could fit any example.'
  }
  if (/effect|impact|consequence|result/.test(c)) {
    return 'Say what follows from this — the effect, not only the fact itself.'
  }
  return 'Cover this part of the question in its own sentence so a marker can tick it separately.'
}

export function hintLeaksAnswer(
  hint: string,
  criterion: string,
  modelAnswer: string = '',
): boolean {
  const text = String(hint || '').trim()
  if (!text) return true
  if (text.length > MAX_HINT_CHARS) return true
  const lower = text.toLowerCase()
  const crit = String(criterion || '').trim()
  if (crit && lower === crit.toLowerCase()) return true
  if (tokenOverlapRatio(text, criterion) >= 0.55) return true
  if (modelAnswer && tokenOverlapRatio(text, modelAnswer) >= 0.4) return true
  const quoted = crit.match(/["'“”](.{8,80})["'“”]/)
  if (quoted?.[1] && lower.includes(quoted[1].toLowerCase())) return true
  return false
}

export function sanitizeHint(
  hint: string | undefined,
  criterion: string,
  modelAnswer: string = '',
): string {
  const raw = String(hint || '').replace(/\s+/g, ' ').trim()
  if (raw && !hintLeaksAnswer(raw, criterion, modelAnswer)) return raw
  return scaffoldHint(criterion)
}

export function alignLongformHints(
  criteria: unknown,
  hints: unknown,
  modelAnswer: string = '',
): string[] {
  const list = Array.isArray(criteria)
    ? criteria.map((c) => String(c ?? '').trim()).filter(Boolean)
    : []
  if (list.length === 0) return []
  const incoming = Array.isArray(hints) ? hints.map((h) => String(h ?? '').trim()) : []
  return list.map((criterion, i) => sanitizeHint(incoming[i], criterion, modelAnswer))
}

export function attachLongformHints<T extends Record<string, any>>(
  question: T,
): T & { hints?: string[] } {
  if (!question || question.type !== 'longform') return question
  const hints = alignLongformHints(
    question.marking_criteria,
    question.hints,
    String(question.model_answer ?? ''),
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

export function studentHintsOf(question: { type?: string; hints?: unknown } | null | undefined): string[] {
  if (!question || question.type !== 'longform') return []
  if (!Array.isArray(question.hints)) return []
  return question.hints.map((h) => String(h ?? '').trim()).filter(Boolean)
}
