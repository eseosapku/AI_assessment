import { slotIdForBin } from './sortPlacement'

const CHOSEN_SLOT = slotIdForBin('chosen')

export function chosenToPlacement(chosen: string | null): Record<string, string> {
  if (!chosen) return {}
  return { [chosen]: CHOSEN_SLOT }
}

export function placementToChosen(placement: Record<string, string>): string | null {
  const onChosen = Object.entries(placement)
    .filter(([, slotId]) => slotId === CHOSEN_SLOT)
    .map(([pieceId]) => pieceId)
    .sort()
  return onChosen[0] ?? null
}
