'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import StudyLabSidebar, { type StudyLabSidebarProps } from '../StudyLabSidebar'
import ChatMouthpiece, { type ChatMouthpieceProps } from '../ChatMouthpiece'
import type { StudyCanvasProps } from '../StudyCanvas'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { focusIds, continueFor, dockModel, type ContinueTarget } from '@/lib/studylab/spotlight'
import { StageContext, type StageValue } from './StageContext'
import { ActionDock } from './ActionDock'

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
  /** Continue / Finish lesson: the lesson's way forward. */
  onAdvance: () => void
  /** Sends the learner to a card: the next question, the open check. */
  onFocus: (nodeId: string) => void
  /** Above everything: the demo's "this is a demo" bar. */
  banner?: ReactNode
  /** Over the board: the unsaved notice, the demo's cue card. */
  boardOverlay?: ReactNode
  /** Outside the layout: offers and coach marks. */
  children?: ReactNode
}

/**
 * Room the camera leaves around the work in focus: the board's own controls
 * along the top, and the bar and Inky along the bottom.
 */
const INSETS = { top: 72, right: 32, bottom: 128, left: 32 }

/**
 * The lesson screen: the plan, the board and the tutor, laid out once.
 *
 * A real lesson and the demo both render this, so every control the demo
 * teaches is the control a real lesson has -- the two used to carry their own
 * copies of the layout, and drifted.
 */
export default function LessonStage({
  subjectKey, focus, rail, board, chat, onAdvance, onFocus, banner, boardOverlay, children,
}: LessonStageProps) {
  const spotlight = useMemo(
    () => focusIds({ nodes: board.nodes, run: board.run, explicit: focus }),
    [board.nodes, board.run, focus],
  )

  // The dock: cards in the spotlight ask for it, and the first of them in the
  // spotlight's order gets it -- so with a whole step on screen, the bar
  // belongs to the first thing to answer, then the next.
  const [dockEl, setDockEl] = useState<HTMLDivElement | null>(null)
  const [claims, setClaims] = useState<ReadonlySet<string>>(new Set())
  const claim = useCallback((nodeId: string) => {
    setClaims((prev) => new Set(prev).add(nodeId))
    return () =>
      setClaims((prev) => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
  }, [])
  // The card the learner last started working on, when it is one that asked.
  const [preferred, setPreferred] = useState<string | null>(null)
  const prefer = useCallback((nodeId: string) => setPreferred(nodeId), [])
  const owner =
    preferred && claims.has(preferred) && spotlight.includes(preferred)
      ? preferred
      : (spotlight.find((id) => claims.has(id)) ?? null)

  const flow = { nodes: board.nodes, run: board.run, busy: chat.busy }
  const runContinue = useCallback(
    (target: ContinueTarget) => {
      if (target.kind === 'focus') onFocus(target.nodeId)
      else onAdvance()
    },
    [onAdvance, onFocus],
  )
  const stage = useMemo<StageValue>(
    () => ({
      dockEl,
      focus: new Set(spotlight),
      owner,
      continueFor: (nodeId) => continueFor(nodeId, { nodes: board.nodes, run: board.run, busy: chat.busy }),
      runContinue,
      claim,
      prefer,
    }),
    [dockEl, spotlight, owner, board.nodes, board.run, chat.busy, runContinue, claim, prefer],
  )
  const view = dockModel({ ...flow, working: chat.working ?? 'Thinking…' })

  return (
    <StageContext.Provider value={stage}>
      <div className="ss-lesson h-screen w-full flex flex-col overflow-hidden" style={subjectStyle(subjectKey)}>
        {banner}
        <div className="flex min-h-0 flex-1">
          <StudyLabSidebar {...rail} />
          <div data-tour="lesson-board" className="relative flex-1 min-w-0 h-full">
            {boardOverlay}
            <StudyCanvas {...board} focusIds={spotlight} insets={INSETS} primaryId={owner} />
            <ActionDock ref={setDockEl} view={view} claimed={owner !== null} onContinue={runContinue} />
          </div>
          <div className="w-[360px] shrink-0 h-full border-l border-ss-line">
            <ChatMouthpiece {...chat} />
          </div>
        </div>
        {children}
      </div>
    </StageContext.Provider>
  )
}
