import { X, Equal } from 'lucide-react'

export interface ChainStep {
  label: string
  value: number
  basis: 'observed' | 'modelled'
  note: string
  runningTotal: number
}

function formatFactor(value: number, index: number): string {
  if (index === 0) return value.toLocaleString()
  if (value === 1) return '100%'
  if (value < 1) return `${Math.round(value * 1000) / 10}%`
  return String(value)
}

/**
 * The arithmetic behind a headline figure, laid out so it can be checked.
 *
 * A projected number that arrives without its derivation is indistinguishable
 * from one somebody made up, so each factor is shown with its value, where it
 * came from, and the running total after it is applied. Observed factors — ones
 * the live database measured — are marked apart from modelled ones, because the
 * honest reading of a forecast depends entirely on knowing which links in the
 * chain are evidence and which are assumptions.
 */
export function MethodChain({ steps, result, resultLabel }: { steps: ChainStep[]; result: number; resultLabel: string }) {
  return (
    <div>
      <ol className="flex flex-wrap items-stretch gap-2">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-stretch gap-2">
            {i > 0 && (
              <span className="grid w-4 shrink-0 place-items-center text-ss-slate" aria-hidden>
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <div className="min-w-[132px] max-w-[190px] flex-1 rounded-xl border border-ss-line bg-ss-canvas p-3">
              <p className="text-[17px] font-extrabold leading-none text-ss-ink">
                {formatFactor(step.value, i)}
              </p>
              <p className="mt-1.5 text-[12px] font-bold leading-tight text-ss-ink">{step.label}</p>
              <span
                className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[12px] font-extrabold uppercase tracking-wide ${
                  step.basis === 'observed'
                    ? 'bg-[color:var(--ss-good)]/12 text-ss-good'
                    : 'bg-[color:var(--ss-warn)]/14 text-ss-warn'
                }`}
              >
                {step.basis}
              </span>
              <p className="mt-2 text-[12px] font-medium leading-snug text-ss-slate">{step.note}</p>
            </div>
          </li>
        ))}

        <li className="flex items-stretch gap-2">
          <span className="grid w-4 shrink-0 place-items-center text-ss-slate" aria-hidden>
            <Equal className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-[132px] rounded-xl border-2 border-[color:var(--ss-accent)] bg-ss-accent-soft p-3">
            <p className="text-[17px] font-extrabold leading-none text-ss-accent">
              {result.toLocaleString()}
            </p>
            <p className="mt-1.5 text-[12px] font-bold leading-tight text-ss-ink">{resultLabel}</p>
          </div>
        </li>
      </ol>
    </div>
  )
}
