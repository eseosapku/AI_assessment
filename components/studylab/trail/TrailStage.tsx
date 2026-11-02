'use client'

import { MessageSquareText } from 'lucide-react'
import { KanaLive } from './KanaLive'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { LessonStageProps } from '../stage/LessonStage'
import ChatMouthpiece from '../ChatMouthpiece'
import { Kana } from '../kana/Kana'
import { StageContext, type StageValue, type HelpRequest } from '../stage/StageContext'
import { LessonCompleteScene } from '../stage/LessonCompleteScene'
import { CanvasContext } from '../canvasShared'
import { CARD_ACTIONS } from '../StudyCanvas'
import { FiledCardsList } from './FiledCardsList'
import { KanaOnBoard } from './KanaOnBoard'
import { TrailCanvas, type TrailCanvasHandle } from './TrailCanvas'
import { TrailChatPanel } from './TrailChatPanel'
import { ThroughTheSquare } from './ThroughTheSquare'
import { TrailDock } from './TrailDock'
import { TrailOpeningControls } from './TrailOpeningControls'
import { TrailTopBar } from './TrailTopBar'
import { TrailPlacementContext, type TrailPlacement } from './TrailFrame'
import { TrailRibbon } from './TrailRibbon'
import { useTrailModel } from './useTrailModel'
import { trailAction, trailContinue } from '@/lib/studylab/trail/action'
import { checkSteps } from '@/lib/studylab/trail/answerStyle'
import { showsDetourFooter } from '@/lib/studylab/trail/detours'
import { canRetry } from '@/lib/studylab/trail/lookBack'
import { escapeTarget, stationPills, topBarLabel } from '@/lib/studylab/trail/furniture'
import { nextQuestion, openingChips, openingInsets, planFrom } from '@/lib/studylab/trail/opening'
import { cardTitle } from '@/lib/studylab/trail/placement'
import { bubbleLine, lineTone, withDisplayLines } from '@/lib/studylab/trail/voice'
import type { BarModel } from '@/lib/studylab/checkBarModel'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { continueFor, dockModel, cameraInsets, quietStage, type ContinueTarget } from '@/lib/studylab/spotlight'
import { drawerKey } from '@/lib/studylab/drawerKey'
import { lessonFinished, lessonSummary } from '@/lib/studylab/scenes'
import { playSound } from '@/lib/studylab/sound'
import { focusWidthFor, journeyFrame, RIBBON_ROOM } from '@/lib/studylab/trail/camera'
import { latestLine } from '@/lib/studylab/bubble'
import type { LessonRun } from '@/lib/studylab/lessonRun'
import type { Rect } from '@/lib/studylab/trail/types'

const INSETS = cameraInsets(false)
const INSETS_PHONE = cameraInsets(true)
/** The ribbon hangs under the top bar: the camera keeps the card clear of it. */

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
function subscribeWidth(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}
/** The top bar and the button: what is left of the screen for a card goes between them. */
const CHROME_H = 64 + 110
/** With the chat open the board sits in a frame, this much clear of the page. */
const DRAWER_MARGINS = 24
/** Said once her questions about the plan are answered. */
const PLAN_READY = 'Your plan is ready. Change anything you like, or start when you are.'

function useViewportHeight(): number {
  const [height, setHeight] = useState(() => (typeof window === 'undefined' ? 900 : window.innerHeight))
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return height
}

function useViewportWidth(): number {
  return useSyncExternalStore(subscribeWidth, () => window.innerWidth, () => DESKTOP_WIDTH)
}

const DESKTOP_WIDTH = 1440
/** A station flown to is seen whole, even a big one. */
const PLOT_ZOOM = 0.35
/** On a phone a card is always at full size, and moved with a finger. */
const FULL_SIZE = 1
const PHONE_KANA = 64
const NOTHING = () => {}
const NOTE_CHIPS = ['Look again', 'Keep going']
const NO_CONTINUE = () => null
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
  const baseInsets = phone ? INSETS_PHONE : INSETS
  const focusWidth = focusWidthFor(useViewportWidth())
  // The chat drawer, closed by default.
  const [ownOpen, setOwnOpen] = useState(false)
  const open = drawerOpen ?? ownOpen
  // A phone has no room on the board for Kana: she stands on the screen, above the
  // button. With the chat open she is at its foot, so the card has the whole board.
  const viewportH = useViewportHeight()
  const trailView = useMemo(() => ({ focusWidth, speaker: !phone && !open, focusRoom: phone ? undefined : viewportH - CHROME_H - (open ? DRAWER_MARGINS : 0) }), [focusWidth, phone, open, viewportH])
  const model = useTrailModel(props, trailView)
  const { focusId, world, nextInQueue, say, lines, lookBack, epochOf, dataOf, sandboxFor } = model
  const lookingBack = lookBack?.id ?? null
  const detourOpen = model.detour
  const canvas = useRef<TrailCanvasHandle>(null)
  const spotlight = useMemo(() => (focusId ? [focusId] : []), [focusId])

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
  const dockCard = lookingBack ?? focusId
  const owner = dockCard && claims.has(dockCard) ? dockCard : null

  const flow = { nodes: board.nodes, run: board.run, busy: chat.busy }
  const { moveOn } = model
  const runContinue = useCallback(
    (target: ContinueTarget) => {
      moveOn()
      if (target.kind === 'focus') onFocus(target.nodeId)
      else if (target.kind === 'handIn') onHandIn?.()
      else onAdvance()
    },
    [moveOn, onAdvance, onFocus, onHandIn],
  )
  const sayLine = useCallback((text: string, tone: BarModel['tone']) => say(text, lineTone(tone)), [say])
  const stage = useMemo<StageValue>(
    () =>
      lookingBack
        ? // A reopened card's bar comes to the dock with no Continue, and it can call no tutor.
          { dockEl, focus: new Set([lookingBack]), owner, continueFor: NO_CONTINUE, runContinue: NOTHING, claim, prefer, look: 'trail' }
        : {
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
          },
    [lookingBack, dockEl, spotlight, owner, board.nodes, board.run, chat.busy, nextInQueue, runContinue, claim, prefer, help, sayLine],
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
  const { onCardPrompt } = board
  const onDeeper = useCallback(
    (id: string, title: string) => {
      // The card menu's own words, so it arrives as an ordinary question.
      const deeper = CARD_ACTIONS[0]
      onCardPrompt(`Focusing on the card "${title}" (card id: ${id}): ${deeper.text}`, `${deeper.label} — ${title}`)
    },
    [onCardPrompt],
  )
  // A detour card ends with "Did that clear it up?", once nothing more of it waits.
  const focusNode = focusId ? board.nodes.find((n) => n.id === focusId) : undefined
  const footerShown = showsDetourFooter({ detourOpen: !!model.detour, nextInQueue, claimed: owner !== null, settled: !!focusNode && canRetry(focusNode.data), busy: chat.busy })
  const { leaveDetour, stillNotSure } = model
  const openChatPanel = useCallback(() => setOpen(true), [setOpen])
  const detourFooter = useMemo(
    () => (footerShown ? { backTo: 'my card', onBack: leaveDetour, onStillNotSure: stillNotSure, onAnother: openChatPanel } : null),
    [footerShown, leaveDetour, stillNotSure, openChatPanel],
  )
  const plotsRef = useRef(world.plots)
  plotsRef.current = world.plots
  const flyToStation = useCallback((index: number) => {
    const plot = plotsRef.current[index]
    if (plot) canvas.current?.flyTo(plot.rect, { minZoom: PLOT_ZOOM })
  }, [])
  const checkStep = useMemo(() => checkSteps(board.nodes, board.run, focusId), [board.nodes, board.run, focusId])
  const placementValue = useMemo<TrailPlacement>(
    () => ({ places: world.cards, onMeasure: model.onMeasure, onOpen: model.open, onStation: flyToStation, onDeeper, lookingBack, checkStep, pointer, epochOf, dataOf, sandboxFor, onNote: model.showNote }),
    [world.cards, model.onMeasure, model.open, flyToStation, onDeeper, lookingBack, checkStep, pointer, epochOf, dataOf, sandboxFor, model.showNote],
  )

  // A failed turn that can be sent again: the dock offers it.
  const last = latestLine(chat.messages)
  const failed = last?.retryAction ? (last.tone === 'refusal' ? 'refusal' : 'error') : null
  const view = dockModel({ ...flow, working: chat.working ?? 'Thinking…', failed })
  const focusType = focusId ? (board.nodes.find((n) => n.id === focusId)?.type ?? null) : null
  const action = trailAction({ view, claimed: owner !== null, run: board.run, focusType, nextInQueue, interlude: model.interlude, lookBack: lookBack ? { canRetry: canRetry(lookBack.data) } : null, detourFooter: footerShown })
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

  // On a card just answered, what was said about it stands until the learner moves on.
  const answered = !!focusNode && canRetry(focusNode.data)
  const said = bubbleLine(chat.messages, lines, { busy: chat.busy, working: chat.working ?? 'Thinking…', holding: model.holding || (chat.busy && answered), focus: focusId })
  const asking = planning && !chat.busy && !failed
  // A parked question brought up again takes the bubble until it is answered.
  const noteLine = !chat.busy && model.note ? { key: `note:${model.note.id}`, text: `Before we go on: you parked "${model.note.question}". Want another look?`, more: false, tone: 'say' as const } : null
  const line = noteLine ?? (asking ? { key: question ? `q:${question}` : 'plan-ready', text: question ?? PLAN_READY, more: false, tone: 'say' as const } : said)
  const chips = noteLine
    ? NOTE_CHIPS
    : asking
    ? question
      ? openingChips(question)
      : []
    : !chat.busy && !open && !gating && !model.holding && !quietStage(board.run ?? null)
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

  // The end of the lesson, read off the run as it changes; or the lesson opened
  // already finished, which shows its summary too. A station's end has no previous
  // run on a reload, so it never replays.
  const finished = board.run?.phase === 'done'
  const prevRun = useRef<LessonRun | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(finished)
  useEffect(() => {
    const prev = prevRun.current
    prevRun.current = board.run
    if (lessonFinished(prev, board.run)) setSummaryOpen(true)
  }, [board.run])
  const closeSummary = useCallback(() => setSummaryOpen(false), [])

  // A station done: a sound, Kana's hop, and the camera pulled back to show the journey.
  const interlude = model.interlude
  const interludeKey = interlude ? `${interlude.done}-${interlude.next}` : null
  useEffect(() => {
    if (interludeKey) playSound('complete')
  }, [interludeKey])
  // On a phone the opening frames the lesson's name: the whole journey would be too small to read.
  const restFrame = useMemo(
    () => (interlude ? journeyFrame(world, interlude.done, interlude.next) : phone && board.run?.phase === 'planning' ? world.title : null),
    [interlude, world, phone, board.run?.phase],
  )

  const openChat = useCallback(() => setOpen(true), [setOpen])
  const [menuOpen, setMenuOpen] = useState(false)

  // Looking back: the camera goes to the card and the keyboard follows; Back
  // returns both to the card the learner was on.
  const cardsRef = useRef(world.cards)
  cardsRef.current = world.cards
  const lookOpener = useRef<HTMLElement | null>(null)
  const phoneRef = useRef(phone)
  phoneRef.current = phone
  useEffect(() => {
    if (!lookingBack) return
    lookOpener.current = document.activeElement as HTMLElement | null
    const rect = cardsRef.current[lookingBack]
    if (rect) canvas.current?.flyTo(rect, phoneRef.current ? { minZoom: FULL_SIZE } : undefined)
    const raf = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(lookingBack)}"]`)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [lookingBack])
  const { closeLookBack } = model
  const backFromLooking = useCallback(() => {
    closeLookBack()
    canvas.current?.flyToFocus()
    requestAnimationFrame(() => lookOpener.current?.isConnected && lookOpener.current.focus({ preventScroll: true }))
  }, [closeLookBack])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open menu is on top: its own Esc closes it, and the chat stays as it is.
      const closes = e.key === 'Escape' ? escapeTarget({ menuOpen, chatOpen: open, lookBack: !!lookingBack, detourOpen: !!detourOpen }) : null
      if (closes === 'menu') return
      if (closes === 'lookBack') {
        backFromLooking()
        return
      }
      if (closes === 'detour') {
        if (!chat.busy) leaveDetour()
        return
      }
      const t = e.target as HTMLElement | null
      const act = drawerKey({ key: e.key, target: t ? { tagName: t.tagName, isContentEditable: t.isContentEditable } : null, open })
      if (!act) return
      e.preventDefault()
      setOpen(act === 'open')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen, menuOpen, lookingBack, backFromLooking, detourOpen, leaveDetour, chat.busy])

  // Thumbnails take no Tab stop, so the keyboard reaches them through a list.
  const filed = useMemo(() => {
    const byId = new Map(board.nodes.map((n) => [n.id, n]))
    const entry = (id: string, station: string) => {
      const n = byId.get(id)
      return n ? [{ id, title: cardTitle(n), station }] : []
    }
    return [
      ...model.placement.stations.flatMap((s) => [...s.finished, ...s.filed].flatMap((c) => entry(c.id, s.title))),
      ...model.placement.detours.flatMap((d) => d.filed.flatMap((c) => entry(c.id, 'Detour'))),
    ]
  }, [board.nodes, model.placement.stations, model.placement.detours])

  return (
    <StageContext.Provider value={stage}>
      <CanvasContext.Provider value={canvasValue}>
        <TrailPlacementContext.Provider value={placementValue}>
          <div className={`ss-lesson ss-trail ss-board-plain flex h-screen w-full flex-col overflow-hidden${phone ? ' ss-trail-phone' : ''}`} style={{ ...subjectStyle(subjectKey), '--trail-card-w': `${focusWidth}px` } as CSSProperties}>
            {banner}
            <div className="flex min-h-0 flex-1">
              {/* The chat on the left; the board narrows beside it. */}
              <TrailChatPanel open={open} onClose={() => setOpen(false)}>
                <ChatMouthpiece {...chat} messages={shownMessages} onSend={sendFromChat} look="trail" onClose={() => setOpen(false)} focusInput={open} />
              </TrailChatPanel>
              <div data-tour="lesson-board" data-stage-board className={`relative h-full min-w-0 flex-1${open ? ' ss-trail-framed' : ''}`}>
                {boardOverlay}
                <TrailCanvas ref={canvas} model={model} nodes={board.nodes} insets={planning && !phone ? openingInsets(baseInsets) : lookBack || detourOpen ? { ...baseInsets, top: baseInsets.top + RIBBON_ROOM } : baseInsets} onCardPrompt={board.onCardPrompt} focusMinZoom={phone ? FULL_SIZE : undefined} heading={heading} restFrame={restFrame} opening={planning}>
                  <KanaOnBoard
                    world={world}
                    focusId={focusId}
                    line={line}
                    chips={chips}
                    hidden={open || !!lookingBack || finished}
                    inChat={open && !phone}
                    steppedBack={!!lookingBack}
                    cheer={interludeKey}
                    celebrating={finished}
                    band={planning || phone}
                    bandKana={phone ? PHONE_KANA : undefined}
                    onAskBand={phone ? openChat : undefined}
                    pointer={pointer}
                    onMore={openChat}
                    onChip={(text) => (noteLine ? model.settleNote(text === NOTE_CHIPS[0]) : asking ? answerPlan(text) : chat.onChip ? chat.onChip(text) : chat.onSend(text))}
                    extra={
                      asking && question ? (
                        <button type="button" className="ss-trail-more" onClick={openChat}>
                          Type an answer
                        </button>
                      ) : undefined
                    }
                    onShowCard={showCard}
                    onSpeechHeight={model.setSpeechHeight}
                  />
                </TrailCanvas>
                <TrailDock
                  ref={setDockEl}
                  action={action}
                  waiting={chat.busy && answered && action.kind === 'bar' ? 'Getting your next card…' : null}
                  footer={detourFooter}
                  onContinue={runContinue}
                  onGoToStation={model.endInterlude}
                  onStart={() => chat.onAcceptPlan?.('step')}
                  onTryAgain={model.tryAgain}
                  secondary={plan ? <TrailOpeningControls onAnswer={answerPlan} /> : undefined}
                  onSummary={() => setSummaryOpen(true)}
                  onProveIt={chat.onProveIt}
                  provingIt={chat.provingIt}
                  onRetry={last?.retryAction ? () => chat.onRetry?.(last.retryAction!) : undefined}
                />
                {!open && (
                  <div className="ss-trail-ask">
                    <KanaLive pose="happy" size={140} label="Ask Kana" onPoke={openChat} crop />
                    <button type="button" onClick={openChat} aria-label="Ask Kana" title="Ask Kana" className="ss-trail-ask-pill">
                      <MessageSquareText className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                )}
                <TrailTopBar
                  pills={stationPills(board.run, plan?.steps)}
                  label={topBarLabel({ run: board.run, lookingBack: lookBack?.title ?? null, detourOpen: !!detourOpen }) || rail.title}
                  plots={world.plots}
                  canClassic={!!trail?.onClassic}
                  onLeave={rail.onBack}
                  onStation={(plot) => canvas.current?.flyTo(plot.rect, { minZoom: PLOT_ZOOM })}
                  onWholeBoard={() => canvas.current?.showAll()}
                  onBackToCard={() => canvas.current?.flyToFocus()}
                  onAddBlock={(type) => board.onAddBlock(type)}
                  onClassic={trail?.onClassic}
                  onMenuChange={setMenuOpen}
                />
                {lookBack ? (
                  <TrailRibbon kind="lookBack" text={`Looking back: ${lookBack.title}`} onBack={backFromLooking} />
                ) : detourOpen ? (
                  <TrailRibbon kind="detour" text={`You were on: ${world.plots[detourOpen.station]?.title ?? 'your station'}`} onBack={leaveDetour} waiting={chat.busy} />
                ) : null}
                <FiledCardsList items={filed} onOpen={model.open} />
                {finished && summaryOpen && board.run && (
                  <LessonCompleteScene
                    title={rail.title}
                    summary={lessonSummary(board.run, board.nodes, activeMs)}
                    before={chat.before}
                    onProveIt={chat.onProveIt}
                    provingIt={chat.provingIt}
                    proveFailed={chat.proveFailed}
                    proveUpdatesGapMap={chat.proveUpdatesGapMap}
                    onClose={closeSummary}
                    mascot={<Kana pose="celebrate" size={84} />}
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
