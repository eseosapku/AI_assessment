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
        const existing = await db.query(
            'SELECT seconds_active FROM user_activity_daily WHERE user_id = $1 AND activity_date = $2 LIMIT 1',
            [userId, today]
        )

        const currentSeconds = Number(existing.rows[0]?.seconds_active ?? 0)
        const nextSeconds = currentSeconds + seconds

        if (existing.rows[0]) {
            await db.query(
                'UPDATE user_activity_daily SET seconds_active = $1, updated_at = NOW() WHERE user_id = $2 AND activity_date = $3',
                [nextSeconds, userId, today]
            )
        } else {
            await db.query(
                'INSERT INTO user_activity_daily (user_id, activity_date, seconds_active) VALUES ($1, $2, $3)',
                [userId, today, nextSeconds]
            )
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Activity ping error:', err)
        return NextResponse.json({ error: pgErrorMessage(err, 'Failed to record activity') }, { status: 500 })
    }
}
