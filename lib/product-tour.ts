/**
 * The first-run tour.
 *
 * N1 in the report: every tester was lost at some point, and one abandoned the
 * search for the assessment builder and ended up somewhere else entirely.
 *
 * The first build of this was rejected on sight, and rightly. Two faults, and
 * they are worth separating because only one of them was a design failure.
 *
 * The first was mechanical: steps were anchored with a selector that walked the
 * shell's markup (`aside a[href=...]`), so an unrelated structural change —
 * making the sidebar a div for landmark reasons — silently unhooked every coach
 * mark and left four cards floating in the middle of the screen pointing at
 * nothing. Anchors are explicit `data-tour` attributes now, and a step whose
 * anchor is missing is skipped rather than shown adrift.
 *
 * The second was the content. "Watch it move — scores, subjects and grades over
 * time" describes a page; it does not teach anyone anything or tell them what
 * to do. A tour that narrates the menu is a menu read aloud. Each step now names
 * the one thing that section is for, what it needs from the student, and what
 * comes back — and the first step points at the button they actually have to
 * press.
 */

export interface TourStep {
  /** Value of the target's data-tour attribute. */
  anchor: string
  /** Short label for the thing being pointed at. */
  eyebrow: string
  title: string
  body: string
  /** The one action this step is asking for, when there is one. */
  action?: string
}

/**
 * Ordered by what a student does first, not by the order of the sidebar. The
 * tester who got lost was looking for the quiz builder, so that is step one and
 * it points at the button, not at a menu item.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    anchor: 'hero-cta',
    eyebrow: 'Make a quiz',
    title: 'This button is the whole product',
    body:
      'Pick your syllabus topic, or type any topic you like, and you get a real quiz written from your textbook — with the page it came from on every question.',
    action: 'Takes about a minute to build.',
  },
  {
    anchor: '/studylab',
    eyebrow: 'When you get stuck',
    title: 'Ask for a lesson, not an answer',
    body:
      'Name what you are stuck on and LearnSpace writes the lesson for it — explanations, diagrams, worked examples, and checkpoints that quiz you as you go. You can photograph a homework question and it will work through it with you.',
  },
  {
    anchor: '/studylab/gap-map',
    eyebrow: 'What to study next',
    title: 'Your weak topics, found for you',
    body:
      'Every topic you have been quizzed on, coloured by how you did. You never have to guess what to revise — tap a red one and it builds you a lesson on that exact thing.',
    action: 'Fills in after your first quiz.',
  },
  {
    anchor: '/progress',
    eyebrow: 'Proof it is working',
    title: 'Retake anything, and watch it move',
    body:
      'Every quiz you have taken, with the questions you got wrong and why. Retake one after studying and the same topic should come back green.',
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
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* nothing to do — a tour that reruns is a nuisance, not a failure */
  }
}

export function resetTour(): void {
  try {
    localStorage.removeItem(SEEN_KEY)
  } catch {
    /* replay is best-effort */
  }
}

export function clampStep(step: number): number {
  return Math.max(0, Math.min(TOUR_STEPS.length - 1, step))
}

/** Where a panel should sit relative to its anchor, given the room available. */
export type Placement = 'right' | 'left' | 'below' | 'above' | 'center'

export function choosePlacement(
  anchor: { top: number; left: number; right: number; bottom: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 16,
): Placement {
  if (viewport.width - anchor.right >= panel.width + gap) return 'right'
  if (anchor.left >= panel.width + gap) return 'left'
  if (viewport.height - anchor.bottom >= panel.height + gap) return 'below'
  if (anchor.top >= panel.height + gap) return 'above'
  return 'center'
}
