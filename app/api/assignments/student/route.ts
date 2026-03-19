import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    // Fetch all assignments where this student's email is in the list
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .contains('student_emails', [email.toLowerCase()])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Assignment fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ assignments: data ?? [] })
  } catch (err) {
    console.error('Assignment fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}
