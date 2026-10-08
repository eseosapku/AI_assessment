import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust, hasBedrockCredentials } from '@/lib/bedrock'
import { BEDROCK_CREDENTIALS_ERROR } from '@/lib/aws-config'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'
import { checkRateLimit, identify } from '@/lib/rate-limit'
import { parseHomeworkSheet, EMPTY_SHEET } from '@/lib/studylab/homework'
import { parseImageDataUrl } from '@/lib/studylab/imageMime'
import { fenceStudentText, MAX_IMAGE_CHARS } from '@/lib/studylab/untrusted'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Reads a homework sheet: what is being asked, and what the student already did.
 *
 * Its own route rather than an extension of `snap`, which reads the same photo
 * for a different reason — `snap` names the space, and runs before the space
 * exists. This runs once the space is open, and its output becomes the lesson
 * itself.
 *
 * The whole point is that this is the ONLY time the photo is looked at. What
 * comes back is carried through every turn afterwards, so a diagram has to be
 * described here in words or it is lost. Sending the image on every teaching
 * turn would be slow and expensive for something that does not change.
 *
 * It transcribes; it never solves. A homework helper that answers the question
 * on sight has done the student's homework, and it has done it before they were
 * even asked whether they wanted that.
 */
export async function POST(request: NextRequest) {
  try {
    if (!hasBedrockCredentials()) {
      return NextResponse.json({ error: BEDROCK_CREDENTIALS_ERROR }, { status: 500 })
    }

    const body = await request.json()
    const userId = String(body?.userId ?? body?.user_id ?? '').trim()
    // The paywall only applied when the page said who it was, so leaving the
    // id off read a sheet with no plan at all.
    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Sign in to read a homework sheet.' }, { status: 401 })
    }
    const gate = await assertSubscriptionAccess(userId, 'study')
    if (!gate.allowed) return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
    if (typeof body?.image === 'string' && body.image.length > MAX_IMAGE_CHARS) {
      return NextResponse.json({ error: 'That photo is too large. Try a smaller one.' }, { status: 413 })
    }

    const limit = checkRateLimit('studylab-homework-read', identify(userId, request.headers))
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'That is a lot of sheets very quickly. Give it a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const image = parseImageDataUrl(body?.image)
    const text = String(body?.text ?? '').trim().slice(0, 6000)
    if (!image && !text) {
      return NextResponse.json({ error: 'Send a photo or the text of the problem.' }, { status: 400 })
    }

    let raw: string
    try {
      raw = await callGemma(readPrompt(text), {
        maxTokens: 2000,
        temperature: 0.1,
        ...(image ? { image, maxCandidates: 2 } : {}),
        usage: { feature: 'homework_read', requestId: randomUUID(), userId },
      })
    } catch (err) {
      console.warn('Homework read failed:', (err as Error)?.message ?? err)
      return NextResponse.json({ error: 'Could not read that just now — try again.' }, { status: 502 })
    }

    let sheet = EMPTY_SHEET
    try {
      sheet = parseHomeworkSheet(parseJsonRobust(raw))
    } catch {
      /* falls through to the empty sheet below */
    }

    // A sheet with no question on it is not a failure to report as an error —
    // the photo may simply be too dark to read. The caller offers the learner
    // a way to type it instead, which needs a 200 to get to.
    return NextResponse.json({ sheet })
  } catch (err) {
    console.error('Homework read route error:', err)
    return NextResponse.json({ error: 'Could not read that problem' }, { status: 500 })
  }
}

/**
 * The reading instruction.
 *
 * Two things it has to get right that are easy to get wrong. A homework page is
 * usually photographed with the student's working already on it, and that
 * working is not part of the question — it goes in `attempt`, where the tutor
 * can start from where they actually are. And a printed page is full of text
 * that is not a question either: names, page numbers, mark allocations, and on
 * one real sheet a set of annotations about using a straight edge and engineering
 * paper.
 */
function readPrompt(text: string): string {
  return [
    'You are reading a page of a student\'s homework so a tutor can help them with it.',
    'DO NOT SOLVE ANYTHING. Transcribe what is on the page.',
    text ? `\n${fenceStudentText('The student also typed this', text)}\n` : '',
    '',
    'Find each question that is set. For each one:',
    '  "label"   the number as printed on the page — "1", "Q3", "7.4-7".',
    '  "text"    the question, transcribed so completely that someone could',
    '            attempt it from your transcription alone and never need the',
    '            photo. If it comes with a table of values, REPRODUCE THE TABLE',
    '            HERE as markdown — every row, every number. Dropping the data',
    '            leaves a question nobody can answer. Maths as LaTeX between',
    '            $ signs.',
    '  "attempt" the student\'s OWN working for this question if the page already',
    '            has some on it — their lines of algebra, their diagram, their',
    '            final answer. Transcribe it as they wrote it, mistakes and all.',
    '            null if the page is blank under the question.',
    '  "answer"  the correct final answer, ONLY if the page states it (in a mark',
    '            scheme, or because the student has already written one). Do not',
    '            work it out. null otherwise.',
    '  "rubric"  one line on what a correct answer has to show. This is what the',
    '            marking reads against, so describe the understanding, not the',
    '            wording.',
    '',
    'Then "given", which is for two things only:',
    '  - ANY figure, diagram, sketch or graph, always, whichever question it',
    '    belongs to — described in words with every value and label marked on',
    '    it: "a simply supported beam of span L carrying a triangular',
    '    distributed load, zero at A and q0 at B". The picture is not looked at',
    '    again after this, so a diagram you do not describe is a diagram the',
    '    tutor never sees.',
    '  - Data that SEVERAL questions share: a table at the top of the page that',
    '    questions 1 to 4 all use, a constant to use throughout.',
    'On a sheet with one question, "given" holds the figure and nothing else,',
    'because everything else is already in the question. Never copy the wording',
    'of a question in here.',
    '',
    'Three things must not appear anywhere in your answer — not as a question,',
    'and not in "given":',
    '  - names, dates, page numbers, course codes, mark allocations;',
    '  - printed advice about laying the work out ("use a straight edge",',
    '    "double underline your answer", "use engineering paper");',
    '  - the working the student did themselves. That belongs in "attempt" only.',
    '',
    'Reply with JSON only:',
    '{ "subject": "<one or two words, e.g. Algebra, Statics; empty if unsure>",',
    '  "given": ["..."],',
    '  "questions": [',
    '    { "label": "1", "text": "...", "attempt": "..." | null,',
    '      "answer": "..." | null, "rubric": "..." }',
    '  ] }',
    '',
    'If the page is unreadable, reply { "subject": "", "given": [], "questions": [] }.',
  ]
    .filter(Boolean)
    .join('\n')
}
