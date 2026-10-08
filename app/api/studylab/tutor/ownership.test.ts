import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))
vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))

import { callGemma } from '@/lib/bedrock'
import { db } from '@/lib/db'
import { POST } from './route'

const OWNER = '22222222-2222-4222-8222-222222222222'
const STRANGER = '33333333-3333-4333-8333-333333333333'
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/studylab/tutor', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.mocked(db.query).mockReset()
  vi.mocked(callGemma).mockReset()
  vi.mocked(db.query).mockResolvedValue({ rows: [{ id: 'space', user_id: OWNER, origin: 'topic', lesson_run: null, canvas_state: {} }] } as any)
})

describe('driving a lesson', () => {
  it("is refused for someone who does not own it, before any model call", async () => {
    // Anyone holding a lesson id could spend its owner's tutor allowance.
    const res = await post({ learnspaceId: 'space', userId: STRANGER, action: { type: 'next_beat' } })
    expect(res.status).toBe(404)
    expect(callGemma).not.toHaveBeenCalled()
  })

  it('is refused when the caller does not say who they are', async () => {
    const res = await post({ learnspaceId: 'space', action: { type: 'next_beat' } })
    expect(res.status).toBe(404)
    expect(callGemma).not.toHaveBeenCalled()
  })
})
