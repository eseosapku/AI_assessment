import { db } from '@/lib/db'
import {
  buildUsageEvent,
  usageEventValues,
  USAGE_EVENT_COLUMNS,
  type AiUsageEvent,
  type BuildEventInput,
} from '@/lib/ai-usage'

/**
 * Writing to the AI usage ledger.
 *
 * Separated from the pure builder so that everything worth testing can be
 * tested without a database, and so this file can hold the one rule that
 * matters here: **telemetry never breaks a generation.**
 *
 * A student waiting on a quiz must not lose it because an analytics insert
 * failed, the table has not been migrated yet, or the connection pool is busy.
 * Every failure below is logged once and swallowed. That is deliberate: a
 * silent gap in a cost report is a bad day for whoever reads the report, while
 * a thrown error here is a bad day for a student sitting an exam.
 */

const INSERT_SQL = `
  INSERT INTO ai_usage_events (${USAGE_EVENT_COLUMNS.join(', ')})
  VALUES (${USAGE_EVENT_COLUMNS.map((_, i) => `$${i + 1}`).join(', ')})
  ON CONFLICT DO NOTHING
`

/**
 * True once the table has been confirmed missing, so a deployment running
 * ahead of its migration logs once rather than on every model call.
 */
let ledgerUnavailable = false

function isMissingTable(error: unknown): boolean {
  // 42P01 is undefined_table.
  return String((error as { code?: unknown })?.code ?? '') === '42P01'
}

export async function recordUsageEvent(event: AiUsageEvent): Promise<boolean> {
  if (ledgerUnavailable) return false
  try {
    await db.query(INSERT_SQL, usageEventValues(event))
    return true
  } catch (error) {
    if (isMissingTable(error)) {
      ledgerUnavailable = true
      console.warn(
        'ai_usage_events is missing — AI usage will not be recorded until migrations/add-ai-usage-events.sql is applied.',
      )
      return false
    }
    console.error('Failed to record AI usage event:', (error as Error)?.message ?? error)
    return false
  }
}

/** Resets the missing-table latch. Tests only. */
export function resetLedgerAvailability(): void {
  ledgerUnavailable = false
}

/**
 * Times a Bedrock call and records what it cost, then returns what the call
 * returned.
 *
 * The wrapper exists because Bedrock is invoked from five places, each with its
 * own client and retry loop. Instrumenting them individually would mean five
 * copies of the same timing and extraction logic, and the fifth would drift
 * from the first within a month.
 *
 * `parseBody` is supplied by the caller because each site already decodes the
 * response its own way, and re-decoding here would double the work on a hot
 * path for nothing.
 */
export async function withUsageTracking<T>(
  context: Omit<BuildEventInput, 'startedAt' | 'response' | 'responseBody' | 'error'> & {
    parseBody?: (result: T) => unknown
  },
  call: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await call()
    void recordUsageEvent(
      buildUsageEvent({
        ...context,
        startedAt,
        response: result,
        responseBody: context.parseBody ? safeParse(context.parseBody, result) : undefined,
      }),
    )
    return result
  } catch (error) {
    // Recorded, then rethrown unchanged: the caller's own error handling and
    // retry logic must see exactly what it would have seen without telemetry.
    void recordUsageEvent(buildUsageEvent({ ...context, startedAt, error }))
    throw error
  }
}

/** A parser that throws must not turn a successful call into a failed one. */
function safeParse<T>(parse: (result: T) => unknown, result: T): unknown {
  try {
    return parse(result)
  } catch {
    return undefined
  }
}
