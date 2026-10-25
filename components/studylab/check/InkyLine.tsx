'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Inky } from '../inky/Inky'
import type { InkyMood } from '@/lib/studylab/inkyMood'
import { motionFor } from '@/lib/studylab/motionPresets'
import { SafeLatex } from '../canvasShared'

const TONE_TEXT = {
  neutral: 'text-ss-ink',
  good: 'text-[color:var(--ss-good)]',
  warn: 'text-[color:var(--ss-warn)]',
  bad: 'text-[color:var(--ss-bad)]',
} as const

/**
 * Inky's one line about the answer: "That's it.", "Not quite — have another
 * go.", or the feedback written for the option chosen. Announced politely to
 * screen readers, so the result is heard as well as seen.
 */
export function InkyLine({
  mood,
  text,
  tone = 'neutral',
}: {
  mood: InkyMood
  text?: string
  tone?: keyof typeof TONE_TEXT
}) {
  const reduced = useReducedMotion() ?? false
  const m = motionFor('rise', reduced)
  return (
    <div className="flex min-h-[28px] items-start gap-2" aria-live="polite">
      <Inky size={28} mood={mood} className="shrink-0" />
      <AnimatePresence mode="wait">
        {text && (
          <motion.p
            key={text}
            initial={m.initial}
            animate={m.animate}
            exit={m.exit}
            transition={m.transition}
            className={`pt-1 text-[13px] font-semibold leading-snug ${TONE_TEXT[tone]}`}
          >
            <SafeLatex>{text}</SafeLatex>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
