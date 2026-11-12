import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))
import { db } from '@/lib/db'
import { GET } from './route'

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

beforeEach(() => vi.mocked(db.query).mockReset())

describe('dashboard referral visibility', () => {
  it.each([
    [true, true],
    [false, false],
  ])('returns active=%s from the effective referral query', async (databaseValue, expected) => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ active: databaseValue }] } as any)
    const response = await GET(new NextRequest(`http://localhost/api/referrals/status?user_id=${USER}`))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ active: expected })
    const sql = String(vi.mocked(db.query).mock.calls[0][0])
    expect(sql).toContain('active = TRUE')
    expect(sql).toContain('expires_at > NOW()')
  })

  it('fails closed when the database lookup fails', async () => {
    vi.mocked(db.query).mockRejectedValueOnce(new Error('database unavailable'))
    const response = await GET(new NextRequest(`http://localhost/api/referrals/status?user_id=${USER}`))
    expect(response.status).toBe(500)
  })

  it('rejects invalid account ids without querying', async () => {
    const response = await GET(new NextRequest('http://localhost/api/referrals/status?user_id=nope'))
    expect(response.status).toBe(400)
    expect(db.query).not.toHaveBeenCalled()
  })
})
