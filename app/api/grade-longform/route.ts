import { NextRequest, NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

export async function POST(request: NextRequest) {
  try {
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

    // ── Copy-paste detection (no AI needed) ──────────────────────────────────
    // If >65% of the student's words appear verbatim in the passage, it's a paste.
    function isCopied(answer: string, passage: string | undefined): boolean {
      if (!passage || !answer) return false
      const passageWords = new Set(passage.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean))
      const answerWords = answer.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
      if (answerWords.length < 20) return false
      const matchCount = answerWords.filter(w => passageWords.has(w)).length
      return matchCount / answerWords.length > 0.65
    }

    // Build zero-mark results for unanswered or copied questions
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
      if (isCopied(studentAnswer, q.passage)) {
        emptyGrades[idx] = {
          marks_awarded: 0,
          marks_total: q.marks,
          criteria_results: q.marking_criteria.map((c: string) => ({
            criterion: c,
            met: false,
            relevant_quote: null,
            note: 'Answer appears to be copied directly from the passage. You must write in your own words.',
          })),
          general_feedback: 'Your answer was copied from the passage and cannot be awarded marks. You need to select specific quotes and explain them in your own words — describe what the language does and why the author chose it.',
        }
        return false
      }
      return true
    })

    if (questionsToGrade.length === 0) {
      return NextResponse.json({ grades: emptyGrades })
    }

    // ── Single Bedrock call grades ALL long-form questions at once ────────────
    const questionsBlock = questionsToGrade
      .map(({ q, idx }: any, i: number) => {
        const studentAnswer = (answers[idx] || '').trim()
        const criteriaList = q.marking_criteria
          .map((c: string, ci: number) => `  ${ci + 1}. ${c}`)
          .join('\n')

        const passageSection = q.passage
          ? `\nREADING PASSAGE (source text the student was given):\n"""\n${q.passage}\n"""`
          : ''

        // Truncate very long answers to keep prompt within token budget
        const truncatedAnswer = studentAnswer.length > 1200
          ? studentAnswer.slice(0, 1200) + '… [truncated]'
          : studentAnswer

        return `--- QUESTION ${i + 1} (index ${idx}) [${q.marks} marks] ---
Question: ${q.question}
Marking criteria (1 mark each):
${criteriaList}
Model answer summary: ${q.model_answer ?? '(none provided)'}${passageSection}
Student's answer: "${truncatedAnswer}"`
      })
      .join('\n\n')

    const indexList = questionsToGrade.map(({ idx }: any) => idx).join(', ')

    const prompt = `You are a strict but fair examiner. Grade the following ${questionsToGrade.length} long-form answer(s) for a ${subject} assessment.

${questionsBlock}

CRITICAL GRADING RULES:
1. If a READING PASSAGE is provided, the student MUST respond in their OWN WORDS using analysis, not just copy text from the passage. If their answer is mostly or entirely copied/paraphrased directly from the passage without any personal analysis, interpretation, or structured argument, award 0 marks and mark ALL criteria as not met — copying is not answering.
2. A valid answer requires the student to demonstrate understanding: they must select evidence AND explain/analyse it. Quoting alone does not meet any criterion.
3. If no passage is provided, grade on content quality and whether each criterion is addressed.
4. For each criterion that IS met, identify the most relevant short phrase from the student's OWN words (not copied passage text) as "relevant_quote". If not met, set it to null.

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

    async function tryGrade(): Promise<Record<number, any>> {
      const client = new BedrockRuntimeClient({
        region: 'eu-west-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      })
      const cmd = new InvokeModelCommand({
        modelId: 'eu.google.gemma-3-27b-it-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.2,
        }),
      })
      const res = await client.send(cmd)
      const parsedBody = JSON.parse(new TextDecoder().decode(res.body))
      let text = (parsedBody?.choices?.[0]?.message?.content ?? parsedBody?.choices?.[0]?.text ?? '').trim()
      text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(text)
      const aiGrades: Record<string, any> = parsed.grades ?? {}

      const grades: Record<number, any> = { ...emptyGrades }
      questionsToGrade.forEach(({ q, idx }: any) => {
        const g = aiGrades[String(idx)] ?? aiGrades[idx]
        grades[idx] = g ? {
          marks_awarded: Math.max(0, Math.min(q.marks, g.marks_awarded ?? 0)),
          marks_total: q.marks,
          criteria_results: g.criteria_results ?? [],
          general_feedback: g.general_feedback ?? '',
        } : {
          marks_awarded: 0,
          marks_total: q.marks,
          criteria_results: q.marking_criteria.map((c: string) => ({
            criterion: c, met: false, relevant_quote: null, note: 'Could not be automatically graded.',
          })),
          general_feedback: 'This answer could not be automatically graded.',
        }
      })
      return grades
    }

    try {
      const grades = await tryGrade()
      return NextResponse.json({ grades })
    } catch (err: any) {
      console.error('Grading AI error:', err)
      const fallbackGrades: Record<number, any> = { ...emptyGrades }
      questionsToGrade.forEach(({ q, idx }: any) => {
        fallbackGrades[idx] = {
          marks_awarded: 0,
          marks_total: q.marks,
          criteria_results: q.marking_criteria.map((c: string) => ({
            criterion: c, met: false, relevant_quote: null, note: 'Automatic grading failed.',
          })),
          general_feedback: 'Automatic grading encountered an error.',
        }
      })
      return NextResponse.json({ grades: fallbackGrades })
    }
  } catch (error: any) {
    console.error('Grade longform route error:', error)
    return NextResponse.json({ error: 'Failed to grade answers' }, { status: 500 })
  }
}
