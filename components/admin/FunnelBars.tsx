export interface FunnelStage {
  key: string
  label: string
  meaning: string
  count: number
  ofPrevious: number
}

/**
 * The student funnel, drawn as nested widths.
 *
 * Each bar is sized against the top of the funnel so the shape of the drop is
 * visible at a glance, but the percentage quoted beside it is against the stage
 * directly above. Those are different numbers on purpose: the width shows how
 * few people are left, the percentage shows which step lost them. Quoting
 * everything against the total makes every late stage look equally bad and
 * hides the one leak worth fixing.
 */
export function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) return null
  const top = Math.max(1, stages[0].count)

  return (
    <ol className="grid gap-3">
      {stages.map((stage, i) => {
        const width = Math.max(4, (stage.count / top) * 100)
        // The worst single drop is the one worth drawing attention to.
        const worstDrop = i > 0 && stage.ofPrevious === Math.min(...stages.slice(1).map((s) => s.ofPrevious))
        return (
          <li key={stage.key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13px] font-bold text-ss-ink">{stage.label}</span>
              <span className="text-[13px] font-semibold text-ss-slate">
                <span className="text-[15px] font-extrabold text-ss-ink">
                  {stage.count.toLocaleString()}
                </span>
                {i > 0 && (
                  <>
                    {' '}
                    <span className={worstDrop ? 'font-extrabold text-ss-warn' : ''}>
                      {stage.ofPrevious}% of previous
                    </span>
                  </>
                )}
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-lg bg-ss-chip">
              <div
                className="h-full rounded-lg"
                style={{
                  width: `${width}%`,
                  backgroundColor: i === 0 ? 'var(--ss-slate)' : 'var(--ss-accent)',
                  opacity: 1 - i * 0.14,
                }}
              />
            </div>
            <p className="mt-1 text-[12px] font-medium text-ss-slate">{stage.meaning}</p>
          </li>
        )
      })}
    </ol>
  )
}
