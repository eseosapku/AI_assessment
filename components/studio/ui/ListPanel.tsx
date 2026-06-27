import type { ReactNode } from 'react'
import type { LucideIcon } from './tokens'

export function ListPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-ss-line bg-ss-panel p-[18px]">
      <div className="mb-1 flex items-center gap-2 text-[13px] font-extrabold text-ss-ink">
        {Icon && <Icon className="h-4 w-4 text-ss-accent" strokeWidth={1.9} />} {title}
      </div>
      <div>{children}</div>
    </div>
  )
}
