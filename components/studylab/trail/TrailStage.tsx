'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { LessonStageProps } from '../stage/LessonStage'
import ChatMouthpiece from '../ChatMouthpiece'
import { Kana } from '../kana/Kana'
import { StageContext, type StageValue, type HelpRequest } from '../stage/StageContext'
import { StationScene } from '../stage/StationScene'
import { LessonCompleteScene } from '../stage/LessonCompleteScene'
import { CanvasContext } from '../canvasShared'
import { FiledCardsList } from './FiledCardsList'
import { KanaOnBoard } from './KanaOnBoard'
import { TrailCanvas, type TrailCanvasHandle } from './TrailCanvas'
import { TrailChatPanel } from './TrailChatPanel'
import { ThroughTheSquare } from './ThroughTheSquare'
import { TrailDock } from './TrailDock'
import { TrailOpeningControls } from './TrailOpeningControls'
import { TrailTopBar } from './TrailTopBar'
import { TrailPlacementContext, type TrailPlacement } from './TrailFrame'
import { useTrailModel } from './useTrailModel'
import { trailAction, trailContinue } from '@/lib/studylab/trail/action'
import { escapeTarget, stationPills, topBarLabel } from '@/lib/studylab/trail/furniture'
import { nextQuestion, openingChips, openingInsets, planFrom } from '@/lib/studylab/trail/opening'
import { cardTitle } from '@/lib/studylab/trail/placement'
import { bubbleLine, lineTone, withDisplayLines } from '@/lib/studylab/trail/voice'
import type { BarModel } from '@/lib/studylab/checkBarModel'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { continueFor, dockModel, cameraInsets, quietStage, type ContinueTarget } from '@/lib/studylab/spotlight'
import { drawerKey } from '@/lib/studylab/drawerKey'
import { settledSince, lessonFinished, lessonSummary } from '@/lib/studylab/scenes'
import { latestLine } from '@/lib/studylab/bubble'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import type { Rect } from '@/lib/studylab/trail/types'

const INSETS = cameraInsets(false)
const INSETS_PHONE = cameraInsets(true)

/** Below `sm`. */
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
 * the run, one button, Kana on the board, and three pills along the top.
 */
export default function TrailStage(props: LessonStageProps) {
  return (
    <ReactFlowProvider>
      <TrailStageInner {...props} />
    </ReactFlowProvider>
  )
}

function TrailStageInner(props: LessonStageProps) {
  const { subjectKey, rail, board, chat, onAdvance, onFocus, onHandIn, pointer = null, activeMs = 0, drawerOpen, onDrawerOpenChange, banner, boardOverlay, children, trail } = props
  const phone = usePhone()
  const model = useTrailModel(props)
  const { focusId, world, nextInQueue, say, lines } = model
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
  const sayLine = useCallback((text: string, tone: BarModel['tone']) => say(text, lineTone(tone)), [say])
  const stage = useMemo<StageValue>(
    () => ({
      dockEl,
      focus: new Set(spotlight),
      owner,
      continueFor: (nodeId) => trailContinue(nodeId, { nodes: board.nodes, run: board.run, busy: chat.busy }, nextInQueue),
      runContinue,
      claim,
      prefer,
      help,
      look: 'trail',
      sayLine,
    }),
    [dockEl, spotlight, owner, board.nodes, board.run, chat.busy, nextInQueue, runContinue, claim, prefer, help, sayLine],
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
  const focusType = focusId ? (board.nodes.find((n) => n.id === focusId)?.type ?? null) : null
  const action = trailAction({ view, claimed: owner !== null, run: board.run, focusType, nextInQueue, interlude: model.interlude, lookBack: null, detourFooter: false })
  // A check with questions left: Kana keeps the chips to herself.
  const gating = continueFor(null, { ...flow, busy: false })?.kind === 'focus'
  // The opening: the plan on the table, and Kana asking its questions one at a time.
  const planning = board.run?.phase === 'planning'
  const plan = useMemo(() => (planning ? planFrom(chat.messages) : null), [planning, chat.messages])
  const [asked, setAsked] = useState<ReadonlySet<string>>(new Set())
  const question = plan ? nextQuestion(plan.questions, asked) : null
  const answerPlan = useCallback(
    (answer: string) => {
      if (question) setAsked((prev) => new Set(prev).add(question))
      chat.onAnswerPlan?.(answer)
    },
    [question, chat],
  )
  const [intro, setIntro] = useState(planning)
  const endIntro = useCallback(() => setIntro(false), [])

  const said = bubbleLine(chat.messages, lines, { busy: chat.busy, working: chat.working ?? 'Thinking…' })
  const asking = planning && !chat.busy && !failed
  const line = asking ? (question ? { key: `q:${question}`, text: question, more: false, tone: 'say' as const } : null) : said
  const chips = asking
    ? question
      ? openingChips(question)
      : []
    : !chat.busy && !open && !gating && !quietStage(board.run ?? null)
      ? chat.suggestions.slice(0, 3)
      : []
  const shownMessages = useMemo(() => withDisplayLines(chat.messages, lines), [chat.messages, lines])
  // While a plan is on the table, what is typed in the chat answers it, as the classic plan card's box does.
  const sendFromChat = useCallback<typeof chat.onSend>(
    (text, opts) => {
      if (plan && !opts?.silent && text.trim()) answerPlan(text.trim())
      else chat.onSend(text, opts)
    },
    [plan, answerPlan, chat],
  )
  const heading = useMemo(() => ({ title: rail.title, subject: rail.subject }), [rail.title, rail.subject])
  const showCard = useCallback((rect: Rect) => canvas.current?.flyTo(rect), [])

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
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open menu is on top: its own Esc closes it, and the chat stays as it is.
      if (e.key === 'Escape' && escapeTarget({ menuOpen, chatOpen: open, lookBack: false, detourOpen: false }) === 'menu') return
      const t = e.target as HTMLElement | null
      const act = drawerKey({ key: e.key, target: t ? { tagName: t.tagName, isContentEditable: t.isContentEditable } : null, open })
      if (!act) return
      e.preventDefault()
      setOpen(act === 'open')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen, menuOpen])

  // Thumbnails take no Tab stop, so the keyboard reaches them through a list.
  const filed = useMemo(() => {
    const byId = new Map(board.nodes.map((n) => [n.id, n]))
    return model.placement.stations.flatMap((s) =>
      [...s.finished, ...s.filed].flatMap((c) => {
        const n = byId.get(c.id)
        return n ? [{ id: c.id, title: cardTitle(n), station: s.title }] : []
      }),
    )
  }, [board.nodes, model.placement.stations])

  return (
    <StageContext.Provider value={stage}>
      <CanvasContext.Provider value={canvasValue}>
        <TrailPlacementContext.Provider value={placementValue}>
          <div className="ss-lesson ss-trail ss-board-plain flex h-screen w-full flex-col overflow-hidden" style={subjectStyle(subjectKey)}>
            {banner}
            <div className="flex min-h-0 flex-1">
              {/* The chat on the left; the board narrows beside it. */}
              <TrailChatPanel open={open}>
                <ChatMouthpiece {...chat} messages={shownMessages} onSend={sendFromChat} look="trail" onClose={() => setOpen(false)} focusInput={open} />
              </TrailChatPanel>
              <div data-tour="lesson-board" data-stage-board className="relative h-full min-w-0 flex-1">
                {boardOverlay}
                <TrailCanvas ref={canvas} model={model} nodes={board.nodes} insets={planning ? openingInsets(phone ? INSETS_PHONE : INSETS) : phone ? INSETS_PHONE : INSETS} onCardPrompt={board.onCardPrompt} heading={heading} opening={planning}>
                  <KanaOnBoard
                    world={world}
                    focusId={focusId}
                    line={line}
                    chips={chips}
                    hidden={open}
                    band={planning}
                    pointer={pointer}
                    onMore={openChat}
                    onChip={(text) => (asking ? answerPlan(text) : chat.onChip ? chat.onChip(text) : chat.onSend(text))}
                    extra={
                      asking && question ? (
                        <button type="button" className="ss-trail-more" onClick={openChat}>
                          Type an answer
                        </button>
                      ) : undefined
                    }
                    onShowCard={showCard}
                  />
                </TrailCanvas>
                <TrailDock
                  ref={setDockEl}
                  action={action}
                  onContinue={runContinue}
                  onGoToStation={model.endInterlude}
                  onStart={() => chat.onAcceptPlan?.('step')}
                  secondary={plan ? <TrailOpeningControls onAnswer={answerPlan} /> : undefined}
                  onSummary={() => setSummaryOpen(true)}
                  onProveIt={chat.onProveIt}
                  provingIt={chat.provingIt}
                  onRetry={last?.retryAction ? () => chat.onRetry?.(last.retryAction!) : undefined}
                />
                <button
                  type="button"
                  onClick={openChat}
                  aria-label="Ask Kana"
                  className="ss-press absolute bottom-5 left-4 z-30 inline-flex min-h-[52px] items-center gap-2 rounded-full border border-ss-line bg-ss-panel px-3 pr-4 text-[16px] font-bold text-ss-ink shadow-ss-panel"
                >
                  <Kana simple pose="happy" size={34} />
                  <span>Ask Kana</span>
                </button>
                <TrailTopBar
                  pills={stationPills(board.run, plan?.steps)}
                  label={topBarLabel({ run: board.run, lookingBack: null, detourOpen: false }) || rail.title}
                  plots={world.plots}
                  canClassic={!!trail?.onClassic}
                  onLeave={rail.onBack}
                  onStation={(plot) => canvas.current?.flyTo(plot.rect)}
                  onWholeBoard={() => canvas.current?.showAll()}
                  onBackToCard={() => canvas.current?.flyToFocus()}
                  onAddBlock={(type) => board.onAddBlock(type)}
                  onClassic={trail?.onClassic}
                  onMenuChange={setMenuOpen}
                />
                <FiledCardsList items={filed} onOpen={NOTHING_YET} />
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
            {intro && <ThroughTheSquare onDone={endIntro} />}
          </div>
        </TrailPlacementContext.Provider>
      </CanvasContext.Provider>
    </StageContext.Provider>
  )
}
