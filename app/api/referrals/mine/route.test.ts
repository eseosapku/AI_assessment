import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))
import { db } from '@/lib/db'
import { GET } from './route'

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

beforeEach(() => vi.mocked(db.query).mockReset())

describe('referrer privacy dashboard', () => {
  it('returns counts and timestamps without referred-user identity or payment details', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'code', code: 'SAVE40', active: true, effective_active: true, uses: 2 }] } as any)
      .mockResolvedValueOnce({ rows: [{ code: 'SAVE40', redeemed_at: '2026-01-02T00:00:00Z' }] } as any)
    const response = await GET(new NextRequest(`http://localhost/api/referrals/mine?user_id=${USER}`))
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).not.toMatch(/referred_user|payer|email|transaction|amount_paid/i)
    const body = JSON.parse(text)
    expect(body.summary).toEqual({ totalUses: 2, activeCodes: 1 })
    expect(body.events).toEqual([{ code: 'SAVE40', redeemed_at: '2026-01-02T00:00:00Z' }])
  })

  it('does not count an expired but enabled code as active', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'code', code: 'OLD40', active: true, effective_active: false, uses: 1 }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
    const response = await GET(new NextRequest(`http://localhost/api/referrals/mine?user_id=${USER}`))
    expect((await response.json()).summary).toEqual({ totalUses: 1, activeCodes: 0 })
  })

  it('rejects an invalid user id', async () => {
    const response = await GET(new NextRequest('http://localhost/api/referrals/mine?user_id=nope'))
    expect(response.status).toBe(400)
    expect(db.query).not.toHaveBeenCalled()
  })
})
