'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityFrame } from '@/components/studylab/activities/ActivityFrame'
import { useActivityDrag } from '@/components/studylab/activities/useActivityDrag'
import { shakeElement } from '@/lib/studylab/activities/motion'
import { createInitialMaterialState } from '@/lib/studylab/material/initialState'
import { applyMove, tick } from '@/lib/studylab/material/interpreter'
import type { MaterialSpec, MaterialState, Piece } from '@/lib/studylab/material/types'
import { ControlView } from './ControlView'
import { DisplayView } from './DisplayView'
import { MaterialFrame } from './MaterialFrame'
import { PieceChip } from './PieceChip'
import { SlotTarget } from './SlotTarget'

const REFUSAL_KEYFRAMES = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-6px)' },
  { transform: 'translateX(6px)' },
  { transform: 'translateX(0)' },
]

export type MaterialRendererProps = {
  spec: MaterialSpec
  /** Bench-only remount key; ignored in controlled mode. */
  resetKey?: string
  state?: MaterialState
  onStateChange?: (next: MaterialState) => void
  solved?: boolean
  revealed?: boolean
  reveal?: string
  hint?: string | null
  hintAvailable?: boolean
  onHint?: () => void
  onCheck?: () => void
  wrongIds?: string[]
  onRefusal?: (pieceId: string, slotId: string) => void
}

export function MaterialRenderer({
  spec,
  resetKey = '',
  state: controlledState,
  onStateChange,
  solved: solvedProp,
  revealed = false,
  reveal,
  hint = null,
  hintAvailable = false,
  onHint,
  onCheck,
  wrongIds = [],
  onRefusal,
}: MaterialRendererProps) {
  const controlled = controlledState !== undefined && onStateChange !== undefined
  const [internal, setInternal] = useState(() => createInitialMaterialState(spec))
  const rootRef = useRef<HTMLDivElement>(null)

  // A bench picker can replace either the key or the spec object. Reset after
  // that render rather than setting state while React is rendering it.
  useEffect(() => {
    if (controlled) return
    setInternal(createInitialMaterialState(spec))
  }, [controlled, resetKey, spec])

  const state = controlled ? controlledState! : internal
  const setState = controlled ? onStateChange! : setInternal

  const result = tick(spec, state)
  const slotIds = spec.slots.map((slot) => slot.id)

  const place = useCallback((pieceId: string, slotId: string) => {
    const moved = applyMove(spec, state, { pieceId, slotId })
    const refused = moved.rejectedMoves.length > state.rejectedMoves.length
    const movedResult = tick(spec, moved)
    const next: MaterialState = {
      ...moved,
      status: movedResult.solved ? 'solved' : 'in_progress',
    }

    if (refused) {
      const piece = rootRef.current?.querySelector(`[data-item="${CSS.escape(pieceId)}"]`)
      shakeElement(piece, REFUSAL_KEYFRAMES)
      onRefusal?.(pieceId, slotId)
    }
    setState(next)
  }, [onRefusal, setState, spec, state])

  const drag = useActivityDrag(place)

  const pieceView = (piece: Piece) => (
    <PieceChip
      key={piece.id}
      piece={piece}
      dragging={drag.dragId === piece.id}
      dragProps={drag.itemProps(piece.id, slotIds)}
      wrong={wrongIds.includes(piece.id)}
    />
  )

  const unplaced = spec.pieces.filter((piece) => state.placement[piece.id] === undefined)

  const changeControl = (controlId: string, value: number) => {
    const changed: MaterialState = {
      ...state,
      controls: { ...state.controls, [controlId]: value },
    }
    const changedResult = tick(spec, changed)
    setState({
      ...changed,
      status: changedResult.solved ? 'solved' : 'in_progress',
    })
  }

  return (
    <ActivityFrame
      prompt={spec.prompt}
      solved={solvedProp ?? result.solved}
      revealed={revealed}
      reveal={reveal}
      hint={hint}
      hintAvailable={hintAvailable}
      onHint={onHint ?? (() => undefined)}
      onCheck={onCheck}
    >
      <div ref={rootRef}>
        <MaterialFrame
          spec={spec}
          displays={spec.displays?.length ? (
            <div className="flex flex-wrap items-end justify-center gap-3">
              {spec.displays.map((display) => (
                <DisplayView key={display.id} display={display} value={result.displays[display.id]} />
              ))}
            </div>
          ) : undefined}
          groups={(group) => (
            <div className="flex flex-wrap content-start items-start gap-1.5">
              {spec.slots.filter((slot) => slot.groupId === group.id).map((slot) => (
                <SlotTarget key={slot.id} slot={slot} hot={drag.overId === slot.id}>
                  {spec.pieces
                    .filter((piece) => state.placement[piece.id] === slot.id)
                    .map(pieceView)}
                </SlotTarget>
              ))}
            </div>
          )}
          pool={unplaced.length ? (
            <div className="flex min-h-[30px] flex-wrap gap-1.5">
              {unplaced.map(pieceView)}
            </div>
          ) : undefined}
          controls={spec.controls?.length ? (
            <div className="flex flex-col gap-2">
              {spec.controls.map((control) => (
                <ControlView
                  key={control.id}
                  control={control}
                  value={state.controls[control.id] ?? control.min}
                  onChange={(value) => changeControl(control.id, value)}
                />
              ))}
            </div>
          ) : undefined}
          says={result.says}
        />
      </div>
    </ActivityFrame>
  )
}
