import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import { POST } from './route'

const signup = (body: Record<string, unknown>) =>
  POST(
    new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', email: 'x@example.com', password: 'secret1', className: 'S1', ...body }),
    }),
  )

function insertedRole(): unknown {
  const insert = vi.mocked(db.query).mock.calls.find(([q]) => /INSERT INTO users/.test(String(q)))
  return (insert?.[1] as unknown[] | undefined)?.[5]
}

beforeEach(() => {
  vi.mocked(db.query).mockReset()
  vi.mocked(db.query).mockImplementation((async (sql: string) =>
    /INSERT INTO users/.test(sql)
      ? { rows: [{ id: 'new-id', name: 'X', email: 'x@example.com', role: 'student' }] }
      : { rows: [] }) as any)
})

describe('the role a new account gets', () => {
  // The role was stored as sent, and role = 'platform_admin' opens /api/admin.
  it('never stores platform_admin from the request', async () => {
    await signup({ role: 'platform_admin' })
    expect(insertedRole()).toBe('student')
  })

  it('stores teacher when asked', async () => {
    await signup({ role: 'teacher' })
    expect(insertedRole()).toBe('teacher')
  })

  it('defaults to student', async () => {
    await signup({})
    expect(insertedRole()).toBe('student')
  })
})
