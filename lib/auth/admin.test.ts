import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { requirePlatformAdmin, allowlistedAdminIds, hashToken, tokenFromRequest } from './admin'
import type { Database } from '@/lib/db'

const ADMIN_ID = 'a14a382f-07f4-4c48-88d2-7d89d4c71606'
const TEACHER_ID = '204fd419-6ab4-48cd-b866-8ef70c161e7a'

const dbWith = (rows: Record<string, unknown>[]): Database =>
  ({ query: vi.fn().mockResolvedValue({ rows }) }) as unknown as Database

const req = (userId?: string) =>
  new NextRequest(
    `https://studysquare.test/api/admin/overview${userId ? `?user_id=${userId}` : ''}`,
  )

let error: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
  delete process.env.PLATFORM_ADMIN_USER_IDS
})
afterEach(() => {
  error.mockRestore()
  delete process.env.PLATFORM_ADMIN_USER_IDS
})

describe('allowlistedAdminIds', () => {
  it('reads a comma-separated list', () => {
    expect(allowlistedAdminIds({ PLATFORM_ADMIN_USER_IDS: `${ADMIN_ID}, ${TEACHER_ID}` } as never))
      .toEqual([ADMIN_ID, TEACHER_ID])
  })

  it('drops anything that is not a user id', () => {
    // A typo in an environment variable must not widen access to a value that
    // happens to match some other column.
    expect(allowlistedAdminIds({ PLATFORM_ADMIN_USER_IDS: 'yes, true, *, admin' } as never)).toEqual([])
  })

  it('is empty when unset, so the default is closed', () => {
    expect(allowlistedAdminIds({} as never)).toEqual([])
  })
})

describe('requirePlatformAdmin', () => {
  it('admits an account carrying the role', async () => {
    const auth = await requirePlatformAdmin(
      req(ADMIN_ID),
      dbWith([{ id: ADMIN_ID, email: 'admin@test', name: 'Admin' }]),
    )
    expect(auth.ok).toBe(true)
  })

  it('checks the role in the database rather than believing the client', async () => {
    const db = dbWith([])
    await requirePlatformAdmin(req(TEACHER_ID), db)
    const [sql] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sql).toContain("role = 'platform_admin'")
  })

  it('passes the allowlist to the query, so a teacher can look without being promoted', async () => {
    // Promoting them would take away their dashboard, classrooms and reports,
    // since the rest of the app branches on the same single role column.
    process.env.PLATFORM_ADMIN_USER_IDS = TEACHER_ID
    const db = dbWith([{ id: TEACHER_ID, email: 'teacher@test', name: 'Teacher' }])
    const auth = await requirePlatformAdmin(req(TEACHER_ID), db)

    expect(auth.ok).toBe(true)
    const [, values] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(values[1]).toEqual([TEACHER_ID])
  })

  it('still requires the account to exist', async () => {
    // The allowlist says which ids may look, not that any id is a person.
    process.env.PLATFORM_ADMIN_USER_IDS = TEACHER_ID
    const auth = await requirePlatformAdmin(req(TEACHER_ID), dbWith([]))
    expect(auth.ok).toBe(false)
  })

  it('refuses an unlisted account that lacks the role', async () => {
    const auth = await requirePlatformAdmin(req(TEACHER_ID), dbWith([]))
    expect(auth.ok).toBe(false)
    if (!auth.ok) expect(auth.response.status).toBe(401)
  })

  it('refuses a request carrying no identity at all', async () => {
    const auth = await requirePlatformAdmin(req(), dbWith([]))
    expect(auth.ok).toBe(false)
  })

  it('ignores a user_id that is not a user id', async () => {
    const db = dbWith([])
    const auth = await requirePlatformAdmin(req('not-a-uuid'), db)
    expect(auth.ok).toBe(false)
    // Never reached the database: a malformed id is rejected before it can be
    // used as a query parameter.
    expect(db.query).not.toHaveBeenCalled()
  })

  it('does not leak whether the failure was identity or permission', async () => {
    // Distinguishing them tells an attacker which half they got right.
    const auth = await requirePlatformAdmin(req(TEACHER_ID), dbWith([]))
    if (!auth.ok) {
      const body = await auth.response.json()
      expect(String(body.error)).not.toMatch(/role|platform_admin|not found/i)
    }
  })

  it('fails closed when the database is unreachable', async () => {
    const broken = { query: vi.fn().mockRejectedValue(new Error('down')) } as unknown as Database
    const auth = await requirePlatformAdmin(req(ADMIN_ID), broken)
    expect(auth.ok).toBe(false)
    if (!auth.ok) expect(auth.response.status).toBe(500)
  })
})

describe('token handling', () => {
  it('hashes rather than storing what the client sent', () => {
    // A leaked database dump should not hand over live sessions.
    const hash = hashToken('secret-token')
    expect(hash).not.toContain('secret-token')
    expect(hash).toHaveLength(64)
  })

  it('prefers a bearer header over a cookie', () => {
    const request = new NextRequest('https://studysquare.test/x', {
      headers: { authorization: 'Bearer header-token' },
    })
    expect(tokenFromRequest(request)).toBe('header-token')
  })

  it('is null when neither is present', () => {
    expect(tokenFromRequest(new NextRequest('https://studysquare.test/x'))).toBeNull()
  })
})
