'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Kana } from '@/components/studylab/kana/Kana'

export interface Pt { x: number; y: number }
export const FLIGHT_MS = 360
const SIZE = 64

/**
 * Kana in her `fly` pose, crossing the page in an arc from one point to
 * another. Drawn in a portal at the top of the page so no scroller clips her.
 * She is only a picture: the caller owns the timing and the navigation.
 */
export function FlyingKana({ from, to }: { from: Pt; to: Pt }) {
  const el = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(0)

  useLayoutEffect(() => {
    const node = el.current
    if (!node || typeof node.animate !== 'function') return
    const at = (p: Pt) => `translate(${p.x - SIZE / 2}px, ${p.y - SIZE * 0.8}px)`
    const top = Math.min(from.y, to.y) - 90
    const mid = { x: (from.x + to.x) / 2, y: top }
    const anim = node.animate(
      [
        { transform: `${at(from)} rotate(-8deg) scale(0.9)`, offset: 0 },
        { transform: `${at(mid)} rotate(6deg) scale(1.08)`, offset: 0.5, easing: 'ease-in' },
        { transform: `${at(to)} rotate(0deg) scale(1)`, offset: 1 },
      ],
      { duration: FLIGHT_MS, easing: 'ease-out', fill: 'forwards' },
    )
    return () => anim.cancel()
  }, [from, to])

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      setT((now - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={el}
      data-kana-flying="true"
      aria-hidden="true"
      style={{ position: 'fixed', left: 0, top: 0, width: SIZE, zIndex: 60, pointerEvents: 'none', lineHeight: 0, transform: `translate(${from.x - SIZE / 2}px, ${from.y - SIZE * 0.8}px)` }}
    >
      <Kana pose="fly" size={SIZE} t={t} simple />
    </div>,
    document.body,
  )
}
