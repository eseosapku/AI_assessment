import { db as defaultDb, type Database } from '@/lib/db'
import { curriculumShortLabel } from '@/lib/curriculum-registry'

/**
 * The metrics that say whether the platform is working as a business, rather
 * than whether the gap engine is working as a feature.
 *
 * The three headline figures answer "does the product help?". These answer the
 * questions that come next and are usually harder to hear: do students come
 * back, does work set by a teacher ever come in, and is anything we built
 * actually being used.
 *
 * Each loader is independent and every failure is contained by the caller, so
 * one broken query costs one panel rather than the page.
 */

const COUNTABLE = `submission_reason IS DISTINCT FROM 'violation'`

function n(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0
}

export interface FunnelStage {
  key: string
  label: string
  /** What reaching this stage means, in the reader's terms. */
  meaning: string
  count: number
  /** Share of the stage above, which is where a leak actually shows. */
  ofPrevious: number
}

/**
 * Registered, activated, returned, habitual.
 *
 * Each stage is measured against the one above it rather than against the
 * total, because a funnel quoted against the top makes every later stage look
 * equally bad and hides which step is the one losing people.
 */
export async function loadFunnel(database: Database = defaultDb): Promise<FunnelStage[]> {
  const { rows } = await database.query(`
    WITH per AS (
      SELECT u.id, COUNT(r.id) AS papers
        FROM users u
        LEFT JOIN results r ON r.user_id = u.id AND r.${COUNTABLE}
       WHERE u.role = 'student'
       GROUP BY 1
    )
    SELECT COUNT(*)                                AS registered,
           COUNT(*) FILTER (WHERE papers >= 1)     AS activated,
           COUNT(*) FILTER (WHERE papers >= 2)     AS returned,
           COUNT(*) FILTER (WHERE papers >= 6)     AS habitual
      FROM per
  `)
  const r = rows[0] ?? {}
  const stages: Omit<FunnelStage, 'ofPrevious'>[] = [
    { key: 'registered', label: 'Registered', meaning: 'Made an account', count: n(r.registered) },
    { key: 'activated', label: 'Sat a paper', meaning: 'Got as far as being marked once', count: n(r.activated) },
    { key: 'returned', label: 'Came back', meaning: 'Sat a second paper', count: n(r.returned) },
    { key: 'habitual', label: 'Stuck with it', meaning: 'Six or more papers — enough to measure improvement', count: n(r.habitual) },
  ]
  return stages.map((s, i) => ({
    ...s,
    ofPrevious: i === 0 ? 100 : pct(s.count, stages[i - 1].count),
  }))
}

export interface RetentionCohort {
  cohort: string
  students: number
  returned: number
  returnRate: number
  /** Whether this cohort has had a fair chance to come back yet. */
  mature: boolean
}

/**
 * Return rate by the month a student first sat a paper.
 *
 * The newest cohorts are marked immature rather than dropped. A student who
 * joined three weeks ago has had far less opportunity to sit a second paper
 * than one who joined in March, and reading their low rate as a decline is the
 * standard way to misread this chart.
 */
export async function loadRetentionCohorts(
  database: Database = defaultDb,
  months = 12,
): Promise<RetentionCohort[]> {
  const { rows } = await database.query(
    `
    WITH first_paper AS (
      SELECT user_id, MIN(created_at) AS first_at, COUNT(*) AS papers
        FROM results WHERE ${COUNTABLE} GROUP BY 1
    )
    SELECT to_char(first_at, 'YYYY-MM')                  AS cohort,
           COUNT(*)                                       AS students,
           COUNT(*) FILTER (WHERE papers >= 2)            AS returned,
           MIN(first_at) > NOW() - INTERVAL '45 days'     AS immature
      FROM first_paper
     WHERE first_at > NOW() - ($1 || ' months')::interval
     GROUP BY 1 ORDER BY 1 ASC
  `,
    [String(months)],
  )
  return rows.map((r: Record<string, unknown>) => ({
    cohort: String(r.cohort),
    students: n(r.students),
    returned: n(r.returned),
    returnRate: pct(n(r.returned), n(r.students)),
    mature: !r.immature,
  }))
}

export interface AssignmentHealth {
  set: number
  completed: number
  started: number
  neverOpened: number
  completionRate: number
  teachersSetting: number
  /** Median hours between a paper being set and being handed in. */
  medianHoursToComplete: number | null
}

/**
 * What happens to work a teacher sets.
 *
 * The single most operationally useful number on the platform: a teacher who
 * sets work that never comes back stops setting work. Counted per student per
 * assignment, since one assignment set to thirty students is thirty pieces of
 * work that either arrive or do not.
 */
export async function loadAssignmentHealth(database: Database = defaultDb): Promise<AssignmentHealth> {
  const { rows } = await database.query(`
    SELECT COUNT(*)                                            AS set,
           COUNT(*) FILTER (WHERE ar.status = 'completed')     AS completed,
           COUNT(*) FILTER (WHERE ar.status = 'started')       AS started,
           COUNT(*) FILTER (WHERE ar.status = 'pending')       AS never_opened,
           COUNT(DISTINCT a.teacher_id)                        AS teachers,
           PERCENTILE_CONT(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (ar.completed_at - ar.created_at)) / 3600.0
           ) FILTER (WHERE ar.completed_at IS NOT NULL)         AS median_hours
      FROM assignment_results ar
      LEFT JOIN assignments a ON a.id = ar.assignment_id
  `)
  const r = rows[0] ?? {}
  const set = n(r.set)
  const completed = n(r.completed)
  const median = r.median_hours === null || r.median_hours === undefined ? null : n(r.median_hours)
  return {
    set,
    completed,
    started: n(r.started),
    neverOpened: n(r.never_opened),
    completionRate: pct(completed, set),
    teachersSetting: n(r.teachers),
    medianHoursToComplete: median === null ? null : Math.round(median * 10) / 10,
  }
}

export interface TutorEngagement {
  lessons: number
  lessonsWithChat: number
  messages: number
  medianMessagesPerLesson: number
  /** Share of lessons the student actually spoke to rather than just read. */
  conversationRate: number
}

/**
 * Whether the tutor is used as a tutor or just as a page.
 *
 * A generated lesson that is read and closed is a document. One with a
 * conversation attached is the thing the product claims to be, so the split
 * between the two is worth watching on its own.
 */
export async function loadTutorEngagement(database: Database = defaultDb): Promise<TutorEngagement> {
  const { rows } = await database.query(`
    WITH per_lesson AS (
      SELECT learnspace_id, COUNT(*) AS messages
        FROM learnspace_messages GROUP BY 1
    )
    SELECT (SELECT COUNT(*) FROM learnspaces)              AS lessons,
           COUNT(*)                                        AS lessons_with_chat,
           COALESCE(SUM(messages), 0)                      AS messages,
           COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY messages), 0) AS median_messages
      FROM per_lesson
  `)
  const r = rows[0] ?? {}
  const lessons = n(r.lessons)
  const withChat = n(r.lessons_with_chat)
  return {
    lessons,
    lessonsWithChat: withChat,
    messages: n(r.messages),
    medianMessagesPerLesson: Math.round(n(r.median_messages)),
    conversationRate: pct(withChat, lessons),
  }
}

export interface CurriculumUsage {
  curriculum: string
  assessments: number
  papers: number
  avgScore: number | null
}

/** Which curricula are actually being taught on, as opposed to merely loaded. */
export async function loadCurriculumMix(database: Database = defaultDb): Promise<CurriculumUsage[]> {
  const { rows } = await database.query(`
    SELECT t.curriculum                                   AS curriculum,
           COUNT(DISTINCT a.id)                           AS assessments,
           COUNT(r.id)                                    AS papers,
           AVG(COALESCE(r.percentage, r.score))           AS avg_score
      FROM assessments a
      JOIN textbooks t ON t.textbook_id = a.textbook_id
      LEFT JOIN results r ON r.assessment_id = a.id AND r.${COUNTABLE}
     GROUP BY 1 ORDER BY papers DESC, assessments DESC
  `)
  return rows.map((r: Record<string, unknown>) => ({
    curriculum: curriculumShortLabel(r.curriculum === null ? null : Number(r.curriculum)),
    assessments: n(r.assessments),
    papers: n(r.papers),
    avgScore: r.avg_score === null || r.avg_score === undefined ? null : Math.round(n(r.avg_score)),
  }))
}

export interface RecallHealth {
  cards: number
  decks: number
  students: number
  reviewed: number
  dueNow: number
  /** Cards that have been through at least one review, as a share of all. */
  reviewRate: number
}

/**
 * Whether the spaced-repetition deck is a deck or a graveyard.
 *
 * A card that was created and never reviewed cost a generation and returned
 * nothing, so the review rate is the number that decides whether this feature
 * earns its keep.
 */
export async function loadRecallHealth(database: Database = defaultDb): Promise<RecallHealth> {
  const { rows } = await database.query(`
    SELECT COUNT(*)                                              AS cards,
           COUNT(DISTINCT deck_id)                               AS decks,
           COUNT(DISTINCT user_id)                               AS students,
           COUNT(*) FILTER (WHERE last_reviewed_at IS NOT NULL)  AS reviewed,
           COUNT(*) FILTER (WHERE due_at <= NOW())               AS due_now
      FROM recall_cards
  `)
  const r = rows[0] ?? {}
  const cards = n(r.cards)
  const reviewed = n(r.reviewed)
  return {
    cards,
    decks: n(r.decks),
    students: n(r.students),
    reviewed,
    dueNow: n(r.due_now),
    reviewRate: pct(reviewed, cards),
  }
}

export interface CollectionPoint {
  key: string
  label: string
  /** What is being captured now, in plain terms. */
  status: string
  /** Rows, papers, or events captured — 0 means nothing is arriving. */
  captured: number
  /** How much there could be, where a denominator exists. */
  possible: number | null
  /** Why this is worth wiring up. */
  worth: string
  state: 'live' | 'partial' | 'silent'
}

/**
 * What the platform is not measuring yet.
 *
 * A dashboard that only reports what happens to be instrumented quietly
 * confuses "this is not happening" with "we are not watching". These are the
 * places where a number is missing because nothing writes it, and each one is
 * a decision waiting on evidence that is not being collected.
 */
export async function loadCollectionPoints(database: Database = defaultDb): Promise<CollectionPoint[]> {
  const { rows } = await database.query(`
    SELECT
      (SELECT COUNT(*) FROM assessments)                                          AS assessments,
      (SELECT COUNT(*) FROM assessments WHERE array_length(subtopic_ids, 1) > 0)  AS tagged,
      (SELECT COUNT(*) FROM ai_usage_events)                                      AS usage_events,
      (SELECT COUNT(*) FROM question_reports)                                     AS question_reports,
      (SELECT COUNT(*) FROM ai_jobs)                                              AS jobs,
      (SELECT COUNT(*) FROM ai_jobs WHERE status = 'failed')                      AS jobs_failed,
      (SELECT COUNT(*) FROM results)                                              AS results,
      (SELECT COUNT(*) FROM user_sessions)                                        AS sessions
  `)
  const r = rows[0] ?? {}
  const assessments = n(r.assessments)
  const jobs = n(r.jobs)

  const point = (
    key: string,
    label: string,
    captured: number,
    possible: number | null,
    status: string,
    worth: string,
  ): CollectionPoint => ({
    key,
    label,
    captured,
    possible,
    status,
    worth,
    state: captured === 0 ? 'silent' : possible !== null && captured < possible * 0.9 ? 'partial' : 'live',
  })

  return [
    point(
      'tagging',
      'Subtopic tags on papers',
      n(r.tagged),
      assessments,
      `${n(r.tagged).toLocaleString()} of ${assessments.toLocaleString()} papers`,
      'The ceiling on gap detection. An untagged paper is marked, returned, and then invisible to the engine forever.',
    ),
    point(
      'cost',
      'AI spend per generation',
      n(r.usage_events),
      null,
      'Nothing is being written',
      'Without it there is no cost per student, no margin, and no way to separate what development burns from what teaching does.',
    ),
    point(
      'quality',
      'Reported questions',
      n(r.question_reports),
      null,
      'Table exists, nothing arrives',
      'The only direct signal on whether generated questions are any good. Right now a bad question is invisible unless someone emails.',
    ),
    point(
      'reliability',
      'Generation success rate',
      jobs,
      null,
      jobs > 0 ? `${n(r.jobs_failed)} of ${jobs} jobs failed` : 'No jobs recorded',
      'Too few jobs recorded to trust the rate. Every generation should land here, not just the async ones.',
    ),
    point(
      'sessions',
      'Sign-in sessions',
      n(r.sessions),
      null,
      `${n(r.sessions)} recorded`,
      'Login does not open a session, so there is no way to see concurrent use, session length, or revoke access.',
    ),
    point(
      'dropout',
      'Abandoned papers',
      0,
      n(r.results),
      'Not captured',
      'A paper started and never submitted leaves no trace, so the difference between "too hard" and "lost interest" cannot be told apart.',
    ),
  ]
}
