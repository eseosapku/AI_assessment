import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { normalizeCountry, countryToDb, type CountryCode } from '@/lib/countries'

function defaultSubjects(country: CountryCode, role: string) {
  if (role === 'teacher') return []
  if (country === 'NG') {
    return ['English Studies', 'Mathematics', 'Basic Science', 'Social Studies', 'Digital Technologies']
  }
  if (country === 'RW') {
    return ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science']
  }
  return ['Mathematics', 'English', 'Biology', 'Chemistry', 'Physics']
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
    const educationLevel = body.educationLevel === 'university' ? 'university' : 'school'
    const universityCourse = educationLevel === 'university' ? String(body.universityCourse ?? '').trim() : null
    const universityYear = educationLevel === 'university' ? Number(body.universityYear) || null : null

    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password are required' }, { status: 400 })
    }
    if (!email && !studentIdInput) {
      return NextResponse.json({ error: 'Email or student ID is required' }, { status: 400 })
    }
    if (role === 'student' && educationLevel === 'university' && (!universityCourse || !universityYear)) {
      return NextResponse.json({ error: 'Course and year of study are required for university students' }, { status: 400 })
    }
    if (role === 'student' && educationLevel === 'school' && !className) {
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
    const userClass =
      role === 'teacher'
        ? 'Teacher'
        : educationLevel === 'university'
          ? `${universityCourse} · Year ${universityYear}`
          : className

    const subjects = defaultSubjects(country, role)
    const insertResult = await db.query(
      `INSERT INTO users (email, password_hash, name, student_id, class, role, subjects, country, education_level, university_course, university_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, email, student_id, class, subjects, role, country, education_level, university_course, university_year`,
      [email, passwordHash, name, studentId, userClass, role, subjects, countryToDb(country), educationLevel, universityCourse, universityYear],
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
      educationLevel: newUser.education_level ?? 'school',
      universityCourse: newUser.university_course ?? null,
      universityYear: newUser.university_year ?? null,
    }

    return NextResponse.json({ success: true, user, message: 'Account created successfully' })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
