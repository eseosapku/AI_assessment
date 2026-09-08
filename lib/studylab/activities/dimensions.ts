// lib/studylab/activities/dimensions.ts
import type { ActivitySpec } from './types'

/**
 * What a material can vary, as a closed vocabulary.
 *
 * The Montessori principle this serves is isolation of a single quality: the
 * pink tower varies size and nothing else — not colour, not shape, not
 * material. Enforcing that needs both halves of the comparison to be drawn
 * from the same fixed set, or checking "what you said you isolate" against
 * "what this material varies" is just comparing two pieces of free text.
 */
export type Dimension =
  | 'identity'     // which thing this is — naming
  | 'category'     // which group it belongs to
  | 'order'        // where it comes in a sequence
  | 'position'     // where it sits in space
  | 'quantity'     // how much
  | 'magnitude'    // how much, continuously varied by the student
  | 'membership'   // which set, or both
  | 'consequence'  // what follows from a choice
  | 'structure'    // how parts join

export const DIMENSIONS: readonly Dimension[] = [
  'identity', 'category', 'order', 'position',
  'quantity', 'magnitude', 'membership', 'consequence', 'structure',
]

const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []

/** How many different values a field takes across a list of pieces. */
const spread = (items: Record<string, unknown>[], field: string): number =>
  new Set(items.map((i) => i[field])).size

/**
 * What this material actually varies, read off the payload rather than from
 * anything the tutor claimed.
 *
 * Nine patterns each vary one thing by construction — that is what made them
 * teachable in the first place. `balance` is the exception: it varies quantity
 * when weighing and structure when balancing an equation, and `mode` says which.
 *
 * A pattern only counts as varying its dimension if the payload genuinely
 * does. A sorting frame whose items all go in one bin varies nothing, and a
 * three-period card with two items sharing one label names nothing — both
 * are degenerate materials that would otherwise sail through the intent
 * check by virtue of their pattern name (or a mere item count) alone.
 * Returning `[]` makes them unjustifiable.
 */
export function dimensionsOf(spec: ActivitySpec): Dimension[] {
  const p = (spec?.payload ?? {}) as unknown as Record<string, unknown>
  switch (spec?.pattern) {
    case 'threePeriod':
      return spread(list(p.items), 'label') >= 2 ? ['identity'] : []
    case 'sort':
      return list(p.bins).length >= 2 && spread(list(p.items), 'binId') >= 2 ? ['category'] : []
    case 'label':
      return list(p.hotspots).length >= 2 ? ['position'] : []
    case 'sequence':
      return list(p.items).length >= 2 ? ['order'] : []
    case 'compare':
      return spread(list(p.items), 'belongs') >= 2 ? ['membership'] : []
    case 'scenario':
      return spread(list(p.choices), 'consequence') >= 2 ? ['consequence'] : []
    case 'compose':
      return list(p.parts).length >= 2 ? ['structure'] : []
    case 'vary': {
      const v = (p.variable ?? {}) as Record<string, unknown>
      return Number(v.max) > Number(v.min) ? ['magnitude'] : []
    }
    case 'balance': {
      if (p.mode === 'equation') return ['structure']
      const pool = [...list(p.pool), ...list(p.left), ...list(p.right)]
      return spread(pool, 'weight') >= 2 ? ['quantity'] : []
    }
    default:
      return []
  }
}
