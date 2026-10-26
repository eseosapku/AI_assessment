'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Inky } from '../inky/Inky'
import { motionFor } from '@/lib/studylab/motionPresets'
import { playSound } from '@/lib/studylab/sound'

const SHOW_MS = 1200

/**
 * The moment a station is done: its tick stamps down, Inky cheers, and it is
 * gone again in a second and a bit -- or at once, with a click or Escape. It
 * never blocks the lesson; the next station's work can already be landing
 * behind it.
 */
export function StationScene({ title, onDone }: { title: string | null; onDone: () => void }) {
  const reduced = useReducedMotion() ?? false
  useEffect(() => {
    if (!title) return
    playSound('complete')
    const t = setTimeout(onDone, SHOW_MS)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [title, onDone])

  const settle = motionFor('settle', reduced)
  const pop = motionFor('pop', reduced)
  return (
    <AnimatePresence>
      {title && (
        <motion.div
          key={title}
          role="status"
          aria-live="assertive"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          onClick={onDone}
          className="absolute inset-0 z-40 flex cursor-pointer items-center justify-center"
        >
          <motion.div
            initial={pop.initial}
            animate={pop.animate}
            transition={pop.transition}
            className="flex items-center gap-4 rounded-3xl border border-ss-line bg-ss-panel px-6 py-5 shadow-[0_28px_60px_-24px_rgba(20,60,90,0.55)]"
          >
            <motion.span
              initial={settle.initial}
              animate={settle.animate}
              transition={settle.transition}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: 'var(--subject)', color: 'var(--ss-panel)' }}
            >
              <Check className="h-7 w-7" strokeWidth={3} aria-hidden />
            </motion.span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ss-subject-ink">Station complete</p>
              <p className="mt-0.5 max-w-[320px] text-[17px] font-extrabold leading-snug text-ss-ink [text-wrap:balance]">{title}</p>
            </div>
            <Inky size={52} mood="celebrating" className="shrink-0" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
