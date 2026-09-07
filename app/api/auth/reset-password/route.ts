import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { normalizeOtp, normalizeResetEmail, otpMatches } from '@/lib/password-reset-otp'
import { checkRateLimit, identify } from '@/lib/rate-limit'

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

    const rateLimit = checkRateLimit('reset-password', identify(null, request.headers))
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      )
    }

    const userResult = await db.query(
      'SELECT id, reset_token, reset_token_expires FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail],
    )
    const user = userResult.rows[0]

    if (!user || !otpMatches(user.reset_token, normalizedOtp)) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })
    }

    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await db.query(
      `UPDATE users
       SET password_hash = $2,
           reset_token = NULL,
           reset_token_expires = NULL,
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
