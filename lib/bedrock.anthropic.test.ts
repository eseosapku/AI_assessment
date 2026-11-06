import { beforeEach, describe, expect, it, vi } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class { send = send },
  InvokeModelCommand: class { constructor(public input: any) {} },
}))
vi.mock('@/lib/aws-config', () => ({
  getBedrockCredentials: () => ({ accessKeyId: 'test', secretAccessKey: 'test' }),
  getBedrockRegion: () => 'eu-west-1', hasBedrockCredentials: () => true,
  BEDROCK_CREDENTIALS_ERROR: 'missing credentials',
}))
import { callGemma } from './bedrock'

describe('Claude through the shared Bedrock helper', () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ body: new TextEncoder().encode(JSON.stringify({ content: [{ type: 'text', text: '{"issues":[]}' }] })) })
  })
  it('uses the Anthropic protocol and reads its text response', async () => {
    expect(await callGemma('Review this question.', { model: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0', temperature: 0 })).toBe('{"issues":[]}')
    const body = JSON.parse(send.mock.calls[0][0].input.body)
    expect(body.anthropic_version).toBe('bedrock-2023-05-31')
    expect(body.messages[0].content).toEqual([{ type: 'text', text: 'Review this question.' }])
    expect(body.max_tokens).toBe(2000)
  })
  it('sends figure pixels as an Anthropic image source', async () => {
    await callGemma('Read the labelled figure.', { model: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0', image: { base64: 'aW1hZ2U=', mimeType: 'image/png' } })
    const body = JSON.parse(send.mock.calls[0][0].input.body)
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aW1hZ2U=' } })
  })
})
