// lib/studylab/activities/patterns/balance.ts
import type { BalancePayload, PatternModule, SuccessRule, ValidateResult } from '../types'
import { evaluateSuccess } from '../success'
import { BALANCE_PAN } from '../dropZoneGeometry'

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
 * Ceiling on how many items may be authored onto `left` or `right` — but
 * NOT `pool` (see `okItems`/`isPayload` below for why the two differ).
 *
 * A pan is rendered `absolute`, anchored at `top: 50%` inside the beam box,
 * with roughly `BALANCE_PAN.headroomPx` of headroom below that anchor before
 * it would grow past the container and into the pool strip below (see
 * `dropZoneGeometry.ts` for the full derivation from the card's actual
 * content width, the beam's aspect ratio, and one chip row's height). A pan
 * that can't hold its own authored items without scrolling is a material
 * the student can't see across, which is a bad Montessori material
 * regardless of layout — so authoring too many onto one pan is rejected
 * here, before a student ever meets it.
 *
 * `pool`, by contrast, renders as an ordinary normal-flow strip at the
 * bottom of the card (see BalanceActivity.tsx) — no `absolute`, no
 * `max-height`, nothing for a large pool to overflow. The most ordinary
 * balance lesson there is — "here are five weights, sort them onto the
 * scale" — authors everything into `pool` and nothing pre-placed, so
 * capping it here would reject the common case for a risk it doesn't carry.
 * What a student can put ON a pan by dragging is still bounded, regardless
 * of how large the pool is: by this same cap on `left`/`right` for the
 * *authored* starting point, and by BalanceActivity.tsx's `max-height` for
 * whatever a drag piles on beyond that at runtime.
 */
const MAX_ITEMS_PER_GROUP = BALANCE_PAN.maxItems

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
    // Shape only — no cap. Shared by all three groups: an item is an item
    // regardless of which group it starts in.
    const okItems = (arr: unknown) =>
      Array.isArray(arr) &&
      (arr as BalancePayload['pool']).every(
        (i) =>
          !!i && typeof i === 'object' &&
          typeof i.id === 'string' && i.id.length > 0 &&
          typeof i.label === 'string' &&
          typeof i.weight === 'number' && Number.isFinite(i.weight),
      )
    // Cap only `left`/`right` — see MAX_ITEMS_PER_GROUP above for why `pool`
    // is exempt.
    const okGroup = (arr: unknown) => okItems(arr) && (arr as unknown[]).length <= MAX_ITEMS_PER_GROUP
    return (
      !!x && typeof x === 'object' &&
      okGroup(x.left) && okGroup(x.right) && okItems(x.pool) &&
      (x.mode === 'weights' || x.mode === 'equation') &&
      all(x).length > 0
    )
  },
}
