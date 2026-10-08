import { describe, it, expect } from 'vitest'
import {
  resolveEnvironment,
  extractTokens,
  extractProviderRequestId,
  errorCodeOf,
  buildUsageEvent,
  usageEventValues,
  USAGE_EVENT_COLUMNS,
} from './ai-usage'

const base = {
  modelId: 'amazon.nova-lite-v1:0',
  feature: 'generate_assessment',
  requestId: '11111111-1111-4111-8111-111111111111',
  startedAt: 1_000,
  finishedAt: 3_500,
  environment: 'production' as const,
  newId: () => 'fixed-id',
}

describe('resolveEnvironment', () => {
  it('takes an explicit setting over anything inferred', () => {
    expect(resolveEnvironment({ APP_ENVIRONMENT: 'staging', NODE_ENV: 'production' } as never)).toBe('staging')
  })

  it('reads the Amplify branch, which is what actually identifies a deploy', () => {
    expect(resolveEnvironment({ AWS_BRANCH: 'main' } as never)).toBe('production')
    expect(resolveEnvironment({ AWS_BRANCH: 'aws_deploy' } as never)).toBe('staging')
    expect(resolveEnvironment({ AWS_BRANCH: 'feat/whatever' } as never)).toBe('development')
  })

  it('falls back to NODE_ENV', () => {
    expect(resolveEnvironment({ NODE_ENV: 'production' } as never)).toBe('production')
    expect(resolveEnvironment({ NODE_ENV: 'test' } as never)).toBe('development')
  })

  it('says unknown rather than filing local traffic under production', () => {
    expect(resolveEnvironment({} as never)).toBe('unknown')
  })
})

describe('extractTokens', () => {
  it('reads the Nova and converse shape', () => {
    expect(extractTokens({ usage: { inputTokens: 120, outputTokens: 45, totalTokens: 165 } })).toEqual({
      inputTokens: 120, outputTokens: 45, totalTokens: 165,
    })
  })

  it('reads the OpenAI-style shape Gemma answers in', () => {
    // Logged with a total and no split, so a tutor call could not be priced.
    expect(extractTokens({ usage: { prompt_tokens: 3100, completion_tokens: 640, total_tokens: 3740 } })).toEqual({
      inputTokens: 3100, outputTokens: 640, totalTokens: 3740,
    })
  })

  it('reads the invocation-metrics shape Bedrock adds to some models', () => {
    expect(extractTokens({ amazonBedrockInvocationMetrics: { inputTokenCount: 10, outputTokenCount: 5 } })).toEqual({
      inputTokens: 10, outputTokens: 5, totalTokens: 15,
    })
  })

  it('derives a missing total only when both halves are known', () => {
    expect(extractTokens({ usage: { inputTokens: 10, outputTokens: 5 } }).totalTokens).toBe(15)
    // Adding a null to a number would report half the spend as the whole of it.
    expect(extractTokens({ usage: { inputTokens: 10 } }).totalTokens).toBeNull()
  })

  it('reads the two-halves shape with no total', () => {
    expect(extractTokens({ input_token_count: 8, generation_token_count: 3 })).toEqual({
      inputTokens: 8, outputTokens: 3, totalTokens: 11,
    })
  })

  it('returns nulls, never zeroes, when a model reports nothing', () => {
    // A zero would quietly understate spend in every total built on this table.
    expect(extractTokens({ completion: 'text' })).toEqual({
      inputTokens: null, outputTokens: null, totalTokens: null,
    })
    expect(extractTokens(null)).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null })
    expect(extractTokens('nonsense')).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null })
  })

  it('rejects counts the schema itself would refuse', () => {
    expect(extractTokens({ usage: { inputTokens: -4, outputTokens: 2.5 } })).toEqual({
      inputTokens: null, outputTokens: null, totalTokens: null,
    })
  })
})

describe('extractProviderRequestId', () => {
  it('takes the id AWS returns, for reconciling against the bill', () => {
    expect(extractProviderRequestId({ $metadata: { requestId: 'abc-123' } })).toBe('abc-123')
  })

  it('is null when there is none', () => {
    expect(extractProviderRequestId({})).toBeNull()
    expect(extractProviderRequestId(null)).toBeNull()
    expect(extractProviderRequestId({ $metadata: { requestId: '  ' } })).toBeNull()
  })
})

describe('errorCodeOf', () => {
  it('prefers the SDK error name, which groups', () => {
    expect(errorCodeOf({ name: 'ThrottlingException', message: 'Rate exceeded at 12:04' }))
      .toBe('ThrottlingException')
  })

  it('falls back to the message when the name says nothing', () => {
    expect(errorCodeOf(new Error('Model not available'))).toBe('Model not available')
  })

  it('handles an error with neither', () => {
    expect(errorCodeOf({})).toBe('UnknownError')
  })

  it('is null for no error at all', () => {
    expect(errorCodeOf(null)).toBeNull()
    expect(errorCodeOf(undefined)).toBeNull()
  })
})

describe('buildUsageEvent', () => {
  it('records a successful call with its tokens and latency', () => {
    const e = buildUsageEvent({
      ...base,
      response: { $metadata: { requestId: 'aws-1' } },
      responseBody: { usage: { inputTokens: 100, outputTokens: 20 } },
      userId: 'user-1',
    })
    expect(e.status).toBe('succeeded')
    expect(e.latencyMs).toBe(2500)
    expect(e.tokens).toEqual({ inputTokens: 100, outputTokens: 20, totalTokens: 120 })
    expect(e.providerRequestId).toBe('aws-1')
    expect(e.errorCode).toBeNull()
    expect(e.userId).toBe('user-1')
  })

  it('records a failure without inventing token counts', () => {
    // A failed call may still have burned input tokens, but the response we
    // would read them from never arrived — guessing would corrupt the ledger.
    const e = buildUsageEvent({ ...base, error: { name: 'ValidationException' } })
    expect(e.status).toBe('failed')
    expect(e.errorCode).toBe('ValidationException')
    expect(e.tokens).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null })
  })

  it('never produces a negative latency', () => {
    // A clock that moves backwards mid-request would otherwise produce a value
    // the schema's CHECK rejects, losing the event entirely.
    expect(buildUsageEvent({ ...base, startedAt: 5_000, finishedAt: 1_000 }).latencyMs).toBe(0)
  })

  it('defaults the platform to this one, since the table serves two', () => {
    expect(buildUsageEvent(base).platform).toBe('studysquare')
    expect(buildUsageEvent({ ...base, platform: 'brainink_grading' }).platform).toBe('brainink_grading')
  })

  it('leaves every optional correlation id null rather than empty', () => {
    const e = buildUsageEvent(base)
    for (const k of ['jobId', 'userId', 'schoolId', 'classroomId', 'assessmentId', 'assignmentId', 'resultId'] as const) {
      expect(e[k], k).toBeNull()
    }
  })

  it('survives a model id or feature that never arrived', () => {
    const e = buildUsageEvent({ ...base, modelId: '', feature: '' })
    expect(e.modelId).toBe('unknown')
    expect(e.feature).toBe('unknown')
  })
})

describe('usageEventValues', () => {
  it('lines up with the column list, so the two cannot drift', () => {
    const values = usageEventValues(buildUsageEvent(base))
    expect(values).toHaveLength(USAGE_EVENT_COLUMNS.length)
  })

  it('serialises metadata as JSON and dates as ISO', () => {
    const values = usageEventValues(buildUsageEvent({ ...base, metadata: { topics: 3 } }))
    expect(values[USAGE_EVENT_COLUMNS.indexOf('usage_metadata')]).toBe('{"topics":3}')
    expect(String(values[USAGE_EVENT_COLUMNS.indexOf('occurred_at')])).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes nulls through rather than converting them to zero', () => {
    const values = usageEventValues(buildUsageEvent(base))
    expect(values[USAGE_EVENT_COLUMNS.indexOf('input_tokens')]).toBeNull()
    expect(values[USAGE_EVENT_COLUMNS.indexOf('error_code')]).toBeNull()
  })
})
