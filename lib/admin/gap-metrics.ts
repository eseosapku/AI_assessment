import { db as defaultDb, type Database } from '@/lib/db'

/**
 * The three numbers the platform is judged on: gaps found, gaps closed, and
 * whether scores went up.
 *
 * Each has to survive the obvious follow-up question, so the method is computed
 * and returned beside the figure rather than written into a caption that can
 * drift away from the query underneath it.
 *
 * A **gap** is one (student x subtopic) pair measured below 50%. It is not a
 * wrong answer — a student who misses four questions on photosynthesis has one
 * gap in photosynthesis, not four — and it is not a low quiz score, which says
 * nothing about which part of the syllabus went wrong. The unit is deliberately
 * the smallest thing a lesson can be built for.
 *
 * A gap is **closed** only by re-measurement: same student, same subtopic, a
 * later paper, 50% or better. Studying it does not close it and neither does
 * time passing. That makes the number harder to move and much harder to argue
 * with.
 *
 * The 50% line is the one the student's own gap map already uses, so the
 * dashboard and the learner never describe the same subtopic in different
 * words.
 */

/** Below this, a subtopic is a gap. Matches the learner-facing gap map exactly. */
export const GAP_THRESHOLD = 50

/** Proctor-ended papers measure nothing about ability, so they are excluded throughout. */
const COUNTABLE = `r.submission_reason IS DISTINCT FROM 'violation'`

export interface GapLifecycle {
  identified: number
  closed: number
  stillOpen: number
  /** closed / identified, as a percentage. */
  closureRate: number
  /** Days between a gap first opening and first clearing. Null until any close. */
  medianDaysToClose: number | null
  studentsWithGaps: number
  subtopicsAffected: number
}

export interface GapMonthPoint {
  month: string
  identified: number
  closed: number
}

/**
 * How much of the syllabus a paper actually names.
 *
 * Gap detection can only see subtopics a paper was tagged with, so this is the
 * ceiling on everything above it. Worth reporting on its own: an untagged paper
 * is marked, returned, and then invisible to the gap engine forever.
 */
export interface TaggingCoverage {
  assessments: number
  tagged: number
  /** tagged / assessments, as a percentage. */
  coverage: number
  /** Gaps found per tagged paper — the rate any forecast has to be built on. */
  gapsPerTaggedPaper: number
}

export interface PerformanceLift {
  students: number
  firstThreeAvg: number
  lastThreeAvg: number
  /** Percentage points. Negative is possible and is reported as such. */
  deltaPoints: number
  /** The same movement relative to where they started. */
  deltaRelative: number
}

function n(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0
}

/**
 * Every (student, subtopic) measurement, from papers that carried subtopic tags.
 *
 * Built from `results` joined to the subtopics its assessment declared, rather
 * than from `topic_mastery`, because mastery holds only a running average and
 * this needs the history: when a pair first went under, and whether anything
 * later brought it back.
 */
const MEASUREMENTS = `
  SELECT r.user_id,
         s AS subtopic_id,
         COALESCE(r.percentage, r.score, 0) AS pct,
         r.created_at
    FROM results r
    JOIN assessments a ON a.id = r.assessment_id
    CROSS JOIN LATERAL unnest(a.subtopic_ids) AS s
   WHERE ${COUNTABLE}
`

/** Gaps with the moment each opened and the moment each first cleared. */
const RESOLVED = `
  WITH m AS (${MEASUREMENTS}),
  opened AS (
    SELECT user_id, subtopic_id,
           MIN(created_at) FILTER (WHERE pct < ${GAP_THRESHOLD}) AS opened_at
      FROM m GROUP BY 1, 2
  ),
  resolved AS (
    SELECT o.user_id, o.subtopic_id, o.opened_at,
           (SELECT MIN(m2.created_at) FROM m m2
             WHERE m2.user_id = o.user_id
               AND m2.subtopic_id = o.subtopic_id
               AND m2.created_at > o.opened_at
               AND m2.pct >= ${GAP_THRESHOLD}) AS closed_at
      FROM opened o WHERE o.opened_at IS NOT NULL
  )
`

export async function loadGapLifecycle(database: Database = defaultDb): Promise<GapLifecycle> {
  const { rows } = await database.query(`
    ${RESOLVED}
    SELECT COUNT(*)                                      AS identified,
           COUNT(*) FILTER (WHERE closed_at IS NOT NULL) AS closed,
           COUNT(DISTINCT user_id)                       AS students,
           COUNT(DISTINCT subtopic_id)                   AS subtopics,
           PERCENTILE_CONT(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (closed_at - opened_at)) / 86400.0
           ) FILTER (WHERE closed_at IS NOT NULL)         AS median_days
      FROM resolved
  `)
  const r = rows[0] ?? {}
  const identified = n(r.identified)
  const closed = n(r.closed)
  const median = r.median_days === null || r.median_days === undefined ? null : n(r.median_days)
  return {
    identified,
    closed,
    stillOpen: Math.max(0, identified - closed),
    closureRate: pct(closed, identified),
    // Kept to three decimals below a day. Live, the median close is 68 minutes
    // — students retaking in the same sitting — and rounding that to one decimal
    // collapses it to "0 days", which reads as never rather than immediately.
    medianDaysToClose:
      median === null ? null : median < 1 ? Math.round(median * 1000) / 1000 : Math.round(median * 10) / 10,
    studentsWithGaps: n(r.students),
    subtopicsAffected: n(r.subtopics),
  }
}

/** Gaps opened and closed per month, so the two curves can be read against each other. */
export async function loadGapTimeline(
  database: Database = defaultDb,
  months = 12,
): Promise<GapMonthPoint[]> {
  const { rows } = await database.query(
    `
    ${RESOLVED},
    months AS (
      SELECT to_char(generate_series(
        date_trunc('month', NOW()) - ($1 || ' months')::interval,
        date_trunc('month', NOW()), '1 month'), 'YYYY-MM') AS month
    )
    SELECT mo.month,
           (SELECT COUNT(*) FROM resolved WHERE to_char(opened_at, 'YYYY-MM') = mo.month) AS identified,
           (SELECT COUNT(*) FROM resolved WHERE to_char(closed_at, 'YYYY-MM') = mo.month) AS closed
      FROM months mo ORDER BY mo.month ASC
  `,
    [String(months)],
  )
  return rows.map((r: Record<string, unknown>) => ({
    month: String(r.month),
    identified: n(r.identified),
    closed: n(r.closed),
  }))
}

/**
 * The ceiling on gap detection.
 *
 * Subtopic tagging began part-way through the platform's life, so every paper
 * marked before it is invisible to the gap engine — the single largest reason
 * the identified count is smaller than the marking volume suggests.
 */
export async function loadTaggingCoverage(database: Database = defaultDb): Promise<TaggingCoverage> {
  const { rows } = await database.query(`
    ${RESOLVED},
    counts AS (
      SELECT COUNT(*) AS assessments,
             COUNT(*) FILTER (WHERE array_length(subtopic_ids, 1) > 0) AS tagged
        FROM assessments
    )
    SELECT c.assessments, c.tagged, (SELECT COUNT(*) FROM resolved) AS identified
      FROM counts c
  `)
  const r = rows[0] ?? {}
  const assessments = n(r.assessments)
  const tagged = n(r.tagged)
  return {
    assessments,
    tagged,
    coverage: pct(tagged, assessments),
    gapsPerTaggedPaper: tagged > 0 ? Math.round((n(r.identified) / tagged) * 100) / 100 : 0,
  }
}

/**
 * Whether scores move.
 *
 * Each student's first three papers against their last three, over students
 * with at least six. Below six the two windows overlap, which compares a
 * student against themselves and reports no movement however much they
 * improved.
 */
export async function loadPerformanceLift(database: Database = defaultDb): Promise<PerformanceLift> {
  const { rows } = await database.query(`
    WITH ranked AS (
      SELECT user_id,
             COALESCE(percentage, score, 0) AS pct,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at)      AS asc_n,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS desc_n,
             COUNT(*)     OVER (PARTITION BY user_id)                          AS total
        FROM results r
       WHERE ${COUNTABLE}
    )
    SELECT COUNT(DISTINCT user_id)             AS students,
           AVG(pct) FILTER (WHERE asc_n  <= 3) AS first_three,
           AVG(pct) FILTER (WHERE desc_n <= 3) AS last_three
      FROM ranked WHERE total >= 6
  `)
  const r = rows[0] ?? {}
  const first = Math.round(n(r.first_three) * 10) / 10
  const last = Math.round(n(r.last_three) * 10) / 10
  return {
    students: n(r.students),
    firstThreeAvg: first,
    lastThreeAvg: last,
    deltaPoints: Math.round((last - first) * 10) / 10,
    deltaRelative: first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0,
  }
}
