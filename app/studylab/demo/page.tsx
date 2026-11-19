import { redirect } from 'next/navigation'

/**
 * The old scripted demo was replaced by the in-lesson tour. Keep its public URL
 * useful instead of treating "demo" as a database lesson id.
 */
export default function StudyLabDemoRedirect() {
  redirect('/studylab')
}
