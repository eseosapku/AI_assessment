import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'A valid user is required.' }, { status: 400 })
  }

  try {
    const { rows: codes } = await db.query(
      `SELECT rc.id, rc.code, rc.discount_percentage, rc.active,
              (rc.active AND (rc.expires_at IS NULL OR rc.expires_at > NOW())) AS effective_active,
              rc.expires_at, rc.created_at, COUNT(rr.id)::int AS uses,
              MAX(rr.redeemed_at) AS last_used_at
         FROM referral_codes rc
         LEFT JOIN referral_redemptions rr ON rr.referral_code_id = rc.id
        WHERE rc.owner_user_id = $1
        GROUP BY rc.id
        ORDER BY rc.created_at DESC`,
      [userId],
    )
    const { rows: events } = await db.query(
      `SELECT rc.code, rr.redeemed_at
         FROM referral_redemptions rr
         JOIN referral_codes rc ON rc.id = rr.referral_code_id
        WHERE rc.owner_user_id = $1
        ORDER BY rr.redeemed_at DESC
        LIMIT 250`,
      [userId],
    )
    const totalUses = codes.reduce((sum, code) => sum + (Number(code.uses) || 0), 0)
    return NextResponse.json({
      summary: { totalUses, activeCodes: codes.filter((code) => code.effective_active).length },
      codes,
      // Deliberately no referred user id, name, email, payment id, or amount.
      events,
    })
  } catch (error) {
    console.error('Referral dashboard error:', error)
    return NextResponse.json({ error: 'Could not load your referrals.' }, { status: 500 })
  }
}
