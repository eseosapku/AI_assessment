// lib/studylab/trail/look.ts
import type { LessonRun } from '../lessonRun'
import type { ChatMessage } from '../types'

/**
 * Which presentation of a lesson the learner sees. The Trail is built alongside
 * the classic view and only draws what it was designed for: a station run, step
 * by step, with a plan short enough to lay out. Everything else stays classic
 * and is never offered the switch.
 */
export type Look = 'classic' | 'trail'

export const LOOK_KEY = 'ss-learnspace-look'

const FEWEST_STATIONS = 3
const MOST_STATIONS = 10

/** A learner's question the tutor answered with new cards: a detour, on the Trail. */
export interface LastAsk {
  version: number
  question: string
  created: string[]
}

/** What the Trail needs from the lesson on top of what any stage is given. */
export interface TrailWiring {
  spaceId: string
  lastAsk: LastAsk | null
  onClassic: () => void
}

export function trailEligible(run: LessonRun | null, messages: ChatMessage[]): boolean {
  if (!run || run.mode === 'montessori' || run.steps.some((s) => s.homework)) return false
  const count = run.steps.length
  const fits = count >= FEWEST_STATIONS && count <= MOST_STATIONS
  // The recipe is only set when a plan is accepted, so a plan on the table is
  // judged by its length, and a first draft still on its way by nothing yet.
  if (run.phase === 'planning') return !messages.some((m) => m.kind === 'homework') && (count === 0 || fits)
  return run.recipe === 'station' && run.pace === 'step' && fits
}

/** The URL is for testing, so it beats the saved choice. Neither can force a run the Trail cannot draw. */
export function resolveLook(input: { search: string; stored: string | null; eligible: boolean }): Look {
  if (!input.eligible) return 'classic'
  const asked = new URLSearchParams(input.search).get('look')
  if (asked === 'trail' || asked === 'classic') return asked
  return input.stored === 'trail' ? 'trail' : 'classic'
}
