# Figure Library P3o: The Geography Wave at Scale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** draw the 13 Geography families of P3m into the staging store, put them through the blind review, approve them, and draw them to volume. Then report Geography coverage. Before P3m, 134 of the 146 mapped Geography topics had no family; its link report reaches 66.

**Approval:** this follows P3m under the user's standing approval of 2026-10-14 ("keep on going ... i agree and approve whatever yo do till i get back").

**Architecture:** this is the P3j run again. The blind reviewer answers without the key, and `agrees` compares its answers with the key.

Geography answers that may need help from `agrees`; the P3m probe already fixed hemispheres and bracketed times:
- grid references, four and six figures;
- compass directions in words or letters;
- latitudes and longitudes;
- local times;
- gradients written as 1 in n.

climate_graph, cross_section and population_pyramid are drawn with `--redo`: their 90 stored P1 figures carry the old questions.

**Tech Stack:** Python figgen (pytest), TypeScript review scripts (vitest, jiti), sqlite staging store.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, section 9.

## Global Constraints

- **Spend:**
  - The review job is `p3o-blind`, capped at $5. 13 × 30 figures is about $3.10, at P3j's $0.008 a figure.
  - Re-reviews go under `p3o-fix`, capped at $3. Caps are cumulative per job.
  - The library total ($91.34 before) stays far under $600.
- **Store:** `C:/Users/Stephen/figure-library/figures.db`, staging only, backed up to `figures.db.bak-p3o`.
- **Approval:**
  - A family passes at 27 of 30, or under the short-family rule.
  - Before approving, every rejection is triaged by sub-type.
  - A grader miss is fixed in `agrees` and regraded free, before any family is changed.
- **Volume:** 150 a family. A family with fewer distinct figures keeps what it has.
- **Commits:** local only, on `aws_deploy`. Leave out the three unrelated files, and use the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Six-figure references estimated a tenth out.** Expected: accepted, since ±1 in each direction is in the forms. A reviewer two tenths out is a fair miss.
2. **Ternary readings.** Reviewers misread triangular graphs often. Expected: triage checks the drawn point before blaming the family.
3. **Wind-rose and contour readings.** Expected: a count on rings and a height on a labelled contour; a misread is triaged by render.
4. **Old P1 figures.** Expected: the three pilot families are approved only from their redrawn, reviewed figures.
5. **Links.** Expected: the 66 topics read in P3m stand. Coverage is counted after the relink.

---

### Task 1: Draw 30, review, triage, approve

- [ ] Back up the store to `figures.db.bak-p3o`. Run `generate.py --per-family 30` on the 10 new families, and `--redo --per-family 30` on climate_graph, cross_section and population_pyramid.
- [ ] Run `review-drawn.ts --job=p3o-blind --cap=5 --families=<the 13> --dry`, then the same without `--dry`.
- [ ] Triage:
  - fix grader misses in `agrees` by TDD, then `--regrade --dry`, then `--regrade`;
  - fix family faults by TDD, `--redo` the family, and re-review under `p3o-fix`.
- [ ] Approve both jobs.

### Task 2: Volume, coverage and the record

- [ ] Draw to 150 with `generate.py --per-family 150`, then approve again.
- [ ] Report Geography coverage, and run the in-process quiz check on three newly reached topics.
- [ ] Record a P3o result in the spec and memory, and commit `docs(figure-library): the P3o result`.
