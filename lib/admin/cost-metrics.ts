import { db as defaultDb, type Database } from '@/lib/db'
import {
  AWS_MONTHS,
  AWS_COST_SOURCE,
  type CostSource,
  bucketsForMonth,
  serviceTotals,
  type CostBucket,
} from './aws-costs'

/**
 * What the platform costs, from the actual AWS bill.
 *
 * Every figure here is real spend joined to real usage. An earlier version
 * guessed at infrastructure and estimated inference from token profiles; the
 * export showed the guess was three times too high and the estimate five times
 * too low, which is a good argument for not guessing.
 *
 * The two findings the bill produces:
 *
 *  - **Inference is not the cost.** Bedrock is 4.9% of spend. The database
 *    alone is 63%. This platform costs money to store and serve data, not to
 *    generate it — so the margin thesis holds, but for a different reason than
 *    "the models are cheap".
 *  - **Spend does not follow usage.** July was the most expensive month on
 *    record and had thirteen active students. Most of the bill is provisioned
 *    rather than consumed, which means the per-student cost is set by how many
 *    students turn up against a bill that arrives regardless.
 *
 * That second point is why this reports per month rather than as one lifetime
 * average. A single blended figure would hide both the 98% margin in May and
 * the loss in July, and those are the same platform two months apart.
 */

/** Monthly subscription per student, USD. Mirrors SUBSCRIPTION_USD. */
export const REVENUE_PER_STUDENT_USD = 5

export interface MonthlyCost {
  month: string
  /** Everything AWS charged that month. */
  totalUsd: number
  servingUsd: number
  inferenceUsd: number
  developmentUsd: number
  /** Serving plus inference: what it cost to have students on the platform. */
  costToServeUsd: number
  activeStudents: number
  /** costToServe / activeStudents. Null in a month with nobody on it. */
  costPerStudentUsd: number | null
  /** Subscription revenue if every active student paid. */
  revenueUsd: number
  /** Revenue minus cost to serve, over revenue. Null when there is no revenue. */
  marginPct: number | null
}

export interface ServiceLine {
  service: string
  usd: number
  bucket: CostBucket
  /** Share of the whole bill. */
  sharePct: number
}

export interface CostMetrics {
  source: CostSource
  months: MonthlyCost[]
  services: ServiceLine[]
  /** Lifetime totals across the exported period. */
  totalUsd: number
  servingUsd: number
  inferenceUsd: number
  developmentUsd: number
  /** Inference as a share of the whole bill. */
  inferenceSharePct: number
  /** The month with the most students on it — the platform at its busiest. */
  bestMonth: MonthlyCost | null
  /** The most recent month in the export. */
  latestMonth: MonthlyCost | null
  revenuePerStudentUsd: number
  /** Active students needed to cover the latest month's bill at full price. */
  breakEvenStudents: number
}

function n(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number, dp = 2): number {
  const f = 10 ** dp
  return Math.round(value * f) / f
}

/**
 * Students on the platform each month.
 *
 * Counts anyone with recorded activity, not only those who sat a paper: a
 * student who spent the month revising still had to be served, and costing the
 * platform against the smaller number would overstate what each one costs.
 * Falls back to paper-sitters for months predating the activity ledger.
 */
async function loadMonthlyActive(database: Database): Promise<Map<string, number>> {
  const { rows } = await database.query(`
    WITH activity AS (
      SELECT to_char(activity_date, 'YYYY-MM') AS month, COUNT(DISTINCT user_id) AS students
        FROM user_activity_daily WHERE seconds_active > 0 GROUP BY 1
    ),
    papers AS (
      SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(DISTINCT user_id) AS students
        FROM results WHERE submission_reason IS DISTINCT FROM 'violation' GROUP BY 1
    )
    SELECT COALESCE(a.month, p.month)                       AS month,
           GREATEST(COALESCE(a.students, 0), COALESCE(p.students, 0)) AS students
      FROM activity a
      FULL OUTER JOIN papers p ON p.month = a.month
  `)
  const out = new Map<string, number>()
  for (const r of rows as Record<string, unknown>[]) {
    out.set(String(r.month), n(r.students))
  }
  return out
}

export async function loadCostMetrics(database: Database = defaultDb): Promise<CostMetrics> {
  const active = await loadMonthlyActive(database)

  const months: MonthlyCost[] = AWS_MONTHS.map((m) => {
    const buckets = bucketsForMonth(m)
    const costToServe = buckets.serving + buckets.inference
    const students = active.get(m.month) ?? 0
    const revenue = students * REVENUE_PER_STUDENT_USD
    return {
      month: m.month,
      totalUsd: round(m.total),
      servingUsd: round(buckets.serving),
      inferenceUsd: round(buckets.inference),
      developmentUsd: round(buckets.development),
      costToServeUsd: round(costToServe),
      activeStudents: students,
      costPerStudentUsd: students > 0 ? round(costToServe / students, 3) : null,
      revenueUsd: round(revenue),
      // Negative when the bill outruns the subscriptions, and reported as such.
      // A month with nobody on it has no margin, not a margin of zero.
      marginPct: revenue > 0 ? round(((revenue - costToServe) / revenue) * 100, 1) : null,
    }
  })

  const services = serviceTotals()
  const totalUsd = services.reduce((a, s) => a + s.usd, 0)
  const sumBucket = (bucket: CostBucket) =>
    services.filter((s) => s.bucket === bucket).reduce((a, s) => a + s.usd, 0)

  const serving = sumBucket('serving')
  const inference = sumBucket('inference')
  const development = sumBucket('development')

  const withStudents = months.filter((m) => m.activeStudents > 0)
  const bestMonth =
    withStudents.length > 0
      ? withStudents.reduce((best, m) => (m.activeStudents > best.activeStudents ? m : best))
      : null
  const latestMonth = months.length > 0 ? months[months.length - 1] : null

  return {
    source: AWS_COST_SOURCE,
    months,
    services: services.map((s) => ({ ...s, sharePct: round((s.usd / totalUsd) * 100, 1) })),
    totalUsd: round(totalUsd),
    servingUsd: round(serving),
    inferenceUsd: round(inference),
    developmentUsd: round(development),
    inferenceSharePct: round((inference / totalUsd) * 100, 1),
    bestMonth,
    latestMonth,
    revenuePerStudentUsd: REVENUE_PER_STUDENT_USD,
    breakEvenStudents: latestMonth
      ? Math.ceil(latestMonth.costToServeUsd / REVENUE_PER_STUDENT_USD)
      : 0,
  }
}
