import { db } from './shared'

async function processMessage(record: any) {
  const parsed = JSON.parse(record.body || '{}')
  const jobId = String(parsed?.job_id ?? '').trim()
  if (!jobId) return

  const token = process.env.INTERNAL_JOB_RUNNER_TOKEN
  const baseUrl = process.env.BACKEND_INTERNAL_BASE_URL
  if (!token || !baseUrl) throw new Error('INTERNAL_JOB_RUNNER_TOKEN and BACKEND_INTERNAL_BASE_URL are required')

  const executeUrl = `${baseUrl.replace(/\/$/, '')}/api/jobs/${encodeURIComponent(jobId)}/execute`
  const response = await fetch(executeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-job-runner-token': token,
    },
  })

  // 409 means this delivery lost the claim: the job is already running or
  // finished. Marking it failed here overwrote a completed quiz.
  if (response.ok || response.status === 409) return

  const raw = await response.text()
  let message = `Execute endpoint failed (${response.status})`
  try {
    const json = JSON.parse(raw)
    message = String(json?.error || message)
  } catch {
    if (raw) message = raw.slice(0, 400)
  }

  await db.query(
    `UPDATE ai_jobs
     SET status = 'failed',
         error_message = $2,
         finished_at = NOW()
     WHERE id = $1
       AND status IN ('queued', 'running')`,
    [jobId, message.slice(0, 4000)],
  )
}

export async function handler(event: any) {
  for (const record of event.Records) {
    await processMessage(record)
  }
}
