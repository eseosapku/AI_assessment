# Cambridge Checkpoint Exam Path — Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cambridge Checkpoint path to exam prep that generates a real component — Paper 1 or Paper 2 at Cambridge's own duration — and reports the result by strand, for Mathematics and Science at both Primary and Lower Secondary.

**Architecture:** A static syllabus module holds every published fact (codes, components, durations, strands) so nothing else hard-codes one. Questions are generated through the existing `generate-assessment` route and tagged to a strand by keyword overlap, reusing the tokeniser the subtopic tagger already uses. The report scores 0–50 to match Cambridge's published scale and counts a question toward a strand only when the tag was a real match, never a fallback assignment.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript strict, vitest (node environment), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-cambridge-checkpoint-exam-path-design.md` — read it, especially "What Checkpoint actually is" (every code and duration is sourced there) and "Known limits".

## Global Constraints

- **Beta scope: Mathematics and Science only**, both programmes. English is a later cut; ESL is deferred because `0876/02` is Listening and needs audio. Do not build either — but **do record all eight subjects as data** in the syllabus module, so the codes live in one correct place.
- **Never reproduce Cambridge questions or figures.** Cambridge past papers and their diagrams are copyrighted. Questions are original, generated against the public syllabus; figures come from the platform's own catalogue.
- vitest runs in the **node** environment only — no jsdom. **Never create a `.test.tsx` file.**
- Live/model tests go in `scripts/live/*.test.ts` under `vitest.live.config.ts`, excluded from the default suite.
- `npx tsc --noEmit` clean and `npx vitest run` fully green at the end of every task. Baseline: **123 test files / 1579 tests**.
- **Local commits only. NEVER push.** `aws_deploy` is the deploy branch.
- Work in the main repo at `c:\Users\Stephen\AI_assessment` — not a worktree.
- `dropDanglingReferences` and `repairBookReferences` in the generation pipeline apply unchanged and **must not be weakened**. A Checkpoint question referring to a figure that is not there is the same defect as anywhere else.
- Results are reported on **Cambridge's 0–50 scale**. That is the published *reporting* scale, not a paper's raw mark total; no raw totals are invented.

## File Structure

| Path | Responsibility |
|---|---|
| `lib/tag-tokens.ts` | `tagTokens` + `TAG_STOPWORDS`, extracted so the strand tagger and the subtopic tagger share one tokeniser |
| `lib/cambridge-checkpoint.ts` | The syllabus: programmes, subjects, codes, components, durations, strands, per-component `mockable` |
| `lib/checkpoint-strands.ts` | `tagQuestionsWithStrands` — keyword overlap over a subject's strands, recording matched vs assigned |
| `lib/checkpoint-report.ts` | `checkpointReport` — 0–50 score plus the per-strand breakdown |
| `components/ExamPrepForm.tsx` | The third exam type and its programme → subject → component flow |
| `app/api/generate-assessment/route.ts` | Imports the shared tokeniser instead of defining its own |

---

### Task 1: The shared tokeniser

`tagTokens` and `TAG_STOPWORDS` are private to `app/api/generate-assessment/route.ts`. The strand tagger needs the same tokenising, and two copies of a text-normalising function drift — this codebase already carries one duplicated validator for exactly this reason. Extract before there is a second consumer, and prove the route's behaviour is unchanged.

**Files:**
- Create: `lib/tag-tokens.ts`
- Modify: `app/api/generate-assessment/route.ts` (remove the local `tagTokens` and `TAG_STOPWORDS`, import them)
- Test: `lib/tag-tokens.test.ts`

**Interfaces:**
- Produces: `export const TAG_STOPWORDS: Set<string>` and `export function tagTokens(value: string): string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/tag-tokens.test.ts
import { describe, it, expect } from 'vitest'
import { tagTokens, TAG_STOPWORDS } from './tag-tokens'

describe('tagTokens', () => {
  it('lowercases and keeps only alphanumeric runs', () => {
    expect(tagTokens('Photosynthesis: light-dependent REACTIONS!')).toEqual([
      'photosynthesis', 'light', 'dependent', 'reactions',
    ])
  })

  it('drops words of three characters or fewer', () => {
    // "of", "an", "at" carry no signal for matching a strand name.
    expect(tagTokens('Rate of an acid at 20C')).not.toContain('of')
    expect(tagTokens('Rate of an acid at 20C')).toContain('acid')
  })

  it('drops stopwords', () => {
    for (const word of TAG_STOPWORDS) {
      expect(tagTokens(`alpha ${word} beta`)).not.toContain(word)
    }
  })

  it('never throws on empty or non-string input', () => {
    expect(tagTokens('')).toEqual([])
    expect(tagTokens(null as unknown as string)).toEqual([])
    expect(tagTokens(undefined as unknown as string)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/tag-tokens`
Expected: FAIL with `Failed to resolve import "./tag-tokens"`.

- [ ] **Step 3: Create `lib/tag-tokens.ts`**

Move `TAG_STOPWORDS` and `tagTokens` out of `app/api/generate-assessment/route.ts` **verbatim** — same stopword set, same regex, same length filter — and export both. Add a file header saying the tokeniser is shared by the subtopic tagger and the Checkpoint strand tagger, and that two copies would drift.

- [ ] **Step 4: Point the route at it**

In `app/api/generate-assessment/route.ts`, delete the local `TAG_STOPWORDS` and `tagTokens` and add the import:

```ts
import { tagTokens } from '@/lib/tag-tokens'
```

Change nothing else. `tagQuestionsWithSubtopics` keeps its current behaviour exactly, round-robin included.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS. The route's existing tagging tests must still pass untouched — that is what proves the extraction changed no behaviour.

- [ ] **Step 6: Commit**

```bash
git add lib/tag-tokens.ts lib/tag-tokens.test.ts app/api/generate-assessment/route.ts
git commit -m "refactor(exam): one tokeniser for both taggers

The Checkpoint strand tagger needs the same normalising the subtopic
tagger does, and two copies of a text function drift.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The syllabus

Every published fact about Checkpoint, in one file, so nothing else hard-codes a code or a duration. All eight subjects are recorded even though only Mathematics and Science are buildable this phase — the codes should live in one correct place from the start, and a revision site had two of them wrong.

**Files:**
- Create: `lib/cambridge-checkpoint.ts`
- Test: `lib/cambridge-checkpoint.test.ts`

**Interfaces:**
- Produces:
  - `type CheckpointProgramme = 'primary' | 'lower-secondary'`
  - `interface CheckpointComponent { number: string; name?: string; minutes: number; mockable: boolean; notMockableReason?: string }`
  - `interface CheckpointSubject { programme: CheckpointProgramme; name: string; code: string; components: CheckpointComponent[]; strands: string[]; crossCuttingStrand?: string }`
  - `const CHECKPOINT_SUBJECTS: CheckpointSubject[]`
  - `function stageOf(programme: CheckpointProgramme): 6 | 9`
  - `function checkpointSubject(programme: CheckpointProgramme, name: string): CheckpointSubject | undefined`
  - `const BETA_SUBJECTS: readonly string[]` — the subjects built this phase
  - `function buildableSubjects(programme: CheckpointProgramme): CheckpointSubject[]` — those in `BETA_SUBJECTS` with at least one mockable component

- [ ] **Step 1: Write the failing test**

```ts
// lib/cambridge-checkpoint.test.ts
import { describe, it, expect } from 'vitest'
import {
  CHECKPOINT_SUBJECTS, checkpointSubject, buildableSubjects, stageOf,
} from './cambridge-checkpoint'

describe('the published syllabus', () => {
  it('records Lower Secondary Mathematics as Cambridge prints it', () => {
    const maths = checkpointSubject('lower-secondary', 'Mathematics')!
    expect(maths.code).toBe('0862')
    expect(maths.components.map((c) => c.number)).toEqual(['01', '02'])
    expect(maths.components.every((c) => c.minutes === 60)).toBe(true)
  })

  it('records Lower Secondary Science as Cambridge prints it', () => {
    const science = checkpointSubject('lower-secondary', 'Science')!
    expect(science.code).toBe('0893')
    expect(science.components.every((c) => c.minutes === 45)).toBe(true)
    expect(science.strands).toContain('Earth and Space')
    expect(science.strands).toHaveLength(6)
  })

  it('records the Primary subjects at their own durations', () => {
    expect(checkpointSubject('primary', 'Mathematics')!.code).toBe('0096')
    expect(checkpointSubject('primary', 'Mathematics')!.components[0].minutes).toBe(45)
    expect(checkpointSubject('primary', 'Science')!.code).toBe('0097')
    expect(checkpointSubject('primary', 'Science')!.components[0].minutes).toBe(35)
  })

  it('does not confuse English with English as a Second Language', () => {
    // Several revision sites print 0861 as ESL. Cambridge's own May 2026
    // timetable has 0861 as English and 0876 as ESL, and a wrong syllabus code
    // in a product that claims to prep for the real exam is not a small error.
    expect(checkpointSubject('lower-secondary', 'English')!.code).toBe('0861')
    expect(checkpointSubject('lower-secondary', 'English as a Second Language')!.code).toBe('0876')
    expect(checkpointSubject('primary', 'English')!.code).toBe('0058')
    expect(checkpointSubject('primary', 'English as a Second Language')!.code).toBe('0057')
  })

  it('marks Lower Secondary listening unmockable, and says why', () => {
    const esl = checkpointSubject('lower-secondary', 'English as a Second Language')!
    const listening = esl.components.find((c) => c.number === '02')!
    expect(listening.mockable).toBe(false)
    expect(listening.notMockableReason).toMatch(/audio/i)
    // Its siblings can be mocked — the flag is per component, not per subject.
    expect(esl.components.find((c) => c.number === '01')!.mockable).toBe(true)
    expect(esl.components.find((c) => c.number === '03')!.mockable).toBe(true)
  })

  it('does not assume Primary ESL mirrors Lower Secondary', () => {
    // Only the durations were sourced for Primary ESL, never which component
    // is which skill. Guessing that 02 is Listening because it is at Lower
    // Secondary is the inference this module exists to prevent.
    const esl = checkpointSubject('primary', 'English as a Second Language')!
    expect(esl.components.every((c) => !c.mockable)).toBe(true)
    expect(esl.components[1].notMockableReason).toMatch(/not sourced/i)
  })

  it('keeps "cannot be mocked" apart from "not built yet"', () => {
    // English Reading and Writing genuinely can be mocked; they are simply
    // not this phase's work. Burying that among real limitations would tell a
    // learner the wrong reason.
    const english = checkpointSubject('lower-secondary', 'English')!
    expect(english.components.every((c) => c.mockable)).toBe(true)
    expect(buildableSubjects('lower-secondary').map((s) => s.name)).not.toContain('English')
  })

  it('offers only the subjects this phase built', () => {
    for (const programme of ['primary', 'lower-secondary'] as const) {
      expect(buildableSubjects(programme).map((s) => s.name).sort()).toEqual(['Mathematics', 'Science'])
    }
  })

  it('derives the stage rather than storing it twice', () => {
    expect(stageOf('primary')).toBe(6)
    expect(stageOf('lower-secondary')).toBe(9)
  })
})

describe('the syllabus holds together', () => {
  it('gives every subject a four-digit code and at least one component', () => {
    for (const s of CHECKPOINT_SUBJECTS) {
      expect(s.code, s.name).toMatch(/^\d{4}$/)
      expect(s.components.length, s.name).toBeGreaterThan(0)
    }
  })

  it('gives every component a positive duration', () => {
    for (const s of CHECKPOINT_SUBJECTS) {
      for (const c of s.components) {
        expect(c.minutes, `${s.name} ${c.number}`).toBeGreaterThan(0)
      }
    }
  })

  it('makes every unbuildable component explain itself', () => {
    for (const s of CHECKPOINT_SUBJECTS) {
      for (const c of s.components) {
        if (!c.mockable) expect(c.notMockableReason, `${s.name} ${c.number}`).toBeTruthy()
      }
    }
  })

  it('gives every subject at least two strands to report against', () => {
    // A single-strand subject would make the strand breakdown meaningless,
    // which is the whole product here.
    for (const s of CHECKPOINT_SUBJECTS) {
      expect(s.strands.length, s.name).toBeGreaterThanOrEqual(2)
    }
  })

  it('never lists the cross-cutting strand among the others', () => {
    // "Thinking and Working Mathematically" runs through Number, Algebra and
    // Statistics rather than sitting beside them; listing it twice would let a
    // question be tagged to it as if it were a content area.
    for (const s of CHECKPOINT_SUBJECTS) {
      if (s.crossCuttingStrand) expect(s.strands, s.name).not.toContain(s.crossCuttingStrand)
    }
  })

  it('has no duplicate code within a programme', () => {
    for (const programme of ['primary', 'lower-secondary'] as const) {
      const codes = CHECKPOINT_SUBJECTS.filter((s) => s.programme === programme).map((s) => s.code)
      expect(new Set(codes).size, programme).toBe(codes.length)
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/cambridge-checkpoint`
Expected: FAIL with `Failed to resolve import "./cambridge-checkpoint"`.

- [ ] **Step 3: Write `lib/cambridge-checkpoint.ts`**

A file header naming the source — Cambridge International's *Final Test Series Timetable May 2026* — and stating that a revision site is not a source for this file.

The eight subjects, exactly:

| Programme | Subject | Code | Components (number, minutes) |
|---|---|---|---|
| primary | English | `0058` | `01`/60, `02`/60 |
| primary | English as a Second Language | `0057` | `01`/35, `02`/25, `03`/35 |
| primary | Mathematics | `0096` | `01`/45, `02`/45 |
| primary | Science | `0097` | `01`/35, `02`/35 |
| lower-secondary | English | `0861` | `01`/70, `02`/70 |
| lower-secondary | English as a Second Language | `0876` | `01` Reading and Usage/45, `02` Listening/35, `03` Writing/40 |
| lower-secondary | Mathematics | `0862` | `01`/60, `02`/60 |
| lower-secondary | Science | `0893` | `01`/45, `02`/45 |

Strands — the same for both programmes of a subject:

- **Mathematics:** `['Number', 'Algebra, Geometry and Measure', 'Statistics and Probability']`, `crossCuttingStrand: 'Thinking and Working Mathematically'`
- **Science:** `['Biology', 'Chemistry', 'Physics', 'Earth and Space', 'Thinking and Working Scientifically', 'Science in Context']`
- **English:** `['Reading', 'Writing', 'Speaking', 'Listening']`
- **English as a Second Language:** `['Reading and Usage', 'Listening', 'Writing']`

`mockable` means **can this ever be mocked in text and figures**, which is not the same as "is it built yet". Keep the two apart — conflating them would bury a permanent limitation among temporary ones:

- **Lower Secondary ESL `02`** is `mockable: false`, `notMockableReason: 'Listening needs audio, which this path cannot produce.'` This is sourced: Cambridge's own mark schemes name `0876/01` Reading and Usage and `0876/03` Writing, leaving `02` as Listening.
- **Primary ESL `01`, `02`, `03`** are all `mockable: false`, `notMockableReason: 'Component names for Primary ESL are not sourced yet; deferred with ESL.'` **Do not assume Primary mirrors Lower Secondary.** Only the durations were sourced for Primary ESL, never which component is which skill, and guessing that `02` is Listening because it is at Lower Secondary is exactly the kind of inference this file exists to prevent.
- **Every other component** is `mockable: true`, English included — English Reading and Writing genuinely can be mocked; it simply is not this phase's work.

What ships this phase is a separate, explicit list:

```ts
/**
 * Subjects built this phase. Deliberately not derived from `mockable`:
 * a component that cannot ever be mocked (ESL Listening needs audio) and one
 * that simply is not built yet (English) are different facts, and a learner
 * deserves the real reason for each.
 */
export const BETA_SUBJECTS = ['Mathematics', 'Science'] as const
```

and `buildableSubjects(programme)` returns subjects that are in `BETA_SUBJECTS` **and** have at least one mockable component.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/cambridge-checkpoint`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/cambridge-checkpoint.ts lib/cambridge-checkpoint.test.ts
git commit -m "feat(exam): the Cambridge Checkpoint syllabus, from the source

Codes, components and durations off Cambridge's own May 2026 timetable.
All eight subjects recorded even though two ship first, because a code
belongs in one correct place — and the revision sites have 0861 as
English as a Second Language, which it is not.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Tagging a question to a strand

The subtopic tagger round-robins when keyword overlap finds nothing, and records which it did on `q.topic_label_matched` — "an assignment, not a finding", as its own comment says. The strand tagger keeps that distinction, because for Checkpoint the breakdown *is* the product: reporting an assignment as a strand finding would make the report quietly wrong while looking right.

**Files:**
- Create: `lib/checkpoint-strands.ts`
- Test: `lib/checkpoint-strands.test.ts`

**Interfaces:**
- Consumes: `tagTokens` (Task 1); `CheckpointSubject` (Task 2).
- Produces:
  - `interface StrandTag { strand: string; matched: boolean }`
  - `function tagQuestionToStrand(question: unknown, strands: string[]): StrandTag | null`
  - `function tagQuestionsWithStrands(questions: unknown[], subject: CheckpointSubject): void` — writes `strand` and `strand_matched` onto each question in place, matching how `tagQuestionsWithSubtopics` writes `subtopic_id`

- [ ] **Step 1: Write the failing test**

```ts
// lib/checkpoint-strands.test.ts
import { describe, it, expect } from 'vitest'
import { tagQuestionToStrand, tagQuestionsWithStrands } from './checkpoint-strands'
import { checkpointSubject } from './cambridge-checkpoint'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

describe('tagQuestionToStrand', () => {
  it('matches a question to the strand its words belong to', () => {
    const tag = tagQuestionToStrand(
      { question: 'Describe how a chemical reaction changes the substances involved.' },
      SCIENCE.strands,
    )
    expect(tag).toEqual({ strand: 'Chemistry', matched: true })
  })

  it('reads the options and explanation too, not just the stem', () => {
    const tag = tagQuestionToStrand(
      { question: 'Which is correct?', options: ['A biology cell'], explanation: 'Cells are biology.' },
      SCIENCE.strands,
    )
    expect(tag?.strand).toBe('Biology')
  })

  it('says so when nothing matches, rather than picking one', () => {
    // The report counts only real matches. A fallback here would score a
    // strand the question may have nothing to do with.
    const tag = tagQuestionToStrand({ question: 'What is 2 + 2?' }, SCIENCE.strands)
    expect(tag?.matched).toBe(false)
  })

  it('returns null when there are no strands to match against', () => {
    expect(tagQuestionToStrand({ question: 'Anything.' }, [])).toBeNull()
  })

  it('never throws on whatever the generator produced', () => {
    expect(() => tagQuestionToStrand(null, SCIENCE.strands)).not.toThrow()
    expect(() => tagQuestionToStrand({ question: 42 }, SCIENCE.strands)).not.toThrow()
    expect(() => tagQuestionToStrand({ options: 'not an array' }, SCIENCE.strands)).not.toThrow()
  })
})

describe('tagQuestionsWithStrands', () => {
  it('writes the strand and whether it was matched onto every question', () => {
    const questions: any[] = [
      { question: 'Explain how a plant cell differs from an animal cell in biology.' },
      { question: 'What is 2 + 2?' },
    ]
    tagQuestionsWithStrands(questions, SCIENCE)
    expect(questions[0].strand).toBe('Biology')
    expect(questions[0].strand_matched).toBe(true)
    expect(questions[1].strand_matched).toBe(false)
  })

  it('never tags a strand from another subject', () => {
    const questions: any[] = [{ question: 'Describe an algebra expression and its statistics.' }]
    tagQuestionsWithStrands(questions, SCIENCE)
    expect(SCIENCE.strands).toContain(questions[0].strand)
  })

  it('can tag to the cross-cutting strand where the subject has one', () => {
    // "Thinking and Working Mathematically" runs through the content strands,
    // so a question can be tagged to it even though it is not one of them.
    const maths = checkpointSubject('lower-secondary', 'Mathematics')!
    const questions: any[] = [
      { question: 'Explain your thinking and justify the conjecture mathematically.' },
    ]
    tagQuestionsWithStrands(questions, maths)
    expect([...maths.strands, maths.crossCuttingStrand]).toContain(questions[0].strand)
  })

  it('leaves an empty paper alone', () => {
    expect(() => tagQuestionsWithStrands([], SCIENCE)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/checkpoint-strands`
Expected: FAIL with `Failed to resolve import "./checkpoint-strands"`.

- [ ] **Step 3: Write `lib/checkpoint-strands.ts`**

Score each candidate strand by counting shared tokens between `tagTokens(strandName)` and `tagTokens(questionText)`, where question text is the stem plus options plus explanation, guarded so a non-string or non-array field cannot throw. The candidate list is `subject.strands` plus `subject.crossCuttingStrand` when present.

Highest score wins with `matched: true`. A score of zero returns the **first** strand with `matched: false` — a placeholder so the field is always populated for scoring, never a claim. Say in a comment that the report must read `strand_matched`, and why: an assignment shown as a finding is the fault this distinction exists to prevent.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/checkpoint-strands`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/checkpoint-strands.ts lib/checkpoint-strands.test.ts
git commit -m "feat(exam): tag a Checkpoint question to a strand, and admit when it is a guess

The subtopic tagger already separates a keyword hit from a fallback
assignment. Checkpoint keeps that separation, because the strand
breakdown is the product and an assignment reported as a finding is
wrong in a way that looks right.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The strand report

What makes this Checkpoint rather than Checkpoint-flavoured practice. Cambridge reports 0–50 at strand level; a strand nobody was asked about reads "not assessed in this paper", never zero.

**Files:**
- Create: `lib/checkpoint-report.ts`
- Test: `lib/checkpoint-report.test.ts`

**Interfaces:**
- Consumes: `CheckpointSubject` (Task 2); questions carrying `strand` and `strand_matched` (Task 3).
- Produces:
  - `interface StrandResult { strand: string; assessed: boolean; correct: number; total: number }`
  - `interface CheckpointResult { score: number; outOf: 50; strands: StrandResult[]; weakest: string | null }`
  - `function checkpointReport(questions: unknown[], answers: boolean[], subject: CheckpointSubject): CheckpointResult`

- [ ] **Step 1: Write the failing test**

```ts
// lib/checkpoint-report.test.ts
import { describe, it, expect } from 'vitest'
import { checkpointReport } from './checkpoint-report'
import { checkpointSubject } from './cambridge-checkpoint'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

const q = (strand: string, matched = true) => ({ strand, strand_matched: matched })

describe('checkpointReport', () => {
  it('scores on the 0-50 scale Cambridge publishes', () => {
    const questions = [q('Biology'), q('Biology'), q('Chemistry'), q('Chemistry')]
    const report = checkpointReport(questions, [true, true, true, false], SCIENCE)
    expect(report.outOf).toBe(50)
    expect(report.score).toBe(38)   // 3/4 of 50, rounded
  })

  it('reports a strand nobody was asked about as not assessed, never zero', () => {
    // Scoring a strand that had no questions is the same class of lie as a
    // citation that is not true — it reads as a finding and is not one.
    const report = checkpointReport([q('Biology')], [true], SCIENCE)
    const physics = report.strands.find((s) => s.strand === 'Physics')!
    expect(physics.assessed).toBe(false)
    expect(physics.total).toBe(0)
  })

  it('counts a question toward a strand only when the tag was a real match', () => {
    const questions = [q('Biology', true), q('Physics', false)]
    const report = checkpointReport(questions, [true, false], SCIENCE)
    expect(report.strands.find((s) => s.strand === 'Biology')!.total).toBe(1)
    expect(report.strands.find((s) => s.strand === 'Physics')!.assessed).toBe(false)
  })

  it('still scores an unmatched question overall, because the learner answered it', () => {
    // The tag is uncertain; the answer is not. Dropping it from the total
    // would understate what they actually did.
    const report = checkpointReport([q('Biology', false)], [true], SCIENCE)
    expect(report.score).toBe(50)
  })

  it('names the weakest assessed strand', () => {
    const questions = [q('Biology'), q('Chemistry'), q('Chemistry')]
    const report = checkpointReport(questions, [true, false, false], SCIENCE)
    expect(report.weakest).toBe('Chemistry')
  })

  it('names no weakest strand when nothing was assessed', () => {
    const report = checkpointReport([q('Biology', false)], [true], SCIENCE)
    expect(report.weakest).toBeNull()
  })

  it('lists every strand of the subject, assessed or not', () => {
    const report = checkpointReport([q('Biology')], [true], SCIENCE)
    expect(report.strands.map((s) => s.strand)).toEqual(SCIENCE.strands)
  })

  it('survives a paper with no questions', () => {
    const report = checkpointReport([], [], SCIENCE)
    expect(report.score).toBe(0)
    expect(report.weakest).toBeNull()
    expect(report.strands.every((s) => !s.assessed)).toBe(true)
  })

  it('never throws when answers and questions disagree in length', () => {
    expect(() => checkpointReport([q('Biology'), q('Physics')], [true], SCIENCE)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/checkpoint-report`
Expected: FAIL with `Failed to resolve import "./checkpoint-report"`.

- [ ] **Step 3: Write `lib/checkpoint-report.ts`**

`score` is `Math.round((correct / answered) * 50)` over every answered question, matched or not — the tag is uncertain, the answer is not. A paper with no questions scores 0 rather than dividing by zero.

`strands` lists `subject.strands` in order, always all of them. A strand's `correct`/`total` count only questions whose `strand_matched` is true; `assessed` is `total > 0`. `weakest` is the assessed strand with the lowest `correct / total`, or `null` when none were assessed. An answers array shorter than the questions array treats the missing entries as unanswered rather than throwing.

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/checkpoint-report`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/checkpoint-report.ts lib/checkpoint-report.test.ts
git commit -m "feat(exam): a Checkpoint result reads by strand, like the real one

Cambridge reports 0-50 at strand level, which is why a missed paper
cannot be made up. A strand nobody was asked about reads not assessed
rather than zero — scoring one is the same class of lie as a citation
that is not true.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The Checkpoint path in the form

`ExamPrepForm` has `type ExamType = 'waec' | 'jamb'`. Checkpoint joins it, but asks a different question: programme, then subject, then component — and takes the duration from the syllabus, never from the form.

**Files:**
- Modify: `components/ExamPrepForm.tsx`

**Interfaces:**
- Consumes: `CHECKPOINT_SUBJECTS`, `checkpointSubject`, `buildableSubjects`, `stageOf` (Task 2).
- Produces: no new exports. Generation goes through the existing `/api/generate-assessment` call the form already makes.

- [ ] **Step 1: Widen the exam type and add the card**

Change `type ExamType = 'waec' | 'jamb'` to `type ExamType = 'waec' | 'jamb' | 'checkpoint'`, and add a third card beside the WAEC and JAMB ones at the existing exam picker (around line 199), following their shape exactly:

```tsx
{ id: 'checkpoint' as const, label: 'Cambridge Checkpoint', desc: 'Primary and Lower Secondary practice papers', icon: BookOpen },
```

- [ ] **Step 2: Add the programme, subject and component state**

```tsx
const [programme, setProgramme] = useState<'primary' | 'lower-secondary'>('lower-secondary')
const [checkpointSubjectName, setCheckpointSubjectName] = useState('')
const [component, setComponent] = useState('')
```

The subject list comes from `buildableSubjects(programme)` — so a subject with nothing mockable never appears as a choice. The component list comes from the chosen subject's `components.filter((c) => c.mockable)`.

Render the unbuildable components as disabled entries showing their `notMockableReason`, rather than omitting them. A learner looking for ESL Listening should learn why it is not there, not conclude the product forgot it.

- [ ] **Step 3: Send the Checkpoint context to the generator**

Where the form builds its request (around line 142), add the Checkpoint branch. The subject is the Checkpoint subject name; `style` and `className` name the real exam; the duration comes from the component:

```tsx
const cpSubject = exam === 'checkpoint'
  ? checkpointSubject(programme, checkpointSubjectName)
  : undefined
const cpComponent = cpSubject?.components.find((c) => c.number === component)
```

```tsx
style: exam === 'checkpoint'
  ? `Cambridge ${programme === 'primary' ? 'Primary' : 'Lower Secondary'} Checkpoint ${cpSubject!.code}/${component} practice`
  : /* existing waec/jamb expression unchanged */,
className: exam === 'checkpoint' ? `Stage ${stageOf(programme)}` : /* existing */,
```

Pass the duration through as the assessment's time, and add the strand list to the context string so the generator spreads questions across strands rather than dwelling on one:

```tsx
exam === 'checkpoint'
  ? `Cambridge ${cpSubject!.name} ${cpSubject!.code}, component ${component}, ${cpComponent!.minutes} minutes. Spread the questions across these strands: ${[...cpSubject!.strands, cpSubject!.crossCuttingStrand].filter(Boolean).join(', ')}. Write original questions against the published Cambridge curriculum — never reproduce a real Checkpoint question.`
  : '',
```

- [ ] **Step 4: Gate the submit button**

Checkpoint cannot submit until a programme, a subject and a component are chosen. Extend the existing step/validity expression (around line 99) so the button stays disabled until all three are set, in the same style as the WAEC and JAMB branches.

- [ ] **Step 5: Type check and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both PASS at 123 files and the test count Tasks 1-4 left it at. The form has no unit tests — it is a React component and vitest here is node-only, so **do not add a `.test.tsx`**. It is verified in the browser in Task 6.

- [ ] **Step 6: Commit**

```bash
git add components/ExamPrepForm.tsx
git commit -m "feat(exam): a Cambridge Checkpoint path beside WAEC and JAMB

Programme, then subject, then component — and the duration comes from
the syllabus rather than the form. A component that cannot be mocked is
shown with its reason rather than quietly missing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Prove it against a real model, and in a browser

Mocked tests prove the wiring. Whether the generator actually spreads a paper across strands is invisible to them — and the strand breakdown is the product.

**Files:**
- Create: `scripts/live/liveCheckpointStrands.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing importable.

- [ ] **Step 1: Write the live test**

```ts
/**
 * Does a generated Checkpoint component actually spread across strands?
 *
 * Run with: npx vitest run --config vitest.live.config.ts liveCheckpointStrands
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'

// No dotenv in this project; the .env is a flat KEY=value file.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

import { checkpointSubject } from '@/lib/cambridge-checkpoint'
import { tagQuestionsWithStrands } from '@/lib/checkpoint-strands'
import { checkpointReport } from '@/lib/checkpoint-report'

const SCIENCE = checkpointSubject('lower-secondary', 'Science')!

describe('a generated Lower Secondary Science component', () => {
  it('spreads across strands instead of dwelling on one', async () => {
    const res = await fetch('http://localhost:3000/api/generate-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Science',
        topics: SCIENCE.strands,
        count: 12,
        questionType: 'mcq',
        style: `Cambridge Lower Secondary Checkpoint ${SCIENCE.code}/01 practice`,
        className: 'Stage 9',
        grade: 9,
      }),
    })
    const json = await res.json()
    const questions = json?.questions ?? []
    expect(questions.length, 'no questions came back').toBeGreaterThan(0)

    tagQuestionsWithStrands(questions, SCIENCE)
    const report = checkpointReport(questions, questions.map(() => true), SCIENCE)

    console.log(`\n${questions.length} questions, ${SCIENCE.code}/01`)
    report.strands.forEach((s) =>
      console.log(`  ${s.assessed ? `${s.total} q` : 'not assessed'}  ${s.strand}`),
    )
    const matched = questions.filter((q: any) => q.strand_matched).length
    console.log(`  matched to a strand: ${matched}/${questions.length}`)

    // The fault this exists to catch: every question landing in one strand,
    // which makes the breakdown that is the product say nothing.
    const assessed = report.strands.filter((s) => s.assessed)
    expect(assessed.length, 'the whole paper landed in one strand').toBeGreaterThan(1)
    // And a paper where nothing matched would report entirely "not assessed".
    expect(matched, 'no question matched any strand').toBeGreaterThan(questions.length / 3)
  }, 300_000)
})
```

- [ ] **Step 2: Run it**

Start the dev server (`npx next dev`), then:

Run: `npx vitest run --config vitest.live.config.ts liveCheckpointStrands`
Expected: PASS.

If the whole paper lands in one strand, the fix is the strand list in Task 5's context string, not the assertion. Do not weaken the assertion — it is the only thing that checks the product actually works.

- [ ] **Step 3: Verify the path in a browser**

With the dev server running, launch an isolated Chrome — its own throwaway profile and a non-default port, and shut down only the PID you started. **Never `taskkill` a browser.**

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --user-data-dir="C:/Users/Stephen/AppData/Local/Temp/claude-chrome-checkpoint" --remote-debugging-port=9333 "http://localhost:3000/exam-prep"
```

Confirm: the Cambridge Checkpoint card appears beside WAEC and JAMB; choosing it asks programme → subject → component; only Maths and Science are offered; ESL Listening is visible but disabled with its reason; the duration shown matches the syllabus (Lower Secondary Science `01` is 45 minutes); and a generated paper ends on a strand breakdown where an unasked strand reads "not assessed".

- [ ] **Step 4: Commit**

```bash
git add scripts/live/liveCheckpointStrands.test.ts
git commit -m "test(exam): does a Checkpoint paper actually spread across strands

Mocked tests prove the wiring; only a real call proves the breakdown
says anything. Asserts more than one strand is assessed, because the
failure that matters is a whole paper landing in one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## What this leaves

- **English**, Reading and Writing only — the next cut. Its components are already recorded with `mockable: false` and a reason, so enabling it is data plus generation, not new structure.
- **ESL** — until Listening can be done with audio.
- **Real papers.** When they arrive, their text enters through `generate-assessment`'s existing `sourceText` / `sourceName` path and their figures through `lib/exam-source-images.ts`, whose `examFromCurriculum` currently returns `'waec' | 'jamb' | null` and needs widening. The feature's shape does not change.
- **Raw mark totals per paper**, which Cambridge does not publish and which no revision site is a source for. The report uses the 0–50 reporting scale Cambridge does publish.
