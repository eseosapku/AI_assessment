// lib/studylab/busyLabel.ts

/**
 * What to show while the tutor works.
 *
 * Three bouncing dots say only "something is happening", which for a call that
 * can take ten seconds is not enough to tell a slow turn from a broken one. The
 * client knows exactly which action it sent, so it can say which job is running
 * without guessing — and because the wording differs per action, the label also
 * confirms that the click that started it registered.
 */
export function busyLabel(action: { type?: string; pace?: string } | null | undefined): string {
  switch (action?.type) {
    case 'draft_plan':
      return 'Working out a plan…'
    case 'accept_plan':
      return 'Starting the first step…'
    case 'next_beat':
      return 'Building the next card…'
    case 'jump':
      return 'Opening that step…'
    case 'test_out':
      return 'Writing a few questions…'
    case 'answer_check':
      return 'Marking that…'
    case 'ask':
      return 'Thinking about that…'
    case 'edit_plan':
      return 'Reworking the plan…'
    default:
      return 'Thinking…'
  }
}
