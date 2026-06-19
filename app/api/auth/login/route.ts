import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { normalizeCountry } from '@/lib/countries'
import { findUserByEmail, findUserByStudentId } from '@/lib/users-db'

function normalizeEmail(value: unknown) {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed.toLowerCase() : null
}

function normalizeStudentId(value: unknown) {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed.toUpperCase() : null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const identifier = String(body.identifier ?? body.email ?? body.studentId ?? '').trim()
    const password = String(body.password ?? '')

    // Validation
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email or student ID and password are required' },
        { status: 400 }
      )
    }

    const email = normalizeEmail(body.email ?? (identifier.includes('@') ? identifier : null))
    const studentId = normalizeStudentId(body.studentId ?? (!identifier.includes('@') ? identifier : null))

    if (!email && !studentId) {
      return NextResponse.json(
        { error: 'Email or student ID is required' },
        { status: 400 }
      )
    }

    const userData = email
      ? await findUserByEmail(email)
      : await findUserByStudentId(studentId!)

    if (!userData) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userData.password_hash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
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
      country: normalizeCountry(userData.country),
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
