'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { aboutLine, type RackChapter, type RackSection } from '@/lib/studylab/rack'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { ChapterArt } from './ChapterTile'
import { SectionPath } from './SectionPath'
import { KanaSheet } from './KanaSheet'

export function ChapterPage({
  chapter,
  subject,
  selected,
  cheer,
  busy,
  onSelect,
  onTeach,
  onQuiz,
  lostMarks,
  tryIt,
}: {
  chapter: RackChapter
  subject: string
  selected: RackSection | null
  cheer: { name: string; next: RackSection | null } | null
  busy: boolean
  onSelect: (s: RackSection) => void
  onTeach: () => void
  onQuiz: (count?: number) => void
  lostMarks: ReactNode
  tryIt: ReactNode
}) {
  const about = aboutLine(chapter)
  const total = chapter.hasSections ? chapter.sections.length : 1
  const tried = chapter.hasSections ? chapter.triedCount : chapter.sections[0]?.band !== 'none' ? 1 : 0
  // Kana stands on the selected plate; with the whole chapter judged, on the first.
  const standOn = selected ?? chapter.sections[0] ?? null

  return (
    <div className="ss-rack ss-rack-chapwrap">
      <Link href="/studylab/gap-map" className="ss-rack-back"><ArrowLeft aria-hidden="true" />Gap Map</Link>
      <div className="ss-rack-chap ss-lesson" style={subjectStyle(subject)}>
        <div className="ss-rack-col">
          <div className="ss-rack-info">
            <ChapterArt chapter={chapter} subject={subject} className="ss-rack-pic" />
            <h2>{chapter.name}</h2>
            {about && <p>{about}</p>}
            <div className="ss-rack-facts">
              <span>{subject}</span>
              <span>{tried} of {total} tried</span>
              {chapter.wholeChapter && <span>Whole chapter {Math.round(chapter.wholeChapter.score)}%</span>}
              {chapter.gapCount > 0 && <b>{chapter.gapCount} {chapter.gapCount === 1 ? 'gap' : 'gaps'}</b>}
            </div>
          </div>
          {lostMarks}
        </div>
        <div className="ss-rack-mid">
          <SectionPath chapter={chapter} selected={selected} standOn={standOn} celebrating={!!cheer} onSelect={onSelect} />
          <KanaSheet chapter={chapter} section={selected} cheer={cheer} busy={busy} onTeach={onTeach} onQuiz={onQuiz} />
        </div>
        <div className="ss-rack-col">{tryIt}</div>
      </div>
    </div>
  )
}
