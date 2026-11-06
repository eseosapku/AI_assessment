import { NextRequest, NextResponse } from 'next/server'
import { enqueueAiJob } from '@/lib/enqueue-ai-job'

/** Generation runs in the queue worker, never in this gateway-bound request. */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Assessment payload is required' }, { status: 400 })
    }
    const job = await enqueueAiJob('generate_assessment', payload)
    return NextResponse.json({ success: true, queued: true, job }, { status: 202 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to queue assessment' }, { status: error?.status || 500 })
  }
}
