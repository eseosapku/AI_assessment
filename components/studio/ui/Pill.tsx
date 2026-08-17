import type { ReactNode } from 'react'

export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent'
  className?: string
}) {
  const t = tone === 'accent' ? 'bg-ss-accent-soft text-ss-accent' : 'bg-ss-chip text-ss-slate'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold ${t} ${className}`}>
      {children}
    </span>
  )
}
