import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonbParam } from '@/lib/pg-json'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'
import { policyFor } from '@/lib/studylab/lessonPolicy'
import { runFromLegacy } from '@/lib/studylab/lessonRunMigrate'
import { proposePlan, type LessonRun } from '@/lib/studylab/lessonRun'
import { keepMeasuredSteps } from '@/lib/studylab/stepLocks'
import { applyAction, draftPlan } from './dispatch'
import { checkRateLimit, identify } from '@/lib/rate-limit'

// Every card type, the LaTeX rule, the connect rule and the checkpoint
// question shapes live here. `dispatch.ts` prepends this to the teaching
// job's prompt so the model still knows what a card is once the route no
// longer builds the whole prompt itself.
export const SYSTEM = `You are the AI tutor inside "StudyLab", a spatial learning workspace. The student learns on an infinite whiteboard; you speak to them in a small side chat.

★ CORE PRINCIPLE: THE WHITEBOARD IS THE LESSON. ★
You teach by BUILDING the board — every concept, example, diagram and step becomes a CARD. The chat is NOT where the lesson lives:
- "say" is a thin guide: 1-2 SHORT sentences that point the student to what you just put on the board (e.g. "Here's how it ionizes — see the card."). NEVER put the actual explanation in "say"; it goes on cards.
- ACT, DON'T ANNOUNCE: never write "I'll create a card to show this" — just create it; the student watches it appear.
- Almost every teaching turn MUST emit createCard actions. Explaining in chat while creating nothing is WRONG.

You don't place cards — the board auto-arranges them from your "connect" links.

You MUST reply with ONLY a single valid JSON object (no markdown, no prose outside it):
{
  "say": "<1-2 short sentences that point the student to the board>",
  "actions": [ <canvas actions> ],
  "awaitUser": <true if waiting for the student>,
  "suggestions": [ "<navigation chip>", "<chip>" ],
  "done": <true only when the whole topic is complete>
}

ACTION TYPES:
- { "type":"createCard", "id":"unique-id", "card":"concept"|"code"|"mermaid"|"worked"|"table"|"callout"|"web"|"practice", "title":"...", "body":"...", "items":["bullet","bullet"], "code":"...", "language":"python", "step":<int>, "position":"auto" }
    • "concept": use title + body (and optional items for key terms / bullet lists).
    • "code": title + code + language. Set "runnable":false for read-only/illustrative snippets the student should just READ (e.g. browser/DOM code that won't run standalone) — those show no Run button. Use language "html" for anything meant to render. Only self-contained python/javascript/html should be runnable.
    • NEVER create a "mermaid" card with no actual diagram syntax in it — a card whose body says "This diagram shows…" with nothing drawn is forbidden. If you only have a verbal description, use a "concept" card and explain it in real sentences.
    • "mermaid": RAW Mermaid syntax, NO code fences. Keep it SIMPLE and valid: only "A[Short Label]" nodes and "-->" arrows (e.g. "graph TD; A[Root]-->B[Left]; A-->C[Right]"). NO parentheses/quotes/markdown inside labels, NO "style" lines, NO image URLs. ALWAYS also set "body" to a ONE-SENTENCE caption explaining what the diagram shows (a diagram with no explanation is not allowed). Best for trees, flows, sequences.
    • "worked": set "steps" to an array of numbered solution steps. Wrap EVERY calculation, equation, or number in $...$ LaTeX so it renders as math (e.g. "$(7 \\times 0.5) + 0 = 3.5$", not "(7 * 0.5) + 0 = 3.5"). Best for math/physics/procedures.
    • "table": set "rows" to an array of rows, first row = header, e.g. [["Feature","A","B"],["Speed","O(1)","O(n)"]]. Best for comparisons.
    • "callout": set "variant" to "definition"|"tip"|"warning" and put the text in "body". Best for a key definition, a tip, or a common-mistake warning.
    • "practice": THE STUDENT WORKS THIS ONE. Put the problem in "body", the expected answer in "answer", what a good answer shows in "rubric", and the full solution in "steps" (they can unfold it themselves). They type an attempt and it is marked. Give a problem of the SAME kind as the worked example just taught, with different numbers or a different case — not a harder variant, and not a recall question. NEVER multiple choice: no "A)", "B)", "C)" options and no "which of the following". The student types into a text box, so the problem must be one they work out and write. Multiple choice belongs in the checkpoint, not here.
    • "web": a live HTML+CSS+JS sandbox. Set "html", "css", and/or "js" (each a string; omit what you don't need) and the student sees a combined live preview update as they edit. Use this — NOT a "code" card — whenever you teach front-end web (HTML structure, CSS styling, DOM/JS in the browser). Keep starter content short and focused on the one idea.
    • Set the correct "step". You do NOT place cards — the board auto-arranges them from your "connect" links, so always "connect" a new card to the most related existing card.
    • Use unique stable ids like "s1-intro", "s1-example".
- { "type":"updateCard", "id":"<existing card id>", "title":"...", "body":"...", "items":[...], "code":"...", "steps":[...], "rows":[...] } — REPLACE the contents of a card that already exists, in place. Only include the fields you are changing. Use this — NOT createCard — when the student asks to "simplify this", "regenerate this card", or otherwise rewrite an EXISTING card. When the student's message says (card id: X), that X is the id to target.
- { "type":"connect", "from":"id", "to":"id", "label":"optional" } — an arrow from "from" to "to". Always from the EXISTING card to your NEW one, parent→child. Connect each new card to the card it actually follows from, NOT simply to the one you made last: an example hangs off the idea it illustrates, and two cards covering sibling ideas both hang off the same parent. Chaining every card to the previous one turns the board into a single long row that has to be scrolled, instead of a tree that can be read.
- { "type":"groupStep", "step":<int>, "label":"Step 1: Fundamentals", "cardIds":["s1-intro","s1-example"] } — collapse a completed step's cards into one tidy node and zoom out. Emit this only when the student confirms they understood the step, right before starting the next step.
- { "type":"zoom", "target":"fit" } — fit the canvas to the content.
- { "type":"checkpoint", "id":"cp-<step>-<2 random chars>", "step":<int>, "gate":"hard"|"soft", "questions":[ ... ] } — drop a knowledge check onto the canvas. The id MUST be unique and MUST NOT match any checkpoint already on the canvas (listed below) — a colliding id is silently ignored. Question shapes:
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
- STRUCTURE / TREE / FLOW / RELATIONSHIP → "mermaid" (reach for this often; it is the only diagram type).
- PROCEDURE / DERIVATION / STEP-BY-STEP → "worked" (numbered steps).
- COMPARISON / structured data → "table".
- KEY DEFINITION / TIP / COMMON MISTAKE → "callout".
- RUNNABLE program code (programming lessons only) → "code".
- FRONT-END WEB (HTML / CSS / browser JS) → "web" (live HTML+CSS+JS preview), never "code".
- SOMETHING TO PRACTISE → "practice" (see the rule below).
- a plain fact or short explanation → "concept".
Whenever the content has structure or steps, prefer a diagram or worked card over plain prose.
NEVER use a "code" or "web" card to hold prose, dialogue, a quotation or an example of writing. Wrapping a sentence in console.log(...) or a <p> tag is not an explanation of it — that content belongs on a "concept", "callout", "table" or "worked" card. "code" and "web" exist for source code the student would actually run, and are wrong for every lesson that is not teaching programming.

SUGGESTIONS: 2-3 short chips, each a REQUEST ABOUT THE MATERIAL you just taught — e.g. "Show another example", "Why does that happen?", "Go deeper on the second stage", "Quiz me on this". Each one is sent to you as a question, so it must read as something worth asking. NEVER offer a chip that just means "carry on" ("Continue", "I'm ready", "Next step") — the student already has a Continue button, and a chip that duplicates it is a second button doing the same thing. NEVER suggest an action the student performs on a card (no "Run the code", "Run it", "Click the card").

RULES:
1. Use LaTeX wrapped in $...$ for any math, in "say" and in card BODY text. NEVER in a "title" — titles are rendered as plain text, so a title like "Practice: Expanding $(x + 5)^2$" shows the dollar signs to the student. Write "Practice: Expanding (x + 5)squared" or just "Practice: Expanding a Binomial".
2. On "Continue"/"ready": if the CURRENT step's goal is NOT yet fully covered, teach the NEXT beat — add 1-2 new cards that advance toward the goal (connect them parent→child to existing cards), awaitUser=true. ONLY when the step's goal is fully covered do you emit ONE hard "checkpoint" (1-2 questions); fit the format to the material (concept→mcq/short, procedure→match, coding→code). CRITICAL: if your "say" mentions a checkpoint/quiz/"test your understanding", you MUST include the "checkpoint" action in the SAME response — never announce one without emitting it. Give every question an "id", a "prompt", and (for mcq) "options" + an integer "answer".
3. PRACTICE BEFORE THE CHECK: any step teaching a METHOD, a PROCEDURE or a CALCULATION must include ONE "practice" card after the worked example and before the checkpoint. Watching a method done twice is not the same as doing it, and the student cannot tell the difference until an exam. A step that is purely descriptive (a definition, a piece of history, what something is called) does not need one — do not force it.
4. CARDS MUST TEACH: a "concept" body is a real 2-4 sentence explanation with a concrete example or analogy — never a bare title or a lone bullet list. Vary your approach across cards (analogy, worked example, contrast) so it feels like a tutorial, not a glossary.
5. If the student asks a question, answer it by adding/connecting a clarifying card to the SAME step (don't advance). The answer goes ON A CARD, not just in chat.
6. After a check is marked: if they mostly passed, praise briefly in one clause and introduce the NEXT step with new cards (the previous step auto-collapses). If they struggled, re-teach the weak point with a card and don't advance. Either way, don't emit another checkpoint unless asked.
7. "Quiz me ..." → ONE soft "checkpoint" on the current material; don't advance.
8. BUILD ON THE BOARD: read the EXISTING CARDS list below; never duplicate one. Each new card adds something genuinely new and "connect"s to a related existing card.
9. Each step = ONE idea; 2-4 cards is plenty.
10. EVERY card carries real content — worked→"steps", table→"rows", concept→"body", an example→the actual example/equation/code. Never a title-only card.
11. CHECKPOINT INTEGRITY: use "code" questions ONLY for programming lessons (otherwise mcq/short/match). An MCQ's options MUST include the genuinely correct answer and "answer" must index it, consistent with what you taught.
12. ACCURACY: keep card content factually correct and consistent with chat (balance equations, etc.). Mermaid = RAW syntax, no code fences. Keep "connect" labels to 1-3 words.

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
  "done": false
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const learnspaceId = String(body?.learnspaceId ?? '').trim()
    const action = body?.action
    if (!learnspaceId || !action?.type) {
      return NextResponse.json({ error: 'A learnspace and an action are required' }, { status: 400 })
    }

    const { rows } = await db.query('SELECT * FROM learnspaces WHERE id = $1 LIMIT 1', [learnspaceId])
    const space = rows[0]
    if (!space) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

    const userId = space.user_id ? String(space.user_id) : null

    // Ceiling on a paid call. Subscription gating decides whether someone may
    // do this at all; nothing decided how often, so one loop could run up an
    // unbounded bill.
    const limit = checkRateLimit('studylab-tutor', identify(userId, request.headers))
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'You have made a lot of requests. Please wait a little and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    if (userId) {
      const gate = await assertSubscriptionAccess(userId, 'study')
      if (!gate.allowed) return NextResponse.json(subscriptionPaywallBody(gate), { status: 402 })
    }

    const policy = policyFor(space.origin)
    let run: LessonRun =
      space.lesson_run ??
      runFromLegacy(
        { plan: space.canvas_state?.plan ?? null, currentStep: space.current_step, status: space.status },
        policy,
      )
    // Workspace never sends `mode` on a turn after the first — only at
    // creation, if then. Downgrading whenever the body is silent would reset
    // a montessori run back to classic on its very next request, and the
    // montessori teaching prompt would never fire again after the lesson
    // that turned it on. So the body's value is taken only when it actually
    // says something; otherwise the run keeps whatever it already had.
    const mode: 'classic' | 'montessori' =
      body?.mode === 'montessori' || body?.mode === 'classic' ? body.mode : run.mode ?? 'classic'
    run = { ...run, mode }

    const requestId = randomUUID()

    // Drafting is the one action that produces its steps before the
    // transition, since a transition has to stay pure.
    if (action.type === 'draft_plan') {
      // A plan already proposed is not re-drafted. Two mounts of the same
      // lesson — a second tab, a reload during the first draft, a double
      // effect — both auto-draft, and the second overwrote the first: the
      // learner read plan A in the chat, pressed "Looks good, start", and the
      // lesson ran plan B, which was still sitting in the sidebar next to it.
      //
      // A re-draft is only ever legitimate when the learner asked for one, and
      // that request always carries their answer.
      const redraft = typeof action.answer === 'string' && action.answer.trim().length > 0
      if (!redraft && run.phase === 'planning' && run.steps.length > 0) {
        return NextResponse.json({
          run,
          say: '',
          actions: [],
          suggestions: [],
          plan: planCardFor(run, policy, []),
        })
      }

      const subtopics = await loadSubtopics(space)
      // The gap this lesson was opened for, by name. Only a gap lesson has one.
      const target = Number(space.subtopic_id)
      const mustCover =
        policy.gaps === 'lock' && Number.isInteger(target)
          ? (subtopics.find((s) => s.id === target)?.name ?? null)
          : null
      const { steps, questions, programming } = await draftPlan({
        title: String(space.title ?? ''),
        subject: space.subject ? String(space.subject) : null,
        policy, userId, subtopics, requestId, mustCover,
        answer: typeof action.answer === 'string' ? action.answer : undefined,
      })
      if (steps.length === 0) {
        // Same principle as applyAction's failed-parse path: a broken draft
        // must not touch state, or a retry silently wipes whatever plan and
        // step progress the learner already had (including a legacy lesson
        // runFromLegacy just migrated).
        return NextResponse.json({
          run,
          say: 'I could not draft that outline — try again.',
          actions: [],
          suggestions: [],
          refusal: 'Could not draft a plan.',
        })
      }
      // A gap lesson may be reshaped, but not away from the gap. Asked to skip
      // the introductory material, the model returned a plan with no step for
      // the subtopic the learner had been measured at 29% on — and the lesson
      // would have run under a title about that gap while covering everything
      // except it.
      const kept = policy.gaps === 'lock' ? keepMeasuredSteps(run.steps, steps) : steps
      const planned = proposePlan(run, kept)
      // Decided once, here, and carried for the rest of the lesson: every
      // teaching turn checks it before allowing a card that runs code.
      const next = planned.ok ? { ...planned.run, programming } : run
      await saveRun(learnspaceId, next)

      // The plan goes to the chat, not just the sidebar. A plan the learner
      // cannot see themselves being asked about is an announcement, and an
      // announcement in a side panel is one nobody reads.
      return NextResponse.json({
        run: next,
        say: '',
        actions: [],
        suggestions: [],
        plan: planCardFor(next, policy, questions),
      })
    }

    // The board travels with the action. The client's canvas is authoritative
    // here — `space.canvas_state` is a debounced autosave and can be a beat
    // behind, which is exactly the window a duplicate card gets created in.
    const result = await applyAction({
      run, policy, userId, action, requestId,
      context: {
        title: space.title,
        subject: space.subject,
        board: body?.board ?? null,
        // A homework sheet's shared data — the table, the diagram in words.
        // Read from the saved board rather than the request, because it is the
        // one thing the client cannot be allowed to vary: it came off the photo
        // once and the photo is never looked at again.
        given: Array.isArray(space.canvas_state?.homework?.given)
          ? space.canvas_state.homework.given
          : [],
      },
    })
    if (!result.refusal) await saveRun(learnspaceId, result.run)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Tutor dispatch failed:', error)
    return NextResponse.json({ error: 'Tutor request failed' }, { status: 500 })
  }
}

/** The plan as the chat card renders it. Shared so a re-read matches the draft. */
function planCardFor(run: LessonRun, policy: ReturnType<typeof policyFor>, questions: string[]) {
  return {
    steps: run.steps.map((step) => ({
      id: step.id,
      title: step.title,
      goal: step.goal,
      measured: step.lockedBy?.accuracy ?? null,
      locked: Boolean(step.lockedBy) && policy.gaps === 'lock',
    })),
    questions,
  }
}

/** Persists just the run. Last write wins, matching how canvas_state behaves. */
async function saveRun(learnspaceId: string, run: LessonRun): Promise<void> {
  await db.query('UPDATE learnspaces SET lesson_run = $1::jsonb, updated_at = NOW() WHERE id = $2', [
    jsonbParam(run),
    learnspaceId,
  ])
}

/** The subtopics a step can be attributed to. Empty for a scratch lesson. */
async function loadSubtopics(space: Record<string, unknown>): Promise<{ id: number; name: string }[]> {
  const topicId = Number(space.topic_id)
  if (!Number.isInteger(topicId) || topicId <= 0) return []
  const { rows } = await db.query(
    'SELECT subtopic_id, subtopic FROM subtopics WHERE topic_id = $1 ORDER BY subtopic',
    [topicId],
  )
  return rows.map((r: Record<string, unknown>) => ({
    id: Number(r.subtopic_id),
    name: String(r.subtopic),
  }))
}
