/**
 * Whether closing the quiz builder would throw away work.
 *
 * Clicking the dimmed page behind the dialog used to close it at once. An
 * empty builder can still close that way. One that has a step filled in, or a
 * quiz already generating, has to be confirmed.
 */
export function quizBuilderShouldConfirm(state: {
  step: number
  generating: boolean
  hasEntry: boolean
}): boolean {
  if (state.generating) return true
  if (state.step > 1) return true
  return state.hasEntry
}
