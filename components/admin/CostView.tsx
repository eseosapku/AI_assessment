export interface CostLine {
  key: string
  label: string
  model: string
  calls: number
  totalUsd: number
  perCallUsd: number
  bucket: string
}

export interface CostSummary {
  basis: 'measured' | 'estimated'
  lines: CostLine[]
  aiTotalUsd: number
  aiTeachingUsd: number
  aiDevelopmentUsd: number
  aiMonthlyUsd: number
  activeStudents: number
  aiPerStudentMonthUsd: number
  aiPerPaperUsd: number
  revenuePerStudentUsd: number
  inferenceShareOfRevenuePct: number
  revenueAfterInferenceUsd: number
}

const usd = (v: number, dp = 2) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

/**
 * What inference costs, against what a student pays.
 *
 * Reports one cost, because one cost is what the database can account for.
 * There is no margin figure here on purpose: a margin needs a full cost base,
 * and hosting, storage, egress and payment fees are not measured anywhere in
 * this system. Quoting one anyway would mean resting the most consequential
 * number on the page on an estimate nobody could check.
 *
 * The narrower claim is still the interesting one. Model calls take a fraction
 * of a percent of the subscription, so whatever running this platform does
 * cost, it is not inference — and that is a finding the operation counts
 * genuinely support.
 */
export function CostView({ c }: { c: CostSummary }) {
  const share = Math.min(100, Math.max(0, c.inferenceShareOfRevenuePct))
  // Sub-1% would be invisible at true scale, so the sliver is floored — the
  // figure beside it carries the real value.
  const drawnShare = Math.max(share, 0.6)

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure
          value={usd(c.aiPerStudentMonthUsd, 4)}
          label="of model spend per student, per month"
        />
        <Figure value={usd(c.aiPerPaperUsd, 5)} label="per paper generated" />
        <Figure
          value={`${c.inferenceShareOfRevenuePct}%`}
          label={`of the ${usd(c.revenuePerStudentUsd, 0)} subscription`}
        />
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-[13px] font-bold">
          <span className="text-ss-ink">Model spend against the subscription</span>
          <span className="text-ss-slate">
            {usd(c.aiPerStudentMonthUsd, 4)} of {usd(c.revenuePerStudentUsd, 0)}
          </span>
        </div>
        <div className="flex h-7 w-full overflow-hidden rounded-lg bg-ss-chip">
          <div style={{ width: `${drawnShare}%`, backgroundColor: 'var(--ss-bad)' }} />
          <div style={{ width: `${100 - drawnShare}%`, backgroundColor: 'var(--ss-good)' }} />
        </div>
        <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-ss-slate">
          The green is <span className="font-bold text-ss-ink">not</span> margin. Hosting, database,
          storage, egress and payment fees all come out of it, and none of them are measured
          anywhere in this system — they are listed below under what we are not measuring yet. What
          this does show is that model calls are not where the money goes.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-bold text-ss-ink">Where the model spend goes</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ss-line">
                <th scope="col" className="pb-2 text-[12px] font-bold uppercase tracking-wide text-ss-slate">Operation</th>
                <th scope="col" className="pb-2 text-[12px] font-bold uppercase tracking-wide text-ss-slate">Model</th>
                <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Calls</th>
                <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Per call</th>
                <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Total</th>
              </tr>
            </thead>
            <tbody>
              {c.lines.map((l) => (
                <tr key={l.key} className="border-b border-ss-line last:border-0">
                  <td className="py-2.5 text-[13px] font-bold capitalize text-ss-ink">{l.label}</td>
                  <td className="py-2.5 text-[13px] font-medium text-ss-slate">{l.model}</td>
                  <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">
                    {l.calls.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-[13px] font-medium text-ss-slate">
                    {usd(l.perCallUsd, 5)}
                  </td>
                  <td className="py-2.5 text-right text-[13px] font-extrabold text-ss-ink">
                    {usd(l.totalUsd, 2)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-ss-line">
                <td colSpan={4} className="pt-3 text-[13px] font-bold text-ss-ink">
                  All model spend, per month
                </td>
                <td className="pt-3 text-right text-[13px] font-extrabold text-ss-ink">
                  {usd(c.aiMonthlyUsd, 2)}
                </td>
              </tr>
              {c.aiDevelopmentUsd > 0 && (
                <tr>
                  <td colSpan={4} className="pt-1.5 text-[13px] font-medium text-ss-slate">
                    of which development, not teaching
                  </td>
                  <td className="pt-1.5 text-right text-[13px] font-bold text-ss-slate">
                    {usd(c.aiDevelopmentUsd, 2)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[34px] font-extrabold leading-none tracking-tight text-ss-ink">{value}</p>
      <p className="mt-1.5 text-[13px] font-semibold leading-snug text-ss-slate">{label}</p>
    </div>
  )
}
