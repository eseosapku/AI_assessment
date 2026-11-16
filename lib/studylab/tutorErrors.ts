/**
 * What a student reads when a call to the tutor fails.
 *
 * The raw error used to go straight into the chat: a gateway timeout answers
 * with an HTML page, `res.json()` threw, and the student read "Unexpected
 * token '<'". Or "Failed to fetch", or a database message. The server's own
 * words are passed on only where they were written for a person: a rate
 * limit, a paywall, a refusal.
 */
export function friendlyTutorError(failure: { status?: number; bodyError?: string; thrown?: unknown }): string {
  const thrown = failure.thrown as { name?: string; message?: string } | undefined
  if (thrown?.name === 'AbortError' || thrown?.name === 'TimeoutError') {
    return 'The tutor is taking too long to answer. Try again.'
  }
  if (thrown && thrown.name === 'TypeError') {
    return "Couldn't reach the tutor. Check your connection and try again."
  }
  const status = failure.status ?? 0
  const said = String(failure.bodyError ?? '').trim()
  // Our own deadline, or Amplify's gateway giving up at 30 s.
  if (status === 504) return 'The tutor is taking too long to answer. Try again.'
  if (status === 404) return 'This lesson is not available. Go back to your LearnSpaces and open it again.'
  if ((status === 400 || status === 402 || status === 403 || status === 409 || status === 429) && said) return said
  return 'Something went wrong on our side. Try again.'
}

const BUSY_NAMES = new Set([
  'ThrottlingException',
  'ServiceUnavailableException',
  'ModelNotReadyException',
  'InternalServerException',
  'ModelTimeoutException',
])

/**
 * Whether a model call failed because the model was busy or briefly down --
 * throttled, a 503, a model still warming up -- rather than because the
 * request was wrong. Nothing about the lesson caused it, so it is answered
 * the way a reply that did not parse is: the turn did not come through, try
 * it again, and nothing moved.
 */
export function isTransientModelError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } }
  if (typeof e.name === 'string' && BUSY_NAMES.has(e.name)) return true
  const status = e.$metadata?.httpStatusCode
  return status === 429 || status === 500 || status === 502 || status === 503
}
