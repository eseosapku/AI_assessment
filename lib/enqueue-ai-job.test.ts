import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ create: vi.fn(), fail: vi.fn(), invoke: vi.fn(), after: vi.fn() }))
vi.mock('./ai-jobs', () => ({ createAiJob: mock.create, failAiJob: mock.fail }))
vi.mock('next/server', () => ({ after: mock.after }))
vi.mock('./invoke-existing-lambda', () => ({ invokeExistingLambda: mock.invoke }))
import { enqueueAiJob } from './enqueue-ai-job'
import { GENERATION_TIMEOUT_MS } from './generation-timeout'
beforeEach(() => { vi.resetAllMocks(); mock.create.mockResolvedValue({ id: 'j', status: 'queued' }); vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'studysquare_function') })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('durable production dispatch', () => {
  it('allows a generation to run for 15 minutes', () => {
    expect(GENERATION_TIMEOUT_MS).toBe(15 * 60 * 1000)
  })
  it('starts background work in the existing function without requiring a queue', async () => {
    await enqueueAiJob('generate_assessment', { style: 'Practice Style' })
    expect(mock.invoke).toHaveBeenCalledWith('j', 'studysquare_function')
    expect(mock.after).not.toHaveBeenCalled()
  })
  it('starts the existing Lambda from Amplify with the Bedrock keys', async () => {
    vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', '')
    vi.stubEnv('BEDROCK_ACCESS_KEY_ID', 'key')
    vi.stubEnv('BEDROCK_SECRET_ACCESS_KEY', 'secret')
    await enqueueAiJob('generate_assessment', { style: 'Exam Style (Past Papers)' })
    expect(mock.invoke).toHaveBeenCalledWith('j', 'studysquare_function')
    expect(mock.after).not.toHaveBeenCalled()
  })
  it('forwards Amplify submissions to the existing backend when it cannot sign a Lambda call', async () => {
    vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', '')
    vi.stubEnv('BEDROCK_ACCESS_KEY_ID', '')
    vi.stubEnv('BEDROCK_SECRET_ACCESS_KEY', '')
    vi.stubEnv('AWS_ACCESS_KEY_ID', '')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', '')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ job: { id: 'j' } }, { status: 201 })))
    expect(await enqueueAiJob('generate_assessment', {})).toEqual({ id: 'j' })
    expect(mock.create).not.toHaveBeenCalled()
    expect(mock.after).not.toHaveBeenCalled()
  })
})
