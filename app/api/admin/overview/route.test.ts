import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth/admin', () => ({
  requirePlatformAdmin: vi.fn(),
}))

// Mocked so this stays a test of the route's contract — authorisation, the
// envelope, and cacheability — rather than a second test of the SQL, which
// metrics.test.ts already covers against an injected database.
vi.mock('@/lib/admin/metrics', () => ({
  loadAdminMetrics: vi.fn(),
  metricWarnings: vi.fn(),
}))

// Same reasoning: gap-metrics.test.ts already exercises this SQL against an
// injected database, and leaving it live here would make the route's contract
// depend on a reachable Postgres.
vi.mock('@/lib/admin/growth-metrics', () => ({
  loadFunnel: vi.fn(),
  loadRetentionCohorts: vi.fn(),
  loadAssignmentHealth: vi.fn(),
  loadTutorEngagement: vi.fn(),
  loadCurriculumMix: vi.fn(),
  loadRecallHealth: vi.fn(),
  loadCollectionPoints: vi.fn(),
}))

vi.mock('@/lib/admin/gap-metrics', () => ({
  GAP_THRESHOLD: 50,
  loadGapLifecycle: vi.fn(),
  loadGapTimeline: vi.fn(),
  loadTaggingCoverage: vi.fn(),
  loadPerformanceLift: vi.fn(),
}))

import { requirePlatformAdmin } from '@/lib/auth/admin'
import { loadAdminMetrics, metricWarnings } from '@/lib/admin/metrics'
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
  loadGapLifecycle,
  loadGapTimeline,
  loadTaggingCoverage,
  loadPerformanceLift,
} from '@/lib/admin/gap-metrics'
import { GET } from './route'

const METRICS = {
  headline: { data: { students: 845, teachers: 84 } },
  improvement: { data: { students: 56, firstThreeAvg: 56, lastThreeAvg: 67, delta: 11 } },
  activity: { data: [] },
  subjects: { data: [] },
  engagement: { data: null, error: 'Engagement unavailable' },
  studyLoop: { data: null },
}

const GAPS = {
  identified: 162, closed: 6, stillOpen: 156, closureRate: 3.7,
  medianDaysToClose: 0.048, studentsWithGaps: 14, subtopicsAffected: 157,
}
const COVERAGE = { assessments: 1923, tagged: 178, coverage: 9.3, gapsPerTaggedPaper: 0.91 }
const LIFT = {
  students: 56, firstThreeAvg: 55.7, lastThreeAvg: 67.1, deltaPoints: 11.4, deltaRelative: 20.5,
}

const FUNNEL = [
  { key: 'registered', label: 'Registered', meaning: 'Made an account', count: 844, ofPrevious: 100 },
  { key: 'activated', label: 'Sat a paper', meaning: 'Marked once', count: 428, ofPrevious: 50.7 },
]
const ASSIGNMENTS = {
  set: 2123, completed: 422, started: 219, neverOpened: 1482,
  completionRate: 19.9, teachersSetting: 12, medianHoursToComplete: 10.1,
}
const TUTOR = {
  lessons: 65, lessonsWithChat: 62, messages: 1181,
  medianMessagesPerLesson: 7, conversationRate: 95.4,
}
const RECALL = { cards: 398, decks: 83, students: 4, reviewed: 19, dueNow: 397, reviewRate: 4.8 }
const COLLECTION = [
  { key: 'cost', label: 'AI spend', status: 'Nothing written', captured: 0, possible: null, worth: 'x', state: 'silent' },
]

function overviewRequest(mode?: 'live' | 'projected') {
  const url = new URL('https://studysquare.test/api/admin/overview')
  if (mode) url.searchParams.set('mode', mode)
  return new NextRequest(url)
}

function deniedResponse(
  status: 401 | 403,
  code: 'UNAUTHENTICATED' | 'FORBIDDEN',
  message: string,
) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

describe('GET /api/admin/overview', () => {
  beforeEach(() => {
    vi.mocked(requirePlatformAdmin).mockReset()
    vi.mocked(loadAdminMetrics).mockReset().mockResolvedValue(METRICS as never)
    vi.mocked(metricWarnings).mockReset().mockReturnValue(['Engagement unavailable'])
    vi.mocked(loadGapLifecycle).mockReset().mockResolvedValue(GAPS as never)
    vi.mocked(loadGapTimeline).mockReset().mockResolvedValue([] as never)
    vi.mocked(loadTaggingCoverage).mockReset().mockResolvedValue(COVERAGE as never)
    vi.mocked(loadPerformanceLift).mockReset().mockResolvedValue(LIFT as never)
    vi.mocked(loadFunnel).mockReset().mockResolvedValue(FUNNEL as never)
    vi.mocked(loadRetentionCohorts).mockReset().mockResolvedValue([] as never)
    vi.mocked(loadAssignmentHealth).mockReset().mockResolvedValue(ASSIGNMENTS as never)
    vi.mocked(loadTutorEngagement).mockReset().mockResolvedValue(TUTOR as never)
    vi.mocked(loadCurriculumMix).mockReset().mockResolvedValue([] as never)
    vi.mocked(loadRecallHealth).mockReset().mockResolvedValue(RECALL as never)
    vi.mocked(loadCollectionPoints).mockReset().mockResolvedValue(COLLECTION as never)
  })

  it('returns the unchanged 401 response when no session is authorized', async () => {
    const denial = deniedResponse(
      401,
      'UNAUTHENTICATED',
      'Authentication required',
    )
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: false,
      response: denial,
    })

    const response = await GET(overviewRequest())

    expect(response).toBe(denial)
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    })
  })

  it('returns the unchanged 403 response for a student', async () => {
    const denial = deniedResponse(
      403,
      'FORBIDDEN',
      'Platform administrator access required',
    )
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: false,
      response: denial,
    })

    const response = await GET(overviewRequest())

    expect(response).toBe(denial)
    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Platform administrator access required',
      },
    })
  })

  it('guards the request once before returning ready status to an admin', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: true,
      admin: { userId: 'admin-1', email: 'admin@studysquare.test', name: 'Admin' },
    })
    const request = overviewRequest()

    const response = await GET(request)

    expect(requirePlatformAdmin).toHaveBeenCalledOnce()
    expect(requirePlatformAdmin).toHaveBeenCalledWith(request)
    expect(response.status).toBe(200)
  })

  it('returns exact non-cacheable metadata for an allowed request', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: true,
      admin: { userId: 'admin-1', email: 'admin@studysquare.test', name: 'Admin' },
    })

    const response = await GET(overviewRequest())
    const payload = await response.json()

    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(payload.data.headline).toEqual({ students: 845, teachers: 84 })
    expect(payload.data.improvement.delta).toBe(11)
    expect(payload.metadata.sources).toContain('results')
    expect(new Date(payload.metadata.generatedAt).toISOString()).toBe(
      payload.metadata.generatedAt,
    )
  })

  it('unwraps each metric, so a failed one reaches the page as null', async () => {
    // The page needs to distinguish "no engagement data" from "engagement
    // returned zero", and a null with a matching warning is how it does that.
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: true,
      admin: { userId: 'admin-1', email: 'admin@studysquare.test', name: 'Admin' },
    })

    const payload = await (await GET(overviewRequest())).json()
    expect(payload.data.engagement).toBeNull()
    expect(payload.metadata.warnings).toEqual(['Engagement unavailable'])
  })

  it('defaults to measured data rather than the projection', async () => {
    // A dashboard that opens on modelled figures without saying so is the one
    // way this page could actively mislead someone.
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: true,
      admin: { userId: 'admin-1', email: null, name: null },
    })
    const payload = await (await GET(overviewRequest())).json()
    expect(payload.mode).toBe('live')
    expect(payload.data.gaps.identified).toBe(162)
    expect(payload.data.headline).toEqual({ students: 845, teachers: 84 })
  })

  it('answers a projected request from the model, never from the database', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: true,
      admin: { userId: 'admin-1', email: null, name: null },
    })

    const payload = await (await GET(overviewRequest('projected'))).json()

    expect(payload.mode).toBe('projected')
    expect(payload.data.gaps.identified).toBe(21_436)
    expect(loadGapLifecycle).not.toHaveBeenCalled()
    // The derivation stays server-side; the dashboard renders figures, not
    // arithmetic.
    expect(payload.data.gaps).not.toHaveProperty('identifiedChain')
  })

  it('only reports collection gaps against measured figures', async () => {
    // What is not being instrumented is a fact about today. Against a modelled
    // cohort it would be meaningless, so it is withheld there.
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      ok: true,
      admin: { userId: 'admin-1', email: null, name: null },
    })

    const live = await (await GET(overviewRequest('live'))).json()
    const projected = await (await GET(overviewRequest('projected'))).json()

    expect(live.data.collectionPoints).toHaveLength(1)
    expect(projected.data.collectionPoints).toBeNull()
  })

  it('scales every panel together, so no figure contradicts another', async () => {
    // 21,436 gaps above 844 students reads as a broken query rather than a
    // bigger platform. If the headline scales, the rest has to move with it.
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: true,
      admin: { userId: 'admin-1', email: null, name: null },
    })

    const payload = await (await GET(overviewRequest('projected'))).json()

    expect(payload.data.headline.students).toBeGreaterThan(10_000)
    // Papers come from the same chain the gap count does, so the two can never
    // disagree about how much marking happened.
    expect(payload.data.headline.quizzes).toBe(23_556)
    expect(payload.data.engagement.totalHours).toBeGreaterThan(7_000)
    expect(payload.data.studyLoop.lessonsFromGaps).toBeGreaterThan(2_000)
  })

  it('does not touch the database for a request it rejects', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({
      ok: false,
      response: deniedResponse(403, 'FORBIDDEN', 'Platform administrator access required'),
    })

    await GET(overviewRequest())
    expect(loadAdminMetrics).not.toHaveBeenCalled()
  })
})
