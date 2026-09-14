import { joinId } from '@/lib/studylab/activities/patterns/compose'
import { slotIdForBin } from './sortPlacement'

const JOINED_SLOT = slotIdForBin('joined')

export function joinsToPlacement(joins: [string, string][]): Record<string, string> {
  const placement: Record<string, string> = {}
  for (const [a, b] of joins) {
    placement[`bond-${joinId(a, b)}`] = JOINED_SLOT
  }
  return placement
}

export function placementToJoins(placement: Record<string, string>): [string, string][] {
  const joins: [string, string][] = []
  for (const [pieceId, slotId] of Object.entries(placement)) {
    if (slotId !== JOINED_SLOT) continue
    if (!pieceId.startsWith('bond-')) continue
    const segments = pieceId.slice('bond-'.length).split('-')
    if (segments.length !== 2) continue
    joins.push([segments[0], segments[1]])
  }
  joins.sort(([a, b], [c, d]) => joinId(a, b).localeCompare(joinId(c, d)))
  return joins
}
