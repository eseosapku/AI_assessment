'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Kana } from '@/components/studylab/kana/Kana'
import { subjectStyle } from '@/lib/studylab/subjectFamily'
import type { UnplacedSubject, UnlinkedResults } from '@/lib/studylab/wall'
import { kanaHomeLine, nextFix, squareSize, visibleTrays, type RackTray } from '@/lib/studylab/rack'
import { readClosedTrays, writeClosedTrays } from '@/lib/studylab/rack-closed'
import { prefersReducedMotion } from '@/lib/studylab/motionPresets'
import { ChapterTile } from './ChapterTile'
import { FlyingKana, type Pt } from './FlyingKana'
import { QuizzesNotOnChapter } from './QuizzesNotOnChapter'

/** A row that scrolls sideways with no scrollbar; a mouse gets small chevrons at the edges when it overflows. */
function TrayRow({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [can, setCan] = useState({ l: false, r: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setCan({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    measure()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      ro?.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [])
  const by = (dir: -1 | 1) =>
    ref.current?.scrollBy({ left: dir * Math.max(200, (ref.current?.clientWidth ?? 0) * 0.8), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  return (
    <div className="ss-rack-rowwrap">
      <div ref={ref} className={className}>{children}</div>
      {can.l && <button type="button" tabIndex={-1} aria-hidden="true" className="ss-rack-sc l" onClick={() => by(-1)}><ChevronLeft /></button>}
      {can.r && <button type="button" tabIndex={-1} aria-hidden="true" className="ss-rack-sc r" onClick={() => by(1)}><ChevronRight /></button>}
    </div>
  )
}

export function RackHome({
  userId,
  trays,
  unplaced,
  unlinked,
  droppedTopicIds,
  focusTrayKey,
  visible = true,
}: {
  userId: string
  trays: RackTray[]
  unplaced: UnplacedSubject[]
  unlinked: UnlinkedResults | null
  droppedTopicIds: number[]
  focusTrayKey: string | null
  /** False while a chapter is open: this page stays mounted so its scroll and "show all" survive. */
  visible?: boolean
}) {
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const [closed, setClosed] = useState<string[]>(() => readClosedTrays(userId))
  const pick = nextFix(trays)
  const { shown, hidden } = visibleTrays(trays, showAll)
  const root = useRef<HTMLDivElement>(null)

  // A tray with a tile about to drop, or one a link points at, opens so the student sees it (not saved).
  useEffect(() => {
    const keys = new Set<string>()
    if (focusTrayKey) keys.add(focusTrayKey)
    for (const t of trays) if (t.chapters.some((c) => droppedTopicIds.includes(c.topicId))) keys.add(t.key)
    if (keys.size === 0) return
    setClosed((c) => (c.some((k) => keys.has(k)) ? c.filter((k) => !keys.has(k)) : c))
  }, [focusTrayKey, droppedTopicIds, trays])

  useEffect(() => {
    if (!focusTrayKey || !visible) return
    // A focused tray beyond the first six has to be on the page to be scrolled to.
    if (!shown.some((t) => t.key === focusTrayKey)) {
      setShowAll(true)
      return
    }
    const el = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-tray-key]') ?? []).find(
      (n) => n.dataset.trayKey === focusTrayKey,
    )
    el?.scrollIntoView({ block: 'start' })
  }, [focusTrayKey, shown, visible])

  const setOpen = (key: string, open: boolean) => {
    const next = open ? closed.filter((k) => k !== key) : closed.includes(key) ? closed : [...closed, key]
    setClosed(next)
    writeClosedTrays(userId, next)
  }

  // Kana flies to the tapped tile, then the chapter opens.
  const [flight, setFlight] = useState<{ from: Pt; to: Pt } | null>(null)
  const flying = useRef(false)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const origin = useCallback((): HTMLElement | null => {
    const inView = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
    }
    const cands = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-kana-from]') ?? [])
    return cands.find(inView) ?? null
  }, [])
  const onTap = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Ctrl, Shift, Alt, Meta and non-primary clicks keep their own meaning: open at once, no animation.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (flying.current) { e.preventDefault(); return }
    if (prefersReducedMotion()) return
    e.preventDefault()
    flying.current = true
    let from: HTMLElement | null = null
    // Whatever goes wrong with the picture, the navigation still happens.
    const go = window.setTimeout(() => router.push(href), 420)
    // She has landed by the time the chapter opens: take the flying picture away, and give the perch back.
    const landed = window.setTimeout(() => {
      setFlight(null)
      from?.style.removeProperty('visibility')
    }, 450)
    const reset = window.setTimeout(() => { flying.current = false }, 1100)
    timers.current.push(go, landed, reset)
    try {
      from = origin()
      const slot = e.currentTarget.querySelector<HTMLElement>('.ss-rack-slot')
      if (slot) {
        const tr = slot.getBoundingClientRect()
        const fr = from?.getBoundingClientRect()
        const start: Pt = fr ? { x: fr.left + fr.width / 2, y: fr.top + fr.height * 0.8 } : { x: tr.left + tr.width / 2, y: -40 }
        setFlight({ from: start, to: { x: tr.left + tr.width / 2, y: tr.top + tr.height * 0.2 } })
        from?.style.setProperty('visibility', 'hidden')
      }
    } catch {
      /* no picture is fine */
    }
  }, [origin, router])

  const pickHref = pick
    ? `/studylab/gap-map?chapter=${pick.chapter.topicId}${pick.section?.subtopicId ? `&section=${pick.section.subtopicId}` : ''}`
    : null
  const hasGaps = !!pick
  const hasOther = unplaced.length > 0 || !!(unlinked && unlinked.count > 0)

  return (
    <div ref={root} className="ss-rack" hidden={!visible}>
      <div className="ss-rack-hi">
        <div className="ss-rack-hi-k ss-rack-bob" data-kana-from="home">
          <Kana pose={trays.length === 0 || !trays.some((t) => t.triedCount > 0) ? 'wave' : hasGaps ? 'point' : 'celebrate'} size={104} />
        </div>
        <div className="ss-rack-say">
          <span>{kanaHomeLine(trays, pick, hasOther)}</span>
          {pickHref && <Link href={pickHref} className="ss-rack-go">Let&apos;s fix it</Link>}
          {trays.length === 0 && <Link href="/practice" className="ss-rack-go">Take a quiz</Link>}
        </div>
      </div>

      {shown.map((tray, ti) => {
        const size = squareSize(tray.squares.length)
        const perchedHere = pick && tray.chapters.some((c) => c.topicId === pick.chapter.topicId)
        const open = !closed.includes(tray.key)
        const gaps = tray.gapCount > 0 ? `${tray.gapCount} ${tray.gapCount === 1 ? 'gap' : 'gaps'}` : null
        const full = `${tray.subject}${tray.level ? `, ${tray.level}` : ''}`
        const inner = (
          <div className="ss-rack-shell ss-lesson" style={subjectStyle(tray.subject)} data-open={open}>
            <div className="ss-rack-fold" data-open={!open}>
              <div className="fin">
                <button
                  type="button"
                  className="ss-rack-crow"
                  aria-expanded={false}
                  aria-label={`Open ${tray.subject}${tray.level ? `, ${tray.level}` : ''}${gaps ? `, ${gaps}` : ''}`}
                  onClick={() => setOpen(tray.key, true)}
                >
                  <b className="s">{tray.subject}</b>
                  {tray.level && <span className="lv">{tray.level}</span>}
                  <small>{tray.triedCount} of {tray.totalCount} tried</small>
                  {gaps && <em>{gaps}</em>}
                  <ChevronDown className="c" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="ss-rack-fold" data-open={open}>
              <div className="fin">
                <TrayRow className={`ss-rack-tray${perchedHere ? ' perched' : ''}`}>
                  <div className="ss-rack-subj">
                    <div className="ss-rack-subj-h">
                      <h2>{tray.subject}</h2>
                      <button type="button" className="ss-rack-tgl" aria-expanded={true} aria-label={`Close ${full}`} onClick={() => setOpen(tray.key, false)}>
                        <ChevronDown aria-hidden="true" />
                      </button>
                    </div>
                    {tray.level && <p className="lv">{tray.level}</p>}
                    <div className="ss-rack-squares" style={{ '--sq': `${size}px` } as React.CSSProperties} aria-hidden="true">
                      {tray.squares.map((b, i) => <i key={i} className={b} />)}
                    </div>
                    <small>{tray.triedCount} of {tray.totalCount} tried</small>
                    {gaps && <b>{gaps}</b>}
                  </div>
                  {tray.chapters.map((c, ci) => (
                    <ChapterTile
                      key={c.topicId}
                      chapter={c}
                      subject={tray.subject}
                      index={ci}
                      perched={!!pick && pick.chapter.topicId === c.topicId}
                      dropped={droppedTopicIds.includes(c.topicId)}
                      visible={visible}
                      onTap={onTap}
                    />
                  ))}
                </TrayRow>
              </div>
            </div>
          </div>
        )
        // The tour's anchor, written out so the tour test can find it.
        return ti === 0 ? (
          <section key={tray.key} data-tray-key={tray.key} aria-label={full} data-tour="gapmap-legend">{inner}</section>
        ) : (
          <section key={tray.key} data-tray-key={tray.key} aria-label={full}>{inner}</section>
        )
      })}

      {hidden > 0 && (
        <button type="button" className="ss-rack-more" onClick={() => setShowAll(true)}>Show all subjects</button>
      )}

      <QuizzesNotOnChapter userId={userId} unplaced={unplaced} unlinked={unlinked} noTrays={trays.length === 0} />
      {flight && <FlyingKana from={flight.from} to={flight.to} />}
    </div>
  )
}
