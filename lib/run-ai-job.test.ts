import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ claim: vi.fn(), complete: vi.fn(), fail: vi.fn(), generate: vi.fn() }))
vi.mock('./ai-jobs', () => ({ claimQueuedAiJob: mock.claim, completeAiJob: mock.complete, failAiJob: mock.fail }))
vi.mock('./assessment-generation', () => ({ generateAssessment: mock.generate }))
import { runAiJob } from './run-ai-job'
beforeEach(() => { vi.resetAllMocks(); mock.claim.mockResolvedValue({ job_type: 'generate_assessment', input_payload: { count: 10 } }) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('direct SQS execution', () => {
  it('completes a 35-second generation without calling the website or a gateway', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    mock.generate.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(Response.json({ questions: ['done'] })), 35000)))
    const work = runAiJob('job-1')
    await vi.advanceTimersByTimeAsync(28000)
    expect(mock.complete).not.toHaveBeenCalled()
    expect(mock.fail).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(7000)
    await work
    expect(mock.complete).toHaveBeenCalledWith('job-1', { questions: ['done'] })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not generate again for a duplicate queue delivery', async () => {
    mock.claim.mockResolvedValue(null)
    await runAiJob('done-job')
    expect(mock.generate).not.toHaveBeenCalled()
  })
  it('stores the actual generation error and HTTP status', async () => {
    mock.generate.mockResolvedValue(Response.json({ error: 'Subscribe' }, { status: 402 }))
    await runAiJob('job-1')
    expect(mock.fail).toHaveBeenCalledWith('job-1', 'Subscribe', { statusCode: 402, errorPayload: { error: 'Subscribe' } })
  })
})
