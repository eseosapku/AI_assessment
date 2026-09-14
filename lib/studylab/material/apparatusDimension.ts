import type { Dimension } from '@/lib/studylab/activities/dimensions'
import { getApparatus } from './canon'

/**
 * Canon apparatus name → the single quality it is built to isolate.
 *
 * balance-beam defaults to quantity (weighing). Equation-style structure still
 * uses createActivity with pattern: 'balance' + mode: 'equation' for now —
 * free-form materials have no mode field.
 */
const MAP: Record<string, Dimension> = {
  'sorting-frame': 'category',
  'ordering-track': 'order',
  'three-period-cards': 'identity',
  'venn-sets': 'membership',
  'balance-beam': 'quantity',
  'labelled-diagram': 'position',
  'variable-model': 'magnitude',
  'decision-branch': 'consequence',
  'bonding-ring': 'structure',
}

export function apparatusDimension(name: string): Dimension | null {
  if (!getApparatus(name)) return null
  return MAP[name] ?? null
}
