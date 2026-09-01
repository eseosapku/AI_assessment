import { NextRequest, NextResponse } from 'next/server'
import { mapAuthUser } from '@/lib/auth-user'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

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

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email or student ID and password are required' },
        { status: 400 },
      )
    }

    const email = normalizeEmail(body.email ?? (identifier.includes('@') ? identifier : null))
    const studentId = normalizeStudentId(body.studentId ?? (!identifier.includes('@') ? identifier : null))

    if (!email && !studentId) {
      return NextResponse.json(
        { error: 'Email or student ID is required' },
        { status: 400 },
      )
    }

    const userResult = email
      ? await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email])
      : await db.query('SELECT * FROM users WHERE student_id = $1 LIMIT 1', [studentId])
    const userData = userResult.rows[0]

    if (!userData) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isValidPassword = await bcrypt.compare(password, userData.password_hash)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const user = mapAuthUser(userData)

    return NextResponse.json({
      success: true,
      user,
      message: 'Login successful',
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
