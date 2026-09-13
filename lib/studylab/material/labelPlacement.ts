import { binIdFromSlot, slotIdForBin } from './sortPlacement'

/** Legacy label work: hotspotId → label. Material placement: label → s-${hotspotId}. */
export function labelAssignToPlacement(assign: Record<string, string>): Record<string, string> {
  const placement: Record<string, string> = {}
  for (const [hotspotId, label] of Object.entries(assign)) {
    if (!label) continue
    placement[label] = slotIdForBin(hotspotId)
  }
  return placement
}

export function placementToLabelAssign(placement: Record<string, string>): Record<string, string> {
  const assign: Record<string, string> = {}
  for (const [label, slotId] of Object.entries(placement)) {
    const hotspotId = binIdFromSlot(slotId)
    if (!hotspotId) continue
    assign[hotspotId] = label
  }
  return assign
}
