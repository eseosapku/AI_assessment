import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subject, topics, count, style, className } = body

    // Validation
    if (!subject || !topics || !count) {
      return NextResponse.json(
        { error: 'Subject, topics, and count are required' },
        { status: 400 }
      )
    }

    // Construct the AI prompt
    const prompt = `You are an expert educational assessment generator. Create ${count} multiple-choice questions for a ${style} assessment.

**Subject:** ${subject}
**Topics:** ${topics.join(', ')}
**Question Count:** ${count}
**Style:** ${style}
${className ? `**Target Audience/Grade Level:** ${className}` : ''}

**Requirements:**
1. Generate exactly ${count} questions
2. Each question must have 4 options (A, B, C, D)
3. Include detailed explanations for correct answers
4. Questions should be appropriate for ${style === 'Exam Style' ? 'high-stakes exams' : 'practice tests'}
5. Vary difficulty levels appropriately
${className ? `6. Ensure the vocabulary, concepts, and difficulty are strictly appropriate for a student in ${className}.` : ''}
7. CRITICAL: For any math equations, formulas, or scientific notation, you MUST use LaTeX formatting. Wrap inline math in single dollar signs (e.g., $x^2 + y^2 = z^2$) and block math in double dollar signs (e.g., $$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$).

**CRITICAL: Return ONLY valid JSON in this EXACT format (no markdown, no additional text):**

{
  "assessment_id": "${Date.now()}-${Math.random().toString(36).substr(2, 9)}",
  "estimated_time": ${count * 2},
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Detailed explanation why this is correct"
    }
  ]
}

Generate the assessment now:`

    try {
      // Get Gemini model
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      
      // Generate content
      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      // Clean the response (remove markdown code blocks if present)
      let cleanedText = text.trim()
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\n?/g, '')
      }
      
      // Parse JSON
      const assessmentData = JSON.parse(cleanedText)
      
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
      
      // If it's a quota error, return a specific message
      if (aiError.message?.includes('429') || aiError.message?.includes('Quota')) {
        return NextResponse.json(
          { error: 'AI rate limit exceeded. Please wait a minute and try again.' },
          { status: 429 }
        )
      }
      
      // Fallback to mock data if AI fails for other reasons
      const mockResponse = generateMockAssessment(subject, topics, count, style)
      return NextResponse.json({
        ...mockResponse,
        subject,
        topics,
        ai_fallback: true
      })
    }

  } catch (error) {
    console.error('Generate assessment error:', error)
    return NextResponse.json(
      { error: 'Failed to generate assessment' },
      { status: 500 }
    )
  }
}

// Mock assessment generator for development
function generateMockAssessment(subject: string, topics: string[], count: number, style: string) {
  const questionsPerTopic = Math.ceil(count / topics.length)
  const questions = []

  for (let i = 0; i < count; i++) {
    const topicIndex = Math.floor(i / questionsPerTopic)
    const topic = topics[topicIndex] || topics[0]

    questions.push({
      id: i + 1,
      question: `${subject} - ${topic}: Sample question ${i + 1}. What is the fundamental concept related to this topic?`,
      options: [
        'Option A: This is the correct answer demonstrating understanding',
        'Option B: This is a plausible but incorrect distractor',
        'Option C: This is another common misconception',
        'Option D: This is clearly incorrect'
      ],
      correct_answer: 0,
      explanation: `The correct answer is Option A. This demonstrates a fundamental understanding of ${topic} in ${subject}. Option B is incorrect because it represents a common misconception. Option C fails to account for key principles. Option D contradicts the basic theory.`
    })
  }

  // Time calculation: ~1.5 minutes per question for exam style, ~1 minute for test style
  const timePerQuestion = style.includes('Exam') ? 1.5 : 1
  const estimatedTime = Math.ceil(count * timePerQuestion)

  return {
    assessment_id: `ASS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    estimated_time: estimatedTime,
    questions: questions
  }
}
