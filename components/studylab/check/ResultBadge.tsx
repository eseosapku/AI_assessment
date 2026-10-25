'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { motionFor } from '@/lib/studylab/motionPresets'

/**
 * The tick or cross pinned to the corner of the answer it is about. Never
 * colour alone: the icon carries the meaning, and the label says it again for
 * a screen reader.
 *
 * `answer` is the grey tick that marks the right option after a miss in a
 * test, or once the answer has been shown.
 */
export function ResultBadge({ kind, tone = 'bad' }: { kind: 'correct' | 'wrong' | 'answer'; tone?: 'warn' | 'bad' }) {
  const reduced = useReducedMotion() ?? false
  const m = motionFor('pop', reduced)
  const bg =
    kind === 'correct' ? 'var(--ss-good)'
    : kind === 'answer' ? 'var(--ss-slate)'
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
      className="pointer-events-none absolute -right-2 -top-2 z-10 grid h-5 w-5 place-items-center rounded-md shadow-sm"
      style={{ backgroundColor: bg, color: 'var(--ss-panel)' }}
    >
      {kind === 'wrong' ? <X className="h-3.5 w-3.5" strokeWidth={3} /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </motion.span>
  )
}
