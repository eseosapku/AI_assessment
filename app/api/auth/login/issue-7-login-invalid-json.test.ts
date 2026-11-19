import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

describe('issue-7-login-invalid-json', () => {
  it('returns 400 for a malformed request body', async () => {
    const response = await POST(new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'this is plain text',
    }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/valid JSON/i)
  })
})
