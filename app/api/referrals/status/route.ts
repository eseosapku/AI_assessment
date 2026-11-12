import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'A valid user is required.' }, { status: 400 })
  }

  try {
    const { rows } = await db.query<{ active: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM referral_codes
          WHERE owner_user_id = $1
            AND active = TRUE
            AND (expires_at IS NULL OR expires_at > NOW())
       ) AS active`,
      [userId],
    )
    return NextResponse.json({ active: rows[0]?.active === true })
  } catch (error) {
    console.error('Referral status error:', error)
    return NextResponse.json({ error: 'Could not check referral status.' }, { status: 500 })
  }
}
