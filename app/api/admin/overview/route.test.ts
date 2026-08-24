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

import { requirePlatformAdmin } from '@/lib/auth/admin'
import { loadAdminMetrics, metricWarnings } from '@/lib/admin/metrics'
import { GET } from './route'

const METRICS = {
  headline: { data: { students: 845, teachers: 84 } },
  improvement: { data: { students: 56, firstThreeAvg: 56, lastThreeAvg: 67, delta: 11 } },
  activity: { data: [] },
  subjects: { data: [] },
  engagement: { data: null, error: 'Engagement unavailable' },
  studyLoop: { data: null },
}

function overviewRequest() {
  return new NextRequest('https://studysquare.test/api/admin/overview')
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
      principal: { userId: 'admin-1', role: 'platform_admin' },
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
      principal: { userId: 'admin-1', role: 'platform_admin' },
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
      principal: { userId: 'admin-1', role: 'platform_admin' },
    })

    const payload = await (await GET(overviewRequest())).json()
    expect(payload.data.engagement).toBeNull()
    expect(payload.metadata.warnings).toEqual(['Engagement unavailable'])
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
