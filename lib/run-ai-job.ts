import { NextRequest } from 'next/server'
import { claimQueuedAiJob, completeAiJob, failAiJob } from './ai-jobs'

/** Called inside Lambda by SQS. No call back through Amplify/API Gateway. */
export async function runAiJob(id: string): Promise<void> {
  const job = await claimQueuedAiJob(id)
  if (!job) {
    console.error(`AI job ${id} was not queued on this database, so nothing was generated`)
    return
  }
  try {
    const request = new NextRequest(`http://ai-worker.internal/api/${job.job_type}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job.input_payload || {}),
    })
    let response: Response
    if (job.job_type === 'generate_assessment') {
      const { generateAssessment } = await import('./assessment-generation')
      response = await generateAssessment(request)
    } else if (job.job_type === 'grade_longform') {
      const { POST } = await import('../app/api/grade-longform/route'); response = await POST(request)
    } else if (job.job_type === 'generate_feedback') {
      const { POST } = await import('../app/api/generate-feedback/route'); response = await POST(request)
    } else throw new Error(`Unsupported job type: ${job.job_type}`)
    const payload = await response.json()
    if (!response.ok) {
      await failAiJob(id, payload?.error || `Generation failed (${response.status})`, { statusCode: response.status, errorPayload: payload })
      return
    }
    await completeAiJob(id, payload)
  } catch (error: any) {
    await failAiJob(id, error?.message || 'AI job failed')
  }
}
