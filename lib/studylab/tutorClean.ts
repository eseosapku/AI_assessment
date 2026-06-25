// Deterministic safety nets for the tutor's chat output, so even a weaker model
// can't fully break the "whiteboard is the lesson" contract.

// A sentence that announces creating/showing a card ("I'll create a card to...").
const ANNOUNCE = /\b(create|make|add|draw|build|sketch|illustrate|put together|show)\b[^.!?]*\bcard\b/i

// Strip filler sentences that announce card creation instead of just doing it.
// Never blanks the whole message — if everything is stripped, keep the original.
export function cleanSay(say: string): string {
  if (!say) return say
  const sentences = say.match(/[^.!?]+[.!?]*/g) ?? [say]
  const kept = sentences.filter((s) => {
    const t = s.trim()
    return t.length > 0 && !ANNOUNCE.test(t)
  })
  const result = kept.join(' ').replace(/\s+/g, ' ').trim()
  return result || say.trim()
}

// Suggestion chips must navigate the lesson, not perform actions the student does
// on a card. Drop "Run the code" / "Click..." style chips.
const CARD_ACTION = /\b(run|execute|click|press|tap|paste)\b/i

export function cleanSuggestions(suggestions: string[]): string[] {
  return suggestions.filter((s) => !CARD_ACTION.test(s))
}
