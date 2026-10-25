import type { CheckFlowState } from './checkFlow'

/**
 * What the check bar shows for a state of the check flow: its tone, its two
 * buttons and its one line. Pure, so the copy and the order of the buttons can
 * be pinned in tests rather than discovered in a browser.
 *
 * The order is the teaching. After a miss while learning, another go comes
 * first and help sits beside it; after the second miss, help leads. In a test,
 * "Why?" leads until it has been read, and only then does Continue.
 */
export type BarAction = 'check' | 'tryAgain' | 'getHelp' | 'reveal' | 'why' | 'continue'

export interface BarButton {
  action: BarAction
  label: string
  disabled?: boolean
  busy?: boolean
}

export interface BarModel {
  tone: 'neutral' | 'good' | 'warn' | 'bad'
  /** Absent only when nothing is left to press (no Continue here, no Why?). */
  primary?: BarButton
  secondary?: BarButton
  line?: string
}

export interface BarOptions {
  /** The answer, or worked steps, can be shown. */
  canReveal: boolean
  /** There is an explanation behind "Why?". */
  hasWhy: boolean
  /** The learner has already opened it. */
  whyOpened: boolean
  /** The tutor can be asked about this attempt (Phase 3). */
  hasHelp: boolean
  continueLabel?: string
  /**
   * False where the card cannot move the lesson on -- a question inside a
   * checkpoint, which is handed in when every question in it is settled.
   * Defaults to true.
   */
  hasContinue?: boolean
  /** Label for revealing: "Show me how" on practice, "Show answer" elsewhere. */
  revealLabel?: string
}

export const CORRECT_LINES = ["That's it.", 'Yes.', 'Right.'] as const

const B = {
  check: { action: 'check', label: 'Check' },
  tryAgain: { action: 'tryAgain', label: 'Try again' },
  getHelp: { action: 'getHelp', label: 'Get help' },
  why: { action: 'why', label: 'Why?' },
} satisfies Record<string, BarButton>

export function barModel(state: CheckFlowState, opts: BarOptions): BarModel {
  const model = fullModel(state, opts)
  if (opts.hasContinue !== false) return model
  // Without Continue: whatever stood beside it moves up to take its place.
  const keep = [model.primary, model.secondary].filter((b) => b && b.action !== 'continue') as BarButton[]
  return { ...model, primary: keep[0], secondary: keep[1] }
}

function fullModel(state: CheckFlowState, opts: BarOptions): BarModel & { primary: BarButton } {
  const cont: BarButton = { action: 'continue', label: opts.continueLabel ?? 'Continue' }
  const reveal: BarButton = { action: 'reveal', label: opts.revealLabel ?? 'Show answer' }
  const why = opts.hasWhy ? B.why : undefined

  switch (state.phase) {
    case 'idle':
      return { tone: 'neutral', primary: { ...B.check, disabled: true }, line: state.message }
    case 'ready':
      return { tone: 'neutral', primary: B.check, line: state.message }
    case 'checking':
      return { tone: 'neutral', primary: { ...B.check, disabled: true, busy: true } }
    case 'correct':
      return {
        tone: 'good',
        primary: cont,
        secondary: why,
        line: state.message ?? CORRECT_LINES[(state.attempts + CORRECT_LINES.length - 1) % CORRECT_LINES.length],
      }
    case 'retry':
      return {
        tone: 'warn',
        primary: B.tryAgain,
        secondary: opts.hasHelp ? B.getHelp : opts.canReveal ? reveal : undefined,
        line: state.message ?? 'Not quite — have another go.',
      }
    case 'wrong':
      if (state.mode === 'test') {
        if (why && !opts.whyOpened) return { tone: 'bad', primary: why, secondary: cont, line: 'Incorrect' }
        return { tone: 'bad', primary: cont, secondary: why, line: 'Incorrect' }
      }
      return {
        tone: 'warn',
        primary: opts.hasHelp ? B.getHelp : opts.canReveal ? reveal : cont,
        secondary: B.tryAgain,
        line: state.message ?? 'Still not quite.',
      }
    case 'revealed':
      return { tone: 'neutral', primary: cont, secondary: why, line: state.message }
  }
}
