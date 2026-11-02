'use client'

import { useContext } from 'react'
import type { NodeProps } from '@xyflow/react'
import { SafeLatex } from '../canvasShared'
import { TrailPlacementContext } from './TrailFrame'
import { statementOf } from '@/lib/studylab/trail/answerStyle'
import type { StudyNodeData } from '@/lib/studylab/types'

/**
 * A "name it" card on the Trail: its first sentence large, an optional figure, the
 * rest of the text under it, and a way to go deeper.
 */
export function TrailConceptCard({ id, data }: NodeProps) {
  const d = data as unknown as StudyNodeData
  const { statement, rest, items } = statementOf(d)
  const { onDeeper, lookingBack } = useContext(TrailPlacementContext)

  // With no sentence fit to lead, the title does: it is short, and it says what this is.
  const lead = statement || d.title || ''
  // Parts are numbered as the classic card numbers them, so a pointer still lands.
  const firstItem = d.body?.trim() ? 1 : 2

  return (
    <div className="ss-trail-concept sl-node-enter">
      {d.title && lead !== d.title && <p className="ss-trail-concept-title"><SafeLatex>{d.title}</SafeLatex></p>}
      {lead && (
        <p className="ss-trail-concept-statement">
          <SafeLatex>{lead}</SafeLatex>
        </p>
      )}
      {d.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ss-trail-concept-figure" src={d.imageUrl} alt={d.title ?? ''} />
      ) : d.svg ? (
        <div className="ss-trail-concept-figure [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: d.svg }} />
      ) : null}
      {(rest || items.length > 0) && (
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
      {/* It asks the tutor, and nothing done on a reopened card may change the lesson. */}
      {lookingBack !== id && (
        <div className="ss-trail-concept-links">
          <button type="button" onClick={() => onDeeper(id, d.title ?? lead)}>
            Go deeper
          </button>
        </div>
      )}
    </div>
  )
}
