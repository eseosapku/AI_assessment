import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string
  /** One line saying what the section is for. A heading names a category;
      students still have to guess where its contents came from. */
  hint?: string
  action?: { label: string; onClick?: () => void; href?: string }
}) {
  const inner = action && (
    <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-ss-accent hover:underline">
      {action.label} <ArrowRight className="h-3.5 w-3.5" />
    </span>
  )
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-extrabold text-ss-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] font-medium text-ss-slate">{hint}</p>}
      </div>
      {action?.href ? (
        <Link href={action.href} className="shrink-0">
          {inner}
        </Link>
      ) : action ? (
        <button type="button" onClick={action.onClick} className="shrink-0">
          {inner}
        </button>
      ) : null}
    </div>
  )
}
