# Figure Library P3j: The Biology Wave at Scale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the 17 Biology families of P3i are drawn into the staging store, pass the blind review, are approved and are drawn to volume. They are the 15 new families plus food_web and punnett, whose P1 questions were rewritten. Coverage of the mapped Biology topics is then reported.

**Approval:** this follows P3h under the user's standing approval of 2026-10-14. The P3i sheet is published at https://claude.ai/artifact/4NdZG8ffZRKyC94UiWVvTc.

**Architecture:** the P3h run again. The grader (`agrees`) already reads glosses, charges, roundings, forms and unit factors.

**Tech Stack:** Python figgen (pytest), TypeScript review scripts (vitest, jiti), sqlite staging store.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, section 9.

## Global Constraints

- **Spend:**
  - The review job is `p3j-blind`, capped at $6. 17 × 30 figures is about $4.10, at P3h's $0.008 a figure.
  - Re-reviews go under `p3j-fix`, capped at $3. Caps are cumulative per job.
  - The library total ($81.79 before) stays far under $600.
- **Store:**
  - `C:/Users/Stephen/figure-library/figures.db`, staging only, backed up to `figures.db.bak-p3j`.
  - food_web and punnett are drawn with `--redo`: their 60 stored P1 figures carry the old questions.
- **Approval:**
  - A family passes at 27 of 30, or under the short-family rule.
  - Before approving, every rejection is triaged by sub-type.
  - A grader miss is fixed in `agrees` and regraded free, before any family is changed.
- **Volume:** 150 a family; a family with fewer distinct figures keeps what it has.
- **Commits:** local only, on `aws_deploy`. Leave out the three unrelated files, and use the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Knowledge-only questions slipping back in.** Expected: none; P3i removed them, and the test pins it.
2. **Drawings read wrongly.** Examples: leaf features (teeth, lobes, veins), meniscus-like readings, pedigree lines. Expected: triage looks at the figure before blaming the reviewer.
3. **Readings between marks.** Expected: none, or a stated tolerance.
4. **Short families.** dichotomous_key and sa_volume have few distinct figures. Expected: they keep what they have.
5. **Old P1 figures.** Expected: food_web and punnett are approved only from their redrawn, reviewed figures.

---

### Task 1: Draw 30, review, triage, approve

- [x] Back up the store to `figures.db.bak-p3j`. Run `generate.py --per-family 30` on the 15 new families, and `--redo --per-family 30` on food_web and punnett.
- [x] Run `review-drawn.ts --job=p3j-blind --cap=6 --families=<the 17> --dry`, then the same without `--dry`.
- [x] Triage:
  - fix grader misses in `agrees`, then `--regrade --dry`;
  - fix family faults by TDD, `--redo` the family, and re-review under `p3j-fix`.
- [x] Approve both jobs.

### Task 2: Volume, coverage and the record

- [x] Draw to 150 with `generate.py --per-family 150`, then approve again.
- [x] Report Biology coverage, and run the in-process quiz check on three newly reached topics.
- [x] Record a P3j result in the spec and memory, and commit `docs(figure-library): the P3j result`.
