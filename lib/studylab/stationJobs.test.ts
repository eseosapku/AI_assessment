// lib/studylab/stationJobs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { query, txQuery } = vi.hoisted(() => ({ query: vi.fn(), txQuery: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    query,
    withStatementTimeout: async (_ms: number, fn: (q: typeof txQuery) => unknown) => fn(txQuery),
  },
}))

import { stationVersion, nextPass, claimPass, authorState, finishPass, failPass, sendBack } from './stationJobs'

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
  it('takes one lock for the whole station, so a claim never lands between a send-back\'s writes', async () => {
    txQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'job-1' }] })
    await claimPass('space', 's1', 'v1', 'verify')
    expect(txQuery.mock.calls[0][1]).toEqual(['author_station:space:s1:v1'])
  })
  it('claims a pass only while every pass before it stands written -- never verify over parts being sent back', async () => {
    txQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
    await claimPass('space', 's1', 'v1', 'verify')
    const [sql, values] = txQuery.mock.calls[1]
    expect(String(sql)).toMatch(/= ANY\(\$7/)
    expect(values.slice(6)).toEqual([['explore', 'name', 'practice_check'], 3])
    txQuery.mockReset()
    txQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'job-2' }] })
    await claimPass('space', 's1', 'v1', 'explore')
    expect(txQuery.mock.calls[1][1].slice(6)).toEqual([[], 0])
  })
  it('returns null when the pass is already running or done', async () => {
    txQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
    expect(await claimPass('space', 's1', 'v1', 'name')).toBeNull()
  })
  it('names the type of the job it inserts -- Postgres refused a parameter selected as text and compared as varchar', async () => {
    txQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'job-1' }] })
    await claimPass('space', 's1', 'v1', 'name')
    // Found live: "inconsistent types deduced for parameter $1 -- text versus character varying".
    expect(String(txQuery.mock.calls[1][0])).toMatch(/SELECT \$1::varchar,/)
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
  it('hands back what was last found wrong with each pass, so the next try is told', async () => {
    const failed = (pass: string, error_message: string) => ({ ...row(pass, 'failed'), error_message })
    query.mockResolvedValue({ rows: [
      failed('practice_check', 'redone: feedback on option 2 names the wrong multiplier'),
      failed('verify', 'feedback on option 2 names the wrong multiplier'),
      failed('explore', 'the material cannot be solved'),
      failed('name', '[error] ServiceUnavailableException: busy'),
    ] })
    const s = await authorState('space', 's1', 'v1')
    expect(s.lastFailure).toEqual({
      practice_check: 'feedback on option 2 names the wrong multiplier',
      verify: 'feedback on option 2 names the wrong multiplier',
      explore: 'the material cannot be solved',
    })
  })

  it('charges a redo only to the pass at fault, not to the passes written on top of it', async () => {
    const failed = (pass: string, error_message: string) => ({ ...row(pass, 'failed'), error_message })
    query.mockResolvedValue({ rows: [
      failed('explore', 'redone: the series is upside down'),
      failed('name', 'superseded: the series is upside down'),
      failed('practice_check', 'superseded: the series is upside down'),
      failed('practice_check', '[error] AbortError: Request aborted'),
    ] })
    const s = await authorState('space', 's1', 'v1')
    expect(s.status).not.toBe('failed')
    expect(s.retries).toBe(1)
    expect(s.lastFailure).toEqual({ explore: 'the series is upside down' })
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

describe('sendBack', () => {
  it("sends a verified station's faulted part back in one transaction, under the station's lock", async () => {
    txQuery.mockResolvedValue({ rows: [] })
    await sendBack('space', 's1', 'v1', 'job-4', 'the series is upside down', 'explore')
    expect(String(txQuery.mock.calls[0][0])).toMatch(/pg_advisory_xact_lock/)
    expect(txQuery.mock.calls[0][1]).toEqual(['author_station:space:s1:v1'])
    // Verify did its job: recorded, uncharged.
    expect(txQuery.mock.calls[1][1]).toEqual(['job-4', 'superseded: the series is upside down'])
    // The faulted part charged, what was built on it superseded -- in one statement.
    const [sql, values] = txQuery.mock.calls[2]
    expect(String(sql)).toMatch(/CASE WHEN input_payload->>'pass' = \$6/)
    expect(String(sql)).toMatch(/status = 'succeeded'/)
    expect(values).toEqual(['author_station', 'space', 's1', 'v1', ['explore', 'name', 'practice_check'], 'explore', 'the series is upside down'])
  })
  it('sends back only the faulted part and what follows it', async () => {
    txQuery.mockResolvedValue({ rows: [] })
    await sendBack('space', 's1', 'v1', 'job-4', 'feedback on option 2 is wrong', 'practice_check')
    expect(txQuery.mock.calls[2][1][4]).toEqual(['practice_check'])
  })
  it('records a verify that sent a part back without charging it -- the part it faulted is charged', async () => {
    query.mockResolvedValue({ rows: [] })
    await failPass('job-4', 'the series is upside down', false)
    expect(query.mock.calls[0][1]).toEqual(['job-4', 'superseded: the series is upside down'])
  })
})
