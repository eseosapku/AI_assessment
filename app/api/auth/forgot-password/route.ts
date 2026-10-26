import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendPasswordResetOtp, isEmailConfigured } from '@/lib/email'
import {
  generatePasswordResetOtp,
  normalizeResetEmail,
  passwordResetOtpExpiresAt,
} from '@/lib/password-reset-otp'
import { checkRateLimit, identify } from '@/lib/rate-limit'

const GENERIC_SUCCESS = {
  success: true,
  message: 'If an account exists with that email, we sent a 6-digit code.',
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const normalizedEmail = normalizeResetEmail(email)

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!isEmailConfigured()) {
      console.error('Forgot password: SMTP_PASS is not configured')
      return NextResponse.json(
        { error: 'Password reset is temporarily unavailable. Please try again later.' },
        { status: 503 },
      )
    }

    const byIp = checkRateLimit('forgot-password', identify(null, request.headers))
    // Each new code resets the wrong-guess count, so codes for one address are
    // limited by the address and not only by a spoofable forwarded IP.
    const rateLimit = byIp.allowed ? checkRateLimit('forgot-password', `e:${normalizedEmail}`) : byIp
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      )
    }

    const userResult = await db.query('SELECT id, email FROM users WHERE email = $1 LIMIT 1', [
      normalizedEmail,
    ])
    const user = userResult.rows[0]

    if (!user) {
      return NextResponse.json(GENERIC_SUCCESS)
    }

    const otp = generatePasswordResetOtp()
    const resetTokenExpires = passwordResetOtpExpiresAt()

    await db.query(
      `UPDATE users
       SET reset_token = $2,
           reset_token_expires = $3,
           reset_attempts = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, otp, resetTokenExpires.toISOString()],
    )

    try {
      await sendPasswordResetOtp(user.email, otp)
    } catch (error) {
      console.error('Forgot password email error:', error)
      await db.query(
        `UPDATE users
         SET reset_token = NULL,
             reset_token_expires = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [user.id],
      )
      return NextResponse.json(
        { error: 'We could not send the email right now. Please try again in a few minutes.' },
        { status: 503 },
      )
    }

    return NextResponse.json(GENERIC_SUCCESS)
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
