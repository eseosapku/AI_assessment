import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
        const { data, error } = await supabase
            .from('user_activity_daily')
            .select('seconds_active')
            .eq('user_id', userId)
            .eq('activity_date', today)
            .maybeSingle()

        if (error) {
            console.error('Activity lookup error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const nextSeconds = (data?.seconds_active ?? 0) + seconds
        if (data) {
            const { error: updateError } = await supabase
                .from('user_activity_daily')
                .update({ seconds_active: nextSeconds, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('activity_date', today)

            if (updateError) {
                console.error('Activity update error:', updateError)
                return NextResponse.json({ error: updateError.message }, { status: 500 })
            }
        } else {
            const { error: insertError } = await supabase
                .from('user_activity_daily')
                .insert({ user_id: userId, activity_date: today, seconds_active: nextSeconds })

            if (insertError) {
                console.error('Activity insert error:', insertError)
                return NextResponse.json({ error: insertError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Activity ping error:', err)
        return NextResponse.json({ error: 'Failed to record activity' }, { status: 500 })
    }
}
