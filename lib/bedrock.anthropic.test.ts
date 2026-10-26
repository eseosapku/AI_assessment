import { describe, it, expect } from 'vitest'
import { buildInvokeBody, extractText } from './bedrock'

describe('Claude on Bedrock', () => {
  const id = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

  it('sends the Anthropic message body', () => {
    expect(JSON.parse(buildInvokeBody(id, 'Hello', 900, 0.4))).toEqual({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 900,
      temperature: 0.4,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
    })
  })

  it('puts an image before the text, base64 with its media type', () => {
    const body = JSON.parse(buildInvokeBody(id, 'What is this?', 500, 0, { base64: 'AAAA', mimeType: 'image/png' }))
    expect(body.messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
      { type: 'text', text: 'What is this?' },
    ])
  })

  it('reads every text block of the reply, and nothing from an empty one', () => {
    expect(extractText(id, { content: [{ type: 'text', text: '{"say":' }, { type: 'text', text: '"hi"}' }] })).toBe('{"say":"hi"}')
    expect(extractText(id, { content: [] })).toBe('')
    expect(extractText(id, {})).toBe('')
  })
})
