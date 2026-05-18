import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, score, grade, feedback } = body

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const payload = {
      user_id,
      assessment_id: body.assessment_id || null,
      answers: body.answers || {},
      score,
      total_questions: body.total_questions || 10,
      percentage: score,
      feedback: { text: feedback },
      grade: grade ?? null,
      questions_data: body.questions_data ?? null,
      longform_grades: body.longform_grades ?? null,
    }

    let { error } = await supabase
      .from('results')
      .insert([payload])

    if (error && /column .* does not exist/i.test(error.message)) {
      const { grade: _grade, questions_data: _questions, longform_grades: _grades, ...fallback } = payload
      const retry = await supabase.from('results').insert([fallback])
      error = retry.error
    }

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
