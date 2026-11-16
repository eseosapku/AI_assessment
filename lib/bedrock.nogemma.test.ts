// lib/bedrock.nogemma.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * callModel used to append google.gemma-3-12b-it candidates to every call, so a
 * lesson job whose model id was unusable quietly ran on Gemma 12B. A caller that
 * opts out gets the error instead; a busy model still goes to its named fallback.
 */
const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    send(...args: unknown[]) {
      return send(...args)
    }
  },
  InvokeModelCommand: class {
    input: { modelId: string; body: string }
    constructor(input: { modelId: string; body: string }) {
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

import { callGemma, resetWorkingModels } from './bedrock'

const KIMI = 'global.moonshotai.kimi-k3.1'
const badId = () => Object.assign(new Error('The provided model identifier is invalid.'), { name: 'ValidationException' })
const busy = () => Object.assign(new Error('Bedrock is unable to process your request.'), { name: 'ServiceUnavailableException' })
const ok = (text: string) => ({ body: new TextEncoder().encode(JSON.stringify({ choices: [{ message: { content: text } }] })) })
const ids = () => send.mock.calls.map(([c]) => c.input.modelId as string)

beforeEach(() => {
  send.mockReset()
  resetWorkingModels()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 20 * 60_000)
})

describe('noGemmaFallback', () => {
  it('raises on an unusable model id instead of answering from Gemma 12B', async () => {
    send.mockRejectedValue(badId())
    await expect(callGemma('p', { model: KIMI, noGemmaFallback: true })).rejects.toThrow(/model identifier/)
    expect(ids()).toEqual([KIMI])
  })

  it('still walks to Gemma 12B for callers that do not opt in', async () => {
    send.mockRejectedValue(badId())
    await expect(callGemma('p', { model: KIMI })).rejects.toBeTruthy()
    expect(ids().some((i) => i.includes('gemma-3-12b'))).toBe(true)
  })

  it('sends reasoning_effort and headroom to Kimi, and returns the answer only', async () => {
    send.mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({ choices: [{ message: { content: '<think>x</think>Hi', reasoning_content: 'x' } }] })),
    })
    await expect(callGemma('p', { model: KIMI, maxTokens: 350, reasoningEffort: 'low', noGemmaFallback: true })).resolves.toBe('Hi')
    expect(JSON.parse(send.mock.calls[0][0].input.body)).toMatchObject({ reasoning_effort: 'low', max_tokens: 3350 })
  })

  it('a busy model still goes to the named fallback', async () => {
    send.mockImplementation(async (cmd: { input: { modelId: string } }) => {
      if (cmd.input.modelId === KIMI) throw busy()
      return ok('fine')
    })
    await expect(
      callGemma('p', { model: KIMI, fallbackModel: 'qwen.qwen3-next-80b-a3b', reasoningEffort: 'low', noGemmaFallback: true }),
    ).resolves.toBe('fine')
    expect(ids()[1]).toBe('eu.qwen.qwen3-next-80b-a3b')
    // Qwen takes no reasoning setting.
    expect(send.mock.calls[1][0].input.body).not.toMatch(/reasoning/)
  })
})
