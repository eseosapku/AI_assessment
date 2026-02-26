import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assessment, answers, score, grade, className } = body

    if (!assessment || !answers) {
      return NextResponse.json(
        { error: 'Assessment and answers are required' },
        { status: 400 }
      )
    }

    // Prepare a summary of how the student did
    const performanceSummary = assessment.questions.map((q: any, idx: number) => {
      const isCorrect = answers[idx] === q.correct_answer
      return `Q${idx + 1}: ${q.question}
Student Answer: ${q.options[answers[idx]] || 'No answer'}
Correct Answer: ${q.options[q.correct_answer]}
Status: ${isCorrect ? 'Correct' : 'Incorrect'}`
    }).join('\n\n')

    const prompt = `You are an encouraging and insightful AI tutor. A student${className ? ` in ${className}` : ''} just completed an assessment on ${assessment.subject} (${assessment.topics.join(', ')}).
They scored ${score}% (Grade: ${grade}).

Here is their performance breakdown:
${performanceSummary}

Based on their answers, provide a short, personalized feedback paragraph (3-4 sentences). 
Highlight what they did well, identify any specific areas or concepts they struggled with based on their incorrect answers, and offer a brief tip for improvement. Keep the tone supportive and educational. Do not use markdown formatting like bold or italics, just plain text.`

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      const result = await model.generateContent(prompt)
      const response = await result.response
      const feedback = response.text().trim()
      
      return NextResponse.json({ feedback })
    } catch (aiError: any) {
      console.error('Gemini AI Error:', aiError)
      return NextResponse.json(
        { feedback: "Great effort on completing the assessment! Review the explanations for the questions you missed to improve your understanding of these topics." },
        { status: 200 } // Fallback feedback
      )
    }

  } catch (error) {
    console.error('Feedback generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate feedback' },
      { status: 500 }
    )
  }
}
