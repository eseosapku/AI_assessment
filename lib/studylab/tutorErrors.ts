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
