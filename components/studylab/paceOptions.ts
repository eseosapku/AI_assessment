// components/studylab/paceOptions.ts
import { Footprints, FastForward } from 'lucide-react'
import type { Pace } from '@/lib/studylab/lessonPolicy'

/**
 * The two ways a lesson can run, described once.
 *
 * The plan card asks for this before the lesson starts and the sidebar lets it
 * be changed afterwards; both read from here so the choice cannot be called one
 * thing in one place and something else in the other.
 *
 * The labels say what the learner gets, not what the machine does. "One card at
 * a time" and "Whole step at once" name a mechanism, which is why the two
 * settings read as the same thing and neither seemed worth picking.
 */
export const PACES: {
  id: Pace
  icon: typeof Footprints
  title: string
  blurb: string
}[] = [
  {
    id: 'step',
    icon: Footprints,
    title: 'Step by step',
    blurb: 'One card at a time. I stop after each so you can ask, steer or move on.',
  },
  {
    id: 'run',
    icon: FastForward,
    title: 'Run ahead',
    blurb: 'A whole step at once, ending in a quick check. Faster if you mostly know it.',
  },
]

export const paceOption = (pace: Pace) => PACES.find((p) => p.id === pace) ?? PACES[0]
