import { NextRequest, NextResponse } from 'next/server'
import { isAiJobType } from '@/lib/ai-jobs'
import { enqueueAiJob } from '@/lib/enqueue-ai-job'

export async function POST(request: NextRequest) {
  try {
    const { job_type, payload } = await request.json()
    if (!isAiJobType(job_type) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Valid job_type and payload are required' }, { status: 400 })
    }
    const job = await enqueueAiJob(job_type, payload)
    return NextResponse.json({ success: true, job, queued: true }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to queue job' }, { status: error?.status || 500 })
  }
}
