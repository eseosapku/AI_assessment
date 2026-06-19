import { NextRequest, NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { getBedrockCredentials, getBedrockRegion } from '@/lib/aws-config'
import { gradeInteractiveQuestion } from '@/lib/grade-interactive'
import { normalizeInteractiveQuestion } from '@/lib/interactive-assessment-plan'


const AWS_REGION = getBedrockRegion()
const DEFAULT_FEEDBACK_MODEL =
  process.env.AWS_FEEDBACK_MODEL_ID ||
  process.env.AWS_BEDROCK_MODEL_ID ||
  process.env.AWS_MODEL_ID ||
  'google.gemma-3-27b-it'

const PREFIXES = ['eu', 'us', 'ap'] as const

function stripPrefix(modelId: string): string {
  return modelId.replace(/^(us|eu|ap)\./, '')
}

function modelFamily(modelId: string): string {
  return stripPrefix(modelId)
}

function buildModelCandidates(seedIds: string[]): string[] {
  const expanded: string[] = []

  const appendWithPrefixes = (id: string) => {
    const clean = (id || '').trim()
    if (!clean) return

    const bare = stripPrefix(clean)
    expanded.push(clean)
    expanded.push(bare)
    PREFIXES.forEach((p) => expanded.push(`${p}.${bare}`))
  }

  seedIds.forEach(appendWithPrefixes)
  appendWithPrefixes('google.gemma-3-27b-it')
  appendWithPrefixes('google.gemma-3-27b-it-v1:0')

  return [...new Set(expanded.filter(Boolean))]
}

function isModelIdError(err: any): boolean {
  const text = `${err?.name || ''} ${err?.message || ''}`.toLowerCase()
  return (
    text.includes('provided model identifier is invalid') ||
    text.includes('invalid model') ||
    text.includes('validationexception') ||
    text.includes('on-demand throughput')
  )
}

function buildInvokeBody(modelId: string, prompt: string, maxTokens: number, temperature: number): string {
  const family = modelFamily(modelId)

  if (family.startsWith('amazon.nova')) {
    return JSON.stringify({
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens, temperature },
    })
  }

  if (family.startsWith('meta.llama')) {
    return JSON.stringify({
      prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
      max_gen_len: maxTokens,
      temperature,
    })
  }

  return JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
  })
}

function extractBedrockText(modelId: string, payload: any): string {
  const family = modelFamily(modelId)

  if (family.startsWith('amazon.nova')) {
    return payload?.output?.message?.content?.[0]?.text ?? ''
  }

  if (family.startsWith('meta.llama')) {
    return payload?.generation ?? ''
  }

  const raw =
    payload?.choices?.[0]?.message?.content ??
    payload?.choices?.[0]?.text ??
    payload?.output?.message?.content?.[0]?.text ??
    payload?.output_text ??
    payload?.content?.[0]?.text ??
    payload?.outputs?.[0]?.text ??
    ''

  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => (typeof item === 'string' ? item : item?.text || ''))
      .join('\n')
      .trim()
  }

  return String(raw || '').trim()
}

async function callFeedbackModel(
  client: BedrockRuntimeClient,
  prompt: string,
  modelCandidates: string[]
): Promise<string> {
  let lastErr: any = null

  for (const modelId of modelCandidates) {
    try {
      const cmd = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: buildInvokeBody(modelId, prompt, 900, 0.65),
      })

      const res = await client.send(cmd)
      const parsed = JSON.parse(new TextDecoder().decode(res.body))
      const feedback = extractBedrockText(modelId, parsed)
      if (feedback.trim()) return feedback.trim()
      throw new Error(`Empty model response from ${modelId}`)
    } catch (err: any) {
      lastErr = err
      if (isModelIdError(err)) continue
      throw err
    }
  }

  throw lastErr || new Error('No feedback model candidate succeeded.')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assessment, answers, longFormAnswers, longFormGrades, interactiveAnswers, interactiveGrades, score, grade, className } = body

    if (!assessment || (!answers && !longFormAnswers && !interactiveAnswers)) {
      return NextResponse.json({ error: 'Assessment and answers are required' }, { status: 400 })
    }

    const hasLongForm = assessment.questions.some((q: any) => q.type === 'longform')
    const hasInteractive = assessment.questions.some((q: any) => q.type === 'interactive')
    const hasMCQ = assessment.questions.some((q: any) => q.type === 'mcq' || (!q.type && Array.isArray(q.options)))

    const questionTypesLabel = [
      hasMCQ && 'MCQ',
      hasInteractive && 'Interactive study',
      hasLongForm && 'Long-form written',
    ].filter(Boolean).join(' + ') || 'Mixed'

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
      if (q.type === 'interactive') {
        const normalized = normalizeInteractiveQuestion(q)
        const ans = interactiveAnswers?.[idx] ?? interactiveAnswers?.[String(idx)]
        const g = interactiveGrades?.[idx] ?? interactiveGrades?.[String(idx)]
          ?? (normalized ? gradeInteractiveQuestion(normalized, ans) : null)
        if (!g) return `Q${idx + 1} [Interactive — ${q.kind}]: Not graded.`
        const missed = g.item_results.filter((r: any) => !r.correct).map((r: any) => r.label)
        return [
          `Q${idx + 1} [Interactive ${q.kind} — scored ${g.marks_awarded}/${g.marks_total}]`,
          `Question: ${q.question}`,
          missed.length ? `Items missed: ${missed.join(' | ')}` : 'All items correct.',
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
QUESTION TYPES: ${questionTypesLabel}

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
        if (q.type === 'longform' || q.type === 'interactive') return null
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

    const credentials = getBedrockCredentials()
    if (!credentials) {
      return NextResponse.json({ feedback: fallback })
    }

    try {
      const client = new BedrockRuntimeClient({
        region: AWS_REGION,
        credentials,
      })

      const modelCandidates = buildModelCandidates([
        String(body?.aiModel || ''),
        DEFAULT_FEEDBACK_MODEL,
      ])

      const feedback = await callFeedbackModel(client, prompt, modelCandidates)
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
