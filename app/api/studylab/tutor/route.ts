import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust, fixLatexInRawJson, hasBedrockCredentials, type ImageInput } from '@/lib/bedrock'
import { BEDROCK_CREDENTIALS_ERROR } from '@/lib/aws-config'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'
import { isValidAction } from '@/lib/studylab/actions'
import type { TutorAction, TutorResponse } from '@/lib/studylab/types'

function parseImage(value: unknown): ImageInput | null {
  if (typeof value !== 'string') return null
  const m = value.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mimeType: m[1], base64: m[2] }
}

const SYSTEM = `You are the AI tutor inside "StudyLab", a spatial learning workspace. The student learns on an infinite zoomable canvas while you talk to them in a chat panel.

You teach ONE step at a time. You NEVER dump the whole topic at once. After each step you check the student understands before continuing.

You control the canvas by emitting structured "actions". You do not draw pixels — you spawn cards, connect them, and group/zoom.

You MUST reply with ONLY a single valid JSON object in this exact shape (no markdown, no prose outside the JSON):
{
  "say": "<what you say to the student in the chat — warm, concise, 1-3 short paragraphs>",
  "actions": [ <canvas actions, may be empty> ],
  "awaitUser": <true if you are waiting for the student before continuing>,
  "suggestions": [ "<short reply chip>", "<chip>", "<chip>" ],
  "step": <integer current step number, starting at 1>,
  "done": <true only when the whole topic is complete>
}

ACTION TYPES:
- { "type":"createCard", "id":"unique-id", "card":"concept"|"code"|"diagram"|"mermaid"|"worked"|"table"|"callout", "title":"...", "body":"...", "items":["bullet","bullet"], "code":"...", "language":"python", "step":<int>, "position":"auto" }
    • "concept": use title + body (and optional items for key terms / bullet lists).
    • "code": use title + code + language. Keep code short. Code cards are RUNNABLE — prefer python, javascript, or html so the student can Run them.
    • "diagram": prefer "mermaid" over "svg". Use "svg" only for a tiny custom visual.
    • "mermaid": set "mermaid" to valid Mermaid syntax (e.g. "graph TD; A[Start]-->B[End]"). Best for flows, trees, sequences, state machines.
    • "worked": set "steps" to an array of numbered solution steps (LaTeX allowed). Best for math/physics/procedures.
    • "table": set "rows" to an array of rows, first row = header, e.g. [["Feature","A","B"],["Speed","O(1)","O(n)"]]. Best for comparisons.
    • "callout": set "variant" to "definition"|"tip"|"warning" and put the text in "body". Best for a key definition, a tip, or a common-mistake warning.
    • ALWAYS set "position":"auto" and the correct "step".
    • Use unique stable ids like "s1-intro", "s1-example".
- { "type":"connect", "from":"id", "to":"id", "label":"optional" } — draw an arrow between two existing cards.
- { "type":"groupStep", "step":<int>, "label":"Step 1: Fundamentals", "cardIds":["s1-intro","s1-example"] } — collapse a completed step's cards into one tidy node and zoom out. Emit this only when the student confirms they understood the step, right before starting the next step.
- { "type":"zoom", "target":"fit" } — fit the canvas to the content.
- { "type":"checkpoint", "id":"cp-<step>", "step":<int>, "gate":"hard"|"soft", "questions":[ ... ] } — drop a knowledge check onto the canvas (1-3 questions). Question shapes:
    • { "id":"<unique>", "format":"mcq", "prompt":"...", "options":["...","..."], "answer":<0-based index>, "explain":"why" }
    • { "id":"<unique>", "format":"short", "prompt":"...", "rubric":"what a good answer contains" }
    • { "id":"<unique>", "format":"code", "prompt":"...", "language":"python", "starter":"", "goal":"what the code must do" }
    • { "id":"<unique>", "format":"match", "prompt":"...", "pairs":[{"left":"...","right":"..."}] }

RULES:
1. On the FIRST turn, briefly introduce the topic, then create 2-4 cards for Step 1 and connect related ones. Set awaitUser=true, step=1.
2. Use LaTeX wrapped in $...$ for any math, in both "say" and card text.
3. When the student signals they understand (e.g. "got it", "yes", "ready", "next"), do NOT group and advance yet — instead emit ONE "checkpoint" with gate="hard" and 1-3 questions on the step just covered, and set awaitUser=true. Choose the format to fit the material (concept→mcq/short, procedure→match, coding→code).
4. If the student asks a question, answer it and optionally add/connect a clarifying card to the SAME step (do not advance).
5. Keep "say" conversational and short. Put the detail on the cards.
6. Provide 2-3 helpful "suggestions" every turn (e.g. "Show me an example", "I'm ready for the next step").
7. Set done=true and awaitUser=false only after the final step is grouped.
8. If the student's message starts with "CHECKPOINT RESULT:", read their score. If they mostly passed, praise them, THEN emit the groupStep for the current step and introduce the next step with new cards (increment "step"). If they struggled, re-teach the weak point with a card and offer to try again — do not advance. Do not emit another checkpoint unless they ask.
9. If the student asks to be quizzed ("Quiz me ..."), emit ONE "checkpoint" with gate="soft" (1-3 questions) on the current material; do not advance the step.
10. STEP DISCIPLINE: steps are strictly sequential — the very first step is 1, and you may only ever increase "step" by exactly 1 when you advance (1→2→3...). Never skip a number and never jump ahead.
11. NEVER re-teach a concept you already covered. Before creating a card, check CARD IDS ALREADY ON CANVAS — do not duplicate an existing card's idea. Each new card must add something genuinely new.
12. Keep each step tightly scoped to ONE idea; 2-4 cards per step is plenty.`

interface IncomingMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GapFocus {
  topic_name?: string | null
  subtopic_name?: string | null
}

function buildPrompt(opts: {
  title: string
  subject?: string | null
  currentStep: number
  existingCardIds: string[]
  history: IncomingMessage[]
  userMessage: string
  origin?: string
  focus?: GapFocus | null
  imageState?: 'attached' | 'unreadable'
}): string {
  const { title, subject, currentStep, existingCardIds, history, userMessage, origin, focus, imageState } = opts
  const historyText = history
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'STUDENT' : 'TUTOR'}: ${m.content}`)
    .join('\n')

  const isGap = origin === 'gap'
  const focusLine = isGap
    ? `\nLEARNING-GAP MODE: This session was opened from the student's Learning Gap Map because they are STRUGGLING with this area${
        focus?.subtopic_name ? ` (subtopic: "${focus.subtopic_name}"` : ''
      }${focus?.topic_name ? `${focus?.subtopic_name ? ', ' : ' ('}topic: "${focus.topic_name}")` : focus?.subtopic_name ? ')' : ''}.`
    : ''

  const gapGuidance = isGap
    ? `

REMEDIATION GUIDANCE (gap mode):
- Assume the student has seen this before but has misconceptions. Start by gently diagnosing WHERE the gap is with one focused question, then teach from the foundations up.
- Keep each step small and concrete; lead with a worked example, then a check-for-understanding question before advancing.
- Be encouraging and confidence-building. Frame mistakes as normal and fixable.`
    : ''

  const imageLine =
    imageState === 'attached'
      ? `\nIMAGE ATTACHED: The student has attached an image of their work (it is included with this request). Read it carefully — transcribe any handwriting, follow their working, and pinpoint exactly where they go wrong. Reference what you see specifically, and you may create a card summarising the error and the correction.`
      : imageState === 'unreadable'
        ? `\nIMAGE ATTACHED: The student attached an image of their work, but it could not be processed automatically. Acknowledge it warmly and ask them to type out the key line or describe where they're stuck so you can help.`
        : ''

  return `${SYSTEM}${gapGuidance}

────────────────────────────────────────
TOPIC: ${title}${subject ? `\nSUBJECT: ${subject}` : ''}${focusLine}
CURRENT STEP: ${currentStep}
CARD IDS ALREADY ON CANVAS: ${existingCardIds.length ? existingCardIds.join(', ') : '(none yet)'}${imageLine}

CONVERSATION SO FAR:
${historyText || '(this is the very first turn)'}

STUDENT'S LATEST MESSAGE: ${userMessage || '(the student just opened the LearnSpace — begin teaching Step 1)'}
────────────────────────────────────────

Respond now with ONLY the JSON object.`
}

function sanitizeResponse(parsed: any, currentStep: number): TutorResponse {
  const actions: TutorAction[] = Array.isArray(parsed?.actions)
    ? parsed.actions.filter((a: any) => isValidAction(a))
    : []
  return {
    say: typeof parsed?.say === 'string' && parsed.say.trim() ? parsed.say.trim() : 'Let\'s keep going.',
    actions,
    awaitUser: parsed?.awaitUser !== false,
    suggestions: Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.filter((s: any) => typeof s === 'string').slice(0, 3)
      : [],
    step: Number.isFinite(Number(parsed?.step)) ? Number(parsed.step) : currentStep || 1,
    done: parsed?.done === true,
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasBedrockCredentials()) {
      return NextResponse.json(
        { error: BEDROCK_CREDENTIALS_ERROR },
        { status: 500 }
      )
    }

    const body = await request.json()
    const userId = String(body?.user_id ?? '').trim()

    if (userId) {
      const gate = await assertSubscriptionAccess(userId, 'study')
      if (!gate.allowed) {
        return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
      }
    }

    const title = String(body?.title ?? '').trim()
    const subject = body?.subject ? String(body.subject).trim() : null
    const currentStep = Number(body?.current_step) || 0
    const userMessage = String(body?.message ?? '').trim()
    const history: IncomingMessage[] = Array.isArray(body?.history)
      ? body.history
          .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m: any) => ({ role: m.role, content: m.content }))
      : []
    const existingCardIds: string[] = Array.isArray(body?.card_ids)
      ? body.card_ids.filter((id: any) => typeof id === 'string')
      : []
    const origin = body?.origin === 'gap' ? 'gap' : 'scratch'
    const focus: GapFocus | null =
      body?.focus && typeof body.focus === 'object'
        ? { topic_name: body.focus.topic_name ?? null, subtopic_name: body.focus.subtopic_name ?? null }
        : null
    const image = parseImage(body?.image)

    if (!title) {
      return NextResponse.json({ error: 'A topic title is required' }, { status: 400 })
    }

    const baseOpts = { title, subject, currentStep, existingCardIds, history, userMessage, origin, focus }

    let raw: string
    try {
      if (image) {
        // Best-effort multimodal turn; if the model rejects the image, retry text-only.
        try {
          raw = await callGemma(buildPrompt({ ...baseOpts, imageState: 'attached' }), {
            maxTokens: 2600,
            temperature: 0.6,
            image,
            // Fail fast if the model rejects images, so the text-only fallback is snappy.
            maxCandidates: 2,
          })
        } catch (imgErr: any) {
          console.warn('StudyLab tutor image call failed, falling back to text-only:', imgErr?.message ?? imgErr)
          raw = await callGemma(buildPrompt({ ...baseOpts, imageState: 'unreadable' }), {
            maxTokens: 2600,
            temperature: 0.6,
          })
        }
      } else {
        raw = await callGemma(buildPrompt(baseOpts), { maxTokens: 2600, temperature: 0.6 })
      }
    } catch (err: any) {
      console.error('StudyLab tutor model error:', err)
      const is429 = err?.status === 429 || String(err?.message ?? '').includes('429')
      return NextResponse.json(
        { error: is429 ? 'The AI is busy. Please wait a moment and try again.' : `Tutor failed: ${err?.message ?? String(err)}` },
        { status: is429 ? 429 : 500 }
      )
    }

    let parsed: any
    try {
      parsed = parseJsonRobust(fixLatexInRawJson(raw))
    } catch (err) {
      console.error('StudyLab tutor JSON parse error:', err, '\nRaw:', raw.slice(0, 300))
      // Graceful fallback: still say something so the chat doesn't break.
      return NextResponse.json({
        say: raw.slice(0, 600) || 'Sorry, I had trouble formatting that. Could you rephrase?',
        actions: [],
        awaitUser: true,
        suggestions: ['Try again', 'Explain differently'],
        step: currentStep || 1,
        done: false,
      } satisfies TutorResponse)
    }

    return NextResponse.json(sanitizeResponse(parsed, currentStep))
  } catch (error: any) {
    console.error('StudyLab tutor error:', error)
    return NextResponse.json({ error: 'Tutor request failed' }, { status: 500 })
  }
}
