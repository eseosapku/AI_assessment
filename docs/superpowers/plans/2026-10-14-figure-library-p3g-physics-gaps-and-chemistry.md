# Figure Library P3g: The Physics Gaps and the Chemistry Wave, Samples

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two new sets of drawn figure families, each ending in a sample sheet for the user's verdict:
- 9 Physics families for the topics the Physics wave left empty: electric and magnetic fields, electrostatics, circular motion and gravity, gases, capacitors, and the photoelectric effect and energy levels.
- 14 Chemistry families: particles, bonding, the periodic table, organic structures, energy profiles, electrolysis, rate, solubility and pH curves, mass spectra, titrations and chromatograms.

The user asked for both ("do all that you reccomend", 2026-10-14). Nothing is drawn at scale until the user's verdict on the sheets.

**Architecture:** Each family is one module in `scripts/figgen/families/`, following P3e. Each family ships with:
- an answer test over 1,000 seeds, with the science itself checked;
- the shared tests: variety, wording, inside the axes, text overlap, and SVG/PNG.

Chemistry joins `WORDED_SUBJECTS`. Structures, apparatus and dot-and-cross diagrams are drawn directly with matplotlib, as the P3e circuits were. RDKit and schemdraw, which the spec names, are not installed, and the molecules here are small.

**Tech Stack:** Python figgen (matplotlib, pytest); the read-only link report; `wave_sheet.py` for the sheets.

**Spec:** `docs/superpowers/specs/2026-10-10-figure-library-design.md`: section 5.2 (Chemistry: "structural formulas, dot-and-cross diagrams, particle diagrams, energy profiles, rate graphs, titration and solubility curves, chromatograms, apparatus readings"; Physics: "field patterns"), and section 9 (the P3f result's "Next").

## Global Constraints

- **Spend:** $0. This phase draws samples only and writes nothing to the store.
- **Values:** every value asked for lies on a mark or a gridline, and every key is exact (to 2 d.p. at most) or a stated whole value.
- **Constants:** stated in the stem where they are needed ("Take k = 9 × 10⁹ N m² C⁻²", "Take π = 3.14").
- **Chemistry:** real substances with real data:
  - real ions and molecules;
  - solubility values of the right size;
  - real isotopes and abundances;
  - true electrolysis products.
- **Formulas:** displayed with subscripts and superscripts. The plain typed forms are accepted too: "H2O" and "H₂O", "Mg2+" and "Mg²⁺".
- **MCQs:** an option set never lets the key be picked without the figure. This is pinned by the P3c centrality test, extended to Chemistry. Where a question is about the figure, the options are letters on the figure.
- **Questions stand alone:** each names its subject, since a quiz shows one question per figure. Assumptions are stated (P3f).
- **Commits:** local on `aws_deploy`, with the three unrelated files left out and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A value read between marks.** Examples: a burette reading between 0.05 cm³ lines, a chromatogram spot off the cm grid, a curve point off a gridline. Expected: every value asked lies on a mark; pinned per family.
2. **An MCQ answerable without the figure.** Examples: a "which is a compound?" question whose options name substances. Expected: the options are the figure's box letters; the centrality test covers every Chemistry MCQ.
3. **A formula or ion marked wrong because of how it is typed.** Examples: "H2O" against "H₂O", "Na+" against "Na⁺", "2,8,1" against "2.8.1". Expected: accepted, through a shared `core.formula_forms`; pinned.
4. **Chemistry that is wrong in a way the arithmetic cannot see.** Examples: an ion with the wrong charge, a molecule with a wrong lone-pair count, hydrogen at the anode, or a solubility curve for a salt shaped wrong. Expected: each family's test checks the chemistry (electron counts, octets, products by the discharge rules).
5. **Misfit links.** "chemical-equations" and "covalent-bonding" are broad concepts. Expected: the link report is read topic by topic, and AVOID removes misfits before the sheets.

---

### Task 1: Chemistry joins the wording test; formula forms

- **Files:** `scripts/figgen/core.py` (`formula_forms`, `sub`, `sup`); `scripts/figgen/tests/test_core.py`; `scripts/figgen/tests/test_families_common.py` (`WORDED_SUBJECTS` += chemistry).
- **Test first:**
  - `formula_forms("H2O")` contains "H₂O", "H2O" and "h2o";
  - `formula_forms("Mg2+")` contains "Mg²⁺", "Mg2+" and "Mg+2";
  - `sub("CO2") == "CO₂"`.
- Commit: `feat(figgen): formula forms; chemistry joins the wording test`.

### Task 2: Physics fields

- **electric_field** (`physics.field`; LS, UP, AL)
  - **Draws:** parallel plates with the voltage and gap labelled, field lines, and a charge; or a point charge with radial field lines.
  - **Asks:** the field direction (MCQ); E = V/d; F = qE; the direction of the force on a charge (MCQ, 2 × 2).
  - **Concepts:** electric-field, electric-field-strength, electric-potential, potential-difference, electrostatics, applications-of-electrostatics.
- **coulomb_force** (`physics.field`; LS, UP, AL)
  - **Draws:** two charged spheres, their charges in μC, and the distance between them.
  - **Asks:** attract or repel (MCQ); F = kQq/r² (UP, AL); the force when r doubles.
  - **Checks:** F is exact to 2 d.p.
  - **Concepts:** coulombs-law, electrostatics, electric-field.
- **magnet_field** (`physics.field`; LS, UP)
  - **Draws:** one or two bar magnets with field lines, and compasses or points lettered.
  - **Asks:** which pole is X; the compass direction at P; attract or repel; which material is magnetic.
  - **Concepts:** magnetism, magnetization-and-demagnetization, magnetic-fields.
- Commit: `feat(figgen): physics gaps: fields`.

### Task 3: Physics circles and gravity

- **circular_motion** (`physics.force`; UP, AL)
  - **Draws:** a car on a roundabout, a stone on a string, or a moto on a bend, seen from above, with r, v and m labelled.
  - **Asks:** F = mv²/r, a = v²/r, T = 2πr/v (π = 3.14), and the force's direction (MCQ: towards the centre, 2 × 2).
  - **Concepts:** motion-in-a-circle, centripetal-acceleration-and-force, angular-displacement-and-velocity.
- **gravity_orbit** (`physics.field`; UP, AL)
  - **Draws:** g against distance from a planet's centre, in planet radii (inverse square), on a grid.
  - **Asks:** g at the surface; g at nR (read); the weight of a mass there; the ratio when the distance doubles.
  - **Concepts:** gravitational-field, gravitational-field-strength, newtons-law-of-gravitation, orbiting-under-gravity, kepler-laws, satellites, solar-system-structure.
- Commit: `feat(figgen): physics gaps: circles and gravity`.

### Task 4: Physics gases, capacitors and quanta

- **gas_law** (`graph.line`; UP, AL)
  - **Draws:** Boyle's p–V curve with points on lattice crossings; or p against temperature (°C) extrapolated to absolute zero.
  - **Asks:** pV; p at a stated V; absolute zero; T in kelvin.
  - **Concepts:** ideal-gas-law, kinetic-theory-of-matter, pressure.
- **capacitor_discharge** (`graph.line`; AL)
  - **Draws:** V against t, halving every whole number of gridlines.
  - **Asks:** V₀; Q₀ = CV₀; the time to halve; the energy ½CV₀².
  - **Concepts:** capacitors, energy-stored-in-capacitor, potential-difference.
- **photoelectric** (`graph.line`; UP, AL)
  - **Draws:** Ek(max) in eV against f in 10¹⁴ Hz, a straight line.
  - **Asks:** the threshold frequency; the work function; Ek at a stated f.
  - **Concepts:** photoelectric-effect, photon-and-light-energy, wave-particle-duality, spectra-and-quantum-physics.
- **energy_levels** (`physics.wave`; UP, AL)
  - **Draws:** an energy-level diagram in eV with transitions arrowed and lettered.
  - **Asks:** a photon's energy; the highest-frequency transition (MCQ by letter); the ionisation energy.
  - **Concepts:** line-spectra, spectra-and-quantum-physics, photon-and-light-energy.
- Commit: `feat(figgen): physics gaps: gases, capacitors, quanta`.

### Task 5: Chemistry particles and bonding

- **particle_diagram** (`chem.particle`; LS, UP)
  - **Draws:** four lettered boxes of particles: elements (atoms or diatomic molecules), compounds, mixtures, and solid, liquid or gas arrangements.
  - **Asks:** which box is a compound, an element or a mixture (letters); a box's state; the number of molecules in a box.
  - **Concepts:** states-of-matter, kinetic-theory, chemical-formulae, separation-techniques.
- **electron_shells** (`chem.particle`; LS, UP)
  - **Draws:** a shell diagram of elements 1–20, the nucleus marked with its proton number.
  - **Asks:** the configuration ("2,8,1"); the group and period; the charge of its ion.
  - **Concepts:** electronic-configuration, atomic-structure, bohr-model, periodic-table-structure.
- **ionic_bonding** (`chem.structure`; LS, UP)
  - **Draws:** dot-and-cross ions in brackets with their charges: NaCl, MgO, CaCl₂, Na₂O, LiF, KBr, MgCl₂, CaO.
  - **Asks:** an ion's charge; the formula; the electrons transferred; which atom gained electrons.
  - **Checks:** every ion has a full outer shell, and the charges balance.
  - **Concepts:** ionic-bonding, chemical-formulae, electronic-configuration.
- **covalent_bonding** (`chem.structure`; LS, UP)
  - **Draws:** dot-and-cross molecules: H₂, Cl₂, HCl, H₂O, NH₃, CH₄, CO₂, O₂, N₂.
  - **Asks:** shared pairs; lone pairs on the central atom; the formula; single, double or triple bond.
  - **Checks:** every atom has a full outer shell.
  - **Concepts:** covalent-bonding, chemical-formulae, vsepr-theory.
- **periodic_table** (`table.data`; LS, UP)
  - **Draws:** periods 1–4 of the table with some cells lettered, as exam papers do.
  - **Asks:** which letter is a noble gas, an alkali metal or a halogen; the group of X; the formula of X with Y; the most reactive of three.
  - **Concepts:** periodic-table-structure, periodic-trends, group-1-alkali-metals, group-17-halogens, noble-gases.
- Commit: `feat(figgen): chemistry: particles and bonding`.

### Task 6: Chemistry structures, energy and electrolysis

- **organic_structure** (`chem.structure`; UP, AL)
  - **Draws:** displayed formulas of C1–C5 alkanes, alkenes, alcohols and carboxylic acids.
  - **Asks:** the name; the molecular formula; the homologous series (MCQ); the number of hydrogen atoms.
  - **Concepts:** alkanes, alkene-chemistry, alcohols, carboxylic-acids, organic-functional-groups, homologous-series.
- **energy_profile** (`chem.energy`; UP, AL)
  - **Draws:** a reaction pathway with energy in kJ/mol on a gridded axis, and a catalysed path dashed.
  - **Asks:** ΔH with its sign; Ea; exothermic or endothermic (MCQ, 2 × 2); the catalysed Ea; the reverse Ea (AL).
  - **Concepts:** enthalpy-changes, bond-energy, catalysis, thermochemistry.
- **electrolysis** (`chem.structure`; UP, AL)
  - **Draws:** a cell with electrodes lettered and the battery's + and − marked: molten PbBr₂, NaCl solution, CuSO₄ solution with carbon or copper electrodes, or dilute H₂SO₄.
  - **Asks:** the product at A and at B (by the discharge rules); which electrode is the cathode; which ion moves to it.
  - **Concepts:** electrolysis, redox-reactions, electrochemistry.
- Commit: `feat(figgen): chemistry: structures, energy, electrolysis`.

### Task 7: Chemistry graphs

- **rate_graph** (`graph.line`; LS, UP, AL)
  - **Draws:** the volume of gas against time for one or two experiments, with corners on gridlines.
  - **Asks:** the total volume; the volume at t; the mean rate over the first t s; when it stopped; which experiment was faster (MCQ, lettered).
  - **Concepts:** reaction-rate, factors-affecting-reaction-rate, catalysis.
- **solubility_curve** (`graph.line`; UP)
  - **Draws:** curves of real salts (KNO₃, NaCl, KCl, NH₄Cl, CuSO₄), their values rounded to gridlines.
  - **Asks:** the solubility at T; the mass that crystallises on cooling; the most soluble salt at T.
  - **Concepts:** solutions-and-solubility, salts, separation-techniques.
- **ph_curve** (`graph.line`; UP, AL)
  - **Draws:** pH against the volume of alkali added, with the equivalence point on gridlines.
  - **Asks:** the equivalence volume; the starting pH; strong or weak acid (MCQ); a suitable indicator (MCQ).
  - **Concepts:** acid-base-titrations, ph-scale, acid-base-indicators, weak-acids-and-bases.
- **mass_spectrum** (`graph.bar`; UP, AL)
  - **Draws:** isotope peaks (m/z against % abundance) of real elements with real abundances, rounded so Ar is exact.
  - **Asks:** Ar; the number of isotopes; the most abundant one.
  - **Concepts:** mass-spectrometry, relative-atomic-mass, atomic-number-mass-number-isotopes.
- Commit: `feat(figgen): chemistry: graphs`.

### Task 8: Chemistry analysis

- **titration** (`instrument.reading`; UP, AL)
  - **Draws:** burette readings before and after for three runs, the scale zoomed in, at 0.05 cm³ marks.
  - **Asks:** a titre; the mean of the concordant titres; moles = c × V (AL).
  - **Concepts:** acid-base-titrations, mole-concept, laboratory-techniques, neutralization.
- **chromatogram** (`chem.chromatogram`; LS, UP)
  - **Draws:** paper with the baseline, the solvent front and lettered spots on a cm grid, for a mixture and reference dyes.
  - **Asks:** the Rf value (exact); which dyes the mixture holds (letters); the number of substances.
  - **Concepts:** chromatography, separation-techniques, laboratory-techniques.
- Commit: `feat(figgen): chemistry: analysis`.

### Task 9: Link, look, review, sheets and record

- [ ] **Link report** for all 23 families, read-only and by topic name. AVOID misfits, each as a ruling.
- [ ] **Look** at one PNG of every sub-type and fix what a student would trip on.
- [ ] **Fresh review** of the batch by an Opus subagent, then one fix pass.
- [ ] **Sheets:**
  - `wave_sheet.py --subject physics --families=<the 9> --label "P3g, the Physics gaps"`;
  - `wave_sheet.py --subject chemistry --label "P3g, the Chemistry wave"`.

  Publish both.
- [ ] **Record** a P3g result in the spec and in memory. Commit. Stop for the user's verdict. P3h (draw 30, blind review, approve, volume) waits for it.
