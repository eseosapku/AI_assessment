# A Cambridge Checkpoint path in exam prep

**Status:** designed, not built — **beta scope**
**Date:** 2026-09-14

## Why Checkpoint

Exam prep today is Nigeria-shaped: WAEC and JAMB, with NERDC behind them. Both
are national. Cambridge Checkpoint is the one assessment in this space that
cuts across every country StudySquare serves, and it feeds directly into IGCSE,
which the platform already has textbooks and figures for.

## What Checkpoint actually is

Everything in this section comes from Cambridge International's own published
material, not from revision sites. It matters that it is right: the whole value
of this path is that it matches the real thing.

**Two programmes, not one.**

*Cambridge Primary Checkpoint* — taken at the end of Stage 6:

| Subject | Code | Components | Duration each |
|---|---|---|---|
| English (Primary) | `0058` | `/01`, `/02` | 1h |
| English as a Second Language (Primary) | `0057` | `/01`, `/02`, `/03` | 35m, 25m, 35m |
| Mathematics (Primary) | `0096` | `/01`, `/02` | 45m |
| Science (Primary) | `0097` | `/01`, `/02` | 35m |

*Cambridge Lower Secondary Checkpoint* — taken at the end of Stage 9:

| Subject | Code | Components | Duration each |
|---|---|---|---|
| English (Lower Secondary) | `0861` | `/01`, `/02` | 1h 10m |
| English as a Second Language (Lower Secondary) | `0876` | `/01`, `/02`, `/03` | 45m, 35m, 40m |
| Mathematics (Lower Secondary) | `0862` | `/01`, `/02` | 1h |
| Science (Lower Secondary) | `0893` | `/01`, `/02` | 45m |

Source: Cambridge's *Final Test Series Timetable May 2026*. Note that several
third-party sites state `0861` is English as a Second Language. **It is not** —
`0861` is English and `0876` is ESL, per Cambridge's own timetable. A revision
site is not a source for this file.

**Three test series from 2026:** March (2–12), May (11–21), October (mid-month).

**Results are reported on a 0–50 scale within performance bands, at strand and
sub-strand level as well as subject level.** Cambridge's own FAQ explains why a
missed paper cannot be made up: to score the Science *biology* strand they need
every biology-targeting question across **both** papers.

That last point is the whole design. A Checkpoint practice path whose output is
a single percentage is not Checkpoint. The real thing tells a school which
strand is weak.

**Global Perspectives Checkpoint is coursework** — a learner-produced research
report, available in May and October but not March. It is not a timed paper and
this path does not attempt it.

### The strands

| Subject | Strands |
|---|---|
| Mathematics | Number · Algebra, Geometry and Measure · Statistics and Probability, with **Thinking and Working Mathematically** cutting across all three |
| Science | Biology · Chemistry · Physics · Earth and Space · Thinking and Working Scientifically · Science in Context |
| English | Reading · Writing · Speaking · Listening |
| English as a Second Language | `/01` Reading and Usage · `/02` Listening · `/03` Writing |

## Scope, and the constraint that sets it

**Not every strand can be mocked honestly in a system that produces text and
figures.** That decides the build order rather than being discovered halfway:

- **Mathematics and Science — fully mockable.** Every strand is assessable on
  paper, both are figure-heavy, and both have the most to say at strand level.
  **These ship first, both stages.**
- **English — Reading and Writing only, and that is still faithful.** Speaking
  and Listening are not in the two written Checkpoint papers either, so a mock
  covering Reading and Writing matches what the real papers assess. Second cut.
- **English as a Second Language — deferred.** `0876/02` is Listening and needs
  audio. A "Checkpoint ESL mock" that silently omits a third of the real exam
  reads as legitimate and is not, which is worse than not shipping it.

## What gets built

Three pieces, each following a precedent already in the repo.

### 1. The syllabus module

`lib/cambridge-checkpoint.ts`, shaped like `lib/nigeria-exam-syllabi.ts`: the
two programmes, their subjects, syllabus codes, component numbers, durations,
and the strand list per subject — every fact in the section above, with the
source named in the file header.

This is the file that makes the path legitimate rather than invented, so it is
data, not prose, and nothing else hard-codes a code or a duration.

```ts
export type CheckpointProgramme = 'primary' | 'lower-secondary'

export interface CheckpointComponent {
  /** As printed: "01", "02", "03". */
  number: string
  /** What this component assesses, where Cambridge names it. */
  name?: string
  minutes: number
  /**
   * False where this component cannot be mocked in text and figures.
   *
   * Per component, not per subject: ESL `/01` Reading and `/03` Writing are
   * perfectly mockable while `/02` Listening needs audio. A subject-level flag
   * would force an all-or-nothing that the real exam does not have.
   */
  mockable: boolean
  /** Why not, when `mockable` is false. Shown to the learner, never hidden. */
  notMockableReason?: string
}

export interface CheckpointSubject {
  programme: CheckpointProgramme
  name: string
  /** Cambridge syllabus code: "0862". */
  code: string
  components: CheckpointComponent[]
  strands: string[]
  /** A strand that cuts across the others rather than sitting beside them. */
  crossCuttingStrand?: string
}

/**
 * The stage a programme is assessed at, derived rather than stored.
 *
 * Primary Checkpoint is end-of-Stage-6 and Lower Secondary is end-of-Stage-9 by
 * definition, so carrying both a programme and a stage on every subject is two
 * facts that can disagree.
 */
export function stageOf(programme: CheckpointProgramme): 6 | 9 {
  return programme === 'primary' ? 6 : 9
}
```

### 2. A third exam type

`ExamPrepForm` currently has `type ExamType = 'waec' | 'jamb'`. Checkpoint joins
it, but produces something different: where WAEC and JAMB generate one question
set, Checkpoint generates a **component** — Paper 1 or Paper 2 at the real
duration, with every question tagged to a strand.

The form asks, in order: programme (Primary / Lower Secondary) → subject →
component. Duration comes from the syllabus module, never from the form.

### 3. The strand report

Questions already carry `subtopic_id` and a readable counterpart, and the review
page already groups a finished paper by it — see
`app/api/generate-assessment/route.ts:102-138`. Strands ride that existing rail
rather than adding a parallel one.

After a component, the learner sees a score **out of 50, matching Cambridge's
reporting scale**, and underneath it a per-strand breakdown naming the weakest
strand. That is what the real Checkpoint reports to a school, and it is already
the shape StudySquare's gap map consumes.

## Where the real papers plug in later

This is beta. Questions are generated against the public syllabus, and figures
come from the existing textbook-vision catalogue. Real Checkpoint papers will
be supplied later to sharpen it, so the places they enter must be seams rather
than assumptions spread through the code. Both already exist:

- **Paper text** goes through `generate-assessment`'s existing `sourceText` /
  `sourceName` path, which already carries the SOURCE RULES that forbid citing a
  page number or figure the learner cannot see.
- **Paper figures** go through `lib/exam-source-images.ts`
  (`matchQuestionToImage`, `attachSourceImages`). Its `examFromCurriculum`
  currently returns `'waec' | 'jamb' | null`; Checkpoint means widening that
  union and adding a manifest entry. Nothing else changes.

So the beta path and the polished path differ by which source the questions are
generated from, not by how the feature is shaped.

**Cambridge past papers and their figures are copyrighted.** This path matches
the public syllabus, component structure, durations and strand model. It
generates original questions and uses the platform's own figures. It does not
reproduce Cambridge questions or lift Cambridge diagrams, in beta or after.

## Error handling

- **A component that cannot be mocked** (ESL `/02` Listening) is shown with its
  `notMockableReason`, not hidden and not silently degraded. Its siblings stay
  selectable: a learner can sit ESL Reading without being told the whole subject
  is unavailable.
- **A strand with no questions in a generated component** is reported as "not
  assessed in this paper" rather than as zero. Scoring a strand nobody was asked
  about is the same class of lie as a citation that is not true.
- **Figure coverage is thin for some stages.** Where the catalogue has no
  suitable figure, the question is text-only — never a question referring to a
  figure that is not there. `dropDanglingReferences` and `repairBookReferences`
  already enforce this and apply unchanged.

## Testing

vitest is node-environment only here — no jsdom, and no `.test.tsx`.

- **The syllabus module** carries its own tests: every subject has at least one
  component; every duration is positive; codes match the four-digit format;
  every non-mockable component states a reason; `stageOf` agrees with the
  programme on every subject. These are cheap and they are what stops a typo
  becoming a wrong exam.
- **Strand tagging**: a generated component assigns every question a strand from
  its subject's list and never one from another subject's.
- **The report**: a strand with no questions reads "not assessed", not 0.
- **Live**: one `scripts/live/` test generating a real Lower Secondary Science
  component and asserting the strand spread is not degenerate — all six strands
  should not collapse onto one.

## What this deliberately does not do

- **Global Perspectives** — coursework, not a paper.
- **ESL** — until Listening can be done with audio.
- **Speaking and Listening in English** — not in the written papers either.
- **Raw mark totals per paper.** Cambridge publishes the 0–50 *reporting* scale,
  which is not a paper's raw total, and no authoritative source for raw totals
  was found. The report is scored on the 0–50 scale Cambridge actually
  publishes; raw totals get set from a specimen paper when one is to hand.

## Known limits

- **The path is only as good as the figure catalogue's Stage 6 and Stage 9
  coverage.** Checkpoint Maths and Science lean on diagrams heavily and
  Cambridge's cannot be used. Worth measuring before promising the feature.
- **Strand tagging is a model judgement.** The existing subtopic tagger
  round-robins when nothing matches, which would put a question in an arbitrary
  strand. For Checkpoint that is worse than elsewhere, because the strand
  breakdown is the product. The tagger must refuse rather than round-robin here.
