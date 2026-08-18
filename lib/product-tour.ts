/**
 * The first-run tour of the sidebar.
 *
 * N1 in the report: "every tester had at least one moment of being lost", and
 * one gave up looking for the assessment builder and ended up in LearnSpace.
 * The nav labels alone do not say what a section is for — that was the same
 * finding behind renaming StudyLab and adding the section copy.
 *
 * Deliberately separate from the existing signup onboarding (lib/onboarding.ts),
 * which asks who the student is. This one shows them around, and can be
 * replayed without redoing that.
 */

export interface TourStep {
  /** Nav href the step points at, matched against the rendered links. */
  href: string
  title: string
  body: string
}

/**
 * Ordered by what a student does first, not by the order of the sidebar: the
 * point of the tour is the path through the product, and Practice is where the
 * tester who got lost was trying to go.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    href: '/practice',
    title: 'Start here',
    body: 'Build a quiz from your syllabus, prep for a national exam, or type any topic you like.',
  },
  {
    href: '/studylab',
    title: 'Stuck on something?',
    body: 'LearnSpace draws you the whole lesson — explanations, diagrams and checkpoints that quiz you as you go.',
  },
  {
    href: '/studylab/gap-map',
    title: 'See where the gaps are',
    body: 'Every topic you have been quizzed on, colour-coded. Tap a weak one to study it.',
  },
  {
    href: '/progress',
    title: 'Watch it move',
    body: 'Scores, subjects and grades over time — and every quiz you can retake.',
  },
]

const SEEN_KEY = 'ss-product-tour-seen'

export function hasSeenTour(): boolean {
  if (typeof window === 'undefined') return true // never auto-run on the server
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    // If storage is unavailable the tour would run on every load, which is
    // worse than never running it.
    return true
  }
}

export function markTourSeen(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* nothing to do — the tour simply may show again */
  }
}

export function resetTour(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SEEN_KEY)
  } catch {
    /* ignore */
  }
}

/** Clamp a step index to the tour, so a stale index cannot render nothing. */
export function clampStep(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0
  return Math.min(Math.floor(index), TOUR_STEPS.length - 1)
}
