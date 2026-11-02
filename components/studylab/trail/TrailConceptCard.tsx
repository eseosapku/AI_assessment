'use client'

import { useContext, useEffect, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { SafeLatex } from '../canvasShared'
import { TrailPlacementContext } from './TrailFrame'
import { statementOf } from '@/lib/studylab/trail/answerStyle'
import type { StudyNodeData } from '@/lib/studylab/types'

/**
 * A "name it" card on the Trail: one large statement, an optional figure, and a
 * way to go deeper. Everything longer is folded behind Tell me more.
 */
export function TrailConceptCard({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { statement, rest, items } = statementOf(d)
  const { onDeeper, pointer, lookingBack } = useContext(TrailPlacementContext)
  const [open, setOpen] = useState(false)

  // The tutor pointing at a folded part unfolds it, so the glow has somewhere to land.
  const pointedAtPart = pointer?.nodeId === id && !!pointer.part
  useEffect(() => {
    if (pointedAtPart) setOpen(true)
  }, [pointedAtPart])

  const said = statement || d.title || ''
  // Parts are numbered as the classic card numbers them, so a pointer still lands.
  const firstItem = d.body?.trim() ? 1 : 2
  const folded = !!rest || items.length > 0

  return (
    <div className="ss-trail-concept sl-node-enter">
      {d.title && said !== d.title && <p className="ss-trail-concept-title">{d.title}</p>}
      <p className="ss-trail-concept-statement">
        <SafeLatex>{said}</SafeLatex>
      </p>
      {d.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ss-trail-concept-figure" src={d.imageUrl} alt={d.title ?? ''} />
      ) : d.svg ? (
        <div className="ss-trail-concept-figure [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: d.svg }} />
      ) : null}
      {open && folded && (
        <div className="ss-trail-concept-more">
          {rest && (
            <div className="whitespace-pre-wrap">
              <SafeLatex>{rest}</SafeLatex>
            </div>
          )}
          {items.length > 0 && (
            <ul>
              {items.map((item, i) => (
                <li key={i} data-part={`item-${i + firstItem}`}>
                  <SafeLatex>{item}</SafeLatex>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="ss-trail-concept-links">
        {folded && (
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Show less' : 'Tell me more'}
          </button>
        )}
        {/* It asks the tutor, and nothing done on a reopened card may change the lesson. */}
        {lookingBack !== id && (
          <button type="button" onClick={() => onDeeper(id, d.title ?? said)}>
            Go deeper
          </button>
        )}
      </div>
    </div>
  )
}
