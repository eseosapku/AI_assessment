import { cleanRecallText } from './text'
import type { RecallCardInput } from './types'

export function buildMissedRecallCards(
  questions: unknown[],
  answers: Record<string | number, unknown> | { mcq?: Record<string | number, unknown> },
  subject: string,
): RecallCardInput[] {
  const missed: RecallCardInput[] = []
  const mcqAnswers =
    answers && typeof answers === 'object' && 'mcq' in answers && answers.mcq
      ? answers.mcq
      : answers

  questions.forEach((raw, idx) => {
    const q = raw as Record<string, unknown>
    const type = String(q?.type ?? '')
    if (type === 'longform' || type.startsWith('interactive')) return

    const options = Array.isArray(q?.options) ? q.options : []
    if (options.length === 0) return

    const userAns = (mcqAnswers as Record<string | number, unknown>)[idx]
      ?? (mcqAnswers as Record<string | number, unknown>)[String(idx)]
    const correct = Number(q.correct_answer)
    if (userAns === undefined || Number(userAns) === correct) return

    const front = cleanRecallText(String(q.question ?? 'Question'))
    const correctText = cleanRecallText(String(options[correct] ?? ''))
    const explanation = cleanRecallText(String(q.explanation ?? ''))
    const back = explanation ? `${correctText}\n\n${explanation}` : correctText
    if (!front || !back) return

    // A real image carries its author, licence and source wherever it is shown (CC BY, CC BY-SA).
    const credit = q.image_url && q.image_credit ? `

Image: ${String(q.image_credit)}` : ''
    const card: RecallCardInput = { front: `${front}${credit}`, back, hint: subject }
    if (q.image_url) card.front_image_url = String(q.image_url)
    if (q.diagram_svg) card.front_diagram_svg = String(q.diagram_svg)

    missed.push(card)
  })

  return missed
}
