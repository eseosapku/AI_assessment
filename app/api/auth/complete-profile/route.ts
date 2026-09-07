import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeCountry, countryToDb, type CountryCode } from '@/lib/countries'
import { defaultSubjectsFor, mapAuthUser } from '@/lib/auth-user'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body.userId ?? '').trim()
    const name = String(body.name ?? '').trim()
    const role = body.role === 'teacher' ? 'teacher' : 'student'
    const country = normalizeCountry(body.country) as CountryCode
    const educationLevel = body.educationLevel === 'university' ? 'university' : 'school'
    const universityCourse = educationLevel === 'university' ? String(body.universityCourse ?? '').trim() : null
    const universityYear = educationLevel === 'university' ? Number(body.universityYear) || null : null
    const className = String(body.className ?? '').trim()

    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to finish your profile.' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (role === 'student' && educationLevel === 'university' && (!universityCourse || !universityYear)) {
      return NextResponse.json({ error: 'Select your course and year of study' }, { status: 400 })
    }
    if (role === 'student' && educationLevel === 'school' && !className) {
      return NextResponse.json({ error: 'Please select a class / grade' }, { status: 400 })
    }

    const existing = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId])
    const row = existing.rows[0]
    if (!row) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const userClass =
      role === 'teacher'
        ? 'Teacher'
        : educationLevel === 'university'
          ? `${universityCourse} · Year ${universityYear}`
          : className

    const subjects =
      Array.isArray(row.subjects) && row.subjects.length > 0 && role === (row.role ?? 'student')
        ? row.subjects
        : defaultSubjectsFor(country, role)

    const updated = await db.query(
      `UPDATE users
       SET name = $2,
           role = $3,
           country = $4,
           class = $5,
           education_level = $6,
           university_course = $7,
           university_year = $8,
           subjects = $9,
           profile_complete = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        userId,
        name,
        role,
        countryToDb(country),
        userClass,
        educationLevel,
        universityCourse,
        universityYear,
        subjects,
      ],
    )

    const saved = updated.rows[0]
    if (!saved) {
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: mapAuthUser(saved),
    })
  } catch (error) {
    console.error('Complete profile error:', error)
    return NextResponse.json({ error: 'Could not save your profile. Please try again.' }, { status: 500 })
  }
}
