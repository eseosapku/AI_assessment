'use client'
import type { ActivitySpec, ActivityState, ModelSpec, VaryPayload } from '@/lib/studylab/activities/types'
import { computeReadouts, modelValue } from '@/lib/studylab/activities/patterns/vary'
import { evaluateExpr } from '@/lib/studylab/activities/expr'
import { ActivityFrame } from './ActivityFrame'
import { useActivityState } from './useActivityState'

const VB_W = 300
const VB_H = 150

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Bars: height is expr/max, clamped so a runaway expression stays in the chart. */
function BarsModel({ payload, value, model }: { payload: VaryPayload; value: number; model: Extract<ModelSpec, { kind: 'bars' }> }) {
  const bars = model.bars
  const slot = VB_W / Math.max(bars.length, 1)
  const barW = Math.min(slot * 0.5, 56)
  return (
    <g>
      {bars.map((b, i) => {
        const raw = modelValue(payload, b.expr, value)
        // A broken/unsafe expression must be skipped, not drawn as a zero bar —
        // a flat empty bar is indistinguishable from a genuine zero reading and
        // reads as data when it is actually absence of data.
        if (raw === null || !(b.max > 0)) return null
        const frac = clamp01(raw / b.max)
        const h = frac * (VB_H - 26)
        const x = slot * i + (slot - barW) / 2
        return (
          <g key={b.label + i}>
            <rect x={x} y={VB_H - 20 - h} width={barW} height={h} rx={4} className="fill-[color:var(--ss-accent)]" />
            <rect x={x} y={10} width={barW} height={VB_H - 30} rx={4} className="fill-[color:var(--ss-ink)]" fillOpacity={0.05} />
            <text x={x + barW / 2} y={VB_H - 6} textAnchor="middle" className="fill-[color:var(--ss-slate)] text-[12px]">
              {b.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** Tank: the object floats or sinks as its density crosses the fluid's. */
function TankModel({ payload, value, model }: { payload: VaryPayload; value: number; model: Extract<ModelSpec, { kind: 'tank' }> }) {
  const fluidDensity = modelValue(payload, model.fluidExpr, value)
  const objectDensity = modelValue(payload, model.objectExpr, value)
  // Neutral mid-position if either expression is unusable or the fluid has no
  // (or negative) density — dividing by zero must degrade, never render NaN.
  const ratio =
    fluidDensity !== null && fluidDensity > 0 && objectDensity !== null
      ? clamp01(objectDensity / fluidDensity)
      : 0.5
  const tankTop = 18
  const tankH = VB_H - 34
  const waterTop = tankTop + tankH * 0.18
  const waterH = tankH - tankH * 0.18
  const objSize = 34
  // ratio 0 => floats at the surface, 1 => rests on the bottom.
  const objY = waterTop - objSize / 2 + ratio * (waterH - objSize / 2)
  return (
    <g>
      <rect x={70} y={waterTop} width={VB_W - 140} height={waterH} rx={3} className="fill-[color:var(--ss-accent)]" fillOpacity={0.22} />
      <rect
        x={70} y={tankTop} width={VB_W - 140} height={tankH} rx={4}
        className="fill-none stroke-[color:var(--ss-ink)]" strokeWidth={2} strokeOpacity={0.3}
      />
      <rect
        x={VB_W / 2 - objSize / 2} y={objY} width={objSize} height={objSize} rx={5}
        className="fill-[color:var(--ss-warn)] stroke-[color:var(--ss-ink)]" strokeWidth={1.5} strokeOpacity={0.4}
      />
    </g>
  )
}

/** Plot: sampled polyline; unusable samples are skipped, not zeroed. */
function PlotModel({ payload, value, model }: { payload: VaryPayload; value: number; model: Extract<ModelSpec, { kind: 'plot' }> }) {
  const [x0, x1] = model.xRange
  const [y0, y1] = model.yRange
  const span = x1 - x0
  const ySpan = y1 - y0
  const pts: string[] = []
  if (span > 0 && ySpan > 0) {
    const N = 48
    for (let i = 0; i <= N; i++) {
      const xv = x0 + (span * i) / N
      const yv = evaluateAt(payload, model.fn, xv, value)
      if (yv === null) continue
      const px = ((xv - x0) / span) * VB_W
      const py = VB_H - 14 - clamp01((yv - y0) / ySpan) * (VB_H - 28)
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`)
    }
  }
  return (
    <g>
      <line x1={0} y1={VB_H - 14} x2={VB_W} y2={VB_H - 14} className="stroke-[color:var(--ss-ink)]" strokeWidth={1} strokeOpacity={0.2} />
      {pts.length > 1 && (
        <polyline points={pts.join(' ')} className="fill-none stroke-[color:var(--ss-accent)]" strokeWidth={2.5} strokeLinejoin="round" />
      )}
    </g>
  )
}

/**
 * Sample the plotted function. The axis variable is `x`; the slider variable is
 * also in scope so a curve can respond to the slider (e.g. a changing gradient).
 * The two can collide: a model-authored payload commonly names the slider
 * variable `x` too, since that's the most natural id for a maths activity. If
 * the slider entry were spread in after `x`, it would clobber the sampling
 * axis with the constant slider value and every one of the 48 samples would
 * evaluate to the same point — a flat line with no error. The axis always
 * wins: apply it last, and skip the slider entry entirely when the ids match
 * (it would just be overwritten anyway).
 */
function evaluateAt(payload: VaryPayload, fn: string, x: number, value: number): number | null {
  const vars = payload.variable.id === 'x' ? { x } : { [payload.variable.id]: value, x }
  return evaluateExpr(fn, vars)
}

export function VaryActivity({ id, spec, onOutcome, initialState }: {
  id: string; spec: ActivitySpec; onOutcome: (o: unknown) => void; initialState?: ActivityState
}) {
  const payload = spec.payload as VaryPayload
  const a = useActivityState(id, spec, initialState)
  const value = typeof (a.work as { value?: number }).value === 'number'
    ? (a.work as { value: number }).value
    : payload.variable.min

  const readouts = computeReadouts(payload, value)
  const v = payload.variable

  return (
    <ActivityFrame
      prompt={spec.prompt} solved={a.solved} reveal={spec.reveal} revealed={a.revealed}
      hint={a.hint} hintAvailable={a.hintAvailable} onHint={a.showHint}
      onCheck={() => { const o = a.check(); if (o) onOutcome(o) }}
    >
      <div className="flex flex-col gap-3">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label={v.label}>
          {payload.model.kind === 'bars' && <BarsModel payload={payload} value={value} model={payload.model} />}
          {payload.model.kind === 'tank' && <TankModel payload={payload} value={value} model={payload.model} />}
          {payload.model.kind === 'plot' && <PlotModel payload={payload} value={value} model={payload.model} />}
        </svg>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor={`vary-${id}`} className="text-[12px] font-bold uppercase tracking-widest text-ss-slate">
              {v.label}
            </label>
            <span className="text-[13px] font-extrabold text-ss-ink">
              {value}{v.unit ? ` ${v.unit}` : ''}
            </span>
          </div>
          <input
            id={`vary-${id}`}
            type="range"
            className="nodrag w-full accent-[color:var(--ss-accent)]"
            min={v.min}
            max={v.max}
            step={v.step && v.step > 0 ? v.step : 1}
            value={value}
            onChange={(e) => a.setWork({ value: Number(e.target.value) })}
          />
        </div>

        {readouts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {readouts.map((r) => (
              <span key={r.label} className="rounded-lg border border-ss-line px-2.5 py-1.5 text-[12px] font-semibold text-ss-ink">
                {r.label}: <span className="text-ss-accent">{Number.isInteger(r.value) ? r.value : r.value.toFixed(2)}</span>
                {r.unit ? ` ${r.unit}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </ActivityFrame>
  )
}
