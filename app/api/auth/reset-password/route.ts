import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import {
  normalizeOtp,
  normalizeResetEmail,
  otpMatches,
  PASSWORD_RESET_MAX_ATTEMPTS,
} from '@/lib/password-reset-otp'
import { checkRateLimit, identify } from '@/lib/rate-limit'

const INVALID_CODE = 'Invalid or expired verification code'

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Please wait a few minutes and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const { email, otp, password } = await request.json()
    const normalizedEmail = normalizeResetEmail(email)
    const normalizedOtp = normalizeOtp(otp)

    if (!normalizedEmail || !normalizedOtp || !password) {
      return NextResponse.json(
        { error: 'Email, verification code, and password are required' },
        { status: 400 },
      )
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const byIp = checkRateLimit('reset-password', identify(null, request.headers))
    if (!byIp.allowed) return tooMany(byIp.retryAfterSeconds)
    // X-Forwarded-For is the caller's to set, so the IP bucket alone was
    // bypassed by sending a fresh address with every guess.
    const byEmail = checkRateLimit('reset-password', `e:${normalizedEmail}`)
    if (!byEmail.allowed) return tooMany(byEmail.retryAfterSeconds)

    // The attempt is counted before the code is compared, in one statement, so
    // parallel guesses cannot all slip in under the limit.
    const userResult = await db.query(
      `UPDATE users
          SET reset_attempts = COALESCE(reset_attempts, 0) + 1
        WHERE email = $1
          AND reset_token IS NOT NULL
          AND COALESCE(reset_attempts, 0) < $2
        RETURNING id, reset_token, reset_token_expires, reset_attempts`,
      [normalizedEmail, PASSWORD_RESET_MAX_ATTEMPTS],
    )
    const user = userResult.rows[0]
    if (!user) {
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 })
    }

    const expired = Boolean(user.reset_token_expires && new Date(user.reset_token_expires) < new Date())
    if (expired || !otpMatches(user.reset_token, normalizedOtp)) {
      if (Number(user.reset_attempts) >= PASSWORD_RESET_MAX_ATTEMPTS) {
        await db.query(
          `UPDATE users SET reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $1`,
          [user.id],
        )
        return NextResponse.json(
          { error: 'Too many wrong codes. Request a new verification code.' },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await db.query(
      `UPDATE users
       SET password_hash = $2,
           reset_token = NULL,
           reset_token_expires = NULL,
           reset_attempts = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, passwordHash],
    )

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
