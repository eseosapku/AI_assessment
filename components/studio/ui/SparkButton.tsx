import { Sparkles } from 'lucide-react'

export function SparkButton({
  label,
  ariaLabel,
  onClick,
  className = '',
}: {
  label: string
  /** Use when the visible label repeats down a list. "Study" four times over
      tells a screen-reader user nothing about which topic each one opens. */
  ariaLabel?: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-xl bg-ss-accent-soft px-3 py-1.5 text-[13px] font-bold text-ss-accent transition-all hover:brightness-95 active:scale-[0.98] ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5" /> {label}
    </button>
  )
}
