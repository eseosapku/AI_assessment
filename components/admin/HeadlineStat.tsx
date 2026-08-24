'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type StatTone = 'accent' | 'good' | 'warn'

const TONE: Record<StatTone, { chip: string; rule: string; figure: string }> = {
  accent: { chip: 'bg-ss-accent-soft text-ss-accent', rule: 'bg-[color:var(--ss-accent)]', figure: 'text-ss-ink' },
  good: { chip: 'bg-[color:var(--ss-good)]/12 text-ss-good', rule: 'bg-[color:var(--ss-good)]', figure: 'text-ss-ink' },
  warn: { chip: 'bg-[color:var(--ss-warn)]/14 text-ss-warn', rule: 'bg-[color:var(--ss-warn)]', figure: 'text-ss-ink' },
}

export interface StatDefinition {
  /** What one unit of this number actually is. The answer to "21,000 what?" */
  unit: string
  /** How it is measured, in one or two sentences. */
  method: string
  /** What it deliberately is not, where a reader would otherwise assume wrong. */
  notCounted?: string
}

/**
 * One of the three numbers the platform is judged on.
 *
 * The definition sits under the figure rather than in a tooltip. A tooltip is
 * fine for a detail; this is the part that decides whether the number means
 * anything, and the first question anyone asks on seeing "21,436 learning gaps"
 * is what a gap is and how one was counted. Answering that in the card is the
 * difference between a claim and a measurement.
 */
export function HeadlineStat({
  icon: Icon,
  label,
  value,
  suffix,
  sub,
  tone = 'accent',
  definition,
}: {
  icon: LucideIcon
  label: string
  value: string
  suffix?: string
  /** One supporting figure that gives the headline its scale. */
  sub: string
  tone?: StatTone
  definition: StatDefinition
}) {
  const [open, setOpen] = useState(false)
  const t = TONE[tone]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ss-line bg-ss-panel p-5 shadow-sm">
      <div aria-hidden className={`absolute inset-x-0 top-0 h-1 ${t.rule}`} />

      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${t.chip}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-ss-slate">{label}</h3>
      </div>

      <p className={`mt-3 text-[40px] font-extrabold leading-none tracking-tight ${t.figure}`}>
        {value}
        {suffix && <span className="ml-1 text-[22px] font-bold text-ss-slate">{suffix}</span>}
      </p>

      <p className="mt-2 text-[13px] font-semibold text-ss-slate">{sub}</p>

      <p className="mt-3 text-[13px] font-medium leading-snug text-ss-ink">
        <span className="font-bold">One {definition.unit}</span> — {definition.method}
      </p>

      {definition.notCounted && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 -ml-2 text-[12.5px] font-bold text-ss-accent hover:bg-ss-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ss-accent)]"
          >
            What this does not count
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {open && (
            <p className="mt-2 rounded-xl bg-ss-chip p-3 text-[12.5px] font-medium leading-relaxed text-ss-slate">
              {definition.notCounted}
            </p>
          )}
        </>
      )}
    </div>
  )
}
