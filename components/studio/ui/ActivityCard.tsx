import Link from 'next/link'
import type { ReactNode } from 'react'
import { IconChip } from './IconChip'
import { Pill } from './Pill'
import type { Tone, LucideIcon } from './tokens'

export function ActivityCard({
  icon,
  tone = 'accent',
  pill,
  pillTone = 'accent',
  title,
  progress,
  meta,
  onClick,
  href,
}: {
  icon: LucideIcon
  tone?: Tone
  pill?: string
  pillTone?: 'neutral' | 'accent'
  title: string
  progress?: number
  meta?: ReactNode
  onClick?: () => void
  href?: string
}) {
  const body = (
    <div className="rounded-[20px] border border-ss-line bg-ss-panel p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-ss-panel">
      <div className="flex items-center justify-between">
        <IconChip icon={icon} tone={tone} />
        {pill && <Pill tone={pillTone}>{pill}</Pill>}
      </div>
      <h3 className="mt-3 text-[14.5px] font-bold text-ss-ink">{title}</h3>
      {typeof progress === 'number' && (
        <div className="my-3 h-[7px] overflow-hidden rounded-md bg-ss-chip">
          <div className="h-full rounded-md bg-ss-accent" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {meta && <div className="flex items-center gap-2 text-[12px] font-semibold text-ss-slate">{meta}</div>}
    </div>
  )
  if (href) return <Link href={href}>{body}</Link>
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="block w-full">
        {body}
      </button>
    )
  return body
}
