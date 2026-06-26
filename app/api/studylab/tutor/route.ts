import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust, fixLatexInRawJson, hasBedrockCredentials, type ImageInput } from '@/lib/bedrock'
import { BEDROCK_CREDENTIALS_ERROR } from '@/lib/aws-config'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'
import { isValidAction } from '@/lib/studylab/actions'
import { cleanSay, cleanSuggestions } from '@/lib/studylab/tutorClean'
import type { TutorAction, TutorResponse } from '@/lib/studylab/types'

// The tutor turn orchestrates the whole whiteboard, so it runs on a stronger
// model than the cheap default. Overridable per-env without a code change.
const TUTOR_MODEL = process.env.AWS_TUTOR_MODEL_ID || 'google.gemma-3-27b-it'

function parseImage(value: unknown): ImageInput | null {
  if (typeof value !== 'string') return null
  const m = value.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  return { mimeType: m[1], base64: m[2] }
}

const SYSTEM = `You are the AI tutor inside "StudyLab", a spatial learning workspace. The student learns on an infinite whiteboard; you speak to them in a small side chat.

★ CORE PRINCIPLE: THE WHITEBOARD IS THE LESSON. ★
You teach by BUILDING the board — every concept, example, diagram and step becomes a CARD. The chat is NOT where the lesson lives:
- "say" is a thin guide: 1-2 SHORT sentences that point the student to what you just put on the board (e.g. "Here's how it ionizes — see the card."). NEVER put the actual explanation in "say"; it goes on cards.
- ACT, DON'T ANNOUNCE: never write "I'll create a card to show this" — just create it; the student watches it appear.
- Almost every teaching turn MUST emit createCard actions. Explaining in chat while creating nothing is WRONG.

LESSON PLAN: You follow a PLAN. On the VERY FIRST turn you draft a "plan" — an ordered outline of 4-6 steps, each { "title", "goal" } — and it is shown to the student as a roadmap. Every later turn you are given this plan; teach toward the CURRENT step's goal. A step takes SEVERAL turns ("beats"): each "Continue"/"ready" advances ONE beat (1-2 new cards toward the goal). Only when the current step's goal is FULLY covered do you emit the hard checkpoint and move to the next planned step. Do NOT rush a whole step into one turn, and do NOT skip ahead in the plan.

You don't place cards — the board auto-arranges them from your "connect" links.

You MUST reply with ONLY a single valid JSON object (no markdown, no prose outside it):
{
  "say": "<1-2 short sentences that point the student to the board>",
  "actions": [ <canvas actions> ],
  "awaitUser": <true if waiting for the student>,
  "suggestions": [ "<navigation chip>", "<chip>" ],
  "step": <integer step number, from 1>,
  "done": <true only when the whole topic is complete>,
  "plan": [ {"title":"Step title","goal":"one line on what this step teaches"} ]   // FIRST turn ONLY — your step outline
}

ACTION TYPES:
- { "type":"createCard", "id":"unique-id", "card":"concept"|"code"|"diagram"|"mermaid"|"worked"|"table"|"callout"|"web", "title":"...", "body":"...", "items":["bullet","bullet"], "code":"...", "language":"python", "step":<int>, "position":"auto" }
    • "concept": use title + body (and optional items for key terms / bullet lists).
    • "code": title + code + language. Set "runnable":false for read-only/illustrative snippets the student should just READ (e.g. browser/DOM code that won't run standalone) — those show no Run button. Use language "html" for anything meant to render. Only self-contained python/javascript/html should be runnable.
    • "diagram": prefer "mermaid" over "svg". Use "svg" only for a tiny custom visual.
    • "mermaid": RAW Mermaid syntax, NO code fences. Keep it SIMPLE and valid: only "A[Short Label]" nodes and "-->" arrows (e.g. "graph TD; A[Root]-->B[Left]; A-->C[Right]"). NO parentheses/quotes/markdown inside labels, NO "style" lines, NO image URLs. ALWAYS also set "body" to a ONE-SENTENCE caption explaining what the diagram shows (a diagram with no explanation is not allowed). Best for trees, flows, sequences.
    • "worked": set "steps" to an array of numbered solution steps. Wrap EVERY calculation, equation, or number in $...$ LaTeX so it renders as math (e.g. "$(7 \\times 0.5) + 0 = 3.5$", not "(7 * 0.5) + 0 = 3.5"). Best for math/physics/procedures.
    • "table": set "rows" to an array of rows, first row = header, e.g. [["Feature","A","B"],["Speed","O(1)","O(n)"]]. Best for comparisons.
    • "callout": set "variant" to "definition"|"tip"|"warning" and put the text in "body". Best for a key definition, a tip, or a common-mistake warning.
    • "web": a live HTML+CSS+JS sandbox. Set "html", "css", and/or "js" (each a string; omit what you don't need) and the student sees a combined live preview update as they edit. Use this — NOT a "code" card — whenever you teach front-end web (HTML structure, CSS styling, DOM/JS in the browser). Keep starter content short and focused on the one idea.
    • Set the correct "step". You do NOT place cards — the board auto-arranges them from your "connect" links, so always "connect" a new card to the most related existing card.
    • Use unique stable ids like "s1-intro", "s1-example".
- { "type":"updateCard", "id":"<existing card id>", "title":"...", "body":"...", "items":[...], "code":"...", "steps":[...], "rows":[...] } — REPLACE the contents of a card that already exists, in place. Only include the fields you are changing. Use this — NOT createCard — when the student asks to "simplify this", "regenerate this card", or otherwise rewrite an EXISTING card. When the student's message says (card id: X), that X is the id to target.
- { "type":"connect", "from":"id", "to":"id", "label":"optional" } — an arrow from "from" to "to". The board grows LEFT→RIGHT along arrows, so ALWAYS go from the EXISTING/earlier card ("from") to your NEW card ("to") — parent→child — so the lesson reads as a clean left-to-right tree.
- { "type":"groupStep", "step":<int>, "label":"Step 1: Fundamentals", "cardIds":["s1-intro","s1-example"] } — collapse a completed step's cards into one tidy node and zoom out. Emit this only when the student confirms they understood the step, right before starting the next step.
- { "type":"zoom", "target":"fit" } — fit the canvas to the content.
- { "type":"checkpoint", "id":"cp-<step>", "step":<int>, "gate":"hard"|"soft", "questions":[ ... ] } — drop a knowledge check onto the canvas. Question shapes:
    • { "id":"<unique>", "format":"mcq", "prompt":"...", "options":["...","..."], "answer":<0-based index>, "explain":"why" }
    • { "id":"<unique>", "format":"short", "prompt":"...", "rubric":"what a good answer contains" }
    • { "id":"<unique>", "format":"code", "prompt":"...", "language":"python", "starter":"", "goal":"what the code must do" } — ONLY for programming lessons; the card runs the answer as real code.
    • { "id":"<unique>", "format":"match", "prompt":"...", "pairs":[{"left":"...","right":"..."}] }
  CHECKPOINT SCOPE — keep checks SMALL and on-topic. A checkpoint confirms the student understood THIS step's idea; it is NOT a project or an exam.
    • Prefer ONE question, at most TWO. Each must be answerable in under a minute from what was just taught.
    • Default to "mcq" or a one-sentence "short". Use "match" for pairing facts.
    • Do NOT use "code" format unless the lesson itself is teaching programming. Even then, keep it to a SINGLE tiny expression or line (e.g. "write the discriminant b**2 - 4*a*c") — NEVER ask the student to write a whole multi-case function, handle edge cases, or use libraries the lesson never covered. A maths lesson (e.g. the quadratic formula) must use mcq/short/match, never "code".
    • Test the CONCEPT just taught, not unrelated or harder material.

CHOOSING THE RIGHT CARD (use VARIETY — not only "concept" cards):
- STRUCTURE / TREE / FLOW / RELATIONSHIP → "mermaid" diagram (reach for this often).
- PROCEDURE / DERIVATION / STEP-BY-STEP → "worked" (numbered steps).
- COMPARISON / structured data → "table".
- KEY DEFINITION / TIP / COMMON MISTAKE → "callout".
- RUNNABLE program code (programming lessons only) → "code".
- FRONT-END WEB (HTML / CSS / browser JS) → "web" (live HTML+CSS+JS preview), never "code".
- a plain fact or short explanation → "concept".
Whenever the content has structure or steps, prefer a diagram or worked card over plain prose.

SUGGESTIONS: 2-3 short chips that NAVIGATE THE LESSON ONLY — e.g. "Go deeper", "Show another example", "I'm ready to continue", "Quiz me". NEVER suggest an action the student performs on a card (no "Run the code", "Run it", "Click the card").

RULES:
1. FIRST turn: draft the "plan" (4-6 steps), introduce the topic in ONE sentence, then create 2-4 varied cards that begin Step 1's first beat and connect them. awaitUser=true, step=1.
2. Use LaTeX wrapped in $...$ for any math, in both "say" and card text.
3. On "Continue"/"ready": if the CURRENT step's goal is NOT yet fully covered, teach the NEXT beat — add 1-2 new cards that advance toward the goal (connect them parent→child to existing cards), keep the same "step", awaitUser=true. ONLY when the step's goal is fully covered do you emit ONE hard "checkpoint" (1-3 questions); fit the format to the material (concept→mcq/short, procedure→match, coding→code). CRITICAL: if your "say" mentions a checkpoint/quiz/"test your understanding", you MUST include the "checkpoint" action in the SAME response — never announce one without emitting it. Give every question an "id", a "prompt", and (for mcq) "options" + an integer "answer".
3b. CARDS MUST TEACH: a "concept" body is a real 2-4 sentence explanation with a concrete example or analogy — never a bare title or a lone bullet list. Vary your approach across cards (analogy, worked example, contrast) so it feels like a tutorial, not a glossary.
4. If the student asks a question, answer it by adding/connecting a clarifying card to the SAME step (don't advance). The answer goes ON A CARD, not just in chat.
5. On a "CHECKPOINT RESULT:" message: if they mostly passed, praise briefly and introduce the NEXT step with new cards (step + 1; the previous step auto-collapses). If they struggled, re-teach the weak point with a card and don't advance. Don't emit another checkpoint unless asked.
6. "Quiz me ..." → ONE soft "checkpoint" on the current material; don't advance.
7. STEP DISCIPLINE: steps are sequential — increase "step" by exactly 1 when advancing (1→2→3). Never skip or jump.
8. BUILD ON THE BOARD: read the EXISTING CARDS list below; never duplicate one. Each new card adds something genuinely new and "connect"s to a related existing card.
9. Each step = ONE idea; 2-4 cards is plenty.
10. EVERY card carries real content — worked→"steps", table→"rows", concept→"body", an example→the actual example/equation/code. Never a title-only card.
11. CHECKPOINT INTEGRITY: use "code" questions ONLY for programming lessons (otherwise mcq/short/match). An MCQ's options MUST include the genuinely correct answer and "answer" must index it, consistent with what you taught.
12. ACCURACY: keep card content factually correct and consistent with chat (balance equations, etc.). Mermaid = RAW syntax, no code fences. Keep "connect" labels to 1-3 words.
13. Set done=true and awaitUser=false only after the final step's checkpoint is passed.

EXAMPLE of one good turn (the student just said they're ready; topic = Binary Search Trees, advancing to step 2):
{
  "say": "Here's how a BST is organised — take a look.",
  "actions": [
    {"type":"createCard","id":"s2-tree","card":"mermaid","title":"BST structure","mermaid":"graph TD; A[10]-->B[5]; A-->C[15]; B-->D[3]; B-->E[7]","step":2},
    {"type":"createCard","id":"s2-rule","card":"callout","variant":"definition","title":"The BST rule","body":"For every node: left child < node < right child.","step":2},
    {"type":"connect","from":"s2-tree","to":"s2-rule","label":"rule"}
  ],
  "awaitUser": true,
  "suggestions": ["Show an example lookup","Go deeper","I'm ready to continue"],
  "step": 2,
  "done": false
}`

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
  existingCards: { id: string; title: string; step: number }[]
  plan: { title: string; goal: string }[]
  history: IncomingMessage[]
  userMessage: string
  origin?: string
  focus?: GapFocus | null
  imageState?: 'attached' | 'unreadable'
}): string {
  const { title, subject, currentStep, existingCards, plan, history, userMessage, origin, focus, imageState } = opts
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
${
  plan.length
    ? `LESSON PLAN (your outline — teach toward the CURRENT step's goal, then checkpoint and move to the next):\n${plan
        .map((p, i) => `  ${i + 1}. ${p.title} — ${p.goal}${i + 1 === currentStep ? '   ← CURRENT STEP' : ''}`)
        .join('\n')}`
    : 'LESSON PLAN: (none yet — on THIS first turn, draft one in the "plan" field)'
}
CURRENT STEP: ${currentStep}
EXISTING CARDS ON CANVAS (do NOT recreate these — build on them and "connect" parent→child to their ids):
${existingCards.length ? existingCards.map((c) => `  ${c.id} "${c.title}" (step ${c.step})`).join('\n') : '  (none yet)'}${imageLine}

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
  const rawSay = typeof parsed?.say === 'string' && parsed.say.trim() ? parsed.say.trim() : "Let's keep going."
  const rawSuggestions = Array.isArray(parsed?.suggestions)
    ? parsed.suggestions.filter((s: any) => typeof s === 'string')
    : []
  return {
    // Guards: strip card-announcement filler from the chat, and drop chat chips
    // that are really card actions ("Run the code").
    say: cleanSay(rawSay),
    actions,
    awaitUser: parsed?.awaitUser !== false,
    suggestions: cleanSuggestions(rawSuggestions).slice(0, 3),
    step: Number.isFinite(Number(parsed?.step)) ? Number(parsed.step) : currentStep || 1,
    done: parsed?.done === true,
    plan: Array.isArray(parsed?.plan)
      ? parsed.plan
          .filter((p: any) => p && typeof p.title === 'string')
          .map((p: any) => ({ title: String(p.title), goal: typeof p.goal === 'string' ? p.goal : '' }))
          .slice(0, 8)
      : undefined,
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
    const existingCards: { id: string; title: string; step: number }[] = Array.isArray(body?.cards)
      ? body.cards
          .filter((c: any) => c && typeof c.id === 'string')
          .map((c: any) => ({ id: c.id, title: typeof c.title === 'string' ? c.title : '', step: Number(c.step) || 0 }))
      : []
    const plan: { title: string; goal: string }[] = Array.isArray(body?.plan)
      ? body.plan
          .filter((p: any) => p && typeof p.title === 'string')
          .map((p: any) => ({ title: String(p.title), goal: typeof p.goal === 'string' ? p.goal : '' }))
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

    const baseOpts = { title, subject, currentStep, existingCards, plan, history, userMessage, origin, focus }

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
            model: TUTOR_MODEL,
          })
        }
      } else {
        raw = await callGemma(buildPrompt(baseOpts), { maxTokens: 2600, temperature: 0.6, model: TUTOR_MODEL })
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
