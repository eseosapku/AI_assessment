import type { Placement, MaterialSpec } from '@/lib/studylab/material/types'
import type { SuccessRule } from '@/lib/studylab/activities/types'
import { sortModule } from '@/lib/studylab/activities/patterns/sort'
import { sequenceModule } from '@/lib/studylab/activities/patterns/sequence'
import { compareModule } from '@/lib/studylab/activities/patterns/compare'
import {
  assignToPlacement,
  binIdFromSlot,
  placementToAssign,
} from '@/lib/studylab/material/sortPlacement'
import {
  indexFromSlot,
  orderToPlacement,
  placementToOrder,
} from '@/lib/studylab/material/sequencePlacement'

export type MaterialWorkAdapter = {
  freshWork(payload: unknown, seed: number | undefined): Record<string, unknown>
  placementFromWork(work: Record<string, unknown>, materialSpec: MaterialSpec): Placement
  workFromPlacement(
    placement: Placement,
    materialSpec: MaterialSpec,
    payload: unknown,
  ): Record<string, unknown>
  wrongIdsWhenUnsolved(
    payload: unknown,
    work: Record<string, unknown>,
    success: SuccessRule,
  ): string[]
  refusalTarget(slotId: string): string
}

export const sortAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { assign: {} }
  },
  placementFromWork(work) {
    return assignToPlacement((work.assign as Record<string, string>) ?? {})
  },
  workFromPlacement(placement) {
    return { assign: placementToAssign(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return sortModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}

export const compareAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { assign: {} }
  },
  placementFromWork(work) {
    return assignToPlacement((work.assign as Record<string, string>) ?? {})
  },
  workFromPlacement(placement) {
    return { assign: placementToAssign(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return compareModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}

export const sequenceAdapter: MaterialWorkAdapter = {
  freshWork(payload, seed) {
    if (sequenceModule.isPayload(payload)) {
      return sequenceModule.initialWork(payload, seed ?? 1) as unknown as Record<string, unknown>
    }
    return { order: [] }
  },
  placementFromWork(work) {
    return orderToPlacement(Array.isArray(work.order) ? (work.order as string[]) : [])
  },
  workFromPlacement(placement, materialSpec) {
    return { order: placementToOrder(placement, materialSpec.slots.length) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return sequenceModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return indexFromSlot(slotId)?.toString() ?? slotId
  },
}
