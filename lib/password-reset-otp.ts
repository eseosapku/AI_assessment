import { randomInt } from 'crypto'

/** Six-digit code for email verification. */
export function generatePasswordResetOtp(): string {
  return String(randomInt(100000, 1000000))
}

export const PASSWORD_RESET_OTP_TTL_MS = 15 * 60 * 1000

/**
 * Wrong codes allowed against one issued code before it is thrown away. Six
 * digits are only safe while guesses are scarce.
 */
export const PASSWORD_RESET_MAX_ATTEMPTS = 5

export function passwordResetOtpExpiresAt(now: number = Date.now()): Date {
  return new Date(now + PASSWORD_RESET_OTP_TTL_MS)
}

/** Constant-time string compare to avoid timing leaks on OTP checks. */
export function otpMatches(stored: string | null | undefined, provided: string): boolean {
  const a = String(stored ?? '').trim()
  const b = String(provided ?? '').trim()
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export function normalizeResetEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase()
}

export function normalizeOtp(otp: unknown): string {
  return String(otp ?? '').trim().replace(/\s/g, '')
}
