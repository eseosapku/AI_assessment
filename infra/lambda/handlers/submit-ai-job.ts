import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { db, json } from './shared'

const sqs = new SQSClient({ region: process.env.AWS_REGION })

export async function handler(event: any) {
  try {
    const parsed = event.body ? JSON.parse(event.body) : {}
    const jobType = String(parsed?.job_type ?? '').trim()
    const payload = parsed?.payload

    if (!['generate_assessment', 'grade_longform', 'generate_feedback'].includes(jobType)) {
      return json(400, { error: 'Invalid job_type' })
    }
    if (!payload || typeof payload !== 'object') {
      return json(400, { error: 'payload is required' })
    }

    const insertResult = await db.query(
      `INSERT INTO ai_jobs (job_type, status, input_payload, attempts)
       VALUES ($1, 'queued', $2::jsonb, 0)
       RETURNING id, job_type, status, result_payload, error_message, created_at, started_at, finished_at`,
      [jobType, JSON.stringify(payload)],
    )
    const data = insertResult.rows[0]
    if (!data) return json(500, { error: 'Failed to create AI job' })

    const queueUrl = process.env.AI_JOB_QUEUE_URL
    if (!queueUrl) {
      return json(500, { error: 'AI_JOB_QUEUE_URL is not configured' })
    }

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ job_id: String(data.id) }),
      }),
    )

    return json(201, { success: true, job: data })
  } catch (error: any) {
    return json(500, { error: error?.message || 'Unexpected error' })
  }
}
