import type { ReactNode } from 'react'

/**
 * The container every section of the admin dashboard sits in.
 *
 * A dashboard is read by scanning, so each panel states what it is and — where
 * the figure is not self-evident — how it was arrived at. The `method` line is
 * a first-class prop rather than a caption someone might forget, because the
 * question that follows every number on this page is "how do you know that?"
 */
export function Panel({
  title,
  hint,
  method,
  right,
  children,
  className = '',
}: {
  title: string
  hint?: string
  /** How the numbers in this panel are derived. Rendered as the panel's footnote. */
  method?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-2xl border border-ss-line bg-ss-panel p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold tracking-tight text-ss-ink">{title}</h2>
          {hint && <p className="mt-1 text-[13px] font-medium leading-snug text-ss-slate">{hint}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
      {method && (
        <p className="mt-4 border-t border-ss-line pt-3 text-[12px] font-medium leading-relaxed text-ss-slate">
          <span className="font-bold text-ss-ink">How: </span>
          {method}
        </p>
      )}
    </section>
  )
}
