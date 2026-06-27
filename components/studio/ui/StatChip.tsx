import type { ReactNode } from 'react'
import { IconChip } from './IconChip'
import type { LucideIcon, Tone } from './tokens'

export function StatChip({
  icon,
  value,
  label,
  tone = 'neutral',
}: {
  icon: LucideIcon
  value: ReactNode
  label: string
  tone?: Tone
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-[18px] border border-ss-line bg-ss-panel p-4">
      <IconChip icon={icon} tone={tone} className="h-[46px] w-[46px]" />
      <div className="min-w-0">
        <div className="truncate text-[24px] font-extrabold leading-none text-ss-ink">{value}</div>
        <div className="mt-[3px] text-[11.5px] font-semibold text-ss-slate">{label}</div>
      </div>
    </div>
  )
}
