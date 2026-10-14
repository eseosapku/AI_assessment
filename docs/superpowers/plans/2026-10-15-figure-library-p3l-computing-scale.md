# Figure Library P3l: The Computing Wave at Scale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** draw the 15 Computing families of P3k into the staging store, put them through the blind review, approve them, and draw them to volume. Then report Computing coverage. Before P3k, 397 mapped Computing topics had no figure; its link report reaches 106 of them.

**Approval:** this follows P3k under the user's standing approval of 2026-10-14 ("keep on going ... i agree and approve whatever yo do till i get back").

**Architecture:** this is the P3j run again. The blind reviewer answers without the key, and `agrees` compares its answers with the key.

Computing answers that may need help from `agrees`:
- comma-separated lists ("3, 5, 9");
- binary strings, with or without spaces;
- hexadecimal, with or without "h" or "0x";
- capitalised words (cipher and Pass/Fail).

**Tech Stack:** Python figgen (pytest), TypeScript review scripts (vitest, jiti), sqlite staging store.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, section 9.

## Global Constraints

- **Spend:**
  - The review job is `p3l-blind`, capped at $5. 15 × 30 figures is about $3.60, at P3j's $0.008 a figure.
  - Re-reviews go under `p3l-fix`, capped at $3. Caps are cumulative per job.
  - The library total ($86.88 before) stays far under $600.
- **Store:** `C:/Users/Stephen/figure-library/figures.db`, staging only, backed up to `figures.db.bak-p3l`.
- **Approval:**
  - A family passes at 27 of 30, or under the short-family rule.
  - Before approving, every rejection is triaged by sub-type.
  - A grader miss is fixed in `agrees` and regraded free, before any family is changed.
- **Volume:** 150 a family. A family with fewer distinct figures keeps what it has.
- **Commits:** local only, on `aws_deploy`. Leave out the three unrelated files, and use the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Lists and codes marked wrong for their form.** Examples: "3,5,9" against "3, 5, 9"; "0110 1100" against "01101100"; "3Fh" against "3F". Expected: the forms are in `accepted`, or `agrees` reads them.
2. **A reviewer reading a convention differently.** Examples: bubble-sort passes, insertion-sort pass numbers, binary search's midpoint, levels counted from 1. Expected: triage checks the figure states the convention before blaming the reviewer.
3. **Small text.** The cipher's 26 letters and the trace table's code. Expected: the reviewer reads them; if not, the figure is enlarged.
4. **Questions answerable without the figure.** Expected: none. The P3k review checked them.
5. **Links.** Expected: the 106 topics read by name in P3k stand. Coverage is counted only after the relink.

---

### Task 1: Draw 30, review, triage, approve

- [ ] Back up the store to `figures.db.bak-p3l`. Run `generate.py --per-family 30 --families=<the 15>`.
- [ ] Run `review-drawn.ts --job=p3l-blind --cap=5 --families=<the 15> --dry`, then the same without `--dry`.
- [ ] Triage:
  - fix grader misses in `agrees` by TDD, then `--regrade --dry`, then `--regrade`;
  - fix family faults by TDD, `--redo` the family, and re-review under `p3l-fix`.
- [ ] Approve both jobs.

### Task 2: Volume, coverage and the record

- [ ] Draw to 150 with `generate.py --per-family 150`, then approve again.
- [ ] Report Computing coverage, and run the in-process quiz check on three newly reached topics.
- [ ] Record a P3l result in the spec and memory, and commit `docs(figure-library): the P3l result`.
