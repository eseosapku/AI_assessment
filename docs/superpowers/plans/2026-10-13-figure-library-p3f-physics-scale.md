# Figure Library P3f: The Physics Wave at Scale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 19 Physics families of P3e are drawn into the staging store, pass the blind review, are approved and drawn to volume. Coverage of the mapped Physics topics is then reported. The user approved the sample sheet ("i think theyre fine go on", 2026-10-13).

**Architecture:** This is the P3d run, repeated for Physics. Everything it needs exists:
- `generate.py` with `--per-family`, `--families`, `--redo`, `--relink` and `--refresh-forms`;
- `review-drawn.ts` with `--job`, `--cap`, `--families`, `--dry`, `--regrade` and `--approve`;
- `coverage-report.ts`;
- `libraryFigures` for the quiz check.

The one code change made before money is spent is in the review's answer check. Physics answers carry units, and a reviewer often restates an answer in another unit ("0.5 A (500 mA)").

**Tech Stack:** Python figgen (pytest), TypeScript review scripts (vitest, jiti), sqlite staging store.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`. The relevant parts are section 9 (P3, the P3d result's lessons and the P3e result's "Next").

## Global Constraints

- **Spend:**
  - The review job is `p3f-blind`, capped at $8. Its estimate for 19 × 30 figures is about $5.
  - The library total ($65.28 before this phase) stays far under $600.
  - `--dry` first; a run over the cap is refused.
- **The store:**
  - It is `C:/Users/Stephen/figure-library/figures.db`, staging only and never production.
  - Back it up before drawing (`figures.db.bak-p3f`).
  - Redraw only with `--redo` on the families that changed. That drops their reviews, so they are reviewed again.
- **Approval:**
  - A family passes at 27 of 30.
  - Before approving, every rejection is triaged against its figure, including rejections inside passing families, grouped by sub-type (kind, mode, view, medium, band).
  - A sub-type whose reviewed figures all failed is fixed or left out, never approved with its family.
  - A reviewer's misreading is recorded, not "fixed".
- **Volume:** 150 figures a family. A family with fewer distinct figures keeps what it has.
- **Commits:** local on `aws_deploy`, with the three unrelated files left out (`scripts/build_checkpoint_figure_bank.py`, `scripts/textbook-figure-raw.ts`, the deletion of `data/audit/paper-style.json`), and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A reviewer restating the answer in another unit, or naming the quantity first.** Examples: "0.5 A (500 mA)", "R = 6 Ω", "20 ms (0.02 s)". Expected: read as the key when every part is the key or one of its accepted forms. A second, different value is still a hedge. Pinned in Task 1.
2. **A sub-type failing inside a passing family.** Expected: listed by the triage query (rejections grouped by sub-type params) and fixed before approval.
3. **A fix that changes a stem or a drawing after review.** Expected: that family is redrawn with `--redo` and reviewed again, so every approved figure carries the reviewed wording.
4. **Short families.** em_spectrum has 28 figures and nucleus about 72; lens_diagram and pressure have fewer than 150 too. Expected: they keep what they have, and the run carries on.
5. **Coverage counted against misfits.** Expected: coverage is reported from the store's links, and the in-process quiz check reads three of the newly reached Physics topics.

---

### Task 1: The review reads a restated unit as the same answer

**Files:**
- Modify: `scripts/figure-library/review.ts` (`agrees`)
- Test: `scripts/figure-library/review.test.ts`

**Interfaces:**
- Consumes: `agrees(q: ReviewQuestion, own: string): boolean`; `q.accepted` holds the key's fair forms. Physics answers get these through `core.measure`, for example "500 mA" for 0.5 A and "0.02 s" for 20 ms.
- Produces: the same signature. A numeric answer split into parts at brackets, "=" and " or " agrees when every part with a number is the key or an accepted form.

- [ ] **Step 1: Write the failing test** (in `describe('whether the reviewer reached the key')`):

```ts
it('reads a restatement in another accepted unit, or a named quantity, as the same answer', () => {
  const amps = short('0.5', ['0.5', '0.5 A', '500 mA'])
  expect(agrees(amps, '0.5 A (500 mA)')).toBe(true)
  expect(agrees(amps, '500 mA (0.5 A)')).toBe(true)
  expect(agrees(amps, 'I = 0.5 A')).toBe(true)
  expect(agrees(amps, '0.5 A or 0.6 A')).toBe(false) // a hedge between two values
  expect(agrees(amps, '0.5 A (600 mA)')).toBe(false)
  const ms = short('20', ['20', '20 ms', '0.02 s'])
  expect(agrees(ms, '20 ms (0.02 s)')).toBe(true)
})
```

- [ ] **Step 2: Run it and watch it fail.** Run: `npx vitest run scripts/figure-library/review.test.ts`. Expected: FAIL, because "0.5 A (500 mA)" reads as two numbers.
- [ ] **Step 3: Implement.** In `agrees`, after `reached` is computed for a one-number key, also accept the answer when it splits on `(`, `)`, `=` and ` or ` into parts where every part that holds a number either has every number equal to the key, or is (as `words`) one of `q.accepted`. A part `or` splits off must itself be the key, so a hedge between two values still fails.
- [ ] **Step 4: Run the review tests and the whole vitest file.** Expected: PASS, the earlier cases unchanged.
- [ ] **Step 5: Commit.** `fix(figure-library): the review reads a restated unit as the same answer`.

### Task 2: Draw 30, review, triage, approve

- [ ] Back up the store to `figures.db.bak-p3f`. Run `python scripts/figgen/generate.py --per-family 30 --families=<the 19>`.
- [ ] Run `npx jiti scripts/figure-library/review-drawn.ts --job=p3f-blind --cap=8 --families=<the 19> --dry`, then the same command without `--dry`.
- [ ] **Triage:**
  - for each family under 27 of 30, read the rejections against their figures;
  - for every family, group the rejections by sub-type params and look at each failing sub-type;
  - fix by TDD (a failing test first), then run `--redo` and re-review the families changed;
  - read the noted passes and act on the real ones;
  - after any fix to `agrees`, run `--regrade` (free) before paying again.
- [ ] Approve with `review-drawn.ts --job=p3f-blind --approve`.
- [ ] Commit any fixes: `fix(figgen): the P3f review's findings`.

### Task 3: Volume, coverage and the record

- [ ] Draw to volume with `generate.py --per-family 150 --families=<the passing>`, then approve again (`--approve`).
- [ ] Run `coverage-report.ts`, and count the 195 mapped Physics topics by number of figures and number of families.
- [ ] Run the in-process `libraryFigures` check on three newly reached Physics topics.
- [ ] Record a P3f result in the spec and in memory: the figures approved, the spend, the review's findings, and coverage.
- [ ] Commit: `docs(figure-library): the P3f result`.
