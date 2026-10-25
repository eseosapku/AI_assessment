import type { CheckPhase } from './checkFlow'

/** Inky's faces. Each one only changes the eyes, brows and mouth. */
export type InkyMood = 'idle' | 'looking' | 'talking' | 'thinking' | 'happy' | 'concerned' | 'celebrating'

/** The face Inky makes for where a check has got to. */
export function moodForCheck(phase: CheckPhase): InkyMood {
  switch (phase) {
    case 'correct':
      return 'happy'
    case 'retry':
    case 'wrong':
      return 'concerned'
    case 'checking':
      return 'thinking'
    case 'revealed':
      return 'looking'
    default:
      return 'idle'
  }
}
