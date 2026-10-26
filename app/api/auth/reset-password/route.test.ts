import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { db } from '@/lib/db'
import { __resetRateLimits } from '@/lib/rate-limit'
import { PASSWORD_RESET_MAX_ATTEMPTS } from '@/lib/password-reset-otp'
import { POST } from './route'

/** One account with an issued code, counting attempts the way the UPDATE does. */
function fakeAccount(code: string) {
  const row = { id: 'u1', reset_token: code as string | null, reset_token_expires: new Date(Date.now() + 60_000), reset_attempts: 0 }
  let passwordChanged = false
  vi.mocked(db.query).mockImplementation((async (sql: string, params: any[] = []) => {
    if (/SET reset_attempts = COALESCE/.test(sql)) {
      if (!row.reset_token || row.reset_attempts >= params[1]) return { rows: [] }
      row.reset_attempts += 1
      return { rows: [{ ...row }] }
    }
    if (/SET password_hash/.test(sql)) {
      passwordChanged = true
      row.reset_token = null
      return { rows: [] }
    }
    if (/SET reset_token = NULL/.test(sql)) {
      row.reset_token = null
      return { rows: [] }
    }
    return { rows: [] }
  }) as any)
  return { row, changed: () => passwordChanged }
}

let ip = 0
const attempt = (otp: string) =>
  POST(
    new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      // A fresh forwarded address every time, as an attacker would send.
      headers: { 'x-forwarded-for': `10.0.0.${++ip}` },
      body: JSON.stringify({ email: 'victim@example.com', otp, password: 'newpass1' }),
    }),
  )

beforeEach(() => {
  vi.mocked(db.query).mockReset()
  __resetRateLimits()
})

describe('guessing a password-reset code', () => {
  it('accepts the right code', async () => {
    const account = fakeAccount('123456')
    expect((await attempt('123456')).status).toBe(200)
    expect(account.changed()).toBe(true)
  })

  // Wrong guesses cost nothing and the limit keyed on a spoofable header, so
  // all 900,000 codes could be tried inside the 15-minute window.
  it('throws the code away after the allowed wrong guesses', async () => {
    const account = fakeAccount('123456')
    for (let i = 0; i < PASSWORD_RESET_MAX_ATTEMPTS; i++) {
      expect((await attempt('000000')).status).toBe(400)
    }
    expect(account.row.reset_token).toBeNull()
    expect((await attempt('123456')).status).toBe(400)
    expect(account.changed()).toBe(false)
  })

  it('rate-limits by email even when the forwarded IP changes', async () => {
    fakeAccount('123456')
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) statuses.push((await attempt('000000')).status)
    expect(statuses).toContain(429)
  })
})
