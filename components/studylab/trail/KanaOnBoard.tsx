'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Panel, ViewportPortal } from '@xyflow/react'
import { SafeLatex } from '../canvasShared'
import { KanaLive } from './KanaLive'
import { flightPoint } from '@/lib/studylab/kana/poses'
import { prefersReducedMotion } from '@/lib/studylab/motionPresets'
import { pointSelector } from '@/lib/studylab/point'
import { KANA_W, restingSpot } from '@/lib/studylab/trail/opening'
import type { Point, Rect, TrailWorld } from '@/lib/studylab/trail/types'
import { kanaPoseFor, type BubbleLine } from '@/lib/studylab/trail/voice'

const KANA_SIZE = KANA_W
const FLIGHT_MS = 1500
const SAY_MS = 2400
const BAND_KANA = 104
const SPARK_EVERY_MS = 110
const SPARKS = 10
/** How long the offer to ask her stays up after she is tapped. */
const ASK_OFFER_MS = 5000

const place = (el: HTMLElement, p: Point) => {
  el.style.transform = `translate(${p.x}px, ${p.y}px)`
}

/**
 * Kana on the board with the tutor's latest line. The bubble is the newest thing
 * said; open the chat and it hides, because the same line is there.
 */
export function KanaOnBoard({ world, focusId, line, chips, extra, hidden, band, bandKana = BAND_KANA, onAskBand, steppedBack, cheer, celebrating, pointer, onMore, onChip, onShowCard, onSpeechHeight }: {
  world: TrailWorld
  focusId: string | null
  line: BubbleLine | null
  chips: string[]
  /** Beside the chips: the opening's "Type an answer". */
  extra?: ReactNode
  /** The chat is open: the line is in there. */
  hidden: boolean
  /** The whole board is in view, too small to read on: she stands on the screen, above the button. */
  band?: boolean
  bandKana?: number
  /** On a phone she stands in for the Ask Kana pill: there is no corner to spare for it. */
  onAskBand?: () => void
  /** A finished card is open over everything: she steps back with the rest. */
  steppedBack?: boolean
  /** Changes when a station ends: a hop and a burst of tiles. */
  cheer?: string | null
  /** The lesson is over: she holds the pose. */
  celebrating?: boolean
  pointer: { nodeId: string; part?: string } | null
  onMore: () => void
  onChip: (text: string) => void
  /** The tutor pointed at a card not in view: the camera goes there. */
  onShowCard: (rect: Rect) => void
  /** How much room her words take, so the card sits clear of them. */
  onSpeechHeight?: (height: number) => void
}) {
  const spot = band ? null : (world.speaker ?? restingSpot(world))
  const target = spot?.kana ?? null
  // State, not a ref: the portal mounts a beat after this component does, and the
  // move below has to run again once there is something to move.
  const [mover, setMover] = useState<HTMLDivElement | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const sparks = useRef<(HTMLSpanElement | null)[]>([])
  const pos = useRef<Point | null>(null)
  const flewFor = useRef<string | null>(focusId)
  const [flying, setFlying] = useState(false)

  const spark = (i: number, from: Point, to: Point, duration: number) => {
    const el = sparks.current[i % SPARKS]
    el?.animate(
      [
        { opacity: 1, transform: `translate(${from.x}px, ${from.y}px) rotate(0deg) scale(1)` },
        { opacity: 0, transform: `translate(${to.x}px, ${to.y}px) rotate(70deg) scale(0.4)` },
      ],
      { duration, easing: 'ease-out', fill: 'forwards' },
    )
  }

  // She flies when the focus moves on. A plot beside hers growing only nudges her
  // along with the card, on the same glide the card takes.
  const tx = target?.x
  const ty = target?.y
  useEffect(() => {
    const el = mover
    if (!el || tx === undefined || ty === undefined) return
    const to = { x: tx, y: ty }
    const from = pos.current
    const moved = flewFor.current !== focusId
    flewFor.current = focusId
    pos.current = to
    if (!from || prefersReducedMotion()) {
      el.style.transition = 'none'
      place(el, to)
      return
    }
    if (!moved) {
      el.style.transition = ''
      place(el, to)
      return
    }
    el.style.transition = 'none'
    setFlying(true)
    let raf = 0
    let count = 0
    const start = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / FLIGHT_MS)
      const p = flightPoint(from, to, k)
      place(el, p)
      const due = Math.floor((now - start) / SPARK_EVERY_MS)
      if (due > count) {
        count = due
        spark(count, { x: p.x + KANA_SIZE / 2, y: p.y + KANA_SIZE / 2 }, { x: p.x + KANA_SIZE / 2, y: p.y + KANA_SIZE / 2 + 36 }, 650)
      }
      if (k < 1) {
        raf = requestAnimationFrame(tick)
        return
      }
      setFlying(false)
      body.current?.animate([{ transform: 'scale(1.08, 0.86)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' })
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      place(el, to)
      setFlying(false)
    }
  }, [mover, tx, ty, focusId])

  const hopAndBurst = () => {
    const c = pos.current
    if (!c || prefersReducedMotion()) return
    body.current?.animate([{ transform: 'none' }, { transform: 'translateY(-30px)' }, { transform: 'none' }], { duration: 420, easing: 'ease-out' })
    const mid = { x: c.x + KANA_SIZE / 2, y: c.y + KANA_SIZE / 2 }
    for (let i = 0; i < SPARKS; i++) {
      const a = (i / SPARKS) * Math.PI * 2
      spark(i, mid, { x: mid.x + Math.cos(a) * 130, y: mid.y + Math.sin(a) * 130 }, 700)
    }
  }

  // A new line: she talks for a moment, and a right answer gets a hop and a burst of tiles.
  const key = line?.key ?? null
  const tone = line?.tone ?? null
  const lastKey = useRef(key)
  const [talking, setTalking] = useState(false)
  const [reaction, setReaction] = useState<'good' | 'nudge' | null>(null)
  useEffect(() => {
    if (key === lastKey.current) return
    lastKey.current = key
    if (!key || tone === 'working') return
    if (tone === 'good') {
      setReaction('good')
      hopAndBurst()
    } else if (tone === 'nudge' || tone === 'refusal' || tone === 'error') {
      setReaction('nudge')
    } else {
      setTalking(true)
    }
    const timer = setTimeout(() => {
      setTalking(false)
      setReaction(null)
    }, SAY_MS)
    return () => clearTimeout(timer)
  }, [key, tone])

  // The end of a station is worth the same, with or without a line to go with it.
  const lastCheer = useRef(cheer ?? null)
  useEffect(() => {
    if ((cheer ?? null) === lastCheer.current) return
    lastCheer.current = cheer ?? null
    if (!cheer) return
    setReaction('good')
    hopAndBurst()
    const timer = setTimeout(() => setReaction(null), SAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheer])

  // What the tutor is talking about glows until the next turn. Off in another
  // card, the camera goes to it.
  const pointNode = pointer?.nodeId
  const pointPart = pointer?.part
  const cards = useRef(world.cards)
  cards.current = world.cards
  const show = useRef(onShowCard)
  show.current = onShowCard
  const away = useRef(steppedBack)
  away.current = steppedBack
  useEffect(() => {
    if (!pointNode) return
    let el: Element | null = null
    const timer = setTimeout(() => {
      try {
        el = document.querySelector(pointSelector(pointNode, pointPart))
      } catch {
        el = null
      }
      el?.classList.add('ss-trail-pointed')
      const rect = cards.current[pointNode]
      if (pointNode !== focusId && rect && !away.current) show.current(rect)
    }, 150)
    return () => {
      clearTimeout(timer)
      el?.classList.remove('ss-trail-pointed')
    }
  }, [pointNode, pointPart, focusId])

  // Tapping her: she reacts, and offers to talk.
  const [askOffer, setAskOffer] = useState(false)
  const askTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const offerToTalk = () => {
    setAskOffer(true)
    if (askTimer.current) clearTimeout(askTimer.current)
    askTimer.current = setTimeout(() => setAskOffer(false), ASK_OFFER_MS)
  }
  useEffect(
    () => () => {
      if (askTimer.current) clearTimeout(askTimer.current)
    },
    [],
  )

  // Her strip on the board grows to fit what she says.
  const [speech, setSpeech] = useState<HTMLDivElement | null>(null)
  const reportHeight = useRef(onSpeechHeight)
  reportHeight.current = onSpeechHeight
  useEffect(() => {
    if (!speech || typeof ResizeObserver === 'undefined') return
    const report = () => reportHeight.current?.(speech.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(speech)
    return () => ro.disconnect()
  }, [speech])

  const pose = kanaPoseFor({ flying, reaction: celebrating ? 'good' : reaction, talking, pointing: !!pointer })
  const words = line && !hidden && (
    <div key={line.key} className={`ss-trail-bubble ss-trail-bubble-${line.tone}`}>
      <span>
        <SafeLatex>{line.text}</SafeLatex>
      </span>
      {line.more && (
        <button type="button" className="ss-trail-more nopan" onClick={onMore}>
          More
        </button>
      )}
    </div>
  )
  const answers = line && !hidden && (chips.length > 0 || extra) && (
    <div className="ss-trail-chips nopan">
      {chips.map((c) => (
        <button key={c} type="button" className="ss-press ss-trail-chip" onClick={() => onChip(c)}>
          {c}
        </button>
      ))}
      {extra}
    </div>
  )

  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {line?.text}
      </div>
      {band && (
        <Panel position="bottom-center" className="ss-trail-band">
          {onAskBand ? (
            <KanaLive pose={pose} size={bandKana} label="Ask Kana" onPoke={onAskBand} className="ss-trail-band-ask">
              <span>Ask Kana</span>
            </KanaLive>
          ) : (
            <KanaLive pose={pose} size={bandKana} className="shrink-0" />
          )}
          <div className="ss-trail-band-speech">
            {words}
            {answers}
          </div>
        </Panel>
      )}
      <ViewportPortal>
        {SPARK_POOL.map((i) => (
          <span key={i} ref={(el) => void (sparks.current[i] = el)} className="ss-trail-spark" aria-hidden />
        ))}
        {spot && (
          <div ref={setMover} className={`ss-trail-kana${steppedBack ? ' ss-trail-kana-back' : ''}`} style={{ width: KANA_SIZE }}>
            <div ref={body} style={{ transformOrigin: '50% 100%' }}>
              <KanaLive pose={pose} size={KANA_SIZE} onPoke={offerToTalk} />
            </div>
            {askOffer && !hidden && (
              <button type="button" className="ss-press ss-trail-ask-chip nopan" onClick={onMore}>
                Ask Kana
              </button>
            )}
          </div>
        )}
        {spot && line && !hidden && (
          <div ref={setSpeech} className="ss-trail-speech" style={{ left: spot.bubble.x, top: spot.bubble.y, width: spot.bubble.w }}>
            {words}
            {answers}
          </div>
        )}
      </ViewportPortal>
    </>
  )
}

const SPARK_POOL = Array.from({ length: SPARKS }, (_, i) => i)
