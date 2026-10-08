import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (t: string) => JSON.parse(t),
  fixLatexInRawJson: (t: string) => t,
  hasBedrockCredentials: () => true,
}))
vi.mock('@/lib/db', () => ({ db: { query: vi.fn() } }))
vi.mock('@/lib/subscription-server', () => ({
  assertSubscriptionAccess: vi.fn().mockResolvedValue({ allowed: true }),
  subscriptionPaywallBody: () => ({}),
}))

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

describe('two turns at once', () => {
  // Each turn reads the lesson, spends 5-20 s on the model, and writes the
  // whole run back: a double tap or a second tab and the later write wiped
  // the earlier one.
  const row = { id: 'space', user_id: OWNER, origin: 'topic', lesson_run: null, canvas_state: {} }

  it('refuses to write over a turn that landed in the meantime', async () => {
    vi.mocked(db.query).mockReset()
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
    const res = await post({ learnspaceId: 'space', userId: OWNER, action: { type: 'set_pace', pace: 'run' } })
    expect(res.status).toBe(409)
    const update = vi.mocked(db.query).mock.calls[1]
    expect(update[0]).toMatch(/lesson_run IS NOT DISTINCT FROM \$3::jsonb/)
  })

  it('writes when nothing changed underneath it', async () => {
    vi.mocked(db.query).mockReset()
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [row] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'space' }], rowCount: 1 } as any)
    const res = await post({ learnspaceId: 'space', userId: OWNER, action: { type: 'set_pace', pace: 'run' } })
    expect(res.status).toBe(200)
  })
})

describe('a turn that runs out of time', () => {
  // Amplify ends a request at 30 s with an HTML error page the student
  // cannot read. The route gives up first and says so.
  const row = { id: 'space', user_id: OWNER, origin: 'topic', lesson_run: null, canvas_state: {} }

  it('answers 504 with words, and saves nothing', async () => {
    vi.mocked(db.query).mockReset()
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [row] } as any)
    vi.mocked(callGemma).mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))
    const res = await post({ learnspaceId: 'space', userId: OWNER, action: { type: 'draft_plan' } })
    expect(res.status).toBe(504)
    expect((await res.json()).error).toMatch(/too long/i)
    expect(vi.mocked(db.query).mock.calls.some(([sql]) => /UPDATE learnspaces/.test(String(sql)))).toBe(false)
  })

  it('hands the model call a signal that stops it in time', async () => {
    vi.mocked(db.query).mockReset()
    vi.mocked(db.query).mockResolvedValue({ rows: [row], rowCount: 1 } as any)
    vi.mocked(callGemma).mockResolvedValueOnce('{"steps":[]}')
    await post({ learnspaceId: 'space', userId: OWNER, action: { type: 'draft_plan' } })
    const opts = vi.mocked(callGemma).mock.calls[0]?.[1] as { signal?: AbortSignal } | undefined
    expect(opts?.signal).toBeInstanceOf(AbortSignal)
    expect(opts?.signal?.aborted).toBe(false)
  })
})
