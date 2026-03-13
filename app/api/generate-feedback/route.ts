import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export async function POST(request: NextRequest) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const body = await request.json()
    const { assessment, answers, longFormAnswers, longFormGrades, score, grade, className } = body

    if (!assessment || (!answers && !longFormAnswers)) {
      return NextResponse.json({ error: 'Assessment and answers are required' }, { status: 400 })
    }

    // Build performance summary covering both MCQ and long-form questions
    const performanceSummary = assessment.questions.map((q: any, idx: number) => {
      if (q.type === 'longform') {
        const lfGrade = longFormGrades?.[idx]
        if (!lfGrade) return `Q${idx + 1} (Long-form, ${q.marks} marks): Not yet graded`

        const metCriteria = lfGrade.criteria_results.filter((c: any) => c.met).map((c: any) => c.criterion)
        const missedCriteria = lfGrade.criteria_results.filter((c: any) => !c.met).map((c: any) => c.criterion)

        return `Q${idx + 1} (Long-form, ${q.marks} marks): ${lfGrade.marks_awarded}/${lfGrade.marks_total} marks earned
Question: ${q.question}
Criteria met: ${metCriteria.length > 0 ? metCriteria.join('; ') : 'None'}
Criteria missed: ${missedCriteria.length > 0 ? missedCriteria.join('; ') : 'None'}`
      }

      // MCQ
      const isCorrect = answers?.[idx] === q.correct_answer
      return `Q${idx + 1} (MCQ): ${q.question}
Student Answer: ${q.options?.[answers?.[idx]] || 'No answer'}
Correct Answer: ${q.options?.[q.correct_answer] || 'N/A'}
Status: ${isCorrect ? 'Correct' : 'Incorrect'}`
    }).join('\n\n')

    const hasLongForm = assessment.questions.some((q: any) => q.type === 'longform')
    const hasMCQ = assessment.questions.some((q: any) => q.type !== 'longform')

    const prompt = `You are an encouraging and insightful AI tutor. A student${className ? ` in ${className}` : ''} just completed an assessment on ${assessment.subject} (${assessment.topics.join(', ')}).
They scored ${score}% (Grade: ${grade}).
${hasLongForm ? 'The assessment included long-form written questions graded against specific marking criteria.' : ''}

Here is their performance breakdown:
${performanceSummary}

Based on their performance, provide personalised feedback strictly following this exact format:

Great work on your ${assessment.subject} assessment! 🎯
Scoring ${score}% shows a [brief comment on their overall performance]

**What you did well**
✅ [Strength based on correct answers / met criteria]
✅ [Second strength]
✅ [Third strength]

**Areas to improve**
⚠️ [Topic or skill]: [Specific feedback based on mistakes / missed criteria]
${hasMCQ && hasLongForm ? '⚠️ [Written answer skill if applicable]: [Specific feedback]' : ''}

**How to improve**
💡 [Actionable study tip 1]
💡 [Actionable study tip 2]

Keep the tone supportive and educational. Use exactly the symbols shown (✅ ⚠️ 💡). Do NOT use markdown dashes or asterisks for list items. DO use **bold** for the three section headers exactly as shown.`

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      })
      const feedback = completion.choices[0]?.message?.content?.trim() || ''
      return NextResponse.json({ feedback })
    } catch (aiError: any) {
      console.error('Groq AI Error:', aiError)
      return NextResponse.json({
        feedback: 'Great effort on completing the assessment! Review the explanations and criteria for the questions you missed to improve your understanding.',
      })
    }
  } catch (error) {
    console.error('Feedback generation error:', error)
    return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 })
  }
}
