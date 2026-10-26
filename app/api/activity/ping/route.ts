import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pgErrorMessage } from '@/lib/pg-errors'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const userId = String(body?.user_id ?? '').trim()
        const seconds = Number(body?.seconds ?? 0)

        if (!userId) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
        }
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return NextResponse.json({ error: 'seconds must be a positive number' }, { status: 400 })
        }

        const today = new Date().toISOString().slice(0, 10)
        // One statement. The old select-then-write was two round trips to RDS,
        // and two pings at once could both insert and one would fail.
        await db.query(
            `INSERT INTO user_activity_daily (user_id, activity_date, seconds_active)
             VALUES ($1, $2::date, $3)
             ON CONFLICT (user_id, activity_date)
             DO UPDATE SET seconds_active = user_activity_daily.seconds_active + EXCLUDED.seconds_active,
                           updated_at = NOW()`,
            [userId, today, Math.round(seconds)],
        )

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Activity ping error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to record activity') }, { status: 500 })
    }
}
