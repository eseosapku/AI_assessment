import { runAiJob } from '../../../lib/run-ai-job'

/** SQS invokes generation directly, outside the HTTP gateway. */
export async function handler(event: { Records: { body: string; messageId: string }[] }, context?: { callbackWaitsForEmptyEventLoop: boolean }) {
  if (context) context.callbackWaitsForEmptyEventLoop = false
  const batchItemFailures: { itemIdentifier: string }[] = []
  for (const record of event.Records) {
    try {
      const { job_id } = JSON.parse(record.body || '{}')
      if (job_id) await runAiJob(String(job_id))
    } catch {
      batchItemFailures.push({ itemIdentifier: record.messageId })
    }
  }
  return { batchItemFailures }
}
