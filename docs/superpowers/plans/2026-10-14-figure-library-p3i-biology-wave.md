# Figure Library P3i: The Biology Wave, Samples

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 15 Biology families, ending in a sample sheet. They cover enzyme, photosynthesis, population, osmosis, blood-glucose and spirometer graphs; pedigrees and DNA; quadrats, keys and variation; and magnification, antibiotic plates, surface area to volume, and food tests. Two Biology families already exist from P1: food_web and punnett.

**Approval:** The user's standing approval of 2026-10-14 covers this phase ("keep on going ... i agree and approve whatever yo do till i get back"). The sheet is published for the user. Scaling (P3j) follows it the way P3h followed P3g.

**Architecture:** Each family is one module in `scripts/figgen/families/`, following P3g. Each family ships with:
- an answer test over 1,000 seeds, with the biology itself checked;
- the shared tests: variety, wording, inside the axes, text overlap, and SVG/PNG.

Biology joins `WORDED_SUBJECTS`. Organisms, cells and apparatus are drawn directly with matplotlib, and are kept schematic. A real photograph of an organism belongs to the real-image track, not here.

**Tech Stack:** Python figgen (matplotlib, pytest); the read-only link report; `wave_sheet.py` for the sheet.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`, section 5.2. Its Biology entry reads: "enzyme, photosynthesis and population graphs, Punnett squares, pedigree charts, food webs, pyramids, dichotomous keys, microscope graticule measurements, labelled-diagram templates with varied targets". Section 9 sets the wave order: Maths, Physics, Chemistry, then Biology.

## Global Constraints

- **Spend:** $0. This phase draws samples only and writes nothing to the store.
- **Values:** every value asked for lies on a mark or a gridline, and every key is exact (to 2 d.p. at most) or a stated whole value.
- **Biology:** real organisms and processes, with values of the right size:
  - enzyme optima of real enzymes (amylase pH 7 and 37 °C, pepsin pH 2, trypsin pH 8);
  - resting breathing of 12–20 breaths a minute;
  - blood glucose in mmol/dm³ of the right range;
  - real antibiotics and inherited conditions (albinism, sickle-cell anaemia, cystic fibrosis).
- **MCQs:** an option set never lets the key be picked without the figure. This is pinned by the centrality test, extended to Biology. Where a question is about the figure, the options are letters on the figure.
- **Questions stand alone:** each names its subject, since a quiz shows one question per figure. Assumptions are stated.
- **Commits:** local on `aws_deploy`, with the three unrelated files left out and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A biology answer the arithmetic cannot check.** Examples: a pedigree whose genotype cannot be inferred from the chart, a recessive condition drawn with an affected child of two unaffected-and-homozygous parents, a limiting factor named wrong on the plateau. Expected: each family's test checks the biology (inferability, Mendelian consistency, which factor limits where).
2. **A reading between marks.** Examples: a zone diameter off the mm grid, a tidal volume off a gridline, an image length the ruler cannot give. Expected: every value asked lies on a mark; pinned per family.
3. **A figure that gives its own answer away.** Examples: a key whose couplets name the answer letter, a glucose graph labelled "diabetic". Expected: the labels are letters or neutral names.
4. **Units students write several ways.** Examples: µm and um, mmol/dm³ and mmol/L, cm³ and ml. Expected: accepted forms cover them.
5. **Misfit links.** Biology's broad concepts (enzymes, cell-structure) reach many topics. Expected: the link report is read topic by topic, and AVOID removes misfits before the sheet.

---

### Task 1: Biology joins the wording test; graphs of processes

- **Files:** `scripts/figgen/tests/test_families_common.py` (`WORDED_SUBJECTS` += biology); `scripts/figgen/tests/test_biology_answers.py` (new).
- **enzyme_graph** (`graph.line`; LS, UP, AL)
  - **Draws:** the rate against temperature or pH for one or two lettered enzymes, with the optimum on a gridline.
  - **Asks:** the optimum; the rate at a value; which enzyme works in the stomach (letters); why the rate falls past the optimum (MCQ, 2 × 2: denatured or not, and the active site's shape).
  - **Concepts:** enzymes, enzyme-technology-applications.
- **photosynthesis_rate** (`graph.line`; LS, UP, AL)
  - **Draws:** the rate against light intensity at two CO₂ levels or temperatures, each levelling off at a corner on gridlines.
  - **Asks:** the rate at a value; the limiting factor at a lettered point (light on the slope, the other factor on the plateau); where the curve levels off.
  - **Concepts:** photosynthesis, plant-nutrition.
- **population_curve** (`graph.line`; LS, UP)
  - **Draws:** a sigmoid growth curve of yeast, bacteria or a mammal, with its phases lettered and the carrying capacity on a gridline.
  - **Asks:** the letter of the exponential phase; the carrying capacity; the population at a time; the mean growth rate between two times (UP).
  - **Concepts:** population-characteristics, population-size-limiting-factors.
- **osmosis_graph** (`graph.line`; UP, AL)
  - **Draws:** the % change in mass of potato pieces against sucrose concentration, crossing zero on a gridline.
  - **Asks:** the concentration with no change; the % change at a concentration; whether a piece gains or loses mass, and why (MCQ, 2 × 2).
  - **Concepts:** osmosis, cell-membranes-transport.
- **glucose_graph** (`graph.line`; UP, AL)
  - **Draws:** blood glucose after a meal for two lettered people, one of whom has diabetes. Neither is labelled as such.
  - **Asks:** the peak; when it returns to normal; which person has diabetes (letters); the hormone released as glucose rises (MCQ).
  - **Concepts:** homeostasis-general-principles, endocrine-system-structure-function, hormonal-imbalance-effects.
- **spirometer_trace** (`graph.line`; UP, AL)
  - **Draws:** volume against time for quiet breathing and one deep breath, with peaks and troughs on gridlines.
  - **Asks:** the breathing rate per minute; the tidal volume; the vital capacity.
  - **Concepts:** gas-exchange, breathing-mechanism-humans.
- **Commit:** `feat(figgen): biology: graphs of processes`.

### Task 2: Inheritance and DNA

- **pedigree** (`bio.genetics`; UP, AL)
  - **Draws:** three generations, numbered, with an autosomal recessive condition. Affected individuals are shaded, and squares and circles show sex.
  - **Asks:** whether the condition is dominant or recessive (MCQ with the reason); the genotype of a numbered person (only where the chart decides it); the chance that the next child is affected.
  - **Checks:** each asked genotype is forced by the chart.
  - **Concepts:** monohybrid-inheritance, inheritance-concepts.
- **dna_strand** (`bio.genetics`; UP, AL)
  - **Draws:** a ladder of 8–10 base pairs, one strand lettered and the other partly lettered.
  - **Asks:** the base opposite a position; the % of T given the % of A; the mRNA codons from the template strand (AL).
  - **Concepts:** dna-structure, nucleic-acids-protein-synthesis, dna-replication.
- **Commit:** `feat(figgen): biology: inheritance and DNA`.

### Task 3: Ecology, keys and variation

- **quadrat** (`bio.ecology`; LS, UP)
  - **Draws:** a field on a metre grid with plants, and lettered quadrats.
  - **Asks:** the count in a quadrat; the mean per quadrat; the estimated population (the mean × the field's area).
  - **Concepts:** population-characteristics, ecosystem-properties-ecological-factors.
- **dichotomous_key** (`bio.key`; LS, UP)
  - **Draws:** 4–5 lettered leaves or invertebrates, and a numbered key of paired statements on features that can be seen.
  - **Asks:** the name of a lettered organism; the feature that separates two of them.
  - **Concepts:** classification-organisms.
- **variation_chart** (`graph.bar`; LS, UP)
  - **Draws:** a histogram of a continuous feature and a bar chart of a discontinuous one, lettered.
  - **Asks:** which shows continuous variation (letters); the number in a group; the modal class.
  - **Concepts:** continuous-discontinuous-variation, variation-causes.
- **Commit:** `feat(figgen): biology: ecology, keys and variation`.

### Task 4: Cells and the laboratory

- **magnification** (`instrument.reading`; LS, UP, AL)
  - **Draws:** a cell drawing with a ruler beside it, and either a stated magnification or a scale bar.
  - **Asks:** the actual size in µm; the magnification from the scale bar.
  - **Concepts:** cell-structure, animal-plant-cells, electron-microscopes.
- **antibiotic_plate** (`diagram.template`; UP, AL)
  - **Draws:** an agar plate on a mm grid, with lettered antibiotic discs and clear zones.
  - **Asks:** the zone's diameter; the most effective antibiotic (letters); the zone's area (AL, π = 3.14).
  - **Concepts:** antibiotics, aseptic-technique, bacterial-diseases-plants-animals.
- **sa_volume** (`maths.solid`; LS, UP)
  - **Draws:** lettered cubes of whole-cm sides.
  - **Asks:** the surface area, the volume and the SA:V ratio of one; which would lose heat or take in substances fastest (letters).
  - **Concepts:** size-surface-area-volume-ratio, gas-exchange.
- **food_test_table** (`table.data`; LS, UP)
  - **Draws:** a table of foods against Benedict's, iodine, biuret and emulsion results, as colours named.
  - **Asks:** which food holds starch, reducing sugar, protein or fat; which test shows protein.
  - **Concepts:** food-components-identification, biological-molecules.
- **Commit:** `feat(figgen): biology: cells and the laboratory`.

### Task 5: Link, look, review, sheet and record

- [ ] **Link report** for all 15 families, read-only and by topic name. Each AVOID for a misfit is a ruling.
- [ ] **Look** at one PNG of every sub-type, and fix what a student would trip on.
- [ ] **Fresh review** of the batch by an Opus subagent, then one fix pass.
- [ ] **Sheet:** run `wave_sheet.py --subject biology --label "P3i, the Biology wave"` and publish it.
- [ ] **Record** a P3i result in the spec and in memory. Commit.
