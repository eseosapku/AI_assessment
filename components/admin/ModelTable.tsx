export interface ModelUsageRow {
  key: string
  label: string
  what: string
  modelId: string
  modelLabel: string
  provider: string
  inputPer1M: number
  outputPer1M: number
  note: string
  calls: number
  sharePct: number
  usd: number
  perCallUsd: number
  configuredBy: string
  provenance: 'chosen' | 'inherited'
  why: string
}

export interface ModelUsage {
  basis: 'measured' | 'apportioned'
  rows: ModelUsageRow[]
  bedrockUsd: number
  unusedModels: { id: string; label: string; provider: string; inputPer1M: number; outputPer1M: number; note: string }[]
  inheritedCallSites: { path: string; label: string; what: string }[]
}

const usd = (v: number, dp = 2) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

const PROVIDER_TONE: Record<string, string> = {
  Amazon: 'bg-ss-accent-soft text-ss-accent',
  Google: 'bg-[color:var(--ss-good)]/12 text-ss-good',
  Anthropic: 'bg-[color:var(--ss-warn)]/14 text-ss-warn',
}

/**
 * Which model runs which feature, at what rate, for how much.
 *
 * Grouped by feature rather than by model, because the decision this table
 * supports is per feature: whether the tutor is worth Gemma's three-times rate
 * is a different question from whether generation is. The model each one runs
 * on is resolved from the same environment variable the route reads, so the
 * page cannot describe a model choice the system is no longer making.
 */
export function ModelTable({ usage }: { usage: ModelUsage }) {
  const max = Math.max(1, ...usage.rows.map((r) => r.usd))

  return (
    <div className="grid gap-5">
      <ul className="grid gap-2.5">
        {usage.rows.map((r) => (
          <li key={r.key} className="rounded-xl border border-ss-line bg-ss-canvas p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-[220px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-extrabold text-ss-ink">{r.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[12px] font-extrabold ${
                      PROVIDER_TONE[r.provider] ?? 'bg-ss-chip text-ss-slate'
                    }`}
                  >
                    {r.modelLabel}
                  </span>
                  {/* The distinction that matters: a model picked for the job,
                      or one an incident picked and nobody revisited. */}
                  {r.provenance === 'inherited' && (
                    <span className="rounded-full bg-[color:var(--ss-warn)]/14 px-2 py-0.5 text-[12px] font-extrabold text-ss-warn">
                      Inherited
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] font-medium leading-snug text-ss-slate">{r.what}</p>
              </div>

              <div className="text-right">
                <p className="text-[16px] font-extrabold leading-none text-ss-ink">{usd(r.usd)}</p>
                <p className="mt-1 text-[12px] font-semibold text-ss-slate">
                  {r.calls.toLocaleString()} calls · {usd(r.perCallUsd, 5)} each
                </p>
              </div>
            </div>

            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ss-chip">
              <div
                className="h-full rounded-full bg-[color:var(--ss-accent)]"
                style={{ width: `${Math.max(1, (r.usd / max) * 100)}%` }}
              />
            </div>

            <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] font-medium text-ss-slate">
              <div>
                <dt className="inline font-bold text-ss-ink">Rate: </dt>
                <dd className="inline">
                  {usd(r.inputPer1M, 3)} in / {usd(r.outputPer1M, 3)} out per million tokens
                </dd>
              </div>
              <div>
                <dt className="inline font-bold text-ss-ink">Set by: </dt>
                <dd className="inline">
                  <code className="rounded bg-ss-chip px-1 py-0.5">{r.configuredBy}</code>
                </dd>
              </div>
            </dl>
            <p className="mt-1.5 text-[12px] font-medium leading-snug text-ss-slate">{r.why}</p>
          </li>
        ))}
      </ul>

      {usage.inheritedCallSites.length > 0 && (
        <div className="rounded-xl border border-[color:var(--ss-warn)]/40 bg-[color:var(--ss-warn)]/10 p-3.5">
          <p className="text-[13px] font-extrabold text-ss-ink">
            Still on the model the June incident picked
          </p>
          <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-ss-slate">
            These reach Bedrock through <code className="rounded bg-ss-chip px-1 py-0.5">callGemma()</code>{' '}
            without naming a model, so they take the shared default — which was pointed at Nova Lite
            on 22 June to stop the timeouts and never pointed back. The function is still called
            callGemma, which is how it stayed invisible. They are listed rather than costed because
            nothing counts these calls.
          </p>
          <ul className="mt-2.5 grid gap-1.5">
            {usage.inheritedCallSites.map((c) => (
              <li key={c.path} className="text-[12.5px] font-medium text-ss-slate">
                <span className="font-bold text-ss-ink">{c.label}</span> — {c.what}{' '}
                <code className="rounded bg-ss-chip px-1 py-0.5 text-[12px]">{c.path}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {usage.unusedModels.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-bold text-ss-ink">Available, nothing routed to it</p>
          <ul className="grid gap-2">
            {usage.unusedModels.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ss-line pb-2 last:border-0 last:pb-0"
              >
                <span className="text-[13px] font-bold text-ss-ink">
                  {m.label}{' '}
                  <span className="font-medium text-ss-slate">
                    — {usd(m.inputPer1M, 3)} / {usd(m.outputPer1M, 3)} per million
                  </span>
                </span>
                <span className="text-[12px] font-medium text-ss-slate">{m.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
