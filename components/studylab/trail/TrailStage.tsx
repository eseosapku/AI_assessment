'use client'

import LessonStage, { type LessonStageProps } from '../stage/LessonStage'

/**
 * The Trail look of a lesson: the same props as the classic stage.
 *
 * For now it is the classic stage with a way back, so a lesson stays fully
 * usable while the Trail's own board is built.
 */
export default function TrailStage(props: LessonStageProps) {
  return (
    <LessonStage
      {...props}
      board={{ ...props.board, boardExtra: undefined }}
      boardOverlay={
        <>
          {props.boardOverlay}
          <button
            type="button"
            onClick={props.trail?.onClassic}
            className="absolute left-3 top-16 z-20 rounded-xl border border-ss-line bg-ss-panel px-3 py-2 text-[12px] font-semibold text-ss-ink shadow-ss-panel hover:border-ss-accent"
          >
            Back to the classic look
          </button>
        </>
      }
    />
  )
}
