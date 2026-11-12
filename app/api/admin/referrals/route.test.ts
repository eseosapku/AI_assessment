import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))
vi.mock('@/lib/auth/admin', () => ({
  requirePlatformAdmin: vi.fn(async () => ({ ok: true, admin: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } })),
}))

import { db } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/auth/admin'
import { GET, PATCH, POST } from './route'

const request = (method: string, body?: unknown) => new NextRequest('http://localhost/api/admin/referrals?user_id=admin', {
  method,
  headers: { 'content-type': 'application/json' },
  body: body == null ? undefined : JSON.stringify(body),
})

beforeEach(() => {
  vi.mocked(db.query).mockReset()
  vi.mocked(requirePlatformAdmin).mockResolvedValue({ ok: true, admin: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: null, name: null } })
})

describe('admin referral management', () => {
  it('requires platform-admin authorization', async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValueOnce({ ok: false, response: Response.json({ error: 'no' }, { status: 401 }) } as any)
    expect((await GET(request('GET'))).status).toBe(401)
    expect(db.query).not.toHaveBeenCalled()
  })

  it('creates a normalized code for an existing owner', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Owner' }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'code-id', code: 'SAVE40', discount_percentage: 40 }] } as any)
    const response = await POST(request('POST', { code: ' save40 ', owner_identifier: 'owner@example.com', discount_percentage: 40 }))
    expect(response.status).toBe(201)
    expect(vi.mocked(db.query).mock.calls[1][1]?.[0]).toBe('SAVE40')
  })

  it('rejects 100% discounts and missing owners', async () => {
    expect((await POST(request('POST', { code: 'FREE100', owner_identifier: 'x', discount_percentage: 100 }))).status).toBe(400)
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as any)
    expect((await POST(request('POST', { code: 'SAVE40', owner_identifier: 'missing', discount_percentage: 40 }))).status).toBe(404)
  })

  it('can deactivate a code', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ id: 'code-id', code: 'SAVE40', active: false }] } as any)
    const response = await PATCH(request('PATCH', { id: 'code-id', active: false }))
    expect(response.status).toBe(200)
    expect(vi.mocked(db.query).mock.calls[0][0]).toContain('active = $2')
  })
})
