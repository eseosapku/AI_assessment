'use client'
import { useCallback, useContext, useEffect, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { createInitialMaterialState } from '@/lib/studylab/material/initialState'
import { tick } from '@/lib/studylab/material/interpreter'
import type { MaterialState } from '@/lib/studylab/material/types'
import type { BarAction } from '@/lib/studylab/checkBarModel'
import { CanvasContext, CardFrame } from '@/components/studylab/canvasShared'
import { MaterialRenderer } from './MaterialRenderer'
import { useCheckFlow } from '../check/useCheckFlow'
import { restoreEvent } from '@/lib/studylab/checkFlow'

export function MaterialBoardNode({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const materialSpec = d.materialSpec
  const { onNodeDataChange } = useContext(CanvasContext)

  const [materialState, setMaterialState] = useState<MaterialState>(() => {
    if (d.materialState) return d.materialState
    if (materialSpec) return createInitialMaterialState(materialSpec)
    return { placement: {}, controls: {}, attempts: 0, rejectedMoves: [], status: 'untouched' }
  })
  const [revealed, setRevealed] = useState(() => d.materialState?.status === 'solved')

  // The lesson's check flow; the material state already counts attempts.
  const { state: flow, dispatch } = useCheckFlow(
    'learn',
    { attempts: materialState.attempts, settled: materialState.status === 'solved' ? 'correct' : undefined },
    () => {},
  )
  useEffect(() => {
    const restored = restoreEvent(flow, materialState.status === 'in_progress')
    if (restored) dispatch(restored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback(
    (next: MaterialState) => {
      setMaterialState(next)
      onNodeDataChange?.(id, { materialState: next })
    },
    [id, onNodeDataChange],
  )

  const handleStateChange = useCallback(
    (next: MaterialState) => {
      persist({
        ...next,
        status: materialState.status === 'solved' ? 'solved' : 'in_progress',
      })
      // Moving something is the answer, and after a miss it is the next go.
      dispatch({ type: 'answer', present: true })
    },
    [persist, materialState.status, dispatch],
  )

  const check = useCallback(() => {
    if (!materialSpec) return
    dispatch({ type: 'check' })
    const tickResult = tick(materialSpec, materialState)
    const next: MaterialState = {
      ...materialState,
      attempts: materialState.attempts + 1,
      status: tickResult.solved ? 'solved' : 'in_progress',
    }
    persist(next)
    if (tickResult.solved) setRevealed(true)
    dispatch({ type: 'result', verdict: tickResult.solved ? 'correct' : 'incorrect' })
  }, [materialSpec, materialState, persist, dispatch])

  const onCheckAction = (action: BarAction) => {
    if (action === 'check') check()
    else if (action === 'tryAgain') dispatch({ type: 'tryAgain' })
  }

  if (!materialSpec) {
    return (
      <CardFrame>
        <p className="p-4 text-[12px] text-ss-slate">This material could not be loaded.</p>
      </CardFrame>
    )
  }

  const solved = materialState.status === 'solved'

  return (
    <MaterialRenderer
      spec={materialSpec}
      state={materialState}
      onStateChange={handleStateChange}
      solved={solved}
      revealed={revealed}
      onCheck={solved ? undefined : check}
      checkState={flow}
      onCheckAction={onCheckAction}
    />
  )
}
