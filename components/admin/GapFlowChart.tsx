'use client'

import { useId, useState } from 'react'

export interface GapFlowPoint {
  month: string
  identified: number
  closed: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortMonth(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1
  return MONTH_LABELS[idx] ?? month
}

/**
 * Gaps opened against gaps closed, month by month.
 *
 * Closed is drawn *inside* identified rather than beside it, because closure is
 * a subset of identification — a student cannot close a gap nobody found. Two
 * bars side by side would invite the reader to add them together, which would
 * double-count every gap that was both found and fixed.
 *
 * The gap between the two heights is the backlog for that month, which is the
 * thing worth watching: identification outrunning closure is what a widening
 * hole looks like.
 */
export function GapFlowChart({ points }: { points: GapFlowPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const clipId = useId()

  const max = Math.max(1, ...points.map((p) => p.identified))
  const width = 720
  const height = 220
  const padX = 8
  const padTop = 12
  const padBottom = 26
  const plot = height - padTop - padBottom
  const slot = (width - padX * 2) / Math.max(1, points.length)
  const barW = Math.min(34, slot * 0.56)

  const y = (v: number) => padTop + plot - (v / max) * plot

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12.5px] font-bold">
        <span className="inline-flex items-center gap-1.5 text-ss-slate">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-ss-accent-soft ring-1 ring-inset ring-[color:var(--ss-accent)]/40" />
          Identified
        </span>
        <span className="inline-flex items-center gap-1.5 text-ss-slate">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-[color:var(--ss-good)]" />
          Closed
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[220px] w-full min-w-[560px]"
          role="img"
          aria-label={`Gaps identified and closed over ${points.length} months`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={width} height={height} />
            </clipPath>
          </defs>

          {/* Four gridlines. Enough to judge a height against, few enough to stay quiet. */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={padX}
              x2={width - padX}
              y1={y(max * f)}
              y2={y(max * f)}
              className="stroke-ss-line"
              strokeWidth={1}
            />
          ))}

          <g clipPath={`url(#${clipId})`}>
            {points.map((p, i) => {
              const cx = padX + slot * i + slot / 2
              const x = cx - barW / 2
              const idTop = y(p.identified)
              const clTop = y(p.closed)
              const active = hover === i
              return (
                <g
                  key={p.month}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                >
                  {/* Full-height hit area so the tooltip is easy to catch. */}
                  <rect x={cx - slot / 2} y={0} width={slot} height={height} fill="transparent" />
                  <rect
                    x={x}
                    y={idTop}
                    width={barW}
                    height={Math.max(0, padTop + plot - idTop)}
                    rx={5}
                    className="fill-ss-accent-soft"
                    opacity={active ? 1 : 0.85}
                  />
                  <rect
                    x={x}
                    y={clTop}
                    width={barW}
                    height={Math.max(0, padTop + plot - clTop)}
                    rx={5}
                    fill="var(--ss-good)"
                    opacity={active ? 1 : 0.9}
                  />
                  <text
                    x={cx}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-ss-slate text-[12px] font-bold"
                  >
                    {shortMonth(p.month)}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <figcaption className="mt-2 min-h-[20px] text-[12.5px] font-semibold text-ss-slate" aria-live="polite">
        {hover !== null && points[hover] ? (
          <>
            <span className="text-ss-ink">{shortMonth(points[hover].month)}</span> —{' '}
            {points[hover].identified.toLocaleString()} identified,{' '}
            {points[hover].closed.toLocaleString()} closed
            {points[hover].identified > 0 && (
              <> ({Math.round((points[hover].closed / points[hover].identified) * 100)}%)</>
            )}
          </>
        ) : (
          'Hover a month for its figures.'
        )}
      </figcaption>
    </figure>
  )
}
