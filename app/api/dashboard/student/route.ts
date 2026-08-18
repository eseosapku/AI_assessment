import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { countsTowardMastery, exclusionReason } from '@/lib/result-counts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function gradeFromPercentage(percentage: number) {
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B+'
  if (percentage >= 60) return 'B'
  if (percentage >= 50) return 'C'
  return 'D'
}

export async function GET(request: NextRequest) {
  try {
    const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'A valid user_id is required' }, { status: 400 })
    }

    // Work set by a teacher is saved with assessment_id deliberately NULL — it
    // hangs off assignment_results instead. Joining only to assessments left
    // every one of those with no subject, and the `|| 'Assessment'` fallback
    // below then collected them into a phantom subject called "Assessment"
    // that sat in Progress alongside the real ones, while the actual subject
    // vanished from the list. Recover it from the assignment.
    const resultsQuery = await db.query(
      `SELECT r.id, r.created_at, r.score, r.percentage, r.feedback, r.questions_data,
              r.answers, r.longform_grades, r.submission_reason,
              COALESCE(a.subject, asg.subject) AS subject,
              COALESCE(a.difficulty, asg.difficulty_level) AS difficulty,
              (asg.id IS NOT NULL) AS from_assignment
       FROM results r
       LEFT JOIN assessments a ON a.id = r.assessment_id
       -- LATERAL with LIMIT 1, not a plain join: assignment_results has no
       -- unique constraint on result_id, so a second row pointing at the same
       -- result would duplicate that quiz and double-count it in the average.
       LEFT JOIN LATERAL (
         SELECT asg.id, asg.subject, asg.difficulty_level
           FROM assignment_results ar
           JOIN assignments asg ON asg.id = ar.assignment_id
          WHERE ar.result_id = r.id
          ORDER BY ar.completed_at DESC NULLS LAST
          LIMIT 1
       ) asg ON TRUE
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId],
    )

    const rows = resultsQuery.rows
    const recentAssessments = rows.slice(0, 6).map((item: any) => {
      const percentage = Number(item.percentage ?? item.score ?? 0)
      const feedback = item.feedback
      const feedbackText =
        typeof feedback === 'object' && feedback !== null && 'text' in feedback
          ? String((feedback as { text?: string }).text ?? '')
          : 'No feedback available.'

      return {
        id: item.id,
        date: new Date(item.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        subject: item.subject || 'Untitled quiz',
        topic: item.difficulty || 'General',
        fromAssignment: Boolean(item.from_assignment),
        // Shown in history either way; the label says why it is not in the average.
        excludedReason: exclusionReason(item),
        grade: gradeFromPercentage(percentage),
        score: item.score,
        percentage,
        feedback: feedbackText,
        questions_data: item.questions_data ?? null,
        answers: item.answers ?? null,
        longform_grades: item.longform_grades ?? null,
      }
    })

    let stats = { total: 0, avgScore: 0 }
    let subjectAverages: { subject: string; avg: number; count: number }[] = []

    // An attempt the proctor ended, or one where nothing was answered, is not
    // evidence of what the student knows. On the live data that is 140
    // auto-submits averaging 21%, sitting permanently in every average beside
    // a manual average of 60%.
    const counting = rows.filter((r: any) => countsTowardMastery(r))

    if (rows.length > 0) {
      // percentage is the field every other screen reads; score is only equal
      // to it for rows written by the current save path.
      const avg =
        counting.length > 0
          ? counting.reduce((acc: number, curr: any) => acc + Number(curr.percentage ?? curr.score ?? 0), 0) /
            counting.length
          : 0
      // `total` stays every attempt: the student did sit them, and a count
      // that silently disagrees with the history below it is worse than one
      // that includes a walk-away.
      stats = { total: rows.length, avgScore: Math.round(avg) }

      const subjectMap: Record<string, number[]> = {}
      for (const item of counting) {
        // A result with no recoverable subject is not evidence about any
        // subject, so it must not invent one. It still counts towards the
        // overall total above.
        const subj = String(item.subject ?? '').trim()
        if (!subj) continue
        if (!subjectMap[subj]) subjectMap[subj] = []
        subjectMap[subj].push(Number(item.percentage ?? item.score ?? 0))
      }
      subjectAverages = Object.entries(subjectMap)
        .map(([subject, scores]) => ({
          subject,
          avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          count: scores.length,
        }))
        .sort((a, b) => b.avg - a.avg)
    }

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const dailyQuery = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM assessments
       WHERE user_id = $1 AND created_at >= $2`,
      [userId, startOfDay.toISOString()],
    )
    const dailyUsed = Number(dailyQuery.rows[0]?.count ?? 0)

    return NextResponse.json({
      data: {
        recentAssessments,
        stats,
        subjectAverages,
        dailyUsed,
      },
    })
  } catch (err) {
    console.error('Dashboard student fetch error:', err)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
