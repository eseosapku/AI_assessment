// lib/studylab/mermaid.ts

/**
 * Makes the tutor's Mermaid safe to render.
 *
 * The prompt asks for simple syntax and no parentheses inside labels. The model
 * writes `C[Water (Roots)]` anyway, which Mermaid cannot parse — and a diagram
 * that fails to parse renders as "Diagram unavailable", so the card the chat
 * just pointed at is empty.
 *
 * Quoting the label is what Mermaid itself prescribes for a label containing
 * its own delimiters, so the fix keeps the words the tutor chose rather than
 * stripping them.
 *
 * Applied at render time, not when the card is written, so diagrams already
 * saved on a board start working too.
 */

/** Characters that end a label early, or confuse the parser inside one. */
const NEEDS_QUOTING = /[()[\]{}"<>]/

const CLOSERS: Record<string, string> = { '[': ']', '(': ')', '{': '}' }

/**
 * Wraps a label in quotes when it contains something the parser would trip on.
 *
 * A label that is already quoted is left alone. Internal double quotes are
 * dropped rather than escaped: Mermaid has no escape inside a quoted label, so
 * a stray quote would break it a second way.
 */
function quoteLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return label
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return label
  if (!NEEDS_QUOTING.test(trimmed)) return label
  return `"${trimmed.replace(/"/g, '')}"`
}

/**
 * Strips the wrappers the model puts around a diagram, and quotes its labels.
 *
 * Labels are found by scanning rather than by regex: a label runs from the
 * bracket that follows a node id to the first matching closer, and a regex that
 * tries to express that either stops at the wrong bracket or backtracks
 * catastrophically on a long diagram.
 */
export function sanitiseMermaid(raw: string): string {
  const src = (raw ?? '')
    // Code fences, and the stray "mermaid" line that sometimes follows them.
    .replace(/^\s*```(?:mermaid)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^\s*mermaid\s*\n/i, '')
    .trim()

  if (!src) return ''

  let out = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    const closer = CLOSERS[ch]

    // A bracket only opens a label when it directly follows a node id.
    const opensLabel = closer !== undefined && /[A-Za-z0-9_\])}]/.test(src[i - 1] ?? '')
    if (!opensLabel) {
      out += ch
      i += 1
      continue
    }

    const end = src.indexOf(closer, i + 1)
    if (end === -1) {
      // Unbalanced: nothing sensible to do but leave the rest as it stands.
      out += src.slice(i)
      break
    }

    out += ch + quoteLabel(src.slice(i + 1, end)) + closer
    i = end + 1
  }

  return out
}

/**
 * A markdown image the model sometimes puts in the mermaid field instead of a
 * diagram. Returns the URL, or null when the content really is a diagram.
 */
export function mermaidImageUrl(src: string): string | null {
  const m = src.match(/^!\[[^\]]*\]\((https?:\/\/[^)]+)\)$/)
  return m ? m[1] : null
}
