'use client'

import { MINUTES_A_STEP } from '../stage/PlanOpening'
import type { Rect } from '@/lib/studylab/trail/types'

export interface TrailHeading {
  title: string
  subject?: string | null
}

/** The lesson's name on the board, above the journey it opens. */
export function TrailTitleBlock({ rect, heading, stations }: { rect: Rect; heading: TrailHeading; stations: number }) {
  return (
    <div className="ss-trail-title" style={{ transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.w, height: rect.h }}>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/studysquare-mark.svg" alt="" width={56} height={56} />
        <span className="ss-trail-title-brand">StudySquare LearnSpace</span>
        {heading.subject && <span className="ss-trail-title-subject">{heading.subject}</span>}
      </div>
      <h1>{heading.title}</h1>
      {stations > 0 && (
        <p>
          {stations} {stations === 1 ? 'station' : 'stations'} · about {stations * MINUTES_A_STEP} minutes
        </p>
      )}
    </div>
  )
}
