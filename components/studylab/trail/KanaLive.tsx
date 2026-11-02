'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Kana } from '../kana/Kana'
import { lookAt, pokePose, type KanaPose } from '@/lib/studylab/kana/poses'
import { prefersReducedMotion } from '@/lib/studylab/motionPresets'
import type { Point } from '@/lib/studylab/trail/types'

/** About 30 frames a second is plenty for an idle bob, and easy on a phone. */
const FRAME_MS = 33
const POKE_MS = 1100
/** Poses that mean something by where she is looking keep their own eyes. */
const OWN_EYES: ReadonlySet<KanaPose> = new Set<KanaPose>(['think', 'point', 'fly', 'sleepy'])
const AT_EASE: ReadonlySet<KanaPose> = new Set<KanaPose>(['open', 'happy'])

/**
 * Kana, alive: she bobs and blinks, her eyes follow the pointer, she waves when you
 * come near and reacts when you tap her. Under reduced motion she holds still and
 * only changes pose. `still` stops her clock while nobody can see her.
 */
export function KanaLive({ pose, size, still = false, label = 'Say hello to Kana', onPoke, className = '', children }: {
  pose: KanaPose
  size: number
  still?: boolean
  label?: string
  onPoke?: () => void
  className?: string
  children?: ReactNode
}) {
  const [t, setT] = useState<number | undefined>(undefined)
  const [look, setLook] = useState<Point | null>(null)
  const [hovered, setHovered] = useState(false)
  const [poked, setPoked] = useState<KanaPose | null>(null)
  const self = useRef<HTMLButtonElement>(null)
  const pointer = useRef<Point | null>(null)
  const pokes = useRef(0)
  const pokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (still || prefersReducedMotion()) return
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    let raf = 0
    let last = 0
    const start = performance.now()
    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now
        setT((now - start) / 1000)
        const box = self.current?.getBoundingClientRect()
        if (box && pointer.current) setLook(lookAt({ x: box.x + box.width / 2, y: box.y + box.height * 0.35 }, pointer.current))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [still])
  useEffect(
    () => () => {
      if (pokeTimer.current) clearTimeout(pokeTimer.current)
    },
    [],
  )

  const poke = () => {
    setPoked(pokePose(pokes.current++))
    if (pokeTimer.current) clearTimeout(pokeTimer.current)
    pokeTimer.current = setTimeout(() => setPoked(null), POKE_MS)
    if (!prefersReducedMotion()) {
      self.current?.animate([{ transform: 'none' }, { transform: 'translateY(-16px) rotate(-4deg)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' })
    }
    onPoke?.()
  }

  const shown = poked ?? (hovered && AT_EASE.has(pose) ? 'wave' : pose)
  return (
    <button
      ref={self}
      type="button"
      aria-label={label}
      className={`ss-trail-owl nopan ${className}`}
      onClick={poke}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Kana size={size} pose={shown} t={t} look={look && !OWN_EYES.has(shown) ? look : undefined} />
      {children}
    </button>
  )
}
