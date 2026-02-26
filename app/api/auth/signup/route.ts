import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, className } = await request.json()

    // Validation
    if (!name || !email || !password || !className) {
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

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Generate student ID
    const studentId = 'STD-2024-' + Math.floor(Math.random() * 9999).toString().padStart(4, '0')

    // Create user in database
    const { data: newUser, error: dbError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        name,
        student_id: studentId,
        class: className,
        subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science']
      })
      .select('id, name, email, student_id, class, subjects')
      .single()

    if (dbError || !newUser) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      )
    }

    // Return user data (without password)
    const user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      studentId: newUser.student_id,
      class: newUser.class,
      subjects: newUser.subjects
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
