import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const query = vi.fn()
vi.mock('@/lib/db', () => ({ db: { query: (...args: unknown[]) => query(...args) } }))

const { recordUsageEvent, withUsageTracking, resetLedgerAvailability } = await import('./ai-usage-recorder')
const { buildUsageEvent } = await import('./ai-usage')

const event = () =>
  buildUsageEvent({
    modelId: 'amazon.nova-lite-v1:0',
    feature: 'generate_assessment',
    requestId: '11111111-1111-4111-8111-111111111111',
    startedAt: 0,
    finishedAt: 100,
    environment: 'production',
    newId: () => 'fixed-id',
  })

let warn: ReturnType<typeof vi.spyOn>
let error: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  query.mockReset().mockResolvedValue({ rows: [] })
  resetLedgerAvailability()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  error = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
  error.mockRestore()
})

describe('recordUsageEvent', () => {
  it('inserts one row with every column bound', async () => {
    await expect(recordUsageEvent(event())).resolves.toBe(true)
    const [sql, values] = query.mock.calls[0]
    expect(sql).toContain('INSERT INTO ai_usage_events')
    // Placeholder count must match the values, or Postgres rejects the whole row.
    expect(String(sql).match(/\$\d+/g)).toHaveLength((values as unknown[]).length)
  })

  it('does not throw when the insert fails', async () => {
    // A student waiting on a quiz must not lose it because analytics failed.
    query.mockRejectedValue(new Error('connection terminated'))
    await expect(recordUsageEvent(event())).resolves.toBe(false)
    expect(error).toHaveBeenCalled()
  })

  it('warns once when the table has not been migrated, then stops trying', async () => {
    // A deployment running ahead of its migration should log once, not on
    // every single model call.
    const missing = Object.assign(new Error('relation does not exist'), { code: '42P01' })
    query.mockRejectedValue(missing)

    await recordUsageEvent(event())
    await recordUsageEvent(event())
    await recordUsageEvent(event())

    expect(warn).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledTimes(1)
  })
})

describe('withUsageTracking', () => {
  const context = {
    modelId: 'amazon.nova-lite-v1:0',
    feature: 'generate_assessment',
    requestId: '11111111-1111-4111-8111-111111111111',
  }

  it('returns exactly what the call returned', async () => {
    const result = await withUsageTracking(context, async () => ({ ok: true }))
    expect(result).toEqual({ ok: true })
  })

  it('records the tokens the caller parses out of the response', async () => {
    await withUsageTracking(
      { ...context, parseBody: () => ({ usage: { inputTokens: 30, outputTokens: 12 } }) },
      async () => ({ $metadata: { requestId: 'aws-9' } }),
    )
    const values = query.mock.calls[0][1] as unknown[]
    expect(values).toContain(30)
    expect(values).toContain(12)
    expect(values).toContain('aws-9')
  })

  it('rethrows the original error unchanged', async () => {
    // The caller's retry logic must see exactly what it would have seen
    // without telemetry in the way.
    const boom = Object.assign(new Error('nope'), { name: 'ThrottlingException' })
    await expect(withUsageTracking(context, async () => { throw boom })).rejects.toBe(boom)
  })

  it('records a failure with its error code', async () => {
    await withUsageTracking(context, async () => {
      throw Object.assign(new Error('rate'), { name: 'ThrottlingException' })
    }).catch(() => {})
    const values = query.mock.calls[0][1] as unknown[]
    expect(values).toContain('failed')
    expect(values).toContain('ThrottlingException')
  })

  it('survives a parser that throws, without failing the call', async () => {
    const result = await withUsageTracking(
      { ...context, parseBody: () => { throw new Error('bad json') } },
      async () => 'fine',
    )
    expect(result).toBe('fine')
    expect(query).toHaveBeenCalled()
  })

  it('does not fail the call when recording itself throws', async () => {
    query.mockRejectedValue(new Error('db down'))
    await expect(withUsageTracking(context, async () => 'fine')).resolves.toBe('fine')
  })
})
