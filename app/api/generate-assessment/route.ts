import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subject, topics, count, style } = body

    // In production, replace with actual Gemini API call
    const geminiApiKey = process.env.GEMINI_API_KEY

    // Construct the AI prompt
    const prompt = `You are the engine for a premium AI Assessment Platform. Generate a structured JSON response for a student assessment based on the following inputs:

Subject: ${subject}
Topics: ${topics.join(', ')}
Question Count: ${count}
Style: ${style}

Requirements:
1. Time Calculation: Calculate the ideal duration (in minutes) based on the complexity of the subject and the number of questions.
2. Question Generation:
   - If 'Exam Style', mimic the tone and complexity of official board past papers.
   - If 'Test Style', focus on formative concepts from standard textbooks.
   - All questions must be Multiple Choice (MCQ) with 4 options each.
3. Feedback Loop: For each question, provide a "Rationalization" explaining why the correct answer is right and why distractors are wrong.

Output Format (STRICT JSON):
{
  "assessment_id": "unique_id",
  "estimated_time": number_in_minutes,
  "questions_array": [
    {
      "id": 1,
      "question": "question_text",
      "options": ["option_1", "option_2", "option_3", "option_4"],
      "correct_answer": index_of_correct_option (0-3),
      "feedback_text": "detailed_explanation"
    }
  ]
}

Return ONLY the JSON object, no additional text.`

    // Mock response for development (replace with actual Gemini API call)
    const mockResponse = generateMockAssessment(subject, topics, count, style)

    /* 
    // Actual Gemini API call (uncomment when ready)
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey || ''
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    })

    const data = await response.json()
    const generatedText = data.candidates[0].content.parts[0].text
    const assessmentData = JSON.parse(generatedText)
    */

    return NextResponse.json({
      ...mockResponse,
      subject,
      topics
    })

  } catch (error) {
    console.error('Error generating assessment:', error)
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
      feedback_text: `The correct answer is Option A. This demonstrates a fundamental understanding of ${topic} in ${subject}. Option B is incorrect because it represents a common misconception. Option C fails to account for key principles. Option D contradicts the basic theory.`
    })
  }

  // Time calculation: ~1.5 minutes per question for exam style, ~1 minute for test style
  const timePerQuestion = style.includes('Exam') ? 1.5 : 1
  const estimatedTime = Math.ceil(count * timePerQuestion)

  return {
    assessment_id: `ASS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    estimated_time: estimatedTime,
    questions_array: questions
  }
}
