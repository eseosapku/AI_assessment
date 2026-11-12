import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import { assertSubscriptionAccess, incrementFreeAssessmentUsage } from './subscription-server'

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

beforeEach(() => {
  vi.mocked(db.query).mockReset()
})

describe('server-side paywall enforcement', () => {
  it('permits the first two assessments and blocks the third', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: USER, role: 'student', subscription_status: 'free', free_assessments_used: 0 }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: USER, role: 'student', subscription_status: 'free', free_assessments_used: 1 }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: USER, role: 'student', subscription_status: 'free', free_assessments_used: 2 }] } as any)
    expect((await assertSubscriptionAccess(USER, 'assessment')).allowed).toBe(true)
    expect((await assertSubscriptionAccess(USER, 'assessment')).allowed).toBe(true)
    expect(await assertSubscriptionAccess(USER, 'assessment')).toMatchObject({ allowed: false, reason: 'assessment' })
  })

  it('requires payment for StudyLab even before free assessments are used', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{ id: USER, role: 'student', subscription_status: 'free', free_assessments_used: 0 }],
    } as any)
    expect(await assertSubscriptionAccess(USER, 'study')).toMatchObject({ allowed: false, reason: 'study' })
  })

  it('allows active subscribers and teachers', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({
        rows: [{ id: USER, role: 'student', subscription_status: 'active', subscription_expires_at: '2999-01-01T00:00:00Z' }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ id: USER, role: 'teacher', subscription_status: 'free' }] } as any)
    expect((await assertSubscriptionAccess(USER, 'study')).allowed).toBe(true)
    expect((await assertSubscriptionAccess(USER, 'study')).allowed).toBe(true)
  })

  it('increments free usage atomically and never above the limit', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as any)
    await incrementFreeAssessmentUsage(USER)
    const [sql, params] = vi.mocked(db.query).mock.calls[0]
    expect(sql).toContain('free_assessments_used = LEAST')
    expect(sql).toContain('free_assessments_used, 0) < $2')
    expect(params).toEqual([USER, 2])
  })
})
