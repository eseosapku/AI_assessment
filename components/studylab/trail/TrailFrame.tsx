'use client'

import { createContext, useContext, useEffect, useMemo, useRef, type ComponentType, type CSSProperties, type PointerEvent } from 'react'
import type { NodeProps } from '@xyflow/react'
import { CanvasContext, type CanvasCallbacks } from '../canvasShared'
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
  /** A reopened card's own way out to its copy. Null for the learner's own notes, which save. */
  sandboxFor?: (id: string, epoch: number) => CanvasCallbacks | null
  /** The tile on a plot with a parked question. */
  onNote?: (station: number) => void
  /** A finished card opened again: everything else steps back and takes no input. */
  lookingBack?: string | null
  /** Where the learner is in the open check, when the card in focus is one of its questions. */
  checkStep?: CheckStep | null
  /** What the tutor is pointing at, so a folded part can open. */
  pointer?: { nodeId: string; part?: string } | null
  /** Bumped to remount a card, so a reopened one comes back as it was saved. */
  epochOf: (id: string) => number
  /**
   * The card's data as of now. React Flow hands a node its data a tick after this
   * context changes, so a card remounted on `epochOf` alone would start from the
   * old data and hold it in its local state.
   */
  dataOf?: (id: string) => StudyNodeData | null
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
/** What a finger means to use, rather than move the board with. */
const HANDS_ON = 'button, input, textarea, select, a, label, svg, [draggable="true"], [role="slider"], .nodrag'

/**
 * On a phone the card fills the screen, so a drag on its words has to move the board,
 * or a tall card could never be read to its end. `nopan` is decided as the finger lands.
 */
function panOnlyOffControls(e: PointerEvent<HTMLDivElement>) {
  const onControl = !!(e.target as Element).closest?.(HANDS_ON)
  e.currentTarget.classList.toggle('nopan', e.pointerType !== 'touch' || onControl)
}

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
    const { places, onMeasure, onOpen, epochOf, checkStep, lookingBack, dataOf, sandboxFor } = useContext(TrailPlacementContext)
    const { id, type } = props
    const data = (dataOf?.(id) ?? props.data) as NodeProps['data']
    const place = places[id]
    const inner = useRef<HTMLDivElement>(null)
    const scroller = useRef<HTMLDivElement>(null)
    const epoch = epochOf(id)

    // A fade at the foot while there is more below it.
    const scrolls = !!place?.scrolls
    const height = place?.h
    useEffect(() => {
      const el = scroller.current
      if (!el) return
      const mark = () => el.toggleAttribute('data-more', scrolls && el.scrollHeight - el.scrollTop - el.clientHeight > MEASURE_SLOP)
      mark()
      el.addEventListener('scroll', mark, { passive: true })
      return () => el.removeEventListener('scroll', mark)
    }, [scrolls, height])

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

    const role = place?.role
    const sandbox = useMemo(() => (role === 'reopened' ? (sandboxFor?.(id, epoch) ?? null) : null), [role, sandboxFor, id, epoch])

    if (!place) return null
    const live = LIVE.has(place.role)
    // Next vendors React 19, which takes `inert` as a boolean; the installed
    // @types/react is 18's and does not list it, hence the spread.
    const steppedBack = !!lookingBack && lookingBack !== id
    const quiet = !live ? ({ inert: true, 'aria-hidden': true } as Record<string, boolean>) : steppedBack ? ({ inert: true } as Record<string, boolean>) : {}
    const title = cardTitle({ data: data as unknown as StudyNodeData })
    return (
      <div className="ss-trail-frame" style={{ width: place.w, height: place.h }} data-role={place.role} data-tour={place.role === 'finished' || place.role === 'filed' ? 'lesson-finished' : undefined}>
        {/* The focus ring, scaled with the card and by the same glide, so the two
            cannot part. Drawn from the frame's size, it trailed the card by up to a
            tenth of a second and left a second outline beside it. Always there, so a
            card turning into the focus brings its ring along at its own size. */}
        <div
          className="ss-trail-ring"
          style={{ width: place.w / place.scale, height: place.h / place.scale, transform: `scale(${place.scale})`, '--trail-scale': place.scale } as CSSProperties}
        />
        {place.role === 'focus' && type === 'quiz' && checkStep && <CheckStepBar step={checkStep} />}
        <div ref={scroller} className={`ss-trail-scroller${scrolls ? ' ss-trail-scrolls nowheel' : ''}`} tabIndex={scrolls ? 0 : undefined}>
        <div
          key={epoch}
          ref={inner}
          className={`ss-trail-card${live ? ' nopan' : ''}${ANSWERED.has(type) ? ' ss-trail-answer' : ''}`}
          style={{ transform: `scale(${place.scale})`, '--trail-scale': place.scale } as CSSProperties}
          onPointerDownCapture={live ? panOnlyOffControls : undefined}
          {...quiet}
        >
          {sandbox ? (
            <CanvasContext.Provider value={sandbox}>
              <Inner {...props} data={data} />
            </CanvasContext.Provider>
          ) : (
            <Inner {...props} data={data} />
          )}
        </div>
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
