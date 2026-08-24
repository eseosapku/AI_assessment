import { db as defaultDb, type Database } from '@/lib/db'

/**
 * What inference costs, and how much of the subscription it takes.
 *
 * Deliberately narrow. This reports the one cost the database can actually
 * account for — model calls — and nothing else. An earlier version carried a
 * hand-entered infrastructure figure so it could quote a gross margin, but that
 * number was invented rather than measured, and it was the number the margin
 * turned on. A margin resting on a guess is worth less than a smaller claim
 * that holds, so the guess is gone and the claim is narrower.
 *
 * What that leaves is still worth stating: model calls are a rounding error
 * against a $5 subscription. All generation to date comes to about three
 * dollars. Whatever the true cost of running this platform turns out to be, it
 * is not inference — which is the useful finding, and it is one the operation
 * counts genuinely support.
 *
 * What this is NOT is a profit margin. Hosting, database, storage, egress,
 * payment fees and everything else are absent because none of them are in this
 * database. They appear instead in the collection points panel, as things
 * nothing is currently measuring.
 *
 * `ai_usage_events` is the intended source and it is empty until the newly
 * instrumented call sites have run, so figures are estimated from operation
 * counts until then and switch to measured on their own. `basis` says which.
 */

export type CostBasis = 'measured' | 'estimated'

/**
 * Bedrock rates, USD per million tokens.
 *
 * List prices, and worth checking against an invoice: regional pricing differs,
 * and the Gemma models are served through Bedrock Marketplace rather than as
 * first-party models, so their rates move independently of Amazon's own.
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
 * conversation and returns a paragraph. The ledger replaces these with measured
 * averages once it has run; that is precisely what it is for.
 */
export const OPERATION_PROFILES: OperationProfile[] = [
  { key: 'generate_assessment', label: 'Paper generated', model: 'amazon.nova-lite-v1:0', inputTokens: 3000, outputTokens: 2500, bucket: 'teaching' },
  { key: 'generate_feedback', label: 'Paper marked with feedback', model: 'amazon.nova-lite-v1:0', inputTokens: 2000, outputTokens: 800, bucket: 'teaching' },
  { key: 'build_lesson', label: 'Lesson built', model: 'google.gemma-3-27b-it', inputTokens: 2500, outputTokens: 4000, bucket: 'teaching' },
  { key: 'tutor_reply', label: 'Tutor reply', model: 'google.gemma-3-27b-it', inputTokens: 4000, outputTokens: 700, bucket: 'teaching' },
  { key: 'recall_card', label: 'Recall card', model: 'amazon.nova-lite-v1:0', inputTokens: 1500, outputTokens: 1200, bucket: 'teaching' },
]

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
  /** Spend attributable to teaching students, as opposed to development. */
  aiTeachingUsd: number
  aiDevelopmentUsd: number
  /** Inference per month, averaged over the period the platform has run. */
  aiMonthlyUsd: number
  activeStudents: number
  /** Inference to serve one student for one month. */
  aiPerStudentMonthUsd: number
  /** Inference per paper generated — the unit that scales with usage. */
  aiPerPaperUsd: number
  revenuePerStudentUsd: number
  /** Inference as a percentage of the subscription. Not a cost ratio. */
  inferenceShareOfRevenuePct: number
  /** Subscription left after inference. Before every other cost, none of which is measured. */
  revenueAfterInferenceUsd: number
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
      (SELECT COUNT(*) FROM assessments)                                   AS generate_assessment,
      (SELECT COUNT(*) FROM results)                                       AS generate_feedback,
      (SELECT COUNT(*) FROM learnspaces)                                   AS build_lesson,
      (SELECT COUNT(*) FROM learnspace_messages WHERE role = 'assistant')  AS tutor_reply,
      (SELECT COUNT(*) FROM recall_cards)                                  AS recall_card,
      (SELECT COUNT(DISTINCT user_id) FROM results)                        AS active_students
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
      key: `${String(r.feature)}:${String(r.environment)}`,
      label: String(r.feature).replace(/_/g, ' '),
      model: MODEL_RATES[model]?.label ?? model,
      calls,
      totalUsd: round(total, 4),
      perCallUsd: calls > 0 ? round(total / calls, 6) : 0,
      // Anything outside production is development overhead: vision passes,
      // benchmarks and local experiments are not costs of teaching anyone.
      bucket: String(r.environment) === 'production' ? 'teaching' : 'development',
    }
  })
}

/**
 * Inference cost, and its share of the subscription.
 *
 * `activeStudents` costs the same arithmetic against a different cohort, which
 * is how the scaled view stays consistent with the rest of the page: call
 * volumes move with the student body, so the per-student figure barely shifts.
 * Inference is very nearly a pure variable cost, and this reports it as one.
 */
export async function loadCostMetrics(
  database: Database = defaultDb,
  options: { activeStudents?: number } = {},
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
  const activeStudents = options.activeStudents ?? counts.activeStudents
  const papers = Math.round(counts.generate_assessment * scaleFactor)

  const aiMonthly = aiTotal / MONTHS_RUNNING
  const perStudentMonth = activeStudents > 0 ? aiMonthly / activeStudents : 0

  return {
    basis,
    lines: lines.sort((a, b) => b.totalUsd - a.totalUsd),
    aiTotalUsd: round(aiTotal, 2),
    aiTeachingUsd: round(aiTeaching, 2),
    aiDevelopmentUsd: round(aiTotal - aiTeaching, 2),
    aiMonthlyUsd: round(aiMonthly, 2),
    activeStudents,
    aiPerStudentMonthUsd: round(perStudentMonth, 4),
    aiPerPaperUsd: papers > 0 ? round(aiTotal / papers, 5) : 0,
    revenuePerStudentUsd: REVENUE_PER_STUDENT_USD,
    inferenceShareOfRevenuePct:
      REVENUE_PER_STUDENT_USD > 0 ? round((perStudentMonth / REVENUE_PER_STUDENT_USD) * 100, 3) : 0,
    revenueAfterInferenceUsd: round(REVENUE_PER_STUDENT_USD - perStudentMonth, 3),
  }
}
