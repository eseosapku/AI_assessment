import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@brainink.app'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo123!'

const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Demo Student',
  email: DEMO_EMAIL,
  studentId: 'DEMO-2026-0001',
  class: 'College Sophomore',
  subjects: ['Medicine', 'Nursing', 'Pharmacy', 'Computer Science', 'Business Administration'],
  role: 'student' as const,
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Built-in demo account for local testing and live demos.
    if (email.trim().toLowerCase() === DEMO_EMAIL.toLowerCase() && password === DEMO_PASSWORD) {
      return NextResponse.json({
        success: true,
        user: DEMO_USER,
        message: 'Demo login successful',
      })
    }

    // Find user by email
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (dbError || !userData) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userData.password_hash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Return user data (without password)
    const user = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      studentId: userData.student_id,
      class: userData.class,
      subjects: userData.subjects,
      role: userData.role ?? 'student',
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
