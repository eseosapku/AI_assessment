// lib/studylab/demoLesson.ts
import type { LessonStep, LessonRun } from './lessonRun'
import type { CheckpointQuestion, TutorAction } from './types'

/**
 * A complete lesson with nothing behind it.
 *
 * Every card, sentence and question here is written by hand. Running the demo
 * calls no model, spends nothing, saves nothing, and cannot fail — which is the
 * point: a first-time user should be able to learn the controls without their
 * first impression depending on a generation going well, and without their
 * first LearnSpace being a throwaway.
 *
 * It drives the real `LessonRun` state machine and renders through the real
 * canvas, sidebar and chat, so everything learned here transfers exactly. The
 * only thing replaced is where the content comes from.
 *
 * The topic is deliberately not academic. Nobody should feel tested by the
 * tutorial.
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

/** The questions the plan card asks before the demo lesson starts. */
export const DEMO_PLAN_QUESTIONS = [
  'Do you want the physics, or just enough to explain it to someone?',
]

interface DemoBeat {
  say: string
  actions: TutorAction[]
  suggestions?: string[]
}

interface DemoStepScript {
  beats: DemoBeat[]
  check: { id: string; questions: CheckpointQuestion[] }
}

/**
 * What the tutor "produces" on each turn.
 *
 * Two beats per step, then a check — the same shape a real lesson settles into,
 * so the pacing the learner sees here is the pacing they will get.
 */
const SCRIPT: Record<string, DemoStepScript> = {
  d1: {
    beats: [
      {
        say: 'Start here — sunlight only looks white. See the card.',
        suggestions: ['Show me the colours', 'Why does a prism work?'],
        actions: [
          {
            type: 'createCard',
            id: 'd1-white',
            card: 'concept',
            step: 1,
            title: 'White light is a mixture',
            body:
              'Sunlight looks colourless, but it is every colour of the rainbow travelling together. A prism does not add colour to light — it separates what was already there, because each colour bends by a slightly different amount.',
            items: ['Red bends least', 'Violet bends most'],
          },
        ],
      },
      {
        say: 'And the colours differ in one way that matters for the rest of this.',
        suggestions: ['What is a wavelength?', 'Show me a comparison'],
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
    ],
    check: {
      id: 'demo-cp-1',
      questions: [
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
          explain:
            'The colours are already in the light. The prism bends each by a different amount, spreading them apart.',
        },
      ],
    },
  },

  d2: {
    beats: [
      {
        say: 'Now the bit that makes the sky blue rather than, say, violet.',
        suggestions: ['Why not violet?', 'Show me what scattering looks like'],
        actions: [
          {
            type: 'createCard',
            id: 'd2-scatter',
            card: 'concept',
            step: 2,
            title: 'Small things scatter small waves',
            body:
              'Air molecules are far smaller than a wavelength of light. Molecules that size deflect short waves far more strongly than long ones — blue gets bounced around the sky in every direction, while red carries straight on.',
          },
        ],
      },
      {
        say: 'Here is the whole thing as a picture.',
        suggestions: ['So why is the Sun yellow?', 'Go deeper'],
        actions: [
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
          { type: 'connect', from: 'd2-scatter', to: 'd2-diagram', label: 'in short' },
        ],
      },
    ],
    check: {
      id: 'demo-cp-2',
      questions: [
        {
          id: 'demo-q2',
          format: 'mcq',
          prompt: 'Why does the whole sky look blue rather than just the area around the Sun?',
          options: [
            'Blue light is scattered in every direction by the air',
            'The atmosphere is made of blue gas',
            'Our eyes cannot see the other colours',
          ],
          answer: 0,
          explain:
            'Scattered blue arrives from all over the sky, not just along the line to the Sun.',
        },
      ],
    },
  },

  d3: {
    beats: [
      {
        say: 'Same idea, different amount of air. See the card.',
        suggestions: ['Why is it stronger over the sea?', 'Quiz me on this'],
        actions: [
          {
            type: 'createCard',
            id: 'd3-sunset',
            card: 'callout',
            step: 3,
            variant: 'tip',
            title: 'Sunsets are the leftovers',
            body:
              'At sunset the light reaches you at a shallow angle, so it travels through far more air. By the time it arrives almost all the blue has been scattered away — what is left to reach your eye is the red and orange.',
          },
        ],
      },
      {
        say: 'One last card, and that is the whole explanation.',
        suggestions: ['Show another example', 'Go deeper'],
        actions: [
          {
            type: 'createCard',
            id: 'd3-summary',
            card: 'concept',
            step: 3,
            title: 'The whole thing in one line',
            body:
              'Air scatters blue light; a little air gives you a blue sky, a lot of air gives you a red sunset. Same physics, different path length.',
          },
          { type: 'connect', from: 'd3-sunset', to: 'd3-summary', label: 'so' },
        ],
      },
    ],
    check: {
      id: 'demo-cp-3',
      questions: [
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
      ],
    },
  },
}

/** The scripted response to teaching one beat of a step. */
export function demoBeat(stepId: string, beatIndex: number): DemoBeat | null {
  const script = SCRIPT[stepId]
  if (!script) return null
  return script.beats[beatIndex] ?? null
}

/** How many beats a step has before it should be checked. */
export function demoBeatCount(stepId: string): number {
  return SCRIPT[stepId]?.beats.length ?? 0
}

/** The check that closes a step, as a canvas action. */
export function demoCheck(stepId: string, stepNumber: number): TutorAction | null {
  const script = SCRIPT[stepId]
  if (!script) return null
  return {
    type: 'checkpoint',
    id: script.check.id,
    step: stepNumber,
    gate: 'hard',
    questions: script.check.questions,
  }
}

export function demoCheckpointId(stepId: string): string | null {
  return SCRIPT[stepId]?.check.id ?? null
}

/**
 * The answer to "what do I do now?", at every point in the demo.
 *
 * A tutorial that shows you a workspace and says nothing is the thing it is
 * meant to fix, so there is always a cue — and the cue names one action, not a
 * list of what is possible.
 */
export interface DemoCue {
  /** One line, imperative. */
  action: string
  /** Why it is worth doing. */
  why: string
  /** A `data-tour` anchor to ring while this cue stands. */
  anchor?: string
}

export function demoCue(run: LessonRun, opts: { checkOpen: boolean }): DemoCue {
  if (run.phase === 'planning') {
    return {
      action: 'Read the plan, then press “Looks good, start”',
      why:
        'Every lesson opens with a plan you have to agree to — nothing is built until you do. “Answer / change it” is where you reshape it, and it costs you nothing to redo.',
      anchor: 'lesson-chat',
    }
  }

  if (run.phase === 'done') {
    return {
      action: 'That is the whole loop — start a real one',
      why:
        'Plan, teach, check, next step. A real lesson works exactly like this; the only difference is that the cards are written for whatever you asked for.',
    }
  }

  if (opts.checkOpen) {
    return {
      action: 'Answer the check on the board',
      why:
        'A check blocks Continue until it is answered. Getting one wrong is not a dead end — the tutor re-teaches that point instead of moving on.',
      anchor: 'lesson-board',
    }
  }

  const step = run.steps[run.currentStep]
  if (step && run.beats === 0) {
    return {
      action: 'Press Continue to start this step',
      why: 'Continue is the only control that moves the lesson forward. Everything else explores where you already are.',
      anchor: 'lesson-continue',
    }
  }

  if (run.currentStep === 0) {
    return {
      action: 'Try a chip, or ask something of your own',
      why:
        'The outlined buttons are questions about what is on the board right now — they add a card without skipping ahead. Typing your own question does the same.',
      anchor: 'lesson-chat',
    }
  }

  if (run.currentStep === 1) {
    return {
      action: 'Right-click a card and pick “Simplify this”',
      why:
        'Every card can be rewritten in place — simpler, deeper, or with an example added. You never have to accept a card you did not follow.',
      anchor: 'lesson-board',
    }
  }

  return {
    action: 'Press Continue, or click any step in the plan',
    why:
      'You do not have to go in order. A step you have not reached starts teaching; one you have finished shows you what you built.',
    anchor: 'lesson-plan',
  }
}
