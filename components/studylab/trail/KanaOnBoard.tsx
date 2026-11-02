'use client'

import { useEffect, useRef, useState } from 'react'
import { ViewportPortal } from '@xyflow/react'
import { Kana } from '../kana/Kana'
import { flightPoint } from '@/lib/studylab/kana/poses'
import { prefersReducedMotion } from '@/lib/studylab/motionPresets'
import { pointSelector } from '@/lib/studylab/point'
import { PAD, SPEAKER_H } from '@/lib/studylab/trail/layout'
import type { Point, Rect, TrailWorld } from '@/lib/studylab/trail/types'
import { kanaPoseFor, type BubbleLine } from '@/lib/studylab/trail/voice'

const KANA_SIZE = 150
const FLIGHT_MS = 1500
const SAY_MS = 2400
const SPARK_EVERY_MS = 110
const SPARKS = 10
/** About 30 frames a second is plenty for an idle bob, and easy on a phone. */
const FRAME_MS = 33
const RESTING_BUBBLE_W = 420

/** With no card in focus, Kana waits on the plot the journey is at. */
function restingSpot(world: TrailWorld): { kana: Point; bubble: Rect } | null {
  const plot = world.plots.find((p) => p.state === 'next' || p.state === 'current') ?? world.plots[world.plots.length - 1]
  if (!plot) return null
  const { x, y } = plot.rect
  return { kana: { x: x + PAD, y: y + PAD }, bubble: { x: x + PAD + KANA_SIZE, y: y + PAD, w: RESTING_BUBBLE_W, h: SPEAKER_H } }
}

const place = (el: HTMLElement, p: Point) => {
  el.style.transform = `translate(${p.x}px, ${p.y}px)`
}

/** Kana herself: bobbing, blinking and talking off a clock, or perfectly still under reduced motion. */
function KanaLive({ pose }: { pose: ReturnType<typeof kanaPoseFor> }) {
  const [t, setT] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (prefersReducedMotion()) return
    let raf = 0
    let last = 0
    const start = performance.now()
    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now
        setT((now - start) / 1000)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <Kana size={KANA_SIZE} pose={pose} t={t} title="Kana" />
}

/**
 * Kana on the board with the tutor's latest line. The bubble is the newest thing
 * said; open the chat and it hides, because the same line is there.
 */
export function KanaOnBoard({ world, focusId, line, chips, hidden, pointer, onMore, onChip, onShowCard }: {
  world: TrailWorld
  focusId: string | null
  line: BubbleLine | null
  chips: string[]
  /** The chat is open: the line is in there. */
  hidden: boolean
  pointer: { nodeId: string; part?: string } | null
  onMore: () => void
  onChip: (text: string) => void
  /** The tutor pointed at a card not in view: the camera goes there. */
  onShowCard: (rect: Rect) => void
}) {
  const spot = world.speaker ?? restingSpot(world)
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
      const c = pos.current
      if (c && !prefersReducedMotion()) {
        body.current?.animate([{ transform: 'none' }, { transform: 'translateY(-30px)' }, { transform: 'none' }], { duration: 420, easing: 'ease-out' })
        const mid = { x: c.x + KANA_SIZE / 2, y: c.y + KANA_SIZE / 2 }
        for (let i = 0; i < SPARKS; i++) {
          const a = (i / SPARKS) * Math.PI * 2
          spark(i, mid, { x: mid.x + Math.cos(a) * 130, y: mid.y + Math.sin(a) * 130 }, 700)
        }
      }
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

  // What the tutor is talking about glows until the next turn. Off in another
  // card, the camera goes to it.
  const pointNode = pointer?.nodeId
  const pointPart = pointer?.part
  const cards = useRef(world.cards)
  cards.current = world.cards
  const show = useRef(onShowCard)
  show.current = onShowCard
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
      if (pointNode !== focusId && rect) show.current(rect)
    }, 150)
    return () => {
      clearTimeout(timer)
      el?.classList.remove('ss-trail-pointed')
    }
  }, [pointNode, pointPart, focusId])

  const pose = kanaPoseFor({ flying, reaction, talking, pointing: !!pointer })

  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {line?.text}
      </div>
      <ViewportPortal>
        {SPARK_POOL.map((i) => (
          <span key={i} ref={(el) => void (sparks.current[i] = el)} className="ss-trail-spark" aria-hidden />
        ))}
        {spot && (
          <div ref={setMover} className="ss-trail-kana" style={{ width: KANA_SIZE }}>
            <div ref={body} style={{ transformOrigin: '50% 100%' }}>
              <KanaLive pose={pose} />
            </div>
          </div>
        )}
        {spot && line && !hidden && (
          <div className="ss-trail-speech" style={{ left: spot.bubble.x, top: spot.bubble.y, width: spot.bubble.w, height: spot.bubble.h }}>
            <div key={line.key} className={`ss-trail-bubble ss-trail-bubble-${line.tone}`}>
              <span>{line.text}</span>
              {line.more && (
                <button type="button" className="ss-trail-more nopan" onClick={onMore}>
                  More
                </button>
              )}
            </div>
            {chips.length > 0 && (
              <div className="ss-trail-chips nopan">
                {chips.map((c) => (
                  <button key={c} type="button" className="ss-press ss-trail-chip" onClick={() => onChip(c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </ViewportPortal>
    </>
  )
}

const SPARK_POOL = Array.from({ length: SPARKS }, (_, i) => i)
