import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // In production, save to database
    // For now, simulate account creation
    const user = {
      id: 'user-' + Date.now(),
      name: name,
      email: email,
      studentId: 'STD-2024-' + Math.floor(Math.random() * 9999),
      class: 'Grade 12 - Science',
      subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science']
    }

    return NextResponse.json({
      success: true,
      user,
      message: 'Account created successfully'
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Signup failed' },
      { status: 500 }
    )
  }
}
