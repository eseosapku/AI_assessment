import { NextRequest, NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assessment, answers, longFormAnswers, longFormGrades, score, grade, className } = body

    if (!assessment || (!answers && !longFormAnswers)) {
      return NextResponse.json({ error: 'Assessment and answers are required' }, { status: 400 })
    }

    const hasLongForm = assessment.questions.some((q: any) => q.type === 'longform')
    const hasMCQ = assessment.questions.some((q: any) => q.type !== 'longform')

    // Build a detailed per-question performance summary
    const performanceSummary = assessment.questions.map((q: any, idx: number) => {
      if (q.type === 'longform') {
        const g = longFormGrades?.[idx]
        if (!g) return `Q${idx + 1} [Long-form, ${q.marks} marks]: Answer not yet graded.`
        const met = g.criteria_results.filter((c: any) => c.met).map((c: any) => c.criterion)
        const missed = g.criteria_results.filter((c: any) => !c.met).map((c: any) => c.criterion)
        return [
          `Q${idx + 1} [Long-form, ${q.marks} marks — scored ${g.marks_awarded}/${g.marks_total}]`,
          `Question: ${q.question}`,
          `Criteria MET: ${met.length ? met.join(' | ') : 'None'}`,
          `Criteria MISSED: ${missed.length ? missed.join(' | ') : 'None'}`,
        ].join('\n')
      }
      const isCorrect = answers?.[idx] === q.correct_answer
      const chosen = q.options?.[answers?.[idx]] ?? 'No answer'
      const correct = q.options?.[q.correct_answer] ?? 'N/A'
      return [
        `Q${idx + 1} [MCQ — ${isCorrect ? 'CORRECT ✓' : 'INCORRECT ✗'}]`,
        `Question: ${q.question}`,
        isCorrect ? `Student correctly chose: ${chosen}` : `Student chose: "${chosen}" — Correct answer: "${correct}"`,
      ].join('\n')
    }).join('\n\n')

    const prompt = `You are an expert, encouraging academic tutor giving detailed written feedback to a student.

STUDENT PROFILE: ${className ? `Class/Year: ${className}` : 'Secondary school student'}
SUBJECT: ${assessment.subject} — Topics: ${assessment.topics?.join(', ')}
FINAL SCORE: ${score}% (Grade ${grade})
QUESTION TYPES: ${hasLongForm && hasMCQ ? 'Mixed MCQ + Long-form written' : hasLongForm ? 'Long-form written' : 'Multiple choice'}

DETAILED PERFORMANCE:
${performanceSummary}

─────────────────────────────────────────────
INSTRUCTIONS — READ CAREFULLY:
Write feedback that is SPECIFIC, DETAILED, and genuinely useful. Minimum 250 words total.
Do NOT use vague phrases like "good effort" or "keep trying" without explanation.
Every point MUST reference specific questions, topics, or criteria from the performance data above.
Use EXACTLY this format — no extra sections, no bullet dashes:

**What you did well**
✅ [Name the specific topic/question/criterion the student mastered — explain WHY their approach was correct in 2-3 sentences]
✅ [Second specific strength — quote or reference a question number or criterion they got right]
✅ [Third strength — if they got long-form marks, reference which criteria they met and why that shows understanding]

**Areas to improve**
⚠️ [Specific topic or question]: [2-3 sentence explanation of the exact misconception or gap shown by their wrong answer or missed criterion — be precise about what they got wrong and why]
⚠️ [Second weak area]: [Same level of specificity — name the question, what they answered, what was expected]
${hasLongForm ? '⚠️ [Written answer skill if applicable]: [Specific feedback on their analytical writing — what structure or evidence they missed]' : ''}

**How to improve**
💡 [Concrete, subject-specific revision tip directly addressing their weakest area — name a technique, method, or concept to study]
💡 [Second actionable tip — suggest a specific type of practice question or skill to develop]
💡 [Third tip if relevant — mention a resource type, exam technique, or habit that would help this specific student]

─────────────────────────────────────────────
Use exactly the symbols shown (✅ ⚠️ 💡). Use **bold** only for the three section headers. Write in full sentences. Be specific — generic feedback is not acceptable.`

    // Build the static fallback first so it's available in all paths
    const missed = assessment.questions
      .map((q: any, idx: number) => {
        if (q.type === 'longform') return null
        return answers?.[idx] !== q.correct_answer ? `Q${idx + 1} (${q.question?.slice(0, 60)}…)` : null
      })
      .filter(Boolean)
      .slice(0, 3)
      .join(', ')

    const fallback = [
      `**What you did well**`,
      `✅ You completed the assessment and demonstrated effort across the questions.`,
      `✅ Your score of ${score}% shows you have a foundation in ${assessment.subject} to build on.`,
      `✅ Attempting all questions shows good exam technique.`,
      ``,
      `**Areas to improve**`,
      missed
        ? `⚠️ Review the following questions where your answer was incorrect: ${missed}. Go back to the explanations provided for each one.`
        : `⚠️ Review all topic areas to consolidate your knowledge.`,
      `⚠️ Make sure you read each question carefully and check your working before selecting an answer.`,
      ``,
      `**How to improve**`,
      `💡 Go through each incorrect answer in the Detailed Review below and read the explanation carefully.`,
      `💡 Make revision notes on the topics you found difficult and practise similar questions.`,
      `💡 Attempt this assessment again after revision to track your progress.`,
    ].join('\n')

    // If no AWS credentials, return the fallback
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json({ feedback: fallback })
    }

    try {
      const client = new BedrockRuntimeClient({
        region: process.env.AWS_REGION ?? 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      })
      const cmd = new InvokeModelCommand({
        modelId: 'us.amazon.nova-lite-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 900, temperature: 0.65 },
        }),
      })
      const res = await client.send(cmd)
      const feedback = (JSON.parse(new TextDecoder().decode(res.body))?.output?.message?.content?.[0]?.text ?? '').trim()
      return NextResponse.json({ feedback: feedback || fallback })
    } catch (aiError: any) {
      console.error('Bedrock feedback error:', aiError)
      return NextResponse.json({ feedback: fallback })
    }
  } catch (error) {
    console.error('Feedback generation error:', error)
    return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 })
  }
}
