import { NextResponse, type NextRequest } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth/admin'
import { loadAdminMetrics, metricWarnings } from '@/lib/admin/metrics'

/**
 * Platform metrics for the admin dashboard.
 *
 * Keeps the envelope the stub established — `data` beside a `metadata` block
 * carrying its sources, when it was generated, and what could not be loaded.
 * That last part is why the shape is worth keeping: a metric can fail on its
 * own here, and an operator needs to be told which one rather than quietly
 * shown a dashboard with a hole in it.
 */
export async function GET(request: NextRequest) {
  const authorization = await requirePlatformAdmin(request)
  if (!authorization.ok) return authorization.response

  const metrics = await loadAdminMetrics()

  return NextResponse.json(
    {
      data: {
        headline: metrics.headline.data,
        improvement: metrics.improvement.data,
        activity: metrics.activity.data,
        subjects: metrics.subjects.data,
        engagement: metrics.engagement.data,
        studyLoop: metrics.studyLoop.data,
      },
      metadata: {
        sources: ['results', 'users', 'learnspaces', 'user_activity_daily'],
        generatedAt: new Date().toISOString(),
        warnings: metricWarnings(metrics),
      },
    },
    // Never cached: these numbers are the reason someone opened the page, and a
    // stale figure is worse than a slow one.
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
