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
  aiMonthlyUsd: number
  infrastructureMonthlyUsd: number
  totalMonthlyUsd: number
  activeStudents: number
  costPerStudentMonthUsd: number
  aiPerStudentMonthUsd: number
  revenuePerStudentUsd: number
  grossMarginPct: number
  breakEvenStudents: number
}

const usd = (v: number, dp = 2) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

/**
 * Cost to serve, and what the subscription leaves after it.
 *
 * Laid out to make one point clear, because it is the point: inference is a
 * rounding error and infrastructure is the bill. That matters more than the
 * headline margin, since a cost driven by usage rises with every new student
 * while a fixed one is diluted by them — the same reason the figure improves
 * with scale rather than degrading.
 *
 * The split bar is deliberately drawn against the subscription rather than as
 * a pie of costs, so the empty part of it is the margin and needs no label.
 */
export function CostView({ c }: { c: CostSummary }) {
  const cost = c.costPerStudentMonthUsd
  const revenue = c.revenuePerStudentUsd
  const costShare = revenue > 0 ? Math.min(100, Math.max(0, (cost / revenue) * 100)) : 0

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure value={`${c.grossMarginPct}%`} label="gross margin per student" />
        <Figure value={usd(cost, 2)} label="to serve one student for a month" />
        <Figure
          value={c.breakEvenStudents.toLocaleString()}
          label="subscriptions to cover the fixed bill"
        />
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-[13px] font-bold">
          <span className="text-ss-ink">Cost against the {usd(revenue, 0)} subscription</span>
          <span className="text-ss-slate">
            {usd(cost, 2)} of {usd(revenue, 0)}
          </span>
        </div>
        <div className="flex h-7 w-full overflow-hidden rounded-lg bg-ss-chip">
          <div style={{ width: `${costShare}%`, backgroundColor: 'var(--ss-bad)' }} />
          <div style={{ width: `${100 - costShare}%`, backgroundColor: 'var(--ss-good)' }} />
        </div>
        <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-ss-slate">
          Inference accounts for {usd(c.aiPerStudentMonthUsd, 4)} of that. The rest is
          infrastructure, which barely moves with headcount — which is why the margin widens as the
          platform grows rather than narrowing.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-bold text-ss-ink">Where the inference spend goes</p>
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
                  Infrastructure, per month
                </td>
                <td className="pt-3 text-right text-[13px] font-extrabold text-ss-ink">
                  {usd(c.infrastructureMonthlyUsd, 2)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="pt-1.5 text-[13px] font-bold text-ss-ink">
                  Inference, per month
                </td>
                <td className="pt-1.5 text-right text-[13px] font-extrabold text-ss-ink">
                  {usd(c.aiMonthlyUsd, 2)}
                </td>
              </tr>
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
