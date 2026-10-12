# Figure Library P3d: The Second Maths Batch at Scale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 20 families of the P3c batch are drawn into the staging store, pass the blind review, are approved and drawn to volume. Coverage is then reported. The user approved the sample sheet ("THATS FINE GO ON", 2026-10-12).

**Architecture:** This is the P3b run, repeated. Everything it needs exists:
- `generate.py` with `--per-family`, `--families`, `--redo` and `--relink`;
- `review-drawn.ts` with `--job`, `--cap`, `--families`, `--regrade` and `--approve`;
- `coverage-report.ts`;
- `libraryFigures` for the quiz check.

Only the P3c final review's fixes are code.

**Tech Stack:** Python figgen (pytest), TypeScript review scripts (vitest, jiti), sqlite staging store.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`. The relevant parts are section 9 (P3, the P3b result and its final-review lessons) and the P3c result's "Next".

## Global Constraints

- **Spend:**
  - The review job is `p3d-blind`, capped at $8. Its estimate for 20 × 30 figures is about $5.
  - The library total stays far under $600.
  - `--dry` first; a run over the cap is refused.
- **The store:**
  - It is staging only, and never production.
  - Back it up before drawing (`figures.db.bak-p3d`).
  - Redraw only with `--redo` on the families that changed. That drops their reviews, so they are reviewed again.
- **Approval:**
  - A family passes at 27 of 30.
  - Before approving, every rejection is triaged against its figure. That includes rejections inside passing families, grouped by sub-type (kind, case, fact, band, shape) — the P3b final-review lesson.
  - A sub-type whose reviewed figures all failed is fixed or left out, never approved with its family.
  - A reviewer's misreading is recorded, not "fixed".
- **Commits:** local on `aws_deploy`, the three unrelated files left out, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A sub-type failing inside a passing family.** Expected: listed by the triage query (rejections grouped by sub-type params) and fixed before approval.
2. **A fix that changes a stem or a drawing after review.** Expected: that family is redrawn with `--redo` and reviewed again, so every approved figure carries the reviewed wording.
3. **Short families** (fewer than 150 different figures). Expected: they keep what they have; the run carries on.
4. **A tolerance or a range in a key.** Expected: none planned in this batch. Every key is exact, so the review's strict number matching applies.
5. **Coverage counted against misfits.** Expected: coverage is reported from the store's links, and the in-process quiz check reads three of the newly reached topics.

---

### Task 1: The P3c final review's findings

- [ ] For each Critical or Important finding: write a test that reproduces it, watch it fail, then fix it and watch it pass. Record each in the P3c ledger as `Final: fixed …`.
- [ ] Minor findings are recorded as deferred.
- [ ] Run `python -m pytest scripts/figgen -q -p no:cacheprovider` until it passes in full.
- [ ] Commit: `fix(figgen): the P3c final review's findings`.
- [ ] Redraw (`--redo`) any family whose drawing or stems changed.

### Task 2: Draw, review, triage, approve, volume

- [ ] Back up the store. Run `generate.py --per-family 30 --families=<the 20>`.
- [ ] Run `review-drawn.ts --job=p3d-blind --cap=8 --families=<the 20> --dry`, then the same command without `--dry`.
- [ ] **Triage:**
  - for each family under 27 of 30, read the rejections against their figures;
  - for every family, group the rejections by sub-type and look at each failing sub-type;
  - fix by TDD, then `--redo` and re-review the families changed;
  - record the noted passes that were read.
- [ ] Approve with `review-drawn.ts --job=p3d-blind --approve`.
- [ ] Draw to volume with `generate.py --per-family 150 --families=<the passing>`, then approve again.
- [ ] Run `coverage-report.ts`, count the 302 mapped Maths topics by number of figures and families, and run the in-process `libraryFigures` check on three newly reached topics.
- [ ] Record a P3d result in the spec and in memory. Commit: `docs(figure-library): the P3d result`.
