# StudySquare — Usability & WCAG Action Plan

Merges the three-tester usability report with a code-level audit run on
2026-08-11. Every claim below is measured against the current `aws_deploy`
code, not inferred from the report.

The headline: most of the accessibility failures are **not** dozens of separate
component mistakes. They are four systemic causes. Fixing those four removes
the large majority of the WAVE errors at once.

---

## Part 0 — What the audit found that the report did not

The testers reported symptoms. These are the causes underneath them.

### 0.1 The colour tokens themselves fail AA in light mode

Measured contrast against WCAG 2.1 AA (4.5:1 normal text, 3:1 large):

| Token pair | Ratio | Normal | Large |
|---|---|---|---|
| `--ss-slate` on panel (#7e8a96 / #fff) | **3.52** | FAIL | pass |
| `--ss-slate` on chip | **3.27** | FAIL | pass |
| `--ss-accent` on white (#0e8fd1) | **3.58** | FAIL | pass |
| `text-gray-400` on white | **2.54** | FAIL | **FAIL** |
| white on `--ss-accent` (every primary button) | **3.58** | FAIL | pass |
| white on `--ss-good` | **2.62** | FAIL | **FAIL** |
| white on `--ss-warn` | **2.01** | FAIL | **FAIL** |
| white on `--ss-bad` | **3.27** | FAIL | pass |

`--ss-slate` is the secondary text colour used across the entire product, and
`--ss-accent` is every link, label and primary button. **Dark mode passes** —
this is purely a light-theme palette problem.

This is why WAVE reports 17 contrast errors on a near-empty dashboard and 45 in
the quiz modal. It is one fix, not 45.

### 0.2 MCQ options are buttons, not radios — this is the "reads as enabled" bug

`app/assessment/page.tsx` renders each option as `<motion.button>`. There is no
`role="radiogroup"`, no `role="radio"`, no `aria-checked`. **The selected state
is conveyed only visually** — a filled circle and a `<Check>` SVG with no label.

A screen-reader user cannot tell which option they have selected. That is a
WCAG 4.1.2 (Name, Role, Value) failure on the single most important screen in
the product, and it matches Tester 3's report exactly.

### 0.3 Ten modal surfaces have no dialog semantics

None of these declare `role="dialog"`, `aria-modal`, a focus trap, Escape-to-close,
or focus restore on close:

`AuthModal`, `FlowForm`, `ProfileSidebar`, `NotificationBell`, `StudioPrimitives`,
`PaletteToolbar`, `StudyLabHub`, `SubscribeModal`, `classrooms/[id]`, `assessment`.

This is why "some modals aren't picked up at all by accessibility functions": to
an assistive tool they are just `div`s, and focus stays behind them on the page
underneath.

### 0.4 Free-topic mode doesn't know the curriculum exists

"Stories of Use" is a real Cambridge topic. Typed into *Quiz me on anything*, it
is expanded **from the model's general knowledge**, which guessed literature and
drifted to poems. The curriculum database is never consulted, so a topic that
exists as real syllabus content gets hallucinated scope instead.

### 0.5 My own duplicate-dropping makes U2 worse — disclosure

The report's U2 ("asked for 10 questions, got fewer") is real, and the clean-up
I shipped on 2026-08-10 **adds to it**: it drops duplicate and contradictory
questions without replacing them. Measured: 10 requested → 7–8 returned. This
plan must add a top-up pass, not just filtering.

---

## Part 1 — Accessibility (blocks users; do first)

### A1. Retune the light palette to AA *(systemic — clears most WAVE errors)*
Replace the failing tokens. Values computed to hit 4.5:1 on white while staying
on-brand:

- `--ss-slate` `#7e8a96` → `#6c7781` (4.57:1)
- `--ss-accent` `#0e8fd1` → `#0c7cb6` (4.59:1) — keep `#0e8fd1` for large
  headings and non-text UI, where 3:1 is the bar
- Ban `text-gray-400` for text (2.54:1 fails even large); map to `--ss-slate`
- **Status fills**: darkening `--ss-warn` to `#9a6c28` to carry white text kills
  the brand. Use **ink text on the bright fill** instead — keeps the colour,
  passes AA. Same for `--ss-good`.
- Add a CI check: a test that asserts every token pair meets AA, so this cannot
  regress silently.

### A2. Fix the MCQ answer semantics
Convert options to a real radio group: `role="radiogroup"` + `aria-labelledby`
on the container, `role="radio"` + `aria-checked` per option, arrow-key
navigation, and a text equivalent for the selected state. Apply the same
treatment to the interactive question types.

### A3. Give every modal real dialog semantics
One shared `<Modal>` primitive: `role="dialog"`, `aria-modal="true"`,
`aria-labelledby`, focus trap, Escape to close, focus restored to the trigger,
and background `inert`. Migrate all ten surfaces onto it.

### A4. Sub-12px text
279 occurrences across 62 files (`text-[10px]` ×144, `text-[11px]` ×102,
`text-[9px]` ×6). Establish a floor: **12px minimum for body/label text**,
11px only for non-essential decorative labels with an accessible alternative.
Raise the wizard's 18 instances first — that screen scored 3.6/10.

### A5. Empty button
`FlowForm` line ~1048: close button contains only an `<X>` icon, no label.
Add `aria-label="Close"`. Sweep for other icon-only buttons repo-wide.

### A6. Maths and symbols for screen readers
KaTeX emits MathML, but the surrounding stems and standalone symbols are
unlabelled. Add a symbol→speech map (`÷` → "divided by", `√` → "square root of",
`≥` → "greater than or equal to") and verify with NVDA.

### A7. Structure and focus
Skip-to-content link, correct landmark roles, visible focus rings that meet 3:1,
logical focus order through the wizard steps.

### A8. Accessibility settings panel
User-facing toggles: high contrast, larger text, reduced motion. Surfaced in
Settings and linked from the footer.

---

## Part 2 — Question quality

### B1. Stricter image-based questions *(from the rainfall screenshot)*
That question fails four ways at once: it calls a photo "a map"; it **describes
the image in words**, making the image redundant; it **states the answer in the
stem** ("during a rainfall… rain is visible as streaks"); and the options are
trivially guessable.

New contract — the question must be **unanswerable without looking at the image**:
- The stem may refer to the figure ("In the photograph…") but must **not
  describe its contents**.
- The stem must **not contain the answer** or its synonyms — validated
  automatically by checking stem tokens against the correct option.
- The figure type must be named correctly (photograph / diagram / map / graph);
  validate against the catalogue's `visionType` rather than trusting the model.
- Reject a question where the correct option's key words appear in the stem.
- Prefer "read a value / identify a labelled part / compare two regions" over
  "what does this show".

### B1b. A model pass for "does this question actually need its figure?"
Raised on 2026-08-17 after B1 shipped. The heuristics now catch a stem that
narrates its figure, misnames it, or restates the answer — measurable faults.
They cannot catch the more common one.

A live neuron paper produced *"Which part of the neuron is responsible for
receiving signals?"* → Dendrites, carrying a diagram. It narrates nothing,
misnames nothing, leaks nothing, and passes every check — yet a student answers
it from memory and never looks at the picture. The figure is decoration.

Judging that needs semantics, not string matching. Options:

1. **A scoring pass** — one cheap call per paper asking, per illustrated
   question, "could this be answered without seeing the figure?" Questions
   scored answerable-without lose their image (never the question). Costs one
   extra call per generation; reuses the existing Nova Lite path.
2. **Generate against the figure** — write illustrated questions *from* the
   figure's vision description in a separate step, rather than writing questions
   and attaching pictures afterwards. Slower and a bigger change, but attacks
   the cause: figures are currently matched to questions, not the reverse.
3. **Accept supporting figures** — decide that a figure aiding recall is fine,
   and say so in the copy rather than implying every image is load-bearing.

### B1c. The figure often contains the answer

Raised 2026-08-18, and it changes the recommendation above. Measured against
the manifest: **5,491 of 10,001 described figures (55%) carry visible labels.**

A fully labelled diagram makes identification worthless. "Which part carries
the impulse away from the cell body?" against a neuron diagram with *Axon*
printed on it is a find-the-word exercise, not a test of knowledge — and it
passes every check in B1, because the stem neither narrates the figure nor
restates the answer. The answer is in the picture.

The distinction that matters is how a figure is keyed:

- **Word-labelled** (parts named in the image): naming questions are reading
  comprehension. Ask instead for what the labels do not give away — function,
  relationship, sequence, comparison, prediction, cause and effect. *"Which
  structure would be affected first if the myelin sheath degraded?"*
- **Letter- or number-keyed** (A/B/C pointing at unnamed parts): identification
  is legitimate and good, because the student must supply the name.
- **Unlabelled**: identification and description both work.

This is a property of the figure, known before any question is written, and
the vision descriptions already record it. So it is a routing decision, not
another checking pass: classify the figure, then ask the model for the kind of
question that figure can honestly support.

That also settles the choice above. A scoring pass (1) can only reject what has
already been written, and cannot see this at all. Generating from the figure (2)
is the only option that can act on how the figure is keyed, and it costs nothing
recurring because it folds into a call that already happens.

Revised recommendation: **(2), with figure classification driving the question
type.** Fall back to (3) only if generating from figures proves unreliable. (3) is the
honest fallback if neither earns its cost.

Whichever is chosen, the decision belongs in the product's own words: if figures
are supporting rather than required, the interface should not imply otherwise.

### B2. Deliver the requested number of questions
Add a top-up pass: after dedupe and contradiction filtering, if the paper is
short, request replacements for the dropped slots and re-filter. Cap the retry
so a pathological topic can't loop. Also investigate the beginner/low-grade pool
that produces the shortfall in the first place.

### B3. Ground free topics in the curriculum
Before expanding a typed topic, search the topics/subtopics tables. On a strong
match, offer: *"'Stories of Use' is a topic in Cambridge English — use the
syllabus version?"* with the free-form path still available. This makes the
feature stronger precisely where it currently fails.

### B4. State the limits plainly
A short "what this can and can't do" note in the custom-topic step: it works
from general knowledge, it isn't tied to your syllabus unless matched, and very
niche topics may return fewer questions.

---

## Part 3 — Taking a quiz

### C1. Flag unanswered questions *(U1)*
Per the report: the question-number strip shows **grey for not-yet-visited**,
**red for visited-but-unanswered**, and a red "unanswered" banner on submit
listing the offending numbers as jump buttons. (The jump-to-question mechanic
already exists in the review screen and can be reused.)

### C2. Teach the interactive question types
They are unfamiliar interaction patterns and currently ship with no instruction:
- A **first-run coached demo** per type — a ghost hand animating one drag or one
  match, dismissible, shown once per type and replayable.
- A persistent **"?" button** on every interactive question opening a short
  how-to for that type.
- A worked **example state** on first encounter, before the real question.
- Matching already gained a standing instruction and progress count on
  2026-08-10; extend that pattern to sort, order, categorise and label.

### C3. Feedback discoverability *(U5 — partly shipped)*
The next-steps panel and sticky Done bar landed on 2026-08-10. Still to do: the
"results are ready" banner and a badge when new feedback exists.

---

## Part 4 — Building a quiz

### D1. Subtopics are missed entirely
Currently a quiet list below topics. Make selection state unmissable: a running
count ("3 of 12 subtopics selected"), select-all/clear, and an explicit empty
state explaining that choosing none covers the whole topic.

### D2. Multi-select isn't legible as multi-select
Topics and subtopics both allow multiple choices but look like single-choice
rows. Use checkbox affordances, not plain rows, and echo the selection back in
the step header.

### D3. A better subject picker
Same problem the gap-map dial had: long textbook names in a flat list. Reuse the
searchable, grouped picker built for the gap map on 2026-08-11.

### D4. Step validation *(U1, creation side)*
Block Continue with an inline reason rather than a dead button, and mark
incomplete steps in the rail.

### D5. "Study area" button clarity
Label the action with what it does, not what it is.

---

## Part 5 — Navigation & onboarding

### E1. First-run coach marks *(N1)*
3–5 steps: Create assessment → LearnSpace → Gap Maps → Progress. Runs once,
replayable from Settings, keyboard navigable and screen-reader friendly.

### E2. Persistent tooltips on primary actions.

### E3. LearnSpace zoom and navigation *(N2)*
Labelled zoom control with +/− and a percentage; replace the hierarchical
canvas navigation with a linear "Section 1 of 5" progression.

---

## Sequencing

**Wave 1 — unblocks users, mostly systemic**
A1 palette · A2 MCQ semantics · A3 modal primitive · A5 empty button · B2
question count · C1 unanswered flagging

**Wave 2 — comprehension**
A4 text sizes · A6 symbols · C2 interactive tutorials · D1/D2 subtopics · B1
image-question contract

**Wave 3 — polish and reach**
A7 structure · A8 settings panel · B3 curriculum grounding · B4 limits · D3
subject picker · D4 validation · E1–E3 onboarding and LearnSpace

Wave 1 is where the WAVE score moves. A1 alone should take the wizard from
3.6/10 to a passing contrast profile.

---

## Part 6 — Found by proactive audit (nobody reported these yet)

Everything above came from testers. Everything below is what the next round of
testing would have raised, or what would have surfaced as a support ticket after
launch. Each is verified against the code.

### F1. Strict mode submits the whole quiz on the first window blur — CRITICAL
`app/assessment/page.tsx` auto-submits on `visibilitychange` **or** `blur`, on
the **first** occurrence, with no warning and no grace period.

Things that fire a blur without any cheating: a screen reader or magnifier
taking focus, an on-screen keyboard opening, a system notification, an
accidental alt-tab, a phone call, a dropped Bluetooth keyboard, clicking the
browser's own address bar. All of them end the student's exam instantly.

**This actively punishes assistive-technology users**, since AT frequently
takes focus. It also can't distinguish blur from cheating.

Fix: warn on the first violation with a visible countdown, submit only after a
configurable threshold, never treat plain `blur` as equivalent to a tab switch,
log violations for the teacher rather than acting unilaterally, and exempt
sessions where an accessibility mode is active.

### F2. Two interactive question types are unusable on touch — CRITICAL
`order` and `categorize` use HTML5 `draggable` / `onDragStart`. HTML5
drag-and-drop **does not fire on mobile browsers**. On a phone or tablet these
questions cannot be answered at all — and the student is still marked on them.

Given the audience, this likely affects a majority of real users. Fix with
pointer events (the pattern already written for the StudyLab activity engine),
plus a tap-to-select / tap-to-place fallback that works for keyboard, touch and
screen readers alike.

### F3. No offline or connection-loss handling anywhere
No `navigator.onLine` check, no retry, no queued submission. A student on a
patchy connection who loses signal mid-submit loses the entire attempt with no
message. For the markets this targets, this is a core reliability gap, not an
edge case.

Fix: detect offline, hold answers locally, retry submission with backoff, and
show honest state ("Saved on this device — will submit when you're back
online"). The paused-state machinery already in the player is most of what this
needs.

### F4. Figure payloads are unbounded on metered connections
10,001 figures, 448 MB total. Median 26 KB is fine — but **24 figures exceed
500 KB and the largest is 7.3 MB**. An assessment can carry up to 12 figures,
and `ExamFigure` now loads them **eagerly** (my change, to fix the "I didn't
know there was an image" complaint). Worst case is several megabytes before the
first question is answered.

Fix: cap and re-encode oversized figures at build time, generate width variants
with `srcset`, keep the first figure eager and lazy-load the rest, and use
explicit dimensions to stop layout shift.

### F5. A student cannot challenge an AI grade — and cannot report a bad question
Long-form answers are marked by a model with no route to dispute the mark, and
there is no way to flag a wrong or nonsensical question anywhere in the product.

Both matter for trust, and both are the cheapest possible source of quality
signal: a "this question looks wrong" control feeds a review queue that would
have surfaced the duplicate-shapes and rainfall-photo problems without a
usability study.

Fix: per-question "Report a problem" with a reason, a "Request another look"
action on written marks, and an admin queue.

### F6. The AI's work is invisible while it happens
Generation can take a minute or more behind a generic spinner: no progress, no
stage, no cancel, no estimate. Users assume it has hung.

Fix: stage the wait honestly ("Finding figures… Writing questions… Checking for
duplicates…"), allow cancel, and state expected duration up front.

### F7. Nothing tells the student where a question came from
No source attribution on generated questions. A student who disagrees has no
way to check, and a teacher has no way to verify alignment. The textbook, page
and topic are already known at generation time and simply aren't surfaced.

### F8. No spend or abuse ceiling on the AI endpoints
Subscription gating exists, but there is no per-user rate limit on generation,
tutoring or grading. One scripted loop can run up an unbounded Bedrock bill.
Add per-user and per-IP limits with a clear 429, plus a daily cap.

### F9. First-run is a wall of zeros
A new account sees 0 tests, 0%, "—" grade, an empty gap map and an empty recall
deck, with no guidance. The single most important moment in the product is its
emptiest screen.

Fix: purposeful empty states that each name the one action that fills them, and
a seeded "try a sample quiz" path so the dashboard is never blank.

### F10. Session expiry mid-quiz is unhandled
Auth is a `localStorage` user object with no expiry handling. If the session
becomes invalid during an attempt, submission fails at the end — after the work
is done. Detect early, warn, and preserve answers through re-authentication.

### F11. Timer has no accommodation *(WCAG 2.2.1, Level A)*
The countdown auto-submits at zero. WCAG 2.2.1 requires that a time limit can be
turned off, adjusted, or extended, unless the timing is essential. For a
practice quiz it is not essential.

Fix: let students extend or disable the timer on self-directed quizzes, let
teachers grant extra time per student on assignments, and warn before expiry
rather than submitting silently.

### F12. Everything is English-only
Rwanda and Nigeria are first-class markets and the UI has no localisation layer,
while the curriculum data is multilingual. Not Wave 1 — but the longer strings
go untranslated, the more expensive this becomes.

### F13. Answers cannot be changed after moving on, and there's no review step
There is no "review your answers" screen before submission — the student
submits blind. Pairs naturally with C1 (unanswered flagging): one final screen
showing every question's state, with jump links.

---

## Part 7 — Copy: say what things do

Raised after the palette and type-scale work landed: the interface was now
legible and still didn't explain itself. Legibility and comprehension are
different problems, and fixing the first exposes the second.

The pattern throughout is copy that names the control instead of its
consequence — "Select student level", "Choose a question style", "Add your own
area" — leaving the student to infer what changes. The quiz wizard has been
rewritten on this principle (2026-08-17); the rest of the product has not.

### C6. Platform-wide copy pass
Each surface, in order of how many students hit it: the assessment player,
results and feedback, the dashboard, Recall, LearnSpace, Gap Maps, Settings.

Rules for the pass, taken from what worked in the wizard:
- **Name the consequence, not the control.** "How hard should it be?" beats
  "Select difficulty", because the student is choosing an outcome.
- **Say what happens if you skip it.** Optional steps must say what the default
  does — "Pick none and the quiz covers the whole topic."
- **Say what a screen is for before showing its contents.** The scope step
  displayed eight pills with no statement that they were already all selected.
- **Describe the experience, not the category.** "Exam style — closest to the
  day itself" beats "Exam Style (Past Papers)".
- **Never let a placeholder be the only label**, and never let it carry
  meaning a screen reader would miss.
- **Empty states name the one action that fills them** (see F9).

This is editorial work, not a find-and-replace: it needs a decision about what
each screen is for before its labels can be rewritten. Budget it as its own
pass rather than folding it into a wave.

---

## Revised sequencing

**Wave 0 — ship-blockers found in audit**
F1 blur auto-submit · F2 touch drag · F3 offline submission · F11 timer
accommodation

These are not polish. Each one currently loses a student's work or excludes a
whole class of user.

**Wave 1 — accessibility and correctness** (as before)
A1 palette · A2 MCQ semantics · A3 modal primitive · A5 empty button · B2
question count · C1 unanswered flagging · F13 review-before-submit

**Wave 2 — comprehension and trust**
A4 text sizes · A6 symbols · C2 interactive tutorials · D1/D2 subtopics · B1
image-question contract · B1b figure-necessity model pass · F5 report/appeal ·
F6 honest progress · F7 source attribution

**Wave 3 — reach, cost and polish**
C6 platform-wide copy pass ·
A7 · A8 · B3 curriculum grounding · B4 limits · D3 subject picker · D4
validation · E1–E3 onboarding · F4 image budget · F8 rate limits · F9 first-run
· F10 session expiry · F12 localisation groundwork

---

## Already shipped (from the report's list)

- **U4** results layout — weak-area grouping, per-area bars, jump-to-question
- **N3** sticky navigation in review — Done bar
- **U5** partially — next-steps panel with study and retake actions
- Retake, gap-map deep links, LearnSpace "prove it" quiz
