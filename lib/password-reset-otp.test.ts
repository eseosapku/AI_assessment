import { describe, expect, it } from 'vitest'
import {
  generatePasswordResetOtp,
  normalizeOtp,
  normalizeResetEmail,
  otpMatches,
  passwordResetOtpExpiresAt,
  PASSWORD_RESET_OTP_TTL_MS,
} from './password-reset-otp'

describe('password-reset-otp', () => {
  it('generates a 6-digit code', () => {
    const otp = generatePasswordResetOtp()
    expect(otp).toMatch(/^\d{6}$/)
  })

  it('normalizes email and otp input', () => {
    expect(normalizeResetEmail('  User@Example.COM ')).toBe('user@example.com')
    expect(normalizeOtp('12 34 56')).toBe('123456')
  })

  it('compares OTPs in constant time', () => {
    expect(otpMatches('123456', '123456')).toBe(true)
    expect(otpMatches('123456', '654321')).toBe(false)
    expect(otpMatches(null, '123456')).toBe(false)
  })

  it('expires OTP after 15 minutes', () => {
    const now = Date.now()
    const expires = passwordResetOtpExpiresAt(now)
    expect(expires.getTime() - now).toBe(PASSWORD_RESET_OTP_TTL_MS)
  })
})
