// lib/studylab/material/sequencePlacement.ts
/** Canon sequence-frame slot ids are `s-${index}` — pinned by equivalence tests. */
export function slotIdForIndex(index: number): string {
  return `s-${index}`
}

export function indexFromSlot(slotId: string): number | null {
  if (!slotId.startsWith('s-')) return null
  const rest = slotId.slice(2)
  if (rest.length === 0 || !/^\d+$/.test(rest)) return null
  return Number(rest)
}

export function orderToPlacement(order: string[]): Record<string, string> {
  const placement: Record<string, string> = {}
  for (let i = 0; i < order.length; i++) {
    const id = order[i]
    if (!id) continue
    placement[id] = slotIdForIndex(i)
  }
  return placement
}

export function placementToOrder(
  placement: Record<string, string>,
  slotCount: number,
): string[] {
  const order: string[] = []
  for (let i = 0; i < slotCount; i++) {
    const slotId = slotIdForIndex(i)
    const candidates = Object.entries(placement)
      .filter(([, pieceSlot]) => pieceSlot === slotId)
      .map(([pieceId]) => pieceId)
      .sort()
    if (candidates.length === 0) continue
    order.push(candidates[0])
  }
  return order
}
