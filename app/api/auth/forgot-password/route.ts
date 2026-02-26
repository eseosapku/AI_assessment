import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

    // Find user by email
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single()

    // Always return success to prevent email enumeration
    if (dbError || !user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, reset instructions have been sent',
        resetLink: '' // Don't reveal if email doesn't exist
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpires = new Date(Date.now() + 3600000) // 1 hour

    // Save reset token to database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires.toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to save reset token:', updateError)
      return NextResponse.json(
        { error: 'Failed to generate reset link' },
        { status: 500 }
      )
    }

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
