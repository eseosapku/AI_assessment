# StudyLab Knowledge-Check Checkpoints Implementation Plan (Phase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the tutor drop knowledge-check quizzes onto the canvas — MCQ, short-answer, code-challenge, and drag/match — graded (client-side for MCQ/match, AI for short/code), with a hard gate at step boundaries and an optional student-initiated "Quiz me".

**Architecture:** A new `checkpoint` tutor action carries a list of typed questions; the pure reducer expands it into a checkpoint-header node plus one `quiz` node per question. Quiz nodes grade themselves (MCQ/match locally via pure helpers; short/code via a new `/api/studylab/grade` route) and write their result back through `onNodeDataChange`. When every question in a checkpoint is answered, the Workspace sends a synthetic `CHECKPOINT RESULT` turn to the tutor, which advances (pass) or re-teaches (fail). A minimal tutor-prompt addition teaches the model to emit checkpoints.

**Tech Stack:** Next.js 16, React 18, TypeScript (strict), `@xyflow/react` v12, Vitest, AWS Bedrock (via existing `lib/bedrock.ts`). No new npm dependencies.

## Global Constraints

- Path alias `@/*` maps to repo root. TypeScript `strict`; no `any` in new code (existing `isValidAction(a: any)` is baseline).
- Pure-logic modules (`lib/studylab/*.ts` except components) must NOT import React or browser/canvas code.
- Quiz answer keys live client-side (acceptable for a study tool, not an exam). Short-answer/code grading goes through `/api/studylab/grade`.
- The grade route mirrors the existing tutor route's structure: `hasBedrockCredentials()` guard, `assertSubscriptionAccess(userId,'study')` gate, `callGemma` + `parseJsonRobust`, graceful fallback on model/JSON failure.
- No new npm dependencies. Code-challenge questions reuse the Phase 3 `RunnableCodeNode`/run engines.
- Interactive controls carry `nodrag` (and `onMouseDown` stopPropagation on text inputs).
- Verification gate: `npx tsc --noEmit` (clean) + `npm test` (all green). `npm run lint` is unavailable (Next 16). Do not start the dev server inside a subagent.
- Commit after each task. Commit messages end with the trailer below.

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

- This plan is **Phase 5** of `docs/superpowers/specs/2026-06-25-studylab-tutor-expansion-design.md`. The broad tutor-prompt rewrite + new tutoring node types (mermaid/worked/table/callout) remain **Phase 6**; this phase adds only the minimal checkpoint protocol to the prompt.

---

### Task 1: Checkpoint types + client grading helpers (pure, TDD)

**Files:**
- Modify: `lib/studylab/types.ts` (add `CheckpointQuestion`, `QuizCell`, the `checkpoint` action; refine `StudyNodeData.quiz`)
- Create: `lib/studylab/quiz.ts`
- Test: `lib/studylab/quiz.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type CheckpointQuestion =
    | { id: string; format: 'mcq'; prompt: string; options: string[]; answer: number; explain?: string }
    | { id: string; format: 'short'; prompt: string; rubric?: string }
    | { id: string; format: 'code'; prompt: string; language?: string; starter?: string; goal: string }
    | { id: string; format: 'match'; prompt: string; pairs: { left: string; right: string }[] }

  export interface QuizCell {
    checkpointId: string
    gate: 'hard' | 'soft'
    question: CheckpointQuestion
    state: 'unanswered' | 'pending' | 'correct' | 'incorrect'
    given?: number | string | string[]
    feedback?: string
  }
  ```
  `StudyNodeData.quiz?: Record<string, unknown>` becomes `quiz?: QuizCell`. Add the `checkpoint` member to `TutorAction`:
  ```ts
  | { type: 'checkpoint'; id: string; step: number; gate: 'hard' | 'soft'; questions: CheckpointQuestion[] }
  ```
- Produces (quiz.ts):
  - `function gradeMcq(q: Extract<CheckpointQuestion,{format:'mcq'}>, given: number): boolean`
  - `function gradeMatch(q: Extract<CheckpointQuestion,{format:'match'}>, given: string[]): boolean`
  - `function checkpointResultText(cells: QuizCell[]): string` — a one-line summary like `CHECKPOINT RESULT: 2/3 correct. Missed: "<prompt>"...` for the synthetic tutor turn.
  - `function isValidQuestion(q: any): q is CheckpointQuestion` — structural guard used by `isValidAction` in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `lib/studylab/quiz.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { gradeMcq, gradeMatch, checkpointResultText, isValidQuestion } from '@/lib/studylab/quiz'
import type { CheckpointQuestion, QuizCell } from '@/lib/studylab/types'

const mcq: CheckpointQuestion = { id: 'q1', format: 'mcq', prompt: 'p', options: ['a', 'b'], answer: 1 }
const match: CheckpointQuestion = { id: 'q2', format: 'match', prompt: 'p', pairs: [{ left: 'L1', right: 'R1' }, { left: 'L2', right: 'R2' }] }

describe('gradeMcq', () => {
  it('is correct only for the answer index', () => {
    expect(gradeMcq(mcq as any, 1)).toBe(true)
    expect(gradeMcq(mcq as any, 0)).toBe(false)
  })
})

describe('gradeMatch', () => {
  it('is correct when every left maps to its right', () => {
    expect(gradeMatch(match as any, ['R1', 'R2'])).toBe(true)
    expect(gradeMatch(match as any, ['R2', 'R1'])).toBe(false)
    expect(gradeMatch(match as any, ['R1'])).toBe(false)
  })
})

describe('isValidQuestion', () => {
  it('accepts well-formed questions', () => {
    expect(isValidQuestion(mcq)).toBe(true)
    expect(isValidQuestion(match)).toBe(true)
    expect(isValidQuestion({ id: 's', format: 'short', prompt: 'p' })).toBe(true)
    expect(isValidQuestion({ id: 'c', format: 'code', prompt: 'p', goal: 'g' })).toBe(true)
  })
  it('rejects malformed questions', () => {
    expect(isValidQuestion({ format: 'mcq', prompt: 'p' })).toBe(false) // no id/options/answer
    expect(isValidQuestion({ id: 'x', format: 'rune' })).toBe(false)
    expect(isValidQuestion(null)).toBe(false)
  })
})

describe('checkpointResultText', () => {
  it('summarises score and lists missed prompts', () => {
    const cells: QuizCell[] = [
      { checkpointId: 'c', gate: 'hard', question: mcq, state: 'correct' },
      { checkpointId: 'c', gate: 'hard', question: { ...mcq, id: 'q3', prompt: 'tricky' }, state: 'incorrect' },
    ]
    const text = checkpointResultText(cells)
    expect(text).toContain('1/2')
    expect(text).toContain('tricky')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- quiz`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the types to `lib/studylab/types.ts`**

- Add `CheckpointQuestion` and `QuizCell` (exact shapes above) near the top (after `CardKind`).
- Change `StudyNodeData.quiz?: Record<string, unknown>` to `quiz?: QuizCell`.
- Add the `checkpoint` member to the `TutorAction` union (exact shape above).
- Add `'checkpointHeader'` to `StudyNode.type` and `StudyNodeData.kind` unions (so the reducer can create header nodes): change both `CardKind | 'stepGroup' | 'image'` to `CardKind | 'stepGroup' | 'image' | 'quiz' | 'checkpointHeader'`.

- [ ] **Step 4: Implement `lib/studylab/quiz.ts`**

```ts
import type { CheckpointQuestion, QuizCell } from './types'

export function gradeMcq(q: Extract<CheckpointQuestion, { format: 'mcq' }>, given: number): boolean {
  return given === q.answer
}

export function gradeMatch(q: Extract<CheckpointQuestion, { format: 'match' }>, given: string[]): boolean {
  return q.pairs.length === given.length && q.pairs.every((p, i) => given[i] === p.right)
}

export function checkpointResultText(cells: QuizCell[]): string {
  const total = cells.length
  const correct = cells.filter((c) => c.state === 'correct').length
  const missed = cells
    .filter((c) => c.state !== 'correct')
    .map((c) => `"${c.question.prompt}"`)
    .join(', ')
  const tail = missed ? ` Missed: ${missed}.` : ' All correct.'
  return `CHECKPOINT RESULT: ${correct}/${total} correct.${tail}`
}

export function isValidQuestion(q: any): q is CheckpointQuestion {
  if (!q || typeof q !== 'object' || typeof q.id !== 'string' || typeof q.prompt !== 'string') return false
  switch (q.format) {
    case 'mcq':
      return Array.isArray(q.options) && q.options.every((o: any) => typeof o === 'string') && Number.isInteger(q.answer)
    case 'short':
      return true
    case 'code':
      return typeof q.goal === 'string'
    case 'match':
      return Array.isArray(q.pairs) && q.pairs.every((p: any) => typeof p?.left === 'string' && typeof p?.right === 'string')
    default:
      return false
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- quiz`
Expected: PASS — all tests pass.

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all green; tsc clean (the `quiz` field type change and union widening must not break existing code).

- [ ] **Step 7: Commit**

```bash
git add lib/studylab/types.ts lib/studylab/quiz.ts lib/studylab/quiz.test.ts
git commit -m "feat(studylab): checkpoint question types + client grading helpers"
```

---

### Task 2: Reducer expands `checkpoint` into nodes (pure, TDD)

**Files:**
- Modify: `lib/studylab/actions.ts` (`isValidAction` + `applyActions` checkpoint case)
- Test: `lib/studylab/actions.checkpoint.test.ts`

**Interfaces:**
- Consumes: `isValidQuestion` from `./quiz`; the `checkpoint` action type.
- Produces: applying a `checkpoint` action adds one `checkpointHeader` node (`id = '<action.id>-hdr'`) and one `quiz` node per question (`id = question.id`), each with `data.step = action.step` and `source` left undefined (AI nodes). Each quiz node's `data.quiz = { checkpointId, gate, question, state: 'unanswered' }`. Re-applying the same checkpoint id is a no-op. The created ids are reported in `ApplyResult.created`.

- [ ] **Step 1: Write the failing tests**

Create `lib/studylab/actions.checkpoint.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyActions, isValidAction } from '@/lib/studylab/actions'
import type { CanvasState } from '@/lib/studylab/types'

const empty: CanvasState = { nodes: [], edges: [] }
const checkpoint = {
  type: 'checkpoint' as const,
  id: 'cp1',
  step: 1,
  gate: 'hard' as const,
  questions: [
    { id: 'cp1-q1', format: 'mcq' as const, prompt: 'p', options: ['a', 'b'], answer: 0 },
    { id: 'cp1-q2', format: 'short' as const, prompt: 'explain' },
  ],
}

describe('isValidAction checkpoint', () => {
  it('accepts a well-formed checkpoint', () => {
    expect(isValidAction(checkpoint)).toBe(true)
  })
  it('rejects a checkpoint with a bad question', () => {
    expect(isValidAction({ ...checkpoint, questions: [{ id: 'x', format: 'mcq' }] })).toBe(false)
  })
})

describe('applyActions checkpoint', () => {
  it('creates a header node and one quiz node per question', () => {
    const res = applyActions(empty, [checkpoint])
    const header = res.nodes.find((n) => n.type === 'checkpointHeader')
    const quizzes = res.nodes.filter((n) => n.type === 'quiz')
    expect(header?.id).toBe('cp1-hdr')
    expect(quizzes.map((n) => n.id)).toEqual(['cp1-q1', 'cp1-q2'])
    expect(quizzes[0].data.quiz?.checkpointId).toBe('cp1')
    expect(quizzes[0].data.quiz?.gate).toBe('hard')
    expect(quizzes[0].data.quiz?.state).toBe('unanswered')
    expect(res.created).toContain('cp1-q1')
  })

  it('is idempotent on the same checkpoint id', () => {
    const once = applyActions(empty, [checkpoint])
    const twice = applyActions({ nodes: once.nodes, edges: once.edges }, [checkpoint])
    expect(twice.created).toEqual([])
    expect(twice.nodes.filter((n) => n.type === 'quiz')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- actions.checkpoint`
Expected: FAIL — checkpoint not handled.

- [ ] **Step 3: Add the validation case**

In `lib/studylab/actions.ts`:
- Add import: `import { isValidQuestion } from './quiz'`
- In `isValidAction`, add before `default`:
```ts
    case 'checkpoint':
      return (
        typeof a.id === 'string' &&
        ['hard', 'soft'].includes(a.gate) &&
        Array.isArray(a.questions) &&
        a.questions.length > 0 &&
        a.questions.every(isValidQuestion)
      )
```

- [ ] **Step 4: Add the reducer case**

In `applyActions`, add a `case 'checkpoint'` to the switch (after `createCard`):
```ts
case 'checkpoint': {
  if (nodes.some((n) => n.data.quiz?.checkpointId === action.id)) break
  const step = action.step
  const headerId = `${action.id}-hdr`
  if (!nodes.some((n) => n.id === headerId)) {
    nodes.push({
      id: headerId,
      type: 'checkpointHeader',
      position: autoPosition(nodes, step, 'checkpointHeader'),
      data: { kind: 'checkpointHeader', title: 'Check your understanding', step },
    })
    created.push(headerId)
  }
  for (const q of action.questions) {
    if (nodes.some((n) => n.id === q.id)) continue
    nodes.push({
      id: q.id,
      type: 'quiz',
      position: autoPosition(nodes, step, 'quiz'),
      data: { kind: 'quiz', step, quiz: { checkpointId: action.id, gate: action.gate, question: q, state: 'unanswered' } },
    })
    created.push(q.id)
  }
  break
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- actions.checkpoint`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all green; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add lib/studylab/actions.ts lib/studylab/actions.checkpoint.test.ts
git commit -m "feat(studylab): expand checkpoint actions into header + quiz nodes"
```

---

### Task 3: AI grade route for short-answer + code

**Files:**
- Create: `app/api/studylab/grade/route.ts`

**Interfaces:**
- Request body: `{ user_id?: string; prompt: string; format: 'short' | 'code'; answer: string; rubric?: string; goal?: string; output?: string }`.
- Response: `{ correct: boolean; feedback: string }` (HTTP 200), or `{ error }` on failure with the credential/subscription pattern of the tutor route.

- [ ] **Step 1: Implement the route**

Model the file on `app/api/studylab/tutor/route.ts` (same imports + guards). Full implementation:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { callGemma, parseJsonRobust, hasBedrockCredentials } from '@/lib/bedrock'
import { BEDROCK_CREDENTIALS_ERROR } from '@/lib/aws-config'
import { assertSubscriptionAccess, subscriptionPaywallBody } from '@/lib/subscription-server'

function buildPrompt(o: { prompt: string; format: string; answer: string; rubric?: string; goal?: string; output?: string }): string {
  const criterion = o.format === 'code'
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
    } catch (err: any) {
      return NextResponse.json({ correct: false, feedback: 'Could not grade right now — try again in a moment.' })
    }
    try {
      const parsed = parseJsonRobust(raw)
      return NextResponse.json({ correct: parsed?.correct === true, feedback: String(parsed?.feedback ?? 'Reviewed.') })
    } catch {
      return NextResponse.json({ correct: false, feedback: raw.slice(0, 300) || 'Reviewed — try again.' })
    }
  } catch {
    return NextResponse.json({ error: 'Grade request failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Confirm `callGemma`, `parseJsonRobust`, `hasBedrockCredentials` are exported from `@/lib/bedrock` and `BEDROCK_CREDENTIALS_ERROR` from `@/lib/aws-config` — they are, per the tutor route.)

- [ ] **Step 3: Commit**

```bash
git add app/api/studylab/grade/route.ts
git commit -m "feat(studylab): AI grade route for short-answer and code questions"
```

---

### Task 4: Quiz + checkpoint-header renderers

**Files:**
- Create: `components/studylab/QuizNode.tsx`
- Modify: `components/studylab/canvasNodes.tsx` (register `quiz` + `checkpointHeader`)

**Interfaces:**
- Consumes: `CanvasContext` (`onNodeDataChange`), `CardFrame`/`handleClass` from `./canvasShared`; `gradeMcq`, `gradeMatch` from `@/lib/studylab/quiz`; `getEngine`, `normalizeLanguage` from `@/lib/studylab/runner`; `QuizCell`/`CheckpointQuestion` from types.
- Produces: `export function QuizNode(props: NodeProps)`, `export function CheckpointHeaderNode(props: NodeProps)`.

Behavior (standard-model task — follow the contract):
- `CheckpointHeaderNode`: a small emerald banner `CardFrame`-style card showing `data.title` ("Check your understanding") and a `Target`/`HelpCircle` icon. Read-only.
- `QuizNode` reads `d.quiz` (a `QuizCell`) and renders by `quiz.question.format`. All persist results through `onNodeDataChange(id, { quiz: { ...quiz, state, given, feedback } })`. Show the current `state` (unanswered/correct/incorrect) with color. Use `nodrag` on every control.
  - **mcq**: list `options` as buttons; on click set `given=index`, grade with `gradeMcq`, set `state` correct/incorrect, reveal `question.explain`.
  - **match**: render each `pairs[i].left` with a `<select className="nodrag">` of all `right` texts (shuffled order is fine); a "Check" button grades with `gradeMatch(question, given[])`.
  - **short**: a `nodrag` `<textarea>` + "Check" button → `POST /api/studylab/grade` with `{ format:'short', prompt, answer, rubric }`; while awaiting set `state='pending'`; on response set `state` + `feedback`.
  - **code**: an editable `nodrag` `<textarea>` seeded from `question.starter`, a **Run** button (reuse `getEngine(normalizeLanguage(question.language)).run`) showing output, and a "Submit" button → `POST /api/studylab/grade` with `{ format:'code', prompt, answer:code, goal, output }`. (Keep this self-contained; do not import `RunnableCodeNode` to avoid coupling — a small inline run is fine.)
- Each `QuizNode` carries `Handle`s (target/left, source/right) like other cards.

- [ ] **Step 1: Create `QuizNode.tsx`** implementing the contract. Keep helpers (a `useGrade` fetch hook) local; keep the file focused.

- [ ] **Step 2: Register the renderers**

In `components/studylab/canvasNodes.tsx`, import and add to `studyNodeTypes`:
```ts
import { QuizNode, CheckpointHeaderNode } from './QuizNode'
// ...
quiz: QuizNode,
checkpointHeader: CheckpointHeaderNode,
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/QuizNode.tsx components/studylab/canvasNodes.tsx
git commit -m "feat(studylab): quiz + checkpoint-header node renderers (mcq, short, code, match)"
```

---

### Task 5: Gating + chat (auto-submit, Quiz-me, pending banner)

**Files:**
- Modify: `components/studylab/Workspace.tsx` (auto-submit synthetic CHECKPOINT RESULT; expose pending state + a "Quiz me" sender; focus-checkpoint)
- Modify: `components/studylab/ChatMouthpiece.tsx` (Quiz-me button + pending banner)

**Interfaces:**
- Consumes: `checkpointResultText` from `@/lib/studylab/quiz`.
- Produces:
  - `Workspace` computes `pendingCheckpoint` (a checkpoint with a `hard` gate where not every quiz node is answered) and passes a boolean + an `onQuizMe()` callback to `ChatMouthpiece`.
  - When every quiz node sharing a `checkpointId` has `state` in `{correct,incorrect}` and that id hasn't been submitted yet, the Workspace builds `checkpointResultText(cells)` and calls `handleSend(...)`, recording the id in a `submittedCheckpoints` ref so it fires once.

- [ ] **Step 1: Workspace — auto-submit effect + Quiz-me**

Add a ref near the others: `const submitted = useRef<Set<string>>(new Set())`.

Add an effect after the handlers:
```ts
useEffect(() => {
  const byCp = new Map<string, typeof canvas.nodes>()
  for (const n of canvas.nodes) {
    const cp = n.data.quiz?.checkpointId
    if (cp) byCp.set(cp, [...(byCp.get(cp) ?? []), n])
  }
  for (const [cpId, cells] of byCp) {
    if (submitted.current.has(cpId)) continue
    const cellData = cells.map((c) => c.data.quiz!).filter(Boolean)
    if (cellData.length > 0 && cellData.every((c) => c.state === 'correct' || c.state === 'incorrect')) {
      submitted.current.add(cpId)
      handleSend(checkpointResultText(cellData))
    }
  }
}, [canvas.nodes, handleSend])
```

Add a Quiz-me sender:
```ts
const handleQuizMe = useCallback(() => {
  handleSend('Quiz me on what we have covered so far.')
}, [handleSend])
```

Compute pending state:
```ts
const pendingCheckpoint = useMemo(() => {
  const byCp = new Map<string, { gate: 'hard' | 'soft'; answered: boolean }[]>()
  for (const n of canvas.nodes) {
    const q = n.data.quiz
    if (!q) continue
    byCp.set(q.checkpointId, [...(byCp.get(q.checkpointId) ?? []), { gate: q.gate, answered: q.state === 'correct' || q.state === 'incorrect' }])
  }
  for (const cells of byCp.values()) {
    if (cells.some((c) => c.gate === 'hard') && !cells.every((c) => c.answered)) return true
  }
  return false
}, [canvas.nodes])
```

Pass to ChatMouthpiece: `pendingCheckpoint={pendingCheckpoint}` and `onQuizMe={handleQuizMe}`.

- [ ] **Step 2: ChatMouthpiece — Quiz-me button + banner**

In `components/studylab/ChatMouthpiece.tsx`:
- Add `pendingCheckpoint?: boolean` and `onQuizMe?: () => void` to `ChatMouthpieceProps`.
- Above the suggestions block, when `!busy`, render a small "Quiz me on this" button (calls `onQuizMe`).
- When `pendingCheckpoint`, render a banner (amber) "Answer the check on the canvas to continue." and **hide the suggestion chips** (so the student finishes the check before advancing).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/studylab/Workspace.tsx components/studylab/ChatMouthpiece.tsx
git commit -m "feat(studylab): checkpoint gating, auto-submit results, and Quiz-me control"
```

---

### Task 6: Tutor prompt — checkpoint protocol

Teach the model to emit `checkpoint` actions (so checkpoints actually fire) without the full Phase 6 rewrite.

**Files:**
- Modify: `app/api/studylab/tutor/route.ts` (system prompt + handle the `CHECKPOINT RESULT` student turn)

**Interfaces:** none (prompt text only).

- [ ] **Step 1: Add the checkpoint protocol to the SYSTEM prompt**

In the `SYSTEM` string in `app/api/studylab/tutor/route.ts`, add a new ACTION TYPE and rules:
```
- { "type":"checkpoint", "id":"cp-<step>", "step":<int>, "gate":"hard"|"soft", "questions":[ ... ] } — drop a knowledge check onto the canvas.
    Question shapes:
      { "id":"<unique>", "format":"mcq", "prompt":"...", "options":["..."], "answer":<index>, "explain":"..." }
      { "id":"<unique>", "format":"short", "prompt":"...", "rubric":"what a good answer contains" }
      { "id":"<unique>", "format":"code", "prompt":"...", "language":"python", "starter":"", "goal":"what the code must do" }
      { "id":"<unique>", "format":"match", "prompt":"...", "pairs":[{"left":"...","right":"..."}] }
```
And RULES additions:
```
8. Right before you would group a completed step, emit ONE "checkpoint" with gate="hard" and 1-3 questions instead of grouping immediately; set awaitUser=true. Choose the format to fit (concept→mcq/short, procedure→match, coding→code).
9. If the student message starts with "CHECKPOINT RESULT:", read their score: if they passed (most correct), praise them, THEN emit the groupStep for the step and introduce the next step; if they struggled, re-teach the weak point and offer to try again. Do not create another checkpoint unless they ask.
10. If the student asks to be quizzed ("Quiz me ..."), emit ONE checkpoint with gate="soft" on the current material.
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (string-only change).

- [ ] **Step 3: Commit**

```bash
git add app/api/studylab/tutor/route.ts
git commit -m "feat(studylab): teach the tutor the checkpoint protocol"
```

---

## Self-Review

**Spec coverage (Phase 5 — checkpoints):**
- `checkpoint` action + 4 question formats → Task 1 (types) + Task 2 (validation/reducer). ✓
- Reducer expands into header + one quiz node per question → Task 2. ✓
- MCQ + match graded client-side; short + code AI-graded → Task 1 (helpers) + Task 3 (route) + Task 4 (renderers wire both). ✓
- Code questions reuse the run engines → Task 4. ✓
- Hard gate at step boundaries; synthetic `CHECKPOINT RESULT` turn; pass→advance / fail→re-teach → Task 5 (auto-submit + pending) + Task 6 (prompt branches on result). ✓
- "Quiz me" student-initiated soft checkpoint → Task 5 (button) + Task 6 (prompt). ✓
- Chat shows a prominent check affordance; chips hidden while a hard check is pending → Task 5. ✓
- Answer keys client-side (study tool, not exam) → Task 1/4, per spec. ✓

**Documented deviations / v1 scope:** the "Take the check →" zoom button is reduced to the auto-fit the reducer already does on checkpoint creation plus a pending banner (a dedicated re-zoom button is a follow-up); checkpoints grade per-question then auto-submit when all are answered (no separate "submit checkpoint" button). The full tutor-prompt rewrite and new tutoring node types remain Phase 6.

**Placeholder scan:** Tasks 1–3 and 6 carry complete code. Tasks 4–5 are standard-model tasks with explicit per-format behavior, exact endpoint payloads, the persistence pattern, and exact registry keys.

**Type consistency:** `CheckpointQuestion`/`QuizCell` (Task 1) are used by the reducer (Task 2), renderers (Task 4), and gating (Task 5). `checkpointResultText`/`gradeMcq`/`gradeMatch`/`isValidQuestion` signatures match across tasks. The `quiz` action shape in the prompt (Task 6) matches `isValidAction`'s checks (Task 2) and the `CheckpointQuestion` shapes (Task 1). Node types `quiz`/`checkpointHeader` are added to the type unions (Task 1), created by the reducer (Task 2), and registered as renderers (Task 4).
