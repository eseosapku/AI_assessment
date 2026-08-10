import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust, hasBedrockCredentials } from '@/lib/bedrock'
import { BEDROCK_CREDENTIALS_ERROR } from '@/lib/aws-config'
import {
  normalizeTopic,
  isUsableTopic,
  normalizeNotes,
  isUsableNotes,
  sanitizeScope,
  buildScopePrompt,
  buildNotesScopePrompt,
  type QuizScope,
} from '@/lib/quiz-topic'

/**
 * Expand a free-typed phrase into study scope for a self-directed quiz.
 *
 * This runs between two wizard steps while the student waits, so it uses the
 * cheap fast model and a small token budget. It is deliberately forgiving: a
 * model or network failure returns a usable scope built from the raw phrase
 * (200, `degraded: true`) instead of an error, because the student can always
 * proceed with just their topic — blocking the wizard on an optional
 * refinement would be a worse product than a broader quiz.
 *
 * No subscription gate here: this endpoint neither generates nor stores an
 * assessment. `/api/generate-assessment` remains the gate for that.
 */
const SCOPE_MODEL = process.env.AWS_SCOPE_MODEL_ID || 'amazon.nova-lite-v1:0'

function fallbackScope(topic: string): QuizScope {
  return { subject: 'General knowledge', topic, focusAreas: [], teachable: true }
}

export async function POST(request: NextRequest) {
  let topic = ''
  try {
    const body = await request.json().catch(() => ({}))
    topic = normalizeTopic(body?.topic)
    const notes = normalizeNotes(body?.notes)
    const fromNotes = isUsableNotes(notes)

    // Either input is accepted; pasted material is summarised from the text
    // itself while a typed topic is expanded from general knowledge.
    if (!fromNotes && !isUsableTopic(topic)) {
      return NextResponse.json(
        { error: 'Type what you want to be quizzed on.' },
        { status: 400 },
      )
    }

    if (!hasBedrockCredentials()) {
      return NextResponse.json({ error: BEDROCK_CREDENTIALS_ERROR }, { status: 500 })
    }

    const raw = await callGemma(fromNotes ? buildNotesScopePrompt(notes) : buildScopePrompt(topic), {
      maxTokens: 500,
      temperature: 0.4,
      model: SCOPE_MODEL,
    })

    const fallbackTitle = topic || 'My notes'
    return NextResponse.json({
      scope: sanitizeScope(parseJsonRobust(raw), fallbackTitle),
      degraded: false,
    })
  } catch (error) {
    // Covers model errors, throttling and unparseable output alike: the student
    // keeps moving with their own phrase as the topic.
    console.error('Quiz topic scope failed:', error)
    return NextResponse.json({ scope: fallbackScope(topic || 'My notes'), degraded: true })
  }
}
