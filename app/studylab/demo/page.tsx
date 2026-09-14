import type { Metadata } from 'next'
import { Suspense } from 'react'
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
  // `DemoWorkspace` reads the query string, and a client component that calls
  // `useSearchParams()` has to sit behind a Suspense boundary or the whole
  // production build fails on this page — which is exactly what it was doing.
  // The page cannot become a client component instead: it exports `metadata`,
  // and only a server component may.
  return (
    <Suspense fallback={null}>
      <DemoWorkspace />
    </Suspense>
  )
}
