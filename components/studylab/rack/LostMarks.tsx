'use client'

import { useEffect, useState } from 'react'
import { X, Check } from 'lucide-react'
import type { RackChapter } from '@/lib/studylab/rack'
import type { LostMark } from '@/lib/studylab/lost-marks'

/** Up to two questions this student got wrong in the chapter. Renders nothing while loading, on error, or with none. */
export function LostMarks({ userId, chapter }: { userId: string; chapter: RackChapter }) {
  const whole = !chapter.hasSections || !!chapter.wholeChapter
  const ids = whole
    ? []
    : chapter.sections.filter((s) => (s.band === 'gap' || s.band === 'shaky') && s.subtopicId).map((s) => s.subtopicId as number)
  const key = `${userId}|${chapter.topicId}|${ids.join(',')}`
  const [got, setGot] = useState<{ key: string; items: LostMark[] } | null>(null)

  useEffect(() => {
    if (!whole && ids.length === 0) return
    let live = true
    fetch(`/api/studylab/gap-map/lost-marks?user_id=${encodeURIComponent(userId)}&topic_id=${chapter.topicId}&subtopic_ids=${ids.join(',')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && Array.isArray(j?.data)) setGot({ key, items: j.data }) })
      .catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!got || got.key !== key || got.items.length === 0) return null
  return (
    <section className="ss-rack-lost" aria-label="Where you lost marks">
      <h3>Where you lost marks</h3>
      <ul>
        {got.items.map((m) => (
          <li key={m.question}>
            <p>{m.question}</p>
            <span className="no"><X aria-hidden="true" /><span>You said: {m.said}</span></span>
            <span className="yes"><Check aria-hidden="true" /><span>{m.right}</span></span>
          </li>
        ))}
      </ul>
    </section>
  )
}
