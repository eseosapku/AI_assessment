import { NextRequest, NextResponse } from 'next/server'
import { getAiJob } from '@/lib/ai-jobs'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const jobId = String(id ?? '').trim()
    if (!jobId) return NextResponse.json({ error: 'Job id is required' }, { status: 400 })

    const job = await getAiJob(jobId)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    return NextResponse.json({ success: true, job })
  } catch (error: any) {
    console.error('Get AI job error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch AI job' }, { status: 500 })
  }
}
