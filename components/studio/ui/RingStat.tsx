import Avatar from '@/components/studio/Avatar'

export function RingStat({ pct, name, sub, userId }: { pct: number; name: string; sub?: string; userId?: string | null }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="rounded-[22px] border border-ss-line bg-ss-panel p-[22px] text-center">
      <div
        className="mx-auto grid h-[122px] w-[122px] place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--ss-accent) 0 ${p}%, var(--ss-chip) ${p}% 100%)` }}
      >
        <div className="grid h-[100px] w-[100px] place-items-center rounded-full bg-ss-panel">
          <Avatar userId={userId} name={name} size={80} className="ring-2 ring-[color:var(--ss-accent)]/20" />
        </div>
      </div>
      <div className="mt-3.5 text-[16.5px] font-extrabold text-ss-ink">{name}</div>
      {sub && <div className="mt-[3px] text-[12px] font-semibold text-ss-slate">{sub}</div>}
    </div>
  )
}
