import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, className, role = 'student' } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }
    if (role === 'student' && !className) {
      return NextResponse.json({ error: 'Class / grade is required for students' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const prefix = role === 'teacher' ? 'TCH' : 'STD'
    const userId = `${prefix}-2024-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
    const userClass = role === 'teacher' ? 'Teacher' : className

    const { data: newUser, error: dbError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        name,
        student_id: userId,
        class: userClass,
        role,
        subjects: role === 'teacher' ? [] : ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'],
      })
      .select('id, name, email, student_id, class, subjects, role')
      .single()

    if (dbError || !newUser) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: dbError?.message || 'Failed to create account' }, { status: 500 })
    }

    const user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      studentId: newUser.student_id,
      class: newUser.class,
      subjects: newUser.subjects,
      role: newUser.role ?? role,
    }

    return NextResponse.json({ success: true, user, message: 'Account created successfully' })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
