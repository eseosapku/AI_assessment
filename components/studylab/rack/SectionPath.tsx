'use client'

import { useEffect, useRef } from 'react'
import { Kana } from '@/components/studylab/kana/Kana'
import { sectionLabel, type RackChapter, type RackSection } from '@/lib/studylab/rack'
import { Plate } from './Plate'

const X = ['10cqw', '2cqw', '14cqw', '24cqw']

function meta(s: RackSection): { cls: string; text: string } {
  switch (s.band) {
    case 'gold': return { cls: 'g', text: `✦ Gap closed, ${Math.round(s.lowest ?? 0)} → ${Math.round(s.score ?? 0)}%` }
    case 'gap': return { cls: 'b', text: `${Math.round(s.score ?? 0)}%, a gap` }
    case 'shaky': return { cls: 'w', text: `${Math.round(s.score ?? 0)}%, shaky` }
    case 'solid': return { cls: 'o', text: `${Math.round(s.score ?? 0)}%, solid` }
    default: return { cls: '', text: 'Not tried yet' }
  }
}

/**
 * The path of plates. Kana stands on `standOn`. On opening, the path scrolls
 * only when that plate is not fully in view; on a phone the page scrolls so it
 * sits clear above the sheet.
 */
export function SectionPath({
  chapter,
  selected,
  standOn,
  celebrating,
  onSelect,
}: {
  chapter: RackChapter
  selected: RackSection | null
  standOn: RackSection | null
  celebrating: boolean
  onSelect: (s: RackSection) => void
}) {
  const path = useRef<HTMLDivElement>(null)
  const scrolled = useRef<string | null>(null)

  useEffect(() => {
    const root = path.current
    const mark = standOn ? `${chapter.topicId}:${standOn.key}` : null
    if (!root || !mark || scrolled.current === mark) return
    scrolled.current = mark
    const stop = root.querySelector<HTMLElement>('.ss-rack-stop.on')
    if (!stop) return
    const inner = getComputedStyle(root).overflowY === 'auto'
    if (inner) {
      const a = stop.getBoundingClientRect(), p = root.getBoundingClientRect()
      if (a.bottom > p.bottom - 20) root.scrollTop += a.bottom - p.bottom + 40
      else if (a.top < p.top) root.scrollTop += a.top - p.top - 12
    } else {
      stop.scrollIntoView({ block: 'center' })
    }
  }, [chapter.topicId, standOn])

  return (
    <div ref={path} className="ss-rack-path">
      {chapter.sections.map((s, i) => {
        const m = meta(s)
        const on = standOn?.key === s.key
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={selected?.key === s.key}
            aria-label={sectionLabel(s)}
            className={`ss-rack-stop ${s.band}${on ? ' on' : ''}${selected?.key === s.key ? ' sel' : ''}`}
            style={{ '--x': X[i % 4] } as React.CSSProperties}
            onClick={() => onSelect(s)}
          >
            <span className="ss-rack-plate">
              <Plate band={s.band} />
              {on && (
                <span className="ss-rack-on-plate" aria-hidden="true">
                  <span className="ss-rack-bob"><Kana pose={celebrating ? 'celebrate' : 'happy'} size={120} simple /></span>
                </span>
              )}
            </span>
            <span className="ss-rack-lb" aria-hidden="true">
              <b>{s.name}</b>
              <span className={m.cls}>{m.text}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
