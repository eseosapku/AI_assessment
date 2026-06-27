import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const userId = String(request.nextUrl.searchParams.get('user_id') ?? '').trim()
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Valid user_id required' }, { status: 400 })
  }

  try {
    const result = await db.query(
      'SELECT onboarding_completed FROM users WHERE id = $1 LIMIT 1',
      [userId],
    )
    const row = result.rows[0]
    if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json({ completed: Boolean(row.onboarding_completed) })
  } catch (error: any) {
    // Column may not exist yet on older DBs
    if (String(error?.message ?? '').includes('onboarding_completed')) {
      return NextResponse.json({ completed: false, fallback: true })
    }
    console.error('Onboarding GET error:', error)
    return NextResponse.json({ error: 'Failed to load onboarding status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = String(body.userId ?? '').trim()
    const completed = Boolean(body.completed)

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Valid userId required' }, { status: 400 })
    }

    await db.query(
      'UPDATE users SET onboarding_completed = $1 WHERE id = $2',
      [completed, userId],
    )
    return NextResponse.json({ success: true, completed })
  } catch (error: any) {
    if (String(error?.message ?? '').includes('onboarding_completed')) {
      return NextResponse.json({ success: true, completed: true, fallback: true })
    }
    console.error('Onboarding POST error:', error)
    return NextResponse.json({ error: 'Failed to update onboarding' }, { status: 500 })
  }
}
