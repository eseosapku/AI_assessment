'use client'

export type AiJobType = 'generate_assessment' | 'grade_longform' | 'generate_feedback'

export type AiJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface AiJobRecord<T = any> {
  id: string
  job_type: AiJobType
  status: AiJobStatus
  result_payload: T | null
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

interface CreateJobResponse {
  success: boolean
  job: AiJobRecord
}

interface JobStatusResponse {
  success: boolean
  job: AiJobRecord
}

export async function createAiJob(jobType: AiJobType, payload: unknown): Promise<AiJobRecord> {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_type: jobType, payload }),
  })
  const json = (await res.json()) as CreateJobResponse & { error?: string }
  if (!res.ok || !json?.job) {
    throw new Error(json?.error || 'Failed to create AI job')
  }
  return json.job
}

export async function getAiJob(jobId: string): Promise<AiJobRecord> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
    cache: 'no-store',
  })
  const json = (await res.json()) as JobStatusResponse & { error?: string }
  if (!res.ok || !json?.job) {
    throw new Error(json?.error || 'Failed to fetch AI job')
  }
  return json.job
}

export async function waitForAiJob<T = any>(
  jobId: string,
  options?: {
    pollIntervalMs?: number
    timeoutMs?: number
  },
): Promise<T> {
  const pollIntervalMs = options?.pollIntervalMs ?? 2000
  const timeoutMs = options?.timeoutMs ?? 210000
  const startedAt = Date.now()

  while (true) {
    const job = await getAiJob(jobId)
    if (job.status === 'succeeded') return (job.result_payload ?? null) as T
    if (job.status === 'failed') throw new Error(job.error_message || 'AI job failed')
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('AI job timed out. Please retry.')
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
}

export async function triggerAiJobExecution(jobId: string): Promise<void> {
  await fetch(`/api/jobs/${encodeURIComponent(jobId)}/execute`, {
    method: 'POST',
  }).catch(() => undefined)
}
