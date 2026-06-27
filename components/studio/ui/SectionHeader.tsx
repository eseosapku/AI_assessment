import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: { label: string; onClick?: () => void; href?: string }
}) {
  const inner = action && (
    <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-ss-accent hover:underline">
      {action.label} <ArrowRight className="h-3.5 w-3.5" />
    </span>
  )
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-extrabold text-ss-ink">{title}</h2>
      {action?.href ? (
        <Link href={action.href}>{inner}</Link>
      ) : action ? (
        <button type="button" onClick={action.onClick}>
          {inner}
        </button>
      ) : null}
    </div>
  )
}
