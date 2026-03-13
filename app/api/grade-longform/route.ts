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

    const longFormQuestions = questions
      .map((q: any, idx: number) => ({ q, idx }))
      .filter(({ q }: any) => q.type === 'longform')

    if (longFormQuestions.length === 0) {
      return NextResponse.json({ grades: {} })
    }

    // Build zero-mark results for unanswered questions so we can skip them in the AI call
    const emptyGrades: Record<number, any> = {}
    const questionsToGrade = longFormQuestions.filter(({ q, idx }: any) => {
      const studentAnswer = (answers[idx] || '').trim()
      if (!studentAnswer) {
        emptyGrades[idx] = {
          marks_awarded: 0,
          marks_total: q.marks,
          criteria_results: q.marking_criteria.map((c: string) => ({
            criterion: c,
            met: false,
            relevant_quote: null,
            note: 'No answer provided.',
          })),
          general_feedback: 'No answer was written for this question.',
        }
        return false
      }
      return true
    })

    if (questionsToGrade.length === 0) {
      return NextResponse.json({ grades: emptyGrades })
    }

    // ── Single Groq call grades ALL long-form questions at once ───────────────
    // This avoids multiple rapid-fire API calls that would breach the TPM limit.
    const questionsBlock = questionsToGrade
      .map(({ q, idx }: any, i: number) => {
        const studentAnswer = (answers[idx] || '').trim()
        const criteriaList = q.marking_criteria
          .map((c: string, ci: number) => `  ${ci + 1}. ${c}`)
          .join('\n')

        return `--- QUESTION ${i + 1} (index ${idx}) [${q.marks} marks] ---
Question: ${q.question}
Marking criteria (1 mark each):
${criteriaList}
Model answer summary: ${q.model_answer ?? '(none provided)'}
Student's answer: "${studentAnswer}"`
      })
      .join('\n\n')

    const indexList = questionsToGrade.map(({ idx }: any) => idx).join(', ')

    const prompt = `You are a strict but fair examiner. Grade the following ${questionsToGrade.length} long-form answer(s) for a ${subject} assessment.

${questionsBlock}

For each question, evaluate whether the student has met each criterion. If they have, identify the most relevant short phrase from their answer as "relevant_quote". If not, set it to null.

Return ONLY valid JSON — no markdown, no extra keys:
{
  "grades": {
${questionsToGrade
  .map(({ q, idx }: any) => `    "${idx}": {
      "marks_awarded": <integer 0-${q.marks}>,
      "criteria_results": [
        { "criterion": "<exact criterion text>", "met": <true|false>, "relevant_quote": "<short quote or null>", "note": "<one sentence why met or not>" }
      ],
      "general_feedback": "<2-3 sentence encouraging, specific feedback on this answer>"
    }`)
  .join(',\n')}
  }
}

Indices to grade: ${indexList}`

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      })

      let text = (completion.choices[0]?.message?.content || '').trim()
      text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(text)
      const aiGrades: Record<string, any> = parsed.grades ?? {}

      // Merge AI grades with empty grades, clamp marks to valid range
      const grades: Record<number, any> = { ...emptyGrades }
      questionsToGrade.forEach(({ q, idx }: any) => {
        const g = aiGrades[String(idx)] ?? aiGrades[idx]
        if (g) {
          grades[idx] = {
            marks_awarded: Math.max(0, Math.min(q.marks, g.marks_awarded ?? 0)),
            marks_total: q.marks,
            criteria_results: g.criteria_results ?? [],
            general_feedback: g.general_feedback ?? '',
          }
        } else {
          // AI didn't return a grade for this question — fallback
          grades[idx] = {
            marks_awarded: 0,
            marks_total: q.marks,
            criteria_results: q.marking_criteria.map((c: string) => ({
              criterion: c,
              met: false,
              relevant_quote: null,
              note: 'Could not be automatically graded.',
            })),
            general_feedback: 'This answer could not be automatically graded. Please review manually.',
          }
        }
      })

      return NextResponse.json({ grades })
    } catch (err: any) {
      console.error('Grading AI error:', err)
      // Return zero marks for all questions rather than crashing
      const fallbackGrades: Record<number, any> = { ...emptyGrades }
      questionsToGrade.forEach(({ q, idx }: any) => {
        fallbackGrades[idx] = {
          marks_awarded: 0,
          marks_total: q.marks,
          criteria_results: q.marking_criteria.map((c: string) => ({
            criterion: c,
            met: false,
            relevant_quote: null,
            note: 'Automatic grading failed. Please review this answer manually.',
          })),
          general_feedback: err?.status === 429
            ? 'Grading was rate-limited. Please wait a moment and resubmit.'
            : 'Automatic grading encountered an error.',
        }
      })
      return NextResponse.json({ grades: fallbackGrades })
    }
  } catch (error: any) {
    console.error('Grade longform route error:', error)
    return NextResponse.json({ error: 'Failed to grade answers' }, { status: 500 })
  }
}
