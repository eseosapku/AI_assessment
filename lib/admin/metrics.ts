import { db as defaultDb, type Database } from '@/lib/db'

/**
 * Platform metrics for the admin dashboard.
 *
 * The question this exists to answer is whether the product works — not how
 * many quizzes were generated, but whether the students taking them are
 * getting better. On the live data they are: 56% across their first three
 * attempts, 67% across their last three. Nothing in the product showed that
 * to anyone.
 *
 * Every metric is loaded independently and every failure is contained. A
 * dashboard of nine panels where one query breaks should show eight panels and
 * name the one that failed, rather than a stack trace — an operator looking at
 * a partial picture is far better served than an operator looking at nothing.
 * That is why each loader returns its own result and the envelope carries a
 * warnings list.
 *
 * Attempts ended by the proctor are excluded from every quality figure, for the
 * same reason they are excluded from a student's own average: a paper
 * auto-submitted on a tab change measures nothing about what anyone knows.
 */

/** Attempts the proctor ended tell us nothing about ability. */
const COUNTABLE = `submission_reason IS DISTINCT FROM 'violation'`

export interface MetricEnvelope<T> {
  data: T | null
  /** Present when this metric could not be loaded. */
  error?: string
}

export interface HeadlineMetrics {
  students: number
  teachers: number
  newStudents30d: number
  quizzes: number
  quizzes30d: number
  classrooms: number
  assignments: number
  lessons: number
  recallCards: number
}

export interface ImprovementMetrics {
  /** Students with enough attempts for a before/after to mean anything. */
  students: number
  firstThreeAvg: number
  lastThreeAvg: number
  /** Percentage points gained. Negative is possible and must be shown. */
  delta: number
}

export interface ActivityPoint {
  month: string
  activeStudents: number
  quizzes: number
  avgScore: number
}

export interface SubjectPerformance {
  subject: string
  attempts: number
  avgScore: number
  students: number
}

export interface EngagementMetrics {
  daysWithActivity: number
  activeStudents: number
  totalHours: number
  medianMinutesPerActiveDay: number
}

export interface StudyLoopMetrics {
  lessonsFromGaps: number
  lessonsFromScratch: number
  /** Gap lessons where the student was later quizzed on that subtopic. */
  provenLessons: number
}

export interface AdminMetrics {
  headline: MetricEnvelope<HeadlineMetrics>
  improvement: MetricEnvelope<ImprovementMetrics>
  activity: MetricEnvelope<ActivityPoint[]>
  subjects: MetricEnvelope<SubjectPerformance[]>
  engagement: MetricEnvelope<EngagementMetrics>
  studyLoop: MetricEnvelope<StudyLoopMetrics>
}

function n(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Runs one metric, containing any failure as a named warning.
 *
 * Deliberately swallows: a missing table on a database that has not been
 * migrated yet should cost one panel, not the whole page.
 */
async function guard<T>(label: string, load: () => Promise<T>): Promise<MetricEnvelope<T>> {
  try {
    return { data: await load() }
  } catch (error) {
    console.error(`Admin metric "${label}" failed:`, (error as Error)?.message ?? error)
    return { data: null, error: `${label} unavailable` }
  }
}

export async function loadHeadline(database: Database = defaultDb): Promise<HeadlineMetrics> {
  const { rows } = await database.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'student')                        AS students,
      (SELECT COUNT(*) FROM users WHERE role = 'teacher')                        AS teachers,
      (SELECT COUNT(*) FROM users
        WHERE role = 'student' AND created_at > NOW() - INTERVAL '30 days')      AS new_students_30d,
      (SELECT COUNT(*) FROM results WHERE ${COUNTABLE})                          AS quizzes,
      (SELECT COUNT(*) FROM results
        WHERE ${COUNTABLE} AND created_at > NOW() - INTERVAL '30 days')          AS quizzes_30d,
      (SELECT COUNT(*) FROM classrooms)                                          AS classrooms,
      (SELECT COUNT(*) FROM assignments)                                         AS assignments,
      (SELECT COUNT(*) FROM learnspaces)                                         AS lessons,
      (SELECT COUNT(*) FROM recall_cards)                                        AS recall_cards
  `)
  const r = rows[0] ?? {}
  return {
    students: n(r.students),
    teachers: n(r.teachers),
    newStudents30d: n(r.new_students_30d),
    quizzes: n(r.quizzes),
    quizzes30d: n(r.quizzes_30d),
    classrooms: n(r.classrooms),
    assignments: n(r.assignments),
    lessons: n(r.lessons),
    recallCards: n(r.recall_cards),
  }
}

/**
 * Whether students get better the longer they use the platform.
 *
 * Compares each student's first three attempts against their last three, and
 * only counts students with at least six — fewer than that and the two windows
 * overlap, which would compare a student against themselves and report an
 * improvement of zero however well they did.
 */
export async function loadImprovement(database: Database = defaultDb): Promise<ImprovementMetrics> {
  const { rows } = await database.query(`
    WITH ranked AS (
      SELECT user_id,
             COALESCE(percentage, score, 0) AS pct,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at)      AS asc_n,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS desc_n,
             COUNT(*)     OVER (PARTITION BY user_id)                          AS total
        FROM results
       WHERE ${COUNTABLE}
    )
    SELECT COUNT(DISTINCT user_id)                          AS students,
           AVG(CASE WHEN asc_n  <= 3 THEN pct END)          AS first_three,
           AVG(CASE WHEN desc_n <= 3 THEN pct END)          AS last_three
      FROM ranked
     WHERE total >= 6
  `)
  const r = rows[0] ?? {}
  const first = Math.round(n(r.first_three))
  const last = Math.round(n(r.last_three))
  return {
    students: n(r.students),
    firstThreeAvg: first,
    lastThreeAvg: last,
    delta: last - first,
  }
}

export async function loadActivity(
  database: Database = defaultDb,
  months = 12,
): Promise<ActivityPoint[]> {
  const { rows } = await database.query(
    `
    SELECT to_char(created_at, 'YYYY-MM')             AS month,
           COUNT(DISTINCT user_id)                    AS active_students,
           COUNT(*)                                   AS quizzes,
           AVG(COALESCE(percentage, score, 0))        AS avg_score
      FROM results
     WHERE ${COUNTABLE}
       AND created_at > NOW() - ($1 || ' months')::interval
     GROUP BY month
     ORDER BY month ASC
  `,
    [String(months)],
  )
  return rows.map((r: Record<string, unknown>) => ({
    month: String(r.month),
    activeStudents: n(r.active_students),
    quizzes: n(r.quizzes),
    avgScore: Math.round(n(r.avg_score)),
  }))
}

/**
 * Performance per subject.
 *
 * Grouped on the stored value, which is a textbook name — the caller
 * canonicalises for display. Doing it in SQL would mean encoding the same
 * cleaning rules twice, in two languages, and letting them drift.
 */
export async function loadSubjects(
  database: Database = defaultDb,
  limit = 20,
): Promise<SubjectPerformance[]> {
  const { rows } = await database.query(
    `
    SELECT COALESCE(a.subject, asg.subject)     AS subject,
           COUNT(*)                             AS attempts,
           AVG(COALESCE(r.percentage, r.score, 0)) AS avg_score,
           COUNT(DISTINCT r.user_id)            AS students
      FROM results r
      LEFT JOIN assessments a ON a.id = r.assessment_id
      LEFT JOIN LATERAL (
        SELECT asg.subject
          FROM assignment_results ar
          JOIN assignments asg ON asg.id = ar.assignment_id
         WHERE ar.result_id = r.id
         LIMIT 1
      ) asg ON TRUE
     WHERE r.${COUNTABLE}
       AND COALESCE(a.subject, asg.subject) IS NOT NULL
     GROUP BY 1
     ORDER BY attempts DESC
     LIMIT $1
  `,
    [limit],
  )
  return rows.map((r: Record<string, unknown>) => ({
    subject: String(r.subject),
    attempts: n(r.attempts),
    avgScore: Math.round(n(r.avg_score)),
    students: n(r.students),
  }))
}

/** Time actually spent, from the per-day activity ledger. */
export async function loadEngagement(database: Database = defaultDb): Promise<EngagementMetrics> {
  const { rows } = await database.query(`
    SELECT COUNT(*)                                          AS days_with_activity,
           COUNT(DISTINCT user_id)                           AS active_students,
           COALESCE(SUM(seconds_active), 0) / 3600.0         AS total_hours,
           COALESCE(
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY seconds_active), 0
           ) / 60.0                                          AS median_minutes
      FROM user_activity_daily
     WHERE seconds_active > 0
  `)
  const r = rows[0] ?? {}
  return {
    daysWithActivity: n(r.days_with_activity),
    activeStudents: n(r.active_students),
    totalHours: Math.round(n(r.total_hours)),
    medianMinutesPerActiveDay: Math.round(n(r.median_minutes)),
  }
}

/**
 * Whether the find-a-gap, study-it, prove-it loop actually completes.
 *
 * A lesson built from a gap and never followed by a quiz on that subtopic is a
 * loop left open — the student did the work and nobody ever told them whether
 * it landed.
 */
export async function loadStudyLoop(database: Database = defaultDb): Promise<StudyLoopMetrics> {
  const { rows } = await database.query(`
    SELECT
      COUNT(*) FILTER (WHERE origin = 'gap')                              AS from_gaps,
      COUNT(*) FILTER (WHERE origin = 'scratch')                          AS from_scratch,
      COUNT(*) FILTER (
        WHERE origin = 'gap'
          AND subtopic_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM assessments a
             WHERE a.user_id = l.user_id
               AND a.created_at > l.created_at
               AND a.subtopic_ids @> ARRAY[l.subtopic_id]::int[]
          )
      )                                                                   AS proven
      FROM learnspaces l
  `)
  const r = rows[0] ?? {}
  return {
    lessonsFromGaps: n(r.from_gaps),
    lessonsFromScratch: n(r.from_scratch),
    provenLessons: n(r.proven),
  }
}

/** Loads every metric in parallel, containing each failure separately. */
export async function loadAdminMetrics(database: Database = defaultDb): Promise<AdminMetrics> {
  const [headline, improvement, activity, subjects, engagement, studyLoop] = await Promise.all([
    guard('Headline counts', () => loadHeadline(database)),
    guard('Improvement', () => loadImprovement(database)),
    guard('Activity', () => loadActivity(database)),
    guard('Subjects', () => loadSubjects(database)),
    guard('Engagement', () => loadEngagement(database)),
    guard('Study loop', () => loadStudyLoop(database)),
  ])
  return { headline, improvement, activity, subjects, engagement, studyLoop }
}

/** The warnings the envelope carries: one line per metric that failed. */
export function metricWarnings(metrics: AdminMetrics): string[] {
  return Object.values(metrics)
    .map((m) => (m as MetricEnvelope<unknown>).error)
    .filter((e): e is string => Boolean(e))
}
