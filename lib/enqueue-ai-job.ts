import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { after } from 'next/server'
import { createAiJob, failAiJob, type AiJobType } from './ai-jobs'
import { getBedrockCredentials, getBedrockRegion } from './aws-config'
import { NodeHttpHandler } from '@smithy/node-http-handler'

const sqs = new SQSClient({ region: getBedrockRegion(), credentials: getBedrockCredentials() || undefined,
  maxAttempts: 1, requestHandler: new NodeHttpHandler({ connectionTimeout: 2000, requestTimeout: 5000 }) })

export async function enqueueAiJob(type: AiJobType, payload: Record<string, unknown>) {
  const queue = process.env.AI_JOB_QUEUE_URL
  if (!queue && process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('Background generation is not configured. Set AI_JOB_QUEUE_URL and deploy the assessment worker.'), { status: 503 })
  }
  const job = await createAiJob(type, payload)
  try {
    if (queue) {
      await sqs.send(new SendMessageCommand({ QueueUrl: queue, MessageBody: JSON.stringify({ job_id: job.id }) }))
    } else {
      // Development only. A deployed server must use the durable SQS worker.
      after(async () => { const { runAiJob } = await import('./run-ai-job'); await runAiJob(job.id) })
    }
  } catch (error: any) {
    await failAiJob(job.id, error?.message || 'Unable to dispatch job')
    throw error
  }
  return job
}
