'use client'
import { useCallback, useContext, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { StudyNodeData } from '@/lib/studylab/types'
import { createInitialMaterialState } from '@/lib/studylab/material/initialState'
import { tick } from '@/lib/studylab/material/interpreter'
import type { MaterialState } from '@/lib/studylab/material/types'
import { CanvasContext, CardFrame } from '@/components/studylab/canvasShared'
import { MaterialRenderer } from './MaterialRenderer'

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
    },
    [persist, materialState.status],
  )

  const check = useCallback(() => {
    if (!materialSpec) return
    const tickResult = tick(materialSpec, materialState)
    const next: MaterialState = {
      ...materialState,
      attempts: materialState.attempts + 1,
      status: tickResult.solved ? 'solved' : 'in_progress',
    }
    persist(next)
    if (tickResult.solved) setRevealed(true)
  }, [materialSpec, materialState, persist])

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
    />
  )
}
