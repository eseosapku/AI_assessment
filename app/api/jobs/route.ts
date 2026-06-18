import { NextRequest, NextResponse } from 'next/server'
import { createAiJob, isAiJobType } from '@/lib/ai-jobs'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-1' })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const jobType = body?.job_type
    const payload = body?.payload

    if (!isAiJobType(jobType)) {
      return NextResponse.json({ error: 'Invalid job_type' }, { status: 400 })
    }
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'payload is required' }, { status: 400 })
    }

    const job = await createAiJob(jobType, payload as Record<string, unknown>)

    const queueUrl = process.env.AI_JOB_QUEUE_URL
    if (queueUrl) {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ job_id: job.id }),
        }),
      )
    }

    return NextResponse.json(
      { success: true, job, queued: Boolean(queueUrl) },
      { status: 201 },
    )
  } catch (error: any) {
    console.error('Create AI job error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create AI job' }, { status: 500 })
  }
}
