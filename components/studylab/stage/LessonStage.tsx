'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { LessonTopBar, type LessonTopBarProps } from './LessonTopBar'
import { OpeningCard } from './OpeningCard'
import ChatMouthpiece, { type ChatMouthpieceProps } from '../ChatMouthpiece'
import type { StudyCanvasProps } from '../StudyCanvas'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { focusIds, continueFor, dockModel, cameraInsets, quietStage, type ContinueTarget } from '@/lib/studylab/spotlight'
import { StageContext, type StageValue, type HelpRequest } from './StageContext'
import { ActionDock } from './ActionDock'
import { InkyDock } from './InkyDock'
import { TutorDrawer } from './TutorDrawer'
import { drawerKey } from '@/lib/studylab/drawerKey'
import { settledSince, lessonFinished, lessonSummary } from '@/lib/studylab/scenes'
import { latestLine } from '@/lib/studylab/bubble'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import { StationScene } from './StationScene'
import { LessonCompleteScene } from './LessonCompleteScene'

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
  rail: LessonTopBarProps
  board: StudyCanvasProps
  chat: ChatMouthpieceProps
  /** Continue / Finish lesson: the lesson's way forward. */
  onAdvance: () => void
  /** Sends the learner to a card: the next question, the open check. */
  onFocus: (nodeId: string) => void
  /** Hands a finished check in again, when its hand-in never got through. */
  onHandIn?: () => void
  /** The part the latest turn pointed at, until the next turn. */
  pointer?: { nodeId: string; part?: string } | null
  /** Brings a card into view without changing what is in the spotlight. */
  onShowNode?: (nodeId: string) => void
  /** Time spent learning so far, for the lesson-complete scene. */
  activeMs?: number
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

const INSETS = cameraInsets(false)
const INSETS_PHONE = cameraInsets(true)

/** Below `sm`, where the dock stands on top of Inky instead of beside it. */
const PHONE = '(max-width: 639px)'
function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false)
}

/**
 * The lesson screen: the plan, the board and the tutor, laid out once.
 *
 * A real lesson and the demo both render this, so every control the demo
 * teaches is the control a real lesson has -- the two used to carry their own
 * copies of the layout, and drifted.
 */
export default function LessonStage({
  subjectKey, focus, rail, board, chat, onAdvance, onFocus, onHandIn, pointer = null, onShowNode, activeMs = 0, drawerOpen, onDrawerOpenChange, banner, boardOverlay, children,
}: LessonStageProps) {
  const phone = usePhone()
  const spotlight = useMemo(
    () => focusIds({ nodes: board.nodes, run: board.run, explicit: focus }),
    [board.nodes, board.run, focus],
  )

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

  // Get help on a card: the chat opens on the learner's question, and the
  // tutor gets their attempt to read back. Closing the chat hands focus back
  // to the Get help button that opened it.
  const onHelp = chat.onHelp
  const help = useMemo(
    () =>
      onHelp
        ? (nodeId: string, request: HelpRequest) => {
            setOpen(true)
            onHelp({ nodeId, ...request })
          }
        : undefined,
    [onHelp, setOpen],
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
      else if (target.kind === 'handIn') onHandIn?.()
      else onAdvance()
    },
    [onAdvance, onFocus, onHandIn],
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
      help,
    }),
    [dockEl, spotlight, owner, board.nodes, board.run, chat.busy, runContinue, claim, prefer, help],
  )
  // A failed turn that can be sent again: the dock offers it.
  const last = latestLine(chat.messages)
  const failed = last?.retryAction ? (last.tone === 'refusal' ? 'refusal' : 'error') : null
  const view = dockModel({ ...flow, working: chat.working ?? 'Thinking…', failed })
  // A check with questions left: Inky keeps its chips to itself.
  const gating = continueFor(null, { ...flow, busy: false })?.kind === 'focus'
  const [viewTick, setViewTick] = useState(0)
  const onViewSettled = useCallback(() => setViewTick((t) => t + 1), [])
  // The moments worth marking, read off the run as it changes: a station done
  // (a short stamp) and the lesson done (the summary over the whole board).
  // A reload has no previous run, so it never replays either.
  const prevRun = useRef<LessonRun | null>(null)
  const [stamp, setStamp] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  useEffect(() => {
    const prev = prevRun.current
    prevRun.current = board.run
    const done = settledSince(prev, board.run)
    if (lessonFinished(prev, board.run)) setSummaryOpen(true)
    else if (done.length > 0) setStamp(done[done.length - 1].title)
  }, [board.run])
  const clearStamp = useCallback(() => setStamp(null), [])
  const closeSummary = useCallback(() => setSummaryOpen(false), [])
  const finished = board.run?.phase === 'done'

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
        <LessonTopBar {...rail} busy={rail.busy ?? chat.busy} />
        <div className="flex min-h-0 flex-1">
          {/* The chat on the left, as Brilliant has it; the board narrows beside it. */}
          <TutorDrawer open={open} onClose={() => setOpen(false)}>
            <ChatMouthpiece {...chat} onClose={() => setOpen(false)} focusInput={open} />
          </TutorDrawer>
          <div data-tour="lesson-board" data-stage-board className="relative flex-1 min-w-0 h-full">
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
            <StudyCanvas {...board} focusIds={spotlight} insets={phone ? INSETS_PHONE : INSETS} primaryId={owner} onViewSettled={onViewSettled} overview={finished} />
            <InkyDock
              messages={chat.messages}
              suggestions={chat.suggestions}
              busy={chat.busy}
              working={chat.working ?? 'Thinking…'}
              quiet={gating || quietStage(board.run ?? null)}
              hidden={open}
              focusIds={spotlight}
              viewTick={viewTick}
              onOpenChat={openChat}
              onAsk={(text) => (chat.onChip ? chat.onChip(text) : chat.onSend(text))}
              onRetry={(action) => chat.onRetry?.(action)}
              pointer={pointer}
              onReveal={onShowNode}
            />
            <ActionDock
              ref={setDockEl}
              view={view}
              claimed={owner !== null}
              onContinue={runContinue}
              onSummary={() => setSummaryOpen(true)}
              onProveIt={chat.onProveIt}
              provingIt={chat.provingIt}
              onRetry={last?.retryAction ? () => chat.onRetry?.(last.retryAction!) : undefined}
            />
            <StationScene title={stamp} onDone={clearStamp} />
            {finished && summaryOpen && board.run && (
              <LessonCompleteScene
                title={rail.title}
                summary={lessonSummary(board.run, board.nodes, activeMs)}
                before={chat.before}
                onProveIt={chat.onProveIt}
                provingIt={chat.provingIt}
                proveUpdatesGapMap={chat.proveUpdatesGapMap}
                onClose={closeSummary}
              />
            )}
          </div>
        </div>
        {children}
      </div>
    </StageContext.Provider>
  )
}
