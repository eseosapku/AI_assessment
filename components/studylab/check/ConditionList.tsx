'use client'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { motionFor } from '@/lib/studylab/motionPresets'

/**
 * Conditions that tick one by one as they come true: an order's clues, a
 * sequence's rules, a balance's "both sides weigh the same".
 */
export function ConditionList({ items, label = 'Clues' }: { items: { text: string; met: boolean }[]; label?: string }) {
  const reduced = useReducedMotion() ?? false
  if (items.length === 0) return null
  return (
    <ul aria-label={label} className="flex flex-col gap-1.5">
      {items.map((c, i) => (
        <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug">
          <span
            aria-hidden
            className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none"
            style={c.met
              ? { borderColor: 'var(--ss-good)', backgroundColor: 'color-mix(in srgb, var(--ss-good) 15%, transparent)' }
              : { borderColor: 'var(--ss-slate)' }}
          >
            {c.met && (
              <motion.span key="tick" {...motionFor('pop', reduced)} className="grid place-items-center">
                <Check className="h-3 w-3" style={{ color: 'var(--ss-good)' }} />
              </motion.span>
            )}
          </span>
          <span className={c.met ? 'text-ss-ink' : 'text-ss-slate'}>
            {c.text}
            <span className="sr-only">{c.met ? ' (true now)' : ' (not yet)'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
