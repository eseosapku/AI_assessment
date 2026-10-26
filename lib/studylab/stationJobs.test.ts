// lib/studylab/stationJobs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { query, txQuery } = vi.hoisted(() => ({ query: vi.fn(), txQuery: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    query,
    withStatementTimeout: async (_ms: number, fn: (q: typeof txQuery) => unknown) => fn(txQuery),
  },
}))

import { stationVersion, nextPass, claimPass, authorState, finishPass, failPass, redoPass } from './stationJobs'

beforeEach(() => {
  query.mockReset()
  txQuery.mockReset()
})

describe('stationVersion -- what a bundle was written for', () => {
  const base = { title: 'Equivalent fractions', goal: 'See that 1/2 and 2/4 are the same amount', position: 0, subject: 'Mathematics' }
  it('is stable for the same step', () => {
    expect(stationVersion(base)).toBe(stationVersion({ ...base }))
    expect(stationVersion(base)).toMatch(/^[0-9a-f]{12,}$/)
  })
  it('changes when the step it was written for changes', () => {
    const v = stationVersion(base)
    expect(stationVersion({ ...base, title: 'Equal fractions' })).not.toBe(v)
    expect(stationVersion({ ...base, goal: 'Order fractions' })).not.toBe(v)
    expect(stationVersion({ ...base, position: 1 })).not.toBe(v)
    expect(stationVersion({ ...base, subject: 'Science' })).not.toBe(v)
  })
})

describe('nextPass', () => {
  it('walks explore, name, practice and check, then verify', () => {
    expect(nextPass([])).toBe('explore')
    expect(nextPass(['explore'])).toBe('name')
    expect(nextPass(['explore', 'name'])).toBe('practice_check')
    expect(nextPass(['explore', 'name', 'practice_check'])).toBe('verify')
    expect(nextPass(['explore', 'name', 'practice_check', 'verify'])).toBeNull()
  })
})

describe('claimPass -- a pass is written once', () => {
  it('takes the station’s lock before it looks, so two tabs cannot both claim', async () => {
    txQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'job-1' }] })
    expect(await claimPass('space', 's1', 'v1', 'name')).toBe('job-1')
    expect(String(txQuery.mock.calls[0][0])).toMatch(/pg_advisory_xact_lock/)
    expect(String(txQuery.mock.calls[1][0])).toMatch(/INSERT INTO ai_jobs/)
    expect(String(txQuery.mock.calls[1][0])).toMatch(/NOT EXISTS/)
    expect(txQuery.mock.calls[1][1]).toContain('author_station')
  })
  it('returns null when the pass is already running or done', async () => {
    txQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
    expect(await claimPass('space', 's1', 'v1', 'name')).toBeNull()
  })
})

describe('authorState', () => {
  const row = (pass: string, status: string, result?: unknown) => ({ id: `${pass}-${status}`, pass, status, result_payload: result ?? null })
  it('is none with nothing written', async () => {
    query.mockResolvedValue({ rows: [] })
    expect(await authorState('space', 's1', 'v1')).toMatchObject({ status: 'none', done: [], retries: 0 })
  })
  it('is authoring part way, with what the passes so far wrote', async () => {
    query.mockResolvedValue({ rows: [row('explore', 'succeeded', { partial: { explore: { opening: 'Look.' } } }), row('name', 'running')] })
    const s = await authorState('space', 's1', 'v1')
    expect(s.status).toBe('authoring')
    expect(s.done).toEqual(['explore'])
    expect(s.partial).toEqual({ explore: { opening: 'Look.' } })
  })
  it('is ready once verify succeeded, with the bundle it passed', async () => {
    query.mockResolvedValue({ rows: [row('explore', 'succeeded', { partial: {} }), row('name', 'succeeded', { partial: {} }), row('practice_check', 'succeeded', { partial: {} }), row('verify', 'succeeded', { bundle: { version: 'v1' } })] })
    expect(await authorState('space', 's1', 'v1')).toMatchObject({ status: 'ready', bundle: { version: 'v1' } })
  })
  it('is failed when one pass failed twice -- the station runs live', async () => {
    query.mockResolvedValue({ rows: [row('explore', 'failed'), row('explore', 'failed')] })
    expect(await authorState('space', 's1', 'v1')).toMatchObject({ status: 'failed', retries: 2 })
  })
  it('reads only this station and this version', async () => {
    query.mockResolvedValue({ rows: [] })
    await authorState('space', 's1', 'v1')
    expect(query.mock.calls[0][1]).toEqual(['author_station', 'space', 's1', 'v1'])
  })
})

describe('finishPass and failPass', () => {
  it('records the result, or the reason, on the row that was claimed', async () => {
    query.mockResolvedValue({ rows: [] })
    await finishPass('job-1', { partial: { version: 'v1' } })
    expect(String(query.mock.calls[0][0])).toMatch(/status = 'succeeded'/)
    expect(query.mock.calls[0][1][0]).toBe('job-1')
    await failPass('job-2', 'no feedback on option 2')
    expect(String(query.mock.calls[1][0])).toMatch(/status = 'failed'/)
    expect(query.mock.calls[1][1]).toEqual(['job-2', 'no feedback on option 2'])
  })
})

describe('redoPass', () => {
  it('turns a written pass back into a failure, so it is written again -- and counts against it', async () => {
    query.mockResolvedValue({ rows: [] })
    await redoPass('space', 's1', 'v1', 'explore', 'the vary models a false relationship')
    const [sql, values] = query.mock.calls[0]
    expect(String(sql)).toMatch(/UPDATE ai_jobs SET status = 'failed'/)
    expect(String(sql)).toMatch(/status = 'succeeded'/)
    expect(values).toEqual(['author_station', 'space', 's1', 'v1', 'explore', 'redone: the vary models a false relationship'])
  })
})
