import type { Metadata } from 'next'
import DemoWorkspace from '@/components/studylab/DemoWorkspace'

export const metadata: Metadata = {
  title: 'Try a LearnSpace — StudySquare',
  description: 'A short, pre-written lesson that shows you how a LearnSpace works.',
}

/**
 * The tutorial LearnSpace.
 *
 * Deliberately outside `/studylab/[id]`: it has no id, touches no database and
 * calls no model, so routing it through the same page would mean teaching that
 * page to be two things at once.
 */
export default function StudyLabDemoPage() {
  return <DemoWorkspace />
}
