import { db as defaultDb, type Database } from '@/lib/db'

/**
 * Evidence that students get better, beyond the single headline figure.
 *
 * One number — first three papers against last three — is easy to wave away as
 * survivorship: the students who stayed were always going to be the stronger
 * ones. These are the cuts that make the claim harder to dismiss. The learning
 * curve shows the shape of the improvement rather than its endpoints, the
 * subject breakdown shows it is not one subject carrying the average, and the
 * mastery mix shows movement at the level the product actually intervenes on.
 *
 * Every one of them is measured, in both modes. Nothing here is modelled.
 */

const COUNTABLE = `submission_reason IS DISTINCT FROM 'violation'`

function n(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export interface CurvePoint {
  /** Which paper this was for the student — 1st, 2nd, 3rd. */
  nth: number
  students: number
  avgScore: number
}

/**
 * Average score by how many papers a student had already sat.
 *
 * Read down the curve rather than at its ends. The first paper scores well and
 * the second dips, which is the usual shape when a first attempt is a gentle
 * one; the climb that matters starts around the fourth. The student count falls
 * away as the curve goes right, so the tail is thinner evidence than the head
 * and the panel says so.
 */
export async function loadLearningCurve(
  database: Database = defaultDb,
  depth = 12,
): Promise<CurvePoint[]> {
  const { rows } = await database.query(
    `
    WITH ranked AS (
      SELECT user_id,
             COALESCE(percentage, score, 0) AS pct,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS nth
        FROM results WHERE ${COUNTABLE}
    )
    SELECT nth, COUNT(*) AS students, AVG(pct) AS avg_score
      FROM ranked WHERE nth <= $1
     GROUP BY 1 ORDER BY 1 ASC
  `,
    [depth],
  )
  return rows.map((r: Record<string, unknown>) => ({
    nth: n(r.nth),
    students: n(r.students),
    avgScore: Math.round(n(r.avg_score) * 10) / 10,
  }))
}

export interface SubjectImprovement {
  subject: string
  students: number
  firstPaper: number
  lastPaper: number
  deltaPoints: number
}

/**
 * First paper against most recent, per subject.
 *
 * Uses first-and-last rather than first-three-and-last-three, because at
 * subject grain almost nobody has six papers in the same subject and the
 * stricter window would empty the table. The subject is returned raw for the
 * caller to canonicalise and merge, since the same subject is stored under
 * several textbook titles.
 */
export async function loadSubjectImprovement(
  database: Database = defaultDb,
  minStudents = 2,
): Promise<SubjectImprovement[]> {
  const { rows } = await database.query(
    `
    WITH s AS (
      SELECT r.user_id,
             a.subject,
             COALESCE(r.percentage, r.score, 0) AS pct,
             ROW_NUMBER() OVER (PARTITION BY r.user_id, a.subject ORDER BY r.created_at)      AS asc_n,
             ROW_NUMBER() OVER (PARTITION BY r.user_id, a.subject ORDER BY r.created_at DESC) AS desc_n,
             COUNT(*)     OVER (PARTITION BY r.user_id, a.subject)                            AS total
        FROM results r
        JOIN assessments a ON a.id = r.assessment_id
       WHERE r.${COUNTABLE} AND a.subject IS NOT NULL
    )
    SELECT subject,
           COUNT(DISTINCT user_id)                  AS students,
           AVG(pct) FILTER (WHERE asc_n = 1)        AS first_paper,
           AVG(pct) FILTER (WHERE desc_n = 1)       AS last_paper
      FROM s
     WHERE total >= 2
     GROUP BY 1
    HAVING COUNT(DISTINCT user_id) >= $1
     ORDER BY students DESC
  `,
    [minStudents],
  )
  return rows.map((r: Record<string, unknown>) => {
    const first = Math.round(n(r.first_paper) * 10) / 10
    const last = Math.round(n(r.last_paper) * 10) / 10
    return {
      subject: String(r.subject),
      students: n(r.students),
      firstPaper: first,
      lastPaper: last,
      deltaPoints: Math.round((last - first) * 10) / 10,
    }
  })
}

export interface MasteryMix {
  gap: number
  developing: number
  mastered: number
  total: number
  /** Assessed subtopics sitting at or above 80%, as a share of all assessed. */
  masteredShare: number
}

/**
 * Where measured subtopics currently sit.
 *
 * The level the product actually intervenes on. A quiz average says a student
 * is at 63%; this says which parts of the syllabus are solid and which are not,
 * which is the thing a lesson can be built against.
 */
export async function loadMasteryMix(database: Database = defaultDb): Promise<MasteryMix> {
  const { rows } = await database.query(`
    SELECT COUNT(*) FILTER (WHERE accuracy < 50)                      AS gap,
           COUNT(*) FILTER (WHERE accuracy >= 50 AND accuracy < 80)   AS developing,
           COUNT(*) FILTER (WHERE accuracy >= 80)                     AS mastered
      FROM topic_mastery
     WHERE attempts > 0 AND accuracy IS NOT NULL
  `)
  const r = rows[0] ?? {}
  const gap = n(r.gap)
  const developing = n(r.developing)
  const mastered = n(r.mastered)
  const total = gap + developing + mastered
  return {
    gap,
    developing,
    mastered,
    total,
    masteredShare: total > 0 ? Math.round((mastered / total) * 1000) / 10 : 0,
  }
}
