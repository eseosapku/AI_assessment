import type { Dimension } from '@/lib/studylab/activities/dimensions'
import { getApparatus } from './canon'

/**
 * Canon apparatus name → qualities it is built to isolate.
 *
 * Most apparatus teach one quality. balance-beam teaches quantity when weighing
 * and structure when balancing equations — free-form materials have no `mode`
 * field, so both isolates are accepted for that name.
 */
const MAP: Record<string, readonly Dimension[]> = {
  'sorting-frame': ['category'],
  'ordering-track': ['order'],
  'three-period-cards': ['identity'],
  'venn-sets': ['membership'],
  'balance-beam': ['quantity', 'structure'],
  'labelled-diagram': ['position'],
  'variable-model': ['magnitude'],
  'decision-branch': ['consequence'],
  'bonding-ring': ['structure'],
}

/** Primary (advertised first) dimension for an apparatus, or null if unknown. */
export function apparatusDimension(name: string): Dimension | null {
  const dims = apparatusDimensions(name)
  return dims?.[0] ?? null
}

/** All accepted isolates for an apparatus, or null if the name is not canon. */
export function apparatusDimensions(name: string): readonly Dimension[] | null {
  if (!getApparatus(name)) return null
  return MAP[name] ?? null
}
