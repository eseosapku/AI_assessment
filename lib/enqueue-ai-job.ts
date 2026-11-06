import { after } from 'next/server'
import { GENERATION_TIMEOUT_MS } from './generation-timeout'
import { createAiJob, failAiJob, type AiJobType } from './ai-jobs'
import { getBedrockCredentials } from './aws-config'
import { jobApiUrl } from './job-api-url'
import { invokeExistingLambda } from './invoke-existing-lambda'

export async function enqueueAiJob(type: AiJobType, payload: Record<string, unknown>) {
  const onWorker = process.env.AWS_LAMBDA_FUNCTION_NAME === 'studysquare_function'
  const canInvoke = Boolean(getBedrockCredentials())
  if (!onWorker && !canInvoke && process.env.NODE_ENV === 'production') {
    // Last resort when this process cannot sign a Lambda call itself.
    const response = await fetch(jobApiUrl('/api/jobs'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_type: type, payload }), signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS) })
    const result = await response.json()
    if (!response.ok || !result.job) throw Object.assign(new Error(result.error || 'Could not start generation'), { status: response.status })
    return result.job
  }
  const job = await createAiJob(type, payload)
  try {
    if (onWorker || canInvoke) {
      await invokeExistingLambda(job.id, 'studysquare_function')
    } else {
      // Local development only; production uses the existing Lambda above.
      after(async () => { const { runAiJob } = await import('./run-ai-job'); await runAiJob(job.id) })
    }
  } catch (error: any) {
    await failAiJob(job.id, error?.message || 'Unable to dispatch job')
    throw error
  }
  return job
}
