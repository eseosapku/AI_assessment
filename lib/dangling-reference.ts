/**
 * Questions that point at something that is not there.
 *
 * Observed live on ICT: *"Consider the following code snippet. What will be the
 * output after the loop completes?"* — with no snippet anywhere in the
 * question. Also *"In the following code, what will be the value of 'total'?"*,
 * again with no code. The paper is unanswerable and nothing in the pipeline
 * noticed, because every other check looks at the options rather than at
 * whether the stem's promise is kept.
 *
 * The same shape shows up as "the diagram above" with no figure attached and
 * "the table below" with no table. One rule covers all of them: if a stem
 * promises attached content, that content has to be in the stem, in the
 * passage, or in an attached image.
 *
 * A stem can also point outside the screen entirely — "the diagram on page
 * 286", "described in Unit 9" — which is the same fault reached by a different
 * road. That one is `book-reference.ts`, because it can often be repaired
 * rather than dropped; what it could not repair arrives here as 'source'.
 */
import { bookReference } from './book-reference'

export interface ReferencingQuestion {
  question?: unknown
  passage?: unknown
  image_url?: unknown
  diagram_svg?: unknown
  options?: unknown
}

/** What a stem can promise. Each needs different evidence that it was kept. */
export type ReferenceKind = 'code' | 'figure' | 'table' | 'passage' | 'source'

interface Promise_ {
  kind: ReferenceKind
  pattern: RegExp
}

const PROMISES: readonly Promise_[] = [
  { kind: 'code', pattern: /\b(?:the following|this|the|below|above)\s+(?:code|snippet|program|script|function|pseudocode|algorithm)\b/i },
  { kind: 'code', pattern: /\bcode\s+(?:snippet|segment|fragment|below|above)\b/i },
  { kind: 'figure', pattern: /\b(?:the )?(?:diagram|figure|image|graph|chart|photograph|illustration|map)\s+(?:above|below|shown|opposite)\b/i },
  { kind: 'figure', pattern: /\b(?:in|from|using)\s+the\s+(?:diagram|figure|image|graph|chart|map)\b/i },
  // "The diagram shows a plant cell. Name the part labelled A."
  //
  // The commonest opening in a real Checkpoint paper, and it slipped past
  // every guard: the pattern above wants "shown", this one says "shows". It
  // was the single largest source of stems promising a picture that was never
  // attached — 53 in one sweep, almost all of this shape.
  { kind: 'figure', pattern: /\b(?:the )?(?:diagram|figure|image|graph|chart|photograph|illustration|map)\s+(?:shows?|illustrates?|represents?|displays?)\b/i },
  { kind: 'figure', pattern: /\brefer(?:ring|s)?\s+to\s+the\s+(?:diagram|figure|image|graph|chart|map|table)\b/i },
  // "Look at the diagram." was the single commonest unattached promise in a
  // Checkpoint sweep — 35 of them — and it matched nothing here, because the
  // patterns above all want a position word or a verb after the noun.
  { kind: 'figure', pattern: /\b(?:look\s+at|study|examine|consider)\s+(?:the|this|these)\s+(?:diagram|figure|image|graph|chart|photograph|illustration|map)\b/i },
  { kind: 'table', pattern: /\b(?:the )?table\s+(?:above|below|shown|shows?)\b/i },
  { kind: 'passage', pattern: /\b(?:the )?(?:passage|extract|text|article)\s+(?:above|below|shown)\b/i },
]

/** Something that looks like real code rather than a sentence about code. */
const LOOKS_LIKE_CODE =
  /(?:^|\n)\s*(?:for|while|if|def|function|int|var|let|const|print|return|class|import|#include)\b|[{};]\s*$|=\s*\w+\s*[+\-*/]|\bprint\s*\(|\breturn\b.*[;)]/m


function hasCode(text: string): boolean {
  // Multiple lines with an operator or keyword, or a fenced block.
  if (/```/.test(text)) return true
  return LOOKS_LIKE_CODE.test(text)
}

function hasTable(text: string): boolean {
  if (/\|.*\|/.test(text)) return true
  // Two or more lines that are mostly numbers separated by whitespace.
  const rows = text.split('\n').filter((l) => /\d/.test(l) && /\s{2,}|\t/.test(l))
  return rows.length >= 2
}

/**
 * What the stem promised but did not deliver, or null when it is answerable.
 *
 * Deliberately narrow. A stem that merely mentions the word "diagram" is fine;
 * only a definite reference — "the diagram above", "the following code" —
 * counts as a promise, because rejecting a good question is worse than letting
 * a slightly loose one through.
 */
export function danglingReference(q: ReferencingQuestion): ReferenceKind | null {
  const stem = String(q?.question ?? '')
  if (!stem.trim()) return null

  const passage = String(q?.passage ?? '')
  const hasImage = Boolean(String(q?.image_url ?? '').trim() || String(q?.diagram_svg ?? '').trim())
  const body = `${stem}\n${passage}`

  for (const { kind, pattern } of PROMISES) {
    if (!pattern.test(stem)) continue

    if (kind === 'code') {
      // An attached image can legitimately be a screenshot of code.
      if (hasCode(body) || hasImage) continue
      return 'code'
    }
    if (kind === 'figure') {
      if (hasImage) continue
      return 'figure'
    }
    if (kind === 'table') {
      if (hasTable(body) || hasImage) continue
      return 'table'
    }
    if (kind === 'passage') {
      if (passage.trim().length > 40) continue
      return 'passage'
    }
  }

  // Last, because a repair upstream is always better than a drop, and by the
  // time this runs everything repairable has been. An attached image is no
  // defence here: the student still has no page 286 to turn to, so a stem that
  // names one is wrong whether or not there is a picture beside it.
  if (bookReference(stem)) return 'source'

  return null
}

/**
 * Removes questions whose promise cannot be kept, returning what was dropped.
 *
 * Must run before the paper is trimmed to the requested count, so the top-up
 * can refill the gap — dropping afterwards silently shortens the paper, which
 * is the fault the top-up exists to prevent.
 */
export function dropDanglingReferences(questions: ReferencingQuestion[]): {
  kept: ReferencingQuestion[]
  dropped: ReferenceKind[]
} {
  const kept: ReferencingQuestion[] = []
  const dropped: ReferenceKind[] = []
  for (const q of questions) {
    const kind = danglingReference(q)
    if (kind) dropped.push(kind)
    else kept.push(q)
  }
  return { kept, dropped }
}
