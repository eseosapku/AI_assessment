import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/bedrock', () => ({
  callGemma: vi.fn(),
  parseJsonRobust: (text: string) => JSON.parse(text),
  hasBedrockCredentials: () => true,
}))

vi.mock('@/lib/subscription-server', () => ({
  assertSubscriptionAccess: vi.fn(async () => ({ allowed: true, snapshot: {} })),
  subscriptionPaywallBody: () => ({ error: 'pay' }),
}))

import { callGemma } from '@/lib/bedrock'
import { POST } from './route'

const grade = (answer = 'yes') =>
  POST(
    new NextRequest('http://localhost/api/studylab/grade', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'What is 2 + 2?', answer, format: 'short' }),
    }),
  )

beforeEach(() => vi.mocked(callGemma).mockReset())

describe('a checkpoint grade that is not a real boolean', () => {
  it('does not lock a reply that is not JSON', async () => {
    vi.mocked(callGemma).mockResolvedValue('sorry, not json')
    const body = await (await grade()).json()
    expect(body.correct).toBeUndefined()
    expect(body.feedback).toMatch(/could not grade/i)
  })

  it('accepts the word true instead of marking it wrong', async () => {
    vi.mocked(callGemma).mockResolvedValue('{"correct":"true","feedback":"Yes, that\'s right."}')
    const body = await (await grade()).json()
    expect(body.correct).toBe(true)
  })

  it('keeps a real boolean', async () => {
    vi.mocked(callGemma).mockResolvedValue('{"correct":true,"feedback":"Yes."}')
    expect((await (await grade()).json()).correct).toBe(true)
  })
})
