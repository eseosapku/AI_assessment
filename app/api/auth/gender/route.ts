/**
 * Record one person's answer to the gender question.
 *
 * Its own route rather than a field on /api/auth/update-profile: that one
 * handles password changes and a broad profile edit, and the one-time prompt
 * should not be able to reach any of it.
 *
 * Write-once by design. An answer already on the record is not overwritten
 * here — the prompt only ever fires for someone who has none, so a second call
 * for the same user is a replay or a race, not a correction. Changing a
 * recorded answer belongs in profile settings, where the person can see what
 * it currently says.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeGender } from '@/lib/gender'
import { mapAuthUser } from '@/lib/auth-user'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body?.userId ?? '').trim()
    const gender = normalizeGender(body?.gender)

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }
    // Refused rather than stored: this value reaches a reported figure, and a
    // value no report can read is worse than no value.
    if (!gender) {
      return NextResponse.json({ error: 'Choose one of the options' }, { status: 400 })
    }

    const result = await db.query(
      'UPDATE users SET gender = $1 WHERE id = $2 AND gender IS NULL RETURNING *',
      [gender, userId],
    )

    if (result.rows.length === 0) {
      // Either no such user, or they already answered. Both mean there is
      // nothing to write; read the row back so the client can stop asking.
      const existing = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId])
      if (existing.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, user: mapAuthUser(existing.rows[0]) })
    }

    return NextResponse.json({ success: true, user: mapAuthUser(result.rows[0]) })
  } catch (error) {
    console.error('Gender update error:', error)
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 })
  }
}
