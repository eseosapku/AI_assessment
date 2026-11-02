'use client'

import { useContext } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { motionFor } from '@/lib/studylab/motionPresets'
import { StageContext } from '../stage/StageContext'

/**
 * The tick or cross pinned to the corner of the answer it is about. Never
 * colour alone: the icon carries the meaning, and the label says it again for
 * a screen reader.
 *
 * `answer` is the grey tick that marks the right option after a miss in a
 * test, or once the answer has been shown. On the Trail these are bigger tiles,
 * and the right answer is green whoever chose it, so it can be told at a glance.
 */
export function ResultBadge({ kind, tone = 'bad' }: { kind: 'correct' | 'wrong' | 'answer'; tone?: 'warn' | 'bad' }) {
  const reduced = useReducedMotion() ?? false
  const m = motionFor('pop', reduced)
  const trail = useContext(StageContext)?.look === 'trail'
  const bg =
    kind === 'correct' ? 'var(--ss-good)'
    : kind === 'answer' ? (trail ? 'var(--ss-good)' : 'var(--ss-slate)')
    : tone === 'warn' ? 'var(--ss-warn)'
    : 'var(--ss-bad)'
  const label = kind === 'correct' ? 'Correct' : kind === 'answer' ? 'The right answer' : 'Your answer, not right'
  return (
    <motion.span
      initial={m.initial}
      animate={m.animate}
      transition={m.transition}
      role="img"
      aria-label={label}
      className={`pointer-events-none absolute -right-2 -top-2 z-10 grid place-items-center shadow-sm ${trail ? 'h-7 w-7 rounded-lg' : 'h-5 w-5 rounded-md'}`}
      style={{ backgroundColor: bg, color: 'var(--ss-panel)' }}
    >
      {kind === 'wrong' ? <X className="h-3.5 w-3.5" strokeWidth={3} /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </motion.span>
  )
}
