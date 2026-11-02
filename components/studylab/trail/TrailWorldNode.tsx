'use client'

import { memo, useContext } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Lock } from 'lucide-react'
import type { PlotBox, Tile, TrailWorld } from '@/lib/studylab/trail/types'
import { TILE } from '@/lib/studylab/trail/layout'
import { TrailPlacementContext } from './TrailFrame'
import { TrailTitleBlock, type TrailHeading } from './TrailTitleBlock'

/** Rounded like the mark's own squares, but never so far that a big plot's corner cuts across a card. */
const radiusOf = (w: number, h: number) => Math.min(Math.min(w, h) * 0.18, 120)
const BADGE = 56

const tileFill = (t: Tile) =>
  t.kind === 'branch' ? 'var(--subject)' : `var(--trail-${t.kind === 'done' ? 'done' : 'tile'}-${t.tone})`

function Plot({ plot, onStation }: { plot: PlotBox; onStation: (index: number) => void }) {
  const { rect, state, index, title } = plot
  return (
    <g className={`ss-trail-plot ss-trail-plot-${state}`} style={{ transform: `translate(${rect.x}px, ${rect.y}px)` }}>
      <rect
        className="ss-trail-plot-shape"
        style={{ width: rect.w, height: rect.h }}
        rx={radiusOf(rect.w, rect.h)}
        ry={radiusOf(rect.w, rect.h)}
        pathLength={1000}
        onClick={() => onStation(index)}
      >
        <title>{title}</title>
      </rect>
      <g style={{ transform: `translate(${rect.w / 2}px, 0)` }} className="ss-trail-badge">
        <rect x={-BADGE / 2} y={-BADGE / 2} width={BADGE} height={BADGE} rx={BADGE * 0.26} />
        <text textAnchor="middle" dominantBaseline="central">
          {state === 'done' ? '✓' : index + 1}
        </text>
      </g>
    </g>
  )
}

/**
 * The board under the cards: plots, the tiled trail, and the quiet lines that
 * join a station's cards. It draws in the world's own coordinates from a node
 * pinned at the origin, so a plot growing never shifts the drawing against the
 * cards on top of it.
 */
function TrailWorldNodeInner({ data }: NodeProps) {
  const { world, heading, opening } = data as unknown as { world: TrailWorld; heading: TrailHeading; opening: boolean }
  const { onStation } = useContext(TrailPlacementContext)
  return (
    <div className={`ss-trail-world${opening ? ' ss-trail-world-opening' : ''}`}>
      <TrailTitleBlock rect={world.title} heading={heading} stations={world.plots.length} />
      <svg width={1} height={1} aria-hidden>
        {world.links.map((l, i) => (
          <line key={i} className="ss-trail-link" x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} />
        ))}
        {world.plots.map((p) => (
          <Plot key={p.id} plot={p} onStation={onStation} />
        ))}
        {world.tiles.map((t, i) => (
          <rect
            key={`${t.kind === 'branch' ? 'b' : 't'}${t.segment}-${i}`}
            className="ss-trail-tile"
            x={-TILE / 2}
            y={-TILE / 2}
            width={TILE}
            height={TILE}
            rx={TILE * 0.24}
            style={{ transform: `translate(${t.x}px, ${t.y}px) rotate(${t.angle}deg)`, fill: tileFill(t), ...(opening ? { animationDelay: `${i * 14}ms` } : {}) }}
          />
        ))}
      </svg>
      {world.plots.map((p) => (
        <div
          key={p.id}
          className={`ss-trail-label ss-trail-label-${p.state}`}
          style={{ transform: `translate(${p.label.x}px, ${p.label.y}px)`, width: p.label.w, height: p.label.h - BADGE / 2 }}
        >
          <span>
            {p.locked && <Lock className="ss-trail-label-lock" aria-label="We will cover this one" />}
            {p.title}
          </span>
        </div>
      ))}
    </div>
  )
}

export const TrailWorldNode = memo(TrailWorldNodeInner)
