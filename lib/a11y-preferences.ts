/**
 * Accessibility preferences the student controls.
 *
 * The rest of this work fixed defaults — contrast, type size, focus, motion.
 * Defaults can only ever suit most people. Someone with low vision may still
 * want larger text than a design can reasonably ship, and someone with
 * vestibular sensitivity may be on a device that never sets
 * prefers-reduced-motion.
 *
 * Stored per browser rather than per account on purpose: these describe the
 * device and the room you are in, not the person. The same student on a phone
 * in bright sun and a laptop indoors wants different answers.
 */

export interface A11yPreferences {
  /** Stronger text and border contrast than the AA default. */
  highContrast: boolean
  /** Scales the whole interface. */
  largeText: boolean
  /** Suppress animation beyond what the OS setting already covers. */
  reducedMotion: boolean
}

export const DEFAULT_PREFERENCES: A11yPreferences = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
}

export const A11Y_STORAGE_KEY = 'ss-a11y-preferences'

/** Coerce anything read from storage into a usable set. */
export function normalizePreferences(raw: unknown): A11yPreferences {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    highContrast: src.highContrast === true,
    largeText: src.largeText === true,
    reducedMotion: src.reducedMotion === true,
  }
}

export function readPreferences(): A11yPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY)
    return normalizePreferences(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function writePreferences(prefs: A11yPreferences): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(normalizePreferences(prefs)))
  } catch {
    // Private mode: the preference applies for this session and is not kept.
  }
}

/**
 * The attributes the stylesheet keys off.
 *
 * Returned rather than applied so the mapping is testable without a DOM, and
 * so the same values can be set during server render later without moving the
 * logic.
 */
export function preferenceAttributes(prefs: A11yPreferences): Record<string, string | null> {
  return {
    'data-a11y-contrast': prefs.highContrast ? 'high' : null,
    'data-a11y-text': prefs.largeText ? 'large' : null,
    'data-a11y-motion': prefs.reducedMotion ? 'reduced' : null,
  }
}

/** Apply to the document root. A null value removes the attribute entirely. */
export function applyPreferences(prefs: A11yPreferences, root?: HTMLElement): void {
  const el = root ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!el) return
  for (const [attr, value] of Object.entries(preferenceAttributes(prefs))) {
    if (value === null) el.removeAttribute(attr)
    else el.setAttribute(attr, value)
  }
}
