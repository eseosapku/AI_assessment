import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export async function POST(request: NextRequest) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const body = await request.json()
    const { questions, answers, subject } = body

    if (!questions || !answers) {
      return NextResponse.json({ error: 'Questions and answers required' }, { status: 400 })
    }

    const longFormQuestions = questions.filter((q: any) => q.type === 'longform')

    const gradePromises = longFormQuestions.map(async (q: any) => {
      const questionIndex = questions.indexOf(q)
      const studentAnswer = (answers[questionIndex] || '').trim()

      if (!studentAnswer) {
        return {
          questionIndex,
          grade: {
            marks_awarded: 0,
            marks_total: q.marks,
            criteria_results: q.marking_criteria.map((c: string) => ({
              criterion: c,
              met: false,
              relevant_quote: null,
              note: 'No answer provided.',
            })),
            general_feedback: 'No answer was written for this question.',
          },
        }
      }

      const criteriaList = q.marking_criteria
        .map((c: string, i: number) => `${i + 1}. ${c}`)
        .join('\n')

      const prompt = `You are a strict but fair examiner grading a student's written answer.

SUBJECT: ${subject}
QUESTION: ${q.question}
TOTAL MARKS: ${q.marks}

MARKING CRITERIA (each criterion = 1 mark):
${criteriaList}

MODEL ANSWER:
${q.model_answer}

STUDENT'S ANSWER:
"${studentAnswer}"

Grade this answer carefully. For each criterion, decide if the student has addressed it (fully or sufficiently). If they have, copy the most relevant short phrase or sentence from the student's answer verbatim as "relevant_quote". If they have not, set relevant_quote to null.

Return ONLY valid JSON exactly matching this schema (no markdown, no extra keys):
{
  "marks_awarded": <integer 0 to ${q.marks}>,
  "criteria_results": [
    {
      "criterion": "<exact criterion text from the list>",
      "met": <true or false>,
      "relevant_quote": "<short verbatim quote from student answer, or null>",
      "note": "<one sentence: why criterion was or was not met>"
    }
  ],
  "general_feedback": "<2-3 sentences of encouraging, specific feedback on the answer quality>"
}`

      try {
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        })

        let text = (completion.choices[0]?.message?.content || '').trim()
        text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
        const gradeData = JSON.parse(text)

        // Clamp marks to valid range
        const marks_awarded = Math.max(0, Math.min(q.marks, gradeData.marks_awarded ?? 0))

        return {
          questionIndex,
          grade: {
            marks_awarded,
            marks_total: q.marks,
            criteria_results: gradeData.criteria_results ?? [],
            general_feedback: gradeData.general_feedback ?? '',
          },
        }
      } catch (err) {
        console.error('Grading error for question', questionIndex, err)
        return {
          questionIndex,
          grade: {
            marks_awarded: 0,
            marks_total: q.marks,
            criteria_results: q.marking_criteria.map((c: string) => ({
              criterion: c,
              met: false,
              relevant_quote: null,
              note: 'Automatic grading failed for this criterion.',
            })),
            general_feedback: 'Unable to automatically grade this answer. Please review manually.',
          },
        }
      }
    })

    const results = await Promise.all(gradePromises)
    const grades: Record<number, any> = {}
    results.forEach(({ questionIndex, grade }) => {
      grades[questionIndex] = grade
    })

    return NextResponse.json({ grades })
  } catch (error: any) {
    console.error('Grade longform error:', error)
    return NextResponse.json({ error: 'Failed to grade answers' }, { status: 500 })
  }
}
