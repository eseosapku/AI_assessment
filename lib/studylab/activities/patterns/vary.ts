import type { PatternModule, SuccessRule, ValidateResult, VaryPayload } from '../types'
import { evaluateSuccess } from '../success'
import { evaluateExpr } from '../expr'

export interface VaryWork { value: number }

/**
 * Evaluate every readout at the current variable value.
 *
 * Expressions are authored by the model at runtime, so they go through
 * `evaluateExpr` (whitelisted parser, no eval) and NOT through any dynamic code
 * path. A readout whose expression fails to parse is DROPPED rather than shown
 * as NaN — a broken expression must degrade to a smaller activity, never to
 * garbage on the board.
 */
export interface VaryReadout { label: string; value: number; unit?: string }

export function computeReadouts(payload: VaryPayload, value: number): VaryReadout[] {
  // Computed key, so a variable id of '__proto__' becomes an ordinary own
  // property rather than touching the prototype; evaluateExpr then reads it
  // with an own-property guard.
  const vars = { [payload.variable.id]: value }
  const out: VaryReadout[] = []
  for (const r of payload.readouts) {
    const v = evaluateExpr(r.expr, vars)
    if (v === null) continue // unusable expression: drop the readout, never show NaN
    out.push({ label: r.label, value: v, unit: r.unit })
  }
  return out
}

/** Evaluate one model expression, or null if it is unusable. */
export function modelValue(payload: VaryPayload, expr: string, value: number): number | null {
  return evaluateExpr(expr, { [payload.variable.id]: value })
}

const finite = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n)
const positive = (n: unknown): boolean => finite(n) && (n as number) > 0
const nonEmptyString = (s: unknown): boolean => typeof s === 'string' && s.length > 0

/**
 * Validate the model's own required fields, per kind. `isPayload` already
 * confirmed `m.kind` is one of the three known values before this runs.
 * Without this, a malformed payload (e.g. `{kind:'plot'}` with no `xRange`)
 * passes `isPayload` and then crashes the node when the component destructures
 * a field that was never there — `validateSpec` exists precisely to drop that
 * payload instead of rendering it.
 */
function isModel(m: { kind?: unknown }): boolean {
  if (m.kind === 'bars') {
    const bm = m as { bars?: unknown }
    return (
      Array.isArray(bm.bars) && bm.bars.length > 0 &&
      bm.bars.every(
        (b) =>
          !!b && typeof b === 'object' &&
          nonEmptyString((b as { label?: unknown }).label) &&
          nonEmptyString((b as { expr?: unknown }).expr) &&
          positive((b as { max?: unknown }).max),
      )
    )
  }
  if (m.kind === 'tank') {
    const tm = m as { fluidExpr?: unknown; objectExpr?: unknown }
    return nonEmptyString(tm.fluidExpr) && nonEmptyString(tm.objectExpr)
  }
  if (m.kind === 'plot') {
    const pm = m as { fn?: unknown; xRange?: unknown; yRange?: unknown }
    const range = (r: unknown): boolean =>
      Array.isArray(r) && r.length === 2 && finite(r[0]) && finite(r[1]) && (r[1] as number) > (r[0] as number)
    return nonEmptyString(pm.fn) && range(pm.xRange) && range(pm.yRange)
  }
  return false
}

export const varyModule: PatternModule<VaryPayload, VaryWork> = {
  pattern: 'vary',

  initialWork(payload): VaryWork {
    // Start at the minimum so the activity is never handed over pre-solved.
    return { value: payload.variable.min }
  },

  validate(payload, work, success: SuccessRule): ValidateResult {
    // Defence in depth: a `numericWithin` rule with a tolerance tighter than
    // half the slider's step is often unreachable — the student can only ever
    // land ON a step boundary, and the target may sit between two of them.
    // Widen the tolerance (never narrow it) rather than trust the model to
    // have authored a reachable one. Step defaults to 1 to match the slider's
    // own fallback (see VaryActivity's `step={v.step && v.step > 0 ? v.step : 1}`).
    if (success.kind === 'numericWithin') {
      const step = positive(payload.variable.step) ? payload.variable.step : 1
      const minTolerance = step / 2
      if (success.tolerance < minTolerance) {
        return evaluateSuccess({ ...success, tolerance: minTolerance }, { value: work.value })
      }
    }
    return evaluateSuccess(success, { value: work.value })
  },

  isPayload(p: unknown): p is VaryPayload {
    const x = p as VaryPayload
    if (!x || typeof x !== 'object') return false
    const v = x.variable
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !v.id) return false
    // Finite, ordered bounds and a usable step: a NaN/zero step would freeze the
    // slider, and reversed bounds would render an inverted, unusable control.
    if (!finite(v.min) || !finite(v.max) || v.max <= v.min) return false
    if (v.step !== undefined && !positive(v.step)) return false
    if (typeof v.label !== 'string') return false
    const m = x.model as { kind?: unknown } | undefined
    if (!m || typeof m !== 'object' || typeof m.kind !== 'string') return false
    if (!['bars', 'tank', 'plot'].includes(m.kind)) return false
    if (!isModel(m)) return false
    if (!Array.isArray(x.readouts)) return false
    return x.readouts.every(
      (r) => !!r && typeof r.label === 'string' && typeof r.expr === 'string',
    )
  },
}
