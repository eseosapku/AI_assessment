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

describe('what it asks, and of whom', () => {
  it('runs on the model that marked 36 of 36', async () => {
    vi.mocked(callGemma).mockResolvedValue('{"correct":true,"feedback":"Yes."}')
    await grade()
    expect(vi.mocked(callGemma).mock.calls[0][1]).toMatchObject({ model: 'anthropic.claude-haiku-4-5-20251001-v1:0' })
  })
  it('judges the result, not the route', async () => {
    vi.mocked(callGemma).mockResolvedValue('{"correct":true,"feedback":"Yes."}')
    await grade()
    const prompt = String(vi.mocked(callGemma).mock.calls[0][0])
    expect(prompt).toContain('not their steps, the order of them')
    expect(prompt).toContain('One of two solutions is not complete')
  })
})

describe('the mark comes from what it found', () => {
  const reply = (fields: object) => JSON.stringify({ feedback: 'f', ...fields })
  const mark = async (fields: object) => {
    vi.mocked(callGemma).mockResolvedValue(reply(fields))
    return (await (await grade()).json()).correct
  }
  it('a matching result is correct, whatever else it says', async () => {
    expect(await mark({ result_matches: true, used_named_method: null })).toBe(true)
    expect(await mark({ result_matches: true, used_named_method: true, correct: false })).toBe(true)
  })
  it('a result that does not match is not, even called correct', async () => {
    expect(await mark({ result_matches: false, used_named_method: true, correct: true })).toBe(false)
  })
  it('the right result by another way, when the question named its method, is not', async () => {
    expect(await mark({ result_matches: true, used_named_method: false })).toBe(false)
  })
  it('sends back only the mark and the feedback, never its working', async () => {
    vi.mocked(callGemma).mockResolvedValue(reply({ my_result: 'x = 4', student_result: 'x = 4', result_matches: true, used_named_method: null }))
    expect(await (await grade()).json()).toEqual({ correct: true, feedback: 'f' })
  })
})
