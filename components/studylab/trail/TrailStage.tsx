'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { LessonStageProps } from '../stage/LessonStage'
import { LessonTopBar } from '../stage/LessonTopBar'
import { OpeningCard } from '../stage/OpeningCard'
import ChatMouthpiece from '../ChatMouthpiece'
import { StageContext, type StageValue, type HelpRequest } from '../stage/StageContext'
import { ActionDock } from '../stage/ActionDock'
import { InkyDock } from '../stage/InkyDock'
import { TutorDrawer } from '../stage/TutorDrawer'
import { StationScene } from '../stage/StationScene'
import { LessonCompleteScene } from '../stage/LessonCompleteScene'
import { CanvasContext } from '../canvasShared'
import { TrailCanvas, type TrailCanvasHandle } from './TrailCanvas'
import { TrailPlacementContext, type TrailPlacement } from './TrailFrame'
import { useTrailModel } from './useTrailModel'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { continueFor, dockModel, cameraInsets, quietStage, type ContinueTarget } from '@/lib/studylab/spotlight'
import { drawerKey } from '@/lib/studylab/drawerKey'
import { settledSince, lessonFinished, lessonSummary } from '@/lib/studylab/scenes'
import { latestLine } from '@/lib/studylab/bubble'
import type { LessonRun } from '@/lib/studylab/lessonRun'

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

const NO_EPOCH = () => 0
const NOTHING_YET = () => {}
/** A card's resize handle works in the classic view's sizes; the Trail draws at its own scale. */
const NO_RESIZE = () => {}

/**
 * The Trail look of a lesson: the same props as the classic stage, and the same
 * lesson underneath. It has its own board, whose positions are worked out from
 * the run; its dock, chat and top bar are the classic ones for now.
 */
export default function TrailStage(props: LessonStageProps) {
  return (
    <ReactFlowProvider>
      <TrailStageInner {...props} />
    </ReactFlowProvider>
  )
}

function TrailStageInner(props: LessonStageProps) {
  const { subjectKey, rail, board, chat, onAdvance, onFocus, onHandIn, pointer = null, onShowNode, activeMs = 0, drawerOpen, onDrawerOpenChange, banner, boardOverlay, children, trail } = props
  const phone = usePhone()
  const model = useTrailModel(props)
  const { focusId, world } = model
  const canvas = useRef<TrailCanvasHandle>(null)
  const spotlight = useMemo(() => (focusId ? [focusId] : []), [focusId])

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

  // Get help on a card: the chat opens on the learner's question.
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

  // The dock: only the card in focus can ask for it.
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
  const prefer = useCallback(() => {}, [])
  const owner = focusId && claims.has(focusId) ? focusId : null

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
      look: 'trail',
    }),
    [dockEl, spotlight, owner, board.nodes, board.run, chat.busy, runContinue, claim, prefer, help],
  )
  const canvasValue = useMemo(
    () => ({
      onToggleGroup: board.onToggleGroup,
      onNodeDataChange: board.onNodeDataChange,
      onDeleteNode: board.onDeleteNode,
      onAskTutor: board.onAskTutor,
      onNodeResize: NO_RESIZE,
    }),
    [board.onToggleGroup, board.onNodeDataChange, board.onDeleteNode, board.onAskTutor],
  )
  const placementValue = useMemo<TrailPlacement>(
    () => ({ places: world.cards, onMeasure: model.onMeasure, onOpen: NOTHING_YET, onStation: NOTHING_YET, epochOf: NO_EPOCH }),
    [world.cards, model.onMeasure],
  )

  // A failed turn that can be sent again: the dock offers it.
  const last = latestLine(chat.messages)
  const failed = last?.retryAction ? (last.tone === 'refusal' ? 'refusal' : 'error') : null
  const view = dockModel({ ...flow, working: chat.working ?? 'Thinking…', failed })
  // A check with questions left: Inky keeps its chips to itself.
  const gating = continueFor(null, { ...flow, busy: false })?.kind === 'focus'
  const [viewTick, setViewTick] = useState(0)
  const onViewSettled = useCallback(() => setViewTick((t) => t + 1), [])

  // The moments worth marking, read off the run as it changes. A reload has no
  // previous run, so it never replays either.
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
      <CanvasContext.Provider value={canvasValue}>
        <TrailPlacementContext.Provider value={placementValue}>
          <div className="ss-lesson ss-trail ss-board-plain flex h-screen w-full flex-col overflow-hidden" style={subjectStyle(subjectKey)}>
            {banner}
            <LessonTopBar {...rail} busy={rail.busy ?? chat.busy} />
            <div className="flex min-h-0 flex-1">
              {/* The chat on the left; the board narrows beside it. */}
              <TutorDrawer open={open} onClose={() => setOpen(false)}>
                <ChatMouthpiece {...chat} onClose={() => setOpen(false)} focusInput={open} />
              </TutorDrawer>
              <div data-tour="lesson-board" data-stage-board className="relative h-full min-w-0 flex-1">
                {boardOverlay}
                <button
                  type="button"
                  onClick={trail?.onClassic}
                  className="absolute left-3 top-3 z-20 rounded-xl border border-ss-line bg-ss-panel px-3 py-2 text-[16px] font-semibold text-ss-ink shadow-ss-panel hover:border-ss-accent"
                >
                  Back to the classic look
                </button>
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
                <TrailCanvas ref={canvas} model={model} nodes={board.nodes} insets={phone ? INSETS_PHONE : INSETS} onCardPrompt={board.onCardPrompt} onViewSettled={onViewSettled} />
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
        </TrailPlacementContext.Provider>
      </CanvasContext.Provider>
    </StageContext.Provider>
  )
}
