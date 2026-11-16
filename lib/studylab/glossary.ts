/**
 * Key terms the tutor marks in card text as `[[term|one-sentence definition]]`.
 *
 * They render underlined; tapping one opens its definition, so a learner who
 * meets "corpus" for the first time does not have to leave the card to find
 * out what it means. Only the first three in a text are defined: a card that
 * is mostly links has stopped being a card.
 *
 * The bar is what makes a mark. Double brackets without one are left exactly
 * as written -- `[[1, 2]]` is a nested list, not a term -- and nothing inside
 * a code span or maths is read at all. A mark missing one half shows as its
 * plain word, never as stray brackets.
 */
export type GlossaryPart =
  | { kind: 'text'; text: string }
  | { kind: 'term'; term: string; definition: string }

export const MAX_TERMS = 3

const MARK = /\[\[([^[\]|]*)\|([^[\]]*)\]\]/g
/** Code spans and maths, which are passed through untouched. */
const PROTECTED = /\$\$[\s\S]*?\$\$|\$[^$\n]*\$|`[^`\n]*`/g

export function splitGlossary(text: string): GlossaryPart[] {
  const parts: GlossaryPart[] = []
  const pushText = (t: string) => {
    if (!t) return
    const last = parts[parts.length - 1]
    if (last?.kind === 'text') last.text += t
    else parts.push({ kind: 'text', text: t })
  }
  // A mark that starts inside code or maths is part of it. One whose
  // definition holds some maths is still a mark.
  const guarded = [...text.matchAll(PROTECTED)].map((p) => [p.index ?? 0, (p.index ?? 0) + p[0].length])
  const inGuard = (i: number) => guarded.some(([from, to]) => i >= from && i < to)
  let terms = 0
  let at = 0
  for (const m of text.matchAll(MARK)) {
    const index = m.index ?? 0
    if (index < at || inGuard(index)) continue
    pushText(text.slice(at, index))
    const term = (m[1] ?? '').trim()
    const definition = (m[2] ?? '').trim()
    if (term && definition && terms < MAX_TERMS) {
      parts.push({ kind: 'term', term, definition })
      terms += 1
    } else {
      pushText(term)
    }
    at = index + m[0].length
  }
  pushText(text.slice(at))
  return parts
}
