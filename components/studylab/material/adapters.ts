import type { Placement, MaterialSpec } from '@/lib/studylab/material/types'
import type { SuccessRule } from '@/lib/studylab/activities/types'
import { sortModule } from '@/lib/studylab/activities/patterns/sort'
import { sequenceModule } from '@/lib/studylab/activities/patterns/sequence'
import { compareModule } from '@/lib/studylab/activities/patterns/compare'
import { balanceModule } from '@/lib/studylab/activities/patterns/balance'
import { labelModule } from '@/lib/studylab/activities/patterns/label'
import { scenarioModule } from '@/lib/studylab/activities/patterns/scenario'
import { varyModule } from '@/lib/studylab/activities/patterns/vary'
import { composeModule } from '@/lib/studylab/activities/patterns/compose'
import { threePeriodModule } from '@/lib/studylab/activities/patterns/threePeriod'
import { controlsToValue, valueToControls } from '@/lib/studylab/material/varyControls'
import { placementToSides, sidesToPlacement } from '@/lib/studylab/material/balancePlacement'
import {
  labelAssignToPlacement,
  placementToLabelAssign,
} from '@/lib/studylab/material/labelPlacement'
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
import {
  chosenToPlacement,
  placementToChosen,
} from '@/lib/studylab/material/scenarioPlacement'
import {
  joinsToPlacement,
  placementToJoins,
} from '@/lib/studylab/material/composePlacement'
import {
  answersToPlacement,
  placementToAnswers,
} from '@/lib/studylab/material/threePeriodPlacement'

export type MaterialWorkAdapter = {
  freshWork(payload: unknown, seed: number | undefined): Record<string, unknown>
  placementFromWork(
    work: Record<string, unknown>,
    materialSpec: MaterialSpec,
    payload?: unknown,
  ): Placement
  controlsFromWork?(
    work: Record<string, unknown>,
    materialSpec: MaterialSpec,
    payload: unknown,
  ): Record<string, number>
  workFromPlacement(
    placement: Placement,
    materialSpec: MaterialSpec,
    payload: unknown,
    controls?: Record<string, number>,
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

export const labelAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { assign: {} }
  },
  placementFromWork(work) {
    return labelAssignToPlacement((work.assign as Record<string, string>) ?? {})
  },
  workFromPlacement(placement) {
    return { assign: placementToLabelAssign(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return labelModule.validate(payload as never, work as never, success).wrongIds
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

export const balanceAdapter: MaterialWorkAdapter = {
  freshWork(payload) {
    if (balanceModule.isPayload(payload)) {
      return balanceModule.initialWork(payload) as unknown as Record<string, unknown>
    }
    return { left: [], right: [] }
  },
  placementFromWork(work) {
    const left = Array.isArray(work.left) ? (work.left as string[]) : []
    const right = Array.isArray(work.right) ? (work.right as string[]) : []
    return sidesToPlacement({ left, right })
  },
  workFromPlacement(placement) {
    return placementToSides(placement)
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return balanceModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}

function variableId(payload: unknown): string | null {
  if (varyModule.isPayload(payload)) return payload.variable.id
  return null
}

export const varyAdapter: MaterialWorkAdapter = {
  freshWork(payload) {
    if (varyModule.isPayload(payload)) {
      return varyModule.initialWork(payload) as unknown as Record<string, unknown>
    }
    return { value: 0 }
  },
  placementFromWork() {
    return {}
  },
  controlsFromWork(work, _spec, payload) {
    const id = variableId(payload)
    if (!id) return {}
    const value = typeof work.value === 'number' && Number.isFinite(work.value)
      ? work.value
      : (varyModule.isPayload(payload) ? payload.variable.min : 0)
    return valueToControls(id, value)
  },
  workFromPlacement(_placement, _spec, payload, controls) {
    const id = variableId(payload)
    const fallback = varyModule.isPayload(payload) ? payload.variable.min : 0
    if (!id) return { value: fallback }
    return { value: controlsToValue(controls, id, fallback) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return varyModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return slotId
  },
}

export const scenarioAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { chosen: null }
  },
  placementFromWork(work) {
    const chosen = typeof work.chosen === 'string' ? work.chosen : null
    return chosenToPlacement(chosen)
  },
  workFromPlacement(placement) {
    return { chosen: placementToChosen(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return scenarioModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}

function itemsFrom(payload: unknown): { id: string; label: string }[] {
  if (threePeriodModule.isPayload(payload)) return payload.items
  return []
}

export const threePeriodAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { phase: 2, answers: {}, presentIdx: 0, identifyIdx: 0 }
  },
  placementFromWork(work, _spec, payload) {
    const answers = (work.answers as Record<string, string>) ?? {}
    return answersToPlacement(answers, itemsFrom(payload))
  },
  workFromPlacement(placement, _spec, payload) {
    return {
      phase: 2,
      answers: placementToAnswers(placement, itemsFrom(payload)),
      presentIdx: 0,
      identifyIdx: 0,
    }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return threePeriodModule.validate(payload as never, work as never, success).wrongIds
  },
  refusalTarget(slotId) {
    return binIdFromSlot(slotId) ?? slotId
  },
}

export const composeAdapter: MaterialWorkAdapter = {
  freshWork() {
    return { joins: [] }
  },
  placementFromWork(work) {
    const joins = Array.isArray(work.joins) ? (work.joins as [string, string][]) : []
    return joinsToPlacement(joins)
  },
  workFromPlacement(placement) {
    return { joins: placementToJoins(placement) }
  },
  wrongIdsWhenUnsolved(payload, work, success) {
    return composeModule.validate(payload as never, work as never, success).wrongIds
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
