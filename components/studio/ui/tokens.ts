import type { LucideIcon } from 'lucide-react'

export type Tone = 'accent' | 'neutral' | 'good' | 'warn' | 'bad' | 'recall' | 'studylab' | 'exam'
export type { LucideIcon }

// Icon-chip background + foreground per tone. Dark-aware where it composes from
// ss-* vars; the semantic tones use an alpha tint over their token color.
export const TONE_CHIP: Record<Tone, string> = {
  neutral: 'bg-ss-chip text-ss-slate',
  accent: 'bg-ss-accent-soft text-ss-accent',
  good: 'bg-[color:var(--ss-good)]/12 text-ss-good',
  warn: 'bg-[color:var(--ss-warn)]/14 text-ss-warn',
  bad: 'bg-[color:var(--ss-bad)]/12 text-ss-bad',
  recall: 'bg-ss-accent-soft text-ss-accent-bright',
  studylab: 'bg-[color:var(--ss-good)]/12 text-ss-good',
  exam: 'bg-[color:var(--ss-warn)]/14 text-ss-warn',
}
