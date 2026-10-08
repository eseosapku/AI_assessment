import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust } from '@/lib/bedrock'
import { modelForJob } from '@/lib/studylab/lessonJobs'
import { checkRateLimit, identify } from '@/lib/rate-limit'
import { parseVerdict, type PracticeVerdict } from '@/lib/studylab/practice'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'
import { fenceStudentText, MAX_TYPED_CHARS } from '@/lib/studylab/untrusted'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Marks one attempt at a practice problem.
 *
 * Deliberately its own endpoint rather than another lesson action: marking does
 * not move the run, does not touch the board, and must come back fast enough
 * that typing an answer and being told about it feels like one motion. It runs
 * on the cheap model for the same reason: measured on real marking calls, Nova
 * Lite comes back in about 1.8s where the teaching model averages 10.5s and
 * reaches 18s at p90.
 *
 * The caller has already tried to settle the answer locally (see
 * `lib/studylab/practice`), so anything arriving here genuinely needed reading.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const prompt = String(body?.prompt ?? '').trim()
    const attempt = String(body?.attempt ?? '').trim()
    const expected = String(body?.expected ?? '').trim()
    const rubric = String(body?.rubric ?? '').trim()
    const userId = String(body?.userId ?? '').trim()

    if (!prompt || !attempt) {
      return NextResponse.json({ error: 'A problem and an attempt are required' }, { status: 400 })
    }
    // A paid call, so it needs someone it is paid for. Anyone could mark
    // anything here, with no account and no plan.
    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Sign in to have that marked.' }, { status: 401 })
    }
    if (attempt.length > MAX_TYPED_CHARS) {
      return NextResponse.json(
        { error: `That answer is too long to mark. Keep it under ${MAX_TYPED_CHARS.toLocaleString('en')} characters.` },
        { status: 413 },
      )
    }

    const limit = checkRateLimit('studylab-practice', identify(userId, request.headers))
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'That is a lot of attempts very quickly. Give it a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const gate = await assertSubscriptionAccess(userId, 'study')
    if (!gate.allowed) return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })

    // The problem, answer and rubric come off the board, which the page owns;
    // capped rather than refused, since the student did not write them.
    const raw = await callGemma(markingPrompt({
      prompt: prompt.slice(0, MAX_TYPED_CHARS),
      attempt,
      expected: expected.slice(0, 1000),
      rubric: rubric.slice(0, 1500),
    }), {
      maxTokens: 320,
      temperature: 0.2,
      model: modelForJob('grade'),
      usage: { feature: 'lesson_practice', requestId: randomUUID(), userId },
    })

    let parsed: { verdict?: unknown; feedback?: unknown }
    try {
      parsed = parseJsonRobust(raw)
    } catch {
      // A failed parse must not read as a wrong answer. Saying so plainly and
      // leaving the attempt open is the honest outcome.
      return NextResponse.json({
        verdict: 'unmarked' as const,
        feedback: 'I could not mark that just now — try again.',
      })
    }

    const verdict: PracticeVerdict = parseVerdict(parsed?.verdict)
    const feedback =
      typeof parsed?.feedback === 'string' && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : fallbackFeedback(verdict)

    return NextResponse.json({ verdict, feedback })
  } catch (error) {
    console.error('Practice marking failed:', error)
    return NextResponse.json({ error: 'Could not mark that attempt' }, { status: 500 })
  }
}

/**
 * The marking instruction.
 *
 * Written to mark the WORKING, not to compare strings — string comparison
 * already happened for free before this call was made. What is left is the
 * case where someone has done something reasonable that does not look like the
 * expected answer, and the whole value of spending anything here is reading it
 * properly.
 */
function markingPrompt(o: { prompt: string; attempt: string; expected: string; rubric: string }): string {
  return [
    'You are marking one practice attempt by a student. Be encouraging but honest.',
    '',
    `PROBLEM: ${o.prompt}`,
    o.expected ? `EXPECTED ANSWER: ${o.expected}` : '',
    o.rubric ? `WHAT A GOOD ANSWER SHOWS: ${o.rubric}` : '',
    fenceStudentText('THE STUDENT WROTE', o.attempt),
    '',
    'CORRECT means the final answer matches the expected answer — in any form,',
    'any notation, with or without units or working shown.',
    'CLOSE means the method is right but the answer is not: a slip in the',
    'arithmetic, a sign, a step left half-done. Right method, wrong answer is',
    'ALWAYS close, never correct.',
    'INCORRECT means the idea behind it is wrong.',
    'Check the answer before you praise the method. A student who divided 15 by',
    '3 and wrote 3 has the right method and the wrong answer, and telling them',
    'they were correct teaches them the mistake.',
    '',
    'Reply with JSON only:',
    '{ "verdict": "correct" | "close" | "incorrect", "feedback": "..." }',
    '',
    '"feedback" is one or two sentences addressed to the student. If they are',
    'right, say briefly what they got right. If not, name the ONE thing to fix —',
    'never give them the whole answer, they can reveal the solution themselves.',
  ]
    .filter(Boolean)
    .join('\n')
}

function fallbackFeedback(verdict: PracticeVerdict): string {
  if (verdict === 'correct') return 'That is right.'
  if (verdict === 'close') return 'Close — check your working through once more.'
  return 'Not quite. Have another go, or reveal the solution.'
}
