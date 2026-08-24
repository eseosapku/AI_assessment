'use client'

import { useState } from 'react'

export interface CurvePoint {
  nth: number
  students: number
  avgScore: number
}

/**
 * Average score against how many papers a student had already sat.
 *
 * The point of drawing this rather than quoting first-versus-last is that the
 * shape is the argument: scores dip after the first paper and only start
 * climbing around the fourth, which is what improvement actually looks like and
 * is far more convincing than two endpoints.
 *
 * The line thins as it goes right because fewer students have sat that many
 * papers, and the marker size follows the sample. The tail is real but it is
 * thinner evidence than the head, and the chart should not pretend otherwise.
 */
export function LearningCurve({ points }: { points: CurvePoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return null

  const width = 720
  const height = 240
  const padL = 34
  const padR = 12
  const padTop = 14
  const padBottom = 34
  const plotW = width - padL - padR
  const plotH = height - padTop - padBottom

  const maxN = Math.max(...points.map((p) => p.nth))
  const maxStudents = Math.max(...points.map((p) => p.students))
  const x = (nth: number) => padL + ((nth - 1) / Math.max(1, maxN - 1)) * plotW
  const y = (score: number) => padTop + plotH - (score / 100) * plotH

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.nth)} ${y(p.avgScore)}`).join(' ')
  const area = `${path} L ${x(points[points.length - 1].nth)} ${padTop + plotH} L ${x(points[0].nth)} ${padTop + plotH} Z`

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[240px] w-full min-w-[560px]"
          role="img"
          aria-label="Average score by how many papers a student had already sat"
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} className="stroke-ss-line" strokeWidth={1} />
              <text x={padL - 6} y={y(v) + 4} textAnchor="end" className="fill-ss-slate text-[12px] font-bold">
                {v}
              </text>
            </g>
          ))}

          <path d={area} fill="var(--ss-accent)" opacity={0.1} />
          <path d={path} fill="none" stroke="var(--ss-accent)" strokeWidth={2.5} strokeLinejoin="round" />

          {points.map((p) => {
            const active = hover === p.nth
            // Radius follows the sample, so a point backed by 22 students does
            // not look as solid as one backed by 431.
            const r = 3 + (p.students / maxStudents) * 4
            return (
              <g key={p.nth} onMouseEnter={() => setHover(p.nth)} onMouseLeave={() => setHover((h) => (h === p.nth ? null : h))}>
                <rect x={x(p.nth) - plotW / maxN / 2} y={0} width={plotW / maxN} height={height} fill="transparent" />
                <circle cx={x(p.nth)} cy={y(p.avgScore)} r={active ? r + 2.5 : r} fill="var(--ss-accent)" />
                <text x={x(p.nth)} y={height - 12} textAnchor="middle" className="fill-ss-slate text-[12px] font-bold">
                  {p.nth}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <figcaption className="mt-1 min-h-[20px] text-[12.5px] font-semibold text-ss-slate" aria-live="polite">
        {hover !== null && points.find((p) => p.nth === hover) ? (
          (() => {
            const p = points.find((q) => q.nth === hover)!
            return (
              <>
                <span className="text-ss-ink">Paper {p.nth}</span> — {p.avgScore}% average across{' '}
                {p.students.toLocaleString()} students
              </>
            )
          })()
        ) : (
          'Papers sat, left to right. Larger dots are backed by more students.'
        )}
      </figcaption>
    </figure>
  )
}
