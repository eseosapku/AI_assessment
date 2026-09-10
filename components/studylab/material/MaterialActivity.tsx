'use client'
import { useCallback, useContext, useRef, useState } from 'react'
import type { ActivitySpec, ActivityState } from '@/lib/studylab/activities/types'
import { sortModule, type SortWork } from '@/lib/studylab/activities/patterns/sort'
import { buildOutcome } from '@/lib/studylab/activities/telemetry'
import { createInitialMaterialState } from '@/lib/studylab/material/initialState'
import { tick } from '@/lib/studylab/material/interpreter'
import type { MaterialSpec, MaterialState } from '@/lib/studylab/material/types'
import {
  assignToPlacement,
  binIdFromSlot,
  placementToAssign,
} from '@/lib/studylab/material/sortPlacement'
import { CanvasContext } from '@/components/studylab/canvasShared'
import { MaterialRenderer } from './MaterialRenderer'

const HINT_AFTER_ATTEMPTS = 2

function seedMaterialState(materialSpec: MaterialSpec, initial?: ActivityState): MaterialState {
  const base = createInitialMaterialState(materialSpec)
  const assign = (initial?.work as SortWork | undefined)?.assign ?? {}
  const hasAssign = Object.keys(assign).length > 0
  return {
    ...base,
    placement: hasAssign ? assignToPlacement(assign) : base.placement,
    status: initial?.status === 'solved'
      ? 'solved'
      : hasAssign
        ? 'in_progress'
        : base.status,
    rejectedMoves: [], // material-shaped; activity rejects live in ActivityState
  }
}

export function MaterialActivity({
  id,
  spec,
  materialSpec,
  onOutcome,
  initialState,
}: {
  id: string
  spec: ActivitySpec
  materialSpec: MaterialSpec
  onOutcome: (o: unknown) => void
  initialState?: ActivityState
}) {
  const { onNodeDataChange } = useContext(CanvasContext)
  const startedAt = useRef(Date.now())

  const [activity, setActivity] = useState<ActivityState>(() => {
    if (initialState && initialState.work && Object.keys(initialState.work).length > 0) {
      return initialState
    }
    return {
      status: initialState?.status ?? 'untouched',
      attempts: initialState?.attempts ?? 0,
      hintsUsed: initialState?.hintsUsed ?? 0,
      elapsedMs: initialState?.elapsedMs ?? 0,
      rejectedMoves: initialState?.rejectedMoves ?? [],
      work: { assign: {} },
    }
  })
  const activityRef = useRef(activity)
  activityRef.current = activity
  const [materialState, setMaterialState] = useState<MaterialState>(() =>
    seedMaterialState(materialSpec, activity),
  )
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [revealed, setRevealed] = useState(activity.status === 'solved')

  const persistActivity = useCallback((next: ActivityState) => {
    // Refusal and placement callbacks can fire before React renders between them.
    activityRef.current = next
    setActivity(next)
    onNodeDataChange?.(id, { activityState: next })
  }, [id, onNodeDataChange])

  const handleStateChange = useCallback((next: MaterialState) => {
    setMaterialState(next)
    const assign = placementToAssign(next.placement)
    const latest = activityRef.current
    persistActivity({
      ...latest,
      work: { assign },
      status: latest.status === 'solved' ? 'solved' : 'in_progress',
    })
  }, [persistActivity])

  const handleRefusal = useCallback((pieceId: string, slotId: string) => {
    const targetId = binIdFromSlot(slotId) ?? slotId
    const latest = activityRef.current
    persistActivity({
      ...latest,
      status: latest.status === 'solved' ? 'solved' : 'in_progress',
      rejectedMoves: [...(latest.rejectedMoves ?? []), { itemId: pieceId, targetId }],
    })
  }, [persistActivity])

  const check = useCallback(() => {
    const tickResult = tick(materialSpec, materialState)
    const assign = placementToAssign(materialState.placement)
    const work: SortWork = { assign }
    const attempts = activity.attempts + 1
    const failedWrongIds = tickResult.solved
      ? []
      : sortModule.validate(spec.payload as never, work, spec.success).wrongIds
    const validate = { ok: tickResult.solved, wrongIds: failedWrongIds }
    const next: ActivityState = {
      ...activity,
      attempts,
      work: { assign },
      status: validate.ok ? 'solved' : 'in_progress',
      elapsedMs: Date.now() - startedAt.current,
    }
    persistActivity(next)
    setWrongIds(validate.wrongIds)
    if (validate.ok) {
      setRevealed(true)
      setMaterialState({ ...materialState, status: 'solved' })
    }
    onOutcome(buildOutcome(id, spec.pattern, next, validate))
  }, [activity, id, materialSpec, materialState, onOutcome, persistActivity, spec])

  const hintAvailable =
    (spec.hints?.length ?? 0) > 0 && activity.attempts >= HINT_AFTER_ATTEMPTS
  const hint = hintAvailable
    ? spec.hints![Math.min(activity.hintsUsed, spec.hints!.length - 1)]
    : null

  return (
    <MaterialRenderer
      spec={materialSpec}
      state={materialState}
      onStateChange={handleStateChange}
      onRefusal={handleRefusal}
      solved={activity.status === 'solved'}
      revealed={revealed}
      reveal={spec.reveal}
      hint={hint}
      hintAvailable={hintAvailable}
      onHint={() => persistActivity({ ...activity, hintsUsed: activity.hintsUsed + 1 })}
      onCheck={activity.status === 'solved' ? undefined : check}
      wrongIds={wrongIds}
    />
  )
}
