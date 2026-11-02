'use client'

import { useCallback, useMemo, useState } from 'react'
import type { LessonStageProps } from '../stage/LessonStage'
import { FOCUS_W, trailLayout } from '@/lib/studylab/trail/layout'
import { placeCards, trailSpotlight, type Placement } from '@/lib/studylab/trail/placement'
import { syncQueue, type QueueState } from '@/lib/studylab/trail/queue'
import type { Size, TrailWorld } from '@/lib/studylab/trail/types'

export interface TrailModel {
  world: TrailWorld
  placement: Placement
  queue: QueueState | null
  focusId: string | null
  waiting: string[]
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

  const [sizes, setSizes] = useState<Record<string, Size>>({})
  const onMeasure = useCallback((id: string, size: Size) => {
    setSizes((prev) => (prev[id]?.w === size.w && prev[id]?.h === size.h ? prev : { ...prev, [id]: size }))
  }, [])

  const placement = useMemo(
    () => placeCards({ nodes, run, queue, detours: [], openDetour: null, blocks: {}, sizes, interlude: null, notes: [] }),
    [nodes, run, queue, sizes],
  )
  const world = useMemo(
    () => trailLayout({ stations: placement.stations, detours: placement.detours, focusWidth: FOCUS_W, speaker: false }),
    [placement],
  )

  return { world, placement, queue, focusId: placement.focus, waiting: placement.waiting, sizes, onMeasure }
}
