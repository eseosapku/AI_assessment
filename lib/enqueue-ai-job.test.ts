import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ create: vi.fn(), fail: vi.fn(), send: vi.fn(), after: vi.fn() }))
vi.mock('./ai-jobs', () => ({ createAiJob: mock.create, failAiJob: mock.fail }))
vi.mock('next/server', () => ({ after: mock.after }))
vi.mock('@aws-sdk/client-sqs', () => ({ SQSClient: class { send = mock.send }, SendMessageCommand: class { constructor(public input: any) {} } }))
import { enqueueAiJob } from './enqueue-ai-job'
beforeEach(() => { vi.resetAllMocks(); mock.create.mockResolvedValue({ id: 'j', status: 'queued' }); vi.stubEnv('NODE_ENV', 'production') })
afterEach(() => vi.unstubAllEnvs())
describe('durable production dispatch', () => {
  it('dispatches a job ID to SQS rather than starting generation inside the request', async () => {
    vi.stubEnv('AI_JOB_QUEUE_URL', 'https://sqs/queue')
    await enqueueAiJob('generate_assessment', { style: 'Practice Style' })
    expect(mock.send.mock.calls[0][0].input).toEqual({ QueueUrl: 'https://sqs/queue', MessageBody: '{"job_id":"j"}' })
    expect(mock.after).not.toHaveBeenCalled()
  })
  it('never silently falls back to gateway-bound work when the queue is missing', async () => {
    vi.stubEnv('AI_JOB_QUEUE_URL', '')
    await expect(enqueueAiJob('generate_assessment', {})).rejects.toMatchObject({ status: 503 })
    expect(mock.create).not.toHaveBeenCalled()
    expect(mock.after).not.toHaveBeenCalled()
  })
})
