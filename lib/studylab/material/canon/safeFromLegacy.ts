import type { MaterialSpec } from '../types'

/** Hostile model payloads may throw while legacy guards inspect getters. */
export function safeFromLegacy(convert: () => MaterialSpec | null): MaterialSpec | null {
  try {
    return convert()
  } catch {
    return null
  }
}
