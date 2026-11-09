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

describe('global. and apac. profiles', () => {
  it('route by the model behind the prefix', () => {
    const nova = JSON.parse(buildInvokeBody('global.amazon.nova-2-lite-v1:0', 'Hi', 100, 0.3))
    expect(nova).toEqual({ messages: [{ role: 'user', content: [{ text: 'Hi' }] }], inferenceConfig: { maxTokens: 100, temperature: 0.3 } })
    const claude = JSON.parse(buildInvokeBody('apac.anthropic.claude-haiku-4-5-20251001-v1:0', 'Hi', 100, 0))
    expect(claude.anthropic_version).toBe('bedrock-2023-05-31')
    expect(extractText('global.amazon.nova-2-lite-v1:0', { output: { message: { content: [{ text: 'ok' }] } } })).toBe('ok')
  })
})

describe('reasoning_effort', () => {
  const KIMI = 'global.moonshotai.kimi-k3.1'
  it('is sent to Kimi, GPT-OSS and MiniMax only', () => {
    for (const id of [KIMI, 'openai.gpt-oss-120b-1:0', 'eu.minimax.minimax-m2']) {
      expect(JSON.parse(buildInvokeBody(id, 'Hi', 350, 0.4, undefined, 'low')).reasoning_effort, id).toBe('low')
    }
    for (const id of ['google.gemma-3-12b-it', 'amazon.nova-lite-v1:0', 'meta.llama3-70b-instruct-v1:0', 'mistral.mistral-large-2402-v1:0', 'qwen.qwen3-next-80b-a3b', 'eu.anthropic.claude-haiku-4-5-20251001-v1:0']) {
      expect(buildInvokeBody(id, 'Hi', 350, 0.4, undefined, 'low'), id).not.toMatch(/reasoning/)
    }
  })
  it('is absent when no effort is asked for', () => {
    expect(JSON.parse(buildInvokeBody(KIMI, 'Hi', 350, 0.4))).toEqual({ messages: [{ role: 'user', content: 'Hi' }], max_tokens: 350, temperature: 0.4 })
  })
  it('adds 3000 tokens of headroom only when thinking is on', () => {
    expect(JSON.parse(buildInvokeBody(KIMI, 'Hi', 350, 0.4, undefined, 'low')).max_tokens).toBe(3350)
    expect(JSON.parse(buildInvokeBody(KIMI, 'Hi', 350, 0.4, undefined, 'high')).max_tokens).toBe(3350)
    expect(JSON.parse(buildInvokeBody(KIMI, 'Hi', 350, 0.4, undefined, 'none'))).toMatchObject({ max_tokens: 350, reasoning_effort: 'none' })
    // Not sent, so no headroom either.
    expect(JSON.parse(buildInvokeBody('amazon.nova-lite-v1:0', 'Hi', 350, 0.4, undefined, 'low')).inferenceConfig.maxTokens).toBe(350)
  })
  it('keeps the field with an image', () => {
    const b = JSON.parse(buildInvokeBody(KIMI, 'Hi', 350, 0, { base64: 'AA', mimeType: 'image/png' }, 'low'))
    expect(b.reasoning_effort).toBe('low')
    expect(b.max_tokens).toBe(3350)
  })
})

describe('extractText answers only', () => {
  const KIMI = 'global.moonshotai.kimi-k3.1'
  it('ignores a separate reasoning field', () => {
    expect(extractText(KIMI, { choices: [{ message: { content: ' Answer ', reasoning_content: 'thinking hard' } }] })).toBe('Answer')
  })
  it('strips inline think and reasoning blocks', () => {
    expect(extractText('openai.gpt-oss-120b-1:0', { choices: [{ message: { content: '<reasoning>let me see\nok</reasoning>\n{"a":1}' } }] })).toBe('{"a":1}')
    expect(extractText('minimax.minimax-m2', { choices: [{ message: { content: '<think>hmm</think>Done <think>again</think>.' } }] })).toBe('Done .')
    expect(extractText('minimax.minimax-m2', { choices: [{ message: { content: 'thought about it</think>Final' } }] })).toBe('Final')
  })
  it('skips reasoning parts in a content array', () => {
    expect(extractText(KIMI, { choices: [{ message: { content: [{ type: 'reasoning', text: 'x' }, { type: 'text', text: 'Hi' }] } }] })).toBe('Hi')
  })
})

describe('the checker body for a non-Anthropic model', () => {
  it('is the OpenAI-style body, with thinking low and headroom', () => {
    const b = JSON.parse(buildInvokeBody('global.moonshotai.kimi-k3.1', 'Check this', 4000, 0, undefined, 'low'))
    expect(b).toEqual({ messages: [{ role: 'user', content: 'Check this' }], max_tokens: 7000, temperature: 0, reasoning_effort: 'low' })
    expect(b.anthropic_version).toBeUndefined()
  })
})
