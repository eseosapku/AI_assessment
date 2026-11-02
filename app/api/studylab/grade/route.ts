import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust, hasBedrockCredentials } from '@/lib/bedrock'
import { BEDROCK_CREDENTIALS_ERROR } from '@/lib/aws-config'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'
import { modelForJob } from '@/lib/studylab/lessonJobs'

function gradedCorrect(value: unknown): boolean | null {
  if (value === true || value === false) return value
  const text = String(value ?? '').trim().toLowerCase()
  if (text === 'true') return true
  if (text === 'false') return false
  return null
}

/**
 * The mark comes from what the model found, not from a verdict of its own. Asked for
 * one it passed a missing second root with feedback naming the miss, and asked to list
 * problems it invented them for right answers. A reply without the findings is read
 * as its plain "correct".
 */
function markOf(parsed: Record<string, unknown>): boolean | null {
  const matches = gradedCorrect(parsed?.result_matches)
  if (matches === null) return gradedCorrect(parsed?.correct)
  return matches && gradedCorrect(parsed?.used_named_method) !== false
}

function buildPrompt(o: {
  prompt: string
  format: string
  answer: string
  rubric?: string
  goal?: string
  output?: string
  /** A check allows one go: the card moves on, with a good answer shown beside the feedback. */
  final?: boolean
}): string {
  const criterion =
    o.format === 'code'
      ? `GOAL the code must meet: ${o.goal ?? '(unspecified)'}\nThe student's program output was:\n${o.output ?? '(not run)'}`
      : `RUBRIC / expected idea: ${o.rubric ?? '(use your judgement)'}`
  const whenWrong = o.final
    ? 'If it is not right, say what the answer needed. They do not get another go at this question and a good answer is shown beside your words, so never tell them to try or do anything.'
    : 'If it is not right, name the one key fix.'
  return `You are grading a student's answer to one short practice question. Be kind and honest.

QUESTION: ${o.prompt}
${criterion}
STUDENT'S ANSWER:
${o.answer}

HOW TO MARK. Reply with ONLY a JSON object with these fields, in this order:
"my_result": work the question out yourself and write the result in a few words. The rubric is one good answer, not the only one.
"student_result": the student's final result, in a few words.
"result_matches": true if the student's result says the same as yours, in any form or wording, and is complete. One of two solutions is not complete. Judge only the result: not their steps, the order of them, or how much they wrote.
"named_method": the method the question itself tells the student to use, or null if it names none.
"used_named_method": true if their answer shows that method, false if it shows another or none, null if the question names none.
"feedback": one or two plain sentences to the student. If it is right, say what they got right, and do not ask for more detail. ${whenWrong} Do not thank them or praise effort. If what they wrote is not an attempt at all ("no", "idk"), say so simply, without scolding, and say what the question was after.`
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
        buildPrompt({ prompt, format, answer, rubric: body?.rubric, goal: body?.goal, output: body?.output, final: body?.final === true }),
        // Haiku, not Nova Lite, which marks practice: on twelve answers with known marks,
        // run three times each, Haiku got 36 of 36. Nova got 27, and failed right working
        // for not following the rubric. A check is what moves the lesson on.
        { maxTokens: 500, temperature: 0.2, model: modelForJob('check') }
      )
    } catch {
      return NextResponse.json({ correct: false, feedback: 'Could not grade right now — try again in a moment.' })
    }

    try {
      const parsed = parseJsonRobust(raw)
      const correct = markOf(parsed)
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
