import { barHeights } from '@/lib/studio/miniBars'

export function MiniBars({
  values,
  active = [],
  labels = [],
}: {
  values: number[]
  active?: number[]
  labels?: string[]
}) {
  const h = barHeights(values, 84)
  return (
    <div>
      <div className="mt-[18px] flex h-[84px] items-end gap-2.5 px-1">
        {h.map((px, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-md ${active.includes(i) ? 'bg-ss-accent' : 'bg-ss-chip'}`}
            style={{ height: `${px}%` }}
          />
        ))}
      </div>
      {labels.length > 0 && (
        <div className="mt-[7px] flex gap-2.5 text-[10px] font-semibold text-ss-slate">
          {labels.map((l, i) => (
            <span key={i} className="flex-1 text-center">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
