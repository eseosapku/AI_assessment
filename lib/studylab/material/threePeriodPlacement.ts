import { binIdFromSlot, slotIdForBin } from './sortPlacement'

type ItemRef = { id: string; label: string }

const ANSWER_PREFIX = 'answer-'

export function answersToPlacement(
  answers: Record<string, string>,
  items: ItemRef[],
): Record<string, string> {
  const placement: Record<string, string> = {}
  for (const [pieceId, label] of Object.entries(answers)) {
    const item = items.find((i) => i.label === label)
    if (!item) continue
    placement[pieceId] = slotIdForBin(`${ANSWER_PREFIX}${item.id}`)
  }
  return placement
}

export function placementToAnswers(
  placement: Record<string, string>,
  items: ItemRef[],
): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const [pieceId, slotId] of Object.entries(placement)) {
    const binId = binIdFromSlot(slotId)
    if (!binId?.startsWith(ANSWER_PREFIX)) continue
    const itemId = binId.slice(ANSWER_PREFIX.length)
    const item = items.find((i) => i.id === itemId)
    if (!item) continue
    answers[pieceId] = item.label
  }
  return answers
}
