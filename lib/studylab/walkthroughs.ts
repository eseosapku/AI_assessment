// lib/studylab/walkthroughs.ts

/**
 * Guided runs through the LearnSpace, done on the learner's own lesson.
 *
 * Distinct from the coach marks in `product-tour`, which point at controls and
 * say what they are. This answers the question that comes after that one: what
 * do I actually DO with them? Each walkthrough is a real task — learn something
 * properly, skim something you half-know, make the tutor explain it your way —
 * broken into steps that tick off when the learner performs them for real,
 * rather than when they press Next.
 *
 * Nothing here simulates anything. A step completes because the action
 * happened in the lesson, which is why the events are the ones the workspace
 * already dispatches.
 */

export type WalkthroughEvent =
  | 'plan-shown'
  | 'plan-redrafted'
  | 'plan-accepted'
  | 'beat-taught'
  | 'pace-changed'
  | 'step-jumped'
  | 'question-asked'
  | 'card-menu-used'
  | 'check-answered'
  | 'block-added'
  | 'tested-out'

export interface WalkthroughStep {
  /** The action, in the imperative. */
  action: string
  /** Why it is worth doing — the part a tooltip would leave out. */
  why: string
  /** The event that ticks this step off. */
  on: WalkthroughEvent
  /** A `data-tour` anchor to point at while this step is current. */
  anchor?: string
}

export interface Walkthrough {
  id: string
  /** What the learner is trying to do, in their words. */
  title: string
  blurb: string
  steps: readonly WalkthroughStep[]
}

export const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: 'learn-properly',
    title: 'Learn something new, properly',
    blurb: 'Shape the plan before it starts, then go a card at a time and ask as you go.',
    steps: [
      {
        action: 'Read the proposed plan in the chat',
        why: 'Nothing gets built until you agree to it. This is the cheapest moment to change the lesson.',
        on: 'plan-shown',
      },
      {
        action: 'Press "Answer / change it" and say what you want',
        why: 'Answer the question it asked, or just say "skip the history, I only need the maths". It redrafts around what you said.',
        on: 'plan-redrafted',
      },
      {
        action: 'Choose "Step by step", then start',
        why: 'One card per turn, so you can stop and ask before the next idea lands on top of the last one.',
        on: 'plan-accepted',
      },
      {
        action: 'Ask a question in your own words',
        why: 'Type it in the box. The answer arrives as a card joined to the step you are on — not as a line of chat you will scroll past.',
        on: 'question-asked',
      },
      {
        action: 'Answer the check when it appears',
        why: 'Getting one wrong is useful: the tutor re-teaches that exact point instead of moving on.',
        on: 'check-answered',
      },
    ],
  },
  {
    id: 'skim-it',
    title: 'Skim a topic you half-know',
    blurb: 'Turn the pace up, jump past what you have already got, and prove the rest.',
    steps: [
      {
        // Worded without naming a destination on purpose: a step that says
        // "switch to Run ahead" cannot be completed by someone already on it.
        action: 'Try the other pace',
        why: '"Run ahead" builds a whole step in one turn and ends in a check; "Step by step" adds one card and waits. Switch and the next turn obeys it.',
        on: 'pace-changed',
        anchor: 'lesson-pace',
      },
      {
        action: 'Click a later step in the plan',
        why: 'You do not have to go in order. A step you have not reached starts teaching straight away.',
        on: 'step-jumped',
        anchor: 'lesson-plan',
      },
      {
        action: 'Answer its check',
        why: 'This is the part worth not skipping. It is the only thing that tells you the skim was safe.',
        on: 'check-answered',
      },
    ],
  },
  {
    id: 'make-it-yours',
    title: 'Make the tutor explain it your way',
    blurb: 'Rewrite a card you did not follow, and put your own notes beside the lesson.',
    steps: [
      {
        action: 'Open a card’s menu and pick "Simplify this"',
        why: 'It rewrites that card in plainer terms, in place. "Explain this deeper" does the reverse.',
        on: 'card-menu-used',
        anchor: 'lesson-board',
      },
      {
        action: 'Ask for an example of something',
        why: 'Either from the chips under the chat or in your own words. Worked examples are what make an idea stick.',
        on: 'question-asked',
      },
      {
        action: 'Add a block of your own',
        why: 'Use "Add block" for a sticky note, a checklist or a scratchpad. The board is yours as well as the tutor’s.',
        on: 'block-added',
      },
    ],
  },
] as const

export function walkthroughById(id: string): Walkthrough | undefined {
  return WALKTHROUGHS.find((w) => w.id === id)
}

/**
 * Which step is current, given what has happened so far.
 *
 * Steps complete in order. An event that matches a later step while an earlier
 * one is outstanding is ignored on purpose: a walkthrough that ticked off
 * whatever happened to fire would jump around, and the learner would lose the
 * thread of what they were being shown.
 *
 * Returns the number completed, so `steps.length` means finished.
 */
export function progressFor(steps: readonly WalkthroughStep[], events: readonly WalkthroughEvent[]): number {
  let done = 0
  for (const event of events) {
    if (done >= steps.length) break
    if (steps[done].on === event) done += 1
  }
  return done
}

const KEY = 'ss-walkthrough'

/** The walkthrough in progress, if any, and how far through it the learner is. */
export interface WalkthroughState {
  id: string
  events: WalkthroughEvent[]
}

export function loadWalkthrough(): WalkthroughState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WalkthroughState>
    if (typeof parsed?.id !== 'string' || !walkthroughById(parsed.id)) return null
    return { id: parsed.id, events: Array.isArray(parsed.events) ? parsed.events : [] }
  } catch {
    // Storage can be unavailable or hold something from an older shape. Either
    // way, no walkthrough is better than a broken one.
    return null
  }
}

export function saveWalkthrough(state: WalkthroughState | null): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state))
    else localStorage.removeItem(KEY)
  } catch {
    /* a walkthrough that forgets its place is a nuisance, not a failure */
  }
}
