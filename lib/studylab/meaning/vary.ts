// lib/studylab/meaning/vary.ts
import type { VaryPayload } from '../activities/types'
import { evaluateExpr } from '../activities/expr'

/** Most positions a slider is tried at; a long range is sampled evenly on its steps. */
const MAX_SAMPLES = 200
/** A bar that moves less than this share of its height shows nothing. */
const MIN_SPAN = 0.05

const said = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''))

/** The slider positions a card is tried at: min, max and evenly between, on the slider's own steps. */
export function samplePositions(variable: VaryPayload['variable'], n = MAX_SAMPLES): number[] {
  const { min, max } = variable
  const step = variable.step > 0 ? variable.step : 1
  const steps = Math.max(1, Math.round((max - min) / step))
  const every = Math.max(1, Math.ceil(steps / Math.max(1, n - 1)))
  const out: number[] = []
  for (let i = 0; i <= steps; i += every) out.push(+(min + i * step).toFixed(10))
  if (out[out.length - 1] !== max) out.push(max)
  return out
}

/** An expression across the slider's range; null where it cannot be worked out. */
function across(payload: VaryPayload, expr: string, at: number[]): (number | null)[] {
  return at.map((v) => evaluateExpr(expr, { [payload.variable.id]: v }))
}

function spread(values: (number | null)[]): { lo: number; hi: number } | null {
  const ok = values.filter((v): v is number => v !== null)
  return ok.length ? { lo: Math.min(...ok), hi: Math.max(...ok) } : null
}

/**
 * Why a slider card would show nothing, or be marked on the wrong thing, in
 * words the writer can act on; empty when it is fine. Its bars must move as the
 * slider moves (and visibly), a plot's slider must not share the axis's name,
 * a tank's object must move, and the card is marked on a `target` -- a reading
 * the learner watches -- that some slider position reaches and the start does not.
 */
export function varyFaults(payload: VaryPayload): string[] {
  const out: string[] = []
  const at = samplePositions(payload.variable)
  const m = payload.model
  if (m.kind === 'bars') {
    for (const bar of m.bars) {
      const s = spread(across(payload, bar.expr, at))
      if (!s) out.push(`the bar "${bar.label}" cannot be worked out from the slider`)
      else if (s.hi === s.lo) out.push(`the bar "${bar.label}" reads ${said(s.lo)} at every slider position: moving the slider changes nothing`)
      else if (s.lo >= bar.max) out.push(`the bar "${bar.label}" is full at every slider position (its max is ${said(bar.max)})`)
      else if (s.hi <= 0) out.push(`the bar "${bar.label}" is empty at every slider position`)
      else if ((Math.min(s.hi, bar.max) - Math.max(s.lo, 0)) / bar.max < MIN_SPAN) {
        out.push(`the bar "${bar.label}" hardly moves (${said(s.lo)} to ${said(s.hi)} of ${said(bar.max)}): set its max near the largest reading`)
      }
    }
  } else if (m.kind === 'plot') {
    if (payload.variable.id === 'x') out.push('the slider is named "x", the same as the plot\'s axis, so the curve never moves: name the slider for what it is')
  } else if (m.kind === 'tank') {
    const fluid = across(payload, m.fluidExpr, at)
    const object = across(payload, m.objectExpr, at)
    const ratio = spread(fluid.map((f, i) => (f !== null && f > 0 && object[i] !== null ? (object[i] as number) / f : null)))
    if (!ratio || ratio.hi === ratio.lo) out.push('the object in the tank stays where it is at every slider position')
  }

  const t = payload.target
  if (!t || typeof t.expr !== 'string' || !Number.isFinite(t.value)) {
    out.push('it is marked on the slider\'s own value: give a "target" on what the learner watches -- { "expr": a reading of the slider, "value", "tolerance" }')
    return out
  }
  const reading = across(payload, t.expr, at)
  const near = (v: number | null) => v !== null && Math.abs(v - t.value) <= Math.max(t.tolerance, 0)
  const s = spread(reading)
  if (!s || s.hi === s.lo) out.push(`the target's reading "${t.expr}" does not change as the slider moves`)
  else if (!reading.some(near)) out.push(`no slider position reaches the target (${t.expr} = ${said(t.value)} ± ${said(t.tolerance)}; it runs ${said(s.lo)} to ${said(s.hi)})`)
  else if (near(reading[0])) out.push(`the target is met at the slider's start, so the card is solved before the slider moves`)
  return out
}
