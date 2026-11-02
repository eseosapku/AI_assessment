// lib/studylab/trail/furniture.ts
import type { LessonRun } from '../lessonRun'

/**
 * What stays on screen on the Trail: three pills along the top and the Board
 * menu behind one of them. Nothing else is there permanently.
 */

export type PillTone = 'done' | 'current' | 'rest'

/** One short pill a station. Read from each step's status, so a jump back keeps later stations green. */
export function stationPills(run: LessonRun | null, planSteps?: { id: string }[]): { tone: PillTone }[] {
  if (!run || run.phase === 'planning') return (planSteps ?? run?.steps ?? []).map(() => ({ tone: 'rest' }))
  return run.steps.map((s, i) => ({
    tone: i === run.currentStep ? 'current' : s.status === 'done' || s.status === 'known' ? 'done' : 'rest',
  }))
}

/** Where the learner is, in a word or a station's name. */
export function topBarLabel(input: { run: LessonRun | null; lookingBack: string | null; detourOpen: boolean }): string {
  const { run, lookingBack, detourOpen } = input
  if (lookingBack) return 'Looking back'
  if (detourOpen) return 'Detour'
  if (!run || run.phase === 'planning') return 'Your plan'
  return run.steps[run.currentStep]?.title ?? 'Lesson complete'
}

/** What the "Back to my card" pill is for: it shows once the learner has moved the board away. */
export const BACK_TO_CARD_HINT = 'You moved the board. This takes you back to the card you are working on.'

export type MenuId = 'whole' | 'back' | 'zoomIn' | 'zoomOut' | 'add' | 'sound' | 'classic'

export function trailMenu(input: { canClassic: boolean; muted: boolean }): { id: MenuId; label: string }[] {
  return [
    { id: 'whole', label: 'See the whole board' },
    { id: 'back', label: 'Back to my card' },
    { id: 'zoomIn', label: 'Zoom in' },
    { id: 'zoomOut', label: 'Zoom out' },
    { id: 'add', label: 'Add a block' },
    { id: 'sound', label: input.muted ? 'Sound on' : 'Sound off' },
    ...(input.canClassic ? [{ id: 'classic' as const, label: 'Back to the classic look' }] : []),
  ]
}

/** What Esc closes, one thing a press: whatever is on top first, the learner's place last. */
export function escapeTarget(input: { menuOpen: boolean; chatOpen: boolean; lookBack: boolean; detourOpen: boolean }): 'menu' | 'chat' | 'lookBack' | 'detour' | null {
  if (input.menuOpen) return 'menu'
  if (input.chatOpen) return 'chat'
  if (input.lookBack) return 'lookBack'
  return input.detourOpen ? 'detour' : null
}
