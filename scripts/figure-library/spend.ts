// scripts/figure-library/spend.ts
import type { Store } from './store'

/** USD per million tokens, on-demand, EU inference profiles (regional pricing). */
export const PRICES: Record<string, { input: number; output: number }> = {
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0': { input: 1.1, output: 5.5 },
  'eu.anthropic.claude-sonnet-5-5': { input: 2.2, output: 11 },
}

/** The user's hard cap on model spend for the whole library (spec section 8). */
export const DEFAULT_CAP_USD = 600

export class BudgetExceeded extends Error {}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model]
  if (!p) throw new Error(`No price recorded for ${model}; add it to PRICES before spending on it`)
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

/** The cap in force. The environment may lower it, never raise it. */
export function capUsd(): number {
  const v = Number(process.env.FIGURE_LIBRARY_CAP_USD)
  return Number.isFinite(v) && v > 0 ? Math.min(v, DEFAULT_CAP_USD) : DEFAULT_CAP_USD
}

export function totalSpend(db: Store, job?: string): number {
  const row = (job
    ? db.prepare('SELECT COALESCE(SUM(usd), 0) AS t FROM spend WHERE job = ?').get(job)
    : db.prepare('SELECT COALESCE(SUM(usd), 0) AS t FROM spend').get()) as { t: number }
  return Number(row.t)
}

export function recordSpend(db: Store, e: { job: string; model: string; inputTokens: number; outputTokens: number }): number {
  const usd = costUsd(e.model, e.inputTokens, e.outputTokens)
  db.prepare('INSERT INTO spend (job, model, input_tokens, output_tokens, usd, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(e.job, e.model, e.inputTokens, e.outputTokens, usd, new Date().toISOString())
  return usd
}

/** Refuses to start a job whose estimate would take the library past its cap, or the job past its own. */
export function assertBudget(db: Store, o: { job: string; estimateUsd: number; jobCapUsd: number; cap?: number }): void {
  const cap = o.cap ?? capUsd()
  const spent = totalSpend(db)
  const jobSpent = totalSpend(db, o.job)
  if (spent + o.estimateUsd > cap) {
    throw new BudgetExceeded(`Spent $${spent.toFixed(2)} of $${cap}; this job's estimate of $${o.estimateUsd.toFixed(2)} would pass the cap.`)
  }
  if (jobSpent + o.estimateUsd > o.jobCapUsd) {
    throw new BudgetExceeded(`${o.job} has spent $${jobSpent.toFixed(2)} of its $${o.jobCapUsd}; an estimate of $${o.estimateUsd.toFixed(2)} more would pass it.`)
  }
}

/** Checked after every call: stops a job the moment it crosses either cap. */
export function checkBudget(db: Store, o: { job: string; jobCapUsd: number; cap?: number }): void {
  const cap = o.cap ?? capUsd()
  const spent = totalSpend(db)
  const jobSpent = totalSpend(db, o.job)
  if (spent > cap || jobSpent > o.jobCapUsd) {
    throw new BudgetExceeded(`Stopped: library spend $${spent.toFixed(2)} (cap $${cap}), ${o.job} $${jobSpent.toFixed(2)} (cap $${o.jobCapUsd}).`)
  }
}
