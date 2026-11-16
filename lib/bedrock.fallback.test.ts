// lib/bedrock.fallback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * A lesson must not stop because one model is busy. Haiku 4.5 answered every
 * call in eu-west-1 with ServiceUnavailable for a stretch of a real session
 * while Sonnet answered at once; a call that names a fallback takes it for a
 * busy model, and only for a busy model.
 */
const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    send(...args: unknown[]) {
      return send(...args)
    }
  },
  InvokeModelCommand: class {
    input: { modelId: string }
    constructor(input: { modelId: string }) {
      this.input = input
    }
  },
}))
vi.mock('@/lib/aws-config', () => ({
  BEDROCK_CREDENTIALS_ERROR: 'no credentials',
  getBedrockCredentials: () => ({ accessKeyId: 'a', secretAccessKey: 'b' }),
  getBedrockRegion: () => 'eu-west-1',
  hasBedrockCredentials: () => true,
}))
vi.mock('@/lib/ai-usage-recorder', () => ({ withUsageTracking: (_: unknown, fn: () => unknown) => fn() }))

import { callGemma } from './bedrock'

const HAIKU = 'anthropic.claude-haiku-4-5-20251001-v1:0'
const SONNET = 'anthropic.claude-sonnet-4-5-20250929-v1:0'
const busy = () => Object.assign(new Error('Bedrock is unable to process your request.'), { name: 'ServiceUnavailableException' })
const reply = (text: string) => ({ body: new TextEncoder().encode(JSON.stringify({ content: [{ type: 'text', text }] })) })

beforeEach(() => {
  send.mockReset()
  // Past any minute a model was left alone for in an earlier test.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 10 * 60_000)
})

describe('callGemma with a fallback model', () => {
  it('takes the fallback when the model is busy', async () => {
    send.mockImplementation(async (...args: unknown[]) => {
      const cmd = args[0] as { input: { modelId: string } }
      if (cmd.input.modelId.includes('haiku')) throw busy()
      return reply('{"ok":true}')
    })
    await expect(callGemma('p', { model: HAIKU, fallbackModel: SONNET })).resolves.toBe('{"ok":true}')
    expect(send.mock.calls.some(([c]) => c.input.modelId.includes('sonnet'))).toBe(true)
  })

  it('fails as before when no fallback is named', async () => {
    send.mockRejectedValue(busy())
    await expect(callGemma('p', { model: HAIKU })).rejects.toMatchObject({ name: 'ServiceUnavailableException' })
  })

  it('does not hand a broken request to the fallback', async () => {
    send.mockRejectedValue(Object.assign(new Error('messages: Field required'), { name: 'ValidationException' }))
    await expect(callGemma('p', { model: HAIKU, fallbackModel: SONNET })).rejects.toMatchObject({ name: 'ValidationException' })
    expect(send.mock.calls.some(([c]) => c.input.modelId.includes('sonnet'))).toBe(false)
  })

  it('leaves a busy model alone for a minute -- each try cost six seconds of a 24-second turn -- then asks it again', async () => {
    send.mockImplementation(async (cmd: { input: { modelId: string } }) => {
      if (cmd.input.modelId.includes('haiku')) throw busy()
      return reply('{"ok":true}')
    })
    const haikuTries = () => send.mock.calls.filter(([c]) => c.input.modelId.includes('haiku')).length
    await callGemma('p', { model: HAIKU, fallbackModel: SONNET })
    expect(haikuTries()).toBe(1)
    await callGemma('p', { model: HAIKU, fallbackModel: SONNET })
    expect(haikuTries()).toBe(1)
    vi.setSystemTime(Date.now() + 61_000)
    await callGemma('p', { model: HAIKU, fallbackModel: SONNET })
    expect(haikuTries()).toBe(2)
  })
})

/**
 * "Too many requests" is not a struggling model: it comes back in under a
 * second, and the next ask often goes through. Kimi refused 5 of 12 single
 * calls on 2026-11-15 with nothing else running; benched for a minute on the
 * first refusal, a lesson ran almost wholly on its fallback.
 */
describe('a model that says too many requests', () => {
  const KIMI = 'global.moonshotai.kimi-k3.1'
  const QWEN = 'qwen.qwen3-next-80b-a3b'
  const throttled = () => Object.assign(new Error('Too many requests, please wait before trying again.'), { name: 'ThrottlingException', $metadata: { httpStatusCode: 429 } })
  const kimiTries = () => send.mock.calls.filter(([c]) => c.input.modelId.includes('kimi')).length
  const qwenTries = () => send.mock.calls.filter(([c]) => c.input.modelId.includes('qwen')).length
  const settle = async <T,>(p: Promise<T>) => { await vi.advanceTimersByTimeAsync(5_000); return p }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
    vi.setSystemTime(Date.now() + 10 * 60_000)
  })

  it('is asked once more, after a short pause, before the fallback', async () => {
    let n = 0
    send.mockImplementation(async (cmd: { input: { modelId: string } }) => {
      if (cmd.input.modelId.includes('kimi') && n++ === 0) throw throttled()
      return reply('{"from":"kimi"}')
    })
    await expect(settle(callGemma('p', { model: KIMI, fallbackModel: QWEN }))).resolves.toBe('{"from":"kimi"}')
    expect(kimiTries()).toBe(2)
    expect(qwenTries()).toBe(0)
  })

  it('hands over to the fallback when it refuses again, and is left alone for 15 seconds, not a minute', async () => {
    send.mockImplementation(async (cmd: { input: { modelId: string } }) => {
      if (cmd.input.modelId.includes('kimi')) throw throttled()
      return reply('{"from":"qwen"}')
    })
    await expect(settle(callGemma('p', { model: KIMI, fallbackModel: QWEN }))).resolves.toBe('{"from":"qwen"}')
    expect(kimiTries()).toBe(2)
    await settle(callGemma('p', { model: KIMI, fallbackModel: QWEN }))
    expect(kimiTries()).toBe(2)
    vi.setSystemTime(Date.now() + 16_000)
    await settle(callGemma('p', { model: KIMI, fallbackModel: QWEN }))
    expect(kimiTries()).toBe(4)
  })

  it('is asked once more when no fallback is named, then fails as before', async () => {
    send.mockRejectedValue(throttled())
    // Caught before the clock moves, so the refusal is never unhandled.
    const out = callGemma('p', { model: KIMI }).catch((e) => e)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await out).toMatchObject({ name: 'ThrottlingException' })
    expect(kimiTries()).toBe(2)
  })
})
