'use client'
import { useCallback, useContext, useRef, useState } from 'react'
import type { ActivitySpec, ActivityState } from '@/lib/studylab/activities/types'
import { buildOutcome } from '@/lib/studylab/activities/telemetry'
import { createInitialMaterialState } from '@/lib/studylab/material/initialState'
import { tick } from '@/lib/studylab/material/interpreter'
import type { MaterialSpec, MaterialState } from '@/lib/studylab/material/types'
import { CanvasContext } from '@/components/studylab/canvasShared'
import type { MaterialWorkAdapter } from './adapters'
import { MaterialRenderer } from './MaterialRenderer'

const HINT_AFTER_ATTEMPTS = 2

function seedMaterialState(
  materialSpec: MaterialSpec,
  adapter: MaterialWorkAdapter,
  initial: ActivityState | undefined,
  payload: unknown,
): MaterialState {
  const base = createInitialMaterialState(materialSpec)
  const work = (initial?.work as Record<string, unknown> | undefined) ?? {}
  const placement = adapter.placementFromWork(work, materialSpec)
  const hasWork =
    Object.keys(placement).length > 0 || typeof work.value === 'number'
  const controls = adapter.controlsFromWork
    ? { ...base.controls, ...adapter.controlsFromWork(work, materialSpec, payload) }
    : base.controls
  return {
    ...base,
    placement: hasWork ? placement : base.placement,
    controls: hasWork ? controls : base.controls,
    status: initial?.status === 'solved'
      ? 'solved'
      : hasWork
        ? 'in_progress'
        : base.status,
    rejectedMoves: [], // material-shaped; activity rejects live in ActivityState
  }
}

export function MaterialActivity({
  id,
  spec,
  materialSpec,
  adapter,
  onOutcome,
  initialState,
}: {
  id: string
  spec: ActivitySpec
  materialSpec: MaterialSpec
  adapter: MaterialWorkAdapter
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
      work: adapter.freshWork(spec.payload, spec.seed),
    }
  })
  const activityRef = useRef(activity)
  activityRef.current = activity
  const [materialState, setMaterialState] = useState<MaterialState>(() =>
    seedMaterialState(materialSpec, adapter, activity, spec.payload),
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
    const work = adapter.workFromPlacement(
      next.placement,
      materialSpec,
      spec.payload,
      next.controls,
    )
    const latest = activityRef.current
    persistActivity({
      ...latest,
      work,
      status: latest.status === 'solved' ? 'solved' : 'in_progress',
    })
  }, [adapter, materialSpec, persistActivity, spec.payload])

  const handleRefusal = useCallback((pieceId: string, slotId: string) => {
    const targetId = adapter.refusalTarget(slotId)
    const latest = activityRef.current
    persistActivity({
      ...latest,
      status: latest.status === 'solved' ? 'solved' : 'in_progress',
      rejectedMoves: [...(latest.rejectedMoves ?? []), { itemId: pieceId, targetId }],
    })
  }, [adapter, persistActivity])

  const check = useCallback(() => {
    const tickResult = tick(materialSpec, materialState)
    const work = adapter.workFromPlacement(
      materialState.placement,
      materialSpec,
      spec.payload,
      materialState.controls,
    )
    const attempts = activity.attempts + 1
    const failedWrongIds = tickResult.solved
      ? []
      : adapter.wrongIdsWhenUnsolved(spec.payload, work, spec.success)
    const validate = { ok: tickResult.solved, wrongIds: failedWrongIds }
    const next: ActivityState = {
      ...activity,
      attempts,
      work,
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
  }, [activity, adapter, id, materialSpec, materialState, onOutcome, persistActivity, spec])

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
