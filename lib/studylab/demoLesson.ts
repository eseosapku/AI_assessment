// lib/studylab/demoLesson.ts
import type { LessonStep } from './lessonRun'
import type { CheckpointQuestion, TutorAction } from './types'

/**
 * A complete lesson with nothing behind it.
 *
 * Every card, sentence and question here is written by hand. Running the demo
 * calls no model, saves nothing, spends nothing and cannot fail — so a first
 * LearnSpace is never a throwaway, and a first impression never depends on a
 * generation going well.
 *
 * It is a SCRIPT OF ACTS rather than a lesson that reacts. Each act names the
 * one thing the learner should do next, and the tutor's answer to it is already
 * written. That is what lets the demo cover the whole surface — the plan, the
 * pace, chips, asking, rewriting a card, checks, jumping, your own blocks —
 * in a fixed order, instead of hoping the learner stumbles into each one.
 */

export const DEMO_TITLE = 'Why the sky is blue'
export const DEMO_SUBJECT = 'A guided demo'

export const DEMO_STEPS: LessonStep[] = [
  {
    id: 'd1',
    title: 'Sunlight is every colour at once',
    goal: 'See that white light is a mixture, not a single thing.',
    status: 'pending',
    cardIds: [],
  },
  {
    id: 'd2',
    title: 'Air scatters blue much more',
    goal: 'Understand why short wavelengths bounce around the sky.',
    status: 'pending',
    cardIds: [],
  },
  {
    id: 'd3',
    title: 'So why are sunsets red?',
    goal: 'Apply the same idea to light travelling through more air.',
    status: 'pending',
    cardIds: [],
  },
]

export const DEMO_PLAN_QUESTIONS = [
  'Do you want the physics, or just enough to explain it to someone?',
]

/** The thing a learner must do to move the demo on. */
export type DemoTrigger =
  | 'accept-plan'
  | 'continue'
  | 'chip'
  | 'ask'
  | 'card-menu'
  | 'answer-check'
  | 'set-pace'
  | 'jump'
  | 'add-block'

export interface DemoAct {
  /** What advances this act. */
  expect: DemoTrigger
  /** The one thing to do now, and why it is worth knowing. */
  cue: { action: string; why: string; anchor?: string }
  /** The tutor's scripted reply. */
  say?: string
  /** Canvas actions to play. */
  actions?: TutorAction[]
  /** Chips offered after this act. The next act's `chip` trigger uses the first. */
  suggestions?: string[]
  /**
   * Text put into the chat box for an `ask` act.
   *
   * The box is read-only throughout the demo: there is no model to answer
   * anything typed, and an input that swallows what you write teaches that the
   * tutor ignores you. Showing the question already written, ready to send,
   * demonstrates the same thing honestly.
   */
  compose?: string
  /** Which step this act belongs to, 1-based. Drives the rail and grouping. */
  step: number
  /** Set when the act's actions open a check that gates Continue. */
  opensCheck?: string
  /** Set when answering the check completes the step. */
  completesStep?: boolean
}

const CHECK_1: CheckpointQuestion[] = [
  {
    id: 'demo-q1',
    format: 'mcq',
    prompt: 'What does a prism actually do to sunlight?',
    options: [
      'Adds colour to light that had none',
      'Separates colours that were already there',
      'Removes every colour except blue',
    ],
    answer: 1,
    explain: 'The colours are already in the light. A prism bends each by a different amount, spreading them apart.',
  },
]

const CHECK_2: CheckpointQuestion[] = [
  {
    id: 'demo-q2',
    format: 'mcq',
    prompt: 'Why does the whole sky look blue, not just the part near the Sun?',
    options: [
      'Blue light is scattered in every direction by the air',
      'The atmosphere is made of blue gas',
      'Our eyes cannot see the other colours',
    ],
    answer: 0,
    explain: 'Scattered blue arrives from all over the sky, not only along the line to the Sun.',
  },
]

const CHECK_3: CheckpointQuestion[] = [
  {
    id: 'demo-q3',
    format: 'mcq',
    prompt: 'What has changed at sunset compared with midday?',
    options: [
      'The Sun emits different colours in the evening',
      'The light travels through much more air before reaching you',
      'The atmosphere cools and stops scattering',
    ],
    answer: 1,
    explain: 'A shallow angle means a much longer path through the atmosphere.',
  },
]

export const DEMO_ACTS: readonly DemoAct[] = [
  // ── Step 1: taught a card at a time, with every way of steering ──────────
  {
    expect: 'accept-plan',
    step: 1,
    cue: {
      action: 'Read the plan, then press “Looks good, start”',
      why: 'Every lesson opens with a plan you have to agree to — nothing is built until you do. “Answer / change it” is where you reshape it, and redoing it costs nothing.',
      anchor: 'lesson-chat',
    },
    say: 'Start here — sunlight only looks white. See the card.',
    suggestions: ['Show me what a prism does', 'Go deeper'],
    actions: [
      {
        type: 'createCard',
        id: 'd1-white',
        card: 'concept',
        step: 1,
        title: 'White light is a mixture',
        body:
          'Sunlight looks colourless, but it is every colour of the rainbow travelling together. A prism does not add colour — it separates what was already there, because each colour bends by a slightly different amount.',
        items: ['Red bends least', 'Violet bends most'],
      },
    ],
  },
  {
    expect: 'continue',
    step: 1,
    cue: {
      action: 'Press Continue',
      why: 'Continue is the only control that moves the lesson forward. Everything else explores where you already are.',
      anchor: 'lesson-continue',
    },
    say: 'And the colours differ in one way that matters for all of this.',
    suggestions: ['Show me what a prism does', 'Why is violet not the answer?'],
    actions: [
      {
        type: 'createCard',
        id: 'd1-wavelength',
        card: 'table',
        step: 1,
        title: 'Colour is wavelength',
        rows: [
          ['Colour', 'Wavelength', 'Behaviour in air'],
          ['Red', 'Long (~700 nm)', 'Passes through easily'],
          ['Green', 'Middle (~550 nm)', 'Scatters a little'],
          ['Blue', 'Short (~450 nm)', 'Scatters a lot'],
        ],
      },
      { type: 'connect', from: 'd1-white', to: 'd1-wavelength', label: 'differ by' },
    ],
  },
  {
    expect: 'chip',
    step: 1,
    cue: {
      action: 'Press the chip “Show me what a prism does”',
      why: 'The outlined buttons are questions about what is on the board right now. Asking one adds a card without skipping ahead — the lesson stays where it is.',
      anchor: 'lesson-chat',
    },
    say: 'Here is the prism itself.',
    suggestions: ['Why is violet not the answer?'],
    actions: [
      {
        type: 'createCard',
        id: 'd1-prism',
        card: 'mermaid',
        step: 1,
        title: 'What a prism does',
        mermaid:
          'graph LR; A[White light in] --> B[Glass bends each colour differently]; B --> C[Red out]; B --> D[Green out]; B --> E[Blue out]',
        body: 'One beam in, a spread of colours out — none of them added by the glass.',
      },
      { type: 'connect', from: 'd1-white', to: 'd1-prism', label: 'shown by' },
    ],
  },
  {
    expect: 'ask',
    step: 1,
    compose: 'Why do we see a rainbow after it rains?',
    cue: {
      action: 'Send the question already in the box',
      why: 'You can ask anything in your own words. The answer arrives as a card joined to the step you are on — not as a line of chat you will scroll past.',
      anchor: 'lesson-chat',
    },
    say: 'Good question — same physics, different glass.',
    actions: [
      {
        type: 'createCard',
        id: 'd1-rainbow',
        card: 'concept',
        step: 1,
        title: 'Raindrops are prisms',
        body:
          'A raindrop bends and reflects light just as a prism does. Millions of them, each sending a slightly different colour towards your eye, is what makes an arc of separated colour across the sky.',
      },
      { type: 'connect', from: 'd1-prism', to: 'd1-rainbow', label: 'in nature' },
    ],
  },
  {
    expect: 'card-menu',
    step: 1,
    cue: {
      action: 'Right-click “White light is a mixture” and pick “Simplify this”',
      why: 'Any card can be rewritten where it sits — simpler, deeper, or with an example added. You never have to accept a card you did not follow.',
      anchor: 'lesson-board',
    },
    say: 'Rewritten it plainly — same card, simpler words.',
    actions: [
      {
        type: 'updateCard',
        id: 'd1-white',
        title: 'White light is a mixture',
        body:
          'White light is all the colours mixed together. A prism does not colour the light — it just spreads the colours apart so you can see them separately.',
      },
    ],
  },
  {
    expect: 'continue',
    step: 1,
    opensCheck: 'demo-cp-1',
    cue: {
      action: 'Press Continue',
      why: 'The step has covered its idea, so the tutor closes it with a check rather than adding more cards.',
      anchor: 'lesson-continue',
    },
    say: 'Quick check before we move on — it is on the board.',
    actions: [
      { type: 'checkpoint', id: 'demo-cp-1', step: 1, gate: 'hard', questions: CHECK_1 },
    ],
  },
  {
    expect: 'answer-check',
    step: 1,
    completesStep: true,
    cue: {
      action: 'Answer the check on the board',
      why: 'A check blocks Continue until it is answered. Getting one wrong is not a dead end — the tutor re-teaches that point instead of moving on.',
      anchor: 'lesson-board',
    },
  },

  // ── Step 2: the same lesson at the other pace ────────────────────────────
  {
    expect: 'set-pace',
    step: 2,
    cue: {
      action: 'Switch the pace to “Run ahead”',
      why: '“Step by step” adds one card and waits, which is what you have had so far. “Run ahead” builds a whole step in one turn and finishes with the check. Switch whenever a step is covering something you already know.',
      anchor: 'lesson-pace',
    },
  },
  {
    expect: 'continue',
    step: 2,
    opensCheck: 'demo-cp-2',
    cue: {
      action: 'Press Continue and watch the difference',
      why: 'At this pace the whole step arrives at once — three cards and its check, instead of one card and a wait.',
      anchor: 'lesson-continue',
    },
    say: 'Whole step this time: why the sky is blue, and the check.',
    actions: [
      {
        type: 'createCard',
        id: 'd2-scatter',
        card: 'concept',
        step: 2,
        title: 'Small things scatter small waves',
        body:
          'Air molecules are far smaller than a wavelength of light. Molecules that size deflect short waves far more strongly than long ones — blue gets bounced around the sky, while red carries straight on.',
      },
      {
        type: 'createCard',
        id: 'd2-diagram',
        card: 'mermaid',
        step: 2,
        title: 'Where the blue ends up',
        mermaid:
          'graph LR; A[Sunlight] --> B[Air molecules]; B --> C[Blue scattered everywhere]; B --> D[Red passes straight through]; C --> E[You see a blue sky]',
        body: 'Blue is scattered across the whole sky, so it reaches your eye from every direction.',
      },
      {
        type: 'createCard',
        id: 'd2-violet',
        card: 'callout',
        step: 2,
        variant: 'tip',
        title: 'So why not violet?',
        body:
          'Violet scatters even more than blue. But the Sun puts out less violet, and our eyes are far more sensitive to blue — so blue is what we notice.',
      },
      { type: 'connect', from: 'd2-scatter', to: 'd2-diagram', label: 'in short' },
      { type: 'connect', from: 'd2-scatter', to: 'd2-violet', label: 'but' },
      { type: 'checkpoint', id: 'demo-cp-2', step: 2, gate: 'hard', questions: CHECK_2 },
    ],
  },
  {
    expect: 'answer-check',
    step: 2,
    completesStep: true,
    cue: {
      action: 'Answer this one too',
      why: 'Both paces end the same way. The check is what tells you the step actually landed.',
      anchor: 'lesson-board',
    },
  },

  // ── Step 3: reached by jumping, and made yours ───────────────────────────
  {
    expect: 'jump',
    step: 3,
    cue: {
      action: 'Click step 3 in the plan on the left',
      why: 'You do not have to go in order. A step you have not reached starts teaching straight away; one you have finished just shows you what you built.',
      anchor: 'lesson-plan',
    },
    say: 'Same idea, more air in the way.',
    suggestions: ['Show another example'],
    actions: [
      {
        type: 'createCard',
        id: 'd3-sunset',
        card: 'callout',
        step: 3,
        variant: 'definition',
        title: 'Sunsets are the leftovers',
        body:
          'At sunset the light reaches you at a shallow angle, so it travels through far more air. Almost all the blue has been scattered away before it arrives — what is left to reach your eye is red and orange.',
      },
    ],
  },
  {
    expect: 'add-block',
    step: 3,
    cue: {
      action: 'Open “Add block” and drop in a sticky note',
      why: 'The board is yours as well as the tutor’s. Notes, checklists, images and a code scratchpad all sit alongside the lesson and are saved with it.',
      anchor: 'lesson-add-block',
    },
    say: 'Your note sits on the board with everything else.',
  },
  {
    expect: 'continue',
    step: 3,
    opensCheck: 'demo-cp-3',
    cue: {
      action: 'Press Continue for the last card',
      why: 'One more card, then the check that finishes the lesson.',
      anchor: 'lesson-continue',
    },
    say: 'And that is the whole explanation.',
    actions: [
      {
        type: 'createCard',
        id: 'd3-summary',
        card: 'concept',
        step: 3,
        title: 'The whole thing in one line',
        body:
          'Air scatters blue light. A little air gives you a blue sky; a lot of air gives you a red sunset. Same physics, different path length.',
      },
      { type: 'connect', from: 'd3-sunset', to: 'd3-summary', label: 'so' },
      { type: 'checkpoint', id: 'demo-cp-3', step: 3, gate: 'hard', questions: CHECK_3 },
    ],
  },
  {
    expect: 'answer-check',
    step: 3,
    completesStep: true,
    cue: {
      action: 'Answer the last check',
      why: 'That finishes the lesson. A real one then offers you a proper quiz whose score moves your gap map.',
      anchor: 'lesson-board',
    },
  },
] as const

/** The act the demo is waiting on, or undefined when it is finished. */
export function actAt(index: number): DemoAct | undefined {
  return DEMO_ACTS[index]
}

export function isFinished(index: number): boolean {
  return index >= DEMO_ACTS.length
}

/** The chips on offer while `index` is outstanding — the previous act's. */
export function suggestionsAt(index: number): string[] {
  for (let i = index - 1; i >= 0; i -= 1) {
    const s = DEMO_ACTS[i].suggestions
    if (s) return s
  }
  return []
}

/**
 * What the learner should do now.
 *
 * There is always an answer. A tutorial that shows you a workspace and says
 * nothing is the thing this exists to fix.
 */
export function cueAt(index: number): { action: string; why: string; anchor?: string } {
  const act = DEMO_ACTS[index]
  if (act) return act.cue
  return {
    action: 'That is the whole loop — you are ready',
    why:
      'Plan, teach, ask, check, next step. A real lesson works exactly like this; the only difference is that the cards are written for whatever you asked for.',
  }
}
