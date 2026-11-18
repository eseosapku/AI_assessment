'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Kana } from '../kana/Kana'
import { placeCard, type Box } from '@/lib/studylab/tour/place'
import { BEGINNING_DELAY_MS, nextTip, tipById, TIPS, type TipDef } from '@/lib/studylab/tour/tips'
import { markShown, readUsage, USED_EVENT } from '@/lib/studylab/tour/usage'
import { boxOf, findAnchor, useFollow } from './useFollow'

const CARD_W = 292
const TICK_MS = 1000

export interface TipFacts {
  /** The opening is over and the lesson is on screen. */
  ready: boolean
  touring: boolean
  chatOpen: boolean
  phone: boolean
  /** Finished or filed cards on the board. */
  filedCount: number
  /** The "Did that clear it up?" footer is showing. */
  footerShown: boolean
  stationCount: number
}

/**
 * Kana's tool tips: a ring that pulses round a control and one sentence beside it.
 * No dimming, nothing in the way. The decision is `nextTip`; this only gathers what
 * is true right now, once a second, and draws the answer.
 */
export function KanaTips(facts: TipFacts) {
  const [tip, setTip] = useState<TipDef | null>(null)
  const [mounted, setMounted] = useState(false)
  const factsRef = useRef(facts)
  factsRef.current = facts
  const tipRef = useRef<TipDef | null>(null)
  tipRef.current = tip
  const lastTipAt = useRef<number | null>(null)
  const readySince = useRef<number | null>(null)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (facts.ready && readySince.current === null) readySince.current = Date.now()
  }, [facts.ready])

  const show = useCallback((t: TipDef) => {
    lastTipAt.current = Date.now()
    markShown(t.id)
    setTip(t)
  }, [])

  const tick = useCallback(() => {
    const f = factsRef.current
    const cur = tipRef.current
    const usage = readUsage()
    if (cur) {
      if (f.touring || (cur.inChat ?? false) !== f.chatOpen || usage.used.includes(cur.id) || !boxOf(findAnchor(cur.anchor))) setTip(null)
      return
    }
    if (!f.ready) return
    const started = readySince.current !== null && Date.now() - readySince.current >= BEGINNING_DELAY_MS
    const wanted: Record<string, boolean> = {
      'lesson-composer': f.chatOpen && !f.phone,
      'lesson-finished': f.filedCount > 0,
      'lesson-unsure': f.footerShown,
      'lesson-stations': f.stationCount >= 3,
      'lesson-board-menu': true,
    }
    const visible = new Set(TIPS.filter((t) => wanted[t.id] && (!t.atStart || started) && boxOf(findAnchor(t.anchor))).map((t) => t.id))
    const t = nextTip({ visible, used: new Set(usage.used), shown: new Set(usage.shown), now: Date.now(), lastTipAt: lastTipAt.current, chatOpen: f.chatOpen, touring: f.touring })
    if (t) show(t)
  }, [show])

  useEffect(() => {
    const id = setInterval(tick, TICK_MS)
    const onUsed = () => tick()
    window.addEventListener(USED_EVENT, onUsed)
    return () => {
      clearInterval(id)
      window.removeEventListener(USED_EVENT, onUsed)
    }
  }, [tick])

  // Development only: ?tip=<id> shows that tip as soon as its control is on screen, used or not.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const forced = tipById(new URLSearchParams(window.location.search).get('tip') ?? '')
    if (!forced) return
    const id = setInterval(() => {
      if (boxOf(findAnchor(forced.anchor))) {
        setTip(forced)
        clearInterval(id)
      }
    }, 400)
    return () => clearInterval(id)
  }, [])

  if (!mounted) return null
  return createPortal(
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {tip?.text ?? ''}
      </div>
      {tip && <TipView key={tip.id} tip={tip} onDismiss={() => setTip(null)} />}
    </>,
    document.body,
  )
}

function TipView({ tip, onDismiss }: { tip: TipDef; onDismiss: () => void }) {
  const ring = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const find = useMemo(() => () => findAnchor(tip.anchor), [tip.anchor])
  const draw = useCallback((box: Box | null) => {
    const r = ring.current
    const c = card.current
    if (!r || !c) return
    if (!box) {
      r.style.display = 'none'
      c.style.display = 'none'
      return
    }
    r.style.display = ''
    c.style.display = ''
    const pad = 4
    r.style.width = `${box.w + pad * 2}px`
    r.style.height = `${box.h + pad * 2}px`
    r.style.transform = `translate(${box.x - pad}px, ${box.y - pad}px)`
    const p = placeCard({ x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }, { w: c.offsetWidth, h: c.offsetHeight }, { w: window.innerWidth, h: window.innerHeight }, 14, 12)
    c.style.transform = `translate(${p.x}px, ${p.y}px)`
  }, [])
  useFollow(find, draw)
  return (
    <>
      <div ref={ring} className="ss-tip-ring" aria-hidden />
      <div ref={card} className="ss-tip-card ss-tour-pop" style={{ width: CARD_W }}>
        <div className="flex items-start gap-2.5">
          <div className="shrink-0" aria-hidden>
            <Kana pose="happy" size={40} />
          </div>
          <p className="min-w-0 flex-1 pt-0.5 text-[15px] font-semibold leading-snug text-ss-ink">{tip.text}</p>
        </div>
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={onDismiss} className="ss-press ss-tour-primary ss-tour-small">
            Got it
          </button>
        </div>
      </div>
    </>
  )
}
