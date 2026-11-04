'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Kana } from '@/components/studylab/kana/Kana'
import { figureSrc } from '@/lib/figure-src'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import { prefersReducedMotion } from '@/lib/studylab/motionPresets'
import { chapterLabel, type RackChapter } from '@/lib/studylab/rack'

/** The logo's four squares on the subject colour: the tile with no picture. */
function LogoSquares() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <g fill="var(--subject)">
        <rect x="6" y="6" width="12" height="12" rx="3.6" fillOpacity="0.9" />
        <rect x="22" y="6" width="12" height="12" rx="3.6" fillOpacity="0.45" />
        <rect x="6" y="22" width="12" height="12" rx="3.6" fillOpacity="0.45" />
        <rect x="22" y="22" width="12" height="12" rx="3.6" fillOpacity="0.9" />
      </g>
    </svg>
  )
}

/**
 * A chapter's picture on its subject's soft colour, or the plain tile (the
 * logo's four squares) when it has none or the file will not load. Never a
 * broken image. The caller gives it the shape through `className`.
 */
export function ChapterArt({ chapter, subject, className = '' }: { chapter: RackChapter; subject: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const art = chapter.art
  const showImg = !!art && !failed
  return (
    <span className={`ss-lesson ${className}`} style={subjectStyle(subject)}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={figureSrc(art)} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <LogoSquares />
      )}
    </span>
  )
}

export function gapPillText(chapter: RackChapter): string | null {
  if (chapter.state !== 'gap') return null
  return chapter.gapCount > 1 ? `${chapter.gapCount} gaps` : chapter.gapCount === 1 && !chapter.wholeChapter ? '1 gap' : 'Gap'
}

export function ChapterTile({
  chapter,
  subject,
  index,
  perched,
  dropped,
  visible = true,
  onTap,
}: {
  chapter: RackChapter
  subject: string
  index: number
  /** Kana sits on this tile: it holds the lowest gap. */
  perched: boolean
  /** The tile just left its gap behind: it starts lifted and settles into its slot once the page is on screen. */
  dropped: boolean
  /** The home page is showing. It can stay mounted while a chapter is open, so the drop waits for this. */
  visible?: boolean
  /** A plain tap: the page may take over (Kana flies to the tile) by calling preventDefault, then navigates itself. */
  onTap?: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  // Reduced motion: seated from the start, nothing to animate.
  const [lifted, setLifted] = useState(() => dropped && !prefersReducedMotion())
  // The parent clears `dropped` after first use, so remember that this tile had it.
  const wasDropped = useRef(dropped)
  useEffect(() => {
    if (!wasDropped.current || !visible) return
    wasDropped.current = false
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setLifted(false))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [visible])

  const [phase, setPhase] = useState<'' | 'pop' | 'hop'>('')
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const href = `/studylab/gap-map?chapter=${chapter.topicId}`
  const pill = gapPillText(chapter)
  const mark =
    chapter.state === 'gold' ? { c: 'g', t: '✦' }
    : chapter.state === 'shaky' ? { c: 'w', t: '–' }
    : chapter.state === 'solid' ? { c: 'o', t: '✓' }
    : null

  return (
    <Link
      href={href}
      aria-label={chapterLabel(chapter)}
      className={`ss-rack-t ${chapter.state}${phase ? ` ${phase}` : ''}`}
      style={{ '--tilt': index % 2 ? '3deg' : '-4deg' } as React.CSSProperties}
      data-topic-id={chapter.topicId}
      onClick={(e) => {
        onTap?.(e, href)
        if (!e.defaultPrevented) return
        // the page took over: the tile presses in and pops, then hops when Kana lands
        setPhase('pop')
        timers.current.push(
          window.setTimeout(() => setPhase(''), 270),
          window.setTimeout(() => setPhase('hop'), 340),
          window.setTimeout(() => setPhase(''), 520),
        )
      }}
    >
      <span className="ss-rack-slot">
        <ChapterArt chapter={chapter} subject={subject} className={`ss-rack-tile${lifted ? ' lifted' : ''}`} />
        {mark && <span className={`ss-rack-mk ${mark.c}`} aria-hidden="true">{mark.t}</span>}
        {pill && <span className="ss-rack-pill" aria-hidden="true">{pill}</span>}
        {perched && (
          <span className="ss-rack-perch ss-rack-bob" aria-hidden="true" data-kana-from="perch">
            <Kana pose="open" look={{ x: 0.6, y: 1 }} size={48} simple />
          </span>
        )}
      </span>
      <span className="ss-rack-nm" title={chapter.name}>{chapter.name}</span>
    </Link>
  )
}
