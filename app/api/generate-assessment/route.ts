import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getCurriculumContext, type GradeLevel } from '@/lib/rwanda-curriculum'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subject, topics, count, style, className, grade, curriculum } = body

    // Validation
    if (!subject || !topics || !count) {
      return NextResponse.json(
        { error: 'Subject, topics, and count are required' },
        { status: 400 }
      )
    }

    // Build curriculum context block
    const curriculumBlock =
      curriculum === 'rwanda-reb' && grade
        ? getCurriculumContext(grade as GradeLevel, subject, topics)
        : className
        ? `**Target Audience/Grade Level:** ${className}`
        : ''

    // Construct the AI prompt
    const prompt = `You are an expert educational assessment generator aligned with the Rwanda National Competence-Based Curriculum (REB). Create ${count} multiple-choice questions for a ${style} assessment.

${curriculumBlock}

**Subject:** ${subject}
**Topics:** ${topics.join(', ')}
**Question Count:** ${count}
**Style:** ${style}

**Requirements:**
1. Generate exactly ${count} questions strictly based on the Rwanda Education Board (REB) syllabus topics listed above
2. Each question must have 4 options (A, B, C, D)
3. Include detailed explanations for correct answers
4. Questions should be appropriate for ${style.includes('Exam') ? 'high-stakes national exams (O-Level or A-Level as applicable)' : 'classroom practice tests'}
5. Vary difficulty levels (recall, application, analysis) as per the competence-based approach
6. Ensure vocabulary, context, and difficulty strictly match the grade level and REB curriculum standards
7. CRITICAL: For any math equations, formulas, or scientific notation, you MUST use LaTeX formatting. Wrap inline math in single dollar signs (e.g., $x^2 + y^2 = z^2$) and block math in double dollar signs (e.g., $$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$).

**CRITICAL: Return ONLY a valid JSON object. No markdown, no explanation, no extra text — just the JSON.**

The JSON must follow this exact schema:
{
  "assessment_id": "auto",
  "estimated_time": ${count * 2},
  "questions": [
    {
      "id": 1,
      "question": "Full question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_answer": 0,
      "explanation": "Detailed explanation of why the correct answer is right and why others are wrong"
    }
  ]
}

Rules:
- "correct_answer" is the zero-based index (0=A, 1=B, 2=C, 3=D)
- Generate all ${count} questions
- Do NOT wrap in markdown code blocks

Generate the assessment now:`

    try {
      // Get Gemini model with JSON mode enforced
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      })

      // Generate content
      const result = await model.generateContent(prompt)
      const response = result.response
      const text = response.text()

      // Robust JSON extraction: strip markdown fences, then find the outermost {...}
      let cleanedText = text.trim()
      cleanedText = cleanedText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      // If there's still surrounding text, extract the JSON object
      if (!cleanedText.startsWith('{')) {
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        }
      }

      // Parse JSON
      let assessmentData: any
      try {
        assessmentData = JSON.parse(cleanedText)
      } catch (parseError) {
        console.error('JSON parse failed. Raw response:', text)
        throw new Error(`AI returned invalid JSON. Raw: ${text.substring(0, 200)}`)
      }
      
      // Save assessment to database
      const { supabase } = require('@/lib/supabase')
      const { data: dbAssessment, error: dbError } = await supabase
        .from('assessments')
        .insert([
          {
            user_id: body.user_id || null,
            subject,
            difficulty: style,
            duration: count * 2,
            questions_data: assessmentData.questions,
            status: 'completed'
          }
        ])
        .select()
        .single()

      if (dbError) {
        console.error('Error saving assessment to DB:', dbError)
      }
      
      return NextResponse.json({
        ...assessmentData,
        assessment_id: dbAssessment?.id || assessmentData.assessment_id,
        subject,
        topics,
        style
      })
      
    } catch (aiError: any) {
      console.error('Gemini AI Error:', aiError)

      if (aiError.message?.includes('429') || aiError.message?.includes('Quota')) {
        return NextResponse.json(
          { error: 'AI rate limit exceeded. Please wait a minute and try again.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: `AI generation failed: ${aiError.message || 'Unknown error'}. Please try again.` },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Generate assessment error:', error)
    return NextResponse.json(
      { error: 'Failed to generate assessment' },
      { status: 500 }
    )
  }
}
