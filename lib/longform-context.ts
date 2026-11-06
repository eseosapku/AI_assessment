/** A part's short demand is only markable with the shared setup the learner saw. */
export function longformContext(question: { scenario?: string; image_alt?: string }): string {
  return [
    question.scenario ? `Shared question context:\n${question.scenario}` : '',
    question.image_alt ? `Shared figure description:\n${question.image_alt}` : '',
  ].filter(Boolean).join('\n\n')
}
