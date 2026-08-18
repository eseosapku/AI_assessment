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
    /** Stops the poll. Without it a cancelled generation keeps polling to the
        timeout and then hands back a result nobody is waiting for. */
    signal?: AbortSignal
  },
): Promise<T> {
  const pollIntervalMs = options?.pollIntervalMs ?? 2000
  const timeoutMs = options?.timeoutMs ?? 210000
  const signal = options?.signal
  const startedAt = Date.now()

  const aborted = () => {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    return err
  }

  while (true) {
    if (signal?.aborted) throw aborted()
    const job = await getAiJob(jobId)
    if (signal?.aborted) throw aborted()
    if (job.status === 'succeeded') return (job.result_payload ?? null) as T
    if (job.status === 'failed') throw new Error(job.error_message || 'AI job failed')
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('AI job timed out. Please retry.')
    }
    // The wait has to be interruptible too, or cancelling still costs a
    // full poll interval before anything notices.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, pollIntervalMs)
      const onAbort = () => {
        clearTimeout(timer)
        reject(aborted())
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }
}

export async function triggerAiJobExecution(jobId: string): Promise<void> {
  await fetch(`/api/jobs/${encodeURIComponent(jobId)}/execute`, {
    method: 'POST',
  }).catch(() => undefined)
}
