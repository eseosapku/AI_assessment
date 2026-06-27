import { Sparkles } from 'lucide-react'

export function SparkButton({
  label,
  onClick,
  className = '',
}: {
  label: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl bg-ss-accent-soft px-3 py-1.5 text-[11.5px] font-bold text-ss-accent transition-all hover:brightness-95 active:scale-[0.98] ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5" /> {label}
    </button>
  )
}
