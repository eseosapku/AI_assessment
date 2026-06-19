import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    const resultsQuery = await db.query(
      `SELECT r.id, r.created_at, r.score, r.percentage, r.feedback, r.questions_data,
              r.answers, r.longform_grades,
              a.subject, a.difficulty
       FROM results r
       LEFT JOIN assessments a ON a.id = r.assessment_id
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
        subject: item.subject || 'Assessment',
        topic: item.difficulty || 'General',
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

    if (rows.length > 0) {
      const avg = rows.reduce((acc: number, curr: any) => acc + Number(curr.score ?? 0), 0) / rows.length
      stats = { total: rows.length, avgScore: Math.round(avg) }

      const subjectMap: Record<string, number[]> = {}
      for (const item of rows) {
        const subj = item.subject || 'Assessment'
        if (!subjectMap[subj]) subjectMap[subj] = []
        subjectMap[subj].push(Number(item.score ?? 0))
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
