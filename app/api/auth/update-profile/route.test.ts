import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import { POST } from './route'

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const existingUser = {
  id: USER_ID,
  name: 'Student',
  email: null,
  student_id: '3796',
  class: 'Grade 12',
  subjects: ['Mathematics'],
  role: 'student',
  country: 'RW',
  password_hash: 'hash',
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/update-profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: USER_ID, ...body }),
  })
}

beforeEach(() => {
  vi.mocked(db.query).mockReset()
})

describe('adding an account email from Settings', () => {
  it('normalizes and saves a unique email for a student-ID account', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [existingUser] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ ...existingUser, email: 'payer@example.com' }] } as any)

    const response = await POST(request({ email: '  Payer@Example.com  ' }))
    expect(response.status).toBe(200)
    expect((await response.json()).user.email).toBe('payer@example.com')
    expect(vi.mocked(db.query).mock.calls[1][1]).toEqual(['payer@example.com', USER_ID])
    expect(vi.mocked(db.query).mock.calls[2][0]).toContain('email = $2')
  })

  it('rejects an invalid email', async () => {
    const response = await POST(request({ email: 'not-an-email' }))
    expect(response.status).toBe(400)
    expect(db.query).not.toHaveBeenCalled()
  })

  it('rejects an email already owned by another account', async () => {
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [existingUser] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }] } as any)

    const response = await POST(request({ email: 'used@example.com' }))
    expect(response.status).toBe(409)
    expect((await response.json()).error).toContain('already used')
  })
})
