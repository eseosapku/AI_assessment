import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, subject, topics, score, grade, feedback } = body

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('results')
      .insert([
        {
          user_id,
          assessment_id: body.assessment_id || null,
          answers: body.answers || {},
          score,
          total_questions: body.total_questions || 10,
          percentage: score,
          feedback: { text: feedback }
        }
      ])

    if (error) {
      console.error('Supabase insert error:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Assessment result saved successfully'
    })

  } catch (error) {
    console.error('Error saving result:', error)
    return NextResponse.json(
      { error: 'Failed to save assessment result' },
      { status: 500 }
    )
  }
}
