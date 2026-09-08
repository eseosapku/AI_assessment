// lib/studylab/activities/patterns/balance.ts
import type { BalancePayload, PatternModule, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'

export interface BalanceWork { left: string[]; right: string[] }

const all = (p: BalancePayload) => [...p.left, ...p.right, ...p.pool]

/**
 * Total weight of one side. Unknown ids (a stale reference, or a keyboard-path
 * race) contribute 0 rather than NaN — `?? 0` on the Map lookup, not on the
 * arithmetic, so a missing weight can never poison the running sum.
 */
export function sideTotal(payload: BalancePayload, ids: string[]): number {
  const index = new Map(all(payload).map((i) => [i.id, i.weight]))
  return ids.reduce((sum, id) => sum + (index.get(id) ?? 0), 0)
}

/**
 * Ceiling on how many items may be authored into any one of `left`/`right`/`pool`.
 *
 * A pan is rendered `absolute`, anchored at `top: 50%` inside the ~246px-tall
 * beam box (a 300:190 aspect ratio at the card's ~388px content width) — so it
 * has roughly 120px of headroom before it would grow past the container and
 * into the pool strip below. A chip row is about 36px tall (a 20px item icon
 * plus 8px of vertical padding, plus the 8px gap to the next row), and the
 * pan's 33%-wide column is only ~103-119px after its own padding — too narrow
 * for more than one average item label per row. 120px of headroom therefore
 * holds at most 3 rows before the pan overflows its own drawn box.
 *
 * Nothing here stops a student from dragging every item onto one pan at
 * runtime (there is no `accepts()` for balance — see below), so this bounds
 * the *authored* size of each group rather than guaranteeing every possible
 * arrangement fits; BalanceActivity.tsx's `max-height` is the runtime
 * backstop for whatever a student still manages to pile onto one side. A pan
 * that can't hold its own authored items without scrolling is a material the
 * student can't see across, which is a bad Montessori material regardless of
 * layout — so it is rejected here, before a student ever meets it.
 */
const MAX_ITEMS_PER_GROUP = 3

export const balanceModule: PatternModule<BalancePayload, BalanceWork> = {
  pattern: 'balance',

  initialWork(payload): BalanceWork {
    // Seed the pans from the authored sides; everything else starts in the pool.
    return { left: payload.left.map((i) => i.id), right: payload.right.map((i) => i.id) }
  },

  validate(payload, work, success: SuccessRule): ValidateResult {
    const diff = sideTotal(payload, work.left ?? []) - sideTotal(payload, work.right ?? [])
    return evaluateSuccess(success, { value: diff })
  },

  // No accepts(): any item may sit on either pan. Being momentarily wrong is
  // the point of a balance — the tilt shows it, Check confirms it.

  isPayload(p: unknown): p is BalancePayload {
    const x = p as BalancePayload
    const okItems = (arr: unknown) =>
      Array.isArray(arr) &&
      arr.length <= MAX_ITEMS_PER_GROUP &&
      (arr as BalancePayload['pool']).every(
        (i) =>
          !!i && typeof i === 'object' &&
          typeof i.id === 'string' && i.id.length > 0 &&
          typeof i.label === 'string' &&
          typeof i.weight === 'number' && Number.isFinite(i.weight),
      )
    return (
      !!x && typeof x === 'object' &&
      okItems(x.left) && okItems(x.right) && okItems(x.pool) &&
      (x.mode === 'weights' || x.mode === 'equation') &&
      all(x).length > 0
    )
  },
}
