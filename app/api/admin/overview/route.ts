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
import {
  loadFunnel,
  loadRetentionCohorts,
  loadAssignmentHealth,
  loadTutorEngagement,
  loadCurriculumMix,
  loadRecallHealth,
  loadCollectionPoints,
} from '@/lib/admin/growth-metrics'
import {
  projectGaps,
  projectLift,
  projectTimeline,
  projectHeadline,
  projectSubjects,
  projectEngagement,
  projectStudyLoop,
  projectFunnel,
  projectRetention,
  projectAssignments,
  projectTutor,
  projectCurriculum,
  projectRecall,
} from '@/lib/admin/projection'

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
  const [metrics, coverage, funnel, retention, assignments, tutor, curriculum, recall, collection] =
    await Promise.all([
      loadAdminMetrics(),
      guard('Tagging coverage', () => loadTaggingCoverage()),
      guard('Funnel', () => loadFunnel()),
      guard('Retention', () => loadRetentionCohorts()),
      guard('Assignments', () => loadAssignmentHealth()),
      guard('Tutor engagement', () => loadTutorEngagement()),
      guard('Curriculum mix', () => loadCurriculumMix()),
      guard('Recall', () => loadRecallHealth()),
      guard('Collection points', () => loadCollectionPoints()),
    ])

  let gaps: { data: GapLifecycle | null; error?: string }
  let timeline: { data: GapMonthPoint[] | null; error?: string }
  let lift: { data: PerformanceLift | null; error?: string }

  if (mode === 'projected') {
    // The chains stay server-side. They are how the figures are derived and the
    // tests assert against them, but the dashboard does not render arithmetic.
    const { identifiedChain: _i, closedChain: _c, ...projected } = projectGaps()
    gaps = { data: projected }
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
    ...[coverage, gaps, timeline, lift, funnel, retention, assignments, tutor, curriculum, recall, collection]
      .map((m) => m.error)
      .filter((e): e is string => Boolean(e)),
  ]

  // Every panel moves together or none of it holds up: a page reporting 21,436
  // gaps above 844 students reads as a broken query rather than a bigger
  // platform. The subject mix, pass rates and activity shape stay exactly as
  // measured — only the magnitudes scale.
  const projected = mode === 'projected'

  return NextResponse.json(
    {
      mode,
      data: {
        gaps: gaps.data,
        gapTimeline: timeline.data,
        lift: lift.data,
        taggingCoverage: coverage.data,
        headline: projected ? projectHeadline(metrics.headline.data) : metrics.headline.data,
        improvement: metrics.improvement.data,
        activity: metrics.activity.data,
        subjects: projected ? projectSubjects(metrics.subjects.data) : metrics.subjects.data,
        engagement: projected ? projectEngagement(metrics.engagement.data) : metrics.engagement.data,
        studyLoop: projected ? projectStudyLoop(metrics.studyLoop.data) : metrics.studyLoop.data,
        funnel: projected ? projectFunnel(funnel.data) : funnel.data,
        retention: projected ? projectRetention(retention.data) : retention.data,
        assignments: projected ? projectAssignments(assignments.data) : assignments.data,
        tutor: projected ? projectTutor(tutor.data) : tutor.data,
        curriculum: projected ? projectCurriculum(curriculum.data) : curriculum.data,
        recall: projected ? projectRecall(recall.data) : recall.data,
        // What is not being captured is a fact about today's instrumentation.
        // It has no meaning against a modelled cohort, so it is only sent live.
        collectionPoints: projected ? null : collection.data,
      },
      metadata: {
        sources: [
          'results', 'assessments', 'subtopics', 'users', 'learnspaces',
          'user_activity_daily', 'assignment_results', 'learnspace_messages',
          'recall_cards', 'textbooks',
        ],
        generatedAt: new Date().toISOString(),
        warnings,
      },
    },
    // Never cached: these numbers are the reason someone opened the page, and a
    // stale figure is worse than a slow one.
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
