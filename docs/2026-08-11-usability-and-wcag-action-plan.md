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

**Done 2026-08-18.** The skip link and 3:1 focus rings shipped earlier; this
finished the landmarks and the focus order.

**Focus order (2.4.3).** Advancing a wizard step replaced the whole panel while
focus stayed on the Continue button. A keyboard or screen-reader user pressed
Continue and, as far as they could tell, nothing happened — the new step was
behind them and was never announced. Focus now moves to the step panel, which
is labelled "Step 4 of 8", so arriving there says where you are. The first
render is deliberately skipped so the dialog's own autofocus keeps the caret in
the first field.

**Landmarks.** The first attempt at the banner was wrong and worth recording:
changing `TopBar`'s wrapper to `<header>` achieves nothing while it sits inside
`<main>`, because `<header>`'s implicit banner role is scoped away by any
sectioning ancestor. The shell would have had no banner however the tag was
written. Fixed structurally instead — the column is a plain `div`, `<header>`
and `<main>` are siblings, and `#main-content` (the skip link's target) is now
the real `<main>` rather than a div inside one.

Two further landmark faults: `SideNav` wrapped its `<nav>` in an unlabelled
`<aside>`, adding a second, vaguer complementary landmark over the same links
and diluting the rail's — the one place "complementary" is actually true. And
the desktop and mobile navs were both named "Main", so a screen reader's
landmark list showed two identical entries.

Verified in a browser on the public page, which turned out to have the same
fault — two unnamed `<nav>`s, now "Main" and "Footer". The signed-in shell's
landmarks are verified by source structure and the compiler only: the browser
check redirected to the landing page for want of credentials.

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

**Built 2026-08-18.** `lib/figure-keying.ts` classifies each figure from its
existing vision description, so nothing new is generated and nothing recurring
is spent. The letter-keyed test runs before the word-label test deliberately:
a keyed figure is usually *described* as "labelled A to D", and read the other
way round a perfectly good identification question would be banned for no
reason. Across the manifest: 53% unlabelled, 46% word-labelled, 1% letter-keyed.

Each catalogue line in the prompt now carries its own keying and its own
instruction, phrased as a demand rather than a ban — telling a model not to ask
naming questions yields naming questions in different words, whereas asking for
a consequence yields a consequence.

Measured on Biology / neuron structure, the topic whose figures are the most
heavily labelled in the corpus: the pass before this change returned mostly
naming questions; three runs after it returned one naming question in nine, and
zero and one in the two follow-up runs. The rest ask what a part does, what
happens if it fails, or why the arrangement matters.

One bug found in the process, and it was mine. The image-quality check from B1
could drop a question, and it ran *after* the paper was trimmed to the requested
count — silently reintroducing the shortfall B2 exists to prevent, which is why
that verification run returned nine of ten. It now only ever detaches the
figure, never the question: a stem that leaks its answer is a weak question, but
a paper of nine when ten were asked for is a broken promise. Both follow-up runs
returned 10/10.

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

### E1b. The tour was rejected, and the reason was two faults

Raised 2026-08-18 on sight of the shipped tour: *"this tutorial is useless and
does nothing, it isn't professional and doesn't point to what's needed, neither
is it in-depth in anything."* Correct on every count, and the two causes are
worth separating because only one was a design failure.

**The mechanical fault was mine, introduced by A7.** Steps were anchored with
`document.querySelector('aside a[href=...]')` — a selector that walks the
shell's markup. Changing `SideNav`'s wrapper from `<aside>` to a `<div>`, for
the landmark reasons above, silently unhooked every coach mark. The tour fell
back to its centred-card path and became four boxes in the middle of the screen
pointing at nothing. That is worse than no tour: on a student's first visit it
makes the product look broken.

Anchors are explicit `data-tour` attributes now, so a purely structural change
cannot unhook them. A step whose anchor is missing is skipped rather than shown
adrift, and if nothing can be anchored the tour does not run at all.

**The design fault was the content.** *"Watch it move — scores, subjects and
grades over time"* describes a page. It teaches nothing and asks for nothing. A
tour that narrates the sidebar is the menu read aloud, which is exactly the
complaint. Each step now names what that part of the product is for, what it
needs from the student and what comes back — and step one points at the
**Create assessment button**, not at a menu item, because a button was what the
lost tester could not find. The test asserts a floor on body length, which is a
crude proxy for depth but does stop the one-line page description coming back.

Visually: a spotlight that leaves the target lit rather than dimming it, a
pointer joining panel to target, placement chosen from the room available
(right, left, below, above, centre) so the panel never lands off screen, and
progress as dots.

**Also rejected:** the LearnSpace create dialog, *"very bland and just off
putting"*. It asks a student to describe what they are confused about, which
takes some nerve, and it opened on a bare grey box. It now has a branded header
that says what it makes and how long it takes; the five suggestions carry a
subject and an icon and fill both fields, so they demonstrate what a
well-formed request looks like rather than sitting there as grey pills; the
teaching modes are named for what the student does ("Read and understand",
"Learn by doing") instead of for the method; and the footer says what the
disabled button is waiting for.

**E3 was half reverted.** The section navigation came out — the user has other
plans for that surface — but the zoom control stayed, and my first pass wrongly
removed both. React Flow's default `<Controls>` is three unlabelled icon
buttons with no indication of how far in you are, which is the same "what does
this do" fault as everything else in this pass. `ZoomControl` replaces it with
named buttons, a visible percentage and a labelled fit control.

### E1c. One tour per surface

Raised 2026-08-18: *"there seems to be more you can give tutorials on, do the
same everywhere else."* Right — a single tour over the sidebar is the wrong
shape. A student standing on the Gap Map needs to know what its colours mean,
not that Progress exists.

Six tours now, each written from what is actually on that screen, each tracked
under its own key so arriving somewhere new still explains itself:

| Surface | What it explains |
| --- | --- |
| **Home** | The Create button is the product · LearnSpace is for being stuck · the Gap Map finds your weak topics · Progress proves it moved |
| **Practice** | Syllabus quizzes come from your real textbook · the off-syllabus path takes pasted notes · past papers and class work are separate flows |
| **LearnSpace** | Narrow topics beat broad ones · homework help works from a photo alone · lessons save their position |
| **Gap Map** | Subjects branch to subtopics so a gap shows at its true level · what the colours mean, and that grey ≠ bad · tapping a weak node starts the loop |
| **Progress** | Judge the average over weeks, not one quiz · weak subjects sort first and link into a quiz · every question is reviewable and reportable |
| **Recall** | Cards return just before you forget · decks build from what you got wrong · rating honestly is what makes the schedule work |

Where a step could either describe a control or say something a student does
not already know, it says the second thing. "Only what you are about to forget"
and "grey means untested, which is not the same as bad at it" are the kind of
line that earns an interruption; "this is your deck list" is not.

The test suite enforces the shape rather than the wording: 3-5 steps per tour,
a floor on body length, no title that merely repeats its anchor, no title reused
across surfaces, and every anchor present in the known `data-tour` set.

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

**Done 2026-08-18.** The obvious build is stage narration — "Reading your
textbook…", "Writing questions…" — timed off the clock. It was rejected. The
request is a single POST with no stage events, so the client genuinely does not
know which phase the model is in, and a guess dressed as a fact costs more
trust than the spinner did the moment a slow run sits on "Almost done" for
forty seconds.

`lib/generation-progress.ts` reports only what is actually known: how long this
user's last few runs took (median of seven, so one outlier cannot poison it),
how far through that this run is, and whether it has gone past normal. The bar
never reaches 100 — it must not finish before the paper does — and once a run
is overdue it says so plainly rather than claiming it is nearly there.

Cancel is an AbortController, which also required making `waitForAiJob`
interruptible: on the async-job path, cancelling previously left the poll
running to its 210-second timeout and then pushed the student into a quiz they
had cancelled. That path is behind a flag that is off today, so the bug was
latent rather than live.

One bug of my own, caught before commit: the first version decided whether a
run should teach the estimate by reading the `error` state in the `finally`
block. That closure holds the value from the render that started the request,
so it could not see an error set moments earlier in the `catch`, and every
failed run would have taught the estimate that generation is fast. Tracked in
a local now.

Fix: stage the wait honestly ("Finding figures… Writing questions… Checking for
duplicates…"), allow cancel, and state expected duration up front.

### F7. Nothing tells the student where a question came from
No source attribution on generated questions. A student who disagrees has no
way to check, and a teacher has no way to verify alignment. The textbook, page
and topic are already known at generation time and simply aren't surfaced.

**Done 2026-08-18.** The rule is that a citation must be true or absent, and
holding to it turned up two places where the data was less certain than it
looked.

The page is known only for questions that carry a figure — that is the one
part of the pipeline that tracks where content sat in the book. Text questions
therefore cite a book and an area and no page, rather than a plausible number.

The subtopic tag was the harder one. `tagQuestionsWithSubtopics` matches on
keywords and **round-robins when nothing matches**, which is a sound way to
spread coverage for scoring but is an assignment, not a finding. Printing it as
provenance would have invented a source, which is worse than offering none. It
now records whether the tag was found, and only a real match is citable — with
one exception that is not a guess at all: when the student asked for exactly
one topic or subtopic, every question is from it, so a single candidate counts
as known.

The citation appears under each question in review and in the downloaded
report, since the export is what a teacher actually checks a paper against.

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

### C5b. The report card was never in this plan

Raised 2026-08-18 by the user asking whether the report-card complaint had been
worked on. It had not — it appears nowhere in this document, so it was never
tracked, and it only ever received the platform-wide sweeps.

Worse, it had escaped those too. The component carried **54 hardcoded palette
classes**, so the AA retune of the light palette simply never reached it:
`text-gray-400` on white is 2.8:1 and `text-amber-600` at 12px is 3.3:1, both
failing 1.4.3. Converting it to the `ss-*` tokens fixed every one at once —
the same systemic lesson as the original palette pass, on a file that had been
missed.

The rest was the familiar set:

- **The printed card was branded "Brain Ink · AI Assessment Platform"** with a
  placeholder "B" tile. That is the artifact that reaches a parent or a school
  office, and it named a product that no longer exists by that name.
  StudySquare now, with the Brain Ink endorsement line the rest of the app uses.
- **The page's loading state said "Loading Brain Ink…"** — the same unfinished
  rename fixed elsewhere in `fd8d94f`.
- **Both selects had labels tied to nothing**, and the Student select greys out
  until a classroom is chosen without ever saying so.
- **The empty state named no action.** It now says what a report card is built
  from, differently for a teacher and a student, because the thing that fills
  it differs.

**Lesson, and the guard built from it:** the plan was assembled from the tester
report plus an audit of the surfaces testers reached. Nobody opened the report
card, so nothing about it entered the plan, and every later sweep was scoped to
the plan.

`lib/palette-escapes.test.ts` now closes that hole. It counts hardcoded
Tailwind palette classes per file against a committed baseline
(`lib/palette-escapes.baseline.json`, currently **53 files / 2,623 classes**)
and fails on any increase, or on any new file arriving dirty. It is a one-way
ratchet rather than a hard rule, deliberately: a hard rule could not be adopted
without rewriting 53 files first, and a guard nobody can turn on guards
nothing. Files that improve are reported so the baseline can be lowered, which
locks each cleanup in.

Verified by reintroducing a single `text-gray-400` into `SparkButton.tsx`: the
suite fails and names the file.

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

**Done 2026-08-18.** All seven surfaces. The dashboard and LearnSpace both
needed structure before they needed words: `SectionHeader`
and `ListPanel` had nowhere to put a line saying what a section was *for*, so
every heading was a bare category name and the student had to guess where its
contents came from.

What the pass turned up beyond the wording:

- **"Quota left: 47."** No unit, no timeframe. It is quizzes, and it is today.
- **"Good work, {name}"** greeted everyone, including a student averaging 20%.
  Praise that arrives regardless of the score is worth nothing, and to someone
  who is struggling it reads as mockery. That string was also passed to the
  avatar, so the alt text read *"Good work, Stephen's profile photo."*
- **Four buttons all named "Study."** Tabbing through the focus-areas panel gave
  a screen-reader user the same word four times with no way to tell which topic
  each one opened (WCAG 2.4.4). They now carry the topic in their accessible name.
- **The score chart carried its meaning in colour alone** (WCAG 1.4.1) — no key,
  and no statement of which end was recent.
- **Two dialogs had labels not tied to their fields**, so the association existed
  visually and nowhere else.
- **The homework Solve button sits disabled until there is something to work
  from, and never said so.** A dead control with no explanation reads as broken —
  the same fault as the dead Submit found in the assessment player.

Settings was the last, and the worst of the three for markup rather than
wording. **All fourteen of its labels were tied to their fields visually and
nowhere else** — a screen reader read the form as fourteen anonymous boxes.
Three of them were not field labels at all: `<label>` used as a heading over a
group of buttons, which points at no control and so reaches assistive tech as
nothing whatsoever. Those are headings with a labelled group now.

The three password reveal buttons were icon-only with no accessible name
(WCAG 4.1.2), and the two disabled fields — Role and Student ID — were greyed
out with no explanation, which reads as a broken page rather than a deliberate
one. Both now say who sets them and who can change them. The password rule
(six characters) was stated only in the error after it had been broken.

---

## The study loop

Raised 2026-08-18, and it is the most important thing in this document: *"the
aim is for students to do assessments, review and study — I don't think the way
it is is really prompting them to study right now."*

Correct. The Progress screen's response to Physics at 10% was a link reading
**"Practice this subject"** — be tested again on the thing you already know you
are failing. Testing is diagnosis; studying is treatment. Every road out of the
dashboard led back to diagnosis.

Three faults, and they compound:

1. **The weak-topic action tested instead of teaching.** Now "Study this",
   landing on the LearnSpace dialog with the subject already filled, so the
   distance between "I'm bad at this" and being taught it is one click.
2. **The loop never closed visibly.** A student could study a topic, retake it,
   improve, and be told nothing at all — which teaches that studying achieves
   nothing. A retake now carries the score it is beating, and finishing it says
   *"27% to 61%. That is 34 points from studying it."* Honest when it goes the
   other way, and the advice after a drop is another lesson, not another test.
3. **Nothing brought a student back.** Recall — the one mechanism that turns a
   quiz into retained knowledge — was the fourth item in the menu with nothing
   pointing at it.

`lib/study-loop.ts` picks the single next action. The ordering is the design:

| | When | Why it ranks there |
| --- | --- | --- |
| 1 | No quizzes yet | Nothing else is knowable |
| 2 | Studied, never retested | The payoff moment — an unclosed loop teaches that studying is pointless |
| 3 | Cards due | Short, and the only thing here that decays |
| 4 | Weakest topic | Study it. Not another quiz on it |
| 5 | Nothing pressing | Extend, rather than inventing an obligation |

`NextStepCard` sits **above** the statistics, deliberately. A student at 43%
opening a screen of averages and bar charts has been handed a report, not a
plan, and the student who most needs a plan is the one least served by another
chart. One topic, one button, and a number of minutes — because "about 4 min"
is what decides between later and now.

`/api/next-step` supplies the two signals the dashboard could not derive: cards
due, and lessons built but never tested. Each is wrapped separately, because a
dashboard that 500s over one missing table is worse than one offering a
slightly weaker suggestion.

**Three corrections after seeing it on screen:**

- **"Take the retake" opened the builder.** It set a target in session storage
  and left the student to reconstruct a quiz the app already had every parameter
  for — the exact friction the card exists to remove, reintroduced by me one
  layer down. It generates the paper and goes straight into it now, joining the
  lesson to its topic, subtopic and textbook in the same query that finds it.
  The builder remains the fallback if generation fails, because a dead button is
  worse than a longer path.
- **It was stuck on one suggestion.** A student who never took the retake saw
  the same card forever, and advice you cannot dismiss stops being advice and
  becomes wallpaper. Every suggestion now carries a key identifying the *topic*
  rather than the category, so "not now" falls through to the next one — the
  next unproven topic, then cards, then the next weak topic. Held in state, not
  storage: "not now" means not now, and tomorrow the weakest topic is worth
  offering again. The first quiz cannot be set aside, because nothing else is
  knowable until it exists.
- **It did not look like it mattered.** A quiet bordered box among six other
  quiet bordered boxes. It is now the loudest thing on the page, and carries a
  **Test → Study → Prove** strip with the current leg lit — three words that say
  what the product is *for*, on the screen students open most.

## Closing out the tester document

Audited item by item against the code on 2026-08-18 rather than from memory,
because "I think that's done" is how U4 stayed undone for a month.

**Closed in this pass:**

- **U4 — report card.** It already had Score Summary and a subject breakdown;
  what it lacked was the doc's third section. **Feedback & Next Steps** now
  names the subjects under 50%, says to study each one *before* being tested on
  it again, and says to retake afterwards to confirm it moved. Subject names
  reach that HTML from the database, so they are escaped.
- **U5 — feedback unmissable.** A tester finished a quiz and never realised
  feedback existed, because the next-steps panel sits below the entire question
  review. The score card now carries a line straight to it: *"We found 3 things
  to work on — see what to study."*
- **A2 — keyboard shortcuts.** Alt+N and Alt+B step the wizard, and the header
  says so; an unadvertised shortcut helps nobody. Alt rather than bare arrows or
  letters, because arrows belong to the radio groups inside each step and
  letters belong to the text fields — a shortcut that eats a keystroke someone
  was typing is worse than no shortcut.

**Deliberately not done, with reasons:**

- **U3's dashboard grouping** into labelled Create / Learn / Review sections.
  The underlying complaint — a tester could not find the assessment builder —
  is fixed by the dominant hero CTA and now by the next-step card above it. A
  three-way grouping would fight that design by giving three destinations equal
  weight, when the whole point of the study loop is that at any moment one of
  them matters more than the others.
- **N1's permanently-on hover tooltips** (E2). Tooltips that fire on hover do
  not exist for touch or keyboard users, and the tour plus the section hints now
  carry that explanation on the screen where everyone can read it. Worth
  revisiting only if testers still ask "what does this do" after the tours.
- **A3's footer accessibility link.** The toggles are in Settings and reachable
  from the menu on every page. A footer link matters on a marketing site; inside
  a signed-in shell with a persistent sidebar it is a second door to the same room.

## The phantom subject

Raised 2026-08-18: *"full progress doesn't actually show everything, some taken
subjects and quizzes are missing from that and from recents."* Measured against
the live database rather than reasoned about, and it is worse than "missing".

Work set by a teacher is saved with `assessment_id` deliberately NULL — it
hangs off `assignment_results` instead. The dashboard query joined only to
`assessments`, so every one of those results came back with no subject, and the
`|| 'Assessment'` fallback then **collected them all into a single phantom
subject literally named "Assessment"**, which sat in Progress alongside the real
ones with an average of its own. That is the "Assessment 27%" row in the
screenshot: not a subject, an error.

On the live data, out of **1,672 results**:

| | |
| --- | --- |
| No subject from the assessments join | **686** (41%) |
| …recoverable from the assignment | **445** |
| …genuinely orphaned | 241 |

The 445 were real, named subjects hidden behind that one fake row:
Mathematics-S1-SB (137), ICT S5 Adapted SB (60), Physics S3 SB (41), Physics
Learners book S2 (38), S1 Physics SB (36), English S6 SB (35), French S2 SB
(30), Biology S2 SB (16).

Three fixes:

- **Recover the subject from the assignment**, via a `LATERAL … LIMIT 1` rather
  than a plain join: `assignment_results` has no unique constraint on
  `result_id`, so a second row pointing at the same result would have
  duplicated that quiz and double-counted it in the average. No duplicates exist
  today; the guard is there so a future one cannot corrupt the numbers silently.
- **A result with no recoverable subject no longer invents one.** The 241
  orphans still count towards the total — the student did take them — but they
  contribute to no subject's average, because they are not evidence about any
  subject.
- **Averages read `percentage`, not `score`.** They are equal on every current
  row, so this changes nothing today, but `score` is the field that has meant
  different things over time and `percentage` is what every other screen reads.

## Exam prep did not fail — it produced unusable papers

Raised 2026-08-18: *"exam prep assessments fail to generate."* Reproduced, and
the failure is narrower and stranger than a plain error. JAMB is fine. WAEC
without a past paper is fine. **WAEC with a synced past paper attached** is
where it breaks, in two ways:

| Run | Result |
| --- | --- |
| 1 | 0 questions |
| 2 | 10 questions, **7 of them malformed** |

Malformed meaning: the past-question bank stores questions the way they are
printed on the paper —

```
The shaded area in the diagram is represented by
A) {(x,y) : y - 3x < -6}
B) {(x,y) : y + 3x < 6}
```

— so the model copies that whole block into the stem, and then has nothing left
to put in the options array and emits `["A","B","C","D"]`. The student is shown
a question with four bare letters to choose between. It passes every existing
check, because the stem is fine and there are four distinct options.

`lib/inline-options.ts` repairs it. Telling the model not to do it helps and is
worth doing, but a paper full of that shape keeps pulling it back, so the fix
has to be on what arrives rather than on what was asked for.

The parser is deliberately timid, because mangling a good question is worse
than leaving a bad one. It requires at least two labels, consecutive from the
first (A,B,C — not A,C,F), the block must be the tail of the stem, and there
must be a stem left over afterwards. "If A) is chosen, what follows?" is left
alone. The answer index is preserved, since the model chose it against the same
letters, and clamped rather than dropped when the counts disagree.

It runs before the paper is trimmed to the requested count, so a repaired
question still counts towards it — the same ordering mistake as B1c, avoided
this time.

**Verified:** two runs on the failing path, 10/10 delivered, zero degenerate.

**Still open, found while reproducing:** asking WAEC for `theory` returns
multiple-choice questions. Not a generation failure, but not what was asked for.

## The top of the dashboard, third attempt

Raised 2026-08-18: *"creating assessments should still be prominent as it's
still the main thing."* Correct, and the previous attempt had quietly demoted
it — "Create assessment" ended up as a bordered ghost button in fourth
position, after the primary action, the time estimate and before a dismiss
link. That is not what the product's main action should look like.

The mistake was structural, not cosmetic. One card was being asked to be two
things: the front door, and a recommendation. They have different jobs and
different lifespans — building a quiz is always available and always the same;
the recommendation changes hourly and is sometimes to do something else
entirely. Merging them meant one of the two always lost, and the first merge
lost the wrong one.

**Two surfaces, hierarchy carried by contrast rather than volume.**

| | |
| --- | --- |
| **Build a quiz** | The only saturated panel on the page. Full brand gradient, the art, the largest type, the dark high-contrast button. It earns the colour by being the thing most students came to do. |
| **Do this next** | A light panel beside it with an accent spine. Unmissable, obviously secondary, and no longer shouting over the thing it complements. |

Both panels are the same height with their buttons on a shared baseline, so the
row reads as one composed unit rather than two adjacent cards. On a narrow
screen they stack — quiz first, recommendation second — which is the right
priority order anyway.

The **Test › Study › Prove** strip moved to a quiet footer inside the
recommendation, as small accent text rather than chunky pills. It still says
what the product is for; it no longer competes with the two buttons above it.

The earlier stacked-gradient version is what the previous section describes, and
the lesson from it is worth keeping: when two elements are fighting, the fix is
usually to give them different *jobs*, not different colours.

## "Does this look professional?" — no, and mostly not for design reasons

Asked directly on 2026-08-18. The honest answer was no, and the largest cause
turned out to be the data rather than the layout.

**`assessments.subject` is not a subject.** It is whatever the textbook file was
called at ingest. The live values include `Advanced Mathematics S6 SB (1)`,
`Biology S4  SB` (two spaces), `AGRIC S2 SB`, `Apply javscript`, and
`Branis_Sumba_RUZIVO_Abstract` — somebody's document name, shown to students as
a subject. Rendered into fixed-width rows those became `Cambridge Primary…`,
`Impact of Agricultu…`, `The binomial classi…`: a column of clipped ellipses
that reads as broken software long before anyone questions the spacing around
it.

`lib/subject-label.ts` cleans the label only — the stored value stays the key
everything matches on, so nothing here can change which quiz belongs to which
subject. It strips ingest noise (`SB`, `Student Book`, `(1)`, extensions),
turns filename separators into spaces, collapses the double spaces the data is
full of, and lifts the level out (`S4`, `Grade 6`) to show separately rather
than as part of the name. Case is left alone unless the whole string is
shouting, which is what keeps `ICT` and `MicroPython` intact.

**Two layout faults, both self-inflicted:**

- **A three-column grid holding one card** left two thirds of the row empty. A
  page with a hole that size reads as broken whatever is in it. Columns are now
  capped at the number of cards.
- **The hero stretched to match its neighbour**, opening a two-hundred-pixel
  band of empty gradient between the headline and the button. That looked like
  a rendering fault, not a layout. The button sits under the title now and the
  panels find their own heights.

**Two data findings worth a decision, not fixed here:**

- **213 results scored exactly 0.** Across 1,672 results the distribution is
  genuinely broad (324 in the 0–20% band), so a 27% average next to five recent
  scores of 90+ is arithmetically honest. But an abandoned attempt scoring zero
  counts the same as a genuine failure, and that is a product question: should a
  walk-away drag a student's average down for good?
- **The subject list is really a textbook list.** Cleaning labels treats the
  symptom. A student taking Biology from two different books has two "subjects",
  and no screen can merge them until ingest records a subject separately from a
  source.

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
