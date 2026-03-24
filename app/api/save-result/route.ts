import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, assessment_id, subject, topics, score, grade, feedback, answers, total_questions } = body

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Update the assessment record to mark as completed if assessment_id is provided
    if (assessment_id) {
      const { error: updateError } = await supabase
        .from('assessments')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', assessment_id)
      
      if (updateError) console.error('Error updating assessment status:', updateError)
    }

    const { data, error } = await supabase
      .from('results')
      .insert([
        {
          user_id,
          assessment_id: assessment_id || null,
          answers: answers || {},
          score: Math.round(score) || 0,
          total_questions: total_questions || 10,
          percentage: Math.round(score) || 0,
          feedback: feedback ? { text: feedback } : null
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
