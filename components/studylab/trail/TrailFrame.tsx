'use client'

import { createContext, useContext, useEffect, useRef, type ComponentType } from 'react'
import type { NodeProps } from '@xyflow/react'
import { CheckStepBar } from './CheckStepBar'
import type { CheckStep } from '@/lib/studylab/trail/answerStyle'
import { cardTitle } from '@/lib/studylab/trail/placement'
import type { CardRole, Size, TrailWorld } from '@/lib/studylab/trail/types'
import type { StudyNodeData } from '@/lib/studylab/types'

/** What a card on the Trail needs from the board around it. */
export interface TrailPlacement {
  places: TrailWorld['cards']
  onMeasure: (id: string, size: Size) => void
  onOpen: (id: string) => void
  onStation: (index: number) => void
  /** "Go deeper": asks the tutor, as the card menu does. */
  onDeeper: (id: string, title: string) => void
  /** Where the learner is in the open check, when the card in focus is one of its questions. */
  checkStep?: CheckStep | null
  /** What the tutor is pointing at, so a folded part can open. */
  pointer?: { nodeId: string; part?: string } | null
  /** Bumped to remount a card, so a reopened one comes back as it was saved. */
  epochOf: (id: string) => number
}

export const TrailPlacementContext = createContext<TrailPlacement>({
  places: {},
  onMeasure: () => {},
  onOpen: () => {},
  onStation: () => {},
  onDeeper: () => {},
  epochOf: () => 0,
})

const LIVE: ReadonlySet<CardRole> = new Set<CardRole>(['focus', 'reopened'])
/** Cards answered in place: drawn wide at scale 1, with big choices. */
const ANSWERED = new Set(['quiz', 'practice'])
/** Smaller changes than this are rounding: they must not move the board. */
const MEASURE_SLOP = 4

/**
 * Today's card components, drawn at the Trail's scale.
 *
 * The outer box takes the scaled size, so React Flow and the layout see what is
 * on screen, while the card itself keeps its own width and is scaled from the
 * corner. A card in focus is live; any other is a picture of itself with one
 * button on it.
 */
export function withTrailFrame(Inner: ComponentType<NodeProps>) {
  function Framed(props: NodeProps) {
    const { places, onMeasure, onOpen, epochOf, checkStep } = useContext(TrailPlacementContext)
    const { id, data, type } = props
    const place = places[id]
    const inner = useRef<HTMLDivElement>(null)
    const epoch = epochOf(id)

    useEffect(() => {
      const el = inner.current
      if (!el || typeof ResizeObserver === 'undefined') return
      let last: Size | null = null
      const report = () => {
        // The layout size: a transform does not change it, so a card measures
        // the same whatever scale it is drawn at.
        const size = { w: el.offsetWidth, h: el.offsetHeight }
        if (size.w === 0 || size.h === 0) return
        if (last && Math.abs(last.w - size.w) < MEASURE_SLOP && Math.abs(last.h - size.h) < MEASURE_SLOP) return
        last = size
        onMeasure(id, size)
      }
      report()
      const ro = new ResizeObserver(report)
      ro.observe(el)
      return () => ro.disconnect()
    }, [id, epoch, onMeasure])

    if (!place) return null
    const live = LIVE.has(place.role)
    // Next vendors React 19, which takes `inert` as a boolean; the installed
    // @types/react is 18's and does not list it, hence the spread.
    const quiet = live ? {} : ({ inert: true, 'aria-hidden': true } as Record<string, boolean>)
    const title = cardTitle({ data: data as unknown as StudyNodeData })
    return (
      <div className="ss-trail-frame" style={{ width: place.w, height: place.h }} data-role={place.role}>
        {place.role === 'focus' && type === 'quiz' && checkStep && <CheckStepBar step={checkStep} />}
        <div
          key={epoch}
          ref={inner}
          className={`ss-trail-card${live ? ' nopan' : ''}${ANSWERED.has(type) ? ' ss-trail-answer' : ''}`}
          style={{ transform: `scale(${place.scale})` }}
          {...quiet}
        >
          <Inner {...props} />
        </div>
        {!live && (
          <button type="button" tabIndex={-1} aria-label={`Open ${title}`} className="ss-trail-open" onClick={() => onOpen(id)} />
        )}
      </div>
    )
  }
  Framed.displayName = `withTrailFrame(${Inner.displayName ?? Inner.name ?? 'Card'})`
  return Framed
}
