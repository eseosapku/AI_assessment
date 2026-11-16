// lib/ai-jobs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const query = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ db: { query } }))

import { getAiJob, AI_JOB_TYPES } from './ai-jobs'

beforeEach(() => query.mockReset())

describe('getAiJob', () => {
  it('reads only the job types the public API creates -- never a station written ahead, whose result holds a check\'s answers', async () => {
    query.mockResolvedValue({ rows: [] })
    await getAiJob('job-1')
    const [sql, values] = query.mock.calls[0]
    expect(String(sql)).toMatch(/job_type = ANY\(\$2\)/)
    expect(values).toEqual(['job-1', [...AI_JOB_TYPES]])
    expect(values[1]).not.toContain('author_station')
  })
})
