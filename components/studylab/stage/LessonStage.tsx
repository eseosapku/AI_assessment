'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { PathRail, type PathRailProps } from './PathRail'
import { OpeningCard } from './OpeningCard'
import ChatMouthpiece, { type ChatMouthpieceProps } from '../ChatMouthpiece'
import type { StudyCanvasProps } from '../StudyCanvas'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { focusIds, continueFor, dockModel, type ContinueTarget } from '@/lib/studylab/spotlight'
import { StageContext, type StageValue } from './StageContext'
import { ActionDock } from './ActionDock'
import { InkyDock } from './InkyDock'
import { TutorDrawer } from './TutorDrawer'
import { drawerKey } from '@/lib/studylab/drawerKey'

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
  rail: PathRailProps
  board: StudyCanvasProps
  chat: ChatMouthpieceProps
  /** Continue / Finish lesson: the lesson's way forward. */
  onAdvance: () => void
  /** Sends the learner to a card: the next question, the open check. */
  onFocus: (nodeId: string) => void
  /** The chat drawer, when the caller holds it (the demo opens it for a cue). */
  drawerOpen?: boolean
  onDrawerOpenChange?: (open: boolean) => void
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
  subjectKey, focus, rail, board, chat, onAdvance, onFocus, drawerOpen, onDrawerOpenChange, banner, boardOverlay, children,
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
  // A check with questions left: Inky keeps its chips to itself.
  const gating = continueFor(null, { ...flow, busy: false })?.kind === 'focus'
  const [viewTick, setViewTick] = useState(0)
  const onViewSettled = useCallback(() => setViewTick((t) => t + 1), [])
  // The chat drawer, closed by default.
  const [ownOpen, setOwnOpen] = useState(false)
  const open = drawerOpen ?? ownOpen
  const opener = useRef<HTMLElement | null>(null)
  const setOpen = useCallback(
    (next: boolean) => {
      if (next) opener.current = document.activeElement as HTMLElement | null
      if (onDrawerOpenChange) onDrawerOpenChange(next)
      else setOwnOpen(next)
      // Closing hands focus back to whatever opened it.
      if (!next) requestAnimationFrame(() => opener.current?.isConnected && opener.current.focus({ preventScroll: true }))
    },
    [onDrawerOpenChange],
  )
  const openChat = useCallback(() => setOpen(true), [setOpen])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const act = drawerKey({ key: e.key, target: t ? { tagName: t.tagName, isContentEditable: t.isContentEditable } : null, open })
      if (!act) return
      e.preventDefault()
      setOpen(act === 'open')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <StageContext.Provider value={stage}>
      <div className="ss-lesson h-screen w-full flex flex-col overflow-hidden" style={subjectStyle(subjectKey)}>
        {banner}
        <div className="flex min-h-0 flex-1">
          <PathRail {...rail} busy={rail.busy ?? chat.busy} />
          <div data-tour="lesson-board" className="relative flex-1 min-w-0 h-full">
            {boardOverlay}
            <OpeningCard
              title={rail.title}
              subject={rail.subject}
              messages={chat.messages}
              busy={chat.busy}
              defaultPace={chat.defaultPace}
              onAcceptPlan={chat.onAcceptPlan}
              onAnswerPlan={chat.onAnswerPlan}
              onStartHomework={chat.onStartHomework}
            />
            <StudyCanvas {...board} focusIds={spotlight} insets={INSETS} primaryId={owner} onViewSettled={onViewSettled} />
            <InkyDock
              messages={chat.messages}
              suggestions={chat.suggestions}
              busy={chat.busy}
              working={chat.working ?? 'Thinking…'}
              quiet={gating}
              hidden={open}
              focusIds={spotlight}
              viewTick={viewTick}
              onOpenChat={openChat}
              onAsk={(text) => chat.onSend(text)}
              onRetry={(action) => chat.onRetry?.(action)}
            />
            <ActionDock ref={setDockEl} view={view} claimed={owner !== null} onContinue={runContinue} />
          </div>
          <TutorDrawer open={open} onClose={() => setOpen(false)}>
            <ChatMouthpiece {...chat} onClose={() => setOpen(false)} focusInput={open} />
          </TutorDrawer>
        </div>
        {children}
      </div>
    </StageContext.Provider>
  )
}
