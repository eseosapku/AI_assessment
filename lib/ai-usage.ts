/**
 * The AI usage ledger.
 *
 * `ai_usage_events` was added as a schema with nothing writing to it, so the
 * admin dashboard it exists to feed would have reported an empty table however
 * well it was built. This fills it.
 *
 * Bedrock is invoked from five separate places, each with its own client and
 * its own retry loop, and none of them read the token counts the response
 * carries. Rather than copy an emitter five times, everything here is pure and
 * takes what a call site already has — a model id, a parsed response body, a
 * start time — so a call site only has to hand over what it knows.
 *
 * Two rules the recorder holds to:
 *
 *  - Telemetry never breaks a generation. A student waiting on a quiz must not
 *    lose it because an analytics insert failed, so every write is wrapped and
 *    a failure is logged and swallowed.
 *  - A missing number is null, never zero. Not every model reports tokens, and
 *    a zero would quietly understate spend in every total built on this table.
 */

export type UsagePlatform = 'studysquare' | 'brainink_grading'
export type UsageEnvironment = 'production' | 'staging' | 'development' | 'unknown'
export type UsageStatus = 'succeeded' | 'failed'

export interface TokenCounts {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

export interface AiUsageEvent {
  id: string
  occurredAt: Date
  platform: UsagePlatform
  environment: UsageEnvironment
  provider: 'aws_bedrock'
  modelId: string
  /** Which product surface spent the money: 'generate_assessment', 'grade_longform', … */
  feature: string
  requestId: string
  providerRequestId: string | null
  jobId: string | null
  userId: string | null
  schoolId: string | null
  classroomId: string | null
  assessmentId: string | null
  assignmentId: string | null
  resultId: string | null
  tokens: TokenCounts
  latencyMs: number
  status: UsageStatus
  errorCode: string | null
  metadata: Record<string, unknown>
}

/**
 * Which deployment produced the spend.
 *
 * Amplify sets its own branch variable and does not set NODE_ENV to anything
 * useful for this, so the branch is checked first. "unknown" is a real option
 * in the schema and is the honest answer when nothing identifies the
 * environment — better than filing local traffic under production.
 */
export function resolveEnvironment(env: NodeJS.ProcessEnv = process.env): UsageEnvironment {
  const explicit = String(env.APP_ENVIRONMENT ?? '').trim().toLowerCase()
  if (explicit === 'production' || explicit === 'staging' || explicit === 'development') {
    return explicit
  }

  const branch = String(env.AWS_BRANCH ?? '').trim().toLowerCase()
  if (branch === 'main' || branch === 'master' || branch === 'production') return 'production'
  if (branch === 'aws_deploy' || branch === 'staging') return 'staging'
  if (branch) return 'development'

  const node = String(env.NODE_ENV ?? '').trim().toLowerCase()
  if (node === 'production') return 'production'
  if (node === 'development' || node === 'test') return 'development'

  return 'unknown'
}

function asCount(value: unknown): number | null {
  const n = Number(value)
  // Negative or fractional token counts are not counts; treat them as absent
  // rather than storing a number the schema's own CHECK would reject.
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

/**
 * Token counts out of a Bedrock response.
 *
 * Every model family reports them differently and some do not report them at
 * all, so this reads the shapes we actually invoke and returns nulls otherwise.
 * The response headers carry them too, but the SDK does not surface arbitrary
 * headers on `$metadata`, so the body is the only reliable source here.
 */
export function extractTokens(body: unknown): TokenCounts {
  const b = (body ?? {}) as Record<string, any>

  // Nova, and Bedrock's converse-style responses.
  const usage = b.usage ?? b.amazonBedrockInvocationMetrics ?? null
  if (usage && typeof usage === 'object') {
    const input = asCount(usage.inputTokens ?? usage.input_tokens ?? usage.inputTokenCount)
    const output = asCount(usage.outputTokens ?? usage.output_tokens ?? usage.outputTokenCount)
    const total = asCount(usage.totalTokens ?? usage.total_tokens)
    return {
      inputTokens: input,
      outputTokens: output,
      // Derive the total only when both halves are known; adding a null to a
      // number would silently report half the spend as the whole of it.
      totalTokens: total ?? (input !== null && output !== null ? input + output : null),
    }
  }

  // Anthropic-style, which reports the two halves and no total.
  const input = asCount(b.input_token_count ?? b.inputTextTokenCount)
  const output = asCount(b.output_token_count ?? b.generation_token_count)
  if (input !== null || output !== null) {
    return {
      inputTokens: input,
      outputTokens: output,
      totalTokens: input !== null && output !== null ? input + output : null,
    }
  }

  return { inputTokens: null, outputTokens: null, totalTokens: null }
}

/** The provider's own id for the call, for reconciling against an AWS bill. */
export function extractProviderRequestId(response: unknown): string | null {
  const meta = (response as { $metadata?: { requestId?: unknown } } | null)?.$metadata
  const id = String(meta?.requestId ?? '').trim()
  return id || null
}

/**
 * A short, stable code for what went wrong.
 *
 * The AWS SDK's `name` is the useful part — ThrottlingException,
 * ValidationException, AccessDeniedException — and it groups far better than a
 * message full of ids and timestamps ever would.
 */
export function errorCodeOf(error: unknown): string | null {
  if (!error) return null
  const e = error as { name?: unknown; code?: unknown; message?: unknown }
  const name = String(e.name ?? e.code ?? '').trim()
  if (name && name !== 'Error') return name.slice(0, 120)
  const message = String(e.message ?? '').trim()
  return message ? message.slice(0, 120) : 'UnknownError'
}

export interface BuildEventInput {
  modelId: string
  feature: string
  requestId: string
  startedAt: number
  finishedAt?: number
  platform?: UsagePlatform
  environment?: UsageEnvironment
  response?: unknown
  responseBody?: unknown
  error?: unknown
  jobId?: string | null
  userId?: string | null
  schoolId?: string | null
  classroomId?: string | null
  assessmentId?: string | null
  assignmentId?: string | null
  resultId?: string | null
  metadata?: Record<string, unknown>
  /** Injected so tests do not depend on a clock or a random source. */
  now?: () => number
  newId?: () => string
}

function uuid(): string {
  // crypto.randomUUID is available in Node 18+ and in the edge runtime; the
  // fallback keeps this usable anywhere rather than throwing inside telemetry.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Assembles one ledger row. Pure: no clock, no database, no throwing. */
export function buildUsageEvent(input: BuildEventInput): AiUsageEvent {
  const now = input.now ?? (() => Date.now())
  const finished = input.finishedAt ?? now()
  const failed = Boolean(input.error)

  return {
    id: (input.newId ?? uuid)(),
    occurredAt: new Date(finished),
    platform: input.platform ?? 'studysquare',
    environment: input.environment ?? resolveEnvironment(),
    provider: 'aws_bedrock',
    modelId: String(input.modelId || 'unknown'),
    feature: String(input.feature || 'unknown'),
    requestId: input.requestId,
    providerRequestId: extractProviderRequestId(input.response),
    jobId: input.jobId ?? null,
    userId: input.userId ?? null,
    schoolId: input.schoolId ?? null,
    classroomId: input.classroomId ?? null,
    assessmentId: input.assessmentId ?? null,
    assignmentId: input.assignmentId ?? null,
    resultId: input.resultId ?? null,
    tokens: failed
      ? { inputTokens: null, outputTokens: null, totalTokens: null }
      : extractTokens(input.responseBody),
    // Clamped at zero: a clock that moves backwards mid-request would otherwise
    // produce a negative the schema rejects, losing the whole event.
    latencyMs: Math.max(0, Math.round(finished - input.startedAt)),
    status: failed ? 'failed' : 'succeeded',
    errorCode: failed ? errorCodeOf(input.error) : null,
    metadata: input.metadata ?? {},
  }
}

/** Column order for the insert, kept beside the builder so they cannot drift. */
export const USAGE_EVENT_COLUMNS = [
  'id', 'occurred_at', 'platform', 'environment', 'provider', 'model_id', 'feature',
  'request_id', 'provider_request_id', 'job_id', 'user_id', 'school_id', 'classroom_id',
  'assessment_id', 'assignment_id', 'result_id', 'input_tokens', 'output_tokens',
  'total_tokens', 'latency_ms', 'status', 'error_code', 'usage_metadata',
] as const

/** Values in `USAGE_EVENT_COLUMNS` order. */
export function usageEventValues(event: AiUsageEvent): unknown[] {
  return [
    event.id,
    event.occurredAt.toISOString(),
    event.platform,
    event.environment,
    event.provider,
    event.modelId,
    event.feature,
    event.requestId,
    event.providerRequestId,
    event.jobId,
    event.userId,
    event.schoolId,
    event.classroomId,
    event.assessmentId,
    event.assignmentId,
    event.resultId,
    event.tokens.inputTokens,
    event.tokens.outputTokens,
    event.tokens.totalTokens,
    event.latencyMs,
    event.status,
    event.errorCode,
    JSON.stringify(event.metadata ?? {}),
  ]
}
