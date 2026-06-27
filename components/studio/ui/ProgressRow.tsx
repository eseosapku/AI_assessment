import { ArrowUp, ArrowDown } from 'lucide-react'

export function ProgressRow({ label, pct, trend, art }: { label: string; pct: number; trend?: 'up' | 'down'; art?: string }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="flex items-center gap-3 border-b border-ss-line py-2.5 last:border-0">
      {art && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art} alt="" aria-hidden className="h-7 w-7 shrink-0 object-contain" />
      )}
      <span className="w-[140px] shrink-0 truncate text-[13.5px] font-bold text-ss-ink">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-md bg-ss-chip">
        <i className="block h-full rounded-md bg-gradient-to-r from-ss-accent-bright to-ss-accent" style={{ width: `${p}%` }} />
      </span>
      <span className="w-10 text-right text-[13px] font-extrabold tabular-nums text-ss-ink">{p}%</span>
      {trend && (
        <span
          className={`grid h-[22px] w-[22px] place-items-center rounded-[7px] ${
            trend === 'up' ? 'bg-[color:var(--ss-good)]/12 text-ss-good' : 'bg-[color:var(--ss-bad)]/12 text-ss-bad'
          }`}
        >
          {trend === 'up' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </span>
      )}
    </div>
  )
}
