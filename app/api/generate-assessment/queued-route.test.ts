import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const enqueue = vi.hoisted(() => vi.fn())
vi.mock('@/lib/enqueue-ai-job', () => ({ enqueueAiJob: enqueue }))
import { POST } from './route'
beforeEach(() => { enqueue.mockReset(); enqueue.mockResolvedValue({ id: 'j', status: 'queued' }) })
describe('short generation submission requests', () => {
  it.each(['Practice Style', 'Exam Style'])('queues %s without waiting for generation', async (style) => {
    const response = await POST(new NextRequest('http://app/api/generate-assessment', { method: 'POST', body: JSON.stringify({ style, count: 10 }) }))
    expect(response.status).toBe(202)
    expect((await response.json()).job.id).toBe('j')
    expect(enqueue).toHaveBeenCalledWith('generate_assessment', { style, count: 10 })
  })
  it('reports an unavailable backend explicitly', async () => {
    enqueue.mockRejectedValue(Object.assign(new Error('Backend unavailable'), { status: 503 }))
    const response = await POST(new NextRequest('http://app/api/generate-assessment', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(503)
    expect((await response.json()).error).toContain('Backend unavailable')
  })
})
