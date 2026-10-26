// app/api/studylab/[id]/stations/[step]/author/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  query: vi.fn(),
  claimPass: vi.fn(),
  authorState: vi.fn(),
  finishPass: vi.fn(),
  failPass: vi.fn(),
  redoPass: vi.fn(),
  runPass: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ db: { query: h.query } }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true }), identify: () => 'k' }))
vi.mock('@/lib/subscription-server', () => ({ assertSubscriptionAccess: async () => ({ allowed: true }), subscriptionPaywallBody: () => ({}) }))
vi.mock('@/lib/studylab/stationJobs', async (orig) => ({
  ...(await orig<typeof import('@/lib/studylab/stationJobs')>()),
  claimPass: h.claimPass,
  authorState: h.authorState,
  finishPass: h.finishPass,
  failPass: h.failPass,
  redoPass: h.redoPass,
}))
vi.mock('@/app/api/studylab/stations/passes', () => ({ runPass: h.runPass }))

import { POST, GET } from './route'
import { stationVersion } from '@/lib/studylab/stationJobs'

const steps = [
  { id: 's1', title: 'Metals', goal: 'Sort metals', status: 'teaching', cardIds: [] },
  { id: 's2', title: 'Alloys', goal: 'Why alloys are harder', status: 'pending', cardIds: [] },
]
const space = (over: Record<string, unknown> = {}) => ({
  id: 'space-1', user_id: 'u1', title: 'Elements', subject: 'Chemistry',
  lesson_run: { phase: 'teaching', pace: 'step', steps, currentStep: 0, beats: 0, awaiting: false, recipe: 'station', stage: 'explore' },
  ...over,
})
const params = (step = 's2') => ({ params: Promise.resolve({ id: 'space-1', step }) })
const post = (body: Record<string, unknown> = { userId: 'u1' }, step = 's2') =>
  POST(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as never, params(step))
const v2 = stationVersion({ title: 'Alloys', goal: 'Why alloys are harder', position: 1, subject: 'Chemistry' })

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset()
  h.query.mockResolvedValue({ rows: [space()] })
  h.authorState.mockResolvedValue({ status: 'none', done: [], partial: {}, retries: 0 })
})

describe('POST /api/studylab/[id]/stations/[step]/author', () => {
  it('writes nothing for someone who does not own the lesson', async () => {
    const res = await post({ userId: 'someone-else' })
    expect(res.status).toBe(404)
    expect(h.claimPass).not.toHaveBeenCalled()
    expect(h.runPass).not.toHaveBeenCalled()
  })

  it('runs the next pass for the station as it stands, and records what it wrote', async () => {
    h.claimPass.mockResolvedValue('job-1')
    h.runPass.mockResolvedValue({ ok: true, partial: { explore: { opening: 'Look.' } } })
    const res = await post()
    expect(res.status).toBe(200)
    expect(h.claimPass).toHaveBeenCalledWith('space-1', 's2', v2, 'explore')
    expect(h.runPass.mock.calls[0][0]).toBe('explore')
    expect(h.runPass.mock.calls[0][1]).toMatchObject({ step: { id: 's2' }, stepNo: 2, version: v2 })
    expect(h.finishPass).toHaveBeenCalledWith('job-1', { partial: { explore: { opening: 'Look.' } } })
    expect(await res.json()).toMatchObject({ status: 'authoring', next: 'name' })
  })

  it('hands a pass written again what was found wrong with it last time', async () => {
    h.authorState.mockResolvedValue({ status: 'authoring', done: [], partial: {}, retries: 1, lastFailure: { explore: 'the material cannot be solved' } })
    h.claimPass.mockResolvedValue('job-2')
    h.runPass.mockResolvedValue({ ok: true, partial: {} })
    await post()
    expect(h.runPass.mock.calls[0][1]).toMatchObject({ fix: 'the material cannot be solved' })
  })

  it('makes no second model call for a pass another request already holds', async () => {
    h.claimPass.mockResolvedValue(null)
    const res = await post()
    expect(res.status).toBe(202)
    expect(h.runPass).not.toHaveBeenCalled()
  })

  it('is ready once verify passes, with the bundle stored', async () => {
    h.authorState.mockResolvedValue({ status: 'authoring', done: ['explore', 'name', 'practice_check'], partial: { explore: {} }, retries: 0 })
    h.claimPass.mockResolvedValue('job-4')
    h.runPass.mockResolvedValue({ ok: true, bundle: { version: v2 } })
    const res = await post()
    expect(h.finishPass).toHaveBeenCalledWith('job-4', { bundle: { version: v2 } })
    expect(await res.json()).toMatchObject({ status: 'ready' })
  })

  it('sends a part back to be written again when verify fails it', async () => {
    h.authorState.mockResolvedValue({ status: 'authoring', done: ['explore', 'name', 'practice_check'], partial: {}, retries: 0 })
    h.claimPass.mockResolvedValue('job-4')
    h.runPass.mockResolvedValue({ ok: false, reason: 'false relationship', redo: 'explore' })
    await post()
    // Verify did its job; the part it faulted is what is charged.
    expect(h.failPass).toHaveBeenCalledWith('job-4', 'false relationship', false)
    // The faulted part is charged; what was written on top of it is written again, uncharged.
    expect(h.redoPass.mock.calls.map((c) => [c[3], c[5]])).toEqual([['explore', true], ['name', false], ['practice_check', false]])
    expect(h.redoPass).toHaveBeenCalledWith('space-1', 's2', v2, 'explore', 'false relationship', true)
  })

  it('starts a fresh chain when the step was rewritten since the last pass', async () => {
    const edited = [steps[0], { ...steps[1], goal: 'Why alloys resist corrosion' }]
    h.query.mockResolvedValue({ rows: [space({ lesson_run: { ...space().lesson_run, steps: edited } })] })
    h.claimPass.mockResolvedValue(null)
    await post()
    const fresh = stationVersion({ title: 'Alloys', goal: 'Why alloys resist corrosion', position: 1, subject: 'Chemistry' })
    expect(fresh).not.toBe(v2)
    expect(h.authorState).toHaveBeenCalledWith('space-1', 's2', fresh)
    expect(h.claimPass).toHaveBeenCalledWith('space-1', 's2', fresh, 'explore')
  })

  it('never hands the written station to the browser, where the answers could be read', async () => {
    h.authorState.mockResolvedValue({ status: 'ready', done: ['explore', 'name', 'practice_check', 'verify'], partial: { check: { answer: 1 } }, retries: 0, bundle: { check: { answer: 1 } } })
    const body = await (await post()).json()
    expect(body).not.toHaveProperty('bundle')
    expect(body).not.toHaveProperty('partial')
  })

  it('answers a ready or failed station without claiming anything', async () => {
    h.authorState.mockResolvedValue({ status: 'ready', done: ['explore', 'name', 'practice_check', 'verify'], partial: {}, retries: 0, bundle: {} })
    expect(await (await post()).json()).toMatchObject({ status: 'ready' })
    h.authorState.mockResolvedValue({ status: 'failed', done: [], partial: {}, retries: 2 })
    expect(await (await post()).json()).toMatchObject({ status: 'failed' })
    expect(h.claimPass).not.toHaveBeenCalled()
  })

  it('writes nothing ahead for a homework step or a lesson from before stations', async () => {
    h.query.mockResolvedValue({ rows: [space({ lesson_run: { ...space().lesson_run, recipe: undefined } })] })
    expect((await post()).status).toBe(409)
    h.query.mockResolvedValue({ rows: [space({ lesson_run: { ...space().lesson_run, steps: [steps[0], { ...steps[1], homework: { label: 'Q2' } }] } })] })
    expect((await post()).status).toBe(409)
    expect(h.claimPass).not.toHaveBeenCalled()
  })

  it('writes ahead for a lesson whose plan is still on the table -- it takes stations when the plan is accepted', async () => {
    h.query.mockResolvedValue({ rows: [space({ lesson_run: { ...space().lesson_run, phase: 'planning', currentStep: -1, recipe: undefined, stage: undefined } })] })
    h.claimPass.mockResolvedValue(null)
    expect((await post()).status).toBe(202)
    expect(h.claimPass).toHaveBeenCalled()
  })

  it('records a pass that could not finish, and asks for nothing more', async () => {
    h.claimPass.mockResolvedValue('job-1')
    h.runPass.mockRejectedValue(Object.assign(new Error('busy'), { name: 'ServiceUnavailableException' }))
    const res = await post()
    expect(h.failPass).toHaveBeenCalledWith('job-1', expect.stringContaining('busy'))
    // Marked as an error, so the next try is not told a model outage was its fault.
    expect(h.failPass.mock.calls[0][1]).toMatch(/^\[error\] /)
    expect(res.status).toBe(200)
  })
})

describe('GET', () => {
  it('reports where the station stands', async () => {
    h.authorState.mockResolvedValue({ status: 'authoring', done: ['explore'], partial: {}, retries: 0 })
    const res = await GET(new Request('http://x/api?userId=u1') as never, params())
    expect(await res.json()).toMatchObject({ status: 'authoring', done: ['explore'], next: 'name' })
  })
})
