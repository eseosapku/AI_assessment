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

## Already shipped (from the report's list)

- **U4** results layout — weak-area grouping, per-area bars, jump-to-question
- **N3** sticky navigation in review — Done bar
- **U5** partially — next-steps panel with study and retake actions
- Retake, gap-map deep links, LearnSpace "prove it" quiz
