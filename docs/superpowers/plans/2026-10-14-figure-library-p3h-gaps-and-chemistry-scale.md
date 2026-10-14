# Figure Library P3h: The Physics Gaps and the Chemistry Wave at Scale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 23 families of P3g are drawn into the staging store, pass the blind review, are approved and drawn to volume. These are the 9 Physics gap families and the 14 Chemistry families. Coverage of the mapped Physics and Chemistry topics is then reported.

**Approval:** The user's standing approval of 2026-10-14 covers this phase: "i trust you and want you to keep on going ... i agree and approve whatever yo do till i get back". The P3g sheets are still published for the user. Scaling does not wait for a verdict on them.

**Architecture:** This is the P3f run again, for 23 families. Everything it needs exists:
- `generate.py` with `--per-family`, `--families`, `--redo` and `--relink`;
- `review-drawn.ts` with `--job`, `--cap`, `--families`, `--dry`, `--regrade` and `--approve`;
- `coverage-report.ts`;
- `libraryFigures` for the quiz check.

No code change is planned before money is spent. Chemistry answers are formulas, ions and names, and their typed forms come from `core.formula_forms`. Triage will show whether the review's `agrees` misses a fair form. If it does, that becomes a TDD fix, then `--regrade`, which is free.

**Tech Stack:** Python figgen (pytest), TypeScript review scripts (vitest, jiti), sqlite staging store.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`. The relevant part is section 9: P3, with the P3f result and the P3g plan.

## Global Constraints

- **Spend:**
  - The review job is `p3h-blind`, capped at $12. P3f cost $7.91 for 570 figures, so 690 figures should cost about $9.60.
  - The library total ($73.59 before this phase) stays far under $600.
  - Run `--dry` first. A run over the cap is refused.
- **The store:**
  - It is `C:/Users/Stephen/figure-library/figures.db`, staging only, never production.
  - Back it up before drawing, as `figures.db.bak-p3h`.
  - Redraw only with `--redo`, and only on the families that changed. That drops their reviews, so they are reviewed again.
- **Approval:**
  - A family passes at 27 of 30.
  - Before approving, triage every rejection against its figure, including rejections inside passing families, grouped by sub-type (kind, band, series, electrolyte, mode).
  - A sub-type whose reviewed figures all failed is fixed or left out. It is never approved along with its family.
  - A reviewer's misreading is recorded, not "fixed".
- **Volume:** 150 figures a family. A family with fewer distinct figures keeps what it has. organic_structure has about 44 distinct molecules and mirror images.
- **Commits:**
  - Local only, on `aws_deploy`.
  - Leave out the three unrelated files: `scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts`, and the deletion of `data/audit/paper-style.json`.
  - Use the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A formula, ion or name typed another fair way.** Examples: "C₂H₅OH" for C₂H₆O, "Pb²⁺" or "Pb2+", "Propan-1-ol", "A and C only". Expected: accepted when it is a fair form; any miss is fixed in `agrees` or the family's forms, then regraded.
2. **A reading the reviewer cannot make exactly.** Examples: a burette meniscus, a starting pH, a solubility value. Expected: the reading carries the tolerance its scale allows, or lies on a mark.
3. **A sub-type failing inside a passing family.** Examples: titration at AL (moles), electrolysis with copper electrodes, the ammonia pH curve. Expected: found by the triage grouping and fixed before approval.
4. **A fix after the review.** Expected: that family is redrawn with `--redo` and reviewed again under `p3h-fix`, so every approved figure carries the wording that was reviewed.
5. **Short families.** organic_structure and capacitor_discharge have few distinct figures. Expected: they keep what they have, and the short-family rule (`SHORT_FLOOR` 20) lets them pass.

---

### Task 1: Draw 30, review, triage, approve

- [ ] **Draw.** Back up the store to `figures.db.bak-p3h`, then run `python scripts/figgen/generate.py --per-family 30 --families=<the 23>`.
- [ ] **Review.** Run `npx jiti scripts/figure-library/review-drawn.ts --job=p3h-blind --cap=12 --families=<the 23> --dry`, then the same command without `--dry`.
- [ ] **Triage:**
  - for each family under 27 of 30, read the rejections against their figures;
  - for every family, group the rejections by sub-type and look at each failing sub-type;
  - fix by TDD (a failing test first), then run `--redo` on the changed families and re-review them under `p3h-fix`;
  - after any fix to `agrees`, run `--regrade --dry --families=…` (free) before paying again.
- [ ] **Approve** with `review-drawn.ts --job=p3h-blind --approve`, and the same with `--job=p3h-fix`.
- [ ] **Commit** any fixes: `fix(figgen): the P3h review's findings`.

### Task 2: Volume, coverage and the record

- [ ] Draw to volume with `generate.py --per-family 150 --families=<the passing>`, then approve again.
- [ ] Run `coverage-report.ts`. Count the mapped Physics and Chemistry topics by number of figures and number of families.
- [ ] Run the in-process `libraryFigures` check on three newly reached Chemistry topics.
- [ ] Record a P3h result in the spec and in memory: the figures approved, the spend, the review's findings, and coverage.
- [ ] **Commit:** `docs(figure-library): the P3h result`.
