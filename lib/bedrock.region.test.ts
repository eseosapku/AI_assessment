// lib/bedrock.region.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Mistral Large 3 is served in us-east-1 only, with no inference profile:
 * asked from eu-west-1, Bedrock answers "The provided model identifier is
 * invalid" (2026-11-16). As the teaching backup it must be called there,
 * while everything else stays in the app's own region.
 */
const { sent } = vi.hoisted(() => ({ sent: [] as { region: string; modelId: string }[] }))
const { busyKimi } = vi.hoisted(() => ({ busyKimi: { on: false } }))
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    region: string
    constructor(config: { region: string }) {
      this.region = config.region
    }
    async send(cmd: { input: { modelId: string } }) {
      sent.push({ region: this.region, modelId: cmd.input.modelId })
      if (busyKimi.on && cmd.input.modelId.includes('kimi')) {
        throw Object.assign(new Error('Too many requests'), { name: 'ThrottlingException', $metadata: { httpStatusCode: 429 } })
      }
      return { body: new TextEncoder().encode(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] })) }
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

import { callGemma, buildModelCandidates, homeRegionFor } from './bedrock'

const MISTRAL = 'mistral.mistral-large-3-675b-instruct'
const KIMI = 'global.moonshotai.kimi-k3.1'

beforeEach(() => {
  sent.length = 0
  busyKimi.on = false
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] })
  vi.setSystemTime(Date.now() + 10 * 60_000)
})

describe('a model served in one region only', () => {
  it('knows its home region', () => {
    expect(homeRegionFor(MISTRAL)).toBe('us-east-1')
    expect(homeRegionFor(KIMI)).toBeUndefined()
    expect(homeRegionFor('amazon.nova-lite-v1:0')).toBeUndefined()
  })

  it('is tried by its own id, with no regional variants to probe', () => {
    expect(buildModelCandidates(MISTRAL)).toEqual([MISTRAL])
  })

  it('is called in its home region, and the rest in the app region', async () => {
    await callGemma('p', { model: MISTRAL })
    await callGemma('p', { model: KIMI })
    expect(sent).toEqual([{ region: 'us-east-1', modelId: MISTRAL }, { region: 'eu-west-1', modelId: KIMI }])
  })

  it('is called in its home region as the fallback for a busy Kimi', async () => {
    busyKimi.on = true
    const out = callGemma('p', { model: KIMI, fallbackModel: MISTRAL })
    await vi.advanceTimersByTimeAsync(5_000)
    await expect(out).resolves.toBe('{"ok":true}')
    expect(sent.filter((s) => s.modelId === KIMI).every((s) => s.region === 'eu-west-1')).toBe(true)
    expect(sent.at(-1)).toEqual({ region: 'us-east-1', modelId: MISTRAL })
  })
})
