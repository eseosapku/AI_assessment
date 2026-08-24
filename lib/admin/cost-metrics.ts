import { db as defaultDb, type Database } from '@/lib/db'

/**
 * What the platform costs to run, and what that leaves.
 *
 * `ai_usage_events` is the intended source and it is empty, because nothing
 * writes to it yet. So this computes an estimate instead — real operation
 * counts from the database, multiplied by per-call token profiles and per-model
 * rates — and switches to measured figures on its own as soon as events start
 * arriving. Which of the two produced the number is returned in `basis`, since
 * the difference matters to anyone acting on it.
 *
 * The finding worth stating up front: on these models inference is not the
 * cost. Nova Lite is cheap enough that a student's entire year of generated
 * papers costs a fraction of a cent, and the real monthly bill is the database
 * and the hosting, which barely move with headcount. That is why the margin
 * widens with scale rather than narrowing — the expensive part is already paid
 * for at 431 students and does not need paying again at 6,000.
 *
 * Everything below is a stated assumption in one place, so it can be corrected
 * against a real AWS bill without hunting through the code.
 */

export type CostBasis = 'measured' | 'estimated'

/**
 * Bedrock rates, USD per million tokens.
 *
 * These are list prices and should be checked against an actual invoice before
 * anyone quotes a margin from them — regional pricing differs, and the Gemma
 * models are served through Bedrock Marketplace rather than as first-party
 * models, so their rates move independently of Amazon's own.
 */
export const MODEL_RATES: Record<string, { input: number; output: number; label: string }> = {
  'amazon.nova-micro-v1:0': { input: 0.035, output: 0.14, label: 'Nova Micro' },
  'amazon.nova-lite-v1:0': { input: 0.06, output: 0.24, label: 'Nova Lite' },
  'amazon.nova-pro-v1:0': { input: 0.8, output: 3.2, label: 'Nova Pro' },
  'google.gemma-3-12b-it': { input: 0.1, output: 0.2, label: 'Gemma 3 12B' },
  'google.gemma-3-27b-it': { input: 0.2, output: 0.4, label: 'Gemma 3 27B' },
}

const FALLBACK_RATE = { input: 0.06, output: 0.24, label: 'Unknown model' }

export interface OperationProfile {
  key: string
  label: string
  model: string
  /** Typical tokens in and out for one call of this kind. */
  inputTokens: number
  outputTokens: number
  /** Whether this is student-facing spend or development overhead. */
  bucket: 'teaching' | 'development'
}

/**
 * What one call of each kind costs in tokens.
 *
 * Estimated from the shape of each prompt — a generation carries curriculum
 * context and returns structured questions; a tutor reply carries the whole
 * conversation and returns a paragraph. Replace these with measured averages
 * once the ledger has run for a week; that is precisely what it is for.
 */
export const OPERATION_PROFILES: OperationProfile[] = [
  { key: 'generate_assessment', label: 'Paper generated', model: 'amazon.nova-lite-v1:0', inputTokens: 3000, outputTokens: 2500, bucket: 'teaching' },
  { key: 'generate_feedback', label: 'Paper marked with feedback', model: 'amazon.nova-lite-v1:0', inputTokens: 2000, outputTokens: 800, bucket: 'teaching' },
  { key: 'build_lesson', label: 'Lesson built', model: 'google.gemma-3-27b-it', inputTokens: 2500, outputTokens: 4000, bucket: 'teaching' },
  { key: 'tutor_reply', label: 'Tutor reply', model: 'google.gemma-3-27b-it', inputTokens: 4000, outputTokens: 700, bucket: 'teaching' },
  { key: 'recall_card', label: 'Recall card', model: 'amazon.nova-lite-v1:0', inputTokens: 1500, outputTokens: 1200, bucket: 'teaching' },
]

/**
 * Fixed monthly infrastructure, USD.
 *
 * The part of the bill that has nothing to do with how many papers were
 * generated: RDS, hosting, storage, egress. It is entered rather than measured
 * because none of it is in this database — correct it from the AWS console.
 *
 * It scales with headcount far more slowly than revenue does, which is the
 * whole reason the margin improves with size.
 */
export const INFRASTRUCTURE = {
  /** What it costs today, at roughly 431 active students. */
  monthlyUsdToday: 300,
  /** What it would cost serving the modelled cohort — bigger database, more hosting. */
  monthlyUsdAtScale: 1200,
}

/** Monthly subscription per student, USD. Mirrors SUBSCRIPTION_USD. */
export const REVENUE_PER_STUDENT_USD = 5

/** Months the platform has been marking papers, for turning lifetime spend into monthly. */
const MONTHS_RUNNING = 7

export interface CostLine {
  key: string
  label: string
  model: string
  calls: number
  /** USD for every call of this kind so far. */
  totalUsd: number
  /** USD for one call, useful for sanity-checking against a bill. */
  perCallUsd: number
  bucket: 'teaching' | 'development'
}

export interface CostMetrics {
  basis: CostBasis
  lines: CostLine[]
  /** Inference spend across every operation, lifetime. */
  aiTotalUsd: number
  /** Inference spend attributable to teaching students, as opposed to development. */
  aiTeachingUsd: number
  aiDevelopmentUsd: number
  /** Inference, per month, averaged over the period the platform has run. */
  aiMonthlyUsd: number
  infrastructureMonthlyUsd: number
  totalMonthlyUsd: number
  activeStudents: number
  /** All-in cost to serve one active student for one month. */
  costPerStudentMonthUsd: number
  /** Inference alone, per student per month — the part that grows with usage. */
  aiPerStudentMonthUsd: number
  revenuePerStudentUsd: number
  /** Revenue minus cost, over revenue. */
  grossMarginPct: number
  /** Subscriptions needed each month to cover the fixed bill. */
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

/** USD for one call, from a profile and its model's rate. */
export function costOfProfile(profile: OperationProfile): number {
  const rate = MODEL_RATES[profile.model] ?? FALLBACK_RATE
  return (profile.inputTokens * rate.input + profile.outputTokens * rate.output) / 1_000_000
}

/** USD for a measured pair of token counts. */
export function costOfTokens(model: string, inputTokens: number, outputTokens: number): number {
  const rate = MODEL_RATES[model] ?? FALLBACK_RATE
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000
}

interface Counts {
  generate_assessment: number
  generate_feedback: number
  build_lesson: number
  tutor_reply: number
  recall_card: number
  activeStudents: number
}

/** How many of each billable operation actually happened. */
async function loadOperationCounts(database: Database): Promise<Counts> {
  const { rows } = await database.query(`
    SELECT
      (SELECT COUNT(*) FROM assessments)                                          AS generate_assessment,
      (SELECT COUNT(*) FROM results)                                              AS generate_feedback,
      (SELECT COUNT(*) FROM learnspaces)                                          AS build_lesson,
      (SELECT COUNT(*) FROM learnspace_messages WHERE role = 'assistant')         AS tutor_reply,
      (SELECT COUNT(*) FROM recall_cards)                                         AS recall_card,
      (SELECT COUNT(DISTINCT user_id) FROM results)                               AS active_students
  `)
  const r = rows[0] ?? {}
  return {
    generate_assessment: n(r.generate_assessment),
    generate_feedback: n(r.generate_feedback),
    build_lesson: n(r.build_lesson),
    tutor_reply: n(r.tutor_reply),
    recall_card: n(r.recall_card),
    activeStudents: n(r.active_students),
  }
}

/** The ledger, once it has anything in it. */
async function loadMeasuredLines(database: Database): Promise<CostLine[] | null> {
  const { rows } = await database.query(`
    SELECT feature, model_id, environment,
           COUNT(*)                            AS calls,
           COALESCE(SUM(input_tokens), 0)      AS input_tokens,
           COALESCE(SUM(output_tokens), 0)     AS output_tokens
      FROM ai_usage_events
     WHERE status = 'succeeded'
     GROUP BY 1, 2, 3
  `)
  if (rows.length === 0) return null

  return rows.map((r: Record<string, unknown>) => {
    const model = String(r.model_id)
    const calls = n(r.calls)
    const total = costOfTokens(model, n(r.input_tokens), n(r.output_tokens))
    return {
      key: String(r.feature),
      label: String(r.feature).replace(/_/g, ' '),
      model: MODEL_RATES[model]?.label ?? model,
      calls,
      totalUsd: round(total, 4),
      perCallUsd: calls > 0 ? round(total / calls, 6) : 0,
      // Anything not running in production is development overhead: vision
      // passes, benchmarks and local experiments are not costs of teaching.
      bucket: String(r.environment) === 'production' ? 'teaching' : 'development',
    }
  })
}

/**
 * Cost and margin.
 *
 * Prefers the ledger and falls back to the estimate, reporting which it used.
 * `atScale` swaps the infrastructure figure and the student count so the same
 * arithmetic can be run against the modelled cohort — the point being that the
 * fixed cost is already paid, so serving fourteen times the students does not
 * cost fourteen times as much.
 */
export async function loadCostMetrics(
  database: Database = defaultDb,
  options: { atScale?: boolean; activeStudents?: number } = {},
): Promise<CostMetrics> {
  const counts = await loadOperationCounts(database)
  const measured = await loadMeasuredLines(database).catch(() => null)

  const scaleFactor =
    options.activeStudents && counts.activeStudents > 0
      ? options.activeStudents / counts.activeStudents
      : 1

  let lines: CostLine[]
  let basis: CostBasis

  if (measured && measured.length > 0) {
    basis = 'measured'
    lines = measured
  } else {
    basis = 'estimated'
    lines = OPERATION_PROFILES.map((p) => {
      const perCall = costOfProfile(p)
      const calls = Math.round((counts[p.key as keyof Counts] as number) * scaleFactor)
      return {
        key: p.key,
        label: p.label,
        model: MODEL_RATES[p.model]?.label ?? p.model,
        calls,
        totalUsd: round(perCall * calls, 4),
        perCallUsd: round(perCall, 6),
        bucket: p.bucket,
      }
    })
  }

  const aiTotal = lines.reduce((a, l) => a + l.totalUsd, 0)
  const aiTeaching = lines.filter((l) => l.bucket === 'teaching').reduce((a, l) => a + l.totalUsd, 0)
  const aiDevelopment = aiTotal - aiTeaching

  const activeStudents = options.activeStudents ?? counts.activeStudents
  const infrastructure = options.atScale
    ? INFRASTRUCTURE.monthlyUsdAtScale
    : INFRASTRUCTURE.monthlyUsdToday

  const aiMonthly = aiTotal / MONTHS_RUNNING
  const totalMonthly = aiMonthly + infrastructure
  const perStudentMonth = activeStudents > 0 ? totalMonthly / activeStudents : 0
  const margin =
    REVENUE_PER_STUDENT_USD > 0
      ? ((REVENUE_PER_STUDENT_USD - perStudentMonth) / REVENUE_PER_STUDENT_USD) * 100
      : 0

  return {
    basis,
    lines: lines.sort((a, b) => b.totalUsd - a.totalUsd),
    aiTotalUsd: round(aiTotal, 2),
    aiTeachingUsd: round(aiTeaching, 2),
    aiDevelopmentUsd: round(aiDevelopment, 2),
    aiMonthlyUsd: round(aiMonthly, 2),
    infrastructureMonthlyUsd: infrastructure,
    totalMonthlyUsd: round(totalMonthly, 2),
    activeStudents,
    costPerStudentMonthUsd: round(perStudentMonth, 3),
    aiPerStudentMonthUsd: activeStudents > 0 ? round(aiMonthly / activeStudents, 4) : 0,
    revenuePerStudentUsd: REVENUE_PER_STUDENT_USD,
    // Can go negative on a small base with a fixed bill, and is reported as
    // such — a margin that cannot be negative is not a margin.
    grossMarginPct: round(margin, 1),
    breakEvenStudents: Math.ceil(infrastructure / REVENUE_PER_STUDENT_USD),
  }
}
