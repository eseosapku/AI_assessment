import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePlatformAdmin } from '@/lib/auth/admin'
import { isValidReferralCodeFormat, normalizeReferralCode } from '@/lib/referrals'

export async function GET(request: NextRequest) {
  const authorization = await requirePlatformAdmin(request)
  if (!authorization.ok) return authorization.response

  const { rows } = await db.query(
    `SELECT rc.id, rc.code, rc.discount_percentage, rc.active,
            rc.expires_at, rc.created_at,
            owner.id AS owner_user_id, owner.name AS owner_name,
            owner.email AS owner_email, owner.student_id AS owner_student_id,
            COUNT(rr.id)::int AS uses,
            MAX(rr.redeemed_at) AS last_used_at
       FROM referral_codes rc
       JOIN users owner ON owner.id = rc.owner_user_id
       LEFT JOIN referral_redemptions rr ON rr.referral_code_id = rc.id
      GROUP BY rc.id, owner.id
      ORDER BY rc.created_at DESC`,
  )
  return NextResponse.json({ referrals: rows })
}

export async function POST(request: NextRequest) {
  const authorization = await requirePlatformAdmin(request)
  if (!authorization.ok) return authorization.response

  try {
    const body = await request.json()
    const code = normalizeReferralCode(body?.code)
    const ownerIdentifier = String(body?.owner_identifier ?? '').trim()
    const discountPercentage = Number(body?.discount_percentage)
    const expiresAt = body?.expires_at ? new Date(body.expires_at) : null

    if (!isValidReferralCodeFormat(code)) {
      return NextResponse.json({ error: 'Code must be 3–32 letters, numbers, hyphens, or underscores.' }, { status: 400 })
    }
    if (!ownerIdentifier) {
      return NextResponse.json({ error: 'Choose a referral owner by email, student ID, or user ID.' }, { status: 400 })
    }
    if (!Number.isFinite(discountPercentage) || discountPercentage <= 0 || discountPercentage >= 100) {
      return NextResponse.json({ error: 'Discount percentage must be between 1 and 99.' }, { status: 400 })
    }
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: 'Expiration date is invalid.' }, { status: 400 })
    }

    const ownerResult = await db.query(
      `SELECT id, name, email, student_id FROM users
        WHERE id::text = $1 OR LOWER(email) = LOWER($1) OR UPPER(student_id) = UPPER($1)
        LIMIT 1`,
      [ownerIdentifier],
    )
    const owner = ownerResult.rows[0]
    if (!owner) return NextResponse.json({ error: 'Referral owner not found.' }, { status: 404 })

    const created = await db.query(
      `INSERT INTO referral_codes
         (code, owner_user_id, discount_percentage, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, code, owner_user_id, discount_percentage, active, expires_at, created_at`,
      [
        code,
        owner.id,
        discountPercentage,
        expiresAt?.toISOString() ?? null,
        authorization.admin.userId,
      ],
    )
    return NextResponse.json({ referral: { ...created.rows[0], owner_name: owner.name } }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'That referral code already exists.' }, { status: 409 })
    }
    console.error('Create referral error:', error)
    return NextResponse.json({ error: 'Could not create referral code.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await requirePlatformAdmin(request)
  if (!authorization.ok) return authorization.response

  try {
    const body = await request.json()
    const id = String(body?.id ?? '').trim()
    if (!id) return NextResponse.json({ error: 'Referral id is required.' }, { status: 400 })

    const updates: string[] = []
    const values: unknown[] = [id]
    if (typeof body.active === 'boolean') {
      values.push(body.active)
      updates.push(`active = $${values.length}`)
    }
    if (body.discount_percentage != null) {
      const percent = Number(body.discount_percentage)
      if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
        return NextResponse.json({ error: 'Discount percentage must be between 1 and 99.' }, { status: 400 })
      }
      values.push(percent)
      updates.push(`discount_percentage = $${values.length}`)
    }
    if (!updates.length) return NextResponse.json({ error: 'No changes provided.' }, { status: 400 })

    const { rows } = await db.query(
      `UPDATE referral_codes SET ${updates.join(', ')} WHERE id = $1
       RETURNING id, code, discount_percentage, active`,
      values,
    )
    if (!rows[0]) return NextResponse.json({ error: 'Referral code not found.' }, { status: 404 })
    return NextResponse.json({ referral: rows[0] })
  } catch (error) {
    console.error('Update referral error:', error)
    return NextResponse.json({ error: 'Could not update referral code.' }, { status: 500 })
  }
}
