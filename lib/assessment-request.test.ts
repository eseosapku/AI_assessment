import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAssessment } from './assessment-request'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('quiz generation beyond the HTTP gateway window', () => {
  it.each(['Practice Style', 'Exam Style'])('waits for a 35-second %s job using short polls', async (style) => {
    vi.useFakeTimers()
    const start = Date.now()
    const fetcher = vi.fn(async (url: string) => url === '/api/generate-assessment'
      ? Response.json({ job: { id: 'job-1' } }, { status: 202 })
      : Response.json({ job: { id: 'job-1', status: Date.now() - start >= 35000 ? 'succeeded' : 'running', result_payload: { questions: ['complete'] } } }))
    vi.stubGlobal('fetch', fetcher)
    let done = false
    const result = fetchAssessment('/api/generate-assessment', { method: 'POST', body: JSON.stringify({ style }) }).then((r) => { done = true; return r })
    await vi.advanceTimersByTimeAsync(27500)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(10000)
    expect(await (await result).json()).toEqual({ questions: ['complete'] })
    expect(fetcher.mock.calls.slice(1).every(([url]) => url === '/api/jobs/job-1')).toBe(true)
  })
  it('preserves subscription failures instead of reporting an empty response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ job: { id: 'j' } }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ job: { status: 'failed', error_message: 'Subscribe', result_payload: { statusCode: 402, errorPayload: { error: 'Subscribe', code: 'PAYMENT_REQUIRED' } } } })))
    const response = await fetchAssessment('/api/generate-assessment')
    expect(response.status).toBe(402)
    expect((await response.json()).code).toBe('PAYMENT_REQUIRED')
  })
})
