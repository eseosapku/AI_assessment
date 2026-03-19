import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const teacher_id = request.nextUrl.searchParams.get('teacher_id')
    if (!teacher_id) return NextResponse.json({ error: 'teacher_id required' }, { status: 400 })

    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('teacher_id', teacher_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Teacher assignments fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ assignments: data ?? [] })
  } catch (err) {
    console.error('Teacher assignments fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}
