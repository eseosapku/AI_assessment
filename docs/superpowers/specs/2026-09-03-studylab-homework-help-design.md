# Homework help, as its own thing

**Status:** design, awaiting approval
**Date:** 2026-09-03

## The problem

Homework help currently borrows the topic-lesson machinery whole, and it is the
wrong machinery.

Snap a photo of a pump-selection question and you get: a five-step course in
Engineering Economics, an empty board, and a plan card asking you to agree to
"Introduction to Pump Systems & Performance" before anything at all appears.
The question you photographed is nowhere on screen, and nothing that follows
refers to it.

The cause is not subtle. `/api/studylab/snap` reads the photo **only to name the
space**. The photo and any typed text are handed to the Workspace through
localStorage, shown once in the transcript, and then dropped. The code says so:

> **NOT CARRIED OVER:** the new action contract has no field for arbitrary user
> content on any call — `draft_plan` takes only title/subject/policy … so there
> is no request left that could hand the photo or text to the model. The plan
> drafted below is therefore generic (title/subject only), not tailored to this
> specific problem. — `components/studylab/Workspace.tsx`

So the model plans a syllabus from the two words in the title. Everything after
that is downstream of never having read the question.

## What it should be

A homework space opens with **the work on the board**: the photo, the question
transcribed beside it, and the working hanging off that. The rail lists the
questions on the sheet, not a syllabus. The tutor sets up each step and the
student does it; the tutor never writes the answer to the question they were
set.

Three decisions, taken:

| | |
|---|---|
| **The rail** | The questions on the sheet. One step per question. A single question becomes one step broken into the parts of its method. |
| **Working style** | The student does each step and it gets marked. Intermediate steps keep "Show me how"; the final answer does not. |
| **A page of eight** | It reads all of them, lists them, and asks which — "all of them" being one of the answers. |

## Shape of the board

```
 ┌──────────┐      ┌─────────────────┐
 │  photo   │─────▶│ Q2  (excerpt)   │
 │  of the  │  Q2  │ "A pump must    │
 │  sheet   │      │  deliver 40 l/s │
 │          │      │  against …"     │
 └──────────┘      └────────┬────────┘
      │                     │
      │ Q3              ┌───┴────────────┐
      ▼                 │ what you need  │   ← a hint card, only when stuck
 ┌──────────┐           └───┬────────────┘
 │ Q3 …     │               │
 └──────────┘           ┌───┴────────────┐
                        │ find the       │   ← practice: one sub-step
                        │ static lift    │      of THEIR question
                        │ [your working] │
                        └───┬────────────┘
                            │
                        ┌───┴────────────┐
                        │ CHECK          │   ← the question itself
                        │ "So what is    │
                        │  the total     │
                        │  head?"        │
                        └────────────────┘
```

The photo is pinned and never folded away — it is the source, and a student
checking their transcription against it must be able to see both.

## How it works

### 1. Reading the sheet — one call, once

A new route, `app/api/studylab/homework/read/route.ts`. `snap` is left exactly
as it is: it still names the space, and it is on the do-not-touch list.

```ts
// in
{ image?: string, text?: string, userId: string }

// out
{
  subject: string,
  given: string[],            // data shared by every question: a table, the
                              // values off a diagram, "take g = 9.81"
  questions: {
    id: string,               // 'q1', 'q2', …
    label: string,            // "Q3", "3(b)" — as printed on the sheet
    text: string,             // transcribed, not solved
    answer: string | null,    // what a correct final answer is, if determinable
    rubric: string | null,    // what a good answer has to show
  }[],
}
```

Transcribe, never solve. A diagram is described in `given` in words, because
the teaching turns afterwards work from this transcription and not from the
image — sending the photo on every turn would be slow and expensive. **Known
limit:** a question that turns on reading a graph precisely will be as good as
the transcription is. Worth revisiting if it bites.

### 2. Opening — no syllabus, no agreeing

`draftPlan` is not called for a homework space at all. The questions *are* the
plan, so the model call that produced the generic syllabus disappears entirely
— one fewer call, and the failure removed at the root.

On open:

- The photo goes on the board as an `image` node. `addImageNode` already exists
  in `lib/studylab/actions.ts` and **nothing currently calls it**; this is what
  it was written for.
- The chat lists the questions and asks which to work on, with a chip per
  question plus "All of them".
- Exactly one question on the sheet ⇒ no asking, straight in.

The choosing *is* the plan card. For a homework space `PlanCard` renders the
question list with checkboxes and one button, "Work through these" — replacing
both the syllabus and the pace selector.

### 3. The plan

`run.steps` is built directly from the chosen questions:

- `title` — `"Q3 — Life cycle cost"` (the printed label plus a short descriptor)
- `goal` — the transcribed question text
- plus the question's `answer` / `rubric` carried through for the final check

A new dispatch action replaces `draft_plan` + `accept_plan` here:

```ts
| { type: 'start_homework'; questionIds: string[] }
```

It is a pure transition — no model call — building the plan and accepting it in
one move.

### 4. Working a question

Each turn on a homework step produces **at most one thing**:

- a short **hint card** — what to notice, which rule applies — offered when the
  student is stuck or opening a question, never a solution; or
- a **practice card for one sub-step of their actual question**, with the
  `answer` and `rubric` for that sub-step.

The student writes their working, and the existing practice marking route reads
it. Everything here already exists.

**The step's check is the question itself.** The final answer is a one-question
checkpoint whose prompt is their question and whose rubric is what a correct
answer shows. So the board reads: the question → the parts of the working →
"so what is the total head?". Answering it settles the step and moves to the
next question, through `passCheck`, unchanged.

This is what removes the course-shaped feel: no "three cards then a quiz", no
checkpoint about the topic in general. The only thing they are ever checked on
is the thing they were set.

### 5. Not doing their homework for them

- The prompt forbids the final answer appearing in any card or in chat.
- Intermediate practice cards keep **Show me how**. It reveals a sub-step, not
  the answer.
- The final check has **no reveal**. After two wrong attempts the tutor offers a
  fully worked **parallel** problem — same method, different numbers — and the
  student comes back to their own. That is the escape hatch for someone properly
  stuck, and it is not their answer.

### 6. Policy

```ts
homework: {
  gaps: 'advise',
  planEditable: 'always',
  defaultPace: 'step',        // was 'run'
  completion: 'learner-says',
  planSize: { min: 1, max: 12 },   // as many questions as the sheet has
  testOut: 'offer',
}
```

"Run ahead" is hidden for homework: at this pace it would mean solving the whole
question in one go, which is the one thing this must not do.

## What changes, by file

**New**

- `app/api/studylab/homework/read/route.ts` — the vision read above.
- `lib/studylab/homework.ts` — the parsed-sheet type, its validator, and
  `stepsFromQuestions()`.
- A `question` card kind in `lib/studylab/blocks.ts` and its renderer: the
  printed label, the transcribed text, read-only, visually distinct from
  anything being taught. It is the thing being answered, not a thing being
  explained.

**Changed**

- `components/studylab/Workspace.tsx` — a homework space runs the read instead
  of `draft_plan`, puts the photo on the board, and offers the question list.
- `app/api/studylab/tutor/dispatch.ts` — `start_homework`; a homework branch in
  the teaching prompt (their question, the given data, one thing per turn, never
  the answer); `shouldCloseStep` and the plan-drafting call both skipped for
  homework.
- `components/studylab/PlanCard.tsx` — the question-picker rendering.
- `lib/studylab/lessonPolicy.ts` — the policy above.
- `components/studylab/StudyLabSidebar.tsx` — no pace switch on homework.

**Untouched**

`app/api/studylab/snap/route.ts`, `app/api/studylab/grade/route.ts`,
`lib/textbook-vision-images.ts` — all on the do-not-touch list, and none of them
needs to change.

## Phasing

Each phase leaves the product working and is worth shipping on its own.

**Phase 1 — the sheet reaches the board.** The read route, the photo as an image
node, the question list, the plan built from the chosen questions. At the end of
this, a homework space opens with your actual question on it instead of a
syllabus, even though the working still uses the ordinary teaching turn.

**Phase 2 — working the question.** The `question` excerpt card, the homework
teaching prompt, the question-as-check. At the end of this the loop is the one
described above.

**Phase 3 — the edges.** The stuck path and its parallel example, hiding the
pace switch, and adding a second photo to a space that already exists.

## Open questions

- **Typed homework with no photo** takes the same path, minus the image node.
  The read route still splits it into questions.
- **A question that is a whole essay prompt** has no numeric answer, so its check
  falls back to the rubric and the marking reads for the idea. Fine, but worth
  watching.
- **Re-reading the photo mid-lesson.** Not in scope. If the transcription is
  wrong the student can correct it in chat, and the correction reaches the tutor
  the same way any other message does.
