import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const userResult = await db.query('SELECT id, email FROM users WHERE email = $1 LIMIT 1', [normalizedEmail])
    const user = userResult.rows[0]

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, reset instructions have been sent',
        resetLink: '' // Don't reveal if email doesn't exist
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpires = new Date(Date.now() + 3600000) // 1 hour

    await db.query(
      `UPDATE users
       SET reset_token = $2,
           reset_token_expires = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, resetToken, resetTokenExpires.toISOString()],
    )

    // In production, send email with reset link
    // For development, return the reset link
    const resetLink = `/reset-password?token=${resetToken}`

    return NextResponse.json({
      success: true,
      message: 'Password reset instructions sent',
      resetLink // In production, don't return this
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
