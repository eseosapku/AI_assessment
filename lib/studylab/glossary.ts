/**
 * Key terms the tutor marks in card text as `[[term|one-sentence definition]]`.
 *
 * They render underlined; tapping one opens its definition, so a learner who
 * meets "corpus" for the first time does not have to leave the card to find
 * out what it means. A mark that is missing a part shows as its plain word,
 * never as stray brackets, and only the first three in a text are defined:
 * a card that is mostly links has stopped being a card.
 */
export type GlossaryPart =
  | { kind: 'text'; text: string }
  | { kind: 'term'; term: string; definition: string }

export const MAX_TERMS = 3

const MARK = /\[\[([^[\]|]*)(?:\|([^[\]]*))?\]\]/g

export function splitGlossary(text: string): GlossaryPart[] {
  const parts: GlossaryPart[] = []
  const pushText = (t: string) => {
    if (!t) return
    const last = parts[parts.length - 1]
    if (last?.kind === 'text') last.text += t
    else parts.push({ kind: 'text', text: t })
  }
  let terms = 0
  let at = 0
  for (const m of text.matchAll(MARK)) {
    pushText(text.slice(at, m.index))
    const term = (m[1] ?? '').trim()
    const definition = (m[2] ?? '').trim()
    if (term && definition && terms < MAX_TERMS) {
      parts.push({ kind: 'term', term, definition })
      terms += 1
    } else {
      pushText(term)
    }
    at = (m.index ?? 0) + m[0].length
  }
  pushText(text.slice(at))
  return parts
}
