'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { LessonStageProps } from '../stage/LessonStage'
import { FOCUS_W, trailLayout } from '@/lib/studylab/trail/layout'
import { blockSize } from '@/lib/studylab/blocks'
import { interludeFrom } from '@/lib/studylab/trail/action'
import { freshAttempt, openLookBack, type LookBack } from '@/lib/studylab/trail/lookBack'
import type { StudyNodeData } from '@/lib/studylab/types'
import { planFrom } from '@/lib/studylab/trail/opening'
import { assignBlocks, placeCards, trailSpotlight, type Placement } from '@/lib/studylab/trail/placement'
import { pinnedFocus, syncQueue, type QueueState } from '@/lib/studylab/trail/queue'
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
  getLookBack: () => LookBack | null
  open: (id: string) => void
  closeLookBack: () => void
  tryAgain: () => void
  writeSandbox: (patch: Partial<StudyNodeData>) => void
  epochOf: (id: string) => number
  dataOf: (id: string) => StudyNodeData | null
  /** The cards' own sizes, as drawn. They place cards here and nowhere else. */
  sizes: Record<string, Size>
  onMeasure: (id: string, size: Size) => void
}

/**
 * Everything the Trail shows, derived from the lesson's own state on each render:
 * the same run always gives the same board, and none of it is saved.
 */
export function useTrailModel(props: LessonStageProps): TrailModel {
  const { board, focus, chat, onFocus } = props
  const { nodes, run } = board

  const spotlight = useMemo(() => trailSpotlight({ nodes, run, explicit: focus }), [nodes, run, focus])
  const [held, setHeld] = useState<QueueState | null>(null)
  const queue = syncQueue(held, spotlight)
  if (queue !== held) setHeld(queue)

  const pin = pinnedFocus(focus, spotlight)
  useEffect(() => {
    if (pin) onFocus(pin)
  }, [pin, onFocus])

  // A station settling opens the pause, read off the run as it changes, in the
  // same render as the new cards so they never flash up before it.
  const [lastRun, setLastRun] = useState(run)
  const [pause, setPause] = useState<{ done: number; next: number } | null>(null)
  if (run !== lastRun) {
    setLastRun(run)
    const fresh = interludeFrom(lastRun, run)
    if (fresh) setPause(fresh)
  }
  const interlude = pause && run?.phase === 'teaching' && run.currentStep === pause.next ? pause : null
  const endInterlude = useCallback(() => setPause(null), [])

  const said = useRef(chat.messages.length)
  said.current = chat.messages.length
  const [lines, setLines] = useState<DisplayLine[]>([])
  const say = useCallback((text: string, tone: DisplayLine['tone']) => {
    const afterIndex = said.current
    setLines((prev) => {
      const last = prev[prev.length - 1]
      return last && last.text === text && last.afterIndex === afterIndex ? prev : [...prev, { afterIndex, text, tone }]
    })
  }, [])

  const [sizes, setSizes] = useState<Record<string, Size>>({})
  const onMeasure = useCallback((id: string, size: Size) => {
    setSizes((prev) => (prev[id]?.w === size.w && prev[id]?.h === size.h ? prev : { ...prev, [id]: size }))
  }, [])

  // The learner's own blocks stay in the station they were made in.
  const currentStep = run?.currentStep ?? 0
  const knownBlocks = useRef<Record<string, number>>({})
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
  const open = useCallback(
    (id: string) => {
      const node = latest.current.nodes.find((n) => n.id === id)
      if (!node) return
      // Over the plot in view, wherever the board has been moved to.
      const box = document.querySelector('[data-stage-board]')?.getBoundingClientRect()
      const middle = box ? rf.screenToFlowPosition({ x: box.x + box.width / 2, y: box.y + box.height / 2 }) : { x: 0, y: 0 }
      const natural = latest.current.sizes[id] ?? blockSize(node.type)
      const drawnH = natural.h * Math.min(1.5, FOCUS_W / natural.w)
      setLookBack(openLookBack(node, { x: middle.x - FOCUS_W / 2, y: middle.y - drawnH / 2 }, nextEpoch.current++))
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
    () => placeCards({ nodes, run, planSteps, queue, detours: [], openDetour: null, blocks, sizes, interlude, notes: [] }),
    [nodes, run, planSteps, queue, blocks, sizes, interlude],
  )
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
        focusWidth: FOCUS_W,
        speaker: true,
        reopened: reopenedId && reopenedAt && !reopenedGone ? { id: reopenedId, natural: sizes[reopenedId] ?? blockSize(reopenedType ?? ''), at: reopenedAt } : null,
      }),
    [placement, reopenedId, reopenedAt, reopenedGone, reopenedType, sizes],
  )

  const nextInQueue = interlude ? null : (placement.waiting.find((id) => queue?.ids.includes(id)) ?? null)

  return { world, placement, queue, focusId: placement.focus, waiting: placement.waiting, nextInQueue, interlude, endInterlude, lines, say, lookBack, getLookBack, open, closeLookBack, tryAgain, writeSandbox, epochOf, dataOf, sizes, onMeasure }
}
