/**
 * First-run coach marks, per surface.
 *
 * N1 in the report: every tester was lost at some point, and one abandoned the
 * search for the assessment builder and ended up somewhere else entirely.
 *
 * The first build of this was rejected on sight, and rightly. Two faults, worth
 * separating because only one was a design failure.
 *
 * The first was mechanical: steps were anchored with a selector that walked the
 * shell's markup (`aside a[href=...]`), so an unrelated structural change —
 * making the sidebar a div, for landmark reasons — silently unhooked every
 * coach mark and left four cards floating mid-screen pointing at nothing.
 * Anchors are explicit `data-tour` attributes now, and a step whose anchor is
 * missing is skipped rather than shown adrift.
 *
 * The second was the content. "Watch it move — scores, subjects and grades over
 * time" describes a page; it teaches nothing and asks for nothing. A tour that
 * narrates the menu is the menu read aloud.
 *
 * Hence one tour per surface rather than one tour over the sidebar. A student
 * standing on the Gap Map needs to know what its colours mean, not that
 * Progress exists. Each tour is written from what is actually on that screen,
 * runs once, and is tracked separately so arriving somewhere new still explains
 * itself.
 */

export type TourId = 'home' | 'practice' | 'learnspace' | 'lesson' | 'gapmap' | 'progress' | 'recall'

export interface TourStep {
  /** Value of the target's data-tour attribute. */
  anchor: string
  /** Short label for the thing being pointed at. */
  eyebrow: string
  title: string
  body: string
  /** The one thing this step is asking for, or a caveat worth knowing. */
  action?: string
}

export interface Tour {
  id: TourId
  steps: readonly TourStep[]
}

/**
 * Ordered by what a student does on that screen, not by layout position.
 *
 * Each step earns its interruption or it is not here: what this part is for,
 * what it wants from the student, and what comes back. Anything they can work
 * out by reading the label is left out.
 */
export const TOURS: Record<TourId, Tour> = {
  home: {
    id: 'home',
    steps: [
      {
        anchor: 'hero-cta',
        eyebrow: 'Make a quiz',
        title: 'This button is the whole product',
        body:
          'Pick your syllabus topic, or type any topic you like, and you get a real quiz written from your textbook — with the page it came from printed on every question.',
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
          'Every quiz you have taken, with the questions you got wrong and why they were wrong. Retake one after studying and the same topic should come back green.',
      },
    ],
  },

  practice: {
    id: 'practice',
    steps: [
      {
        anchor: 'practice-build',
        eyebrow: 'From your syllabus',
        title: 'Built from your actual textbook',
        body:
          'Walk through curriculum, subject, topic and difficulty, and the questions are written from the book your school uses — not from the internet. Pick several topics to mix them, or drill one subtopic on its own.',
        action: 'Every question shows the page it came from.',
      },
      {
        anchor: 'practice-custom',
        eyebrow: 'Off the syllabus',
        title: 'Anything not in the curriculum',
        body:
          'Type any topic, paste your own notes, or upload a PDF of up to 10 MB. Questions come from what you provide, and pictures in the PDF can be shown beside the question. Useful for a class the syllabus does not cover, or for revising from something a teacher handed out.',
        action: 'Be specific — a whole subject gives you a shallow quiz.',
      },
      {
        anchor: 'practice-modes',
        eyebrow: 'Other ways in',
        title: 'Past papers and class work',
        body:
          'National exam prep follows real past-paper style and marking. Class work is whatever your teachers have set — it lands here and the result goes back to them.',
      },
    ],
  },

  learnspace: {
    id: 'learnspace',
    steps: [
      {
        anchor: 'learnspace-new',
        eyebrow: 'Start a lesson',
        title: 'Name what confused you',
        body:
          'The narrower the better. "Photosynthesis" gets you a tour of the topic; "why leaves are green" gets you an answer. The tutor lays out explanations, diagrams and worked examples, then quizzes you at checkpoints to see if it landed.',
        action: 'Ready in about a minute.',
      },
      {
        anchor: 'learnspace-homework',
        eyebrow: 'Stuck right now',
        title: 'Photograph the question',
        body:
          'Snap or paste a homework question and the tutor builds a lesson that walks you through solving it — the method, not just the answer. Works from a photo of the page alone.',
      },
      {
        anchor: 'learnspace-list',
        eyebrow: 'Come back later',
        title: 'Your lessons stay put',
        body:
          'Everything you build is saved here with how far through you got, so you can stop mid-lesson and pick it up another day. Lessons built from a weak topic say so on the card.',
      },
    ],
  },

  /**
   * Inside a lesson, as distinct from the `learnspace` hub above.
   *
   * Runs once the first card is on the board — not on arrival. A first-timer
   * staring at an empty canvas has nothing to point at, and every step here
   * describes a control that is only there once teaching has started. It waits
   * until something has visibly happened, then explains how to steer it.
   */
  lesson: {
    id: 'lesson',
    steps: [
      {
        anchor: 'lesson-board',
        eyebrow: 'The board',
        title: 'The board is the lesson, not the chat',
        body:
          'Every idea, example and diagram becomes a card here, joined left to right so the lesson reads as a path. The chat on the right is a thin guide that points at what it just built — the teaching itself is always on a card.',
        action: 'Drag cards anywhere. Nothing you build is ever deleted.',
      },
      {
        anchor: 'lesson-chat',
        eyebrow: 'Finding what it made',
        title: 'Every card it adds is listed here',
        body:
          'When the tutor says "see the card", the block underneath names it. Click that block and the board flies straight to it, so you never have to go hunting across the canvas.',
      },
      {
        anchor: 'lesson-continue',
        eyebrow: 'Moving and asking',
        title: 'Continue is the only thing that moves forward',
        body:
          'The outlined buttons above it are questions about what is on screen right now — asking one gets you another card without skipping ahead. You can also type your own question, or paste a photo of your working.',
        action: 'Right-click any card for Simplify, Explain deeper, or Quiz me on this.',
      },
      {
        anchor: 'lesson-plan',
        eyebrow: 'Your plan',
        title: 'Click any step to go straight to it',
        body:
          'Each row shows its own state: waiting, being taught, or done. Clicking a step you have not reached starts teaching it; clicking one you have finished brings its cards back without re-explaining them.',
      },
      {
        anchor: 'lesson-pace',
        eyebrow: 'How fast',
        title: 'Change the pace whenever it stops fitting',
        body:
          'Step by step adds one card and waits for you. Run ahead builds a whole step at once and finishes with a quick check. Switch when a step covers something you already know, and switch back when it gets hard.',
        action: 'Takes effect on the next turn.',
      },
    ],
  },

  gapmap: {
    id: 'gapmap',
    steps: [
      {
        anchor: 'gapmap-canvas',
        eyebrow: 'The whole picture',
        title: 'Your knowledge as a wall',
        body:
          'Every topic you have been quizzed on is a tile here, grouped by subject. Nothing to pan or open — the gaps are the holes in the wall, and they sort themselves to the front.',
      },
      {
        anchor: 'gapmap-legend',
        eyebrow: 'Reading it',
        title: 'Every tile carries a mark, not just a colour',
        body:
          'A tick means you are getting these right, a dash means shaky, a cross means it needs work, and a dashed outline means no quiz has covered it yet — which is not the same as being bad at it.',
      },
      {
        anchor: 'gapmap-canvas',
        eyebrow: 'Acting on it',
        title: 'Tap a hole to fill it',
        body:
          'Any tile opens a panel with what it is, how you did and how often you have been tested — and a button that builds a lesson on that exact subtopic. Find the gap, study it, prove it closed.',
      },
    ],
  },

  progress: {
    id: 'progress',
    steps: [
      {
        anchor: 'progress-overall',
        eyebrow: 'Where you stand',
        title: 'Your average, and which way it is going',
        body:
          'Across every quiz you have finished. One bad quiz moves this less than you would think, so judge it over a few weeks rather than after a single result.',
      },
      {
        anchor: 'progress-subjects',
        eyebrow: 'Split by subject',
        title: 'What is going well, and what is not',
        body:
          'Subjects are sorted so the ones needing work come to your attention first. Each one links straight into a quiz on that subject, so you can act without hunting for the builder.',
      },
      {
        anchor: 'progress-recent',
        eyebrow: 'Go back over it',
        title: 'Every question, and why it was marked that way',
        body:
          'Open any past quiz to see what you answered, what was right, and the reasoning. If you think a question is wrong you can report it, and it goes to a real reviewer.',
      },
    ],
  },

  recall: {
    id: 'recall',
    steps: [
      {
        anchor: 'recall-due',
        eyebrow: 'Today',
        title: 'Only what you are about to forget',
        body:
          'Cards come back just before you would lose them, so a short daily session beats a long one at the weekend. If nothing is due, you are done — that is the system working, not a bug.',
      },
      {
        anchor: 'recall-decks',
        eyebrow: 'Where cards come from',
        title: 'Decks build themselves from your quizzes',
        body:
          'Questions you got wrong become cards automatically, so the deck is always aimed at what you personally struggle with rather than at the topic in general.',
      },
      {
        anchor: 'recall-decks',
        eyebrow: 'Be honest',
        title: 'Rating a card decides when it returns',
        body:
          'Say a card was hard and it comes back soon; say it was easy and it waits longer. Marking everything easy to get through faster only means forgetting it before the exam.',
      },
    ],
  },
}

/** Back-compat for the original single tour. */
export const TOUR_STEPS = TOURS.home.steps

const seenKey = (id: TourId) => `ss-tour-seen-${id}`
/** The key the first version used, before tours were per-surface. */
const LEGACY_HOME_KEY = 'ss-product-tour-seen'

export function hasSeenTour(id: TourId = 'home'): boolean {
  if (typeof window === 'undefined') return true // never auto-run on the server
  try {
    if (localStorage.getItem(seenKey(id)) === '1') return true
    // Anyone who already sat through the old sidebar tour should not be shown
    // the home one again just because the key was renamed.
    return id === 'home' && localStorage.getItem(LEGACY_HOME_KEY) === '1'
  } catch {
    // If storage is unavailable the tour would run on every load, which is
    // worse than never running it.
    return true
  }
}

export function markTourSeen(id: TourId = 'home'): void {
  try {
    localStorage.setItem(seenKey(id), '1')
  } catch {
    /* a tour that reruns is a nuisance, not a failure */
  }
}

/** Replays every tour — what the Settings control offers. */
export function resetTour(): void {
  try {
    for (const id of Object.keys(TOURS) as TourId[]) localStorage.removeItem(seenKey(id))
    localStorage.removeItem(LEGACY_HOME_KEY)
  } catch {
    /* replay is best-effort */
  }
}

export function clampStep(step: number, total: number = TOURS.home.steps.length): number {
  return Math.max(0, Math.min(total - 1, step))
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
