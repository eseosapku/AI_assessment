export interface MonthlyCost {
  month: string
  totalUsd: number
  servingUsd: number
  inferenceUsd: number
  developmentUsd: number
  costToServeUsd: number
  activeStudents: number
  costPerStudentUsd: number | null
  revenueUsd: number
  marginPct: number | null
}

export interface ServiceLine {
  service: string
  usd: number
  bucket: 'serving' | 'inference' | 'development'
  sharePct: number
}

export interface CostSummary {
  source: { exportedOn: string; periodFrom: string; periodTo: string; note: string }
  months: MonthlyCost[]
  services: ServiceLine[]
  totalUsd: number
  servingUsd: number
  inferenceUsd: number
  developmentUsd: number
  inferenceSharePct: number
  bestMonth: MonthlyCost | null
  latestMonth: MonthlyCost | null
  revenuePerStudentUsd: number
  breakEvenStudents: number
}

const usd = (v: number, dp = 2) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(2, 4)}`

/**
 * The bill, against the students it served.
 *
 * Reported per month rather than as one blended average, because the blend
 * would hide the only thing here worth acting on: the margin is excellent in
 * the months students actually showed up and negative in the months they did
 * not, and the bill barely moved between them. Most of the spend is provisioned
 * rather than consumed, so the per-student figure is set by attendance against
 * a cost that arrives either way.
 */
export function CostView({ c }: { c: CostSummary }) {
  const best = c.bestMonth
  const latest = c.latestMonth

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure
          value={best?.costPerStudentUsd !== null && best ? usd(best.costPerStudentUsd!, 2) : '—'}
          label={best ? `per student in ${label(best.month)}, the busiest month` : 'no month with students'}
        />
        <Figure
          value={best?.marginPct !== null && best ? `${best.marginPct}%` : '—'}
          label={`margin on the ${usd(c.revenuePerStudentUsd, 0)} subscription that month`}
        />
        <Figure
          value={c.breakEvenStudents.toLocaleString()}
          label="active students to cover the latest month"
        />
      </div>

      {/* Where the money goes: three buckets, one bar. */}
      <div>
        <p className="mb-2 text-[13px] font-bold text-ss-ink">
          {usd(c.totalUsd)} spent from {label(c.source.periodFrom)} to {label(c.source.periodTo)}
        </p>
        <div className="flex h-7 w-full overflow-hidden rounded-lg bg-ss-chip">
          <div style={{ width: `${(c.servingUsd / c.totalUsd) * 100}%`, backgroundColor: 'var(--ss-accent)' }} />
          <div style={{ width: `${(c.inferenceUsd / c.totalUsd) * 100}%`, backgroundColor: 'var(--ss-good)' }} />
          <div style={{ width: `${(c.developmentUsd / c.totalUsd) * 100}%`, backgroundColor: 'var(--ss-slate)' }} />
        </div>
        <dl className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <Legend color="var(--ss-accent)" label="Serving" value={usd(c.servingUsd)} note="Database, network, hosting" />
          <Legend color="var(--ss-good)" label="Inference" value={usd(c.inferenceUsd)} note={`${c.inferenceSharePct}% of the bill`} />
          <Legend color="var(--ss-slate)" label="Development" value={usd(c.developmentUsd)} note="CI, registry, experiments" />
        </dl>
      </div>

      {/* The month-by-month table, which is where the real story is. */}
      <div>
        <p className="mb-2 text-[13px] font-bold text-ss-ink">Cost against students, month by month</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ss-line">
                <th scope="col" className="pb-2 text-[12px] font-bold uppercase tracking-wide text-ss-slate">Month</th>
                <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Bill</th>
                <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">To serve</th>
                <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Students</th>
                <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Each</th>
                <th scope="col" className="pb-2 text-right text-[12px] font-bold uppercase tracking-wide text-ss-slate">Margin</th>
              </tr>
            </thead>
            <tbody>
              {c.months.map((m) => (
                <tr key={m.month} className="border-b border-ss-line last:border-0">
                  <td className="py-2.5 text-[13px] font-bold text-ss-ink">{label(m.month)}</td>
                  <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">{usd(m.totalUsd)}</td>
                  <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">{usd(m.costToServeUsd)}</td>
                  <td className="py-2.5 text-right text-[13px] font-semibold text-ss-slate">
                    {m.activeStudents.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right text-[13px] font-semibold text-ss-ink">
                    {m.costPerStudentUsd === null ? '—' : usd(m.costPerStudentUsd, 2)}
                  </td>
                  <td className="py-2.5 text-right">
                    {/* Losses shown as losses. The months that went underwater
                        are the ones the number exists to surface. */}
                    <span
                      className={`text-[13px] font-extrabold ${
                        m.marginPct === null
                          ? 'text-ss-slate'
                          : m.marginPct >= 0
                            ? 'text-ss-good'
                            : 'text-ss-bad'
                      }`}
                    >
                      {m.marginPct === null ? '—' : `${m.marginPct}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] font-medium leading-relaxed text-ss-slate">
          Most of this bill is provisioned rather than consumed — the database runs whether anyone
          logs in or not — so the per-student figure is set by how many students turn up against a
          cost that arrives regardless. That is why the busy months are profitable and the quiet ones
          are not, on almost identical spend.
        </p>
      </div>

      {/* Service detail. */}
      <div>
        <p className="mb-2 text-[13px] font-bold text-ss-ink">By service</p>
        <ul className="grid gap-2">
          {c.services
            .filter((s) => s.usd >= 0.01)
            .map((s) => (
              <li key={s.service} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-ss-ink">{s.service}</span>
                    <span className="shrink-0 text-[12px] font-medium text-ss-slate">{s.sharePct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ss-chip">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0.5, s.sharePct)}%`,
                        backgroundColor:
                          s.bucket === 'inference'
                            ? 'var(--ss-good)'
                            : s.bucket === 'development'
                              ? 'var(--ss-slate)'
                              : 'var(--ss-accent)',
                      }}
                    />
                  </div>
                </div>
                <span className="text-[13px] font-extrabold text-ss-ink">{usd(s.usd)}</span>
              </li>
            ))}
        </ul>
      </div>

      <p className="text-[12px] font-medium text-ss-slate">
        Cost Explorer export taken {c.source.exportedOn}. Re-export and update{' '}
        <code className="rounded bg-ss-chip px-1 py-0.5">lib/admin/aws-costs.ts</code> to refresh.
        {latest && ` Latest month in the export: ${label(latest.month)}.`}
      </p>
    </div>
  )
}

function Figure({ value, label: text }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[34px] font-extrabold leading-none tracking-tight text-ss-ink">{value}</p>
      <p className="mt-1.5 text-[13px] font-semibold leading-snug text-ss-slate">{text}</p>
    </div>
  )
}

function Legend({
  color,
  label: text,
  value,
  note,
}: {
  color: string
  label: string
  value: string
  note: string
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-ss-line pb-2 sm:border-0 sm:pb-0">
      <dt className="text-[13px] font-medium text-ss-slate">
        <span className="inline-flex items-center gap-2 font-bold text-ss-ink">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          {text}
        </span>
        <span className="mt-0.5 block text-[12px]">{note}</span>
      </dt>
      <dd className="shrink-0 text-[14px] font-extrabold text-ss-ink">{value}</dd>
    </div>
  )
}
