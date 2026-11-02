'use client'

import { useCallback, useMemo, useState } from 'react'
import type { LessonStageProps } from '../stage/LessonStage'
import { FOCUS_W, trailLayout } from '@/lib/studylab/trail/layout'
import { interludeFrom } from '@/lib/studylab/trail/action'
import { placeCards, trailSpotlight, type Placement } from '@/lib/studylab/trail/placement'
import { syncQueue, type QueueState } from '@/lib/studylab/trail/queue'
import type { Size, TrailWorld } from '@/lib/studylab/trail/types'

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
  /** The cards' own sizes, as drawn. They place cards here and nowhere else. */
  sizes: Record<string, Size>
  onMeasure: (id: string, size: Size) => void
}

/**
 * Everything the Trail shows, derived from the lesson's own state on each render:
 * the same run always gives the same board, and none of it is saved.
 */
export function useTrailModel(props: LessonStageProps): TrailModel {
  const { board, focus } = props
  const { nodes, run } = board

  const spotlight = useMemo(() => trailSpotlight({ nodes, run, explicit: focus }), [nodes, run, focus])
  const [held, setHeld] = useState<QueueState | null>(null)
  const queue = syncQueue(held, spotlight)
  if (queue !== held) setHeld(queue)

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

  const [sizes, setSizes] = useState<Record<string, Size>>({})
  const onMeasure = useCallback((id: string, size: Size) => {
    setSizes((prev) => (prev[id]?.w === size.w && prev[id]?.h === size.h ? prev : { ...prev, [id]: size }))
  }, [])

  const placement = useMemo(
    () => placeCards({ nodes, run, queue, detours: [], openDetour: null, blocks: {}, sizes, interlude, notes: [] }),
    [nodes, run, queue, sizes, interlude],
  )
  const world = useMemo(
    () => trailLayout({ stations: placement.stations, detours: placement.detours, focusWidth: FOCUS_W, speaker: false }),
    [placement],
  )

  const nextInQueue = interlude ? null : (placement.waiting.find((id) => queue?.ids.includes(id)) ?? null)

  return { world, placement, queue, focusId: placement.focus, waiting: placement.waiting, nextInQueue, interlude, endInterlude, sizes, onMeasure }
}
