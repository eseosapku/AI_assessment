export function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code
}

export function pgErrorMessage(err: unknown, fallback = 'Database error'): string {
  return String((err as { message?: string })?.message ?? fallback)
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23505'
}

export function isNotNullViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23502'
}

export function isMissingTable(err: unknown): boolean {
  const msg = pgErrorMessage(err, '')
  return pgErrorCode(err) === '42P01' || /relation .* does not exist/i.test(msg)
}

export function isMissingColumn(err: unknown): boolean {
  const msg = pgErrorMessage(err, '')
  return pgErrorCode(err) === '42703' || /column .* does not exist/i.test(msg)
}
