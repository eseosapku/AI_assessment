import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { countryToDb } from '@/lib/countries'
import { defaultSubjectsFor, mapAuthUser } from '@/lib/auth-user'
import { isGoogleAuthConfigured, verifyGoogleIdToken } from '@/lib/google-auth'

function generatedStudentId() {
  return `STD-2024-${Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    if (!isGoogleAuthConfigured()) {
      return NextResponse.json(
        { error: 'Google sign-in is not set up yet.' },
        { status: 503 },
      )
    }

    const { idToken } = await request.json()
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Google sign-in failed. Please try again.' }, { status: 400 })
    }

    let identity
    try {
      identity = await verifyGoogleIdToken(idToken)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.'
      return NextResponse.json({ error: message }, { status: 401 })
    }

    const byGoogle = await db.query('SELECT * FROM users WHERE google_id = $1 LIMIT 1', [identity.googleId])
    if (byGoogle.rows[0]) {
      const user = mapAuthUser(byGoogle.rows[0])
      return NextResponse.json({ success: true, user, isNew: false })
    }

    const byEmail = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [identity.email])
    if (byEmail.rows[0]) {
      const existing = byEmail.rows[0]
      if (existing.google_id && existing.google_id !== identity.googleId) {
        return NextResponse.json(
          { error: 'This email is already linked to a different Google account. Sign in with password instead.' },
          { status: 400 },
        )
      }

      const updated = await db.query(
        `UPDATE users
         SET google_id = $2,
             auth_provider = CASE
               WHEN auth_provider = 'google' THEN 'google'
               ELSE 'both'
             END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.id, identity.googleId],
      )
      const row = updated.rows[0] ?? existing
      if (identity.picture) {
        try {
          await db.query('UPDATE users SET avatar_url = COALESCE(avatar_url, $2) WHERE id = $1', [
            existing.id,
            identity.picture,
          ])
        } catch {
          // avatar_url column may not exist yet
        }
      }
      return NextResponse.json({ success: true, user: mapAuthUser(row), isNew: false })
    }

    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
    const studentId = generatedStudentId()
    const country = 'RW'
    const role = 'student'
    const subjects = defaultSubjectsFor(country, role)

    const inserted = await db.query(
      `INSERT INTO users (
         email, password_hash, name, student_id, class, role, subjects, country,
         education_level, university_course, university_year,
         google_id, profile_complete, auth_provider
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        identity.email,
        passwordHash,
        identity.name,
        studentId,
        'Pending',
        role,
        subjects,
        countryToDb(country),
        'school',
        null,
        null,
        identity.googleId,
        false,
        'google',
      ],
    )

    const newUser = inserted.rows[0]
    if (!newUser) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    if (identity.picture) {
      try {
        await db.query('UPDATE users SET avatar_url = $2 WHERE id = $1 AND avatar_url IS NULL', [
          newUser.id,
          identity.picture,
        ])
        newUser.avatar_url = identity.picture
      } catch {
        // avatar_url column may not exist yet
      }
    }

    return NextResponse.json({ success: true, user: mapAuthUser(newUser), isNew: true })
  } catch (error) {
    console.error('Google auth error:', error)
    const detail = error instanceof Error ? error.message : ''
    const missingColumn =
      /google_id|profile_complete|auth_provider|avatar_url/i.test(detail)
    if (missingColumn) {
      return NextResponse.json(
        { error: 'Google sign-in needs a database update. Run migrations/add-google-auth.sql and try again.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Google sign-in failed. Please try again.' }, { status: 500 })
  }
}
