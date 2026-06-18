import { db } from '@/lib/db'

export const AI_JOB_TYPES = ['generate_assessment', 'grade_longform', 'generate_feedback'] as const
export type AiJobType = typeof AI_JOB_TYPES[number]

export const AI_JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const
export type AiJobStatus = typeof AI_JOB_STATUSES[number]

export interface AiJobRow {
  id: string
  job_type: AiJobType
  status: AiJobStatus
  input_payload: Record<string, unknown> | null
  result_payload: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  attempts: number | null
}

export function isAiJobType(value: unknown): value is AiJobType {
  return AI_JOB_TYPES.includes(String(value) as AiJobType)
}

function mapJobRow(row: any): AiJobRow {
  return {
    id: String(row.id),
    job_type: row.job_type as AiJobType,
    status: row.status as AiJobStatus,
    input_payload: (row.input_payload ?? null) as Record<string, unknown> | null,
    result_payload: (row.result_payload ?? null) as Record<string, unknown> | null,
    error_message: row.error_message ?? null,
    created_at: new Date(row.created_at).toISOString(),
    started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
    finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    attempts: Number.isFinite(Number(row.attempts)) ? Number(row.attempts) : 0,
  }
}

export async function createAiJob(jobType: AiJobType, payload: Record<string, unknown>) {
  const result = await db.query(
    `INSERT INTO ai_jobs (job_type, status, input_payload, attempts)
     VALUES ($1, 'queued', $2::jsonb, 0)
     RETURNING id, job_type, status, input_payload, result_payload, error_message, created_at, started_at, finished_at, attempts`,
    [jobType, JSON.stringify(payload)],
  )
  return mapJobRow(result.rows[0])
}

export async function getAiJob(jobId: string) {
  const result = await db.query(
    `SELECT id, job_type, status, input_payload, result_payload, error_message, created_at, started_at, finished_at, attempts
     FROM ai_jobs
     WHERE id = $1
     LIMIT 1`,
    [jobId],
  )
  if (result.rows.length === 0) return null
  return mapJobRow(result.rows[0])
}

export async function claimQueuedAiJob(jobId: string) {
  const result = await db.query(
    `UPDATE ai_jobs
     SET status = 'running',
         started_at = NOW(),
         error_message = NULL,
         attempts = COALESCE(attempts, 0) + 1
     WHERE id = $1
       AND status = 'queued'
     RETURNING id, job_type, status, input_payload, result_payload, error_message, created_at, started_at, finished_at, attempts`,
    [jobId],
  )
  if (result.rows.length === 0) return null
  return mapJobRow(result.rows[0])
}

export async function completeAiJob(jobId: string, resultPayload: Record<string, unknown>) {
  await db.query(
    `UPDATE ai_jobs
     SET status = 'succeeded',
         result_payload = $2::jsonb,
         finished_at = NOW(),
         error_message = NULL
     WHERE id = $1`,
    [jobId, JSON.stringify(resultPayload)],
  )
}

export async function failAiJob(jobId: string, message: string) {
  await db.query(
    `UPDATE ai_jobs
     SET status = 'failed',
         error_message = $2,
         finished_at = NOW()
     WHERE id = $1`,
    [jobId, message.slice(0, 4000)],
  )
}
