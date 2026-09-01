// lib/studylab/demoGate.ts

/**
 * Whether to offer the demo before a learner's first real lesson.
 *
 * Offered once, on whichever LearnSpace they open first — a topic they typed, a
 * gap from the map, or a homework photo. That is the only moment the offer is
 * useful: before it, they have nothing to apply it to; after it, they have
 * already worked it out or already given up.
 *
 * Answering either way settles it. Declining counts: someone who said no should
 * not be asked again every time they start a lesson.
 */

const KEY = 'ss-studylab-demo-seen'

export function hasSeenDemo(): boolean {
  if (typeof window === 'undefined') return true // never offer during SSR
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // With storage unavailable the offer would return on every lesson, which is
    // worse than never showing it.
    return true
  }
}

export function markDemoSeen(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* an offer that reappears is a nuisance, not a failure */
  }
}

/** Lets the offer be seen again — what a "replay the tour" control would call. */
export function resetDemoSeen(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* best effort */
  }
}
