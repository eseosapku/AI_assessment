// lib/studylab/stationJobs.ts
import { db } from '@/lib/db'
import type { StationBundle } from './stationBundle'

/**
 * Station authoring on the `ai_jobs` table: one row per pass, the job type
 * `author_station`, the station and the version it was written for in the
 * row's payload. No new table -- the rows are additive, and the passes are
 * short enough to run one a request.
 */
export type Pass = 'explore' | 'name' | 'practice_check' | 'verify'

export const PASSES: readonly Pass[] = ['explore', 'name', 'practice_check', 'verify']

const JOB = 'author_station'

/** A running claim older than this belongs to a request that died. */
const STALE_CLAIM_SECONDS = 60

/** Two FNV-1a hashes with different seeds: short, stable, the same in the browser and on the server. */
function fnv(s: string, seed: number): string {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * What a bundle was written for. A step renamed, rewritten or moved gets a new
 * version, and a bundle for the old one is never served.
 */
export function stationVersion(input: { title: string; goal: string; position: number; subject?: string }): string {
  const key = [input.title.trim(), input.goal.trim(), input.position, (input.subject ?? '').trim()].join('␟')
  return fnv(key, 0x811c9dc5) + fnv(key, 0x2f1a7c33)
}

export function nextPass(done: Pass[]): Pass | null {
  return PASSES.find((p) => !done.includes(p)) ?? null
}

export interface AuthorState {
  status: 'none' | 'authoring' | 'ready' | 'failed'
  done: Pass[]
  /** What the passes so far wrote, merged in order. */
  partial: Partial<StationBundle>
  bundle?: StationBundle
  /** The most failures of any one pass. A pass is tried twice, then the station runs live. */
  retries: number
  /** What was last found wrong with each pass, for its next try. Outages are left out: they were nobody's fault. */
  lastFailure: Partial<Record<Pass, string>>
}

/** Marks a reason as an outage or a timeout rather than something the pass wrote. */
export const ERROR_MARK = '[error] '

/** A pass written again because what it built on changed: no fault of its own. */
const SUPERSEDED = 'superseded'

/** Where this station's authoring stands, for this version only. */
export async function authorState(spaceId: string, stepId: string, version: string): Promise<AuthorState> {
  const { rows } = await db.query<{ id: string; pass: string; status: string; result_payload: Record<string, unknown> | null; error_message?: string | null }>(
    `SELECT id, input_payload->>'pass' AS pass, status, result_payload, error_message
       FROM ai_jobs
      WHERE job_type = $1 AND input_payload->>'spaceId' = $2 AND input_payload->>'stepId' = $3 AND input_payload->>'version' = $4
      ORDER BY created_at`,
    [JOB, spaceId, stepId, version],
  )
  const done: Pass[] = []
  let partial: Partial<StationBundle> = {}
  let bundle: StationBundle | undefined
  const failures = new Map<string, number>()
  const lastFailure: Partial<Record<Pass, string>> = {}
  let running = false
  for (const r of rows) {
    if (r.status === 'succeeded' && PASSES.includes(r.pass as Pass) && !done.includes(r.pass as Pass)) {
      done.push(r.pass as Pass)
      const result = r.result_payload ?? {}
      if (result.partial && typeof result.partial === 'object') partial = { ...partial, ...(result.partial as Partial<StationBundle>) }
      if (r.pass === 'verify' && result.bundle && typeof result.bundle === 'object') bundle = result.bundle as StationBundle
    } else if (r.status === 'failed' && String(r.error_message ?? '').startsWith(`${SUPERSEDED}:`)) {
      continue
    } else if (r.status === 'failed') {
      failures.set(r.pass, (failures.get(r.pass) ?? 0) + 1)
      const reason = String(r.error_message ?? '').replace(/^redone: /, '').trim()
      if (reason && !reason.startsWith(ERROR_MARK) && PASSES.includes(r.pass as Pass)) lastFailure[r.pass as Pass] = reason
    } else if (r.status === 'running') running = true
  }
  const retries = Math.max(0, ...failures.values())
  const spent = [...failures.entries()].some(([pass, n]) => n >= 2 && !done.includes(pass as Pass))
  const status: AuthorState['status'] = bundle ? 'ready' : spent ? 'failed' : done.length || running ? 'authoring' : 'none'
  return { status, done, partial, ...(bundle ? { bundle } : {}), retries, lastFailure }
}

/**
 * Claims one pass of one station. Under the station's advisory lock, so two
 * tabs or a reload mid-chain cannot both claim it; the check runs in its own
 * statement after the lock, so it sees a claim committed while it waited.
 * Returns the row's id, or null when the pass is already running or done.
 */
export async function claimPass(spaceId: string, stepId: string, version: string, pass: Pass): Promise<string | null> {
  return db.withStatementTimeout(10_000, async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`${JOB}:${spaceId}:${stepId}:${version}:${pass}`])
    const { rows } = await q<{ id: string }>(
      `INSERT INTO ai_jobs (job_type, status, input_payload, attempts, started_at)
       SELECT $1, 'running', $2::jsonb, 1, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM ai_jobs
           WHERE job_type = $1
             AND input_payload->>'spaceId' = $3 AND input_payload->>'stepId' = $4
             AND input_payload->>'version' = $5 AND input_payload->>'pass' = $6
             AND (status = 'succeeded' OR (status = 'running' AND started_at > NOW() - INTERVAL '${STALE_CLAIM_SECONDS} seconds'))
        )
       RETURNING id`,
      [JOB, JSON.stringify({ spaceId, stepId, version, pass }), spaceId, stepId, version, pass],
    )
    return rows[0]?.id ?? null
  })
}

/** A pass that wrote its part (or, for verify, the whole bundle). */
export async function finishPass(id: string, result: { partial?: Partial<StationBundle>; bundle?: StationBundle }): Promise<void> {
  await db.query(
    `UPDATE ai_jobs SET status = 'succeeded', result_payload = $2::jsonb, finished_at = NOW(), error_message = NULL WHERE id = $1`,
    [id, JSON.stringify(result)],
  )
}

/**
 * A pass that could not, and why. A verify that sent a part back did its job:
 * it is recorded uncharged, and the part it faulted carries the charge.
 */
export async function failPass(id: string, reason: string, charged = true): Promise<void> {
  const message = charged ? reason : `${SUPERSEDED}: ${reason}`
  await db.query(`UPDATE ai_jobs SET status = 'failed', error_message = $2, finished_at = NOW() WHERE id = $1`, [id, message.slice(0, 4000)])
}

/**
 * Sends a written pass back to be written again. The pass the verifier found
 * wrong is charged: its row counts toward the two a pass gets before the
 * station runs live. A pass written again only because what it built on
 * changed is superseded, and is not charged -- it was not at fault.
 */
export async function redoPass(spaceId: string, stepId: string, version: string, pass: Pass, reason: string, blame = true): Promise<void> {
  await db.query(
    `UPDATE ai_jobs SET status = 'failed', error_message = $6, finished_at = NOW()
      WHERE job_type = $1 AND input_payload->>'spaceId' = $2 AND input_payload->>'stepId' = $3
        AND input_payload->>'version' = $4 AND input_payload->>'pass' = $5 AND status = 'succeeded'`,
    [JOB, spaceId, stepId, version, pass, `${blame ? 'redone' : SUPERSEDED}: ${reason}`.slice(0, 4000)],
  )
}
