import { NextRequest, NextResponse } from 'next/server'
import { getAiJob } from '@/lib/ai-jobs'

/** Creation already dispatches the job. Never relay long work through HTTP. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getAiJob(id)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  return NextResponse.json({ success: true, status: job.status }, { status: 202 })
}
