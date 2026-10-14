# Figure Library P3q: The Exam-Diagram Dataset, Imported

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bring the user's dataset of 30,092 Cambridge exam-style diagrams into the staging store as library figures. Each diagram gets questions computed from its manifest parameters, links to the topics that teach it, and the same blind review and approval as our drawn families.

**Why:** the user shared it on 2026-10-15 ("check these out and find out if they can be useful"), and asked that figures look like what students see in school. These diagrams are black-and-white Cambridge IGCSE, AS and A Level style, and they cover what our families do not:
- cell and bacterium structure, the leaf section;
- practical apparatus;
- displayed, structural and skeletal formulae, curly-arrow mechanisms, orbital boxes;
- ruler-and-compass constructions, trigonometry triangles, vectors.

**Source:** `G:/.shortcut-targets-by-id/1hj0Tn1T99ZkM3ZnMTuJJskn15sXY7THs/images/dataset/`.
- `catalogue.csv`
- `manifest.jsonl`: one row per image, with family, qualification, year, subtopic, params and labels.
- `images/<subject>/...`: each image as SVG and PNG.

The files are read as data only. Nothing in the dataset is run.

**Ownership:** the README names no licence. The import stays in the staging store, and nothing reaches production until the user confirms the dataset may be used in StudySquare. The `bio.template` images derive from public-domain art (LadyofHats), whose credit is kept.

**Architecture:**
- **Importer** (`scripts/figgen/dataset/importer.py`):
  - It streams the manifest and copies a figure's SVG and PNG into `figure-library/assets/dataset/<family>/`.
  - It stores the figure with `origin = 'drawn'` and `family = 'ds.<family>'`, so review, regrade and approval work unchanged.
  - The band comes from the qualification: IGCSE → UP; AS and A2 → AL.
- **Question writers** (`scripts/figgen/dataset/questions.py`): one function per dataset family, `(params, labels, rng) -> list[Question]`, computed from the params.
  - **Labels:** the part a letter marks, or the letter of a part.
  - **Maths:** x in a trig triangle; a vector combination; an image point; roots and intercepts; quartiles and medians from cumulative frequency; frequency density.
  - **Chemistry:** a molecule's name and molecular formula, from the SMILES; an electron configuration; ΔH or Ea from an energy profile; the equivalence volume of a titration.
  - **Physics:** a circuit's current or p.d. from its values; a spring's extension; a half-life; a focal length; a wavelength; a speed or distance from a motion graph.
  - **Biology:** a Punnett square's ratio; a pedigree's mode; a food web's producers and consumers.
- **Links:** each dataset subtopic is mapped to our concept ids (`scripts/figgen/dataset/concepts.py`), and linked through `link.topics_for` with a per-family pseudo-module (CONCEPTS, BANDS, NEEDS), so the curriculum-fit rules apply.
- **Families we already draw** (box plots, histograms, decay curves and others) are imported too: they add variety in exam style.

**Tech Stack:** Python (pytest; rdkit only if installed, else formulae from the dataset's own name tables), the review scripts (jiti), the sqlite staging store.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, section 9.

## Global Constraints

- **Spend:**
  - The review job is `p3q-blind`, capped at $12: 40 families × 30 = 1,200 figures, about $9.60.
  - Fix reviews go under `p3q-fix`, capped at $4.
- **Store:** staging only, backed up to `figures.db.bak-p3q`. No write to production.
- **Exactness:** every key is computed from the params. A writer that cannot compute a key asks nothing.
- **No knowledge-only questions:** a question must need the figure. "Name the part labelled B" needs it. "What does the nucleus contain?" does not.
- **Commits:** local only, on `aws_deploy`, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Dataset files are never committed.

## Review Focus

1. **A label the writer reads wrongly.** Letters A–E against the `labelled` order. Expected: the test checks the letter order against the drawn labels list.
2. **Units and rounding.** Trig answers to 3 s.f., and angles to 1 d.p., as Cambridge asks. Expected: the stem states it, and the forms accept the usual roundings.
3. **SMILES to formula.** Expected: written with subscripts, and tested on every molecule in the manifest.
4. **Subtopics that map loosely.** Expected: the link report is read by name.
5. **Google Drive streaming.** Copying 60,000 files is slow. Expected: the importer resumes, and counts what it copied.

---

### Task 1: The importer and the first writers (labels, maths)

- [ ] Write the tests:
  - every manifest row of a family gives questions whose keys the test recomputes;
  - the importer copies, stores and resumes.
- [ ] Write the importer, and the writers for bio.cell, bio.template, bio.leaf_section, phys.apparatus, math.trig_triangle, math.vector, math.transformation, math.function_graph, math.number_line, math.inequality_region.
- [ ] Commit: `feat(figgen): dataset: importer and first writers`.

### Task 2: The remaining writers

- [ ] Write the remaining writers, with tests: chemistry (molecule, molecule_set, functional_groups, dot_cross, electron_shells, orbital_boxes, energy_profile, titration_curve, boltzmann, lattice, mechanism, reaction_scheme), physics (circuit, decay_curve, decay_chain, iv_graph, motion_graph, ray_diagram, wave, force_diagram, field_lines) and the rest of maths and biology.
- [ ] Commit: `feat(figgen): dataset: all writers`.

### Task 3: Concepts, links, sample import, review

- [ ] Map every subtopic to concepts, run the link report, and read it by name.
- [ ] Import 30 a family. Run the review dry, then for real. Triage, fix by TDD, re-review, approve.

### Task 4: The full import, coverage and the record

- [ ] Import the rest, in resumable batches. Approve the passing families. Relink.
- [ ] Report coverage, and record the P3q result.
