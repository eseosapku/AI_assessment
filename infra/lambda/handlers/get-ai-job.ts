import { db, json } from './shared'

export async function handler(event: any) {
  try {
    const jobId = String(event.pathParameters?.id ?? '').trim()
    if (!jobId) return json(400, { error: 'Job id is required' })

    const result = await db.query(
      `SELECT id, job_type, status, result_payload, error_message, created_at, started_at, finished_at
       FROM ai_jobs
       WHERE id = $1
       LIMIT 1`,
      [jobId],
    )
    const data = result.rows[0]
    if (!data) return json(404, { error: 'Job not found' })

    return json(200, { success: true, job: data })
  } catch (error: any) {
    return json(500, { error: error?.message || 'Unexpected error' })
  }
}
