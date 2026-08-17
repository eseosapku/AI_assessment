import { describe, it, expect } from 'vitest'
import {
  nextBackoffMs,
  shouldRetry,
  pruneQueue,
  upsert,
  removeById,
  isRetryableStatus,
  MAX_ATTEMPTS,
  MAX_AGE_MS,
  MAX_QUEUED,
  type PendingSubmission,
} from './offline-submission'

const item = (id: string, over: Partial<PendingSubmission> = {}): PendingSubmission => ({
  id,
  payload: { score: 1 },
  queuedAt: Date.now(),
  attempts: 0,
  ...over,
})

describe('nextBackoffMs', () => {
  it('grows exponentially', () => {
    const mid = () => 0.5
    expect(nextBackoffMs(0, mid)).toBe(1000)
    expect(nextBackoffMs(1, mid)).toBe(2000)
    expect(nextBackoffMs(3, mid)).toBe(8000)
  })

  it('caps the delay', () => {
    expect(nextBackoffMs(99, () => 0.5)).toBe(60_000)
  })

  it('applies jitter so a whole classroom does not retry in the same instant', () => {
    const low = nextBackoffMs(3, () => 0)
    const high = nextBackoffMs(3, () => 1)
    expect(low).toBeLessThan(high)
    expect(low).toBeGreaterThan(0)
  })

  it('handles malformed attempt counts', () => {
    for (const bad of [NaN, -5, undefined]) {
      expect(nextBackoffMs(bad as never, () => 0.5)).toBe(1000)
    }
  })
})

describe('shouldRetry', () => {
  it('stops at the attempt ceiling', () => {
    expect(shouldRetry({ attempts: 0 })).toBe(true)
    expect(shouldRetry({ attempts: MAX_ATTEMPTS - 1 })).toBe(true)
    expect(shouldRetry({ attempts: MAX_ATTEMPTS })).toBe(false)
  })

  it('treats a missing count as fresh', () => {
    expect(shouldRetry({} as never)).toBe(true)
  })
})

describe('isRetryableStatus', () => {
  it('retries network failures and server errors', () => {
    expect(isRetryableStatus(null)).toBe(true)
    expect(isRetryableStatus(undefined)).toBe(true)
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
  })

  it('retries the explicit try-again statuses', () => {
    expect(isRetryableStatus(408)).toBe(true)
    expect(isRetryableStatus(429)).toBe(true)
  })

  it('does not retry a refusal', () => {
    // Retrying a 400 or 401 just burns the queue against a server that already
    // understood and said no.
    for (const s of [400, 401, 403, 404, 422]) {
      expect(isRetryableStatus(s)).toBe(false)
    }
  })

  it('does not retry a success', () => {
    expect(isRetryableStatus(200)).toBe(false)
  })
})

describe('pruneQueue', () => {
  it('drops entries past the age limit', () => {
    const now = Date.now()
    const out = pruneQueue([
      item('old', { queuedAt: now - MAX_AGE_MS - 1000 }),
      item('fresh', { queuedAt: now }),
    ], now)
    expect(out.map((i) => i.id)).toEqual(['fresh'])
  })

  it('keeps an entry exactly at the limit', () => {
    const now = Date.now()
    expect(pruneQueue([item('edge', { queuedAt: now - MAX_AGE_MS })], now)).toHaveLength(1)
  })

  it('caps the queue, keeping the newest', () => {
    const many = Array.from({ length: MAX_QUEUED + 5 }, (_, i) => item(`i${i}`))
    const out = pruneQueue(many)
    expect(out).toHaveLength(MAX_QUEUED)
    expect(out[out.length - 1].id).toBe(`i${MAX_QUEUED + 4}`)
  })

  it('drops malformed entries instead of throwing', () => {
    const out = pruneQueue([null as never, { id: '' } as never, item('ok')])
    expect(out.map((i) => i.id)).toEqual(['ok'])
  })

  it('keeps entries with a future timestamp rather than discarding work', () => {
    // A device with a wrong clock must not silently lose a student's attempt.
    const now = Date.now()
    expect(pruneQueue([item('future', { queuedAt: now + 60_000 })], now)).toHaveLength(1)
  })

  it('handles non-array input', () => {
    expect(pruneQueue(null as never)).toEqual([])
  })
})

describe('upsert', () => {
  it('adds a new entry', () => {
    expect(upsert([], item('a')).map((i) => i.id)).toEqual(['a'])
  })

  it('replaces by id rather than stacking duplicates', () => {
    // This is what makes a retry safe: re-queuing after a failed send must not
    // create a second result the server has to reconcile.
    const out = upsert([item('a', { attempts: 0 })], item('a', { attempts: 3 }))
    expect(out).toHaveLength(1)
    expect(out[0].attempts).toBe(3)
  })

  it('preserves other entries', () => {
    const out = upsert([item('a'), item('b')], item('a', { attempts: 1 }))
    expect(out.map((i) => i.id).sort()).toEqual(['a', 'b'])
  })
})

describe('removeById', () => {
  it('removes the sent entry only', () => {
    expect(removeById([item('a'), item('b')], 'a').map((i) => i.id)).toEqual(['b'])
  })

  it('is a no-op for an unknown id', () => {
    expect(removeById([item('a')], 'zzz')).toHaveLength(1)
  })

  it('handles non-array input', () => {
    expect(removeById(null as never, 'a')).toEqual([])
  })
})
