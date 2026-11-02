'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ListOrdered } from 'lucide-react'
import { CardFrame, NodeHeader, SafeLatex } from '../canvasShared'
import { useDock } from '../stage/StageContext'
import { TrailPlacementContext } from './TrailFrame'
import { firstShown, workedSteps } from '@/lib/studylab/trail/answerStyle'
import type { StudyNodeData } from '@/lib/studylab/types'

/**
 * A worked example on the Trail: its steps one at a time, each read before the next
 * comes, with the button in the dock saying Next step until they are all there. Nine
 * steps at once was a tower of text running off the screen. Anywhere but in focus, a
 * look back or a filed card, it shows all of them.
 */
export function TrailWorkedCard({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const steps = workedSteps(d.steps)
  const { places, lookingBack, pointer } = useContext(TrailPlacementContext)
  const inFocus = places[id]?.role === 'focus' && lookingBack !== id
  const [revealed, setRevealed] = useState(() => firstShown(steps.length))
  // The tutor pointing at a later step brings the steps up to it.
  const pointedAt = pointer?.nodeId === id ? Number(pointer.part?.replace('step-', '')) : NaN
  const shown = inFocus ? Math.max(revealed, Number.isFinite(pointedAt) ? pointedAt : 0) : steps.length
  const stepping = shown < steps.length
  const dock = useDock({ enabled: stepping })
  const next = () => setRevealed(Math.min(steps.length, shown + 1))

  // The newest step comes into view, if the card has outgrown its frame.
  const list = useRef<HTMLOListElement>(null)
  const seen = useRef(shown)
  useEffect(() => {
    if (shown <= seen.current) return
    seen.current = shown
    const scroller = list.current?.closest('.ss-trail-scrolls')
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
  }, [shown])

  return (
    <CardFrame>
      <NodeHeader icon={ListOrdered} title={d.title} tone="green" />
      <div className="px-4 pb-4 pt-2 text-[13px] text-ss-slate">
        {steps.length > 0 ? (
          <ol ref={list} className="space-y-1.5">
            {steps.slice(0, shown).map((s, i) => (
              <li key={i} data-part={`step-${i + 1}`} className="ss-trail-step flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-ss-good">{i + 1}</span>
                <span className="pt-0.5"><SafeLatex>{s}</SafeLatex></span>
              </li>
            ))}
          </ol>
        ) : d.body ? (
          <div className="whitespace-pre-wrap"><SafeLatex>{d.body}</SafeLatex></div>
        ) : null}
        {stepping && (
          <div className="ss-trail-step-foot">
            <span>Step {shown} of {steps.length}</span>
            <button type="button" className="nodrag" onClick={() => setRevealed(steps.length)}>Show all</button>
          </div>
        )}
        {stepping && !dock.docked && (
          <button type="button" className="nodrag ss-trail-go mt-2" onClick={next}>Next step</button>
        )}
        {stepping && dock.place(
          <div className="flex items-stretch gap-2">
            {dock.cont && (
              <button type="button" className="ss-press inline-flex min-h-[44px] items-center justify-center rounded-xl bg-ss-chip px-4 text-[13.5px] font-bold text-ss-ink" onClick={() => dock.onContinue()}>
                Skip
              </button>
            )}
            <button type="button" className="ss-trail-go" onClick={next}>Next step</button>
          </div>,
        )}
      </div>
    </CardFrame>
  )
}
