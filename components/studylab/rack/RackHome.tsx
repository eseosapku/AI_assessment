'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Kana } from '@/components/studylab/kana/Kana'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import type { UnplacedSubject, UnlinkedResults } from '@/lib/studylab/wall'
import { kanaHomeLine, nextFix, squareSize, visibleTrays, type RackTray } from '@/lib/studylab/rack'
import { ChapterTile } from './ChapterTile'

export function RackHome({
  trays,
  unplaced,
  unlinked,
  droppedTopicIds,
  focusTrayKey,
}: {
  trays: RackTray[]
  unplaced: UnplacedSubject[]
  unlinked: UnlinkedResults | null
  droppedTopicIds: number[]
  focusTrayKey: string | null
}) {
  const [showAll, setShowAll] = useState(false)
  const pick = nextFix(trays)
  const { shown, hidden } = visibleTrays(trays, showAll)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusTrayKey) return
    // A focused tray beyond the first six has to be on the page to be scrolled to.
    if (!shown.some((t) => t.key === focusTrayKey)) {
      setShowAll(true)
      return
    }
    const el = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-tray-key]') ?? []).find(
      (n) => n.dataset.trayKey === focusTrayKey,
    )
    el?.scrollIntoView({ block: 'start' })
  }, [focusTrayKey, shown])

  const pickHref = pick
    ? `/studylab/gap-map?chapter=${pick.chapter.topicId}${pick.section?.subtopicId ? `&section=${pick.section.subtopicId}` : ''}`
    : null
  const hasGaps = !!pick

  return (
    <div ref={root} className="ss-rack">
      {trays.length === 0 ? (
        <div className="ss-rack-hi">
          <div className="ss-rack-hi-k ss-rack-bob"><Kana pose="wave" size={104} /></div>
          <div className="ss-rack-say">
            <span>Take your first quiz and I&apos;ll show you where your gaps are.</span>
            <Link href="/practice" className="ss-rack-go">Take a quiz</Link>
          </div>
        </div>
      ) : (
        <div className="ss-rack-hi">
          <div className="ss-rack-hi-k ss-rack-bob"><Kana pose={hasGaps ? 'point' : 'celebrate'} size={104} /></div>
          <div className="ss-rack-say">
            <span>{kanaHomeLine(trays, pick)}</span>
            {pickHref && <Link href={pickHref} className="ss-rack-go">Let&apos;s fix it</Link>}
          </div>
        </div>
      )}

      {shown.map((tray, ti) => {
        const size = squareSize(tray.squares.length)
        const perchedHere = pick && tray.chapters.some((c) => c.topicId === pick.chapter.topicId)
        const inner = (
            <div
              className={`ss-rack-tray ss-lesson${perchedHere ? ' perched' : ''}`}
              style={subjectStyle(tray.subject)}
            >
              <div className="ss-rack-subj">
                <h2>{tray.subject}</h2>
                <div className="ss-rack-squares" style={{ '--sq': `${size}px` } as React.CSSProperties} aria-hidden="true">
                  {tray.squares.map((b, i) => <i key={i} className={b} />)}
                </div>
                <small>{tray.triedCount} of {tray.totalCount} tried</small>
                {tray.gapCount > 0 && <b>{tray.gapCount} {tray.gapCount === 1 ? 'gap' : 'gaps'}</b>}
              </div>
              {tray.chapters.map((c, ci) => (
                <ChapterTile
                  key={c.topicId}
                  chapter={c}
                  subject={tray.subject}
                  index={ci}
                  perched={!!pick && pick.chapter.topicId === c.topicId}
                  dropped={droppedTopicIds.includes(c.topicId)}
                />
              ))}
            </div>
        )
        // The tour's anchor, written out so the tour test can find it.
        return ti === 0 ? (
          <section key={tray.key} data-tray-key={tray.key} aria-label={tray.subject} data-tour="gapmap-legend">{inner}</section>
        ) : (
          <section key={tray.key} data-tray-key={tray.key} aria-label={tray.subject}>{inner}</section>
        )
      })}

      {hidden > 0 && (
        <button type="button" className="ss-rack-more" onClick={() => setShowAll(true)}>Show all subjects</button>
      )}

      {(unplaced.length > 0 || unlinked) && (
        <div className="ss-rack-quiet">
          {unplaced.map((s) => (
            <p key={s.subject}>
              {s.subject}, {s.quizzes.length} {s.quizzes.length === 1 ? 'quiz' : 'quizzes'}
              {s.average !== null ? `, average ${s.average}%` : ''}
            </p>
          ))}
          {unlinked && (
            <p>
              Other quizzes, {unlinked.count} {unlinked.count === 1 ? 'quiz' : 'quizzes'}
              {unlinked.average !== null ? `, average ${unlinked.average}%` : ''}. These were not linked to a
              subject, such as quizzes a teacher set, so they cannot appear on a tile.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
