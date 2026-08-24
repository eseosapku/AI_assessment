import { NextResponse, type NextRequest } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth/admin'
import { loadAdminMetrics, metricWarnings } from '@/lib/admin/metrics'
import {
  loadGapLifecycle,
  loadGapTimeline,
  loadTaggingCoverage,
  loadPerformanceLift,
  type GapLifecycle,
  type GapMonthPoint,
  type PerformanceLift,
} from '@/lib/admin/gap-metrics'
import { projectGaps, projectLift, projectTimeline, SCENARIO } from '@/lib/admin/projection'

/**
 * Everything the admin dashboard reports.
 *
 * Two modes, and the difference between them is stated in the payload rather
 * than left for the page to remember. `live` is measured: every figure comes
 * from a query against real rows. `projected` runs the same platform forward on
 * rates the live data measured, and returns the arithmetic that produced each
 * headline so the dashboard can show its working.
 *
 * The mode is echoed back, because a screenshot of this dashboard will outlive
 * the conversation that produced it and a projected figure mistaken for a
 * measured one is the one failure that would actually matter.
 *
 * Metrics load independently and failures are contained: nine panels where one
 * query breaks should show eight panels and name the one that failed, rather
 * than a stack trace.
 */

export type OverviewMode = 'live' | 'projected'

function parseMode(request: NextRequest): OverviewMode {
  return request.nextUrl.searchParams.get('mode') === 'projected' ? 'projected' : 'live'
}

async function guard<T>(label: string, load: () => Promise<T>): Promise<{ data: T | null; error?: string }> {
  try {
    return { data: await load() }
  } catch (error) {
    console.error(`Admin metric "${label}" failed:`, (error as Error)?.message ?? error)
    return { data: null, error: `${label} unavailable` }
  }
}

export async function GET(request: NextRequest) {
  const authorization = await requirePlatformAdmin(request)
  if (!authorization.ok) return authorization.response

  const mode = parseMode(request)

  // The platform metrics are measured in both modes — student counts, subject
  // performance and time-on-task are real in a way a forecast has no business
  // overwriting.
  const [metrics, coverage] = await Promise.all([
    loadAdminMetrics(),
    guard('Tagging coverage', () => loadTaggingCoverage()),
  ])

  let gaps: { data: GapLifecycle | null; error?: string }
  let timeline: { data: GapMonthPoint[] | null; error?: string }
  let lift: { data: PerformanceLift | null; error?: string }

  if (mode === 'projected') {
    gaps = { data: projectGaps() }
    timeline = { data: projectTimeline() }
    lift = { data: projectLift() }
  } else {
    ;[gaps, timeline, lift] = await Promise.all([
      guard('Gap lifecycle', () => loadGapLifecycle()),
      guard('Gap timeline', () => loadGapTimeline()),
      guard('Performance lift', () => loadPerformanceLift()),
    ])
  }

  const warnings = [
    ...metricWarnings(metrics),
    ...[coverage, gaps, timeline, lift].map((m) => m.error).filter((e): e is string => Boolean(e)),
  ]

  return NextResponse.json(
    {
      mode,
      data: {
        gaps: gaps.data,
        gapTimeline: timeline.data,
        lift: lift.data,
        taggingCoverage: coverage.data,
        headline: metrics.headline.data,
        improvement: metrics.improvement.data,
        activity: metrics.activity.data,
        subjects: metrics.subjects.data,
        engagement: metrics.engagement.data,
        studyLoop: metrics.studyLoop.data,
      },
      // Returned in both modes so the page can always explain a number, and so
      // the assumptions behind a projection travel with it.
      model: mode === 'projected' ? SCENARIO : null,
      metadata: {
        sources: ['results', 'assessments', 'subtopics', 'users', 'learnspaces', 'user_activity_daily'],
        generatedAt: new Date().toISOString(),
        warnings,
      },
    },
    // Never cached: these numbers are the reason someone opened the page, and a
    // stale figure is worse than a slow one.
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
