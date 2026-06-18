import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { normalizeCountry, type CountryCode } from '@/lib/countries'

function defaultSubjects(country: CountryCode, role: string) {
  if (role === 'teacher') return []
  if (country === 'NG') {
    return ['English Studies', 'Mathematics', 'Basic Science', 'Social Studies', 'Digital Technologies']
  }
  return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science']
}

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
    const name = String(body.name ?? '').trim()
    const email = normalizeEmail(body.email)
    const studentIdInput = normalizeStudentId(body.studentId ?? body.student_id)
    const password = String(body.password ?? '')
    const className = String(body.className ?? '').trim()
    const role = body.role ?? 'student'
    const country = normalizeCountry(body.country)

    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password are required' }, { status: 400 })
    }
    if (!email && !studentIdInput) {
      return NextResponse.json({ error: 'Email or student ID is required' }, { status: 400 })
    }
    if (role === 'student' && !className) {
      return NextResponse.json({ error: 'Class / grade is required for students' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    if (email) {
      const existingEmail = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email])
      if (existingEmail.rows.length > 0) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
      }
    }

    if (studentIdInput) {
      const existingStudentId = await db.query('SELECT id FROM users WHERE student_id = $1 LIMIT 1', [studentIdInput])
      if (existingStudentId.rows.length > 0) {
        return NextResponse.json({ error: 'Student ID already registered' }, { status: 400 })
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const prefix = role === 'teacher' ? 'TCH' : 'STD'
    const generatedStudentId = `${prefix}-2024-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
    const studentId = studentIdInput ?? generatedStudentId
    const userClass = role === 'teacher' ? 'Teacher' : className

    const subjects = role === 'teacher' ? [] : ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science']
    const insertResult = await db.query(
      `INSERT INTO users (email, password_hash, name, student_id, class, role, subjects)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, student_id, class, subjects, role`,
      [email, passwordHash, name, studentId, userClass, role, subjects],
    )
    const newUser = insertResult.rows[0]

    if (!newUser) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    const user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      studentId: newUser.student_id,
      class: newUser.class,
      subjects: newUser.subjects,
      role: newUser.role ?? role,
      country: normalizeCountry(newUser.country),
    }

    return NextResponse.json({ success: true, user, message: 'Account created successfully' })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
