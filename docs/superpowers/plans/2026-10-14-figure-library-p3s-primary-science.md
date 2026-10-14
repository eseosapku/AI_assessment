# Figure Library P3s: The Primary Science Wave

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 15 drawn families for Primary Science (P band), plus Primary Computing through one family. They cover the 136 Primary Science topics that have no figure today: Cambridge Primary Science 1–6, Rwanda SET P1–P6 and NERDC Basic Science. Each family is reviewed on a sample of 30, and approved families are drawn to volume.

**Approval:** the user's standing approval ("keep on going ... i agree and approve whatever you do"). On 2026-10-14 the user said "do what you recommend". The recommendation was to skip languages, religion, literature, music and PE, and to focus on Science, Computing, History, Social Studies, Agriculture and Vocational.

**Architecture:** same as P3p.
- One module per family in `scripts/figgen/families/`.
- One answer-test file per group: `test_primary_physical_answers.py`, `test_primary_materials_answers.py`, `test_primary_living_answers.py`. Each recomputes every key over 1,000 seeds.
- Registry lines go under per-group markers in `families/__init__.py`.
- Three parallel writers, briefed by `scratchpad/p3s_brief.md`.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md` (5.2, 9).

## Global Constraints
- **Spend:** $0 to write. The review of 15 × 30 samples is about $3.
- **Primary learners, ages 6–12:**
  - short sentences in plain English;
  - at least 10 pt type;
  - simple shapes, not anatomy;
  - small whole numbers;
  - Rwandan contexts: Kigali, Musanze, a school garden, the market.
- **Exactness:** every key is computed from the params, and every value asked is printed, countable or on a gridline.
- **The figure is needed:** no question can be answered from general knowledge alone. Names of parts or stages are asked only where the figure letters them.
- **Commits:** local only, on `aws_deploy`, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **A circuit read wrongly.** A bulb in a broken loop, a gap or an open switch must not light. A switch drawn open must clearly look open; the dataset's lesson was that open and closed circles look alike.
2. **A seesaw that balances by a hair.** Expected: whole-number moments, and the "which side goes down" question only where the moments differ by a clear amount.
3. **A shadow direction.** The shadow points away from the light source. The sun's position and the shadow must agree in the drawing.
4. **Carroll and Venn sorting.** Each animal's attributes come from a fixed table in the code that a teacher would agree with: no bats as birds, no whales as fish.
5. **A robot path.** Turns are relative to the robot's facing direction. The robot starts on a marked square, facing a drawn direction.

### Task 1: Physical
**Families:** `simple_circuit_p`, `magnets_p`, `shadows_p`, `seesaw_p`, `force_arrows_p`. Writer A.

### Task 2: Materials, Earth and investigations
**Families:** `materials_test_p`, `soil_drainage_p`, `state_changes_p`, `weather_chart_p`, `plant_growth_p`. Writer B.

### Task 3: Living things and ICT
**Families:** `carroll_sort_p`, `food_chain_p`, `body_data_p`, `teeth_p`, `grid_robot_p`. Writer C. `grid_robot_p` has `ALSO` computing concepts for Primary Computing.

### Task 4: Review, approve, volume
- [ ] Shared tests and the full suite green; commit.
- [ ] Draw 30 of each; blind review `p3s-blind`; one fix pass; approve; draw to volume.
- [ ] Coverage of science P topics, before and after; record in the spec and in memory.
