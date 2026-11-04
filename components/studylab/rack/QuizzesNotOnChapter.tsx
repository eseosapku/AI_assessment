'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { UnlinkedResults, UnplacedSubject } from '@/lib/studylab/wall'
import { otherQuizzesSummary } from '@/lib/studylab/rack'
import { readOtherOpen, writeOtherOpen } from '@/lib/studylab/rack-closed'

const quizzes = (n: number) => `${n} ${n === 1 ? 'quiz' : 'quizzes'}`

/**
 * The quizzes that could not be placed on a chapter, folded into one quiet card
 * at the foot of the page. Closed by default and saved per student; with no
 * trays at all it starts open, because it is all the student has.
 */
export function QuizzesNotOnChapter({
  userId,
  unplaced,
  unlinked,
  noTrays,
}: {
  userId: string
  unplaced: UnplacedSubject[]
  unlinked: UnlinkedResults | null
  noTrays: boolean
}) {
  if (unlinked && unlinked.count <= 0) unlinked = null
  const summary = otherQuizzesSummary(unplaced, unlinked)
  const [open, setOpen] = useState(() => readOtherOpen(userId) ?? noTrays)
  useEffect(() => {
    // The decision may arrive after the trays do (the tree loads once): only an undecided card follows it.
    if (readOtherOpen(userId) === null) setOpen(noTrays)
  }, [userId, noTrays])
  if (!summary) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    writeOtherOpen(userId, next)
  }
  const line = `${quizzes(summary.count)}${summary.average !== null ? `, average ${summary.average}%` : ''}`

  return (
    <section className="ss-rack-other" data-open={open} aria-labelledby="ss-rack-other-h">
      <h2 id="ss-rack-other-h">
        <button type="button" className="ss-rack-other-h" aria-expanded={open} aria-controls="ss-rack-other-body" onClick={toggle}>
          <span className="t">Quizzes not on a chapter</span>
          <span className="s">{line}</span>
          <ChevronDown className="c" aria-hidden="true" />
        </button>
      </h2>
      <div className="ss-rack-fold" data-open={open}>
        <div className="fin" id="ss-rack-other-body">
          <ul className="ss-rack-other-l">
            {unplaced.map((s) => (
              <li key={s.subject}>
                <span className="n" title={s.subject}>{s.subject}</span>
                <span className="q">{quizzes(s.quizzes.length)}</span>
                <span className="a">{s.average !== null ? `${s.average}%` : ''}</span>
              </li>
            ))}
            {unlinked && (
              <li>
                <span className="n">Other quizzes</span>
                <span className="q">{quizzes(unlinked.count)}</span>
                <span className="a">{unlinked.average !== null ? `${unlinked.average}%` : ''}</span>
              </li>
            )}
          </ul>
          {unlinked && (
            <p className="ss-rack-other-note">These weren&apos;t linked to a subject, such as quizzes a teacher set, so they can&apos;t appear on a tile.</p>
          )}
        </div>
      </div>
    </section>
  )
}
