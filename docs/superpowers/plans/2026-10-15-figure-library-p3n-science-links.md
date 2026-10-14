# Figure Library P3n: Integrated Science Reached by the Science Families

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the 42 Lower Secondary Science topics are reached by the approved Physics, Chemistry and Biology families that teach what those topics teach. No new figures are drawn and nothing is reviewed again. The topics come from:
- Cambridge Lower Secondary Science 7–9;
- Checkpoint 0893;
- NERDC Integrated Science JS1–3.

Today Science has 179 mapped topics and figures in one.

**Approval:** the user's standing approval of 2026-10-14 covers this. The plan was noted in P3j's "later ideas".

**Architecture:**
- A family may declare `ALSO`: concept ids of another subject, here `science.*`, that its figures teach as well. `link.concepts_of` adds them.
- The family's `NEEDS` and `AVOID` still apply, so a sectioned Science topic is reached only where a section names what the figure teaches.
- `generate.py --relink` (free) writes the new links for figures already approved.
- Primary Science topics (P) are not reached: no family draws at Primary level.

**Tech Stack:** Python figgen (pytest); the read-only link report; `reach_snap.py` to prove no other link moves.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, section 9.

## Global Constraints

- **Spend:** $0.
- **Store:** staging only, backed up to `figures.db.bak-p3n` before the relink.
- **Exactness:** `ALSO` holds only concept ids the store has. A figure is linked to a Science topic only at its own level (LS).
- **No link outside Science moves:** checked with `reach_snap.py` before and after.
- **Commits:** local only, on `aws_deploy`, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A broad Science concept pulls a family in** ("ecosystems", "chemical-reactions"). Expected: the link report is read topic by topic, and AVOID names a misfit.
2. **Unsectioned topics** (Checkpoint 0893 "Physics", NERDC "Physics: motion and energy") are judged by concepts alone. Expected: they are reached only by families whose `ALSO` names a concept the topic lists.

---

### Task 1: `ALSO` in the link, and the families' Science concepts

- [ ] **Test** (`test_link.py`): a family with `ALSO` reaches a topic of the other subject by an `ALSO` concept at its own level, and never at another level.
- [ ] **Test** (`test_families_common.py`): every `ALSO` id exists in the store, and none is in the family's own subject.
- [ ] **Change** `link.concepts_of` to add `ALSO`; add `ALSO` to the LS-band Physics, Chemistry and Biology families.
- [ ] **Commit:** `feat(figgen): science families reach integrated science`.

### Task 2: Link report, relink, coverage and the record

- [ ] Run the link report for subject `science`, and read it by name and section. Name misfits in AVOID.
- [ ] Run `reach_snap.py` diff: no pairs are lost; only Science topics gain.
- [ ] Back up the store, then `generate.py --relink`.
- [ ] Report Science coverage, and run the quiz check on three Science topics.
- [ ] Record a P3n result in the spec and memory.
