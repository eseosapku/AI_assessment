'use client'

import { useMemo, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import StudyLabSidebar, { type StudyLabSidebarProps } from '../StudyLabSidebar'
import ChatMouthpiece, { type ChatMouthpieceProps } from '../ChatMouthpiece'
import type { StudyCanvasProps } from '../StudyCanvas'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { focusIds } from '@/lib/studylab/spotlight'

// React Flow is client-only; load without SSR.
const StudyCanvas = dynamic(() => import('../StudyCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-ss-canvas dark:bg-[#0a0a0a]">
      <Loader2 className="w-7 h-7 text-ss-accent animate-spin" />
    </div>
  ),
})

export interface LessonStageProps {
  /** Picks the lesson's subject colours. */
  subjectKey: string
  /** What the last turn built, or what the learner was sent to. */
  focus: string[]
  rail: StudyLabSidebarProps
  board: StudyCanvasProps
  chat: ChatMouthpieceProps
  /** Above everything: the demo's "this is a demo" bar. */
  banner?: ReactNode
  /** Over the board: the unsaved notice, the demo's cue card. */
  boardOverlay?: ReactNode
  /** Outside the layout: offers and coach marks. */
  children?: ReactNode
}

/**
 * The lesson screen: the plan, the board and the tutor, laid out once.
 *
 * A real lesson and the demo both render this, so every control the demo
 * teaches is the control a real lesson has -- the two used to carry their own
 * copies of the layout, and drifted.
 */
/**
 * Room the camera leaves around the work in focus: the board's own controls
 * along the top, and the bar and Inky along the bottom.
 */
const INSETS = { top: 72, right: 32, bottom: 128, left: 32 }

export default function LessonStage({ subjectKey, focus, rail, board, chat, banner, boardOverlay, children }: LessonStageProps) {
  const spotlight = useMemo(
    () => focusIds({ nodes: board.nodes, run: board.run, explicit: focus }),
    [board.nodes, board.run, focus],
  )
  return (
    <div className="ss-lesson h-screen w-full flex flex-col overflow-hidden" style={subjectStyle(subjectKey)}>
      {banner}
      <div className="flex min-h-0 flex-1">
        <StudyLabSidebar {...rail} />
        <div data-tour="lesson-board" className="relative flex-1 min-w-0 h-full">
          {boardOverlay}
          <StudyCanvas {...board} focusIds={spotlight} insets={INSETS} />
        </div>
        <div className="w-[360px] shrink-0 h-full border-l border-ss-line">
          <ChatMouthpiece {...chat} />
        </div>
      </div>
      {children}
    </div>
  )
}
