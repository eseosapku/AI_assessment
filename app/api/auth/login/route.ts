import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // In production, validate against database
    // For now, simulate authentication
    
    // Mock user validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Simulate successful login
    const user = {
      id: 'user-' + Date.now(),
      name: 'Alex Johnson',
      email: email,
      studentId: 'STD-2024-1234',
      class: 'Grade 12 - Science',
      subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science']
    }

    return NextResponse.json({
      success: true,
      user,
      message: 'Login successful'
    })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
