// lib/studylab/material/sortPlacement.ts
/** Canon sorting-frame slot ids are `s-${groupId}` — pinned by equivalence tests. */
export function slotIdForBin(binId: string): string {
  return `s-${binId}`
}

export function binIdFromSlot(slotId: string): string | null {
  if (!slotId.startsWith('s-')) return null
  const binId = slotId.slice(2)
  return binId.length > 0 ? binId : null
}

export function assignToPlacement(assign: Record<string, string>): Record<string, string> {
  const placement: Record<string, string> = {}
  for (const [pieceId, binId] of Object.entries(assign)) {
    if (!binId) continue
    placement[pieceId] = slotIdForBin(binId)
  }
  return placement
}

export function placementToAssign(placement: Record<string, string>): Record<string, string> {
  const assign: Record<string, string> = {}
  for (const [pieceId, slotId] of Object.entries(placement)) {
    const binId = binIdFromSlot(slotId)
    if (!binId) continue
    assign[pieceId] = binId
  }
  return assign
}
