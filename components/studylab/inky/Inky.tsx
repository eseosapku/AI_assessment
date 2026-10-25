'use client'

import { useEffect, useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { InkyMood } from '@/lib/studylab/inkyMood'

export type { InkyMood }

/**
 * Inky, the tutor: a drop of ink, after the Brain Ink name.
 *
 * Drawn here as layered SVG so every mood is a small change to the same face
 * -- pupils, lids, brows, mouth -- rather than a different picture. It blinks
 * now and then when idle, its mouth moves while it talks, and it hops when a
 * station is done. Under reduced motion it holds still and only its expression
 * changes.
 */
export function Inky({
  size = 32,
  mood = 'idle',
  className,
  title,
}: {
  size?: number
  mood?: InkyMood
  className?: string
  title?: string
}) {
  const reduced = useReducedMotion()
  const gid = useId().replace(/:/g, '')
  const blinking = useBlink(!reduced && (mood === 'idle' || mood === 'looking' || mood === 'talking'))
  const talking = useTalk(!reduced && mood === 'talking')

  const pupil = PUPIL[mood] ?? PUPIL.idle
  const happyEyes = mood === 'happy' || mood === 'celebrating'

  return (
    <motion.svg
      role="img"
      aria-label={title ?? 'Inky, your tutor'}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      animate={
        mood === 'celebrating' && !reduced
          ? { y: [0, -6, 0, -6, 0] }
          : { y: 0 }
      }
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      <defs>
        <linearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--ss-accent-bright)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--ss-accent-deep)' }} />
        </linearGradient>
      </defs>

      {/* The drop. */}
      <path
        d="M32 5 C30 9 13 25 13 40 C13 51 21.5 59 32 59 C42.5 59 51 51 51 40 C51 25 34 9 32 5 Z"
        fill={`url(#${gid}-body)`}
      />
      {/* Its shine. */}
      <path d="M22 30 C20 34 19.5 38 20.5 41" stroke="white" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Cheeks when pleased. */}
      {happyEyes && (
        <g fill="#FF8FA3" fillOpacity="0.45">
          <ellipse cx="21" cy="47" rx="3.2" ry="2" />
          <ellipse cx="43" cy="47" rx="3.2" ry="2" />
        </g>
      )}

      {/* Brows: only when concerned or thinking. */}
      {mood === 'concerned' && (
        <g stroke="#0B1F2E" strokeWidth="1.8" strokeLinecap="round">
          {/* Inner ends raised: worried, not cross. */}
          <path d="M21 35 L28 32.8" />
          <path d="M43 35 L36 32.8" />
        </g>
      )}
      {mood === 'thinking' && (
        <g stroke="#0B1F2E" strokeWidth="1.8" strokeLinecap="round">
          <path d="M21 33 L28 32.5" />
          <path d="M36 32 L43 31" />
        </g>
      )}

      {/* Eyes. */}
      {happyEyes ? (
        <g stroke="#0B1F2E" strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d="M20.5 41.5 Q24.5 36.5 28.5 41.5" />
          <path d="M35.5 41.5 Q39.5 36.5 43.5 41.5" />
        </g>
      ) : (
        <motion.g
          style={{ transformOrigin: '32px 41px' }}
          animate={{ scaleY: blinking ? 0.12 : 1 }}
          transition={{ duration: 0.07 }}
        >
          <ellipse cx="24.5" cy="41" rx="4.6" ry="5.4" fill="white" />
          <ellipse cx="39.5" cy="41" rx="4.6" ry="5.4" fill="white" />
          <circle cx={24.5 + pupil.dx} cy={41 + pupil.dy} r="2.5" fill="#0B1F2E" />
          <circle cx={39.5 + pupil.dx} cy={41 + pupil.dy} r="2.5" fill="#0B1F2E" />
          <circle cx={25.4 + pupil.dx} cy={40 + pupil.dy} r="0.8" fill="white" />
          <circle cx={40.4 + pupil.dx} cy={40 + pupil.dy} r="0.8" fill="white" />
        </motion.g>
      )}

      {/* Mouth. */}
      {mood === 'talking' ? (
        <ellipse cx="32" cy="51.5" rx="3" ry={talking ? 2.6 : 1.1} fill="#0B1F2E" />
      ) : (
        <path d={MOUTH[mood] ?? MOUTH.idle} stroke="#0B1F2E" strokeWidth="2" strokeLinecap="round" fill="none" />
      )}
    </motion.svg>
  )
}

const PUPIL: Record<InkyMood, { dx: number; dy: number }> = {
  idle: { dx: 0, dy: 0.4 },
  looking: { dx: 1.6, dy: 0.6 },
  talking: { dx: 0, dy: 0.4 },
  thinking: { dx: -1.4, dy: -1.6 },
  happy: { dx: 0, dy: 0 },
  concerned: { dx: 0, dy: 1 },
  celebrating: { dx: 0, dy: 0 },
}

const MOUTH: Partial<Record<InkyMood, string>> = {
  idle: 'M28.5 50.5 Q32 53 35.5 50.5',
  looking: 'M29 51 Q32 52.5 35 51',
  thinking: 'M30 51.5 Q32 51 34 52',
  happy: 'M26.5 49.5 Q32 56 37.5 49.5',
  celebrating: 'M26 49 Q32 57 38 49',
  concerned: 'M28 52.5 Q32 50 36 52.5',
}

/** An occasional blink, every 3.5–5 s, while `on`. */
function useBlink(on: boolean): boolean {
  const [closed, setClosed] = useState(false)
  useEffect(() => {
    if (!on) {
      setClosed(false)
      return
    }
    let open: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const schedule = () => {
      next = setTimeout(() => {
        setClosed(true)
        open = setTimeout(() => {
          setClosed(false)
          schedule()
        }, 120)
      }, 3500 + Math.random() * 1500)
    }
    schedule()
    return () => {
      clearTimeout(open)
      clearTimeout(next)
    }
  }, [on])
  return closed
}

/** The mouth opening and closing while Inky talks. */
function useTalk(on: boolean): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!on) {
      setOpen(false)
      return
    }
    const t = setInterval(() => setOpen((o) => !o), 180)
    return () => clearInterval(t)
  }, [on])
  return open
}
