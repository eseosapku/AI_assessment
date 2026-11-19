export function mcqResponse(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

export function hasWrittenResponse(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function honestWrittenFeedback(answer: unknown, feedback: unknown): string {
  const text = String(feedback ?? '').trim()
  if (!hasWrittenResponse(answer)) return text
  if (/did not (?:provide|submit)|no (?:answer|response)|unanswered/i.test(text)) {
    return 'Your submitted answer was reviewed, but it did not meet the marking criteria.'
  }
  return text
}

export function hasAnyStoredResponse(input: {
  mcq?: Record<string, unknown>
  longform?: Record<string, unknown>
  interactive?: Record<string, unknown>
}): boolean {
  return Object.values(input.mcq ?? {}).some((value) => mcqResponse(value) !== null)
    || Object.values(input.longform ?? {}).some(hasWrittenResponse)
    || Object.values(input.interactive ?? {}).some((value) => value !== null && value !== undefined && value !== '')
}
