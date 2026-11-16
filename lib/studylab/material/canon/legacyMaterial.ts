// lib/studylab/material/canon/legacyMaterial.ts
import type { SuccessRule } from '../../activities/types'
import type { MaterialSpec } from '../types'
import { getApparatus } from '.'

/** Enough for every activity on a long lesson's board; the oldest go first. */
const KEEP = 64
const converted = new Map<string, MaterialSpec | null>()

/**
 * A legacy activity as the apparatus draws it, converted once. Converting runs
 * the solver (validateMaterial -> isSolvable, up to 50,000 states), and the
 * activity card did it on every render: drawing station 2's sort in the owner's
 * Sonder lesson froze the board for 1.1 s, and every redraw of the board -- each
 * Continue, each glide -- paid again for every sort and track on it.
 *
 * Keyed by what the activity says, not by object identity, so the same activity
 * rebuilt from saved state is still found.
 */
export function legacyMaterial(apparatus: string, payload: unknown, success: SuccessRule | undefined): MaterialSpec | null {
  const legacy = getApparatus(apparatus)?.legacy
  if (!legacy) return null
  let key: string
  try {
    key = `${apparatus}\n${JSON.stringify(payload)}\n${JSON.stringify(success ?? null)}`
  } catch {
    return legacy.fromLegacy(payload, success)
  }
  if (converted.has(key)) return converted.get(key) ?? null
  const material = legacy.fromLegacy(payload, success)
  converted.set(key, material)
  if (converted.size > KEEP) converted.delete(converted.keys().next().value as string)
  return material
}
