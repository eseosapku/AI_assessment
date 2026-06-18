import { NextRequest, NextResponse } from 'next/server'
import { claimQueuedAiJob, completeAiJob, failAiJob } from '@/lib/ai-jobs'

function canExecuteJob(request: NextRequest) {
  const runnerToken = process.env.INTERNAL_JOB_RUNNER_TOKEN
  const provided = request.headers.get('x-job-runner-token')
  if (!runnerToken) return process.env.NODE_ENV !== 'production'
  return provided === runnerToken
}

function endpointForType(jobType: string) {
  if (jobType === 'generate_assessment') return '/api/generate-assessment'
  if (jobType === 'grade_longform') return '/api/grade-longform'
  if (jobType === 'generate_feedback') return '/api/generate-feedback'
  return null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!canExecuteJob(request)) {
    return NextResponse.json({ error: 'Unauthorized job runner' }, { status: 401 })
  }

  let jobId = ''
  try {
    const { id } = await params
    jobId = String(id ?? '').trim()
    if (!jobId) return NextResponse.json({ error: 'Job id is required' }, { status: 400 })

    const job = await claimQueuedAiJob(jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found or not queued' }, { status: 409 })
    }

    const endpoint = endpointForType(job.job_type)
    if (!endpoint) {
      await failAiJob(jobId, `Unsupported job type: ${job.job_type}`)
      return NextResponse.json({ error: 'Unsupported job type' }, { status: 400 })
    }

    const origin = new URL(request.url).origin
    const upstreamResponse = await fetch(`${origin}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job.input_payload ?? {}),
      cache: 'no-store',
    })

    const raw = await upstreamResponse.text()
    let parsed: Record<string, unknown> = {}
    if (raw) {
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = { raw }
      }
    }

    if (!upstreamResponse.ok) {
      const message = String((parsed as any)?.error || `Upstream failed (${upstreamResponse.status})`)
      await failAiJob(jobId, message)
      return NextResponse.json({ error: message }, { status: 502 })
    }

    await completeAiJob(jobId, parsed)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (jobId) {
      await failAiJob(jobId, error?.message || 'Job execution failed')
    }
    console.error('Execute AI job error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to execute job' }, { status: 500 })
  }
}
