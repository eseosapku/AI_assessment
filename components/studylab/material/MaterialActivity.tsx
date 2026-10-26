'use client'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ActivitySpec, ActivityState } from '@/lib/studylab/activities/types'
import { buildOutcome } from '@/lib/studylab/activities/telemetry'
import { createInitialMaterialState } from '@/lib/studylab/material/initialState'
import { tick } from '@/lib/studylab/material/interpreter'
import type { MaterialSpec, MaterialState } from '@/lib/studylab/material/types'
import { CanvasContext } from '@/components/studylab/canvasShared'
import type { MaterialWorkAdapter } from './adapters'
import { MaterialRenderer } from './MaterialRenderer'
import { useCheckFlow } from '../check/useCheckFlow'
import { restoreEvent } from '@/lib/studylab/checkFlow'
import type { BarAction } from '@/lib/studylab/checkBarModel'


function seedMaterialState(
  materialSpec: MaterialSpec,
  adapter: MaterialWorkAdapter,
  initial: ActivityState | undefined,
  payload: unknown,
): MaterialState {
  const base = createInitialMaterialState(materialSpec)
  const work = (initial?.work as Record<string, unknown> | undefined) ?? {}
  const placement = adapter.placementFromWork(work, materialSpec, payload)
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

  // The lesson's check flow. Attempts are already saved on the activity state
  // by `check`, so the flow keeps no separate copy of its own.
  const { state: flow, dispatch } = useCheckFlow(
    'learn',
    { attempts: activity.attempts, settled: activity.status === 'solved' ? 'correct' : undefined },
    () => {},
  )
  // Work already on the material is an answer that can be checked.
  useEffect(() => {
    const restored = restoreEvent(flow, activity.status === 'in_progress')
    if (restored) dispatch(restored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // Moving a piece is the answer, and after a miss it is the next go.
    setWrongIds([])
    dispatch({ type: 'answer', present: true })
  }, [adapter, materialSpec, persistActivity, spec.payload, dispatch])

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
    dispatch({ type: 'check' })
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
    // A miss shows the next hint, so count it as used.
    const hintShown = !validate.ok && (spec.hints?.length ?? 0) > 0
    const next: ActivityState = {
      ...activity,
      attempts,
      work,
      status: validate.ok ? 'solved' : 'in_progress',
      elapsedMs: Date.now() - startedAt.current,
      hintsUsed: hintShown ? activity.hintsUsed + 1 : activity.hintsUsed,
    }
    persistActivity(next)
    setWrongIds(validate.wrongIds)
    if (validate.ok) {
      setRevealed(true)
      setMaterialState({ ...materialState, status: 'solved' })
    }
    dispatch({ type: 'result', verdict: validate.ok ? 'correct' : 'incorrect' })
    onOutcome(buildOutcome(id, spec.pattern, next, validate))
  }, [activity, adapter, id, materialSpec, materialState, onOutcome, persistActivity, spec, dispatch])

  // After a miss, Inky's line is the next hint, where the activity has one.
  const missed = flow.phase === 'retry' || flow.phase === 'wrong'
  const hints = spec.hints ?? []
  const checkLine =
    missed && hints.length > 0 ? hints[Math.min(Math.max(activity.hintsUsed - 1, 0), hints.length - 1)] : undefined

  const onCheckAction = (action: BarAction) => {
    if (action === 'check') check()
    else if (action === 'tryAgain') dispatch({ type: 'tryAgain' })
  }

  return (
    <MaterialRenderer
      spec={materialSpec}
      state={materialState}
      onStateChange={handleStateChange}
      onRefusal={handleRefusal}
      solved={activity.status === 'solved'}
      revealed={revealed}
      reveal={spec.reveal}
      hint={null}
      hintAvailable={false}
      onHint={() => undefined}
      onCheck={activity.status === 'solved' ? undefined : check}
      wrongIds={wrongIds}
      checkState={flow}
      onCheckAction={onCheckAction}
      checkLine={checkLine}
    />
  )
}
