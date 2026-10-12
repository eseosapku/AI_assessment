# Figure Library P3b: The Maths Wave Drawn, Reviewed and Approved

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 37 Maths families the user approved on the P3a sheet (2026-10-12, "go on its alright") are drawn into the staging store, pass the blind review, are approved, and are drawn to volume for the topics they reach. A coverage report then shows the result.

**Architecture:**
- **Code changes (two):** the generator skips a family whose figures reach no topic and ignores the person's name when spotting repeated figures; the review script takes a job name and a cap.
- **Polish:** the cheap deferred minors from the P3a review are fixed before anything is drawn for review, so the reviewer sees the final wording.
- **The rest is running the pipeline** as P1a did: draw 30 per family, blind review (Sonnet, 27 of 30 to pass), triage failures, approve, draw to volume, approve again, coverage.

**Tech Stack:** Python figgen (pytest), the Node review scripts (`npx jiti`, vitest), Bedrock Sonnet through the spend ledger.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, sections 3, 5.2, 5.5, 8 and 9 (P3).

## Global Constraints

- **Spend:**
  - The blind review is about $9: 37 families × 30 × $0.008. The job cap is $14.
  - Spend stays in the ledger, and the library total stays under $600 (now $45.13).
- **Store:**
  - The staging store only; never production.
  - Redrawing the 9 reworded families replaces their pilot figures. Local quizzes (P2a) lose them until they are approved again.
- **Reviewer:** the reviewer is wrong both ways (P1a). Triage every rejection before changing a family, and never redraw a family during its review.
- **Commits:** stay local on `aws_deploy`, and messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A family whose figures reach no topic (bearings, today).** Expected: skipped with a message, not an endless search for seeds. Pinned in Task 1.
2. **Two figures with the same numbers under different names.** Expected: stored once (spec 3.4: near-duplicates removed). Pinned in Task 1.
3. **A review job over its cap.** Expected: refused before sending. This is the existing `assertBudget`, exercised by the `--dry` estimate in Task 4.
4. **A family failing review because the reviewer misread.** Expected: triaged against the figure, and regraded or recorded, not "fixed". Task 4.
5. **Approval approving figures drawn after the review.** Expected: yes, since a family is judged as a whole (`approveDrawn`). Task 4 approves again after drawing to volume.

---

### Task 1: The generator — no reach, no repeats

**Files:** modify `scripts/figgen/generate.py`; test `scripts/figgen/tests/test_generate.py`.

- [ ] Write the failing tests first:
  - `test_a_family_that_reaches_no_topic_is_skipped`: `main()`-level helper `families_to_draw(db, fams, index)` returns the families with reach, and names the skipped ones.
  - `test_the_same_figure_under_another_name_is_stored_once`: a fake family whose `sample` varies only `name` yields one stored figure per distinct set of numbers.
- [ ] Implement:
  - The dedup key leaves out `name`, since names change only the wording.
  - `main()` skips families with empty `link.reach`, printing why.
- [ ] Run `python -m pytest scripts/figgen -q` → pass. Commit `feat(figgen): skip families with no topic, store a figure once whatever the name`.

### Task 2: Polish before review (the P3a review's deferred minors)

**Files:** the named families; tests in `scripts/figgen/tests/test_p3a_review.py`.

- [ ] Written first, then fixed:
  - **Wording:**
    - `bar_chart` says "walk", not "travel by Walk";
    - `cumulative_frequency` says "the times 160 students took", not "a puzzle of 160 students";
    - `histogram` says "students took between 20 and 25 minutes";
    - `clock` says "How many minutes is it from the time shown until 4 o'clock?".
  - **Accepted forms:** "65 degrees" for a bearing; units without a space ("55kg") wherever a unit form is accepted.
  - **Money:** `scatter_graph` gives car values in millions of RWF, not "$ hundreds".
  - **Sizes:** `cuboid` Lower Secondary sizes are realistic per object, with a small range for each.
  - **Thresholds:** `scatter_graph` picks a threshold with points on both sides.
- [ ] Each fix gets a test. Run the full suite, then commit `fix(figgen): wording, forms and sizes from the P3a review`.

### Task 3: The review script takes a job and a cap

**Files:** modify `scripts/figure-library/review-drawn.ts`.

- [ ] Add `--job` (default `REVIEW_JOB`) and `--cap` (default 8, in USD) to the options.
  - Pass the job to `itemsToReview`, `saveVerdict`, `familyScores`, `notedPasses`, `regrade` and `approveDrawn`.
  - Pass the cap to `assertBudget` and `askJson`.
- [ ] Run `npx tsc --noEmit -p .` and `npx vitest run scripts/figure-library` → pass. Commit `feat(figure-library): review jobs by name, with their own cap`.

### Task 4: Run it

- [ ] **Draw:**
  - `python scripts/figgen/generate.py --redo --families=<the 9 reworded>`
  - then `--families=<the 28 new>`, at 30 each.
  - Look at one figure per family in the store's preview folder.
- [ ] **Estimate:** `npx jiti scripts/figure-library/review-drawn.ts --job=p3b-blind --cap=14 --families=<37> --dry`. Expected: about $9.
- [ ] **Review:** the same command without `--dry`. Report the per-family scores.
- [ ] **Triage every failing family:**
  - Read its rejections against its PNGs.
  - Where the reviewer misread, regrade or record it.
  - Where the family is wrong, fix it under TDD, redraw that family with `--redo`, and review it again.
- [ ] **Approve:** `review-drawn.ts --job=p3b-blind --approve`.
- [ ] **Draw to volume:** `generate.py --per-family 150 --families=<passing>`, then approve again.
- [ ] **Coverage:**
  - `npx jiti scripts/figure-library/coverage-report.ts`.
  - An in-process `libraryFigures` check on three Maths topics: the figures and their converted questions.
- [ ] **Record:** the P3b result in the spec and in memory. Commit `docs: P3b result`.
