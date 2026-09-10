'use client'
import type { Display } from '@/lib/studylab/material/types'

export function DisplayView({ display, value }: { display: Display; value: number | undefined }) {
  const v = value ?? 0
  const lo = display.min ?? -10
  const hi = display.max ?? 10
  const span = hi - lo || 1
  const t = Math.max(0, Math.min(1, (v - lo) / span))

  if (display.kind === 'beam') {
    const deg = (t - 0.5) * 40
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className="h-1.5 w-28 origin-center rounded-full"
          style={{ backgroundColor: 'var(--ss-ink)', transform: `rotate(${deg}deg)` }}
        />
        <span className="text-[12px] font-semibold text-ss-slate">{v}</span>
      </div>
    )
  }

  if (display.kind === 'bar' || display.kind === 'tank' || display.kind === 'gauge') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="h-16 w-8 overflow-hidden rounded border border-ss-line" style={{ backgroundColor: 'var(--ss-canvas)' }}>
          <div
            className="w-full"
            style={{
              height: `${Math.round(t * 100)}%`,
              marginTop: `${Math.round((1 - t) * 100)}%`,
              backgroundColor: 'var(--ss-accent)',
            }}
          />
        </div>
        <span className="text-[12px] font-semibold text-ss-slate">{v}</span>
      </div>
    )
  }

  // plot — numeric binding visible
  return (
    <div className="rounded border border-ss-line px-2 py-1 text-[12px] font-semibold text-ss-ink" style={{ backgroundColor: 'var(--ss-panel)' }}>
      {display.id}: {v}
    </div>
  )
}
