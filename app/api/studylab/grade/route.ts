import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust, hasBedrockCredentials } from '@/lib/bedrock'
import { BEDROCK_CREDENTIALS_ERROR } from '@/lib/aws-config'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'

function gradedCorrect(value: unknown): boolean | null {
  if (value === true || value === false) return value
  const text = String(value ?? '').trim().toLowerCase()
  if (text === 'true') return true
  if (text === 'false') return false
  return null
}

function buildPrompt(o: {
  prompt: string
  format: string
  answer: string
  rubric?: string
  goal?: string
  output?: string
}): string {
  const criterion =
    o.format === 'code'
      ? `GOAL the code must meet: ${o.goal ?? '(unspecified)'}\nThe student's program output was:\n${o.output ?? '(not run)'}`
      : `RUBRIC / expected idea: ${o.rubric ?? '(use your judgement)'}`
  return `You are grading a student's answer to one short practice question. Be encouraging but honest.

QUESTION: ${o.prompt}
${criterion}
STUDENT'S ANSWER:
${o.answer}

Reply with ONLY a JSON object: {"correct": <true|false>, "feedback": "<one or two warm sentences: what was right, and the key fix if wrong>"}`
}

export async function POST(request: NextRequest) {
  try {
    if (!hasBedrockCredentials()) {
      return NextResponse.json({ error: BEDROCK_CREDENTIALS_ERROR }, { status: 500 })
    }

    const body = await request.json()
    const userId = String(body?.user_id ?? '').trim()
    if (userId) {
      const gate = await assertSubscriptionAccess(userId, 'study')
      if (!gate.allowed) return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
    }

    const prompt = String(body?.prompt ?? '').trim()
    const format = body?.format === 'code' ? 'code' : 'short'
    const answer = String(body?.answer ?? '').trim()
    if (!prompt || !answer) {
      return NextResponse.json({ correct: false, feedback: 'Add an answer first, then check it.' })
    }

    let raw: string
    try {
      raw = await callGemma(
        buildPrompt({ prompt, format, answer, rubric: body?.rubric, goal: body?.goal, output: body?.output }),
        { maxTokens: 500, temperature: 0.3 }
      )
    } catch {
      return NextResponse.json({ correct: false, feedback: 'Could not grade right now — try again in a moment.' })
    }

    try {
      const parsed = parseJsonRobust(raw)
      const correct = gradedCorrect(parsed?.correct)
      // A reply that is not a boolean is not a mark. Sending correct: false
      // locked the answer, including when the model wrote the word "true".
      if (correct === null) {
        return NextResponse.json({ feedback: 'Could not grade right now — try again.' })
      }
      return NextResponse.json({ correct, feedback: String(parsed?.feedback ?? 'Reviewed.') })
    } catch {
      return NextResponse.json({ feedback: 'Could not grade right now — try again.' })
    }
  } catch {
    return NextResponse.json({ error: 'Grade request failed' }, { status: 500 })
  }
}
