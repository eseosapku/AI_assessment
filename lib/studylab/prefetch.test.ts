// lib/studylab/prefetch.test.ts
import { describe, it, expect, vi } from 'vitest'
import { whatToAuthor, stationKey, driveStation, driveInLanes, type AuthorStatus } from './prefetch'
import type { LessonRun, LessonStep } from './lessonRun'

const step = (id: string, over: Partial<LessonStep> = {}): LessonStep =>
  ({ id, title: `Step ${id}`, goal: `Goal ${id}`, status: 'pending', cardIds: [], ...over }) as LessonStep
const steps = [step('a'), step('b'), step('c')]
const run = (over: Partial<LessonRun> = {}): LessonRun =>
  ({ phase: 'teaching', pace: 'step', steps, currentStep: 0, beats: 0, awaiting: false, recipe: 'station', stage: 'explore', ...over }) as LessonRun
const known = (entries: [LessonStep, number, AuthorStatus][]) =>
  Object.fromEntries(entries.map(([s, i, status]) => [stationKey(s, i), status]))

describe('whatToAuthor', () => {
  it('writes the first step while the plan is still on the table', () => {
    expect(whatToAuthor(run({ phase: 'planning', currentStep: -1, recipe: undefined, stage: undefined }), {})).toBe('a')
  })

  it('writes the step after the one being taught, and no further ahead', () => {
    expect(whatToAuthor(run({ currentStep: 1, steps: [step('a', { status: 'done' }), step('b', { status: 'teaching' }), step('c')] }), {})).toBe('c')
  })

  it('writes nothing past the last step', () => {
    expect(whatToAuthor(run({ currentStep: 2, steps: [step('a', { status: 'done' }), step('b', { status: 'done' }), step('c', { status: 'teaching' })] }), {})).toBeNull()
  })

  it('follows the lesson past a step the learner already knows', () => {
    const s = [step('a', { status: 'teaching' }), step('b', { status: 'known' }), step('c')]
    expect(whatToAuthor(run({ steps: s }), {})).toBe('c')
  })

  it('never writes a homework step ahead', () => {
    const s = [step('a', { status: 'teaching' }), step('b', { homework: { label: 'Q2' } } as Partial<LessonStep>), step('c')]
    expect(whatToAuthor(run({ steps: s }), {})).toBeNull()
  })

  it('never writes ahead for a lesson from before stations', () => {
    expect(whatToAuthor(run({ recipe: undefined }), {})).toBeNull()
    expect(whatToAuthor(null, {})).toBeNull()
    expect(whatToAuthor(run({ phase: 'done', currentStep: -1 }), {})).toBeNull()
  })

  it('stops driving a station that is ready or has failed, and keeps driving one still being written', () => {
    const r = run()
    expect(whatToAuthor(r, known([[steps[1], 1, 'ready']]))).toBeNull()
    expect(whatToAuthor(r, known([[steps[1], 1, 'failed']]))).toBeNull()
    expect(whatToAuthor(r, known([[steps[1], 1, 'authoring']]))).toBe('b')
  })

  it('writes a step again once it was rewritten, whatever the old one came to', () => {
    const r = run({ steps: [steps[0], step('b', { goal: 'A new goal' }), steps[2]] })
    expect(whatToAuthor(r, known([[steps[1], 1, 'ready']]))).toBe('b')
  })
})

describe('driveStation', () => {
  const reply = (status: number, body: Record<string, unknown>) => ({ status, ok: status < 300, json: async () => body })
  const setup = (...replies: ReturnType<typeof reply>[]) => {
    const fetch = vi.fn()
    for (const r of replies) fetch.mockResolvedValueOnce(r)
    const sleep = vi.fn(async () => {})
    return { fetch, sleep }
  }
  const drive = (deps: ReturnType<typeof setup>, signal = new AbortController().signal) =>
    driveStation({ spaceId: 'sp', stepId: 'b', userId: 'u1', signal, fetch: deps.fetch as never, sleep: deps.sleep })

  it('asks for pass after pass until the station is ready', async () => {
    const deps = setup(reply(200, { status: 'authoring' }), reply(200, { status: 'authoring' }), reply(200, { status: 'authoring' }), reply(200, { status: 'ready' }))
    expect(await drive(deps)).toBe('ready')
    expect(deps.fetch).toHaveBeenCalledTimes(4)
    const [url, init] = deps.fetch.mock.calls[0]
    expect(url).toBe('/api/studylab/sp/stations/b/author')
    expect(JSON.parse(init.body)).toEqual({ userId: 'u1' })
    expect(deps.sleep).not.toHaveBeenCalled()
  })

  it('backs off from 1 s to 3 s while another request holds the pass -- the second lane picks the practice up within 3 s of the explore', async () => {
    const held = reply(202, { status: 'authoring' })
    const deps = setup(held, held, held, held, held, reply(200, { status: 'failed' }))
    expect(await drive(deps)).toBe('failed')
    expect(deps.sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([1000, 2000, 3000, 3000, 3000])
  })

  it('gives up on a station the route will not write, without trying again', async () => {
    const deps = setup(reply(409, { error: 'This step is taught live' }))
    expect(await drive(deps)).toBe('failed')
    expect(deps.fetch).toHaveBeenCalledTimes(1)
  })

  it('stops, and records nothing, once the lesson moves on', async () => {
    const ctrl = new AbortController()
    const deps = setup(reply(200, { status: 'authoring' }))
    deps.fetch.mockImplementationOnce(async () => { ctrl.abort(); throw Object.assign(new Error('aborted'), { name: 'AbortError' }) })
    expect(await drive(deps, ctrl.signal)).toBeNull()
  })

  it('stops after a bounded number of requests, whatever the route answers', async () => {
    const deps = { fetch: vi.fn(async () => reply(200, { status: 'authoring' })), sleep: vi.fn(async () => {}) }
    expect(await drive(deps as never)).toBe('failed')
    expect(deps.fetch.mock.calls.length).toBeLessThanOrEqual(30)
  })
})

describe('driveInLanes', () => {
  const reply = (status: number, body: Record<string, unknown>) => ({ status, ok: status < 300, json: async () => body })
  const lanes = (fetch: ReturnType<typeof vi.fn>, signal = new AbortController().signal) =>
    driveInLanes({ spaceId: 'sp', stepId: 'b', userId: 'u1', signal, fetch: fetch as never, sleep: async () => {} })

  it('asks for two passes at once, so the name and the practice are written side by side', async () => {
    const fetch = vi.fn(async () => reply(200, { status: 'ready' }))
    expect(await lanes(fetch)).toBe('ready')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('is ready when either lane sees it ready, though the other stopped on a dropped request', async () => {
    let n = 0
    const fetch = vi.fn(async () => { n += 1; if (n === 1) throw new Error('network'); return reply(200, { status: 'ready' }) })
    expect(await lanes(fetch)).toBe('ready')
  })

  it('records nothing once the lesson has moved on', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    expect(await lanes(vi.fn(async () => reply(200, { status: 'ready' })), ctrl.signal)).toBeNull()
  })
})
