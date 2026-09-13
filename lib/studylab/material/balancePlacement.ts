// lib/studylab/material/balancePlacement.ts
import { slotIdForBin } from './sortPlacement'

const LEFT_SLOT = slotIdForBin('left')
const RIGHT_SLOT = slotIdForBin('right')

export function sidesToPlacement(work: { left: string[]; right: string[] }): Record<string, string> {
  const placement: Record<string, string> = {}
  for (const id of work.left) {
    if (!id) continue
    placement[id] = LEFT_SLOT
  }
  for (const id of work.right) {
    if (!id) continue
    placement[id] = RIGHT_SLOT
  }
  return placement
}

export function placementToSides(placement: Record<string, string>): { left: string[]; right: string[] } {
  const left: string[] = []
  const right: string[] = []
  for (const [pieceId, slotId] of Object.entries(placement)) {
    if (slotId === LEFT_SLOT) {
      left.push(pieceId)
    } else if (slotId === RIGHT_SLOT) {
      right.push(pieceId)
    }
  }
  left.sort()
  right.sort()
  return { left, right }
}
