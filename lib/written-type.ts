/**
 * A written answer that came back under another name.
 *
 * The prompt calls a one-word item "A SHORT ANSWER" and asks for a
 * "short_answer" key, and the model sometimes writes "type": "short" to match.
 * Everything downstream knows two written types -- "longform" and nothing
 * else -- so the route's type filter deleted it as "invalid question type":
 * four good, keyed questions off one English paper, which then came back
 * short. The key or the mark scheme says what it is; the label is just a
 * label.
 */
const WRITTEN_ALIASES = new Set([
  'short', 'short_answer', 'short-answer', 'shortanswer', 'written', 'open',
  'open_ended', 'text', 'essay', 'composition', 'extended', 'structured',
  'long', 'long_answer', 'justify',
])

/** Rename a keyed or marked written answer to "longform", in place. */
export function normaliseWrittenType(q: unknown): void {
  if (!q || typeof q !== 'object') return
  const o = q as Record<string, unknown>
  const type = String(o.type ?? '').toLowerCase().trim()
  if (!WRITTEN_ALIASES.has(type)) return
  const keyed = Boolean(o.short_answer)
  const marked = Array.isArray(o.marking_criteria) && o.marking_criteria.length > 0
  if (keyed || marked) o.type = 'longform'
}
