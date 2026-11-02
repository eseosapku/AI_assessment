'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { LessonStageProps } from '../stage/LessonStage'
import { FOCUS_W, trailLayout } from '@/lib/studylab/trail/layout'
import { blockSize } from '@/lib/studylab/blocks'
import { absorbTurn, backFromDetour, dueNotes, loadMemory, memoryKey, onAskAnswered, pruneMemory, saveMemory, stillNotSure as nextApproach, type Detour, type TrailMemory, type UnsureNote } from '@/lib/studylab/trail/detours'
import { interludeFrom } from '@/lib/studylab/trail/action'
import { canRetry, freshAttempt, openLookBack, sandboxCallbacks, type LookBack } from '@/lib/studylab/trail/lookBack'
import type { StudyNodeData } from '@/lib/studylab/types'
import { KANA_TALL, planFrom } from '@/lib/studylab/trail/opening'
import { assignBlocks, placeCards, reminderOf, trailSpotlight, type Placement } from '@/lib/studylab/trail/placement'
import { focusOf, holdOn, pinnedFocus, syncQueue, withHold, type QueueState } from '@/lib/studylab/trail/queue'
import type { Size, TrailWorld } from '@/lib/studylab/trail/types'
import type { DisplayLine } from '@/lib/studylab/trail/voice'

export interface TrailModel {
  world: TrailWorld
  placement: Placement
  queue: QueueState | null
  focusId: string | null
  waiting: string[]
  /** The next card of the burst, reached with no tutor call. */
  nextInQueue: string | null
  /** Between stations: the one just finished, and the one the button goes to. */
  interlude: { done: number; next: number } | null
  endInterlude: () => void
  /** Check feedback Kana has said. Shown, and never written to the history the tutor sees. */
  lines: DisplayLine[]
  say: (text: string, tone: DisplayLine['tone']) => void
  /** A finished card opened again, on a copy. */
  lookBack: LookBack | null
  sandboxFor: (id: string, epoch: number) => ReturnType<typeof sandboxCallbacks> | null
  open: (id: string) => void
  closeLookBack: () => void
  tryAgain: () => void
  epochOf: (id: string) => number
  dataOf: (id: string) => StudyNodeData | null
  /** The branch the learner is on. */
  detour: Detour | null
  leaveDetour: () => void
  stillNotSure: () => void
  /** Staying on a card just answered, with what comes next waiting behind it. */
  holding: boolean
  /** The learner has finished with this card. */
  moveOn: () => void
  /** How much room what Kana is saying takes, so the card sits clear of it. */
  setSpeechHeight: (height: number) => void
  /** A parked question being brought up again. */
  note: UnsureNote | null
  showNote: (station: number) => void
  settleNote: (again: boolean) => void
  /** The cards' own sizes, as drawn. They place cards here and nowhere else. */
  sizes: Record<string, Size>
  onMeasure: (id: string, size: Size) => void
}

const PARKED = "Let's park this and keep going; it often clicks after the next part."

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readMemory(spaceId: string | undefined): string | null {
  if (!spaceId) return null
  try {
    return storage()?.getItem(memoryKey(spaceId)) ?? null
  } catch {
    return null
  }
}

/**
 * Everything the Trail shows, derived from the lesson's own state on each render:
 * the same run always gives the same board, and none of it is saved.
 */
export function useTrailModel(props: LessonStageProps, view: { focusWidth: number; speaker: boolean; focusRoom?: number } = { focusWidth: FOCUS_W, speaker: true }): TrailModel {
  const { focusWidth, speaker, focusRoom } = view
  const { board, focus, chat, onFocus, trail } = props
  const { nodes, run } = board
  const spaceId = trail?.spaceId
  const currentStep = run?.currentStep ?? 0

  // What this browser remembers of the run: detours, parked questions, where in a burst the learner was.
  const [loaded] = useState(() => {
    const memory = loadMemory(readMemory(spaceId))
    // A reload keeps the learner's place, if that card is still theirs to be on.
    const saved = focusOf(memory.queue)
    const card = saved ? nodes.find((n) => n.id === saved && !n.hidden) : undefined
    const onDetour = memory.detours.find((d) => d.id === memory.open)?.cardIds.includes(saved ?? '') ?? false
    const belongs = !!card && (onDetour || Number(card.data.step) === currentStep + 1)
    return { memory, restored: belongs ? saved : null }
  })
  const [storedMemory, setMemory] = useState<TrailMemory>(loaded.memory)
  const memoryRef = useRef(storedMemory)

  // A turn while on a closed detour's cards never falls back to them.
  const skip = useMemo(() => new Set(storedMemory.detours.filter((d) => d.id !== storedMemory.open).flatMap((d) => d.cardIds)), [storedMemory])
  const explicit = focus.length > 0 ? focus : loaded.restored ? [loaded.restored] : focus
  const spotlight = useMemo(() => trailSpotlight({ nodes, run, explicit, skip }), [nodes, run, explicit, skip])
  const [held, setHeld] = useState<QueueState | null>(loaded.restored ? loaded.memory.queue : null)

  // A question answered with cards opens a detour, once for each answer, with the
  // queue as it stood before those cards took the focus.
  const ask = trail?.lastAsk ?? null
  const [seenAsk, setSeenAsk] = useState(ask?.version ?? 0)
  let memory = storedMemory
  if (ask && ask.version !== seenAsk) {
    setSeenAsk(ask.version)
    memory = onAskAnswered(memory, ask, { station: Math.max(0, currentStep), queue: held })
  }
  // Work arriving from anywhere else waits: the learner stays on the detour.
  const openOne = memory.detours.find((d) => d.id === memory.open) ?? null
  const away = !!openOne && spotlight.length > 0 && !spotlight.every((id) => openOne.cardIds.includes(id))
  memory = absorbTurn(memory, spotlight)
  if (memory !== storedMemory) setMemory(memory)
  memoryRef.current = memory

  const synced = away ? held : syncQueue(held, spotlight)
  if (synced !== held) setHeld(synced)

  const [hold, setHold] = useState<string | null>(null)
  const [movedOn, setMovedOn] = useState<string | null>(null)
  const was = focusOf(held)
  const wasNode = was ? nodes.find((n) => n.id === was) : undefined
  const asked = hold ?? holdOn({ from: was, queue: synced, settled: !!wasNode && canRetry(wasNode.data), movedOn, detour: !!openOne })
  const holding = asked && !openOne && nodes.some((n) => n.id === asked) ? asked : null
  if (holding !== hold) setHold(holding)
  const queue = withHold(synced, holding)
  const shownFocus = useRef<string | null>(null)
  shownFocus.current = focusOf(queue)
  const moveOn = useCallback(() => {
    setMovedOn(shownFocus.current)
    setHold(null)
  }, [])

  const pin = pinnedFocus(focus, explicit === focus ? spotlight : explicit)
  useEffect(() => {
    if (pin) onFocus(pin)
  }, [pin, onFocus])

  // Cards can go, and what named them goes with them.
  useEffect(() => {
    const ids = new Set(nodes.map((n) => n.id))
    setMemory((m) => pruneMemory(m, ids))
  }, [nodes])

  // A station settling opens the pause, read off the run as it changes, in the
  // same render as the new cards so they never flash up before it.
  const [lastRun, setLastRun] = useState(run)
  const [pause, setPause] = useState<{ done: number; next: number } | null>(null)
  if (run !== lastRun) {
    setLastRun(run)
    const fresh = interludeFrom(lastRun, run)
    if (fresh) setPause(fresh)
  }
  // Waits for the learner to finish with a card they just answered.
  const interlude = !holding && pause && run?.phase === 'teaching' && run.currentStep === pause.next ? pause : null
  const endInterlude = useCallback(() => setPause(null), [])

  const currentStepRef = useRef(currentStep)
  currentStepRef.current = currentStep
  const said = useRef(chat.messages.length)
  said.current = chat.messages.length
  const [lines, setLines] = useState<DisplayLine[]>([])
  const say = useCallback((text: string, tone: DisplayLine['tone'], card: string | null = shownFocus.current) => {
    const afterIndex = said.current
    setLines((prev) => {
      const last = prev[prev.length - 1]
      return last && last.text === text && last.afterIndex === afterIndex ? prev : [...prev, { afterIndex, text, tone, card }]
    })
  }, [])

  const [sizes, setSizes] = useState<Record<string, Size>>({})
  const onMeasure = useCallback((id: string, size: Size) => {
    setSizes((prev) => (prev[id]?.w === size.w && prev[id]?.h === size.h ? prev : { ...prev, [id]: size }))
  }, [])

  // The learner's own blocks stay in the station they were made in.
  const knownBlocks = useRef<Record<string, number>>(loaded.memory.blocks)
  const blocks = useMemo(() => {
    const next = assignBlocks(nodes, knownBlocks.current, currentStep)
    knownBlocks.current = next
    return next
  }, [nodes, currentStep])

  const rf = useReactFlow()
  const [lookBack, setLookBack] = useState<LookBack | null>(null)
  const lookBackRef = useRef(lookBack)
  lookBackRef.current = lookBack
  const getLookBack = useCallback(() => lookBackRef.current, [])
  // Every opening, Try it again and Back remounts the card, so its local state starts from the right data.
  const [epochs, setEpochs] = useState<Record<string, number>>({})
  const nextEpoch = useRef(1)
  const latest = useRef({ nodes, sizes })
  latest.current = { nodes, sizes }
  const widthRef = useRef(focusWidth)
  widthRef.current = focusWidth
  const open = useCallback(
    (id: string) => {
      const node = latest.current.nodes.find((n) => n.id === id)
      if (!node) return
      // Over the plot in view, wherever the board has been moved to.
      const box = document.querySelector('[data-stage-board]')?.getBoundingClientRect()
      const middle = box ? rf.screenToFlowPosition({ x: box.x + box.width / 2, y: box.y + box.height / 2 }) : { x: 0, y: 0 }
      const natural = latest.current.sizes[id] ?? blockSize(node.type)
      const width = widthRef.current
      const drawnH = natural.h * Math.min(1.5, width / natural.w)
      setLookBack(openLookBack(node, { x: middle.x - width / 2, y: middle.y - drawnH / 2 }, nextEpoch.current++))
    },
    [rf],
  )
  const closeLookBack = useCallback(() => {
    const id = lookBackRef.current?.id
    if (id) setEpochs((prev) => ({ ...prev, [id]: nextEpoch.current++ }))
    setLookBack(null)
  }, [])
  const tryAgain = useCallback(() => setLookBack((lb) => lb && { ...lb, data: freshAttempt(lb.data), epoch: nextEpoch.current++ }), [])
  const writeSandbox = useCallback((patch: Partial<StudyNodeData>) => setLookBack((lb) => lb && { ...lb, data: { ...lb.data, ...patch } }), [])
  const sandboxFor = useCallback(
    (id: string, epoch: number) => {
      const open = lookBackRef.current
      if (!open || open.id !== id || open.own) return null
      return sandboxCallbacks({ id, epoch, lookBack: getLookBack, writeSandbox })
    },
    [getLookBack, writeSandbox],
  )
  const dataOf = useCallback((id: string) => {
    const open = lookBackRef.current
    if (open?.id === id && !open.own) return open.data
    return latest.current.nodes.find((n) => n.id === id)?.data ?? null
  }, [])
  const epochOf = useCallback((id: string) => (lookBack?.id === id ? lookBack.epoch : (epochs[id] ?? 0)), [lookBack, epochs])

  // A block the learner has just added opens at once, ready to write in.
  const seenBlocks = useRef<ReadonlySet<string> | null>(null)
  useEffect(() => {
    const ids = Object.keys(blocks)
    const fresh = seenBlocks.current ? ids.filter((id) => !seenBlocks.current!.has(id)) : []
    seenBlocks.current = new Set(ids)
    if (fresh.length > 0) open(fresh[fresh.length - 1])
  }, [blocks, open])

  const planSteps = useMemo(() => planFrom(chat.messages)?.steps, [chat.messages])
  const placement = useMemo(
    () => placeCards({ nodes, run, planSteps, queue, detours: memory.detours, openDetour: memory.open, blocks, sizes, interlude, notes: memory.notes, keep: holding }),
    [nodes, run, planSteps, queue, memory.detours, memory.open, memory.notes, blocks, sizes, interlude, holding],
  )
  // Her strip fits what she is saying, and small changes are not worth moving a card for.
  const [speechH, setSpeechH] = useState(0)
  const setSpeechHeight = useCallback((height: number) => setSpeechH((prev) => (Math.abs(prev - height) < 4 ? prev : height)), [])
  const speakerH = Math.max(KANA_TALL, speechH)

  // A card that has gone (a regenerated one) cannot stay open.
  const reopenedId = lookBack?.id ?? null
  const reopenedGone = !!reopenedId && !placement.drawn.includes(reopenedId)
  useEffect(() => {
    if (reopenedGone) setLookBack(null)
  }, [reopenedGone])
  const reopenedType = reopenedId ? nodes.find((n) => n.id === reopenedId)?.type : undefined
  const reopenedAt = lookBack?.at
  const world = useMemo(
    () =>
      trailLayout({
        stations: placement.stations,
        detours: placement.detours,
        focusWidth,
        speaker,
        speakerH,
        focusRoom,
        reopened: reopenedId && reopenedAt && !reopenedGone ? { id: reopenedId, natural: sizes[reopenedId] ?? blockSize(reopenedType ?? ''), at: reopenedAt } : null,
      }),
    [placement, focusWidth, speaker, speakerH, focusRoom, reopenedId, reopenedAt, reopenedGone, reopenedType, sizes],
  )

  useEffect(() => {
    if (spaceId) saveMemory(storage(), spaceId, { ...memory, queue: synced, blocks })
  }, [spaceId, memory, synced, blocks])

  // Going back from a detour: the place the learner left, or the newest card of
  // the lesson's own if that card has gone.
  const land = useCallback(
    (restore: QueueState | null) => {
      const { nodes: all } = latest.current
      const target = focusOf(restore)
      const byId = target ? all.find((n) => n.id === target) : undefined
      if (byId) {
        setHeld(restore)
        onFocus(byId.id)
        return byId
      }
      const side = new Set(memoryRef.current.detours.flatMap((d) => d.cardIds))
      const step = currentStepRef.current + 1
      const newest = [...all].reverse().find((n) => !n.hidden && n.source !== 'freeform' && n.type !== 'stepGroup' && n.type !== 'checkpointHeader' && Number(n.data.step) === step && !side.has(n.id))
      setHeld(null)
      if (newest) onFocus(newest.id)
      return newest
    },
    [onFocus],
  )
  const leaveDetour = useCallback(() => {
    const { memory: next, restore } = backFromDetour(memoryRef.current)
    setMemory(next)
    const card = land(restore)
    if (card) say(reminderOf(card), 'say', card.id)
  }, [land, say])
  const { onSend } = chat
  const stillNotSure = useCallback(() => {
    const result = nextApproach(memoryRef.current)
    setMemory(result.memory)
    if (result.ask) onSend(result.ask)
    if (result.parked) {
      land(result.restore)
      say(PARKED, 'say')
    }
  }, [land, onSend, say])

  // Parked questions come up again at the end of their station, or from the tile on the plot.
  const [shownNote, setShownNote] = useState<string | null>(null)
  const note = (shownNote ? memory.notes.find((n) => n.id === shownNote) : null) ?? (interlude ? dueNotes(memory, interlude.done)[0] : undefined) ?? null
  const noteId = note?.id
  const notesRef = useRef(memory.notes)
  notesRef.current = memory.notes
  const showNote = useCallback((station: number) => {
    const found = notesRef.current.find((n) => n.station === station)
    if (found) setShownNote(found.id)
  }, [])
  const settleNote = useCallback(
    (again: boolean) => {
      const n = notesRef.current.find((x) => x.id === noteId)
      setShownNote(null)
      if (!n) return
      setMemory((m) => ({ ...m, notes: m.notes.map((x) => (x.id === n.id ? { ...x, raised: true } : x)) }))
      if (again) onSend(n.question)
    },
    [noteId, onSend],
  )

  const detour = memory.detours.find((d) => d.id === memory.open) ?? null

  const nextInQueue = interlude ? null : (placement.waiting.find((id) => queue?.ids.includes(id)) ?? null)

  return { world, placement, queue, focusId: placement.focus, waiting: placement.waiting, nextInQueue, interlude, endInterlude, lines, say, lookBack, sandboxFor, open, closeLookBack, tryAgain, epochOf, dataOf, detour, leaveDetour, stillNotSure, holding: !!holding, moveOn, setSpeechHeight, note, showNote, settleNote, sizes, onMeasure }
}
