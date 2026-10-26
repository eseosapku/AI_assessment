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
})
